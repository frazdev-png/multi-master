<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class AdminController {
    private $db;
    private $auth;
    private $productColumns;
    private $validatedProductColumns;
    private $userColumns;
    private $realtimeTableChecked;
    private $hasRealtimeEvents;

    public function __construct() {
        $this->db = new Database();
        $this->auth = new AuthMiddleware();
        $this->productColumns = null;
        $this->validatedProductColumns = [];
        $this->userColumns = null;
        $this->realtimeTableChecked = false;
        $this->hasRealtimeEvents = false;
    }

    private function getRequestPath() {
        return parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    }

    private function getJsonBody() {
        $raw = file_get_contents('php://input');
        if (!$raw) return [];
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    private function ensureRealtimeEventsSupport() {
        if ($this->realtimeTableChecked) return;
        $this->realtimeTableChecked = true;

        try {
            $stmt = $this->db->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'realtime_events' LIMIT 1");
            $stmt->execute();
            $this->hasRealtimeEvents = (bool)$stmt->fetch(PDO::FETCH_NUM);
        } catch (Exception $e) {
            $this->hasRealtimeEvents = false;
        }
    }

    public function approveDeposit($depositId) {
        $admin = $this->auth->authenticate('admin');
        $depositId = (int)$depositId;
        if ($depositId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid deposit id']);
            return;
        }

        $data = $this->getJsonBody();
        $approvalNote = isset($data['note']) ? trim((string)$data['note']) : null;

        try {
            $this->db->beginTransaction();

            $stmt = $this->db->prepare("SELECT * FROM customer_deposits WHERE id = ? LIMIT 1 FOR UPDATE");
            $stmt->execute([$depositId]);
            $d = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$d) {
                $this->db->rollBack();
                http_response_code(404);
                echo json_encode(['error' => 'Deposit not found']);
                return;
            }

            $status = strtolower((string)($d['status'] ?? ''));
            if ($status === 'completed') {
                // Idempotent approve
                $this->db->commit();
                echo json_encode(['success' => true, 'already_completed' => true]);
                return;
            }

            if ($status !== 'pending') {
                $this->db->rollBack();
                http_response_code(400);
                echo json_encode(['error' => 'Only pending deposits can be approved']);
                return;
            }

            $customerId = (int)($d['customer_id'] ?? 0);
            $amount = (float)($d['amount'] ?? 0);
            if ($customerId <= 0 || $amount <= 0) {
                $this->db->rollBack();
                http_response_code(400);
                echo json_encode(['error' => 'Invalid deposit record']);
                return;
            }

            $ip = $_SERVER['REMOTE_ADDR'] ?? null;

            $this->ensureWalletRow($customerId);

            $stmt = $this->db->prepare("SELECT id FROM wallet_transactions WHERE user_id = ? AND reference_type = 'deposit' AND reference_id = ? AND direction = 'credit' LIMIT 1");
            $stmt->execute([$customerId, $depositId]);
            $existingCredit = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$existingCredit) {
                $stmt = $this->db->prepare("UPDATE wallets SET balance = balance + ?, updated_at = NOW() WHERE user_id = ?");
                $stmt->execute([$amount, $customerId]);

                $stmt = $this->db->prepare("INSERT INTO wallet_transactions (user_id, direction, amount, currency, reference_type, reference_id, description, created_at) VALUES (?, 'credit', ?, 'USDT', 'deposit', ?, 'Deposit approved', NOW())");
                $stmt->execute([$customerId, $amount, $depositId]);
            }

            $stmt = $this->db->prepare("UPDATE customer_deposits SET status = 'completed', approved_by_admin_id = ?, approved_at = NOW(), approved_ip = ?, credited_at = COALESCE(credited_at, NOW()), updated_at = NOW() WHERE id = ?");
            $stmt->execute([(int)$admin['id'], $ip, $depositId]);

            $this->logDepositAction($depositId, 'approved', (int)$admin['id'], [
                'note' => $approvalNote,
            ]);

            $this->emitRealtimeEvent('deposit_updated', ['deposit_id' => $depositId, 'status' => 'completed'], 'admin', null);
            $this->emitRealtimeEvent('deposit_updated', ['deposit_id' => $depositId, 'status' => 'completed'], null, $customerId);

            $this->db->commit();
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            try {
                $this->db->rollBack();
            } catch (Exception $ignore) {
            }
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function createSubscriber() {
        $admin = $this->auth->authenticate('admin');
        $data = $this->getJsonBody();
        $email = strtolower(trim((string)($data['email'] ?? '')));
        $status = strtolower(trim((string)($data['status'] ?? 'subscribed')));

        if (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $email)) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid email is required']);
            return;
        }
        if (!in_array($status, ['subscribed', 'unsubscribed'], true)) {
            $status = 'subscribed';
        }

        try {
            $subAt = $status === 'subscribed' ? date('Y-m-d H:i:s') : null;
            $unsubAt = $status === 'unsubscribed' ? date('Y-m-d H:i:s') : null;

            $stmt = $this->db->prepare("INSERT INTO newsletter_subscribers (email, status, subscribed_at, unsubscribed_at, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())");
            $stmt->execute([$email, $status, $subAt, $unsubAt]);
            $id = (int)$this->db->lastInsertId();

            $this->emitRealtimeEvent('subscriber_created', ['subscriber_id' => $id], 'admin', null);
            http_response_code(201);
            echo json_encode(['success' => true, 'subscriber_id' => $id]);
        } catch (PDOException $e) {
            // Duplicate email -> treat as update
            if ($e->getCode() === '23000') {
                try {
                    $stmt = $this->db->prepare("UPDATE newsletter_subscribers SET status = ?, subscribed_at = COALESCE(subscribed_at, NOW()), unsubscribed_at = CASE WHEN ? = 'unsubscribed' THEN NOW() ELSE NULL END, updated_at = NOW() WHERE email = ?");
                    $stmt->execute([$status, $status, $email]);
                    $stmt = $this->db->prepare("SELECT id FROM newsletter_subscribers WHERE email = ? LIMIT 1");
                    $stmt->execute([$email]);
                    $row = $stmt->fetch(PDO::FETCH_ASSOC);
                    $id = (int)($row['id'] ?? 0);
                    $this->emitRealtimeEvent('subscriber_updated', ['subscriber_id' => $id, 'status' => $status], 'admin', null);
                    echo json_encode(['success' => true, 'subscriber_id' => $id, 'updated' => true]);
                    return;
                } catch (Exception $ignore) {
                }
            }

            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function emitRealtimeEvent($eventType, $payload, $targetRole = null, $targetUserId = null) {
        $this->ensureRealtimeEventsSupport();
        if (!$this->hasRealtimeEvents) return;

        try {
            $stmt = $this->db->prepare("INSERT INTO realtime_events (event_type, target_role, target_user_id, payload, processed, created_at) VALUES (?, ?, ?, ?, 0, NOW())");
            $stmt->execute([(string)$eventType, $targetRole !== null ? (string)$targetRole : null, $targetUserId !== null ? (int)$targetUserId : null, json_encode($payload)]);
        } catch (Exception $e) {
        }
    }

    private function ensureWalletRow($userId) {
        try {
            $stmt = $this->db->prepare("SELECT user_id FROM wallets WHERE user_id = ? LIMIT 1");
            $stmt->execute([(int)$userId]);
            if ($stmt->fetch(PDO::FETCH_ASSOC)) {
                return;
            }
            $stmt = $this->db->prepare("INSERT INTO wallets (user_id, balance, updated_at) VALUES (?, 0.00, NOW())");
            $stmt->execute([(int)$userId]);
        } catch (Exception $e) {
        }
    }

    private function logDepositAction($depositId, $action, $adminId, $details = null) {
        try {
            $ip = $_SERVER['REMOTE_ADDR'] ?? null;
            $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
            $payload = null;
            if ($details !== null) {
                $payload = is_string($details) ? $details : json_encode($details);
            }
            $stmt = $this->db->prepare("INSERT INTO deposit_logs (deposit_id, action, actor_admin_id, ip_address, user_agent, details, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
            $stmt->execute([(int)$depositId, (string)$action, $adminId !== null ? (int)$adminId : null, $ip, $ua, $payload]);
        } catch (Exception $e) {
        }
    }

    public function getEarnings() {
        $user = $this->auth->authenticate('admin');

        $search = trim((string)($_GET['search'] ?? ''));
        $limit = min((int)($_GET['limit'] ?? 50), 200);
        $offset = (int)($_GET['offset'] ?? 0);

        try {
            $sql = "
                SELECT
                    u.id as seller_id,
                    u.email,
                    u.full_name,
                    u.created_at,
                    COALESCE(s.store_name, s.business_name, '') as store_name,
                    COALESCE(s.commission_rate, 10.00) as commission_rate,
                    COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total_amount ELSE 0 END), 0) as total_sales,
                    (SELECT COALESCE(SUM(w.amount), 0) FROM withdrawals w WHERE w.seller_id = u.id AND LOWER(w.status) = 'pending') as pending_withdrawals,
                    (SELECT COALESCE(SUM(wt.amount), 0) FROM wallet_transactions wt WHERE wt.user_id = u.id AND wt.reference_type = 'withdrawal' AND wt.direction = 'debit') as total_withdrawn,
                    (SELECT COALESCE(balance, 0) FROM wallets wa WHERE wa.user_id = u.id LIMIT 1) as wallet_balance
                FROM users u
                LEFT JOIN sellers s ON s.user_id = u.id
                LEFT JOIN orders o ON o.seller_id = u.id
                WHERE u.role = 'seller'
            ";

            $params = [];
            if ($search !== '') {
                $sql .= " AND (u.email LIKE ? OR u.full_name LIKE ? OR s.store_name LIKE ? OR s.business_name LIKE ?)";
                $q = "%{$search}%";
                $params[] = $q;
                $params[] = $q;
                $params[] = $q;
                $params[] = $q;
            }

            $sql .= " GROUP BY u.id ORDER BY total_sales DESC LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;

            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $vendors = [];
            $summarySales = 0.0;
            $summaryAdminEarnings = 0.0;
            $summaryPending = 0.0;

            foreach ($rows as $r) {
                $sales = (float)($r['total_sales'] ?? 0);
                $commission = (float)($r['commission_rate'] ?? 10.0);
                $adminEarnings = round($sales * ($commission / 100.0), 2);
                $pending = (float)($r['pending_withdrawals'] ?? 0);

                $summarySales += $sales;
                $summaryAdminEarnings += $adminEarnings;
                $summaryPending += $pending;

                $vendors[] = [
                    'seller_id' => (int)$r['seller_id'],
                    'store_name' => (string)($r['store_name'] ?? ''),
                    'owner_name' => (string)($r['full_name'] ?? ''),
                    'email' => (string)($r['email'] ?? ''),
                    'commission_rate' => $commission,
                    'total_sales' => $sales,
                    'admin_earnings' => $adminEarnings,
                    'pending_withdrawals' => $pending,
                    'total_withdrawn' => (float)($r['total_withdrawn'] ?? 0),
                    'wallet_balance' => (float)($r['wallet_balance'] ?? 0),
                    'created_at' => $r['created_at'] ?? null,
                ];
            }

            header('Content-Type: application/json');
            echo json_encode([
                'summary' => [
                    'platform_sales' => round($summarySales, 2),
                    'admin_commission_earned' => round($summaryAdminEarnings, 2),
                    'pending_withdrawals' => round($summaryPending, 2),
                ],
                'vendors' => $vendors,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function updateGlobalCommission() {
        $user = $this->auth->authenticate('admin');
        $data = $this->getJsonBody();
        $rate = isset($data['rate']) ? (float)$data['rate'] : 0;

        if ($rate < 0 || $rate > 100) {
            http_response_code(400);
            echo json_encode(['error' => 'Commission rate must be between 0 and 100']);
            return;
        }

        try {
            $conn = $this->db->getConnection();

            $stmt = $conn->prepare("UPDATE sellers SET commission_rate = ?");
            $stmt->execute([$rate]);

            echo json_encode(['success' => true, 'message' => 'Global commission rate updated to ' . $rate . '%']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function listDeposits() {
        $user = $this->auth->authenticate('admin');

        $limit = min((int)($_GET['limit'] ?? 50), 200);
        $offset = (int)($_GET['offset'] ?? 0);
        $status = strtolower(trim((string)($_GET['status'] ?? '')));
        $search = trim((string)($_GET['search'] ?? ''));

        try {
            $sql = "
                SELECT
                    d.id,
                    d.customer_id,
                    d.amount,
                    d.currency,
                    d.method,
                    d.status,
                    d.internal_note,
                    d.created_by_admin_id,
                    d.created_ip,
                    d.approved_by_admin_id,
                    d.approved_at,
                    d.approved_ip,
                    d.credited_at,
                    d.instant_credit,
                    d.instant_reason,
                    d.created_at,
                    u.email as customer_email,
                    u.full_name as customer_name,
                    cu.email as created_by_email,
                    au.email as approved_by_email
                FROM customer_deposits d
                JOIN users u ON u.id = d.customer_id
                LEFT JOIN users cu ON cu.id = d.created_by_admin_id
                LEFT JOIN users au ON au.id = d.approved_by_admin_id
                WHERE 1=1
            ";
            $params = [];

            if ($status !== '' && $status !== 'all') {
                $sql .= " AND LOWER(d.status) = ?";
                $params[] = $status;
            }

            if ($search !== '') {
                $sql .= " AND (u.email LIKE ? OR u.full_name LIKE ? OR CAST(d.id AS CHAR) LIKE ?)";
                $q = "%{$search}%";
                $params[] = $q;
                $params[] = $q;
                $params[] = $q;
            }

            $sql .= " ORDER BY d.created_at DESC LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;

            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            header('Content-Type: application/json');
            echo json_encode(['deposits' => $rows]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function createDeposit() {
        $admin = $this->auth->authenticate('admin');
        $data = $this->getJsonBody();

        $customerId = (int)($data['customer_id'] ?? 0);
        $amount = $data['amount'] ?? null;
        $method = isset($data['method']) ? strtolower(trim((string)$data['method'])) : null;
        $internalNote = isset($data['internal_note']) ? trim((string)$data['internal_note']) : '';
        $status = strtolower(trim((string)($data['status'] ?? 'pending')));
        $instantCredit = !empty($data['instant_credit']);
        $instantReason = isset($data['instant_reason']) ? trim((string)$data['instant_reason']) : '';

        $allowedMethods = ['manual', 'bank', 'crypto', 'adjustment'];
        if ($method !== null && $method !== '' && !in_array($method, $allowedMethods, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid payment method']);
            return;
        }

        if ($internalNote === '') {
            http_response_code(400);
            echo json_encode(['error' => 'internal_note is required']);
            return;
        }

        if ($customerId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'customer_id is required']);
            return;
        }
        if (!is_numeric($amount) || (float)$amount <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid amount is required']);
            return;
        }
        if (!in_array($status, ['pending', 'failed', 'completed'], true)) {
            $status = 'pending';
        }

        // Force safety: only instant_credit can create a completed deposit.
        if ($status === 'completed' && !$instantCredit) {
            $status = 'pending';
        }

        if ($instantCredit) {
            $isSuper = (int)($admin['is_super_admin'] ?? 0) === 1;
            if (!$isSuper) {
                http_response_code(403);
                echo json_encode(['error' => 'Instant credit requires super admin']);
                return;
            }
            if ($instantReason === '') {
                http_response_code(400);
                echo json_encode(['error' => 'instant_reason is required']);
                return;
            }
            $status = 'completed';
        }

        $amount = round((float)$amount, 2);

        try {
            $this->db->beginTransaction();

            $stmt = $this->db->prepare("SELECT id FROM users WHERE id = ? AND role = 'customer' LIMIT 1");
            $stmt->execute([$customerId]);
            if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                $this->db->rollBack();
                http_response_code(404);
                echo json_encode(['error' => 'Customer not found']);
                return;
            }

            $ip = $_SERVER['REMOTE_ADDR'] ?? null;

            $stmt = $this->db->prepare("INSERT INTO customer_deposits (customer_id, amount, currency, method, status, created_by_admin_id, created_ip, internal_note, instant_credit, instant_reason, created_at, updated_at) VALUES (?, ?, 'USDT', ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
            $stmt->execute([$customerId, $amount, $method, $status, (int)$admin['id'], $ip, $internalNote, $instantCredit ? 1 : 0, $instantCredit ? $instantReason : null]);
            $depositId = (int)$this->db->lastInsertId();

            $this->logDepositAction($depositId, 'created', (int)$admin['id'], [
                'customer_id' => $customerId,
                'amount' => $amount,
                'currency' => 'USDT',
                'method' => $method,
                'status' => $status,
                'internal_note' => $internalNote,
                'instant_credit' => $instantCredit,
                'instant_reason' => $instantCredit ? $instantReason : null,
            ]);

            if ($instantCredit) {
                // Atomically approve + credit.
                $this->ensureWalletRow($customerId);

                $stmt = $this->db->prepare("SELECT id FROM wallet_transactions WHERE user_id = ? AND reference_type = 'deposit' AND reference_id = ? AND direction = 'credit' LIMIT 1");
                $stmt->execute([$customerId, $depositId]);
                $existingCredit = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$existingCredit) {
                    $stmt = $this->db->prepare("UPDATE wallets SET balance = balance + ?, updated_at = NOW() WHERE user_id = ?");
                    $stmt->execute([$amount, $customerId]);

                    $stmt = $this->db->prepare("INSERT INTO wallet_transactions (user_id, direction, amount, currency, reference_type, reference_id, description, created_at) VALUES (?, 'credit', ?, 'USDT', 'deposit', ?, 'Deposit credited', NOW())");
                    $stmt->execute([$customerId, $amount, $depositId]);
                }

                $stmt = $this->db->prepare("UPDATE customer_deposits SET approved_by_admin_id = ?, approved_at = NOW(), approved_ip = ?, credited_at = NOW(), updated_at = NOW() WHERE id = ?");
                $stmt->execute([(int)$admin['id'], $ip, $depositId]);

                $this->logDepositAction($depositId, 'instant_credited', (int)$admin['id'], [
                    'reason' => $instantReason,
                ]);
            }

            $this->emitRealtimeEvent('deposit_created', ['deposit_id' => $depositId], 'admin', null);
            $this->emitRealtimeEvent('deposit_created', ['deposit_id' => $depositId], null, $customerId);

            $this->db->commit();
            http_response_code(201);
            echo json_encode(['success' => true, 'deposit_id' => $depositId]);
        } catch (Exception $e) {
            try {
                $this->db->rollBack();
            } catch (Exception $ignore) {
            }
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function listSubscribers() {
        $admin = $this->auth->authenticate('admin');

        $limit = min((int)($_GET['limit'] ?? 50), 200);
        $offset = (int)($_GET['offset'] ?? 0);
        $status = strtolower(trim((string)($_GET['status'] ?? '')));
        $search = trim((string)($_GET['search'] ?? ''));

        try {
            $sql = "SELECT id, email, status, subscribed_at, unsubscribed_at, created_at, updated_at FROM newsletter_subscribers WHERE 1=1";
            $params = [];

            if ($status !== '' && $status !== 'all') {
                $sql .= " AND LOWER(status) = ?";
                $params[] = $status;
            }

            if ($search !== '') {
                $sql .= " AND email LIKE ?";
                $params[] = "%{$search}%";
            }

            $sql .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;

            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            header('Content-Type: application/json');
            echo json_encode(['subscribers' => $rows]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function updateSubscriber($id) {
        $admin = $this->auth->authenticate('admin');
        $id = (int)$id;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid subscriber id']);
            return;
        }

        $data = $this->getJsonBody();
        $status = strtolower(trim((string)($data['status'] ?? '')));
        if (!in_array($status, ['subscribed', 'unsubscribed'], true)) {
            http_response_code(400);
            echo json_encode(['error' => 'status must be subscribed or unsubscribed']);
            return;
        }

        try {
            $unsubAt = $status === 'unsubscribed' ? 'NOW()' : 'NULL';
            $subAt = $status === 'subscribed' ? 'NOW()' : 'subscribed_at';
            $stmt = $this->db->prepare("UPDATE newsletter_subscribers SET status = ?, unsubscribed_at = {$unsubAt}, subscribed_at = {$subAt}, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$status, $id]);

            $this->emitRealtimeEvent('subscriber_updated', ['subscriber_id' => $id, 'status' => $status], 'admin', null);
            echo json_encode(['success' => true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function deleteSubscriber($id) {
        $admin = $this->auth->authenticate('admin');
        $id = (int)$id;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid subscriber id']);
            return;
        }

        try {
            $stmt = $this->db->prepare('DELETE FROM newsletter_subscribers WHERE id = ?');
            $stmt->execute([$id]);

            $this->emitRealtimeEvent('subscriber_deleted', ['subscriber_id' => $id], 'admin', null);
            echo json_encode(['success' => true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function getUserColumns() {
        if (is_array($this->userColumns)) {
            return $this->userColumns;
        }

        try {
            $stmt = $this->db->prepare("SHOW COLUMNS FROM users");
            $stmt->execute();
            $cols = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                if (isset($row['Field'])) {
                    $cols[$row['Field']] = true;
                }
            }
            $this->userColumns = $cols;
            return $this->userColumns;
        } catch (Exception $e) {
            $this->userColumns = [];
            return $this->userColumns;
        }
    }

    private function hasUserColumn($name) {
        $cols = $this->getUserColumns();
        return isset($cols[$name]);
    }

    private function disableProductColumn($name) {
        $this->validatedProductColumns[$name] = false;
        $cols = $this->getProductColumns();
        unset($cols[$name]);
        $this->productColumns = $cols;
    }

    private function runWithIsActiveFallback(callable $fn) {
        try {
            return $fn();
        } catch (PDOException $e) {
            if ($e->getCode() === '42S22' && stripos($e->getMessage(), 'is_active') !== false) {
                $this->disableProductColumn('is_active');
                return $fn();
            }
            throw $e;
        }
    }

    private function getProductColumns() {
        if (is_array($this->productColumns)) {
            return $this->productColumns;
        }

        try {
            $stmt = $this->db->prepare("SHOW COLUMNS FROM products");
            $stmt->execute();
            $cols = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                if (isset($row['Field'])) {
                    $cols[$row['Field']] = true;
                }
            }
            $this->productColumns = $cols;
            return $this->productColumns;
        } catch (Exception $e) {
            $this->productColumns = [];
            return $this->productColumns;
        }
    }

    private function hasProductColumn($name) {
        $cols = $this->getProductColumns();
        if (!isset($cols[$name])) {
            return false;
        }

        if (in_array($name, ['is_active', 'status', 'is_published'], true)) {
            return $this->probeProductColumn($name);
        }

        return true;
    }

    private function probeProductColumn($name) {
        if (array_key_exists($name, $this->validatedProductColumns)) {
            return (bool)$this->validatedProductColumns[$name];
        }

        try {
            $stmt = $this->db->prepare("SELECT 1 FROM products WHERE {$name} IS NOT NULL LIMIT 1");
            $stmt->execute();
            $this->validatedProductColumns[$name] = true;
            return true;
        } catch (PDOException $e) {
            $this->validatedProductColumns[$name] = false;
            $cols = $this->getProductColumns();
            unset($cols[$name]);
            $this->productColumns = $cols;
            return false;
        }
    }

    private function activeProductCondition($alias = 'p') {
        if ($this->hasProductColumn('is_active')) {
            return "{$alias}.is_active = 1";
        }
        if ($this->hasProductColumn('status')) {
            return "{$alias}.status = 'active'";
        }
        if ($this->hasProductColumn('is_published')) {
            return "{$alias}.is_published = 1";
        }
        return "1=1";
    }

    public function updateVendorStatus() {
        $user = $this->auth->authenticate();
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Admin access required']);
            return;
        }

        $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        if (!preg_match('/\/api\/admin\/vendors\/(\d+)\/status/', $path, $m)) {
            http_response_code(400);
            echo json_encode(['error' => 'Vendor ID is required']);
            return;
        }
        $vendorId = (int)$m[1];

        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) $data = [];

        // accepted: status (Active|Pending|Suspended), is_active (bool), is_approved (bool)
        $status = $data['status'] ?? null;
        $isActive = array_key_exists('is_active', $data) ? (int)(!!$data['is_active']) : null;
        $isApproved = array_key_exists('is_approved', $data) ? (int)(!!$data['is_approved']) : null;

        if ($status) {
            if ($status === 'Active') {
                $isActive = 1;
                $isApproved = 1;
            } elseif ($status === 'Pending') {
                $isActive = 1;
                $isApproved = 0;
            } elseif ($status === 'Suspended') {
                $isActive = 0;
            }
        }

        try {
            $this->db->beginTransaction();

            $statusChanged = false;
            $oldActive = null;
            if ($isActive !== null) {
                $stmt = $this->db->prepare("SELECT is_active FROM users WHERE id = ? AND role = 'seller'");
                $stmt->execute([$vendorId]);
                $oldActive = (int)$stmt->fetchColumn();
                if ($oldActive !== $isActive) $statusChanged = true;

                $stmt = $this->db->prepare("UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ? AND role = 'seller'");
                $stmt->execute([$isActive, $vendorId]);
            }

            if ($isApproved !== null) {
                $stmt = $this->db->prepare("UPDATE sellers SET is_approved = ? WHERE user_id = ?");
                $stmt->execute([$isApproved, $vendorId]);
            }

            if ($statusChanged) {
                $statusText = $isActive ? 'active' : 'suspended';
                $stmt = $this->db->prepare("INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, 'account_status', 'Account $statusText', 'Your seller account has been $statusText by admin.', '/seller')");
                $stmt->execute([$vendorId]);
            }

            $this->db->commit();
            echo json_encode(['success' => true]);
        } catch (PDOException $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function deleteVendor($vendorId) {
        $user = $this->auth->authenticate();
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Admin access required']);
            return;
        }

        $vendorId = (int)$vendorId;
        if ($vendorId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid vendor ID']);
            return;
        }

        try {
            $this->db->beginTransaction();

            $stmt = $this->db->prepare("SELECT id FROM users WHERE id = ? AND role = 'seller'");
            $stmt->execute([$vendorId]);
            if (!$stmt->fetch()) {
                $this->db->rollBack();
                http_response_code(404);
                echo json_encode(['error' => 'Vendor not found']);
                return;
            }

            $stmt = $this->db->prepare("DELETE FROM sellers WHERE user_id = ?");
            $stmt->execute([$vendorId]);

            $stmt = $this->db->prepare("DELETE FROM users WHERE id = ? AND role = 'seller'");
            $stmt->execute([$vendorId]);

            $this->db->commit();
            echo json_encode(['success' => true, 'message' => 'Vendor deleted permanently']);
        } catch (PDOException $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function getVendors() {
        // Authenticate admin
        $user = $this->auth->authenticate();
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Admin access required']);
            return;
        }

        $search = $_GET['search'] ?? '';
        $status = $_GET['status'] ?? '';
        $limit = min($_GET['limit'] ?? 50, 100);
        $offset = $_GET['offset'] ?? 0;

        try {
            $vendors = $this->runWithIsActiveFallback(function () use ($search, $status, $limit, $offset) {
                $activeProduct = $this->activeProductCondition('p');
                $userIsActiveSelect = $this->hasUserColumn('is_active') ? 'u.is_active' : '1 as is_active';
                $sql = "
                SELECT
                    u.id as user_id,
                    u.full_name,
                    u.email,
                    u.phone,
                    {$userIsActiveSelect},
                    u.created_at,
                    u.last_seen,
                    s.business_name,
                    s.store_name,
                    s.store_address,
                    s.is_approved,
                    s.commission_rate,
                    s.document_type,
                    s.id_front_image_url,
                    s.id_back_image_url,
                    (SELECT COUNT(*) FROM products p WHERE p.seller_id = u.id AND {$activeProduct}) as products,
                    (SELECT COUNT(*) FROM orders o WHERE o.seller_id = u.id) as orders,
                    (SELECT COALESCE(SUM(o.total_amount),0) FROM orders o WHERE o.seller_id = u.id AND o.status != 'cancelled') as earnings
                FROM users u
                LEFT JOIN sellers s ON s.user_id = u.id
                WHERE u.role = 'seller'
            ";
                $params = [];

                if ($search !== '') {
                    $sql .= " AND (u.full_name LIKE ? OR u.email LIKE ? OR s.store_name LIKE ?)";
                    $q = "%{$search}%";
                    $params[] = $q;
                    $params[] = $q;
                    $params[] = $q;
                }

                if ($status !== '' && $status !== 'all') {
                    if ($status === 'Active') {
                        if ($this->hasUserColumn('is_active')) {
                            $sql .= " AND u.is_active = 1";
                        }
                        $sql .= " AND COALESCE(s.is_approved, 0) = 1";
                    } elseif ($status === 'Pending') {
                        if ($this->hasUserColumn('is_active')) {
                            $sql .= " AND u.is_active = 1";
                        }
                        $sql .= " AND COALESCE(s.is_approved, 0) = 0";
                    } elseif ($status === 'Suspended') {
                        if ($this->hasUserColumn('is_active')) {
                            $sql .= " AND u.is_active = 0";
                        } else {
                            $sql .= " AND 1=0";
                        }
                    }
                }

                $sql .= " ORDER BY u.created_at DESC LIMIT ? OFFSET ?";
                $params[] = (int)$limit;
                $params[] = (int)$offset;

                $stmt = $this->db->prepare($sql);
                $stmt->execute($params);
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            });

            // Normalize fields for frontend
            $result = [];
            foreach ($vendors as $v) {
                $vendorStatus = 'Pending';
                if ((int)$v['is_active'] === 0) {
                    $vendorStatus = 'Suspended';
                } elseif ((int)($v['is_approved'] ?? 0) === 1) {
                    $vendorStatus = 'Active';
                }

                $result[] = [
                    'id' => (int)$v['user_id'],
                    'name' => $v['store_name'] ?: ($v['business_name'] ?: 'Seller'),
                    'owner' => $v['full_name'] ?: '',
                    'email' => $v['email'] ?: '',
                    'phone' => $v['phone'] ?: '',
                    'address' => $v['store_address'] ?: '',
                    'products' => (int)$v['products'],
                    'orders' => (int)$v['orders'],
                    'earnings' => (float)$v['earnings'],
                    'verified' => (int)($v['is_approved'] ?? 0) === 1,
                    'status' => $vendorStatus,
                    'commission' => (float)($v['commission_rate'] ?? 10.0),
                    'joinDate' => $v['created_at'],
                    'lastActive' => $v['last_seen'],
                    'document_type' => $v['document_type'] ?? 'identity-card',
                    'id_front_image_url' => $v['id_front_image_url'] ?? null,
                    'id_back_image_url' => $v['id_back_image_url'] ?? null,
                ];
            }

            header('Content-Type: application/json');
            echo json_encode(['vendors' => $result]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function getDashboardStats() {
        // Authenticate admin
        $user = $this->auth->authenticate();
        
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Admin access required']);
            return;
        }

        try {
            // Get dashboard stats
            $stats = [];
            
            // Total users
            $usersActiveWhere = $this->hasUserColumn('is_active') ? 'WHERE is_active = 1' : '';
            $stmt = $this->db->prepare("
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_users
                FROM users
                {$usersActiveWhere}
            ");
            $stmt->execute();
            $userStats = $stmt->fetch();
            $stats['total_users'] = $userStats['total_users'];
            $stats['new_users'] = $userStats['new_users'];
            
            // Total orders and revenue
            $stmt = $this->db->prepare("
                SELECT 
                    COUNT(*) as total_orders,
                    COALESCE(SUM(total_amount), 0) as total_revenue,
                    COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_orders
                FROM orders
                WHERE status != 'cancelled'
            ");
            $stmt->execute();
            $orderStats = $stmt->fetch();
            $stats['total_orders'] = $orderStats['total_orders'];
            $stats['total_revenue'] = $orderStats['total_revenue'];
            $stats['new_orders'] = $orderStats['new_orders'];
            
            // Active sellers
            $sellerActiveWhere = "WHERE role = 'seller'";
            if ($this->hasUserColumn('is_active')) {
                $sellerActiveWhere .= " AND is_active = 1";
            }
            $stmt = $this->db->prepare("
                SELECT 
                    COUNT(*) as active_sellers,
                    COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_sellers
                FROM users
                {$sellerActiveWhere}
            ");
            $stmt->execute();
            $sellerStats = $stmt->fetch();
            $stats['active_sellers'] = $sellerStats['active_sellers'];
            $stats['new_sellers'] = $sellerStats['new_sellers'];
            
            // Frozen accounts
            if ($this->hasUserColumn('is_active')) {
                $stmt = $this->db->prepare("
                    SELECT COUNT(*) as frozen_accounts
                    FROM users
                    WHERE is_active = 0
                ");
                $stmt->execute();
                $frozenStats = $stmt->fetch();
                $stats['frozen_accounts'] = $frozenStats['frozen_accounts'];
            } else {
                $stats['frozen_accounts'] = 0;
            }
            
            header('Content-Type: application/json');
            echo json_encode(['stats' => $stats]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function getRecentOrders() {
        // Authenticate admin
        $user = $this->auth->authenticate();
        
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Admin access required']);
            return;
        }

        $limit = min($_GET['limit'] ?? 10, 50);

        try {
            $stmt = $this->db->prepare("
                SELECT 
                    o.id,
                    o.status,
                    o.total_amount,
                    o.created_at,
                    u.full_name as customer_name,
                    u.email as customer_email,
                    s.full_name as seller_name,
                    ss.store_name
                FROM orders o
                JOIN users u ON o.customer_id = u.id
                JOIN users s ON o.seller_id = s.id
                LEFT JOIN sellers ss ON ss.user_id = s.id
                ORDER BY o.created_at DESC
                LIMIT ?
            ");
            $stmt->execute([$limit]);
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            header('Content-Type: application/json');
            echo json_encode(['orders' => $orders]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function getFrozenAccounts() {
        // Authenticate admin
        $user = $this->auth->authenticate();
        
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Admin access required']);
            return;
        }

        try {
            if (!$this->hasUserColumn('is_active')) {
                header('Content-Type: application/json');
                echo json_encode(['accounts' => []]);
                return;
            }
            $stmt = $this->db->prepare("
                SELECT id, full_name, email, role, created_at, last_seen
                FROM users
                WHERE is_active = 0
                ORDER BY created_at DESC
                LIMIT 20
            ");
            $stmt->execute();
            $accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            header('Content-Type: application/json');
            echo json_encode(['accounts' => $accounts]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function getUsers() {
        // Authenticate admin
        $user = $this->auth->authenticate();
        
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Admin access required']);
            return;
        }

        $role = $_GET['role'] ?? '';
        $status = $_GET['status'] ?? '';
        $search = $_GET['search'] ?? '';
        $limit = min($_GET['limit'] ?? 20, 50);
        $offset = $_GET['offset'] ?? 0;

        try {
            $userIsActiveSelect = $this->hasUserColumn('is_active') ? 'is_active' : '1 as is_active';
            $sql = "
                SELECT id, full_name, email, role, phone, {$userIsActiveSelect}, created_at, last_seen
                FROM users
                WHERE 1=1
            ";
            $params = [];
            
            if (!empty($role)) {
                $sql .= " AND role = ?";
                $params[] = $role;
            }
            
            if ($status === 'active') {
                if ($this->hasUserColumn('is_active')) {
                    $sql .= " AND is_active = 1";
                }
            } elseif ($status === 'inactive') {
                if ($this->hasUserColumn('is_active')) {
                    $sql .= " AND is_active = 0";
                } else {
                    $sql .= " AND 1=0";
                }
            }
            
            if (!empty($search)) {
                $sql .= " AND (full_name LIKE ? OR email LIKE ?)";
                $searchParam = "%{$search}%";
                $params[] = $searchParam;
                $params[] = $searchParam;
            }
            
            $sql .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            header('Content-Type: application/json');
            echo json_encode(['users' => $users]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function updateUserStatus() {
        // Authenticate admin
        $user = $this->auth->authenticate();
        
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Admin access required']);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $userId = $data['user_id'] ?? null;
        $isActive = $data['is_active'] ?? null;

        if (!$userId || $isActive === null) {
            http_response_code(400);
            echo json_encode(['error' => 'User ID and status are required']);
            return;
        }

        try {
            if (!$this->hasUserColumn('is_active')) {
                http_response_code(400);
                echo json_encode(['error' => 'User status update is not supported (users.is_active column missing)']);
                return;
            }
            $stmt = $this->db->prepare("
                UPDATE users 
                SET is_active = ?, updated_at = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$isActive, $userId]);
            
            echo json_encode([
                'success' => true,
                'message' => 'User status updated successfully'
            ]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $requestUri = $_SERVER['REQUEST_URI'];
        $path = $this->getRequestPath();
        
        if ($method === 'GET') {
            if (strpos($requestUri, '/api/admin/dashboard/stats') !== false) {
                $this->getDashboardStats();
            } elseif (strpos($requestUri, '/api/admin/orders/recent') !== false) {
                $this->getRecentOrders();
            } elseif (strpos($requestUri, '/api/admin/accounts/frozen') !== false) {
                $this->getFrozenAccounts();
            } elseif (strpos($requestUri, '/api/admin/vendors') !== false) {
                $this->getVendors();
            } elseif (strpos($requestUri, '/api/admin/users') !== false) {
                $this->getUsers();
            } elseif (strpos($requestUri, '/api/admin/earnings') !== false) {
                $this->getEarnings();
            } elseif (strpos($requestUri, '/api/admin/deposits') !== false) {
                $this->listDeposits();
            } elseif (strpos($requestUri, '/api/admin/subscribers') !== false) {
                $this->listSubscribers();
            }
            return;
        } elseif ($method === 'PUT') {
            if (strpos($requestUri, '/api/admin/vendors') !== false && strpos($requestUri, '/status') !== false) {
                $this->updateVendorStatus();
                return;
            }
            if (strpos($requestUri, '/api/admin/users/status') !== false) {
                $this->updateUserStatus();
                return;
            }

            if (preg_match('#^/api/admin/deposits/(\d+)/approve$#', $path, $m)) {
                $this->approveDeposit($m[1]);
                return;
            }

            if (strpos($requestUri, '/api/admin/earnings/commission') !== false) {
                $this->updateGlobalCommission();
                return;
            }

            if (preg_match('#^/api/admin/subscribers/(\d+)$#', $path, $m)) {
                $this->updateSubscriber($m[1]);
                return;
            }
        } elseif ($method === 'DELETE') {
            if (preg_match('#^/api/admin/subscribers/(\d+)$#', $path, $m)) {
                $this->deleteSubscriber($m[1]);
                return;
            }
            if (preg_match('#^/api/admin/vendors/(\d+)$#', $path, $m)) {
                $this->deleteVendor($m[1]);
                return;
            }
        } elseif ($method === 'POST') {
            if (strpos($requestUri, '/api/admin/deposits') !== false) {
                $this->createDeposit();
                return;
            }
            if (strpos($requestUri, '/api/admin/subscribers') !== false) {
                $this->createSubscriber();
                return;
            }
        }
    }

    // ==================== ROLES & PERMISSIONS ====================

    public function handleRoles() {
        $method = $_SERVER['REQUEST_METHOD'];
        $auth = new AuthMiddleware();
        $auth->authenticate('admin');

        $requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $apiPos = strpos($requestUri, '/api/admin/roles');
        $pathAfter = $apiPos !== false ? substr($requestUri, $apiPos + strlen('/api/admin/roles')) : '';
        $pathAfter = ltrim($pathAfter, '/');
        $roleId = $pathAfter !== '' && is_numeric($pathAfter) ? (int)$pathAfter : null;

        try {
            $conn = $this->db->getConnection();

            if ($method === 'GET' && !$roleId) {
                $stmt = $conn->query("SELECT r.*, GROUP_CONCAT(p.slug) as permission_slugs FROM roles r LEFT JOIN role_permissions rp ON r.id = rp.role_id LEFT JOIN permissions p ON rp.permission_id = p.id GROUP BY r.id ORDER BY r.id");
                $roles = $stmt->fetchAll(PDO::FETCH_ASSOC);
                $this->sendJson(['success' => true, 'roles' => $roles]);
                return;
            }

            if ($method === 'GET' && $roleId) {
                $stmt = $conn->prepare("SELECT r.*, GROUP_CONCAT(p.slug) as permission_slugs FROM roles r LEFT JOIN role_permissions rp ON r.id = rp.role_id LEFT JOIN permissions p ON rp.permission_id = p.id WHERE r.id = ? GROUP BY r.id");
                $stmt->execute([$roleId]);
                $role = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$role) {
                    $this->sendJson(['success' => false, 'error' => 'Role not found'], 404);
                    return;
                }
                $this->sendJson(['success' => true, 'role' => $role]);
                return;
            }

            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                if (!$data || empty($data['name'])) {
                    $this->sendJson(['success' => false, 'error' => 'Role name is required'], 400);
                    return;
                }
                $stmt = $conn->prepare("INSERT INTO roles (name, description) VALUES (?, ?)");
                $stmt->execute([$data['name'], $data['description'] ?? '']);
                $roleId = (int)$conn->lastInsertId();

                if (!empty($data['permissions']) && is_array($data['permissions'])) {
                    foreach ($data['permissions'] as $permSlug) {
                        $pStmt = $conn->prepare("SELECT id FROM permissions WHERE slug = ?");
                        $pStmt->execute([$permSlug]);
                        $permId = $pStmt->fetchColumn();
                        if ($permId) {
                            $conn->prepare("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)")->execute([$roleId, $permId]);
                        }
                    }
                }
                $this->sendJson(['success' => true, 'message' => 'Role created successfully']);
                return;
            }

            if ($method === 'PUT' && $roleId) {
                $data = json_decode(file_get_contents('php://input'), true);
                if (!$data) {
                    $this->sendJson(['success' => false, 'error' => 'Invalid data'], 400);
                    return;
                }
                $stmt = $conn->prepare("UPDATE roles SET name = ?, description = ? WHERE id = ?");
                $stmt->execute([$data['name'] ?? '', $data['description'] ?? '', $roleId]);

                if (isset($data['permissions']) && is_array($data['permissions'])) {
                    $conn->prepare("DELETE FROM role_permissions WHERE role_id = ?")->execute([$roleId]);
                    foreach ($data['permissions'] as $permSlug) {
                        $pStmt = $conn->prepare("SELECT id FROM permissions WHERE slug = ?");
                        $pStmt->execute([$permSlug]);
                        $permId = $pStmt->fetchColumn();
                        if ($permId) {
                            $conn->prepare("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)")->execute([$roleId, $permId]);
                        }
                    }
                }
                $this->sendJson(['success' => true, 'message' => 'Role updated successfully']);
                return;
            }

            if ($method === 'DELETE' && $roleId) {
                $conn->prepare("DELETE FROM roles WHERE id = ?")->execute([$roleId]);
                $this->sendJson(['success' => true, 'message' => 'Role deleted successfully']);
                return;
            }

            $this->sendJson(['success' => false, 'error' => 'Invalid request'], 400);
        } catch (Exception $e) {
            $this->sendJson(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    public function handlePermissions() {
        try {
            $conn = $this->db->getConnection();
            $stmt = $conn->query("SELECT * FROM permissions ORDER BY id");
            $permissions = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $this->sendJson(['success' => true, 'permissions' => $permissions]);
        } catch (Exception $e) {
            $this->sendJson(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // ==================== STAFF MANAGEMENT ====================

    public function handleStaff() {
        $method = $_SERVER['REQUEST_METHOD'];
        $auth = new AuthMiddleware();
        $auth->authenticate('admin');

        $requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $apiPos = strpos($requestUri, '/api/admin/staff');
        $pathAfter = $apiPos !== false ? substr($requestUri, $apiPos + strlen('/api/admin/staff')) : '';
        $pathAfter = ltrim($pathAfter, '/');
        $staffId = $pathAfter !== '' && is_numeric($pathAfter) ? (int)$pathAfter : null;

        try {
            $conn = $this->db->getConnection();

            if ($method === 'GET' && !$staffId) {
                $stmt = $conn->query("SELECT s.*, u.email, u.full_name, u.is_active, r.name as role_name FROM staff s JOIN users u ON s.user_id = u.id LEFT JOIN roles r ON s.role_id = r.id ORDER BY s.id");
                $staffList = $stmt->fetchAll(PDO::FETCH_ASSOC);
                $this->sendJson(['success' => true, 'staff' => $staffList]);
                return;
            }

            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                if (!$data || empty($data['email']) || empty($data['password'])) {
                    $this->sendJson(['success' => false, 'error' => 'Email and password are required'], 400);
                    return;
                }

                $checkStmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
                $checkStmt->execute([$data['email']]);
                $existingUser = $checkStmt->fetch(PDO::FETCH_ASSOC);

                if ($existingUser) {
                    $userId = $existingUser['id'];
                    $updateStmt = $conn->prepare("UPDATE users SET role = 'admin', full_name = ?, is_active = 1 WHERE id = ?");
                    $updateStmt->execute([$data['full_name'] ?? $data['email'], $userId]);
                } else {
                    $hash = password_hash($data['password'], PASSWORD_BCRYPT);
                    $createStmt = $conn->prepare("INSERT INTO users (email, password_hash, role, full_name, is_active) VALUES (?, ?, 'admin', ?, 1)");
                    $createStmt->execute([$data['email'], $hash, $data['full_name'] ?? 'Staff']);
                    $userId = (int)$conn->lastInsertId();
                }

                $staffStmt = $conn->prepare("INSERT INTO staff (user_id, role_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), status = VALUES(status)");
                $roleId = !empty($data['role_id']) ? (int)$data['role_id'] : null;
                $status = !empty($data['status']) ? $data['status'] : 'active';
                $staffStmt->execute([$userId, $roleId, $status]);

                $this->sendJson(['success' => true, 'message' => 'Staff saved successfully']);
                return;
            }

            if ($method === 'PUT' && $staffId) {
                $data = json_decode(file_get_contents('php://input'), true);
                if (isset($data['status'])) {
                    $conn->prepare("UPDATE staff SET status = ? WHERE id = ?")->execute([$data['status'], $staffId]);
                }
                if (isset($data['role_id'])) {
                    $conn->prepare("UPDATE staff SET role_id = ? WHERE id = ?")->execute([(int)$data['role_id'], $staffId]);
                }
                $this->sendJson(['success' => true, 'message' => 'Staff updated successfully']);
                return;
            }

            if ($method === 'DELETE' && $staffId) {
                $stmt = $conn->prepare("SELECT user_id FROM staff WHERE id = ?");
                $stmt->execute([$staffId]);
                $staff = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($staff) {
                    $conn->prepare("UPDATE users SET is_active = 0 WHERE id = ?")->execute([$staff['user_id']]);
                    $conn->prepare("DELETE FROM staff WHERE id = ?")->execute([$staffId]);
                }
                $this->sendJson(['success' => true, 'message' => 'Staff removed successfully']);
                return;
            }

            $this->sendJson(['success' => false, 'error' => 'Invalid request'], 400);
        } catch (Exception $e) {
            $this->sendJson(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    private function sendJson($data, $code = 200) {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}

<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class WithdrawalController {
    private $db;
    private $auth;

    public function __construct() {
        $this->db = new Database();
        $this->auth = new AuthMiddleware();
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

    private function tableExists($table) {
        try {
            $stmt = $this->db->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1");
            $stmt->execute([$table]);
            return (bool)$stmt->fetch(PDO::FETCH_NUM);
        } catch (Exception $e) {
            return false;
        }
    }

    private function ensureWalletRow($userId) {
        try {
            $stmt = $this->db->prepare("SELECT user_id FROM wallets WHERE user_id = ? LIMIT 1");
            $stmt->execute([$userId]);
            if ($stmt->fetch(PDO::FETCH_ASSOC)) {
                return;
            }
            $stmt = $this->db->prepare("INSERT INTO wallets (user_id, balance, updated_at) VALUES (?, 0.00, NOW())");
            $stmt->execute([$userId]);
        } catch (Exception $e) {
        }
    }

    private function sellerGuaranteePolicy($sellerId) {
        $default = [
            'promo_exempt_guarantee' => false,
            'guarantee_required' => true,
            'guarantee_locked_amount' => 0.0,
            'promo_code_used' => null,
        ];

        try {
            $stmt = $this->db->prepare("SELECT promo_exempt_guarantee, guarantee_required, guarantee_locked_amount, promo_code_used FROM sellers WHERE user_id = ? LIMIT 1");
            $stmt->execute([$sellerId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) return $default;

            return [
                'promo_exempt_guarantee' => (int)($row['promo_exempt_guarantee'] ?? 0) === 1,
                'guarantee_required' => (int)($row['guarantee_required'] ?? 1) === 1,
                'guarantee_locked_amount' => (float)($row['guarantee_locked_amount'] ?? 0.0),
                'promo_code_used' => $row['promo_code_used'] ?? null,
            ];
        } catch (Exception $e) {
            return $default;
        }
    }

    private function getWalletBalance($userId) {
        $this->ensureWalletRow($userId);
        try {
            $stmt = $this->db->prepare("SELECT COALESCE(balance, 0) as balance FROM wallets WHERE user_id = ? LIMIT 1");
            $stmt->execute([$userId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return (float)($row['balance'] ?? 0);
        } catch (Exception $e) {
            return 0.0;
        }
    }

    private function computeWithdrawableBalance($sellerId) {
        $balance = $this->getWalletBalance($sellerId);
        $policy = $this->sellerGuaranteePolicy($sellerId);

        $locked = 0.0;
        if (!$policy['promo_exempt_guarantee'] && $policy['guarantee_required']) {
            $locked = max(0.0, (float)$policy['guarantee_locked_amount']);
        }

        return [
            'balance' => $balance,
            'locked' => $locked,
            'available' => max(0.0, $balance - $locked),
            'policy' => $policy,
        ];
    }

    private function validateEmail($email) {
        return is_string($email) && (bool)preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $email);
    }

    private function validatePaymentMethod($method) {
        $m = strtolower(trim((string)$method));
        return in_array($m, ['binance', 'paypal'], true) ? $m : null;
    }

    private function parseAmount($amount) {
        if (is_string($amount)) {
            $amount = trim($amount);
        }
        if (!is_numeric($amount)) return null;
        $v = (float)$amount;
        if ($v <= 0) return null;
        return round($v, 2);
    }

    private function logWithdrawalAction($withdrawalId, $actorRole, $actorId, $action, $details = null) {
        try {
            $ip = $_SERVER['REMOTE_ADDR'] ?? null;
            $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
            $payload = null;
            if ($details !== null) {
                $payload = is_string($details) ? $details : json_encode($details);
            }
            $stmt = $this->db->prepare("INSERT INTO withdrawal_logs (withdrawal_id, actor_role, actor_id, action, details, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())");
            $stmt->execute([(int)$withdrawalId, (string)$actorRole, $actorId !== null ? (int)$actorId : null, (string)$action, $payload, $ip, $ua]);
        } catch (Exception $e) {
        }
    }

    private function emitRealtimeEvent($eventType, $payload, $targetRole = null, $targetUserId = null) {
        if (!$this->tableExists('realtime_events')) return;
        try {
            $stmt = $this->db->prepare("INSERT INTO realtime_events (event_type, target_role, target_user_id, payload, processed, created_at) VALUES (?, ?, ?, ?, 0, NOW())");
            $stmt->execute([(string)$eventType, $targetRole !== null ? (string)$targetRole : null, $targetUserId !== null ? (int)$targetUserId : null, json_encode($payload)]);
        } catch (Exception $e) {
        }
    }

    private function getSellerWallet($user) {
        $info = $this->computeWithdrawableBalance($user['id']);

        header('Content-Type: application/json');
        echo json_encode([
            'wallet' => [
                'balance' => $info['balance'],
                'locked' => $info['locked'],
                'available' => $info['available'],
                'currency' => 'USDT',
                'promo_exempt_guarantee' => $info['policy']['promo_exempt_guarantee'],
                'promo_code_used' => $info['policy']['promo_code_used'],
            ],
        ]);
    }

    private function listSellerWithdrawals($user) {
        $limit = min($_GET['limit'] ?? 50, 100);
        $offset = $_GET['offset'] ?? 0;

        try {
            $stmt = $this->db->prepare("SELECT id, request_email, payment_method, payout_account, account_holder_name, amount, currency, status, admin_notes, decided_at, created_at, updated_at FROM withdrawals WHERE seller_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?");
            $stmt->execute([(int)$user['id'], (int)$limit, (int)$offset]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            header('Content-Type: application/json');
            echo json_encode(['withdrawals' => $rows]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function createSellerWithdrawal($user) {
        $data = $this->getJsonBody();

        $email = $data['email'] ?? '';
        $method = $this->validatePaymentMethod($data['payment_method'] ?? ($data['method'] ?? ''));
        $payoutAccount = trim((string)($data['payout_account'] ?? ($data['wallet_address'] ?? ($data['account_number'] ?? ''))));
        $accountHolder = trim((string)($data['account_holder_name'] ?? ''));
        $amount = $this->parseAmount($data['amount'] ?? null);

        if (!$this->validateEmail($email)) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid email is required']);
            return;
        }
        if (!$method) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid payment method']);
            return;
        }
        if ($payoutAccount === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Account number / wallet address is required']);
            return;
        }
        if ($accountHolder === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Account holder name is required']);
            return;
        }
        if ($amount === null) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid withdrawal amount is required']);
            return;
        }

        try {
            $this->db->beginTransaction();

            $stmt = $this->db->prepare("SELECT id FROM withdrawals WHERE seller_id = ? AND status = 'pending' LIMIT 1");
            $stmt->execute([(int)$user['id']]);
            if ($stmt->fetch(PDO::FETCH_ASSOC)) {
                $this->db->rollBack();
                http_response_code(400);
                echo json_encode(['error' => 'You already have a pending withdrawal request']);
                return;
            }

            $walletInfo = $this->computeWithdrawableBalance($user['id']);
            if ($walletInfo['available'] + 1e-9 < $amount) {
                $this->db->rollBack();
                http_response_code(400);
                echo json_encode(['error' => 'Insufficient withdrawable balance']);
                return;
            }

            $stmt = $this->db->prepare("INSERT INTO withdrawals (seller_id, request_email, payment_method, payout_account, account_holder_name, amount, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'USDT', 'pending', NOW(), NOW())");
            $stmt->execute([(int)$user['id'], $email, $method, $payoutAccount, $accountHolder, $amount]);
            $withdrawalId = (int)$this->db->lastInsertId();

            if ($withdrawalId <= 0) {
                throw new Exception('Failed to create withdrawal');
            }

            $this->logWithdrawalAction($withdrawalId, 'seller', (int)$user['id'], 'request_created', [
                'email' => $email,
                'payment_method' => $method,
                'payout_account' => $payoutAccount,
                'account_holder_name' => $accountHolder,
                'amount' => $amount,
                'currency' => 'USDT',
            ]);

            $this->emitRealtimeEvent('withdrawal_created', ['withdrawal_id' => $withdrawalId], 'admin', null);

            $this->db->commit();

            http_response_code(201);
            echo json_encode(['success' => true, 'withdrawal_id' => $withdrawalId]);
        } catch (Exception $e) {
            try {
                $this->db->rollBack();
            } catch (Exception $ignore) {
            }
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    private function listAdminWithdrawals($user) {
        $limit = min($_GET['limit'] ?? 50, 200);
        $offset = $_GET['offset'] ?? 0;
        $status = strtolower(trim((string)($_GET['status'] ?? '')));
        $method = strtolower(trim((string)($_GET['payment_method'] ?? '')));
        $search = trim((string)($_GET['search'] ?? ''));

        try {
            $sql = "
                SELECT
                    w.id,
                    w.seller_id,
                    w.request_email,
                    w.payment_method,
                    w.payout_account,
                    w.account_holder_name,
                    w.amount,
                    w.currency,
                    w.status,
                    w.admin_id,
                    w.admin_notes,
                    w.decided_at,
                    w.created_at,
                    u.email as seller_email,
                    u.full_name as seller_name,
                    s.store_name as seller_store_name
                FROM withdrawals w
                JOIN users u ON u.id = w.seller_id
                LEFT JOIN sellers s ON s.user_id = u.id
                WHERE 1=1
            ";
            $params = [];

            if ($status !== '' && $status !== 'all') {
                $sql .= " AND LOWER(w.status) = ?";
                $params[] = $status;
            }

            if ($method !== '' && $method !== 'all') {
                $sql .= " AND LOWER(w.payment_method) = ?";
                $params[] = $method;
            }

            if ($search !== '') {
                $sql .= " AND (u.email LIKE ? OR u.full_name LIKE ? OR s.store_name LIKE ? OR CAST(w.id AS CHAR) LIKE ?)";
                $q = "%{$search}%";
                $params[] = $q;
                $params[] = $q;
                $params[] = $q;
                $params[] = $q;
            }

            $sql .= " ORDER BY w.created_at DESC LIMIT ? OFFSET ?";
            $params[] = (int)$limit;
            $params[] = (int)$offset;

            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            header('Content-Type: application/json');
            echo json_encode(['withdrawals' => $rows]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function decideAdminWithdrawal($adminUser, $withdrawalId) {
        $withdrawalId = (int)$withdrawalId;
        if ($withdrawalId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid withdrawal ID']);
            return;
        }

        $data = $this->getJsonBody();
        $decision = strtolower(trim((string)($data['decision'] ?? ($data['status'] ?? ''))));
        $adminNotes = isset($data['admin_notes']) ? (string)$data['admin_notes'] : (isset($data['notes']) ? (string)$data['notes'] : null);

        if (!in_array($decision, ['approved', 'rejected'], true)) {
            http_response_code(400);
            echo json_encode(['error' => 'decision must be approved or rejected']);
            return;
        }

        try {
            $this->db->beginTransaction();

            $stmt = $this->db->prepare("SELECT * FROM withdrawals WHERE id = ? LIMIT 1 FOR UPDATE");
            $stmt->execute([$withdrawalId]);
            $w = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$w) {
                $this->db->rollBack();
                http_response_code(404);
                echo json_encode(['error' => 'Withdrawal not found']);
                return;
            }

            if (strtolower((string)$w['status']) !== 'pending') {
                $this->db->rollBack();
                http_response_code(400);
                echo json_encode(['error' => 'Only pending withdrawals can be processed']);
                return;
            }

            $sellerId = (int)$w['seller_id'];
            $amount = (float)$w['amount'];

            if ($decision === 'approved') {
                $walletInfo = $this->computeWithdrawableBalance($sellerId);
                if ($walletInfo['available'] + 1e-9 < $amount) {
                    $this->db->rollBack();
                    http_response_code(400);
                    echo json_encode(['error' => 'Seller has insufficient withdrawable balance at approval time']);
                    return;
                }

                $this->ensureWalletRow($sellerId);

                $stmt = $this->db->prepare("SELECT id FROM wallet_transactions WHERE user_id = ? AND reference_type = 'withdrawal' AND reference_id = ? AND direction = 'debit' LIMIT 1");
                $stmt->execute([$sellerId, $withdrawalId]);
                $existingDebit = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$existingDebit) {
                    $stmt = $this->db->prepare("UPDATE wallets SET balance = balance - ?, updated_at = NOW() WHERE user_id = ?");
                    $stmt->execute([$amount, $sellerId]);

                    $stmt = $this->db->prepare("INSERT INTO wallet_transactions (user_id, direction, amount, currency, reference_type, reference_id, description, created_at) VALUES (?, 'debit', ?, 'USDT', 'withdrawal', ?, 'Withdrawal approved', NOW())");
                    $stmt->execute([$sellerId, $amount, $withdrawalId]);
                }
            }

            $stmt = $this->db->prepare("UPDATE withdrawals SET status = ?, admin_id = ?, admin_notes = ?, decided_at = NOW(), updated_at = NOW() WHERE id = ?");
            $stmt->execute([$decision, (int)$adminUser['id'], $adminNotes, $withdrawalId]);

            $this->logWithdrawalAction($withdrawalId, 'admin', (int)$adminUser['id'], $decision, [
                'admin_notes' => $adminNotes,
            ]);

            $this->emitRealtimeEvent('withdrawal_updated', ['withdrawal_id' => $withdrawalId, 'status' => $decision], null, $sellerId);
            $this->emitRealtimeEvent('withdrawal_updated', ['withdrawal_id' => $withdrawalId, 'status' => $decision], 'admin', null);

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

    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $path = $this->getRequestPath();

        if (strpos($path, '/api/seller/') === 0) {
            $user = $this->auth->authenticate('seller');

            if ($path === '/api/seller/wallet' && $method === 'GET') {
                $this->getSellerWallet($user);
                return;
            }

            if ($path === '/api/seller/withdrawals') {
                if ($method === 'GET') {
                    $this->listSellerWithdrawals($user);
                    return;
                }
                if ($method === 'POST') {
                    $this->createSellerWithdrawal($user);
                    return;
                }
            }
        }

        if (strpos($path, '/api/admin/') === 0) {
            $user = $this->auth->authenticate('admin');

            if ($path === '/api/admin/withdrawals' && $method === 'GET') {
                $this->listAdminWithdrawals($user);
                return;
            }

            if ($method === 'PUT' && preg_match('#^/api/admin/withdrawals/(\d+)/decision$#', $path, $m)) {
                $this->decideAdminWithdrawal($user, $m[1]);
                return;
            }
        }

        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found']);
    }
}

?>

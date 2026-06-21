<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class WalletController {
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

    private function ensureWalletRow($userId) {
        $stmt = $this->db->prepare("SELECT user_id FROM wallets WHERE user_id = ? LIMIT 1");
        $stmt->execute([$userId]);
        if (!$stmt->fetch()) {
            $this->db->prepare("INSERT INTO wallets (user_id, balance, pending_balance, available_balance, guarantee_balance, total_earnings, total_withdrawn) VALUES (?, 0, 0, 0, 0, 0, 0)")->execute([$userId]);
        }
    }

    private function recordTransaction($userId, $type, $direction, $amount, $note = '', $adminId = null, $adminName = null, $referenceType = null, $referenceId = null) {
        $this->ensureWalletRow($userId);
        $stmt = $this->db->prepare("SELECT pending_balance, available_balance, guarantee_balance, total_earnings, total_withdrawn FROM wallets WHERE user_id = ?");
        $stmt->execute([$userId]);
        $w = $stmt->fetch(PDO::FETCH_ASSOC);

        $this->db->prepare("INSERT INTO wallet_transactions (user_id, type, direction, amount, pending_balance_after, available_balance_after, guarantee_balance_after, total_earnings_after, total_withdrawn_after, description, admin_id, admin_name, note, reference_type, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())")
            ->execute([$userId, $type, $direction, $amount, $w['pending_balance'], $w['available_balance'], $w['guarantee_balance'], $w['total_earnings'], $w['total_withdrawn'], $type, $adminId, $adminName, $note, $referenceType, $referenceId]);
    }

    private function emitRealtimeEvent($eventType, $targetUserId, $payload) {
        try {
            $stmt = $this->db->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'realtime_events' LIMIT 1");
            $stmt->execute();
            if (!$stmt->fetch(PDO::FETCH_NUM)) return;
        } catch (Exception $e) { return; }

        try {
            $this->db->prepare("INSERT INTO realtime_events (event_type, target_role, target_user_id, payload, created_at) VALUES (?, 'seller', ?, ?, NOW())")
                ->execute([$eventType, $targetUserId, json_encode($payload)]);
        } catch (Exception $e) {}
    }

    // ==================== SELLER ====================

    public function getSellerWallet() {
        $user = $this->auth->authenticate();
        $userId = $user['id'];
        $this->ensureWalletRow($userId);

        $w = $this->db->prepare("SELECT pending_balance, available_balance, guarantee_balance, total_earnings, total_withdrawn, updated_at FROM wallets WHERE user_id = ?");
        $w->execute([$userId]);
        $wallet = $w->fetch(PDO::FETCH_ASSOC);

        $tx = $this->db->prepare("SELECT wt.*, u.full_name as admin_full_name FROM wallet_transactions wt LEFT JOIN users u ON wt.admin_id = u.id WHERE wt.user_id = ? ORDER BY wt.created_at DESC LIMIT 100");
        $tx->execute([$userId]);
        $transactions = $tx->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'wallet' => $wallet,
            'transactions' => $transactions,
        ]);
    }

    // ==================== ADMIN ====================

    public function listSellersForWallet() {
        $admin = $this->auth->authenticate('admin');
        $search = trim($_GET['search'] ?? '');

        $sql = "SELECT u.id, u.email, u.full_name, COALESCE(w.pending_balance, 0) as pending_balance, COALESCE(w.available_balance, 0) as available_balance, COALESCE(w.guarantee_balance, 0) as guarantee_balance, COALESCE(w.total_earnings, 0) as total_earnings, COALESCE(w.total_withdrawn, 0) as total_withdrawn, s.store_name FROM users u LEFT JOIN wallets w ON w.user_id = u.id LEFT JOIN sellers s ON s.user_id = u.id WHERE u.role = 'seller'";
        $params = [];

        if ($search !== '') {
            $sql .= " AND (u.email LIKE ? OR u.full_name LIKE ? OR s.store_name LIKE ?)";
            $p = "%$search%";
            $params = [$p, $p, $p];
        }

        $sql .= " ORDER BY u.full_name ASC LIMIT 200";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $sellers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'sellers' => $sellers]);
    }

    public function getSellerWalletForAdmin($sellerId) {
        $admin = $this->auth->authenticate('admin');
        $sellerId = (int)$sellerId;
        $this->ensureWalletRow($sellerId);

        $w = $this->db->prepare("SELECT pending_balance, available_balance, guarantee_balance, total_earnings, total_withdrawn, updated_at FROM wallets WHERE user_id = ?");
        $w->execute([$sellerId]);
        $wallet = $w->fetch(PDO::FETCH_ASSOC);

        $u = $this->db->prepare("SELECT u.id, u.email, u.full_name, s.store_name FROM users u LEFT JOIN sellers s ON s.user_id = u.id WHERE u.id = ?");
        $u->execute([$sellerId]);
        $seller = $u->fetch(PDO::FETCH_ASSOC);

        $tx = $this->db->prepare("SELECT wt.*, u2.full_name as admin_full_name FROM wallet_transactions wt LEFT JOIN users u2 ON wt.admin_id = u2.id WHERE wt.user_id = ? ORDER BY wt.created_at DESC LIMIT 200");
        $tx->execute([$sellerId]);
        $transactions = $tx->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'seller' => $seller, 'wallet' => $wallet, 'transactions' => $transactions]);
    }

    private function adminAddFunds($admin, $sellerId, $amount, $note) {
        if ($amount <= 0) { http_response_code(400); echo json_encode(['error' => 'Amount must be positive']); return; }
        $this->ensureWalletRow($sellerId);
        $this->db->prepare("UPDATE wallets SET available_balance = available_balance + ?, balance = balance + ? WHERE user_id = ?")->execute([$amount, $amount, $sellerId]);
        $this->recordTransaction($sellerId, 'admin_credit', 'credit', $amount, $note, $admin['id'], $admin['full_name'] ?? $admin['email']);
        $this->emitRealtimeEvent('wallet_updated', $sellerId, ['action' => 'add_funds', 'amount' => $amount]);
        echo json_encode(['success' => true, 'message' => "Added $amount to seller wallet"]);
    }

    private function adminDeductFunds($admin, $sellerId, $amount, $note) {
        if ($amount <= 0) { http_response_code(400); echo json_encode(['error' => 'Amount must be positive']); return; }
        $this->ensureWalletRow($sellerId);
        $w = $this->db->prepare("SELECT available_balance FROM wallets WHERE user_id = ?");
        $w->execute([$sellerId]);
        $row = $w->fetch();
        if (!$row || $row['available_balance'] < $amount) {
            http_response_code(400); echo json_encode(['error' => 'Insufficient available balance']); return;
        }
        $this->db->prepare("UPDATE wallets SET available_balance = available_balance - ?, balance = balance - ? WHERE user_id = ?")->execute([$amount, $amount, $sellerId]);
        $this->recordTransaction($sellerId, 'admin_debit', 'debit', $amount, $note, $admin['id'], $admin['full_name'] ?? $admin['email']);
        $this->emitRealtimeEvent('wallet_updated', $sellerId, ['action' => 'deduct_funds', 'amount' => $amount]);
        echo json_encode(['success' => true, 'message' => "Deducted $amount from seller wallet"]);
    }

    private function adminAddGuarantee($admin, $sellerId, $amount, $note) {
        if ($amount <= 0) { http_response_code(400); echo json_encode(['error' => 'Amount must be positive']); return; }
        $this->ensureWalletRow($sellerId);
        $this->db->prepare("UPDATE wallets SET guarantee_balance = guarantee_balance + ? WHERE user_id = ?")->execute([$amount, $sellerId]);
        $this->recordTransaction($sellerId, 'guarantee_add', 'credit', $amount, $note, $admin['id'], $admin['full_name'] ?? $admin['email']);
        $this->emitRealtimeEvent('wallet_updated', $sellerId, ['action' => 'add_guarantee', 'amount' => $amount]);
        echo json_encode(['success' => true, 'message' => "Added $amount to guarantee balance"]);
    }

    private function adminRemoveGuarantee($admin, $sellerId, $amount, $note) {
        if ($amount <= 0) { http_response_code(400); echo json_encode(['error' => 'Amount must be positive']); return; }
        $this->ensureWalletRow($sellerId);
        $w = $this->db->prepare("SELECT guarantee_balance FROM wallets WHERE user_id = ?");
        $w->execute([$sellerId]);
        $row = $w->fetch();
        if (!$row || $row['guarantee_balance'] < $amount) {
            http_response_code(400); echo json_encode(['error' => 'Insufficient guarantee balance']); return;
        }
        $this->db->prepare("UPDATE wallets SET guarantee_balance = guarantee_balance - ? WHERE user_id = ?")->execute([$amount, $sellerId]);
        $this->recordTransaction($sellerId, 'guarantee_remove', 'debit', $amount, $note, $admin['id'], $admin['full_name'] ?? $admin['email']);
        $this->emitRealtimeEvent('wallet_updated', $sellerId, ['action' => 'remove_guarantee', 'amount' => $amount]);
        echo json_encode(['success' => true, 'message' => "Removed $amount from guarantee balance"]);
    }

    private function adminReleasePending($admin, $sellerId, $amount, $note) {
        if ($amount <= 0) { http_response_code(400); echo json_encode(['error' => 'Amount must be positive']); return; }
        $this->ensureWalletRow($sellerId);
        $w = $this->db->prepare("SELECT pending_balance FROM wallets WHERE user_id = ?");
        $w->execute([$sellerId]);
        $row = $w->fetch();
        if (!$row || $row['pending_balance'] < $amount) {
            http_response_code(400); echo json_encode(['error' => 'Insufficient pending balance']); return;
        }
        $this->db->prepare("UPDATE wallets SET pending_balance = pending_balance - ?, available_balance = available_balance + ?, total_earnings = total_earnings + ? WHERE user_id = ?")->execute([$amount, $amount, $amount, $sellerId]);
        $this->recordTransaction($sellerId, 'funds_released', 'credit', $amount, $note, $admin['id'], $admin['full_name'] ?? $admin['email']);
        $this->emitRealtimeEvent('wallet_updated', $sellerId, ['action' => 'release_pending', 'amount' => $amount]);
        echo json_encode(['success' => true, 'message' => "Released $amount from pending balance"]);
    }

    private function adminHoldFunds($admin, $sellerId, $amount, $note) {
        if ($amount <= 0) { http_response_code(400); echo json_encode(['error' => 'Amount must be positive']); return; }
        $this->ensureWalletRow($sellerId);
        $w = $this->db->prepare("SELECT available_balance FROM wallets WHERE user_id = ?");
        $w->execute([$sellerId]);
        $row = $w->fetch();
        if (!$row || $row['available_balance'] < $amount) {
            http_response_code(400); echo json_encode(['error' => 'Insufficient available balance']); return;
        }
        $this->db->prepare("UPDATE wallets SET available_balance = available_balance - ?, pending_balance = pending_balance + ? WHERE user_id = ?")->execute([$amount, $amount, $sellerId]);
        $this->recordTransaction($sellerId, 'hold', 'debit', $amount, $note, $admin['id'], $admin['full_name'] ?? $admin['email']);
        $this->emitRealtimeEvent('wallet_updated', $sellerId, ['action' => 'hold_funds', 'amount' => $amount]);
        echo json_encode(['success' => true, 'message' => "Held $amount from available balance"]);
    }

    private function adminRefundFunds($admin, $sellerId, $amount, $note) {
        if ($amount <= 0) { http_response_code(400); echo json_encode(['error' => 'Amount must be positive']); return; }
        $this->ensureWalletRow($sellerId);
        $w = $this->db->prepare("SELECT available_balance FROM wallets WHERE user_id = ?");
        $w->execute([$sellerId]);
        $row = $w->fetch();
        if (!$row || $row['available_balance'] < $amount) {
            http_response_code(400); echo json_encode(['error' => 'Insufficient available balance']); return;
        }
        $this->db->prepare("UPDATE wallets SET available_balance = available_balance - ?, balance = balance - ? WHERE user_id = ?")->execute([$amount, $amount, $sellerId]);
        $this->recordTransaction($sellerId, 'refund', 'debit', $amount, $note, $admin['id'], $admin['full_name'] ?? $admin['email']);
        $this->emitRealtimeEvent('wallet_updated', $sellerId, ['action' => 'refund_funds', 'amount' => $amount]);
        echo json_encode(['success' => true, 'message' => "Refunded $amount from seller wallet"]);
    }

    public function handleRequest() {
        $path = $this->getRequestPath();
        $method = $_SERVER['REQUEST_METHOD'];

        if ($method === 'GET' && $path === '/api/seller/wallet') {
            return $this->getSellerWallet();
        }

        if (strpos($path, '/api/admin/wallet') === 0) {
            $this->auth->authenticate('admin');

            if ($method === 'GET' && $path === '/api/admin/wallet/sellers') {
                return $this->listSellersForWallet();
            }

            if ($method === 'GET' && preg_match('#^/api/admin/wallet/seller/(\d+)$#', $path, $m)) {
                return $this->getSellerWalletForAdmin((int)$m[1]);
            }

            if ($method === 'POST') {
                $data = $this->getJsonBody();
                $action = $data['action'] ?? '';
                $admin = $this->auth->authenticate('admin');
                $sellerId = (int)($data['seller_id'] ?? 0);
                $amount = (float)($data['amount'] ?? 0);
                $note = $data['note'] ?? '';

                if ($sellerId <= 0) { http_response_code(400); echo json_encode(['error' => 'Invalid seller_id']); return; }
                if ($amount <= 0) { http_response_code(400); echo json_encode(['error' => 'Amount must be positive']); return; }

                switch ($action) {
                    case 'add_funds': return $this->adminAddFunds($admin, $sellerId, $amount, $note);
                    case 'deduct_funds': return $this->adminDeductFunds($admin, $sellerId, $amount, $note);
                    case 'add_guarantee': return $this->adminAddGuarantee($admin, $sellerId, $amount, $note);
                    case 'remove_guarantee': return $this->adminRemoveGuarantee($admin, $sellerId, $amount, $note);
                    case 'release_pending': return $this->adminReleasePending($admin, $sellerId, $amount, $note);
                    case 'hold_funds': return $this->adminHoldFunds($admin, $sellerId, $amount, $note);
                    case 'refund_funds': return $this->adminRefundFunds($admin, $sellerId, $amount, $note);
                    default: http_response_code(400); echo json_encode(['error' => 'Invalid action']); return;
                }
            }
        }

        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Endpoint not found']);
    }
}

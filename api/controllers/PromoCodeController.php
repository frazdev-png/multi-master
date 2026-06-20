<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class PromoCodeController {
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

    private function normalizeStatus($row) {
        $isUsed = (int)($row['is_used'] ?? 0) === 1;
        $expiresAt = $row['expires_at'] ?? null;
        $isExpired = false;
        if ($expiresAt) {
            try {
                $stmt = $this->db->prepare('SELECT 1 WHERE ? < NOW()');
                $stmt->execute([(string)$expiresAt]);
                $isExpired = (bool)$stmt->fetch(PDO::FETCH_NUM);
            } catch (Exception $e) {
                $isExpired = false;
            }
        }

        $status = 'active';
        if ($isUsed) {
            $status = 'used';
        } elseif ($isExpired) {
            $status = 'expired';
        }

        $row['status'] = $status;
        $row['is_used'] = $isUsed;
        $row['is_expired'] = $isExpired;
        return $row;
    }

    private function listPromoCodes($adminUser) {
        $limit = min($_GET['limit'] ?? 50, 200);
        $offset = $_GET['offset'] ?? 0;
        $status = strtolower(trim((string)($_GET['status'] ?? '')));
        $search = trim((string)($_GET['search'] ?? ''));

        try {
            $sql = "
                SELECT
                    p.id,
                    p.code,
                    p.is_used,
                    p.used_by_user_id,
                    p.used_at,
                    p.expires_at,
                    p.created_at,
                    u.email as used_by_email,
                    u.full_name as used_by_name
                FROM promo_codes p
                LEFT JOIN users u ON u.id = p.used_by_user_id
                WHERE 1=1
            ";
            $params = [];

            if ($status !== '' && $status !== 'all') {
                if ($status === 'used') {
                    $sql .= " AND p.is_used = 1";
                } elseif ($status === 'active') {
                    $sql .= " AND p.is_used = 0 AND (p.expires_at IS NULL OR p.expires_at >= NOW())";
                } elseif ($status === 'expired') {
                    $sql .= " AND p.is_used = 0 AND p.expires_at IS NOT NULL AND p.expires_at < NOW()";
                }
            }

            if ($search !== '') {
                $sql .= " AND (p.code LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)";
                $q = "%{$search}%";
                $params[] = $q;
                $params[] = $q;
                $params[] = $q;
            }

            $sql .= " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
            $params[] = (int)$limit;
            $params[] = (int)$offset;

            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $out = [];
            foreach ($rows as $row) {
                $out[] = $this->normalizeStatus($row);
            }

            header('Content-Type: application/json');
            echo json_encode(['promo_codes' => $out]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function generateUniqueCode() {
        for ($i = 0; $i < 20; $i++) {
            $code = str_pad((string)random_int(0, 9999), 4, '0', STR_PAD_LEFT);
            $stmt = $this->db->prepare('SELECT id FROM promo_codes WHERE code = ? LIMIT 1');
            $stmt->execute([$code]);
            if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                return $code;
            }
        }
        throw new Exception('Failed to generate unique promo code');
    }

    private function createPromoCode($adminUser) {
        $data = $this->getJsonBody();
        $code = isset($data['code']) ? trim((string)$data['code']) : '';
        $expiresAt = isset($data['expires_at']) ? trim((string)$data['expires_at']) : '';

        if ($code === '') {
            $code = $this->generateUniqueCode();
        }

        if (!preg_match('/^\d{4}$/', $code)) {
            http_response_code(400);
            echo json_encode(['error' => 'Promo code must be exactly 4 digits']);
            return;
        }

        $expiresParam = null;
        if ($expiresAt !== '') {
            $ts = strtotime($expiresAt);
            if ($ts === false) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid expires_at']);
                return;
            }
            $expiresParam = date('Y-m-d H:i:s', $ts);
        }

        try {
            $stmt = $this->db->prepare('INSERT INTO promo_codes (code, is_used, expires_at, created_at) VALUES (?, 0, ?, NOW())');
            $stmt->execute([$code, $expiresParam]);
            $id = (int)$this->db->lastInsertId();

            http_response_code(201);
            echo json_encode(['success' => true, 'promo_code' => ['id' => $id, 'code' => $code, 'expires_at' => $expiresParam, 'is_used' => false]]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function updatePromoCode($adminUser, $id) {
        $id = (int)$id;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid promo code ID']);
            return;
        }

        $data = $this->getJsonBody();
        $expiresAt = array_key_exists('expires_at', $data) ? trim((string)$data['expires_at']) : null;

        $expiresParam = null;
        if ($expiresAt !== null && $expiresAt !== '') {
            $ts = strtotime($expiresAt);
            if ($ts === false) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid expires_at']);
                return;
            }
            $expiresParam = date('Y-m-d H:i:s', $ts);
        }

        try {
            $stmt = $this->db->prepare('UPDATE promo_codes SET expires_at = ? WHERE id = ?');
            $stmt->execute([$expiresAt === null ? null : $expiresParam, $id]);
            echo json_encode(['success' => true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function deletePromoCode($adminUser, $id) {
        $id = (int)$id;
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid promo code ID']);
            return;
        }

        try {
            $stmt = $this->db->prepare('SELECT is_used FROM promo_codes WHERE id = ? LIMIT 1');
            $stmt->execute([$id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                http_response_code(404);
                echo json_encode(['error' => 'Promo code not found']);
                return;
            }

            if ((int)($row['is_used'] ?? 0) === 1) {
                http_response_code(400);
                echo json_encode(['error' => 'Cannot delete a used promo code']);
                return;
            }

            $stmt = $this->db->prepare('DELETE FROM promo_codes WHERE id = ?');
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $path = $this->getRequestPath();

        $user = $this->auth->authenticate('admin');

        if ($path === '/api/admin/promo-codes') {
            if ($method === 'GET') {
                $this->listPromoCodes($user);
                return;
            }
            if ($method === 'POST') {
                $this->createPromoCode($user);
                return;
            }
        }

        if (preg_match('#^/api/admin/promo-codes/(\d+)$#', $path, $m)) {
            $id = $m[1];
            if ($method === 'DELETE') {
                $this->deletePromoCode($user, $id);
                return;
            }
            if ($method === 'PUT') {
                $this->updatePromoCode($user, $id);
                return;
            }
        }

        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found']);
    }
}

?>

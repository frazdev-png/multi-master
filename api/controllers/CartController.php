<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class CartController {
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

    private function listCart($user) {
        $stmt = $this->db->prepare("
            SELECT
                c.product_id,
                c.quantity,
                p.name,
                p.price,
                p.image_url,
                p.stock,
                p.seller_id,
                u.full_name as seller_name,
                u.email as seller_email,
                ss.store_name
            FROM cart c
            JOIN products p ON p.id = c.product_id
            JOIN users u ON p.seller_id = u.id
            LEFT JOIN sellers ss ON ss.user_id = u.id
            WHERE c.user_id = ?
            ORDER BY p.seller_id, c.product_id DESC
        ");
        $stmt->execute([$user['id']]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get ALL sellers who have stores — customer can pick any seller for each product
        $allSellers = [];
        $stmtSellers = $this->db->prepare("
            SELECT
                u.id as seller_id,
                u.full_name as seller_name,
                u.email as seller_email,
                ss.store_name
            FROM users u
            JOIN sellers ss ON ss.user_id = u.id
            WHERE u.role = 'seller'
            ORDER BY ss.store_name ASC
        ");
        $stmtSellers->execute();
        $rows = $stmtSellers->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            $allSellers[] = [
                'seller_id' => (int)$row['seller_id'],
                'seller_name' => $row['seller_name'] ?? '',
                'seller_email' => $row['seller_email'] ?? '',
                'store_name' => $row['store_name'] ?? '',
            ];
        }

        // Attach all sellers to each item — customer can pick any seller
        foreach ($items as &$item) {
            $item['available_sellers'] = $allSellers;
            // Default to first seller if current seller is not a real seller
            if (!empty($allSellers)) {
                $currentSid = (int)$item['seller_id'];
                $isRealSeller = false;
                foreach ($allSellers as $s) {
                    if ($s['seller_id'] === $currentSid) {
                        $isRealSeller = true;
                        break;
                    }
                }
                if (!$isRealSeller) {
                    $first = $allSellers[0];
                    $item['seller_id'] = $first['seller_id'];
                    $item['seller_name'] = $first['seller_name'];
                    $item['seller_email'] = $first['seller_email'];
                    $item['store_name'] = $first['store_name'];
                }
            }
        }

        header('Content-Type: application/json');
        echo json_encode(['items' => $items]);
    }

    private function addToCart($user) {
        $data = $this->getJsonBody();
        $sellerProductId = (int)($data['seller_product_id'] ?? 0);
        $productId = (int)($data['product_id'] ?? 0);
        $quantity = (int)($data['quantity'] ?? 1);
        if ($quantity <= 0) $quantity = 1;

        if ($sellerProductId > 0) {
            $stmt = $this->db->prepare("SELECT product_id, selling_price FROM seller_products WHERE id = ? AND is_active = 1");
            $stmt->execute([$sellerProductId]);
            $sp = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$sp) {
                http_response_code(404);
                echo json_encode(['error' => 'Product not available']);
                return;
            }
            $productId = (int)$sp['product_id'];
        }

        if ($productId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'product_id is required']);
            return;
        }

        $stmt = $this->db->prepare("\n            INSERT INTO cart (user_id, product_id, quantity, created_at, updated_at)\n            VALUES (?, ?, ?, NOW(), NOW())\n            ON DUPLICATE KEY UPDATE\n                quantity = quantity + VALUES(quantity),\n                updated_at = NOW()\n        ");
        $stmt->execute([$user['id'], $productId, $quantity]);

        echo json_encode(['success' => true]);
    }

    private function updateCartItem($user, $productId) {
        $productId = (int)$productId;
        if ($productId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'product_id is required']);
            return;
        }

        $data = $this->getJsonBody();
        $quantity = (int)($data['quantity'] ?? 0);

        if ($quantity <= 0) {
            $stmt = $this->db->prepare("DELETE FROM cart WHERE user_id = ? AND product_id = ?");
            $stmt->execute([$user['id'], $productId]);
            echo json_encode(['success' => true]);
            return;
        }

        $stmt = $this->db->prepare("UPDATE cart SET quantity = ?, updated_at = NOW() WHERE user_id = ? AND product_id = ?");
        $stmt->execute([$quantity, $user['id'], $productId]);
        echo json_encode(['success' => true]);
    }

    private function removeCartItem($user, $productId) {
        $productId = (int)$productId;
        if ($productId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'product_id is required']);
            return;
        }
        $stmt = $this->db->prepare("DELETE FROM cart WHERE user_id = ? AND product_id = ?");
        $stmt->execute([$user['id'], $productId]);
        echo json_encode(['success' => true]);
    }

    private function clearCart($user) {
        $stmt = $this->db->prepare("DELETE FROM cart WHERE user_id = ?");
        $stmt->execute([$user['id']]);
        echo json_encode(['success' => true]);
    }

    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $path = $this->getRequestPath();

        $user = $this->auth->authenticate('customer');

        // Block write actions for frozen customers
        if ($method !== 'GET') {
            $this->auth->checkFrozen($user);
        }

        if ($path === '/api/cart') {
            if ($method === 'GET') {
                $this->listCart($user);
                return;
            }
            if ($method === 'POST') {
                $this->addToCart($user);
                return;
            }
            if ($method === 'DELETE') {
                $this->clearCart($user);
                return;
            }
        }

        if (preg_match('#^/api/cart/(\d+)$#', $path, $m)) {
            $productId = $m[1];
            if ($method === 'PUT') {
                $this->updateCartItem($user, $productId);
                return;
            }
            if ($method === 'DELETE') {
                $this->removeCartItem($user, $productId);
                return;
            }
        }

        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found']);
    }
}
?>

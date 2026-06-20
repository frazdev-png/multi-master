<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class WishlistController {
    private $db;
    private $auth;

    public function __construct() {
        $this->db = new Database();
        $this->auth = new AuthMiddleware();
    }

    public function getWishlist() {
        $user = $this->auth->authenticate();
        $userId = (int)$user['id'];

        try {
            $conn = $this->db->getConnection();
            $stmt = $conn->prepare("
                SELECT w.product_id, w.created_at as added_at,
                       p.id, p.name, p.price, p.stock, p.image_url, p.seller_id,
                       u.full_name as seller_name
                FROM wishlist w
                JOIN products p ON w.product_id = p.id
                LEFT JOIN users u ON p.seller_id = u.id
                WHERE w.user_id = ?
                ORDER BY w.created_at DESC
            ");
            $stmt->execute([$userId]);
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

            http_response_code(200);
            header('Content-Type: application/json');
            echo json_encode(['success' => true, 'items' => $items]);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }
    }

    public function addToWishlist() {
        $user = $this->auth->authenticate();
        $userId = (int)$user['id'];
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data || empty($data['product_id'])) {
            http_response_code(400);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => 'Product ID is required']);
            exit;
        }

        $productId = (int)$data['product_id'];

        try {
            $conn = $this->db->getConnection();

            $check = $conn->prepare("SELECT id FROM products WHERE id = ?");
            $check->execute([$productId]);
            if (!$check->fetch()) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['success' => false, 'error' => 'Product not found']);
                exit;
            }

            $stmt = $conn->prepare("INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)");
            $stmt->execute([$userId, $productId]);

            http_response_code(200);
            header('Content-Type: application/json');
            echo json_encode(['success' => true, 'message' => 'Added to wishlist']);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }
    }

    public function removeFromWishlist($productId) {
        $user = $this->auth->authenticate();
        $userId = (int)$user['id'];

        try {
            $conn = $this->db->getConnection();
            $stmt = $conn->prepare("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?");
            $stmt->execute([$userId, (int)$productId]);

            http_response_code(200);
            header('Content-Type: application/json');
            echo json_encode(['success' => true, 'message' => 'Removed from wishlist']);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }
    }

    public function checkWishlist($productId) {
        $user = $this->auth->authenticate();
        $userId = (int)$user['id'];

        try {
            $conn = $this->db->getConnection();
            $stmt = $conn->prepare("SELECT 1 FROM wishlist WHERE user_id = ? AND product_id = ?");
            $stmt->execute([$userId, (int)$productId]);
            $exists = (bool)$stmt->fetch();

            http_response_code(200);
            header('Content-Type: application/json');
            echo json_encode(['success' => true, 'in_wishlist' => $exists]);
            exit;
        } catch (Exception $e) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            exit;
        }
    }
}

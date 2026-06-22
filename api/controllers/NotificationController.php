<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class NotificationController {
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

    private function listNotifications($user) {
        $limit = min($_GET['limit'] ?? 20, 100);
        $unreadOnly = $_GET['unread'] ?? false;
        try {
            $sql = "SELECT id, type, title, message, link, is_read, created_at FROM notifications WHERE user_id = ?";
            $params = [$user['id']];
            if ($unreadOnly) {
                $sql .= " AND is_read = 0";
            }
            $sql .= " ORDER BY created_at DESC LIMIT ?";
            $params[] = (int)$limit;
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $stmt = $this->db->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0");
            $stmt->execute([$user['id']]);
            $unreadCount = (int)$stmt->fetchColumn();

            header('Content-Type: application/json');
            echo json_encode(['notifications' => $rows, 'unread_count' => $unreadCount]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function markAsRead($user, $id) {
        try {
            $stmt = $this->db->prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?");
            $stmt->execute([$id, $user['id']]);
            echo json_encode(['success' => true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function markAllAsRead($user) {
        try {
            $stmt = $this->db->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0");
            $stmt->execute([$user['id']]);
            echo json_encode(['success' => true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $path = $this->getRequestPath();
        $user = $this->auth->authenticate();

        if ($method === 'GET') {
            $this->listNotifications($user);
            return;
        }

        if ($method === 'PUT') {
            if (preg_match('/\/api\/notifications\/(\d+)\/read/', $path, $m)) {
                $this->markAsRead($user, $m[1]);
                return;
            }
            $this->markAllAsRead($user);
            return;
        }

        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }
}

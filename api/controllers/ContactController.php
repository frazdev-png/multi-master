<?php
require_once __DIR__ . '/../config/Database.php';

class ContactController {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    public function submit() {
        $data = json_decode(file_get_contents('php://input'), true);
        $name = trim((string)($data['name'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $subject = trim((string)($data['subject'] ?? ''));
        $message = trim((string)($data['message'] ?? ''));

        if (!$name || !$message) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Name and message are required']);
            return;
        }

        try {
            $conn = $this->db->getConnection();
            $stmt = $conn->prepare("INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)");
            $stmt->execute([$name, $email, $subject, $message]);

            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function list() {
        try {
            $conn = $this->db->getConnection();
            $stmt = $conn->prepare("SELECT * FROM contact_messages ORDER BY created_at DESC");
            $stmt->execute();
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'messages' => $messages]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function markRead($id) {
        try {
            $conn = $this->db->getConnection();
            $stmt = $conn->prepare("UPDATE contact_messages SET is_read = 1 WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
        }
    }
}
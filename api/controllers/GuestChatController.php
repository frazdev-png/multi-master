<?php
require_once __DIR__ . '/../config/Database.php';

class GuestChatController {
    private $db;

    private static $guestSchemaEnsured = false;

    public function __construct() {
        $this->db = new Database();
        $this->ensureGuestColumns();
    }

    private function ensureGuestColumns() {
        if (self::$guestSchemaEnsured) return;
        try {
            $this->db->exec("ALTER TABLE conversations ADD COLUMN is_guest TINYINT(1) NOT NULL DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE conversations ADD COLUMN guest_name VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE conversations ADD COLUMN guest_token VARCHAR(255) NULL");
        } catch (Exception $e) {}
        try {
            $this->db->exec("ALTER TABLE conversations ADD INDEX idx_guest_token (guest_token)");
        } catch (Exception $e) {}
        self::$guestSchemaEnsured = true;
    }

    private function jsonResponse($data, $code = 200) {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    private function getJsonInput() {
        $raw = file_get_contents('php://input');
        return json_decode($raw, true) ?? [];
    }

    /**
     * POST /api/guest/contact
     * Body: { name, message, email? }
     * Returns: { success, conversation_id, token }
     */
    public function createGuestConversation() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        $input = $this->getJsonInput();
        $name = trim((string)($input['name'] ?? ''));
        $message = trim((string)($input['message'] ?? ''));
        $email = trim((string)($input['email'] ?? ''));

        if ($name === '' || $message === '') {
            $this->jsonResponse(['error' => 'Name and message are required'], 400);
        }
        if (mb_strlen($message) > 2000) {
            $this->jsonResponse(['error' => 'Message too long (max 2000 chars)'], 400);
        }

        $token = bin2hex(random_bytes(32));
        $subject = 'Guest inquiry from ' . $name;
        if ($email !== '') {
            $subject .= ' (' . $email . ')';
        }

        try {
            $this->db->beginTransaction();

            $stmt = $this->db->prepare(
                "INSERT INTO conversations (subject, status, is_guest, guest_name, guest_token, created_at, updated_at)
                 VALUES (?, 'open', 1, ?, ?, NOW(), NOW())"
            );
            $stmt->execute([$subject, $name, $token]);
            $conversationId = (int)$this->db->lastInsertId();

            // Auto-assign first admin as participant so admin can reply via normal chat endpoints
            $stmt = $this->db->prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
            $stmt->execute();
            $admin = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($admin) {
                try {
                    $this->db->prepare(
                        "INSERT IGNORE INTO conversation_participants (conversation_id, user_id, created_at) VALUES (?, ?, NOW())"
                    )->execute([$conversationId, (int)$admin['id']]);
                } catch (Exception $e) {}
            }

            $stmt = $this->db->prepare(
                "INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
                 VALUES (?, 0, ?, 'text', NOW())"
            );
            $stmt->execute([$conversationId, $message]);

            $this->db->commit();

            $this->jsonResponse([
                'success' => true,
                'conversation_id' => $conversationId,
                'token' => $token,
                'message' => 'Your message has been sent to the admin.',
            ]);
        } catch (Exception $e) {
            $this->db->rollBack();
            $this->jsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * GET /api/guest/conversations/{token}
     * Returns conversation with messages for this guest token.
     */
    public function getGuestConversation($token = null) {
        if (!$token) {
            $this->jsonResponse(['error' => 'Token is required'], 400);
        }

        try {
            $stmt = $this->db->prepare(
                "SELECT id, guest_name, guest_token, status, created_at, updated_at
                 FROM conversations
                 WHERE guest_token = ? AND is_guest = 1
                 LIMIT 1"
            );
            $stmt->execute([$token]);
            $conv = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$conv) {
                $this->jsonResponse(['error' => 'Conversation not found'], 404);
            }

            $stmt = $this->db->prepare(
                "SELECT m.id, m.sender_id, m.content, m.message_type, m.created_at,
                        CASE WHEN m.sender_id = 0 THEN ? ELSE u.full_name END as sender_name,
                        u.avatar_url as sender_avatar,
                        COALESCE(u.role, 'guest') as sender_role
                 FROM messages m
                 LEFT JOIN users u ON m.sender_id = u.id
                 WHERE m.conversation_id = ?
                 ORDER BY m.created_at ASC"
            );
            $stmt->execute([$conv['guest_name'], $conv['id']]);
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $this->jsonResponse([
                'success' => true,
                'conversation' => [
                    'id' => $conv['id'],
                    'guest_name' => $conv['guest_name'],
                    'status' => $conv['status'],
                    'created_at' => $conv['created_at'],
                    'updated_at' => $conv['updated_at'],
                ],
                'messages' => $messages,
            ]);
        } catch (Exception $e) {
            $this->jsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/guest/conversations/{token}/messages
     * Body: { message }
     */
    public function sendGuestMessage($token = null) {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }
        if (!$token) {
            $this->jsonResponse(['error' => 'Token is required'], 400);
        }

        $input = $this->getJsonInput();
        $content = trim((string)($input['message'] ?? ''));
        if ($content === '') {
            $this->jsonResponse(['error' => 'Message is required'], 400);
        }
        if (mb_strlen($content) > 2000) {
            $this->jsonResponse(['error' => 'Message too long (max 2000 chars)'], 400);
        }

        try {
            $stmt = $this->db->prepare(
                "SELECT id FROM conversations WHERE guest_token = ? AND is_guest = 1 LIMIT 1"
            );
            $stmt->execute([$token]);
            $conv = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$conv) {
                $this->jsonResponse(['error' => 'Conversation not found'], 404);
            }

            $stmt = $this->db->prepare(
                "INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
                 VALUES (?, 0, ?, 'text', NOW())"
            );
            $stmt->execute([$conv['id'], $content]);

            $this->db->prepare("UPDATE conversations SET updated_at = NOW() WHERE id = ?")
                ->execute([$conv['id']]);

            // Ensure at least one admin is a participant (in case conversation was created without one)
            try {
                $stmt = $this->db->prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
                $stmt->execute();
                $admin = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($admin) {
                    $this->db->prepare(
                        "INSERT IGNORE INTO conversation_participants (conversation_id, user_id, created_at) VALUES (?, ?, NOW())"
                    )->execute([(int)$conv['id'], (int)$admin['id']]);
                }
            } catch (Exception $e) {}

            // Notify admin via realtime event
            try {
                $stmt = $this->db->prepare("SELECT id, full_name FROM users WHERE role = 'admin' LIMIT 1");
                $stmt->execute();
                $admin = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($admin) {
                    $messageId = (int)$this->db->lastInsertId();
                    $this->createRealtimeEvent('new_message', $admin['id'], [
                        'conversation_id' => (int)$conv['id'],
                        'message_id' => $messageId,
                        'sender_name' => 'Guest',
                        'sender_id' => 0,
                        'content' => $content,
                    ]);
                }
            } catch (Exception $e) {}

            $this->jsonResponse([
                'success' => true,
                'message' => 'Message sent',
            ]);
        } catch (Exception $e) {
            $this->jsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * GET /api/admin/guest-conversations
     * Admin only — lists all guest conversations.
     */
    public function adminGetGuestConversations() {
        require_once __DIR__ . '/../middleware/AuthMiddleware.php';
        $auth = new AuthMiddleware();
        $auth->authenticate('admin');

        try {
            $sql = "SELECT
                        c.id as conversation_id,
                        c.guest_name,
                        c.status,
                        c.created_at,
                        c.updated_at,
                        m.content as last_message,
                        m.created_at as last_message_at,
                        m.sender_id as last_message_sender_id
                    FROM conversations c
                    LEFT JOIN messages m ON (
                        m.id = (
                            SELECT id FROM messages
                            WHERE conversation_id = c.id
                            ORDER BY created_at DESC
                            LIMIT 1
                        )
                    )
                    WHERE c.is_guest = 1
                    ORDER BY COALESCE(m.created_at, c.updated_at, c.created_at) DESC";

            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $this->jsonResponse(['conversations' => $conversations]);
        } catch (Exception $e) {
            $this->jsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * GET /api/admin/guest-conversations/{id}/messages
     * Admin only — get messages for a specific guest conversation.
     */
    public function adminGetGuestMessages($id = null) {
        require_once __DIR__ . '/../middleware/AuthMiddleware.php';
        $auth = new AuthMiddleware();
        $currentUser = $auth->authenticate('admin');

        if (!$id) {
            $this->jsonResponse(['error' => 'Conversation ID is required'], 400);
        }

        try {
            $stmt = $this->db->prepare(
                "SELECT id, guest_name, status, is_guest FROM conversations WHERE id = ? AND is_guest = 1 LIMIT 1"
            );
            $stmt->execute([(int)$id]);
            $conv = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$conv) {
                $this->jsonResponse(['error' => 'Guest conversation not found'], 404);
            }

            // Ensure current admin is participant (for reply access)
            try {
                $this->db->prepare(
                    "INSERT IGNORE INTO conversation_participants (conversation_id, user_id, created_at) VALUES (?, ?, NOW())"
                )->execute([(int)$id, (int)$currentUser['id']]);
            } catch (Exception $e) {}

            $stmt = $this->db->prepare(
                "SELECT m.id, m.sender_id, m.content, m.message_type, m.created_at,
                        CASE WHEN m.sender_id = 0 THEN ? ELSE u.full_name END as sender_name,
                        u.avatar_url as sender_avatar,
                        COALESCE(u.role, 'guest') as sender_role
                 FROM messages m
                 LEFT JOIN users u ON m.sender_id = u.id
                 WHERE m.conversation_id = ?
                 ORDER BY m.created_at ASC"
            );
            $stmt->execute([$conv['guest_name'], (int)$id]);
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $this->jsonResponse([
                'success' => true,
                'conversation' => $conv,
                'messages' => $messages,
            ]);
        } catch (Exception $e) {
            $this->jsonResponse(['error' => $e->getMessage()], 500);
        }
    }

    private function createRealtimeEvent($type, $userId, $data) {
        try {
            $stmt = $this->db->prepare(
                "INSERT INTO realtime_events (user_id, event_type, event_data, created_at)
                 VALUES (?, ?, ?, NOW())"
            );
            $stmt->execute([$userId, $type, json_encode($data)]);
        } catch (Exception $e) {}
    }

    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

        if (preg_match('#^/api/guest/conversations/([a-f0-9]+)/messages$#', $requestUri, $m)) {
            if ($method === 'POST') {
                $this->sendGuestMessage($m[1]);
            } else {
                $this->jsonResponse(['error' => 'Method not allowed'], 405);
            }
        } elseif (preg_match('#^/api/guest/conversations/([a-f0-9]+)$#', $requestUri, $m)) {
            if ($method === 'GET') {
                $this->getGuestConversation($m[1]);
            } else {
                $this->jsonResponse(['error' => 'Method not allowed'], 405);
            }
        } elseif (preg_match('#^/api/guest/contact$#', $requestUri)) {
            $this->createGuestConversation();
        } elseif (preg_match('#^/api/admin/guest-conversations/(\d+)/messages$#', $requestUri, $m)) {
            $this->adminGetGuestMessages((int)$m[1]);
        } elseif (preg_match('#^/api/admin/guest-conversations$#', $requestUri)) {
            $this->adminGetGuestConversations();
        } else {
            $this->jsonResponse(['error' => 'Endpoint not found'], 404);
        }
    }
}

<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class ChatController {
    private $db;
    private $auth;
    private $userColumns;
    private $messageColumns;
    private $conversationColumns;

    private static $chatSchemaEnsured = false;
    private static $chatSchemaBroken = false;
    private static $chatSchemaBrokenReason = null;

    public function __construct() {
        $this->db = new Database();
        $this->auth = new AuthMiddleware();
        $this->userColumns = null;
        $this->messageColumns = null;
        $this->conversationColumns = null;

        if (!self::$chatSchemaEnsured && !self::$chatSchemaBroken) {
            $this->ensureChatTables();
        }
    }

    private function ensureChatTables() {
        try {
            $this->db->exec("CREATE TABLE IF NOT EXISTS conversations (id INT AUTO_INCREMENT PRIMARY KEY, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
            $this->db->exec("CREATE TABLE IF NOT EXISTS conversation_participants (id INT AUTO_INCREMENT PRIMARY KEY, conversation_id INT NOT NULL, user_id INT NOT NULL, last_read_message_id INT NOT NULL DEFAULT 0, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_conversation_user (conversation_id, user_id), KEY idx_cp_user (user_id), KEY idx_cp_conversation (conversation_id)) ENGINE=InnoDB");
            $this->db->exec("CREATE TABLE IF NOT EXISTS messages (id INT AUTO_INCREMENT PRIMARY KEY, conversation_id INT NOT NULL, sender_id INT NOT NULL, content TEXT NOT NULL, message_type VARCHAR(20) NOT NULL DEFAULT 'text', created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_messages_conversation (conversation_id), KEY idx_messages_sender (sender_id)) ENGINE=InnoDB");
            $this->db->exec("CREATE TABLE IF NOT EXISTS message_reads (message_id INT NOT NULL, user_id INT NOT NULL, read_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (message_id, user_id), KEY idx_mr_user (user_id)) ENGINE=InnoDB");

            self::$chatSchemaEnsured = true;
        } catch (Exception $e) {
            $msg = $e->getMessage();
            error_log('Chat schema ensure failed: ' . $msg);

            // MySQL 1813 means an orphaned tablespace file exists on disk for this table.
            // This cannot be fixed reliably from application code.
            if (strpos($msg, '1813') !== false || strpos($msg, 'Tablespace for table') !== false) {
                self::$chatSchemaBroken = true;
                self::$chatSchemaBrokenReason = $msg;
            }
        }
    }

    private function guardChatSchema() {
        if (!self::$chatSchemaBroken) {
            return true;
        }

        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'Chat database schema is corrupted (orphaned tablespace). Please repair MySQL table files and restart the API.',
            'details' => self::$chatSchemaBrokenReason,
            'table' => 'conversation_participants',
        ]);
        return false;
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

    private function getMessageColumns() {
        if (is_array($this->messageColumns)) {
            return $this->messageColumns;
        }

        try {
            $stmt = $this->db->prepare("SHOW COLUMNS FROM messages");
            $stmt->execute();
            $cols = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                if (isset($row['Field'])) {
                    $cols[$row['Field']] = true;
                }
            }
            $this->messageColumns = $cols;
            return $this->messageColumns;
        } catch (Exception $e) {
            $this->messageColumns = [];
            return $this->messageColumns;
        }
    }

    private function hasMessageColumn($name) {
        $cols = $this->getMessageColumns();
        return isset($cols[$name]);
    }

    private function getConversationColumns() {
        if (is_array($this->conversationColumns)) {
            return $this->conversationColumns;
        }

        try {
            $stmt = $this->db->prepare("SHOW COLUMNS FROM conversations");
            $stmt->execute();
            $cols = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                if (isset($row['Field'])) {
                    $cols[$row['Field']] = true;
                }
            }
            $this->conversationColumns = $cols;
            return $this->conversationColumns;
        } catch (Exception $e) {
            $this->conversationColumns = [];
            return $this->conversationColumns;
        }
    }

    private function hasConversationColumn($name) {
        $cols = $this->getConversationColumns();
        return isset($cols[$name]);
    }

    private function isUserInConversation($conversationId, $userId) {
        try {
            $stmt = $this->db->prepare("SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?");
            $stmt->execute([(int)$conversationId, (int)$userId]);
            if ($stmt->fetch(PDO::FETCH_NUM)) {
                return true;
            }
        } catch (Exception $e) {
        }

        if ($this->hasConversationColumn('user1_id') && $this->hasConversationColumn('user2_id')) {
            try {
                $stmt = $this->db->prepare("SELECT 1 FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?) LIMIT 1");
                $stmt->execute([(int)$conversationId, (int)$userId, (int)$userId]);
                return (bool)$stmt->fetch(PDO::FETCH_NUM);
            } catch (Exception $e) {
                return false;
            }
        }

        return false;
    }

    public function conversations() {
        $method = $_SERVER['REQUEST_METHOD'];
        
        if ($method === 'GET') {
            $this->getConversations();
        } elseif ($method === 'POST') {
            $this->createConversation();
        }
    }

    public function deleteConversation() {
        $user = $this->auth->authenticate();

        if (!$this->guardChatSchema()) {
            return;
        }

        $conversationId = $this->getIdFromUrl();
        if (!$conversationId) {
            http_response_code(400);
            echo json_encode(['error' => 'Conversation ID is required']);
            return;
        }

        if (!$this->isUserInConversation($conversationId, $user['id'])) {
            http_response_code(403);
            echo json_encode(['error' => 'Not authorized to delete this conversation']);
            return;
        }

        try {
            $this->db->beginTransaction();

            // Best effort: delete reads, then messages, then participants, then conversation
            try {
                $stmt = $this->db->prepare("DELETE mr FROM message_reads mr JOIN messages m ON mr.message_id = m.id WHERE m.conversation_id = ?");
                $stmt->execute([(int)$conversationId]);
            } catch (Exception $e) {
            }

            try {
                $stmt = $this->db->prepare("DELETE FROM messages WHERE conversation_id = ?");
                $stmt->execute([(int)$conversationId]);
            } catch (Exception $e) {
            }

            try {
                $stmt = $this->db->prepare("DELETE FROM conversation_participants WHERE conversation_id = ?");
                $stmt->execute([(int)$conversationId]);
            } catch (Exception $e) {
            }

            $stmt = $this->db->prepare("DELETE FROM conversations WHERE id = ?");
            $stmt->execute([(int)$conversationId]);

            $this->db->commit();

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Conversation deleted']);
        } catch (Exception $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function getConversations() {
        // Authenticate user
        $user = $this->auth->authenticate();

        if (!$this->guardChatSchema()) {
            return;
        }
        
        try {
            $onlineSelect = $this->hasUserColumn('is_online') ? 'u.is_online as other_user_online,' : '0 as other_user_online,';
            $lastSeenSelect = $this->hasUserColumn('last_seen') ? 'u.last_seen as other_user_last_seen,' : 'NULL as other_user_last_seen,';
            $lastMessageExpr = $this->hasMessageColumn('content') ? 'm.content' : ($this->hasMessageColumn('message') ? 'm.message' : "''");

            if ($this->hasConversationColumn('user1_id') && $this->hasConversationColumn('user2_id')) {
                $stmt = $this->db->prepare("
                    SELECT
                        c.id as conversation_id,
                        c.created_at,
                        c.updated_at,
                        u.id as other_user_id,
                        u.full_name as other_user_name,
                        u.email as other_user_email,
                        u.avatar_url as other_user_avatar,
                        {$onlineSelect}
                        {$lastSeenSelect}
                        {$lastMessageExpr} as last_message,
                        m.created_at as last_message_at,
                        m.sender_id as last_message_sender_id,
                        0 as unread_count
                    FROM conversations c
                    JOIN users u ON u.id = (CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END)
                    LEFT JOIN messages m ON (
                        m.id = (
                            SELECT id FROM messages
                            WHERE conversation_id = c.id
                            ORDER BY created_at DESC
                            LIMIT 1
                        )
                    )
                    WHERE c.user1_id = ? OR c.user2_id = ?
                    ORDER BY COALESCE(m.created_at, c.updated_at, c.created_at) DESC
                ");
                $stmt->execute([$user['id'], $user['id'], $user['id']]);
            } else {
                $stmt = $this->db->prepare("
                    SELECT 
                        c.id as conversation_id,
                        c.created_at,
                        c.updated_at,
                        u.id as other_user_id,
                        u.full_name as other_user_name,
                        u.email as other_user_email,
                        u.avatar_url as other_user_avatar,
                        {$onlineSelect}
                        {$lastSeenSelect}
                        {$lastMessageExpr} as last_message,
                        m.created_at as last_message_at,
                        m.sender_id as last_message_sender_id,
                        (SELECT COUNT(*) FROM messages m2 
                         WHERE m2.conversation_id = c.id 
                         AND m2.id > cp.last_read_message_id
                         AND m2.sender_id != ?) as unread_count
                    FROM conversations c
                    JOIN conversation_participants cp ON c.id = cp.conversation_id
                    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
                    JOIN users u ON cp2.user_id = u.id
                    LEFT JOIN messages m ON (
                        m.id = (
                            SELECT id FROM messages 
                            WHERE conversation_id = c.id 
                            ORDER BY created_at DESC 
                            LIMIT 1
                        )
                    )
                    WHERE cp.user_id = ? AND cp2.user_id != ?
                    ORDER BY m.created_at DESC
                ");

                $stmt->execute([$user['id'], $user['id'], $user['id']]);
            }

            $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);

            header('Content-Type: application/json');
            echo json_encode(['conversations' => $conversations]);

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function createConversation() {
        // Authenticate user
        $user = $this->auth->authenticate();

        if (!$this->guardChatSchema()) {
            return;
        }
        
        $data = json_decode(file_get_contents('php://input'), true);
        $recipientId = $data['recipient_id'] ?? null;
        
        if (!$recipientId) {
            http_response_code(400);
            echo json_encode(['error' => 'Recipient ID is required']);
            return;
        }
        
        if ($recipientId == $user['id']) {
            http_response_code(400);
            echo json_encode(['error' => 'Cannot create conversation with yourself']);
            return;
        }
        
        try {
            $this->db->beginTransaction();
            
            // Check if recipient exists
            $recipientActiveWhere = $this->hasUserColumn('is_active') ? ' AND is_active = 1' : '';
            $stmt = $this->db->prepare("SELECT id FROM users WHERE id = ?{$recipientActiveWhere}");
            $stmt->execute([$recipientId]);
            
            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                echo json_encode(['error' => 'Recipient not found']);
                return;
            }
            
            $existing = null;
            if ($this->hasConversationColumn('user1_id') && $this->hasConversationColumn('user2_id')) {
                $stmt = $this->db->prepare("SELECT id FROM conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?) LIMIT 1");
                $stmt->execute([$user['id'], $recipientId, $recipientId, $user['id']]);
                $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            } else {
                // Check if conversation already exists
                $stmt = $this->db->prepare("
                    SELECT c.id 
                    FROM conversations c
                    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
                    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
                    WHERE cp1.user_id = ? AND cp2.user_id = ?
                ");
                
                $stmt->execute([$user['id'], $recipientId]);
                $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            }
            
            if ($existing) {
                $conversationId = $existing['id'];

                // Ensure participant rows exist for apps relying on conversation_participants.
                try {
                    $stmt = $this->db->prepare("INSERT IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)");
                    $stmt->execute([(int)$conversationId, (int)$user['id'], (int)$conversationId, (int)$recipientId]);
                } catch (Exception $e) {
                }

                echo json_encode(['conversation_id' => $conversationId]);
                return;
            }
            
            // Create new conversation
            if ($this->hasConversationColumn('user1_id') && $this->hasConversationColumn('user2_id')) {
                $stmt = $this->db->prepare("INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)");
                $stmt->execute([(int)$user['id'], (int)$recipientId]);
                $conversationId = $this->db->lastInsertId();
            } else {
                $this->db->exec("INSERT INTO conversations () VALUES ()");
                $conversationId = $this->db->lastInsertId();
            }
            
            // Add participants
            $stmt = $this->db->prepare("
                INSERT INTO conversation_participants (conversation_id, user_id) 
                VALUES (?, ?), (?, ?)
            ");
            $stmt->execute([$conversationId, $user['id'], $conversationId, $recipientId]);
            
            $this->db->commit();
            
            http_response_code(201);
            echo json_encode([
                'conversation_id' => $conversationId,
                'message' => 'Conversation created successfully'
            ]);
            
        } catch (Exception $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function getConversation() {
        // Authenticate user
        $user = $this->auth->authenticate();

        if (!$this->guardChatSchema()) {
            return;
        }
        
        $conversationId = $this->getIdFromUrl();
        
        if (!$conversationId) {
            http_response_code(400);
            echo json_encode(['error' => 'Conversation ID is required']);
            return;
        }
        
        if (!$this->isUserInConversation($conversationId, $user['id'])) {
            http_response_code(403);
            echo json_encode(['error' => 'Not authorized to view this conversation']);
            return;
        }
        
        $onlineSelect = $this->hasUserColumn('is_online') ? 'u.is_online as is_online,' : '0 as is_online,';
        $lastSeenSelect = $this->hasUserColumn('last_seen') ? 'u.last_seen as last_seen' : 'NULL as last_seen';

        if ($this->hasConversationColumn('user1_id') && $this->hasConversationColumn('user2_id')) {
            $stmt = $this->db->prepare("
                SELECT
                    c.id as conversation_id,
                    c.created_at,
                    c.updated_at,
                    u.id as user_id,
                    u.full_name,
                    u.email,
                    u.avatar_url,
                    {$onlineSelect}
                    {$lastSeenSelect}
                FROM conversations c
                JOIN users u ON u.id = (CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END)
                WHERE c.id = ?
            ");
            $stmt->execute([$user['id'], $conversationId]);
            $otherUser = $stmt->fetch();
        } else {
            // Get conversation details with participants
            $stmt = $this->db->prepare("
                SELECT 
                    c.id as conversation_id,
                    c.created_at,
                    c.updated_at,
                    u.id as user_id,
                    u.full_name,
                    u.email,
                    u.avatar_url,
                    {$onlineSelect}
                    {$lastSeenSelect}
                FROM conversations c
                JOIN conversation_participants cp ON c.id = cp.conversation_id
                JOIN users u ON cp.user_id = u.id
                WHERE c.id = ? AND u.id != ?
            ");
            
            $stmt->execute([$conversationId, $user['id']]);
            $otherUser = $stmt->fetch();
        }
        
        if (!$otherUser) {
            http_response_code(404);
            echo json_encode(['error' => 'Conversation not found']);
            return;
        }
        
        echo json_encode([
            'conversation_id' => $conversationId,
            'other_user' => $otherUser
        ]);
    }

    public function getMessages() {
        // Authenticate user
        $user = $this->auth->authenticate();

        if (!$this->guardChatSchema()) {
            return;
        }
        
        $conversationId = $this->getIdFromUrl();
        
        if (!$conversationId) {
            http_response_code(400);
            echo json_encode(['error' => 'Conversation ID is required']);
            return;
        }
        
        if (!$this->isUserInConversation($conversationId, $user['id'])) {
            http_response_code(403);
            echo json_encode(['error' => 'Not authorized to view this conversation']);
            return;
        }
        
        $messageBodyExpr = $this->hasMessageColumn('content') ? 'm.content' : ($this->hasMessageColumn('message') ? 'm.message' : "''");
        $messageTypeExpr = $this->hasMessageColumn('message_type') ? 'm.message_type' : "'text'";

        // Get messages
        $stmt = $this->db->prepare("
            SELECT 
                m.id,
                m.conversation_id,
                m.sender_id,
                {$messageBodyExpr} as content,
                {$messageTypeExpr} as message_type,
                m.created_at,
                u.full_name as sender_name, 
                u.avatar_url as sender_avatar,
                (SELECT COUNT(*) > 0 FROM message_reads mr 
                 WHERE mr.message_id = m.id AND mr.user_id = ?) as is_read
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = ?
            ORDER BY m.created_at ASC
        ");
        $stmt->execute([$user['id'], $conversationId]);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Mark messages as read when supported by conversation_participants
        try {
            $stmt = $this->db->prepare("
                UPDATE conversation_participants 
                SET last_read_message_id = (
                    SELECT MAX(id) FROM messages 
                    WHERE conversation_id = ?
                )
                WHERE conversation_id = ? AND user_id = ?
            ");
            $stmt->execute([$conversationId, $conversationId, $user['id']]);
        } catch (Exception $e) {
        }
        
        header('Content-Type: application/json');
        echo json_encode(['messages' => $messages]);
    }

    public function sendMessage() {
        // Authenticate user
        $user = $this->auth->authenticate();

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            return;
        }

        if (!$this->guardChatSchema()) {
            return;
        }
        
        $data = json_decode(file_get_contents('php://input'), true);
        $conversationId = $data['conversation_id'] ?? null;
        $content = $data['content'] ?? '';
        $messageType = $data['message_type'] ?? 'text';
        
        if (!$conversationId || !$content) {
            http_response_code(400);
            echo json_encode(['error' => 'Conversation ID and content are required']);
            return;
        }
        
        try {
            if (!$this->isUserInConversation($conversationId, $user['id'])) {
                http_response_code(403);
                echo json_encode(['error' => 'Not authorized for this conversation']);
                return;
            }
            
            $bodyColumn = $this->hasMessageColumn('content') ? 'content' : ($this->hasMessageColumn('message') ? 'message' : null);
            if (!$bodyColumn) {
                throw new Exception('Messages table is missing message/content column');
            }

            $columns = ['conversation_id', 'sender_id', $bodyColumn];
            $placeholders = ['?', '?', '?'];
            $params = [$conversationId, $user['id'], $content];

            if ($this->hasMessageColumn('message_type')) {
                $columns[] = 'message_type';
                $placeholders[] = '?';
                $params[] = $messageType;
            }

            $sql = "INSERT INTO messages (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $messageId = $this->db->lastInsertId();
            
            // Get the full message with user details
            $messageBodyExpr = $this->hasMessageColumn('content') ? 'm.content' : ($this->hasMessageColumn('message') ? 'm.message' : "''");
            $messageTypeExpr = $this->hasMessageColumn('message_type') ? 'm.message_type' : "'text'";
            $stmt = $this->db->prepare("
                SELECT
                    m.id,
                    m.conversation_id,
                    m.sender_id,
                    {$messageBodyExpr} as content,
                    {$messageTypeExpr} as message_type,
                    m.created_at,
                    u.full_name as sender_name,
                    u.avatar_url as sender_avatar
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.id = ?
            ");
            $stmt->execute([$messageId]);
            $message = $stmt->fetch();
            
            // Update conversation updated_at
            $this->db->prepare("
                UPDATE conversations 
                SET updated_at = NOW() 
                WHERE id = ?
            ")->execute([$conversationId]);
            
            // Get other participants
            $stmt = $this->db->prepare("
                SELECT user_id 
                FROM conversation_participants 
                WHERE conversation_id = ? AND user_id != ?
            ");
            $stmt->execute([$conversationId, $user['id']]);
            $participants = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            http_response_code(201);
            header('Content-Type: application/json');
            echo json_encode([
                'message' => $message,
                'participants' => $participants
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function deleteMessage() {
        $user = $this->auth->authenticate();

        if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            return;
        }

        if (!$this->guardChatSchema()) {
            return;
        }

        $messageId = $this->getIdFromUrl();
        if (!$messageId) {
            http_response_code(400);
            echo json_encode(['error' => 'Message ID is required']);
            return;
        }

        try {
            $stmt = $this->db->prepare("SELECT id, conversation_id, sender_id FROM messages WHERE id = ? LIMIT 1");
            $stmt->execute([(int)$messageId]);
            $message = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$message) {
                http_response_code(404);
                echo json_encode(['error' => 'Message not found']);
                return;
            }

            $conversationId = (int)$message['conversation_id'];
            $senderId = (int)$message['sender_id'];
            $isAdmin = strtolower((string)($user['role'] ?? '')) === 'admin';

            if (!$isAdmin && $senderId !== (int)$user['id']) {
                http_response_code(403);
                echo json_encode(['error' => 'Not authorized to delete this message']);
                return;
            }

            if (!$this->isUserInConversation($conversationId, (int)$user['id'])) {
                http_response_code(403);
                echo json_encode(['error' => 'Not authorized to delete this message']);
                return;
            }

            $this->db->beginTransaction();

            try {
                $stmt = $this->db->prepare("DELETE FROM message_reads WHERE message_id = ?");
                $stmt->execute([(int)$messageId]);
            } catch (Exception $e) {
            }

            $stmt = $this->db->prepare("DELETE FROM messages WHERE id = ?");
            $stmt->execute([(int)$messageId]);

            $this->db->commit();

            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'Message deleted',
                'message_id' => (int)$messageId,
                'conversation_id' => $conversationId,
            ]);
        } catch (Exception $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function updateMessage() {
        $user = $this->auth->authenticate();

        if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            return;
        }

        if (!$this->guardChatSchema()) {
            return;
        }

        $messageId = $this->getIdFromUrl();
        if (!$messageId) {
            http_response_code(400);
            echo json_encode(['error' => 'Message ID is required']);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $content = $data['content'] ?? '';

        if (!$content) {
            http_response_code(400);
            echo json_encode(['error' => 'Content is required']);
            return;
        }

        try {
            $stmt = $this->db->prepare("SELECT id, conversation_id, sender_id FROM messages WHERE id = ? LIMIT 1");
            $stmt->execute([(int)$messageId]);
            $message = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$message) {
                http_response_code(404);
                echo json_encode(['error' => 'Message not found']);
                return;
            }

            $conversationId = (int)$message['conversation_id'];
            $senderId = (int)$message['sender_id'];

            if ($senderId !== (int)$user['id']) {
                http_response_code(403);
                echo json_encode(['error' => 'Not authorized to edit this message']);
                return;
            }

            if (!$this->isUserInConversation($conversationId, (int)$user['id'])) {
                http_response_code(403);
                echo json_encode(['error' => 'Not authorized']);
                return;
            }

            $bodyColumn = $this->hasMessageColumn('content') ? 'content' : ($this->hasMessageColumn('message') ? 'message' : null);
            if (!$bodyColumn) {
                throw new Exception('Messages table is missing content column');
            }

            $this->db->prepare("UPDATE messages SET {$bodyColumn} = ?, updated_at = NOW() WHERE id = ?")
                ->execute([$content, (int)$messageId]);

            $messageTypeExpr = $this->hasMessageColumn('message_type') ? 'm.message_type' : "'text'";
            $stmt = $this->db->prepare("
                SELECT m.id, m.conversation_id, m.sender_id, m.{$bodyColumn} as content, {$messageTypeExpr} as message_type, m.created_at, m.updated_at,
                       u.full_name as sender_name, u.avatar_url as sender_avatar
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.id = ?
            ");
            $stmt->execute([(int)$messageId]);
            $updated = $stmt->fetch();

            header('Content-Type: application/json');
            echo json_encode(['success' => true, 'message' => $updated]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function markAsRead() {
        // Authenticate user
        $user = $this->auth->authenticate();

        if (!$this->guardChatSchema()) {
            return;
        }
        
        $messageId = $this->getIdFromUrl();
        
        if (!$messageId) {
            http_response_code(400);
            echo json_encode(['error' => 'Message ID is required']);
            return;
        }
        
        try {
            $stmt = $this->db->prepare("SELECT conversation_id, sender_id FROM messages WHERE id = ? LIMIT 1");
            $stmt->execute([$messageId]);
            $message = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$message) {
                http_response_code(404);
                echo json_encode(['error' => 'Message not found']);
                return;
            }

            if (!$this->isUserInConversation($message['conversation_id'], $user['id'])) {
                http_response_code(404);
                echo json_encode(['error' => 'Message not found or not authorized']);
                return;
            }
            
            // Mark message as read
            $stmt = $this->db->prepare("
                INSERT IGNORE INTO message_reads (message_id, user_id) 
                VALUES (?, ?)
            ");
            $stmt->execute([$messageId, $user['id']]);
            
            // Update last read message in conversation
            try {
                $stmt = $this->db->prepare("
                    UPDATE conversation_participants 
                    SET last_read_message_id = ?
                    WHERE conversation_id = ? AND user_id = ?
                ");
                $stmt->execute([$messageId, $message['conversation_id'], $user['id']]);
            } catch (Exception $e) {
            }
            
            echo json_encode([
                'message' => 'Message marked as read',
                'message_id' => $messageId,
                'sender_id' => $message['sender_id']
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    private function getIdFromUrl() {
        $requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        if (!$requestPath) return null;

        if (preg_match_all('/(\d+)/', $requestPath, $matches) && !empty($matches[1])) {
            $id = end($matches[1]);
            return (int)$id;
        }

        return null;
    }

    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        
        // Parse the request to determine which method to call
        if (strpos($requestUri, '/api/conversations') !== false) {
            if (preg_match('/\/api\/conversations\/(\d+)\/messages/', $requestUri, $matches)) {
                $this->getMessages();
            } elseif (preg_match('/\/api\/conversations\/(\d+)/', $requestUri, $matches)) {
                if ($method === 'DELETE') {
                    $this->deleteConversation();
                } else {
                    $this->getConversation();
                }
            } else {
                $this->conversations();
            }
        } elseif (strpos($requestUri, '/api/messages') !== false) {
            if (preg_match('/\/api\/messages\/(\d+)\/read/', $requestUri, $matches)) {
                $this->markAsRead();
            } elseif (preg_match('/\/api\/messages\/(\d+)/', $requestUri, $matches)) {
                if ($method === 'DELETE') {
                    $this->deleteMessage();
                } elseif ($method === 'PUT') {
                    $this->updateMessage();
                } else {
                    http_response_code(405);
                    echo json_encode(['error' => 'Method not allowed']);
                }
            } else {
                $this->sendMessage();
            }
        }
    }
}

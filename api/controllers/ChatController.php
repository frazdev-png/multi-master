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
            $this->db->exec("CREATE TABLE IF NOT EXISTS conversation_audit_log (id INT AUTO_INCREMENT PRIMARY KEY, conversation_id INT NOT NULL, action VARCHAR(50) NOT NULL, old_status VARCHAR(20) NULL, new_status VARCHAR(20) NULL, admin_id INT NULL, admin_name VARCHAR(255) NULL, reason TEXT NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_cal_conversation (conversation_id)) ENGINE=InnoDB");

            // Add new columns if not exist
            try { $this->db->exec("ALTER TABLE conversations ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'open'"); } catch (Exception $e) {}
            try { $this->db->exec("ALTER TABLE conversations ADD COLUMN subject VARCHAR(255) NULL"); } catch (Exception $e) {}
            try { $this->db->exec("ALTER TABLE messages ADD COLUMN attachment_url VARCHAR(500) NULL"); } catch (Exception $e) {}
            try { $this->db->exec("ALTER TABLE messages ADD COLUMN attachment_type VARCHAR(50) NULL"); } catch (Exception $e) {}

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

    // Non-admin users (customers/sellers) can ONLY communicate with admin.
    // No other non-admin participant beside themselves is allowed.
    private function isAllowedConversation($conversationId, $user) {
        $role = strtolower((string)($user['role'] ?? ''));
        // Admin is always allowed
        if ($role === 'admin') return true;

        try {
            $stmt = $this->db->prepare("
                SELECT u.id, u.role FROM conversation_participants cp
                JOIN users u ON cp.user_id = u.id
                WHERE cp.conversation_id = ?
            ");
            $stmt->execute([(int)$conversationId]);
            $participants = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $hasAdmin = false;
            $otherNonAdminCount = 0;

            foreach ($participants as $p) {
                $r = strtolower((string)($p['role'] ?? ''));
                $pid = (int)($p['id'] ?? 0);

                if ($r === 'admin') {
                    $hasAdmin = true;
                } elseif ($pid !== (int)$user['id']) {
                    $otherNonAdminCount++;
                }
            }

            // Must have an admin AND no other non-admin participants besides self
            return $hasAdmin && $otherNonAdminCount === 0;
        } catch (Exception $e) {
            return false;
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

        if (!$this->isAllowedConversation($conversationId, $user)) {
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

            $statusSelect = $this->hasConversationColumn('status') ? 'c.status,' : "'open' as status,";
            $subjectSelect = $this->hasConversationColumn('subject') ? 'c.subject,' : 'NULL as subject,';

            if ($this->hasConversationColumn('user1_id') && $this->hasConversationColumn('user2_id')) {
                $userRole = strtolower((string)($user['role'] ?? ''));
                $legacyCondition = '';
                $legacyParams = [];
                // Non-admin users: other user must be admin
                if ($userRole !== 'admin') {
                    $legacyCondition = " AND u.role = 'admin'";
                }
                $stmt = $this->db->prepare("
                    SELECT
                        c.id as conversation_id,
                        c.created_at,
                        c.updated_at,
                        {$statusSelect}
                        {$subjectSelect}
                        u.id as other_user_id,
                        u.full_name as other_user_name,
                        u.email as other_user_email,
                        u.avatar_url as other_user_avatar,
                        u.role as other_user_role,
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
                    WHERE (c.user1_id = ? OR c.user2_id = ?)
                    {$legacyCondition}
                    ORDER BY COALESCE(m.created_at, c.updated_at, c.created_at) DESC
                ");
                $stmt->execute([$user['id'], $user['id'], $user['id']]);
            } else {
                $userRole = strtolower((string)($user['role'] ?? ''));
                $extraCondition = '';
                $extraParams = [];
                // Non-admin users: ALL other participants must be admin
                if ($userRole !== 'admin') {
                    $extraCondition = "AND NOT EXISTS (
                        SELECT 1 FROM conversation_participants cp3
                        JOIN users u3 ON cp3.user_id = u3.id
                        WHERE cp3.conversation_id = c.id
                        AND cp3.user_id != ?
                        AND LOWER(u3.role) NOT IN ('admin')
                    )";
                    $extraParams = [$user['id']];
                }
                $stmt = $this->db->prepare("
                    SELECT 
                        c.id as conversation_id,
                        c.created_at,
                        c.updated_at,
                        {$statusSelect}
                        {$subjectSelect}
                        u.id as other_user_id,
                        u.full_name as other_user_name,
                        u.email as other_user_email,
                        u.avatar_url as other_user_avatar,
                        u.role as other_user_role,
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
                    WHERE cp.user_id = ?
                    AND cp2.user_id = (
                        SELECT COALESCE(MIN(cp3.user_id), 0) FROM conversation_participants cp3
                        WHERE cp3.conversation_id = c.id AND cp3.user_id != ?
                    )
                    {$extraCondition}
                    ORDER BY m.created_at DESC
                ");

                $allParams = [$user['id'], $user['id'], $user['id']];
                foreach ($extraParams as $ep) { $allParams[] = $ep; }
                $stmt->execute($allParams);
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
        $subject = $data['subject'] ?? '';
        
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
            $stmt = $this->db->prepare("SELECT id, role FROM users WHERE id = ?{$recipientActiveWhere}");
            $stmt->execute([$recipientId]);
            $recipient = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$recipient) {
                http_response_code(404);
                echo json_encode(['error' => 'Recipient not found']);
                return;
            }

            // Role-based restrictions: customers/sellers can only chat with admin
            $userRole = strtolower((string)($user['role'] ?? ''));
            $recipientRole = strtolower((string)($recipient['role'] ?? ''));
            $isAdmin = $userRole === 'admin';

            if (!$isAdmin && $recipientRole !== 'admin') {
                http_response_code(403);
                echo json_encode(['error' => 'You can only start conversations with Admin']);
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
                $hasSubject = $this->hasConversationColumn('subject');
                if ($hasSubject && $subject) {
                    $stmt = $this->db->prepare("INSERT INTO conversations (user1_id, user2_id, subject) VALUES (?, ?, ?)");
                    $stmt->execute([(int)$user['id'], (int)$recipientId, $subject]);
                } else {
                    $stmt = $this->db->prepare("INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)");
                    $stmt->execute([(int)$user['id'], (int)$recipientId]);
                }
                $conversationId = $this->db->lastInsertId();
            } else {
                $hasSubject = $this->hasConversationColumn('subject');
                if ($hasSubject && $subject) {
                    $this->db->prepare("INSERT INTO conversations (subject) VALUES (?)")->execute([$subject]);
                } else {
                    $this->db->exec("INSERT INTO conversations () VALUES ()");
                }
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

        if (!$this->isAllowedConversation($conversationId, $user)) {
            http_response_code(403);
            echo json_encode(['error' => 'Not authorized to view this conversation']);
            return;
        }
        
        $onlineSelect = $this->hasUserColumn('is_online') ? 'u.is_online as is_online,' : '0 as is_online,';
        $lastSeenSelect = $this->hasUserColumn('last_seen') ? 'u.last_seen as last_seen' : 'NULL as last_seen';
        $statusSelect = $this->hasConversationColumn('status') ? 'c.status,' : "'open' as status,";
        $subjectSelect = $this->hasConversationColumn('subject') ? 'c.subject,' : 'NULL as subject,';

        $roleSelect = $this->hasUserColumn('role') ? 'u.role as other_user_role,' : "'customer' as other_user_role,";

        if ($this->hasConversationColumn('user1_id') && $this->hasConversationColumn('user2_id')) {
            $stmt = $this->db->prepare("
                SELECT
                    c.id as conversation_id,
                    c.created_at,
                    c.updated_at,
                    {$statusSelect}
                    {$subjectSelect}
                    u.id as user_id,
                    u.full_name,
                    u.email,
                    u.avatar_url,
                    {$roleSelect}
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
                    {$statusSelect}
                    {$subjectSelect}
                    u.id as user_id,
                    u.full_name,
                    u.email,
                    u.avatar_url,
                    u.role as other_user_role,
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

        if (!$this->isAllowedConversation($conversationId, $user)) {
            http_response_code(403);
            echo json_encode(['error' => 'Not authorized to view this conversation']);
            return;
        }
        
        $messageBodyExpr = $this->hasMessageColumn('content') ? 'm.content' : ($this->hasMessageColumn('message') ? 'm.message' : "''");
        $messageTypeExpr = $this->hasMessageColumn('message_type') ? 'm.message_type' : "'text'";
        $attachmentUrlExpr = $this->hasMessageColumn('attachment_url') ? 'm.attachment_url,' : 'NULL as attachment_url,';
        $attachmentTypeExpr = $this->hasMessageColumn('attachment_type') ? 'm.attachment_type' : 'NULL as attachment_type';

        // Get messages
        $stmt = $this->db->prepare("
            SELECT 
                m.id,
                m.conversation_id,
                m.sender_id,
                {$messageBodyExpr} as content,
                {$messageTypeExpr} as message_type,
                {$attachmentUrlExpr}
                {$attachmentTypeExpr},
                m.created_at,
                u.full_name as sender_name, 
                u.avatar_url as sender_avatar,
                u.role as sender_role,
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
        $attachmentUrl = $data['attachment_url'] ?? null;
        $attachmentType = $data['attachment_type'] ?? null;
        
        if (!$conversationId) {
            http_response_code(400);
            echo json_encode(['error' => 'Conversation ID is required']);
            return;
        }

        if (!$content && !$attachmentUrl) {
            http_response_code(400);
            echo json_encode(['error' => 'Content or attachment is required']);
            return;
        }
        
        try {
            if (!$this->isUserInConversation($conversationId, $user['id'])) {
                http_response_code(403);
                echo json_encode(['error' => 'Not authorized for this conversation']);
                return;
            }

            if (!$this->isAllowedConversation($conversationId, $user)) {
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

            if ($this->hasMessageColumn('attachment_url') && $attachmentUrl) {
                $columns[] = 'attachment_url';
                $placeholders[] = '?';
                $params[] = $attachmentUrl;
            }

            if ($this->hasMessageColumn('attachment_type') && $attachmentType) {
                $columns[] = 'attachment_type';
                $placeholders[] = '?';
                $params[] = $attachmentType;
            }

            $sql = "INSERT INTO messages (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $messageId = $this->db->lastInsertId();
            
            // Get the full message with user details
            $messageBodyExpr = $this->hasMessageColumn('content') ? 'm.content' : ($this->hasMessageColumn('message') ? 'm.message' : "''");
            $messageTypeExpr = $this->hasMessageColumn('message_type') ? 'm.message_type' : "'text'";
            $attachmentUrlExpr = $this->hasMessageColumn('attachment_url') ? 'm.attachment_url,' : 'NULL as attachment_url,';
            $attachmentTypeExpr = $this->hasMessageColumn('attachment_type') ? 'm.attachment_type' : 'NULL as attachment_type';
            $stmt = $this->db->prepare("
                SELECT
                    m.id,
                    m.conversation_id,
                    m.sender_id,
                    {$messageBodyExpr} as content,
                    {$messageTypeExpr} as message_type,
                    {$attachmentUrlExpr}
                    {$attachmentTypeExpr},
                    m.created_at,
                    u.full_name as sender_name,
                    u.avatar_url as sender_avatar,
                    u.role as sender_role
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
            
            // Notify other participants via realtime events
            foreach ($participants as $participantId) {
                $this->createRealtimeEvent('new_message', $participantId, [
                    'conversation_id' => $conversationId,
                    'message_id' => $messageId,
                    'sender_id' => $user['id'],
                    'sender_name' => $user['full_name'] ?? $user['email'],
                    'sender_role' => $user['role'] ?? '',
                    'has_attachment' => $attachmentUrl ? true : false,
                    'attachment_type' => $attachmentType,
                ]);
            }
            
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

            if (!$this->isAllowedConversation($conversationId, $user)) {
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

            if (!$this->isAllowedConversation($conversationId, $user)) {
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

            if (!$this->isAllowedConversation($message['conversation_id'], $user)) {
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

    private function createRealtimeEvent($eventType, $targetUserId, $payload) {
        try {
            $stmt = $this->db->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'realtime_events' LIMIT 1");
            $stmt->execute();
            if (!$stmt->fetch(PDO::FETCH_NUM)) return;
        } catch (Exception $e) { return; }

        try {
            $this->db->prepare("INSERT INTO realtime_events (event_type, target_role, target_user_id, payload, created_at) VALUES (?, NULL, ?, ?, NOW())")
                ->execute([$eventType, $targetUserId, json_encode($payload)]);
        } catch (Exception $e) {}
    }

    public function updateConversationStatus() {
        $user = $this->auth->authenticate('admin');

        if (!$this->guardChatSchema()) { return; }

        $conversationId = $this->getIdFromUrl();
        if (!$conversationId) {
            http_response_code(400);
            echo json_encode(['error' => 'Conversation ID is required']);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $status = $data['status'] ?? '';
        $reason = $data['reason'] ?? '';

        $validStatuses = ['open', 'under_review', 'resolved', 'closed'];
        if (!in_array($status, $validStatuses)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid status. Valid: ' . implode(', ', $validStatuses)]);
            return;
        }

        try {
            $stmt = $this->db->prepare("SELECT status FROM conversations WHERE id = ?");
            $stmt->execute([$conversationId]);
            $conv = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$conv) {
                http_response_code(404);
                echo json_encode(['error' => 'Conversation not found']);
                return;
            }

            $oldStatus = $conv['status'] ?? 'open';

            $this->db->prepare("UPDATE conversations SET status = ? WHERE id = ?")
                ->execute([$status, $conversationId]);

            // Audit log
            $this->db->prepare("INSERT INTO conversation_audit_log (conversation_id, action, old_status, new_status, admin_id, admin_name, reason) VALUES (?, ?, ?, ?, ?, ?, ?)")
                ->execute([$conversationId, 'status_change', $oldStatus, $status, $user['id'], $user['full_name'] ?? $user['email'], $reason]);

            // Notify participants
            $stmt = $this->db->prepare("SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?");
            $stmt->execute([$conversationId, $user['id']]);
            $participants = $stmt->fetchAll(PDO::FETCH_COLUMN);
            foreach ($participants as $participantId) {
                $this->createRealtimeEvent('conversation_status', $participantId, [
                    'conversation_id' => $conversationId,
                    'old_status' => $oldStatus,
                    'new_status' => $status,
                    'reason' => $reason,
                    'admin_name' => $user['full_name'] ?? $user['email'],
                ]);
            }

            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Conversation status updated', 'status' => $status]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function adminGetAllConversations() {
        $user = $this->auth->authenticate('admin');

        if (!$this->guardChatSchema()) { return; }

        $search = trim($_GET['search'] ?? '');
        $status = trim($_GET['status'] ?? '');

        try {
            $onlineSelect = $this->hasUserColumn('is_online') ? 'u.is_online as other_user_online,' : '0 as other_user_online,';
            $lastSeenSelect = $this->hasUserColumn('last_seen') ? 'u.last_seen as other_user_last_seen,' : 'NULL as other_user_last_seen,';
            $lastMessageExpr = $this->hasMessageColumn('content') ? 'm.content' : ($this->hasMessageColumn('message') ? 'm.message' : "''");
            $statusSelect = $this->hasConversationColumn('status') ? 'c.status,' : "'open' as status,";
            $subjectSelect = $this->hasConversationColumn('subject') ? 'c.subject,' : 'NULL as subject,';

            // If legacy columns exist, use them directly — covers ALL conversations
            if ($this->hasConversationColumn('user1_id') && $this->hasConversationColumn('user2_id')) {
                $sql = "
                    SELECT 
                        c.id as conversation_id,
                        c.created_at,
                        c.updated_at,
                        {$statusSelect}
                        {$subjectSelect}
                        u.id as other_user_id,
                        u.full_name as other_user_name,
                        u.email as other_user_email,
                        u.avatar_url as other_user_avatar,
                        u.role as other_user_role,
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
                ";
                $params = [$user['id'], $user['id'], $user['id']];
            } else {
                $sql = "
                    SELECT 
                        c.id as conversation_id,
                        c.created_at,
                        c.updated_at,
                        {$statusSelect}
                        {$subjectSelect}
                        u.id as other_user_id,
                        u.full_name as other_user_name,
                        u.email as other_user_email,
                        u.avatar_url as other_user_avatar,
                        u.role as other_user_role,
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
                    WHERE cp.user_id = ?
                    AND cp2.user_id = (
                        SELECT COALESCE(MIN(cp3.user_id), 0) FROM conversation_participants cp3
                        WHERE cp3.conversation_id = c.id AND cp3.user_id != ?
                    )
                ";
                $params = [$user['id'], $user['id'], $user['id']];
            }

            if ($search !== '') {
                $sql .= " AND (u.full_name LIKE ? OR u.email LIKE ? OR u.role LIKE ?)";
                $p = "%$search%";
                $params[] = $p;
                $params[] = $p;
                $params[] = $p;
            }

            if ($status !== '' && $this->hasConversationColumn('status')) {
                $sql .= " AND c.status = ?";
                $params[] = $status;
            }

            $sql .= " ORDER BY COALESCE(m.created_at, c.updated_at, c.created_at) DESC";

            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);

            header('Content-Type: application/json');
            echo json_encode(['conversations' => $conversations]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function uploadAttachment() {
        $user = $this->auth->authenticate();

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            return;
        }

        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'File upload failed']);
            return;
        }

        $conversationId = $_POST['conversation_id'] ?? null;
        if (!$conversationId) {
            http_response_code(400);
            echo json_encode(['error' => 'Conversation ID is required']);
            return;
        }

        if (!$this->isUserInConversation($conversationId, $user['id'])) {
            http_response_code(403);
            echo json_encode(['error' => 'Not authorized for this conversation']);
            return;
        }

        if (!$this->isAllowedConversation($conversationId, $user)) {
            http_response_code(403);
            echo json_encode(['error' => 'Not authorized for this conversation']);
            return;
        }

        $file = $_FILES['file'];
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        $maxSize = 10 * 1024 * 1024; // 10MB

        if (!in_array($file['type'], $allowedTypes)) {
            http_response_code(400);
            echo json_encode(['error' => 'File type not allowed. Allowed: jpg, png, gif, webp, pdf, doc, docx']);
            return;
        }

        if ($file['size'] > $maxSize) {
            http_response_code(400);
            echo json_encode(['error' => 'File too large. Max 10MB']);
            return;
        }

        $uploadDir = __DIR__ . '/../uploads/chat/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = 'chat_' . $conversationId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $destPath = $uploadDir . $filename;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save file']);
            return;
        }

        $attachmentUrl = '/uploads/chat/' . $filename;
        $attachmentType = strpos($file['type'], 'image/') === 0 ? 'image' : 'document';
        $content = $_POST['content'] ?? '';

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'attachment_url' => $attachmentUrl,
            'attachment_type' => $attachmentType,
            'filename' => $file['name'],
        ]);
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
            if (preg_match('/\/api\/conversations\/(\d+)\/status/', $requestUri, $matches)) {
                if ($method === 'PUT') {
                    $this->updateConversationStatus();
                } else {
                    http_response_code(405);
                    echo json_encode(['error' => 'Method not allowed']);
                }
            } elseif (preg_match('/\/api\/conversations\/(\d+)\/messages/', $requestUri, $matches)) {
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
        } elseif (strpos($requestUri, '/api/admin/conversations') !== false) {
            $this->adminGetAllConversations();
        } elseif ($requestUri === '/api/messages/upload') {
            $this->uploadAttachment();
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

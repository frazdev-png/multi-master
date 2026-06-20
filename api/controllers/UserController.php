<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class UserController {
    private $db;
    private $auth;
    private $userColumns;

    public function __construct() {
        $this->db = new Database();
        $this->auth = new AuthMiddleware();
        $this->userColumns = null;
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

    public function getUsers() {
        // Authenticate user
        $user = $this->auth->authenticate();
        
        $search = $_GET['search'] ?? '';
        $role = $_GET['role'] ?? null;
        $limit = min($_GET['limit'] ?? 20, 50);
        $offset = $_GET['offset'] ?? 0;
        
        try {
            $activeWhere = $this->hasUserColumn('is_active') ? 'is_active = 1 AND ' : '';
            $onlineSelect = $this->hasUserColumn('is_online') ? 'is_online,' : '0 as is_online,';
            $lastSeenSelect = $this->hasUserColumn('last_seen') ? 'last_seen' : 'NULL as last_seen';
            $sql = "
                SELECT 
                    id, 
                    full_name, 
                    email, 
                    role, 
                    avatar_url,
                    {$onlineSelect}
                    {$lastSeenSelect}
                FROM users 
                WHERE {$activeWhere}id != ?
            ";
            $params = [$user['id']];
            
            if (!empty($search)) {
                $sql .= " AND (full_name LIKE ? OR email LIKE ?)";
                $searchParam = "%{$search}%";
                $params[] = $searchParam;
                $params[] = $searchParam;
            }
            
            if ($role && in_array($role, ['admin', 'seller', 'customer'])) {
                $sql .= " AND role = ?";
                $params[] = $role;
            }
            
            if ($this->hasUserColumn('is_online')) {
                $sql .= " ORDER BY is_online DESC, full_name ASC LIMIT ? OFFSET ?";
            } else {
                $sql .= " ORDER BY full_name ASC LIMIT ? OFFSET ?";
            }
            $params[] = $limit;
            $params[] = $offset;
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Remove sensitive info
            foreach ($users as &$u) {
                unset($u['password_hash']);
            }
            
            header('Content-Type: application/json');
            echo json_encode(['users' => $users]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function handleRequest() {
        $this->getUsers();
    }
}

<?php
require_once 'BaseModel.php';

class UserModel extends BaseModel {
    public function __construct() {
        parent::__construct('users');
    }

    // Get all users (for admin functionality)
    public function all() {
        $query = 'SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at DESC';
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Get user by ID
    public function getById($id) {
        $query = 'SELECT id, email, role, is_active, created_at FROM users WHERE id = :id LIMIT 1';
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Update user status
    public function updateStatus($id, $isActive) {
        $query = 'UPDATE users SET is_active = :is_active, updated_at = NOW() WHERE id = :id';
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':is_active', $isActive);
        return $stmt->execute();
    }
}

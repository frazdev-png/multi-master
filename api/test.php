<?php
// Test database connection
require_once 'config/Database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    echo "Database connection: SUCCESS\n";
    
    // Test if tables exist
    $tables = ['users', 'conversations', 'messages', 'conversation_participants'];
    foreach ($tables as $table) {
        $result = $conn->query("SHOW TABLES LIKE '$table'");
        echo "$table table: " . ($result->rowCount() > 0 ? "EXISTS" : "MISSING") . "\n";
    }
    
    // Check admin user
    $stmt = $conn->prepare("SELECT id, email, role FROM users WHERE role = 'admin'");
    $stmt->execute();
    $admin = $stmt->fetch();
    echo "Admin user: " . ($admin ? "EXISTS ({$admin['email']})" : "MISSING") . "\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
?>

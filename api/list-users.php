<?php
require_once __DIR__ . '/config/Database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("SELECT id, email, role, full_name, is_active FROM users ORDER BY id");
echo str_pad("ID", 4) . str_pad("Email", 35) . str_pad("Role", 12) . "Active\n";
echo str_repeat("-", 65) . "\n";
while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo str_pad($r['id'], 4) . str_pad($r['email'], 35) . str_pad($r['role'], 12) . $r['is_active'] . "\n";
}

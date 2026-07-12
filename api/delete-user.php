<?php
require_once __DIR__ . '/config/Database.php';

$email = $argv[1] ?? '';
if (!$email) {
    die("Usage: php delete-user.php <email>\n");
}

try {
    $db = new Database();
    $conn = $db->getConnection();

    $stmt = $conn->prepare("SELECT id, email, role, full_name FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        die("User not found: $email\n");
    }

    $id = $user['id'];
    echo "Found: {$user['full_name']} ({$user['email']}) role={$user['role']} id=$id\n";

    $conn->beginTransaction();

    $conn->prepare("DELETE FROM cart WHERE user_id = ?")->execute([$id]);
    $conn->prepare("DELETE FROM wishlist WHERE user_id = ?")->execute([$id]);
    $conn->prepare("DELETE FROM wallets WHERE user_id = ?")->execute([$id]);
    $conn->prepare("DELETE FROM wallet_transactions WHERE user_id = ? OR admin_id = ?")->execute([$id, $id]);
    $conn->prepare("DELETE FROM notifications WHERE user_id = ?")->execute([$id]);
    $conn->prepare("DELETE FROM conversation_participants WHERE user_id = ?")->execute([$id]);
    $conn->prepare("DELETE FROM staff WHERE user_id = ?")->execute([$id]);

    $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$id]);

    $conn->commit();
    echo "User deleted successfully.\n";
} catch (Exception $e) {
    if (isset($conn)) $conn->rollBack();
    die("Error: " . $e->getMessage() . "\n");
}

<?php
/**
 * Migration: Inject admin into conversations that have no admin participant.
 * Run ONCE after deploying the chat permission fixes.
 *
 * Usage: php api/migrate_conversations.php
 */

require_once __DIR__ . '/config/Database.php';

$db = new Database();
$conn = $db->getConnection();

echo "=== Conversation Migration ===\n\n";

// Step 1: Find the first admin user
$stmt = $conn->prepare("SELECT id, email FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
$stmt->execute();
$admin = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$admin) {
    echo "ERROR: No admin user found. Create an admin first.\n";
    exit(1);
}

echo "Using admin: ID {$admin['id']} ({$admin['email']})\n\n";

// Step 2: Find conversations with conversation_participants that lack an admin
$stmt = $conn->prepare("
    SELECT cp.conversation_id
    FROM conversation_participants cp
    JOIN users u ON cp.user_id = u.id
    GROUP BY cp.conversation_id
    HAVING SUM(CASE WHEN LOWER(u.role) = 'admin' THEN 1 ELSE 0 END) = 0
");
$stmt->execute();
$convIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

if (count($convIds) === 0) {
    echo "No conversation_participants-based conversations found that lack admin.\n";
} else {
    echo "Found " . count($convIds) . " conversation(s) in conversation_participants without admin.\n";

    // Check which ones already have this admin
    $placeholders = implode(',', array_fill(0, count($convIds), '?'));
    $checkStmt = $conn->prepare("
        SELECT cp.conversation_id FROM conversation_participants cp
        WHERE cp.conversation_id IN ($placeholders) AND cp.user_id = ?
    ");
    $checkParams = array_merge($convIds, [$admin['id']]);
    $checkStmt->execute($checkParams);
    $existing = $checkStmt->fetchAll(PDO::FETCH_COLUMN);
    $existingSet = array_flip($existing);

    $insertStmt = $conn->prepare("INSERT IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)");
    $injected = 0;
    foreach ($convIds as $cid) {
        if (!isset($existingSet[$cid])) {
            $insertStmt->execute([(int)$cid, (int)$admin['id']]);
            $injected++;
            echo "  Injected admin into conversation #{$cid}\n";
        }
    }
    echo "Injected admin into {$injected} conversation(s).\n";
}

// Step 3: Handle legacy conversations (user1_id/user2_id) that may not be in conversation_participants yet
if ($conn->query("SHOW COLUMNS FROM conversations LIKE 'user1_id'")->rowCount() > 0) {
    echo "\nChecking legacy user1_id/user2_id conversations...\n";

    // Find legacy conversations that lack a conversation_participants entry for admin
    $stmt = $conn->prepare("
        SELECT c.id, c.user1_id, c.user2_id
        FROM conversations c
        WHERE c.id NOT IN (
            SELECT cp.conversation_id FROM conversation_participants cp WHERE cp.user_id = ?
        )
        AND (c.user1_id != ? OR c.user2_id != ?)
    ");
    $stmt->execute([$admin['id'], $admin['id'], $admin['id']]);
    $legacyRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $insertCp = $conn->prepare("INSERT IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)");
    $inserted = 0;
    foreach ($legacyRows as $row) {
        // Add admin
        $insertCp->execute([(int)$row['id'], (int)$admin['id']]);
        // Ensure both original users are also in conversation_participants
        $insertCp->execute([(int)$row['id'], (int)$row['user1_id']]);
        $insertCp->execute([(int)$row['id'], (int)$row['user2_id']]);
        $inserted++;
        echo "  Migrated legacy conversation #{$row['id']} (users: {$row['user1_id']}, {$row['user2_id']})\n";
    }
    echo "Migrated {$inserted} legacy conversation(s).\n";
}

echo "\n=== Migration Complete ===\n";

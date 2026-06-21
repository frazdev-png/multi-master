<?php
/**
 * Migration: Ensure conversation_participants has correct entries.
 * Does NOT create 3-way conversations (customer↔seller↔admin).
 * Only ensures admin is a participant in conversations where
 * admin was already one of the original two users.
 *
 * Usage: php api/migrate_conversations.php
 */

require_once __DIR__ . '/config/Database.php';

$db = new Database();
$conn = $db->getConnection();

echo "=== Conversation Migration ===\n\n";

$adminStmt = $conn->prepare("SELECT id, email FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
$adminStmt->execute();
$admin = $adminStmt->fetch(PDO::FETCH_ASSOC);

if (!$admin) {
    echo "ERROR: No admin user found. Create an admin first.\n";
    exit(1);
}

echo "Using admin: ID {$admin['id']} ({$admin['email']})\n\n";
$adminId = (int)$admin['id'];

$hasLegacyCols = $conn->query("SHOW COLUMNS FROM conversations LIKE 'user1_id'")->rowCount() > 0;

// Step 1: CLEANUP — remove admin from conversations where admin was NOT one of the original two users
echo "--- Cleanup: Removing admin from non-admin conversations ---\n";
$removed = 0;

if ($hasLegacyCols) {
    // Remove admin from legacy convos where admin wasn't one of the original pair
    $stmt = $conn->prepare("
        DELETE cp FROM conversation_participants cp
        JOIN conversations c ON c.id = cp.conversation_id
        WHERE cp.user_id = ?
        AND (c.user1_id != ? AND c.user2_id != ?)
    ");
    $stmt->execute([$adminId, $adminId, $adminId]);
    $removed = $stmt->rowCount();
    echo "  Removed admin from {$removed} conversation(s) where admin was not an original participant.\n";
} else {
    // For participant-table-only: remove admin from convos that have >2 participants
    $stmt = $conn->prepare("
        DELETE cp FROM conversation_participants cp
        JOIN (
            SELECT conversation_id FROM conversation_participants
            GROUP BY conversation_id
            HAVING COUNT(*) > 2
        ) multi ON multi.conversation_id = cp.conversation_id
        WHERE cp.user_id = ?
    ");
    $stmt->execute([$adminId]);
    $removed = $stmt->rowCount();
    echo "  Removed admin from {$removed} multi-participant conversation(s).\n";
}

// Step 2: Ensure participants exist for legacy conversations where admin IS an original participant
echo "\n--- Ensuring participant entries for admin conversations ---\n";
$ensured = 0;

if ($hasLegacyCols) {
    $stmt = $conn->prepare("
        SELECT c.id, c.user1_id, c.user2_id
        FROM conversations c
        WHERE (c.user1_id = ? OR c.user2_id = ?)
        AND c.id NOT IN (
            SELECT cp.conversation_id FROM conversation_participants cp WHERE cp.user_id = ?
        )
    ");
    $stmt->execute([$adminId, $adminId, $adminId]);
    $legacyRows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $insertCp = $conn->prepare("INSERT IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)");
    foreach ($legacyRows as $row) {
        $cid = (int)$row['id'];
        $u1 = (int)$row['user1_id'];
        $u2 = (int)$row['user2_id'];
        $insertCp->execute([$cid, $u1]);
        $insertCp->execute([$cid, $u2]);
        // Admin is already one of u1/u2, so they're also added
        $ensured++;
        echo "  Ensured participants for conversation #{$cid} (users: {$u1}, {$u2})\n";
    }
    echo "Ensured participants for {$ensured} legacy conversation(s).\n";
} else {
    echo "  No legacy columns found, skipping.\n";
}

// Step 3: Ensure the current admin user has a participant entry for all convos they're in
echo "\n--- Ensuring admin participant entry ---\n";
if ($hasLegacyCols) {
    $stmt = $conn->prepare("
        INSERT IGNORE INTO conversation_participants (conversation_id, user_id)
        SELECT id, ? FROM conversations
        WHERE (user1_id = ? OR user2_id = ?)
        AND id NOT IN (
            SELECT conversation_id FROM conversation_participants WHERE user_id = ?
        )
    ");
    $stmt->execute([$adminId, $adminId, $adminId, $adminId]);
    $added = $stmt->rowCount();
    echo "  Added admin participant entry for {$added} conversation(s).\n";
}

echo "\n=== Migration Complete ===\n";

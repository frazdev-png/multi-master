<?php
require_once __DIR__ . '/../config/Database.php';

class PermissionHelper {
    private static $cache = [];

    /**
     * Check if a user has a specific permission.
     * Super Admin bypasses all checks.
     * Users not in staff table (legacy admins) bypass all checks.
     */
    public static function hasPermission($userId, $permissionSlug) {
        $db = new Database();
        $conn = $db->getConnection();

        // Check super admin first
        $stmt = $conn->prepare("SELECT is_super_admin FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user) return false;
        if ((int)$user['is_super_admin'] === 1) return true;

        // Users NOT in staff table are legacy admins — allow everything
        $stmt = $conn->prepare("SELECT id FROM staff WHERE user_id = ? LIMIT 1");
        $stmt->execute([$userId]);
        if (!$stmt->fetch()) return true;

        // Get user's role from staff table + direct staff_permissions
        $stmt = $conn->prepare("
            SELECT 1 FROM staff s
            LEFT JOIN role_permissions rp ON rp.role_id = s.role_id
            LEFT JOIN permissions p ON p.id = rp.permission_id
            WHERE s.user_id = ? AND p.slug = ?
            UNION
            SELECT 1 FROM staff s
            JOIN staff_permissions sp ON sp.staff_id = s.id
            JOIN permissions p ON p.id = sp.permission_id
            WHERE s.user_id = ? AND p.slug = ?
            LIMIT 1
        ");
        $stmt->execute([$userId, $permissionSlug, $userId, $permissionSlug]);
        return (bool)$stmt->fetch();
    }

    /**
     * Get all permission slugs for a user (for frontend use).
     */
    public static function getUserPermissions($userId) {
        $cacheKey = "perms_{$userId}";
        if (isset(self::$cache[$cacheKey])) {
            return self::$cache[$cacheKey];
        }

        $db = new Database();
        $conn = $db->getConnection();

        // Super admin — return all permission slugs
        $stmt = $conn->prepare("SELECT is_super_admin FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user) return [];
        if ((int)$user['is_super_admin'] === 1) {
            $stmt = $conn->query("SELECT slug FROM permissions");
            $slugs = $stmt->fetchAll(PDO::FETCH_COLUMN);
            self::$cache[$cacheKey] = $slugs;
            return $slugs;
        }

        // Legacy admin (no staff record) — return all permission slugs
        $stmt = $conn->prepare("SELECT id FROM staff WHERE user_id = ? LIMIT 1");
        $stmt->execute([$userId]);
        if (!$stmt->fetch()) {
            $stmt = $conn->query("SELECT slug FROM permissions");
            $slugs = $stmt->fetchAll(PDO::FETCH_COLUMN);
            self::$cache[$cacheKey] = $slugs;
            return $slugs;
        }

        // Staff user — return role permissions + direct staff_permissions
        $stmt = $conn->prepare("
            SELECT p.slug FROM staff s
            JOIN role_permissions rp ON rp.role_id = s.role_id
            JOIN permissions p ON p.id = rp.permission_id
            WHERE s.user_id = ?
            UNION
            SELECT p.slug FROM staff s
            JOIN staff_permissions sp ON sp.staff_id = s.id
            JOIN permissions p ON p.id = sp.permission_id
            WHERE s.user_id = ?
        ");
        $stmt->execute([$userId, $userId]);
        $slugs = $stmt->fetchAll(PDO::FETCH_COLUMN);
        self::$cache[$cacheKey] = $slugs;
        return $slugs;
    }

    public static function requirePermission($userId, $permissionSlug) {
        if (!self::hasPermission($userId, $permissionSlug)) {
            http_response_code(403);
            echo json_encode(['error' => 'Access denied. Required permission: ' . $permissionSlug]);
            exit;
        }
    }
}

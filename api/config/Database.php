<?php
class Database {
    private $host;
    private $db_name;
    private $username;
    private $password;
    private $conn;
    private static $sharedConn;
    private static $schemaEnsured = false;
    private static $brokenTables = [];

    private function ensureHealthyTable(PDO $conn, string $table, string $createSql) {
        if (!empty(self::$brokenTables[$table])) {
            return;
        }

        $exists = null;
        try {
            // Some MySQL setups don't allow parameterized SHOW statements; use quote() + direct query.
            $q = $conn->quote($table);
            $stmt = $conn->query("SHOW TABLES LIKE {$q}");
            $exists = (bool)$stmt->fetch(PDO::FETCH_NUM);
        } catch (Exception $e) {
            // If SHOW TABLES fails for any reason, fall back to attempting creation.
            $exists = null;
        }

        if ($exists === false || $exists === null) {
            try {
                $conn->exec($createSql);
            } catch (Exception $e) {
                $msg = $e->getMessage();
                error_log("Failed to create table {$table}: " . $msg);

                // MySQL 1813: orphaned tablespace exists. App code cannot repair this.
                if (strpos($msg, '1813') !== false || strpos($msg, 'Tablespace for table') !== false) {
                    self::$brokenTables[$table] = true;
                }
            }
            return;
        }

        // If table exists but is corrupted / missing in engine (MySQL 1932), a simple query will throw.
        try {
            $conn->query("SELECT 1 FROM {$table} LIMIT 1");
        } catch (PDOException $e) {
            $msg = $e->getMessage();
            if (strpos($msg, '1932') !== false || strpos($msg, "doesn't exist in engine") !== false) {
                try {
                    $conn->exec('SET FOREIGN_KEY_CHECKS=0');
                } catch (Exception $ignore) {
                }
                try {
                    $conn->exec("DROP TABLE IF EXISTS {$table}");
                } catch (Exception $ignore) {
                }
                try {
                    $conn->exec($createSql);
                } catch (Exception $e2) {
                    error_log("Failed to recreate corrupted table {$table}: " . $e2->getMessage());
                }
                try {
                    $conn->exec('SET FOREIGN_KEY_CHECKS=1');
                } catch (Exception $ignore) {
                }
            }
        } catch (Exception $e) {
        }
    }

    private function ensureChatSchema(PDO $conn) {
        try {
            $this->ensureHealthyTable(
                $conn,
                'conversations',
                "CREATE TABLE IF NOT EXISTS conversations (id INT AUTO_INCREMENT PRIMARY KEY, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB"
            );
            $this->ensureHealthyTable(
                $conn,
                'conversation_participants',
                "CREATE TABLE IF NOT EXISTS conversation_participants (id INT AUTO_INCREMENT PRIMARY KEY, conversation_id INT NOT NULL, user_id INT NOT NULL, last_read_message_id INT NOT NULL DEFAULT 0, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_conversation_user (conversation_id, user_id), KEY idx_cp_user (user_id), KEY idx_cp_conversation (conversation_id)) ENGINE=InnoDB"
            );
            $this->ensureHealthyTable(
                $conn,
                'messages',
                "CREATE TABLE IF NOT EXISTS messages (id INT AUTO_INCREMENT PRIMARY KEY, conversation_id INT NOT NULL, sender_id INT NOT NULL, content TEXT NOT NULL, message_type VARCHAR(20) NOT NULL DEFAULT 'text', created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_messages_conversation (conversation_id), KEY idx_messages_sender (sender_id)) ENGINE=InnoDB"
            );
            $this->ensureHealthyTable(
                $conn,
                'message_reads',
                "CREATE TABLE IF NOT EXISTS message_reads (message_id INT NOT NULL, user_id INT NOT NULL, read_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (message_id, user_id), KEY idx_mr_user (user_id)) ENGINE=InnoDB"
            );
            $this->ensureHealthyTable(
                $conn,
                'wishlist',
                "CREATE TABLE IF NOT EXISTS wishlist (user_id INT NOT NULL, product_id INT NOT NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, product_id)) ENGINE=InnoDB"
            );
        } catch (Exception $e) {
        }
    }

    private function ensureSchema(PDO $conn) {
        try {
            $ensureTable = function (string $table, string $createSql) use ($conn) {
                $stmt = $conn->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1");
                $stmt->execute([$table]);
                if (!$stmt->fetch(PDO::FETCH_NUM)) {
                    $conn->exec($createSql);
                }
            };

            $ensureTable('users', "CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL, full_name VARCHAR(255) NULL, phone VARCHAR(20) NULL, avatar_url VARCHAR(255) DEFAULT NULL, is_online TINYINT(1) NOT NULL DEFAULT 0, last_seen TIMESTAMP NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, email_verified_at TIMESTAMP NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
            $ensureTable('sellers', "CREATE TABLE IF NOT EXISTS sellers (user_id INT PRIMARY KEY, business_name VARCHAR(255) NOT NULL, store_name VARCHAR(255) NOT NULL UNIQUE, cnic_number VARCHAR(20) NULL UNIQUE, cnic_document_url VARCHAR(255) DEFAULT NULL, tax_number VARCHAR(50) DEFAULT NULL, store_address TEXT NULL, bank_name VARCHAR(100) DEFAULT NULL, account_number VARCHAR(50) DEFAULT NULL, account_holder_name VARCHAR(255) DEFAULT NULL, is_approved TINYINT(1) NOT NULL DEFAULT 0, commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00) ENGINE=InnoDB");
            $ensureTable(
                'promo_codes',
                "CREATE TABLE IF NOT EXISTS promo_codes (id INT AUTO_INCREMENT PRIMARY KEY, code VARCHAR(20) NOT NULL UNIQUE, is_used TINYINT(1) NOT NULL DEFAULT 0, is_active TINYINT(1) NOT NULL DEFAULT 1, used_by_user_id INT NULL, used_at TIMESTAMP NULL, expires_at TIMESTAMP NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_promo_code (code), INDEX idx_promo_used_by (used_by_user_id), CONSTRAINT fk_promo_used_by_user FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB"
            );
            $ensureTable('categories', "CREATE TABLE IF NOT EXISTS categories (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, description TEXT NULL, image_url TEXT DEFAULT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
            $ensureTable('products', "CREATE TABLE IF NOT EXISTS products (id INT AUTO_INCREMENT PRIMARY KEY, seller_id INT NULL, category_id INT NULL, name VARCHAR(255) NOT NULL, description TEXT NULL, price DECIMAL(10,2) NOT NULL DEFAULT 0.00, stock INT NOT NULL DEFAULT 0, image_url TEXT DEFAULT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
            $ensureTable('orders', "CREATE TABLE IF NOT EXISTS orders (id INT AUTO_INCREMENT PRIMARY KEY, order_number VARCHAR(50) NULL, customer_id INT NULL, seller_id INT NULL, status VARCHAR(30) DEFAULT 'pending', subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00, tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00, shipping_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00, discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00, total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00, payment_status VARCHAR(30) DEFAULT 'pending', payment_method VARCHAR(50) DEFAULT NULL, shipping_address TEXT NULL, billing_address TEXT NULL, notes TEXT NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
            $ensureTable('order_items', "CREATE TABLE IF NOT EXISTS order_items (id INT AUTO_INCREMENT PRIMARY KEY, order_id INT NOT NULL, product_id INT NOT NULL, seller_id INT NOT NULL, quantity INT NOT NULL DEFAULT 1, unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00, total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
            $ensureTable('cart', "CREATE TABLE IF NOT EXISTS cart (user_id INT NOT NULL, product_id INT NOT NULL, quantity INT NOT NULL DEFAULT 1, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, product_id)) ENGINE=InnoDB");
            $ensureTable('reviews', "CREATE TABLE IF NOT EXISTS reviews (id INT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL, user_id INT NOT NULL, rating TINYINT NOT NULL, comment TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_reviews_product_id (product_id), INDEX idx_reviews_user_id (user_id)) ENGINE=InnoDB");

            $ensureTable(
                'withdrawals',
                "CREATE TABLE IF NOT EXISTS withdrawals (id INT AUTO_INCREMENT PRIMARY KEY, seller_id INT NOT NULL, request_email VARCHAR(255) NOT NULL, payment_method VARCHAR(20) NOT NULL, payout_account VARCHAR(255) NOT NULL, account_holder_name VARCHAR(255) NOT NULL, amount DECIMAL(10,2) NOT NULL, currency VARCHAR(4) NOT NULL DEFAULT 'USDT', status VARCHAR(20) NOT NULL DEFAULT 'pending', admin_id INT NULL, admin_notes TEXT NULL, decided_at TIMESTAMP NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_withdrawals_seller (seller_id), INDEX idx_withdrawals_status (status), INDEX idx_withdrawals_method (payment_method), CONSTRAINT fk_withdrawals_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT fk_withdrawals_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB"
            );

            $ensureTable(
                'withdrawal_logs',
                "CREATE TABLE IF NOT EXISTS withdrawal_logs (id INT AUTO_INCREMENT PRIMARY KEY, withdrawal_id INT NOT NULL, actor_role VARCHAR(20) NOT NULL, actor_id INT NULL, action VARCHAR(50) NOT NULL, details LONGTEXT NULL, ip_address VARCHAR(64) NULL, user_agent VARCHAR(255) NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_wlog_withdrawal (withdrawal_id), INDEX idx_wlog_actor (actor_id), CONSTRAINT fk_withdrawal_logs_withdrawal FOREIGN KEY (withdrawal_id) REFERENCES withdrawals(id) ON DELETE CASCADE, CONSTRAINT fk_withdrawal_logs_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB"
            );

            $ensureTable(
                'wallet_transactions',
                "CREATE TABLE IF NOT EXISTS wallet_transactions (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, type VARCHAR(30) NOT NULL DEFAULT 'admin_credit', direction VARCHAR(10) NOT NULL, amount DECIMAL(10,2) NOT NULL, pending_balance_after DECIMAL(10,2) NULL, available_balance_after DECIMAL(10,2) NULL, guarantee_balance_after DECIMAL(10,2) NULL, total_earnings_after DECIMAL(10,2) NULL, total_withdrawn_after DECIMAL(10,2) NULL, currency VARCHAR(4) NOT NULL DEFAULT 'USDT', reference_type VARCHAR(50) NULL, reference_id INT NULL, description VARCHAR(255) NULL, admin_id INT NULL, admin_name VARCHAR(255) NULL, note TEXT NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_wallet_tx_user (user_id), INDEX idx_wallet_tx_ref (reference_type, reference_id), INDEX idx_wallet_tx_type (type), CONSTRAINT fk_wallet_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB"
            );

            $ensureTable(
                'realtime_events',
                "CREATE TABLE IF NOT EXISTS realtime_events (id INT AUTO_INCREMENT PRIMARY KEY, event_type VARCHAR(50) NOT NULL, target_role VARCHAR(20) NULL, target_user_id INT NULL, payload LONGTEXT NOT NULL, processed TINYINT(1) NOT NULL DEFAULT 0, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, processed_at TIMESTAMP NULL, INDEX idx_realtime_processed (processed, id), INDEX idx_realtime_target_user (target_user_id), INDEX idx_realtime_target_role (target_role), CONSTRAINT fk_realtime_target_user FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB"
            );

            $ensureTable(
                'newsletter_subscribers',
                "CREATE TABLE IF NOT EXISTS newsletter_subscribers (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, status VARCHAR(20) NOT NULL DEFAULT 'subscribed', subscribed_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, unsubscribed_at TIMESTAMP NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_newsletter_status (status)) ENGINE=InnoDB"
            );

            $ensureTable(
                'customer_deposits',
                "CREATE TABLE IF NOT EXISTS customer_deposits (id INT AUTO_INCREMENT PRIMARY KEY, customer_id INT NOT NULL, amount DECIMAL(10,2) NOT NULL, currency VARCHAR(4) NOT NULL DEFAULT 'USDT', method VARCHAR(50) NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending', created_by_admin_id INT NULL, created_ip VARCHAR(64) NULL, internal_note TEXT NULL, approved_by_admin_id INT NULL, approved_at TIMESTAMP NULL, approved_ip VARCHAR(64) NULL, credited_at TIMESTAMP NULL, instant_credit TINYINT(1) NOT NULL DEFAULT 0, instant_reason TEXT NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_deposits_customer (customer_id), INDEX idx_deposits_status (status), CONSTRAINT fk_deposits_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE, CONSTRAINT fk_deposits_created_by FOREIGN KEY (created_by_admin_id) REFERENCES users(id) ON DELETE SET NULL, CONSTRAINT fk_deposits_approved_by FOREIGN KEY (approved_by_admin_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB"
            );

            $ensureTable(
                'deposit_logs',
                "CREATE TABLE IF NOT EXISTS deposit_logs (id INT AUTO_INCREMENT PRIMARY KEY, deposit_id INT NOT NULL, action VARCHAR(50) NOT NULL, actor_admin_id INT NULL, ip_address VARCHAR(64) NULL, user_agent VARCHAR(255) NULL, details LONGTEXT NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_dlog_deposit (deposit_id), INDEX idx_dlog_actor (actor_admin_id), CONSTRAINT fk_deposit_logs_deposit FOREIGN KEY (deposit_id) REFERENCES customer_deposits(id) ON DELETE CASCADE, CONSTRAINT fk_deposit_logs_actor FOREIGN KEY (actor_admin_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB"
            );

            $ensureTable(
                'notifications',
                "CREATE TABLE IF NOT EXISTS notifications (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, type VARCHAR(50) NOT NULL DEFAULT 'info', title VARCHAR(255) NOT NULL, message TEXT NULL, link VARCHAR(255) NULL, is_read TINYINT(1) NOT NULL DEFAULT 0, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_notif_user (user_id), INDEX idx_notif_read (user_id, is_read), CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB"
            );

            // Roles & Permissions tables
            $ensureTable(
                'roles',
                "CREATE TABLE IF NOT EXISTS roles (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, description TEXT NULL, permissions_count INT NOT NULL DEFAULT 0, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB"
            );
            $ensureTable(
                'permissions',
                "CREATE TABLE IF NOT EXISTS permissions (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, slug VARCHAR(100) NOT NULL UNIQUE, description TEXT NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB"
            );
            $ensureTable(
                'role_permissions',
                "CREATE TABLE IF NOT EXISTS role_permissions (role_id INT NOT NULL, permission_id INT NOT NULL, PRIMARY KEY (role_id, permission_id), FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE, FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE) ENGINE=InnoDB"
            );
            $ensureTable(
                'staff',
                "CREATE TABLE IF NOT EXISTS staff (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL UNIQUE, role_id INT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active', created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL) ENGINE=InnoDB"
            );

            // Seed default roles & permissions if table is empty
            try {
                $stmt = $conn->prepare('SELECT COUNT(*) FROM roles');
                $stmt->execute();
                $roleCount = (int)$stmt->fetchColumn();
                if ($roleCount === 0) {
                    $conn->exec("INSERT IGNORE INTO roles (name, description, permissions_count) VALUES ('Super Admin', 'Full system access', 0), ('Moderator', 'Content and user moderation', 0), ('Support Agent', 'Customer support access', 0), ('Content Manager', 'Manage site content', 0)");
                }
            } catch (Exception $e) {
            }

            // Seed ALL permissions (idempotent — IGNORE duplicates)
            try {
                $allPermissions = [
                    // Dashboard
                    ['Dashboard', 'dashboard.view', 'View admin dashboard'],
                    // Orders
                    ['Orders', 'orders.view', 'View orders'],
                    ['Orders', 'orders.edit', 'Edit/update orders'],
                    ['Orders', 'orders.delete', 'Delete orders'],
                    // Categories
                    ['Categories', 'categories.view', 'View categories'],
                    ['Categories', 'categories.create', 'Create categories'],
                    ['Categories', 'categories.edit', 'Edit categories'],
                    ['Categories', 'categories.delete', 'Delete categories'],
                    // Products
                    ['Products', 'products.view', 'View products'],
                    ['Products', 'products.create', 'Create products'],
                    ['Products', 'products.edit', 'Edit products'],
                    ['Products', 'products.delete', 'Delete products'],
                    // Customers
                    ['Customers', 'customers.view', 'View customers'],
                    ['Customers', 'customers.edit', 'Edit/freeze/unfreeze customers'],
                    ['Customers', 'customers.delete', 'Delete customers'],
                    // Vendors
                    ['Vendors', 'vendors.view', 'View vendors'],
                    ['Vendors', 'vendors.edit', 'Edit vendor status'],
                    ['Vendors', 'vendors.delete', 'Delete vendors'],
                    // Riders
                    ['Riders', 'riders.view', 'View riders'],
                    ['Riders', 'riders.create', 'Create riders'],
                    ['Riders', 'riders.edit', 'Edit riders'],
                    ['Riders', 'riders.delete', 'Delete riders'],
                    // Discussions
                    ['Discussions', 'discussions.view', 'View discussions'],
                    // Coupons
                    ['Coupons', 'coupons.view', 'View coupons'],
                    ['Coupons', 'coupons.create', 'Create coupons'],
                    ['Coupons', 'coupons.edit', 'Edit coupons'],
                    ['Coupons', 'coupons.delete', 'Delete coupons'],
                    // Promo Codes
                    ['Promo Codes', 'promo_codes.view', 'View promo codes'],
                    ['Promo Codes', 'promo_codes.create', 'Create promo codes'],
                    ['Promo Codes', 'promo_codes.edit', 'Edit promo codes'],
                    ['Promo Codes', 'promo_codes.delete', 'Delete promo codes'],
                    // Blog
                    ['Blog', 'blog.view', 'View blog posts'],
                    ['Blog', 'blog.create', 'Create blog posts'],
                    ['Blog', 'blog.edit', 'Edit blog posts'],
                    ['Blog', 'blog.delete', 'Delete blog posts'],
                    // Messages
                    ['Messages', 'messages.view', 'View messages/chat'],
                    // Settings
                    ['Settings', 'settings.view', 'View settings'],
                    ['Settings', 'settings.edit', 'Edit settings'],
                    // Staff Management
                    ['Staff', 'staff.view', 'View staff'],
                    ['Staff', 'staff.create', 'Create staff accounts'],
                    ['Staff', 'staff.edit', 'Edit staff accounts'],
                    ['Staff', 'staff.delete', 'Delete/deactivate staff'],
                    // Roles & Permissions
                    ['Roles', 'roles.view', 'View roles & permissions'],
                    ['Roles', 'roles.create', 'Create roles'],
                    ['Roles', 'roles.edit', 'Edit roles'],
                    ['Roles', 'roles.delete', 'Delete roles'],
                    // Subscribers
                    ['Subscribers', 'subscribers.view', 'View subscribers'],
                    ['Subscribers', 'subscribers.create', 'Create subscribers'],
                    ['Subscribers', 'subscribers.delete', 'Delete subscribers'],
                    // Customer Deposits
                    ['Deposits', 'deposits.view', 'View customer deposits'],
                    ['Deposits', 'deposits.create', 'Create deposits'],
                    ['Deposits', 'deposits.approve', 'Approve deposits'],
                    // Wallet Management
                    ['Wallet', 'wallet.view', 'View wallet management'],
                    ['Wallet', 'wallet.manage', 'Manage wallets (credit/debit)'],
                    // Withdrawals
                    ['Withdrawals', 'withdrawals.view', 'View withdrawals'],
                    ['Withdrawals', 'withdrawals.approve', 'Approve/reject withdrawals'],
                    // Vendor Earnings
                    ['Earnings', 'earnings.view', 'View vendor earnings'],
                    ['Earnings', 'earnings.manage', 'Manage commissions'],
                    // Cache
                    ['Cache', 'cache.clear', 'Clear system cache'],
                    // System
                    ['System', 'system.view', 'View system information'],
                    // Addons
                    ['Addons', 'addons.view', 'View addon manager'],
                    ['Addons', 'addons.manage', 'Manage addons'],
                ];
                $stmtPerm = $conn->prepare("INSERT IGNORE INTO permissions (name, slug, description) VALUES (?, ?, ?)");
                foreach ($allPermissions as $p) {
                    $stmtPerm->execute($p);
                }
            } catch (Exception $e) {
            }

            // Assign ALL permissions to Super Admin role, and auto-migrate legacy admins
            try {
                $stmt = $conn->prepare("SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1");
                $stmt->execute();
                $superAdminRoleId = $stmt->fetchColumn();
                if ($superAdminRoleId) {
                    // Link all permissions to Super Admin
                    $stmtPerms = $conn->query("SELECT id FROM permissions");
                    $allPermIds = $stmtPerms->fetchAll(PDO::FETCH_COLUMN);
                    $stmtLink = $conn->prepare("INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
                    foreach ($allPermIds as $pid) {
                        $stmtLink->execute([$superAdminRoleId, $pid]);
                    }
                    // Update permission count
                    $conn->exec("UPDATE roles SET permissions_count = (SELECT COUNT(*) FROM role_permissions WHERE role_id = {$superAdminRoleId}) WHERE id = {$superAdminRoleId}");
                }

                // Auto-migrate legacy admins: mark all existing 'admin' role users as Super Admin
                $conn->exec("UPDATE users SET is_super_admin = 1 WHERE role = 'admin' AND (is_super_admin IS NULL OR is_super_admin = 0)");
                // Also mark users with staff records who aren't already super admin
                $conn->exec("UPDATE users u JOIN staff s ON s.user_id = u.id SET u.is_super_admin = 1 WHERE (u.is_super_admin IS NULL OR u.is_super_admin = 0)");
            } catch (Exception $e) {
            }

            // Chat tables (required by ChatController / websocket_server)
            // Use ensureHealthyTable to also repair the MySQL 1932 "doesn't exist in engine" condition.
            $this->ensureHealthyTable(
                $conn,
                'conversations',
                "CREATE TABLE IF NOT EXISTS conversations (id INT AUTO_INCREMENT PRIMARY KEY, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB"
            );
            $this->ensureHealthyTable(
                $conn,
                'conversation_participants',
                "CREATE TABLE IF NOT EXISTS conversation_participants (id INT AUTO_INCREMENT PRIMARY KEY, conversation_id INT NOT NULL, user_id INT NOT NULL, last_read_message_id INT NOT NULL DEFAULT 0, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_conversation_user (conversation_id, user_id), KEY idx_cp_user (user_id), KEY idx_cp_conversation (conversation_id)) ENGINE=InnoDB"
            );
            $this->ensureHealthyTable(
                $conn,
                'messages',
                "CREATE TABLE IF NOT EXISTS messages (id INT AUTO_INCREMENT PRIMARY KEY, conversation_id INT NOT NULL, sender_id INT NOT NULL, content TEXT NOT NULL, message_type VARCHAR(20) NOT NULL DEFAULT 'text', created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_messages_conversation (conversation_id), KEY idx_messages_sender (sender_id)) ENGINE=InnoDB"
            );
            $this->ensureHealthyTable(
                $conn,
                'message_reads',
                "CREATE TABLE IF NOT EXISTS message_reads (message_id INT NOT NULL, user_id INT NOT NULL, read_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (message_id, user_id), KEY idx_mr_user (user_id)) ENGINE=InnoDB"
            );

            $ensureColumn = function (string $table, string $column, string $definition) use ($conn) {
                try {
                    $stmt = $conn->prepare("SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1");
                    $stmt->execute([$table, $column]);
                    if (!$stmt->fetch(PDO::FETCH_NUM)) {
                        $conn->exec("ALTER TABLE {$table} ADD COLUMN {$definition}");
                    }
                } catch (Exception $e) {
                }
            };

            $ensureColumn('users', 'email', 'email VARCHAR(255) NULL');
            $ensureColumn('users', 'password_hash', 'password_hash VARCHAR(255) NULL');
            $ensureColumn('users', 'role', 'role VARCHAR(20) NULL');
            $ensureColumn('users', 'full_name', 'full_name VARCHAR(255) NULL');
            $ensureColumn('users', 'phone', 'phone VARCHAR(20) NULL');
            $ensureColumn('users', 'avatar_url', 'avatar_url VARCHAR(255) DEFAULT NULL');
            $ensureColumn('users', 'is_active', 'is_active TINYINT(1) NOT NULL DEFAULT 1');
            $ensureColumn('users', 'is_online', 'is_online TINYINT(1) NOT NULL DEFAULT 0');
            $ensureColumn('users', 'created_at', 'created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
            $ensureColumn('users', 'updated_at', 'updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');

            $ensureColumn('users', 'last_seen', 'last_seen TIMESTAMP NULL');

            $ensureColumn('users', 'is_super_admin', 'is_super_admin TINYINT(1) NOT NULL DEFAULT 0');
            $ensureColumn('users', 'token_version', 'token_version INT NOT NULL DEFAULT 1');
            $ensureColumn('users', 'blocked_at', 'blocked_at TIMESTAMP NULL');
            $ensureColumn('users', 'block_reason', 'block_reason TEXT NULL');
            $ensureColumn('users', 'is_frozen', 'is_frozen TINYINT(1) NOT NULL DEFAULT 0');
            $ensureColumn('users', 'frozen_at', 'frozen_at TIMESTAMP NULL');
            $ensureColumn('users', 'frozen_reason', 'frozen_reason TEXT NULL');

            $ensureColumn('customer_deposits', 'status', "status VARCHAR(20) NOT NULL DEFAULT 'pending'");
            $ensureColumn('customer_deposits', 'created_by_admin_id', 'created_by_admin_id INT NULL');
            $ensureColumn('customer_deposits', 'created_ip', 'created_ip VARCHAR(64) NULL');
            $ensureColumn('customer_deposits', 'internal_note', 'internal_note TEXT NULL');
            $ensureColumn('customer_deposits', 'approved_by_admin_id', 'approved_by_admin_id INT NULL');
            $ensureColumn('customer_deposits', 'approved_at', 'approved_at TIMESTAMP NULL');
            $ensureColumn('customer_deposits', 'approved_ip', 'approved_ip VARCHAR(64) NULL');
            $ensureColumn('customer_deposits', 'credited_at', 'credited_at TIMESTAMP NULL');
            $ensureColumn('customer_deposits', 'instant_credit', 'instant_credit TINYINT(1) NOT NULL DEFAULT 0');
            $ensureColumn('customer_deposits', 'instant_reason', 'instant_reason TEXT NULL');

            // Chat message schema compatibility: legacy installs used `message`, newer uses `content`.
            $ensureColumn('messages', 'content', 'content TEXT NULL');
            $ensureColumn('messages', 'message_type', "message_type VARCHAR(20) NOT NULL DEFAULT 'text'");
            $ensureColumn('messages', 'updated_at', 'updated_at TIMESTAMP NULL DEFAULT NULL');

            try {
                $stmt = $conn->prepare("SHOW COLUMNS FROM messages LIKE 'message'");
                $stmt->execute();
                $hasLegacyMessage = (bool)$stmt->fetch(PDO::FETCH_ASSOC);
                $stmt = $conn->prepare("SHOW COLUMNS FROM messages LIKE 'content'");
                $stmt->execute();
                $hasContent = (bool)$stmt->fetch(PDO::FETCH_ASSOC);
                if ($hasLegacyMessage && $hasContent) {
                    $conn->exec("UPDATE messages SET content = message WHERE (content IS NULL OR content = '') AND message IS NOT NULL");
                }
            } catch (Exception $e) {
            }

            $ensureColumn('products', 'category_id', 'category_id INT NULL');
            $ensureColumn('products', 'seller_id', 'seller_id INT NULL');
            $ensureColumn('products', 'name', 'name VARCHAR(255) NULL');
            $ensureColumn('products', 'description', 'description TEXT');
            $ensureColumn('products', 'price', 'price DECIMAL(10,2) NOT NULL DEFAULT 0.00');
            $ensureColumn('products', 'stock', 'stock INT NOT NULL DEFAULT 0');
            $ensureColumn('products', 'is_active', 'is_active TINYINT(1) NOT NULL DEFAULT 1');
            $ensureColumn('products', 'image_url', 'image_url TEXT DEFAULT NULL');
            $ensureColumn('products', 'created_at', 'created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
            $ensureColumn('products', 'updated_at', 'updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
            $ensureColumn('products', 'rating', 'rating DECIMAL(3,1) NOT NULL DEFAULT 0.0');

            // Migrate image_url from VARCHAR(255) to TEXT for long external URLs
            try {
                $stmt = $conn->prepare("SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'image_url' LIMIT 1");
                $stmt->execute();
                $colInfo = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($colInfo && $colInfo['DATA_TYPE'] === 'varchar' && (int)$colInfo['CHARACTER_MAXIMUM_LENGTH'] <= 255) {
                    $conn->exec("ALTER TABLE products MODIFY COLUMN image_url TEXT DEFAULT NULL");
                }
            } catch (Exception $e) {
            }

            try {
                $stmt = $conn->prepare("SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'categories' AND column_name = 'image_url' LIMIT 1");
                $stmt->execute();
                $colInfo = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($colInfo && $colInfo['DATA_TYPE'] === 'varchar' && (int)$colInfo['CHARACTER_MAXIMUM_LENGTH'] <= 255) {
                    $conn->exec("ALTER TABLE categories MODIFY COLUMN image_url TEXT DEFAULT NULL");
                }
            } catch (Exception $e) {
            }

            $stmt = $conn->prepare("SHOW COLUMNS FROM products LIKE 'vendor_id'");
            $stmt->execute();
            $hasVendorId = (bool)$stmt->fetch(PDO::FETCH_ASSOC);
            if ($hasVendorId) {
                $conn->exec("UPDATE products SET seller_id = vendor_id WHERE seller_id IS NULL AND vendor_id IS NOT NULL");
            }

            $stmt = $conn->prepare("SHOW COLUMNS FROM products LIKE 'user_id'");
            $stmt->execute();
            $hasUserId = (bool)$stmt->fetch(PDO::FETCH_ASSOC);
            if ($hasUserId) {
                $conn->exec("UPDATE products SET seller_id = user_id WHERE seller_id IS NULL AND user_id IS NOT NULL");
            }

            $stmt = $conn->prepare("SHOW COLUMNS FROM products LIKE 'quantity'");
            $stmt->execute();
            $hasQuantity = (bool)$stmt->fetch(PDO::FETCH_ASSOC);
            $stmt = $conn->prepare("SHOW COLUMNS FROM products LIKE 'stock'");
            $stmt->execute();
            $hasStock = (bool)$stmt->fetch(PDO::FETCH_ASSOC);
            if ($hasQuantity) {
                if ($hasStock) {
                    $conn->exec("UPDATE products SET stock = quantity WHERE stock = 0 AND quantity IS NOT NULL");
                }
            }

            $stmt = $conn->prepare("SHOW COLUMNS FROM products LIKE 'status'");
            $stmt->execute();
            $hasStatus = (bool)$stmt->fetch(PDO::FETCH_ASSOC);
            if ($hasStatus) {
                $conn->exec("UPDATE products SET is_active = CASE WHEN status = 'inactive' THEN 0 ELSE 1 END WHERE is_active NOT IN (0,1) OR is_active IS NULL");
            }

            $stmt = $conn->prepare("SHOW TABLES LIKE 'reviews'");
            $stmt->execute();
            if (!$stmt->fetch(PDO::FETCH_NUM)) {
                $conn->exec("CREATE TABLE IF NOT EXISTS reviews (id INT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL, user_id INT NOT NULL, rating TINYINT NOT NULL, comment TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_reviews_product_id (product_id), INDEX idx_reviews_user_id (user_id)) ENGINE=InnoDB");
            }

            $ensureColumn('categories', 'description', 'description TEXT');
            $ensureColumn('categories', 'image_url', 'image_url TEXT DEFAULT NULL');
            $ensureColumn('categories', 'is_active', 'is_active TINYINT(1) NOT NULL DEFAULT 1');
            $ensureColumn('categories', 'created_at', 'created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
            $ensureColumn('categories', 'updated_at', 'updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');

            $stmt = $conn->prepare("SHOW COLUMNS FROM categories LIKE 'status'");
            $stmt->execute();
            $hasCategoryStatus = (bool)$stmt->fetch(PDO::FETCH_ASSOC);
            if ($hasCategoryStatus) {
                $conn->exec("UPDATE categories SET is_active = CASE WHEN status = 'inactive' THEN 0 ELSE 1 END WHERE is_active NOT IN (0,1) OR is_active IS NULL");
            }

            $seedCategories = [
                'Electronics & Mobile Accessories',
                'Fashion & Clothes',
                'Footwear & Bags',
                'Home & Kitchen',
                'Beauty, Grooming & Personal Care',
                'Grocery & Staples',
                'Baby Care & Kids Toys',
                'Auto Accessories & Industrial Supplies',
                'Health & Wellness',
            ];
            foreach ($seedCategories as $catName) {
                $stmt = $conn->prepare("SELECT id FROM categories WHERE name = ? LIMIT 1");
                $stmt->execute([$catName]);
                if (!$stmt->fetch()) {
                    $conn->prepare("INSERT IGNORE INTO categories (name, is_active) VALUES (?, 1)")->execute([$catName]);
                }
            }

            $ensureColumn('sellers', 'user_id', 'user_id INT NULL');
            $ensureColumn('sellers', 'business_name', 'business_name VARCHAR(255) NULL');
            $ensureColumn('sellers', 'store_name', 'store_name VARCHAR(255) NULL');
            $ensureColumn('sellers', 'cnic_number', 'cnic_number VARCHAR(20) NULL');
            $ensureColumn('sellers', 'is_approved', 'is_approved TINYINT(1) NOT NULL DEFAULT 0');
            $ensureColumn('sellers', 'commission_rate', 'commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00');
            $ensureColumn('sellers', 'store_address', 'store_address TEXT');
            $ensureColumn('sellers', 'tax_number', 'tax_number VARCHAR(50) NULL');
            $ensureColumn('sellers', 'cnic_document_url', 'cnic_document_url VARCHAR(255) DEFAULT NULL');
            $ensureColumn('sellers', 'document_type', "document_type VARCHAR(30) DEFAULT 'identity-card'");
            $ensureColumn('sellers', 'id_front_image_url', 'id_front_image_url VARCHAR(255) DEFAULT NULL');
            $ensureColumn('sellers', 'id_back_image_url', 'id_back_image_url VARCHAR(255) DEFAULT NULL');
            $ensureColumn('sellers', 'bank_name', 'bank_name VARCHAR(100) DEFAULT NULL');
            $ensureColumn('sellers', 'account_number', 'account_number VARCHAR(50) DEFAULT NULL');
            $ensureColumn('sellers', 'account_holder_name', 'account_holder_name VARCHAR(255) DEFAULT NULL');

            $ensureColumn('sellers', 'promo_code_used', 'promo_code_used VARCHAR(20) NULL');
            $ensureColumn('sellers', 'promo_exempt_guarantee', 'promo_exempt_guarantee TINYINT(1) NOT NULL DEFAULT 0');
            $ensureColumn('sellers', 'guarantee_required', 'guarantee_required TINYINT(1) NOT NULL DEFAULT 1');
            $ensureColumn('sellers', 'guarantee_locked_amount', "guarantee_locked_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            $ensureColumn('sellers', 'business_type', "business_type VARCHAR(50) NULL");
            $ensureColumn('sellers', 'pan_number', "pan_number VARCHAR(50) NULL");
            $ensureColumn('sellers', 'gst_number', "gst_number VARCHAR(50) NULL");
            $ensureColumn('sellers', 'ifsc_code', "ifsc_code VARCHAR(50) NULL");
            $ensureColumn('sellers', 'upi_id', "upi_id VARCHAR(100) NULL");

            $ensureColumn('promo_codes', 'is_active', "is_active TINYINT(1) NOT NULL DEFAULT 1");

            $ensureTable('wishlist', "CREATE TABLE IF NOT EXISTS wishlist (user_id INT NOT NULL, product_id INT NOT NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, product_id)) ENGINE=InnoDB");
            $ensureTable('wallets', "CREATE TABLE IF NOT EXISTS wallets (user_id INT PRIMARY KEY, balance DECIMAL(10,2) NOT NULL DEFAULT 0.00, pending_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00, available_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00, guarantee_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00, total_earnings DECIMAL(10,2) NOT NULL DEFAULT 0.00, total_withdrawn DECIMAL(10,2) NOT NULL DEFAULT 0.00, updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");

            $ensureColumn('wallets', 'balance', 'balance DECIMAL(10,2) NOT NULL DEFAULT 0.00');
            $ensureColumn('wallets', 'pending_balance', 'pending_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00');
            $ensureColumn('wallets', 'available_balance', 'available_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00');
            $ensureColumn('wallets', 'guarantee_balance', 'guarantee_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00');
            $ensureColumn('wallets', 'total_earnings', 'total_earnings DECIMAL(10,2) NOT NULL DEFAULT 0.00');
            $ensureColumn('wallets', 'total_withdrawn', 'total_withdrawn DECIMAL(10,2) NOT NULL DEFAULT 0.00');
            $ensureColumn('wallets', 'updated_at', 'updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
            $ensureColumn('wallet_transactions', 'type', "type VARCHAR(30) NOT NULL DEFAULT 'admin_credit'");
            $ensureColumn('wallet_transactions', 'pending_balance_after', 'pending_balance_after DECIMAL(10,2) NULL');
            $ensureColumn('wallet_transactions', 'available_balance_after', 'available_balance_after DECIMAL(10,2) NULL');
            $ensureColumn('wallet_transactions', 'guarantee_balance_after', 'guarantee_balance_after DECIMAL(10,2) NULL');
            $ensureColumn('wallet_transactions', 'total_earnings_after', 'total_earnings_after DECIMAL(10,2) NULL');
            $ensureColumn('wallet_transactions', 'total_withdrawn_after', 'total_withdrawn_after DECIMAL(10,2) NULL');
            $ensureColumn('wallet_transactions', 'admin_id', 'admin_id INT NULL');
            $ensureColumn('wallet_transactions', 'admin_name', 'admin_name VARCHAR(255) NULL');
            $ensureColumn('wallet_transactions', 'note', 'note TEXT NULL');

            $stmt = $conn->prepare("SHOW COLUMNS FROM users LIKE 'password'");
            $stmt->execute();
            $hasLegacyPassword = (bool)$stmt->fetch(PDO::FETCH_ASSOC);
            if ($hasLegacyPassword) {
                $conn->exec("UPDATE users SET password_hash = password WHERE (password_hash IS NULL OR password_hash = '') AND password IS NOT NULL AND password != ''");
            }

            $ensureColumn('orders', 'customer_id', 'customer_id INT NULL');
            $ensureColumn('orders', 'seller_id', 'seller_id INT NULL');
            $ensureColumn('orders', 'status', 'status VARCHAR(30) DEFAULT \'pending\'');
            $ensureColumn('orders', 'total_amount', 'total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00');
            $ensureColumn('orders', 'created_at', 'created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
            $ensureColumn('orders', 'updated_at', 'updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
            $ensureColumn('orders', 'order_number', 'order_number VARCHAR(50) NULL');
            $ensureColumn('orders', 'subtotal', 'subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00');
            $ensureColumn('orders', 'tax_amount', 'tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00');
            $ensureColumn('orders', 'shipping_amount', 'shipping_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00');
            $ensureColumn('orders', 'discount_amount', 'discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00');
            $ensureColumn('orders', 'payment_status', "payment_status VARCHAR(30) DEFAULT 'pending'");
            $ensureColumn('orders', 'payment_method', 'payment_method VARCHAR(50) DEFAULT NULL');
            $ensureColumn('orders', 'shipping_address', 'shipping_address TEXT NULL');
            $ensureColumn('orders', 'billing_address', 'billing_address TEXT NULL');
            $ensureColumn('orders', 'notes', 'notes TEXT NULL');
            $ensureColumn('orders', 'admin_read_at', 'admin_read_at TIMESTAMP NULL');
            $ensureColumn('orders', 'seller_read_at', 'seller_read_at TIMESTAMP NULL');

            $ensureColumn('order_items', 'order_id', 'order_id INT NULL');
            $ensureColumn('order_items', 'product_id', 'product_id INT NULL');
            $ensureColumn('order_items', 'seller_id', 'seller_id INT NULL');
            $ensureColumn('order_items', 'quantity', 'quantity INT NOT NULL DEFAULT 1');
            $ensureColumn('order_items', 'unit_price', 'unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00');
            $ensureColumn('order_items', 'total_price', 'total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00');
            $ensureColumn('order_items', 'created_at', 'created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');

            $ensureColumn('cart', 'created_at', 'created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
            $ensureColumn('cart', 'updated_at', 'updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');

            // Backfill unit_price/total_price from legacy columns if present
            try {
                $stmt = $conn->prepare("SHOW COLUMNS FROM order_items LIKE 'price'");
                $stmt->execute();
                $hasLegacyPrice = (bool)$stmt->fetch(PDO::FETCH_ASSOC);
                if ($hasLegacyPrice) {
                    $conn->exec("UPDATE order_items SET unit_price = price WHERE (unit_price IS NULL OR unit_price = 0) AND price IS NOT NULL");
                    $conn->exec("ALTER TABLE order_items MODIFY COLUMN price DECIMAL(10,2) NOT NULL DEFAULT 0.00");
                }
            } catch (Exception $e) {
            }

            try {
                $stmt = $conn->prepare("SHOW COLUMNS FROM order_items LIKE 'total'");
                $stmt->execute();
                $hasLegacyTotal = (bool)$stmt->fetch(PDO::FETCH_ASSOC);
                if ($hasLegacyTotal) {
                    $conn->exec("UPDATE order_items SET total_price = total WHERE (total_price IS NULL OR total_price = 0) AND total IS NOT NULL");
                    $conn->exec("ALTER TABLE order_items MODIFY COLUMN total DECIMAL(10,2) NOT NULL DEFAULT 0.00");
                }
            } catch (Exception $e) {
            }

            $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
            $stmt->execute(['seller@example.com']);
            $sellerUser = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$sellerUser) {
                $hash = password_hash('password', PASSWORD_BCRYPT);
                $stmtIns = $conn->prepare("INSERT INTO users (email, password_hash, role, full_name, is_active, email_verified_at, created_at, updated_at) VALUES (?, ?, 'seller', ?, 1, NOW(), NOW(), NOW())");
                $stmtIns->execute(['seller@example.com', $hash, 'Sample Seller']);
                $sellerId = (int)$conn->lastInsertId();
            } else {
                $sellerId = (int)($sellerUser['id'] ?? 0);
            }

            if ($sellerId > 0) {
                $stmt = $conn->prepare("SELECT user_id FROM sellers WHERE user_id = ? LIMIT 1");
                $stmt->execute([$sellerId]);
                $sellerProfile = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$sellerProfile) {
                    $storeName = 'store_' . $sellerId;
                    $cnic = 'cnic_' . $sellerId;
                    $stmtIns = $conn->prepare("INSERT INTO sellers (user_id, business_name, store_name, cnic_number, is_approved, commission_rate) VALUES (?, ?, ?, ?, 1, 10.00)");
                    $stmtIns->execute([$sellerId, 'Sample Seller Business', $storeName, $cnic]);
                }
            }
        } catch (Exception $e) {
            error_log('Schema ensure failed: ' . $e->getMessage());
        } finally {
            $this->ensureChatSchema($conn);
        }
    }

    public function __construct() {
        $this->host = $_ENV['DB_HOST'] ?? 'localhost';
        $this->db_name = $_ENV['DB_DATABASE'] ?? 'multi_vendor_system';
        $this->username = $_ENV['DB_USERNAME'] ?? 'root';
        $this->password = $_ENV['DB_PASSWORD'] ?? '';
    }

    // Get the database connection
    public function getConnection() {
        if (self::$sharedConn instanceof PDO) {
            $this->conn = self::$sharedConn;

            $shouldEnsureSchema = !self::$schemaEnsured;
            if (!$shouldEnsureSchema) {
                try {
                    $stmt = $this->conn->prepare("SHOW TABLES LIKE 'cart'");
                    $stmt->execute();
                    if (!$stmt->fetch(PDO::FETCH_NUM)) {
                        $shouldEnsureSchema = true;
                    }

                    if (!$shouldEnsureSchema) {
                        $stmt = $this->conn->prepare("SHOW COLUMNS FROM users LIKE 'is_online'");
                        $stmt->execute();
                        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                            $shouldEnsureSchema = true;
                        }
                    }

                    if (!$shouldEnsureSchema) {
                        $stmt = $this->conn->prepare("SHOW COLUMNS FROM messages LIKE 'content'");
                        $stmt->execute();
                        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                            $shouldEnsureSchema = true;
                        }
                    }

                    if (!$shouldEnsureSchema) {
                        $stmt = $this->conn->prepare("SHOW COLUMNS FROM products LIKE 'image_url'");
                        $stmt->execute();
                        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                            $shouldEnsureSchema = true;
                        }
                    }

                    if (!$shouldEnsureSchema) {
                        $stmt = $this->conn->prepare("SHOW TABLES LIKE 'conversation_participants'");
                        $stmt->execute();
                        if (!$stmt->fetch(PDO::FETCH_NUM)) {
                            $shouldEnsureSchema = true;
                        } else {
                            // detect MySQL 1932 corruption case
                            $this->conn->query("SELECT 1 FROM conversation_participants LIMIT 1");
                        }
                    }
                } catch (Exception $e) {
                    $shouldEnsureSchema = true;
                }
            }

            if ($shouldEnsureSchema) {
                try {
                    $this->ensureSchema($this->conn);
                    self::$schemaEnsured = true;
                } catch (Exception $e) {
                    self::$schemaEnsured = false;
                }
            }

            // Always ensure chat schema (cheap) so chat never breaks even if other schema steps are skipped.
            $this->ensureChatSchema($this->conn);

            return $this->conn;
        }

        try {
            $this->conn = new PDO(
                "mysql:host={$this->host};dbname={$this->db_name};charset=utf8mb4",
                $this->username,
                $this->password,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );

            self::$sharedConn = $this->conn;

            $shouldEnsureSchema = !self::$schemaEnsured;
            if (!$shouldEnsureSchema) {
                try {
                    $stmt = $this->conn->prepare("SHOW TABLES LIKE 'cart'");
                    $stmt->execute();
                    if (!$stmt->fetch(PDO::FETCH_NUM)) {
                        $shouldEnsureSchema = true;
                    }

                    if (!$shouldEnsureSchema) {
                        $stmt = $this->conn->prepare("SHOW COLUMNS FROM users LIKE 'is_online'");
                        $stmt->execute();
                        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                            $shouldEnsureSchema = true;
                        }
                    }

                    if (!$shouldEnsureSchema) {
                        $stmt = $this->conn->prepare("SHOW COLUMNS FROM messages LIKE 'content'");
                        $stmt->execute();
                        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                            $shouldEnsureSchema = true;
                        }
                    }

                    if (!$shouldEnsureSchema) {
                        $stmt = $this->conn->prepare("SHOW COLUMNS FROM products LIKE 'image_url'");
                        $stmt->execute();
                        if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                            $shouldEnsureSchema = true;
                        }
                    }
                    if (!$shouldEnsureSchema) {
                        $stmt = $this->conn->prepare("SHOW TABLES LIKE 'conversation_participants'");
                        $stmt->execute();
                        if (!$stmt->fetch(PDO::FETCH_NUM)) {
                            $shouldEnsureSchema = true;
                        } else {
                            // detect MySQL 1932 corruption case
                            $this->conn->query("SELECT 1 FROM conversation_participants LIMIT 1");
                        }
                    }
                } catch (Exception $e) {
                    $shouldEnsureSchema = true;
                }
            }

            if ($shouldEnsureSchema) {
                try {
                    $this->ensureSchema($this->conn);
                    self::$schemaEnsured = true;
                } catch (Exception $e) {
                    self::$schemaEnsured = false;
                }
            }

            // Always ensure chat schema (cheap) so chat never breaks even if other schema steps are skipped.
            $this->ensureChatSchema($this->conn);
        } catch(PDOException $e) {
            error_log('Connection Error: ' . $e->getMessage());
            throw new Exception('Database connection error. Please try again later.');
        }

        return $this->conn;
    }
    
    // Prepare statement shortcut
    public function prepare($sql) {
        return $this->getConnection()->prepare($sql);
    }
    
    // Execute query shortcut
    public function query($sql) {
        return $this->getConnection()->query($sql);
    }

    // Exec shortcut
    public function exec($sql) {
        return $this->getConnection()->exec($sql);
    }
    
    // Last insert ID
    public function lastInsertId() {
        if ($this->conn instanceof PDO) {
            return $this->conn->lastInsertId();
        }

        if (self::$sharedConn instanceof PDO) {
            $this->conn = self::$sharedConn;
            return $this->conn->lastInsertId();
        }

        return $this->getConnection()->lastInsertId();
    }
    
    // Begin transaction
    public function beginTransaction() {
        return $this->getConnection()->beginTransaction();
    }
    
    // Commit transaction
    public function commit() {
        return $this->getConnection()->commit();
    }
    
    // Rollback transaction
    public function rollBack() {
        return $this->getConnection()->rollBack();
    }
}
?>

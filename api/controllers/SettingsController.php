<?php
require_once __DIR__ . '/../config/Database.php';

class SettingsController {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    private function ensureColumnExists($conn, $name, $definition) {
        try {
            $stmt = $conn->prepare("SHOW COLUMNS FROM website_settings LIKE ?");
            $stmt->execute([$name]);
            $col = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$col) {
                $conn->exec("ALTER TABLE website_settings ADD COLUMN $name $definition");
            }
        } catch (Exception $e) {
        }
    }

    public function uploadAsset() {
        try {
            $type = isset($_POST['type']) ? strtolower(trim((string)$_POST['type'])) : '';
            if (!$type) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'type is required']);
                return;
            }

            if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'file is required']);
                return;
            }

            $file = $_FILES['file'];
            if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Upload failed']);
                return;
            }

            $allowedTypes = ['logo', 'favicon', 'homepage_banner', 'product', 'chat'];
            if (!in_array($type, $allowedTypes, true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Invalid type']);
                return;
            }

            $originalName = (string)($file['name'] ?? '');
            $tmpName = (string)($file['tmp_name'] ?? '');
            $mime = (string)($file['type'] ?? '');

            $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
            if (!$ext) $ext = 'png';

            $allowedExt = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'ico'];
            if (!in_array($ext, $allowedExt, true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Unsupported file type']);
                return;
            }

            $uploadDir = __DIR__ . '/../uploads/settings';
            if (!is_dir($uploadDir)) {
                @mkdir($uploadDir, 0775, true);
            }

            $safeType = preg_replace('/[^a-z0-9_\-]+/i', '_', $type);
            $unique = bin2hex(random_bytes(8));
            $filename = $safeType . '_' . $unique . '.' . $ext;
            $targetPath = $uploadDir . '/' . $filename;

            if (!move_uploaded_file($tmpName, $targetPath)) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to save uploaded file']);
                return;
            }

            $url = '/uploads/settings/' . $filename;

            echo json_encode(['success' => true, 'url' => $url, 'type' => $type, 'mime' => $mime]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error uploading file: ' . $e->getMessage()]);
        }
    }

    private function decodeJsonField(&$settings, $field, $default) {
        if (!array_key_exists($field, $settings) || $settings[$field] === null || $settings[$field] === '') {
            $settings[$field] = $default;
            return;
        }
        if (is_array($settings[$field])) return;
        $decoded = json_decode($settings[$field], true);
        $settings[$field] = is_array($decoded) ? $decoded : $default;
    }

    // Get all website settings
    public function getSettings() {
        try {
            $conn = $this->db->getConnection();
            
            // Check if settings table exists, create if not
            $this->createSettingsTableIfNotExists($conn);

            $this->ensureColumnExists($conn, 'font_settings', 'LONGTEXT NULL');
            $this->ensureColumnExists($conn, 'seo_settings', 'LONGTEXT NULL');
            $this->ensureColumnExists($conn, 'menu_settings', 'LONGTEXT NULL');
            $this->ensureColumnExists($conn, 'homepage_settings', 'LONGTEXT NULL');
            $this->ensureColumnExists($conn, 'cache_settings', 'LONGTEXT NULL');
            
            $stmt = $conn->prepare("SELECT * FROM website_settings LIMIT 1");
            $stmt->execute();
            $settings = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // If no settings exist, return defaults
            if (!$settings) {
                $settings = $this->getDefaultSettings();
                // Insert default settings
                $this->insertDefaultSettings($conn);
            }

            $this->decodeJsonField($settings, 'font_settings', []);
            $this->decodeJsonField($settings, 'seo_settings', []);
            $this->decodeJsonField($settings, 'menu_settings', []);
            $this->decodeJsonField($settings, 'homepage_settings', []);
            $this->decodeJsonField($settings, 'cache_settings', []);
            
            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'data' => $settings
            ]);
        } catch(Exception $e) {
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching settings: ' . $e->getMessage()
            ]);
        }
    }

    // Update website settings
    public function updateSettings() {
        try {
            // Get JSON input
            $json_input = file_get_contents('php://input');
            $data = json_decode($json_input, true);
            
            if (!$data) {
                // Try to get from POST if JSON decode fails
                $data = $_POST;
            }
            
            $conn = $this->db->getConnection();
            
            // Ensure table exists
            $this->createSettingsTableIfNotExists($conn);

            $this->ensureColumnExists($conn, 'font_settings', 'LONGTEXT NULL');
            $this->ensureColumnExists($conn, 'seo_settings', 'LONGTEXT NULL');
            $this->ensureColumnExists($conn, 'menu_settings', 'LONGTEXT NULL');
            $this->ensureColumnExists($conn, 'homepage_settings', 'LONGTEXT NULL');
            $this->ensureColumnExists($conn, 'cache_settings', 'LONGTEXT NULL');
            
            $allowed_fields = [
                'website_name', 'tagline', 'currency', 'timezone', 
                'email', 'phone', 'address', 'refund_policy', 
                'return_policy', 'terms_conditions', 'logo_url', 'favicon_url',
                'font_settings', 'seo_settings', 'menu_settings', 'cache_settings', 'homepage_settings'
            ];
            
            $update_fields = [];
            $values = [];
            
            foreach ($allowed_fields as $field) {
                if (isset($data[$field])) {
                    $update_fields[] = "$field = ?";
                    $v = $data[$field];
                    if (is_array($v) || is_object($v)) {
                        $values[] = json_encode($v);
                    } else {
                        $values[] = $v;
                    }
                }
            }
            
            if (empty($update_fields)) {
                throw new Exception('No valid fields to update');
            }
            
            // Add updated_at timestamp
            $update_fields[] = "updated_at = CURRENT_TIMESTAMP";
            
            $sql = "UPDATE website_settings SET " . implode(', ', $update_fields) . " WHERE id = 1";
            $stmt = $conn->prepare($sql);
            $stmt->execute($values);
            
            // Get updated settings
            $updated_settings = $this->getCurrentSettings($conn);

            $this->decodeJsonField($updated_settings, 'font_settings', []);
            $this->decodeJsonField($updated_settings, 'seo_settings', []);
            $this->decodeJsonField($updated_settings, 'menu_settings', []);
            $this->decodeJsonField($updated_settings, 'homepage_settings', []);
            $this->decodeJsonField($updated_settings, 'cache_settings', []);
            
            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'message' => 'Settings updated successfully',
                'data' => $updated_settings
            ]);
            
        } catch(Exception $e) {
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error updating settings: ' . $e->getMessage()
            ]);
        }
    }

    private function createSettingsTableIfNotExists($conn) {
            $sql = "CREATE TABLE IF NOT EXISTS website_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            website_name VARCHAR(255) DEFAULT 'Sell1Mall',
            tagline VARCHAR(500) DEFAULT 'Your Premier Multi-Vendor Marketplace',
            currency VARCHAR(10) DEFAULT 'USDT',
            timezone VARCHAR(50) DEFAULT 'UTC',
            email VARCHAR(255) DEFAULT 'admin@sell1mall.com',
            phone VARCHAR(50) DEFAULT '+1 234 567 8900',
            address VARCHAR(500) DEFAULT '123 Business Street, City, Country',
            refund_policy TEXT,
            return_policy TEXT,
            terms_conditions TEXT,
            logo_url VARCHAR(500),
            favicon_url VARCHAR(500),
            font_settings LONGTEXT,
            seo_settings LONGTEXT,
            menu_settings LONGTEXT,
            homepage_settings LONGTEXT,
            cache_settings LONGTEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        
        $conn->exec($sql);

        // Fix strict mode: MySQL 8+ doesn't allow DEFAULT on TEXT columns
        try { $conn->exec("ALTER TABLE website_settings MODIFY tagline VARCHAR(500) DEFAULT 'Your Premier Multi-Vendor Marketplace'"); } catch (Exception $e) {}
        try { $conn->exec("ALTER TABLE website_settings MODIFY address VARCHAR(500) DEFAULT '123 Business Street, City, Country'"); } catch (Exception $e) {}
    }

    private function getDefaultSettings() {
        return [
            'website_name' => 'Sell1Mall',
            'tagline' => 'Your Premier Multi-Vendor Marketplace',
            'currency' => 'USDT',
            'timezone' => 'UTC',
            'email' => 'admin@sell1mall.com',
            'phone' => '+1 234 567 8900',
            'address' => '123 Business Street, City, Country',
            'refund_policy' => '',
            'return_policy' => '',
            'terms_conditions' => '',
            'logo_url' => null,
            'favicon_url' => null,
            'font_settings' => [],
            'seo_settings' => [],
            'menu_settings' => [],
            'homepage_settings' => [],
            'cache_settings' => []
        ];
    }

    private function insertDefaultSettings($conn) {
        $defaults = $this->getDefaultSettings();
        $sql = "INSERT INTO website_settings (website_name, tagline, currency, timezone, email, phone, address, font_settings, seo_settings, menu_settings, homepage_settings, cache_settings) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->execute([
            $defaults['website_name'],
            $defaults['tagline'],
            $defaults['currency'],
            $defaults['timezone'],
            $defaults['email'],
            $defaults['phone'],
            $defaults['address'],
            json_encode($defaults['font_settings']),
            json_encode($defaults['seo_settings']),
            json_encode($defaults['menu_settings']),
            json_encode($defaults['homepage_settings']),
            json_encode($defaults['cache_settings'])
        ]);
    }

    private function getCurrentSettings($conn) {
        $stmt = $conn->prepare("SELECT * FROM website_settings LIMIT 1");
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
?>

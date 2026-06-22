<?php
require_once 'BaseModel.php';

class User extends BaseModel {
    public function __construct() {
        parent::__construct('users');
    }

    private function tableExists($table) {
        try {
            $stmt = $this->conn->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1");
            $stmt->execute([$table]);
            return (bool)$stmt->fetch(PDO::FETCH_NUM);
        } catch (Exception $e) {
            return false;
        }
    }

    private function ensureWalletRow($userId) {
        if (!$this->tableExists('wallets')) {
            return;
        }

        try {
            $stmt = $this->conn->prepare('SELECT user_id FROM wallets WHERE user_id = ? LIMIT 1');
            $stmt->execute([(int)$userId]);
            if ($stmt->fetch(PDO::FETCH_ASSOC)) {
                return;
            }

            $stmt = $this->conn->prepare('INSERT INTO wallets (user_id, balance, updated_at) VALUES (?, 0.00, NOW())');
            $stmt->execute([(int)$userId]);
        } catch (Exception $e) {
        }
    }

    private function applySellerPromoCode($userId, $promoCode) {
        $promoCode = is_string($promoCode) ? trim($promoCode) : '';
        if ($promoCode === '') {
            return false;
        }

        if (!preg_match('/^\d{4}$/', $promoCode)) {
            return false;
        }

        if (!$this->tableExists('promo_codes')) {
            return false;
        }

        try {
            $stmt = $this->conn->prepare("SELECT id, is_used, expires_at FROM promo_codes WHERE code = ? LIMIT 1 FOR UPDATE");
            $stmt->execute([$promoCode]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                return false;
            }

            if ((int)($row['is_used'] ?? 0) === 1) {
                return false;
            }

            $expiresAt = $row['expires_at'] ?? null;
            if ($expiresAt) {
                $stmt = $this->conn->prepare('SELECT 1 WHERE ? < NOW()');
                $stmt->execute([(string)$expiresAt]);
                if ($stmt->fetch(PDO::FETCH_NUM)) {
                    return false;
                }
            }

            $stmt = $this->conn->prepare("UPDATE promo_codes SET is_used = 1, used_by_user_id = ?, used_at = NOW() WHERE id = ? AND is_used = 0");
            $stmt->execute([(int)$userId, (int)$row['id']]);
            if ($stmt->rowCount() <= 0) {
                return false;
            }

            $stmt = $this->conn->prepare("UPDATE sellers SET promo_code_used = ?, promo_exempt_guarantee = 1, guarantee_required = 0, guarantee_locked_amount = 0.00 WHERE user_id = ?");
            $stmt->execute([$promoCode, (int)$userId]);
            return true;
        } catch (Exception $e) {
            return false;
        }
    }

    // Register a new user
    public function register($data) {
        $inTransaction = false;
        try {
            if (!$this->conn->inTransaction()) {
                $this->conn->beginTransaction();
                $inTransaction = true;
            }

        // Validate input
        if (empty($data['email']) || empty($data['password']) || empty($data['role'])) {
            throw new Exception('Email, password, and role are required');
        }

        // Check if email already exists
        if ($this->emailExists($data['email'])) {
            throw new Exception('Email already exists');
        }

        // Hash password
        $data['password_hash'] = password_hash($data['password'], PASSWORD_BCRYPT);
        unset($data['password']);

        $createdAt = date('Y-m-d H:i:s');

        // Filter to valid users table columns only (seller fields belong to sellers table)
        $userData = [];
        foreach (['email', 'password_hash', 'role', 'full_name', 'phone', 'avatar_url', 'is_active'] as $key) {
            if (array_key_exists($key, $data)) {
                $userData[$key] = $data[$key];
            }
        }
        // New accounts are always active by default
        $userData['is_active'] = 1;
        $userData['created_at'] = $createdAt;
        $userData['updated_at'] = $createdAt;

        // Insert user
        $userId = $this->create($userData);
        
        // If it's a seller, create seller profile
        if ($data['role'] === 'seller') {
            $sellerData = null;
            if (!empty($data['seller_data']) && is_array($data['seller_data'])) {
                $sellerData = $data['seller_data'];
            } else {
                $sellerData = [
                    'business_name' => $data['business_name'] ?? null,
                    'store_name' => $data['store_name'] ?? null,
                    'cnic_number' => $data['cnic_number'] ?? null,
                    'tax_number' => $data['tax_number'] ?? null,
                    'store_address' => $data['store_address'] ?? null,
                    'bank_name' => $data['bank_name'] ?? null,
                    'account_number' => $data['account_number'] ?? null,
                    'account_holder_name' => $data['account_holder_name'] ?? null,
                    'cnic_document_url' => $data['cnic_document_url'] ?? null,
                ];
            }

            if (!empty($sellerData)) {
                $this->createSellerProfile($userId, $sellerData);
            }

            $promoCode = $data['promo_code'] ?? ($sellerData['promo_code'] ?? null);
            $this->applySellerPromoCode($userId, $promoCode);
        }

        $this->ensureWalletRow($userId);

            if ($inTransaction) {
                $this->conn->commit();
            }

        return $userId;
        } catch (Exception $e) {
            if ($inTransaction && $this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            throw $e;
        }
    }

    // Authenticate user
    public function authenticate($email, $password) {
        $query = 'SELECT * FROM users WHERE email = :email LIMIT 1';
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            $hash = $user['password_hash'] ?? '';

            if ($hash && password_verify($password, $hash)) {
                unset($user['password_hash']);
                return $user;
            }

            // Legacy/plain migration: if stored hash is not bcrypt and equals password, upgrade.
            if (!$hash || strpos($hash, '$2y$') !== 0) {
                if ($hash === $password) {
                    $newHash = password_hash($password, PASSWORD_BCRYPT);
                    $update = $this->conn->prepare('UPDATE users SET password_hash = :hash, updated_at = NOW() WHERE id = :id');
                    $update->bindParam(':hash', $newHash);
                    $update->bindParam(':id', $user['id']);
                    $update->execute();

                    unset($user['password_hash']);
                    return $user;
                }
            }
        }

        return false;
    }

    // Authenticate admin user
    public function authenticateAdmin($email, $password) {
        $query = 'SELECT * FROM users WHERE email = :email AND role = :role LIMIT 1';
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->bindValue(':role', 'admin');
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            $hash = $user['password_hash'] ?? '';

            if ($hash && password_verify($password, $hash)) {
                unset($user['password_hash']);
                return $user;
            }

            // Legacy/plain migration: if stored hash is not bcrypt and equals password, upgrade.
            if (!$hash || strpos($hash, '$2y$') !== 0) {
                if ($hash === $password) {
                    $newHash = password_hash($password, PASSWORD_BCRYPT);
                    $update = $this->conn->prepare('UPDATE users SET password_hash = :hash, updated_at = NOW() WHERE id = :id');
                    $update->bindParam(':hash', $newHash);
                    $update->bindParam(':id', $user['id']);
                    $update->execute();

                    unset($user['password_hash']);
                    return $user;
                }
            }
        }

        return false;
    }

    // Check if email exists
    public function emailExists($email) {
        $query = 'SELECT id FROM users WHERE email = :email LIMIT 1';
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->execute();
        return $stmt->rowCount() > 0;
    }

    // Create seller profile
    private function createSellerProfile($userId, $sellerData) {
        $requiredFields = ['business_name', 'store_name', 'cnic_number'];
        foreach ($requiredFields as $field) {
            if (empty($sellerData[$field])) {
                throw new Exception("$field is required for seller registration");
            }
        }

        $storeName = (string)$sellerData['store_name'];
        $cnicNumber = (string)$sellerData['cnic_number'];

        $stmt = $this->conn->prepare('SELECT 1 FROM sellers WHERE store_name = :store_name LIMIT 1');
        $stmt->bindValue(':store_name', $storeName);
        $stmt->execute();
        if ($stmt->fetch(PDO::FETCH_NUM)) {
            throw new Exception('Store name already exists');
        }

        $stmt = $this->conn->prepare('SELECT 1 FROM sellers WHERE cnic_number = :cnic_number LIMIT 1');
        $stmt->bindValue(':cnic_number', $cnicNumber);
        $stmt->execute();
        if ($stmt->fetch(PDO::FETCH_NUM)) {
            throw new Exception('CNIC number already exists');
        }

        $sellerData['user_id'] = $userId;

        $query = 'INSERT INTO sellers (' . implode(', ', array_keys($sellerData)) . ') ';
        $query .= 'VALUES (:' . implode(', :', array_keys($sellerData)) . ')';
        
        try {
            $stmt = $this->conn->prepare($query);
            foreach ($sellerData as $key => $value) {
                $stmt->bindValue(':' . $key, $value);
            }

            return $stmt->execute();
        } catch (PDOException $e) {
            if ((string)$e->getCode() === '23000') {
                $msg = (string)$e->getMessage();
                if (stripos($msg, 'store_name') !== false) {
                    throw new Exception('Store name already exists');
                }
                if (stripos($msg, 'cnic_number') !== false) {
                    throw new Exception('CNIC number already exists');
                }
                throw new Exception('Seller profile already exists');
            }
            throw $e;
        }
    }

    // Get user by email
    public function getByEmail($email) {
        $query = 'SELECT * FROM users WHERE email = :email LIMIT 1';
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Get user with role data
    public function getUserWithRoleData($userId) {
        $user = $this->getById($userId);
        if (!$user) return null;

        if ($user['role'] === 'seller') {
            $query = 'SELECT * FROM sellers WHERE user_id = :user_id LIMIT 1';
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $userId);
            $stmt->execute();
            $sellerData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($sellerData) {
                $user = array_merge($user, $sellerData);
            }
        }

        unset($user['password_hash']);
        return $user;
    }

    // Update user profile
    public function updateProfile($userId, $data) {
        $user = $this->getById($userId);
        if (!$user) {
            throw new Exception('User not found');
        }

        $userUpdate = [];
        $sellerUpdate = [];

        if (isset($data['password']) && $data['password'] !== '') {
            if (isset($data['current_password'])) {
                $current = (string)$data['current_password'];
                $hash = (string)($user['password_hash'] ?? '');

                $ok = false;
                if ($hash && strpos($hash, '$2y$') === 0) {
                    $ok = password_verify($current, $hash);
                } elseif ($hash !== '') {
                    $ok = $hash === $current;
                }

                if (!$ok) {
                    throw new Exception('Current password is incorrect');
                }
            }

            $userUpdate['password_hash'] = password_hash($data['password'], PASSWORD_BCRYPT);
        }

        foreach (['full_name', 'phone', 'avatar_url'] as $key) {
            if (array_key_exists($key, $data)) {
                $userUpdate[$key] = $data[$key];
            }
        }

        if ($user['role'] === 'seller') {
            foreach (
                [
                    'business_name',
                    'store_name',
                    'cnic_number',
                    'cnic_document_url',
                    'tax_number',
                    'store_address',
                    'bank_name',
                    'account_number',
                    'account_holder_name',
                    'business_type',
                    'pan_number',
                    'gst_number',
                    'ifsc_code',
                    'upi_id',
                ] as $key
            ) {
                if (array_key_exists($key, $data)) {
                    $sellerUpdate[$key] = $data[$key];
                }
            }
        }

        if (!empty($userUpdate)) {
            $userUpdate['updated_at'] = date('Y-m-d H:i:s');
            $this->update($userId, $userUpdate);
        }

        if ($user['role'] === 'seller' && !empty($sellerUpdate)) {
            $set = [];
            foreach ($sellerUpdate as $key => $value) {
                $set[] = $key . ' = :' . $key;
            }

            $sql = 'UPDATE sellers SET ' . implode(', ', $set) . ' WHERE user_id = :user_id';
            $stmt = $this->conn->prepare($sql);
            foreach ($sellerUpdate as $key => $value) {
                $stmt->bindValue(':' . $key, $value);
            }
            $stmt->bindValue(':user_id', $userId);
            $stmt->execute();
        }

        return true;
    }
}
?>

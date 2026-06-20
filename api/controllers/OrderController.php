<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class OrderController {
    private $db;
    private $auth;
    private $orderItemColumns;

    public function __construct() {
        $this->db = new Database();
        $this->auth = new AuthMiddleware();
    }

    private function getRequestPath() {
        return parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    }

    private function getJsonBody() {
        $raw = file_get_contents('php://input');
        if (!$raw) return [];
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    private function tableExists($table) {
        try {
            $stmt = $this->db->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1");
            $stmt->execute([$table]);
            return (bool)$stmt->fetch(PDO::FETCH_NUM);
        } catch (Exception $e) {
            return false;
        }
    }

    private function getOrderItemColumns() {
        if (is_array($this->orderItemColumns)) {
            return $this->orderItemColumns;
        }

        $cols = [];
        try {
            $stmt = $this->db->prepare("SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'order_items'");
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $row) {
                $name = strtolower($row['column_name'] ?? '');
                if ($name !== '') {
                    $cols[$name] = true;
                }
            }
        } catch (Exception $e) {
        }

        $priceCol = isset($cols['unit_price']) ? 'unit_price' : (isset($cols['price']) ? 'price' : 'unit_price');
        $totalCol = isset($cols['total_price']) ? 'total_price' : (isset($cols['total']) ? 'total' : 'total_price');
        $hasSellerId = isset($cols['seller_id']);

        $this->orderItemColumns = [
            'price' => $priceCol,
            'total' => $totalCol,
            'has_seller_id' => $hasSellerId,
        ];

        return $this->orderItemColumns;
    }

    private function listSellerOrders($user) {
        $limit = min($_GET['limit'] ?? 50, 100);
        $offset = $_GET['offset'] ?? 0;
        $status = $_GET['status'] ?? '';
        $search = $_GET['search'] ?? '';

        try {

        $orderItemCols = $this->getOrderItemColumns();
        $priceCol = $orderItemCols['price'];

        $sql = "
            SELECT 
                o.*,
                u.full_name as customer_name,
                u.email as customer_email,
                u.phone as customer_phone,
                COUNT(oi.id) as item_count,
                COALESCE(SUM(oi.quantity * oi.{$priceCol}), o.total_amount) as total_amount
            FROM orders o
            JOIN users u ON o.customer_id = u.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.seller_id = ?
        ";
        $params = [$user['id']];

        if ($status !== '' && $status !== 'all') {
            $sql .= " AND o.status = ?";
            $params[] = $status;
        }

        if ($search !== '') {
            $sql .= " AND (CAST(o.id AS CHAR) LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)";
            $s = "%{$search}%";
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
        }

        $sql .= " GROUP BY o.id ORDER BY o.created_at DESC LIMIT ? OFFSET ?";
        $params[] = (int)$limit;
        $params[] = (int)$offset;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($orders as &$order) {
            $stmtItems = $this->db->prepare("
                SELECT oi.*, oi.{$priceCol} as price, p.name as product_name, p.image_url
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = ?
            ");
            $stmtItems->execute([$order['id']]);
            $order['items'] = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
        }

        header('Content-Type: application/json');
        echo json_encode(['orders' => $orders]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function updateSellerOrderStatus($user, $orderId) {
        $data = $this->getJsonBody();
        $status = $data['status'] ?? null;
        if (!$status) {
            http_response_code(400);
            echo json_encode(['error' => 'status is required']);
            return;
        }

        $allowed = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        $status = strtolower($status);
        if (!in_array($status, $allowed)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid status']);
            return;
        }

        $stmt = $this->db->prepare("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ? AND seller_id = ?");
        $stmt->execute([$status, (int)$orderId, $user['id']]);

        echo json_encode(['success' => true]);
    }

    private function listAdminOrders($user) {
        $limit = min($_GET['limit'] ?? 50, 100);
        $offset = $_GET['offset'] ?? 0;
        $status = $_GET['status'] ?? '';
        $search = $_GET['search'] ?? '';

        $sql = "
            SELECT 
                o.*,
                cu.full_name as customer_name,
                cu.email as customer_email,
                su.full_name as seller_name,
                ss.store_name,
                COUNT(oi.id) as item_count
            FROM orders o
            JOIN users cu ON o.customer_id = cu.id
            JOIN users su ON o.seller_id = su.id
            LEFT JOIN sellers ss ON ss.user_id = su.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE 1=1
        ";
        $params = [];

        if ($status !== '' && $status !== 'all') {
            $sql .= " AND o.status = ?";
            $params[] = $status;
        }

        if ($search !== '') {
            $sql .= " AND (CAST(o.id AS CHAR) LIKE ? OR cu.full_name LIKE ? OR ss.store_name LIKE ?)";
            $s = "%{$search}%";
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
        }

        $sql .= " GROUP BY o.id ORDER BY o.created_at DESC LIMIT ? OFFSET ?";
        $params[] = (int)$limit;
        $params[] = (int)$offset;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        header('Content-Type: application/json');
        echo json_encode(['orders' => $orders]);
    }

    private function updateAdminOrderStatus($user, $orderId) {
        $data = $this->getJsonBody();
        $status = $data['status'] ?? null;
        if (!$status) {
            http_response_code(400);
            echo json_encode(['error' => 'status is required']);
            return;
        }

        $allowed = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        $status = strtolower($status);
        if (!in_array($status, $allowed)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid status']);
            return;
        }

        $stmt = $this->db->prepare("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$status, (int)$orderId]);

        echo json_encode(['success' => true]);
    }

    public function getCustomerOrders() {
        // Authenticate user
        $user = $this->auth->authenticate();
        
        if ($user['role'] !== 'customer') {
            http_response_code(403);
            echo json_encode(['error' => 'Access denied']);
            return;
        }

        $limit = min($_GET['limit'] ?? 10, 50);
        $offset = $_GET['offset'] ?? 0;
        $status = $_GET['status'] ?? '';

        try {
            $orderItemCols = $this->getOrderItemColumns();
            $priceCol = $orderItemCols['price'];

            $sql = "
                SELECT 
                    o.*,
                    u.full_name as seller_name,
                    ss.store_name,
                    COUNT(oi.id) as item_count,
                    SUM(oi.quantity * oi.{$priceCol}) as total_amount
                FROM orders o
                JOIN users u ON o.seller_id = u.id
                LEFT JOIN sellers ss ON ss.user_id = u.id
                JOIN order_items oi ON o.id = oi.order_id
                WHERE o.customer_id = ?
            ";
            
            $params = [$user['id']];
            
            if (!empty($status)) {
                $sql .= " AND o.status = ?";
                $params[] = $status;
            }
            
            $sql .= " GROUP BY o.id ORDER BY o.created_at DESC LIMIT ? OFFSET ?";
            $params[] = $limit;
            $params[] = $offset;
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Get order items for each order
            foreach ($orders as &$order) {
                $stmt = $this->db->prepare("
                    SELECT oi.*, oi.{$priceCol} as price, p.name as product_name, p.image_url
                    FROM order_items oi
                    JOIN products p ON oi.product_id = p.id
                    WHERE oi.order_id = ?
                ");
                $stmt->execute([$order['id']]);
                $order['items'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }
            
            header('Content-Type: application/json');
            echo json_encode(['orders' => $orders]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function getOrderStats() {
        // Authenticate user
        $user = $this->auth->authenticate();
        
        if ($user['role'] !== 'customer') {
            http_response_code(403);
            echo json_encode(['error' => 'Access denied']);
            return;
        }

        try {
            $orderItemCols = $this->getOrderItemColumns();
            $priceCol = $orderItemCols['price'];
            $hasWishlist = $this->tableExists('wishlist');
            $hasWallets = $this->tableExists('wallets');

            // Get customer stats
            $wishlistSelect = $hasWishlist ? "(SELECT COUNT(*) FROM wishlist WHERE user_id = ?)" : "0";
            $stmt = $this->db->prepare("
                SELECT 
                    COUNT(DISTINCT o.id) as total_orders,
                    COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) as delivered_orders,
                    COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN oi.quantity * oi.{$priceCol} END), 0) as total_spent,
                    {$wishlistSelect} as wishlist_items,
                    (SELECT COUNT(*) FROM cart WHERE user_id = ?) as cart_items
                FROM orders o
                LEFT JOIN order_items oi ON o.id = oi.order_id
                WHERE o.customer_id = ?
            ");
            if ($hasWishlist) {
                $stmt->execute([$user['id'], $user['id'], $user['id']]);
            } else {
                $stmt->execute([$user['id'], $user['id']]);
            }
            $stats = $stmt->fetch();
            
            // Get wallet balance if wallet table exists
            if ($hasWallets) {
                try {
                    $stmt = $this->db->prepare("
                        SELECT COALESCE(balance, 0) as wallet_balance
                        FROM wallets
                        WHERE user_id = ?
                    ");
                    $stmt->execute([$user['id']]);
                    $wallet = $stmt->fetch();
                    $stats['wallet_balance'] = $wallet['wallet_balance'] ?? 0;
                } catch (PDOException $e) {
                    $stats['wallet_balance'] = 0;
                }
            } else {
                $stats['wallet_balance'] = 0;
            }
            
            header('Content-Type: application/json');
            echo json_encode(['stats' => $stats]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function createOrder() {
        // Authenticate user
        $user = $this->auth->authenticate();
        
        if ($user['role'] !== 'customer') {
            http_response_code(403);
            echo json_encode(['error' => 'Access denied']);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $items = $data['items'] ?? [];
        $shippingAddress = $data['shipping_address'] ?? '';

        if (empty($items) || empty($shippingAddress)) {
            http_response_code(400);
            echo json_encode(['error' => 'Items and shipping address are required']);
            return;
        }

        try {
            $this->db->beginTransaction();

            $orderItemCols = $this->getOrderItemColumns();
            $priceCol = $orderItemCols['price'];
            $totalCol = $orderItemCols['total'];
            $hasSellerId = $orderItemCols['has_seller_id'];
            
            // Group items by seller
            $sellerItems = [];
            foreach ($items as $item) {
                $sellerItems[$item['seller_id']][] = $item;
            }
            
            $orderIds = [];
            
            foreach ($sellerItems as $sellerId => $sellerItemsList) {
                // Create order for each seller
                $subtotal = 0.0;
                foreach ($sellerItemsList as $item) {
                    $qty = (int)($item['quantity'] ?? 0);
                    $unit = (float)($item['unit_price'] ?? ($item['price'] ?? 0));
                    if ($qty > 0) {
                        $subtotal += ($qty * $unit);
                    }
                }

                $orderNumber = 'ORD-' . date('YmdHis') . '-' . substr(bin2hex(random_bytes(4)), 0, 8);
                $totalAmount = $subtotal;

                $stmt = $this->db->prepare("
                    INSERT INTO orders (order_number, customer_id, seller_id, status, subtotal, tax_amount, shipping_amount, discount_amount, total_amount, payment_status, shipping_address, created_at, updated_at)
                    VALUES (?, ?, ?, 'pending', ?, 0.00, 0.00, 0.00, ?, 'pending', ?, NOW(), NOW())
                ");
                $stmt->execute([$orderNumber, $user['id'], $sellerId, $subtotal, $totalAmount, $shippingAddress]);
                $orderId = (int)$this->db->lastInsertId();
                if ($orderId <= 0) {
                    throw new Exception('Failed to create order: missing order id');
                }

                $stmtCheck = $this->db->prepare("SELECT id FROM orders WHERE id = ? LIMIT 1");
                $stmtCheck->execute([$orderId]);
                if (!$stmtCheck->fetch(PDO::FETCH_ASSOC)) {
                    throw new Exception('Failed to create order: order row not found after insert');
                }
                $orderIds[] = $orderId;
                
                // Add order items
                foreach ($sellerItemsList as $item) {
                    $qty = (int)($item['quantity'] ?? 0);
                    $unit = (float)($item['unit_price'] ?? ($item['price'] ?? 0));
                    $productId = (int)($item['product_id'] ?? 0);
                    if ($qty <= 0) {
                        continue;
                    }
                    if ($productId <= 0) {
                        throw new Exception('Invalid product_id for order item');
                    }
                    $lineTotal = $qty * $unit;

                    if ($hasSellerId) {
                    $stmt = $this->db->prepare("
                        INSERT INTO order_items (order_id, product_id, seller_id, quantity, {$priceCol}, {$totalCol}, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, NOW())
                    ");
                    $stmt->execute([$orderId, $productId, $sellerId, $qty, $unit, $lineTotal]);
                    } else {
                        $stmt = $this->db->prepare("
                            INSERT INTO order_items (order_id, product_id, quantity, {$priceCol}, {$totalCol}, created_at)
                            VALUES (?, ?, ?, ?, ?, NOW())
                        ");
                        $stmt->execute([$orderId, $productId, $qty, $unit, $lineTotal]);
                    }
                    
                    // Update product stock
                    $stmt = $this->db->prepare("
                        UPDATE products SET stock = stock - ? WHERE id = ?
                    ");
                    $stmt->execute([$qty, $productId]);
                }
            }
            
            // Clear cart
            $stmt = $this->db->prepare("DELETE FROM cart WHERE user_id = ?");
            $stmt->execute([$user['id']]);
            
            $this->db->commit();
            
            http_response_code(201);
            echo json_encode([
                'success' => true,
                'order_ids' => $orderIds,
                'message' => 'Orders created successfully'
            ]);
            
        } catch (Exception $e) {
            $this->db->rollBack();
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $requestUri = $_SERVER['REQUEST_URI'];
        $path = $this->getRequestPath();

        if (strpos($path, '/api/seller/orders') === 0) {
            $user = $this->auth->authenticate('seller');

            if ($method === 'GET' && $path === '/api/seller/orders') {
                $this->listSellerOrders($user);
                return;
            }

            if ($method === 'PUT' && preg_match('/\/api\/seller\/orders\/(\d+)\/status/', $path, $m)) {
                $this->updateSellerOrderStatus($user, $m[1]);
                return;
            }
        }

        if (strpos($path, '/api/admin/orders') === 0) {
            $user = $this->auth->authenticate('admin');

            if ($method === 'GET' && $path === '/api/admin/orders') {
                $this->listAdminOrders($user);
                return;
            }

            if ($method === 'PUT' && preg_match('/\/api\/admin\/orders\/(\d+)\/status/', $path, $m)) {
                $this->updateAdminOrderStatus($user, $m[1]);
                return;
            }
        }
        
        if ($method === 'GET') {
            if (strpos($requestUri, '/api/orders/stats') !== false) {
                $this->getOrderStats();
            } else {
                $this->getCustomerOrders();
            }
        } elseif ($method === 'POST') {
            $this->createOrder();
        }
    }
}

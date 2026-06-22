<?php
require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class ProductController {
    private $db;
    private $auth;
    private $productColumns;
    private $categoryColumns;
    private $validatedProductColumns;
    private $validatedCategoryColumns;

    public function __construct() {
        $this->db = new Database();
        $this->auth = new AuthMiddleware();
        $this->productColumns = null;
        $this->categoryColumns = null;
        $this->validatedProductColumns = [];
        $this->validatedCategoryColumns = [];
    }

    private function disableProductColumn($name) {
        $this->validatedProductColumns[$name] = false;
        $cols = $this->getProductColumns();
        unset($cols[$name]);
        $this->productColumns = $cols;
    }

    private function runWithIsActiveFallback(callable $fn) {
        try {
            return $fn();
        } catch (PDOException $e) {
            if ($e->getCode() === '42S22' && stripos($e->getMessage(), 'is_active') !== false) {
                $this->disableProductColumn('is_active');
                return $fn();
            }
            throw $e;
        }
    }

    private function getCategoryColumns() {
        if (is_array($this->categoryColumns)) {
            return $this->categoryColumns;
        }

        try {
            $stmt = $this->db->prepare("SHOW COLUMNS FROM categories");
            $stmt->execute();
            $cols = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                if (isset($row['Field'])) {
                    $cols[$row['Field']] = true;
                }
            }
            $this->categoryColumns = $cols;
            return $this->categoryColumns;
        } catch (Exception $e) {
            $this->categoryColumns = [];
            return $this->categoryColumns;
        }
    }

    private function disableCategoryColumn($name) {
        $this->validatedCategoryColumns[$name] = false;
        $cols = $this->getCategoryColumns();
        unset($cols[$name]);
        $this->categoryColumns = $cols;
    }

    private function hasCategoryColumn($name) {
        $cols = $this->getCategoryColumns();
        if (!isset($cols[$name])) {
            return false;
        }

        if (in_array($name, ['is_active', 'status', 'created_at', 'updated_at', 'image_url', 'description'], true)) {
            return $this->probeCategoryColumn($name);
        }

        return true;
    }

    private function probeCategoryColumn($name) {
        if (array_key_exists($name, $this->validatedCategoryColumns)) {
            return (bool)$this->validatedCategoryColumns[$name];
        }

        try {
            $stmt = $this->db->prepare("SELECT 1 FROM categories WHERE {$name} IS NOT NULL LIMIT 1");
            $stmt->execute();
            $this->validatedCategoryColumns[$name] = true;
            return true;
        } catch (PDOException $e) {
            $this->validatedCategoryColumns[$name] = false;
            $this->disableCategoryColumn($name);
            return false;
        }
    }

    private function activeCategoryCondition($alias = 'c') {
        if ($this->hasCategoryColumn('is_active')) {
            return "{$alias}.is_active = 1";
        }
        if ($this->hasCategoryColumn('status')) {
            return "{$alias}.status <> 'inactive'";
        }
        return "1=1";
    }

    private function sellerProductsOrderBy() {
        if ($this->hasProductColumn('created_at')) {
            return 'p.created_at';
        }
        return 'p.id';
    }

    private function stockColumnName() {
        if ($this->hasProductColumn('stock')) {
            return 'stock';
        }
        if ($this->hasProductColumn('quantity')) {
            return 'quantity';
        }
        return null;
    }

    private function stockSelectExpr($alias = 'p') {
        $col = $this->stockColumnName();
        if ($col) {
            return "{$alias}.{$col} as stock";
        }
        return '0 as stock';
    }

    private function inStockCondition($alias = 'p') {
        $col = $this->stockColumnName();
        if ($col) {
            return "{$alias}.{$col} > 0";
        }
        return '1=1';
    }

    private function getProductColumns() {
        if (is_array($this->productColumns)) {
            return $this->productColumns;
        }

        try {
            $stmt = $this->db->prepare("SHOW COLUMNS FROM products");
            $stmt->execute();
            $cols = [];
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                if (isset($row['Field'])) {
                    $cols[$row['Field']] = true;
                }
            }
            $this->productColumns = $cols;
            return $this->productColumns;
        } catch (Exception $e) {
            $this->productColumns = [];
            return $this->productColumns;
        }
    }

    private function hasProductColumn($name) {
        $cols = $this->getProductColumns();
        if (!isset($cols[$name])) {
            return false;
        }

        // Probe likely-to-differ columns to avoid runtime SQL crashes when schema is different
        if (in_array($name, ['is_active', 'status', 'is_published'], true)) {
            return $this->probeProductColumn($name);
        }

        return true;
    }

    private function probeProductColumn($name) {
        if (array_key_exists($name, $this->validatedProductColumns)) {
            return (bool)$this->validatedProductColumns[$name];
        }

        try {
            // If column truly doesn't exist, MySQL will throw 42S22
            $stmt = $this->db->prepare("SELECT 1 FROM products WHERE {$name} IS NOT NULL LIMIT 1");
            $stmt->execute();
            $this->validatedProductColumns[$name] = true;
            return true;
        } catch (PDOException $e) {
            $this->validatedProductColumns[$name] = false;

            // Remove from cached columns so subsequent logic won't try to use it
            $cols = $this->getProductColumns();
            unset($cols[$name]);
            $this->productColumns = $cols;
            return false;
        }
    }

    private function activeProductCondition($alias = 'p') {
        if ($this->hasProductColumn('is_active')) {
            return "{$alias}.is_active = 1";
        }
        if ($this->hasProductColumn('status')) {
            return "{$alias}.status = 'active'";
        }
        if ($this->hasProductColumn('is_published')) {
            return "{$alias}.is_published = 1";
        }
        return "1=1";
    }

    private function inactiveProductCondition($alias = 'p') {
        if ($this->hasProductColumn('is_active')) {
            return "{$alias}.is_active = 0";
        }
        if ($this->hasProductColumn('status')) {
            return "{$alias}.status <> 'active'";
        }
        if ($this->hasProductColumn('is_published')) {
            return "{$alias}.is_published = 0";
        }
        return "1=1";
    }

    public function getProducts() {
        $authHeader = null;
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        if (is_array($headers)) {
            foreach ($headers as $k => $v) {
                if (strtolower((string)$k) === 'authorization') {
                    $authHeader = $v;
                    break;
                }
            }
        }
        if (!$authHeader) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null);
        }
        if (is_string($authHeader) && preg_match('/Bearer\s(\S+)/', $authHeader)) {
            $this->auth->authenticate();
        }

        $search = $_GET['search'] ?? '';
        $categoryParam = trim((string)($_GET['category'] ?? ''));
        $categories = array_values(array_filter(array_unique(array_map('trim', explode(',', $categoryParam))), function ($v) {
            return $v !== '';
        }));
        $minPrice = $_GET['min_price'] ?? 0;
        $maxPrice = $_GET['max_price'] ?? 999999;
        $rating = $_GET['rating'] ?? 0;
        $sortBy = $_GET['sort'] ?? 'created_at';
        $order = $_GET['order'] ?? 'DESC';
        $limit = min($_GET['limit'] ?? 20, 50);
        $offset = $_GET['offset'] ?? 0;

        try {
            $products = $this->runWithIsActiveFallback(function () use ($search, $categories, $minPrice, $maxPrice, $rating, $sortBy, $order, $limit, $offset) {
                $activeProduct = $this->activeProductCondition('p');
                $inStock = $this->inStockCondition('p');
                $stockSelect = $this->stockSelectExpr('p');

                $categoryJoin = '';
                $categorySelect = "'' as category_name";
                $categoryWhere = '';
                if ($this->hasProductColumn('category_id')) {
                    $categoryJoin = 'LEFT JOIN categories c ON p.category_id = c.id';
                    $categorySelect = 'c.name as category_name';
                    if (!empty($categories)) {
                        if (count($categories) > 1) {
                            $placeholders = implode(',', array_fill(0, count($categories), '?'));
                            $categoryWhere = " AND c.name IN ({$placeholders})";
                        } else {
                            $categoryWhere = ' AND c.name = ?';
                        }
                    }
                }

                $sql = "
                    SELECT 
                        p.*,
                        {$stockSelect},
                        u.full_name as seller_name,
                        ss.store_name,
                        {$categorySelect},
                        (SELECT AVG(rating) FROM reviews WHERE product_id = p.id) as avg_rating,
                        (SELECT COUNT(*) FROM reviews WHERE product_id = p.id) as review_count,
                        (SELECT COUNT(*) FROM order_items WHERE product_id = p.id) as sales_count
                    FROM products p
                    JOIN users u ON p.seller_id = u.id
                    LEFT JOIN sellers ss ON ss.user_id = u.id
                    {$categoryJoin}
                    WHERE {$activeProduct} AND {$inStock}
                      AND NOT EXISTS (SELECT 1 FROM users WHERE id = p.seller_id AND role = 'admin')
                ";

                $params = [];

                if (!empty($search)) {
                    $sql .= " AND (p.name LIKE ? OR p.description LIKE ?)";
                    $searchParam = "%{$search}%";
                    $params[] = $searchParam;
                    $params[] = $searchParam;
                }

                if (!empty($categories) && $categoryWhere !== '') {
                    $sql .= $categoryWhere;
                    foreach ($categories as $catName) {
                        $params[] = $catName;
                    }
                }

                if ($minPrice > 0) {
                    $sql .= " AND p.price >= ?";
                    $params[] = $minPrice;
                }

                if ($maxPrice < 999999) {
                    $sql .= " AND p.price <= ?";
                    $params[] = $maxPrice;
                }

                if ($rating > 0) {
                    $sql .= " AND (SELECT AVG(rating) FROM reviews WHERE product_id = p.id) >= ?";
                    $params[] = $rating;
                }

                $allowedSort = ['created_at','price','rating','sales'];
                $sortBy = in_array($sortBy, $allowedSort) ? $sortBy : 'created_at';
                $order = strtoupper($order) === 'ASC' ? 'ASC' : 'DESC';

                if ($sortBy === 'price') {
                    $sql .= " ORDER BY p.price {$order}";
                } elseif ($sortBy === 'rating') {
                    $sql .= " ORDER BY avg_rating {$order}";
                } elseif ($sortBy === 'sales') {
                    $sql .= " ORDER BY sales_count {$order}";
                } else {
                    $orderBy = $this->hasProductColumn('created_at') ? 'p.created_at' : 'p.id';
                    $sql .= " ORDER BY {$orderBy} {$order}";
                }

                $sql .= " LIMIT ? OFFSET ?";
                $params[] = (int)$limit;
                $params[] = (int)$offset;

                $stmt = $this->db->prepare($sql);
                $stmt->execute($params);
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            });

            foreach ($products as &$product) {
                $product['avg_rating'] = round((float)($product['avg_rating'] ?? 0), 1);
                $product['original_price'] = (float)($product['price'] ?? 0) * 1.5;
                $product['image_url'] = $product['image_url'] ?? '/placeholder-product.jpg';
            }

            header('Content-Type: application/json');
            echo json_encode(['products' => $products]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
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

    private function normalizeProductStatus($product) {
        // First check if is_active is explicitly set to 0
        if (isset($product['is_active']) && (int)$product['is_active'] === 0) {
            return 'Inactive';
        }
        // Then check if is_published is explicitly set to 0
        if (isset($product['is_published']) && (int)$product['is_published'] === 0) {
            return 'Inactive';
        }
        // Check status field only if is_active is not set
        if (!isset($product['is_active']) && isset($product['status']) && strtolower((string)$product['status']) !== 'active') {
            return 'Inactive';
        }
        // Check stock only if product is marked as active
        $stock = (int)($product['stock'] ?? ($product['quantity'] ?? 0));
        if ($stock <= 0) {
            return 'Out of Stock';
        }
        return 'Active';
    }

    private function findCategoryId($categoryName) {
        if (!$categoryName) return null;
        $stmt = $this->db->prepare("SELECT id FROM categories WHERE name = ? LIMIT 1");
        $stmt->execute([$categoryName]);
        $row = $stmt->fetch();
        return $row ? (int)$row['id'] : null;
    }

    private function listSellerProducts($user) {
        $search = $_GET['search'] ?? '';
        $category = $_GET['category'] ?? '';
        $status = $_GET['status'] ?? '';
        $limit = min($_GET['limit'] ?? 50, 100);
        $offset = $_GET['offset'] ?? 0;

        try {
            $rows = $this->runWithIsActiveFallback(function () use ($user, $search, $category, $status, $limit, $offset) {
                $stockSelect = $this->stockSelectExpr('p');
                $categoryJoin = '';
                $categorySelect = "'' as category_name";
                if ($this->hasProductColumn('category_id')) {
                    $categoryJoin = 'LEFT JOIN categories c ON p.category_id = c.id';
                    $categorySelect = 'c.name as category_name';
                }

                $sql = "
                    SELECT p.*, {$stockSelect}, {$categorySelect}
                    FROM products p
                    {$categoryJoin}
                    WHERE p.seller_id = ?
                ";
                $params = [$user['id']];

                if ($search !== '') {
                    $sql .= " AND (p.name LIKE ? OR p.description LIKE ?)";
                    $s = "%{$search}%";
                    $params[] = $s;
                    $params[] = $s;
                }

                if ($category !== '' && $category !== 'all' && $categoryJoin !== '') {
                    $sql .= " AND c.name = ?";
                    $params[] = $category;
                }

                if ($status !== '' && $status !== 'all') {
                    if ($status === 'Active') {
                        $sql .= " AND " . $this->activeProductCondition('p') . " AND " . $this->inStockCondition('p');
                    } elseif ($status === 'Inactive') {
                        $sql .= " AND " . $this->inactiveProductCondition('p');
                    } elseif ($status === 'Out of Stock') {
                        $col = $this->stockColumnName();
                        if ($col) {
                            $sql .= " AND " . $this->activeProductCondition('p') . " AND p.{$col} <= 0";
                        } else {
                            $sql .= " AND 1=0";
                        }
                    }
                }

                $orderBy = $this->sellerProductsOrderBy();
                $sql .= " ORDER BY {$orderBy} DESC LIMIT ? OFFSET ?";
                $params[] = (int)$limit;
                $params[] = (int)$offset;

                $stmt = $this->db->prepare($sql);
                $stmt->execute($params);
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            });

        $products = [];
        foreach ($rows as $row) {
            $products[] = [
                'id' => (int)$row['id'],
                'name' => $row['name'],
                'price' => (float)$row['price'],
                'stock' => (int)($row['stock'] ?? ($row['quantity'] ?? 0)),
                'category' => $row['category_name'] ?? '',
                'status' => $this->normalizeProductStatus($row),
                'is_active' => isset($row['is_active']) ? (int)$row['is_active'] : 1,
                'created_at' => $row['created_at'],
                'image_url' => $row['image_url'] ?? null,
                'description' => $row['description'] ?? ''
            ];
        }

        header('Content-Type: application/json');
        echo json_encode(['products' => $products]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function listAdminCatalog($user) {
        try {
            $rows = $this->runWithIsActiveFallback(function () {
                $stockSelect = $this->stockSelectExpr('p');
                $categoryJoin = '';
                $categorySelect = "'' as category_name";
                if ($this->hasProductColumn('category_id')) {
                    $categoryJoin = 'LEFT JOIN categories c ON p.category_id = c.id';
                    $categorySelect = 'c.name as category_name';
                }

                $sql = "
                    SELECT p.*, {$stockSelect}, {$categorySelect}
                    FROM products p
                    {$categoryJoin}
                    WHERE p.seller_id IN (SELECT id FROM users WHERE role = 'admin')
                      AND " . $this->activeProductCondition('p') . "
                ";

                $stmt = $this->db->prepare($sql);
                $stmt->execute();
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            });

            $products = [];
            foreach ($rows as $row) {
                $products[] = [
                    'id' => (int)$row['id'],
                    'name' => $row['name'],
                    'price' => (float)$row['price'],
                    'stock' => (int)($row['stock'] ?? ($row['quantity'] ?? 0)),
                    'category' => $row['category_name'] ?? '',
                    'status' => $this->normalizeProductStatus($row),
                    'is_active' => isset($row['is_active']) ? (int)$row['is_active'] : 1,
                    'created_at' => $row['created_at'],
                    'image_url' => $row['image_url'] ?? null,
                    'description' => $row['description'] ?? ''
                ];
            }

            header('Content-Type: application/json');
            echo json_encode(['products' => $products]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function adoptAdminProduct($user, $productId) {
        try {
            $stmt = $this->db->prepare("
                SELECT p.*, u.role
                FROM products p
                JOIN users u ON p.seller_id = u.id
                WHERE p.id = ? AND u.role = 'admin' LIMIT 1
            ");
            $stmt->execute([$productId]);
            $adminProduct = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$adminProduct) {
                http_response_code(404);
                echo json_encode(['error' => 'Admin product not found']);
                return;
            }

            $stmt = $this->db->prepare("SELECT id FROM products WHERE seller_id = ? AND name = ? LIMIT 1");
            $stmt->execute([$user['id'], $adminProduct['name']]);
            if ($stmt->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'You already have a product with this name']);
                return;
            }

            $columns = ['seller_id', 'name', 'price'];
            $placeholders = ['?', '?', '?'];
            $values = [$user['id'], $adminProduct['name'], $adminProduct['price']];

            $stockCol = $this->stockColumnName();
            $stockValue = (int)($adminProduct['stock'] ?? ($adminProduct['quantity'] ?? 0));
            if ($stockCol) {
                $columns[] = $stockCol;
                $placeholders[] = '?';
                $values[] = $stockValue;
            }

            if ($this->hasProductColumn('category_id') && !empty($adminProduct['category_id'])) {
                $columns[] = 'category_id';
                $placeholders[] = '?';
                $values[] = $adminProduct['category_id'];
            }

            if ($this->hasProductColumn('description')) {
                $columns[] = 'description';
                $placeholders[] = '?';
                $values[] = $adminProduct['description'];
            }

            if ($this->hasProductColumn('image_url')) {
                $columns[] = 'image_url';
                $placeholders[] = '?';
                $values[] = $adminProduct['image_url'];
            }

            if ($this->hasProductColumn('is_active')) {
                $columns[] = 'is_active';
                $placeholders[] = '?';
                $values[] = 1;
            } elseif ($this->hasProductColumn('status')) {
                $columns[] = 'status';
                $placeholders[] = '?';
                $values[] = 'active';
            } elseif ($this->hasProductColumn('is_published')) {
                $columns[] = 'is_published';
                $placeholders[] = '?';
                $values[] = 1;
            }

            if ($this->hasProductColumn('created_at')) {
                $columns[] = 'created_at';
                $placeholders[] = 'NOW()';
            }
            if ($this->hasProductColumn('updated_at')) {
                $columns[] = 'updated_at';
                $placeholders[] = 'NOW()';
            }

            $sql = "INSERT INTO products (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($values);
            $newId = (int)$this->db->lastInsertId();

            header('Content-Type: application/json');
            echo json_encode(['success' => true, 'product_id' => $newId, 'message' => 'Product added to your store']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function createSellerProduct($user) {
        $data = $this->getJsonBody();
        $name = trim($data['name'] ?? '');
        $price = $data['price'] ?? null;
        $stock = $data['stock'] ?? null;

        if ($name === '' || $price === null || $stock === null) {
            http_response_code(400);
            echo json_encode(['error' => 'name, price, and stock are required']);
            return;
        }

        $categoryId = $data['category_id'] ?? null;
        if (!$categoryId && !empty($data['category'])) {
            $categoryId = $this->findCategoryId($data['category']);
        }
        $description = $data['description'] ?? null;
        $imageUrl = $data['image_url'] ?? null;
        if ($imageUrl !== null && $imageUrl !== '') {
            if (strlen($imageUrl) > 65535) {
                http_response_code(400);
                echo json_encode(['error' => 'Image URL is too long (max 65535 characters)']);
                return;
            }
            $allowedSchemes = ['http://', 'https://', 'data:image/', '/uploads/'];
            $valid = false;
            foreach ($allowedSchemes as $scheme) {
                if (stripos($imageUrl, $scheme) === 0) {
                    $valid = true;
                    break;
                }
            }
            if (!$valid) {
                http_response_code(400);
                echo json_encode(['error' => 'Image URL must start with http://, https://, or be a valid data URI']);
                return;
            }
            if (preg_match('/^https?:\/\//i', $imageUrl)) {
                $parsed = parse_url($imageUrl);
                if (!isset($parsed['scheme'], $parsed['host'])) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Image URL is not a valid URL']);
                    return;
                }
            }
        }
        $isActive = isset($data['is_active']) ? (int)(!!$data['is_active']) : 1;

        $columns = ['seller_id', 'name', 'price'];
        $placeholders = ['?', '?', '?'];
        $values = [$user['id'], $name, $price];

        $stockCol = $this->stockColumnName();
        if ($stockCol) {
            $columns[] = $stockCol;
            $placeholders[] = '?';
            $values[] = $stock;
        }

        if ($categoryId !== null && $this->hasProductColumn('category_id')) {
            $columns[] = 'category_id';
            $placeholders[] = '?';
            $values[] = $categoryId;
        }

        if ($this->hasProductColumn('description')) {
            $columns[] = 'description';
            $placeholders[] = '?';
            $values[] = $description;
        }

        if ($this->hasProductColumn('image_url')) {
            $columns[] = 'image_url';
            $placeholders[] = '?';
            $values[] = $imageUrl;
        }

        if ($this->hasProductColumn('is_active')) {
            $columns[] = 'is_active';
            $placeholders[] = '?';
            $values[] = $isActive;
        } elseif ($this->hasProductColumn('status')) {
            $columns[] = 'status';
            $placeholders[] = '?';
            $values[] = $isActive ? 'active' : 'inactive';
        } elseif ($this->hasProductColumn('is_published')) {
            $columns[] = 'is_published';
            $placeholders[] = '?';
            $values[] = $isActive;
        }

        if ($this->hasProductColumn('created_at')) {
            $columns[] = 'created_at';
            $placeholders[] = 'NOW()';
        }
        if ($this->hasProductColumn('updated_at')) {
            $columns[] = 'updated_at';
            $placeholders[] = 'NOW()';
        }

        $sql = "INSERT INTO products (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($values);
        $id = (int)$this->db->lastInsertId();

        http_response_code(201);
        echo json_encode(['success' => true, 'product_id' => $id]);
    }

    private function updateSellerProduct($user, $productId) {
        $data = $this->getJsonBody();

        $stmt = $this->db->prepare("SELECT * FROM products WHERE id = ? AND seller_id = ? LIMIT 1");
        $stmt->execute([(int)$productId, $user['id']]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found']);
            return;
        }

        if (array_key_exists('image_url', $data)) {
            $imageUrl = $data['image_url'];
            if ($imageUrl !== null && $imageUrl !== '') {
                if (strlen($imageUrl) > 65535) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Image URL is too long (max 65535 characters)']);
                    return;
                }
                $allowedSchemes = ['http://', 'https://', 'data:image/', '/uploads/'];
                $valid = false;
                foreach ($allowedSchemes as $scheme) {
                    if (stripos($imageUrl, $scheme) === 0) {
                        $valid = true;
                        break;
                    }
                }
                if (!$valid) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Image URL must start with http://, https://, or be a valid data URI']);
                    return;
                }
                if (preg_match('/^https?:\/\//i', $imageUrl)) {
                    $parsed = parse_url($imageUrl);
                    if (!isset($parsed['scheme'], $parsed['host'])) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Image URL is not a valid URL']);
                        return;
                    }
                }
            }
        }

        $fields = [];
        $params = [];

        foreach (['name','description','image_url'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "$key = ?";
                $params[] = $data[$key];
            }
        }

        if (array_key_exists('price', $data)) {
            $fields[] = "price = ?";
            $params[] = $data['price'];
        }

        if (array_key_exists('stock', $data)) {
            $stockCol = $this->stockColumnName();
            if ($stockCol) {
                $fields[] = "{$stockCol} = ?";
                $params[] = $data['stock'];
            }
        }

        if (array_key_exists('category_id', $data)) {
            $fields[] = "category_id = ?";
            $params[] = $data['category_id'];
        } elseif (array_key_exists('category', $data)) {
            $fields[] = "category_id = ?";
            $params[] = $this->findCategoryId($data['category']);
        }

        if (array_key_exists('is_active', $data)) {
            $nextActive = (int)(!!$data['is_active']);
            if ($this->hasProductColumn('is_active')) {
                $fields[] = "is_active = ?";
                $params[] = $nextActive;
            } elseif ($this->hasProductColumn('status')) {
                $fields[] = "status = ?";
                $params[] = $nextActive ? 'active' : 'inactive';
            } elseif ($this->hasProductColumn('is_published')) {
                $fields[] = "is_published = ?";
                $params[] = $nextActive;
            }
        }

        if (empty($fields)) {
            echo json_encode(['success' => true]);
            return;
        }

        if ($this->hasProductColumn('updated_at')) {
            $fields[] = "updated_at = NOW()";
        }
        $sql = "UPDATE products SET " . implode(', ', $fields) . " WHERE id = ? AND seller_id = ?";
        $params[] = (int)$productId;
        $params[] = $user['id'];

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['success' => true]);
    }

    private function deleteSellerProduct($user, $productId) {
        if ($this->hasProductColumn('is_active')) {
            $stmt = $this->db->prepare("UPDATE products SET is_active = 0" . ($this->hasProductColumn('updated_at') ? ", updated_at = NOW()" : "") . " WHERE id = ? AND seller_id = ?");
            $stmt->execute([(int)$productId, $user['id']]);
        } elseif ($this->hasProductColumn('status')) {
            $stmt = $this->db->prepare("UPDATE products SET status = ?" . ($this->hasProductColumn('updated_at') ? ", updated_at = NOW()" : "") . " WHERE id = ? AND seller_id = ?");
            $stmt->execute(['inactive', (int)$productId, $user['id']]);
        } elseif ($this->hasProductColumn('is_published')) {
            $stmt = $this->db->prepare("UPDATE products SET is_published = 0" . ($this->hasProductColumn('updated_at') ? ", updated_at = NOW()" : "") . " WHERE id = ? AND seller_id = ?");
            $stmt->execute([(int)$productId, $user['id']]);
        } else {
            $stmt = $this->db->prepare("DELETE FROM products WHERE id = ? AND seller_id = ?");
            $stmt->execute([(int)$productId, $user['id']]);
        }
        echo json_encode(['success' => true]);
    }

    private function listAdminProducts($user) {
        $search = $_GET['search'] ?? '';
        $category = $_GET['category'] ?? '';
        $limit = min($_GET['limit'] ?? 50, 100);
        $offset = $_GET['offset'] ?? 0;

        try {
            $rows = $this->runWithIsActiveFallback(function () use ($search, $category, $limit, $offset) {
                $categoryJoin = '';
                $categorySelect = "'' as category_name";
                if ($this->hasProductColumn('category_id')) {
                    $categoryJoin = 'LEFT JOIN categories c ON p.category_id = c.id';
                    $categorySelect = 'c.name as category_name';
                }

                $sql = "
                    SELECT
                        p.*,
                        {$categorySelect},
                        u.full_name as seller_name,
                        ss.store_name,
                        (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.product_id = p.id) as rating
                    FROM products p
                    JOIN users u ON p.seller_id = u.id
                    LEFT JOIN sellers ss ON ss.user_id = u.id
                    {$categoryJoin}
                    WHERE 1=1
                ";
                $params = [];

                if ($search !== '') {
                    $sql .= " AND (p.name LIKE ? OR u.full_name LIKE ? OR ss.store_name LIKE ?)";
                    $s = "%{$search}%";
                    $params[] = $s;
                    $params[] = $s;
                    $params[] = $s;
                }

                if ($category !== '' && $category !== 'all' && $categoryJoin !== '') {
                    $sql .= " AND c.name = ?";
                    $params[] = $category;
                }

                $orderBy = $this->hasProductColumn('created_at') ? 'p.created_at' : 'p.id';
                $sql .= " ORDER BY {$orderBy} DESC LIMIT ? OFFSET ?";
                $params[] = (int)$limit;
                $params[] = (int)$offset;

                $stmt = $this->db->prepare($sql);
                $stmt->execute($params);
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            });

            header('Content-Type: application/json');
            echo json_encode(['products' => $rows]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function createAdminProduct($user) {
        $data = $this->getJsonBody();

        $name = trim($data['name'] ?? '');
        $price = $data['price'] ?? null;
        $stock = $data['stock'] ?? null;

        if ($name === '' || $price === null || $stock === null) {
            http_response_code(400);
            echo json_encode(['error' => 'name, price, and stock are required']);
            return;
        }

        $sellerId = (int)($data['seller_id'] ?? 0);
        if ($sellerId <= 0) {
            $sellerId = (int)$user['id'];
        }

        $categoryId = $data['category_id'] ?? null;
        if (!$categoryId && !empty($data['category'])) {
            $categoryId = $this->findCategoryId($data['category']);
        }

        $description = $data['description'] ?? null;
        $imageUrl = $data['image_url'] ?? null;
        if ($imageUrl !== null && $imageUrl !== '') {
            if (strlen($imageUrl) > 65535) {
                http_response_code(400);
                echo json_encode(['error' => 'Image URL is too long (max 65535 characters)']);
                return;
            }
            $allowedSchemes = ['http://', 'https://', 'data:image/', '/uploads/'];
            $valid = false;
            foreach ($allowedSchemes as $scheme) {
                if (stripos($imageUrl, $scheme) === 0) {
                    $valid = true;
                    break;
                }
            }
            if (!$valid) {
                http_response_code(400);
                echo json_encode(['error' => 'Image URL must start with http://, https://, or be a valid data URI']);
                return;
            }
            if (preg_match('/^https?:\/\//i', $imageUrl)) {
                $parsed = parse_url($imageUrl);
                if (!isset($parsed['scheme'], $parsed['host'])) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Image URL is not a valid URL']);
                    return;
                }
            }
        }
        $isActive = isset($data['is_active']) ? (int)(!!$data['is_active']) : 1;

        $columns = ['seller_id', 'name', 'price', 'stock'];
        $placeholders = ['?', '?', '?', '?'];
        $values = [$sellerId, $name, $price, $stock];

        if ($categoryId !== null && $this->hasProductColumn('category_id')) {
            $columns[] = 'category_id';
            $placeholders[] = '?';
            $values[] = $categoryId;
        }

        if ($this->hasProductColumn('description')) {
            $columns[] = 'description';
            $placeholders[] = '?';
            $values[] = $description;
        }

        if ($this->hasProductColumn('image_url')) {
            $columns[] = 'image_url';
            $placeholders[] = '?';
            $values[] = $imageUrl;
        }

        if ($this->hasProductColumn('is_active')) {
            $columns[] = 'is_active';
            $placeholders[] = '?';
            $values[] = $isActive;
        } elseif ($this->hasProductColumn('status')) {
            $columns[] = 'status';
            $placeholders[] = '?';
            $values[] = $isActive ? 'active' : 'inactive';
        } elseif ($this->hasProductColumn('is_published')) {
            $columns[] = 'is_published';
            $placeholders[] = '?';
            $values[] = $isActive;
        }

        if ($this->hasProductColumn('created_at')) {
            $columns[] = 'created_at';
            $placeholders[] = 'NOW()';
        }
        if ($this->hasProductColumn('updated_at')) {
            $columns[] = 'updated_at';
            $placeholders[] = 'NOW()';
        }

        $sql = "INSERT INTO products (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($values);
        http_response_code(201);
        echo json_encode(['success' => true, 'product_id' => (int)$this->db->lastInsertId()]);
    }

    private function updateAdminProduct($user, $productId) {
        $data = $this->getJsonBody();

        if (array_key_exists('image_url', $data)) {
            $imageUrl = $data['image_url'];
            if ($imageUrl !== null && $imageUrl !== '') {
                if (strlen($imageUrl) > 65535) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Image URL is too long (max 65535 characters)']);
                    return;
                }
                $allowedSchemes = ['http://', 'https://', 'data:image/', '/uploads/'];
                $valid = false;
                foreach ($allowedSchemes as $scheme) {
                    if (stripos($imageUrl, $scheme) === 0) {
                        $valid = true;
                        break;
                    }
                }
                if (!$valid) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Image URL must start with http://, https://, or be a valid data URI']);
                    return;
                }
                if (preg_match('/^https?:\/\//i', $imageUrl)) {
                    $parsed = parse_url($imageUrl);
                    if (!isset($parsed['scheme'], $parsed['host'])) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Image URL is not a valid URL']);
                        return;
                    }
                }
            }
        }

        $fields = [];
        $params = [];
        foreach (['name','description','image_url'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "$key = ?";
                $params[] = $data[$key];
            }
        }
        foreach (['price','stock','category_id'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "$key = ?";
                $params[] = $data[$key];
            }
        }
        if (!array_key_exists('category_id', $data) && !empty($data['category'])) {
            $catId = $this->findCategoryId($data['category']);
            if ($catId) {
                $fields[] = "category_id = ?";
                $params[] = $catId;
            }
        }

        if (array_key_exists('is_active', $data)) {
            $nextActive = (int)(!!$data['is_active']);
            if ($this->hasProductColumn('is_active')) {
                $fields[] = "is_active = ?";
                $params[] = $nextActive;
            } elseif ($this->hasProductColumn('status')) {
                $fields[] = "status = ?";
                $params[] = $nextActive ? 'active' : 'inactive';
            } elseif ($this->hasProductColumn('is_published')) {
                $fields[] = "is_published = ?";
                $params[] = $nextActive;
            }
        }

        if (empty($fields)) {
            echo json_encode(['success' => true]);
            return;
        }

        if ($this->hasProductColumn('updated_at')) {
            $fields[] = "updated_at = NOW()";
        }
        $sql = "UPDATE products SET " . implode(', ', $fields) . " WHERE id = ?";
        $params[] = (int)$productId;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        echo json_encode(['success' => true]);
    }

    private function deleteAdminProduct($user, $productId) {
        $stmt = $this->db->prepare("DELETE FROM products WHERE id = ?");
        $stmt->execute([(int)$productId]);
        echo json_encode(['success' => true]);
    }

    private function listAdminCategories($user) {
        try {
            $rows = $this->runWithIsActiveFallback(function () {
                $activeProduct = $this->activeProductCondition('p');
                $stmt = $this->db->prepare("SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND {$activeProduct}) as product_count FROM categories c ORDER BY c.name");
                $stmt->execute();
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            });

            header('Content-Type: application/json');
            echo json_encode(['categories' => $rows]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    private function createAdminCategory($user) {
        $data = $this->getJsonBody();
        $name = trim($data['name'] ?? '');
        if ($name === '') {
            http_response_code(400);
            echo json_encode(['error' => 'name is required']);
            return;
        }
        $description = $data['description'] ?? null;
        $imageUrl = $data['image_url'] ?? null;
        $isActive = isset($data['is_active']) ? (int)(!!$data['is_active']) : 1;

        $columns = ['name'];
        $placeholders = ['?'];
        $values = [$name];

        if ($this->hasCategoryColumn('description')) {
            $columns[] = 'description';
            $placeholders[] = '?';
            $values[] = $description;
        }

        if ($this->hasCategoryColumn('image_url')) {
            $columns[] = 'image_url';
            $placeholders[] = '?';
            $values[] = $imageUrl;
        }

        if ($this->hasCategoryColumn('is_active')) {
            $columns[] = 'is_active';
            $placeholders[] = '?';
            $values[] = $isActive;
        } elseif ($this->hasCategoryColumn('status')) {
            $columns[] = 'status';
            $placeholders[] = '?';
            $values[] = $isActive ? 'active' : 'inactive';
        }

        if ($this->hasCategoryColumn('created_at')) {
            $columns[] = 'created_at';
            $placeholders[] = 'NOW()';
        }
        if ($this->hasCategoryColumn('updated_at')) {
            $columns[] = 'updated_at';
            $placeholders[] = 'NOW()';
        }

        $sql = "INSERT INTO categories (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($values);
        http_response_code(201);
        echo json_encode(['success' => true, 'category_id' => (int)$this->db->lastInsertId()]);
    }

    private function updateAdminCategory($user, $categoryId) {
        $data = $this->getJsonBody();
        $fields = [];
        $params = [];
        foreach (['name','description','image_url'] as $key) {
            if (array_key_exists($key, $data) && $this->hasCategoryColumn($key)) {
                $fields[] = "$key = ?";
                $params[] = $data[$key];
            }
        }
        if (array_key_exists('is_active', $data)) {
            $nextActive = (int)(!!$data['is_active']);
            if ($this->hasCategoryColumn('is_active')) {
                $fields[] = "is_active = ?";
                $params[] = $nextActive;
            } elseif ($this->hasCategoryColumn('status')) {
                $fields[] = "status = ?";
                $params[] = $nextActive ? 'active' : 'inactive';
            }
        }
        if (empty($fields)) {
            echo json_encode(['success' => true]);
            return;
        }

        if ($this->hasCategoryColumn('updated_at')) {
            $fields[] = "updated_at = NOW()";
        }
        $sql = "UPDATE categories SET " . implode(', ', $fields) . " WHERE id = ?";
        $params[] = (int)$categoryId;
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        echo json_encode(['success' => true]);
    }

    private function deleteAdminCategory($user, $categoryId) {
        if ($this->hasCategoryColumn('is_active')) {
            $sql = "UPDATE categories SET is_active = 0";
            if ($this->hasCategoryColumn('updated_at')) {
                $sql .= ", updated_at = NOW()";
            }
            $sql .= " WHERE id = ?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([(int)$categoryId]);
            echo json_encode(['success' => true]);
            return;
        }

        if ($this->hasCategoryColumn('status')) {
            $sql = "UPDATE categories SET status = 'inactive'";
            if ($this->hasCategoryColumn('updated_at')) {
                $sql .= ", updated_at = NOW()";
            }
            $sql .= " WHERE id = ?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([(int)$categoryId]);
            echo json_encode(['success' => true]);
            return;
        }

        $stmt = $this->db->prepare("DELETE FROM categories WHERE id = ?");
        $stmt->execute([(int)$categoryId]);
        echo json_encode(['success' => true]);
    }

    public function getCategories() {
        try {
            $categories = $this->runWithIsActiveFallback(function () {
                $activeProduct = $this->activeProductCondition('p');

                $select = [
                    'c.id',
                    'c.name',
                    ($this->hasCategoryColumn('description') ? 'c.description' : 'NULL as description'),
                    ($this->hasCategoryColumn('image_url') ? 'c.image_url' : 'NULL as image_url'),
                    ($this->hasCategoryColumn('is_active') ? 'c.is_active' : '1 as is_active'),
                    ($this->hasCategoryColumn('created_at') ? 'c.created_at' : 'NULL as created_at'),
                    ($this->hasCategoryColumn('updated_at') ? 'c.updated_at' : 'NULL as updated_at'),
                ];
                $categoryActive = $this->activeCategoryCondition('c');

                $groupBy = ['c.id', 'c.name'];
                if ($this->hasCategoryColumn('description')) $groupBy[] = 'c.description';
                if ($this->hasCategoryColumn('image_url')) $groupBy[] = 'c.image_url';
                if ($this->hasCategoryColumn('is_active')) $groupBy[] = 'c.is_active';
                if ($this->hasCategoryColumn('created_at')) $groupBy[] = 'c.created_at';
                if ($this->hasCategoryColumn('updated_at')) $groupBy[] = 'c.updated_at';

                $productJoin = '';
                $productCountSelect = '0 as product_count';
                if ($this->hasProductColumn('category_id')) {
                    $productJoin = "LEFT JOIN products p ON c.id = p.category_id AND {$activeProduct}";
                    $productCountSelect = 'COUNT(p.id) as product_count';
                }

                $stmt = $this->db->prepare("
                    SELECT
                        " . implode(",\n                        ", $select) . ",
                        {$productCountSelect}
                    FROM categories c
                    {$productJoin}
                    WHERE {$categoryActive}
                    GROUP BY " . implode(', ', $groupBy) . "
                    ORDER BY c.name
                ");
                $stmt->execute();
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            });

            header('Content-Type: application/json');
            echo json_encode(['categories' => $categories]);

        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function getProduct($id) {
        try {
            $product = $this->runWithIsActiveFallback(function () use ($id) {
                $activeProduct = $this->activeProductCondition('p');
                $stmt = $this->db->prepare("
                    SELECT 
                        p.*,
                        u.full_name as seller_name,
                        ss.store_name,
                        u.email as seller_email,
                        c.name as category_name,
                        (SELECT AVG(rating) FROM reviews WHERE product_id = p.id) as avg_rating,
                        (SELECT COUNT(*) FROM reviews WHERE product_id = p.id) as review_count
                    FROM products p
                    JOIN users u ON p.seller_id = u.id
                    LEFT JOIN sellers ss ON ss.user_id = u.id
                    LEFT JOIN categories c ON p.category_id = c.id
                    WHERE p.id = ? AND {$activeProduct}
                ");
                $stmt->execute([(int)$id]);
                return $stmt->fetch();
            });
            
            if (!$product) {
                http_response_code(404);
                echo json_encode(['error' => 'Product not found']);
                return;
            }
            
            // Get product reviews
            $stmt = $this->db->prepare("
                SELECT r.*, u.full_name as reviewer_name
                FROM reviews r
                JOIN users u ON r.user_id = u.id
                WHERE r.product_id = ?
                ORDER BY r.created_at DESC
                LIMIT 10
            ");
            $stmt->execute([$id]);
            $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $product['reviews'] = $reviews;
            $product['avg_rating'] = $product['avg_rating'] !== null ? round((float)$product['avg_rating'], 1) : 0;
            
            header('Content-Type: application/json');
            echo json_encode(['product' => $product]);
            
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }

    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $requestUri = $_SERVER['REQUEST_URI'];
        $path = $this->getRequestPath();

        if (strpos($path, '/api/seller/products') === 0) {
            $user = $this->auth->authenticate('seller');
            if ($method === 'GET' && strpos($path, '/api/seller/products/admin-catalog') !== false) {
                $this->listAdminCatalog($user);
                return;
            }
            if ($method === 'POST' && preg_match('/\/api\/seller\/products\/(\d+)\/adopt/', $path, $m)) {
                $this->adoptAdminProduct($user, $m[1]);
                return;
            }
            if ($method === 'GET') {
                $this->listSellerProducts($user);
                return;
            }
            if ($method === 'POST') {
                $this->createSellerProduct($user);
                return;
            }
            if ($method === 'PUT' && preg_match('/\/api\/seller\/products\/(\d+)/', $path, $m)) {
                $this->updateSellerProduct($user, $m[1]);
                return;
            }
            if ($method === 'DELETE' && preg_match('/\/api\/seller\/products\/(\d+)/', $path, $m)) {
                $this->deleteSellerProduct($user, $m[1]);
                return;
            }
        }

        if (strpos($path, '/api/admin/products') === 0) {
            $user = $this->auth->authenticate('admin');
            if ($method === 'GET') {
                $this->listAdminProducts($user);
                return;
            }
            if ($method === 'POST') {
                $this->createAdminProduct($user);
                return;
            }
            if ($method === 'PUT' && preg_match('/\/api\/admin\/products\/(\d+)/', $path, $m)) {
                $this->updateAdminProduct($user, $m[1]);
                return;
            }
            if ($method === 'DELETE' && preg_match('/\/api\/admin\/products\/(\d+)/', $path, $m)) {
                $this->deleteAdminProduct($user, $m[1]);
                return;
            }
        }

        if (strpos($path, '/api/admin/categories') === 0) {
            $user = $this->auth->authenticate('admin');
            if ($method === 'GET') {
                $this->listAdminCategories($user);
                return;
            }
            if ($method === 'POST') {
                $this->createAdminCategory($user);
                return;
            }
            if ($method === 'PUT' && preg_match('/\/api\/admin\/categories\/(\d+)/', $path, $m)) {
                $this->updateAdminCategory($user, $m[1]);
                return;
            }
            if ($method === 'DELETE' && preg_match('/\/api\/admin\/categories\/(\d+)/', $path, $m)) {
                $this->deleteAdminCategory($user, $m[1]);
                return;
            }
        }
        
        if ($method === 'GET') {
            if (preg_match('/\/api\/products\/(\d+)/', $requestUri, $matches)) {
                $this->getProduct($matches[1]);
            } elseif (strpos($requestUri, '/api/categories') !== false) {
                $this->getCategories();
            } else {
                $this->getProducts();
            }
        }
    }
}

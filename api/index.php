<?php
// Load environment variables (create a .env file in the api directory)
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim((string)$line);
        if ($line === '' || strpos($line, '#') === 0) {
            continue;
        }

        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);

            $value = (string)$value;
            $value = trim($value);
            $isQuoted = (strlen($value) >= 2) && (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'"));
            if (!$isQuoted) {
                $hashPos = strpos($value, ' #');
                if ($hashPos === false) {
                    $hashPos = strpos($value, "\t#");
                }
                if ($hashPos !== false) {
                    $value = substr($value, 0, $hashPos);
                    $value = rtrim($value);
                }
            }

            $value = trim($value, "'\"");
            putenv("$key=$value");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }
}

// Set CORS headers
$_origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$_allowedOrigin = $_ENV['FRONTEND_URL'] ?? '*';
if ($_allowedOrigin !== '*' && $_origin !== '' && $_origin === $_allowedOrigin) {
    header('Access-Control-Allow-Origin: ' . $_origin);
} else {
    header('Access-Control-Allow-Origin: ' . $_allowedOrigin);
}
header('Content-Type: application/json');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Set error reporting
error_reporting(E_ALL);
ini_set('display_errors', '1');
ini_set('log_errors', '1');

$__debug = false;
$__debugEnv = $_ENV['APP_DEBUG'] ?? ($_SERVER['APP_DEBUG'] ?? null);
if (is_string($__debugEnv)) {
    $__debug = in_array(strtolower(trim($__debugEnv)), ['1', 'true', 'yes', 'on'], true);
}

set_exception_handler(function ($e) {
    error_log('Unhandled exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ]);
    exit;
});

set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }

    error_log("PHP error: {$message} in {$file}:{$line}");

    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }

    echo json_encode([
        'success' => false,
        'error' => $message,
        'file' => $file,
        'line' => $line,
    ]);
    exit;
});

register_shutdown_function(function () {
    $err = error_get_last();
    if (!$err) {
        return;
    }

    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR];
    if (!in_array($err['type'] ?? 0, $fatalTypes, true)) {
        return;
    }

    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }

    $msg = $err['message'] ?? 'Fatal error';
    $file = $err['file'] ?? null;
    $line = $err['line'] ?? null;
    error_log('Fatal error: ' . $msg . ($file ? " in {$file}:{$line}" : ''));

    echo json_encode([
        'success' => false,
        'error' => $msg,
        'file' => $file,
        'line' => $line,
    ]);
});

// Define base path
define('BASE_PATH', __DIR__);

// Get the request URI and method
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Normalize when hosted under a subdirectory (e.g. /myapp/api/auth/login)
$apiPos = strpos($requestUri, '/api/');
if ($apiPos !== false) {
    $requestUri = substr($requestUri, $apiPos);
}

if ($requestUri !== '/') {
    $requestUri = rtrim($requestUri, '/');
    if ($requestUri === '') {
        $requestUri = '/';
    }
}

// Health check endpoint (useful for verifying Apache rewrite / routing)
if ($requestUri === '/api/health') {
    echo json_encode(['success' => true, 'message' => 'API is running']);
    exit;
}

// Route the request
$routes = [
    '/api/auth/register' => ['controller' => 'AuthController', 'method' => 'register', 'http_method' => 'POST', 'endpoint' => 'register'],
    '/api/auth/login' => ['controller' => 'AuthController', 'method' => 'login', 'http_method' => 'POST', 'endpoint' => 'login'],
    '/api/auth/admin-login' => ['controller' => 'AuthController', 'method' => 'adminLogin', 'http_method' => 'POST', 'endpoint' => 'admin-login'],
    '/api/auth/profile' => ['controller' => 'AuthController', 'method' => 'profile', 'http_method' => ['GET', 'PUT'], 'endpoint' => 'profile'],
    '/api/auth/me' => ['controller' => 'AuthController', 'method' => 'me', 'http_method' => 'GET', 'endpoint' => 'me'],
    
    // Chat endpoints
    '/api/conversations' => ['controller' => 'ChatController', 'method' => 'conversations', 'http_method' => ['GET', 'POST']],
    '/api/conversations/{id}' => ['controller' => 'ChatController', 'method' => 'getConversation', 'http_method' => ['GET', 'DELETE']],
    '/api/conversations/{id}/messages' => ['controller' => 'ChatController', 'method' => 'getMessages', 'http_method' => 'GET'],
    '/api/conversations/{id}/status' => ['controller' => 'ChatController', 'method' => 'handleRequest', 'http_method' => 'PUT'],
    '/api/admin/conversations' => ['controller' => 'ChatController', 'method' => 'handleRequest', 'http_method' => 'GET'],
    '/api/messages' => ['controller' => 'ChatController', 'method' => 'sendMessage', 'http_method' => 'POST'],
    '/api/messages/upload' => ['controller' => 'ChatController', 'method' => 'handleRequest', 'http_method' => 'POST'],
    '/api/messages/{id}' => ['controller' => 'ChatController', 'method' => 'handleRequest', 'http_method' => ['PUT', 'DELETE']],
    '/api/messages/{id}/read' => ['controller' => 'ChatController', 'method' => 'markAsRead', 'http_method' => 'POST'],
    
    // Product endpoints
    '/api/products' => ['controller' => 'ProductController', 'method' => 'getProducts', 'http_method' => 'GET'],
    '/api/products/{id}' => ['controller' => 'ProductController', 'method' => 'getProduct', 'http_method' => 'GET'],
    '/api/categories' => ['controller' => 'ProductController', 'method' => 'getCategories', 'http_method' => 'GET'],

    // Seller product management
    '/api/seller/products' => ['controller' => 'ProductController', 'method' => 'handleRequest', 'http_method' => ['GET', 'POST']],
    '/api/seller/products/{id}' => ['controller' => 'ProductController', 'method' => 'handleRequest', 'http_method' => ['PUT', 'DELETE']],
    
    // Order endpoints
    '/api/orders' => ['controller' => 'OrderController', 'method' => 'getCustomerOrders', 'http_method' => ['GET', 'POST']],
    '/api/orders/stats' => ['controller' => 'OrderController', 'method' => 'getOrderStats', 'http_method' => 'GET'],

    // Wishlist endpoints
    '/api/wishlist' => ['controller' => 'WishlistController', 'method' => 'getWishlist', 'http_method' => ['GET']],
    '/api/wishlist/add' => ['controller' => 'WishlistController', 'method' => 'addToWishlist', 'http_method' => 'POST'],
    '/api/wishlist/{id}' => ['controller' => 'WishlistController', 'method' => 'removeFromWishlist', 'http_method' => 'DELETE'],
    '/api/wishlist/{id}/check' => ['controller' => 'WishlistController', 'method' => 'checkWishlist', 'http_method' => 'GET'],

    // Cart endpoints
    '/api/cart' => ['controller' => 'CartController', 'method' => 'handleRequest', 'http_method' => ['GET', 'POST', 'DELETE']],
    '/api/cart/{id}' => ['controller' => 'CartController', 'method' => 'handleRequest', 'http_method' => ['PUT', 'DELETE']],

    // Seller order management
    '/api/seller/orders' => ['controller' => 'OrderController', 'method' => 'handleRequest', 'http_method' => 'GET'],
    '/api/seller/orders/{id}/status' => ['controller' => 'OrderController', 'method' => 'handleRequest', 'http_method' => 'PUT'],

    // Seller withdrawals
    '/api/seller/wallet' => ['controller' => 'WalletController', 'method' => 'handleRequest', 'http_method' => 'GET'],
    '/api/seller/withdrawals' => ['controller' => 'WithdrawalController', 'method' => 'handleRequest', 'http_method' => ['GET', 'POST']],

    // Admin product/order/category/vendor management
    '/api/admin/products' => ['controller' => 'ProductController', 'method' => 'handleRequest', 'http_method' => ['GET', 'POST']],
    '/api/admin/products/{id}' => ['controller' => 'ProductController', 'method' => 'handleRequest', 'http_method' => ['PUT', 'DELETE']],
    '/api/admin/categories' => ['controller' => 'ProductController', 'method' => 'handleRequest', 'http_method' => ['GET', 'POST']],
    '/api/admin/categories/{id}' => ['controller' => 'ProductController', 'method' => 'handleRequest', 'http_method' => ['PUT', 'DELETE']],
    '/api/admin/orders' => ['controller' => 'OrderController', 'method' => 'handleRequest', 'http_method' => 'GET'],
    '/api/admin/orders/{id}/status' => ['controller' => 'OrderController', 'method' => 'handleRequest', 'http_method' => 'PUT'],
    '/api/admin/vendors' => ['controller' => 'AdminController', 'method' => 'handleRequest', 'http_method' => 'GET'],
    '/api/admin/vendors/{id}/status' => ['controller' => 'AdminController', 'method' => 'handleRequest', 'http_method' => 'PUT'],

    // Admin roles & permissions management
    '/api/admin/roles' => ['controller' => 'AdminController', 'method' => 'handleRoles', 'http_method' => ['GET', 'POST']],
    '/api/admin/roles/{id}' => ['controller' => 'AdminController', 'method' => 'handleRoles', 'http_method' => ['PUT', 'DELETE']],
    '/api/admin/permissions' => ['controller' => 'AdminController', 'method' => 'handlePermissions', 'http_method' => 'GET'],
    '/api/admin/staff' => ['controller' => 'AdminController', 'method' => 'handleStaff', 'http_method' => ['GET', 'POST']],
    '/api/admin/staff/{id}' => ['controller' => 'AdminController', 'method' => 'handleStaff', 'http_method' => ['PUT', 'DELETE']],

    // Admin withdrawal management
    '/api/admin/withdrawals' => ['controller' => 'WithdrawalController', 'method' => 'handleRequest', 'http_method' => 'GET'],
    '/api/admin/withdrawals/{id}/decision' => ['controller' => 'WithdrawalController', 'method' => 'handleRequest', 'http_method' => 'PUT'],

    // Admin wallet management
    '/api/admin/wallet/sellers' => ['controller' => 'WalletController', 'method' => 'handleRequest', 'http_method' => 'GET'],
    '/api/admin/wallet/seller/{id}' => ['controller' => 'WalletController', 'method' => 'handleRequest', 'http_method' => 'GET'],
    '/api/admin/wallet/action' => ['controller' => 'WalletController', 'method' => 'handleRequest', 'http_method' => 'POST'],

    // Admin advanced: earnings, deposits, subscribers
    '/api/admin/earnings' => ['controller' => 'AdminController', 'method' => 'handleRequest', 'http_method' => 'GET'],
    '/api/admin/deposits' => ['controller' => 'AdminController', 'method' => 'handleRequest', 'http_method' => ['GET', 'POST']],
    '/api/admin/deposits/{id}/approve' => ['controller' => 'AdminController', 'method' => 'handleRequest', 'http_method' => 'PUT'],
    '/api/admin/subscribers' => ['controller' => 'AdminController', 'method' => 'handleRequest', 'http_method' => ['GET', 'POST']],
    '/api/admin/subscribers/{id}' => ['controller' => 'AdminController', 'method' => 'handleRequest', 'http_method' => ['PUT', 'DELETE']],
    
    // Admin endpoints
    '/api/admin/dashboard/stats' => ['controller' => 'AdminController', 'method' => 'getDashboardStats', 'http_method' => 'GET'],
    '/api/admin/orders/recent' => ['controller' => 'AdminController', 'method' => 'getRecentOrders', 'http_method' => 'GET'],
    '/api/admin/accounts/frozen' => ['controller' => 'AdminController', 'method' => 'getFrozenAccounts', 'http_method' => 'GET'],
    '/api/admin/users' => ['controller' => 'AdminController', 'method' => 'getUsers', 'http_method' => 'GET'],
    '/api/admin/users/status' => ['controller' => 'AdminController', 'method' => 'updateUserStatus', 'http_method' => 'PUT'],

    // Admin promo code management (seller store creation incentive)
    '/api/admin/promo-codes' => ['controller' => 'PromoCodeController', 'method' => 'handleRequest', 'http_method' => ['GET', 'POST']],
    '/api/admin/promo-codes/{id}' => ['controller' => 'PromoCodeController', 'method' => 'handleRequest', 'http_method' => ['PUT', 'DELETE']],
    
    // Users endpoint for finding users to chat with
    '/api/users' => ['controller' => 'UserController', 'method' => 'getUsers', 'http_method' => 'GET'],
    
    // Settings endpoints
    '/api/settings' => ['controller' => 'SettingsController', 'method' => 'getSettings', 'http_method' => 'GET'],
    '/api/settings/update' => ['controller' => 'SettingsController', 'method' => 'updateSettings', 'http_method' => 'POST'],
    '/api/settings/upload' => ['controller' => 'SettingsController', 'method' => 'uploadAsset', 'http_method' => 'POST'],

];

// Handle static files in uploads directory
if (preg_match('#^/(?:api/)?uploads/(.+)$#', $requestUri, $matches)) {
    $filePath = __DIR__ . '/uploads/' . $matches[1];
    if (file_exists($filePath) && is_file($filePath)) {
        $mime = mime_content_type($filePath);
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($filePath));
        header('Cache-Control: public, max-age=31536000');
        readfile($filePath);
        exit;
    }
}

// Find matching route
$matchedRoute = null;
$routeParams = [];
$methodNotAllowed = false;
$allowedMethods = [];
foreach ($routes as $route => $config) {
    // Support placeholders like /api/products/{id}
    if (strpos($route, '{') !== false) {
        $paramNames = [];
        $pattern = preg_replace_callback('/\{([^\/]+)\}/', function ($m) use (&$paramNames) {
            $paramNames[] = $m[1];
            return '(\\d+)';
        }, $route);
        $regex = '#^' . $pattern . '$#';
        if (preg_match($regex, $requestUri, $matches)) {
            $pathMatched = true;
            array_shift($matches); // remove full match
            foreach ($paramNames as $i => $name) {
                $routeParams[$name] = $matches[$i] ?? null;
            }
        } else {
            $pathMatched = false;
        }
    } else {
        $pathMatched = ($requestUri === $route);
    }

    if (!$pathMatched) {
        continue;
    }

    $httpMethods = (array) $config['http_method'];
    $allowedMethods = array_values(array_unique(array_merge($allowedMethods, $httpMethods)));
    if (!in_array($requestMethod, $httpMethods, true)) {
        $methodNotAllowed = true;
        continue;
    }

    $matchedRoute = $config;
    break;
}

// Handle 404 if no route matched
if (!$matchedRoute) {
    if ($methodNotAllowed) {
        http_response_code(405);
        if (!empty($allowedMethods)) {
            header('Allow: ' . implode(', ', $allowedMethods));
        }
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        exit;
    }

    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Endpoint not found']);
    exit;
}

// Load Composer autoloader (for JWT library, etc.)
$autoloadFile = __DIR__ . '/vendor/autoload.php';
if (file_exists($autoloadFile)) {
    require_once $autoloadFile;
}

// Include the controller file
$controllerFile = __DIR__ . '/controllers/' . $matchedRoute['controller'] . '.php';
if (!file_exists($controllerFile)) {
    header('HTTP/1.1 500 Internal Server Error');
    echo json_encode(['error' => 'Internal server error']);
    exit;
}

require_once $controllerFile;

// Create controller instance and call the method
$controllerName = $matchedRoute['controller'];
$methodName = $matchedRoute['method'];

$controller = new $controllerName();

if (method_exists($controller, $methodName) && is_callable([$controller, $methodName])) {
    $ref = new ReflectionMethod($controller, $methodName);
    $params = $ref->getParameters();
    $args = [];
    foreach ($params as $param) {
        $name = $param->getName();
        $args[] = $routeParams[$name] ?? null;
    }
    $ref->invokeArgs($controller, $args);
    exit;
}

if (method_exists($controller, 'handleRequest')) {
    $controller->handleRequest();
    exit;
}

http_response_code(500);
echo json_encode(['success' => false, 'error' => 'Method not implemented']);

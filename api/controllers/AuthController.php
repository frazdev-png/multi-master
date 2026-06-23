<?php
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class AuthController {
    private $userModel;
    private $auth;

    public function __construct() {
        $this->userModel = new User();
        $this->auth = new AuthMiddleware();

        $headers = function_exists('headers_list') ? headers_list() : [];
        $hasCors = false;
        if (is_array($headers)) {
            foreach ($headers as $h) {
                if (stripos((string)$h, 'Access-Control-Allow-Origin:') === 0) {
                    $hasCors = true;
                    break;
                }
            }
        }

        if (!$hasCors) {
            $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
            $allowedOrigin = $_ENV['FRONTEND_URL'] ?? '*';
            if ($allowedOrigin !== '*' && $origin !== '' && $origin === $allowedOrigin) {
                header('Access-Control-Allow-Origin: ' . $origin);
            } else {
                header('Access-Control-Allow-Origin: ' . $allowedOrigin);
            }
            header('Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        }

        header('Content-Type: application/json');

        // Handle preflight requests
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit();
        }
    }

    // Handle incoming requests
    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $endpoint = isset($_GET['endpoint']) ? $_GET['endpoint'] : '';
        if ($endpoint === '') {
            $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
            $path = is_string($path) ? rtrim($path, '/') : '';
            if ($path !== '') {
                $pos = strpos($path, '/api/auth/');
                if ($pos !== false) {
                    $endpoint = substr($path, $pos + strlen('/api/auth/'));
                }
            }
        }
        
        try {
            switch ($endpoint) {
                case 'register':
                    if ($method === 'POST') {
                        $this->register();
                    } else {
                        $this->methodNotAllowed();
                    }
                    break;
                    
                case 'login':
                    if ($method === 'POST') {
                        $this->login();
                    } else {
                        $this->methodNotAllowed();
                    }
                    break;
                    
                case 'admin-login':
                    if ($method === 'POST') {
                        $this->adminLogin();
                    } else {
                        $this->methodNotAllowed();
                    }
                    break;
                    
                case 'profile':
                    $user = $this->auth->authenticate(); // Requires authentication
                    
                    if ($method === 'GET') {
                        $this->getProfile($user);
                    } elseif ($method === 'PUT') {
                        $this->updateProfile($user);
                    } else {
                        $this->methodNotAllowed();
                    }
                    break;
                    
                case 'me':
                    if ($method === 'GET') {
                        $this->me();
                    } else {
                        $this->methodNotAllowed();
                    }
                    break;
                    
                default:
                    $this->notFound();
                    break;
            }
        } catch (Exception $e) {
            $msg = $e->getMessage();
            $status = 400;
            if (stripos($msg, 'invalid email or password') !== false) {
                $status = 401;
            }
            $this->sendError($msg, $status);
        }
    }

    // Register a new user
    public function register() {
        $data = $this->getRequestData();
        
        // Normalize camelCase field names from FormData to snake_case for PHP
        $camelToSnake = [
            'fullName' => 'full_name',
            'storeName' => 'store_name',
            'mobileNumber' => 'phone',
            'promoCode' => 'promo_code',
            'documentType' => 'document_type',
        ];
        foreach ($camelToSnake as $camel => $snake) {
            if (isset($data[$camel]) && !isset($data[$snake])) {
                $data[$snake] = $data[$camel];
            }
        }
        // Map username -> cnic_number if cnic_number not provided directly
        if (isset($data['username']) && !isset($data['cnic_number'])) {
            $data['cnic_number'] = $data['username'];
        }
        // Map storeName -> business_name if business_name not provided
        if (isset($data['storeName']) && !isset($data['business_name'])) {
            $data['business_name'] = $data['storeName'];
        }
        
        // Validate required fields
        $requiredFields = ['email', 'password', 'role', 'full_name'];
        $this->validateFields($data, $requiredFields);
        
        // Additional validation for seller registration
        if ($data['role'] === 'seller') {
            $requiredSellerFields = ['business_name', 'store_name', 'cnic_number'];
            $this->validateFields($data, $requiredSellerFields);
            
            // Extract seller data
            $sellerData = [
                'business_name' => $data['business_name'],
                'store_name' => $data['store_name'],
                'cnic_number' => $data['cnic_number'],
                'tax_number' => $data['tax_number'] ?? null,
                'store_address' => $data['store_address'] ?? null,
                'bank_name' => $data['bank_name'] ?? null,
                'account_number' => $data['account_number'] ?? null,
                'account_holder_name' => $data['account_holder_name'] ?? null,
                'cnic_document_url' => $data['cnic_document_url'] ?? null,
                'document_type' => $data['document_type'] ?? 'identity-card',
                'id_front_image_url' => $data['id_front_image_url'] ?? null,
                'id_back_image_url' => $data['id_back_image_url'] ?? null
            ];

            // Handle file uploads from multipart form data
            $uploadDir = __DIR__ . '/../uploads/settings';
            if (!is_dir($uploadDir)) {
                @mkdir($uploadDir, 0775, true);
            }

            foreach (['idFrontImage', 'idBackImage', 'passportImage'] as $field) {
                if (isset($_FILES[$field]) && $_FILES[$field]['error'] === UPLOAD_ERR_OK) {
                    $file = $_FILES[$field];
                    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
                    if (!$ext) $ext = 'png';
                    $allowedExt = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'ico', 'pdf'];
                    if (in_array($ext, $allowedExt, true)) {
                        $unique = bin2hex(random_bytes(8));
                        $filename = 'doc_' . $unique . '.' . $ext;
                        $targetPath = $uploadDir . '/' . $filename;
                        if (move_uploaded_file($file['tmp_name'], $targetPath)) {
                            $url = '/uploads/settings/' . $filename;
                            if ($field === 'idFrontImage' || $field === 'passportImage') {
                                $sellerData['id_front_image_url'] = $url;
                            } elseif ($field === 'idBackImage') {
                                $sellerData['id_back_image_url'] = $url;
                            }
                        }
                    }
                }
            }
            
            $data['seller_data'] = $sellerData;
        }
        
        // Create user
        try {
            $userId = $this->userModel->register($data);
        } catch (Exception $e) {
            $msg = $e->getMessage();
            $status = 400;
            if (stripos($msg, 'already exists') !== false) {
                $status = 409;
            }
            $this->sendError($msg, $status);
        }
        
        // Get the created user
        $user = $this->userModel->getUserWithRoleData($userId);
        
        // Generate JWT token
        $token = AuthMiddleware::generateToken($userId, $data['role'], 1);
        
        // Return success response
        $this->sendResponse([
            'success' => true,
            'message' => 'User registered successfully',
            'user' => $user,
            'token' => $token
        ]);
    }

    // Admin login
    public function adminLogin() {
        $data = $this->getRequestData();
        
        // Validate required fields
        $this->validateFields($data, ['email', 'password']);
        
        // Authenticate admin user
        $user = $this->userModel->authenticateAdmin($data['email'], $data['password']);
        
        if (!$user) {
            $this->sendError('Invalid admin credentials', 401);
        }
        
        // Generate JWT token
        $token = AuthMiddleware::generateToken($user['id'], $user['role'], isset($user['token_version']) ? (int)$user['token_version'] : 1);
        
        // Get full user data with role-specific information
        $userData = $this->userModel->getUserWithRoleData($user['id']);
        
        // Return success response
        $this->sendResponse([
            'success' => true,
            'message' => 'Admin login successful',
            'user' => $userData,
            'token' => $token
        ]);
    }

    // User login
    public function login() {
        $data = $this->getRequestData();
        
        // Validate required fields
        $this->validateFields($data, ['email', 'password']);
        
        // Authenticate user
        $user = $this->userModel->authenticate($data['email'], $data['password']);
        
        if (!$user) {
            $this->sendError('Invalid email or password', 401);
        }

        if (isset($user['is_active']) && (int)$user['is_active'] === 0) {
            $this->sendError('Your account has been suspended. Please contact admin.', 403);
        }
        
        // Generate JWT token
        $token = AuthMiddleware::generateToken($user['id'], $user['role'], isset($user['token_version']) ? (int)$user['token_version'] : 1);
        
        // Get full user data with role-specific information
        $userData = $this->userModel->getUserWithRoleData($user['id']);
        
        // Return success response
        $this->sendResponse([
            'success' => true,
            'message' => 'Login successful',
            'user' => $userData,
            'token' => $token
        ]);
    }

    public function profile() {
        $method = $_SERVER['REQUEST_METHOD'];
        $user = $this->auth->authenticate();

        if ($method === 'GET') {
            $this->getProfile($user);
        } elseif ($method === 'PUT') {
            $this->updateProfile($user);
        } else {
            $this->methodNotAllowed();
        }
    }

    // Get user profile
    private function getProfile($user) {
        // User is already authenticated and passed from the middleware
        $this->sendResponse([
            'success' => true,
            'user' => $user
        ]);
    }

    // Update user profile
    private function updateProfile($user) {
        $data = $this->getRequestData();
        
        // Update the user profile
        $this->userModel->updateProfile($user['id'], $data);
        
        // Get updated user data
        $updatedUser = $this->userModel->getUserWithRoleData($user['id']);
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Profile updated successfully',
            'user' => $updatedUser
        ]);
    }

    // Get current user info (for JWT validation)
    public function me() {
        $user = $this->auth->authenticate();
        $userData = $this->userModel->getUserWithRoleData($user['id']);
        
        $this->sendResponse([
            'success' => true,
            'user' => $userData
        ]);
    }

    // Get JSON input from request
    private function getRequestData() {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '');

        // Prefer JSON when declared.
        if (stripos((string)$contentType, 'application/json') !== false) {
            $raw = file_get_contents('php://input');
            $raw = is_string($raw) ? trim($raw) : '';

            // Strip UTF-8 BOM if present.
            if (strncmp($raw, "\xEF\xBB\xBF", 3) === 0) {
                $raw = substr($raw, 3);
                $raw = trim($raw);
            }

            // Windows curl/Powershell users often wrap JSON in single quotes; accept it.
            if (strlen($raw) >= 2 && $raw[0] === "'" && substr($raw, -1) === "'") {
                $raw = substr($raw, 1, -1);
                $raw = trim($raw);
            }

            if ($raw === '') {
                return [];
            }

            // Debug: log raw input
            error_log('DEBUG getRequestData raw: ' . $raw);

            $data = json_decode($raw, true);
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
                error_log('DEBUG json_decode error: ' . json_last_error_msg() . ' for raw: ' . $raw);
                // Some Windows shells send JSON with literal backslashes (e.g. {\"email\":...}).
                // Try to unescape and decode again.
                $raw2 = str_replace('\\"', '"', $raw);
                $raw2 = str_replace('\\\'', "'", $raw2);
                $raw2 = str_replace('\\\\', '\\', $raw2);
                $data2 = json_decode($raw2, true);
                if (json_last_error() !== JSON_ERROR_NONE || !is_array($data2)) {
                    throw new Exception('Invalid JSON data. Raw: ' . substr($raw, 0, 200));
                }
                $data = $data2;
            }

            return $data;
        }

        // Fallback: handle form submissions.
        if (!empty($_POST) && is_array($_POST)) {
            return $_POST;
        }

        $raw = file_get_contents('php://input');
        $raw = is_string($raw) ? trim($raw) : '';
        if ($raw === '') {
            return [];
        }

        $data = [];
        parse_str($raw, $data);
        return is_array($data) ? $data : [];
    }

    // Validate required fields
    private function validateFields($data, $requiredFields) {
        foreach ($requiredFields as $field) {
            if (empty($data[$field])) {
                throw new Exception("$field is required");
            }
        }
    }

    // Send JSON response
    private function sendResponse($data, $statusCode = 200) {
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }

    // Send error response
    private function sendError($message, $statusCode = 400) {
        $this->sendResponse([
            'success' => false,
            'error' => $message
        ], $statusCode);
    }

    // 404 Not Found
    private function notFound() {
        $this->sendError('Endpoint not found', 404);
    }

    // 405 Method Not Allowed
    private function methodNotAllowed() {
        $this->sendError('Method not allowed', 405);
    }
}

?>

<?php
require_once __DIR__ . '/../models/User.php';

class AuthMiddleware {
    private $userModel;

    public function __construct() {
        $this->userModel = new User();
    }

    private function normalizeRole($role) {
        $r = strtolower(trim((string)$role));
        if ($r === 'vendor') return 'seller';
        if ($r === 'administrator') return 'admin';
        return $r;
    }

    // Authenticate user using JWT token
    public function authenticate($requiredRole = null) {
        $headers = getallheaders();
        $token = $this->getBearerToken($headers);
        
        if (!$token) {
            $this->sendUnauthorized('Access denied. No token provided.');
        }

        try {
            $user = $this->validateToken($token);
            
            // If role is specified, check if user has required role
            if ($requiredRole) {
                $userRole = $this->normalizeRole($user['role'] ?? '');
                $needRole = $this->normalizeRole($requiredRole);
                if ($userRole !== $needRole) {
                    $this->sendForbidden('Insufficient permissions');
                }
            }
            
            return $user;
            
        } catch (Exception $e) {
            $this->sendUnauthorized($e->getMessage());
        }
    }

    // Get bearer token from headers
    private function getBearerToken($headers) {
        $authHeader = null;
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

        if ($authHeader) {
            if (preg_match('/Bearer\s(\S+)/', (string)$authHeader, $matches)) {
                return $matches[1];
            }
        }
        
        // Check for access_token in query string (for WebSocket connections)
        if (isset($_GET['access_token'])) {
            return $_GET['access_token'];
        }
        
        return null;
    }

    // Validate JWT token
    private function validateToken($token) {
        $secretKey = $_ENV['JWT_SECRET'] ?? '';
        $secretKeyTrim = is_string($secretKey) ? trim($secretKey) : '';
        if ($secretKeyTrim === '' || $secretKeyTrim === 'your-secret-key' || stripos($secretKeyTrim, 'change-this-in-production') !== false) {
            throw new Exception('Server JWT configuration error');
        }

        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new Exception('Invalid token format');
        }

        $headerJson = $this->base64UrlDecode($parts[0]);
        $payloadJson = $this->base64UrlDecode($parts[1]);
        $signature = $this->base64UrlDecode($parts[2]);

        $header = json_decode($headerJson, true);
        $payload = json_decode($payloadJson, true);

        if (!is_array($header) || !is_array($payload)) {
            throw new Exception('Invalid token payload');
        }

        if (($header['alg'] ?? '') !== 'HS256') {
            throw new Exception('Unsupported token algorithm');
        }

        $signingInput = $parts[0] . '.' . $parts[1];
        $expected = hash_hmac('sha256', $signingInput, $secretKey, true);
        if (!hash_equals($expected, $signature)) {
            throw new Exception('Invalid token signature');
        }

        $exp = isset($payload['exp']) ? (int)$payload['exp'] : 0;
        if ($exp > 0 && time() >= $exp) {
            throw new Exception('Token expired');
        }

        $userId = isset($payload['sub']) ? (int)$payload['sub'] : 0;
        if ($userId <= 0) {
            throw new Exception('Invalid token subject');
        }

        $user = $this->userModel->getUserWithRoleData($userId);
        if (!$user) {
            throw new Exception('Invalid user');
        }

        return $user;
    }

    // Generate JWT token
    public static function generateToken($userId, $role) {
        $secretKey = $_ENV['JWT_SECRET'] ?? '';
        $secretKeyTrim = is_string($secretKey) ? trim($secretKey) : '';
        if ($secretKeyTrim === '' || $secretKeyTrim === 'your-secret-key' || stripos($secretKeyTrim, 'change-this-in-production') !== false) {
            throw new Exception('Server JWT configuration error');
        }
        $issuedAt = time();

        $ttl = $_ENV['JWT_EXPIRE'] ?? null;
        $ttlInt = is_numeric($ttl) ? (int)$ttl : 0;
        if ($ttlInt <= 0) {
            $ttlInt = (60 * 60 * 24 * 7);
        }
        $expire = $issuedAt + $ttlInt;
        
        $payload = [
            'iss' => 'multi-vendor-chat',
            'iat' => $issuedAt,
            'exp' => $expire,
            'sub' => $userId,
            'role' => $role
        ];
        
        $header = [
            'typ' => 'JWT',
            'alg' => 'HS256'
        ];

        $headerEncoded = self::base64UrlEncode(json_encode($header));
        $payloadEncoded = self::base64UrlEncode(json_encode($payload));
        $signingInput = $headerEncoded . '.' . $payloadEncoded;
        $signature = hash_hmac('sha256', $signingInput, $secretKey, true);
        $signatureEncoded = self::base64UrlEncode($signature);

        return $signingInput . '.' . $signatureEncoded;
    }

    private static function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode($data) {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        $decoded = base64_decode(strtr($data, '-_', '+/'), true);
        if ($decoded === false) {
            throw new Exception('Invalid base64 token segment');
        }
        return $decoded;
    }

    // Send unauthorized response
    private function sendUnauthorized($message = 'Unauthorized') {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => $message]);
        exit;
    }

    // Send forbidden response
    private function sendForbidden($message = 'Forbidden') {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => $message]);
        exit;
    }
}
?>

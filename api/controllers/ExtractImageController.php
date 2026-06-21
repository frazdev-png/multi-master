<?php
require_once __DIR__ . '/../config/Database.php';

class ExtractImageController {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
            return;
        }

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        $url = trim($data['url'] ?? '');

        if ($url === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'URL is required']);
            return;
        }

        $parsed = parse_url($url);
        if (!isset($parsed['scheme'], $parsed['host'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid URL format']);
            return;
        }

        $scheme = strtolower($parsed['scheme']);
        if (!in_array($scheme, ['http', 'https'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'URL must start with http:// or https://']);
            return;
        }

        if (preg_match('/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i', $parsed['path'] ?? '')) {
            http_response_code(200);
            echo json_encode(['success' => true, 'image_url' => $url, 'source' => 'direct']);
            return;
        }

        if (preg_match('/^https?:\/\/(?:.*\.)?(?:i\.)?(?:imgur|unsplash|cloudinary|shopify)\.com\//i', $url)) {
            http_response_code(200);
            echo json_encode(['success' => true, 'image_url' => $url, 'source' => 'direct']);
            return;
        }

        $imageUrl = $this->extractOgImage($url);
        if ($imageUrl) {
            http_response_code(200);
            echo json_encode(['success' => true, 'image_url' => $imageUrl, 'source' => 'opengraph']);
            return;
        }

        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Unable to find a product image from this page. Please provide a direct image URL or upload an image.']);
    }

    private function extractOgImage($url) {
        $html = $this->fetchUrl($url);
        if (!$html) return null;

        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML($html, LIBXML_NOWARNING | LIBXML_NOERROR);
        libxml_clear_errors();

        $xpath = new DOMXPath($dom);

        $queries = [
            "//meta[@property='og:image']/@content",
            "//meta[@name='twitter:image']/@content",
            "//meta[@name='twitter:image:src']/@content",
            "//meta[@property='og:image:secure_url']/@content",
            "//meta[@itemprop='image']/@content",
            "//link[@rel='image_src']/@href",
        ];

        foreach ($queries as $query) {
            $nodes = $xpath->query($query);
            if ($nodes && $nodes->length > 0) {
                $value = trim($nodes->item(0)->nodeValue ?? '');
                if ($value !== '') {
                    return $this->resolveUrl($url, $value);
                }
            }
        }

        $imgs = $xpath->query("//img[starts-with(@class, 'product') or contains(@class, 'main-image') or contains(@class, 'featured-image') or contains(@id, 'main-img')]");
        if ($imgs && $imgs->length > 0) {
            foreach ($imgs as $img) {
                $src = trim($img->getAttribute('src') ?: $img->getAttribute('data-src') ?: '');
                if ($src !== '') {
                    return $this->resolveUrl($url, $src);
                }
            }
        }

        $imgs = $xpath->query("//img[contains(@class, 'zoom') or contains(@class, 'gallery') or ancestor::div[contains(@class, 'product-image') or contains(@class, 'gallery')]]");
        if ($imgs && $imgs->length > 0) {
            foreach ($imgs as $img) {
                $src = trim($img->getAttribute('src') ?: $img->getAttribute('data-src') ?: '');
                if ($src !== '') {
                    return $this->resolveUrl($url, $src);
                }
            }
        }

        $imgs = $xpath->query("//img");
        if ($imgs && $imgs->length > 0) {
            $best = null;
            $bestArea = 0;
            foreach ($imgs as $img) {
                $src = trim($img->getAttribute('src') ?: $img->getAttribute('data-src') ?: '');
                if ($src === '') continue;
                $w = (int)$img->getAttribute('width') ?: 0;
                $h = (int)$img->getAttribute('height') ?: 0;
                $area = $w * $h;
                if ($area > $bestArea) {
                    $bestArea = $area;
                    $best = $src;
                }
            }
            if ($best) {
                $resolved = $this->resolveUrl($url, $best);
                if (preg_match('/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i', $resolved)) {
                    return $resolved;
                }
            }
        }

        return null;
    }

    private function fetchUrl($url) {
        $ctx = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\n",
                'timeout' => 15,
                'follow_location' => true,
                'max_redirects' => 5,
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
            ],
        ]);

        $html = @file_get_contents($url, false, $ctx);
        return $html !== false ? $html : null;
    }

    private function resolveUrl($baseUrl, $maybeRelative) {
        $maybeRelative = trim($maybeRelative);
        if ($maybeRelative === '') return '';

        if (preg_match('/^https?:\/\//i', $maybeRelative)) return $maybeRelative;
        if (strpos($maybeRelative, '//') === 0) return 'https:' . $maybeRelative;

        $parsed = parse_url($baseUrl);
        $scheme = $parsed['scheme'] ?? 'https';
        $host = $parsed['host'] ?? '';
        $port = isset($parsed['port']) ? ':' . $parsed['port'] : '';
        $base = $scheme . '://' . $host . $port;

        if (strpos($maybeRelative, '/') === 0) return $base . $maybeRelative;

        $path = $parsed['path'] ?? '/';
        $path = substr($path, 0, strrpos($path, '/') + 1);
        return $base . $path . $maybeRelative;
    }
}

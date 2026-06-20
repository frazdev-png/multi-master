<?php
// Simple debug endpoint - check what's happening
$requestUri = $_SERVER['REQUEST_URI'];
$method = $_SERVER['REQUEST_METHOD'];
$contentType = $_SERVER['CONTENT_TYPE'] ?? 'none';
$rawInput = file_get_contents('php://input');

header('Content-Type: application/json');

$debug = [
    'uri' => $requestUri,
    'method' => $method,
    'content_type' => $contentType,
    'raw_input' => $rawInput,
    'get_data' => $_GET,
    'post_data' => $_POST,
    'script_name' => $_SERVER['SCRIPT_NAME'] ?? 'none',
];

echo json_encode($debug, JSON_PRETTY_PRINT);

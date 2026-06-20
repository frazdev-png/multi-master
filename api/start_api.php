<?php
/**
 * API Server Startup Script
 * Run this command to start the API server:
 * php -S localhost:8000 start_api.php
 */

// Route all requests to index.php
$requestUri = $_SERVER['REQUEST_URI'];
$scriptName = $_SERVER['SCRIPT_NAME'];

// Remove the script name from the request URI
if (strpos($requestUri, $scriptName) === 0) {
    $requestUri = substr($requestUri, strlen($scriptName));
}

// Forward to index.php
$_SERVER['REQUEST_URI'] = $requestUri;
$_SERVER['SCRIPT_NAME'] = '/index.php';

// Include and execute the main index.php
include __DIR__ . '/index.php';

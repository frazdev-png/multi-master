<?php
/**
 * WebSocket Server Startup Script
 * Run this command to start the WebSocket server:
 * php start_websocket.php
 */

if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require_once __DIR__ . '/vendor/autoload.php';
} else {
    fwrite(STDERR, "Missing Composer dependencies. Run: composer install (inside api/)\n");
    exit(1);
}

// Load environment variables
if (class_exists('Dotenv\\Dotenv')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->load();
}

// Include the WebSocket server
require_once __DIR__ . '/websocket_server.php';

echo "Starting WebSocket server...\n";
echo "WebSocket URL: ws://localhost:" . ($_ENV['WEBSOCKET_PORT'] ?? '8080') . "\n";
echo "Press Ctrl+C to stop the server\n";
echo "---\n";

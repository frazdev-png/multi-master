@echo off
echo Starting Multi-Vendor Real-Time Chat System
echo ==========================================
echo.

echo [1/4] Installing PHP dependencies...
cd api
composer install
if errorlevel 1 (
    echo ERROR: Failed to install PHP dependencies
    pause
    exit /b 1
)
echo PHP dependencies installed successfully
echo.

echo [2/4] Installing Node.js dependencies...
cd ..
npm install
if errorlevel 1 (
    echo ERROR: Failed to install Node.js dependencies
    pause
    exit /b 1
)
echo Node.js dependencies installed successfully
echo.

echo [3/4] Starting API Server on port 8000...
start "API Server" cmd /k "cd api && php -S 127.0.0.1:8000 start_api.php"
timeout /t 2 >nul
echo API Server started
echo.

echo [4/4] Starting WebSocket Server on port 8080...
start "WebSocket Server" cmd /k "cd api && php start_websocket.php"
timeout /t 2 >nul
echo WebSocket Server started
echo.

echo Starting React Frontend on port 3000...
echo.
echo ==========================================
echo SYSTEM READY!
echo.
echo Open your browser and go to: http://localhost:3000
echo.
echo Default Admin Account:
echo Email: admin@example.com
echo Password: admin123
echo.
echo Press Ctrl+C in each server window to stop the servers
echo ==========================================
echo.

npm start

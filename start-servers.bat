@echo off
echo Starting Multi-Vendor E-commerce System...
echo =====================================

echo.
echo [1/3] Installing PHP dependencies...
cd api
if not exist vendor (
    composer install
) else (
    echo Dependencies already installed.
)

cd ..

echo.
echo [2/3] Starting PHP Development Server...
start "PHP Server" cmd /k "cd api && php -S localhost:8000"

echo.
echo [3/3] Starting WebSocket Server...
start "WebSocket Server" cmd /k "cd api && php websocket_server.php"

echo.
echo =====================================
echo Servers are running:
echo - Frontend: http://localhost:3000
echo - API: http://localhost:8000
echo - WebSocket: ws://localhost:8080
echo.
echo Press any key to stop all servers...
pause > nul

taskkill /F /IM php.exe > nul 2>&1
taskkill /F /IM cmd.exe /T /FI "WINDOWTITLE eq PHP Server*" > nul 2>&1
taskkill /F /IM cmd.exe /T /FI "WINDOWTITLE eq WebSocket Server*" > nul 2>&1

echo All servers have been stopped.

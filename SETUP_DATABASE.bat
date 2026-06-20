@echo off
echo Setting up Multi-Vendor E-Commerce Database
echo ============================================
echo.

echo Make sure XAMPP MySQL server is running!
echo.

echo Option 1: If MySQL has no password for root:
echo C:\xampp\mysql\bin\mysql.exe -u root < database\schema.sql
echo.

echo Option 2: If MySQL has password for root:
echo C:\xampp\mysql\bin\mysql.exe -u root -p < database\schema.sql
echo.

echo Option 3: Copy and paste this command in terminal:
echo cd /d "%~dp0"
echo C:\xampp\mysql\bin\mysql.exe -u root < database\schema.sql
echo.

pause

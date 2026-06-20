@echo off
echo Setting up Multi-Vendor E-commerce Database...
echo ===========================================

echo.
echo [1/3] Checking MySQL service status...
sc query MySQL80 | find "RUNNING" > nul
if %ERRORLEVEL% NEQ 0 (
    echo MySQL service is not running. Starting MySQL...
    net start MySQL80
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to start MySQL service. Please start it manually and try again.
        pause
        exit /b 1
    )
) else (
    echo MySQL service is already running.
)

echo.
echo [2/3] Creating database and importing schema...
mysql -u root -e "CREATE DATABASE IF NOT EXISTS multi_vendor_system;"
if %ERRORLEVEL% NEQ 0 (
    echo Failed to create database. Please check your MySQL credentials.
    pause
    exit /b 1
)

mysql -u root multi_vendor_system < database/schema.sql
if %ERRORLEVEL% NEQ 0 (
    echo Failed to import database schema. Please check the schema file.
    pause
    exit /b 1
)

echo.
echo [3/3] Setting up initial admin user...
mysql -u root multi_vendor_system -e "
    -- Update admin credentials (default: admin@sarstore.com / Admin@123456)
    -- Stored as plain text for one-time migration; backend upgrades it to bcrypt on first successful login.
    UPDATE users SET 
        email = 'admin@sarstore.com',
        password_hash = 'Admin@123456',
        role = 'admin',
        email_verified_at = NOW(),
        is_active = 1,
        updated_at = NOW()
    WHERE email = 'admin@example.com' AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@sarstore.com');

    UPDATE users SET
        password_hash = 'Admin@123456',
        role = 'admin',
        email_verified_at = NOW(),
        is_active = 1,
        updated_at = NOW()
    WHERE email = 'admin@sarstore.com';
    
    -- If admin doesn't exist, create one
    INSERT IGNORE INTO users (email, password_hash, role, full_name, is_active, email_verified_at, created_at, updated_at)
    VALUES (
        'admin@sarstore.com',
        'Admin@123456',
        'admin', 
        'Admin User', 
        1, 
        NOW(),
        NOW(),
        NOW()
    );
"

echo.
echo ===========================================
echo Database setup completed successfully!
echo.
echo Admin Credentials:
echo Email: admin@sarstore.com
echo Password: Admin@123456
echo.
echo Please change the default password after first login.
echo.
pause

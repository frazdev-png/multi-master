# Sell1Mall - Complete VPS Deployment Guide

## Project Architecture

sell1mall.com:443
  └─ Nginx (reverse proxy)
       ├─ / → Next.js (port 3000)                [Frontend]
       ├─ /api/auth/* → Next.js (port 3000)       [Auth Routes]
       ├─ /api/backend/* → Next.js (port 3000)    [Backend Proxy to PHP]
       ├─ /api/settings, /api/orders, etc → Next.js [App API Routes]
       ├─ /api/* (others) → PHP API (port 8000)   [Products, Cart, etc.]
       ├─ /uploads/* → Nginx direct               [Static Files]
       └─ /ws/ → PHP WebSocket (port 8080)        [Real-time Chat]

## Prerequisites - Hostinger KVM2 VPS

- OS: Ubuntu 22.04 (pre-installed)
- Domain: sell1mall.com (pointed to 72.61.248.39)
- SSH access: root user

---

## STEP 1: SSH into VPS

```bash
ssh root@72.61.248.39
```

---

## STEP 2: System Update & Required Software

```bash
# Update system
apt update && apt upgrade -y

# Install Nginx
apt install nginx -y

# PHP 8.3 + all required extensions
apt install php8.3-fpm php8.3-mysql php8.3-mbstring php8.3-xml php8.3-curl php8.3-gd php8.3-zip php8.3-intl php8.3-bcmath -y

# MySQL 8
apt install mysql-server -y

# Node.js 20.x (for Next.js)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install nodejs -y

# Verify Node.js version (must be >=18)
node -v    # Expect v20.x.x
npm -v     # Expect 10.x.x

# Composer (PHP dependency manager)
apt install composer -y
composer --version  # Expect 2.x

# PM2 (process manager for Node.js + PHP)
npm install -g pm2
pm2 --version  # Expect 5.x

# Git
apt install git -y

# Certbot (for SSL)
apt install certbot python3-certbot-nginx -y

# Create PM2 log directory
mkdir -p /var/log/pm2
```

---

## STEP 3: Configure MySQL Database

```bash
# Secure MySQL installation
mysql_secure_installation
# Follow prompts: set root password, remove test DB, etc.

# Create database and user
mysql -u root -p
```

```sql
CREATE DATABASE multi_vendor_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'multi_user'@'localhost' IDENTIFIED BY 'YourStrongPasswordHere123!';
GRANT ALL PRIVILEGES ON multi_vendor_system.* TO 'multi_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## STEP 4: Deploy Code from GitHub

```bash
cd /var/www
git clone https://github.com/frazdev-png/multi-master.git
cd multi-master
```

---

## STEP 5: Configure Frontend (.env)

```bash
nano /var/www/multi-master/.env
```

Paste:

```
# NEXT_PUBLIC_API_URL = PHP internal URL (Next.js proxy uses this internally)
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
# NEXT_PUBLIC_WS_URL = Public WebSocket URL (Nginx proxies /ws/ to PHP WebSocket)
NEXT_PUBLIC_WS_URL=wss://sell1mall.com/ws
API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_APP_URL=https://sell1mall.com
```

---

## STEP 6: Configure Backend (api/.env)

```bash
nano /var/www/multi-master/api/.env
```

Paste:

```
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=multi_vendor_system
DB_USERNAME=multi_user
DB_PASSWORD=YourStrongPasswordHere123!

JWT_SECRET=mFQlmILSFKki+4LMxwXMrg7Xp1bpqdW3hjsxrTK0stQC2Lqc70gt5xtbMMv2qHjg
JWT_EXPIRE=604800

WEBSOCKET_HOST=0.0.0.0
WEBSOCKET_PORT=8080

APP_URL=https://sell1mall.com
FRONTEND_URL=https://sell1mall.com
APP_DEBUG=false

UPLOAD_DIR=uploads/
MAX_UPLOAD_SIZE=5242880

MAIL_MAILER=smtp
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="noreply@sell1mall.com"
MAIL_FROM_NAME="Sell1Mall"
```

---

## STEP 7: Install PHP Dependencies (Composer)

```bash
cd /var/www/multi-master/api
composer install --no-dev --optimize-autoloader
```

---

## STEP 8: Install Node.js Dependencies & Build Next.js

```bash
cd /var/www/multi-master
npm install

# Build Next.js for production
npm run build
```

The build output goes to `/var/www/multi-master/.next/`.

---

## STEP 9: Configure Nginx

```bash
# Copy the pre-configured Nginx file
cp /var/www/multi-master/deploy/nginx-sell1mall.conf /etc/nginx/sites-available/sell1mall

# Enable site
ln -sf /etc/nginx/sites-available/sell1mall /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test config
nginx -t

# Restart Nginx
systemctl restart nginx
```

---

## STEP 10: Start Services with PM2

```bash
cd /var/www/multi-master

# 1. Next.js frontend (port 3000) - uses PM2 ecosystem file
pm2 start deploy/ecosystem.config.js

# 2. View all processes
pm2 status

# 3. Save PM2 process list (auto-restart on reboot)
pm2 save
pm2 startup
# PM2 will show a command to run — copy-paste and execute it
```

---

## STEP 11: Enable SSL with Certbot

```bash
certbot --nginx -d sell1mall.com -d www.sell1mall.com
```

Follow the prompts. Certbot will automatically:
- Generate SSL certificates
- Modify the Nginx config to use HTTPS
- Setup auto-renewal

Verify auto-renewal:
```bash
certbot renew --dry-run
```

---

## STEP 12: Set Proper Permissions

```bash
# Ensure Nginx can read files
chown -R www-data:www-data /var/www/multi-master/.next
chown -R www-data:www-data /var/www/multi-master/api/uploads
chmod -R 755 /var/www/multi-master/api/uploads

# Make sure .env files are not world-readable
chmod 640 /var/www/multi-master/.env
chmod 640 /var/www/multi-master/api/.env

# Create uploads directory (if not exists)
mkdir -p /var/www/multi-master/api/uploads
chmod -R 755 /var/www/multi-master/api/uploads
```

---

## STEP 13: Verification Commands

```bash
# 1. Check all PM2 processes are running
pm2 status
# Expected: nextjs (online), php-api (online), websocket (online)

# 2. Test Next.js directly
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000
# Expected: 200

# 3. Test PHP API directly
curl -s http://127.0.0.1:8000/api/health
# Expected: {"success":true,"message":"API is running"}

# 4. Test via Nginx (frontend)
curl -s -o /dev/null -w "%{http_code}" https://sell1mall.com
# Expected: 200

# 5. Test API via Nginx
curl -s https://sell1mall.com/api/health
# Expected: {"success":true,"message":"API is running"}

# 6. Test WebSocket (check port is listening)
ss -tlnp | grep 8080
# Expected: LISTEN on port 8080

# 7. Test MySQL connection
mysql -u multi_user -p -e "SELECT 1 AS test" multi_vendor_system
# Expected: returns a row with test=1

# 8. Test Nginx status
systemctl status nginx --no-pager

# 9. Check system resources
free -h
df -h
```

---

## STEP 14: Post-Deployment

### Check logs if something fails:
```bash
pm2 logs nextjs       # Next.js logs
pm2 logs php-api      # PHP API logs
pm2 logs websocket    # WebSocket logs
journalctl -u nginx   # Nginx logs
```

### Restart all services:
```bash
pm2 restart all
```

### Update code (for future deployments):
```bash
cd /var/www/multi-master
git pull origin main
npm install
npm run build
pm2 restart nextjs
# Restart PHP API if code changed
pm2 restart php-api
# Restart WebSocket if code changed
pm2 restart websocket
```

---

## Port Reference

| Service      | Port | Description              |
|-------------|------|--------------------------|
| Next.js     | 3000 | Frontend (internal)      |
| PHP API     | 8000 | Backend (internal)       |
| WebSocket   | 8080 | Real-time (internal)     |
| Nginx       | 443  | HTTPS (public)           |
| Nginx       | 80   | HTTP → HTTPS redirect    |
| MySQL       | 3306 | Database (internal)      |

---

## Software Version Requirements

| Software  | Required Version | Installed Command         |
|-----------|-----------------|---------------------------|
| Node.js   | >= 18           | `node -v`                 |
| PHP       | >= 7.4          | `php -v`                  |
| Composer  | >= 2.x          | `composer --version`      |
| MySQL     | >= 8.0          | `mysql --version`         |
| Nginx     | >= 1.18         | `nginx -v`                |
| PM2       | >= 5.x          | `pm2 --version`           |

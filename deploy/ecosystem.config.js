module.exports = {
  apps: [
    {
      name: "nextjs",
      cwd: "/var/www/multi-master",
      script: "npx",
      args: "next start -p 3000",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/pm2/nextjs-error.log",
      out_file: "/var/log/pm2/nextjs-out.log",
    },
    {
      name: "php-api",
      cwd: "/var/www/multi-master/api",
      script: "php",
      args: "-S 0.0.0.0:8000 start_api.php",
      interpreter: "none",
      env: {
        APP_ENV: "production",
      },
      max_memory_restart: "200M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/pm2/php-api-error.log",
      out_file: "/var/log/pm2/php-api-out.log",
    },
    {
      name: "websocket",
      cwd: "/var/www/multi-master/api",
      script: "php",
      args: "websocket_server.php",
      interpreter: "none",
      env: {
        APP_ENV: "production",
      },
      max_memory_restart: "200M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/pm2/websocket-error.log",
      out_file: "/var/log/pm2/websocket-out.log",
    },
  ],
};

module.exports = {
  apps: [{
    name: 'wms-app',
    script: 'server.js',
    cwd: '/home/wms/wms-app/.next/standalone',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      BASE_PATH: '/wms',
      HOSTNAME: '0.0.0.0'
    },
    error_file: '/home/wms/logs/wms-error.log',
    out_file: '/home/wms/logs/wms-out.log',
    log_file: '/home/wms/logs/wms-combined.log',
    time: true,
    
    // Auto restart settings
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Resource limits
    max_memory_restart: '1G',
    
    // Startup options
    wait_ready: true,
    listen_timeout: 10000,
    kill_timeout: 5000,
    
    // Pre-start hook to ensure directories exist
    pre_start: () => {
      const fs = require('fs');
      const path = require('path');
      
      // Ensure log directory exists
      const logDir = '/home/wms/logs';
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      // Check if standalone server exists
      const serverPath = '/home/wms/wms-app/.next/standalone/server.js';
      if (!fs.existsSync(serverPath)) {
        console.error('ERROR: Standalone server not found at:', serverPath);
        console.error('Please run "npm run build" with output: "standalone" in next.config.js');
        process.exit(1);
      }
    }
  }]
};

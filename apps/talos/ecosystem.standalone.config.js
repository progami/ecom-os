module.exports = {
  apps: [{
    name: 'talos-app',
    script: 'server.js',
    cwd: '/home/talos/talos-app/.next/standalone',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      BASE_PATH: '/talos',
      HOSTNAME: '0.0.0.0'
    },
    error_file: '/home/talos/logs/error.log',
    out_file: '/home/talos/logs/out.log',
    log_file: '/home/talos/logs/combined.log',
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
      const logDir = '/home/talos/logs';
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      // Check if standalone server exists
      const serverPath = '/home/talos/talos-app/.next/standalone/server.js';
      if (!fs.existsSync(serverPath)) {
        console.error('ERROR: Standalone server not found at:', serverPath);
        console.error('Please run "npm run build" with output: "standalone" in next.config.js');
        process.exit(1);
      }
    }
  }]
};

module.exports = {
  apps: [{
    name: 'wms-app',
    script: 'npm',
    args: 'start',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/home/wms/logs/error.log',
    out_file: '/home/wms/logs/out.log',
    log_file: '/home/wms/logs/combined.log',
    time: true,
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      NEXTAUTH_URL: 'https://wms.targonglobal.com'
    }
  }]
}
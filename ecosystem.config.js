module.exports = {
  apps: [{
    name: 'targon-frontend',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/targonglobal',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/targon-frontend-error.log',
    out_file: '/var/log/pm2/targon-frontend-out.log',
    merge_logs: true,
    time: true
  }]
};
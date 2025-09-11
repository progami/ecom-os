module.exports = {
  apps: [
    {
      name: 'hrms',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
      },
      watch: false,
      max_memory_restart: '300M',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
    },
  ],
}


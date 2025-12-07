const path = require('path');
const BASE_DIR = '/Users/jarraramjad/ecom-os';

module.exports = {
  apps: [
    // DEV ENVIRONMENT (31xx ports) - dev.ecomos.targonglobal.com
    {
      name: 'dev-ecomos',
      cwd: path.join(BASE_DIR, 'apps/ecomos'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3100',
      interpreter: 'node',
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 3100 },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    },
    {
      name: 'dev-wms',
      cwd: path.join(BASE_DIR, 'apps/wms'),
      script: 'server.js',
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 3101 },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    },
    {
      name: 'dev-website',
      cwd: path.join(BASE_DIR, 'apps/website'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3105',
      interpreter: 'node',
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 3105 },
      autorestart: true,
      watch: false,
      max_memory_restart: '300M'
    },
    {
      name: 'dev-hrms',
      cwd: path.join(BASE_DIR, 'apps/hrms'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3106',
      interpreter: 'node',
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 3106 },
      autorestart: true,
      watch: false,
      max_memory_restart: '300M'
    },
    {
      name: 'dev-x-plan',
      cwd: path.join(BASE_DIR, 'apps/x-plan'),
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3108',
      interpreter: 'node',
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 3108 },
      autorestart: true,
      watch: false,
      max_memory_restart: '300M'
    }
  ]
};

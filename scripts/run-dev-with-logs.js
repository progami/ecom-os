#!/usr/bin/env node
const { spawn } = require('child_process');

const [appName, separator, ...cmd] = process.argv.slice(2);
if (!appName || separator !== '--' || cmd.length === 0) {
  console.error('Usage: node scripts/run-dev-with-logs.js <app-name> -- <command>');
  process.exit(1);
}

const child = spawn(cmd[0], cmd.slice(1), {
  stdio: 'inherit',
  env: {
    ...process.env,
    APP_LOG_PREFIX: `[${appName}]`
  }
});

child.on('exit', (code) => {
  process.exit(code);
});

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env.local if it exists
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

// Get port from environment or use default
const port = process.env.PORT || 3000;

// Start Next.js dev server
const nextDev = spawn('npx', ['next', 'dev', '-p', port], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

nextDev.on('close', (code) => {
  process.exit(code);
});
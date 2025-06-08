#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env.local file
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      if (key === 'PORT') {
        process.env.PORT = value;
      }
    }
  }
}

// Get PORT from environment or use default
const port = process.env.PORT || '3000';

console.log(`Starting Next.js dev server on port ${port}...`);

// Run next dev with the specified port
const child = spawn('npx', ['next', 'dev', '-p', port], {
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  process.exit(code);
});
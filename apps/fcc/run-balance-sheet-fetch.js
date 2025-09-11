const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Balance Sheet historical fetch...\n');

const scriptPath = path.join(__dirname, 'scripts', 'fetch-all-historical-balance-sheets.ts');

const child = spawn('npx', ['tsx', scriptPath], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

child.on('error', (error) => {
  console.error('Failed to start process:', error);
});

child.on('exit', (code) => {
  console.log(`\nProcess exited with code ${code}`);
});
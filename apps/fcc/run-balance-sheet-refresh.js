const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Balance Sheet refresh script...\n');

const scriptPath = path.join(__dirname, 'scripts', 'refresh-all-balance-sheet-data.ts');
const tsxPath = path.join(__dirname, 'node_modules', '.bin', 'tsx');

const child = spawn(tsxPath, [scriptPath], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env }
});

child.on('error', (error) => {
  console.error('Failed to start script:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✅ Script completed successfully');
  } else {
    console.error(`\n❌ Script exited with code ${code}`);
  }
  process.exit(code);
});
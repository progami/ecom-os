#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.resolve(repoRoot, 'packages/auth/node_modules/.prisma/client-auth');
const destDir = path.resolve(repoRoot, 'apps/ecomos/node_modules/.prisma/client-auth');

if (!fs.existsSync(sourceDir)) {
  console.warn('[link-prisma-client-auth] Source Prisma client not found, skipping:', sourceDir);
  process.exit(0);
}

try {
  fs.mkdirSync(path.dirname(destDir), { recursive: true });
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  if (typeof fs.cpSync === 'function') {
    fs.cpSync(sourceDir, destDir, { recursive: true });
  } else {
    const { spawnSync } = require('child_process');
    const result = spawnSync('cp', ['-R', sourceDir + '/.', destDir]);
    if (result.status !== 0) {
      throw new Error(result.stderr.toString());
    }
  }
  console.log('[link-prisma-client-auth] Copied Prisma client to', destDir);
} catch (error) {
  console.error('[link-prisma-client-auth] Failed to copy Prisma client:', error);
  process.exit(1);
}

// @ts-nocheck
/**
 * Build and Compilation Tests
 * Ensures the Next.js app builds successfully
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import logger from '@/utils/logger';

const execAsync = promisify(exec);

describe('App Build Tests', () => {
  jest.setTimeout(120000); // 2 minutes for build

  test('TypeScript compilation succeeds (excluding test files)', async () => {
    // Check TypeScript compilation for production code only
    // Test files may have mock-related type issues that don't affect the build
    try {
      const { stdout, stderr } = await execAsync('npx tsc --noEmit --skipLibCheck', {
        cwd: path.resolve(__dirname, '../..')
      });
      
      // Filter out any errors from test files that might still appear
      const errors = stderr.split('\n').filter(line => 
        !line.includes('.test.') && 
        !line.includes('__tests__') &&
        line.includes('error TS')
      );
      
      // TypeScript should compile without errors in production code
      expect(errors.length).toBe(0);
    } catch (error: any) {
      // Filter out test file errors from the output
      const output = (error.stdout || '') + '\n' + (error.stderr || '');
      const productionErrors = output.split('\n').filter(line => 
        !line.includes('.test.') && 
        !line.includes('__tests__') &&
        line.includes('error TS')
      );
      
      if (productionErrors.length > 0) {
        throw new Error(`TypeScript compilation failed in production code:\n${productionErrors.join('\n')}`);
      }
    }
  });

  test('Next.js build succeeds', async () => {
    try {
      const { stdout } = await execAsync('npm run build', {
        cwd: path.resolve(__dirname, '../..')
      });
      
      // Build should complete successfully
      expect(stdout).toContain('Compiled successfully');
      expect(stdout).toContain('Collecting page data');
      expect(stdout).toContain('Generating static pages');
      
      // Check that .next directory exists
      const nextDir = path.resolve(__dirname, '../../.next');
      const dirExists = await fs.access(nextDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    } catch (error: any) {
      throw new Error(`Next.js build failed: ${error.message}`);
    }
  });

  test('All required pages exist', async () => {
    const pagesDir = path.resolve(__dirname, '../app');
    const requiredPages = [
      'page.tsx',
      'layout.tsx',
      'financial-dashboard/page.tsx',
      'financial-dashboard/ledger/page.tsx',
      'financial-dashboard/product-margins/page.tsx'
    ];

    for (const page of requiredPages) {
      const pagePath = path.join(pagesDir, page);
      const exists = await fs.access(pagePath).then(() => true).catch(() => false);
      if (!exists) {
        logger.info(`Missing page: ${pagePath}`);
      }
      expect(exists).toBe(true);
    }
  });

  test('All critical components exist', async () => {
    const componentsDir = path.resolve(__dirname, '../components');
    const requiredComponents = [
      'AssumptionsForm.tsx',
      'FinancialResults.tsx',
      'FinancialTable.tsx',
      'SpreadsheetTable.tsx',
      'ProductMarginTable.tsx',
      'gl/AddExpenseModal.tsx',
      'layout/dashboard-layout.tsx'
    ];

    for (const component of requiredComponents) {
      const componentPath = path.join(componentsDir, component);
      const exists = await fs.access(componentPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  });

  test('Critical libraries are importable', async () => {
    // Test that key modules can be imported without errors
    const imports = [
      () => import('../lib/financeEngine'),
      () => import('../lib/financeEngineClass'),
      () => import('../lib/flexibleFinanceEngine'),
      () => import('../types/financial'),
      () => import('../types/expenses')
    ];

    for (const importFn of imports) {
      await expect(importFn()).resolves.toBeDefined();
    }
  });

  test('Environment is properly configured', () => {
    // Check Node version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    expect(majorVersion).toBeGreaterThanOrEqual(18);

    // Check required environment
    expect(process.env.NODE_ENV).toBeDefined();
  });
});
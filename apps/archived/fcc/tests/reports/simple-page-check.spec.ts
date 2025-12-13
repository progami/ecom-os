import { test } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Simple Page Check', () => {
  const pages = [
    '/reports',
    '/reports/balance-sheet',
    '/reports/profit-loss',
    '/reports/cash-flow',
    '/reports/trial-balance',
    '/reports/general-ledger',
    '/reports/import'
  ];

  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test.afterEach(async () => {
    const errors = helpers.getRuntimeErrors();
    if (errors.length > 0) {
      throw new Error(`Runtime errors detected:\n\n${errors.map(err => 
        `[${err.source}] ${err.message}${err.stack ? '\n' + err.stack : ''}`
      ).join('\n\n')}`);
    }
  });

  test('Check all report pages manually', async ({ page }) => {
    // Set up console monitoring
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          url: page.url(),
          text: msg.text()
        });
      }
    });

    page.on('pageerror', (error) => {
      console.log('Page error:', error.message);
    });

    console.log('\n=== Starting Page Check ===\n');

    for (const pagePath of pages) {
      console.log(`\nChecking ${pagePath}...`);
      consoleErrors.length = 0;

      try {
        // Navigate with dev bypass
        await page.goto(`https://localhost:3003${pagePath}?dev_bypass=true`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        // Wait a bit for JS to execute
        await page.waitForTimeout(3000);

        // Get page title
        const title = await page.title();
        console.log(`  Title: ${title || '(empty)'}`);

        // Check if page has body content
        const bodyText = await page.locator('body').innerText().catch(() => '');
        console.log(`  Body length: ${bodyText.length} characters`);

        // Check for specific error indicators
        const hasError = bodyText.includes('500') || 
                        bodyText.includes('Error') || 
                        bodyText.includes('undefined') ||
                        bodyText.includes('cannot read');
        
        if (hasError) {
          console.log(`  ⚠️  Error indicators found in body`);
        }

        // Check for main content
        const hasMain = await page.locator('main, [role="main"]').count() > 0;
        console.log(`  Has main content: ${hasMain}`);

        // Check for h1 or h2 headings
        const headings = await page.locator('h1, h2').allTextContents();
        if (headings.length > 0) {
          console.log(`  Headings found: ${headings.slice(0, 3).join(', ')}`);
        }

        // Log console errors
        if (consoleErrors.length > 0) {
          console.log(`  Console errors: ${consoleErrors.length}`);
          consoleErrors.forEach(err => {
            console.log(`    - ${err.text.substring(0, 100)}...`);
          });
        }

        console.log(`  ✓ Page loaded`);

      } catch (error) {
        console.log(`  ✗ Failed to load: ${error.message}`);
      }
    }

    console.log('\n=== Page Check Complete ===\n');
  });
});
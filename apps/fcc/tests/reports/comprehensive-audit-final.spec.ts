import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Comprehensive Reports Audit', () => {
  // Define all report pages to test
  const reportPages = [
    { path: '/reports', title: 'Reports Hub', heading: 'Reports Hub' },
    { path: '/reports/cash-flow', title: 'Cash Flow', heading: 'Cash Flow Statement' },
    { path: '/reports/general-ledger', title: 'General Ledger', heading: 'General Ledger' },
    { path: '/reports/trial-balance', title: 'Trial Balance', heading: 'Trial Balance' },
    { path: '/reports/balance-sheet', title: 'Balance Sheet', heading: 'Balance Sheet' },
    { path: '/reports/profit-loss', title: 'Profit & Loss', heading: 'Profit & Loss Statement' },
    { path: '/reports/import', title: 'Import Reports', heading: 'Import Reports' }
  ];

  // Test results storage
  const results: any[] = [];
  let helpers: TestHelpers;

  test.beforeAll(async () => {
    console.log('\n========== COMPREHENSIVE REPORTS AUDIT ==========\n');
    console.log('Testing all report pages for functionality and errors...\n');
  });

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

  for (const reportPage of reportPages) {
    test(`${reportPage.title} - Full Audit`, async ({ page }) => {
      const startTime = Date.now();
      let success = true;
      const issues: string[] = [];

      try {
        console.log(`\n--- Testing ${reportPage.title} ---`);
        
        // Navigate with dev bypass
        await helpers.navigateWithDevBypass(reportPage.path);
        
        // Wait for page to be ready
        await helpers.waitForReportPage(reportPage.title);
        
        // Check page title
        const pageTitle = await page.title();
        console.log(`  Title: ${pageTitle}`);
        
        // Check for main heading
        const headingVariants = [
          page.locator(`h1:has-text("${reportPage.heading}")`),
          page.locator(`h2:has-text("${reportPage.heading}")`),
          page.locator(`h1:has-text("${reportPage.title}")`),
          page.locator(`h2:has-text("${reportPage.title}")`)
        ];
        
        let headingFound = false;
        for (const variant of headingVariants) {
          if (await variant.count() > 0) {
            headingFound = true;
            break;
          }
        }
        
        if (!headingFound) {
          issues.push(`Main heading not found (looked for "${reportPage.heading}" or "${reportPage.title}")`);
        } else {
          console.log(`  ✓ Heading found`);
        }
        
        // Check for page errors
        const pageErrors = await helpers.checkForErrors();
        if (pageErrors.length > 0) {
          issues.push(`Page errors: ${pageErrors.join(', ')}`);
        }
        
        // Page-specific checks
        if (reportPage.path === '/reports') {
          // Reports hub checks
          const reportCards = await page.locator('a[href^="/reports/"], .grid button, .grid > div').count();
          if (reportCards === 0) {
            issues.push('No report cards found on hub page');
          } else {
            console.log(`  ✓ Found ${reportCards} report cards/links`);
          }
        } else if (reportPage.path === '/reports/import') {
          // Import page checks
          const fileInput = await page.locator('input[type="file"]').count();
          const uploadButton = await page.locator('button:has-text("Upload"), button:has-text("Import"), button:has-text("Select")').count();
          
          if (fileInput === 0) issues.push('No file input found');
          if (uploadButton === 0) issues.push('No upload/import button found');
          
          if (fileInput > 0 && uploadButton > 0) {
            console.log(`  ✓ Import controls found`);
          }
        } else {
          // Regular report page checks
          const hasControls = await page.locator('button, select, [role="combobox"]').count() > 0;
          const hasContent = await helpers.hasDataContent() || await helpers.hasEmptyState();
          
          if (!hasControls) {
            issues.push('No interactive controls found (buttons, selects, etc.)');
          }
          
          if (!hasContent) {
            issues.push('No data content or empty state found');
          } else {
            console.log(`  ✓ Content/empty state present`);
          }
        }
        
        // Check for loading states that shouldn't be visible
        const loadingIndicators = await page.locator('.animate-spin, .loading, [data-testid*="loading"]').count();
        if (loadingIndicators > 0) {
          issues.push(`${loadingIndicators} loading indicators still visible`);
        }
        
        // Take screenshot
        const screenshotName = reportPage.path.replace(/\//g, '-').substring(1) || 'hub';
        await page.screenshot({ 
          path: `tests/screenshots/audit-final-${screenshotName}.png`,
          fullPage: true 
        });
        console.log(`  ✓ Screenshot saved`);
        
        // Check for runtime errors
        await helpers.assertNoRuntimeErrors();
        console.log(`  ✓ No runtime errors`);
        
      } catch (error: any) {
        success = false;
        issues.push(`Test failed: ${error.message}`);
        console.error(`  ✗ Error: ${error.message}`);
      }
      
      const loadTime = Date.now() - startTime;
      
      // Store results
      const result = {
        page: reportPage.path,
        title: reportPage.title,
        success,
        loadTime,
        issues,
        runtimeErrors: helpers.getRuntimeErrors()
      };
      results.push(result);
      
      // Summary for this page
      console.log(`  Load time: ${loadTime}ms`);
      console.log(`  Status: ${success ? '✓ PASSED' : '✗ FAILED'}`);
      
      if (issues.length > 0) {
        console.log(`  Issues found (${issues.length}):`);
        issues.forEach(issue => console.log(`    - ${issue}`));
      }
      
      // Assert test passed
      if (!success || issues.length > 0) {
        const errorMessage = `Page ${reportPage.title} has issues:\n${issues.join('\n')}`;
        expect(success, errorMessage).toBe(true);
      }
    });
  }
  
  test.afterAll(async () => {
    console.log('\n\n========== FINAL AUDIT REPORT ==========\n');
    
    const totalPages = results.length;
    const passedPages = results.filter(r => r.success && r.issues.length === 0).length;
    const failedPages = results.filter(r => !r.success).length;
    const pagesWithIssues = results.filter(r => r.issues.length > 0).length;
    const pagesWithRuntimeErrors = results.filter(r => r.runtimeErrors.length > 0).length;
    
    console.log('=== SUMMARY ===');
    console.log(`Total Pages Tested: ${totalPages}`);
    console.log(`✓ Fully Passed: ${passedPages}`);
    console.log(`✗ Failed: ${failedPages}`);
    console.log(`⚠ With Issues: ${pagesWithIssues}`);
    console.log(`⚠ With Runtime Errors: ${pagesWithRuntimeErrors}`);
    
    // Performance analysis
    const avgLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / totalPages;
    const fastestPage = results.reduce((min, r) => r.loadTime < min.loadTime ? r : min);
    const slowestPage = results.reduce((max, r) => r.loadTime > max.loadTime ? r : max);
    
    console.log('\n=== PERFORMANCE ===');
    console.log(`Average Load Time: ${avgLoadTime.toFixed(0)}ms`);
    console.log(`Fastest: ${fastestPage.title} (${fastestPage.loadTime}ms)`);
    console.log(`Slowest: ${slowestPage.title} (${slowestPage.loadTime}ms)`);
    
    // Detailed issues
    if (failedPages > 0 || pagesWithIssues > 0) {
      console.log('\n=== DETAILED ISSUES ===');
      
      results.forEach(result => {
        if (!result.success || result.issues.length > 0 || result.runtimeErrors.length > 0) {
          console.log(`\n${result.title} (${result.page}):`);
          
          if (!result.success) {
            console.log('  Status: FAILED');
          }
          
          if (result.issues.length > 0) {
            console.log('  Issues:');
            result.issues.forEach((issue: string) => console.log(`    - ${issue}`));
          }
          
          if (result.runtimeErrors.length > 0) {
            console.log('  Runtime Errors:');
            result.runtimeErrors.forEach((err: any) => 
              console.log(`    - [${err.source}] ${err.message}`)
            );
          }
        }
      });
    }
    
    // Success rate and recommendations
    const successRate = (passedPages / totalPages) * 100;
    
    console.log('\n=== HEALTH SCORE ===');
    console.log(`Overall Success Rate: ${successRate.toFixed(0)}%`);
    
    if (successRate === 100) {
      console.log('✅ All report pages are working perfectly!');
    } else if (successRate >= 80) {
      console.log('⚠️  Most pages are working well, but some need attention.');
    } else if (successRate >= 50) {
      console.log('⚠️  Several pages have issues that should be addressed.');
    } else {
      console.log('❌ Many pages have critical issues requiring immediate attention.');
    }
    
    // Common issues summary
    const allIssues = results.flatMap(r => r.issues);
    const issueTypes = new Map<string, number>();
    
    allIssues.forEach(issue => {
      const type = issue.includes('heading') ? 'Missing Headings' :
                   issue.includes('controls') ? 'Missing Controls' :
                   issue.includes('content') ? 'Missing Content' :
                   issue.includes('error') ? 'Page Errors' :
                   issue.includes('loading') ? 'Loading Issues' :
                   'Other Issues';
      
      issueTypes.set(type, (issueTypes.get(type) || 0) + 1);
    });
    
    if (issueTypes.size > 0) {
      console.log('\n=== COMMON ISSUES ===');
      Array.from(issueTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`${type}: ${count} occurrences`);
        });
    }
    
    console.log('\n=======================================\n');
  });
});
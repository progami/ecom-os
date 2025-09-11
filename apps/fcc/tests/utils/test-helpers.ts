import { Page, expect } from '@playwright/test';
import { navigateWithAuth, TEST_USERS, injectAuthCookies } from './test-auth';

/**
 * Runtime error tracking interface
 */
interface RuntimeError {
  message: string;
  stack?: string;
  source: string;
  timestamp: number;
}

/**
 * Common test utilities and helpers for the application
 */
export class TestHelpers {
  private runtimeErrors: RuntimeError[] = [];
  private expectedErrorPatterns: RegExp[] = [];
  
  constructor(private page: Page) {
    this.setupErrorTracking();
  }

  /**
   * Set up runtime error tracking
   */
  private setupErrorTracking() {
    // Listen for console errors
    this.page.on('console', async (msg) => {
      if (msg.type() === 'error') {
        const errorMessage = msg.text();
        
        // Check if this error is expected
        const isExpected = this.expectedErrorPatterns.some(pattern => 
          pattern.test(errorMessage)
        );
        
        if (!isExpected) {
          this.runtimeErrors.push({
            message: errorMessage,
            source: 'console',
            timestamp: Date.now(),
          });
        }
      }
    });

    // Listen for page errors
    this.page.on('pageerror', (error) => {
      this.runtimeErrors.push({
        message: error.message,
        stack: error.stack,
        source: 'page',
        timestamp: Date.now(),
      });
    });

    // Listen for response errors
    this.page.on('response', (response) => {
      if (response.status() >= 500) {
        const errorMessage = `HTTP ${response.status()}: ${response.url()}`;
        
        // Check if this error is expected
        const isExpected = this.expectedErrorPatterns.some(pattern => 
          pattern.test(errorMessage) || pattern.test(response.url())
        );
        
        if (!isExpected) {
          this.runtimeErrors.push({
            message: errorMessage,
            source: 'network',
            timestamp: Date.now(),
          });
        }
      }
    });
  }

  /**
   * Get all runtime errors that occurred during the test
   */
  getRuntimeErrors(): RuntimeError[] {
    return [...this.runtimeErrors];
  }

  /**
   * Clear runtime errors
   */
  clearRuntimeErrors() {
    this.runtimeErrors = [];
  }

  /**
   * Set expected error patterns that should not be treated as runtime errors
   * @param patterns - Array of RegExp patterns to match against error messages or URLs
   */
  setExpectedErrors(patterns: RegExp[]) {
    this.expectedErrorPatterns = patterns;
  }
  
  /**
   * Add expected error patterns to the existing list
   * @param patterns - Array of RegExp patterns to add
   */
  addExpectedErrors(patterns: RegExp[]) {
    this.expectedErrorPatterns.push(...patterns);
  }

  /**
   * Clear expected error patterns
   */
  clearExpectedErrors() {
    this.expectedErrorPatterns = [];
  }

  /**
   * Check for runtime errors and throw if any found
   */
  async assertNoRuntimeErrors() {
    if (this.runtimeErrors.length > 0) {
      const errorMessages = this.runtimeErrors.map(err => 
        `[${err.source}] ${err.message}${err.stack ? '\n' + err.stack : ''}`
      ).join('\n\n');
      
      throw new Error(`Runtime errors detected:\n\n${errorMessages}`);
    }
  }

  /**
   * Navigate to a page with dev bypass authentication and error tracking
   */
  async navigateWithDevBypass(path: string = '/') {
    // Clear previous errors before navigation
    this.clearRuntimeErrors();
    
    const url = path.includes('?') 
      ? `${path}&dev_bypass=true` 
      : `${path}?dev_bypass=true`;
    
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // Wait for React to mount and initial render
    await this.waitForReactMount();
    
    // Give a moment for any async errors to surface
    await this.page.waitForTimeout(500);
    
    // Log for debugging
    console.log(`[Test Helper] Navigated to ${url} with dev bypass`);
  }

  /**
   * Navigate to a page with cookie-based authentication
   * @param path - The path to navigate to
   * @param userType - The type of test user to authenticate as
   */
  async navigateWithAuth(
    path: string = '/', 
    userType: keyof typeof TEST_USERS = 'default'
  ) {
    // Clear previous errors before navigation
    this.clearRuntimeErrors();
    
    await navigateWithAuth(this.page, path, {
      userType,
      useCookies: true,
      useDevBypass: false,
      mockEndpoints: true
    });
    
    // Wait for React to mount and initial render
    await this.waitForReactMount();
    
    // Give a moment for any async errors to surface
    await this.page.waitForTimeout(500);
    
    console.log(`[Test Helper] Navigated to ${path} with ${userType} auth`);
  }

  /**
   * Set up authentication for the current context
   * @param userType - The type of test user to authenticate as
   */
  async setupAuth(userType: keyof typeof TEST_USERS = 'default') {
    await injectAuthCookies(this.page.context(), userType);
    console.log(`[Test Helper] Set up ${userType} authentication`);
  }

  /**
   * Wait for the page to finish loading with proper error handling
   * @deprecated Use waitForReactMount() or more specific wait methods instead
   */
  async waitForPageLoad() {
    // For backward compatibility, wait for DOM and React mount
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitForReactMount();
  }

  /**
   * Check if page has authentication requirements
   */
  async isAuthenticationRequired(): Promise<boolean> {
    try {
      // Look for login form or redirect to login
      const loginForm = this.page.locator('form').filter({ hasText: /sign in|login/i });
      const isLoginPage = await loginForm.isVisible({ timeout: 5000 });
      
      return isLoginPage || this.page.url().includes('/login');
    } catch {
      return false;
    }
  }

  /**
   * Perform login using the form
   */
  async login(email: string = 'ajarrar@trademanenterprise.com', password: string = 'password123') {
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    
    // Click sign in button
    await this.page.click('button[type="submit"]');
    
    // Wait for navigation after login
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitForReactMount();
  }

  /**
   * Wait for API requests to complete
   * @deprecated Use waitForDataLoad() or more specific wait methods instead
   */
  async waitForApiRequests(patterns: string[] = ['/api/']) {
    // For backward compatibility, wait for data to load
    await this.waitForDataLoad();
  }

  /**
   * Check if an element is visible and clickable
   */
  async isInteractable(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector);
      return await element.isVisible() && await element.isEnabled();
    } catch {
      return false;
    }
  }

  /**
   * Safely click an element with retry logic
   */
  async safeClick(selector: string, timeout: number = 5000) {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible', timeout });
    await element.click();
  }

  /**
   * Check for error messages on the page
   */
  async checkForErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    // Check for common error indicators
    const errorSelectors = [
      '[role="alert"]',
      '.error',
      '.alert-error',
      '[data-testid*="error"]',
      '.toast-error'
    ];

    for (const selector of errorSelectors) {
      try {
        const errorElements = await this.page.locator(selector).all();
        for (const element of errorElements) {
          if (await element.isVisible()) {
            const text = await element.textContent();
            if (text?.trim()) {
              errors.push(text.trim());
            }
          }
        }
      } catch {
        // Ignore selector errors
      }
    }

    return errors;
  }

  /**
   * Scroll to element before interacting with it
   */
  async scrollToElement(selector: string) {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  /**
   * Wait for a specific text to appear on the page
   */
  async waitForText(text: string, timeout: number = 10000) {
    await this.page.waitForSelector(`text=${text}`, { timeout });
  }

  /**
   * Fill a form field by label
   */
  async fillByLabel(label: string, value: string) {
    // Try different approaches to find the input
    const labelElement = this.page.locator(`label:has-text("${label}")`);
    
    // First try to find input associated with label
    let input = this.page.locator(`input[aria-labelledby="${await labelElement.getAttribute('id')}"]`);
    
    if (!(await input.count())) {
      // Try to find input near the label
      input = labelElement.locator('..').locator('input').first();
    }
    
    if (!(await input.count())) {
      // Try to find input with placeholder matching label
      input = this.page.locator(`input[placeholder*="${label}"]`);
    }

    await input.fill(value);
  }

  /**
   * Upload a file to a file input
   */
  async uploadFile(selector: string, filePath: string) {
    await this.page.setInputFiles(selector, filePath);
  }

  /**
   * Wait for upload to complete by checking for success indicators
   */
  async waitForUploadSuccess(timeout: number = 30000) {
    // Look for success indicators
    const successIndicators = [
      'text=Success',
      'text=Uploaded',
      'text=Import',
      '[data-testid="upload-success"]',
      '.success'
    ];

    for (const indicator of successIndicators) {
      try {
        await this.page.waitForSelector(indicator, { timeout: timeout / successIndicators.length });
        return true;
      } catch {
        continue;
      }
    }
    
    return false;
  }

  /**
   * Wait for React to mount and become interactive
   */
  async waitForReactMount(timeout: number = 10000) {
    try {
      // Wait for common React root selectors
      await Promise.race([
        this.page.waitForSelector('#root', { state: 'attached', timeout }),
        this.page.waitForSelector('#__next', { state: 'attached', timeout }),
        this.page.waitForSelector('[data-reactroot]', { state: 'attached', timeout }),
        this.page.waitForSelector('.app', { state: 'attached', timeout })
      ]);
      
      // Small delay to ensure React has finished initial render
      await this.page.waitForTimeout(100);
    } catch {
      // If none found, assume page is ready
    }
  }

  /**
   * Wait for data to load by checking for common data indicators
   */
  async waitForDataLoad(timeout: number = 15000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      // Check for loading indicators
      const loadingIndicators = await Promise.all([
        this.page.locator('[data-testid*="loading"]').count(),
        this.page.locator('[data-testid*="skeleton"]').count(),
        this.page.locator('.skeleton').count(),
        this.page.locator('[class*="loading"]').count(),
        this.page.locator('[class*="spinner"]').count(),
        this.page.locator('text=Loading').count()
      ]);
      
      const hasLoadingIndicators = loadingIndicators.some(count => count > 0);
      
      if (!hasLoadingIndicators) {
        // Check if we have data or empty state
        const hasContent = await this.hasDataContent() || await this.hasEmptyState();
        if (hasContent) {
          return;
        }
      }
      
      await this.page.waitForTimeout(250);
    }
    
    // Timeout reached, log current state
    console.warn(`waitForDataLoad timed out after ${timeout}ms`);
  }

  /**
   * Check if page has data content (tables, charts, etc.)
   */
  async hasDataContent(): Promise<boolean> {
    const dataSelectors = [
      'table tbody tr',
      '[data-testid*="data-table"]',
      '[data-testid*="chart"]',
      '.recharts-responsive-container',
      '[class*="metric-card"]',
      '[class*="MetricCard"]',
      // Report hub specific selectors
      'h3:has-text("Aged Payables")',
      'h3:has-text("Aged Receivables")',
      'h3:has-text("Cash Flow Statement")',
      'h2:has-text("Available Reports")',
      // General content indicators
      '[class*="report-card"]',
      '[class*="report-list"]',
      // Report page specific selectors
      '.bg-secondary.backdrop-blur-sm.border',
      '[class*="ReportVisualization"]',
      '[class*="ReportTable"]',
      '[class*="MetricSection"]',
      // Headers that indicate content
      'main h1',
      'main h2',
      'main h3'
    ];
    
    for (const selector of dataSelectors) {
      try {
        const element = this.page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
        if (isVisible) return true;
      } catch {
        // Ignore selector errors
      }
    }
    
    return false;
  }

  /**
   * Check if page has empty state
   */
  async hasEmptyState(): Promise<boolean> {
    const emptyStateSelectors = [
      'text=No data available',
      'text=No Data Available',
      'text=No results found',
      '[data-testid*="empty-state"]',
      '[class*="empty-state"]',
      '.ReportEmptyState',
      'text=Try syncing with Xero'
    ];
    
    for (const selector of emptyStateSelectors) {
      try {
        const isVisible = await this.page.locator(selector).isVisible({ timeout: 1000 });
        if (isVisible) return true;
      } catch {
        // Ignore selector errors
      }
    }
    
    return false;
  }

  /**
   * Wait for a specific table to load with data
   */
  async waitForTable(tableSelector: string = 'table', timeout: number = 10000) {
    // Wait for table element
    await this.page.waitForSelector(tableSelector, { state: 'visible', timeout });
    
    // Wait for table body with rows or empty state
    const hasRows = await this.page.waitForFunction(
      (selector) => {
        const table = document.querySelector(selector);
        if (!table) return false;
        
        const tbody = table.querySelector('tbody');
        if (!tbody) return false;
        
        // Check if we have data rows or an empty state message
        const rows = tbody.querySelectorAll('tr');
        const hasDataRows = rows.length > 0;
        const hasEmptyMessage = tbody.textContent?.includes('No data') || 
                               tbody.textContent?.includes('No results');
        
        return hasDataRows || hasEmptyMessage;
      },
      tableSelector,
      { timeout }
    );
    
    return hasRows;
  }

  /**
   * Wait for charts to render
   */
  async waitForCharts(timeout: number = 10000) {
    const chartSelectors = [
      '.recharts-responsive-container',
      '[data-testid*="chart"]',
      'svg.recharts-surface',
      'canvas' // For Chart.js or similar
    ];
    
    for (const selector of chartSelectors) {
      try {
        await this.page.waitForSelector(selector, { state: 'visible', timeout: timeout / chartSelectors.length });
        // Give chart time to render data
        await this.page.waitForTimeout(500);
        return true;
      } catch {
        continue;
      }
    }
    
    return false;
  }

  /**
   * Wait for metric cards to load
   */
  async waitForMetricCards(timeout: number = 10000) {
    const metricSelectors = [
      '[class*="metric-card"]',
      '[class*="MetricCard"]',
      '[data-testid*="metric"]',
      '.metric-card'
    ];
    
    for (const selector of metricSelectors) {
      try {
        const element = this.page.locator(selector).first();
        await element.waitFor({ state: 'visible', timeout: timeout / metricSelectors.length });
        
        // Wait for content to be populated (not just skeleton)
        await this.page.waitForFunction(
          (sel) => {
            const elem = document.querySelector(sel);
            return elem && elem.textContent && elem.textContent.trim().length > 0;
          },
          selector,
          { timeout: 5000 }
        );
        
        return true;
      } catch {
        continue;
      }
    }
    
    return false;
  }

  /**
   * Wait for specific report page to be ready
   */
  async waitForReportPage(reportName: string, timeout: number = 15000) {
    // Wait for React mount
    await this.waitForReactMount();
    
    // For the reports hub, look for different indicators
    if (reportName.toLowerCase() === 'reports') {
      await Promise.race([
        this.page.waitForSelector('h1:has-text("Financial Reports")', { timeout }),
        this.page.waitForSelector('h2:has-text("Available Reports")', { timeout }),
        this.page.waitForSelector('.UnifiedPageHeader', { timeout })
      ]).catch(() => {
        // If none found, continue anyway
      });
    } else {
      // Wait for page title or heading
      await Promise.race([
        this.page.waitForSelector(`h1:has-text("${reportName}")`, { timeout }),
        this.page.waitForSelector(`h2:has-text("${reportName}")`, { timeout }),
        this.page.waitForSelector(`[data-testid="${reportName.toLowerCase().replace(/\s+/g, '-')}-title"]`, { timeout })
      ]).catch(() => {
        // If none found, continue anyway
      });
    }
    
    // Wait for data or empty state
    await this.waitForDataLoad(timeout);
  }
}

/**
 * Custom assertions for financial application testing
 */
export class FinancialAssertions {
  constructor(private page: Page) {}

  /**
   * Assert that a currency value is displayed correctly
   */
  async expectCurrencyValue(selector: string, expectedValue: number, currency: string = '£') {
    const element = this.page.locator(selector);
    await expect(element).toBeVisible();
    
    const text = await element.textContent();
    expect(text).toMatch(new RegExp(`${currency}[\\d,]+\\.\\d{2}`));
    
    // Extract numeric value and compare
    const numericValue = parseFloat(text?.replace(/[£$,\s]/g, '') || '0');
    expect(Math.abs(numericValue - expectedValue)).toBeLessThan(0.01);
  }

  /**
   * Assert that a date is displayed in correct format
   */
  async expectDateFormat(selector: string, format: 'DD/MM/YYYY' | 'YYYY-MM-DD' = 'DD/MM/YYYY') {
    const element = this.page.locator(selector);
    await expect(element).toBeVisible();
    
    const text = await element.textContent();
    const dateRegex = format === 'DD/MM/YYYY' 
      ? /\d{2}\/\d{2}\/\d{4}/
      : /\d{4}-\d{2}-\d{2}/;
    
    expect(text).toMatch(dateRegex);
  }

  /**
   * Assert that a table has the expected number of rows
   */
  async expectTableRows(tableSelector: string, expectedCount: number) {
    const rows = this.page.locator(`${tableSelector} tbody tr`);
    await expect(rows).toHaveCount(expectedCount);
  }

  /**
   * Assert that required form fields are present
   */
  async expectRequiredFields(fieldLabels: string[]) {
    for (const label of fieldLabels) {
      const field = this.page.locator(`label:has-text("${label}")`);
      await expect(field).toBeVisible();
      
      // Check if field is marked as required
      const required = this.page.locator(`input[required], select[required]`).filter({ 
        has: this.page.locator(`label:has-text("${label}")`) 
      });
      
      if (await required.count() > 0) {
        await expect(required.first()).toBeVisible();
      }
    }
  }
}
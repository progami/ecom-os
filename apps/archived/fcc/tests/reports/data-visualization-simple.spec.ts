import { test, expect, Page } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

// Helper to mock API responses
async function mockAPIResponse(page: Page, url: string, data: any) {
  await page.route(url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data)
    });
  });
}

// Helper to set up authentication
async function setupAuth(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userEmail', 'test@example.com');
    localStorage.setItem('userName', 'Test User');
    localStorage.setItem('organizationName', 'Test Org');
  });
}

test.describe('Report Data Visualization Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await setupAuth(page);
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test.afterEach(async () => {
    const errors = helpers.getRuntimeErrors();
    if (errors.length > 0) {
      throw new Error(`Runtime errors detected:\n\n${errors.map(err => 
        `[${err.source}] ${err.message}${err.stack ? '\n' + err.stack : ''}`
      ).join('\n\n')}`);
    }
  });

  test('Aged Payables - displays data correctly', async ({ page }) => {
    const mockData = {
      totalOutstanding: 125000.50,
      current: 45000,
      days1to30: 30000,
      days31to60: 25000,
      days61to90: 15000,
      days91Plus: 10000.50,
      contacts: [
        {
          contactId: 'cont-1',
          contactName: 'Supplier ABC Ltd',
          totalOutstanding: 50000,
          current: 20000,
          days1to30: 15000,
          days31to60: 10000,
          days61to90: 3000,
          days91Plus: 2000
        }
      ],
      summary: {
        contactCount: 1,
        percentageOverdue: 64,
        urgentPayments: 10000.50,
        criticalCashFlow: 75000
      },
      reportDate: '2025-06-26',
      source: 'xero',
      fetchedAt: new Date().toISOString()
    };

    
    // Wait for content to load
    await page.waitForSelector('.text-white', { timeout: 10000 });
    
    // Check that currency values are displayed
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toContain('£125,000.50');
    expect(pageContent).toContain('64%');
    
    // Check for chart containers
    const chartContainers = await page.locator('.recharts-wrapper').count();
    console.log(`Found ${chartContainers} chart containers`);
    
    // Check for data table
    const tableExists = await page.locator('table').isVisible();
    expect(tableExists).toBeTruthy();
    
    // Check table has rows
    const tableRows = await page.locator('tbody tr').count();
    expect(tableRows).toBeGreaterThan(0);
  });

  test('Cash Flow - displays trends and activities', async ({ page }) => {
    const mockData = {
      operatingActivities: {
        netCashFromOperating: 85000,
        receiptsFromCustomers: 250000,
        paymentsToSuppliers: -120000,
        paymentsToEmployees: -35000,
        interestPaid: -5000,
        incomeTaxPaid: -5000
      },
      investingActivities: {
        netCashFromInvesting: -25000,
        purchaseOfAssets: -30000,
        saleOfAssets: 5000
      },
      financingActivities: {
        netCashFromFinancing: 15000,
        proceedsFromBorrowing: 50000,
        repaymentOfBorrowing: -30000,
        dividendsPaid: -5000
      },
      summary: {
        netCashFlow: 75000,
        openingBalance: 100000,
        closingBalance: 175000,
        operatingCashFlowRatio: 34
      },
      monthlyTrends: [
        { month: 'Jan', operating: 12000, investing: -5000, financing: 2000, netCashFlow: 9000 },
        { month: 'Feb', operating: 15000, investing: -3000, financing: 1000, netCashFlow: 13000 }
      ],
      fromDate: '2025-01-01',
      toDate: '2025-06-26',
      reportDate: '2025-06-26',
      source: 'xero',
      fetchedAt: new Date().toISOString()
    };

    await mockAPIResponse(page, '**/api/v1/xero/reports/cash-flow*', mockData);
    await page.goto('/reports/cash-flow');
    
    // Wait for content
    await page.waitForSelector('.text-white', { timeout: 10000 });
    
    // Check key metrics are displayed
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toContain('£75,000');
    expect(pageContent).toContain('£175,000');
    expect(pageContent).toContain('34');
    
    // Check for charts
    const charts = await page.locator('.recharts-wrapper').count();
    console.log(`Found ${charts} charts on cash flow page`);
    
    // Check for cash flow activities table
    const tableVisible = await page.locator('table').isVisible();
    expect(tableVisible).toBeTruthy();
  });

  test('Balance Sheet - displays asset/liability breakdown', async ({ page }) => {
    const mockData = {
      assets: {
        currentAssets: [
          { accountId: 'acc-1', accountName: 'Cash', balance: 175000, accountType: 'BANK' }
        ],
        nonCurrentAssets: [
          { accountId: 'acc-2', accountName: 'Equipment', balance: 450000, accountType: 'FIXED' }
        ],
        totalAssets: 625000
      },
      liabilities: {
        currentLiabilities: [
          { accountId: 'acc-3', accountName: 'Payables', balance: -125000, accountType: 'CURRLIAB' }
        ],
        nonCurrentLiabilities: [
          { accountId: 'acc-4', accountName: 'Loans', balance: -200000, accountType: 'TERMLIAB' }
        ],
        totalLiabilities: -325000
      },
      equity: {
        accounts: [
          { accountId: 'acc-5', accountName: 'Capital', balance: 300000, accountType: 'EQUITY' }
        ],
        totalEquity: 300000
      },
      totalAssets: 625000,
      totalLiabilities: 325000,
      totalEquity: 300000,
      netAssets: 300000,
      currentAssets: 175000,
      nonCurrentAssets: 450000,
      currentLiabilities: 125000,
      nonCurrentLiabilities: 200000,
      workingCapital: 50000,
      currentRatio: 1.4,
      equityRatio: 48,
      summary: {
        netAssets: 300000,
        currentRatio: 1.4,
        quickRatio: 1.2,
        debtToEquityRatio: 1.08,
        equityRatio: 48
      },
      reportDate: '2025-06-26',
      source: 'xero',
      fetchedAt: new Date().toISOString()
    };

    await mockAPIResponse(page, '**/api/v1/xero/reports/balance-sheet*', mockData);
    await page.goto('/reports/balance-sheet');
    
    // Wait for content
    await page.waitForSelector('.text-white', { timeout: 10000 });
    
    // Check key values
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toContain('£625,000');
    expect(pageContent).toContain('£300,000');
    expect(pageContent).toContain('1.4');
    expect(pageContent).toContain('48');
    
    // Check for visualization elements
    const charts = await page.locator('.recharts-wrapper').count();
    console.log(`Found ${charts} charts on balance sheet`);
  });

  test('P&L Report - displays revenue/expense breakdown', async ({ page }) => {
    const mockData = {
      revenue: {
        operatingRevenue: [
          { accountId: 'rev-1', accountName: 'Sales', balance: 450000, accountType: 'REVENUE' }
        ],
        otherIncome: [],
        totalRevenue: 450000
      },
      expenses: {
        costOfSales: [
          { accountId: 'exp-1', accountName: 'COGS', balance: -200000, accountType: 'DIRECTCOSTS' }
        ],
        operatingExpenses: [
          { accountId: 'exp-2', accountName: 'Salaries', balance: -100000, accountType: 'EXPENSE' }
        ],
        otherExpenses: [],
        totalExpenses: -300000
      },
      totalRevenue: 450000,
      totalExpenses: 300000,
      grossProfit: 250000,
      operatingProfit: 150000,
      netProfit: 150000,
      profitability: {
        grossProfit: 250000,
        operatingProfit: 150000,
        ebitda: 160000,
        netProfit: 150000
      },
      margins: {
        grossMargin: 55.6,
        operatingMargin: 33.3,
        ebitdaMargin: 35.6,
        netMargin: 33.3
      },
      fromDate: '2025-01-01',
      toDate: '2025-06-26',
      reportDate: '2025-06-26',
      source: 'xero',
      fetchedAt: new Date().toISOString()
    };

    await mockAPIResponse(page, '**/api/v1/xero/reports/profit-loss*', mockData);
    await page.goto('/reports/profit-loss');
    
    // Wait for content
    await page.waitForSelector('.text-white', { timeout: 10000 });
    
    // Check key metrics
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toContain('£450,000');
    expect(pageContent).toContain('£150,000');
    expect(pageContent).toContain('55.6%');
    expect(pageContent).toContain('33.3%');
    
    // Check margin indicators
    const marginCards = await page.locator('h4:has-text("Margin")').count();
    expect(marginCards).toBeGreaterThan(0);
  });

  test('Number formatting is consistent', async ({ page }) => {
    const mockData = {
      totalOutstanding: 1234567.89,
      current: 1000000,
      days1to30: 234567.89,
      days31to60: 0,
      days61to90: 0,
      days91Plus: 0,
      contacts: [],
      summary: {
        contactCount: 0,
        percentageOverdue: 19,
        urgentPayments: 0,
        criticalCashFlow: 1234567.89
      },
      reportDate: '2025-06-26',
      source: 'xero',
      fetchedAt: new Date().toISOString()
    };

    
    await page.waitForSelector('.text-white', { timeout: 10000 });
    
    // Check large number formatting
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toMatch(/£1,234,567\.89/);
    expect(pageContent).toContain('19%');
  });

  test('Empty state is handled gracefully', async ({ page }) => {
    const emptyData = {
      totalOutstanding: 0,
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      days91Plus: 0,
      contacts: [],
      summary: {
        contactCount: 0,
        percentageOverdue: 0,
        urgentPayments: 0,
        criticalCashFlow: 0
      },
      reportDate: '2025-06-26',
      source: 'xero',
      fetchedAt: new Date().toISOString()
    };

    
    await page.waitForSelector('.text-white', { timeout: 10000 });
    
    // Should show zero values properly
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toContain('£0');
    
    // Table should show empty message
    const emptyMessage = await page.locator('text=/No aged payables found|No data/i').isVisible();
    expect(emptyMessage).toBeTruthy();
  });

  test('Chart responsiveness on mobile', async ({ page }) => {
    const mockData = {
      operatingActivities: { netCashFromOperating: 50000 },
      investingActivities: { netCashFromInvesting: -10000 },
      financingActivities: { netCashFromFinancing: 5000 },
      summary: {
        netCashFlow: 45000,
        openingBalance: 100000,
        closingBalance: 145000,
        operatingCashFlowRatio: 25
      },
      reportDate: '2025-06-26',
      source: 'xero',
      fetchedAt: new Date().toISOString()
    };

    await mockAPIResponse(page, '**/api/v1/xero/reports/cash-flow*', mockData);
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/reports/cash-flow');
    
    await page.waitForSelector('.text-white', { timeout: 10000 });
    
    // Charts should still be visible
    const chartsVisible = await page.locator('.recharts-wrapper').first().isVisible();
    expect(chartsVisible).toBeTruthy();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    
    const tabletChartsVisible = await page.locator('.recharts-wrapper').first().isVisible();
    expect(tabletChartsVisible).toBeTruthy();
  });
});
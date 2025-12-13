import { BrowserContext, Page } from '@playwright/test';

/**
 * Test authentication utilities for Playwright tests
 * Provides cookie-based authentication bypass for faster, more reliable tests
 */

// Pre-generated test user sessions
export const TEST_USERS = {
  default: {
    userId: 'test-user-1',
    email: 'test@example.com',
    name: 'Test User',
    tenantId: 'test-tenant-1',
    tenantName: 'Test Company Ltd',
    organizationId: 'test-org-1',
    hasXeroConnection: true,
    hasData: true
  },
  admin: {
    userId: 'test-admin-1',
    email: 'admin@example.com',
    name: 'Test Admin',
    tenantId: 'test-tenant-1',
    tenantName: 'Test Company Ltd',
    organizationId: 'test-org-1',
    hasXeroConnection: true,
    hasData: true,
    isAdmin: true
  },
  noData: {
    userId: 'test-user-2',
    email: 'newuser@example.com',
    name: 'New User',
    tenantId: 'test-tenant-2',
    tenantName: 'New Company Ltd',
    organizationId: 'test-org-2',
    hasXeroConnection: false,
    hasData: false
  },
  trademan: {
    userId: 'user-1',
    email: 'ajarrar@trademanenterprise.com',
    name: 'TRADEMAN ENTERPRISE',
    tenantId: '!Qn7M1',
    tenantName: 'TRADEMAN ENTERPRISE LTD',
    organizationId: 'org-1',
    hasXeroConnection: true,
    hasData: true
  }
};

// Mock Xero token for authenticated sessions
const MOCK_XERO_TOKEN = {
  access_token: 'mock-access-token-' + Date.now(),
  refresh_token: 'mock-refresh-token-' + Date.now(),
  expires_at: Date.now() + (30 * 60 * 1000), // 30 minutes from now
  token_type: 'Bearer',
  scope: 'accounting.transactions accounting.reports.read'
};

/**
 * Inject authentication cookies into browser context
 */
export async function injectAuthCookies(
  context: BrowserContext,
  userType: keyof typeof TEST_USERS = 'default'
) {
  const user = TEST_USERS[userType];
  
  // Create user session cookie
  const userSessionCookie = {
    name: 'user_session',
    value: JSON.stringify({
      user: {
        id: user.userId,
        email: user.email,
        name: user.name
      },
      userId: user.userId,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenantName,
      organizationId: user.organizationId
    }),
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false, // false for localhost - matches middleware behavior
    sameSite: 'Lax' as const,
    expires: Date.now() / 1000 + (30 * 24 * 60 * 60) // 30 days
  };

  // Create Xero token cookie if user has connection
  const xeroTokenCookie = user.hasXeroConnection ? {
    name: 'xero_token',
    value: JSON.stringify(MOCK_XERO_TOKEN),
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax' as const,
    expires: Date.now() / 1000 + (30 * 24 * 60 * 60)
  } : null;

  const cookies = [userSessionCookie];
  if (xeroTokenCookie) {
    cookies.push(xeroTokenCookie);
  }

  await context.addCookies(cookies);
}

/**
 * Create an authenticated browser context
 */
export async function createAuthenticatedContext(
  browser: any,
  userType: keyof typeof TEST_USERS = 'default'
) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  
  await injectAuthCookies(context, userType);
  
  return context;
}

/**
 * Navigate to a page with authentication already set up
 */
export async function authenticatedGoto(
  page: Page,
  url: string,
  userType: keyof typeof TEST_USERS = 'default'
) {
  // Inject cookies before navigation
  await injectAuthCookies(page.context(), userType);
  
  // Navigate without dev_bypass
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
}

/**
 * Set up authentication state for client-side auth context
 */
export async function setupAuthState(
  page: Page,
  userType: keyof typeof TEST_USERS = 'default'
) {
  const user = TEST_USERS[userType];
  
  // Initialize auth state in localStorage (for client-side context)
  await page.evaluate((userData) => {
    // Set initial auth state that AuthContext might check
    window.localStorage.setItem('isAuthenticated', 'true');
    window.localStorage.setItem('userEmail', userData.email);
    window.localStorage.setItem('userName', userData.name);
    window.localStorage.setItem('organizationName', userData.tenantName);
    
    // Dispatch storage event to notify AuthContext
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'isAuthenticated',
      newValue: 'true',
      storageArea: window.localStorage
    }));
  }, user);
}

/**
 * Clear all authentication
 */
export async function clearAuth(context: BrowserContext) {
  await context.clearCookies();
  
  // Clear localStorage on all pages
  const pages = context.pages();
  for (const page of pages) {
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  }
}

/**
 * Mock API auth endpoints for testing
 */
export async function mockAuthEndpoints(page: Page, userType: keyof typeof TEST_USERS = 'default') {
  const user = TEST_USERS[userType];
  
  // Mock session check endpoint
  await page.route('**/api/v1/auth/session', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: {
          id: user.userId,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          tenantName: user.tenantName
        }
      })
    });
  });
  
  // Mock auth status endpoint
  await page.route('**/api/v1/auth/status', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        isAuthenticated: true,
        hasActiveToken: user.hasXeroConnection,
        hasData: user.hasData,
        user: {
          email: user.email,
          name: user.name
        },
        organization: {
          id: user.organizationId,
          name: user.tenantName,
          tenantId: user.tenantId
        },
        lastSync: user.hasData ? new Date().toISOString() : null
      })
    });
  });
}

/**
 * Enhanced test helper that combines cookie injection with existing dev bypass
 */
export async function navigateWithAuth(
  page: Page,
  path: string,
  options: {
    userType?: keyof typeof TEST_USERS;
    useCookies?: boolean;
    useDevBypass?: boolean;
    mockEndpoints?: boolean;
  } = {}
) {
  const {
    userType = 'default',
    useCookies = true,
    useDevBypass = false,
    mockEndpoints = true
  } = options;
  
  // Set up mocked endpoints if requested
  if (mockEndpoints) {
    await mockAuthEndpoints(page, userType);
  }
  
  // Inject cookies if requested
  if (useCookies) {
    await injectAuthCookies(page.context(), userType);
  }
  
  // Build URL with optional dev bypass
  const baseUrl = 'https://localhost:3003';
  const url = new URL(path, baseUrl);
  if (useDevBypass) {
    url.searchParams.set('dev_bypass', 'true');
  }
  
  // Navigate
  await page.goto(url.toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  
  // Set up client-side auth state if using cookies
  if (useCookies) {
    await setupAuthState(page, userType);
  }
}
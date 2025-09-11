import { test, expect } from '@playwright/test'

test.describe('Xero Connection Status', () => {
  test.describe('When user is not authenticated', () => {
    test.beforeEach(async ({ page, context }) => {
      // Clear all cookies to ensure user is not authenticated
      await context.clearCookies()
      
      // Go to a page that shows the connection status
      await page.goto('/reports/balance-sheet')
    })

    test('should show "Not Logged In" instead of "Disconnected"', async ({ page }) => {
      // Wait for the page to load
      await page.waitForLoadState('domcontentloaded')
      
      // Look for the connection status button
      const connectionButton = page.locator('button').filter({ hasText: /Not Logged In|Disconnected/ })
      
      // Should show "Not Logged In" text
      await expect(connectionButton).toContainText('Not Logged In')
      await expect(connectionButton).not.toContainText('Disconnected')
    })

    test('should redirect to login page when clicked', async ({ page }) => {
      // Wait for the page to load
      await page.waitForLoadState('domcontentloaded')
      
      // Click the connection status button
      const connectionButton = page.locator('button').filter({ hasText: 'Not Logged In' })
      await connectionButton.click()
      
      // Should redirect to login page
      await expect(page).toHaveURL('/login')
    })

    test('should not redirect to OAuth when clicked', async ({ page }) => {
      // Wait for the page to load
      await page.waitForLoadState('domcontentloaded')
      
      // Set up a listener to check if OAuth redirect is attempted
      let oauthRedirectAttempted = false
      page.on('request', request => {
        if (request.url().includes('/api/v1/xero/auth')) {
          oauthRedirectAttempted = true
        }
      })
      
      // Click the connection status button
      const connectionButton = page.locator('button').filter({ hasText: 'Not Logged In' })
      await connectionButton.click()
      
      // Wait a bit to ensure any redirects would have happened
      await page.waitForTimeout(1000)
      
      // Should NOT have attempted OAuth redirect
      expect(oauthRedirectAttempted).toBe(false)
    })

    test('should have appropriate styling and tooltip', async ({ page }) => {
      // Wait for the page to load
      await page.waitForLoadState('domcontentloaded')
      
      // Find the connection button
      const connectionButton = page.locator('button').filter({ hasText: 'Not Logged In' })
      
      // Check for the cursor-not-allowed class
      await expect(connectionButton).toHaveClass(/cursor-not-allowed/)
      
      // Check for opacity styling
      await expect(connectionButton).toHaveClass(/opacity-75/)
      
      // Check tooltip
      await expect(connectionButton).toHaveAttribute('title', 'Please log in to connect to Xero')
    })
  })

  test.describe('When user is authenticated but not connected to Xero', () => {
    test.beforeEach(async ({ page, context }) => {
      // Set up authenticated session
      await context.addCookies([
        {
          name: 'bookkeeping-session',
          value: 'test-session-token',
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          expires: Date.now() / 1000 + 86400 // 24 hours from now
        }
      ])
      
      // Go to a page that shows the connection status
      await page.goto('/reports/balance-sheet')
    })

    test('should show "Disconnected" text', async ({ page }) => {
      // Wait for the page to load
      await page.waitForLoadState('domcontentloaded')
      
      // Look for the connection status button
      const connectionButton = page.locator('button').filter({ hasText: /Not Logged In|Disconnected/ })
      
      // Should show "Disconnected" text when authenticated but not connected
      await expect(connectionButton).toContainText('Disconnected')
      await expect(connectionButton).not.toContainText('Not Logged In')
    })

    test('should redirect to OAuth when clicked', async ({ page }) => {
      // Wait for the page to load
      await page.waitForLoadState('domcontentloaded')
      
      // Set up a listener to check OAuth redirect
      let oauthUrl = ''
      page.on('request', request => {
        if (request.url().includes('/api/v1/xero/auth')) {
          oauthUrl = request.url()
        }
      })
      
      // Click the connection status button
      const connectionButton = page.locator('button').filter({ hasText: 'Disconnected' })
      await connectionButton.click()
      
      // Should redirect to OAuth endpoint
      await expect(page).toHaveURL(/\/api\/v1\/xero\/auth/)
      
      // Check that returnUrl is included
      expect(oauthUrl).toContain('returnUrl=')
    })

    test('should have appropriate styling and tooltip', async ({ page }) => {
      // Wait for the page to load
      await page.waitForLoadState('domcontentloaded')
      
      // Find the connection button
      const connectionButton = page.locator('button').filter({ hasText: 'Disconnected' })
      
      // Should NOT have cursor-not-allowed class
      await expect(connectionButton).not.toHaveClass(/cursor-not-allowed/)
      
      // Should NOT have reduced opacity
      await expect(connectionButton).not.toHaveClass(/opacity-75/)
      
      // Check tooltip
      await expect(connectionButton).toHaveAttribute('title', 'Click to connect to Xero')
    })
  })
})
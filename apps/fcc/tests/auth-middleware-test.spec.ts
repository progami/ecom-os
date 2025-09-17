import { test, expect } from '@playwright/test'
import { createAuthenticatedContext } from './utils/test-auth'

const HAS_AUTH_COOKIE = Boolean(process.env.FCC_AUTH_COOKIE)

test.describe('Centralized authentication middleware', () => {
  test('redirects unauthenticated users to central login', async ({ page }) => {
    await page.goto('/finance', { waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('/login')
    expect(page.url()).toContain('callbackUrl=')
  })

  test('allows navigation with a central auth cookie', async ({ browser }) => {
    test.skip(!HAS_AUTH_COOKIE, 'Set FCC_AUTH_COOKIE to run authenticated navigation tests')

    const context = await createAuthenticatedContext(browser)
    const page = await context.newPage()

    await page.goto('/finance', { waitUntil: 'domcontentloaded' })

    const currentUrl = new URL(page.url())
    expect(currentUrl.pathname).toBe('/finance')

    const response = await context.request.get('/api/v1/auth/session')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.authenticated).toBeTruthy()

    await context.close()
  })

  test('returns unauthenticated payload when session is missing', async ({ request }) => {
    const response = await request.get('/api/v1/auth/session')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.authenticated).toBe(false)
  })
})

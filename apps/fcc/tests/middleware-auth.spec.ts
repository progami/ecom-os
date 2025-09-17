import { test, expect } from '@playwright/test'
import { createAuthenticatedContext, clearAuth } from './utils/test-auth'

const HAS_AUTH_COOKIE = Boolean(process.env.FCC_AUTH_COOKIE)

test.describe('Authenticated navigation helpers', () => {
  test.skip(!HAS_AUTH_COOKIE, 'Set FCC_AUTH_COOKIE to run authenticated navigation tests')

  test('can open primary dashboards without redirect', async ({ browser }) => {
    const context = await createAuthenticatedContext(browser)
    const page = await context.newPage()

    const protectedRoutes = ['/finance', '/analytics', '/cashflow']

    for (const route of protectedRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      expect(new URL(page.url()).pathname).toBe(route)
    }

    await clearAuth(context)
    await context.close()
  })
})

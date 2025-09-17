import { test, expect } from '@playwright/test'
import { createAuthenticatedContext } from '../utils/test-auth'

const HAS_AUTH_COOKIE = Boolean(process.env.FCC_AUTH_COOKIE)

test.describe('Auth helper utilities', () => {
  test.skip(!HAS_AUTH_COOKIE, 'Set FCC_AUTH_COOKIE to run auth helper tests')

  test('injectAuthCookies populates central session cookies', async ({ browser }) => {
    const context = await createAuthenticatedContext(browser)
    const cookies = await context.cookies()

    expect(cookies.some(cookie => cookie.name.includes('next-auth'))).toBeTruthy()
    expect(cookies.some(cookie => cookie.name.includes('xero_token'))).toBeTruthy()

    await context.close()
  })
})

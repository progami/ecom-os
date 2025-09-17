import { test, expect } from '@playwright/test'
import { authenticatedGoto } from './utils/test-auth'

const HAS_AUTH_COOKIE = Boolean(process.env.FCC_AUTH_COOKIE)

test.describe('authenticatedGoto helper', () => {
  test.skip(!HAS_AUTH_COOKIE, 'Set FCC_AUTH_COOKIE to run authenticated navigation tests')

  test('navigates to target route without intermediary redirects', async ({ page }) => {
    await authenticatedGoto(page, '/finance')
    const url = new URL(page.url())
    expect(url.pathname).toBe('/finance')
  })
})

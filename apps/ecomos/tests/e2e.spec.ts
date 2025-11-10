import { test, expect } from '@playwright/test'

const portalBaseUrl = process.env.PORTAL_BASE_URL
if (!portalBaseUrl) {
  throw new Error('PORTAL_BASE_URL must be defined for ecomOS e2e tests.')
}

test('ecomOS home renders and shows portal title', async ({ page }) => {
  await page.goto(portalBaseUrl, { waitUntil: 'domcontentloaded' })
  // Either shows sign-in prompt or the launcher; both include the main brand text
  await expect(page.locator('text=ecomOS Portal')).toBeVisible()
})

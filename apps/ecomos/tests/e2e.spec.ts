import { test, expect } from '@playwright/test'

test('ecomOS home renders and shows portal title', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' })
  // Either shows sign-in prompt or the launcher; both include the main brand text
  await expect(page.locator('text=ecomOS Portal')).toBeVisible()
})


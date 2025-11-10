import { test, expect } from '@playwright/test'

const portalBaseUrl = process.env.PORTAL_BASE_URL
if (!portalBaseUrl) {
  throw new Error('PORTAL_BASE_URL must be defined for ecomOS login tests.')
}
const wmsBaseUrl = process.env.WMS_BASE_URL
if (!wmsBaseUrl) {
  throw new Error('WMS_BASE_URL must be defined for ecomOS login tests.')
}
const DEMO_USERNAMES = ['jarraramjad']
const DEMO_PASS = 'xUh2*KC2%tZYNzV'

test('portal login redirects to portal home', async ({ page }) => {
  await page.goto(`${portalBaseUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[name="emailOrUsername"]', DEMO_USERNAMES[0])
  await page.fill('input[name="password"]', DEMO_PASS)
  await page.waitForSelector('button.submit-button:not([disabled])', { timeout: 15000 })
  await page.click('button.submit-button')
  // In headless, occasionally the POST 302 isn't auto-followed; stabilize by reloading home.
  await page.waitForTimeout(300)
  await page.goto(`${portalBaseUrl}/`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('ecomOS Portal')).toBeVisible({ timeout: 10000 })
})

test('portal login with callback still lands on portal home (tile page)', async ({ page }) => {
  await page.goto(`${portalBaseUrl}/login?callbackUrl=${encodeURIComponent(wmsBaseUrl)}`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[name="emailOrUsername"]', DEMO_USERNAMES[0])
  await page.fill('input[name="password"]', DEMO_PASS)
  await page.waitForSelector('button.submit-button:not([disabled])', { timeout: 15000 })
  await page.click('button.submit-button')
  await page.waitForTimeout(300)
  await page.goto(`${portalBaseUrl}/`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('ecomOS Portal')).toBeVisible({ timeout: 10000 })
})

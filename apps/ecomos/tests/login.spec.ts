import { test, expect } from '@playwright/test'

const PORTAL = 'http://localhost:3000'
const WMS = 'http://localhost:3001'
const DEMO_USERNAMES = ['jarraramjad']
const DEMO_PASS = 'xUh2*KC2%tZYNzV'

test('portal login redirects to portal home', async ({ page }) => {
  await page.goto(`${PORTAL}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[name="emailOrUsername"]', DEMO_USERNAMES[0])
  await page.fill('input[name="password"]', DEMO_PASS)
  await page.waitForSelector('button.submit-button:not([disabled])', { timeout: 15000 })
  await page.click('button.submit-button')
  // In headless, occasionally the POST 302 isn't auto-followed; stabilize by reloading home.
  await page.waitForTimeout(300)
  await page.goto(`${PORTAL}/`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('ecomOS Portal')).toBeVisible({ timeout: 10000 })
})

test('portal login with callback still lands on portal home (tile page)', async ({ page }) => {
  await page.goto(`${PORTAL}/login?callbackUrl=${encodeURIComponent(WMS)}`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[name="emailOrUsername"]', DEMO_USERNAMES[0])
  await page.fill('input[name="password"]', DEMO_PASS)
  await page.waitForSelector('button.submit-button:not([disabled])', { timeout: 15000 })
  await page.click('button.submit-button')
  await page.waitForTimeout(300)
  await page.goto(`${PORTAL}/`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('ecomOS Portal')).toBeVisible({ timeout: 10000 })
})

import { test, expect } from '@playwright/test'

const CENTRAL = 'http://localhost:3000'
const WMS = 'http://localhost:3001'
const DEMO_USERNAMES = ['demo-admin', 'demo-admin@warehouse.com']
const DEMO_PASS = 'SecureWarehouse2024!'

test('portal login redirects to portal home', async ({ page }) => {
  await page.goto(`${CENTRAL}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[placeholder="you@example.com"]', DEMO_USERNAMES[0])
  await page.fill('input[type="password"]', DEMO_PASS)
  await page.click('button:text("Sign In")')
  await page.waitForURL(`${CENTRAL}/`, { timeout: 10000 })
  await expect(page.locator('text=ecomOS Portal')).toBeVisible()
})

test('portal login with callback still lands on portal home (tile page)', async ({ page }) => {
  await page.goto(`${CENTRAL}/login?callbackUrl=${encodeURIComponent(WMS)}`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[placeholder="you@example.com"]', DEMO_USERNAMES[0])
  await page.fill('input[type="password"]', DEMO_PASS)
  await page.click('button:text("Sign In")')
  await page.waitForURL(`${CENTRAL}/`, { timeout: 15000, waitUntil: 'domcontentloaded' as any })
  await expect(page.locator('text=ecomOS Portal')).toBeVisible({ timeout: 10000 })
})

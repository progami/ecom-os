import type { Page } from '@playwright/test'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} must be defined for HRMS e2e tests.`)
  }
  return value
}

const portalBaseUrl = requireEnv('PORTAL_BASE_URL')
const hrmsBaseUrl = requireEnv('HRMS_BASE_URL')

const DEMO_USERNAME = process.env.E2E_USERNAME || 'jarraramjad'
const DEMO_PASS = process.env.E2E_PASSWORD || 'xUh2*KC2%tZYNzV'

export async function loginToHrms(page: Page) {
  await page.goto(`${portalBaseUrl}/login?callbackUrl=${encodeURIComponent(hrmsBaseUrl)}`, {
    waitUntil: 'domcontentloaded',
  })

  // Portal now defaults to Google SSO; password login is not always available.
  // If the password form is not present, return false and let tests decide whether to skip.
  try {
    await page.waitForSelector('input[name="emailOrUsername"]', { timeout: 2_000 })
  } catch {
    return false
  }

  await page.fill('input[name="emailOrUsername"]', DEMO_USERNAME)
  await page.fill('input[name="password"]', DEMO_PASS)
  await page.waitForSelector('button.submit-button:not([disabled])', { timeout: 15_000 })
  await page.click('button.submit-button')

  // Stabilize redirect/cookie propagation.
  await page.waitForTimeout(300)
  await page.goto(hrmsBaseUrl, { waitUntil: 'domcontentloaded' })

  return true
}

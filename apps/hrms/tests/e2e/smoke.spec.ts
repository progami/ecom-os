import { test, expect } from '@playwright/test'
import { loginToHrms } from '../fixtures/auth'

const hrmsBaseUrl = process.env.HRMS_BASE_URL
if (!hrmsBaseUrl) {
  throw new Error('HRMS_BASE_URL must be defined for HRMS e2e tests.')
}

test('HRMS redirects to portal sign-in when signed out', async ({ page }) => {
  await page.goto(`${hrmsBaseUrl}/tasks`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('ecomOS Portal')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
})

test('create and delete a task', async ({ page }) => {
  const loggedIn = await loginToHrms(page)
  test.skip(!loggedIn, 'Portal uses Google SSO; password login not available for automation.')

  await page.goto(`${hrmsBaseUrl}/tasks/add`, { waitUntil: 'domcontentloaded' })

  const title = `E2E Task ${Date.now()}`
  await page.fill('input[name="title"]', title)
  await page.click('button:has-text("Create Task")')

  await expect(page.getByText(title)).toBeVisible()

  await page.click('button:has-text("Delete")')
  await page.waitForURL(new RegExp(`${hrmsBaseUrl.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}/tasks$`), { timeout: 15_000 })
})

test('tasks page loads (authenticated)', async ({ page }) => {
  const loggedIn = await loginToHrms(page)
  test.skip(!loggedIn, 'Portal uses Google SSO; password login not available for automation.')

  await page.goto(`${hrmsBaseUrl}/tasks`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Tasks', { exact: true })).toBeVisible()
})

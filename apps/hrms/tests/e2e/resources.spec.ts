import { test, expect } from '@playwright/test'

test.describe('Resources (Service Providers)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/hrms/resources')
  })

  test('should display providers page', async ({ page }) => {
    await expect(page.locator('h1:has-text("Service Providers")')).toBeVisible()
    await expect(page.locator('input[placeholder*="Search resources"]').first()).toBeVisible()
  })

  test('should show category chips', async ({ page }) => {
    const categories = ['All Providers', 'Accounting', 'Legal', 'Design', 'Marketing', 'IT Services', 'HR Services', 'Other']
    for (const label of categories) {
      await expect(page.locator('button').filter({ hasText: label }).first()).toBeVisible()
    }
  })
})


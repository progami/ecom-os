import { test, expect } from '@playwright/test'

test.describe('Policies', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/hrms/policies')
  })

  test('should display policies page', async ({ page }) => {
    await expect(page.locator('h1:has-text("Policies")')).toBeVisible()
    await expect(page.locator('button:has-text("Add Policy")')).toBeVisible()
    await expect(page.locator('input[placeholder*="Search policies"]').first()).toBeVisible()
  })

  test('should show category filters', async ({ page }) => {
    const categories = ['All', 'Leave', 'Performance', 'Conduct', 'Security', 'Compensation', 'Other']
    for (const label of categories) {
      await expect(page.locator('button').filter({ hasText: label }).first()).toBeVisible()
    }
  })
})


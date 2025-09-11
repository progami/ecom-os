import { test, expect } from '@playwright/test'

test.describe('Employee Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/hrms/employees')
  })

  test('should display employee list structure', async ({ page }) => {
    // Check table headers
    await expect(page.locator('th:has-text("Employee")')).toBeVisible()
    await expect(page.locator('th:has-text("Department")')).toBeVisible()
    await expect(page.locator('th:has-text("Position")')).toBeVisible()
    await expect(page.locator('th:has-text("Status")')).toBeVisible()
    
    // Table is present even if no rows yet
    await expect(page.locator('table')).toBeVisible()
  })

  test('should allow searching employees', async ({ page }) => {
    await page.fill('input[placeholder*="Search employees"]', 'John')
    // In minimal mode, just ensure input works
    await expect(page.locator('input[placeholder*="Search employees"]')).toHaveValue('John')
  })

  test('should toggle filters', async ({ page }) => {
    // Filters should be hidden initially
    await expect(page.locator('text=Department').nth(1)).not.toBeVisible()
    
    // Click filter button
    await page.click('button:has-text("Filters")')
    
    // Filters should be visible
    await expect(page.locator('select').first()).toBeVisible()
  })

  test('should navigate to add employee page', async ({ page }) => {
    await page.click('a:has-text("Add Employee")')
    await expect(page).toHaveURL('/hrms/employees/add')
    await expect(page.locator('h1:has-text("Add New Employee")')).toBeVisible()
  })

  // Actions and detailed view are out of scope for minimal setup
})

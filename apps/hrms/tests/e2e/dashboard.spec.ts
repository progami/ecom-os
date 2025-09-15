import { test, expect } from '@playwright/test'

test.describe('HRMS Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/hrms')
  })

  test('should display all dashboard components', async ({ page }) => {
    // Check header
    await expect(page.locator('h1:has-text("HR Dashboard")')).toBeVisible()
    await expect(page.locator('text=Welcome to your HR Management System')).toBeVisible()
    
    // Check stats cards (lean set)
    await expect(page.locator('text=Total Employees')).toBeVisible()
    await expect(page.locator('h3:has-text("Resources")')).toBeVisible()
    await expect(page.locator('h3:has-text("Policies")')).toBeVisible()
    
    // Check section headers exist
    await expect(page.locator('h2:has-text("Recent Activity")')).toBeVisible()
    await expect(page.locator('h2:has-text("Upcoming Events")')).toBeVisible()
    
    // Check additional metrics
    await expect(page.locator('text=Payroll This Month')).toBeVisible()
    // Values are mock; presence of the section is enough
  })

  test('should have proper gradient styling', async ({ page }) => {
    // Check gradient text
    const gradientText = page.locator('.text-gradient').first()
    await expect(gradientText).toHaveCSS('background-image', /gradient/)
    
    // Check gradient borders
    const gradientBorder = page.locator('.gradient-border').first()
    await expect(gradientBorder).toBeVisible()
  })

  test('should have hover effects on cards', async ({ page }) => {
    // Get a stats card
    const statsCard = page.locator('.hover-glow').first()
    
    // Check initial state
    await expect(statsCard).toBeVisible()
    
    // Hover and check for glow effect
    await statsCard.hover()
    // The hover effect should add box-shadow
    await expect(statsCard).toHaveCSS('box-shadow', /rgba/)
  })

  test('should be responsive', async ({ page }) => {
    // Desktop view - 4 columns
    await expect(page.locator('.grid.lg\\:grid-cols-4 > div')).toHaveCount(4)
    
    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.locator('.grid.md\\:grid-cols-2 > div').first()).toBeVisible()
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('.grid.grid-cols-1 > div').first()).toBeVisible()
  })
})

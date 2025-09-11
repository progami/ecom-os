import { test, expect } from '@playwright/test'

test.describe('UI Inventory', () => {
  test('should have all required UI components', async ({ page }) => {
    // Test all button variants
    await page.goto('/hrms')
    
    // Primary buttons (gradient)
    const primaryButtons = page.locator('.bg-gradient-to-r.from-purple-500.to-pink-500')
    await expect(primaryButtons.first()).toBeVisible()
    
    // Secondary buttons
    const secondaryButtons = page.locator('button.bg-slate-800')
    await expect(secondaryButtons.first()).toBeVisible()
    
    // Test navigation
    await page.goto('/hrms/employees')
    
    // Search inputs
    await expect(page.locator('input[type="text"]').first()).toBeVisible()
    
    // Tables
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('thead')).toBeVisible()
    await expect(page.locator('tbody')).toBeVisible()
    
    // Dropdowns
    await page.click('button:has-text("Filters")')
    await expect(page.locator('select').first()).toBeVisible()
    
    // Cards with gradient borders
    await page.goto('/hrms')
    await expect(page.locator('.gradient-border').first()).toBeVisible()
    await expect(page.locator('.gradient-border-content').first()).toBeVisible()
    
    // Icons
    await expect(page.locator('svg').first()).toBeVisible()
  })

  test('should have consistent color scheme', async ({ page }) => {
    await page.goto('/hrms')
    
    // Background colors
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(2, 6, 23)') // slate-950
    
    // Text colors
    await expect(page.locator('h1').first()).toHaveCSS('color', 'rgb(241, 245, 249)') // slate-100
    
    // Border colors
    const borderElement = page.locator('.border-slate-800').first()
    await expect(borderElement).toBeVisible()
  })

  test('should have all form elements', async ({ page }) => {
    await page.goto('/hrms/employees/add')
    
    // Text inputs
    await expect(page.locator('input[type="text"]').first()).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="tel"]')).toBeVisible()
    await expect(page.locator('input[type="date"]')).toBeVisible()
    await expect(page.locator('input[type="number"]')).toBeVisible()
    
    // Select dropdowns
    await expect(page.locator('select').first()).toBeVisible()
    
    // Labels
    await expect(page.locator('label').first()).toBeVisible()
    
    // Form sections
    await expect(page.locator('text=Personal Information')).toBeVisible()
    await expect(page.locator('text=Employment Information')).toBeVisible()
  })

  test('should have loading states', async ({ page }) => {
    await page.goto('/hrms/employees/add')
    
    // Submit button should show loading state
    const submitButton = page.locator('button:has-text("Save Employee")')
    await expect(submitButton).toBeVisible()
    
    // Click to trigger loading
    await page.fill('input[placeholder="John"]', 'Test')
    await submitButton.click()
    
    // Should show loading text
    await expect(page.locator('text=Saving...')).toBeVisible()
  })

  test('should have proper spacing', async ({ page }) => {
    await page.goto('/hrms')
    
    // Check padding on main container
    const mainContainer = page.locator('main > div').first()
    await expect(mainContainer).toHaveCSS('padding', '32px') // p-8
    
    // Check spacing between sections
    const spaceY = page.locator('.space-y-8').first()
    await expect(spaceY).toBeVisible()
  })
})
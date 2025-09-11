import { test, expect } from '@playwright/test'

test.describe('HRMS Navigation', () => {
  test('should navigate through all main sections', async ({ page }) => {
    await page.goto('/hrms')
    
    // Check dashboard loads
    await expect(page.locator('h1:has-text("HR Dashboard")')).toBeVisible()
    
    // Navigate to Employees
    await page.click('a:has-text("Employees")')
    await expect(page).toHaveURL('/hrms/employees')
    await expect(page.locator('h1:has-text("Employees")')).toBeVisible()
    
    // Navigate to Resources
    await page.click('a:has-text("Resources")')
    await expect(page).toHaveURL('/hrms/resources')
    await expect(page.locator('h1:has-text("Service Providers")')).toBeVisible()
    
    // Navigate to Policies
    await page.click('a:has-text("Policies")')
    await expect(page).toHaveURL('/hrms/policies')
    await expect(page.locator('h1:has-text("Policies")')).toBeVisible()
  })

  test('should show active state for current page', async ({ page }) => {
    await page.goto('/hrms/employees')
    
    const activeLink = page.locator('a:has-text("Employees")')
    await expect(activeLink).toHaveClass(/bg-gradient-to-r/)
  })

  test('mobile navigation should work', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/hrms')
    
    // Mobile menu should be hidden initially
    await expect(page.locator('nav')).toHaveClass(/-translate-x-full/)
    
    // Click menu button
    await page.click('button:has-text("Menu")')
    
    // Navigation should be visible
    await expect(page.locator('nav')).not.toHaveClass(/-translate-x-full/)
  })
})

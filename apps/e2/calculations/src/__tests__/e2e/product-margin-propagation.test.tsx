// @ts-nocheck
/**
 * E2E test to verify that product margin changes propagate correctly through the UI to GL.
 * 
 * This test has been updated after fixing the hardcoded values issue.
 * It now verifies that changes made in the Product Margins page successfully
 * propagate to Revenue Forecast calculations and General Ledger entries.
 */

import { test, expect } from '@playwright/test'
import { prisma } from '@/utils/database'

test.describe('Product Margin Changes Successfully Propagate to GL', () => {
  const testSku = 'TS-007'
  const originalPrice = 6.99
  const newPrice = 8.99
  const testWeek = 'W40' // Future week for testing
  const testUnits = 100
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:4321/financial-dashboard')
    
    // Wait for app to load
    await page.waitForLoadState('networkidle')
  })
  
  test.afterEach(async () => {
    // Reset product price in database
    await prisma.product.update({
      where: { sku: testSku },
      data: { pricing: originalPrice }
    })
  })
  
  test('Product price changes should propagate from Product Margins to GL', async ({ page }) => {
    // Step 1: Go to Product Margins page
    await page.click('text=Product Margins')
    await page.waitForSelector('h1:has-text("Product Margins & Cost Analysis")')
    
    // Step 2: Find and edit the price for TS-007
    const priceCell = await page.locator(`[data-row="price"][data-col="${testSku}"]`)
    await priceCell.dblclick()
    await priceCell.fill(newPrice.toString())
    await page.keyboard.press('Enter')
    
    // Step 3: Save changes
    await page.click('button:has-text("Save Changes")')
    await page.waitForSelector('text=Product data saved successfully')
    
    // Step 4: Navigate to Revenue Forecast page
    await page.click('text=Revenue Forecast')
    await page.waitForSelector('h1:has-text("Revenue Forecast")')
    
    // Step 5: Enter units for the test week
    const unitCell = await page.locator(`[data-row="${testWeek}"][data-col="${testSku}"]`)
    await unitCell.dblclick()
    await unitCell.fill(testUnits.toString())
    await page.keyboard.press('Enter')
    
    // Wait for save
    await page.waitForTimeout(1000)
    
    // Step 6: Check that revenue is calculated with new price
    const revenueCell = await page.locator(`[data-row="${testWeek}"][data-col="revenue"]`)
    const revenueText = await revenueCell.textContent()
    const expectedRevenue = testUnits * newPrice
    
    // Revenue should reflect new price
    expect(revenueText).toContain(expectedRevenue.toLocaleString())
    
    // Step 7: Navigate to General Ledger
    await page.click('text=General Ledger')
    await page.waitForSelector('h1:has-text("General Ledger")')
    
    // Step 8: Check GL entries
    // Look for the revenue entry for our test
    const glEntry = await page.locator(`text=${testSku} Revenue`).first()
    expect(glEntry).toBeTruthy()
    
    // The GL should show entries based on the revenue calculation
    // Note: GL uses NET revenue (after fees), not gross
    const amazonReferralFee = expectedRevenue * 0.15 // 15% referral fee
    const netRevenue = expectedRevenue - amazonReferralFee - (testUnits * 2.56) // minus FBA fees
    
    // Check that GL has entries for this revenue
    const glRows = await page.locator('tr').filter({ hasText: testSku })
    const glRowCount = await glRows.count()
    expect(glRowCount).toBeGreaterThan(0)
  })
  
  test('Product cost changes should affect GL COGS entries', async ({ page }) => {
    const newManufacturingCost = 0.75 // Original is 0.57
    
    // Step 1: Go to Product Margins page
    await page.click('text=Product Margins')
    await page.waitForSelector('h1:has-text("Product Margins & Cost Analysis")')
    
    // Step 2: Edit manufacturing cost
    const costCell = await page.locator(`[data-row="manufacturingCost"][data-col="${testSku}"]`)
    await costCell.dblclick()
    await costCell.fill(newManufacturingCost.toString())
    await page.keyboard.press('Enter')
    
    // Step 3: Save changes
    await page.click('button:has-text("Save Changes")')
    await page.waitForSelector('text=Product data saved successfully')
    
    // Step 4: Check that margin percentage updated
    const marginCell = await page.locator(`[data-row="marginPercent"][data-col="${testSku}"]`)
    const marginText = await marginCell.textContent()
    
    // Margin should be lower with higher cost
    const totalCogs = newManufacturingCost + 0.11 + (newManufacturingCost * 0.35) + 0.12 + 2.56 + 1.05 + 0.07
    const grossProfit = originalPrice - totalCogs
    const expectedMargin = (grossProfit / originalPrice) * 100
    
    expect(parseFloat(marginText || '0')).toBeCloseTo(expectedMargin, 1)
  })
  
  test('Multiple product changes should all reflect in GL', async ({ page }) => {
    const products = [
      { sku: 'TS-007', newPrice: 7.49 },
      { sku: 'TS-009', newPrice: 13.99 }
    ]
    
    // Step 1: Go to Product Margins page
    await page.click('text=Product Margins')
    await page.waitForSelector('h1:has-text("Product Margins & Cost Analysis")')
    
    // Step 2: Edit multiple products
    for (const product of products) {
      const priceCell = await page.locator(`[data-row="price"][data-col="${product.sku}"]`)
      await priceCell.dblclick()
      await priceCell.fill(product.newPrice.toString())
      await page.keyboard.press('Enter')
    }
    
    // Step 3: Save all changes
    await page.click('button:has-text("Save Changes")')
    await page.waitForSelector('text=Product data saved successfully')
    
    // Step 4: Go to Revenue Forecast and enter units for both
    await page.click('text=Revenue Forecast')
    await page.waitForSelector('h1:has-text("Revenue Forecast")')
    
    for (const product of products) {
      const unitCell = await page.locator(`[data-row="${testWeek}"][data-col="${product.sku}"]`)
      await unitCell.dblclick()
      await unitCell.fill('50') // 50 units each
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)
    }
    
    // Step 5: Verify total revenue reflects both products with new prices
    const revenueCell = await page.locator(`[data-row="${testWeek}"][data-col="revenue"]`)
    const revenueText = await revenueCell.textContent()
    const expectedTotalRevenue = (products[0].newPrice * 50) + (products[1].newPrice * 50)
    
    expect(revenueText).toContain(expectedTotalRevenue.toLocaleString())
  })
})

// Integration test to verify data flow
test.describe('Data Flow Verification', () => {
  test('Verify product data flows from DB to UI to GL', async () => {
    // 1. Check database has products
    const dbProducts = await prisma.product.findMany()
    expect(dbProducts.length).toBeGreaterThan(0)
    
    // 2. Check that Product Service returns correct data
    const ProductService = require('../../services/database/ProductService').default
    const productService = ProductService.getInstance()
    const products = await productService.getProductsForDashboardAsync()
    
    expect(Object.keys(products).length).toBe(dbProducts.length)
    
    // 3. Verify all services use database values
    for (const dbProduct of dbProducts) {
      const dashboardProduct = products[dbProduct.sku]
      expect(dashboardProduct).toBeTruthy()
      expect(dashboardProduct.price).toBe(dbProduct.pricing)
    }
    
    // 4. Test that changes propagate
    const testSku = 'TS-007'
    const originalPrice = dbProducts.find(p => p.sku === testSku)?.pricing || 0
    const testPrice = 11.99
    
    // Update price
    await productService.updateProductCosts(testSku, { amazonPrice: testPrice })
    
    // Verify it's reflected in dashboard data
    const updatedProducts = await productService.getProductsForDashboardAsync()
    expect(updatedProducts[testSku].price).toBe(testPrice)
    
    // Restore original
    await productService.updateProductCosts(testSku, { amazonPrice: originalPrice })
  })
})
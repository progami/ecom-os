// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import ProductService from '@/services/database/ProductService'
import { RevenueService } from '@/lib/services/RevenueService'
import ExpenseService from '@/services/database/ExpenseService'
import { GLProcessingService } from '@/lib/services/GLProcessingService'
import { prisma } from '@/utils/database'

describe('End-to-End Product Margin Propagation', () => {
  let productService: ProductService
  let revenueService: RevenueService
  let expenseService: ExpenseService
  
  beforeAll(async () => {
    // Initialize services
    productService = ProductService.getInstance()
    await productService.initializeCache()
    
    revenueService = await RevenueService.getInstance()
    expenseService = ExpenseService.getInstance()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('should propagate product price changes through entire system', async () => {
    // Test with TS-007 product
    const sku = 'TS-007'
    const originalPrice = 6.99
    const newPrice = 9.99
    const units = 100
    
    // Step 1: Verify original price
    const originalProduct = productService.getProduct(sku)
    expect(originalProduct).toBeDefined()
    expect(originalProduct?.price).toBe(originalPrice)
    
    // Step 2: Calculate financials with original price
    const originalFinancials = productService.calculateProductFinancials(sku, units)
    expect(originalFinancials.revenue).toBe(originalPrice * units)
    
    // Step 3: Update product price in database
    await productService.updateProductCosts(sku, {
      amazonPrice: newPrice
    })
    
    // Step 4: Verify price updated in ProductService cache
    const updatedProduct = productService.getProduct(sku)
    expect(updatedProduct?.price).toBe(newPrice)
    
    // Step 5: Verify financial calculations use new price
    const updatedFinancials = productService.calculateProductFinancials(sku, units)
    expect(updatedFinancials.revenue).toBe(newPrice * units)
    expect(updatedFinancials.revenue).toBeGreaterThan(originalFinancials.revenue)
    
    // Step 6: Verify RevenueService uses new price
    const productFromRevenue = revenueService['productService'].getProduct(sku)
    expect(productFromRevenue?.price).toBe(newPrice)
    
    // Step 7: Verify ExpenseService uses updated product data
    const allProducts = expenseService['productService'].getAllProducts()
    expect(allProducts[sku].price).toBe(newPrice)
    
    // Step 8: Verify GL Processing uses updated margins
    const glProcessor = new GLProcessingService()
    const productMargins = productService.getProductMargins()
    const glProduct = productMargins.find(p => p.sku === sku)
    expect(glProduct?.retailPrice).toBe(newPrice)
    
    // Reset price for other tests
    await productService.updateProductCosts(sku, {
      amazonPrice: originalPrice
    })
  })

  it('should calculate correct margins after cost updates', async () => {
    const sku = 'TS-009'
    const units = 50
    
    // Get original costs
    const originalProduct = productService.getProduct(sku)
    const originalManufacturingCost = originalProduct?.manufacturingCost || 0
    
    // Update manufacturing cost
    const newManufacturingCost = originalManufacturingCost * 1.2 // 20% increase
    await productService.updateProductCosts(sku, {
      manufacturingCost: newManufacturingCost
    })
    
    // Calculate new financials
    const financials = productService.calculateProductFinancials(sku, units)
    
    // Verify COGS includes new manufacturing cost
    const expectedCogs = units * (newManufacturingCost + (originalProduct?.freightCost || 0) + 
                                  (newManufacturingCost * ((originalProduct?.tariffRate || 0) / 100)))
    expect(financials.cogs).toBeCloseTo(expectedCogs, 2)
    
    // Verify margin decreased due to higher costs
    expect(financials.grossMargin).toBeLessThan(50) // Assuming margin was > 50% before
    
    // Reset cost
    await productService.updateProductCosts(sku, {
      manufacturingCost: originalManufacturingCost
    })
  })

  it('should handle multiple product updates in transaction', async () => {
    const updates = [
      { sku: 'TS-007', data: { amazonPrice: 7.49 } },
      { sku: 'TS-009', data: { amazonPrice: 13.49 } },
      { sku: 'TS-010', data: { amazonPrice: 15.49 } }
    ]
    
    // Batch update
    await productService.updateMultipleProducts(updates)
    
    // Verify all updates applied
    updates.forEach(({ sku, data }) => {
      const product = productService.getProduct(sku)
      expect(product?.price).toBe(data.amazonPrice)
    })
    
    // Reset prices
    const resets = [
      { sku: 'TS-007', data: { amazonPrice: 6.99 } },
      { sku: 'TS-009', data: { amazonPrice: 12.99 } },
      { sku: 'TS-010', data: { amazonPrice: 14.99 } }
    ]
    await productService.updateMultipleProducts(resets)
  })

  it('should maintain data consistency across service restarts', async () => {
    const sku = 'TS-US-001'
    
    // Update price
    await productService.updateProductCosts(sku, {
      amazonPrice: 8.49
    })
    
    // Simulate service restart by invalidating cache
    await productService.invalidateCache()
    
    // Verify price persisted after cache reload
    const product = productService.getProduct(sku)
    expect(product?.price).toBe(8.49)
    
    // Reset price
    await productService.updateProductCosts(sku, {
      amazonPrice: 7.99
    })
  })
})
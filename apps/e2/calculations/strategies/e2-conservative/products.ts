/**
 * Product definitions and seeding for E2 Conservative Strategy
 */

import { API_BASE, FINANCIAL, SALES_CONFIG } from './business-logic'

export const PRODUCT_DEFINITIONS = [
  {
    sku: '6PK - 7M',
    name: '7 Micron - 6 Pack',
    manufacturingCost: 0.588,
    freightCost: 0.10,
    price: 6.99,
    tariffRate: 0.35,
    awd: 0.12,
    micron: 7,
    packSize: 6,
    dimensions: { length: 27, width: 22.5, height: 1.7 },
    weightGrams: 322.34,
    weightOz: 11.37,
    density: 0.93,
    productArea: 108,
    tacos: 0.15,  // 15% TACoS for 6PK (from stable main)
    refundRate: FINANCIAL.DEFAULT_REFUND_RATE
  },
  {
    sku: '12PK - 7M',
    name: '7 Micron - 12 Pack',
    manufacturingCost: 1.176,
    freightCost: 0.25,
    price: 12.99,
    tariffRate: 0.35,
    awd: 0.24,
    micron: 7,
    packSize: 12,
    dimensions: { length: 27, width: 22.5, height: 3.8 },
    weightGrams: 574.69,
    weightOz: 20.27,
    density: 0.93,
    productArea: 108,
    tacos: 0.07,  // 7% TACoS for 12PK (from stable main)
    refundRate: FINANCIAL.DEFAULT_REFUND_RATE
  },
  {
    sku: '1PK - 32M',
    name: '32 Micron - 1 Pack',
    manufacturingCost: 0.390,
    freightCost: 0.08,
    price: 7.99,
    tariffRate: 0.35,
    awd: 0.09,
    micron: 32,
    packSize: 1,
    dimensions: { length: 27, width: 22.5, height: 1.3 },
    weightGrams: 225.12,
    weightOz: 7.94,
    density: 0.93,
    productArea: 108,
    tacos: 0.07,  // 7% TACoS for 1PK (from stable main)
    refundRate: 0.01
  },
  {
    sku: '3PK - 32M',
    name: '32 Micron - 3 Pack',
    manufacturingCost: 1.170,
    freightCost: 0.21,
    price: 12.99,
    tariffRate: 0.35,
    awd: 0.27,
    micron: 32,
    packSize: 3,
    dimensions: { length: 27, width: 22.5, height: 3.8 },
    weightGrams: 655.36,
    weightOz: 23.12,
    density: 0.93,
    productArea: 108,
    tacos: 0.07,  // 7% TACoS for 3PK (from stable main)
    refundRate: 0.01
  }
]

export async function seedProducts(strategyId: string) {
  console.log('📦 SEEDING PRODUCTS...')
  
  let created = 0
  let skipped = 0
  
  for (const product of PRODUCT_DEFINITIONS) {
    const response = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Required fields
        sku: product.sku,
        name: product.name,
        
        // Input fields only (editable in UI)
        amazonPrice: product.price,
        manufacturingCost: product.manufacturingCost,
        freightCost: product.freightCost,
        warehouseCost: product.awd,
        
        // Product configuration inputs
        sourcingCountry: 'China',
        destinationMarket: 'US',
        packSize: product.packSize,
        micron: product.micron,
        
        // Physical dimensions inputs
        length: product.dimensions.length,
        width: product.dimensions.width,
        height: product.dimensions.height,
        productArea: product.productArea,
        density: product.density,
        weightGrams: product.weightGrams,
        
        // Rate inputs (percentages)
        tariffRate: product.tariffRate,
        tacos: product.tacos,
        refundRate: product.refundRate,
        
        // Strategy context
        strategyId: strategyId
      })
    })
    
    if (response.ok) {
      console.log(`✅ Created ${product.sku}: ${product.name}`)
      created++
    } else if (response.status === 409) {
      console.log(`   Skipped ${product.sku}: Already exists`)
      skipped++
    } else {
      console.log(`❌ Failed to create ${product.sku}: ${response.statusText}`)
    }
  }
  
  console.log('\n📊 PRODUCT SEEDING SUMMARY:')
  console.log(`   Created: ${created} products`)
  console.log(`   Skipped: ${skipped} products (already existed)`)
  console.log(`   Total: ${PRODUCT_DEFINITIONS.length} products`)
  
  return true
}

export function getProductSKUs(): string[] {
  return PRODUCT_DEFINITIONS.map(p => p.sku)
}
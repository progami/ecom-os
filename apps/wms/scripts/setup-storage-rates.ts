#!/usr/bin/env tsx

/**
 * Setup Storage Rates for Testing
 * 
 * This script adds storage rates to warehouses for testing the storage cost system
 */

import { prisma } from '../src/lib/prisma'

async function setupStorageRates() {
  console.log('🏭 Setting up storage rates for testing...')
  
  try {
    // Get all warehouses
    const warehouses = await prisma.warehouse.findMany({
      select: { id: true, code: true, name: true }
    })

    if (warehouses.length === 0) {
      console.log('❌ No warehouses found. Please create warehouses first.')
      return
    }

    // Get the first user to use as creator
    const user = await prisma.user.findFirst({
      select: { id: true }
    })

    if (!user) {
      console.log('❌ No users found. Please create a user first.')
      return
    }

    console.log(`📦 Found ${warehouses.length} warehouses`)

    // Add storage rates for each warehouse
    for (const warehouse of warehouses) {
      // Check if storage rate already exists
      const existingRate = await prisma.costRate.findFirst({
        where: {
          warehouseId: warehouse.id,
          costCategory: 'Storage',
          isActive: true
        }
      })

      if (existingRate) {
        console.log(`⏭️  Storage rate already exists for ${warehouse.name} (${warehouse.code})`)
        continue
      }

      // Create storage rate: $0.50 per carton per week
      const storageRate = await prisma.costRate.create({
        data: {
          warehouseId: warehouse.id,
          costCategory: 'Storage',
          costName: 'Weekly Storage Fee',
          costValue: 0.5000, // $0.50 per carton per week
          unitOfMeasure: 'carton/week',
          effectiveDate: new Date('2024-01-01'),
          endDate: null, // No end date - active indefinitely
          isActive: true,
          createdById: user.id
        }
      })

      console.log(`✅ Created storage rate for ${warehouse.name}: $${storageRate.costValue}/carton/week`)
    }

    console.log(`\n🎉 Storage rates setup complete!`)
    
  } catch (error) {
    console.error('❌ Failed to setup storage rates:', error)
    process.exit(1)
  }
}

setupStorageRates()
  .then(() => {
    console.log('✅ Setup completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  })
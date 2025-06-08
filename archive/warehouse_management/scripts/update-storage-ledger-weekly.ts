#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'
import { endOfWeek, startOfWeek, subWeeks, format } from 'date-fns'
import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const prisma = new PrismaClient()

// Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

async function updateStorageLedgerWeekly() {
  console.log('🔄 Starting weekly storage ledger update...')
  console.log(`📅 Run time: ${new Date().toISOString()}`)
  
  try {
    // Get the most recent Monday (or today if it's Monday)
    const today = new Date()
    const dayOfWeek = today.getDay()
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // If Sunday, go back 6 days; otherwise go back to Monday
    const lastMonday = new Date(today)
    lastMonday.setDate(today.getDate() - daysToSubtract)
    lastMonday.setHours(23, 59, 59, 999)
    
    // Also update the previous week to catch any late transactions
    const previousMonday = new Date(lastMonday)
    previousMonday.setDate(previousMonday.getDate() - 7)
    
    console.log(`📅 Updating for Mondays: ${previousMonday.toISOString().split('T')[0]} and ${lastMonday.toISOString().split('T')[0]}`)
    
    // Get all warehouses (excluding Amazon)
    const warehouses = await prisma.warehouse.findMany({
      where: {
        isActive: true,
        NOT: {
          OR: [
            { code: 'AMZN' },
            { code: 'AMZN-UK' }
          ]
        }
      }
    })
    
    console.log(`🏭 Found ${warehouses.length} warehouses to process`)
    
    // Get all cost rates
    const rates = await prisma.costRate.findMany({
      where: {
        costCategory: 'Storage'
      }
    })
    
    // Process both Mondays
    const mondaysToProcess = [previousMonday, lastMonday]
    let totalCreated = 0
    let totalUpdated = 0
    
    for (const monday of mondaysToProcess) {
      const mondayEnd = new Date(monday)
      const weekNumber = getWeekNumber(monday)
      const weekEndingDate = endOfWeek(monday, { weekStartsOn: 1 })
      
      console.log(`\n🗓️ Processing Week ${weekNumber} - ${monday.toISOString().split('T')[0]}`)
      
      // Get all transactions up to this Monday
      const transactions = await prisma.inventoryTransaction.findMany({
        where: {
          transactionDate: {
            lte: mondayEnd
          }
        },
        include: {
          sku: true,
          warehouse: true
        }
      })
      
      // Process each warehouse
      for (const warehouse of warehouses) {
        const warehouseTransactions = transactions.filter(t => t.warehouseId === warehouse.id)
        
        // Create a map of unique SKU/batch combinations
        const skuBatchMap = new Map<string, { skuId: string, batchLot: string, sku: any }>()
        
        for (const t of warehouseTransactions) {
          const key = `${t.skuId}-${t.batchLot}`
          if (!skuBatchMap.has(key)) {
            skuBatchMap.set(key, {
              skuId: t.skuId,
              batchLot: t.batchLot,
              sku: t.sku
            })
          }
        }
        
        let warehousePallets = 0
        let warehouseEntries = 0
        
        // For each unique SKU/batch, calculate the balance at Monday
        for (const [key, { skuId, batchLot, sku }] of skuBatchMap) {
          const skuBatchTransactions = warehouseTransactions.filter(t => 
            t.skuId === skuId &&
            t.batchLot === batchLot
          )
          
          // Calculate cartons at Monday end
          let cartonsAtMonday = 0
          for (const t of skuBatchTransactions) {
            cartonsAtMonday += t.cartonsIn - t.cartonsOut
          }
          
          if (cartonsAtMonday > 0) {
            // Get pallet configuration
            const balance = await prisma.inventoryBalance.findFirst({
              where: {
                warehouseId: warehouse.id,
                skuId: skuId,
                batchLot: batchLot
              }
            })
            
            let cartonsPerPallet = 1
            
            if (balance?.storageCartonsPerPallet) {
              cartonsPerPallet = balance.storageCartonsPerPallet
            } else {
              const warehouseConfig = await prisma.warehouseSkuConfig.findFirst({
                where: {
                  warehouseId: warehouse.id,
                  skuId: skuId,
                  effectiveDate: { lte: monday },
                  OR: [
                    { endDate: null },
                    { endDate: { gte: monday } }
                  ]
                }
              })
              
              if (warehouseConfig?.storageCartonsPerPallet) {
                cartonsPerPallet = warehouseConfig.storageCartonsPerPallet
              }
            }
            
            const pallets = Math.ceil(cartonsAtMonday / cartonsPerPallet)
            warehousePallets += pallets
            
            // Find applicable rate
            const applicableRate = rates.find(r => 
              r.warehouseId === warehouse.id &&
              new Date(r.effectiveDate) <= monday &&
              (!r.endDate || new Date(r.endDate) >= monday)
            )
            
            const rate = applicableRate ? Number(applicableRate.costValue) : 0
            const cost = pallets * rate
            
            // Get billing period
            const billingPeriodStart = new Date(monday.getFullYear(), monday.getMonth(), 16)
            if (monday.getDate() < 16) {
              billingPeriodStart.setMonth(billingPeriodStart.getMonth() - 1)
            }
            const billingPeriodEnd = new Date(billingPeriodStart)
            billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1)
            billingPeriodEnd.setDate(15)
            
            // Create unique ID
            const slId = `SL-${monday.toISOString().split('T')[0]}-${warehouse.code}-${sku.skuCode}-${batchLot}`
            
            try {
              const existing = await prisma.storageLedger.findUnique({
                where: { slId }
              })
              
              if (existing) {
                // Update existing entry
                await prisma.storageLedger.update({
                  where: { slId },
                  data: {
                    cartonsEndOfMonday: cartonsAtMonday,
                    storagePalletsCharged: pallets,
                    applicableWeeklyRate: rate,
                    calculatedWeeklyCost: cost,
                  }
                })
                totalUpdated++
              } else {
                // Create new entry
                await prisma.storageLedger.create({
                  data: {
                    slId,
                    weekEndingDate,
                    warehouseId: warehouse.id,
                    skuId: skuId,
                    batchLot: batchLot,
                    cartonsEndOfMonday: cartonsAtMonday,
                    storagePalletsCharged: pallets,
                    applicableWeeklyRate: rate,
                    calculatedWeeklyCost: cost,
                    billingPeriodStart,
                    billingPeriodEnd,
                  }
                })
                totalCreated++
              }
              
              warehouseEntries++
            } catch (error) {
              console.error(`❌ Error processing entry ${slId}:`, error)
            }
          }
        }
        
        if (warehouseEntries > 0) {
          console.log(`  ✅ ${warehouse.name}: ${warehouseEntries} entries, ${warehousePallets} total pallets`)
        }
      }
    }
    
    console.log(`\n✅ Weekly update complete!`)
    console.log(`📊 Created: ${totalCreated} new entries`)
    console.log(`📊 Updated: ${totalUpdated} existing entries`)
    console.log(`📊 Total: ${totalCreated + totalUpdated} entries processed`)
    
  } catch (error) {
    console.error('❌ Error updating storage ledger:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the update
updateStorageLedgerWeekly()
  .then(() => {
    console.log('\n🎉 Storage ledger weekly update completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Storage ledger weekly update failed:', error)
    process.exit(1)
  })
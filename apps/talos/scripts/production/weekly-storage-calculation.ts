#!/usr/bin/env tsx

/**
 * Weekly Storage Cost Calculation Script
 * 
 * This script should be run weekly (typically Monday mornings) to ensure
 * all inventory batches have storage cost entries for the previous week.
 * 
 * Usage:
 *   npx tsx scripts/production/weekly-storage-calculation.ts
 *   npx tsx scripts/production/weekly-storage-calculation.ts --date=2024-01-15
 *   npx tsx scripts/production/weekly-storage-calculation.ts --warehouse=WH001
 *   npx tsx scripts/production/weekly-storage-calculation.ts --recalculate
 */

import { ensureWeeklyStorageEntries, recalculateStorageCosts } from '@/services/storageCost.service'
import { endOfWeek } from 'date-fns'

interface ScriptOptions {
  date?: string
  warehouse?: string
  recalculate?: boolean
  help?: boolean
}

function parseArgs(): ScriptOptions {
  const options: ScriptOptions = {}
  
  process.argv.slice(2).forEach(arg => {
    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--recalculate') {
      options.recalculate = true
    } else if (arg.startsWith('--date=')) {
      options.date = arg.split('=')[1]
    } else if (arg.startsWith('--warehouse=')) {
      options.warehouse = arg.split('=')[1]
    }
  })
  
  return options
}

function showHelp() {
  console.log(`
Weekly Storage Cost Calculation Script

Usage:
  npx tsx scripts/production/weekly-storage-calculation.ts [options]

Options:
  --date=YYYY-MM-DD     Calculate for specific date (default: current date)
  --warehouse=CODE      Process only specific warehouse
  --recalculate         Recalculate costs for existing entries without costs
  --help, -h            Show this help message

Examples:
  # Calculate for current week
  npx tsx scripts/production/weekly-storage-calculation.ts
  
  # Calculate for specific date
  npx tsx scripts/production/weekly-storage-calculation.ts --date=2024-01-15
  
  # Recalculate missing costs
  npx tsx scripts/production/weekly-storage-calculation.ts --recalculate
  
  # Process only one warehouse
  npx tsx scripts/production/weekly-storage-calculation.ts --warehouse=WH001
`)
}

async function run() {
  console.log('🏗️  Weekly Storage Cost Calculation Script')
  console.log('=====================================')
  
  try {
    const options = parseArgs()
    
    if (options.help) {
      showHelp()
      process.exit(0)
    }
    
    const targetDate = options.date ? new Date(options.date) : new Date()
    const weekEnding = endOfWeek(targetDate, { weekStartsOn: 1 })
    
    console.log(`📅 Processing week ending: ${weekEnding.toLocaleDateString()}`)
    if (options.warehouse) {
      console.log(`🏭 Warehouse filter: ${options.warehouse}`)
    }
    
    let result
    
    if (options.recalculate) {
      console.log('🔄 Recalculating costs for existing entries...')
      result = await recalculateStorageCosts(weekEnding, options.warehouse)
      
      console.log(`✅ Recalculation completed:`)
      console.log(`   - Entries recalculated: ${result.recalculated}`)
      
      if (result.errors.length > 0) {
        console.log(`❌ Errors encountered: ${result.errors.length}`)
        result.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`)
        })
      }
    } else {
      console.log('📊 Ensuring all batches have storage entries...')
      result = await ensureWeeklyStorageEntries(targetDate)
      
      console.log(`✅ Weekly calculation completed:`)
      console.log(`   - Entries processed: ${result.processed}`)
      console.log(`   - Costs calculated: ${result.costCalculated}`)
      console.log(`   - Entries skipped (no inventory): ${result.skipped}`)
      
      if (result.errors.length > 0) {
        console.log(`❌ Errors encountered: ${result.errors.length}`)
        result.errors.forEach((error, index) => {
          console.log(`   ${index + 1}. ${error}`)
        })
      }
      
      // Show cost calculation rate
      if (result.processed > 0) {
        const costRate = ((result.costCalculated / result.processed) * 100).toFixed(1)
        console.log(`📈 Cost calculation success rate: ${costRate}%`)
        
        if (result.costCalculated < result.processed) {
          console.log(`⚠️  ${result.processed - result.costCalculated} entries need storage rates configured`)
        }
      }
    }
    
    console.log('\n🎉 Script completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Script failed:', error)
    console.error(error.stack)
    process.exit(1)
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n⏹️  Script interrupted by user')
  process.exit(1)
})

process.on('SIGTERM', () => {
  console.log('\n⏹️  Script terminated')
  process.exit(1)
})

run()
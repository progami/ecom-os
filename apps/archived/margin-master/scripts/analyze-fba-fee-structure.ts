import { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

// Helper function to format currency
const formatCurrency = (amount: Decimal | number, currency: string) => {
  const value = amount instanceof Decimal ? amount.toNumber() : amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(value)
}

async function analyzeStandardFees() {
  console.log('\n📊 STANDARD FBA FEES ANALYSIS')
  console.log('=' .repeat(80))
  
  // Group fees by marketplace
  const marketplaces = ['US', 'GB']
  
  for (const marketplace of marketplaces) {
    console.log(`\n🌍 ${marketplace} Market:`)
    
    // Get unique size tiers
    const sizeTiers = await prisma.standardFees.findMany({
      where: { marketplace },
      select: { sizeTierName: true },
      distinct: ['sizeTierName'],
    })
    
    for (const tier of sizeTiers) {
      console.log(`\n   📦 ${tier.sizeTierName}:`)
      
      const fees = await prisma.standardFees.findMany({
        where: { 
          marketplace,
          sizeTierName: tier.sizeTierName,
        },
        orderBy: { rateWeightLowerBoundKg: 'asc' },
      })
      
      fees.forEach(fee => {
        const weightRange = fee.rateWeightUpperBoundKg.toNumber() === 999999 
          ? `${fee.rateWeightLowerBoundKg}kg+`
          : `${fee.rateWeightLowerBoundKg}-${fee.rateWeightUpperBoundKg}kg`
        
        console.log(`      ${weightRange}: ${formatCurrency(fee.fee, fee.currency)}`)
      })
    }
  }
}

async function analyzeLowPriceFees() {
  console.log('\n\n💸 LOW-PRICE FBA FEES ANALYSIS')
  console.log('=' .repeat(80))
  console.log('For products priced under $10/£10')
  
  const marketplaces = ['US', 'GB']
  
  for (const marketplace of marketplaces) {
    console.log(`\n🌍 ${marketplace} Market:`)
    
    const fees = await prisma.lowPriceFees.findMany({
      where: { marketplace },
      orderBy: [
        { sizeTierName: 'asc' },
        { rateWeightUpperBoundKg: 'asc' },
      ],
    })
    
    let currentTier = ''
    fees.forEach(fee => {
      if (fee.sizeTierName !== currentTier) {
        currentTier = fee.sizeTierName
        console.log(`\n   📦 ${currentTier}:`)
      }
      
      const weightRange = `0-${fee.rateWeightUpperBoundKg}kg`
      console.log(`      ${weightRange}: ${formatCurrency(fee.fee, fee.currency)}`)
    })
  }
}

async function analyzeReferralFees() {
  console.log('\n\n🏷️ REFERRAL FEES ANALYSIS')
  console.log('=' .repeat(80))
  
  const marketplaces = ['US', 'GB']
  
  for (const marketplace of marketplaces) {
    console.log(`\n🌍 ${marketplace} Market:`)
    
    const fees = await prisma.referralFeesLegacy.findMany({
      where: { marketplaceGroup: marketplace },
      orderBy: { productCategory: 'asc' },
      distinct: ['productCategory', 'feePercentage'],
    })
    
    const categories = new Map<string, Array<{percentage: number, condition?: string}>>()
    
    fees.forEach(fee => {
      if (!categories.has(fee.productCategory)) {
        categories.set(fee.productCategory, [])
      }
      categories.get(fee.productCategory)!.push({
        percentage: fee.feePercentage.toNumber(),
        condition: fee.condition || undefined,
      })
    })
    
    categories.forEach((feeData, category) => {
      console.log(`\n   📂 ${category}:`)
      feeData.forEach(fee => {
        const conditionText = fee.condition ? ` (${fee.condition})` : ''
        console.log(`      ${fee.percentage}%${conditionText}`)
      })
    })
  }
}

async function analyzeStorageFees() {
  console.log('\n\n🏪 STORAGE FEES ANALYSIS')
  console.log('=' .repeat(80))
  console.log('Per cubic foot per month')
  
  const marketplaces = ['US', 'GB']
  
  for (const marketplace of marketplaces) {
    console.log(`\n🌍 ${marketplace} Market:`)
    
    const fees = await prisma.storageFeesLegacy.findMany({
      where: { marketplaceGroup: marketplace },
      orderBy: [
        { productSize: 'asc' },
        { period: 'asc' },
      ],
    })
    
    let currentSize = ''
    fees.forEach(fee => {
      if (fee.productSize !== currentSize) {
        currentSize = fee.productSize
        console.log(`\n   📏 ${currentSize} Size:`)
      }
      
      console.log(`      ${fee.period}: ${formatCurrency(fee.fee, fee.currency)}`)
    })
  }
}

async function analyzePricingImpact() {
  console.log('\n\n💡 PRICING IMPACT ANALYSIS')
  console.log('=' .repeat(80))
  
  // Example scenarios to show fee impact
  const scenarios = [
    { price: 5, weight: 50, category: 'Electronics' },
    { price: 10, weight: 100, category: 'Electronics' },
    { price: 20, weight: 200, category: 'Home & Garden' },
    { price: 30, weight: 300, category: 'Clothing & Accessories' },
    { price: 50, weight: 500, category: 'Sports & Outdoors' },
  ]
  
  console.log('\nHow fees affect different price points (US Market):')
  console.log('\nPrice  | Category              | Weight | FBA Fee | Ref Fee | Total | % of Price')
  console.log('-'.repeat(80))
  
  for (const scenario of scenarios) {
    // Get standard FBA fee
    const weightKg = scenario.weight / 1000
    const standardFee = await prisma.standardFees.findFirst({
      where: {
        marketplace: 'US',
        sizeTierName: 'Standard envelope', // Simplified for demo
        rateWeightLowerBoundKg: { lte: weightKg },
        rateWeightUpperBoundKg: { gte: weightKg },
      },
    })
    
    // Get referral fee
    const referralFee = await prisma.referralFeesLegacy.findFirst({
      where: {
        marketplaceGroup: 'US',
        productCategory: scenario.category,
      },
    })
    
    if (standardFee && referralFee) {
      const fbaFee = standardFee.fee.toNumber()
      const refFee = Math.max(
        scenario.price * referralFee.feePercentage.toNumber() / 100,
        referralFee.minReferralFee.toNumber()
      )
      const totalFees = fbaFee + refFee
      const percentOfPrice = (totalFees / scenario.price * 100).toFixed(1)
      
      console.log(
        `$${scenario.price.toString().padEnd(5)} | ` +
        `${scenario.category.padEnd(21)} | ` +
        `${scenario.weight}g`.padEnd(6) + ' | ' +
        `$${fbaFee.toFixed(2).padEnd(7)} | ` +
        `$${refFee.toFixed(2).padEnd(7)} | ` +
        `$${totalFees.toFixed(2).padEnd(6)} | ` +
        `${percentOfPrice}%`
      )
    }
  }
}

async function showDatabaseStats() {
  console.log('\n📊 DATABASE STATISTICS')
  console.log('=' .repeat(80))
  
  const stats = {
    standardFees: await prisma.standardFees.count(),
    lowPriceFees: await prisma.lowPriceFees.count(),
    referralFees: await prisma.referralFeesLegacy.count(),
    storageFees: await prisma.storageFeesLegacy.count(),
    sizeTiers: await prisma.sizeTier.count(),
    weightBands: await prisma.weightBand.count(),
    simulations: await prisma.simulation.count(),
  }
  
  console.log('\nFee Data Records:')
  Object.entries(stats).forEach(([table, count]) => {
    console.log(`   ${table}: ${count} records`)
  })
}

async function main() {
  console.log('🔍 FBA FEE STRUCTURE ANALYSIS')
  console.log('=' .repeat(80))
  console.log('Analyzing the seeded FBA fee data to show actual fee structures...')
  
  try {
    await showDatabaseStats()
    await analyzeStandardFees()
    await analyzeLowPriceFees()
    await analyzeReferralFees()
    await analyzeStorageFees()
    await analyzePricingImpact()
    
    console.log('\n\n✨ Analysis complete!')
    console.log('=' .repeat(80))
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
import { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

// Helper function to create Decimal values
const dec = (value: number | string) => new Decimal(value)

// Helper function to format currency
const formatCurrency = (amount: Decimal | number, currency: string) => {
  const value = amount instanceof Decimal ? amount.toNumber() : amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(value)
}

// Helper function to calculate size tier
async function getSizeTier(dimensions: { length: number; width: number; height: number }, weight: number) {
  const sizeTiers = await prisma.sizeTier.findMany({
    orderBy: { sortOrder: 'asc' },
  })

  for (const tier of sizeTiers) {
    if (tier.isOversized) {
      // For oversized, check max dimension
      const maxDim = Math.max(dimensions.length, dimensions.width, dimensions.height)
      if (tier.maxDimensionsCm && dec(maxDim).lte(tier.maxDimensionsCm) && 
          tier.maxWeightG && dec(weight).lte(tier.maxWeightG)) {
        return tier
      }
    } else {
      // For standard sizes, check all dimensions
      if (tier.maxLengthCm && dec(dimensions.length).lte(tier.maxLengthCm) &&
          tier.maxWidthCm && dec(dimensions.width).lte(tier.maxWidthCm) &&
          tier.maxHeightCm && dec(dimensions.height).lte(tier.maxHeightCm) &&
          tier.maxWeightG && dec(weight).lte(tier.maxWeightG)) {
        return tier
      }
    }
  }
  
  return null
}

// Helper function to get FBA fulfillment fee
async function getFulfillmentFee(
  marketplace: string,
  sizeTierName: string,
  weightKg: number,
  isLowPriceFBA: boolean = false
): Promise<Decimal> {
  if (isLowPriceFBA) {
    const lowPriceFee = await prisma.lowPriceFees.findFirst({
      where: {
        marketplace,
        sizeTierName,
        rateWeightLowerBoundKg: { lte: dec(weightKg) },
        rateWeightUpperBoundKg: { gte: dec(weightKg) },
      },
    })
    
    if (lowPriceFee) {
      return lowPriceFee.fee
    }
  }

  const standardFee = await prisma.standardFees.findFirst({
    where: {
      marketplace,
      sizeTierName,
      rateWeightLowerBoundKg: { lte: dec(weightKg) },
      rateWeightUpperBoundKg: { gte: dec(weightKg) },
    },
  })

  return standardFee ? standardFee.fee : dec(0)
}

// Helper function to get referral fee
async function getReferralFee(
  marketplace: string,
  category: string,
  salePrice: Decimal
): Promise<{ percentage: Decimal; minimumFee: Decimal }> {
  const referralFee = await prisma.referralFeesLegacy.findFirst({
    where: {
      marketplaceGroup: marketplace,
      productCategory: category,
      priceLowerBound: { lte: salePrice },
      priceUpperBound: { gte: salePrice },
    },
  })

  if (referralFee) {
    return {
      percentage: referralFee.feePercentage,
      minimumFee: referralFee.minReferralFee,
    }
  }

  // Default to 15% with $0.30 minimum if not found
  return {
    percentage: dec(15),
    minimumFee: dec(0.30),
  }
}

// Helper function to calculate monthly storage fee
async function getMonthlyStorageFee(
  marketplace: string,
  volumeCubicFeet: number,
  isOversized: boolean,
  month: number = new Date().getMonth() + 1
): Promise<Decimal> {
  const period = month >= 10 ? 'October - December' : 'January - September'
  const productSize = isOversized ? 'Oversize' : 'Standard'

  const storageFee = await prisma.storageFeesLegacy.findFirst({
    where: {
      marketplaceGroup: marketplace,
      productSize,
      period,
    },
  })

  if (storageFee) {
    return storageFee.fee.mul(volumeCubicFeet)
  }

  return dec(0)
}

// Main scenario calculator
async function calculateScenario(scenario: {
  name: string
  marketplace: string
  salePrice: number
  category: string
  dimensions: { length: number; width: number; height: number }
  weightG: number
  costOfGoods: number
  estimatedAcosPercent: number
  refundProvisionPercent: number
  monthlyUnits: number
  isLowPriceFBA?: boolean
}) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`📊 SCENARIO: ${scenario.name}`)
  console.log(`${'='.repeat(80)}`)

  const currency = scenario.marketplace === 'US' ? 'USD' : 'GBP'
  const salePrice = dec(scenario.salePrice)
  const weightKg = scenario.weightG / 1000

  // 1. Determine size tier
  const sizeTier = await getSizeTier(scenario.dimensions, scenario.weightG)
  if (!sizeTier) {
    console.log('❌ Error: Could not determine size tier')
    return
  }

  console.log(`\n📦 Product Details:`)
  console.log(`   - Category: ${scenario.category}`)
  console.log(`   - Dimensions: ${scenario.dimensions.length} x ${scenario.dimensions.width} x ${scenario.dimensions.height} cm`)
  console.log(`   - Weight: ${scenario.weightG}g (${weightKg}kg)`)
  console.log(`   - Size Tier: ${sizeTier.name}`)
  console.log(`   - Sale Price: ${formatCurrency(salePrice, currency)}`)

  // 2. Calculate FBA fulfillment fee
  const fulfillmentFee = await getFulfillmentFee(
    scenario.marketplace,
    sizeTier.name,
    weightKg,
    scenario.isLowPriceFBA
  )

  console.log(`\n💰 Fee Breakdown:`)
  console.log(`   - FBA Fulfillment Fee: ${formatCurrency(fulfillmentFee, currency)} ${scenario.isLowPriceFBA ? '(Low-Price FBA)' : ''}`)

  // 3. Calculate referral fee
  const referralFeeData = await getReferralFee(scenario.marketplace, scenario.category, salePrice)
  const referralFeeAmount = Decimal.max(
    salePrice.mul(referralFeeData.percentage).div(100),
    referralFeeData.minimumFee
  )

  console.log(`   - Referral Fee: ${formatCurrency(referralFeeAmount, currency)} (${referralFeeData.percentage}% of sale price, min ${formatCurrency(referralFeeData.minimumFee, currency)})`)

  // 4. Calculate storage fee
  const volumeCubicFeet = (scenario.dimensions.length * scenario.dimensions.width * scenario.dimensions.height) / 28316.8 // cm³ to ft³
  const monthlyStorageFee = await getMonthlyStorageFee(
    scenario.marketplace,
    volumeCubicFeet,
    sizeTier.isOversized
  )
  const perUnitStorageFee = monthlyStorageFee.div(scenario.monthlyUnits)

  console.log(`   - Storage Fee (per unit): ${formatCurrency(perUnitStorageFee, currency)} (${volumeCubicFeet.toFixed(4)} ft³)`)

  // 5. Calculate advertising cost
  const advertisingCost = salePrice.mul(scenario.estimatedAcosPercent).div(100)
  console.log(`   - Advertising Cost: ${formatCurrency(advertisingCost, currency)} (${scenario.estimatedAcosPercent}% ACoS)`)

  // 6. Calculate refund provision
  const refundProvision = salePrice.mul(scenario.refundProvisionPercent).div(100)
  console.log(`   - Refund Provision: ${formatCurrency(refundProvision, currency)} (${scenario.refundProvisionPercent}%)`)

  // 7. Calculate total fees and margins
  const totalFees = fulfillmentFee.add(referralFeeAmount).add(perUnitStorageFee).add(advertisingCost).add(refundProvision)
  const grossMargin = salePrice.sub(dec(scenario.costOfGoods))
  const netMargin = grossMargin.sub(totalFees)
  const marginPercentage = netMargin.div(salePrice).mul(100)

  console.log(`\n📈 Profitability Analysis:`)
  console.log(`   - Cost of Goods: ${formatCurrency(scenario.costOfGoods, currency)}`)
  console.log(`   - Total Fees: ${formatCurrency(totalFees, currency)}`)
  console.log(`   - Gross Margin: ${formatCurrency(grossMargin, currency)} (${grossMargin.div(salePrice).mul(100).toFixed(1)}%)`)
  console.log(`   - Net Margin: ${formatCurrency(netMargin, currency)} (${marginPercentage.toFixed(1)}%)`)

  if (netMargin.gt(0)) {
    console.log(`   ✅ PROFITABLE - Monthly profit: ${formatCurrency(netMargin.mul(scenario.monthlyUnits), currency)}`)
  } else {
    console.log(`   ❌ UNPROFITABLE - Monthly loss: ${formatCurrency(netMargin.mul(scenario.monthlyUnits).abs(), currency)}`)
  }

  // Return results for summary
  return {
    name: scenario.name,
    salePrice: salePrice.toNumber(),
    totalFees: totalFees.toNumber(),
    netMargin: netMargin.toNumber(),
    marginPercentage: marginPercentage.toNumber(),
    isProfitable: netMargin.gt(0),
    monthlyProfit: netMargin.mul(scenario.monthlyUnits).toNumber(),
  }
}

// Generate summary report
function generateSummaryReport(results: any[]) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`📊 SUMMARY REPORT`)
  console.log(`${'='.repeat(80)}`)

  const profitable = results.filter(r => r.isProfitable)
  const unprofitable = results.filter(r => !r.isProfitable)

  console.log(`\n✅ Profitable Scenarios (${profitable.length}):`)
  profitable.forEach(r => {
    console.log(`   - ${r.name}: ${r.marginPercentage.toFixed(1)}% margin ($${r.netMargin.toFixed(2)} per unit)`)
  })

  console.log(`\n❌ Unprofitable Scenarios (${unprofitable.length}):`)
  unprofitable.forEach(r => {
    console.log(`   - ${r.name}: ${r.marginPercentage.toFixed(1)}% margin ($${r.netMargin.toFixed(2)} per unit)`)
  })

  console.log(`\n💡 Key Insights:`)
  console.log(`   1. Low-Price FBA reduces fulfillment fees for items under $10`)
  console.log(`   2. Lightweight items in standard size tiers have the best margins`)
  console.log(`   3. High advertising costs (>25% ACoS) can kill profitability`)
  console.log(`   4. Oversized items face significantly higher fulfillment fees`)
  console.log(`   5. Electronics and Beauty categories have lower referral fees (8%)`)
}

// Main function
async function main() {
  console.log('🚀 FBA Fee Impact Demonstration')
  console.log('================================')
  console.log('This script demonstrates how FBA fees affect profitability using real fee data.')

  const results = []

  // Scenario 1: Profitable phone case
  results.push(await calculateScenario({
    name: 'Premium Phone Case (Electronics)',
    marketplace: 'US',
    salePrice: 29.99,
    category: 'Electronics',
    dimensions: { length: 15, width: 8, height: 1 },
    weightG: 50,
    costOfGoods: 4.50,
    estimatedAcosPercent: 15,
    refundProvisionPercent: 2,
    monthlyUnits: 500,
  }))

  // Scenario 2: Low-margin cheap item
  results.push(await calculateScenario({
    name: 'Cheap Phone Accessory',
    marketplace: 'US',
    salePrice: 7.99,
    category: 'Electronics',
    dimensions: { length: 10, width: 5, height: 1 },
    weightG: 30,
    costOfGoods: 2.00,
    estimatedAcosPercent: 35,
    refundProvisionPercent: 5,
    monthlyUnits: 200,
  }))

  // Scenario 3: Low-Price FBA item
  results.push(await calculateScenario({
    name: 'Budget Kitchen Gadget (Low-Price FBA)',
    marketplace: 'US',
    salePrice: 9.99,
    category: 'Home & Garden',
    dimensions: { length: 12, width: 8, height: 3 },
    weightG: 120,
    costOfGoods: 2.50,
    estimatedAcosPercent: 25,
    refundProvisionPercent: 3,
    monthlyUnits: 300,
    isLowPriceFBA: true,
  }))

  // Scenario 4: Heavy/oversized item
  results.push(await calculateScenario({
    name: 'Garden Tool Set (Oversized)',
    marketplace: 'US',
    salePrice: 49.99,
    category: 'Home & Garden',
    dimensions: { length: 80, width: 30, height: 15 },
    weightG: 4500,
    costOfGoods: 15.00,
    estimatedAcosPercent: 18,
    refundProvisionPercent: 4,
    monthlyUnits: 50,
  }))

  // Scenario 5: Clothing item with high referral fee
  results.push(await calculateScenario({
    name: 'Designer T-Shirt',
    marketplace: 'US',
    salePrice: 34.99,
    category: 'Clothing & Accessories',
    dimensions: { length: 30, width: 20, height: 2 },
    weightG: 180,
    costOfGoods: 8.00,
    estimatedAcosPercent: 20,
    refundProvisionPercent: 5,
    monthlyUnits: 150,
  }))

  // Scenario 6: UK market comparison
  results.push(await calculateScenario({
    name: 'UK Phone Case (Same as US)',
    marketplace: 'GB',
    salePrice: 24.99,
    category: 'Electronics',
    dimensions: { length: 15, width: 8, height: 1 },
    weightG: 50,
    costOfGoods: 4.50,
    estimatedAcosPercent: 15,
    refundProvisionPercent: 2,
    monthlyUnits: 300,
  }))

  // Generate summary report
  generateSummaryReport(results)

  console.log(`\n${'='.repeat(80)}`)
  console.log('✨ Demonstration complete!')
  console.log(`${'='.repeat(80)}`)
}

// Run the demonstration
main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
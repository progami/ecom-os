import { PrismaClient } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

// Helper function to create Decimal values
const dec = (value: number | string) => new Decimal(value)

async function checkExistingData() {
  console.log('🔍 Checking existing data...')
  
  const counts = {
    countries: await prisma.country.count(),
    programs: await prisma.program.count(),
    sizeTiers: await prisma.sizeTier.count(),
    weightBands: await prisma.weightBand.count(),
    standardFees: await prisma.standardFees.count(),
    lowPriceFees: await prisma.lowPriceFees.count(),
    referralFeesLegacy: await prisma.referralFeesLegacy.count(),
    storageFeesLegacy: await prisma.storageFeesLegacy.count(),
    fulfilmentFees: await prisma.fulfilmentFee.count(),
    simulations: await prisma.simulation.count(),
  }
  
  console.log('Current data counts:', counts)
  return counts
}

async function seedCountries() {
  console.log('🌍 Seeding countries...')
  
  const countries = [
    { code: 'US', name: 'United States', region: 'Americas', currency: 'USD' },
    { code: 'GB', name: 'United Kingdom', region: 'Europe', currency: 'GBP' },
    { code: 'DE', name: 'Germany', region: 'Europe', currency: 'EUR' },
    { code: 'FR', name: 'France', region: 'Europe', currency: 'EUR' },
    { code: 'IT', name: 'Italy', region: 'Europe', currency: 'EUR' },
    { code: 'ES', name: 'Spain', region: 'Europe', currency: 'EUR' },
    { code: 'CA', name: 'Canada', region: 'Americas', currency: 'CAD' },
    { code: 'JP', name: 'Japan', region: 'Asia', currency: 'JPY' },
  ]
  
  for (const country of countries) {
    await prisma.country.upsert({
      where: { code: country.code },
      update: {},
      create: country,
    })
  }
  
  console.log(`✅ Created/updated ${countries.length} countries`)
}

async function seedPrograms() {
  console.log('📦 Seeding programs...')
  
  const programs = [
    {
      code: 'FBA',
      name: 'Fulfillment by Amazon',
      description: 'Standard FBA program with Amazon handling storage, packing, and shipping',
    },
    {
      code: 'LOW_PRICE_FBA',
      name: 'Low-Price FBA',
      description: 'Reduced fees for products priced under $10',
    },
    {
      code: 'SIPP',
      name: 'Small and Light',
      description: 'Ships in Plain Packaging program for small, lightweight items',
    },
    {
      code: 'EFN',
      name: 'European Fulfillment Network',
      description: 'Cross-border fulfillment within Europe',
    },
    {
      code: 'PAN_EU',
      name: 'Pan-European FBA',
      description: 'Store inventory across European fulfillment centers',
    },
  ]
  
  for (const program of programs) {
    await prisma.program.upsert({
      where: { code: program.code },
      update: {},
      create: program,
    })
  }
  
  console.log(`✅ Created/updated ${programs.length} programs`)
}

async function seedSizeTiers() {
  console.log('📏 Seeding size tiers...')
  
  const sizeTiers = [
    // Standard sizes
    {
      code: 'STANDARD_ENVELOPE',
      name: 'Standard envelope',
      maxLengthCm: dec(33),
      maxWidthCm: dec(23),
      maxHeightCm: dec(2.5),
      maxWeightG: dec(210),
      isOversized: false,
      sortOrder: 1,
    },
    {
      code: 'STANDARD_SMALL',
      name: 'Standard small',
      maxLengthCm: dec(33),
      maxWidthCm: dec(23),
      maxHeightCm: dec(5),
      maxWeightG: dec(460),
      isOversized: false,
      sortOrder: 2,
    },
    {
      code: 'STANDARD_REGULAR',
      name: 'Standard regular',
      maxLengthCm: dec(45),
      maxWidthCm: dec(34),
      maxHeightCm: dec(26),
      maxWeightG: dec(9000),
      isOversized: false,
      sortOrder: 3,
    },
    {
      code: 'STANDARD_LARGE',
      name: 'Standard large',
      maxLengthCm: dec(61),
      maxWidthCm: dec(46),
      maxHeightCm: dec(46),
      maxWeightG: dec(30000),
      isOversized: false,
      sortOrder: 4,
    },
    // Oversized
    {
      code: 'OVERSIZE_SMALL',
      name: 'Small oversize',
      maxDimensionsCm: dec(61),
      maxWeightG: dec(760),
      isOversized: true,
      sortOrder: 5,
    },
    {
      code: 'OVERSIZE_STANDARD',
      name: 'Standard oversize',
      maxDimensionsCm: dec(120),
      maxWeightG: dec(30000),
      isOversized: true,
      sortOrder: 6,
    },
    {
      code: 'OVERSIZE_LARGE',
      name: 'Large oversize',
      maxDimensionsCm: dec(180),
      maxWeightG: dec(30000),
      isOversized: true,
      sortOrder: 7,
    },
    // Apparel
    {
      code: 'APPAREL_STANDARD',
      name: 'Standard apparel',
      maxLengthCm: dec(45),
      maxWidthCm: dec(34),
      maxHeightCm: dec(26),
      maxWeightG: dec(9000),
      isOversized: false,
      isApparel: true,
      sortOrder: 8,
    },
  ]
  
  for (const sizeTier of sizeTiers) {
    await prisma.sizeTier.upsert({
      where: { code: sizeTier.code },
      update: {},
      create: sizeTier,
    })
  }
  
  console.log(`✅ Created/updated ${sizeTiers.length} size tiers`)
}

async function seedWeightBands() {
  console.log('⚖️ Seeding weight bands...')
  
  const weightBands = [
    // Standard weight bands (in grams)
    { minWeightG: dec(0), maxWeightG: dec(210) },
    { minWeightG: dec(210), maxWeightG: dec(460) },
    { minWeightG: dec(460), maxWeightG: dec(960) },
    { minWeightG: dec(960), maxWeightG: dec(1460) },
    { minWeightG: dec(1460), maxWeightG: dec(1960) },
    { minWeightG: dec(1960), maxWeightG: dec(2460) },
    { minWeightG: dec(2460), maxWeightG: dec(2960) },
    { minWeightG: dec(2960), maxWeightG: dec(3460) },
    { minWeightG: dec(3460), maxWeightG: dec(3960) },
    { minWeightG: dec(3960), maxWeightG: dec(4460) },
    { minWeightG: dec(4460), maxWeightG: dec(4960) },
    { minWeightG: dec(4960), maxWeightG: dec(5460) },
    { minWeightG: dec(5460), maxWeightG: dec(5960) },
    { minWeightG: dec(5960), maxWeightG: dec(6460) },
    { minWeightG: dec(6460), maxWeightG: dec(6960) },
    { minWeightG: dec(6960), maxWeightG: dec(7460) },
    { minWeightG: dec(7460), maxWeightG: dec(7960) },
    { minWeightG: dec(7960), maxWeightG: dec(8460) },
    { minWeightG: dec(8460), maxWeightG: dec(8960) },
    { minWeightG: dec(8960), maxWeightG: dec(9460) },
    { minWeightG: dec(9460), maxWeightG: dec(9960) },
    { minWeightG: dec(9960), maxWeightG: dec(10460) },
    { minWeightG: dec(10460), maxWeightG: dec(10960) },
    { minWeightG: dec(10960), maxWeightG: dec(11960) },
    { minWeightG: dec(11960), maxWeightG: dec(12960) },
    { minWeightG: dec(12960), maxWeightG: dec(13960) },
    { minWeightG: dec(13960), maxWeightG: dec(14960) },
    { minWeightG: dec(14960), maxWeightG: dec(15960) },
    { minWeightG: dec(15960), maxWeightG: dec(16960) },
    { minWeightG: dec(16960), maxWeightG: dec(17960) },
    { minWeightG: dec(17960), maxWeightG: dec(18960) },
    { minWeightG: dec(18960), maxWeightG: dec(19960) },
    { minWeightG: dec(19960), maxWeightG: dec(20960) },
    { minWeightG: dec(20960), maxWeightG: dec(21960) },
    { minWeightG: dec(21960), maxWeightG: dec(22960) },
    { minWeightG: dec(22960), maxWeightG: dec(23960) },
    { minWeightG: dec(23960), maxWeightG: dec(24960) },
    { minWeightG: dec(24960), maxWeightG: dec(25960) },
    { minWeightG: dec(25960), maxWeightG: dec(26960) },
    { minWeightG: dec(26960), maxWeightG: dec(27960) },
    { minWeightG: dec(27960), maxWeightG: dec(28960) },
    { minWeightG: dec(28960), maxWeightG: dec(29960) },
    { minWeightG: dec(29960), maxWeightG: null },
  ]
  
  for (const band of weightBands) {
    await prisma.weightBand.create({
      data: band,
    })
  }
  
  console.log(`✅ Created ${weightBands.length} weight bands`)
}

async function seedStandardFees() {
  console.log('💰 Seeding standard FBA fees...')
  
  const usCountry = await prisma.country.findUnique({ where: { code: 'US' } })
  const gbCountry = await prisma.country.findUnique({ where: { code: 'GB' } })
  
  // US Standard FBA fees
  const usStandardFees = [
    // Standard envelope
    { sizeTier: 'Standard envelope', weightLower: 0, weightUpper: 0.21, fee: 3.22 },
    // Standard small
    { sizeTier: 'Standard small', weightLower: 0, weightUpper: 0.46, fee: 3.47 },
    // Standard regular
    { sizeTier: 'Standard regular', weightLower: 0, weightUpper: 0.46, fee: 4.16 },
    { sizeTier: 'Standard regular', weightLower: 0.46, weightUpper: 0.96, fee: 4.35 },
    { sizeTier: 'Standard regular', weightLower: 0.96, weightUpper: 1.46, fee: 4.75 },
    { sizeTier: 'Standard regular', weightLower: 1.46, weightUpper: 1.96, fee: 5.40 },
    { sizeTier: 'Standard regular', weightLower: 1.96, weightUpper: 2.46, fee: 5.48 },
    { sizeTier: 'Standard regular', weightLower: 2.46, weightUpper: 2.96, fee: 5.62 },
    { sizeTier: 'Standard regular', weightLower: 2.96, weightUpper: 3.46, fee: 5.92 },
    { sizeTier: 'Standard regular', weightLower: 3.46, weightUpper: 3.96, fee: 6.06 },
    // Standard large
    { sizeTier: 'Standard large', weightLower: 0, weightUpper: 0.46, fee: 5.01 },
    { sizeTier: 'Standard large', weightLower: 0.46, weightUpper: 0.96, fee: 5.10 },
    { sizeTier: 'Standard large', weightLower: 0.96, weightUpper: 1.46, fee: 5.38 },
    { sizeTier: 'Standard large', weightLower: 1.46, weightUpper: 1.96, fee: 5.79 },
    { sizeTier: 'Standard large', weightLower: 1.96, weightUpper: 2.46, fee: 5.91 },
    { sizeTier: 'Standard large', weightLower: 2.46, weightUpper: 2.96, fee: 6.14 },
    { sizeTier: 'Standard large', weightLower: 2.96, weightUpper: 3.46, fee: 6.50 },
    { sizeTier: 'Standard large', weightLower: 3.46, weightUpper: 3.96, fee: 6.85 },
    { sizeTier: 'Standard large', weightLower: 3.96, weightUpper: 4.46, fee: 7.25 },
    { sizeTier: 'Standard large', weightLower: 4.46, weightUpper: 4.96, fee: 7.75 },
    { sizeTier: 'Standard large', weightLower: 4.96, weightUpper: 9.0, fee: 8.78 },
    { sizeTier: 'Standard large', weightLower: 9.0, weightUpper: 30.0, fee: 8.78 }, // Plus $0.16/lb above 9kg
  ]
  
  for (const fee of usStandardFees) {
    await prisma.standardFees.create({
      data: {
        sizeTierName: fee.sizeTier,
        lengthLimitCm: dec(50), // Placeholder
        widthLimitCm: dec(50),
        heightLimitCm: dec(50),
        rateWeightLowerBoundKg: dec(fee.weightLower),
        rateWeightUpperBoundKg: dec(fee.weightUpper),
        marketplace: 'US',
        currency: 'USD',
        fee: dec(fee.fee),
      },
    })
  }
  
  // UK Standard FBA fees
  const ukStandardFees = [
    // Standard envelope
    { sizeTier: 'Standard envelope', weightLower: 0, weightUpper: 0.21, fee: 2.50 },
    // Standard small
    { sizeTier: 'Standard small', weightLower: 0, weightUpper: 0.46, fee: 2.75 },
    // Standard regular
    { sizeTier: 'Standard regular', weightLower: 0, weightUpper: 0.46, fee: 3.25 },
    { sizeTier: 'Standard regular', weightLower: 0.46, weightUpper: 0.96, fee: 3.40 },
    { sizeTier: 'Standard regular', weightLower: 0.96, weightUpper: 1.46, fee: 3.75 },
    { sizeTier: 'Standard regular', weightLower: 1.46, weightUpper: 1.96, fee: 4.25 },
    { sizeTier: 'Standard regular', weightLower: 1.96, weightUpper: 2.46, fee: 4.35 },
    { sizeTier: 'Standard regular', weightLower: 2.46, weightUpper: 2.96, fee: 4.45 },
    { sizeTier: 'Standard regular', weightLower: 2.96, weightUpper: 3.46, fee: 4.65 },
    { sizeTier: 'Standard regular', weightLower: 3.46, weightUpper: 3.96, fee: 4.80 },
  ]
  
  for (const fee of ukStandardFees) {
    await prisma.standardFees.create({
      data: {
        sizeTierName: fee.sizeTier,
        lengthLimitCm: dec(50), // Placeholder
        widthLimitCm: dec(50),
        heightLimitCm: dec(50),
        rateWeightLowerBoundKg: dec(fee.weightLower),
        rateWeightUpperBoundKg: dec(fee.weightUpper),
        marketplace: 'GB',
        currency: 'GBP',
        fee: dec(fee.fee),
      },
    })
  }
  
  console.log(`✅ Created ${usStandardFees.length + ukStandardFees.length} standard fees`)
}

async function seedLowPriceFees() {
  console.log('💸 Seeding low-price FBA fees...')
  
  const lowPriceFees = [
    // US Low-Price FBA
    { marketplace: 'US', sizeTier: 'Standard envelope', weight: 0.21, fee: 2.45, currency: 'USD' },
    { marketplace: 'US', sizeTier: 'Standard small', weight: 0.46, fee: 2.63, currency: 'USD' },
    { marketplace: 'US', sizeTier: 'Standard regular', weight: 0.46, fee: 3.22, currency: 'USD' },
    { marketplace: 'US', sizeTier: 'Standard regular', weight: 0.96, fee: 3.40, currency: 'USD' },
    { marketplace: 'US', sizeTier: 'Standard regular', weight: 1.46, fee: 3.58, currency: 'USD' },
    
    // UK Low-Price FBA
    { marketplace: 'GB', sizeTier: 'Standard envelope', weight: 0.21, fee: 1.73, currency: 'GBP' },
    { marketplace: 'GB', sizeTier: 'Standard small', weight: 0.46, fee: 1.95, currency: 'GBP' },
    { marketplace: 'GB', sizeTier: 'Standard regular', weight: 0.46, fee: 2.45, currency: 'GBP' },
    { marketplace: 'GB', sizeTier: 'Standard regular', weight: 0.96, fee: 2.60, currency: 'GBP' },
  ]
  
  for (const fee of lowPriceFees) {
    await prisma.lowPriceFees.create({
      data: {
        programName: 'Low-Price FBA',
        sizeTierName: fee.sizeTier,
        lengthLimitCm: dec(50), // Placeholder
        widthLimitCm: dec(50),
        heightLimitCm: dec(50),
        rateWeightLowerBoundKg: dec(0),
        rateWeightUpperBoundKg: dec(fee.weight),
        marketplace: fee.marketplace,
        currency: fee.currency,
        fee: dec(fee.fee),
      },
    })
  }
  
  console.log(`✅ Created ${lowPriceFees.length} low-price fees`)
}

async function seedReferralFees() {
  console.log('🏷️ Seeding referral fees...')
  
  const referralFees = [
    // Electronics
    {
      marketplaceGroup: 'US',
      productCategory: 'Electronics',
      feePercentage: 8,
      minReferralFee: 0.30,
      currency: 'USD',
    },
    {
      marketplaceGroup: 'GB',
      productCategory: 'Electronics',
      feePercentage: 8,
      minReferralFee: 0.30,
      currency: 'GBP',
    },
    // Clothing & Accessories
    {
      marketplaceGroup: 'US',
      productCategory: 'Clothing & Accessories',
      feePercentage: 17,
      minReferralFee: 0.30,
      currency: 'USD',
    },
    {
      marketplaceGroup: 'GB',
      productCategory: 'Clothing & Accessories',
      feePercentage: 15,
      minReferralFee: 0.30,
      currency: 'GBP',
    },
    // Home & Garden
    {
      marketplaceGroup: 'US',
      productCategory: 'Home & Garden',
      feePercentage: 15,
      minReferralFee: 0.30,
      currency: 'USD',
    },
    {
      marketplaceGroup: 'GB',
      productCategory: 'Home & Garden',
      feePercentage: 15,
      minReferralFee: 0.30,
      currency: 'GBP',
    },
    // Toys & Games
    {
      marketplaceGroup: 'US',
      productCategory: 'Toys & Games',
      feePercentage: 15,
      minReferralFee: 0.30,
      currency: 'USD',
    },
    // Books
    {
      marketplaceGroup: 'US',
      productCategory: 'Books',
      feePercentage: 15,
      minReferralFee: 0.30,
      currency: 'USD',
    },
    // Sports & Outdoors
    {
      marketplaceGroup: 'US',
      productCategory: 'Sports & Outdoors',
      feePercentage: 15,
      minReferralFee: 0.30,
      currency: 'USD',
    },
    // Beauty & Personal Care
    {
      marketplaceGroup: 'US',
      productCategory: 'Beauty & Personal Care',
      feePercentage: 8,
      minReferralFee: 0.30,
      currency: 'USD',
      condition: 'For products with a total sales price of $10.00 or less',
    },
    {
      marketplaceGroup: 'US',
      productCategory: 'Beauty & Personal Care',
      feePercentage: 15,
      minReferralFee: 0.30,
      currency: 'USD',
      condition: 'For products with a total sales price greater than $10.00',
    },
    // Grocery
    {
      marketplaceGroup: 'US',
      productCategory: 'Grocery',
      feePercentage: 8,
      minReferralFee: 0.30,
      currency: 'USD',
      condition: 'For products with a total sales price of $15.00 or less',
    },
    {
      marketplaceGroup: 'US',
      productCategory: 'Grocery',
      feePercentage: 15,
      minReferralFee: 0.30,
      currency: 'USD',
      condition: 'For products with a total sales price greater than $15.00',
    },
  ]
  
  for (const fee of referralFees) {
    await prisma.referralFeesLegacy.create({
      data: {
        marketplaceGroup: fee.marketplaceGroup,
        productCategory: fee.productCategory,
        condition: fee.condition,
        feeType: 'percentage',
        priceLowerBound: dec(0),
        priceUpperBound: dec(999999),
        feePercentage: dec(fee.feePercentage),
        minReferralFee: dec(fee.minReferralFee),
        currency: fee.currency,
      },
    })
  }
  
  console.log(`✅ Created ${referralFees.length} referral fees`)
}

async function seedStorageFees() {
  console.log('🏪 Seeding storage fees...')
  
  const storageFees = [
    // US Storage fees
    {
      marketplaceGroup: 'US',
      productSize: 'Standard',
      period: 'January - September',
      fee: 0.87,
      currency: 'USD',
      unitOfMeasure: 'per cubic foot per month',
    },
    {
      marketplaceGroup: 'US',
      productSize: 'Standard',
      period: 'October - December',
      fee: 2.40,
      currency: 'USD',
      unitOfMeasure: 'per cubic foot per month',
    },
    {
      marketplaceGroup: 'US',
      productSize: 'Oversize',
      period: 'January - September',
      fee: 0.56,
      currency: 'USD',
      unitOfMeasure: 'per cubic foot per month',
    },
    {
      marketplaceGroup: 'US',
      productSize: 'Oversize',
      period: 'October - December',
      fee: 1.40,
      currency: 'USD',
      unitOfMeasure: 'per cubic foot per month',
    },
    // UK Storage fees
    {
      marketplaceGroup: 'GB',
      productSize: 'Standard',
      period: 'January - September',
      fee: 0.75,
      currency: 'GBP',
      unitOfMeasure: 'per cubic foot per month',
    },
    {
      marketplaceGroup: 'GB',
      productSize: 'Standard',
      period: 'October - December',
      fee: 1.05,
      currency: 'GBP',
      unitOfMeasure: 'per cubic foot per month',
    },
    {
      marketplaceGroup: 'GB',
      productSize: 'Oversize',
      period: 'January - September',
      fee: 0.48,
      currency: 'GBP',
      unitOfMeasure: 'per cubic foot per month',
    },
    {
      marketplaceGroup: 'GB',
      productSize: 'Oversize',
      period: 'October - December',
      fee: 0.68,
      currency: 'GBP',
      unitOfMeasure: 'per cubic foot per month',
    },
  ]
  
  for (const fee of storageFees) {
    await prisma.storageFeesLegacy.create({
      data: {
        marketplaceGroup: fee.marketplaceGroup,
        productSize: fee.productSize,
        productCategory: 'All',
        period: fee.period,
        unitOfMeasure: fee.unitOfMeasure,
        currency: fee.currency,
        fee: dec(fee.fee),
      },
    })
  }
  
  console.log(`✅ Created ${storageFees.length} storage fees`)
}

async function seedSampleSimulations() {
  console.log('🧪 Creating sample simulations...')
  
  // Get default user
  const defaultUser = await prisma.user.findFirst({
    where: { email: 'admin@marginmaster.com' },
  })
  
  if (!defaultUser) {
    console.log('⚠️ No default user found. Skipping simulations.')
    return
  }
  
  // Get sourcing profiles
  const sourcingProfiles = await prisma.sourcingProfile.findMany()
  
  if (sourcingProfiles.length === 0) {
    console.log('⚠️ No sourcing profiles found. Skipping simulations.')
    return
  }
  
  const simulations = [
    // Profitable scenarios
    {
      name: 'Phone Case - High Margin',
      marketplace: 'US',
      targetSalePrice: dec(29.99),
      estimatedAcosPercent: dec(15),
      refundProvisionPercent: dec(2),
      sourcingProfileId: sourcingProfiles[0].id,
      components: {
        product: {
          category: 'Electronics',
          dimensions: { length: 15, width: 8, height: 1 },
          weight: 50,
          packSize: 1,
        },
        materials: [
          { name: 'Premium Silicone', quantity: 120, unit: 'cm²' },
        ],
        manufacturing: {
          laborCost: 1.50,
          packagingCost: 0.50,
        },
      },
      results: {
        profitable: true,
        netMargin: 12.45,
        marginPercentage: 41.5,
      },
    },
    {
      name: 'Yoga Mat - Standard Margin',
      marketplace: 'US',
      targetSalePrice: dec(39.99),
      estimatedAcosPercent: dec(20),
      refundProvisionPercent: dec(3),
      sourcingProfileId: sourcingProfiles[1].id,
      components: {
        product: {
          category: 'Sports & Outdoors',
          dimensions: { length: 61, width: 15, height: 15 }, // Rolled up
          weight: 1200,
          packSize: 1,
        },
        materials: [
          { name: 'Recycled Plastic', quantity: 1800, unit: 'cm²' },
        ],
        manufacturing: {
          laborCost: 3.00,
          packagingCost: 1.00,
        },
      },
      results: {
        profitable: true,
        netMargin: 8.75,
        marginPercentage: 21.9,
      },
    },
    {
      name: 'T-Shirt Bundle - Low Price FBA',
      marketplace: 'US',
      targetSalePrice: dec(9.99),
      estimatedAcosPercent: dec(25),
      refundProvisionPercent: dec(5),
      sourcingProfileId: sourcingProfiles[2].id,
      components: {
        product: {
          category: 'Clothing & Accessories',
          dimensions: { length: 30, width: 20, height: 2 },
          weight: 150,
          packSize: 3,
        },
        materials: [
          { name: 'Cotton Fabric', quantity: 800, unit: 'cm²' },
        ],
        manufacturing: {
          laborCost: 1.00,
          packagingCost: 0.25,
        },
      },
      results: {
        profitable: true,
        netMargin: 1.85,
        marginPercentage: 18.5,
      },
    },
    // Unprofitable scenarios
    {
      name: 'Cheap Electronics - Loss Leader',
      marketplace: 'US',
      targetSalePrice: dec(12.99),
      estimatedAcosPercent: dec(35),
      refundProvisionPercent: dec(8),
      sourcingProfileId: sourcingProfiles[0].id,
      components: {
        product: {
          category: 'Electronics',
          dimensions: { length: 10, width: 10, height: 3 },
          weight: 200,
          packSize: 1,
        },
        materials: [
          { name: 'Recycled Plastic', quantity: 150, unit: 'cm²' },
        ],
        manufacturing: {
          laborCost: 2.50,
          packagingCost: 0.75,
        },
      },
      results: {
        profitable: false,
        netMargin: -2.15,
        marginPercentage: -16.5,
      },
    },
    {
      name: 'Heavy Garden Tool - Oversized',
      marketplace: 'GB',
      targetSalePrice: dec(45.99),
      estimatedAcosPercent: dec(18),
      refundProvisionPercent: dec(4),
      sourcingProfileId: sourcingProfiles[3].id,
      components: {
        product: {
          category: 'Home & Garden',
          dimensions: { length: 120, width: 30, height: 15 },
          weight: 5500,
          packSize: 1,
        },
        materials: [
          { name: 'Recycled Plastic', quantity: 2500, unit: 'cm²' },
        ],
        manufacturing: {
          laborCost: 8.00,
          packagingCost: 2.50,
        },
      },
      results: {
        profitable: false,
        netMargin: -3.25,
        marginPercentage: -7.1,
      },
    },
    // Edge cases
    {
      name: 'Bamboo Cutlery Set - Eco Product',
      marketplace: 'US',
      targetSalePrice: dec(24.99),
      estimatedAcosPercent: dec(22),
      refundProvisionPercent: dec(3),
      sourcingProfileId: sourcingProfiles[3].id,
      components: {
        product: {
          category: 'Home & Garden',
          dimensions: { length: 25, width: 10, height: 3 },
          weight: 350,
          packSize: 1,
        },
        materials: [
          { name: 'Bamboo Fiber', quantity: 400, unit: 'cm²' },
        ],
        manufacturing: {
          laborCost: 2.25,
          packagingCost: 1.50,
        },
      },
      results: {
        profitable: true,
        netMargin: 3.15,
        marginPercentage: 12.6,
      },
    },
    {
      name: 'Multi-Pack Beauty Set',
      marketplace: 'US',
      targetSalePrice: dec(89.99),
      estimatedAcosPercent: dec(15),
      refundProvisionPercent: dec(2),
      sourcingProfileId: sourcingProfiles[2].id,
      components: {
        product: {
          category: 'Beauty & Personal Care',
          dimensions: { length: 30, width: 20, height: 10 },
          weight: 800,
          packSize: 5,
        },
        materials: [
          { name: 'Premium Silicone', quantity: 600, unit: 'cm²' },
          { name: 'Recycled Plastic', quantity: 800, unit: 'cm²' },
        ],
        manufacturing: {
          laborCost: 12.00,
          packagingCost: 5.00,
        },
      },
      results: {
        profitable: true,
        netMargin: 18.75,
        marginPercentage: 20.8,
      },
    },
  ]
  
  for (const sim of simulations) {
    await prisma.simulation.create({
      data: {
        userId: defaultUser.id,
        name: sim.name,
        marketplace: sim.marketplace,
        targetSalePrice: sim.targetSalePrice,
        estimatedAcosPercent: sim.estimatedAcosPercent,
        refundProvisionPercent: sim.refundProvisionPercent,
        sourcingProfileId: sim.sourcingProfileId,
        components: sim.components,
        results: sim.results,
      },
    })
  }
  
  console.log(`✅ Created ${simulations.length} sample simulations`)
}

async function seedDefaultUser() {
  console.log('👤 Creating default user...')
  
  const defaultUser = await prisma.user.upsert({
    where: { email: 'admin@marginmaster.com' },
    update: {},
    create: {
      email: 'admin@marginmaster.com',
      name: 'Admin User',
      password: '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', // secret123
      role: 'ADMIN',
    },
  })
  
  console.log('✅ Default user created/verified')
  return defaultUser
}

async function main() {
  console.log('🚀 Starting comprehensive FBA data seeding...\n')
  
  try {
    // Check existing data
    const existingData = await checkExistingData()
    
    // Seed base data
    await seedDefaultUser()
    await seedCountries()
    await seedPrograms()
    await seedSizeTiers()
    
    // Only seed weight bands if they don't exist
    if (existingData.weightBands === 0) {
      await seedWeightBands()
    } else {
      console.log(`⏭️ Skipping weight bands (${existingData.weightBands} already exist)`)
    }
    
    // Seed fee data
    await seedStandardFees()
    await seedLowPriceFees()
    await seedReferralFees()
    await seedStorageFees()
    
    // Create sample simulations
    await seedSampleSimulations()
    
    console.log('\n✅ Database seeding completed successfully!')
    console.log('📊 You now have realistic FBA data for testing various scenarios:')
    console.log('   - Multiple marketplaces (US, UK, etc.)')
    console.log('   - Different product categories')
    console.log('   - Various size tiers and weight bands')
    console.log('   - Standard and Low-Price FBA programs')
    console.log('   - Profitable and unprofitable scenarios')
    console.log('   - Edge cases and multi-pack products')
    
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the seeding
main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
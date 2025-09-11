import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAmazonFBAFees() {
  console.log('🚀 Starting Amazon FBA fees seed...');

  // Clear existing data
  await prisma.amazonFBAFee.deleteMany();
  console.log('✅ Cleared existing Amazon FBA fee data');

  // Standard FBA Fulfillment Fees (2024 rates)
  const standardFBAFees = [
    // Small standard-size
    { productSizeTier: 'Small standard', unitWeight: '4 oz or less', minWeight: 0, maxWeight: 4, fulfillmentFee: 3.22 },
    { productSizeTier: 'Small standard', unitWeight: '4+ to 8 oz', minWeight: 4.01, maxWeight: 8, fulfillmentFee: 3.40 },
    { productSizeTier: 'Small standard', unitWeight: '8+ to 12 oz', minWeight: 8.01, maxWeight: 12, fulfillmentFee: 3.58 },
    { productSizeTier: 'Small standard', unitWeight: '12+ to 16 oz', minWeight: 12.01, maxWeight: 16, fulfillmentFee: 3.77 },
    
    // Large standard-size
    { productSizeTier: 'Large standard', unitWeight: '4 oz or less', minWeight: 0, maxWeight: 4, fulfillmentFee: 3.86 },
    { productSizeTier: 'Large standard', unitWeight: '4+ to 8 oz', minWeight: 4.01, maxWeight: 8, fulfillmentFee: 4.08 },
    { productSizeTier: 'Large standard', unitWeight: '8+ to 12 oz', minWeight: 8.01, maxWeight: 12, fulfillmentFee: 4.24 },
    { productSizeTier: 'Large standard', unitWeight: '12+ to 16 oz', minWeight: 12.01, maxWeight: 16, fulfillmentFee: 4.75 },
    { productSizeTier: 'Large standard', unitWeight: '1+ to 1.25 lb', minWeight: 16.01, maxWeight: 20, fulfillmentFee: 5.40 },
    { productSizeTier: 'Large standard', unitWeight: '1.25+ to 1.5 lb', minWeight: 20.01, maxWeight: 24, fulfillmentFee: 5.48 },
    { productSizeTier: 'Large standard', unitWeight: '1.5+ to 1.75 lb', minWeight: 24.01, maxWeight: 28, fulfillmentFee: 5.73 },
    { productSizeTier: 'Large standard', unitWeight: '1.75+ to 2 lb', minWeight: 28.01, maxWeight: 32, fulfillmentFee: 5.81 },
    { productSizeTier: 'Large standard', unitWeight: '2+ to 2.25 lb', minWeight: 32.01, maxWeight: 36, fulfillmentFee: 5.94 },
    { productSizeTier: 'Large standard', unitWeight: '2.25+ to 2.5 lb', minWeight: 36.01, maxWeight: 40, fulfillmentFee: 6.10 },
    { productSizeTier: 'Large standard', unitWeight: '2.5+ to 2.75 lb', minWeight: 40.01, maxWeight: 44, fulfillmentFee: 6.20 },
    { productSizeTier: 'Large standard', unitWeight: '2.75+ to 3 lb', minWeight: 44.01, maxWeight: 48, fulfillmentFee: 6.30 },
    { productSizeTier: 'Large standard', unitWeight: '3+ lb to 20 lb', minWeight: 48.01, maxWeight: 320, fulfillmentFee: 6.30 }, // Base + $0.16/half-lb above first 3 lb
    
    // Large bulky
    { productSizeTier: 'Large bulky', unitWeight: '0 to 50 lb', minWeight: 0, maxWeight: 800, fulfillmentFee: 9.61 }, // Base + $0.38/lb above first 1 lb
    
    // Extra-large 0 to 50 lb
    { productSizeTier: 'Extra-large 0 to 50 lb', unitWeight: '0 to 50 lb', minWeight: 0, maxWeight: 800, fulfillmentFee: 26.28 }, // Base + $0.38/lb above first 1 lb
    
    // Extra-large 50+ to 70 lb
    { productSizeTier: 'Extra-large 50+ to 70 lb', unitWeight: '50+ to 70 lb', minWeight: 800.01, maxWeight: 1120, fulfillmentFee: 45.06 }, // Base + $0.38/lb above first 51 lb
    
    // Extra-large 70+ to 150 lb
    { productSizeTier: 'Extra-large 70+ to 150 lb', unitWeight: '70+ to 150 lb', minWeight: 1120.01, maxWeight: 2400, fulfillmentFee: 64.10 }, // Base + $0.38/lb above first 71 lb
    
    // Extra-large 150+ lb
    { productSizeTier: 'Extra-large 150+ lb', unitWeight: '150+ lb', minWeight: 2400.01, maxWeight: null, fulfillmentFee: 182.32 }, // Base + $0.83/lb above first 151 lb
  ];

  // Low-price FBA fees (for items under $10)
  const lowPriceFBAFees = [
    // Small standard-size (price < $10)
    { productSizeTier: 'Small standard', unitWeight: '4 oz or less', minWeight: 0, maxWeight: 4, priceThreshold: 10.00, fulfillmentFee: 2.45 },
    { productSizeTier: 'Small standard', unitWeight: '4+ to 8 oz', minWeight: 4.01, maxWeight: 8, priceThreshold: 10.00, fulfillmentFee: 2.63 },
    { productSizeTier: 'Small standard', unitWeight: '8+ to 12 oz', minWeight: 8.01, maxWeight: 12, priceThreshold: 10.00, fulfillmentFee: 2.81 },
    { productSizeTier: 'Small standard', unitWeight: '12+ to 16 oz', minWeight: 12.01, maxWeight: 16, priceThreshold: 10.00, fulfillmentFee: 3.00 },
    
    // Large standard-size (price < $10)
    { productSizeTier: 'Large standard', unitWeight: '4 oz or less', minWeight: 0, maxWeight: 4, priceThreshold: 10.00, fulfillmentFee: 3.09 },
    { productSizeTier: 'Large standard', unitWeight: '4+ to 8 oz', minWeight: 4.01, maxWeight: 8, priceThreshold: 10.00, fulfillmentFee: 3.31 },
    { productSizeTier: 'Large standard', unitWeight: '8+ to 12 oz', minWeight: 8.01, maxWeight: 12, priceThreshold: 10.00, fulfillmentFee: 3.47 },
    { productSizeTier: 'Large standard', unitWeight: '12+ to 16 oz', minWeight: 12.01, maxWeight: 16, priceThreshold: 10.00, fulfillmentFee: 3.98 },
    { productSizeTier: 'Large standard', unitWeight: '1+ to 1.25 lb', minWeight: 16.01, maxWeight: 20, priceThreshold: 10.00, fulfillmentFee: 4.63 },
    { productSizeTier: 'Large standard', unitWeight: '1.25+ to 1.5 lb', minWeight: 20.01, maxWeight: 24, priceThreshold: 10.00, fulfillmentFee: 4.71 },
    { productSizeTier: 'Large standard', unitWeight: '1.5+ to 1.75 lb', minWeight: 24.01, maxWeight: 28, priceThreshold: 10.00, fulfillmentFee: 4.96 },
    { productSizeTier: 'Large standard', unitWeight: '1.75+ to 2 lb', minWeight: 28.01, maxWeight: 32, priceThreshold: 10.00, fulfillmentFee: 5.04 },
    { productSizeTier: 'Large standard', unitWeight: '2+ to 2.25 lb', minWeight: 32.01, maxWeight: 36, priceThreshold: 10.00, fulfillmentFee: 5.17 },
    { productSizeTier: 'Large standard', unitWeight: '2.25+ to 2.5 lb', minWeight: 36.01, maxWeight: 40, priceThreshold: 10.00, fulfillmentFee: 5.33 },
    { productSizeTier: 'Large standard', unitWeight: '2.5+ to 2.75 lb', minWeight: 40.01, maxWeight: 44, priceThreshold: 10.00, fulfillmentFee: 5.43 },
    { productSizeTier: 'Large standard', unitWeight: '2.75+ to 3 lb', minWeight: 44.01, maxWeight: 48, priceThreshold: 10.00, fulfillmentFee: 5.53 },
    { productSizeTier: 'Large standard', unitWeight: '3+ lb to 20 lb', minWeight: 48.01, maxWeight: 320, priceThreshold: 10.00, fulfillmentFee: 5.53 }, // Base + $0.16/half-lb above first 3 lb
  ];

  const effectiveDate = new Date('2024-01-15'); // Amazon's 2024 FBA fee effective date

  // Insert standard FBA fees
  for (const fee of standardFBAFees) {
    await prisma.amazonFBAFee.create({
      data: {
        marketplace: 'US',
        currency: 'USD',
        label: 'standard',
        effectiveDate,
        productSizeTier: fee.productSizeTier,
        unitWeight: fee.unitWeight,
        minWeight: fee.minWeight,
        maxWeight: fee.maxWeight,
        priceThreshold: null,
        fulfillmentFee: fee.fulfillmentFee,
        updatedAt: new Date(),
        metadata: {
          source: 'Amazon FBA 2024 Fee Schedule',
          note: fee.unitWeight.includes('lb') && fee.productSizeTier.includes('standard') 
            ? 'Additional $0.16 per half-pound above base weight' 
            : fee.productSizeTier.includes('bulky') || fee.productSizeTier.includes('Extra-large')
            ? 'Additional per-pound charges apply above base weight'
            : null
        }
      }
    });
  }
  console.log(`✅ Inserted ${standardFBAFees.length} standard FBA fee records`);

  // Insert low-price FBA fees
  for (const fee of lowPriceFBAFees) {
    await prisma.amazonFBAFee.create({
      data: {
        marketplace: 'US',
        currency: 'USD',
        label: 'low-price',
        effectiveDate,
        productSizeTier: fee.productSizeTier,
        unitWeight: fee.unitWeight,
        minWeight: fee.minWeight,
        maxWeight: fee.maxWeight,
        priceThreshold: fee.priceThreshold,
        fulfillmentFee: fee.fulfillmentFee,
        updatedAt: new Date(),
        metadata: {
          source: 'Amazon FBA 2024 Fee Schedule - Low-price FBA',
          note: 'Applies to products with price less than $10.00'
        }
      }
    });
  }
  console.log(`✅ Inserted ${lowPriceFBAFees.length} low-price FBA fee records`);

  const totalRecords = standardFBAFees.length + lowPriceFBAFees.length;
  console.log(`\n✅ Successfully seeded ${totalRecords} Amazon FBA fee records`);
  console.log('📊 Fee types: Standard and Low-price');
  console.log('📅 Effective date: 2024-01-15');
  
  await prisma.$disconnect();
}

seedAmazonFBAFees()
  .catch((e) => {
    console.error('❌ Error seeding Amazon FBA fees:', e);
    process.exit(1);
  });
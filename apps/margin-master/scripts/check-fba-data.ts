import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkFBAData() {
  console.log('🔍 Checking FBA Fees Data...\n');
  
  // Check standard fees
  const standardFees = await prisma.standardFees.findMany({
    take: 10,
    orderBy: [
      { marketplace: 'asc' },
      { sizeTierName: 'asc' },
      { rateWeightLowerBoundKg: 'asc' }
    ]
  });
  
  console.log('📦 Sample Standard Fees:');
  console.log('========================');
  for (const fee of standardFees) {
    console.log(`
Marketplace: ${fee.marketplace}
Size Tier: ${fee.sizeTierName}
Dimensions: ${fee.lengthLimitCm} × ${fee.widthLimitCm} × ${fee.heightLimitCm} cm
Weight Range: ${fee.rateWeightLowerBoundKg} - ${fee.rateWeightUpperBoundKg} kg
Fee: ${fee.currency} ${fee.fee}
---`);
  }
  
  // Check for unusual dimension values
  const unusualDimensions = await prisma.standardFees.findMany({
    where: {
      OR: [
        { lengthLimitCm: { gt: 1000 } },
        { widthLimitCm: { gt: 1000 } },
        { heightLimitCm: { gt: 1000 } }
      ]
    }
  });
  
  if (unusualDimensions.length > 0) {
    console.log('\n⚠️  Found entries with unusual dimensions (> 1000 cm):');
    console.log('=====================================================');
    for (const fee of unusualDimensions) {
      console.log(`${fee.marketplace} - ${fee.sizeTierName}: ${fee.lengthLimitCm} × ${fee.widthLimitCm} × ${fee.heightLimitCm} cm`);
    }
  }
  
  // Count by marketplace
  const marketplaceCounts = await prisma.standardFees.groupBy({
    by: ['marketplace'],
    _count: true
  });
  
  console.log('\n📊 Standard Fees Count by Marketplace:');
  console.log('=====================================');
  for (const count of marketplaceCounts) {
    console.log(`${count.marketplace}: ${count._count} entries`);
  }
  
  // Count unique size tiers
  const sizeTiers = await prisma.standardFees.groupBy({
    by: ['sizeTierName'],
    _count: true
  });
  
  console.log('\n📏 Size Tier Distribution:');
  console.log('=========================');
  for (const tier of sizeTiers) {
    console.log(`${tier.sizeTierName}: ${tier._count} entries`);
  }
  
  // Check SIPP discounts structure
  const sippDiscounts = await prisma.sippDiscounts.findMany({
    take: 5
  });
  
  console.log('\n💰 Sample SIPP Discounts:');
  console.log('========================');
  for (const discount of sippDiscounts) {
    console.log(`
Program: ${discount.programName}
Size Tier: ${discount.sizeTierName}
Weight Range: ${discount.rateWeightLowerBoundKg} - ${discount.rateWeightUpperBoundKg} kg
Marketplace: ${discount.marketplace}
Discount: ${discount.currency} ${discount.discount}
---`);
  }
}

checkFBAData()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
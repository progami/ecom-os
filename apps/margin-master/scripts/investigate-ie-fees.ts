import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function investigateIrelandFees() {
  console.log('🔍 Investigating Ireland (IE) Standard Parcel Fees\n');
  
  // Get all IE Standard parcel fees
  const ieFees = await prisma.standardFees.findMany({
    where: {
      marketplace: 'IE',
      sizeTierName: 'Standard parcel'
    },
    orderBy: {
      rateWeightLowerBoundKg: 'asc'
    }
  });
  
  console.log('Found', ieFees.length, 'fee entries for IE Standard parcel:\n');
  
  // Display all fees with details
  ieFees.forEach((fee, index) => {
    console.log(`${index + 1}. Weight Range: ${fee.rateWeightLowerBoundKg.toString()}-${fee.rateWeightUpperBoundKg.toString()}kg`);
    console.log(`   Size Limits: ${fee.lengthLimitCm}x${fee.widthLimitCm}x${fee.heightLimitCm}cm`);
    console.log(`   Fee: ${fee.currency} ${fee.fee.toString()}`);
    console.log(`   Unit Weight Limit: ${fee.tierUnitWeightLimitKg?.toString() || 'N/A'}kg`);
    console.log(`   Dim Weight Limit: ${fee.tierDimWeightLimitKg?.toString() || 'N/A'}kg`);
    console.log('');
  });
  
  // Check for similar patterns in other marketplaces
  console.log('\n📊 Checking if other marketplaces have similar patterns...\n');
  
  const allStandardParcels = await prisma.standardFees.findMany({
    where: {
      sizeTierName: 'Standard parcel',
      rateWeightLowerBoundKg: { lte: 0.15 },
      rateWeightUpperBoundKg: { gte: 0.15 }
    },
    orderBy: [
      { marketplace: 'asc' },
      { rateWeightLowerBoundKg: 'asc' }
    ]
  });
  
  // Group by marketplace
  const byMarketplace: { [key: string]: typeof allStandardParcels } = {};
  allStandardParcels.forEach(fee => {
    if (!byMarketplace[fee.marketplace]) byMarketplace[fee.marketplace] = [];
    byMarketplace[fee.marketplace].push(fee);
  });
  
  for (const [marketplace, fees] of Object.entries(byMarketplace)) {
    if (fees.length >= 2) {
      const firstRange = fees.find(f => f.rateWeightLowerBoundKg.toNumber() === 0);
      const secondRange = fees.find(f => f.rateWeightLowerBoundKg.toNumber() === 0.15);
      
      if (firstRange && secondRange) {
        const decrease = firstRange.fee.toNumber() - secondRange.fee.toNumber();
        if (decrease > 0) {
          console.log(`${marketplace}: Fee decreases from ${firstRange.fee} to ${secondRange.fee} (decrease: ${decrease.toFixed(2)})`);
        }
      }
    }
  }
  
  // Let's also check if this might be related to different size tier categories
  console.log('\n🔍 Checking all size tiers in IE marketplace for pattern understanding:\n');
  
  const allIeFees = await prisma.standardFees.findMany({
    where: {
      marketplace: 'IE'
    },
    orderBy: [
      { sizeTierName: 'asc' },
      { rateWeightLowerBoundKg: 'asc' }
    ]
  });
  
  // Group by size tier
  const bySizeTier: { [key: string]: typeof allIeFees } = {};
  allIeFees.forEach(fee => {
    if (!bySizeTier[fee.sizeTierName]) bySizeTier[fee.sizeTierName] = [];
    bySizeTier[fee.sizeTierName].push(fee);
  });
  
  for (const [sizeTier, fees] of Object.entries(bySizeTier)) {
    console.log(`\n${sizeTier}: ${fees.length} weight ranges`);
    console.log('First few entries:');
    fees.slice(0, 3).forEach(fee => {
      console.log(`  ${fee.rateWeightLowerBoundKg}-${fee.rateWeightUpperBoundKg}kg: €${fee.fee}`);
    });
  }
}

investigateIrelandFees()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
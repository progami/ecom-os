import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeDimensionIssue() {
  console.log('🔍 Analyzing dimension data...\n');
  
  // Check for any unusual values in dimensions
  const allFees = await prisma.standardFees.findMany({
    select: {
      sizeTierName: true,
      lengthLimitCm: true,
      widthLimitCm: true,
      heightLimitCm: true,
      marketplace: true
    }
  });
  
  // Group by size tier and check consistency
  const sizeTierDimensions = new Map();
  
  for (const fee of allFees) {
    const key = fee.sizeTierName;
    if (!sizeTierDimensions.has(key)) {
      sizeTierDimensions.set(key, []);
    }
    sizeTierDimensions.get(key).push({
      dimensions: `${fee.lengthLimitCm} × ${fee.widthLimitCm} × ${fee.heightLimitCm}`,
      marketplace: fee.marketplace
    });
  }
  
  console.log('📏 Dimension Consistency by Size Tier:');
  console.log('=====================================');
  
  for (const [tier, entries] of sizeTierDimensions) {
    const uniqueDimensions = new Set(entries.map((e: any) => e.dimensions));
    console.log(`\n${tier}:`);
    if (uniqueDimensions.size === 1) {
      console.log(`  ✅ Consistent: ${Array.from(uniqueDimensions)[0]} cm`);
    } else {
      console.log(`  ⚠️  Multiple dimensions found:`);
      for (const dim of uniqueDimensions) {
        const markets = entries.filter((e: any) => e.dimensions === dim).map((e: any) => e.marketplace);
        console.log(`    - ${dim} cm (${markets.join(', ')})`);
      }
    }
  }
  
  // Check if there are any zero values (since fields are not nullable)
  const zeroDimensions = await prisma.standardFees.findMany({
    where: {
      OR: [
        { lengthLimitCm: 0 },
        { widthLimitCm: 0 },
        { heightLimitCm: 0 }
      ]
    }
  });
  
  if (zeroDimensions.length > 0) {
    console.log('\n⚠️  Found entries with ZERO dimensions:');
    for (const fee of zeroDimensions) {
      console.log(`  - ${fee.marketplace} - ${fee.sizeTierName}`);
    }
  }
}

analyzeDimensionIssue()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
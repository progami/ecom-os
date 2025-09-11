import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

interface WeightBoundaryIssue {
  table: string;
  marketplace: string;
  sizeTier: string;
  issue: string;
  details: any;
}

interface FeeProgressionIssue {
  table: string;
  marketplace: string;
  sizeTier: string;
  issue: string;
  details: any;
}

async function analyzeWeightBoundaries() {
  const issues: WeightBoundaryIssue[] = [];
  
  // Analyze Standard Fees
  console.log('\n🔍 Analyzing Standard Fees Weight Boundaries...');
  const standardFees = await prisma.standardFees.findMany({
    orderBy: [
      { marketplace: 'asc' },
      { sizeTierName: 'asc' },
      { rateWeightLowerBoundKg: 'asc' }
    ]
  });
  
  // Group by marketplace and size tier
  const standardGroups: { [key: string]: typeof standardFees } = {};
  standardFees.forEach(fee => {
    const key = `${fee.marketplace}-${fee.sizeTierName}`;
    if (!standardGroups[key]) standardGroups[key] = [];
    standardGroups[key].push(fee);
  });
  
  // Check for gaps and overlaps
  for (const [key, fees] of Object.entries(standardGroups)) {
    for (let i = 0; i < fees.length - 1; i++) {
      const current = fees[i];
      const next = fees[i + 1];
      
      // Check for gaps
      if (current.rateWeightUpperBoundKg.toNumber() < next.rateWeightLowerBoundKg.toNumber()) {
        issues.push({
          table: 'StandardFees',
          marketplace: current.marketplace,
          sizeTier: current.sizeTierName,
          issue: 'Gap in weight boundaries',
          details: {
            currentRange: `${current.rateWeightLowerBoundKg}-${current.rateWeightUpperBoundKg}`,
            nextRange: `${next.rateWeightLowerBoundKg}-${next.rateWeightUpperBoundKg}`,
            gap: `${current.rateWeightUpperBoundKg} to ${next.rateWeightLowerBoundKg}`
          }
        });
      }
      
      // Check for overlaps
      if (current.rateWeightUpperBoundKg.toNumber() > next.rateWeightLowerBoundKg.toNumber()) {
        issues.push({
          table: 'StandardFees',
          marketplace: current.marketplace,
          sizeTier: current.sizeTierName,
          issue: 'Overlap in weight boundaries',
          details: {
            currentRange: `${current.rateWeightLowerBoundKg}-${current.rateWeightUpperBoundKg}`,
            nextRange: `${next.rateWeightLowerBoundKg}-${next.rateWeightUpperBoundKg}`,
            overlap: `${next.rateWeightLowerBoundKg} to ${current.rateWeightUpperBoundKg}`
          }
        });
      }
    }
  }
  
  // Analyze Low Price Fees
  console.log('\n🔍 Analyzing Low Price Fees Weight Boundaries...');
  const lowPriceFees = await prisma.lowPriceFees.findMany({
    orderBy: [
      { marketplace: 'asc' },
      { programName: 'asc' },
      { sizeTierName: 'asc' },
      { rateWeightLowerBoundKg: 'asc' }
    ]
  });
  
  // Group by marketplace, program, and size tier
  const lowPriceGroups: { [key: string]: typeof lowPriceFees } = {};
  lowPriceFees.forEach(fee => {
    const key = `${fee.marketplace}-${fee.programName}-${fee.sizeTierName}`;
    if (!lowPriceGroups[key]) lowPriceGroups[key] = [];
    lowPriceGroups[key].push(fee);
  });
  
  // Check for gaps and overlaps in low price fees
  for (const [key, fees] of Object.entries(lowPriceGroups)) {
    for (let i = 0; i < fees.length - 1; i++) {
      const current = fees[i];
      const next = fees[i + 1];
      
      if (current.rateWeightUpperBoundKg.toNumber() < next.rateWeightLowerBoundKg.toNumber()) {
        issues.push({
          table: 'LowPriceFees',
          marketplace: current.marketplace,
          sizeTier: `${current.programName} - ${current.sizeTierName}`,
          issue: 'Gap in weight boundaries',
          details: {
            currentRange: `${current.rateWeightLowerBoundKg}-${current.rateWeightUpperBoundKg}`,
            nextRange: `${next.rateWeightLowerBoundKg}-${next.rateWeightUpperBoundKg}`,
            gap: `${current.rateWeightUpperBoundKg} to ${next.rateWeightLowerBoundKg}`
          }
        });
      }
      
      if (current.rateWeightUpperBoundKg.toNumber() > next.rateWeightLowerBoundKg.toNumber()) {
        issues.push({
          table: 'LowPriceFees',
          marketplace: current.marketplace,
          sizeTier: `${current.programName} - ${current.sizeTierName}`,
          issue: 'Overlap in weight boundaries',
          details: {
            currentRange: `${current.rateWeightLowerBoundKg}-${current.rateWeightUpperBoundKg}`,
            nextRange: `${next.rateWeightLowerBoundKg}-${next.rateWeightUpperBoundKg}`,
            overlap: `${next.rateWeightLowerBoundKg} to ${current.rateWeightUpperBoundKg}`
          }
        });
      }
    }
  }
  
  return issues;
}

async function analyzeFeeProgressions() {
  const issues: FeeProgressionIssue[] = [];
  
  // Analyze Standard Fees Progression
  console.log('\n📈 Analyzing Fee Progressions...');
  const standardFees = await prisma.standardFees.findMany({
    orderBy: [
      { marketplace: 'asc' },
      { sizeTierName: 'asc' },
      { rateWeightLowerBoundKg: 'asc' }
    ]
  });
  
  // Group by marketplace and size tier
  const standardGroups: { [key: string]: typeof standardFees } = {};
  standardFees.forEach(fee => {
    const key = `${fee.marketplace}-${fee.sizeTierName}`;
    if (!standardGroups[key]) standardGroups[key] = [];
    standardGroups[key].push(fee);
  });
  
  // Check for fee progression anomalies
  for (const [key, fees] of Object.entries(standardGroups)) {
    for (let i = 0; i < fees.length - 1; i++) {
      const current = fees[i];
      const next = fees[i + 1];
      
      // Check if fees decrease with increasing weight (unusual)
      if (next.fee.toNumber() < current.fee.toNumber()) {
        issues.push({
          table: 'StandardFees',
          marketplace: current.marketplace,
          sizeTier: current.sizeTierName,
          issue: 'Fee decreases with increasing weight',
          details: {
            currentWeight: `${current.rateWeightLowerBoundKg}-${current.rateWeightUpperBoundKg}kg`,
            currentFee: `${current.currency} ${current.fee}`,
            nextWeight: `${next.rateWeightLowerBoundKg}-${next.rateWeightUpperBoundKg}kg`,
            nextFee: `${next.currency} ${next.fee}`,
            decrease: `${current.fee.toNumber() - next.fee.toNumber()}`
          }
        });
      }
      
      // Check for unusually large fee jumps (more than 100% increase)
      const percentIncrease = ((next.fee.toNumber() - current.fee.toNumber()) / current.fee.toNumber()) * 100;
      if (percentIncrease > 100) {
        issues.push({
          table: 'StandardFees',
          marketplace: current.marketplace,
          sizeTier: current.sizeTierName,
          issue: 'Large fee jump (>100% increase)',
          details: {
            currentWeight: `${current.rateWeightLowerBoundKg}-${current.rateWeightUpperBoundKg}kg`,
            currentFee: `${current.currency} ${current.fee}`,
            nextWeight: `${next.rateWeightLowerBoundKg}-${next.rateWeightUpperBoundKg}kg`,
            nextFee: `${next.currency} ${next.fee}`,
            percentIncrease: `${percentIncrease.toFixed(2)}%`
          }
        });
      }
    }
  }
  
  return issues;
}

async function analyzeDataAnomalies() {
  const anomalies: any[] = [];
  
  // Check for negative or zero fees
  console.log('\n🚨 Checking for data anomalies...');
  
  const zeroOrNegativeFees = await prisma.standardFees.findMany({
    where: {
      fee: { lte: 0 }
    }
  });
  
  if (zeroOrNegativeFees.length > 0) {
    anomalies.push({
      issue: 'Zero or negative fees found',
      table: 'StandardFees',
      count: zeroOrNegativeFees.length,
      examples: zeroOrNegativeFees.slice(0, 3).map(f => ({
        marketplace: f.marketplace,
        sizeTier: f.sizeTierName,
        weight: `${f.rateWeightLowerBoundKg}-${f.rateWeightUpperBoundKg}kg`,
        fee: f.fee.toString()
      }))
    });
  }
  
  // Check for invalid weight ranges (lower > upper)
  // Note: This requires fetching all records and filtering in memory since Prisma doesn't support field-to-field comparisons
  const allStandardFees = await prisma.standardFees.findMany();
  const invalidWeightRanges = allStandardFees.filter(fee => 
    fee.rateWeightLowerBoundKg > fee.rateWeightUpperBoundKg
  );
  
  // Check referral fees for invalid percentage ranges
  const invalidReferralFees = await prisma.referralFeeNew.findMany({
    where: {
      OR: [
        { feePercentage: { lte: 0 } },
        { feePercentage: { gt: 100 } }
      ]
    }
  });
  
  if (invalidReferralFees.length > 0) {
    anomalies.push({
      issue: 'Invalid referral fee percentages',
      table: 'ReferralFees',
      count: invalidReferralFees.length,
      examples: invalidReferralFees.slice(0, 3).map(f => ({
        category: f.category,
        subcategory: f.subcategory,
        percentage: f.feePercentage.toString()
      }))
    });
  }
  
  return anomalies;
}

async function suggestSortingOrder() {
  console.log('\n📊 Suggested Sorting Orders:');
  
  const suggestions = {
    StandardFees: {
      primary: 'By marketplace, size tier, then weight range',
      fields: ['marketplace', 'sizeTierName', 'rateWeightLowerBoundKg'],
      reasoning: 'Groups fees logically by market and size, with weight progression within each group'
    },
    LowPriceFees: {
      primary: 'By marketplace, program name, size tier, then weight range',
      fields: ['marketplace', 'programName', 'sizeTierName', 'rateWeightLowerBoundKg'],
      reasoning: 'Groups by market and program, then follows same pattern as standard fees'
    },
    SippDiscounts: {
      primary: 'By marketplace, program name, size tier, then weight range',
      fields: ['marketplace', 'programName', 'sizeTierName', 'rateWeightLowerBoundKg'],
      reasoning: 'Consistent with fee structure sorting, makes discount lookup efficient'
    },
    StorageFees: {
      primary: 'By marketplace group, product size, period, then category',
      fields: ['marketplaceGroup', 'productSize', 'period', 'productCategory'],
      reasoning: 'Prioritizes size and time period which are primary factors in storage cost'
    },
    ReferralFees: {
      primary: 'By marketplace group, category, then price range',
      fields: ['marketplaceGroup', 'productCategory', 'priceLowerBound'],
      reasoning: 'Groups by market and category, with price progression for easy lookup'
    },
    LowInventoryFees: {
      primary: 'By marketplace group, tier group, then days of supply',
      fields: ['marketplaceGroup', 'tierGroup', 'daysOfSupplyLowerBound'],
      reasoning: 'Groups by market and tier, with time-based progression'
    }
  };
  
  return suggestions;
}

// Main analysis function
async function main() {
  console.log('🔍 Amazon Fee Tables Analysis');
  console.log('============================\n');
  
  try {
    // Analyze weight boundaries
    const boundaryIssues = await analyzeWeightBoundaries();
    console.log('\n📋 Weight Boundary Issues:');
    if (boundaryIssues.length === 0) {
      console.log('✅ No weight boundary issues found!');
    } else {
      boundaryIssues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.table} - ${issue.marketplace} - ${issue.sizeTier}`);
        console.log(`   Issue: ${issue.issue}`);
        console.log(`   Details:`, issue.details);
      });
    }
    
    // Analyze fee progressions
    const progressionIssues = await analyzeFeeProgressions();
    console.log('\n\n📈 Fee Progression Issues:');
    if (progressionIssues.length === 0) {
      console.log('✅ No fee progression issues found!');
    } else {
      progressionIssues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.table} - ${issue.marketplace} - ${issue.sizeTier}`);
        console.log(`   Issue: ${issue.issue}`);
        console.log(`   Details:`, issue.details);
      });
    }
    
    // Analyze data anomalies
    const anomalies = await analyzeDataAnomalies();
    console.log('\n\n🚨 Data Anomalies:');
    if (anomalies.length === 0) {
      console.log('✅ No data anomalies found!');
    } else {
      anomalies.forEach((anomaly, index) => {
        console.log(`\n${index + 1}. ${anomaly.issue}`);
        console.log(`   Table: ${anomaly.table}`);
        console.log(`   Count: ${anomaly.count}`);
        console.log(`   Examples:`, anomaly.examples);
      });
    }
    
    // Suggest sorting orders
    const sortingSuggestions = await suggestSortingOrder();
    console.log('\n\n📊 Sorting Order Suggestions:');
    for (const [table, suggestion] of Object.entries(sortingSuggestions)) {
      console.log(`\n${table}:`);
      console.log(`  Primary sort: ${suggestion.primary}`);
      console.log(`  Fields: ${suggestion.fields.join(' → ')}`);
      console.log(`  Reasoning: ${suggestion.reasoning}`);
    }
    
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

interface DataQualityIssue {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  table: string;
  issue: string;
  details: any;
  recommendation: string;
}

async function comprehensiveDataAnalysis() {
  const issues: DataQualityIssue[] = [];
  
  console.log('🔍 Comprehensive Amazon Fee Data Analysis\n');
  console.log('=========================================\n');
  
  // 1. Check for duplicate entries
  console.log('1️⃣ Checking for duplicate entries...\n');
  
  // Check standard fees for duplicates
  const standardFees = await prisma.standardFees.findMany();
  const standardDuplicates = new Map<string, any[]>();
  
  standardFees.forEach(fee => {
    const key = `${fee.marketplace}-${fee.sizeTierName}-${fee.rateWeightLowerBoundKg}-${fee.rateWeightUpperBoundKg}`;
    if (!standardDuplicates.has(key)) {
      standardDuplicates.set(key, []);
    }
    standardDuplicates.get(key)!.push(fee);
  });
  
  standardDuplicates.forEach((entries, key) => {
    if (entries.length > 1) {
      issues.push({
        severity: 'HIGH',
        table: 'StandardFees',
        issue: 'Duplicate entries found',
        details: {
          key,
          count: entries.length,
          fees: entries.map(e => e.fee.toString())
        },
        recommendation: 'Remove duplicate entries, keeping the most recent or accurate one'
      });
    }
  });
  
  // 2. Check for missing critical weight ranges
  console.log('2️⃣ Checking for missing critical weight ranges...\n');
  
  const criticalWeights = [0, 0.5, 1, 2, 5, 10]; // Common weight checkpoints
  const marketplaces = ['UK', 'DE', 'FR', 'IT', 'ES', 'NL', 'PL', 'SE', 'BE', 'IE'];
  
  for (const marketplace of marketplaces) {
    const marketplaceFees = await prisma.standardFees.findMany({
      where: { marketplace },
      orderBy: { rateWeightLowerBoundKg: 'asc' }
    });
    
    if (marketplaceFees.length === 0) {
      issues.push({
        severity: 'HIGH',
        table: 'StandardFees',
        issue: 'Missing marketplace data',
        details: { marketplace },
        recommendation: `Add fee data for ${marketplace} marketplace`
      });
      continue;
    }
    
    // Check if we cover common weight points
    for (const weight of criticalWeights) {
      const coveringFee = marketplaceFees.find(f => 
        f.rateWeightLowerBoundKg.toNumber() <= weight && 
        f.rateWeightUpperBoundKg.toNumber() > weight
      );
      
      if (!coveringFee && weight <= 10) { // Only check up to 10kg
        const nearestLower = marketplaceFees
          .filter(f => f.rateWeightUpperBoundKg.toNumber() <= weight)
          .sort((a, b) => b.rateWeightUpperBoundKg.toNumber() - a.rateWeightUpperBoundKg.toNumber())[0];
        
        const nearestUpper = marketplaceFees
          .filter(f => f.rateWeightLowerBoundKg.toNumber() > weight)
          .sort((a, b) => a.rateWeightLowerBoundKg.toNumber() - b.rateWeightLowerBoundKg.toNumber())[0];
        
        if (nearestLower && nearestUpper) {
          issues.push({
            severity: 'MEDIUM',
            table: 'StandardFees',
            issue: 'Gap at critical weight point',
            details: {
              marketplace,
              weight: `${weight}kg`,
              gap: `${nearestLower.rateWeightUpperBoundKg} to ${nearestUpper.rateWeightLowerBoundKg}`,
              sizeTier: nearestLower.sizeTierName
            },
            recommendation: 'Check if this gap is intentional or add missing weight range'
          });
        }
      }
    }
  }
  
  // 3. Check SIPP discount consistency
  console.log('3️⃣ Checking SIPP discount patterns...\n');
  
  const sippDiscounts = await prisma.sippDiscounts.findMany({
    orderBy: [
      { marketplace: 'asc' },
      { programName: 'asc' },
      { sizeTierName: 'asc' },
      { rateWeightLowerBoundKg: 'asc' }
    ]
  });
  
  // Group by program to check consistency
  const sippByProgram = new Map<string, typeof sippDiscounts>();
  sippDiscounts.forEach(discount => {
    const key = discount.programName;
    if (!sippByProgram.has(key)) {
      sippByProgram.set(key, []);
    }
    sippByProgram.get(key)!.push(discount);
  });
  
  sippByProgram.forEach((discounts, program) => {
    // Check if discounts vary by weight (they usually shouldn't)
    const uniqueDiscounts = new Set(discounts.map(d => d.discount.toString()));
    if (uniqueDiscounts.size > 1) {
      issues.push({
        severity: 'MEDIUM',
        table: 'SippDiscounts',
        issue: 'Inconsistent discount values within program',
        details: {
          program,
          uniqueDiscountValues: Array.from(uniqueDiscounts),
          affectedMarketplaces: [...new Set(discounts.map(d => d.marketplace))]
        },
        recommendation: 'Verify if variable discounts are intended for this program'
      });
    }
  });
  
  // 4. Check referral fee logic
  console.log('4️⃣ Checking referral fee logic...\n');
  
  const referralFees = await prisma.referralFeeNew.findMany({
    orderBy: [
      { category: 'asc' },
      { subcategory: 'asc' },
      { feePercentage: 'asc' }
    ]
  });
  
  // Note: The new schema doesn't have price bounds, so we'll check for duplicate categories instead
  const referralByCategory = new Map<string, typeof referralFees>();
  referralFees.forEach(fee => {
    const key = `${fee.countryId}-${fee.programId}-${fee.category}-${fee.subcategory || 'null'}`;
    if (!referralByCategory.has(key)) {
      referralByCategory.set(key, []);
    }
    referralByCategory.get(key)!.push(fee);
  });
  
  // Check for duplicate category entries
  referralByCategory.forEach((fees, categoryKey) => {
    if (fees.length > 1) {
      issues.push({
        severity: 'HIGH',
        table: 'ReferralFeeNew',
        issue: 'Duplicate category entries',
        details: {
          category: fees[0].category,
          subcategory: fees[0].subcategory,
          count: fees.length,
          percentages: fees.map(f => f.feePercentage.toString()).join(', ')
        },
        recommendation: 'Remove duplicate entries to ensure consistent fee determination'
      });
    }
  });
  
  // 5. Check storage fee completeness
  console.log('5️⃣ Checking storage fee completeness...\n');
  
  const storageFees = await prisma.storageFeeNew.findMany();
  
  // Check each country/program has appropriate storage fee periods
  const storageByLocation = new Map<string, typeof storageFees>();
  storageFees.forEach(fee => {
    const key = `${fee.countryId}-${fee.programId}`;
    if (!storageByLocation.has(key)) {
      storageByLocation.set(key, []);
    }
    storageByLocation.get(key)!.push(fee);
  });
  
  // Check for storage fee period coverage
  storageByLocation.forEach((fees, locationKey) => {
    // Check if we have both standard and oversize fees
    const hasStandardFees = fees.some(f => f.standardSizeFee.toNumber() > 0);
    const hasOversizeFees = fees.some(f => f.oversizeFee.toNumber() > 0);
    
    if (!hasStandardFees || !hasOversizeFees) {
      issues.push({
        severity: 'MEDIUM',
        table: 'StorageFeeNew',
        issue: 'Incomplete storage fee coverage',
        details: {
          location: locationKey,
          hasStandardFees,
          hasOversizeFees
        },
        recommendation: 'Add missing storage fee data for complete coverage'
      });
    }
  });
  
  // 6. Special case: Check the IE Standard parcel anomaly
  console.log('6️⃣ Analyzing specific anomalies...\n');
  
  issues.push({
    severity: 'HIGH',
    table: 'StandardFees',
    issue: 'Illogical fee decrease with weight increase',
    details: {
      marketplace: 'IE',
      sizeTier: 'Standard parcel',
      anomaly: 'Fee drops from €3.26 (0-0.15kg) to €1.87 (0.15-0.4kg)',
      percentDecrease: '42.6%'
    },
    recommendation: 'Verify with Amazon documentation - this appears to be a data entry error'
  });
  
  // Print summary
  console.log('\n📊 ANALYSIS SUMMARY\n');
  console.log('===================\n');
  
  const highSeverity = issues.filter(i => i.severity === 'HIGH');
  const mediumSeverity = issues.filter(i => i.severity === 'MEDIUM');
  const lowSeverity = issues.filter(i => i.severity === 'LOW');
  
  console.log(`Total issues found: ${issues.length}`);
  console.log(`- HIGH severity: ${highSeverity.length}`);
  console.log(`- MEDIUM severity: ${mediumSeverity.length}`);
  console.log(`- LOW severity: ${lowSeverity.length}\n`);
  
  // Print detailed issues
  if (highSeverity.length > 0) {
    console.log('🚨 HIGH SEVERITY ISSUES:\n');
    highSeverity.forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.table}] ${issue.issue}`);
      console.log(`   Details:`, JSON.stringify(issue.details, null, 2));
      console.log(`   Recommendation: ${issue.recommendation}\n`);
    });
  }
  
  if (mediumSeverity.length > 0) {
    console.log('⚠️  MEDIUM SEVERITY ISSUES:\n');
    mediumSeverity.forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.table}] ${issue.issue}`);
      console.log(`   Details:`, JSON.stringify(issue.details, null, 2));
      console.log(`   Recommendation: ${issue.recommendation}\n`);
    });
  }
  
  return issues;
}

// Run the analysis
comprehensiveDataAnalysis()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function importExcel() {
  const filePath = './data/amazon_fee.xlsx';
  console.log(`📖 Reading Excel file: ${filePath}`);
  
  // Read the Excel file
  const workbook = XLSX.readFile(filePath);
  
  // Import each sheet
  await importStandardFees(workbook);
  await importLowPriceFees(workbook);
  await importSippDiscounts(workbook);
  await importStorageFees(workbook);
  await importReferralFees(workbook);
  await importLowInventoryFees(workbook);
  
  console.log('✅ Excel import completed!');
}

async function importStandardFees(workbook: XLSX.WorkBook) {
  const sheetName = 'standard';
  const sheet = workbook.Sheets[sheetName];
  
  if (!sheet) {
    console.log(`❌ Sheet "${sheetName}" not found`);
    return;
  }
  
  console.log(`\n📋 Importing ${sheetName} sheet...`);
  
  // Convert sheet to JSON
  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`  Found ${data.length} rows`);
  
  // Clear existing data
  await prisma.standardFees.deleteMany();
  
  // Insert each row
  for (const row of data) {
    const typedRow = row as any;
    await prisma.standardFees.create({
      data: {
        sizeTierName: typedRow['SizeTierName'],
        lengthLimitCm: new Decimal(typedRow['LengthLimit_cm']),
        widthLimitCm: new Decimal(typedRow['WidthLimit_cm']),
        heightLimitCm: new Decimal(typedRow['HeightLimit_cm']),
        tierUnitWeightLimitKg: typedRow['TierUnitWeightLimit_kg'] ? new Decimal(typedRow['TierUnitWeightLimit_kg']) : null,
        tierDimWeightLimitKg: typedRow['TierDimWeightLimit_kg'] ? new Decimal(typedRow['TierDimWeightLimit_kg']) : null,
        rateWeightLowerBoundKg: new Decimal(typedRow['RateWeight_LowerBound_kg']),
        rateWeightUpperBoundKg: new Decimal(typedRow['RateWeight_UpperBound_kg']),
        marketplace: typedRow['Marketplace'],
        currency: typedRow['Currency'],
        fee: new Decimal(typedRow['Fee'])
      }
    });
  }
  
  console.log(`  ✅ Imported ${data.length} standard fees`);
}

async function importLowPriceFees(workbook: XLSX.WorkBook) {
  const sheetName = 'lowprice';
  const sheet = workbook.Sheets[sheetName];
  
  if (!sheet) {
    console.log(`❌ Sheet "${sheetName}" not found`);
    return;
  }
  
  console.log(`\n📋 Importing ${sheetName} sheet...`);
  
  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`  Found ${data.length} rows`);
  
  await prisma.lowPriceFees.deleteMany();
  
  for (const row of data) {
    const typedRow = row as any;
    await prisma.lowPriceFees.create({
      data: {
        programName: typedRow['ProgramName'],
        sizeTierName: typedRow['SizeTierName'],
        lengthLimitCm: new Decimal(typedRow['LengthLimit_cm']),
        widthLimitCm: new Decimal(typedRow['WidthLimit_cm']),
        heightLimitCm: new Decimal(typedRow['HeightLimit_cm']),
        rateWeightLowerBoundKg: new Decimal(typedRow['RateWeight_LowerBound_kg']),
        rateWeightUpperBoundKg: new Decimal(typedRow['RateWeight_UpperBound_kg']),
        marketplace: typedRow['Marketplace'],
        currency: typedRow['Currency'],
        fee: new Decimal(typedRow['Fee'])
      }
    });
  }
  
  console.log(`  ✅ Imported ${data.length} low price fees`);
}

async function importSippDiscounts(workbook: XLSX.WorkBook) {
  const sheetName = 'sipp';
  const sheet = workbook.Sheets[sheetName];
  
  if (!sheet) {
    console.log(`❌ Sheet "${sheetName}" not found`);
    return;
  }
  
  console.log(`\n📋 Importing ${sheetName} sheet...`);
  
  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`  Found ${data.length} rows`);
  
  await prisma.sippDiscounts.deleteMany();
  
  for (const row of data) {
    const typedRow = row as any;
    await prisma.sippDiscounts.create({
      data: {
        programName: typedRow['ProgramName'],
        sizeTierName: typedRow['SizeTierName'],
        rateWeightLowerBoundKg: new Decimal(typedRow['RateWeight_LowerBound_kg']),
        rateWeightUpperBoundKg: new Decimal(typedRow['RateWeight_UpperBound_kg']),
        marketplace: typedRow['Marketplace'],
        currency: typedRow['Currency'],
        discount: new Decimal(typedRow['Discount'])
      }
    });
  }
  
  console.log(`  ✅ Imported ${data.length} SIPP discounts`);
}

async function importStorageFees(workbook: XLSX.WorkBook) {
  const sheetName = 'storage';
  const sheet = workbook.Sheets[sheetName];
  
  if (!sheet) {
    console.log(`❌ Sheet "${sheetName}" not found`);
    return;
  }
  
  console.log(`\n📋 Importing ${sheetName} sheet...`);
  
  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`  Found ${data.length} rows`);
  
  await prisma.storageFeesLegacy.deleteMany();
  
  for (const row of data) {
    const typedRow = row as any;
    await prisma.storageFeesLegacy.create({
      data: {
        marketplaceGroup: typedRow['MarketplaceGroup'],
        productSize: typedRow['ProductSize'],
        productCategory: typedRow['ProductCategory'],
        period: typedRow['Period'],
        unitOfMeasure: typedRow['UnitOfMeasure'],
        currency: typedRow['Currency'],
        fee: new Decimal(typedRow['Fee'])
      }
    });
  }
  
  console.log(`  ✅ Imported ${data.length} storage fees`);
}

async function importReferralFees(workbook: XLSX.WorkBook) {
  const sheetName = 'referral';
  const sheet = workbook.Sheets[sheetName];
  
  if (!sheet) {
    console.log(`❌ Sheet "${sheetName}" not found`);
    return;
  }
  
  console.log(`\n📋 Importing ${sheetName} sheet...`);
  
  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`  Found ${data.length} rows`);
  
  await prisma.referralFeesLegacy.deleteMany();
  
  for (const row of data) {
    const typedRow = row as any;
    await prisma.referralFeesLegacy.create({
      data: {
        marketplaceGroup: typedRow['MarketplaceGroup'],
        productCategory: typedRow['ProductCategory'],
        subCategory: typedRow['SubCategory'] || null,
        condition: typedRow['Condition'] || null,
        feeType: typedRow['FeeType'],
        priceLowerBound: new Decimal(typedRow['Price_LowerBound']),
        priceUpperBound: new Decimal(typedRow['Price_UpperBound']),
        feePercentage: new Decimal(typedRow['FeePercentage']),
        maxFee: typedRow['MaxFee'] ? new Decimal(typedRow['MaxFee']) : null,
        minReferralFee: new Decimal(typedRow['MinReferralFee']),
        mediaClosingFee: typedRow['MediaClosingFee'] ? new Decimal(typedRow['MediaClosingFee']) : null,
        currency: typedRow['Currency']
      }
    });
  }
  
  console.log(`  ✅ Imported ${data.length} referral fees`);
}

async function importLowInventoryFees(workbook: XLSX.WorkBook) {
  const sheetName = 'lowinventoryfee';
  const sheet = workbook.Sheets[sheetName];
  
  if (!sheet) {
    console.log(`❌ Sheet "${sheetName}" not found`);
    return;
  }
  
  console.log(`\n📋 Importing ${sheetName} sheet...`);
  
  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`  Found ${data.length} rows`);
  
  await prisma.lowInventoryFees.deleteMany();
  
  for (const row of data) {
    const typedRow = row as any;
    await prisma.lowInventoryFees.create({
      data: {
        tierGroup: typedRow['TierGroup'],
        tierWeightLimitKg: new Decimal(typedRow['TierWeightLimit_kg']),
        daysOfSupplyLowerBound: typedRow['DaysOfSupply_LowerBound'],
        daysOfSupplyUpperBound: typedRow['DaysOfSupply_UpperBound'],
        marketplaceGroup: typedRow['MarketplaceGroup'],
        currency: typedRow['Currency'],
        fee: new Decimal(typedRow['Fee'])
      }
    });
  }
  
  console.log(`  ✅ Imported ${data.length} low inventory fees`);
}

// Run the import
importExcel()
  .catch((e) => {
    console.error('Error importing Excel:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
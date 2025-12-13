const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function insertTestBalanceSheetData() {
  try {
    console.log('Inserting test balance sheet data...');
    
    const balanceSheetData = {
      totalAssets: 241145.98,
      totalLiabilities: 50439.71,
      netAssets: 190706.27,
      currentAssets: 239377.25,
      currentLiabilities: 50439.71,
      equity: 190706.27,
      cash: 155545.12,
      accountsReceivable: 1808.66,
      accountsPayable: 46845.00,
      inventory: 82023.47,
      assets: {
        current: [
          { name: "Bank", balance: 155545.12 },
          { name: "Trade Debtors", balance: 1808.66 },
          { name: "Inventory", balance: 82023.47 }
        ],
        fixed: [
          { name: "Motor Vehicles", balance: 1768.73 }
        ],
        totalCurrent: 239377.25,
        totalFixed: 1768.73,
        totalAssets: 241145.98
      },
      liabilities: {
        current: [
          { name: "Trade Creditors", balance: 46845.00 },
          { name: "GST", balance: 2094.71 },
          { name: "PAYG Withholdings Payable", balance: 1500.00 }
        ],
        nonCurrent: [],
        totalCurrent: 50439.71,
        totalNonCurrent: 0,
        totalLiabilities: 50439.71
      },
      equity: {
        accounts: [
          { name: "Retained Earnings", balance: 190706.27 }
        ],
        totalEquity: 190706.27
      }
    };

    // Delete any existing balance sheet data first
    await prisma.reportData.deleteMany({
      where: {
        reportType: 'BALANCE_SHEET'
      }
    });

    // Insert the new balance sheet data
    const result = await prisma.reportData.create({
      data: {
        reportType: 'BALANCE_SHEET',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-12-31'),
        data: JSON.stringify(balanceSheetData),
        isActive: true,
        version: 1
      }
    });

    console.log('✅ Successfully inserted test balance sheet data');
    console.log('Report Data ID:', result.id);
    console.log('Expected values:');
    console.log('- Total Assets: £241,145.98');
    console.log('- Total Liabilities: £50,439.71');
    console.log('- Net Assets: £190,706.27');
    console.log('- Current Assets: £239,377.25');
    console.log('- Current Liabilities: £50,439.71');
    console.log('- Cash: £155,545.12');
    console.log('- Inventory: £82,023.47');

  } catch (error) {
    console.error('❌ Error inserting test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

insertTestBalanceSheetData();
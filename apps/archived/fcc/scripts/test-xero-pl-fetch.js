#!/usr/bin/env node
const { config } = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
config({ path: path.join(__dirname, '..', '.env.local') });

async function testXeroPLFetch() {
  console.log('Testing Xero P&L Fetch for May 2025...\n');
  
  try {
    // Test with the correct date for May 2025
    const testDate = '2025-05-31';
    const apiUrl = `http://localhost:3000/api/v1/xero/reports/profit-loss?date=${testDate}&periods=1&timeframe=MONTH&refresh=true`;
    
    console.log('Fetching P&L with parameters:');
    console.log('- Date:', testDate);
    console.log('- Periods:', 1);
    console.log('- Timeframe:', 'MONTH');
    console.log('- Refresh:', true);
    console.log('- URL:', apiUrl);
    console.log('\nMaking request...\n');
    
    const response = await fetch(apiUrl, {
      headers: {
        'Cookie': process.env.TEST_COOKIE || ''
      }
    });
    
    const data = await response.json();
    
    console.log('Response Status:', response.status);
    console.log('\nResponse Data:');
    console.log(JSON.stringify(data, null, 2));
    
    // Write detailed response to file
    const outputPath = path.join(__dirname, 'xero-pl-response.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`\nDetailed response saved to: ${outputPath}`);
    
    // Analyze the response
    if (data.detailedBreakdown) {
      console.log('\n=== DETAILED BREAKDOWN ANALYSIS ===');
      console.log('\nRevenue Accounts:', data.detailedBreakdown.revenue?.accounts?.length || 0);
      if (data.detailedBreakdown.revenue?.accounts?.length > 0) {
        console.log('Revenue accounts:');
        data.detailedBreakdown.revenue.accounts.forEach(acc => {
          console.log(`  - ${acc.accountName}: $${acc.amount}`);
        });
      }
      
      console.log('\nOther Income Accounts:', data.detailedBreakdown.otherIncome?.accounts?.length || 0);
      if (data.detailedBreakdown.otherIncome?.accounts?.length > 0) {
        console.log('Other Income accounts:');
        data.detailedBreakdown.otherIncome.accounts.forEach(acc => {
          console.log(`  - ${acc.accountName}: $${acc.amount}`);
        });
      }
      
      console.log('\nOperating Expense Accounts:', data.detailedBreakdown.operatingExpenses?.accounts?.length || 0);
      if (data.detailedBreakdown.operatingExpenses?.accounts?.length > 0) {
        console.log('Operating Expense accounts (first 5):');
        data.detailedBreakdown.operatingExpenses.accounts.slice(0, 5).forEach(acc => {
          console.log(`  - ${acc.accountName}: $${acc.amount}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

// Run the test
testXeroPLFetch();
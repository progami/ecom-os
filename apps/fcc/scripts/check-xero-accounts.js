#!/usr/bin/env node
const { config } = require('dotenv');
const path = require('path');

// Load environment variables
config({ path: path.join(__dirname, '..', '.env.local') });

async function checkXeroAccounts() {
  console.log('Checking Xero Chart of Accounts for revenue accounts...\n');
  
  try {
    // Fetch Chart of Accounts
    const coaUrl = 'http://localhost:3000/api/v1/xero/accounts';
    
    console.log('Fetching Chart of Accounts...');
    const response = await fetch(coaUrl, {
      headers: {
        'Cookie': process.env.TEST_COOKIE || ''
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.accounts) {
      console.log('No accounts data returned');
      return;
    }
    
    // Filter for revenue accounts
    const revenueAccounts = data.accounts.filter(acc => 
      acc.class === 'REVENUE' || 
      acc.type === 'REVENUE' || 
      acc.type === 'SALES' ||
      acc.type === 'OTHERINCOME'
    );
    
    console.log(`\nFound ${revenueAccounts.length} revenue accounts:\n`);
    
    // Group by type
    const byType = {};
    revenueAccounts.forEach(acc => {
      const type = acc.type || 'UNKNOWN';
      if (!byType[type]) byType[type] = [];
      byType[type].push(acc);
    });
    
    // Display accounts by type
    Object.keys(byType).forEach(type => {
      console.log(`\n${type} (${byType[type].length} accounts):`);
      byType[type].forEach(acc => {
        console.log(`  - ${acc.name} (${acc.code || 'no code'}) - Status: ${acc.status}`);
        if (acc.name.toLowerCase().includes('amazon')) {
          console.log(`    ^ AMAZON ACCOUNT FOUND!`);
        }
      });
    });
    
    // Check for specific Amazon accounts
    console.log('\n\nSearching for Amazon-related accounts:');
    const amazonAccounts = data.accounts.filter(acc => 
      acc.name.toLowerCase().includes('amazon')
    );
    
    if (amazonAccounts.length > 0) {
      console.log(`Found ${amazonAccounts.length} Amazon accounts:`);
      amazonAccounts.forEach(acc => {
        console.log(`  - ${acc.name}`);
        console.log(`    Code: ${acc.code || 'N/A'}`);
        console.log(`    Type: ${acc.type}`);
        console.log(`    Class: ${acc.class}`);
        console.log(`    Status: ${acc.status}`);
        console.log(`    Tax Type: ${acc.taxType || 'N/A'}`);
      });
    } else {
      console.log('No Amazon accounts found!');
    }
    
    // Also check transactions for May 2025
    console.log('\n\nChecking for transactions in May 2025...');
    const transUrl = 'http://localhost:3000/api/v1/xero/transactions?fromDate=2025-05-01&toDate=2025-05-31';
    
    const transResponse = await fetch(transUrl, {
      headers: {
        'Cookie': process.env.TEST_COOKIE || ''
      }
    });
    
    if (transResponse.ok) {
      const transData = await transResponse.json();
      if (transData.transactions) {
        console.log(`Found ${transData.transactions.length} transactions in May 2025`);
        
        // Look for Amazon transactions
        const amazonTrans = transData.transactions.filter(t => 
          t.contact?.name?.toLowerCase().includes('amazon') ||
          t.reference?.toLowerCase().includes('amazon') ||
          t.lineItems?.some(li => li.description?.toLowerCase().includes('amazon'))
        );
        
        if (amazonTrans.length > 0) {
          console.log(`\nFound ${amazonTrans.length} Amazon-related transactions`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the check
checkXeroAccounts();
import { PrismaClient } from '@prisma/client';
import { XeroClient, BankTransaction } from 'xero-node';
import * as https from 'https';
import { structuredLogger } from '@/lib/logger';

const prisma = new PrismaClient();
const agent = new https.Agent({ rejectUnauthorized: false });

// Get environment variables
const clientId = process.env.XERO_CLIENT_ID || '';
const clientSecret = process.env.XERO_CLIENT_SECRET || '';

async function testCashFlowDirect() {
  console.log('=== TESTING CASH FLOW API DIRECTLY ===\n');
  
  try {
    // Initialize Prisma client properly
    await prisma.$connect();
    
    // Get the latest token from database
    const userData = await prisma.user.findFirst({
      where: {
        xeroAccessToken: { not: null }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    
    if (!userData || !userData.xeroAccessToken || !userData.tenantId) {
      console.error('❌ No Xero token found in database');
      return;
    }
    
    console.log('✅ Found token in database');
    console.log(`   User: ${userData.email}`);
    console.log(`   Expires at: ${userData.tokenExpiresAt ? new Date(userData.tokenExpiresAt).toISOString() : 'Unknown'}`);
    console.log(`   Tenant ID: ${userData.tenantId}`);
    
    // Initialize Xero client
    const xeroClient = new XeroClient({
      clientId,
      clientSecret,
      redirectUris: ['https://localhost:3003/api/v1/xero/auth/callback'],
      scopes: 'openid profile email accounting.transactions accounting.settings accounting.contacts accounting.reports.read offline_access'.split(' ')
    });
    
    // Set the token
    console.log('\nSetting token on Xero client...');
    xeroClient.setTokenSet({
      access_token: userData.xeroAccessToken,
      refresh_token: userData.xeroRefreshToken,
      expires_at: Math.floor(userData.tokenExpiresAt || new Date().getTime() / 1000),
      token_type: 'Bearer',
      scope: 'openid profile email accounting.transactions accounting.settings accounting.contacts accounting.reports.read offline_access'
    });
    
    // Wait for token to be set
    await xeroClient.refreshWithRefreshToken(clientId, clientSecret, userData.xeroRefreshToken || '');
    console.log('   Token refreshed successfully');
    
    console.log('\n📊 Testing different approaches to get cash flow data...\n');
    
    // Test 1: Check if Finance API is available
    console.log('1. Checking Finance API availability...');
    const financeApi = (xeroClient as any).financeApi;
    if (financeApi) {
      console.log('   ✅ Finance API found on client');
      if (typeof financeApi.getFinancialStatementCashflow === 'function') {
        console.log('   ✅ getFinancialStatementCashflow method exists');
        
        try {
          const cashFlowResponse = await financeApi.getFinancialStatementCashflow(
            userData.tenantId,
            '2024-01-01',
            '2024-01-31'
          );
          console.log('   ✅ Finance API call successful');
          console.log('   Response:', JSON.stringify(cashFlowResponse.body, null, 2));
        } catch (error: any) {
          console.error('   ❌ Finance API call failed:', error.message || error);
          console.error('   Full error:', error);
          if (error.response) {
            console.error('   Status:', error.response.statusCode);
            console.error('   Body:', error.response.body);
          }
        }
      } else {
        console.log('   ❌ getFinancialStatementCashflow method NOT found');
      }
    } else {
      console.log('   ❌ Finance API NOT found on client');
    }
    
    // Test 2: Try Executive Summary
    console.log('\n2. Testing Executive Summary API...');
    try {
      const summaryResponse = await xeroClient.accountingApi.getReportExecutiveSummary(
        userData.tenantId,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );
      
      console.log('   ✅ Executive Summary retrieved');
      
      if (summaryResponse.body?.reports?.[0]?.rows) {
        const rows = summaryResponse.body.reports[0].rows;
        console.log(`   Found ${rows.length} rows`);
        
        rows.forEach(row => {
          if (row.rowType === 'Section' && row.title) {
            console.log(`\n   Section: ${row.title}`);
            if (row.rows) {
              row.rows.forEach(subRow => {
                if (subRow.cells) {
                  const label = subRow.cells[0]?.value || '';
                  const value = subRow.cells[1]?.value || '0';
                  console.log(`      ${label}: ${value}`);
                }
              });
            }
          }
        });
      }
    } catch (error: any) {
      console.error('   ❌ Executive Summary failed:', error.message);
    }
    
    // Test 3: Try bank transactions approach
    console.log('\n3. Testing Bank Transactions approach...');
    try {
      // Get bank accounts
      const accountsResponse = await xeroClient.accountingApi.getAccounts(
        userData.tenantId,
        undefined,
        'Type=="BANK"'
      );
      
      const bankAccounts = accountsResponse.body?.accounts || [];
      console.log(`   Found ${bankAccounts.length} bank accounts`);
      
      if (bankAccounts.length > 0) {
        // Get transactions for January 2024
        const transactionsResponse = await xeroClient.accountingApi.getBankTransactions(
          userData.tenantId,
          undefined,
          'Date>=DateTime(2024,01,01) AND Date<DateTime(2024,02,01)',
          undefined,
          100
        );
        
        const transactions = transactionsResponse.body?.bankTransactions || [];
        console.log(`   Found ${transactions.length} transactions in January 2024`);
        
        // Calculate cash flow from transactions
        let totalReceived = 0;
        let totalSpent = 0;
        
        transactions.forEach((tx: BankTransaction) => {
          if (tx.type === 'RECEIVE') {
            totalReceived += tx.total || 0;
          } else if (tx.type === 'SPEND') {
            totalSpent += tx.total || 0;
          }
        });
        
        console.log(`\n   Cash Flow Summary (from transactions):`);
        console.log(`      Money Received: £${totalReceived.toFixed(2)}`);
        console.log(`      Money Spent: £${totalSpent.toFixed(2)}`);
        console.log(`      Net Cash Flow: £${(totalReceived - totalSpent).toFixed(2)}`);
        
        // Show opening/closing balances
        if (bankAccounts.length > 0) {
          console.log(`\n   Bank Account Balances:`);
          for (const account of bankAccounts) {
            console.log(`      ${account.name}: £${account.bankAccountNumber || 'N/A'}`);
          }
        }
      }
    } catch (error: any) {
      console.error('   ❌ Bank transactions approach failed:', error.message);
    }
    
    // Test 4: Check if we have any P&L data for comparison
    console.log('\n4. Checking P&L data for January 2024 (for comparison)...');
    const plData = await prisma.reportData.findFirst({
      where: {
        reportType: 'PROFIT_LOSS',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        isActive: true
      }
    });
    
    if (plData) {
      console.log('   ✅ Found P&L data for January 2024');
      const data = JSON.parse(plData.data);
      console.log(`      Revenue: £${data.revenue?.total || 0}`);
      console.log(`      Expenses: £${data.expenses?.total || 0}`);
      console.log(`      Net Profit: £${data.netProfit || 0}`);
    } else {
      console.log('   ❌ No P&L data found for January 2024');
    }
    
    // Test 5: Check available API scopes
    console.log('\n5. Checking API scopes...');
    console.log(`   Scopes: ${'openid profile email accounting.transactions accounting.settings accounting.contacts accounting.reports.read offline_access'}`);
    const hasFinanceScope = 'openid profile email accounting.transactions accounting.settings accounting.contacts accounting.reports.read offline_access'.includes('finance') || 'openid profile email accounting.transactions accounting.settings accounting.contacts accounting.reports.read offline_access'.includes('accounting.reports.read');
    console.log(`   Has finance/reports scope: ${hasFinanceScope ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run the test
testCashFlowDirect()
  .then(() => console.log('\n✅ Test completed'))
  .catch(error => console.error('Test failed:', error));
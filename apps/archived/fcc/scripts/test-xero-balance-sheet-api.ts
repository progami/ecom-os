/**
 * Test script to call the Xero Balance Sheet API directly
 * This will bypass database cache and test the actual Xero parsing logic
 */

const testXeroBalanceSheetAPI = async () => {
  try {
    console.log('Testing Xero Balance Sheet API...');
    
    // Force bypass database by using a future date that won't have cached data
    const testDate = '2025-06-30';
    const url = `https://localhost:3003/api/v1/xero/reports/balance-sheet?date=${testDate}`;
    
    console.log(`Calling: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Response Status: ${response.status}`);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('\n=== API Response ===');
      console.log('Total Assets:', data.totalAssets);
      console.log('Total Liabilities:', data.totalLiabilities);
      console.log('Net Assets:', data.netAssets);
      console.log('Current Assets:', data.currentAssets);
      console.log('Current Liabilities:', data.currentLiabilities);
      console.log('Cash:', data.cash);
      console.log('Inventory:', data.inventory);
      console.log('Accounts Receivable:', data.accountsReceivable);
      console.log('Accounts Payable:', data.accountsPayable);
      console.log('Source:', data.source);
      console.log('Last Synced:', data.lastSyncedAt);
      
      // Expected values from Excel
      const expected = {
        totalAssets: 241145.98,
        totalLiabilities: 50439.71,
        netAssets: 190706.27,
        cash: 155545.12,
        inventory: 82023.47
      };
      
      console.log('\n=== Comparison with Expected Values ===');
      console.log(`Total Assets: API ${data.totalAssets} vs Expected ${expected.totalAssets} (${data.totalAssets === expected.totalAssets ? 'MATCH' : 'MISMATCH'})`);
      console.log(`Total Liabilities: API ${data.totalLiabilities} vs Expected ${expected.totalLiabilities} (${data.totalLiabilities === expected.totalLiabilities ? 'MATCH' : 'MISMATCH'})`);
      console.log(`Net Assets: API ${data.netAssets} vs Expected ${expected.netAssets} (${data.netAssets === expected.netAssets ? 'MATCH' : 'MISMATCH'})`);
      console.log(`Cash: API ${data.cash} vs Expected ${expected.cash} (${data.cash === expected.cash ? 'MATCH' : 'MISMATCH'})`);
      console.log(`Inventory: API ${data.inventory} vs Expected ${expected.inventory} (${data.inventory === expected.inventory ? 'MATCH' : 'MISMATCH'})`);
      
      if (data.source === 'xero_direct') {
        console.log('\n✅ Successfully fetched data directly from Xero API');
      } else {
        console.log(`\n⚠️  Data came from: ${data.source} (not direct Xero)`);
      }
      
    } else {
      console.log('\n❌ API Error:');
      console.log(JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Run the test
testXeroBalanceSheetAPI();
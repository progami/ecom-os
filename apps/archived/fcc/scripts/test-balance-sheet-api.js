#!/usr/bin/env node

/**
 * Test script for Balance Sheet API refresh functionality
 * This tests that clicking "Fetch from Xero" creates an ImportedReport entry
 */

const API_BASE_URL = 'http://localhost:3000/api/v1';

async function testBalanceSheetAPI() {
  console.log('Testing Balance Sheet API refresh functionality...\n');

  try {
    // Test 1: Fetch without refresh (should get from database if available)
    console.log('Test 1: Fetching without refresh parameter...');
    const response1 = await fetch(`${API_BASE_URL}/xero/reports/balance-sheet`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add any required auth headers here
      }
    });
    
    const data1 = await response1.json();
    console.log('Response without refresh:', {
      status: response1.status,
      source: data1.source,
      hasData: !!data1.totalAssets
    });

    // Test 2: Fetch with refresh=true (should create ImportedReport with source=API)
    console.log('\nTest 2: Fetching with refresh=true...');
    const response2 = await fetch(`${API_BASE_URL}/xero/reports/balance-sheet?refresh=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add any required auth headers here
      }
    });
    
    const data2 = await response2.json();
    console.log('Response with refresh:', {
      status: response2.status,
      source: data2.source,
      hasData: !!data2.totalAssets,
      error: data2.error
    });

    // Test 3: Check ImportedReport entries
    console.log('\nTest 3: Checking ImportedReport entries...');
    const reportsResponse = await fetch(`${API_BASE_URL}/reports/imported?type=BALANCE_SHEET&limit=5`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add any required auth headers here
      }
    });

    if (reportsResponse.ok) {
      const reports = await reportsResponse.json();
      console.log('Recent ImportedReport entries:');
      reports.data?.slice(0, 3).forEach((report, index) => {
        console.log(`  ${index + 1}. Source: ${report.source}, Status: ${report.status}, Date: ${new Date(report.importedAt).toLocaleString()}`);
      });
    }

    console.log('\n✅ Test completed. Check if API source entries appear in import history.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testBalanceSheetAPI();
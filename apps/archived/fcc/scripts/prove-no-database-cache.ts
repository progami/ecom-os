#!/usr/bin/env node

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import fetch from 'node-fetch';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function proveNoDatabaseCache() {
  console.log('=== PROVING API AND IMPORT ARE NOT READING FROM DATABASE ===\n');

  // 1. First, let's call the API with source=live to ensure we get fresh Xero data
  console.log('Step 1: Calling Balance Sheet API with source=live (bypasses database)...');
  
  const apiUrl = 'http://localhost:3000/api/v1/xero/reports/balance-sheet?date=2025-06-30&source=live';
  
  try {
    // Read the auth cookie from a file (you'll need to save this from your browser)
    const cookieFile = path.join(__dirname, '../.cookie');
    let cookie = '';
    if (fs.existsSync(cookieFile)) {
      cookie = fs.readFileSync(cookieFile, 'utf-8').trim();
    } else {
      console.log('Please save your auth cookie to scripts/.cookie file');
      console.log('You can get this from Chrome DevTools > Application > Cookies');
      return;
    }

    const response = await fetch(apiUrl, {
      headers: {
        'Cookie': cookie
      }
    });

    if (!response.ok) {
      console.log('API Error:', response.status, await response.text());
      return;
    }

    const apiData = await response.json();
    console.log('\nAPI Response (Live from Xero):');
    console.log('- Total Assets:', apiData.totalAssets);
    console.log('- Total Liabilities:', apiData.totalLiabilities);
    console.log('- Cash:', apiData.cash);
    console.log('- Source:', apiData.source);
    console.log('- Last Synced:', apiData.lastSyncedAt);

    // 2. Now let's check what's in the database
    console.log('\n\nStep 2: Checking database for any cached data...');
    const dbUrl = 'http://localhost:3000/api/v1/reports/balance-sheet?date=2025-06-30';
    
    const dbResponse = await fetch(dbUrl, {
      headers: {
        'Cookie': cookie
      }
    });

    if (dbResponse.ok) {
      const dbData = await dbResponse.json();
      console.log('\nDatabase Response:');
      console.log('- Total Assets:', dbData.totalAssets);
      console.log('- Total Liabilities:', dbData.totalLiabilities);
      console.log('- Cash:', dbData.cash);
      console.log('- Source:', dbData.source);
      console.log('- Import ID:', dbData.importId);
    } else {
      console.log('No data in database');
    }

    // 3. Compare the differences
    console.log('\n\n=== ANALYSIS ===');
    console.log('If API and Database show different values, they are reading from different sources.');
    console.log('If they show the same values, then the API might be reading from cache.');
    
    console.log('\n=== WHY DIFFERENCES EXIST ===');
    console.log('Even for the same date (June 30, 2025), differences can occur because:');
    console.log('1. The Excel file was exported at a different time than the API call');
    console.log('2. Transactions may have been added/modified between export and API call');
    console.log('3. Exchange rates may have been updated (for foreign currency accounts)');
    console.log('4. Rounding differences in calculations');
    console.log('5. Different account categorizations between export formats');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

proveNoDatabaseCache();
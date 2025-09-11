#!/usr/bin/env node

/**
 * Check authentication status and test Xero API
 * This script checks the current auth state from the database
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAuthStatus() {
  console.log('=== Checking Authentication Status ===\n');

  try {
    // Check for user session in database
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        createdAt: true
      }
    });

    if (users.length === 0) {
      console.log('❌ No users found in database');
      console.log('Please register or login first at https://localhost:3003/login\n');
      return;
    }

    console.log('✅ Found users:');
    users.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.id})`);
    });

    // Check for Xero token
    const xeroTokens = await prisma.xeroToken.findMany({
      select: {
        id: true,
        tenantId: true,
        tenantName: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log('\n=== Xero Authentication ===');
    if (xeroTokens.length === 0) {
      console.log('❌ No Xero authentication found');
      console.log('You need to connect to Xero:');
      console.log('1. Go to https://localhost:3003/settings');
      console.log('2. Click "Connect to Xero"');
      console.log('3. Complete the OAuth flow\n');
    } else {
      console.log('✅ Xero tokens found:');
      xeroTokens.forEach(token => {
        console.log(`   - Tenant: ${token.tenantName || 'Unknown'} (${token.tenantId})`);
        console.log(`     Last updated: ${token.updatedAt}`);
      });

      // Test Xero API directly
      console.log('\n=== Testing Direct Xero API Call ===');
      const https = require('https');
      
      // Call the debug endpoint which bypasses cookies
      const options = {
        hostname: 'localhost',
        port: 3003,
        path: '/api/v1/reports/trial-balance/fetch-from-xero',
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-bypass-auth': 'true' // We'll add support for this
        },
        rejectUnauthorized: false
      };

      https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ Xero API is working!');
            console.log('You can now test the balance sheet endpoint.');
          } else {
            console.log(`❌ API returned status ${res.statusCode}`);
            console.log('Response:', data);
          }
        });
      }).on('error', err => {
        console.error('Request failed:', err);
      });
    }

  } catch (error) {
    console.error('Error checking auth status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAuthStatus();
#!/usr/bin/env node

/**
 * Test script for development authentication bypass
 * 
 * Usage:
 *   node scripts/test-dev-bypass.js
 *   
 * This script tests the dev bypass authentication endpoint
 */

const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

if (!baseUrl) {
  throw new Error('NEXT_PUBLIC_APP_URL must be defined before running the FCC dev bypass test script.');
}

async function testDevBypass() {
  console.log('Testing development authentication bypass...\n');
  
  // Test 1: GET request with redirect
  console.log('Test 1: GET request with redirect to /finance');
  try {
    const response1 = await fetch(`${baseUrl}/api/v1/auth/dev-bypass?redirect=/finance`, {
      method: 'GET',
      redirect: 'manual' // Don't follow redirects automatically
    });
    
    console.log(`Status: ${response1.status}`);
    console.log(`Location: ${response1.headers.get('location')}`);
    console.log(`Set-Cookie: ${response1.headers.get('set-cookie')}`);
    console.log('✅ GET request test passed\n');
  } catch (error) {
    console.error('❌ GET request test failed:', error.message);
  }

  // Test 2: POST request with custom data
  console.log('Test 2: POST request with custom session data');
  try {
    const response2 = await fetch(`${baseUrl}/api/v1/auth/dev-bypass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: 'custom-user-456',
        email: 'custom@test.com',
        tenantId: 'custom-tenant-789',
        tenantName: 'Custom Test Organization'
      })
    });
    
    const data = await response2.json();
    console.log(`Status: ${response2.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
    console.log(`Set-Cookie: ${response2.headers.get('set-cookie')}`);
    console.log('✅ POST request test passed\n');
  } catch (error) {
    console.error('❌ POST request test failed:', error.message);
  }

  // Test 3: Verify session endpoint works with dev bypass
  console.log('Test 3: Verify session after dev bypass');
  try {
    // First set the session
    const bypassResponse = await fetch(`${baseUrl}/api/v1/auth/dev-bypass`, {
      method: 'POST'
    });
    const cookie = bypassResponse.headers.get('set-cookie');
    
    // Then check the session
    const sessionResponse = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: {
        'Cookie': cookie
      }
    });
    
    const sessionData = await sessionResponse.json();
    console.log(`Session status: ${sessionResponse.status}`);
    console.log(`Session data:`, JSON.stringify(sessionData, null, 2));
    console.log('✅ Session verification test passed\n');
  } catch (error) {
    console.error('❌ Session verification test failed:', error.message);
  }
}

// Check if running in development
if (process.env.NODE_ENV === 'production') {
  console.error('⚠️  This script should only be run in development environment');
  process.exit(1);
}

// Run tests
testDevBypass().catch(console.error);

#!/usr/bin/env ts-node

/**
 * Integration test to verify WMS frontend and automation script connectivity
 */

import { config } from 'dotenv';

// Load environment variables
config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

async function testIntegration() {
  console.log('🧪 Testing WMS Integration...\n');

  // Test 1: Check if API is reachable
  console.log('1. Testing API connectivity...');
  try {
    const response = await fetch(`${API_BASE_URL}/wms/warehouses`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 401) {
      console.log('   ✅ API is reachable (authentication required)');
    } else if (response.ok) {
      console.log('   ✅ API is reachable and accessible');
    } else {
      console.log(`   ⚠️  API returned status: ${response.status}`);
    }
  } catch (error) {
    console.log('   ❌ API is not reachable. Is the Next.js server running?');
    console.log('      Run "npm run dev" in the main project directory');
  }

  // Test 2: Verify automation script configuration
  console.log('\n2. Checking automation script configuration...');
  const requiredEnvVars = ['API_BASE_URL', 'LOW_STOCK_THRESHOLD'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missingVars.length === 0) {
    console.log('   ✅ All required environment variables are set');
  } else {
    console.log(`   ⚠️  Missing environment variables: ${missingVars.join(', ')}`);
  }

  // Test 3: Frontend routes
  console.log('\n3. Verifying frontend routes...');
  const frontendRoutes = [
    '/wms',
    '/wms/warehouses',
    '/wms/inventory',
    '/wms/products'
  ];

  for (const route of frontendRoutes) {
    try {
      const url = `http://localhost:3000${route}`;
      const response = await fetch(url);
      
      if (response.ok || response.status === 401) {
        console.log(`   ✅ ${route} - Route exists`);
      } else {
        console.log(`   ⚠️  ${route} - Status: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ ${route} - Not accessible`);
    }
  }

  console.log('\n📋 Integration Test Summary:');
  console.log('   - Frontend: WMS pages created in app/wms/');
  console.log('   - API: Routes created in app/api/v1/wms/');
  console.log('   - Automation: Script in warehouse_management/run.ts');
  console.log('   - Database: Prisma schema updated with WMS models');
  
  console.log('\n🚀 Next Steps:');
  console.log('   1. Run "npm install" in the main project to install dependencies');
  console.log('   2. Run "npm run prisma:migrate" to create database tables');
  console.log('   3. Run "npm run dev" to start the Next.js development server');
  console.log('   4. Visit http://localhost:3000/wms to access the WMS interface');
  console.log('   5. Run automation script with "npm start" from warehouse_management/');
}

// Execute test
testIntegration();
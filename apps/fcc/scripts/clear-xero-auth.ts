#!/usr/bin/env node

/**
 * Script to clear Xero authentication tokens and force re-authentication
 * 
 * Usage: npm run clear-auth
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const prisma = new PrismaClient();

async function clearXeroAuth() {
  console.log('🔑 Clearing Xero authentication tokens...\n');
  
  try {
    // Clear all Xero tokens from the database
    const result = await prisma.user.updateMany({
      where: {
        xeroAccessToken: { not: null }
      },
      data: {
        xeroAccessToken: null,
        xeroRefreshToken: null,
        tokenExpiresAt: null
      }
    });
    
    console.log(`✅ Cleared tokens for ${result.count} user(s)`);
    
    // List affected users
    const users = await prisma.user.findMany({
      where: {
        tenantId: { not: null }
      },
      select: {
        id: true,
        email: true,
        tenantName: true
      }
    });
    
    if (users.length > 0) {
      console.log('\n📋 Affected users:');
      users.forEach(user => {
        console.log(`   - ${user.email} (${user.tenantName || 'Unknown tenant'})`);
      });
    }
    
    console.log('\n✨ Authentication cleared successfully!');
    console.log('👉 Users will need to re-authenticate with Xero on their next login.\n');
    
  } catch (error) {
    console.error('❌ Error clearing authentication:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearXeroAuth();
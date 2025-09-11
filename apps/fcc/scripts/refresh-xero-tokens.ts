#!/usr/bin/env node

/**
 * Script to manually refresh Xero tokens
 * 
 * Usage: npm run refresh-tokens [user-email]
 */

import { PrismaClient } from '@prisma/client';
import { XeroClient } from 'xero-node';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const prisma = new PrismaClient();

const xeroConfig = {
  clientId: process.env.XERO_CLIENT_ID || '',
  clientSecret: process.env.XERO_CLIENT_SECRET || '',
  redirectUris: [process.env.XERO_REDIRECT_URI || 'https://localhost:3003/api/v1/xero/auth/callback'],
  scopes: 'offline_access openid profile email accounting.transactions accounting.settings accounting.contacts accounting.reports.read'
};

async function refreshTokensForUser(userEmail?: string) {
  console.log('🔄 Refreshing Xero tokens...\n');
  
  try {
    // Find users with Xero tokens
    const whereClause = userEmail 
      ? { email: userEmail, xeroRefreshToken: { not: null } }
      : { xeroRefreshToken: { not: null } };
    
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        tenantName: true,
        xeroAccessToken: true,
        xeroRefreshToken: true,
        tokenExpiresAt: true
      }
    });
    
    if (users.length === 0) {
      console.log('❌ No users found with Xero tokens to refresh');
      return;
    }
    
    console.log(`Found ${users.length} user(s) with tokens:\n`);
    
    for (const user of users) {
      console.log(`\n👤 Processing: ${user.email} (${user.tenantName || 'Unknown tenant'})`);
      
      if (!user.xeroRefreshToken) {
        console.log('   ⚠️  No refresh token available - user needs to re-authenticate');
        continue;
      }
      
      try {
        // Create Xero client
        const config: any = {
          clientId: xeroConfig.clientId,
          clientSecret: xeroConfig.clientSecret,
          redirectUris: xeroConfig.redirectUris,
          scopes: xeroConfig.scopes.split(' ')
        };
        
        const xero = new XeroClient(config);
        
        // Try to refresh the token
        console.log('   🔄 Attempting token refresh...');
        const newTokenSet = await xero.refreshWithRefreshToken(
          xeroConfig.clientId,
          xeroConfig.clientSecret,
          user.xeroRefreshToken
        );
        
        // Update the user's tokens in database
        await prisma.user.update({
          where: { id: user.id },
          data: {
            xeroAccessToken: newTokenSet.access_token,
            xeroRefreshToken: newTokenSet.refresh_token,
            tokenExpiresAt: new Date((newTokenSet.expires_at || 0) * 1000)
          }
        });
        
        console.log('   ✅ Token refreshed successfully!');
        console.log(`   📅 New token expires at: ${new Date((newTokenSet.expires_at || 0) * 1000).toLocaleString()}`);
        
      } catch (error: any) {
        console.log('   ❌ Failed to refresh token:', error.message || error);
        console.log('   👉 User needs to re-authenticate with Xero');
        
        // Clear invalid tokens
        await prisma.user.update({
          where: { id: user.id },
          data: {
            xeroAccessToken: null,
            xeroRefreshToken: null,
            tokenExpiresAt: null
          }
        });
      }
    }
    
    console.log('\n✨ Token refresh process completed!\n');
    
  } catch (error) {
    console.error('❌ Error during token refresh:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get user email from command line arguments
const userEmail = process.argv[2];

// Run the script
refreshTokensForUser(userEmail);
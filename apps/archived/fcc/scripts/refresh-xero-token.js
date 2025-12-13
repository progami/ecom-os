#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const { XeroClient } = require('xero-node');

const prisma = new PrismaClient();

const xeroConfig = {
  clientId: process.env.XERO_CLIENT_ID || '',
  clientSecret: process.env.XERO_CLIENT_SECRET || '',
  redirectUris: [process.env.XERO_REDIRECT_URI || 'https://localhost:3003/api/v1/xero/auth/callback'],
  scopes: 'offline_access openid profile email accounting.transactions accounting.settings accounting.contacts accounting.reports.read'
};

async function refreshXeroToken() {
  try {
    console.log('Starting Xero token refresh...');
    
    // Get the current user with token
    const user = await prisma.user.findFirst({
      where: {
        xeroRefreshToken: { not: null }
      }
    });
    
    if (!user) {
      console.error('No user with Xero refresh token found');
      return;
    }
    
    console.log(`Found user: ${user.email}`);
    console.log(`Current token expires at: ${new Date(user.tokenExpiresAt).toISOString()}`);
    console.log(`Current time: ${new Date().toISOString()}`);
    
    // Create Xero client
    const xero = new XeroClient({
      clientId: xeroConfig.clientId,
      clientSecret: xeroConfig.clientSecret,
      redirectUris: xeroConfig.redirectUris,
      scopes: xeroConfig.scopes.split(' ')
    });
    
    // Set current token (even if expired)
    xero.setTokenSet({
      access_token: user.xeroAccessToken,
      refresh_token: user.xeroRefreshToken,
      expires_at: Math.floor(user.tokenExpiresAt / 1000),
      token_type: 'Bearer',
      scope: user.xeroScope
    });
    
    // Refresh the token
    console.log('Refreshing token...');
    const newTokenSet = await xero.refreshWithRefreshToken(
      xeroConfig.clientId,
      xeroConfig.clientSecret,
      user.xeroRefreshToken
    );
    
    console.log('Token refreshed successfully!');
    console.log(`New token expires at: ${new Date(newTokenSet.expires_at * 1000).toISOString()}`);
    
    // Update user with new tokens
    await prisma.user.update({
      where: { id: user.id },
      data: {
        xeroAccessToken: newTokenSet.access_token,
        xeroRefreshToken: newTokenSet.refresh_token,
        tokenExpiresAt: new Date(newTokenSet.expires_at * 1000)
      }
    });
    
    console.log('Database updated with new tokens');
    
  } catch (error) {
    console.error('Error refreshing token:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Load environment variables
require('dotenv').config();

// Run the refresh
refreshXeroToken();
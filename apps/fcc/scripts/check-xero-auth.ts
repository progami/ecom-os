#!/usr/bin/env tsx

import { prisma } from '../lib/prisma';

async function checkXeroAuth() {
  try {
    console.log('🔍 Checking Xero authentication status...\n');
    
    // Check for stored Xero tokens
    const tokens = await prisma.xeroToken.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    console.log(`Found ${tokens.length} token records\n`);
    
    for (const token of tokens) {
      console.log('━'.repeat(50));
      console.log(`Token ID: ${token.id}`);
      console.log(`User ID: ${token.userId}`);
      console.log(`Created: ${token.createdAt.toISOString()}`);
      console.log(`Updated: ${token.updatedAt.toISOString()}`);
      console.log(`Expires: ${token.expiresAt.toISOString()}`);
      console.log(`Is Expired: ${token.expiresAt < new Date() ? 'Yes ❌' : 'No ✅'}`);
      console.log(`Scopes: ${token.scopes}`);
      console.log(`Has Access Token: ${token.accessToken ? 'Yes ✅' : 'No ❌'}`);
      console.log(`Has Refresh Token: ${token.refreshToken ? 'Yes ✅' : 'No ❌'}`);
    }
    
    console.log('\n' + '━'.repeat(50));
    
    // Check for tenant connections
    const connections = await prisma.xeroConnection.findMany({
      include: {
        user: {
          select: {
            email: true
          }
        }
      }
    });
    
    console.log(`\nFound ${connections.length} Xero connections\n`);
    
    for (const conn of connections) {
      console.log(`Tenant ID: ${conn.tenantId}`);
      console.log(`Tenant Name: ${conn.tenantName}`);
      console.log(`User: ${conn.user.email}`);
      console.log(`Active: ${conn.isActive ? 'Yes ✅' : 'No ❌'}`);
      console.log(`Created: ${conn.createdAt.toISOString()}`);
      console.log('---');
    }
    
  } catch (error) {
    console.error('❌ Error checking Xero auth:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkXeroAuth();
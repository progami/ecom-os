import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

async function saveXeroToken() {
  // This is a placeholder script to save a fresh Xero token to the database
  // You'll need to replace the token below with a fresh one from the browser OAuth flow
  
  const freshJwtToken = 'REPLACE_WITH_FRESH_JWT_TOKEN_FROM_BROWSER';
  
  if (freshJwtToken === 'REPLACE_WITH_FRESH_JWT_TOKEN_FROM_BROWSER') {
    console.error('❌ Please replace the token with a fresh JWT token from the browser OAuth flow');
    console.log('\nTo get a fresh token:');
    console.log('1. Open the app in browser: https://localhost:3003');
    console.log('2. Go to Settings → Integrations → Connect to Xero');
    console.log('3. Complete the OAuth flow');
    console.log('4. Check the browser console or network tab for the JWT token');
    console.log('5. Replace the token in this script and run again');
    return;
  }
  
  try {
    // Decode the JWT
    const decoded = jwt.decode(freshJwtToken) as any;
    
    if (!decoded) {
      console.error('❌ Failed to decode JWT token');
      return;
    }
    
    console.log('Decoded JWT:');
    console.log('- Tenant ID:', decoded.tenantId);
    console.log('- Access Token (first 50 chars):', decoded.accessToken.substring(0, 50) + '...');
    console.log('- Refresh Token (first 50 chars):', decoded.refreshToken.substring(0, 50) + '...');
    
    // Save to database
    const xeroAuth = await prisma.xeroAuth.upsert({
      where: { id: 1 },
      update: {
        accessToken: decoded.accessToken,
        refreshToken: decoded.refreshToken,
        tenantId: decoded.tenantId,
        expiresAt: new Date(decoded.exp * 1000),
        updatedAt: new Date()
      },
      create: {
        accessToken: decoded.accessToken,
        refreshToken: decoded.refreshToken,
        tenantId: decoded.tenantId,
        expiresAt: new Date(decoded.exp * 1000)
      }
    });
    
    console.log('\n✅ Xero token saved to database successfully');
    console.log('Token expires at:', xeroAuth.expiresAt);
    
  } catch (error) {
    console.error('❌ Error saving token:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
saveXeroToken();
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { XeroClient } from 'xero-node';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Xero client
    const xeroClient = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI || 'http://localhost:3000/api/v1/bookkeeping/xero/callback'],
      scopes: ['accounting.transactions', 'accounting.contacts', 'accounting.settings']
    });

    // Generate authorization URL
    const authUrl = await xeroClient.buildConsentUrl();

    return NextResponse.json({
      success: true,
      authUrl
    });
  } catch (error) {
    console.error('Error initiating Xero auth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Xero authentication' },
      { status: 500 }
    );
  }
}
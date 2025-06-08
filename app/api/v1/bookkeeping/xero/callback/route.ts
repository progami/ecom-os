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

    // Get the authorization code from query parameters
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code missing' },
        { status: 400 }
      );
    }

    // TODO: Validate state parameter for security

    // Initialize Xero client
    const xeroClient = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: ['accounting.transactions', 'accounting.contacts', 'accounting.settings']
    });

    try {
      // Exchange authorization code for tokens
      const tokenSet = await xeroClient.apiClient.exchangeCodeForToken(code);
      
      // TODO: Store tokens securely (encrypted in database)
      // For now, we'll store in session (not recommended for production)
      
      // Redirect to bookkeeping dashboard with success message
      return NextResponse.redirect(
        new URL('/bookkeeping?auth=success', req.url)
      );
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      return NextResponse.redirect(
        new URL('/bookkeeping?auth=error', req.url)
      );
    }
  } catch (error) {
    console.error('Error in Xero callback:', error);
    return NextResponse.json(
      { error: 'Failed to process Xero callback' },
      { status: 500 }
    );
  }
}
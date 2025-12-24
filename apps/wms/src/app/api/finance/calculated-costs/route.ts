import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/auth-wrapper';
export const dynamic = 'force-dynamic'

// CalculatedCost functionality removed in v0.5.0
export const GET = withAuth(async (_request, _session) => {
 try {
 return NextResponse.json(
 { error: 'CalculatedCost functionality removed in v0.5.0' },
 { status: 501 }
 );
 } catch (_error) {
 // console.error('Error calculating costs:', error);
 return NextResponse.json(
 { error: 'Failed to calculate costs' },
 { status: 500 }
 );
 }
})

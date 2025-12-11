import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
export const dynamic = 'force-dynamic'

// CalculatedCost functionality removed in v0.5.0
export async function GET(_request: NextRequest) {
 try {
 const session = await auth();
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

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
}
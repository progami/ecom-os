import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(_request: NextRequest) {
 try {
 const session = await auth()
 
 return NextResponse.json({
 hasSession: !!session,
 session: session || null,
 timestamp: new Date().toISOString()
 })
 } catch (_error) {
 return NextResponse.json({
 error: 'Failed to check session',
 message: _error instanceof Error ? _error.message : 'Unknown error'
 }, { status: 500 })
 }
}
import { NextResponse } from 'next/server'

export async function GET() {
 // WMS does not expose local providers; portal auth handles login.
 // Return empty object to satisfy NextAuth client fetches.
 return NextResponse.json({}, { status: 200 })
}

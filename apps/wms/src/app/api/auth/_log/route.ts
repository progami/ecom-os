import { NextResponse } from 'next/server'

export async function POST() {
 // Accept client log posts from NextAuth in dev without erroring
 return new NextResponse(null, { status: 204 })
}


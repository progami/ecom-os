import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

// Invoice model removed in v0.5.0
export async function GET() {
 const session = await auth()
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }
 return NextResponse.json({ 
 error: 'Invoice functionality removed in v0.5.0',
 data: null 
 }, { status: 501 })
}

export async function POST() {
 const session = await auth()
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }
 return NextResponse.json({ 
 error: 'Invoice functionality removed in v0.5.0' 
 }, { status: 501 })
}

export async function PUT() {
 const session = await auth()
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }
 return NextResponse.json({ 
 error: 'Invoice functionality removed in v0.5.0' 
 }, { status: 501 })
}

export async function DELETE() {
 const session = await auth()
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }
 return NextResponse.json({ 
 error: 'Invoice functionality removed in v0.5.0' 
 }, { status: 501 })
}

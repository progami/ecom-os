import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/auth-wrapper'

// Invoice model removed in v0.5.0
export const GET = withAuth(async () => {
 return NextResponse.json({
 error: 'Invoice functionality removed in v0.5.0',
 data: null
 }, { status: 501 })
})

export const POST = withAuth(async () => {
 return NextResponse.json({
 error: 'Invoice functionality removed in v0.5.0'
 }, { status: 501 })
})

export const PUT = withAuth(async () => {
 return NextResponse.json({
 error: 'Invoice functionality removed in v0.5.0'
 }, { status: 501 })
})

export const DELETE = withAuth(async () => {
 return NextResponse.json({
 error: 'Invoice functionality removed in v0.5.0'
 }, { status: 501 })
})

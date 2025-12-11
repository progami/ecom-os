import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET() {
  const session = await auth()
  if (!session || !session.user) {
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: (session.user as any).id,
      email: session.user.email,
      name: session.user.name,
    },
  })
}


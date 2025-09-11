import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const sourcingProfiles = await prisma.sourcingProfile.findMany({
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(sourcingProfiles)
  } catch (error) {
    console.error('Error fetching sourcing profiles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sourcing profiles' },
      { status: 500 }
    )
  }
}
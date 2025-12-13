import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [countries, programs] = await Promise.all([
      prisma.country.findMany({
        where: {
          isActive: true
        },
        orderBy: {
          name: 'asc'
        }
      }),
      prisma.program.findMany({
        where: {
          isActive: true
        },
        orderBy: {
          name: 'asc'
        }
      })
    ])

    return NextResponse.json({
      countries,
      programs
    })
  } catch (error) {
    console.error('Error fetching metadata:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metadata' },
      { status: 500 }
    )
  }
}
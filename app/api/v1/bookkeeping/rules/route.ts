import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all active categorization rules, ordered by priority (highest first)
    const rules = await prisma.categorizationRule.findMany({
      where: {
        isActive: true
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        name: true,
        description: true,
        matchType: true,
        matchField: true,
        matchValue: true,
        accountCode: true,
        taxType: true,
        priority: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      success: true,
      data: rules,
      count: rules.length
    })
  } catch (error) {
    console.error('Error fetching categorization rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categorization rules' },
      { status: 500 }
    )
  }
}
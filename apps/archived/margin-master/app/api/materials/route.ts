import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createMaterialSchema = z.object({
  name: z.string().min(1),
  countryOfOrigin: z.string().optional().nullable(),
  costPerUnit: z.number().min(0),
  costUnit: z.enum(['area', 'weight', 'volume', 'piece']),
  densityGCm3: z.number().min(0),
  thicknessOptions: z.array(z.number()).optional().nullable(),
  maxSheetLength: z.number().optional().nullable(),
  maxSheetWidth: z.number().optional().nullable(),
  minOrderQuantity: z.number().optional().nullable(),
  setupCost: z.number().optional().nullable(),
  wasteFactor: z.number().min(0).max(1).default(0.1),
  maxBendRadius: z.number().optional().nullable(),
  isRigid: z.boolean().default(false),
  requiresLiner: z.boolean().default(false),
  notes: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')

    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { countryOfOrigin: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ]
    }
    
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    } else {
      where.isActive = true
    }

    const materials = await prisma.materialProfile.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(materials)
  } catch (error) {
    console.error('Error fetching materials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch materials' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createMaterialSchema.parse(body)

    const material = await prisma.materialProfile.create({
      data: {
        ...validatedData,
        thicknessOptions: validatedData.thicknessOptions || undefined,
      },
    })

    return NextResponse.json(material, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating material:', error)
    return NextResponse.json(
      { error: 'Failed to create material' },
      { status: 500 }
    )
  }
}
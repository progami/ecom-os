import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateMaterialSchema = z.object({
  name: z.string().min(1).optional(),
  countryOfOrigin: z.string().optional().nullable(),
  costPerUnit: z.number().min(0).optional(),
  costUnit: z.enum(['area', 'weight', 'volume', 'piece']).optional(),
  densityGCm3: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const material = await prisma.materialProfile.findUnique({
      where: { id },
    })

    if (!material) {
      return NextResponse.json(
        { error: 'Material not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(material)
  } catch (error) {
    console.error('Error fetching material:', error)
    return NextResponse.json(
      { error: 'Failed to fetch material' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = updateMaterialSchema.parse(body)

    const material = await prisma.materialProfile.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(material)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating material:', error)
    return NextResponse.json(
      { error: 'Failed to update material' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.materialProfile.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting material:', error)
    return NextResponse.json(
      { error: 'Failed to delete material' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/simulations/[id] - Get a single simulation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // For demo purposes, fetch without userId filter
    const simulation = await prisma.simulation.findUnique({
      where: {
        id
      },
      include: {
        sourcingProfile: true
      }
    })

    if (!simulation) {
      return NextResponse.json(
        { error: 'Simulation not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(simulation)
  } catch (error) {
    console.error('Error fetching simulation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch simulation' },
      { status: 500 }
    )
  }
}

// DELETE /api/simulations/[id] - Delete a simulation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // In a real app, verify the user owns this simulation
    const userId = 'default-user-id' // Replace with actual user authentication

    const simulation = await prisma.simulation.findFirst({
      where: {
        id,
        userId
      }
    })

    if (!simulation) {
      return NextResponse.json(
        { error: 'Simulation not found' },
        { status: 404 }
      )
    }

    await prisma.simulation.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting simulation:', error)
    return NextResponse.json(
      { error: 'Failed to delete simulation' },
      { status: 500 }
    )
  }
}

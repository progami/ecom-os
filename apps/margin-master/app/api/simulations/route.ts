import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for the simulation
const SimulationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  marketplace: z.string(),
  estimatedAcosPercent: z.number(),
  refundProvisionPercent: z.number(),
  scenarios: z.array(z.object({
    id: z.string(),
    name: z.string(),
    salePrice: z.number(),
    packSize: z.number(),
    materialProfileId: z.string().nullable(),
    sourcingProfileId: z.string().nullable(),
    landedCost: z.number(),
    fbaFee: z.number(),
    referralFee: z.number(),
    netMarginPercent: z.number(),
    roi: z.number(),
  }))
})

// GET /api/simulations - Get all simulations for the user
export async function GET(request: NextRequest) {
  try {
    // In a real app, you'd get the userId from the session
    // For now, we'll fetch all simulations for demo purposes
    // const userId = 'default-user-id' // Replace with actual user authentication

    const simulations = await prisma.simulation.findMany({
      // where: {
      //   userId: userId
      // },
      include: {
        sourcingProfile: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(simulations)
  } catch (error) {
    console.error('Error fetching simulations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch simulations' },
      { status: 500 }
    )
  }
}

// POST /api/simulations - Create a new simulation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate the request body
    const validationResult = SimulationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { name, description, marketplace, estimatedAcosPercent, refundProvisionPercent, scenarios } = validationResult.data

    // In a real app, you'd get the userId from the session
    const userId = 'default-user-id' // Replace with actual user authentication

    // For simplicity, we'll use the first scenario's sourcing profile
    // In a more complex implementation, you might want to handle multiple profiles
    const sourcingProfileId = scenarios.find(s => s.sourcingProfileId)?.sourcingProfileId

    if (!sourcingProfileId) {
      return NextResponse.json(
        { error: 'At least one scenario must have a sourcing profile' },
        { status: 400 }
      )
    }

    // Create the simulation
    const simulation = await prisma.simulation.create({
      data: {
        userId,
        name,
        marketplace,
        targetSalePrice: scenarios[0]?.salePrice || 0, // Using first scenario's sale price as target
        estimatedAcosPercent,
        refundProvisionPercent,
        sourcingProfileId,
        components: {
          description,
          scenarios: scenarios.map(scenario => ({
            ...scenario,
            // Store additional scenario-specific data
            hasChanges: false,
            isCalculating: false,
            lastCalculated: new Date().toISOString()
          }))
        },
        results: {
          totalScenarios: scenarios.length,
          averageMargin: scenarios.reduce((sum, s) => sum + s.netMarginPercent, 0) / scenarios.length,
          averageROI: scenarios.reduce((sum, s) => sum + s.roi, 0) / scenarios.length,
          bestScenario: scenarios.reduce((best, current) => 
            current.netMarginPercent > best.netMarginPercent ? current : best
          ),
          worstScenario: scenarios.reduce((worst, current) => 
            current.netMarginPercent < worst.netMarginPercent ? current : worst
          )
        }
      },
      include: {
        sourcingProfile: true
      }
    })

    return NextResponse.json(simulation, { status: 201 })
  } catch (error) {
    console.error('Error creating simulation:', error)
    return NextResponse.json(
      { error: 'Failed to create simulation' },
      { status: 500 }
    )
  }
}

// DELETE /api/simulations/[id] - Delete a simulation
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const id = url.pathname.split('/').pop()

    if (!id) {
      return NextResponse.json(
        { error: 'Simulation ID is required' },
        { status: 400 }
      )
    }

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
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CombinationGenerator, type GenerationParams } from '@/lib/services/combination-generator'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const params: GenerationParams = await request.json()
    
    // Validate parameters
    if (!params.name || !params.materialProfiles?.length || !params.sourcingProfiles?.length) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Create generator instance
    const generator = new CombinationGenerator()
    
    // Create batch
    const batchId = await generator.createBatch(params)
    
    // Generate combinations
    const combinations = await generator.generateCombinations(params)
    
    // Update batch with combination count
    await prisma.generationBatch.update({
      where: { id: batchId },
      data: {
        totalCombinations: combinations.length,
        status: 'generating'
      }
    })

    // Return batch info and combinations for processing
    return NextResponse.json({
      success: true,
      batchId,
      totalCombinations: combinations.length,
      combinations: combinations.map((c, index) => ({
        id: `${batchId}-${index}`,
        ...c
      }))
    })
  } catch (error) {
    console.error('Generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate combinations' },
      { status: 500 }
    )
  }
}

// Get batch status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batchId')
    
    if (!batchId) {
      // Return list of recent batches
      const batches = await prisma.generationBatch.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          status: true,
          totalCombinations: true,
          completedCombinations: true,
          createdAt: true,
          completedAt: true,
          summary: true
        }
      })
      
      return NextResponse.json({ batches })
    }
    
    // Get specific batch
    const batch = await prisma.generationBatch.findUnique({
      where: { id: batchId }
    })
    
    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      )
    }
    
    // Get top results if complete
    let topResults: any[] = []
    if (batch.status === 'complete') {
      topResults = await prisma.generatedCombination.findMany({
        where: { batchId },
        orderBy: { netMarginPercent: 'desc' },
        take: 20,
        include: {
          materialProfile: {
            select: { name: true }
          },
          sourcingProfile: {
            select: { name: true }
          }
        }
      })
    }
    
    return NextResponse.json({
      batch,
      topResults
    })
  } catch (error) {
    console.error('Batch status error:', error)
    return NextResponse.json(
      { error: 'Failed to get batch status' },
      { status: 500 }
    )
  }
}
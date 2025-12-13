import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// DTO Types
export interface CountryDTO {
  id: string
  code: string
  name: string
  region: string | null
  currency: string
  isActive: boolean
  programs: ProgramSummaryDTO[]
}

export interface ProgramSummaryDTO {
  id: string
  code: string
  name: string
  description: string | null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const includePrograms = searchParams.get('includePrograms') === 'true'
    const activeOnly = searchParams.get('activeOnly') !== 'false' // Default to true
    const region = searchParams.get('region')

    // Build where clause
    const where: any = {}
    if (activeOnly) {
      where.isActive = true
    }
    if (region) {
      where.region = region
    }

    // Fetch countries with their programs
    const countries = await prisma.country.findMany({
      where,
      include: {
        fulfilmentFees: includePrograms ? {
          select: {
            program: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
                isActive: true
              }
            }
          },
          distinct: ['programId'],
          where: {
            program: {
              isActive: true
            }
          }
        } : false
      },
      orderBy: [
        { region: 'asc' },
        { name: 'asc' }
      ]
    })

    // Transform to DTO
    const countriesDTO: CountryDTO[] = countries.map(country => {
      const dto: CountryDTO = {
        id: country.id,
        code: country.code,
        name: country.name,
        region: country.region,
        currency: country.currency,
        isActive: country.isActive,
        programs: []
      }

      if (includePrograms && 'fulfilmentFees' in country) {
        // Get unique programs
        const programMap = new Map<string, ProgramSummaryDTO>()
        country.fulfilmentFees.forEach((fee: any) => {
          if (!programMap.has(fee.program.id)) {
            programMap.set(fee.program.id, {
              id: fee.program.id,
              code: fee.program.code,
              name: fee.program.name,
              description: fee.program.description
            })
          }
        })
        dto.programs = Array.from(programMap.values())
      }

      return dto
    })

    // Add summary statistics
    const response = {
      countries: countriesDTO,
      total: countriesDTO.length,
      regions: Array.from(new Set(countriesDTO.map(c => c.region).filter(Boolean))),
      currencies: Array.from(new Set(countriesDTO.map(c => c.currency)))
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to fetch countries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch countries' },
      { status: 500 }
    )
  }
}
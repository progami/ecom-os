import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getProgramDisplayName } from '@/lib/constants/amazon-programs'

export const dynamic = 'force-dynamic'

// DTO Types
export interface ProgramDTO {
  id: string
  code: string
  name: string
  displayName: string
  description: string | null
  isActive: boolean
  availableCountries: CountrySummaryDTO[]
  feeTypes: string[]
}

export interface CountrySummaryDTO {
  id: string
  code: string
  name: string
  currency: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const countryCode = searchParams.get('country')
    const activeOnly = searchParams.get('activeOnly') !== 'false' // Default to true
    const includeCountries = searchParams.get('includeCountries') === 'true'

    // Build where clause
    const where: any = {}
    if (activeOnly) {
      where.isActive = true
    }

    // If country is specified, filter programs available in that country
    if (countryCode) {
      where.fulfilmentFees = {
        some: {
          country: {
            code: countryCode
          }
        }
      }
    }

    // Fetch programs with their associated data
    const programs = await prisma.program.findMany({
      where,
      include: {
        fulfilmentFees: includeCountries ? {
          select: {
            country: {
              select: {
                id: true,
                code: true,
                name: true,
                currency: true
              }
            }
          },
          distinct: ['countryId']
        } : false,
        storageFees: {
          select: { id: true },
          take: 1
        },
        referralFees: {
          select: { id: true },
          take: 1
        },
        optionalServices: {
          select: { id: true },
          take: 1
        },
        surcharges: {
          select: { id: true },
          take: 1
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Transform to DTO
    const programsDTO: ProgramDTO[] = programs.map(program => {
      const dto: ProgramDTO = {
        id: program.id,
        code: program.code,
        name: program.name,
        displayName: getProgramDisplayName(program.code),
        description: program.description,
        isActive: program.isActive,
        availableCountries: [],
        feeTypes: []
      }

      // Add available countries if requested
      if (includeCountries && 'fulfilmentFees' in program) {
        const countryMap = new Map<string, CountrySummaryDTO>()
        program.fulfilmentFees.forEach((fee: any) => {
          if (!countryMap.has(fee.country.id)) {
            countryMap.set(fee.country.id, {
              id: fee.country.id,
              code: fee.country.code,
              name: fee.country.name,
              currency: fee.country.currency
            })
          }
        })
        dto.availableCountries = Array.from(countryMap.values())
      }

      // Determine available fee types
      if (program.fulfilmentFees.length > 0) dto.feeTypes.push('Fulfilment')
      if (program.storageFees.length > 0) dto.feeTypes.push('Storage')
      if (program.referralFees.length > 0) dto.feeTypes.push('Referral')
      if (program.optionalServices.length > 0) dto.feeTypes.push('Optional Services')
      if (program.surcharges.length > 0) dto.feeTypes.push('Surcharges')

      return dto
    })

    // Add summary
    const response = {
      programs: programsDTO,
      total: programsDTO.length,
      feeTypesSummary: {
        fulfilment: programsDTO.filter(p => p.feeTypes.includes('Fulfilment')).length,
        storage: programsDTO.filter(p => p.feeTypes.includes('Storage')).length,
        referral: programsDTO.filter(p => p.feeTypes.includes('Referral')).length,
        optionalServices: programsDTO.filter(p => p.feeTypes.includes('Optional Services')).length,
        surcharges: programsDTO.filter(p => p.feeTypes.includes('Surcharges')).length
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Failed to fetch programs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch programs' },
      { status: 500 }
    )
  }
}
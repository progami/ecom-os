import { useQuery } from '@tanstack/react-query'

export interface MaterialProfile {
  id: string
  name: string
  countryOfOrigin: string | null
  costPerUnit: number
  costUnit: 'area' | 'weight' | 'volume' | 'piece'
  densityGCm3: number
  isActive: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface SourcingProfile {
  id: string
  name: string
  countryOfOrigin: string | null
  tariffRatePercent: number
  freightAssumptionCost: number | null
  freightUnit: string | null
  costBufferPercent: number
  createdAt: string
  updatedAt: string
}

export interface Country {
  id: string
  code: string
  name: string
  region: string | null
  currency: string
  isActive: boolean
}

export interface Program {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
}

export interface MetadataResponse {
  countries: Country[]
  programs: Program[]
}

export const useMaterials = () => {
  return useQuery<MaterialProfile[]>({
    queryKey: ['materials'],
    queryFn: async () => {
      const response = await fetch('/api/materials')
      if (!response.ok) {
        throw new Error('Failed to fetch materials')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export const useSourcingProfiles = () => {
  return useQuery<SourcingProfile[]>({
    queryKey: ['sourcing-profiles'],
    queryFn: async () => {
      const response = await fetch('/api/sourcing-profiles')
      if (!response.ok) {
        throw new Error('Failed to fetch sourcing profiles')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export const useMetadata = () => {
  return useQuery<MetadataResponse>({
    queryKey: ['metadata'],
    queryFn: async () => {
      const response = await fetch('/api/metadata')
      if (!response.ok) {
        throw new Error('Failed to fetch metadata')
      }
      return response.json()
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Combined hook for simulation data
export const useSimulationData = () => {
  const materialsQuery = useMaterials()
  const sourcingQuery = useSourcingProfiles()
  
  return {
    materials: materialsQuery.data || [],
    sourcingProfiles: sourcingQuery.data || [],
    isLoading: materialsQuery.isLoading || sourcingQuery.isLoading,
    error: materialsQuery.error || sourcingQuery.error,
    refetch: () => {
      materialsQuery.refetch()
      sourcingQuery.refetch()
    }
  }
}
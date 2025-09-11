import { useMutation } from '@tanstack/react-query'
import { CalculationRequest, CalculationResponse } from './use-calculate-fees'

export interface BatchCalculationRequest {
  requests: Array<CalculationRequest & { id: string }>
}

export interface BatchCalculationResponse {
  results: Array<{
    id: string
    success: boolean
    data?: CalculationResponse
    error?: string
  }>
}

export const useCalculateFeesBatch = () => {
  return useMutation<BatchCalculationResponse, Error, BatchCalculationRequest>({
    mutationFn: async ({ requests }: BatchCalculationRequest) => {
      // Process calculations in parallel with error handling for each
      const results = await Promise.all(
        requests.map(async (request) => {
          try {
            const response = await fetch('/api/calculate-fees', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(request),
            })
            
            if (!response.ok) {
              const error = await response.json()
              return {
                id: request.id,
                success: false,
                error: error.details || error.message || 'Failed to calculate fees'
              }
            }
            
            const data = await response.json()
            return {
              id: request.id,
              success: true,
              data
            }
          } catch (error) {
            return {
              id: request.id,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      )

      return { results }
    },
  })
}
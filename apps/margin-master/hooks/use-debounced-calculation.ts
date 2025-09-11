import { useCallback, useRef } from 'react'
import { debounce } from 'lodash'

interface DebouncedCalculationOptions {
  delay?: number
  onCalculate: (scenarioIds: string[]) => Promise<void>
}

export const useDebouncedCalculation = ({
  delay = 500,
  onCalculate
}: DebouncedCalculationOptions) => {
  const pendingCalculations = useRef<Set<string>>(new Set())
  const isCalculating = useRef<Map<string, boolean>>(new Map())

  // Create a debounced function that will execute calculations
  const debouncedCalculate = useRef(
    debounce(async () => {
      const scenarioIds = Array.from(pendingCalculations.current)
      if (scenarioIds.length === 0) return

      // Mark scenarios as calculating
      scenarioIds.forEach(id => isCalculating.current.set(id, true))
      
      try {
        await onCalculate(scenarioIds)
      } finally {
        // Clear calculating state
        scenarioIds.forEach(id => isCalculating.current.delete(id))
        pendingCalculations.current.clear()
      }
    }, delay)
  ).current

  // Queue a scenario for calculation
  const queueCalculation = useCallback((scenarioId: string) => {
    pendingCalculations.current.add(scenarioId)
    debouncedCalculate()
  }, [debouncedCalculate])

  // Cancel pending calculations
  const cancelPendingCalculations = useCallback(() => {
    debouncedCalculate.cancel()
    pendingCalculations.current.clear()
  }, [debouncedCalculate])

  // Check if a scenario is pending calculation
  const isPending = useCallback((scenarioId: string) => {
    return pendingCalculations.current.has(scenarioId)
  }, [])

  // Check if a scenario is currently calculating
  const isCalculatingScenario = useCallback((scenarioId: string) => {
    return isCalculating.current.get(scenarioId) || false
  }, [])

  return {
    queueCalculation,
    cancelPendingCalculations,
    isPending,
    isCalculatingScenario
  }
}
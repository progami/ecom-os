import { useState, useEffect } from 'react'

interface BudgetStrategy {
  id: string
  name: string
  description?: string
  isActive: boolean
}

export function useActiveStrategy() {
  const [activeStrategy, setActiveStrategy] = useState<BudgetStrategy | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActiveStrategy()
  }, [])

  const loadActiveStrategy = async () => {
    try {
      const response = await fetch('/api/strategies')
      if (response.ok) {
        const strategies = await response.json()
        const active = strategies.find((s: BudgetStrategy) => s.isActive)
        setActiveStrategy(active || null)
      }
    } catch (error) {
      console.error('Error loading active strategy:', error)
    } finally {
      setLoading(false)
    }
  }

  return { activeStrategy, loading, refresh: loadActiveStrategy }
}
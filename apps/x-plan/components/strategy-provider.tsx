'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Strategy = {
  id: string
  name: string
  description: string | null
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

type StrategyContextValue = {
  strategyId: string | null
  strategy: Strategy | null
  strategies: Strategy[]
  isLoading: boolean
  setStrategyId: (id: string) => void
  refetch: () => Promise<void>
}

const StrategyContext = createContext<StrategyContextValue | null>(null)

const STORAGE_KEY = 'xplan:active-strategy'

export function StrategyProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [strategyId, setStrategyIdState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchStrategies = async () => {
    try {
      const response = await fetch('/api/v1/x-plan/strategies')
      if (response.ok) {
        const data = await response.json()
        setStrategies(data.strategies)
        return data.strategies as Strategy[]
      }
    } catch (error) {
      console.error('Failed to fetch strategies:', error)
    }
    return []
  }

  const refetch = async () => {
    await fetchStrategies()
  }

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      const fetchedStrategies = await fetchStrategies()

      // Priority: URL param > localStorage > default strategy
      const urlStrategy = searchParams.get('strategy')
      const storedStrategy = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null

      let activeId: string | null = null

      if (urlStrategy && fetchedStrategies.some((s: Strategy) => s.id === urlStrategy)) {
        activeId = urlStrategy
      } else if (storedStrategy && fetchedStrategies.some((s: Strategy) => s.id === storedStrategy)) {
        activeId = storedStrategy
      } else {
        const defaultStrategy = fetchedStrategies.find((s: Strategy) => s.isDefault)
        activeId = defaultStrategy?.id ?? fetchedStrategies[0]?.id ?? null
      }

      setStrategyIdState(activeId)
      if (activeId && typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, activeId)
      }
      setIsLoading(false)
    }

    init()
  }, [searchParams])

  const setStrategyId = (id: string) => {
    setStrategyIdState(id)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, id)
    }
    // Update URL with new strategy
    const params = new URLSearchParams(searchParams.toString())
    params.set('strategy', id)
    router.push(`?${params.toString()}`)
  }

  const strategy = strategies.find((s) => s.id === strategyId) ?? null

  return (
    <StrategyContext.Provider
      value={{
        strategyId,
        strategy,
        strategies,
        isLoading,
        setStrategyId,
        refetch,
      }}
    >
      {children}
    </StrategyContext.Provider>
  )
}

export function useStrategy() {
  const context = useContext(StrategyContext)
  if (!context) {
    throw new Error('useStrategy must be used within a StrategyProvider')
  }
  return context
}

'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GLEntry, GLFilters } from '@/types/gl'

interface GLDataResponse {
  entries: GLEntry[]
  summary: {
    totalEntries: number
    projectionCount: number
    reconciledCount: number
    actualCount: number
  }
}

// Fetch GL entries from API
async function fetchGLEntries(filters?: GLFilters): Promise<GLDataResponse> {
  const params = new URLSearchParams()
  
  if (filters?.startDate) params.append('startDate', filters.startDate.toISOString())
  if (filters?.endDate) params.append('endDate', filters.endDate.toISOString())
  if (filters?.accountType) params.append('accountType', filters.accountType)
  if (filters?.accountCode) params.append('accountCode', filters.accountCode)
  if (filters?.category) params.append('category', filters.category)
  if (filters?.isProjection !== undefined) params.append('isProjection', String(filters.isProjection))
  if (filters?.isReconciled !== undefined) params.append('isReconciled', String(filters.isReconciled))
  if (filters?.isActual !== undefined) params.append('isActual', String(filters.isActual))
  
  const response = await fetch(`/api/gl/entries?${params}`)
  if (!response.ok) {
    throw new Error('Failed to fetch GL entries')
  }
  
  return response.json()
}

// Custom hook for GL data
export function useGLData(filters?: GLFilters) {
  const queryKey = ['gl-entries', filters]
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchGLEntries(filters),
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })
  
  // Derived data from entries
  const entries = data?.entries ?? []
  
  // Filter methods that work on cached data
  const getEntriesByDateRange = (startDate: Date, endDate: Date) => {
    return entries.filter(entry => {
      const entryDate = new Date(entry.date)
      return entryDate >= startDate && entryDate <= endDate
    })
  }
  
  const getEntriesByAccountType = (accountType: GLEntry['accountType']) => {
    return entries.filter(entry => entry.accountType === accountType)
  }
  
  const getEntriesByCategory = (category: string) => {
    return entries.filter(entry => entry.category === category)
  }
  
  const getUniqueCategories = () => {
    const categories = new Set(entries.map(entry => entry.category))
    return Array.from(categories).sort()
  }
  
  const getUniqueAccountCodes = () => {
    const codes = new Set(entries.filter(entry => entry.accountCode).map(entry => entry.accountCode!))
    return Array.from(codes).sort()
  }
  
  const getBalanceByAccount = (accountCode: string, asOfDate?: Date) => {
    const filtered = entries.filter(entry => 
      entry.accountCode === accountCode &&
      (!asOfDate || new Date(entry.date) <= asOfDate)
    )
    return filtered.reduce((balance, entry) => balance + entry.amount, 0)
  }
  
  const getBalanceByAccountType = (accountType: GLEntry['accountType'], asOfDate?: Date) => {
    const filtered = entries.filter(entry => 
      entry.accountType === accountType &&
      (!asOfDate || new Date(entry.date) <= asOfDate)
    )
    return filtered.reduce((balance, entry) => balance + entry.amount, 0)
  }
  
  const getSummaryStats = () => {
    const totalEntries = entries.length
    const accountTypes = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const
    
    const balancesByType = accountTypes.reduce((acc, type) => {
      acc[type] = getBalanceByAccountType(type)
      return acc
    }, {} as Record<string, number>)
    
    const projectionCount = entries.filter(e => e.isProjection).length
    const reconciledCount = entries.filter(e => e.isReconciled).length
    const actualCount = entries.filter(e => e.isActual).length
    
    const dates = entries.map(entry => new Date(entry.date))
    const dateRange = dates.length > 0 ? {
      startDate: new Date(Math.min(...dates.map(d => d.getTime()))),
      endDate: new Date(Math.max(...dates.map(d => d.getTime())))
    } : { startDate: null, endDate: null }
    
    return {
      totalEntries,
      dateRange,
      balancesByType,
      projectionCount,
      reconciledCount,
      actualCount,
      historicalCount: totalEntries - projectionCount
    }
  }
  
  return {
    entries,
    isLoading,
    error,
    refetch,
    summary: data?.summary,
    // Helper methods
    getEntriesByDateRange,
    getEntriesByAccountType,
    getEntriesByCategory,
    getUniqueCategories,
    getUniqueAccountCodes,
    getBalanceByAccount,
    getBalanceByAccountType,
    getSummaryStats
  }
}

// Hook to mutate GL data
export function useGLMutations() {
  const queryClient = useQueryClient()
  
  const invalidateGLData = () => {
    queryClient.invalidateQueries({ queryKey: ['gl-entries'] })
  }
  
  const addGLEntry = async (entry: Omit<GLEntry, 'id'>) => {
    const response = await fetch('/api/gl/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    })
    
    if (!response.ok) {
      throw new Error('Failed to add GL entry')
    }
    
    invalidateGLData()
    return response.json()
  }
  
  const updateGLEntry = async (id: string, updates: Partial<GLEntry>) => {
    const response = await fetch(`/api/gl/entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    
    if (!response.ok) {
      throw new Error('Failed to update GL entry')
    }
    
    invalidateGLData()
    return response.json()
  }
  
  const deleteGLEntry = async (id: string) => {
    const response = await fetch(`/api/gl/entries/${id}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      throw new Error('Failed to delete GL entry')
    }
    
    invalidateGLData()
  }
  
  return {
    addGLEntry,
    updateGLEntry,
    deleteGLEntry,
    invalidateGLData
  }
}
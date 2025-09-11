'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClientFinancialService } from '@/lib/services/ClientFinancialService'
import { RevenueData, ExpenseData } from '@/types/financial'
import { transformRevenueToDashboardFormat, type DashboardRevenueData } from '@/lib/utils/revenueHelpers'
import clientLogger from '@/utils/clientLogger'

const financialService = new ClientFinancialService()

// ========== Revenue Hooks ==========

export function useRevenue() {
  return useQuery({
    queryKey: ['revenue'],
    queryFn: () => financialService.getRevenue(),
    staleTime: 30 * 1000, // 30 seconds
  })
}

export function useRevenueByPeriod(year: number, quarter: number) {
  return useQuery({
    queryKey: ['revenue', year, quarter],
    queryFn: async () => {
      const response = await fetch(`/api/revenue?year=${year}&quarter=${quarter}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch revenue: ${response.statusText}`)
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  })
}

export function useUpdateRevenue() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({
      year,
      week,
      sku,
      units,
      amount,
    }: {
      year: number
      week: number
      sku: string
      units: number
      amount: number
    }) => {
      const response = await fetch('/api/revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateActual',
          data: { year, week, sku, units, amount },
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.error || response.statusText
        throw new Error(`Failed to update revenue: ${errorMessage}`)
      }
      
      return response.json()
    },
    onSuccess: (_, variables) => {
      const quarter = Math.ceil(variables.week / 13)
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['revenue'] })
      queryClient.invalidateQueries({ queryKey: ['revenue', variables.year, quarter] })
      queryClient.invalidateQueries({ queryKey: ['revenue-summary'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-revenue'] })
      queryClient.invalidateQueries({ queryKey: ['gl-entries'] })
    },
    onError: (error) => {
      clientLogger.error('Revenue update error:', error)
    },
  })
}

export function useUpdateUnitSales() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({
      year,
      week,
      sku,
      units,
    }: {
      year: number
      week: number
      sku: string
      units: number
    }) => {
      const response = await fetch('/api/unit-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateUnitSales',
          data: { year, week, sku, units },
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.error || response.statusText
        throw new Error(`Failed to update unit sales: ${errorMessage}`)
      }
      
      return response.json()
    },
    onSuccess: (_, variables) => {
      const quarter = Math.ceil(variables.week / 13)
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['unit-sales'] })
      queryClient.invalidateQueries({ queryKey: ['unit-sales', variables.year, quarter] })
      queryClient.invalidateQueries({ queryKey: ['revenue'] })
      queryClient.invalidateQueries({ queryKey: ['revenue', variables.year, quarter] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['gl-entries'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-revenue'] })
    },
    onError: (error) => {
      clientLogger.error('Unit sales update error:', error)
    },
  })
}

// ========== Expense Hooks ==========

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: () => financialService.getExpenses(),
    staleTime: 30 * 1000,
  })
}

export function useExpensesByPeriod(year: number, quarter: number) {
  return useQuery({
    queryKey: ['expenses', year, quarter],
    queryFn: async () => {
      const timestamp = Date.now()
      const response = await fetch(`/api/expenses?year=${year}&quarter=${quarter}&_t=${timestamp}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch expenses: ${response.statusText}`)
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (expense: Partial<ExpenseData>) => 
      financialService.updateExpense(expense),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
    }
  })
}

// ========== Reconciliation Hooks ==========

export function useReconciliationStatus() {
  return useQuery({
    queryKey: ['reconciliation-status'],
    queryFn: async () => {
      const response = await fetch('/api/reconciliation-status')
      if (!response.ok) {
        throw new Error(`Failed to fetch reconciliation status: ${response.statusText}`)
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })
}

// ========== Product & Inventory Hooks ==========

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => financialService.getProducts(),
    staleTime: 60 * 1000,
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ sku, data }: { sku: string; data: any }) =>
      financialService.updateProduct(sku, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    }
  })
}

export function useInventoryBatches(sku?: string) {
  return useQuery({
    queryKey: ['inventory-batches', sku],
    queryFn: () => financialService.getInventoryBatches(sku),
    staleTime: 30 * 1000,
  })
}

export function useCreateInventoryBatch() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (batch: any) => financialService.createInventoryBatch(batch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] })
    }
  })
}

// ========== Summary Hooks ==========

export function useRevenueSummary() {
  return useQuery({
    queryKey: ['revenue-summary'],
    queryFn: () => financialService.getRevenueSummary(),
    staleTime: 60 * 1000,
  })
}

export function useExpenseSummary(year?: number, quarter?: number) {
  return useQuery({
    queryKey: ['expense-summary', year, quarter],
    queryFn: () => financialService.getExpenseSummary(year, quarter),
    staleTime: 60 * 1000,
  })
}

export function useWeeklyFinancialData(year: number, quarter: number) {
  return useQuery({
    queryKey: ['weekly-financial', year, quarter],
    queryFn: () => financialService.getWeeklyFinancialData(year, quarter),
    staleTime: 60 * 1000,
  })
}

// ========== Dashboard Hooks ==========

export function useDashboardRevenue() {
  return useQuery({
    queryKey: ['dashboard-revenue'],
    queryFn: async (): Promise<DashboardRevenueData> => {
      const response = await fetch('/api/revenue/shared?type=revenue')
      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard revenue: ${response.statusText}`)
      }
      const data = await response.json()
      return transformRevenueToDashboardFormat(data.revenue || [])
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })
}

// ========== Combined Hooks ==========

// For financial page (with year/quarter filtering)
export function useFinancePageData(year: number, quarter: number) {
  const reconciliationQuery = useReconciliationStatus()
  const revenueQuery = useRevenueByPeriod(year, quarter)
  const expensesQuery = useExpensesByPeriod(year, quarter)
  
  return {
    reconciliation: reconciliationQuery,
    revenue: revenueQuery,
    expenses: expensesQuery,
    isLoading: reconciliationQuery.isLoading || revenueQuery.isLoading || expensesQuery.isLoading,
    hasError: reconciliationQuery.isError || revenueQuery.isError || expensesQuery.isError,
    errors: {
      reconciliation: reconciliationQuery.error,
      revenue: revenueQuery.error,
      expenses: expensesQuery.error,
    },
  }
}

// For financial dashboard (all data)
export function useFinancialDashboard() {
  const queryClient = useQueryClient()
  const revenue = useRevenue()
  const expenses = useExpenses()
  const revenueSummary = useRevenueSummary()
  const expenseSummary = useExpenseSummary()
  const dashboardRevenue = useDashboardRevenue()
  
  const isLoading = revenue.isLoading || expenses.isLoading || 
                   revenueSummary.isLoading || expenseSummary.isLoading ||
                   dashboardRevenue.isLoading
  
  const error = revenue.error || expenses.error || 
                revenueSummary.error || expenseSummary.error ||
                dashboardRevenue.error
  
  return {
    revenue: revenue.data,
    expenses: expenses.data,
    revenueSummary: revenueSummary.data,
    expenseSummary: expenseSummary.data,
    revenueData: dashboardRevenue.data || {},
    isLoading,
    error,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['revenue-summary'] })
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-revenue'] })
      queryClient.invalidateQueries({ queryKey: ['gl-entries'] })
    }
  }
}

// Export all hooks from a single file
export * from './useGLData'
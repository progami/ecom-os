'use client'

import { RevenueData, ExpenseData } from '@/types/financial'

/**
 * Client-side financial service that uses API routes for all data operations.
 * This replaces the old SharedFinancialDataService with a proper client-server architecture.
 */
export class ClientFinancialService {
  // Revenue Operations
  async getRevenue(): Promise<RevenueData> {
    const response = await fetch('/api/revenue/shared?type=revenue')
    if (!response.ok) {
      throw new Error('Failed to fetch revenue data')
    }
    const data = await response.json()
    return data.data || {}
  }

  async updateRevenue(yearWeek: string, sku: string, revenue: number, units: number): Promise<void> {
    const response = await fetch('/api/revenue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yearWeek,
        sku,
        grossRevenue: revenue,
        units
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to update revenue')
    }
  }

  async deleteRevenue(id: string): Promise<void> {
    const response = await fetch(`/api/revenue/${id}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      throw new Error('Failed to delete revenue')
    }
  }

  // Expense Operations
  async getExpenses(): Promise<ExpenseData | null> {
    const response = await fetch('/api/expenses')
    if (!response.ok) {
      throw new Error('Failed to fetch expense data')
    }
    const data = await response.json()
    return data.expenses || null
  }

  async updateExpense(expense: Partial<ExpenseData>): Promise<void> {
    const response = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense)
    })
    
    if (!response.ok) {
      throw new Error('Failed to update expense')
    }
  }

  async deleteExpense(id: string): Promise<void> {
    const response = await fetch(`/api/expenses/${id}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      throw new Error('Failed to delete expense')
    }
  }

  // Weekly Financial Data
  async getWeeklyFinancialData(year: number, quarter: number) {
    const response = await fetch(`/api/financial/weekly?year=${year}&quarter=${quarter}`)
    if (!response.ok) {
      throw new Error('Failed to fetch weekly financial data')
    }
    return response.json()
  }

  // Product Operations
  async getProducts() {
    const response = await fetch('/api/products')
    if (!response.ok) {
      throw new Error('Failed to fetch products')
    }
    return response.json()
  }

  async updateProduct(sku: string, data: any) {
    const response = await fetch(`/api/products/${sku}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    if (!response.ok) {
      throw new Error('Failed to update product')
    }
    return response.json()
  }

  // Inventory Operations
  async getInventoryBatches(sku?: string) {
    const url = sku ? `/api/inventory/batches?sku=${sku}` : '/api/inventory/batches'
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to fetch inventory batches')
    }
    return response.json()
  }

  async createInventoryBatch(batch: any) {
    const response = await fetch('/api/inventory/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch)
    })
    
    if (!response.ok) {
      throw new Error('Failed to create inventory batch')
    }
    return response.json()
  }

  // GL Entry Operations
  async getGLEntries(filters?: any) {
    const params = new URLSearchParams(filters)
    const response = await fetch(`/api/gl/entries?${params}`)
    if (!response.ok) {
      throw new Error('Failed to fetch GL entries')
    }
    return response.json()
  }

  async createGLEntries(entries: any[]) {
    const response = await fetch('/api/gl/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries })
    })
    
    if (!response.ok) {
      throw new Error('Failed to create GL entries')
    }
    return response.json()
  }

  // Summary Methods
  async getRevenueSummary() {
    const response = await fetch('/api/revenue/summary')
    if (!response.ok) {
      throw new Error('Failed to fetch revenue summary')
    }
    return response.json()
  }

  async getExpenseSummary(year?: number, quarter?: number) {
    const params = new URLSearchParams()
    if (year) params.append('year', year.toString())
    if (quarter) params.append('quarter', quarter.toString())
    
    const response = await fetch(`/api/expenses/summary?${params}`)
    if (!response.ok) {
      throw new Error('Failed to fetch expense summary')
    }
    return response.json()
  }
}

// Export singleton instance for backward compatibility
export const clientFinancialService = new ClientFinancialService()

// Export default
export default ClientFinancialService
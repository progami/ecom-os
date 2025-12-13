'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, Download, Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { CashSummaryData } from '@/lib/types/cash-summary'
import { structuredLogger } from '@/lib/logger'

interface CashSummaryReportProps {
  month?: number
  year?: number
  periods?: number
  onExport?: (data: CashSummaryData) => void
}

export function CashSummaryReport({ 
  month, 
  year, 
  periods = 5,
  onExport 
}: CashSummaryReportProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CashSummaryData | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchCashSummary = async (refresh = false) => {
    try {
      setError(null)
      if (refresh) setRefreshing(true)
      else setLoading(true)

      const params = new URLSearchParams()
      if (month) params.append('month', month.toString())
      if (year) params.append('year', year.toString())
      params.append('periods', periods.toString())
      if (refresh) params.append('refresh', 'true')

      const response = await fetch(`/api/v1/xero/reports/cash-summary?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch cash summary')
      }

      setData(result)
    } catch (err) {
      structuredLogger.error('[CashSummaryReport] Error fetching data', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchCashSummary()
  }, [month, year, periods])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!data || !data.periods || data.periods.length === 0) {
    return (
      <Alert>
        <AlertDescription>No cash summary data available for the selected period.</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cash Summary</CardTitle>
            <CardDescription>
              {data.accountName} - {data.periods[0].month} to {data.periods[data.periods.length - 1].month}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchCashSummary(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {onExport && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onExport(data)}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4">Account</th>
                {data.periods.map((period) => (
                  <th key={period.month} className="text-right px-3 py-2 min-w-[100px]">
                    {period.month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Income Section */}
              <tr className="font-semibold bg-gray-50">
                <td colSpan={data.periods.length + 1} className="py-2">Income</td>
              </tr>
              {renderSectionRows(data, 'income')}
              
              {/* Expenses Section */}
              <tr className="font-semibold bg-gray-50 border-t">
                <td colSpan={data.periods.length + 1} className="py-2">Expenses</td>
              </tr>
              {renderSectionRows(data, 'expenses')}
              
              {/* Operating Surplus/Deficit */}
              <tr className="font-semibold border-t-2 border-b">
                <td className="py-2">Operating Surplus/(Deficit)</td>
                {data.periods.map((period) => (
                  <td key={period.month} className="text-right px-3 py-2">
                    {formatCurrency(period.operatingSurplusDeficit || 0)}
                  </td>
                ))}
              </tr>
              
              {/* Other Cash Movements */}
              {hasOtherMovements(data) && (
                <>
                  <tr className="font-semibold bg-gray-50">
                    <td colSpan={data.periods.length + 1} className="py-2">Other Cash Movements</td>
                  </tr>
                  {renderSectionRows(data, 'otherCashMovements')}
                </>
              )}
              
              {/* Net Cash Movement */}
              <tr className="font-bold border-t-2 bg-blue-50">
                <td className="py-3">Net Cash Movement</td>
                {data.periods.map((period) => (
                  <td key={period.month} className="text-right px-3 py-3">
                    {formatCurrency(period.netCashMovement || 0)}
                  </td>
                ))}
              </tr>
              
              {/* Summary Section */}
              <tr className="border-t-2">
                <td className="py-2">Opening Balance</td>
                {data.periods.map((period) => (
                  <td key={period.month} className="text-right px-3 py-2">
                    {formatCurrency(period.summary?.openingBalance || 0)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2">Closing Balance</td>
                {data.periods.map((period) => (
                  <td key={period.month} className="text-right px-3 py-2">
                    {formatCurrency(period.summary?.closingBalance || 0)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function renderSectionRows(data: CashSummaryData, sectionKey: string) {
  const rows: JSX.Element[] = []
  const accountTotals = new Map<string, number[]>()
  
  // Aggregate data across all periods
  data.periods.forEach((period, periodIndex) => {
    const section = period[sectionKey as keyof typeof period] as any
    if (section?.items) {
      section.items.forEach((item: any) => {
        if (!accountTotals.has(item.name)) {
          accountTotals.set(item.name, new Array(data.periods.length).fill(0))
        }
        const totals = accountTotals.get(item.name)!
        totals[periodIndex] = item.amount || 0
      })
    }
  })
  
  // Render rows
  accountTotals.forEach((amounts, accountName) => {
    // Skip rows where all values are zero
    if (amounts.every(amt => amt === 0)) return
    
    rows.push(
      <tr key={accountName} className="hover:bg-gray-50">
        <td className="py-1 pl-4">{accountName}</td>
        {amounts.map((amount, idx) => (
          <td key={idx} className="text-right px-3 py-1">
            {amount !== 0 ? formatCurrency(amount) : '-'}
          </td>
        ))}
      </tr>
    )
  })
  
  // Add total row if there are items
  if (rows.length > 0) {
    rows.push(
      <tr key={`${sectionKey}-total`} className="font-semibold border-t">
        <td className="py-1 pl-4">Total {sectionKey === 'income' ? 'Income' : 'Expenses'}</td>
        {data.periods.map((period) => {
          const section = period[sectionKey as keyof typeof period] as any
          return (
            <td key={period.month} className="text-right px-3 py-1">
              {formatCurrency(section?.total || 0)}
            </td>
          )
        })}
      </tr>
    )
  }
  
  return rows
}

function hasOtherMovements(data: CashSummaryData): boolean {
  return data.periods.some(period => 
    period.otherCashMovements && 
    (period.otherCashMovements.fixedAssets !== 0 ||
     period.otherCashMovements.total !== 0)
  )
}
'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Printer, TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react'
import ClientGLService from '@/lib/services/ClientGLService'
import { CHART_OF_ACCOUNTS } from '@/lib/chart-of-accounts'
import clientLogger from '@/utils/clientLogger'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ComposedChart, Area, AreaChart, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { PageSkeleton } from '@/components/ui/page-skeleton'

interface FinancialMetrics {
  accounts: { [accountCode: string]: number }
  totalRevenue: number
  totalCOGS: number
  totalAmazon: number
  totalOperating: number
  grossProfit: number
  netIncome: number
}

interface PeriodData {
  [period: string]: FinancialMetrics
}

const COLORS = {
  revenue: '#10b981',
  profit: '#3b82f6', 
  cogs: '#f59e0b',
  amazon: '#8b5cf6',
  operating: '#ef4444',
  gross: '#06b6d4',
  positive: '#10b981',
  negative: '#ef4444',
  // Additional colors for detailed expense breakdown
  palette: [
    '#f59e0b', // Orange for Manufacturing/COGS
    '#8b5cf6', // Purple for Marketplace
    '#ef4444', // Red for major operating
    '#3b82f6', // Blue
    '#10b981', // Green
    '#ec4899', // Pink
    '#f97316', // Dark orange
    '#06b6d4', // Cyan
  ]
}

export default function ChartsPage() {
  const [yearlyData, setYearlyData] = useState<PeriodData>({})
  const [monthlyGLData, setMonthlyGLData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const chartsRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    generateReports()
  }, [])

  const generateReports = async () => {
    setLoading(true)
    const glService = ClientGLService.getInstance()
    
    try {
      const strategyResponse = await fetch('/api/strategies/active')
      const { strategy: activeStrategy } = await strategyResponse.json()
      
      if (!activeStrategy) return
      
      // Get 6-year range (2025-2030) for cash flow only
      const startDate = new Date(2025, 0, 1)
      const endDate = new Date(2030, 11, 31)
      
      const periodEntries = await glService.getGLEntries(startDate, endDate)
      
      // Process monthly cash flow data
      const monthlyData: { [key: string]: number } = {}
      let runningBalance = 0 // Let GL data handle the opening balance
      
      periodEntries.forEach(entry => {
        const entryDate = new Date(entry.date)
        const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`
        
        // Track cash account (1000) entries
        if (entry.account && entry.account.startsWith('1000')) {
          if (!monthlyData[monthKey]) monthlyData[monthKey] = 0
          // Debits increase cash, credits decrease cash for asset accounts
          monthlyData[monthKey] += (Number(entry.debit) || 0) - (Number(entry.credit) || 0)
        }
      })
      
      // Convert to array format for chart with cumulative balance
      const monthlyCashFlow: any[] = []
      const sortedMonths = Object.keys(monthlyData).sort()
      
      sortedMonths.forEach(month => {
        runningBalance += monthlyData[month]
        const [year, monthNum] = month.split('-')
        monthlyCashFlow.push({
          date: `${year}-${monthNum}`,
          month: new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          cashBalance: runningBalance,
          change: monthlyData[month]
        })
      })
      
      setMonthlyGLData(monthlyCashFlow)
      
      // Use hardcoded financial data
      const data: PeriodData = {
        '2025': {
          accounts: {},
          totalRevenue: 197806.34,
          totalCOGS: 31110.30,
          totalAmazon: 143295.95,
          totalOperating: 40817,
          grossProfit: 23400.09,
          netIncome: -17416.91
        },
        '2026': {
          accounts: {},
          totalRevenue: 1404892.75,
          totalCOGS: 162353.54,
          totalAmazon: 964424.90,
          totalOperating: 147968,
          grossProfit: 278114.31,
          netIncome: 130146.31
        },
        '2027': {
          accounts: {},
          totalRevenue: 2452370.43,
          totalCOGS: 232561.12,
          totalAmazon: 1627552.40,
          totalOperating: 203116,
          grossProfit: 592256.91,
          netIncome: 389140.91
        },
        '2028': {
          accounts: {},
          totalRevenue: 3552188.06,
          totalCOGS: 340493.87,
          totalAmazon: 2354683.52,
          totalOperating: 234876,
          grossProfit: 857010.67,
          netIncome: 622134.67
        },
        '2029': {
          accounts: {},
          totalRevenue: 5200580.34,
          totalCOGS: 498525.15,
          totalAmazon: 3447510.25,
          totalOperating: 347732,
          grossProfit: 1254544.94,
          netIncome: 906812.94
        },
        '2030': {
          accounts: {},
          totalRevenue: 7967996.69,
          totalCOGS: 729896.29,
          totalAmazon: 5247784.81,
          totalOperating: 459388,
          grossProfit: 1990315.59,
          netIncome: 1530927.59
        }
      }
      
      setYearlyData(data)
      
    } catch (error) {
      clientLogger.error('Error generating reports:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const createEmptyMetrics = (): FinancialMetrics => ({
    accounts: {},
    totalRevenue: 0,
    totalCOGS: 0,
    totalAmazon: 0,
    totalOperating: 0,
    grossProfit: 0,
    netIncome: 0
  })
  
  const chartData = useMemo(() => {
    const years = Object.keys(yearlyData).sort()
    
    // Calculate 6-year totals using hardcoded data
    let totalRevenue5Y = 0
    let totalProfit5Y = 0
    let totalCOGS5Y = 0
    let totalAmazon5Y = 0
    let totalOperating5Y = 0
    
    years.forEach(year => {
      totalRevenue5Y += yearlyData[year].totalRevenue
      totalProfit5Y += yearlyData[year].netIncome
      totalCOGS5Y += yearlyData[year].totalCOGS
      totalAmazon5Y += yearlyData[year].totalAmazon
      totalOperating5Y += yearlyData[year].totalOperating
    })
    
    // Yearly Performance Data
    const performanceData = years.map(year => ({
      year,
      revenue: Math.round(yearlyData[year].totalRevenue / 1000),
      grossProfit: Math.round(yearlyData[year].grossProfit / 1000),
      netIncome: Math.round(yearlyData[year].netIncome / 1000),
      expenses: Math.round((yearlyData[year].totalCOGS + yearlyData[year].totalAmazon + yearlyData[year].totalOperating) / 1000)
    }))
    
    // Margin Trends
    const marginData = years.map(year => ({
      year,
      grossMargin: yearlyData[year].totalRevenue > 0 ? 
        ((yearlyData[year].grossProfit / yearlyData[year].totalRevenue) * 100) : 0,
      netMargin: yearlyData[year].totalRevenue > 0 ? 
        ((yearlyData[year].netIncome / yearlyData[year].totalRevenue) * 100) : 0,
      opexRatio: yearlyData[year].totalRevenue > 0 ?
        ((yearlyData[year].totalOperating / yearlyData[year].totalRevenue) * 100) : 0
    }))
    
    // Cash Position Data - this comes from GL entries via monthlyGLData
    // Convert monthly data to yearly for the cash position chart
    const cashPositionData: any[] = []
    let lastCashBalance = 0 // Let GL data handle the opening balance
    
    for (let year = 2025; year <= 2030; year++) {
      // Find the last month of each year in monthlyGLData
      const yearEndEntry = monthlyGLData
        .filter(entry => entry.date.startsWith(year.toString()))
        .sort((a, b) => a.date.localeCompare(b.date))
        .pop()
      
      if (yearEndEntry) {
        cashPositionData.push({
          year: year.toString(),
          cashPosition: yearEndEntry.cashBalance,
          netIncome: yearEndEntry.cashBalance - lastCashBalance
        })
        lastCashBalance = yearEndEntry.cashBalance
      } else {
        // If no data for this year, use previous balance
        cashPositionData.push({
          year: year.toString(),
          cashPosition: lastCashBalance,
          netIncome: 0
        })
      }
    }
    
    // Hardcoded expense breakdown data (6-year totals)
    const totalExpenseBreakdown = [
      {
        name: 'Fulfillment Fees',
        code: '5051',
        category: 'Marketplace Expenses',
        value: 8061440,
        percentage: ((8061440 / totalRevenue5Y) * 100).toFixed(1)
      },
      {
        name: 'Referral Fees',
        code: '5050',
        category: 'Marketplace Expenses',
        value: 2960138,
        percentage: ((2960138 / totalRevenue5Y) * 100).toFixed(1)
      },
      {
        name: 'Advertising',
        code: '5310',
        category: 'Marketplace Expenses',
        value: 2250547,
        percentage: ((2250547 / totalRevenue5Y) * 100).toFixed(1)
      },
      {
        name: 'Manufacturing',
        code: '5020',
        category: 'COGS',
        value: 1258895,
        percentage: ((1258895 / totalRevenue5Y) * 100).toFixed(1)
      },
      {
        name: 'Payroll',
        code: '5100',
        category: 'Operating Expense',
        value: 838654,
        percentage: ((838654 / totalRevenue5Y) * 100).toFixed(1)
      },
      {
        name: 'Tariffs',
        code: '5040',
        category: 'COGS',
        value: 518329,
        percentage: ((518329 / totalRevenue5Y) * 100).toFixed(1)
      },
      {
        name: 'Storage 3PL',
        code: '5032',
        category: 'Marketplace Expenses',
        value: 258777,
        percentage: ((258777 / totalRevenue5Y) * 100).toFixed(1)
      },
      {
        name: 'Refunds',
        code: '4010',
        category: 'Marketplace Expenses',
        value: 252230,
        percentage: ((252230 / totalRevenue5Y) * 100).toFixed(1)
      },
      {
        name: 'Contract Salaries',
        code: '5120',
        category: 'Operating Expense',
        value: 235996,
        percentage: ((235996 / totalRevenue5Y) * 100).toFixed(1)
      },
      {
        name: 'Ocean Freight',
        code: '5030',
        category: 'COGS',
        value: 228549,
        percentage: ((228549 / totalRevenue5Y) * 100).toFixed(1)
      }
    ]
    
    // Revenue vs Profit Efficiency
    const efficiencyData = years.map(year => ({
      year,
      revenue: yearlyData[year].totalRevenue,
      profit: yearlyData[year].netIncome,
      efficiency: yearlyData[year].totalRevenue > 0 ? 
        ((yearlyData[year].netIncome / yearlyData[year].totalRevenue) * 100) : 0
    }))
    
    // Calculate averages
    const avgGrossMargin = years.length > 0 ? 
      marginData.reduce((sum, d) => sum + d.grossMargin, 0) / years.length : 0
    const avgNetMargin = years.length > 0 ? 
      marginData.reduce((sum, d) => sum + d.netMargin, 0) / years.length : 0
    
    return {
      performanceData,
      marginData,
      cashPositionData,
      totalExpenseBreakdown,
      efficiencyData,
      summary: {
        totalRevenue5Y,
        totalProfit5Y,
        avgRevenue: totalRevenue5Y / years.length,
        avgProfit: totalProfit5Y / years.length,
        avgGrossMargin,
        avgNetMargin,
        bestYear: performanceData.reduce((best, curr) => 
          curr.netIncome > (best?.netIncome || 0) ? curr : best, performanceData[0]),
        totalCOGS5Y,
        totalExpenses5Y: totalCOGS5Y + totalAmazon5Y + totalOperating5Y
      }
    }
  }, [yearlyData, monthlyGLData])
  
  const exportToPDF = async () => {
    if (!chartsRef.current) return
    
    setExporting(true)
    
    try {
      // Wait for charts to render completely
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Hide buttons
      const buttons = chartsRef.current.querySelectorAll('button')
      buttons.forEach(btn => (btn as HTMLElement).style.display = 'none')
      
      // Create PDF
      const pdf = new jsPDF('landscape', 'pt', 'letter')
      const pageWidth = pdf.internal.pageSize.width
      const pageHeight = pdf.internal.pageSize.height
      
      // Add title
      pdf.setFontSize(20)
      pdf.text('6-Year Financial Dashboard', pageWidth / 2, 40, { align: 'center' })
      pdf.setFontSize(14)
      pdf.text('2025-2030 Performance Overview', pageWidth / 2, 60, { align: 'center' })
      
      // Get all chart sections
      const chartSections = chartsRef.current.querySelectorAll('.chart-section')
      let yPosition = 90
      
      for (let i = 0; i < chartSections.length; i++) {
        const section = chartSections[i] as HTMLElement
        
        // Capture chart as is
        const canvas = await html2canvas(section, {
          scale: 1.5,
          backgroundColor: '#ffffff',
          logging: false
        })
        
        // Simple scaling - just fit to page width
        const imgWidth = pageWidth - 100
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        
        // Check if need new page
        if (yPosition + imgHeight > pageHeight - 50) {
          pdf.addPage()
          yPosition = 40
        }
        
        // Add image
        const imgData = canvas.toDataURL('image/png')
        pdf.addImage(imgData, 'PNG', 50, yPosition, imgWidth, imgHeight)
        
        yPosition += imgHeight + 30
      }
      
      // Restore buttons
      buttons.forEach(btn => (btn as HTMLElement).style.display = '')
      
      // Convert PDF to base64 and save via API
      const pdfBase64 = pdf.output('datauristring').split(',')[1]
      
      try {
        const response = await fetch('/api/reports/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: pdfBase64,
            filename: 'financial-charts.pdf',
            format: 'pdf',
            strategyName: 'E2 Conservative'
          })
        })
        
        const result = await response.json()
        if (result.success) {
          // Show success notification with green toast
          const toast = document.createElement('div')
          toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-in fade-in slide-in-from-bottom-5'
          toast.textContent = `Charts saved to: ${result.message}`
          document.body.appendChild(toast)
          
          setTimeout(() => {
            toast.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-5')
            setTimeout(() => document.body.removeChild(toast), 200)
          }, 3000)
        } else {
          // Fallback to download if API fails
          pdf.save('financial-charts.pdf')
        }
      } catch (saveError) {
        console.error('Error saving PDF to server:', saveError)
        // Fallback to download
        pdf.save('financial-charts.pdf')
      }
      
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Failed to export PDF. Please try again.')
    } finally {
      setExporting(false)
    }
  }
  
  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toFixed(0)}`
  }
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 shadow-xl rounded-lg border">
          <p className="text-sm font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between gap-4">
              <span className="text-sm" style={{ color: entry.color }}>{entry.name}:</span>
              <span className="text-sm font-medium">
                {entry.name?.toLowerCase().includes('margin') || entry.name?.toLowerCase().includes('growth') || entry.name?.toLowerCase().includes('ratio') ? 
                  `${entry.value.toFixed(1)}%` : 
                  `$${entry.value.toLocaleString()}${typeof entry.value === 'number' && entry.value >= 1000 ? '' : 'K'}`}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <DashboardLayout>
      <div className="p-8 bg-white min-h-screen">
        {/* Header */}
        <div className="mb-8 pb-6 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Financial Analytics</h1>
              <p className="text-gray-500 mt-1">Key Performance Metrics 2025-2030</p>
            </div>
            <Button onClick={exportToPDF} variant="outline" disabled={exporting}>
              <Printer className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export PDF'}
            </Button>
          </div>
        </div>
        
        {loading ? (
          <PageSkeleton variant="chart" />
        ) : (
          <div className="space-y-8" ref={chartsRef}>
            {/* Revenue & Profit Performance */}
            <div className="chart-section">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">Revenue & Profitability Trend</h2>
              <Card>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={450}>
                    <ComposedChart data={chartData.performanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(1)}M` : `$${v}K`} />
                      <Legend />
                      <Bar dataKey="revenue" fill={COLORS.revenue} name="Revenue">
                        <LabelList dataKey="revenue" position="top" formatter={(v: number) => v >= 1000 ? `$${(v/1000).toFixed(1)}M` : `$${v}K`} />
                      </Bar>
                      <Bar dataKey="grossProfit" fill={COLORS.gross} name="Gross Profit">
                        <LabelList dataKey="grossProfit" position="top" formatter={(v: number) => v >= 1000 ? `$${(v/1000).toFixed(1)}M` : `$${v}K`} />
                      </Bar>
                      <Bar dataKey="netIncome" fill={COLORS.profit} name="Net Income">
                        <LabelList dataKey="netIncome" position="top" formatter={(v: number) => v >= 1000 ? `$${(v/1000).toFixed(1)}M` : `$${v}K`} />
                      </Bar>
                      <Line type="monotone" dataKey="expenses" stroke={COLORS.operating} 
                            strokeWidth={3} dot={{ r: 6 }} name="Total Expenses">
                        <LabelList dataKey="expenses" position="top" formatter={(v: number) => v >= 1000 ? `$${(v/1000).toFixed(1)}M` : `$${v}K`} offset={10} />
                      </Line>
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            
            
            {/* Top Expense Categories - Total */}
            <div className="chart-section">
              <h2 className="text-xl font-semibold mb-4">Total Expenses by Category (2025-2030)</h2>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center">
                    <div className="w-1/2">
                      <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                          <Pie
                            data={chartData.totalExpenseBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={140}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {chartData.totalExpenseBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS.palette[index % COLORS.palette.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-1/2 pl-8">
                      <div className="space-y-3">
                        <div className="text-sm text-gray-600 mb-4">
                          Top {chartData.totalExpenseBreakdown.length} expenses over 6 years
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg mb-4">
                          <div className="text-sm font-medium text-blue-900">
                            {(() => {
                              // Calculate US economic activity percentage
                              const totalExpenses = chartData.totalExpenseBreakdown.reduce((sum, item) => sum + item.value, 0)
                              // Manufacturing (5020) and Ocean Freight (5030) are outside US
                              const nonUSExpenses = chartData.totalExpenseBreakdown
                                .filter(item => item.code === '5020' || item.code === '5030')
                                .reduce((sum, item) => sum + item.value, 0)
                              const usExpenses = totalExpenses - nonUSExpenses
                              const usPercentage = ((usExpenses / totalExpenses) * 100).toFixed(1)
                              return `💡 ${usPercentage}% of expenses generate economic activity inside the US`
                            })()}
                          </div>
                          <div className="text-xs text-blue-700 mt-1">
                            Only Manufacturing and Ocean Freight are outsourced internationally
                          </div>
                        </div>
                        {chartData.totalExpenseBreakdown.map((item, index) => (
                          <div key={item.code || item.name} className="flex justify-between items-center">
                            <div className="flex items-center">
                              <div 
                                className="w-4 h-4 rounded mr-3" 
                                style={{ backgroundColor: COLORS.palette[index % COLORS.palette.length] }}
                              />
                              <div>
                                <span className="text-base font-medium">{item.name}</span>
                                <span className="text-xs text-gray-500 ml-2">({item.category})</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-semibold">{formatCurrency(item.value)}</span>
                              <span className="text-gray-500 ml-2">({item.percentage}% of revenue)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            
            {/* Cash Flow Progression */}
            <div className="chart-section">
              <h2 className="text-xl font-semibold mb-4">Cash Balance Over Time</h2>
              <Card>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={monthlyGLData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis 
                        dataKey="month" 
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval={5} // Show every 6th month
                      />
                      <YAxis tickFormatter={(v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${Math.round(v/1000)}K`} />
                      <Tooltip 
                        formatter={(value: number, name: string) => {
                          if (name === 'Change') {
                            const sign = value >= 0 ? '+' : ''
                            return `${sign}${formatCurrency(value)}`
                          }
                          return formatCurrency(value)
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="cashBalance" 
                        stroke="#3b82f6" 
                        strokeWidth={2} 
                        dot={false}
                        name="Cash Balance" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            
          </div>
        )}
      </div>
      
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background: white;
          }
          @page {
            size: letter landscape;
            margin: 0.5in;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </DashboardLayout>
  )
}
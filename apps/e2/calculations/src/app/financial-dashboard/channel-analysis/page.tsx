'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface ChannelData {
  period: string
  Amazon: number
  Walmart: number
  Retail: number
  Total: number
}

interface GLEntry {
  date: string
  account: string
  accountCategory: string
  description: string
  debit: number
  credit: number
  metadata?: any
}

export default function ChannelAnalysisPage() {
  const [channelData, setChannelData] = useState<ChannelData[]>([])
  const [yearlyData, setYearlyData] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState(2026) // Start with 2026 as multi-channel begins then
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchChannelData()
  }, [selectedYear])

  const fetchChannelData = async () => {
    setLoading(true)
    try {
      // Fetch GL entries to calculate channel revenue
      const glRes = await fetch('/api/gl')
      const glData = await glRes.json()
      
      // Filter revenue entries (accounts 4000, 4001, 4002)
      const revenueEntries = glData.filter((entry: GLEntry) => 
        ['4000', '4001', '4002'].includes(entry.account) && entry.credit > 0
      )
      
      // Process monthly channel data
      const monthlyRevenue: Record<string, ChannelData> = {}
      const yearlyRevenue: Record<number, { Amazon: number, Walmart: number, Retail: number }> = {}
      
      revenueEntries.forEach((entry: GLEntry) => {
        const date = new Date(entry.date)
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        const monthKey = `${year}-${month.toString().padStart(2, '0')}`
        
        if (!monthlyRevenue[monthKey]) {
          monthlyRevenue[monthKey] = {
            period: monthKey,
            Amazon: 0,
            Walmart: 0,
            Retail: 0,
            Total: 0
          }
        }
        
        if (!yearlyRevenue[year]) {
          yearlyRevenue[year] = { Amazon: 0, Walmart: 0, Retail: 0 }
        }
        
        const amount = entry.credit
        
        if (entry.account === '4000') {
          monthlyRevenue[monthKey].Amazon += amount
          yearlyRevenue[year].Amazon += amount
        } else if (entry.account === '4001') {
          monthlyRevenue[monthKey].Walmart += amount
          yearlyRevenue[year].Walmart += amount
        } else if (entry.account === '4002') {
          monthlyRevenue[monthKey].Retail += amount
          yearlyRevenue[year].Retail += amount
        }
        
        monthlyRevenue[monthKey].Total += amount
      })
      
      // Filter data for selected year
      const yearMonths = Object.keys(monthlyRevenue)
        .filter(key => key.startsWith(selectedYear.toString()))
        .sort()
      
      const chartData = yearMonths.map(month => monthlyRevenue[month])
      setChannelData(chartData)
      
      // Prepare yearly comparison data
      const yearlyChartData = Object.entries(yearlyRevenue).map(([year, data]) => ({
        year: parseInt(year),
        ...data,
        Total: data.Amazon + data.Walmart + data.Retail
      }))
      setYearlyData(yearlyChartData)
      
    } catch (error) {
      console.error('Error fetching channel data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate channel metrics
  const calculateChannelMetrics = () => {
    const totalRevenue = channelData.reduce((sum, d) => sum + d.Total, 0)
    const amazonRevenue = channelData.reduce((sum, d) => sum + d.Amazon, 0)
    const walmartRevenue = channelData.reduce((sum, d) => sum + d.Walmart, 0)
    const retailRevenue = channelData.reduce((sum, d) => sum + d.Retail, 0)
    
    return {
      total: totalRevenue,
      channels: [
        { name: 'Amazon', value: amazonRevenue, percent: (amazonRevenue / totalRevenue) * 100 },
        { name: 'Walmart', value: walmartRevenue, percent: (walmartRevenue / totalRevenue) * 100 },
        { name: 'Retail', value: retailRevenue, percent: (retailRevenue / totalRevenue) * 100 }
      ]
    }
  }

  const metrics = calculateChannelMetrics()
  
  // Calculate growth rates
  const calculateGrowthRate = (channel: 'Amazon' | 'Walmart' | 'Retail') => {
    if (channelData.length < 2) return 0
    const firstMonth = channelData[0][channel]
    const lastMonth = channelData[channelData.length - 1][channel]
    if (firstMonth === 0) return 0
    return ((lastMonth - firstMonth) / firstMonth) * 100
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28']

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Channel Analysis Dashboard</h1>
        <select 
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="px-4 py-2 border rounded"
        >
          {[2025, 2026, 2027, 2028, 2029, 2030].map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Channel Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.channels.map((channel, index) => (
          <Card key={channel.name}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{channel.name} Channel</CardTitle>
              <CardDescription>
                {formatPercent(channel.percent / 100)} of total revenue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(channel.value)}</div>
              <div className="text-sm text-gray-500 mt-2">
                Growth: {calculateGrowthRate(channel.name as any).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Channel Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Channel Revenue Trend ({selectedYear})</CardTitle>
          <CardDescription>Revenue breakdown by sales channel</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={channelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Area type="monotone" dataKey="Amazon" stackId="1" stroke="#0088FE" fill="#0088FE" />
              <Area type="monotone" dataKey="Walmart" stackId="1" stroke="#00C49F" fill="#00C49F" />
              <Area type="monotone" dataKey="Retail" stackId="1" stroke="#FFBB28" fill="#FFBB28" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Channel Mix Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Channel Revenue Mix ({selectedYear})</CardTitle>
            <CardDescription>Percentage breakdown by channel</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics.channels}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${percent.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {metrics.channels.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Yearly Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Year-over-Year Channel Growth</CardTitle>
            <CardDescription>Annual revenue by channel</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={yearlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="Amazon" stroke="#0088FE" strokeWidth={2} />
                <Line type="monotone" dataKey="Walmart" stroke="#00C49F" strokeWidth={2} />
                <Line type="monotone" dataKey="Retail" stroke="#FFBB28" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Channel Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Month</th>
                  <th className="text-right py-2">Amazon</th>
                  <th className="text-right py-2">Walmart</th>
                  <th className="text-right py-2">Retail</th>
                  <th className="text-right py-2">Total</th>
                  <th className="text-right py-2">Amazon %</th>
                  <th className="text-right py-2">Walmart %</th>
                  <th className="text-right py-2">Retail %</th>
                </tr>
              </thead>
              <tbody>
                {channelData.map(row => (
                  <tr key={row.period} className="border-b">
                    <td className="py-2">{row.period}</td>
                    <td className="text-right">{formatCurrency(row.Amazon)}</td>
                    <td className="text-right">{formatCurrency(row.Walmart)}</td>
                    <td className="text-right">{formatCurrency(row.Retail)}</td>
                    <td className="text-right font-semibold">{formatCurrency(row.Total)}</td>
                    <td className="text-right">{formatPercent((row.Amazon / row.Total))}</td>
                    <td className="text-right">{formatPercent((row.Walmart / row.Total))}</td>
                    <td className="text-right">{formatPercent((row.Retail / row.Total))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-semibold">
                <tr>
                  <td className="py-2">Total</td>
                  <td className="text-right">{formatCurrency(metrics.channels[0].value)}</td>
                  <td className="text-right">{formatCurrency(metrics.channels[1].value)}</td>
                  <td className="text-right">{formatCurrency(metrics.channels[2].value)}</td>
                  <td className="text-right">{formatCurrency(metrics.total)}</td>
                  <td className="text-right">{formatPercent(metrics.channels[0].percent / 100)}</td>
                  <td className="text-right">{formatPercent(metrics.channels[1].percent / 100)}</td>
                  <td className="text-right">{formatPercent(metrics.channels[2].percent / 100)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface ProductData {
  sku: string
  name: string
  amazonPrice: number
  manufacturingCost: number
  freightCost: number
  warehouseCost: number
  tariffRate: number
  refundRate: number
  // Calculated fields
  landedCost: number
  amazonFees: number
  grossMargin: number
  grossMarginPercent: number
  roi: number
}

interface SalesData {
  week: number
  year: number
  quarter: number
  sku: string
  units: number
}

export default function UnitEconomicsPage() {
  const [products, setProducts] = useState<ProductData[]>([])
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [selectedYear, setSelectedYear] = useState(2025)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [selectedYear])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch products
      const productsRes = await fetch('/api/products')
      const productsData = await productsRes.json()
      
      // Calculate unit economics for each product
      const processedProducts = productsData.map((product: any) => {
        const landedCost = product.manufacturingCost + product.freightCost + 
                          (product.manufacturingCost * product.tariffRate) + 
                          product.warehouseCost
        
        // Amazon fees: 15% referral + FBA fees (estimated at $3.50 average)
        const amazonReferralFee = product.amazonPrice * 0.15
        const amazonFBAFee = 3.50 // Average FBA fee
        const amazonFees = amazonReferralFee + amazonFBAFee
        
        const grossProfit = product.amazonPrice - landedCost - amazonFees
        const grossMarginPercent = (grossProfit / product.amazonPrice) * 100
        const roi = ((grossProfit / landedCost) * 100)
        
        return {
          ...product,
          landedCost,
          amazonFees,
          grossMargin: grossProfit,
          grossMarginPercent,
          roi
        }
      })
      
      setProducts(processedProducts)
      
      // Fetch sales data
      const salesRes = await fetch(`/api/unit-sales?year=${selectedYear}`)
      const sales = await salesRes.json()
      setSalesData(sales.unitSales || sales)
      
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate SKU performance metrics
  const skuPerformance = products.map(product => {
    const productSales = salesData.filter(s => s.sku === product.sku)
    const totalUnits = productSales.reduce((sum, sale) => sum + sale.units, 0)
    const revenue = totalUnits * product.amazonPrice
    const grossProfit = totalUnits * product.grossMargin
    
    return {
      sku: product.sku,
      name: product.name,
      units: totalUnits,
      revenue,
      grossProfit,
      margin: product.grossMarginPercent,
      roi: product.roi,
      unitEconomics: {
        price: product.amazonPrice,
        landed: product.landedCost,
        fees: product.amazonFees,
        profit: product.grossMargin
      }
    }
  })

  // Prepare chart data
  const marginComparisonData = products.map(p => ({
    sku: p.sku,
    'Gross Margin %': p.grossMarginPercent,
    'ROI %': p.roi / 10 // Scale down for better visualization
  }))

  const costBreakdownData = products.map(p => ({
    sku: p.sku,
    'Manufacturing': p.manufacturingCost,
    'Freight': p.freightCost,
    'Tariff': p.manufacturingCost * p.tariffRate,
    'Warehouse': p.warehouseCost,
    'Amazon Fees': p.amazonFees
  }))

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Unit Economics Dashboard</h1>
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

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {skuPerformance.map(sku => (
          <Card key={sku.sku}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{sku.sku}</CardTitle>
              <CardDescription className="text-xs">{sku.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold">{formatCurrency(sku.unitEconomics.price)}</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Landed Cost:</span>
                  <span>{formatCurrency(sku.unitEconomics.landed)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amazon Fees:</span>
                  <span>{formatCurrency(sku.unitEconomics.fees)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Gross Profit:</span>
                  <span className="text-green-600">{formatCurrency(sku.unitEconomics.profit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Margin:</span>
                  <span>{formatPercent(sku.margin / 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ROI:</span>
                  <span className="text-blue-600">{formatPercent(sku.roi / 100)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Margin Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Margin & ROI Comparison</CardTitle>
          <CardDescription>Gross margin percentage and ROI by SKU</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={marginComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sku" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Legend />
              <Bar dataKey="Gross Margin %" fill="#8884d8" />
              <Bar dataKey="ROI %" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cost Breakdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown by SKU</CardTitle>
          <CardDescription>All cost components per unit</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costBreakdownData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sku" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="Manufacturing" stackId="a" fill="#0088FE" />
              <Bar dataKey="Freight" stackId="a" fill="#00C49F" />
              <Bar dataKey="Tariff" stackId="a" fill="#FFBB28" />
              <Bar dataKey="Warehouse" stackId="a" fill="#FF8042" />
              <Bar dataKey="Amazon Fees" stackId="a" fill="#8884D8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>SKU Performance Summary ({selectedYear})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">SKU</th>
                  <th className="text-right py-2">Units Sold</th>
                  <th className="text-right py-2">Revenue</th>
                  <th className="text-right py-2">Gross Profit</th>
                  <th className="text-right py-2">Margin %</th>
                  <th className="text-right py-2">ROI %</th>
                </tr>
              </thead>
              <tbody>
                {skuPerformance.map(sku => (
                  <tr key={sku.sku} className="border-b">
                    <td className="py-2">{sku.sku}</td>
                    <td className="text-right">{sku.units.toLocaleString()}</td>
                    <td className="text-right">{formatCurrency(sku.revenue)}</td>
                    <td className="text-right">{formatCurrency(sku.grossProfit)}</td>
                    <td className="text-right">{formatPercent(sku.margin / 100)}</td>
                    <td className="text-right">{formatPercent(sku.roi / 100)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-semibold">
                <tr>
                  <td className="py-2">Total</td>
                  <td className="text-right">{skuPerformance.reduce((sum, s) => sum + s.units, 0).toLocaleString()}</td>
                  <td className="text-right">{formatCurrency(skuPerformance.reduce((sum, s) => sum + s.revenue, 0))}</td>
                  <td className="text-right">{formatCurrency(skuPerformance.reduce((sum, s) => sum + s.grossProfit, 0))}</td>
                  <td className="text-right">-</td>
                  <td className="text-right">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
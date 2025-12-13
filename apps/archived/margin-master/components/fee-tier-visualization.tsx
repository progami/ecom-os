'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface FeeTierVisualizationProps {
  data: Array<{
    sizeTierName: string
    marketplace: string
    currency: string
    fee: number
    rateWeightLowerBoundKg: number
    rateWeightUpperBoundKg: number
    lengthLimitCm?: number
    widthLimitCm?: number
    heightLimitCm?: number
  }>
  selectedCountry?: string | null
}

// Define the order of size tiers
const SIZE_TIER_ORDER = [
  'Small Envelope',
  'Standard Envelope',
  'Large Envelope',
  'Standard Small',
  'Standard',
  'Standard Regular',
  'Standard Large',
  'Standard X-Large',
  'Small Oversize',
  'Oversize',
  'Standard Oversize',
  'Large Oversize',
  'Special Oversize',
]

export function FeeTierVisualization({ data, selectedCountry }: FeeTierVisualizationProps) {
  const processedData = useMemo(() => {
    // Filter by country if selected
    let filtered = selectedCountry 
      ? data.filter(item => item.marketplace === selectedCountry)
      : data

    // Group by size tier and get average fees
    const tierAverages = filtered.reduce((acc, item) => {
      if (!acc[item.sizeTierName]) {
        acc[item.sizeTierName] = {
          tier: item.sizeTierName,
          totalFee: 0,
          count: 0,
          minFee: Infinity,
          maxFee: -Infinity,
          dimensions: {
            length: item.lengthLimitCm || 0,
            width: item.widthLimitCm || 0,
            height: item.heightLimitCm || 0,
          }
        }
      }
      
      acc[item.sizeTierName].totalFee += Number(item.fee)
      acc[item.sizeTierName].count += 1
      acc[item.sizeTierName].minFee = Math.min(acc[item.sizeTierName].minFee, Number(item.fee))
      acc[item.sizeTierName].maxFee = Math.max(acc[item.sizeTierName].maxFee, Number(item.fee))
      
      return acc
    }, {} as Record<string, any>)

    // Convert to array and calculate averages
    const tierData = Object.values(tierAverages)
      .map((tier: any) => ({
        ...tier,
        avgFee: tier.totalFee / tier.count,
        feeRange: tier.maxFee - tier.minFee,
      }))
      .sort((a, b) => {
        const indexA = SIZE_TIER_ORDER.indexOf(a.tier)
        const indexB = SIZE_TIER_ORDER.indexOf(b.tier)
        if (indexA === -1 && indexB === -1) return a.tier.localeCompare(b.tier)
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })

    // Create weight progression data
    const weightProgression = filtered
      .filter(item => item.sizeTierName.includes('Standard'))
      .sort((a, b) => a.rateWeightLowerBoundKg - b.rateWeightLowerBoundKg)
      .map(item => ({
        weight: item.rateWeightLowerBoundKg,
        fee: Number(item.fee),
        tier: item.sizeTierName,
      }))

    return {
      tierData,
      weightProgression,
      totalEntries: filtered.length,
      uniqueTiers: tierData.length,
    }
  }, [data, selectedCountry])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee Structure Visualization</CardTitle>
        <CardDescription>
          Visual analysis of Amazon FBA fee tiers and progressions
          {selectedCountry && ` for ${selectedCountry}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tier-comparison" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="tier-comparison">Tier Comparison</TabsTrigger>
            <TabsTrigger value="fee-range">Fee Ranges</TabsTrigger>
            <TabsTrigger value="weight-progression">Weight Progression</TabsTrigger>
          </TabsList>

          <TabsContent value="tier-comparison" className="space-y-4">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processedData.tierData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="tier" 
                    angle={-45} 
                    textAnchor="end" 
                    height={120}
                    interval={0}
                  />
                  <YAxis label={{ value: 'Average Fee', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="avgFee" 
                    fill="#8884d8" 
                    name="Average Fee"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total fee entries:</span>
                <span className="ml-2 font-semibold">{processedData.totalEntries}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Unique size tiers:</span>
                <span className="ml-2 font-semibold">{processedData.uniqueTiers}</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fee-range" className="space-y-4">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processedData.tierData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="tier" 
                    angle={-45} 
                    textAnchor="end" 
                    height={120}
                    interval={0}
                  />
                  <YAxis label={{ value: 'Fee Amount', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="minFee" fill="#22c55e" name="Min Fee" />
                  <Bar dataKey="avgFee" fill="#3b82f6" name="Avg Fee" />
                  <Bar dataKey="maxFee" fill="#ef4444" name="Max Fee" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-sm text-muted-foreground">
              Shows the minimum, average, and maximum fees for each size tier across different weight bands.
            </div>
          </TabsContent>

          <TabsContent value="weight-progression" className="space-y-4">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={processedData.weightProgression}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="weight" 
                    label={{ value: 'Weight (kg)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis label={{ value: 'Fee Amount', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area 
                    type="stepAfter" 
                    dataKey="fee" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.6}
                    name="FBA Fee"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="text-sm text-muted-foreground">
              Shows how FBA fees increase with product weight for standard-size items.
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  BarChart,
  Bar,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface CombinationData {
  id: string
  packSize: number
  length: number
  width: number
  height: number
  weight: number
  salePrice: number
  sizeTier: string
  fbaFee: number
  referralFee: number
  netMarginPercent: number
  roi: number
  tierEfficiency: number
  opportunity?: string | null
  meetsTargetMargin?: boolean
}

interface FeeEfficiencyGraphProps {
  data: CombinationData[]
}

// Size tier colors for consistency
const SIZE_TIER_COLORS: Record<string, string> = {
  'Standard Envelope': '#22c55e',
  'Standard Small': '#3b82f6',
  'Standard Regular': '#8b5cf6',
  'Standard Large': '#f59e0b',
  'Small Oversize': '#ef4444',
  'Standard Oversize': '#dc2626',
  'Oversize': '#991b1b',
}

export function FeeEfficiencyGraph({ data }: FeeEfficiencyGraphProps) {
  // Process data for different views
  const processedData = useMemo(() => {
    // Sort by total dimensions for tier progression view
    const sortedBySize = [...data].sort((a, b) => {
      const sizeA = a.length + a.width + a.height
      const sizeB = b.length + b.width + b.height
      return sizeA - sizeB
    })

    // Group by size tier for tier analysis
    const tierGroups = data.reduce((acc, item) => {
      if (!acc[item.sizeTier]) {
        acc[item.sizeTier] = []
      }
      acc[item.sizeTier].push(item)
      return acc
    }, {} as Record<string, CombinationData[]>)

    // Calculate tier statistics
    const tierStats = Object.entries(tierGroups).map(([tier, items]) => ({
      tier,
      avgFbaFee: items.reduce((sum, item) => sum + item.fbaFee, 0) / items.length,
      avgMargin: items.reduce((sum, item) => sum + item.netMarginPercent, 0) / items.length,
      avgEfficiency: items.reduce((sum, item) => sum + item.tierEfficiency, 0) / items.length,
      count: items.length,
      minFee: Math.min(...items.map(item => item.fbaFee)),
      maxFee: Math.max(...items.map(item => item.fbaFee)),
    }))

    // Find tier boundaries (where tier changes)
    const tierBoundaries: any[] = []
    for (let i = 1; i < sortedBySize.length; i++) {
      if (sortedBySize[i].sizeTier !== sortedBySize[i - 1].sizeTier) {
        const totalDim = sortedBySize[i].length + sortedBySize[i].width + sortedBySize[i].height
        tierBoundaries.push({
          dimension: totalDim,
          fromTier: sortedBySize[i - 1].sizeTier,
          toTier: sortedBySize[i].sizeTier,
          feeJump: sortedBySize[i].fbaFee - sortedBySize[i - 1].fbaFee,
        })
      }
    }

    return {
      sortedBySize,
      tierStats,
      tierBoundaries,
    }
  }, [data])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold">{data.sizeTier}</p>
          <p className="text-sm">Dimensions: {data.length}×{data.width}×{data.height} cm</p>
          <p className="text-sm">Weight: {data.weight}g</p>
          <p className="text-sm">FBA Fee: ${data.fbaFee.toFixed(2)}</p>
          <p className="text-sm">Margin: {data.netMarginPercent.toFixed(1)}%</p>
          <p className="text-sm">Efficiency: {(data.tierEfficiency * 100).toFixed(0)}%</p>
          {data.opportunity && (
            <p className="text-sm font-semibold text-primary mt-1">{data.opportunity}</p>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>FBA Fee Efficiency Analysis</CardTitle>
        <CardDescription>
          Visualize how fees relate to product dimensions and identify optimization opportunities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tier-progression" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="tier-progression">Tier Progression</TabsTrigger>
            <TabsTrigger value="efficiency-scatter">Efficiency Map</TabsTrigger>
            <TabsTrigger value="tier-analysis">Tier Analysis</TabsTrigger>
            <TabsTrigger value="margin-vs-fee">Margin vs Fee</TabsTrigger>
          </TabsList>

          <TabsContent value="tier-progression" className="space-y-4">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={processedData.sortedBySize}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey={(item) => item.length + item.width + item.height}
                    label={{ value: 'Total Dimensions (cm)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    label={{ value: 'FBA Fee ($)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  
                  {/* Add vertical lines for tier boundaries */}
                  {processedData.tierBoundaries.map((boundary, idx) => (
                    <ReferenceLine
                      key={idx}
                      x={boundary.dimension}
                      stroke="#666"
                      strokeDasharray="5 5"
                      label={{
                        value: `→ ${boundary.toTier}`,
                        position: 'top',
                        fontSize: 10,
                      }}
                    />
                  ))}
                  
                  <Line
                    type="stepAfter"
                    dataKey="fbaFee"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props
                      const color = SIZE_TIER_COLORS[payload.sizeTier] || '#8884d8'
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={payload.opportunity ? 6 : 3}
                          fill={color}
                          stroke={payload.opportunity ? '#000' : 'none'}
                          strokeWidth={payload.opportunity ? 2 : 0}
                        />
                      )
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-sm text-muted-foreground">
              Shows how FBA fees increase with product dimensions. Vertical lines indicate size tier boundaries.
              Highlighted dots represent optimization opportunities.
            </div>
          </TabsContent>

          <TabsContent value="efficiency-scatter" className="space-y-4">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="tierEfficiency"
                    domain={[0, 1]}
                    tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                    label={{ value: 'Tier Efficiency', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="netMarginPercent"
                    label={{ value: 'Net Margin %', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  
                  <Scatter
                    name="Combinations"
                    data={data}
                    fill="#8884d8"
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={SIZE_TIER_COLORS[entry.sizeTier] || '#8884d8'}
                      />
                    ))}
                  </Scatter>
                  
                  {/* Add quadrant lines */}
                  <ReferenceLine x={0.7} stroke="#666" strokeDasharray="3 3" />
                  <ReferenceLine y={20} stroke="#666" strokeDasharray="3 3" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="text-sm text-muted-foreground">
              Higher tier efficiency means the product dimensions are close to the tier boundary (good utilization).
              The top-right quadrant shows high-margin, efficient combinations.
            </div>
          </TabsContent>

          <TabsContent value="tier-analysis" className="space-y-4">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processedData.tierStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tier" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  
                  <Bar dataKey="avgFbaFee" fill="#8884d8" name="Avg FBA Fee ($)" />
                  <Bar dataKey="avgMargin" fill="#82ca9d" name="Avg Margin (%)" />
                  <Bar dataKey="avgEfficiency" fill="#ffc658" name="Avg Efficiency" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              {processedData.tierStats.map((tier) => (
                <div key={tier.tier} className="text-sm">
                  <div className="font-semibold">{tier.tier}</div>
                  <div className="text-muted-foreground">
                    {tier.count} combinations
                    <br />
                    Fee range: ${tier.minFee.toFixed(2)} - ${tier.maxFee.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="margin-vs-fee" className="space-y-4">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="fbaFee"
                    label={{ value: 'FBA Fee ($)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="netMarginPercent"
                    label={{ value: 'Net Margin %', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  
                  <Scatter
                    name="Products"
                    data={data}
                    fill="#8884d8"
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.meetsTargetMargin === false ? '#ef4444' :
                          entry.opportunity === 'sweet-spot' ? '#22c55e' :
                          entry.opportunity === 'tier-boundary' ? '#f59e0b' :
                          entry.opportunity === 'high-margin' ? '#3b82f6' :
                          '#94a3b8'
                        }
                        fillOpacity={entry.meetsTargetMargin === false ? 0.4 : 0.8}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
                <span>Sweet Spot</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                <span>Tier Boundary</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
                <span>High Margin</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#94a3b8]" />
                <span>Standard</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ef4444] opacity-40" />
                <span>Below Target</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
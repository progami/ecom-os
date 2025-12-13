'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Download, 
  TrendingUp, 
  DollarSign, 
  Package,
  Zap,
  Trophy,
  Target,
  AlertCircle,
  ArrowUpRight,
  Loader2,
  Calculator
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FeeEfficiencyGraph } from '@/components/fee-efficiency-graph'

interface BatchData {
  batch: {
    id: string
    name: string
    status: string
    totalCombinations: number
    completedCombinations: number
    summary: {
      totalProcessed: number
      successful: number
      failed: number
      avgMargin: number
      avgROI: number
      topMargin: number
      topROI: number
      sizeTierDistribution: Record<string, number>
      opportunities: Array<{ type: string; count: number }>
    }
    createdAt: string
    completedAt: string
  }
  topResults: Array<{
    id: string
    packSize: number
    length: number
    width: number
    height: number
    weight: number
    salePrice: number
    sizeTier: string
    landedCost: number
    fbaFee: number
    referralFee: number
    netMarginPercent: number
    roi: number
    profitPerUnit: number
    tierEfficiency: number
    marginRank: number
    opportunity: string | null
    meetsTargetMargin?: boolean
    materialProfile: { name: string }
    sourcingProfile: { name: string }
  }>
}

function CombinationResultsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const batchId = searchParams.get('batchId')
  
  const [data, setData] = useState<BatchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('opportunities')

  useEffect(() => {
    if (!batchId) {
      setError('No batch ID provided')
      setLoading(false)
      return
    }

    fetchBatchData()
  }, [batchId])

  const fetchBatchData = async () => {
    try {
      const response = await fetch(`/api/combinations/generate?batchId=${batchId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch batch data')
      }
      
      const data = await response.json()
      setData(data)
    } catch (err) {
      console.error('Error fetching batch data:', err)
      setError('Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    // TODO: Implement CSV export
    console.log('Exporting results...')
  }

  const handleLoadToStudio = () => {
    // Navigate to simulation studio with pre-loaded scenarios
    const topScenarios = data?.topResults.slice(0, 10).map(r => ({
      packSize: r.packSize,
      salePrice: r.salePrice,
      materialProfileId: r.materialProfile.name,
      sourcingProfileId: r.sourcingProfile.name,
      dimensions: {
        length: r.length,
        width: r.width,
        height: r.height,
        weight: r.weight
      }
    }))
    
    // Store in session storage and navigate
    if (topScenarios) {
      sessionStorage.setItem('preloadedScenarios', JSON.stringify(topScenarios))
      router.push('/simulation-studio?preload=true')
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'No data available'}</AlertDescription>
        </Alert>
      </DashboardLayout>
    )
  }

  const { batch, topResults } = data
  const opportunities = topResults.filter(r => r.opportunity)
  const sweetSpots = opportunities.filter(r => r.opportunity === 'sweet-spot')
  const tierBoundaries = opportunities.filter(r => r.opportunity === 'tier-boundary')
  const highMargins = opportunities.filter(r => r.opportunity === 'high-margin')

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Combination Results</h1>
            <p className="text-muted-foreground mt-1">
              {batch.name} • Generated {new Date(batch.completedAt).toLocaleString()}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={handleLoadToStudio}>
              <Calculator className="h-4 w-4 mr-2" />
              Load to Studio
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Analyzed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{batch.summary.totalProcessed.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {batch.summary.successful.toLocaleString()} successful
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Avg. Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{batch.summary.avgMargin.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Top: {batch.summary.topMargin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Avg. ROI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{batch.summary.avgROI.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Top: {batch.summary.topROI.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{opportunities.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                High-value combinations
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Opportunities by type */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-green-600" />
                Sweet Spots
              </CardTitle>
              <CardDescription>
                High margin + efficient tier usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {sweetSpots.length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                Tier Boundaries
              </CardTitle>
              <CardDescription>
                Maximizing size tier efficiency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {tierBoundaries.length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                High Margins
              </CardTitle>
              <CardDescription>
                Top profit opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {highMargins.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Color coding legend */}
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-6 text-sm">
              <span className="font-medium">Margin Color Guide:</span>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-600"></div>
                <span>Above 40%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>30-40%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-600"></div>
                <span>Below target</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Unprofitable</span>
              </div>
              <div className="flex items-center gap-2 ml-auto text-muted-foreground">
                <span>Faded rows do not meet target margin</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
            <TabsTrigger value="top-margin">Top Margin</TabsTrigger>
            <TabsTrigger value="top-roi">Top ROI</TabsTrigger>
            <TabsTrigger value="size-analysis">Size Analysis</TabsTrigger>
            <TabsTrigger value="visualization">Visualization</TabsTrigger>
          </TabsList>

          <TabsContent value="opportunities" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>High-Value Opportunities</CardTitle>
                <CardDescription>
                  Combinations identified as sweet spots, tier boundaries, or high margin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opportunity</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Sourcing</TableHead>
                      <TableHead>Pack</TableHead>
                      <TableHead>Dimensions</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Margin</TableHead>
                      <TableHead>ROI</TableHead>
                      <TableHead>Tier Eff.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {opportunities.map((result) => (
                      <TableRow key={result.id} className={result.meetsTargetMargin === false ? 'opacity-50 bg-gray-50' : ''}>
                        <TableCell>
                          <Badge variant={
                            result.opportunity === 'sweet-spot' ? 'default' :
                            result.opportunity === 'tier-boundary' ? 'secondary' :
                            'outline'
                          }>
                            {result.opportunity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{result.materialProfile.name}</TableCell>
                        <TableCell>{result.sourcingProfile.name}</TableCell>
                        <TableCell>{result.packSize}</TableCell>
                        <TableCell className="text-sm">
                          {result.length}×{result.width}×{result.height}cm
                          <br />
                          <span className="text-muted-foreground">{result.weight}g</span>
                        </TableCell>
                        <TableCell>${result.salePrice.toFixed(2)}</TableCell>
                        <TableCell className="font-medium text-right">
                          <span className={
                            result.meetsTargetMargin === false ? 'text-red-500' :
                            result.netMarginPercent > 40 ? 'text-green-600 font-bold' :
                            result.netMarginPercent > 30 ? 'text-green-500' :
                            'text-amber-600'
                          }>
                            {result.netMarginPercent.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{result.roi.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{(result.tierEfficiency * 100).toFixed(0)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top-margin" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Margin Combinations</CardTitle>
                <CardDescription>
                  Highest net margin percentage opportunities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Sourcing</TableHead>
                      <TableHead>Pack</TableHead>
                      <TableHead>Dimensions</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Margin</TableHead>
                      <TableHead>Profit/Unit</TableHead>
                      <TableHead>Size Tier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topResults.slice(0, 20).map((result, index) => (
                      <TableRow key={result.id} className={result.meetsTargetMargin === false ? 'opacity-50 bg-gray-50' : ''}>
                        <TableCell>#{index + 1}</TableCell>
                        <TableCell className="font-medium">{result.materialProfile.name}</TableCell>
                        <TableCell>{result.sourcingProfile.name}</TableCell>
                        <TableCell>{result.packSize}</TableCell>
                        <TableCell className="text-sm">
                          {result.length}×{result.width}×{result.height}cm
                          <br />
                          <span className="text-muted-foreground">{result.weight}g</span>
                        </TableCell>
                        <TableCell>${result.salePrice.toFixed(2)}</TableCell>
                        <TableCell className="font-bold text-right">
                          <span className={
                            result.meetsTargetMargin === false ? 'text-red-500' :
                            result.netMarginPercent > 40 ? 'text-green-600' :
                            result.netMarginPercent > 30 ? 'text-green-500' :
                            'text-amber-600'
                          }>
                            {result.netMarginPercent.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">${result.profitPerUnit.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{result.sizeTier}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top-roi" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top ROI Combinations</CardTitle>
                <CardDescription>
                  Highest return on investment opportunities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Sourcing</TableHead>
                      <TableHead>Pack</TableHead>
                      <TableHead>Dimensions</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>ROI</TableHead>
                      <TableHead>Margin</TableHead>
                      <TableHead>Landed Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...topResults].sort((a, b) => b.roi - a.roi).slice(0, 20).map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">{result.materialProfile.name}</TableCell>
                        <TableCell>{result.sourcingProfile.name}</TableCell>
                        <TableCell>{result.packSize}</TableCell>
                        <TableCell className="text-sm">
                          {result.length}×{result.width}×{result.height}cm
                          <br />
                          <span className="text-muted-foreground">{result.weight}g</span>
                        </TableCell>
                        <TableCell>${result.salePrice.toFixed(2)}</TableCell>
                        <TableCell className="font-bold text-right text-purple-600">
                          {result.roi.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">{result.netMarginPercent.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">${result.landedCost.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="size-analysis" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Size Tier Distribution</CardTitle>
                <CardDescription>
                  Breakdown of combinations by Amazon size tier
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(batch.summary.sizeTierDistribution)
                    .sort(([, a], [, b]) => b - a)
                    .map(([tier, count]) => (
                      <div key={tier} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{tier}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-32 bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full"
                              style={{ 
                                width: `${(count / batch.summary.totalProcessed) * 100}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-20 text-right">
                            {count.toLocaleString()} ({((count / batch.summary.totalProcessed) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="visualization" className="space-y-4">
            <FeeEfficiencyGraph data={data.topResults} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

export default function CombinationResultsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    }>
      <CombinationResultsContent />
    </Suspense>
  )
}
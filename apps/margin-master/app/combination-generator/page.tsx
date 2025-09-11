'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Play, 
  Loader2, 
  TrendingUp, 
  Package, 
  DollarSign,
  AlertCircle,
  CheckCircle,
  Download,
  BarChart3,
  Zap
} from 'lucide-react'
import { useSimulationData } from '@/hooks/use-simulation-data'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Progress } from '@/components/ui/progress'
import { RangeInput } from '@/components/ui/range-input'
import { DimensionsInput } from '@/components/ui/dimensions-input'
// Removed PackSizeInput - using RangeInput for consistency
import { SmartPriceInput } from '@/components/ui/smart-price-input'

interface GenerationParams {
  name: string
  materialProfiles: string[]
  sourcingProfiles: string[]
  packSizes: { min: number; max: number; step: number }
  dimensions: {
    length: { min: number; max: number; step: number }
    width: { min: number; max: number; step: number }
    height: { min: number; max: number; step: number }
  }
  weight: { min: number; max: number; step: number }
  price: { min: number; max: number; step: number }
  targetMarginPercent?: number
}

interface BatchStatus {
  id: string
  name: string
  status: string
  totalCombinations: number
  completedCombinations: number
  summary?: any
}

export default function CombinationGeneratorPage() {
  const router = useRouter()
  const { materials, sourcingProfiles, isLoading: dataLoading } = useSimulationData()
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [currentBatch, setCurrentBatch] = useState<BatchStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Form state
  const [params, setParams] = useState<GenerationParams>({
    name: '',
    materialProfiles: [],
    sourcingProfiles: [],
    packSizes: { min: 1, max: 24, step: 1 },
    dimensions: {
      length: { min: 10, max: 45, step: 5 },
      width: { min: 10, max: 34, step: 5 },
      height: { min: 2, max: 26, step: 2 }
    },
    weight: { min: 100, max: 9000, step: 100 },
    price: { min: 10, max: 100, step: 5 },
    targetMarginPercent: 30
  })

  // Poll batch status
  useEffect(() => {
    if (!currentBatch || currentBatch.status === 'complete' || currentBatch.status === 'failed') {
      return
    }

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/combinations/generate?batchId=${currentBatch.id}`)
        const data = await response.json()
        
        if (data.batch) {
          setCurrentBatch(data.batch)
          
          if (data.batch.status === 'complete') {
            setSuccess(`Generation complete! ${data.batch.totalCombinations} combinations analyzed.`)
            setIsCalculating(false)
          } else if (data.batch.status === 'failed') {
            setError('Generation failed. Please try again.')
            setIsCalculating(false)
          }
        }
      } catch (err) {
        console.error('Failed to poll batch status:', err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [currentBatch])

  const handleGenerate = async () => {
    setError(null)
    setSuccess(null)
    
    // Validate
    if (!params.name) {
      setError('Please enter a name for this generation batch')
      return
    }
    
    if (params.materialProfiles.length === 0) {
      setError('Please select at least one material profile')
      return
    }
    
    if (params.sourcingProfiles.length === 0) {
      setError('Please select at least one sourcing profile')
      return
    }

    setIsGenerating(true)
    
    try {
      // Step 1: Generate combinations
      const genResponse = await fetch('/api/combinations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      })
      
      if (!genResponse.ok) {
        throw new Error('Failed to generate combinations')
      }
      
      const genData = await genResponse.json()
      setCurrentBatch({
        id: genData.batchId,
        name: params.name,
        status: 'generating',
        totalCombinations: genData.totalCombinations,
        completedCombinations: 0
      })
      
      setIsGenerating(false)
      setIsCalculating(true)
      
      // Step 2: Calculate fees for all combinations
      const calcResponse = await fetch('/api/calculate-fees/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: genData.batchId,
          scenarios: genData.combinations,
          marketplace: 'US',
          targetMarginPercent: params.targetMarginPercent || 30
        })
      })
      
      if (!calcResponse.ok) {
        throw new Error('Failed to calculate fees')
      }
      
      const calcData = await calcResponse.json()
      console.log('Calculation complete:', calcData)
      
    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate combinations')
      setIsGenerating(false)
      setIsCalculating(false)
    }
  }

  const handleViewResults = () => {
    if (currentBatch) {
      router.push(`/combination-results?batchId=${currentBatch.id}`)
    }
  }

  const estimatedCombinations = 
    params.materialProfiles.length * 
    params.sourcingProfiles.length * 
    Math.ceil((params.packSizes.max - params.packSizes.min) / params.packSizes.step + 1) *
    Math.ceil((params.dimensions.length.max - params.dimensions.length.min) / params.dimensions.length.step + 1) *
    Math.ceil((params.dimensions.width.max - params.dimensions.width.min) / params.dimensions.width.step + 1) *
    Math.ceil((params.dimensions.height.max - params.dimensions.height.min) / params.dimensions.height.step + 1) *
    Math.ceil((params.weight.max - params.weight.min) / params.weight.step + 1) *
    Math.ceil((params.price.max - params.price.min) / params.price.step + 1)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Combination Generator</h1>
          <p className="text-muted-foreground">
            Automatically generate and analyze thousands of product combinations to find optimal opportunities
          </p>
        </div>

        {/* Status alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Generation progress */}
        {(isGenerating || isCalculating) && currentBatch && (
          <Card>
            <CardHeader>
              <CardTitle>Generation Progress</CardTitle>
              <CardDescription>
                {isGenerating ? 'Generating combinations...' : 'Calculating fees and margins...'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>
                    {currentBatch.completedCombinations} / {currentBatch.totalCombinations}
                  </span>
                </div>
                <Progress 
                  value={(currentBatch.completedCombinations / currentBatch.totalCombinations) * 100} 
                />
              </div>
              
              {currentBatch.status === 'complete' && (
                <Button onClick={handleViewResults} className="w-full">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Results
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Configuration form - Three column layout for better balance */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Column 1: Basic Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Settings</CardTitle>
              <CardDescription>
                Configure batch and select profiles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Batch Name</Label>
                <Input
                  value={params.name}
                  onChange={(e) => setParams({ ...params, name: e.target.value })}
                  placeholder="e.g., Q4 2024 Analysis"
                />
              </div>

              <div className="space-y-2">
                <Label>Material Profiles</Label>
                <SearchableSelect
                  options={materials.map(m => ({ label: m.name, value: m.id }))}
                  value={params.materialProfiles}
                  onChange={(values) => setParams({ 
                    ...params, 
                    materialProfiles: Array.isArray(values) ? values : [values] 
                  })}
                  placeholder="Select materials..."
                  multiple
                />
              </div>

              <div className="space-y-2">
                <Label>Sourcing Profiles</Label>
                <SearchableSelect
                  options={sourcingProfiles.map(s => ({ label: s.name, value: s.id }))}
                  value={params.sourcingProfiles}
                  onChange={(values) => setParams({ 
                    ...params, 
                    sourcingProfiles: Array.isArray(values) ? values : [values] 
                  })}
                  placeholder="Select sourcing..."
                  multiple
                />
              </div>
            </CardContent>
          </Card>

          {/* Column 2: Product Specifications */}
          <Card>
            <CardHeader>
              <CardTitle>Product Specifications</CardTitle>
              <CardDescription>
                Define physical product parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Compact Dimensions Input */}
              <DimensionsInput
                dimensions={params.dimensions}
                onChange={(dimensions) => setParams({ ...params, dimensions })}
              />

              {/* Weight */}
              <RangeInput
                label="Weight"
                min={params.weight.min}
                max={params.weight.max}
                step={params.weight.step}
                onMinChange={(value) => setParams({
                  ...params,
                  weight: { ...params.weight, min: value }
                })}
                onMaxChange={(value) => setParams({
                  ...params,
                  weight: { ...params.weight, max: value }
                })}
                onStepChange={(value) => setParams({
                  ...params,
                  weight: { ...params.weight, step: value }
                })}
                unit="g"
                helperText="Total weight including packaging"
              />
            </CardContent>
          </Card>

          {/* Column 3: Business Parameters */}
          <Card>
            <CardHeader>
              <CardTitle>Business Parameters</CardTitle>
              <CardDescription>
                Configure pricing and packaging
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pack Sizes */}
              <RangeInput
                label="Pack Sizes"
                min={params.packSizes.min}
                max={params.packSizes.max}
                step={params.packSizes.step}
                onMinChange={(value) => setParams({
                  ...params,
                  packSizes: { ...params.packSizes, min: value }
                })}
                onMaxChange={(value) => setParams({
                  ...params,
                  packSizes: { ...params.packSizes, max: value }
                })}
                onStepChange={(value) => setParams({
                  ...params,
                  packSizes: { ...params.packSizes, step: value }
                })}
                unit="units"
                helperText="Units per pack"
              />

              {/* Price */}
              <SmartPriceInput
                min={params.price.min}
                max={params.price.max}
                step={params.price.step}
                onMinChange={(value) => setParams({
                  ...params,
                  price: { ...params.price, min: value }
                })}
                onMaxChange={(value) => setParams({
                  ...params,
                  price: { ...params.price, max: value }
                })}
                onStepChange={(value) => setParams({
                  ...params,
                  price: { ...params.price, step: value }
                })}
                targetMargin={params.targetMarginPercent || 30}
              />

              <div className="space-y-2">
                <Label>Target Margin %</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={params.targetMarginPercent || '30'}
                    onChange={(e) => setParams({ 
                      ...params, 
                      targetMarginPercent: e.target.value ? parseFloat(e.target.value) : 30 
                    })}
                    placeholder="30"
                    min="0"
                    max="100"
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    (Default: 30%)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Filter results by minimum profit margin
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generation summary */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Generation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold">{estimatedCombinations.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">Total Combinations</p>
              </div>
              <div className="text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold">{params.materialProfiles.length}</div>
                <p className="text-sm text-muted-foreground">Materials</p>
              </div>
              <div className="text-center">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold">{params.sourcingProfiles.length}</div>
                <p className="text-sm text-muted-foreground">Sourcing Profiles</p>
              </div>
              <div className="text-center">
                <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold">~{Math.ceil(estimatedCombinations / 1000)}s</div>
                <p className="text-sm text-muted-foreground">Est. Time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex gap-4">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || isCalculating || dataLoading}
            size="lg"
            className="flex-1"
          >
            {isGenerating || isCalculating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isGenerating ? 'Generating...' : 'Calculating...'}
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Generate Combinations
              </>
            )}
          </Button>
          
          {currentBatch?.status === 'complete' && (
            <Button
              onClick={handleViewResults}
              variant="outline"
              size="lg"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              View Results
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
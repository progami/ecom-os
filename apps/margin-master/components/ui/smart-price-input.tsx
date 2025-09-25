'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Calculator, TrendingUp, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SmartPriceInputProps {
  min: number
  max: number
  step: number
  onMinChange: (value: number) => void
  onMaxChange: (value: number) => void
  onStepChange: (value: number) => void
  targetMargin: number
  estimatedCosts?: {
    minCost?: number  // Minimum possible cost based on smallest dimensions
    avgCost?: number  // Average cost estimate
    maxCost?: number  // Maximum possible cost based on largest dimensions
  }
}

export function SmartPriceInput({
  min,
  max,
  step,
  onMinChange,
  onMaxChange,
  onStepChange,
  targetMargin = 30,
  estimatedCosts
}: SmartPriceInputProps) {
  const [priceMode, setPriceMode] = useState<'manual' | 'margin' | 'competitive'>('manual')
  const [competitivePrice, setCompetitivePrice] = useState(29.99)

  // Calculate minimum price needed for target margin
  const calculateMinPriceForMargin = useCallback((cost: number, marginPercent: number) => {
    // Price = Cost / (1 - Margin%)
    // For 30% margin: Price = Cost / 0.7
    return cost / (1 - marginPercent / 100)
  }, [])

  // Calculate price suggestions based on mode
  useEffect(() => {
    if (priceMode === 'margin' && estimatedCosts) {
      const { minCost = 10, avgCost = 15, maxCost = 20 } = estimatedCosts

      // Calculate minimum prices for target margin
      const minPrice = calculateMinPriceForMargin(maxCost, targetMargin)
      const maxPrice = calculateMinPriceForMargin(minCost, targetMargin + 20) // Up to 50% margin

      onMinChange(Math.ceil(minPrice))
      onMaxChange(Math.ceil(maxPrice))

      // Set step based on price range
      const range = maxPrice - minPrice
      if (range <= 10) onStepChange(0.5)
      else if (range <= 50) onStepChange(1)
      else if (range <= 100) onStepChange(5)
      else onStepChange(10)
    } else if (priceMode === 'competitive') {
      // Set range around competitive price
      const variance = competitivePrice * 0.2 // ±20%
      onMinChange(Math.max(1, competitivePrice - variance))
      onMaxChange(competitivePrice + variance)
      onStepChange(competitivePrice >= 50 ? 5 : competitivePrice >= 20 ? 2 : 1)
    }
  }, [
    priceMode,
    estimatedCosts,
    targetMargin,
    competitivePrice,
    onMinChange,
    onMaxChange,
    onStepChange,
    calculateMinPriceForMargin,
  ])

  const getPricingInsights = () => {
    if (!estimatedCosts) return null

    const { minCost = 10, avgCost = 15, maxCost = 20 } = estimatedCosts
    const minPriceNeeded = calculateMinPriceForMargin(maxCost, targetMargin)
    
    return (
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Min price for {targetMargin}% margin:</span>
          <span className="font-semibold">${minPriceNeeded.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Sweet spot (40% margin):</span>
          <span className="font-semibold">${calculateMinPriceForMargin(avgCost, 40).toFixed(2)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Sale Price ($)</Label>
        <ToggleGroup type="single" value={priceMode} onValueChange={(v) => setPriceMode(v as any)} size="sm">
          <ToggleGroupItem value="manual" aria-label="Manual pricing">
            Manual
          </ToggleGroupItem>
          <ToggleGroupItem value="margin" aria-label="Margin-based pricing">
            <Calculator className="h-3 w-3 mr-1" />
            Margin
          </ToggleGroupItem>
          <ToggleGroupItem value="competitive" aria-label="Competitive pricing">
            <TrendingUp className="h-3 w-3 mr-1" />
            Market
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {priceMode === 'competitive' && (
        <div className="space-y-2">
          <Label className="text-xs">Competitor Price Reference</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={competitivePrice}
              onChange={(e) => setCompetitivePrice(parseFloat(e.target.value) || 29.99)}
              placeholder="29.99"
              step="0.01"
            />
            <Button size="sm" variant="outline" onClick={() => setCompetitivePrice(29.99)}>
              Reset
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">Min</Label>
          <Input
            type="number"
            value={min}
            onChange={(e) => onMinChange(parseFloat(e.target.value) || 0)}
            placeholder="10"
            step="0.01"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Max</Label>
          <Input
            type="number"
            value={max}
            onChange={(e) => onMaxChange(parseFloat(e.target.value) || 0)}
            placeholder="100"
            step="0.01"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Step</Label>
          <Input
            type="number"
            value={step}
            onChange={(e) => onStepChange(parseFloat(e.target.value) || 1)}
            step="0.01"
            placeholder="5"
          />
        </div>
      </div>

      {priceMode === 'margin' && (
        <Alert>
          <DollarSign className="h-4 w-4" />
          <AlertDescription>
            Price range set to achieve {targetMargin}-{targetMargin + 20}% profit margins
            {estimatedCosts && (
              <div className="mt-2">
                {getPricingInsights()}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {priceMode === 'competitive' && (
        <Alert>
          <TrendingUp className="h-4 w-4" />
          <AlertDescription>
            Testing prices ±20% around ${competitivePrice.toFixed(2)} to find optimal positioning
          </AlertDescription>
        </Alert>
      )}
      
      <div className="text-xs text-muted-foreground">
        Will generate {Math.ceil((max - min) / step) + 1} price points
      </div>
    </div>
  )
}
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface DimensionRange {
  min: number
  max: number
  step: number
}

interface DimensionsInputProps {
  dimensions: {
    length: DimensionRange
    width: DimensionRange
    height: DimensionRange
  }
  onChange: (dimensions: {
    length: DimensionRange
    width: DimensionRange
    height: DimensionRange
  }) => void
}

export function DimensionsInput({ dimensions, onChange }: DimensionsInputProps) {
  const [stepType, setStepType] = useState<'step' | 'count'>('step')

  const calculateStepFromCount = (min: number, max: number, count: number) => {
    if (count <= 1) return max - min
    return (max - min) / (count - 1)
  }

  const calculateCountFromStep = (min: number, max: number, step: number) => {
    if (step === 0) return 1
    return Math.floor((max - min) / step) + 1
  }

  const updateDimension = (
    dimension: 'length' | 'width' | 'height',
    field: 'min' | 'max' | 'step',
    value: number
  ) => {
    onChange({
      ...dimensions,
      [dimension]: {
        ...dimensions[dimension],
        [field]: value
      }
    })
  }

  const renderDimensionRow = (
    label: string,
    dimension: 'length' | 'width' | 'height',
    unit: string = 'cm'
  ) => {
    const dim = dimensions[dimension]
    const count = calculateCountFromStep(dim.min, dim.max, dim.step)

    return (
      <div className="grid grid-cols-4 gap-2 items-center">
        <Label className="text-sm font-medium">{label}</Label>
        <div>
          <Input
            type="number"
            value={dim.min}
            onChange={(e) => updateDimension(dimension, 'min', parseFloat(e.target.value) || 0)}
            className="h-8"
            placeholder="Min"
          />
        </div>
        <div>
          <Input
            type="number"
            value={dim.max}
            onChange={(e) => updateDimension(dimension, 'max', parseFloat(e.target.value) || 0)}
            className="h-8"
            placeholder="Max"
          />
        </div>
        <div>
          {stepType === 'step' ? (
            <Input
              type="number"
              value={dim.step}
              onChange={(e) => updateDimension(dimension, 'step', parseFloat(e.target.value) || 1)}
              className="h-8"
              placeholder="Step"
            />
          ) : (
            <Input
              type="number"
              value={count}
              onChange={(e) => {
                const newCount = parseInt(e.target.value) || 2
                const newStep = calculateStepFromCount(dim.min, dim.max, newCount)
                updateDimension(dimension, 'step', newStep)
              }}
              className="h-8"
              placeholder="Count"
              min="2"
            />
          )}
        </div>
      </div>
    )
  }

  const totalCombinations = 
    calculateCountFromStep(dimensions.length.min, dimensions.length.max, dimensions.length.step) *
    calculateCountFromStep(dimensions.width.min, dimensions.width.max, dimensions.width.step) *
    calculateCountFromStep(dimensions.height.min, dimensions.height.max, dimensions.height.step)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Product Dimensions</Label>
        <ToggleGroup type="single" value={stepType} onValueChange={(v) => setStepType(v as any)} size="sm">
          <ToggleGroupItem value="step" aria-label="Use step size">
            Step
          </ToggleGroupItem>
          <ToggleGroupItem value="count" aria-label="Use number of steps">
            Count
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
        {/* Header row */}
        <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground pb-1 border-b">
          <div>Dimension</div>
          <div>Min</div>
          <div>Max</div>
          <div>{stepType === 'step' ? 'Step' : 'Count'}</div>
        </div>

        {/* Dimension rows */}
        {renderDimensionRow('Length', 'length')}
        {renderDimensionRow('Width', 'width')}
        {renderDimensionRow('Height', 'height')}

        {/* Summary */}
        <div className="pt-2 border-t text-sm text-muted-foreground">
          Total combinations: <span className="font-medium text-foreground">{totalCombinations}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        All dimensions in centimeters. The system will test all combinations within these ranges.
      </p>
    </div>
  )
}
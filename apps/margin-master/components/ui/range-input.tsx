'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface RangeInputProps {
  label: string
  min: number
  max: number
  step: number
  onMinChange: (value: number) => void
  onMaxChange: (value: number) => void
  onStepChange: (value: number) => void
  unit?: string
  helperText?: string
}

export function RangeInput({
  label,
  min,
  max,
  step,
  onMinChange,
  onMaxChange,
  onStepChange,
  unit = '',
  helperText
}: RangeInputProps) {
  const [inputType, setInputType] = useState<'step' | 'count'>('step')
  const [stepCount, setStepCount] = useState(5)

  // Calculate step from count
  const calculateStepFromCount = (minVal: number, maxVal: number, count: number) => {
    if (count <= 1) return maxVal - minVal
    return (maxVal - minVal) / (count - 1)
  }

  // Calculate count from step
  const calculateCountFromStep = (minVal: number, maxVal: number, stepVal: number) => {
    if (stepVal === 0) return 1
    return Math.round((maxVal - minVal) / stepVal) + 1
  }

  // Update count when step changes
  useEffect(() => {
    if (inputType === 'step') {
      const count = calculateCountFromStep(min, max, step)
      setStepCount(Math.max(2, Math.min(count, 100))) // Limit between 2-100
    }
  }, [min, max, step, inputType])

  const handleCountChange = (newCount: number) => {
    const validCount = Math.max(2, Math.min(newCount, 100))
    setStepCount(validCount)
    if (inputType === 'count') {
      const newStep = calculateStepFromCount(min, max, validCount)
      onStepChange(Number(newStep.toFixed(2)))
    }
  }

  const handleStepTypeChange = (value: string) => {
    if (value === 'step' || value === 'count') {
      setInputType(value)
      if (value === 'count') {
        // When switching to count mode, update step based on current count
        const newStep = calculateStepFromCount(min, max, stepCount)
        onStepChange(Number(newStep.toFixed(2)))
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label} {unit && `(${unit})`}</Label>
        <ToggleGroup type="single" value={inputType} onValueChange={handleStepTypeChange} size="sm">
          <ToggleGroupItem value="step" aria-label="Use step size">
            Step
          </ToggleGroupItem>
          <ToggleGroupItem value="count" aria-label="Use number of steps">
            Count
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">Min</Label>
          <Input
            type="number"
            value={min}
            onChange={(e) => onMinChange(parseFloat(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Max</Label>
          <Input
            type="number"
            value={max}
            onChange={(e) => onMaxChange(parseFloat(e.target.value) || 0)}
            placeholder="100"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">
            {inputType === 'step' ? 'Step Size' : 'Steps'}
          </Label>
          {inputType === 'step' ? (
            <Input
              type="number"
              value={step}
              onChange={(e) => onStepChange(parseFloat(e.target.value) || 1)}
              step="0.01"
              placeholder="1"
            />
          ) : (
            <Input
              type="number"
              value={stepCount}
              onChange={(e) => handleCountChange(parseInt(e.target.value) || 2)}
              min="2"
              max="100"
              placeholder="5"
            />
          )}
        </div>
      </div>
      
      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
      
      <div className="text-xs text-muted-foreground">
        {inputType === 'step' 
          ? `Will generate ${calculateCountFromStep(min, max, step)} values`
          : `Step size: ${calculateStepFromCount(min, max, stepCount).toFixed(2)}${unit ? ` ${unit}` : ''}`}
      </div>
    </div>
  )
}
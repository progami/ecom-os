'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { X, Plus } from 'lucide-react'

interface PackSizeInputProps {
  packSizes: number[]
  onChange: (packSizes: number[]) => void
}

export function PackSizeInput({ packSizes, onChange }: PackSizeInputProps) {
  const [inputMode, setInputMode] = useState<'manual' | 'range'>('manual')
  const [stepType, setStepType] = useState<'step' | 'count'>('step')
  const [rangeConfig, setRangeConfig] = useState({
    min: 1,
    max: 24,
    step: 1,
    count: 5,
    commonMultiples: false
  })
  const [customSize, setCustomSize] = useState('')

  // Common pack sizes for quick selection
  const commonSizes = [1, 2, 3, 4, 6, 8, 12, 16, 24, 36, 48]

  // Calculate step from count
  const calculateStepFromCount = (min: number, max: number, count: number) => {
    if (count <= 1) return max - min
    return Math.ceil((max - min) / (count - 1))
  }

  // Calculate count from step
  const calculateCountFromStep = (min: number, max: number, step: number) => {
    if (step === 0) return 1
    return Math.floor((max - min) / step) + 1
  }

  // Generate pack sizes from range configuration
  const generateFromRange = () => {
    const sizes: number[] = []
    
    if (rangeConfig.commonMultiples) {
      // Generate common multiples (1, 2, 3, 4, 6, 8, 12, etc.)
      const multipliers = [1, 2, 3, 4, 6, 8, 12, 16, 24, 36, 48, 60, 72, 96]
      for (const mult of multipliers) {
        if (mult >= rangeConfig.min && mult <= rangeConfig.max) {
          sizes.push(mult)
        }
      }
    } else {
      // Generate with regular steps
      const actualStep = stepType === 'count' 
        ? calculateStepFromCount(rangeConfig.min, rangeConfig.max, rangeConfig.count)
        : rangeConfig.step
        
      for (let i = rangeConfig.min; i <= rangeConfig.max; i += actualStep) {
        sizes.push(Math.round(i))
      }
    }
    
    return [...new Set(sizes)].sort((a, b) => a - b) // Remove duplicates and sort
  }

  // Update pack sizes when range config changes in range mode
  useEffect(() => {
    if (inputMode === 'range') {
      onChange(generateFromRange())
    }
  }, [rangeConfig, inputMode])

  const togglePackSize = (size: number) => {
    if (packSizes.includes(size)) {
      onChange(packSizes.filter(s => s !== size))
    } else {
      onChange([...packSizes, size].sort((a, b) => a - b))
    }
  }

  const addCustomSize = () => {
    const size = parseInt(customSize)
    if (size > 0 && !packSizes.includes(size)) {
      onChange([...packSizes, size].sort((a, b) => a - b))
      setCustomSize('')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Pack Sizes</Label>
        <ToggleGroup type="single" value={inputMode} onValueChange={(v) => setInputMode(v as any)} size="sm">
          <ToggleGroupItem value="manual" aria-label="Manual selection">
            Manual
          </ToggleGroupItem>
          <ToggleGroupItem value="range" aria-label="Range generation">
            Range
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {inputMode === 'manual' ? (
        <div className="space-y-3">
          {/* Common sizes */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Common sizes (click to toggle)</p>
            <div className="flex flex-wrap gap-2">
              {commonSizes.map(size => (
                <Badge
                  key={size}
                  variant={packSizes.includes(size) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => togglePackSize(size)}
                >
                  {size}
                </Badge>
              ))}
            </div>
          </div>

          {/* Custom input */}
          <div className="flex gap-2">
            <Input
              type="number"
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              placeholder="Custom size"
              min="1"
              onKeyDown={(e) => e.key === 'Enter' && addCustomSize()}
            />
            <Button 
              size="sm" 
              variant="outline" 
              onClick={addCustomSize}
              disabled={!customSize || parseInt(customSize) <= 0}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Selected sizes */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Selected sizes</p>
            <div className="flex flex-wrap gap-2">
              {packSizes.length === 0 ? (
                <span className="text-sm text-muted-foreground">No sizes selected</span>
              ) : (
                packSizes.map(size => (
                  <Badge key={size} variant="secondary">
                    {size}
                    <button
                      className="ml-1 hover:text-destructive"
                      onClick={() => onChange(packSizes.filter(s => s !== size))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">Range Configuration</Label>
            <ToggleGroup 
              type="single" 
              value={stepType} 
              onValueChange={(v) => setStepType(v as 'step' | 'count')} 
              size="sm"
              disabled={rangeConfig.commonMultiples}
            >
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
                value={rangeConfig.min}
                onChange={(e) => setRangeConfig({
                  ...rangeConfig,
                  min: parseInt(e.target.value) || 1
                })}
                min="1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input
                type="number"
                value={rangeConfig.max}
                onChange={(e) => setRangeConfig({
                  ...rangeConfig,
                  max: parseInt(e.target.value) || 1
                })}
                min="1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                {rangeConfig.commonMultiples ? 'Auto' : (stepType === 'step' ? 'Step Size' : 'Steps')}
              </Label>
              {rangeConfig.commonMultiples ? (
                <Input
                  type="text"
                  value="Auto"
                  disabled
                  className="text-center"
                />
              ) : stepType === 'step' ? (
                <Input
                  type="number"
                  value={rangeConfig.step}
                  onChange={(e) => setRangeConfig({
                    ...rangeConfig,
                    step: parseInt(e.target.value) || 1
                  })}
                  min="1"
                />
              ) : (
                <Input
                  type="number"
                  value={rangeConfig.count}
                  onChange={(e) => setRangeConfig({
                    ...rangeConfig,
                    count: Math.max(2, parseInt(e.target.value) || 2)
                  })}
                  min="2"
                  max="50"
                />
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="commonMultiples"
              checked={rangeConfig.commonMultiples}
              onChange={(e) => setRangeConfig({
                ...rangeConfig,
                commonMultiples: e.target.checked
              })}
              className="rounded border-gray-300"
            />
            <Label htmlFor="commonMultiples" className="text-sm font-normal cursor-pointer">
              Use common pack multiples only (1, 2, 3, 4, 6, 8, 12...)
            </Label>
          </div>

          <div className="text-xs text-muted-foreground">
            {rangeConfig.commonMultiples ? (
              `Will generate ${generateFromRange().length} common pack sizes`
            ) : stepType === 'step' ? (
              `Will generate ${calculateCountFromStep(rangeConfig.min, rangeConfig.max, rangeConfig.step)} pack sizes`
            ) : (
              `Step size: ${calculateStepFromCount(rangeConfig.min, rangeConfig.max, rangeConfig.count)}`
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Generated sizes</p>
            <div className="flex flex-wrap gap-2">
              {generateFromRange().map(size => (
                <Badge key={size} variant="secondary">
                  {size}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
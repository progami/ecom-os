'use client'

import * as React from 'react'
import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useAnimation, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Scenario } from '@/components/simulation-grid'
import type { MaterialProfile, SourcingProfile } from '@/hooks/use-simulation-data'
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Copy,
  DollarSign,
  Package,
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Calculator,
  ArrowRight,
  Percent,
  Layers,
  Globe,
  X,
  GitCompare,
  Info
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

interface ScenarioCardsProps {
  scenarios: Scenario[]
  materials: MaterialProfile[]
  sourcingProfiles: SourcingProfile[]
  onUpdateScenario: (scenario: Scenario) => void
  onDeleteScenario: (scenarioId: string) => void
  onDuplicateScenario: (scenarioId: string) => void
  onCalculateScenario: (scenarioId: string) => void
  onAddScenario: () => void
  onRefreshAll?: () => void
  className?: string
}

// Helper to format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Helper to format percentage
const formatPercent = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)
}

// Get color for margin
const getMarginColor = (value: number) => {
  if (value > 25) return 'text-green-600 dark:text-green-400'
  if (value >= 15) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

// Get background color for margin
const getMarginBgColor = (value: number) => {
  if (value > 25) return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
  if (value >= 15) return 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800'
  return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
}

// Get color for ROI
const getRoiColor = (value: number) => {
  if (value > 50) return 'text-green-600 dark:text-green-400'
  if (value >= 20) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

interface SwipeableCardProps {
  scenario: Scenario
  material?: MaterialProfile
  sourcing?: SourcingProfile
  onDelete: () => void
  onDuplicate: () => void
  onCalculate: () => void
  onToggleExpand: () => void
  isExpanded: boolean
  isComparing?: boolean
  onToggleCompare?: () => void
}

const SwipeableCard: React.FC<SwipeableCardProps> = ({
  scenario,
  material,
  sourcing,
  onDelete,
  onDuplicate,
  onCalculate,
  onToggleExpand,
  isExpanded,
  isComparing,
  onToggleCompare
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)
  const x = useMotionValue(0)
  const controls = useAnimation()
  
  // Transform for delete button opacity
  const deleteOpacity = useTransform(x, [-100, -50], [1, 0])
  const deleteScale = useTransform(x, [-100, -50], [1, 0.8])

  // Handle swipe
  const handleDragEnd = async (_: any, info: PanInfo) => {
    const threshold = -100
    if (info.offset.x < threshold) {
      setShowDeleteConfirm(true)
      await controls.start({ x: -100 })
    } else {
      await controls.start({ x: 0 })
    }
  }

  // Handle long press for duplicate
  const handleLongPressStart = useCallback(() => {
    const timer = setTimeout(() => {
      onDuplicate()
      // Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }
    }, 500)
    setLongPressTimer(timer)
  }, [onDuplicate])

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
  }, [longPressTimer])

  // Check if scenario has required data
  const hasRequiredData = scenario.materialProfileId && scenario.sourcingProfileId && scenario.salePrice > 0
  const isBreakEven = Math.abs(scenario.netMarginPercent) < 0.5 && scenario.netMarginPercent !== 0

  // Get status info
  const getStatusBadge = () => {
    if (scenario.isCalculating) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Calculating
        </Badge>
      )
    }
    if (scenario.calculationError) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Error
        </Badge>
      )
    }
    if (!hasRequiredData) {
      return (
        <Badge variant="outline" className="gap-1 border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-400">
          <AlertTriangle className="h-3 w-3" />
          Incomplete
        </Badge>
      )
    }
    if (scenario.lastCalculated && !scenario.hasChanges) {
      return (
        <Badge variant="outline" className="gap-1 border-green-200 text-green-700 dark:border-green-800 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          Calculated
        </Badge>
      )
    }
    if (scenario.hasChanges) {
      return (
        <Badge variant="outline" className="gap-1 border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          Pending
        </Badge>
      )
    }
    return null
  }

  return (
    <div className="relative overflow-hidden">
      {/* Delete confirmation backdrop */}
      {showDeleteConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-red-500/10 backdrop-blur-sm z-20 flex items-center justify-center gap-2"
        >
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              onDelete()
              setShowDeleteConfirm(false)
            }}
          >
            Delete
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowDeleteConfirm(false)
              controls.start({ x: 0 })
            }}
          >
            Cancel
          </Button>
        </motion.div>
      )}

      {/* Delete button (revealed on swipe) */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 w-24 bg-red-500 flex items-center justify-center"
        style={{ opacity: deleteOpacity, scale: deleteScale }}
      >
        <Trash2 className="h-5 w-5 text-white" />
      </motion.div>

      {/* Main card content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        className="relative bg-background"
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
      >
        <Card 
          className={cn(
            "transition-all duration-300 touch-manipulation",
            "hover:shadow-lg active:scale-[0.98]",
            scenario.hasChanges && "ring-2 ring-amber-400/50",
            isComparing && "ring-2 ring-primary"
          )}
        >
          <CardHeader 
            className="pb-3 cursor-pointer"
            onClick={onToggleExpand}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <CardTitle className="text-lg font-semibold leading-tight">
                  {scenario.name}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusBadge()}
                  {isBreakEven && hasRequiredData && (
                    <Badge variant="secondary" className="text-xs">
                      Break-even
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {onToggleCompare && (
                  <Button
                    size="sm"
                    variant={isComparing ? "default" : "ghost"}
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleCompare()
                    }}
                  >
                    <GitCompare className="h-4 w-4" />
                  </Button>
                )}
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </motion.div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* Key Inputs Section */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(scenario.salePrice)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Pack Size</p>
                  <p className="font-semibold tabular-nums">{scenario.packSize}</p>
                </div>
              </div>
            </div>

            {/* Material & Sourcing */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Material:</span>
                <span className="font-medium">{material?.name || 'Not selected'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Sourcing:</span>
                <span className="font-medium">{sourcing?.name || 'Not selected'}</span>
              </div>
            </div>

            {/* Results Summary */}
            {hasRequiredData && (
              <div className={cn(
                "p-3 rounded-lg border",
                getMarginBgColor(scenario.netMarginPercent)
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Net Margin</span>
                  <span className={cn("text-lg font-bold tabular-nums", getMarginColor(scenario.netMarginPercent))}>
                    {formatPercent(scenario.netMarginPercent)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">ROI</span>
                  <span className={cn("text-lg font-bold tabular-nums", getRoiColor(scenario.roi))}>
                    {formatPercent(scenario.roi)}
                  </span>
                </div>
              </div>
            )}

            {/* Expanded Details */}
            <AnimatePresence>
              {isExpanded && hasRequiredData && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Landed Cost</span>
                      <span className="font-medium tabular-nums">{formatCurrency(scenario.landedCost)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">FBA Fee</span>
                      <span className="font-medium tabular-nums">{formatCurrency(scenario.fbaFee)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Referral Fee</span>
                      <span className="font-medium tabular-nums">{formatCurrency(scenario.referralFee)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="font-medium">Total Costs</span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(scenario.landedCost + scenario.fbaFee + scenario.referralFee)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation()
                  onDuplicate()
                }}
              >
                <Copy className="h-4 w-4 mr-1" />
                Duplicate
              </Button>
              <Button
                size="sm"
                variant="default"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation()
                  onCalculate()
                }}
                disabled={!hasRequiredData || scenario.isCalculating}
              >
                {scenario.isCalculating ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Calculator className="h-4 w-4 mr-1" />
                )}
                Calculate
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export const ScenarioCards: React.FC<ScenarioCardsProps> = ({
  scenarios,
  materials,
  sourcingProfiles,
  onUpdateScenario,
  onDeleteScenario,
  onDuplicateScenario,
  onCalculateScenario,
  onAddScenario,
  onRefreshAll,
  className
}) => {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [comparisonMode, setComparisonMode] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isTablet, setIsTablet] = useState(false)

  // Detect tablet vs phone
  useEffect(() => {
    const checkDevice = () => {
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024)
    }
    checkDevice()
    window.addEventListener('resize', checkDevice)
    return () => window.removeEventListener('resize', checkDevice)
  }, [])

  // Toggle card expansion
  const toggleExpand = (scenarioId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev)
      if (newSet.has(scenarioId)) {
        newSet.delete(scenarioId)
      } else {
        newSet.add(scenarioId)
      }
      return newSet
    })
  }

  // Toggle comparison mode
  const toggleCompare = (scenarioId: string) => {
    if (!comparisonMode) {
      setComparisonMode(true)
      setCompareIds([scenarioId])
    } else {
      setCompareIds(prev => {
        if (prev.includes(scenarioId)) {
          const newIds = prev.filter(id => id !== scenarioId)
          if (newIds.length === 0) {
            setComparisonMode(false)
          }
          return newIds
        } else if (prev.length < 2) {
          return [...prev, scenarioId]
        }
        return prev
      })
    }
  }

  // Get material and sourcing for a scenario
  const getMaterial = (materialId: string | null) => 
    materials.find(m => m.id === materialId)
  
  const getSourcing = (sourcingId: string | null) => 
    sourcingProfiles.find(s => s.id === sourcingId)

  // Render comparison view
  const renderComparison = () => {
    if (compareIds.length !== 2) return null

    const [scenario1, scenario2] = compareIds.map(id => scenarios.find(s => s.id === id)!).filter(Boolean)
    if (!scenario1 || !scenario2) return null

    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Compare Scenarios</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setComparisonMode(false)
                setCompareIds([])
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto">
              {[scenario1, scenario2].map((scenario, index) => {
                const material = getMaterial(scenario.materialProfileId)
                const sourcing = getSourcing(scenario.sourcingProfileId)
                const hasData = scenario.materialProfileId && scenario.sourcingProfileId && scenario.salePrice > 0

                return (
                  <div key={scenario.id} className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{scenario.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Price</span>
                            <span className="font-medium">{formatCurrency(scenario.salePrice)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Pack Size</span>
                            <span className="font-medium">{scenario.packSize}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Material</span>
                            <span className="font-medium text-right">{material?.name || '-'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Sourcing</span>
                            <span className="font-medium text-right">{sourcing?.name || '-'}</span>
                          </div>
                        </div>

                        {hasData && (
                          <>
                            <div className="border-t pt-3 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Landed Cost</span>
                                <span className="font-medium">{formatCurrency(scenario.landedCost)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">FBA Fee</span>
                                <span className="font-medium">{formatCurrency(scenario.fbaFee)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Referral Fee</span>
                                <span className="font-medium">{formatCurrency(scenario.referralFee)}</span>
                              </div>
                            </div>

                            <div className={cn(
                              "p-3 rounded-lg border",
                              getMarginBgColor(scenario.netMarginPercent)
                            )}>
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium">Net Margin</span>
                                <span className={cn("font-bold", getMarginColor(scenario.netMarginPercent))}>
                                  {formatPercent(scenario.netMarginPercent)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">ROI</span>
                                <span className={cn("font-bold", getRoiColor(scenario.roi))}>
                                  {formatPercent(scenario.roi)}
                                </span>
                              </div>
                            </div>

                            {/* Visual comparison indicator */}
                            {index === 0 && scenario1.netMarginPercent > scenario2.netMarginPercent && (
                              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                                <TrendingUp className="h-4 w-4" />
                                <span>Higher margin</span>
                              </div>
                            )}
                            {index === 1 && scenario2.netMarginPercent > scenario1.netMarginPercent && (
                              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                                <TrendingUp className="h-4 w-4" />
                                <span>Higher margin</span>
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )
              })}
            </div>

            {/* Difference Summary */}
            <Card className="mt-6 max-w-4xl mx-auto">
              <CardHeader>
                <CardTitle className="text-base">Comparison Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price Difference</span>
                    <span className="font-medium">
                      {formatCurrency(Math.abs(scenario1.salePrice - scenario2.salePrice))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Margin Difference</span>
                    <span className="font-medium">
                      {Math.abs(scenario1.netMarginPercent - scenario2.netMarginPercent).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ROI Difference</span>
                    <span className="font-medium">
                      {Math.abs(scenario1.roi - scenario2.roi).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className={cn("relative", className)}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Scenarios</h2>
            <p className="text-sm text-muted-foreground">
              Swipe left to delete • Long press to duplicate
            </p>
          </div>
          {scenarios.length > 0 && onRefreshAll && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRefreshAll}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh All
            </Button>
          )}
        </div>

        {/* Cards Container */}
        {scenarios.length === 0 ? (
          // Empty State
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Calculator className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No scenarios yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                Create your first scenario to start comparing pricing strategies
              </p>
              <Button onClick={onAddScenario} size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Add Scenario
              </Button>
            </CardContent>
          </Card>
        ) : isTablet ? (
          // Horizontal scroll for tablets
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4" ref={scrollContainerRef}>
              {scenarios.map((scenario) => (
                <div key={scenario.id} className="w-80 flex-shrink-0">
                  <SwipeableCard
                    scenario={scenario}
                    material={getMaterial(scenario.materialProfileId)}
                    sourcing={getSourcing(scenario.sourcingProfileId)}
                    onDelete={() => onDeleteScenario(scenario.id)}
                    onDuplicate={() => onDuplicateScenario(scenario.id)}
                    onCalculate={() => onCalculateScenario(scenario.id)}
                    onToggleExpand={() => toggleExpand(scenario.id)}
                    isExpanded={expandedCards.has(scenario.id)}
                    isComparing={compareIds.includes(scenario.id)}
                    onToggleCompare={() => toggleCompare(scenario.id)}
                  />
                </div>
              ))}
              <div className="w-80 flex-shrink-0">
                <Card className="border-dashed h-full min-h-[200px] flex items-center justify-center">
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={onAddScenario}
                    className="h-full w-full gap-2"
                  >
                    <Plus className="h-6 w-6" />
                    Add Scenario
                  </Button>
                </Card>
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          // Vertical stack for phones
          <div className="space-y-4">
            {scenarios.map((scenario) => (
              <SwipeableCard
                key={scenario.id}
                scenario={scenario}
                material={getMaterial(scenario.materialProfileId)}
                sourcing={getSourcing(scenario.sourcingProfileId)}
                onDelete={() => onDeleteScenario(scenario.id)}
                onDuplicate={() => onDuplicateScenario(scenario.id)}
                onCalculate={() => onCalculateScenario(scenario.id)}
                onToggleExpand={() => toggleExpand(scenario.id)}
                isExpanded={expandedCards.has(scenario.id)}
                isComparing={compareIds.includes(scenario.id)}
                onToggleCompare={() => toggleCompare(scenario.id)}
              />
            ))}
            <Card className="border-dashed">
              <CardContent className="p-6">
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={onAddScenario}
                  className="w-full gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Add New Scenario
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Comparison Mode Indicator */}
        {comparisonMode && compareIds.length < 2 && (
          <div className="fixed bottom-4 left-4 right-4 z-40">
            <Card className="bg-primary text-primary-foreground">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  <span className="text-sm">Select another scenario to compare</span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setComparisonMode(false)
                    setCompareIds([])
                  }}
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Render comparison view */}
        {comparisonMode && compareIds.length === 2 && renderComparison()}
      </div>
    </TooltipProvider>
  )
}

export default ScenarioCards
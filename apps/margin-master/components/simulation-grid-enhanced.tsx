'use client'

import * as React from 'react'
import { forwardRef, useImperativeHandle, useCallback, useEffect } from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { FloatingInput } from '@/components/ui/floating-input'
import { SearchableSelect, type Option } from '@/components/ui/searchable-select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Calculator, Loader2, AlertCircle, CheckCircle2, Copy, Download, Upload, Save, RefreshCw, Star, TrendingUp, AlertTriangle, Info, Trophy, DollarSign, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebouncedCalculation } from '@/hooks/use-debounced-calculation'
import type { MaterialProfile, SourcingProfile } from '@/hooks/use-simulation-data'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Define the Scenario interface
export interface Scenario {
  id: string
  name: string
  salePrice: number
  packSize: number
  materialProfileId: string | null
  sourcingProfileId: string | null
  // Calculated fields
  landedCost: number
  fbaFee: number
  referralFee: number
  netMarginPercent: number
  roi: number
  // Status fields
  hasChanges?: boolean
  isCalculating?: boolean
  lastCalculated?: string
  calculationError?: string
}

interface SimulationGridProps {
  materials: MaterialProfile[]
  sourcingProfiles: SourcingProfile[]
  onCalculate: (scenarios: Scenario[]) => Promise<void>
  onCalculateScenarios: (scenarioIds: string[]) => Promise<void>
  enableRealTimeCalculation?: boolean
  onSaveSimulation?: (name: string, description: string, scenarios: Scenario[]) => Promise<void>
  marketplace?: string
  estimatedAcosPercent?: number
  refundProvisionPercent?: number
  initialScenarios?: Scenario[]
}

// Create enhanced editable cell components
const EditableNumberCell = ({ 
  getValue, 
  row, 
  column,
  table 
}: any) => {
  const initialValue = getValue()
  const [value, setValue] = React.useState(initialValue)
  const [isFocused, setIsFocused] = React.useState(false)

  const onBlur = () => {
    table.options.meta?.updateData(row.index, column.id, value)
    setIsFocused(false)
  }

  React.useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const isCurrency = column.id === 'salePrice'

  return (
    <div className="max-w-[120px]">
      <FloatingInput
        type="number"
        value={value}
        onChange={e => setValue(parseFloat(e.target.value) || 0)}
        onBlur={onBlur}
        onFocus={() => setIsFocused(true)}
        label={column.columnDef.header as string}
        currency={isCurrency}
        step="0.01"
        className="h-9 text-sm"
      />
    </div>
  )
}

const EditableTextCell = ({ 
  getValue, 
  row, 
  column,
  table 
}: any) => {
  const initialValue = getValue()
  const [value, setValue] = React.useState(initialValue)
  const [isFocused, setIsFocused] = React.useState(false)

  const onBlur = () => {
    table.options.meta?.updateData(row.index, column.id, value)
    setIsFocused(false)
  }

  React.useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  return (
    <div className="max-w-[150px]">
      <FloatingInput
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={onBlur}
        onFocus={() => setIsFocused(true)}
        label="Scenario Name"
        className="h-9 text-sm"
      />
    </div>
  )
}

const SelectCell = ({ 
  getValue, 
  row, 
  column,
  table,
  options 
}: any) => {
  const value = getValue()
  
  const selectOptions: Option[] = options.map((opt: any) => ({
    value: opt.id,
    label: opt.name,
    description: opt.description || undefined
  }))

  return (
    <div className="max-w-[200px]">
      <SearchableSelect
        value={value || ''}
        onChange={(newValue) => {
          table.options.meta?.updateData(row.index, column.id, newValue)
        }}
        options={selectOptions}
        placeholder="Select..."
        searchPlaceholder="Search..."
        className="h-9 text-sm"
      />
    </div>
  )
}

export interface SimulationGridHandle {
  updateScenarios: (scenarios: Scenario[]) => void
  getScenarios: () => Scenario[]
  loadScenarios: (scenarios: Scenario[]) => void
}

export const SimulationGridEnhanced = forwardRef<SimulationGridHandle, SimulationGridProps>(({ 
  materials, 
  sourcingProfiles,
  onCalculate,
  onCalculateScenarios,
  enableRealTimeCalculation = true,
  onSaveSimulation,
  marketplace = 'US',
  estimatedAcosPercent = 20,
  refundProvisionPercent = 2,
  initialScenarios
}, ref) => {
  const [data, setData] = React.useState<Scenario[]>(initialScenarios || [
    {
      id: '1',
      name: 'Scenario 1',
      salePrice: 29.99,
      packSize: 1,
      materialProfileId: null,
      sourcingProfileId: null,
      landedCost: 0,
      fbaFee: 0,
      referralFee: 0,
      netMarginPercent: 0,
      roi: 0,
      hasChanges: false,
      isCalculating: false,
    },
  ])
  const [isCalculating, setIsCalculating] = React.useState(false)
  const [changedScenarios, setChangedScenarios] = React.useState<Set<string>>(new Set())
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false)
  const [simulationName, setSimulationName] = React.useState('')
  const [simulationDescription, setSimulationDescription] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Formatting helpers
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value / 100)
  }

  // Get color classes for net margin
  const getNetMarginColor = (value: number) => {
    if (value > 25) return 'text-green-600 dark:text-green-400 font-semibold'
    if (value >= 15) return 'text-yellow-600 dark:text-yellow-400 font-medium'
    return 'text-red-600 dark:text-red-400 font-medium'
  }

  // Get color classes for ROI
  const getRoiColor = (value: number) => {
    if (value > 50) return 'text-green-600 dark:text-green-400 font-semibold'
    if (value >= 20) return 'text-yellow-600 dark:text-yellow-400 font-medium'
    return 'text-red-600 dark:text-red-400 font-medium'
  }

  // Check if scenario has missing data
  const hasRequiredData = (scenario: Scenario) => {
    return scenario.materialProfileId && scenario.sourcingProfileId && scenario.salePrice > 0
  }

  // Check if scenario is break-even
  const isBreakEven = (scenario: Scenario) => {
    return Math.abs(scenario.netMarginPercent) < 0.5 && scenario.netMarginPercent !== 0
  }

  // Find the most profitable scenario
  const mostProfitableScenario = React.useMemo(() => {
    if (data.length === 0) return null
    return data.reduce((best, current) => {
      if (!hasRequiredData(current)) return best
      if (!best || current.netMarginPercent > best.netMarginPercent) return current
      return best
    }, null as Scenario | null)
  }, [data])

  // Use debounced calculation hook
  const { queueCalculation, isPending, isCalculatingScenario } = useDebouncedCalculation({
    delay: 500,
    onCalculate: async (scenarioIds) => {
      // Mark scenarios as calculating
      setData(prevData => 
        prevData.map(scenario => 
          scenarioIds.includes(scenario.id) 
            ? { ...scenario, isCalculating: true } 
            : scenario
        )
      )

      try {
        await onCalculateScenarios(scenarioIds)
        
        // Mark scenarios as calculated and remove from changed set
        setData(prevData => 
          prevData.map(scenario => 
            scenarioIds.includes(scenario.id) 
              ? { 
                  ...scenario, 
                  isCalculating: false, 
                  hasChanges: false,
                  lastCalculated: new Date().toISOString(),
                  calculationError: undefined
                } 
              : scenario
          )
        )
        setChangedScenarios(prev => {
          const newSet = new Set(prev)
          scenarioIds.forEach(id => newSet.delete(id))
          return newSet
        })
      } catch (error) {
        // Mark scenarios with error
        setData(prevData => 
          prevData.map(scenario => 
            scenarioIds.includes(scenario.id) 
              ? { 
                  ...scenario, 
                  isCalculating: false,
                  calculationError: 'Failed to calculate'
                } 
              : scenario
          )
        )
      }
    }
  })

  const columns = React.useMemo<ColumnDef<Scenario>[]>(
    () => [
      {
        id: 'status',
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center cursor-help">
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Scenario status indicators</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const scenario = row.original
          const isProfitable = mostProfitableScenario?.id === scenario.id
          const breakEven = isBreakEven(scenario)
          const missingData = !hasRequiredData(scenario)
          
          return (
            <div className="flex items-center justify-center gap-1">
              {isProfitable && !missingData && (
                <Tooltip>
                  <TooltipTrigger>
                    <div className="relative">
                      <Trophy className="h-4 w-4 text-yellow-500 fill-yellow-500 animate-pulse" />
                      <div className="absolute inset-0 blur-sm bg-yellow-400 opacity-30 rounded-full" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">Most Profitable Scenario</p>
                    <p className="text-xs text-muted-foreground">Highest net margin percentage</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {breakEven && !missingData && (
                <Tooltip>
                  <TooltipTrigger>
                    <div className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Break-even</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">Break-even Scenario</p>
                    <p className="text-xs text-muted-foreground">Net margin is near zero</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {missingData && (
                <Tooltip>
                  <TooltipTrigger>
                    <AlertTriangle className="h-4 w-4 text-orange-500 animate-pulse" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">Missing Required Data</p>
                    <p className="text-xs text-muted-foreground">Add material and sourcing profiles</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {scenario.isCalculating && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              )}
              {scenario.hasChanges && !scenario.isCalculating && !missingData && (
                <Tooltip>
                  <TooltipTrigger>
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Unsaved changes</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {!scenario.hasChanges && !scenario.isCalculating && scenario.lastCalculated && !missingData && (
                <Tooltip>
                  <TooltipTrigger>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Up to date</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )
        },
        size: 80,
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: EditableTextCell,
        size: 150,
      },
      {
        accessorKey: 'salePrice',
        header: 'Sale Price',
        cell: EditableNumberCell,
        size: 120,
      },
      {
        accessorKey: 'packSize',
        header: 'Pack Size',
        cell: EditableNumberCell,
        size: 100,
      },
      {
        accessorKey: 'materialProfileId',
        header: 'Material Profile',
        cell: (props) => SelectCell({ ...props, options: materials }),
        size: 200,
      },
      {
        accessorKey: 'sourcingProfileId',
        header: 'Sourcing Profile',
        cell: (props) => SelectCell({ ...props, options: sourcingProfiles }),
        size: 200,
      },
      {
        accessorKey: 'landedCost',
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dotted border-muted-foreground">Landed Cost</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Total cost to receive product</p>
              <p className="text-xs text-muted-foreground">Includes material, shipping, duties, and fees</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ getValue }) => {
          const value = getValue() as number
          return (
            <div className="text-right font-medium tabular-nums">
              {formatCurrency(value)}
            </div>
          )
        },
        size: 120,
      },
      {
        accessorKey: 'fbaFee',
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dotted border-muted-foreground">FBA Fee</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Amazon fulfillment fees</p>
              <p className="text-xs text-muted-foreground">Storage and shipping to customer</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ getValue }) => {
          const value = getValue() as number
          return (
            <div className="text-right font-medium tabular-nums">
              {formatCurrency(value)}
            </div>
          )
        },
        size: 120,
      },
      {
        accessorKey: 'referralFee',
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dotted border-muted-foreground">Referral Fee</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Amazon referral commission</p>
              <p className="text-xs text-muted-foreground">Typically 15% of sale price</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ getValue }) => {
          const value = getValue() as number
          return (
            <div className="text-right font-medium tabular-nums">
              {formatCurrency(value)}
            </div>
          )
        },
        size: 120,
      },
      {
        accessorKey: 'netMarginPercent',
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dotted border-muted-foreground flex items-center gap-1">
                <Percent className="h-3 w-3" />
                Net Margin
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Profit margin percentage</p>
              <p className="text-xs text-muted-foreground">(Revenue - All Costs) / Revenue × 100</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ getValue, row }) => {
          const value = getValue() as number
          const scenario = row.original
          const colorClass = getNetMarginColor(value)
          
          return (
            <div className={cn("text-right tabular-nums flex items-center justify-end gap-1", colorClass)}>
              {isBreakEven(scenario) && (
                <div className="w-2 h-2 rounded-full bg-blue-500" title="Break-even" />
              )}
              {formatPercent(value)}
            </div>
          )
        },
        size: 120,
      },
      {
        accessorKey: 'roi',
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dotted border-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                ROI
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Return on Investment</p>
              <p className="text-xs text-muted-foreground">Profit / Investment × 100</p>
            </TooltipContent>
          </Tooltip>
        ),
        cell: ({ getValue }) => {
          const value = getValue() as number
          const colorClass = getRoiColor(value)
          
          return (
            <div className={cn("text-right tabular-nums", colorClass)}>
              {formatPercent(value)}
            </div>
          )
        },
        size: 100,
      },
      {
        id: 'actions',
        header: () => (
          <span className="sr-only">Actions</span>
        ),
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => duplicateRow(row.index)}
              className="h-8 w-8 p-0 hover:bg-muted"
              title="Duplicate scenario"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeRow(row.index)}
              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
              title="Delete scenario"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ),
        size: 100,
      },
    ],
    [materials, sourcingProfiles, mostProfitableScenario, formatCurrency, formatPercent, getNetMarginColor, getRoiColor, isBreakEven]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateData: (rowIndex: number, columnId: string, value: any) => {
        setData(old =>
          old.map((row, index) => {
            if (index === rowIndex) {
              const updatedRow = {
                ...old[rowIndex]!,
                [columnId]: value,
                hasChanges: true,
              }
              
              // Track changed scenario
              setChangedScenarios(prev => new Set(prev).add(updatedRow.id))
              
              // Queue for calculation if real-time is enabled and required fields are present
              if (enableRealTimeCalculation && 
                  updatedRow.materialProfileId && 
                  updatedRow.sourcingProfileId &&
                  updatedRow.salePrice > 0) {
                queueCalculation(updatedRow.id)
              }
              
              return updatedRow
            }
            return row
          })
        )
      },
    },
  })

  const addRow = () => {
    const newRow: Scenario = {
      id: `${Date.now()}`,
      name: `Scenario ${data.length + 1}`,
      salePrice: 0,
      packSize: 1,
      materialProfileId: null,
      sourcingProfileId: null,
      landedCost: 0,
      fbaFee: 0,
      referralFee: 0,
      netMarginPercent: 0,
      roi: 0,
      hasChanges: false,
      isCalculating: false,
    }
    setData([...data, newRow])
  }

  const removeRow = (index: number) => {
    setData(old => old.filter((_, i) => i !== index))
  }

  const duplicateRow = (index: number) => {
    const scenarioToDuplicate = data[index]
    if (!scenarioToDuplicate) return

    const duplicatedScenario: Scenario = {
      ...scenarioToDuplicate,
      id: `${Date.now()}`,
      name: `${scenarioToDuplicate.name} (Copy)`,
      hasChanges: true,
      isCalculating: false,
      lastCalculated: undefined,
    }
    
    setData(old => [...old, duplicatedScenario])
  }

  const clearAllScenarios = () => {
    setData([])
    setChangedScenarios(new Set())
  }

  const handleCalculate = async () => {
    setIsCalculating(true)
    try {
      await onCalculate(data)
    } finally {
      setIsCalculating(false)
    }
  }

  const handleSaveSimulation = async () => {
    if (!onSaveSimulation || !simulationName.trim()) return

    setIsSaving(true)
    try {
      await onSaveSimulation(simulationName, simulationDescription, data)
      setSaveDialogOpen(false)
      setSimulationName('')
      setSimulationDescription('')
    } catch (error) {
      console.error('Failed to save simulation:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const exportToCSV = () => {
    const headers = [
      'Name',
      'Sale Price',
      'Pack Size',
      'Material Profile',
      'Sourcing Profile',
      'Landed Cost',
      'FBA Fee',
      'Referral Fee',
      'Net Margin %',
      'ROI %'
    ]

    const rows = data.map(scenario => {
      const material = materials.find(m => m.id === scenario.materialProfileId)
      const sourcing = sourcingProfiles.find(s => s.id === scenario.sourcingProfileId)
      
      return [
        scenario.name,
        scenario.salePrice,
        scenario.packSize,
        material?.name || '',
        sourcing?.name || '',
        scenario.landedCost.toFixed(2),
        scenario.fbaFee.toFixed(2),
        scenario.referralFee.toFixed(2),
        scenario.netMarginPercent.toFixed(1),
        scenario.roi.toFixed(1)
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `simulation_scenarios_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const lines = content.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) return // Need at least header and one data row

      const headers = lines[0].split(',')
      const scenarios: Scenario[] = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',')
        
        // Find material and sourcing profiles by name
        const materialName = values[3]?.trim()
        const sourcingName = values[4]?.trim()
        const material = materials.find(m => m.name === materialName)
        const sourcing = sourcingProfiles.find(s => s.name === sourcingName)

        scenarios.push({
          id: `${Date.now()}_${i}`,
          name: values[0]?.trim() || `Scenario ${i}`,
          salePrice: parseFloat(values[1]) || 0,
          packSize: parseFloat(values[2]) || 1,
          materialProfileId: material?.id || null,
          sourcingProfileId: sourcing?.id || null,
          landedCost: parseFloat(values[5]) || 0,
          fbaFee: parseFloat(values[6]) || 0,
          referralFee: parseFloat(values[7]) || 0,
          netMarginPercent: parseFloat(values[8]) || 0,
          roi: parseFloat(values[9]) || 0,
          hasChanges: true,
          isCalculating: false,
        })
      }

      setData(scenarios)
    }

    reader.readAsText(file)
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  // Method to update scenarios with calculated values
  useImperativeHandle(ref, () => ({
    updateScenarios: (updatedScenarios: Scenario[]) => {
      setData(prevData => {
        // Create a map for quick lookup
        const updatedMap = new Map(updatedScenarios.map(s => [s.id, s]))
        
        return prevData.map(scenario => {
          const updated = updatedMap.get(scenario.id)
          if (updated) {
            return {
              ...updated,
              hasChanges: false,
              isCalculating: false,
              lastCalculated: new Date().toISOString(),
              calculationError: undefined
            }
          }
          return scenario
        })
      })
      
      // Clear changed scenarios that were updated
      setChangedScenarios(prev => {
        const newSet = new Set(prev)
        updatedScenarios.forEach(s => newSet.delete(s.id))
        return newSet
      })
    },
    getScenarios: () => data,
    loadScenarios: (scenarios: Scenario[]) => setData(scenarios)
  }), [data])

  return (
    <TooltipProvider>
      <Card className="shadow-lg border-muted/50">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
          <div>
            <CardTitle className="text-2xl font-bold">Simulation Scenarios</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Compare multiple pricing scenarios to find your optimal strategy</p>
          </div>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <Button 
              onClick={addRow} 
              size="sm"
              className="shadow-sm hover:shadow transition-shadow"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Scenario
            </Button>
          
          {onSaveSimulation && (
            <AlertDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={data.length === 0}
                  aria-label="Save Simulation"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Simulation
                </Button>
              </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Save Simulation</AlertDialogTitle>
                <AlertDialogDescription>
                  Save the current simulation scenarios for later use.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <FloatingInput
                    label="Simulation Name"
                    value={simulationName}
                    onChange={(e) => setSimulationName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="simulation-description">Description (optional)</Label>
                  <Textarea
                    id="simulation-description"
                    value={simulationDescription}
                    onChange={(e) => setSimulationDescription(e.target.value)}
                    placeholder="Enter description"
                    rows={3}
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleSaveSimulation}
                  disabled={!simulationName.trim() || isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                size="sm" 
                variant="outline"
                disabled={data.length === 0}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear All Scenarios</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to clear all scenarios? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearAllScenarios}>
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button 
            onClick={exportToCSV} 
            size="sm" 
            variant="outline"
            disabled={data.length === 0}
            aria-label="Export CSV"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={importFromCSV}
            className="hidden"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            size="sm" 
            variant="outline"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>

          <Button 
            onClick={handleCalculate} 
            size="sm" 
            variant="default"
            disabled={isCalculating || data.length === 0}
            className="shadow-sm hover:shadow-md transition-all bg-primary hover:bg-primary/90"
          >
            {isCalculating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Calculate All
              </>
            )}
          </Button>
        </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative">
            <div className="overflow-x-auto rounded-lg">
              <table className="w-full min-w-[1200px]">
                <thead>
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id} className="border-b bg-gradient-to-r from-muted/30 to-muted/10">
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          className="px-3 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                          style={{
                            width: header.column.getSize(),
                            minWidth: header.column.getSize(),
                          }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-muted/50">
                  {table.getRowModel().rows.map((row, index) => {
                    const scenario = row.original
                    const isProfitable = mostProfitableScenario?.id === scenario.id
                    return (
                      <tr 
                        key={row.id} 
                        className={cn(
                          "group transition-all duration-200",
                          "hover:bg-muted/20 hover:shadow-sm",
                          scenario.hasChanges && "bg-amber-50/50 dark:bg-amber-950/10",
                          scenario.isCalculating && "bg-blue-50/50 dark:bg-blue-950/10 animate-pulse",
                          isProfitable && hasRequiredData(scenario) && "bg-gradient-to-r from-yellow-50/20 to-transparent dark:from-yellow-950/10"
                        )}
                      >
                        {row.getVisibleCells().map(cell => (
                          <td
                            key={cell.id}
                            className={cn(
                              "px-3 py-3 transition-colors duration-200",
                              "group-hover:bg-muted/10"
                            )}
                            style={{
                              width: cell.column.getSize(),
                              minWidth: cell.column.getSize(),
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Scroll indicator */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none opacity-0 transition-opacity duration-300 lg:hidden" />
          </div>
          {data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="rounded-full bg-muted/30 p-4 mb-4">
                <Calculator className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-muted-foreground mb-2">No scenarios yet</p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Start by adding a scenario to compare different pricing strategies and find your optimal profit margins.
              </p>
              <Button onClick={addRow} size="sm" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Scenario
              </Button>
            </div>
          )}
          
          {/* Status Legend and Info */}
          {data.length > 0 && (
            <div className="px-6 py-4 border-t border-muted/50 bg-muted/5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                    <span className="text-muted-foreground">Most Profitable</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Break-even</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                    <span className="text-muted-foreground">Missing Data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-muted-foreground">Unsaved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-muted-foreground">Calculated</span>
                  </div>
                </div>
                {enableRealTimeCalculation && (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-muted-foreground">Real-time calculation active</span>
                  </div>
                )}
              </div>
              
              {/* Color coding legend */}
              <div className="mt-3 pt-3 border-t border-muted/50 flex flex-wrap gap-6 text-xs">
                <div>
                  <span className="font-medium text-muted-foreground">Net Margin:</span>
                  <span className="ml-2 text-green-600 dark:text-green-400">●</span>
                  <span className="ml-1 text-muted-foreground">&gt;25%</span>
                  <span className="ml-2 text-yellow-600 dark:text-yellow-400">●</span>
                  <span className="ml-1 text-muted-foreground">15-25%</span>
                  <span className="ml-2 text-red-600 dark:text-red-400">●</span>
                  <span className="ml-1 text-muted-foreground">&lt;15%</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">ROI:</span>
                  <span className="ml-2 text-green-600 dark:text-green-400">●</span>
                  <span className="ml-1 text-muted-foreground">&gt;50%</span>
                  <span className="ml-2 text-yellow-600 dark:text-yellow-400">●</span>
                  <span className="ml-1 text-muted-foreground">20-50%</span>
                  <span className="ml-2 text-red-600 dark:text-red-400">●</span>
                  <span className="ml-1 text-muted-foreground">&lt;20%</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
})

SimulationGridEnhanced.displayName = 'SimulationGridEnhanced'
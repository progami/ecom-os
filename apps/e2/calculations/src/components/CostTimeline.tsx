'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Calendar, DollarSign, Edit2, Plus, Save, X, TrendingUp, TrendingDown, Package } from 'lucide-react'
import { format, isWithinInterval, differenceInDays } from 'date-fns'

interface BatchCostPeriod {
  id: string
  sku: string
  startDate: string
  endDate: string | null
  manufacturingCost: number
  freightCost: number
  tariffCost: number
  otherCost: number
  unitLandedCost: number
  notes: string | null
  source: string | null
  isActive: boolean
}

interface CostTimelineProps {
  selectedSku: string
  productData: any
}

export function CostTimeline({ selectedSku, productData }: CostTimelineProps) {
  const [periods, setPeriods] = useState<BatchCostPeriod[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<BatchCostPeriod>>({})
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [hoveredPeriod, setHoveredPeriod] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Record<string, any>>({})
  const [tariffRate, setTariffRate] = useState(0.35) // Default value
  const [amazonFees, setAmazonFees] = useState({
    referralRate: 0.15,
    returnAllowance: 0.01
  })

  useEffect(() => {
    // Load products and config from API
    const loadData = async () => {
      try {
        // Load products
        const productsResponse = await fetch('/api/products?format=dashboard')
        if (!productsResponse.ok) {
          throw new Error('Failed to fetch products')
        }
        const productsData = await productsResponse.json()
        setProducts(productsData)
        
        // Load config
        const configResponse = await fetch('/api/config')
        if (configResponse.ok) {
          const config = await configResponse.json()
          if (config.businessRules) {
            setTariffRate(config.businessRules.tariffRate || 0.35)
            setAmazonFees({
              referralRate: config.businessRules.amazonReferralRate || 0.15,
              returnAllowance: config.businessRules.amazonReturnAllowance || 0.01
            })
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    if (selectedSku) {
      loadPeriods(selectedSku)
    }
  }, [selectedSku])

  const loadPeriods = async (sku: string) => {
    try {
      setError(null)
      const response = await fetch(`/api/batch-cost-periods?sku=${sku}`)
      if (!response.ok) {
        throw new Error('Failed to load cost periods')
      }
      const data = await response.json()
      setPeriods(data || [])
    } catch (err) {
      console.error('Error loading periods:', err)
      setError('Failed to load cost periods')
      setPeriods([])
    }
  }

  const getCurrentPeriod = () => {
    const today = new Date()
    return periods.find(p => {
      const start = new Date(p.startDate)
      const end = p.endDate ? new Date(p.endDate) : new Date('2099-12-31')
      return isWithinInterval(today, { start, end })
    })
  }

  const getUpcomingPeriods = () => {
    const today = new Date()
    return periods.filter(p => new Date(p.startDate) > today).slice(0, 2)
  }

  const startEdit = (period: BatchCostPeriod) => {
    setEditingId(period.id)
    setEditForm({
      manufacturingCost: period.manufacturingCost,
      freightCost: period.freightCost,
      tariffCost: period.tariffCost,
      otherCost: period.otherCost,
      startDate: period.startDate,
      endDate: period.endDate,
      source: period.source,
      notes: period.notes
    })
  }

  const handleSave = async () => {
    if (!editingId && !isAddingNew) return
    
    setLoading(true)
    try {
      const payload = {
        ...editForm,
        sku: selectedSku,
        manufacturingCost: parseFloat(editForm.manufacturingCost?.toString() || '0'),
        freightCost: parseFloat(editForm.freightCost?.toString() || '0'),
        tariffCost: parseFloat(editForm.tariffCost?.toString() || '0'),
        otherCost: parseFloat(editForm.otherCost?.toString() || '0')
      }

      if (editingId) {
        await fetch('/api/batch-cost-periods', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: editingId })
        })
      } else {
        await fetch('/api/batch-cost-periods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      await loadPeriods(selectedSku)
      setEditingId(null)
      setIsAddingNew(false)
      setEditForm({})
    } catch (err) {
      console.error('Error saving:', err)
    } finally {
      setLoading(false)
    }
  }

  const startAddNew = () => {
    const product = products[selectedSku] || productData[selectedSku]
    const lastPeriod = periods[0] // Assuming sorted by date desc
    const startDate = lastPeriod?.endDate 
      ? new Date(new Date(lastPeriod.endDate).getTime() + 24*60*60*1000)
      : new Date()

    setIsAddingNew(true)
    setEditForm({
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: null,
      manufacturingCost: product.manufacturingCost,
      freightCost: product.freightCost,
      tariffCost: product.manufacturingCost * tariffRate,
      otherCost: 0,
      source: '',
      notes: ''
    })
  }

  const currentPeriod = getCurrentPeriod()
  const upcomingPeriods = getUpcomingPeriods()
  const currentMargin = currentPeriod ? calculateMargin(currentPeriod, productData[selectedSku], amazonFees) : 0

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-red-600">
            <p>Error: {error}</p>
            <Button onClick={() => loadPeriods(selectedSku)} className="mt-4">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Cost Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Current Cost</CardTitle>
            <CardDescription className="text-xs">Active as of today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                ${currentPeriod?.unitLandedCost.toFixed(2) || '0.00'}
                <span className="text-sm font-normal text-muted-foreground">/unit</span>
              </div>
              {currentPeriod && (
                <div className="text-xs text-muted-foreground">
                  {currentPeriod.source || 'Standard Cost'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Current Margin</CardTitle>
            <CardDescription className="text-xs">At ${productData[selectedSku]?.price || 0}/unit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMargin.toFixed(1)}%
              <Badge 
                variant={currentMargin > 30 ? 'default' : currentMargin > 20 ? 'secondary' : 'destructive'}
                className="ml-2"
              >
                ${((productData[selectedSku]?.price || 0) - (currentPeriod?.unitLandedCost || 0)).toFixed(2)} profit
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Next Change</CardTitle>
            <CardDescription className="text-xs">Upcoming cost adjustment</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingPeriods.length > 0 ? (
              <div className="space-y-1">
                <div className="text-lg font-bold">
                  ${upcomingPeriods[0].unitLandedCost.toFixed(2)}
                  {upcomingPeriods[0].unitLandedCost > (currentPeriod?.unitLandedCost || 0) ? (
                    <TrendingUp className="inline h-4 w-4 text-red-500 ml-1" />
                  ) : (
                    <TrendingDown className="inline h-4 w-4 text-green-500 ml-1" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(upcomingPeriods[0].startDate), 'MMM dd, yyyy')}
                  ({differenceInDays(new Date(upcomingPeriods[0].startDate), new Date())} days)
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No changes scheduled</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Cost Timeline</CardTitle>
              <CardDescription>Click any period to edit, or add new periods</CardDescription>
            </div>
            <Button size="sm" onClick={startAddNew} disabled={isAddingNew}>
              <Plus className="h-4 w-4 mr-1" />
              Add Period
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Timeline items */}
            {periods.map((period, index) => {
              const isEditing = editingId === period.id
              const isActive = currentPeriod?.id === period.id
              const margin = calculateMargin(period, productData[selectedSku], amazonFees)
              
              return (
                <div
                  key={period.id}
                  className={`
                    relative p-4 rounded-lg border-2 transition-all
                    ${isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                    ${hoveredPeriod === period.id && !isEditing ? 'shadow-md' : ''}
                    ${isEditing ? 'border-primary shadow-lg' : ''}
                  `}
                  onMouseEnter={() => setHoveredPeriod(period.id)}
                  onMouseLeave={() => setHoveredPeriod(null)}
                >
                  {isEditing ? (
                    <EditingForm
                      form={editForm}
                      setForm={setEditForm}
                      onSave={handleSave}
                      onCancel={() => {
                        setEditingId(null)
                        setEditForm({})
                      }}
                      loading={loading}
                      tariffRate={tariffRate}
                    />
                  ) : (
                    <PeriodDisplay
                      period={period}
                      margin={margin}
                      isActive={isActive}
                      onEdit={() => startEdit(period)}
                    />
                  )}
                </div>
              )
            })}

            {/* Add new form */}
            {isAddingNew && (
              <div className="relative p-4 rounded-lg border-2 border-dashed border-primary bg-primary/5">
                <EditingForm
                  form={editForm}
                  setForm={setEditForm}
                  onSave={handleSave}
                  onCancel={() => {
                    setIsAddingNew(false)
                    setEditForm({})
                  }}
                  loading={loading}
                  tariffRate={tariffRate}
                  isNew
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper components
function PeriodDisplay({ period, margin, isActive, onEdit }: any) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className={`w-2 h-12 rounded ${isActive ? 'bg-blue-500' : 'bg-gray-300'}`} />
        <div>
          <div className="font-medium">
            {format(new Date(period.startDate), 'MMM dd, yyyy')}
            {period.endDate && ` - ${format(new Date(period.endDate), 'MMM dd, yyyy')}`}
            {!period.endDate && ' - Ongoing'}
          </div>
          <div className="text-sm text-muted-foreground">
            ${period.unitLandedCost.toFixed(2)}/unit
            {period.source && ` • ${period.source}`}
          </div>
          {period.notes && (
            <div className="text-xs text-muted-foreground mt-1">{period.notes}</div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right">
          <Badge variant={margin > 30 ? 'default' : margin > 20 ? 'secondary' : 'destructive'}>
            {margin.toFixed(1)}% margin
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function EditingForm({ form, setForm, onSave, onCancel, loading, isNew = false, tariffRate = 0.35 }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Start Date</Label>
          <Input
            type="date"
            value={form.startDate || ''}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">End Date</Label>
          <Input
            type="date"
            value={form.endDate || ''}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            placeholder="Ongoing"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Manufacturing</Label>
          <Input
            type="number"
            step="0.01"
            value={form.manufacturingCost || ''}
            onChange={(e) => {
              const val = e.target.value
              setForm({ 
                ...form, 
                manufacturingCost: val,
                tariffCost: val ? (parseFloat(val) * tariffRate).toFixed(2) : ''
              })
            }}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Freight</Label>
          <Input
            type="number"
            step="0.01"
            value={form.freightCost || ''}
            onChange={(e) => setForm({ ...form, freightCost: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Tariff (35%)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.tariffCost || ''}
            onChange={(e) => setForm({ ...form, tariffCost: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Source/PO</Label>
          <Input
            value={form.source || ''}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder="e.g., PO-2025-001"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Notes</Label>
          <Input
            value={form.notes || ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional notes"
            className="h-8 text-sm"
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={loading}>
          <Save className="h-4 w-4 mr-1" />
          {isNew ? 'Add' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

function calculateMargin(period: BatchCostPeriod, product: any, amazonFees: { referralRate: number; returnAllowance: number }): number {
  if (!product) return 0
  const totalCost = period.unitLandedCost + product.warehouseCost + product.fulfillmentFee + 
                   (product.price * amazonFees.referralRate) + (product.price * amazonFees.returnAllowance) // Amazon Expenses
  return ((product.price - totalCost) / product.price) * 100
}
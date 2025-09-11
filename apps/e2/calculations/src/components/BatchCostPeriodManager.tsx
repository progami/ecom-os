'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Calendar, DollarSign, Edit2, Plus, Save, Trash2, X } from 'lucide-react'
import { format } from 'date-fns'

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

interface BatchCostPeriodManagerProps {
  selectedSku: string | null
  onSkuChange: (sku: string) => void
}

export function BatchCostPeriodManager({ selectedSku, onSkuChange }: BatchCostPeriodManagerProps) {
  const [periods, setPeriods] = useState<BatchCostPeriod[]>([])
  const [editingPeriod, setEditingPeriod] = useState<BatchCostPeriod | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [tariffRate, setTariffRate] = useState(0.35) // Default value
  const [formData, setFormData] = useState({
    sku: '',
    startDate: '',
    endDate: '',
    manufacturingCost: '',
    freightCost: '',
    tariffCost: '',
    otherCost: '0',
    notes: '',
    source: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Record<string, any>>({})

  // Load products and config on mount
  useEffect(() => {
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
          if (config.businessRules?.tariffRate) {
            setTariffRate(config.businessRules.tariffRate)
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error)
        setError('Failed to load data')
      }
    }
    loadData()
  }, [])

  // Load periods when SKU changes
  useEffect(() => {
    if (selectedSku) {
      loadPeriods(selectedSku)
    }
  }, [selectedSku])

  const loadPeriods = async (sku: string) => {
    try {
      const response = await fetch(`/api/batch-cost-periods?sku=${sku}`)
      const data = await response.json()
      setPeriods(data)
    } catch (err) {
      console.error('Error loading periods:', err)
    }
  }

  const handleAddNew = () => {
    if (!selectedSku) return
    
    const product = products[selectedSku]
    if (!product) return
    
    setFormData({
      sku: selectedSku,
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: '',
      manufacturingCost: product.manufacturingCost.toString(),
      freightCost: product.freightCost.toString(),
      tariffCost: (product.manufacturingCost * tariffRate).toFixed(2),
      otherCost: '0',
      notes: '',
      source: ''
    })
    setIsAddingNew(true)
    setEditingPeriod(null)
  }

  const handleEdit = (period: BatchCostPeriod) => {
    setFormData({
      sku: period.sku,
      startDate: format(new Date(period.startDate), 'yyyy-MM-dd'),
      endDate: period.endDate ? format(new Date(period.endDate), 'yyyy-MM-dd') : '',
      manufacturingCost: period.manufacturingCost.toString(),
      freightCost: period.freightCost.toString(),
      tariffCost: period.tariffCost.toString(),
      otherCost: period.otherCost.toString(),
      notes: period.notes || '',
      source: period.source || ''
    })
    setEditingPeriod(period)
    setIsAddingNew(false)
  }

  const handleCancel = () => {
    setEditingPeriod(null)
    setIsAddingNew(false)
    setError(null)
  }

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const payload = {
        ...formData,
        manufacturingCost: parseFloat(formData.manufacturingCost),
        freightCost: parseFloat(formData.freightCost),
        tariffCost: parseFloat(formData.tariffCost),
        otherCost: parseFloat(formData.otherCost || '0'),
        endDate: formData.endDate || null
      }

      if (editingPeriod) {
        // Update existing
        const response = await fetch('/api/batch-cost-periods', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: editingPeriod.id })
        })
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to update period')
        }
      } else {
        // Create new
        const response = await fetch('/api/batch-cost-periods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to create period')
        }
      }

      // Reload periods
      if (selectedSku) {
        await loadPeriods(selectedSku)
      }
      
      handleCancel()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cost period?')) return
    
    try {
      const response = await fetch(`/api/batch-cost-periods?id=${id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete period')
      }
      
      if (selectedSku) {
        await loadPeriods(selectedSku)
      }
    } catch (err) {
      console.error('Error deleting period:', err)
    }
  }

  const calculateTariff = () => {
    const manufacturing = parseFloat(formData.manufacturingCost)
    if (!isNaN(manufacturing)) {
      setFormData(prev => ({
        ...prev,
        tariffCost: (manufacturing * tariffRate).toFixed(2)
      }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Cost Periods</CardTitle>
        <CardDescription>
          Define cost periods for inventory batches with specific date ranges
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* SKU Selector */}
          <div className="flex items-center gap-4">
            <Select value={selectedSku || ''} onValueChange={onSkuChange}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(products).map(([sku, product]) => (
                  <SelectItem key={sku} value={sku}>
                    {sku} - {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedSku && (
              <Button onClick={handleAddNew} size="sm" disabled={isAddingNew || !!editingPeriod}>
                <Plus className="h-4 w-4 mr-1" />
                Add Period
              </Button>
            )}
          </div>

          {/* Add/Edit Form */}
          {(isAddingNew || editingPeriod) && (
            <Card className="border-2 border-primary/20">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>End Date (optional)</Label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                      placeholder="Leave empty for ongoing"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Manufacturing Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.manufacturingCost}
                      onChange={(e) => setFormData(prev => ({ ...prev, manufacturingCost: e.target.value }))}
                      onBlur={calculateTariff}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Freight Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.freightCost}
                      onChange={(e) => setFormData(prev => ({ ...prev, freightCost: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Tariff Cost (35%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.tariffCost}
                      onChange={(e) => setFormData(prev => ({ ...prev, tariffCost: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Other Costs</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.otherCost}
                      onChange={(e) => setFormData(prev => ({ ...prev, otherCost: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Source (PO#, etc.)</Label>
                    <Input
                      value={formData.source}
                      onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                      placeholder="e.g., PO-2025-001"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </div>
                
                {error && (
                  <div className="mt-4 p-2 bg-red-50 text-red-600 rounded text-sm">
                    {error}
                  </div>
                )}
                
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={handleCancel} disabled={loading}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={loading}>
                    <Save className="h-4 w-4 mr-1" />
                    {editingPeriod ? 'Update' : 'Create'} Period
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Periods List */}
          {selectedSku && periods.length > 0 && (
            <div className="space-y-2">
              {periods.map((period) => {
                const totalCost = period.manufacturingCost + period.freightCost + 
                                 period.tariffCost + period.otherCost
                
                return (
                  <div
                    key={period.id}
                    className={`p-4 border rounded-lg ${
                      !period.isActive ? 'opacity-50' : ''
                    } ${editingPeriod?.id === period.id ? 'border-primary' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {format(new Date(period.startDate), 'MMM dd, yyyy')}
                            {period.endDate && ` - ${format(new Date(period.endDate), 'MMM dd, yyyy')}`}
                            {!period.endDate && ' - Ongoing'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {period.source && `Source: ${period.source} | `}
                            Landed Cost: ${period.unitLandedCost.toFixed(2)}/unit
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-4">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Mfg:</span> ${period.manufacturingCost.toFixed(2)}
                            <span className="text-muted-foreground ml-2">Freight:</span> ${period.freightCost.toFixed(2)}
                            <span className="text-muted-foreground ml-2">Tariff:</span> ${period.tariffCost.toFixed(2)}
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(period)}
                          disabled={isAddingNew || (editingPeriod !== null && editingPeriod.id !== period.id)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(period.id)}
                          disabled={isAddingNew || !!editingPeriod}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {period.notes && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {period.notes}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {selectedSku && periods.length === 0 && !isAddingNew && (
            <div className="text-center py-8 text-muted-foreground">
              No cost periods defined. Click "Add Period" to create one.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
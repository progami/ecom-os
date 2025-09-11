'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'react-hot-toast'

interface AddProductModalProps {
  isOpen: boolean
  onClose: () => void
  onProductAdded: () => void
  strategyId?: string
}

export function AddProductModal({ isOpen, onClose, onProductAdded, strategyId }: AddProductModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    // Basic Information
    sku: '',
    name: '',
    category: '',
    
    // Pricing & Costs
    pricing: 0,
    manufacturing: 0,
    freight: 0,
    tariff: 0,
    tariffRate: 0.35,
    
    // Amazon Fees
    fulfillmentFee: 0,
    referralFee: 0,
    awd: 0,
    tacos: 0.15, // Default 15%
    
    // Inventory
    currentStock: 0,
    reorderPoint: 0,
    reorderQuantity: 0,
    
    // Physical Specs (REQUIRED for Product Settings)
    length: 0,
    width: 0,
    height: 0,
    weightGrams: 0,
    weightOz: 0,
    weightLb: 0,
    packSize: 1,
    micron: 0,
    density: 0,
    
    // Additional
    country: '',
    sourcingCountry: '',
    destinationMarket: 'US',
    sizeTier: '',
    refundRate: 0.01, // Default 1%
  })

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Auto-calculate tariff when manufacturing or tariffRate changes
    if (field === 'manufacturing' || field === 'tariffRate') {
      const manufacturing = field === 'manufacturing' ? Number(value) : formData.manufacturing
      const rate = field === 'tariffRate' ? Number(value) : formData.tariffRate
      setFormData(prev => ({
        ...prev,
        tariff: manufacturing * rate
      }))
    }
    
    // Auto-calculate referral fee when pricing changes (15% default for Amazon)
    if (field === 'pricing') {
      setFormData(prev => ({
        ...prev,
        referralFee: Number(value) * 0.15
      }))
    }
  }

  const handleSubmit = async () => {
    // Validation
    if (!formData.sku || !formData.name || !formData.category) {
      toast.error('Please fill in SKU, Name, and Category')
      return
    }

    if (formData.pricing <= 0) {
      toast.error('Price must be greater than 0')
      return
    }

    setIsSubmitting(true)

    try {
      // Calculate invested cost
      const investedCost = formData.manufacturing + formData.freight + formData.tariff

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: formData.sku,
          name: formData.name,
          category: formData.category,
          amazonPrice: formData.pricing,
          manufacturingCost: formData.manufacturing,
          freightCost: formData.freight,
          warehouseCost: formData.awd,
          fulfillmentFee: formData.fulfillmentFee,
          tariffRate: formData.tariffRate,
          tacos: formData.tacos,
          refundRate: formData.refundRate,
          strategyId,
          // Physical specs
          length: formData.length,
          width: formData.width,
          height: formData.height,
          weightGrams: formData.weightGrams,
          packSize: formData.packSize,
          sourcingCountry: formData.sourcingCountry,
          destinationMarket: formData.destinationMarket || 'US',
          micron: formData.micron,
          density: formData.density,
          weightOz: formData.weightOz,
          weightLb: formData.weightLb,
          currentStock: formData.currentStock,
          reorderPoint: formData.reorderPoint || null,
          reorderQuantity: formData.reorderQuantity || null
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || 'Failed to create product')
      }

      toast.success('Product created successfully')
      onProductAdded()
      onClose()
      
      // Reset form
      setFormData({
        sku: '',
        name: '',
        category: '',
        pricing: 0,
        manufacturing: 0,
        freight: 0,
        tariff: 0,
        tariffRate: 0.35,
        fulfillmentFee: 0,
        referralFee: 0,
        awd: 0,
        tacos: 0.15,
        currentStock: 0,
        reorderPoint: 0,
        reorderQuantity: 0,
        length: 0,
        width: 0,
        height: 0,
        weightGrams: 0,
        weightOz: 0,
        weightLb: 0,
        packSize: 1,
        micron: 0,
        density: 0,
        country: '',
        sourcingCountry: '',
        destinationMarket: 'US',
        sizeTier: '',
        refundRate: 0.01,
      })
    } catch (error) {
      console.error('Error creating product:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create product')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Create a new product linked to the active strategy
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
            <TabsTrigger value="fees">Fees</TabsTrigger>
            <TabsTrigger value="specs">Specs</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => handleInputChange('sku', e.target.value)}
                  placeholder="e.g., PROD-001"
                />
              </div>
              <div>
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., Premium Widget"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  placeholder="e.g., Electronics"
                />
              </div>
              <div>
                <Label htmlFor="pricing">Selling Price ($) *</Label>
                <Input
                  id="pricing"
                  type="number"
                  step="0.01"
                  value={formData.pricing}
                  onChange={(e) => handleInputChange('pricing', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="currentStock">Current Stock</Label>
                <Input
                  id="currentStock"
                  type="number"
                  value={formData.currentStock}
                  onChange={(e) => handleInputChange('currentStock', parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="reorderPoint">Reorder Point</Label>
                <Input
                  id="reorderPoint"
                  type="number"
                  value={formData.reorderPoint}
                  onChange={(e) => handleInputChange('reorderPoint', parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="reorderQuantity">Reorder Quantity</Label>
                <Input
                  id="reorderQuantity"
                  type="number"
                  value={formData.reorderQuantity}
                  onChange={(e) => handleInputChange('reorderQuantity', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="costs" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="manufacturing">Manufacturing Cost ($/unit)</Label>
                <Input
                  id="manufacturing"
                  type="number"
                  step="0.01"
                  value={formData.manufacturing}
                  onChange={(e) => handleInputChange('manufacturing', parseFloat(e.target.value) || 0)}
                  placeholder="Cost per unit"
                />
              </div>
              <div>
                <Label htmlFor="freight">Freight Cost ($/unit)</Label>
                <Input
                  id="freight"
                  type="number"
                  step="0.01"
                  value={formData.freight}
                  onChange={(e) => handleInputChange('freight', parseFloat(e.target.value) || 0)}
                  placeholder="Shipping cost per unit"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tariffRate">Tariff Rate (%)</Label>
                <Input
                  id="tariffRate"
                  type="number"
                  step="0.01"
                  value={formData.tariffRate * 100}
                  onChange={(e) => handleInputChange('tariffRate', (parseFloat(e.target.value) || 0) / 100)}
                />
              </div>
              <div>
                <Label htmlFor="tariff">Calculated Tariff ($/unit)</Label>
                <Input
                  id="tariff"
                  type="number"
                  step="0.01"
                  value={formData.tariff.toFixed(2)}
                  disabled
                  className="bg-gray-50"
                  placeholder="Auto-calculated"
                />
              </div>
            </div>

            <div className="p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-700">
                Invested Cost: ${(formData.manufacturing + formData.freight + formData.tariff).toFixed(2)}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="fees" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fulfillmentFee">FBA Fee ($/unit) - Optional</Label>
                <Input
                  id="fulfillmentFee"
                  type="number"
                  step="0.01"
                  value={formData.fulfillmentFee}
                  onChange={(e) => handleInputChange('fulfillmentFee', parseFloat(e.target.value) || 0)}
                  placeholder="Leave 0 to auto-calculate from dimensions"
                />
              </div>
              <div>
                <Label htmlFor="referralFee">Referral Fee ($/unit)</Label>
                <Input
                  id="referralFee"
                  type="number"
                  step="0.01"
                  value={formData.referralFee}
                  onChange={(e) => handleInputChange('referralFee', parseFloat(e.target.value) || 0)}
                  placeholder="Auto-calculated as 15% of price"
                  className="bg-gray-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="awd">AWD Storage Fee ($/unit)</Label>
                <Input
                  id="awd"
                  type="number"
                  step="0.01"
                  value={formData.awd}
                  onChange={(e) => handleInputChange('awd', parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 0.50"
                />
              </div>
              <div>
                <Label htmlFor="tacos">TACoS (Advertising %)</Label>
                <Input
                  id="tacos"
                  type="number"
                  step="0.01"
                  value={formData.tacos * 100}
                  onChange={(e) => handleInputChange('tacos', (parseFloat(e.target.value) || 0) / 100)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="refundRate">Refund Rate (%)</Label>
              <Input
                id="refundRate"
                type="number"
                step="0.01"
                value={formData.refundRate * 100}
                onChange={(e) => handleInputChange('refundRate', (parseFloat(e.target.value) || 0) / 100)}
              />
            </div>
          </TabsContent>

          <TabsContent value="specs" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="length">Length (cm)</Label>
                <Input
                  id="length"
                  type="number"
                  step="0.1"
                  value={formData.length}
                  onChange={(e) => handleInputChange('length', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="width">Width (cm)</Label>
                <Input
                  id="width"
                  type="number"
                  step="0.1"
                  value={formData.width}
                  onChange={(e) => handleInputChange('width', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  value={formData.height}
                  onChange={(e) => handleInputChange('height', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="weightGrams">Weight (grams) *</Label>
                <Input
                  id="weightGrams"
                  type="number"
                  step="0.1"
                  value={formData.weightGrams}
                  onChange={(e) => {
                    const grams = parseFloat(e.target.value) || 0
                    handleInputChange('weightGrams', grams)
                    handleInputChange('weightOz', grams * 0.035274)
                    handleInputChange('weightLb', grams * 0.00220462)
                  }}
                />
              </div>
              <div>
                <Label htmlFor="weightOz">Weight (oz)</Label>
                <Input
                  id="weightOz"
                  type="number"
                  step="0.01"
                  value={formData.weightOz.toFixed(2)}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="weightLb">Weight (lb)</Label>
                <Input
                  id="weightLb"
                  type="number"
                  step="0.001"
                  value={formData.weightLb.toFixed(3)}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="packSize">Pack Size (must be whole number)</Label>
                <Input
                  id="packSize"
                  type="number"
                  step="1"
                  min="1"
                  value={formData.packSize}
                  onChange={(e) => handleInputChange('packSize', Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="Units per pack"
                  pattern="[0-9]*"
                />
              </div>
              <div>
                <Label htmlFor="micron">Micron (thickness)</Label>
                <Input
                  id="micron"
                  type="number"
                  step="0.1"
                  value={formData.micron}
                  onChange={(e) => handleInputChange('micron', parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 50"
                />
              </div>
              <div>
                <Label htmlFor="density">Density (g/cm³)</Label>
                <Input
                  id="density"
                  type="number"
                  step="0.01"
                  value={formData.density}
                  onChange={(e) => handleInputChange('density', parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 0.92"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sourcingCountry">Sourcing Country</Label>
                <Input
                  id="sourcingCountry"
                  value={formData.sourcingCountry}
                  onChange={(e) => handleInputChange('sourcingCountry', e.target.value)}
                  placeholder="e.g., China"
                />
              </div>
              <div>
                <Label htmlFor="destinationMarket">Destination Market</Label>
                <Input
                  id="destinationMarket"
                  value={formData.destinationMarket}
                  onChange={(e) => handleInputChange('destinationMarket', e.target.value)}
                  placeholder="e.g., USA"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="sizeTier">Size Tier (Auto-calculated from dimensions)</Label>
              <Input
                id="sizeTier"
                value={formData.sizeTier}
                disabled
                className="bg-gray-50"
                placeholder="Will be calculated from dimensions and weight"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
'use client'

import React, { useState, useEffect } from 'react'
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
import { Package } from 'lucide-react'
import SharedFinancialDataService from '@/lib/services/SharedFinancialDataService'

interface RevenueModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRevenueAdded: () => void
}

interface Product {
  sku: string
  name: string
  retailPrice: number
}

export function RevenueModal({ open, onOpenChange, onRevenueAdded }: RevenueModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedSKU, setSelectedSKU] = useState('')
  const [units, setUnits] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  
  const sharedDataService = SharedFinancialDataService.getInstance()

  useEffect(() => {
    // Get product data from API
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/products?format=dashboard')
        if (!response.ok) {
          throw new Error('Failed to fetch products')
        }
        const productsData = await response.json()
        
        const productList = Object.entries(productsData).map(([sku, product]: [string, any]) => ({
          sku: sku,
          name: product.name,
          retailPrice: product.price
        }))
        
        setProducts(productList)
        if (productList.length > 0) {
          setSelectedSKU(productList[0].sku)
        }
      } catch (error) {
        console.error('Failed to load products:', error)
      }
    }
    
    loadProducts()
  }, [])

  const handleSubmit = () => {
    if (!date || !selectedSKU || !units) return

    const parsedUnits = parseInt(units)
    if (isNaN(parsedUnits) || parsedUnits <= 0) return

    const product = products.find(p => p.sku === selectedSKU)
    if (!product) return

    // Convert date to year-month format
    const dateObj = new Date(date)
    const yearMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
    
    // Update revenue data in SharedFinancialDataService
    // TODO: Fix this - getAllData() method doesn't exist
    // const currentRevenue = sharedDataService.getAllData().revenue
    const currentRevenue: any = {}
    if (!currentRevenue[yearMonth]) {
      currentRevenue[yearMonth] = {}
    }
    
    // Get selected product info
    const selectedProduct = products.find(p => p.sku === selectedSKU)
    if (!selectedProduct) return
    
    // Calculate gross revenue
    const grossRevenue = parsedUnits * selectedProduct.retailPrice
    
    // Add to existing data for this SKU
    const existingData = currentRevenue[yearMonth][selectedSKU] || { grossRevenue: 0, units: 0 }
    const newUnits = existingData.units + parsedUnits
    const newGrossRevenue = existingData.grossRevenue + grossRevenue
    
    // TODO: Fix this - updateMonthlyRevenue() method doesn't exist
    // sharedDataService.updateMonthlyRevenue(yearMonth, selectedSKU, newGrossRevenue, newUnits)

    // Reset form
    resetForm()
    onRevenueAdded()
    onOpenChange(false)
  }

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0])
    if (products.length > 0) {
      setSelectedSKU(products[0].sku)
    }
    setUnits('')
    setCustomDescription('')
  }

  const selectedProduct = products.find(p => p.sku === selectedSKU)
  const estimatedRevenue = selectedProduct ? parseFloat(units || '0') * selectedProduct.retailPrice : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Revenue</DialogTitle>
          <DialogDescription>
            Add product sales revenue to the general ledger
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date" className="text-right">
              Sale Date
            </Label>
            <div className="col-span-3">
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="product" className="text-right">
              Product
            </Label>
            <select
              id="product"
              className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={selectedSKU}
              onChange={(e) => setSelectedSKU(e.target.value)}
            >
              {products.map(product => (
                <option key={product.sku} value={product.sku}>
                  {product.sku} - {product.name} (${product.retailPrice})
                </option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="units" className="text-right">
              Units Sold
            </Label>
            <Input
              id="units"
              type="number"
              className="col-span-3"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder="0"
              min="1"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Input
              id="description"
              className="col-span-3"
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder={`Optional - defaults to "${selectedProduct?.name || 'Product'} Sales"`}
            />
          </div>
          
          {units && selectedProduct && (
            <div className="col-span-4 mt-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-5 w-5 text-green-600" />
                <h4 className="font-medium">Revenue Summary</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Product:</span>
                  <p className="font-medium">{selectedProduct.name}</p>
                </div>
                <div>
                  <span className="text-gray-600">SKU:</span>
                  <p className="font-medium">{selectedProduct.sku}</p>
                </div>
                <div>
                  <span className="text-gray-600">Unit Price:</span>
                  <p className="font-medium">${selectedProduct.retailPrice.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Units:</span>
                  <p className="font-medium">{units}</p>
                </div>
                <div className="col-span-2 pt-2 border-t">
                  <span className="text-gray-600">Gross Revenue:</span>
                  <p className="font-bold text-lg text-green-600">
                    ${estimatedRevenue.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    * Net revenue will be calculated after fees & expenses
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!date || !selectedSKU || !units || parseInt(units) <= 0}
          >
            Add Revenue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
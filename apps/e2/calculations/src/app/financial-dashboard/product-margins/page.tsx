'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, Settings, TrendingUp, Package, DollarSign, AlertTriangle, Save, Plus } from 'lucide-react'
import { ProductDataHotTable } from '@/components/ProductDataHotTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { toast } from 'react-hot-toast'
import clientLogger from '@/utils/clientLogger'
import { sortBySkuOrder } from '@/config/sku-order'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { AddProductModal } from '@/components/AddProductModal'
import { useActiveStrategy } from '@/hooks/useActiveStrategy'

interface ProductCosts {
  name: string
  price: number
  manufacturingCost: number
  freightCost: number
  warehouseCost: number
  fulfillmentFee: number
  tariffRate?: number
  // New configuration fields
  country?: string
  sourcingCountry?: string
  destinationMarket?: string
  packSize?: number
  micron?: number
  quantity?: number
  dimensions?: string
  packageDimensions?: string
  productLength?: number
  productWidth?: number
  productArea?: number
  length?: number
  width?: number
  height?: number
  density?: number
  weightGrams?: number
  weightOz?: number
  weightLb?: number
  cbm?: number
  totalCBM?: number
  sizeTier?: string
  tacos?: number
  refundRate?: number
  weightRange?: string
  feeType?: string
}

type ProductData = Record<string, ProductCosts>

export default function ProductMarginsPage() {
  const router = useRouter()
  // State for product data - from database
  const [productData, setProductData] = useState<ProductData>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [dataVersion, setDataVersion] = useState(Date.now()) // Force re-render of tables
  
  // Get active strategy
  const { activeStrategy } = useActiveStrategy()

  // State for settings with localStorage persistence
  const [tariffRate, setTariffRate] = useLocalStorage('product-margins-tariff-rate', 35)
  const [amazonReferralRate, setAmazonReferralRate] = useLocalStorage('product-margins-referral-rate', 15)
  const [returnAllowanceRate, setReturnAllowanceRate] = useLocalStorage('product-margins-return-rate', 1)
  const [activeTab, setActiveTab] = useState('settings') // Default to Product Settings tab

  // Load product data from database
  useEffect(() => {
    setIsMounted(true)
    console.log('ProductMarginsPage mounted, loading data...')
    
    // Only load data on client side
    if (typeof window !== 'undefined') {
      console.log('Running on client side, loading data')
      loadProductData()
    }
  }, [])
  

  const loadProductData = async () => {
    try {
      setIsLoading(true)
      setLoadError(null)
      console.log('Loading product data...')
      const response = await fetch(`/api/products?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch products: ${errorText}`)
      }
      
      const products = await response.json()
      console.log('API returned products:', products)
      
      if (!Array.isArray(products)) {
        throw new Error('Invalid response format - expected array')
      }
      
      if (products.length === 0) {
        console.warn('No products returned from API')
        setProductData({})
        return
      }
      
      const newProductData: ProductData = {}
      
      // Process each product and calculate FBA fees dynamically
      for (const product of products) {
        console.log('Processing product:', product.sku, {
          manufacturing: product.manufacturing,
          freight: product.freight,
          awd: product.awd,
          // New fields
          country: product.country,
          packSize: product.packSize,
          micron: product.micron,
          packageDimensions: product.packageDimensions,
          productArea: product.productArea,
          productLength: product.productLength,
          productWidth: product.productWidth,
          density: product.density,
          weightGrams: product.weightGrams,
          weightOz: product.weightOz,
          weightLb: product.weightLb,
          cbm: product.cbm,
          sizeTier: product.sizeTier
        })
        
        const price = parseFloat(product.pricing) || 0
        const weightOz = parseFloat(product.weightOz) || 0
        const sizeTier = product.sizeTier || ''
        const marketplace = product.destinationMarket || 'US'
        
        // Calculate FBA fee dynamically via API
        let calculatedFbaFee = parseFloat(product.fulfillmentFee) || 0
        const length = parseFloat(product.length) || 0
        const width = parseFloat(product.width) || 0
        const height = parseFloat(product.height) || 0
        
        if (weightOz && price) {
          console.log(`Calculating FBA for ${product.sku}: weight=${weightOz}oz, price=$${price}, dims=${length}x${width}x${height}`)
          try {
            const response = await fetch('/api/calculate-fba-fee', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                weightOz, 
                sizeTier,  // Pass as fallback
                price, 
                marketplace,
                length,
                width,
                height
              })
            })
            
            if (response.ok) {
              const feeResult = await response.json()
              calculatedFbaFee = feeResult.fee
              // Store weight range, fee type, and calculated size tier in product metadata
              product.weightRange = feeResult.weightRange
              product.feeType = feeResult.feeType
              product.sizeTier = feeResult.sizeTier  // Update size tier from API
              console.log(`Dynamic FBA fee for ${product.sku}: $${calculatedFbaFee} (${feeResult.feeType}) (${feeResult.sizeTier}) (${feeResult.weightRange})`)
            } else {
              console.error(`Error calculating FBA fee for ${product.sku}, using default`)
            }
          } catch (error) {
            console.error(`Error calculating FBA fee for ${product.sku}, using default:`, error)
          }
        }
        
        newProductData[product.sku] = {
          name: product.name,
          price: price,
          manufacturingCost: parseFloat(product.manufacturing) || 0,
          freightCost: parseFloat(product.freight) || 0,
          warehouseCost: parseFloat(product.awd) || 0,
          fulfillmentFee: calculatedFbaFee, // Use dynamically calculated fee
          // New configuration fields
          country: product.country || '',
          sourcingCountry: product.sourcingCountry || product.country || '',
          destinationMarket: product.destinationMarket || 'US',
          packSize: product.packSize || 0,
          micron: product.micron || 0,
          packageDimensions: product.packageDimensions || '',
          length: parseFloat(product.length) || 0,
          width: parseFloat(product.width) || 0,
          height: parseFloat(product.height) || 0,
          productArea: product.productArea ? parseFloat(product.productArea) : 0,
          productLength: product.productLength ? parseFloat(product.productLength) : 0,
          productWidth: product.productWidth ? parseFloat(product.productWidth) : 0,
          density: parseFloat(product.density) || 0,
          weightGrams: parseFloat(product.weightGrams) || 0,
          weightOz: weightOz,
          weightLb: parseFloat(product.weightLb) || 0,
          cbm: parseFloat(product.cbm) || 0,
          sizeTier: sizeTier,
          tacos: parseFloat(product.tacos) || 0.12,
          tariffRate: parseFloat(product.tariffRate) || 0.35,
          refundRate: parseFloat(product.refundRate) || 0.01,
          weightRange: product.weightRange || '',
          feeType: product.feeType || ''
        }
      }
      
      console.log('Setting product data:', newProductData)
      // Debug specific product to check area and packageDimensions
      const firstSku = Object.keys(newProductData)[0]
      if (firstSku) {
        console.log('First product debug:', {
          sku: firstSku,
          packageDimensions: newProductData[firstSku].packageDimensions,
          productArea: newProductData[firstSku].productArea,
          productLength: newProductData[firstSku].productLength,
          productWidth: newProductData[firstSku].productWidth
        })
      }
      setProductData(newProductData)
      console.log('Loaded product data:', newProductData)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      clientLogger.error('Error loading product data:', error)
      setLoadError(errorMessage)
      toast.error('Failed to load product data: ' + errorMessage)
    } finally {
      setIsLoading(false)
    }
  }


  const saveProductData = async () => {
    try {
      setIsSaving(true)
      
      // Save each product
      const savePromises = Object.entries(productData).map(async ([sku, data]) => {
        const response = await fetch(`/api/products/${encodeURIComponent(sku)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amazonPrice: data.price,
            manufacturingCost: data.manufacturingCost,
            freightCost: data.freightCost,
            warehouseCost: data.warehouseCost,
            fulfillmentFee: data.fulfillmentFee,
            // New configuration fields
            country: data.country,
            sourcingCountry: data.sourcingCountry,
            destinationMarket: data.destinationMarket,
            packSize: data.packSize,
            micron: data.micron,
            packageDimensions: data.packageDimensions,
            length: data.length,
            width: data.width,
            height: data.height,
            productLength: data.productLength,
            productWidth: data.productWidth,
            productArea: data.productArea,
            density: data.density,
            weightGrams: data.weightGrams,
            weightOz: data.weightOz,
            weightLb: data.weightLb,
            cbm: data.cbm,
            sizeTier: data.sizeTier,
            tacos: data.tacos,
            tariffRate: data.tariffRate,
            refundRate: data.refundRate
          })
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Failed to save ${sku}:`, errorText)
          throw new Error(`Failed to save ${sku}: ${errorText}`)
        }
      })
      
      await Promise.all(savePromises)
      
      setHasChanges(false)
      toast.success('Product data saved successfully')
      
      console.log('Save complete, reloading data...')
      
      // Clear all data to force React to see a change
      setProductData({})
      setIsLoading(true)
      
      // Add a small delay to ensure database writes are complete and UI updates
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Reload data from server to ensure UI reflects any server-side calculations
      await loadProductData()
      
      // Force re-render of all tables with timestamp
      const newVersion = Date.now()
      console.log('Setting new dataVersion:', newVersion)
      setDataVersion(newVersion)
      
      // Force Next.js to refresh and clear any caching
      router.refresh()
      
      // Force hard reload to ensure all data is fresh
      window.location.reload()
    } catch (error) {
      console.error('Error saving product data:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save product data')
    } finally {
      setIsSaving(false)
    }
  }

  const updateProductField = useCallback((sku: string, field: keyof ProductCosts, value: number) => {
    setProductData(prev => ({
      ...prev,
      [sku]: {
        ...prev[sku],
        [field]: value
      }
    }))
    setHasChanges(true)
  }, [])

  const handleDataChange = useCallback((changes: Array<{ sku: string; field: string; value: number }>) => {
    setProductData(prev => {
      const newData = { ...prev }
      changes.forEach(({ sku, field, value }) => {
        if (newData[sku]) {
          newData[sku] = {
            ...newData[sku],
            [field]: value
          }
        }
      })
      return newData
    })
    setHasChanges(true)
  }, [])

  const handleSettingsChange = useCallback(async (changes: Array<{ sku: string; field: string; value: any }>) => {
    // First update all the changed fields
    let updatedData: ProductData = {}
    setProductData(prev => {
      const newData = { ...prev }
      changes.forEach(({ sku, field, value }) => {
        if (newData[sku]) {
          // Map settings fields to product data fields
          const fieldMap: Record<string, string> = {
            'country': 'country',
            'sourcingCountry': 'sourcingCountry',
            'destinationMarket': 'destinationMarket',
            'packSize': 'packSize',
            'micron': 'micron',
            'packageDimensions': 'packageDimensions',
            'length': 'length',
            'width': 'width',
            'height': 'height',
            'productLength': 'productLength',
            'productWidth': 'productWidth',
            'productArea': 'productArea',
            'density': 'density',
            'weightGrams': 'weightGrams',
            'weightOz': 'weightOz',
            'weightLb': 'weightLb',
            'cbm': 'cbm',
            'sizeTier': 'sizeTier',
            'fulfillmentFee': 'fulfillmentFee',
            'name': 'name',
            'tacos': 'tacos',
            'tariffRate': 'tariffRate',
            'refundRate': 'refundRate'
          }
          
          const mappedField = fieldMap[field] || field
          newData[sku] = { ...newData[sku], [mappedField]: value }
        }
      })
      updatedData = newData
      return newData
    })
    
    // Check if weight needs to be recalculated from area
    const needsWeightCalc: Set<string> = new Set()
    changes.forEach(({ sku, field }) => {
      if (['productArea', 'micron', 'density', 'packSize'].includes(field)) {
        needsWeightCalc.add(sku)
      }
    })
    
    // Recalculate weight for products where area/micron/density changed
    if (needsWeightCalc.size > 0) {
      setProductData(prev => {
        const newData = { ...prev }
        for (const sku of Array.from(needsWeightCalc)) {
          const product = newData[sku]
          if (product && product.productArea && product.micron && product.density) {
            // Calculate weight: Area (ft²) × Micron × Density (g/cm³) × Pack Size
            // Convert: 1 ft² = 929.0304 cm², 1 micron = 0.0001 cm
            const areaInSqFt = product.productArea // stored in square feet
            const areaInCm2 = areaInSqFt * 929.0304 // convert ft² to cm²
            const thicknessInCm = product.micron * 0.0001
            const volumeInCm3 = areaInCm2 * thicknessInCm
            const weightPerSheet = volumeInCm3 * product.density
            const totalWeightGrams = weightPerSheet * (product.packSize || 1)
            
            newData[sku] = {
              ...newData[sku],
              weightGrams: totalWeightGrams,
              weightOz: totalWeightGrams * 0.035274,
              weightLb: totalWeightGrams * 0.00220462
            }
            
            // Also mark for FBA recalculation
            needsFbaRecalc.add(sku)
          }
        }
        return newData
      })
    }
    
    // Check if any weight or dimension changes need FBA fee recalculation
    const needsFbaRecalc: Set<string> = new Set()
    changes.forEach(({ sku, field }) => {
      if (['weightOz', 'weightGrams', 'weightLb', 'length', 'width', 'height', 'sizeTier'].includes(field)) {
        needsFbaRecalc.add(sku)
      }
    })
    
    // Recalculate FBA fees for products that had weight/dimension changes
    if (needsFbaRecalc.size > 0) {
      // Process each SKU that needs FBA recalculation
      for (const sku of Array.from(needsFbaRecalc)) {
        const product = updatedData[sku]
        if (product) {
          const weightOz = product.weightOz || 0
          const price = product.price || 0
          const marketplace = product.destinationMarket || 'US'
          const length = product.length || 0
          const width = product.width || 0
          const height = product.height || 0
          
          // API will calculate size tier from dimensions and weight
          if (weightOz && price) {
            try {
              const response = await fetch('/api/calculate-fba-fee', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  weightOz, 
                  price, 
                  marketplace,
                  length,
                  width,
                  height,
                  sizeTier: product.sizeTier // Pass existing as fallback
                })
              })
              
              if (response.ok) {
                const feeResult = await response.json()
                // Update the FBA fee, size tier, and metadata in state
                setProductData(prevData => ({
                  ...prevData,
                  [sku]: {
                    ...prevData[sku],
                    fulfillmentFee: feeResult.fee,
                    sizeTier: feeResult.sizeTier,  // Update size tier from API
                    weightRange: feeResult.weightRange,
                    feeType: feeResult.feeType
                  }
                }))
                console.log(`Updated FBA fee for ${sku}: $${feeResult.fee} (${feeResult.feeType}) (${feeResult.sizeTier}) (${feeResult.weightRange})`)
              }
            } catch (error) {
              console.error(`Error recalculating FBA fee for ${sku}:`, error)
            }
          }
        }
      }
    }
    
    setHasChanges(true)
  }, [])

  // Prepare product settings data - physical product specifications
  const productSettingsData = useMemo(() => {
    if (!isMounted || Object.keys(productData).length === 0) {
      return []
    }
    
    console.log('Recalculating productSettingsData, productData keys:', Object.keys(productData).length)
    
    // Sort entries based on the standard SKU order
    const sortedEntries = sortBySkuOrder(Object.entries(productData))
    
    return sortedEntries.map(([sku, product]) => ({
      sku,
      name: product.name,
      country: product.country,
      sourcingCountry: product.sourcingCountry,
      destinationMarket: product.destinationMarket,
      packSize: product.packSize,
      micron: product.micron,
      packageDimensions: product.packageDimensions,
      length: product.length,
      width: product.width,
      height: product.height,
      productArea: product.productArea,
      productLength: product.productLength,
      productWidth: product.productWidth,
      density: product.density,
      weightGrams: product.weightGrams,
      weightOz: product.weightOz,
      weightLb: product.weightLb,
      cbm: product.cbm,
      sizeTier: product.sizeTier,
      fulfillmentFee: product.fulfillmentFee, // Keep FBA fee as it's related to size tier
      price: product.price, // Include price for FBA type determination
      tacos: product.tacos,
      tariffRate: product.tariffRate,
      refundRate: product.refundRate,
      weightRange: product.weightRange || '',
      feeType: product.feeType || ''
    }))
  }, [productData, isMounted])

  // Calculate margins and totals
  const marginData = useMemo(() => {
    // Only compute on client side with actual data
    if (!isMounted || Object.keys(productData).length === 0) {
      return []
    }
    
    console.log('Computing marginData from productData:', productData)
    // Sort entries based on the standard SKU order
    const sortedEntries = sortBySkuOrder(Object.entries(productData))
    console.log('Sorted entries:', sortedEntries)
    
    return sortedEntries.map(([sku, product]) => {
      // Calculate all cost components using per-product tariff rate from Product Settings
      const productTariffRate = (product.tariffRate || 0.35) * 100 // Convert to percentage
      const tariffCost = product.manufacturingCost * productTariffRate / 100
      const cogs = product.manufacturingCost + product.freightCost + tariffCost // COGS without AWD
      
      // Calculate Amazon fees
      const amazonReferralFee = product.price * amazonReferralRate / 100
      // Use product's refundRate (already in decimal form, e.g., 0.01 for 1%)
      // Use 0 if refundRate is explicitly set to 0, only default to 1% if undefined/null
      const productRefundRate = product.refundRate !== undefined && product.refundRate !== null ? product.refundRate : 0.01
      const returnAllowance = product.price * productRefundRate
      
      // Calculate advertising cost using TACoS from Product Settings
      // Use 0 if TACoS is explicitly set to 0, only default to 12% if undefined/null
      const tacosRate = product.tacos !== undefined && product.tacos !== null ? product.tacos : 0.12
      const advertisingCost = product.price * tacosRate
      
      // Total Amazon fees (AWD + FBA + Referral + Advertising)
      // FBA Fee comes directly from Product Settings
      const totalAmazonFees = product.warehouseCost + product.fulfillmentFee + amazonReferralFee + advertisingCost
      
      // Total all costs
      const totalCosts = cogs + totalAmazonFees + returnAllowance
      
      // Calculate margin
      const grossMargin = product.price - totalCosts
      const marginPercent = grossMargin / product.price // Keep as decimal (0-1), will be formatted as % in table
      
      return {
        sku,
        name: product.name,
        price: product.price,
        manufacturingCost: product.manufacturingCost,
        freightCost: product.freightCost,
        warehouseCost: product.warehouseCost,
        tariff: tariffCost, // Calculated from tariffRate in Product Settings
        totalCost: cogs,
        fbaFee: product.fulfillmentFee, // Linked from Product Settings
        fulfillmentFee: product.fulfillmentFee, // Same as fbaFee, needed for table display
        amazonReferralFee: amazonReferralFee,
        advertisingCost: advertisingCost, // Calculated from TACoS in Product Settings
        amazonFees: totalAmazonFees,
        returnAllowance,
        grossMargin,
        marginPercent,
        status: marginPercent >= 0.30 ? 'healthy' : marginPercent >= 0.20 ? 'warning' : 'critical',
        tacos: product.tacos || 0.12,
        tariffRate: product.tariffRate || 0.35,
        sizeTier: product.sizeTier // Include size tier for FBA type display
      }
    })
  }, [productData, amazonReferralRate, returnAllowanceRate, isMounted])


  if (loadError) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-center text-red-500">
            <p>Error loading products:</p>
            <p className="text-sm mt-2">{loadError}</p>
            <Button onClick={loadProductData} className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // Don't return early if no products - show the main UI with Add Product button

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Products
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Manage product configuration and analyze profitability
              </p>
            </div>
            <div className="flex items-center gap-4">
              {hasChanges && (
                <Badge variant="outline" className="text-orange-600">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Unsaved Changes
                </Badge>
              )}
              <Button
                variant="outline"
                onClick={() => setIsAddModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
              <Button
                onClick={saveProductData}
                disabled={!hasChanges || isSaving}
              >
                {isSaving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>



        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="settings">Product Settings</TabsTrigger>
            <TabsTrigger value="standard">Margins</TabsTrigger>
          </TabsList>

          {/* Margins Tab */}
          <TabsContent value="standard" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Product Cost & Margin Analysis</CardTitle>
                <CardDescription>
                  Edit costs directly in the table. Changes are highlighted until saved.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-visible">
                {isLoading ? (
                  // Show skeleton loader while data is loading
                  <PageSkeleton variant="table" rows={6} />
                ) : marginData.length > 0 ? (
                  <>
                    {/* Only render HotTable when data is ready */}
                    <ProductDataHotTable
                      key={`margins-${dataVersion}`}
                      view="margins"
                      data={marginData}
                      onDataChange={handleDataChange}
                      tariffRate={tariffRate}
                      amazonReferralRate={amazonReferralRate}
                      returnAllowanceRate={returnAllowanceRate}
                      className="mb-6"
                    />
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg mb-2">No products yet</p>
                    <p className="text-sm">Click "Add Product" to create your first product</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          {/* Product Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  <Package className="h-5 w-5 inline mr-2" />
                  Product Configuration
                </CardTitle>
                <CardDescription>
                  Edit product specifications, dimensions, and packaging details
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-visible">
                {isLoading ? (
                  // Show skeleton loader while data is loading
                  <PageSkeleton variant="table" rows={6} />
                ) : productSettingsData.length > 0 ? (
                  <>
                    <ProductDataHotTable
                      key={`settings-${dataVersion}`}
                      view="settings"
                      data={productSettingsData}
                      onDataChange={handleSettingsChange}
                      className="mb-6"
                    />
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Settings className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg mb-2">No products to configure</p>
                    <p className="text-sm">Click "Add Product" to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <AddProductModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onProductAdded={() => {
            loadProductData() // Reload products after adding
            setIsAddModalOpen(false)
          }}
          strategyId={activeStrategy?.id}
        />
      </div>
    </DashboardLayout>
  )
}
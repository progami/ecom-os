'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Plus, Save, X, AlertCircle } from 'lucide-react'
import { DashboardLayout } from '@/components/wms/layout/dashboard-layout'
import { toast } from 'react-hot-toast'
import { useSession } from 'next-auth/react'

interface Warehouse {
  id: string
  name: string
}

export default function NewTransactionPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [transactionType, setTransactionType] = useState<'RECEIVE' | 'SHIP' | 'ADJUST'>('RECEIVE')
  const [warehouseId, setWarehouseId] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [items, setItems] = useState([
    { id: 1, skuCode: '', batchLot: '', cartons: 0, pallets: 0, units: 0 }
  ])

  useEffect(() => {
    fetchWarehouses()
  }, [])

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/v1/wms/warehouses')
      if (response.ok) {
        const data = await response.json()
        setWarehouses(data)
        if (data.length > 0 && !warehouseId) {
          setWarehouseId(data[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch warehouses:', error)
    }
  }

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now(), skuCode: '', batchLot: '', cartons: 0, pallets: 0, units: 0 }
    ])
  }

  const removeItem = (id: number) => {
    setItems(items.filter(item => item.id !== id))
  }

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate items
    const validItems = items.filter(item => item.skuCode && (item.cartons !== 0 || transactionType === 'ADJUST'))
    if (validItems.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    if (transactionType === 'ADJUST' && !adjustmentReason) {
      toast.error('Please provide a reason for adjustment')
      return
    }
    
    setLoading(true)
    
    const formData = new FormData(e.target as HTMLFormElement)
    const referenceNumber = formData.get('referenceNumber') as string
    const date = formData.get('transactionDate') as string
    const notes = formData.get('notes') as string
    
    try {
      const response = await fetch('/api/v1/wms/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: transactionType,
          referenceNumber,
          date,
          items: validItems,
          notes: transactionType === 'ADJUST' ? `Adjustment Reason: ${adjustmentReason}. ${notes}` : notes,
          warehouseId,
        }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(`Transaction saved successfully! ${data.message}`)
        router.push('/wms/admin/inventory')
      } else {
        toast.error(data.error || 'Failed to save transaction')
        if (data.details) {
          console.error('Error details:', data.details)
        }
      }
    } catch (error) {
      console.error('Submit error:', error)
      toast.error('Failed to save transaction. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">New Transaction</h1>
            <p className="text-muted-foreground">
              Create inventory movement transaction
            </p>
          </div>
          <button
            onClick={() => router.push('/wms/admin/inventory')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Transaction Type */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Transaction Type</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                transactionType === 'RECEIVE' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="transactionType"
                  value="RECEIVE"
                  checked={transactionType === 'RECEIVE'}
                  onChange={(e) => setTransactionType(e.target.value as any)}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="font-medium">Receive</div>
                  <div className="text-sm text-gray-500">Incoming inventory</div>
                </div>
              </label>
              
              <label className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                transactionType === 'SHIP' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="transactionType"
                  value="SHIP"
                  checked={transactionType === 'SHIP'}
                  onChange={(e) => setTransactionType(e.target.value as any)}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="font-medium">Ship</div>
                  <div className="text-sm text-gray-500">Outgoing inventory</div>
                </div>
              </label>
              
              <label className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                transactionType === 'ADJUST' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="transactionType"
                  value="ADJUST"
                  checked={transactionType === 'ADJUST'}
                  onChange={(e) => setTransactionType(e.target.value as any)}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="font-medium">Adjust</div>
                  <div className="text-sm text-gray-500">Inventory adjustment</div>
                </div>
              </label>
            </div>
          </div>

          {/* Header Information */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Transaction Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warehouse
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  {warehouses.map(warehouse => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number
                </label>
                <input
                  type="text"
                  name="referenceNumber"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={transactionType === 'RECEIVE' ? 'PO Number' : transactionType === 'SHIP' ? 'SO Number' : 'ADJ Number'}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transaction Date
                </label>
                <input
                  type="date"
                  name="transactionDate"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>
            
            {transactionType === 'ADJUST' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adjustment Reason
                </label>
                <select
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Select a reason...</option>
                  <option value="Physical Count">Physical Count</option>
                  <option value="Damaged Goods">Damaged Goods</option>
                  <option value="Expired Product">Expired Product</option>
                  <option value="System Correction">System Correction</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </button>
            </div>

            {transactionType === 'ADJUST' && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Adjustment Instructions:</p>
                    <p>Use positive numbers to increase inventory, negative numbers to decrease.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Batch/Lot
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cartons
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pallets
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Units
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.skuCode}
                          onChange={(e) => updateItem(item.id, 'skuCode', e.target.value)}
                          className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="SKU code"
                          required
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.batchLot}
                          onChange={(e) => updateItem(item.id, 'batchLot', e.target.value)}
                          className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Batch/Lot"
                          required
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.cartons}
                          onChange={(e) => updateItem(item.id, 'cartons', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary"
                          {...(transactionType === 'ADJUST' ? {} : { min: "0" })}
                          required
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.pallets}
                          onChange={(e) => updateItem(item.id, 'pallets', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary"
                          {...(transactionType === 'ADJUST' ? {} : { min: "0" })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.units}
                          onChange={(e) => updateItem(item.id, 'units', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary"
                          {...(transactionType === 'ADJUST' ? {} : { min: "0" })}
                          required
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-red-600 hover:text-red-800"
                          disabled={items.length === 1}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-right font-semibold">
                      Total:
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {items.reduce((sum, item) => sum + item.cartons, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {items.reduce((sum, item) => sum + item.pallets, 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {items.reduce((sum, item) => sum + item.units, 0).toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Additional Notes</h3>
            <textarea
              name="notes"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="Any additional notes or comments..."
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.push('/wms/admin/inventory')}
              className="px-6 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Transaction
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
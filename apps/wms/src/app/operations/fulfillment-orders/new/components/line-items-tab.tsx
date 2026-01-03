'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from '@/lib/lucide-icons'
import type { LineItem, SkuOption, SkuBatchOption } from './types'

interface LineItemsTabProps {
  lineItems: LineItem[]
  setLineItems: React.Dispatch<React.SetStateAction<LineItem[]>>
  skus: SkuOption[]
}

export function LineItemsTab({ lineItems, setLineItems, skus }: LineItemsTabProps) {
  const getBatchOptions = (skuCode: string): SkuBatchOption[] => {
    const sku = skus.find(s => s.skuCode === skuCode)
    return sku?.batches ?? []
  }

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        skuCode: '',
        skuDescription: '',
        batchLot: '',
        quantity: 1,
        notes: '',
      },
    ])
  }

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id))
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: unknown) => {
    setLineItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item

        if (field === 'skuCode') {
          const nextSkuCode = String(value)
          const sku = skus.find(s => s.skuCode === nextSkuCode)
          return {
            ...item,
            skuCode: nextSkuCode,
            skuDescription: sku?.description ?? item.skuDescription,
            batchLot: '',
          }
        }

        return {
          ...item,
          [field]: value,
        } as LineItem
      })
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Line Items</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add products to this fulfillment order
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
          <Plus className="h-4 w-4 mr-1" />
          Add Item
        </Button>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="grid grid-cols-14 gap-2 text-xs font-medium text-muted-foreground p-3 border-b bg-slate-50/50">
          <div className="col-span-3">SKU</div>
          <div className="col-span-3">Batch/Lot</div>
          <div className="col-span-4">Description</div>
          <div className="col-span-1">Qty</div>
          <div className="col-span-2">Notes</div>
          <div className="col-span-1"></div>
        </div>

        <div className="divide-y">
          {lineItems.map(item => {
            const batches = getBatchOptions(item.skuCode)
            return (
              <div key={item.id} className="grid grid-cols-14 gap-2 items-center p-3">
                <div className="col-span-3">
                  <select
                    value={item.skuCode}
                    onChange={e => updateLineItem(item.id, 'skuCode', e.target.value)}
                    className="w-full px-2 py-1.5 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    required
                  >
                    <option value="">Select SKU</option>
                    {skus.map(sku => (
                      <option key={sku.id} value={sku.skuCode}>
                        {sku.skuCode}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-3">
                  <select
                    value={item.batchLot}
                    onChange={e => updateLineItem(item.id, 'batchLot', e.target.value)}
                    className="w-full px-2 py-1.5 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    required
                    disabled={!item.skuCode}
                  >
                    <option value="">Select batch</option>
                    {batches.map(batch => (
                      <option key={batch.id} value={batch.batchCode}>
                        {batch.batchCode}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-4">
                  <Input
                    value={item.skuDescription}
                    onChange={e => updateLineItem(item.id, 'skuDescription', e.target.value)}
                    placeholder="Description"
                    className="text-sm h-8"
                  />
                </div>

                <div className="col-span-1">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={e =>
                      updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 0)
                    }
                    className="text-sm h-8"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    value={item.notes}
                    onChange={e => updateLineItem(item.id, 'notes', e.target.value)}
                    placeholder="Notes"
                    className="text-sm h-8"
                  />
                </div>

                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLineItem(item.id)}
                    disabled={lineItems.length === 1}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {lineItems.length === 0 && (
        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No line items added yet. Click "Add Item" to add products.
          </p>
        </div>
      )}
    </div>
  )
}

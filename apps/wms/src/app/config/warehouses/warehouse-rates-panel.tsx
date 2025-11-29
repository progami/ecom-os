'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Package,
  Warehouse as WarehouseIcon,
  Ship,
  Plus,
  Edit,
  Save,
  X,
  RefreshCw,
} from '@/lib/lucide-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import { toast } from 'react-hot-toast'

interface CostRate {
  id: string
  warehouseId: string
  costCategory: string
  costName: string
  costValue: number
  unitOfMeasure: string
  effectiveDate: string
  endDate: string | null
}

interface WarehouseRatesPanelProps {
  warehouseId: string
  warehouseName: string
  warehouseCode: string
}

type TabKey = 'inbound' | 'storage' | 'outbound' | 'forwarding'

// Rate templates define expected rates with their categories and units
// Categories: Inbound, Storage, Outbound, Forwarding (matches the supply chain stage)
const RATE_TEMPLATES = {
  inbound: [
    { costName: "20' Container Handling", costCategory: 'Inbound', unitOfMeasure: 'per_container', defaultValue: 650 },
    { costName: "40' Container Handling", costCategory: 'Inbound', unitOfMeasure: 'per_container', defaultValue: 825 },
    { costName: "40' HQ Container Handling", costCategory: 'Inbound', unitOfMeasure: 'per_container', defaultValue: 875 },
    { costName: "45' HQ Container Handling", costCategory: 'Inbound', unitOfMeasure: 'per_container', defaultValue: 950 },
    { costName: "LCL Handling", costCategory: 'Inbound', unitOfMeasure: 'per_carton', defaultValue: 0.95 },
    { costName: "Additional SKU Fee", costCategory: 'Inbound', unitOfMeasure: 'per_sku', defaultValue: 10 },
    { costName: "Pallet Shortage - 20' Container", costCategory: 'Inbound', unitOfMeasure: 'per_container', defaultValue: 0 },
    { costName: "Pallet Shortage - 40' Container", costCategory: 'Inbound', unitOfMeasure: 'per_container', defaultValue: 0 },
    { costName: "Pallet Shortage - 40' HQ Container", costCategory: 'Inbound', unitOfMeasure: 'per_container', defaultValue: 0 },
    { costName: "Pallet Shortage - 45' HQ Container", costCategory: 'Inbound', unitOfMeasure: 'per_container', defaultValue: 0 },
  ],
  storage: [
    { costName: "Warehouse Storage", costCategory: 'Storage', unitOfMeasure: 'per_pallet_day', defaultValue: 0.69 },
  ],
  outbound: [
    { costName: "FBA Trucking - Up to 8 Pallets", costCategory: 'Outbound', unitOfMeasure: 'flat', defaultValue: 0 },
    { costName: "FBA Trucking - 9-12 Pallets", costCategory: 'Outbound', unitOfMeasure: 'flat', defaultValue: 0 },
    { costName: "FBA Trucking - 13-28 Pallets (FTL)", costCategory: 'Outbound', unitOfMeasure: 'flat', defaultValue: 0 },
    { costName: "Waiting Time (after 4 hrs)", costCategory: 'Outbound', unitOfMeasure: 'per_hour', defaultValue: 0 },
    { costName: "Weekend Delivery Fee", costCategory: 'Outbound', unitOfMeasure: 'per_delivery', defaultValue: 0 },
    { costName: "Rush Fee (24-hour)", costCategory: 'Outbound', unitOfMeasure: 'per_delivery', defaultValue: 0 },
    { costName: "Replenishment Handling", costCategory: 'Outbound', unitOfMeasure: 'per_carton', defaultValue: 1.00 },
    { costName: "Replenishment Minimum", costCategory: 'Outbound', unitOfMeasure: 'per_shipment', defaultValue: 15 },
  ],
  forwarding: [
    { costName: "Pier Pass 2.0 - 40'/45'", costCategory: 'Forwarding', unitOfMeasure: 'flat', defaultValue: 68.42 },
    { costName: "Pier Pass 2.0 - 20'", costCategory: 'Forwarding', unitOfMeasure: 'flat', defaultValue: 34.52 },
    { costName: "Pre-Pull / Night Pull", costCategory: 'Forwarding', unitOfMeasure: 'flat', defaultValue: 175 },
  ],
}

// Map categories to tabs (now 1:1 mapping since categories match tabs)
const CATEGORY_TO_TAB: Record<string, TabKey> = {
  Inbound: 'inbound',
  Storage: 'storage',
  Outbound: 'outbound',
  Forwarding: 'forwarding',
}

export function WarehouseRatesPanel({
  warehouseId,
  warehouseName,
  warehouseCode
}: WarehouseRatesPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('inbound')
  const [rates, setRates] = useState<CostRate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRateId, setEditingRateId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'inbound', label: 'Inbound', icon: <Package className="h-4 w-4" /> },
    { key: 'storage', label: 'Storage', icon: <WarehouseIcon className="h-4 w-4" /> },
    { key: 'outbound', label: 'Outbound', icon: <Package className="h-4 w-4" /> },
    { key: 'forwarding', label: 'Forwarding', icon: <Ship className="h-4 w-4" /> },
  ]

  const loadRates = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetchWithCSRF(`/api/warehouses/${warehouseId}/cost-rates`)
      if (response.ok) {
        const data = await response.json()
        setRates(data.costRates || [])
      }
    } catch (error) {
      console.error('Failed to load rates:', error)
    } finally {
      setLoading(false)
    }
  }, [warehouseId])

  useEffect(() => {
    loadRates()
  }, [loadRates])

  const getRateForTemplate = (template: typeof RATE_TEMPLATES.inbound[0]) => {
    return rates.find(r => r.costName === template.costName)
  }

  const getTabForRate = (rate: CostRate): TabKey => {
    return CATEGORY_TO_TAB[rate.costCategory] || 'inbound'
  }

  const startEditing = (rate: CostRate) => {
    setEditingRateId(rate.id)
    setEditValue(rate.costValue.toString())
  }

  const cancelEditing = () => {
    setEditingRateId(null)
    setEditValue('')
  }

  const saveRate = async (rate: CostRate) => {
    if (!editValue) return

    setSaving(true)
    try {
      const response = await fetchWithCSRF(`/api/settings/rates/${rate.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          costValue: parseFloat(editValue),
          unitOfMeasure: rate.unitOfMeasure,
        })
      })

      if (response.ok) {
        toast.success('Rate updated')
        await loadRates()
        cancelEditing()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update rate')
      }
    } catch (error) {
      toast.error('Failed to update rate')
    } finally {
      setSaving(false)
    }
  }

  const getAddRateUrl = (template: typeof RATE_TEMPLATES.inbound[0]) => {
    const params = new URLSearchParams({
      warehouseId,
      costCategory: template.costCategory,
      costName: template.costName,
      unitOfMeasure: template.unitOfMeasure,
      costValue: template.defaultValue.toString(),
    })
    return `/config/rates/new?${params.toString()}`
  }

  const renderRateRow = (
    template: typeof RATE_TEMPLATES.inbound[0],
    showCategory = false
  ) => {
    const rate = getRateForTemplate(template)
    const isEditing = rate && editingRateId === rate.id

    return (
      <tr key={template.costName} className="hover:bg-slate-50/50">
        <td className="py-2 px-3 text-slate-900">
          {template.costName}
          {showCategory && (
            <span className="ml-2 text-xs text-slate-400">({template.costCategory})</span>
          )}
        </td>
        <td className="py-2 px-3 text-right">
          {rate ? (
            isEditing ? (
              <div className="flex items-center justify-end gap-2">
                <span className="text-slate-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-24 px-2 py-1 text-right border rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  autoFocus
                />
                <button
                  onClick={() => saveRate(rate)}
                  disabled={saving}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button
                  onClick={cancelEditing}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2">
                <span className="font-semibold text-slate-900">
                  ${rate.costValue.toFixed(2)}
                </span>
                <button
                  onClick={() => startEditing(rate)}
                  className="p-1 text-slate-300 hover:text-cyan-600 hover:bg-cyan-50 rounded transition-colors"
                  title="Edit rate"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          ) : (
            <Link
              href={getAddRateUrl(template)}
              className="inline-flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Link>
          )}
        </td>
        <td className="py-2 px-3 text-slate-500 text-sm">
          {formatUnit(template.unitOfMeasure)}
        </td>
      </tr>
    )
  }

  const formatUnit = (unit: string) => {
    const unitLabels: Record<string, string> = {
      per_container: 'per container',
      per_carton: 'per carton',
      per_pallet_day: 'per pallet/day',
      per_sku: 'per SKU',
      per_hour: 'per hour',
      per_delivery: 'per delivery',
      per_shipment: 'per shipment',
      flat: 'flat',
    }
    return unitLabels[unit] || unit
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{warehouseName}</h2>
          <p className="text-sm text-slate-500">Rate Sheet • {warehouseCode} • USD</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadRates}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Badge className="bg-green-50 text-green-700 border-green-200">
            {rates.length} rates configured
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.key
                  ? 'border-cyan-500 text-cyan-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'inbound' && (
          <InboundTab
            templates={RATE_TEMPLATES.inbound}
            renderRateRow={renderRateRow}
          />
        )}
        {activeTab === 'storage' && (
          <StorageTab
            templates={RATE_TEMPLATES.storage}
            renderRateRow={renderRateRow}
          />
        )}
        {activeTab === 'outbound' && (
          <OutboundTab
            templates={RATE_TEMPLATES.outbound}
            renderRateRow={renderRateRow}
          />
        )}
        {activeTab === 'forwarding' && (
          <ForwardingTab
            templates={RATE_TEMPLATES.forwarding}
            renderRateRow={renderRateRow}
          />
        )}
      </div>
    </div>
  )
}

interface TabProps {
  templates: typeof RATE_TEMPLATES.inbound
  renderRateRow: (template: typeof RATE_TEMPLATES.inbound[0], showCategory?: boolean) => React.ReactNode
}

function InboundTab({ templates, renderRateRow }: TabProps) {
  // Filter by costName since all are now 'Inbound' category
  const containerRates = templates.filter(t => t.costName.includes('Container Handling'))
  const lclRates = templates.filter(t => t.costName === 'LCL Handling')
  const skuRates = templates.filter(t => t.costName === 'Additional SKU Fee')
  const palletShortageRates = templates.filter(t => t.costName.includes('Pallet Shortage'))

  return (
    <div className="space-y-6">
      {/* Container Handling */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Warehouse Handling and Carton Labeling</h3>
          <Badge className="bg-blue-50 text-blue-700 border-blue-200">Per Container</Badge>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Covers unloading, sorting, labeling, palletizing, shrink-wrapping, FBA pallet labels, and delivery arrangement.
        </p>
        <table className="w-full text-sm [&_tr]:group">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 font-medium text-slate-600">Container Type</th>
              <th className="text-right py-2 px-3 font-medium text-slate-600">Rate</th>
              <th className="text-left py-2 px-3 font-medium text-slate-600">Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {containerRates.map(t => renderRateRow(t))}
            {lclRates.map(t => renderRateRow(t))}
          </tbody>
        </table>
      </div>

      {/* Additional SKU */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Additional SKU Charges</h3>
        <p className="text-xs text-slate-500 mb-3">Up to 10 SKUs per container included.</p>
        <table className="w-full text-sm [&_tr]:group">
          <tbody className="divide-y divide-slate-50">
            {skuRates.map(t => renderRateRow(t))}
          </tbody>
        </table>
      </div>

      {/* Pallet Shortage */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Pallet Shortage Fee</h3>
        <table className="w-full text-sm [&_tr]:group">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 font-medium text-slate-600">Container Type</th>
              <th className="text-right py-2 px-3 font-medium text-slate-600">Fee</th>
              <th className="text-left py-2 px-3 font-medium text-slate-600">Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {palletShortageRates.map(t => renderRateRow(t))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StorageTab({ templates, renderRateRow }: TabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Warehouse Storage</h3>
        <table className="w-full text-sm [&_tr]:group">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 font-medium text-slate-600">Description</th>
              <th className="text-right py-2 px-3 font-medium text-slate-600">Rate</th>
              <th className="text-left py-2 px-3 font-medium text-slate-600">Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {templates.map(t => renderRateRow(t))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OutboundTab({ templates, renderRateRow }: TabProps) {
  // Filter by costName since all are now 'Outbound' category
  const truckingRates = templates.filter(t => t.costName.includes('FBA Trucking'))
  const accessorialRates = templates.filter(t =>
    ['Waiting Time (after 4 hrs)', 'Weekend Delivery Fee', 'Rush Fee (24-hour)'].includes(t.costName)
  )
  const replenishmentRates = templates.filter(t =>
    t.costName === 'Replenishment Handling' || t.costName === 'Replenishment Minimum'
  )

  return (
    <div className="space-y-6">
      {/* FBA Trucking */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Trucking and Delivery to Amazon FBA</h3>
        <p className="text-xs text-slate-500 mb-4">
          Tactical Logistics will schedule appointments and handle delivery to Amazon.
        </p>
        <table className="w-full text-sm [&_tr]:group">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 font-medium text-slate-600">Pallet Range</th>
              <th className="text-right py-2 px-3 font-medium text-slate-600">Rate</th>
              <th className="text-left py-2 px-3 font-medium text-slate-600">Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {truckingRates.map(t => renderRateRow(t))}
          </tbody>
        </table>
      </div>

      {/* Additional Charges */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Additional Charges</h3>
        <table className="w-full text-sm [&_tr]:group">
          <tbody className="divide-y divide-slate-50">
            {accessorialRates.map(t => renderRateRow(t))}
          </tbody>
        </table>
      </div>

      {/* Replenishment */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Additional Replenishment Shipments to Amazon FBA</h3>
        <table className="w-full text-sm [&_tr]:group">
          <tbody className="divide-y divide-slate-50">
            {replenishmentRates.map(t => renderRateRow(t))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ForwardingTab({ templates, renderRateRow }: TabProps) {
  return (
    <div className="space-y-6">
      {/* Ocean Freight */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Ocean Freight</h3>
        <p className="text-sm text-slate-600">
          Ask for current rates. Tactical will handle freight forwarding from point of manufacture to point of sale.
        </p>
      </div>

      {/* Drayage */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Port Pickup and Deliver to Tactical Warehouse (Drayage)</h3>
        <p className="text-xs text-slate-500 mb-4">
          Covers drayage to Tactical warehouse and includes all chassis fees.
        </p>
        <table className="w-full text-sm [&_tr]:group">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 font-medium text-slate-600">Service</th>
              <th className="text-right py-2 px-3 font-medium text-slate-600">Rate</th>
              <th className="text-left py-2 px-3 font-medium text-slate-600">Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {templates.map(t => renderRateRow(t))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

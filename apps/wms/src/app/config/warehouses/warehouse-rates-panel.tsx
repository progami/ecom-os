'use client'

import { useState, useEffect, useCallback, type FormEvent } from 'react'
import {
  Package,
  Warehouse as WarehouseIcon,
  Ship,
  Plus,
  Edit,
  Save,
  X,
  RefreshCw,
  DollarSign,
} from '@/lib/lucide-icons'
import { Badge } from '@/components/ui/badge'
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
// Tactical Logistics CWH Rate Sheet (from actual invoices)
const RATE_TEMPLATES = {
  inbound: [
    { costName: "20' Container Handling", costCategory: 'Inbound', unitOfMeasure: 'per_container', defaultValue: 650 },
    { costName: "40' Container Handling", costCategory: 'Inbound', unitOfMeasure: 'per_container', defaultValue: 825 },
    { costName: "40' HQ Container Handling", costCategory: 'Inbound', unitOfMeasure: 'per_container', defaultValue: 875 },
    { costName: "45' HQ Container Handling", costCategory: 'Inbound', unitOfMeasure: 'per_container', defaultValue: 950 },
    { costName: "LCL Handling", costCategory: 'Inbound', unitOfMeasure: 'per_carton', defaultValue: 0.95 },
    { costName: "Additional SKU Fee", costCategory: 'Inbound', unitOfMeasure: 'per_sku', defaultValue: 10 },
    { costName: "Cartons Over 1200", costCategory: 'Inbound', unitOfMeasure: 'per_carton', defaultValue: 0.05 },
    { costName: "Pallet & Shrink Wrap Fee", costCategory: 'Inbound', unitOfMeasure: 'per_pallet', defaultValue: 13.75 },
  ],
  storage: [
    { costName: "Warehouse Storage", costCategory: 'Storage', unitOfMeasure: 'per_pallet_day', defaultValue: 0.69 },
    { costName: "Warehouse Storage (6+ Months)", costCategory: 'Storage', unitOfMeasure: 'per_pallet_day', defaultValue: 0.69 },
  ],
  outbound: [
    { costName: "Replenishment Handling", costCategory: 'Outbound', unitOfMeasure: 'per_carton', defaultValue: 1.00 },
    { costName: "Replenishment Minimum", costCategory: 'Outbound', unitOfMeasure: 'per_shipment', defaultValue: 15 },
    { costName: "FBA Trucking - Up to 8 Pallets", costCategory: 'Outbound', unitOfMeasure: 'flat', defaultValue: 0 },
    { costName: "FBA Trucking - 9-12 Pallets", costCategory: 'Outbound', unitOfMeasure: 'flat', defaultValue: 0 },
    { costName: "FBA Trucking - 13-28 Pallets (FTL)", costCategory: 'Outbound', unitOfMeasure: 'flat', defaultValue: 0 },
  ],
  forwarding: [
    { costName: "Pre-pull", costCategory: 'Forwarding', unitOfMeasure: 'flat', defaultValue: 175 },
    { costName: "Pierpass 20'", costCategory: 'Forwarding', unitOfMeasure: 'per_container', defaultValue: 34.52 },
    { costName: "Pierpass 40'", costCategory: 'Forwarding', unitOfMeasure: 'per_container', defaultValue: 68.42 },
  ],
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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newRateTemplate, setNewRateTemplate] = useState<typeof RATE_TEMPLATES.inbound[0] | null>(null)

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'inbound', label: 'Inbound', icon: <Package className="h-4 w-4" /> },
    { key: 'storage', label: 'Storage', icon: <WarehouseIcon className="h-4 w-4" /> },
    { key: 'outbound', label: 'Outbound', icon: <Package className="h-4 w-4" /> },
    ...(RATE_TEMPLATES.forwarding.length > 0
      ? [{ key: 'forwarding' as const, label: 'Forwarding', icon: <Ship className="h-4 w-4" /> }]
      : []),
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
        })
      })

      if (response.ok) {
        toast.success('Rate updated')
        await loadRates()
        cancelEditing()
      } else {
        const error = await response.json().catch(() => null)
        toast.error(error?.error || 'Failed to update rate')
      }
    } catch (_error) {
      toast.error('Failed to update rate')
    } finally {
      setSaving(false)
    }
  }

  const openAddRateModal = (template: typeof RATE_TEMPLATES.inbound[0]) => {
    setNewRateTemplate(template)
    setIsAddModalOpen(true)
  }

  const closeAddRateModal = () => {
    setIsAddModalOpen(false)
    setNewRateTemplate(null)
  }

  const createRate = async (formData: {
    costValue: number
    effectiveDate: string
    endDate: string | null
  }) => {
    if (!newRateTemplate) return

    try {
      const response = await fetchWithCSRF('/api/settings/rates', {
        method: 'POST',
        body: JSON.stringify({
          warehouseId,
          costCategory: newRateTemplate.costCategory,
          costName: newRateTemplate.costName,
          unitOfMeasure: newRateTemplate.unitOfMeasure,
          costValue: formData.costValue,
          effectiveDate: new Date(formData.effectiveDate),
          endDate: formData.endDate ? new Date(formData.endDate) : null,
        })
      })

      if (response.ok) {
        toast.success('Rate created successfully')
        await loadRates()
        closeAddRateModal()
      } else {
        const error = await response.json().catch(() => null)
        toast.error(error?.error || 'Failed to create rate')
      }
    } catch (_error) {
      toast.error('Failed to create rate')
    }
  }

  const renderRateRow = (
    template: typeof RATE_TEMPLATES.inbound[0],
    showCategory = false
  ) => {
    const rate = getRateForTemplate(template)
    const isEditing = rate && editingRateId === rate.id

    return (
      <tr key={template.costName} className="odd:bg-muted/20 hover:bg-primary/5 transition-colors">
        <td className="px-3 py-2 text-foreground whitespace-nowrap w-[45%]">
          {template.costName}
          {showCategory && (
            <span className="ml-2 text-xs text-muted-foreground">({template.costCategory})</span>
          )}
        </td>
        <td className="px-3 py-2 text-right w-[20%]">
          {rate ? (
            isEditing ? (
              <div className="flex items-center justify-end gap-2">
                <span className="text-muted-foreground">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-24 px-2 py-1 text-right border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <button
                  onClick={() => saveRate(rate)}
                  disabled={saving}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                  title="Save"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button
                  onClick={cancelEditing}
                  className="p-1 text-muted-foreground hover:bg-muted rounded"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2">
                <span className="font-semibold text-foreground">${rate.costValue.toFixed(2)}</span>
                <button
                  onClick={() => startEditing(rate)}
                  className="p-1 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 rounded transition-colors"
                  title="Edit rate"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => openAddRateModal(template)}
                  className="p-1 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 rounded transition-colors"
                  title="New effective rate"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          ) : (
            <button
              onClick={() => openAddRateModal(template)}
              className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          )}
        </td>
        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap w-[20%]">
          {rate ? rate.effectiveDate.slice(0, 10) : '—'}
        </td>
        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap w-[15%]">
          {formatUnit(template.unitOfMeasure)}
        </td>
      </tr>
    )
  }

  const formatUnit = (unit: string) => {
    const unitLabels: Record<string, string> = {
      per_container: 'per container',
      per_carton: 'per carton',
      per_pallet: 'per pallet',
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
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{warehouseName}</h2>
            <p className="text-sm text-muted-foreground">Rate Sheet • {warehouseCode} • USD</p>
          </div>
          <Badge className="bg-green-50 text-green-700 border-green-200">
            {rates.length} rates configured
          </Badge>
        </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
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

      {/* Add Rate Modal */}
      {isAddModalOpen && newRateTemplate && (
        <AddRateModal
          template={newRateTemplate}
          warehouseName={warehouseName}
          onClose={closeAddRateModal}
          onSubmit={createRate}
        />
      )}
    </>
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
  const cartonOverageRates = templates.filter(t => t.costName === 'Cartons Over 1200')
  const palletWrapRates = templates.filter(t => t.costName === 'Pallet & Shrink Wrap Fee')

  return (
    <div className="space-y-6">
      {/* Container Handling */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Warehouse Handling and Carton Labeling</h3>
          <Badge className="bg-blue-50 text-blue-700 border-blue-200">Per Container</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Covers unloading, sorting, labeling, palletizing, shrink-wrapping, FBA pallet labels, and delivery arrangement.
        </p>
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold w-[45%]">Container Type</th>
              <th className="px-3 py-2 text-right font-semibold w-[20%]">Rate</th>
              <th className="px-3 py-2 text-left font-semibold w-[20%]">Effective</th>
              <th className="px-3 py-2 text-left font-semibold w-[15%]">Unit</th>
            </tr>
          </thead>
          <tbody>
            {containerRates.map(t => renderRateRow(t))}
            {lclRates.map(t => renderRateRow(t))}
          </tbody>
        </table>
      </div>

      {/* Additional SKU */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Additional SKU Charges</h3>
        <p className="text-xs text-muted-foreground mb-3">Up to 10 SKUs per container included.</p>
        <table className="w-full table-fixed text-sm">
          <tbody>
            {skuRates.map(t => renderRateRow(t))}
          </tbody>
        </table>
      </div>

      {/* Carton Overage */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Carton Overage</h3>
        <p className="text-xs text-muted-foreground mb-3">Up to 1200 cartons per container included.</p>
        <table className="w-full table-fixed text-sm">
          <tbody>
            {cartonOverageRates.map(t => renderRateRow(t))}
          </tbody>
        </table>
      </div>

      {/* Pallet & Shrink Wrap */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Pallet &amp; Shrink Wrap</h3>
        <table className="w-full table-fixed text-sm">
          <tbody>
            {palletWrapRates.map(t => renderRateRow(t))}
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
        <h3 className="text-sm font-semibold text-foreground mb-3">Warehouse Storage</h3>
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold w-[45%]">Description</th>
              <th className="px-3 py-2 text-right font-semibold w-[20%]">Rate</th>
              <th className="px-3 py-2 text-left font-semibold w-[20%]">Effective</th>
              <th className="px-3 py-2 text-left font-semibold w-[15%]">Unit</th>
            </tr>
          </thead>
          <tbody>
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
  const replenishmentRates = templates.filter(t =>
    t.costName === 'Replenishment Handling' || t.costName === 'Replenishment Minimum'
  )

  return (
    <div className="space-y-6">
      {/* FBA Trucking */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Trucking and Delivery to Amazon FBA</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Tactical Logistics will schedule appointments and handle delivery to Amazon.
        </p>
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold w-[45%]">Pallet Range</th>
              <th className="px-3 py-2 text-right font-semibold w-[20%]">Rate</th>
              <th className="px-3 py-2 text-left font-semibold w-[20%]">Effective</th>
              <th className="px-3 py-2 text-left font-semibold w-[15%]">Unit</th>
            </tr>
          </thead>
          <tbody>
            {truckingRates.map(t => renderRateRow(t))}
          </tbody>
        </table>
      </div>

      {/* Replenishment */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Additional Replenishment Shipments to Amazon FBA</h3>
        <table className="w-full table-fixed text-sm">
          <tbody>
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
        <h3 className="text-sm font-semibold text-foreground mb-3">Ocean Freight</h3>
        <p className="text-sm text-muted-foreground">
          Ask for current rates. Tactical will handle freight forwarding from point of manufacture to point of sale.
        </p>
      </div>

      {/* Drayage */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Port Pickup and Deliver to Tactical Warehouse (Drayage)</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Covers drayage to Tactical warehouse and includes all chassis fees.
        </p>
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold w-[45%]">Service</th>
              <th className="px-3 py-2 text-right font-semibold w-[20%]">Rate</th>
              <th className="px-3 py-2 text-left font-semibold w-[20%]">Effective</th>
              <th className="px-3 py-2 text-left font-semibold w-[15%]">Unit</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(t => renderRateRow(t))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface AddRateModalProps {
  template: typeof RATE_TEMPLATES.inbound[0]
  warehouseName: string
  onClose: () => void
  onSubmit: (formData: { costValue: number; effectiveDate: string; endDate: string | null }) => Promise<void> | void
}

function AddRateModal({ template, warehouseName, onClose, onSubmit }: AddRateModalProps) {
  const [formData, setFormData] = useState({
    costValue: template.defaultValue.toString(),
    effectiveDate: new Date().toISOString().split('T')[0],
    endDate: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!formData.costValue || !formData.effectiveDate) {
      toast.error('Please fill in all required fields')
      return
    }

    const numericValue = parseFloat(formData.costValue)
    if (Number.isNaN(numericValue) || numericValue < 0) {
      toast.error('Rate must be a valid number')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        costValue: numericValue,
        effectiveDate: formData.effectiveDate,
        endDate: formData.endDate || null,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        <div className="relative w-full max-w-lg transform rounded-xl bg-white shadow-2xl transition-all">
          <div className="border-b border-slate-200 bg-gradient-to-r from-cyan-50 to-blue-50 px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-cyan-200 shadow-sm">
                    <DollarSign className="h-5 w-5 text-cyan-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">Add Cost Rate</h3>
                </div>
                <p className="text-sm text-slate-600 mt-2">
                  {warehouseName} • {template.costName}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-600 transition-colors"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <p className="text-sm font-medium text-slate-900">{template.costCategory}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Unit of Measure</label>
                <p className="text-sm font-medium text-slate-900">{formatUnitLabel(template.unitOfMeasure)}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Rate (USD) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costValue}
                  onChange={(e) => setFormData({ ...formData, costValue: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-shadow"
                  placeholder="0.00"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Effective Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-shadow"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                End Date <span className="text-slate-400 text-xs font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                min={formData.effectiveDate}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-shadow"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium rounded-lg hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Create Rate
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function formatUnitLabel(unit: string) {
  const unitLabels: Record<string, string> = {
    per_container: 'per container',
    per_carton: 'per carton',
    per_pallet: 'per pallet',
    per_pallet_day: 'per pallet/day',
    per_sku: 'per SKU',
    per_hour: 'per hour',
    per_delivery: 'per delivery',
    per_shipment: 'per shipment',
    flat: 'flat',
  }
  return unitLabels[unit] || unit
}

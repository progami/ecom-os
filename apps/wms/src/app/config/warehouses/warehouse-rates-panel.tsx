'use client'

import {
  Boxes,
  Package,
  Warehouse as WarehouseIcon,
  Truck,
  Ship,
  Check,
  Info,
  ChevronRight
} from '@/lib/lucide-icons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { usePersistedTab } from '@/hooks/usePersistedState'

interface WarehouseRatesPanelProps {
  warehouseId: string
  warehouseName: string
  warehouseCode: string
}

type TabKey = 'receiving' | 'storage' | 'outbound' | 'fba-trucking' | 'drayage'

export function WarehouseRatesPanel({
  warehouseId,
  warehouseName,
  warehouseCode
}: WarehouseRatesPanelProps) {
  // Use persisted tab state - remembers which tab user was on
  const [activeTab, setActiveTab] = usePersistedTab(
    `/config/warehouses/${warehouseId}/rates`,
    'receiving'
  )

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'receiving', label: 'Receiving', icon: <Boxes className="h-4 w-4" /> },
    { key: 'storage', label: 'Storage', icon: <WarehouseIcon className="h-4 w-4" /> },
    { key: 'outbound', label: 'Outbound', icon: <Package className="h-4 w-4" /> },
    { key: 'fba-trucking', label: 'FBA Trucking', icon: <Truck className="h-4 w-4" /> },
    { key: 'drayage', label: 'Drayage', icon: <Ship className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{warehouseName}</h2>
          <p className="text-sm text-slate-500">Rate Sheet • {warehouseCode} • USD</p>
        </div>
        <Badge className="bg-green-50 text-green-700 border-green-200">
          Active
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="FCL 20'" value="$650" sublabel="Base rate" />
        <SummaryCard label="Storage" value="$0.69" sublabel="/pallet/day" />
        <SummaryCard label="Outbound" value="$1.00" sublabel="/carton" />
        <SummaryCard label="LCL" value="$0.95" sublabel="/carton" />
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
        {activeTab === 'receiving' && <ReceivingTab />}
        {activeTab === 'storage' && <StorageTab />}
        {activeTab === 'outbound' && <OutboundTab />}
        {activeTab === 'fba-trucking' && <FBATruckingTab />}
        {activeTab === 'drayage' && <DrayageTab />}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{sublabel}</p>
    </div>
  )
}

function ReceivingTab() {
  return (
    <div className="space-y-6">
      {/* FCL Container Handling */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">FCL Container Handling</CardTitle>
            <Badge className="bg-blue-50 text-blue-700 border-blue-200">Per Container</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Container Type</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600">Base Rate</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">SKU Allowance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <tr className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">20' Standard</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">$650</td>
                  <td className="py-3 px-4 text-slate-600" rowSpan={4}>
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span>Up to 10 SKUs included<br />+$10 per additional SKU</span>
                    </div>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">40' Standard</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">$825</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">40' High Cube</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">$875</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">45' High Cube</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">$950</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Included Services */}
          <div className="bg-green-50/50 rounded-lg p-4 border border-green-100">
            <p className="text-sm font-medium text-green-800 mb-3">Included Services</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                'Unloading & Sorting',
                'Carton Labeling',
                'Palletizing',
                'Shrink Wrapping',
                'FBA Pallet Labels',
                'Delivery Arrangement'
              ].map((service) => (
                <div key={service} className="flex items-center gap-2 text-sm text-green-700">
                  <Check className="h-4 w-4 text-green-600" />
                  {service}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LCL Handling */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">LCL Handling</CardTitle>
            <Badge className="bg-purple-50 text-purple-700 border-purple-200">Per Carton</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 font-semibold text-slate-600">Service</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">Rate</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600">Unit</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-4 font-medium text-slate-900">LCL Receiving</td>
                <td className="py-3 px-4 text-right font-semibold text-slate-900">$0.95</td>
                <td className="py-3 px-4 text-slate-600">Per carton</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function StorageTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Pallet Storage</CardTitle>
            <Badge className="bg-amber-50 text-amber-700 border-amber-200">Tiered Pricing</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 font-semibold text-slate-600">Duration</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">Daily Rate</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">Monthly Est.</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-4">
                  <span className="font-medium text-slate-900">1 – 6 months</span>
                </td>
                <td className="py-3 px-4 text-right font-semibold text-slate-900">$0.69</td>
                <td className="py-3 px-4 text-right text-slate-600">~$20.70/pallet</td>
                <td className="py-3 px-4 text-slate-600">Standard rate</td>
              </tr>
              <tr className="hover:bg-slate-50/50 bg-amber-50/30">
                <td className="py-3 px-4">
                  <span className="font-medium text-slate-900">6+ months</span>
                </td>
                <td className="py-3 px-4 text-right font-semibold text-amber-700">$1.20</td>
                <td className="py-3 px-4 text-right text-slate-600">~$36.00/pallet</td>
                <td className="py-3 px-4 text-amber-700">Long-term storage</td>
              </tr>
            </tbody>
          </table>

          {/* Cost Calculator */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-sm font-medium text-slate-700 mb-3">Monthly Cost Examples (30 days)</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-slate-900">$207</p>
                <p className="text-xs text-slate-500">10 pallets (1-6 mo)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">$1,035</p>
                <p className="text-xs text-slate-500">50 pallets (1-6 mo)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">$3,600</p>
                <p className="text-xs text-slate-500">100 pallets (6+ mo)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function OutboundTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Amazon FBA Replenishment</CardTitle>
            <Badge className="bg-green-50 text-green-700 border-green-200">Per Carton</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 font-semibold text-slate-600">Service</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">Rate</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-600">Unit</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-600">Minimum</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium text-slate-900">Loose Cartons</p>
                    <p className="text-xs text-slate-500 mt-1">Replenishment to Amazon FBA</p>
                  </div>
                </td>
                <td className="py-3 px-4 text-right font-semibold text-slate-900">$1.00</td>
                <td className="py-3 px-4 text-slate-600">Per carton</td>
                <td className="py-3 px-4 text-right">
                  <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                    $15.00 / shipment
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Additional replenishment shipments</p>
                <p className="mt-1 text-blue-700">
                  From warehouse inventory to Amazon FBA fulfillment centers.
                  Minimum charge of $15.00 applies per shipment.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function FBATruckingTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">FBA Delivery (Warehouse → Amazon)</CardTitle>
            <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200">Per Pallet</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pallet Tiers */}
          <div>
            <p className="text-sm font-medium text-slate-600 mb-3">Pallet Tier Pricing</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Pallet Range</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600">Rate / Pallet</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <tr className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">1 – 8 pallets</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">$0.00</td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">LTL</span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">9 – 12 pallets</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">$0.00</td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">Partial</span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">13 – 28 pallets</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">$0.00</td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-1 rounded bg-cyan-100 text-cyan-700">FTL</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Accessorial Charges */}
          <div>
            <p className="text-sm font-medium text-slate-600 mb-3">Accessorial Charges</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Charge Type</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600">Rate</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <tr className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">Waiting Time</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">$0.00/hr</td>
                  <td className="py-3 px-4 text-slate-600">After 4 hours included</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">Weekend Delivery</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">$0.00</td>
                  <td className="py-3 px-4 text-slate-600">Per delivery</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">Rush Fee (24-hr)</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">$0.00</td>
                  <td className="py-3 px-4 text-slate-600">Per delivery</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DrayageTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Port → Tactical Warehouse</CardTitle>
            <Badge className="bg-slate-100 text-slate-700 border-slate-200">Quoted</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-amber-50/50 rounded-lg border border-amber-100">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Base drayage rates are quoted per shipment</p>
                <p className="mt-1 text-amber-700">
                  Chassis fees are now included in the base drayage rate.
                </p>
              </div>
            </div>
          </div>

          {/* Fixed Surcharges */}
          <div>
            <p className="text-sm font-medium text-slate-600 mb-3">Fixed Surcharges</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Service</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600">Rate</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600">Unit</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 font-medium text-slate-900">Pre-Pull / Night Pull</td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900">$175</td>
                  <td className="py-3 px-4 text-slate-600">Per container</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Pass-Through Charges */}
          <div>
            <p className="text-sm font-medium text-slate-600 mb-3">Pass-Through Charges (Billed at Cost)</p>
            <div className="space-y-2">
              {[
                { name: 'Pier Pass 2.0 (TMF)', desc: 'Current terminal rate applies' },
                { name: 'Container Storage / Per Diem', desc: 'Port/terminal charges' },
                { name: 'Demurrage', desc: 'Shipping line charges' },
                { name: 'CTF (Clean Truck Fee)', desc: 'Where applicable' },
              ].map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

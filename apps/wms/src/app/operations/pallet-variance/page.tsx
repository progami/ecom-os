'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  FileText,
  Plus,
  Minus,
  Download,
  TrendingUp,
  TrendingDown
} from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { StatsCard } from '@/components/ui/stats-card'
import { toast } from 'react-hot-toast'
import { redirectToPortal } from '@/lib/portal'

interface PalletVariance {
  id: string
  warehouseId: string
  warehouse: { name: string; code: string }
  skuId: string
  sku: { skuCode: string; description: string }
  batchLot: string
  systemPallets: number
  actualPallets: number
  variance: number
  variancePercentage: number
  lastPhysicalCount: string | null
  notes: string | null
  status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED'
  createdAt: string
  updatedAt: string
}

export default function PalletVariancePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [variances, setVariances] = useState<PalletVariance[]>([])
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'pending'>('pending')
  const [selectedVariance, setSelectedVariance] = useState<PalletVariance | null>(null)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustmentData, setAdjustmentData] = useState({
    actualPallets: 0,
    reason: '',
    notes: ''
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirectToPortal('/login', `${window.location.origin}/operations/pallet-variance`)
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  useEffect(() => {
    fetchVariances()
  }, [])

  const fetchVariances = async () => {
    try {
      setLoading(true)
      // API endpoint removed - set empty data
      setVariances([])
    } catch (_error) {
      toast.error('Failed to load pallet variances')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAdjustment = async () => {
    if (!selectedVariance || !adjustmentData.reason) {
      toast.error('Please provide a reason for the adjustment')
      return
    }

    try {
      const adjustmentType = adjustmentData.actualPallets > selectedVariance.systemPallets ? 'ADJUST_IN' : 'ADJUST_OUT'
      const palletDifference = Math.abs(adjustmentData.actualPallets - selectedVariance.systemPallets)
      
      // Calculate cartons based on the pallet configuration
      const cartonsToAdjust = palletDifference * 50 // Assuming 50 cartons per pallet as default

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: selectedVariance.warehouseId,
          skuId: selectedVariance.skuId,
          batchLot: selectedVariance.batchLot,
          transactionType: adjustmentType,
          referenceId: `PALLET-ADJ-${Date.now()}`,
          cartonsIn: adjustmentType === 'ADJUST_IN' ? cartonsToAdjust : 0,
          cartonsOut: adjustmentType === 'ADJUST_OUT' ? cartonsToAdjust : 0,
          storagePalletsIn: adjustmentType === 'ADJUST_IN' ? palletDifference : 0,
          shippingPalletsOut: adjustmentType === 'ADJUST_OUT' ? palletDifference : 0,
          notes: `Pallet variance adjustment: ${adjustmentData.reason}. ${adjustmentData.notes}`,
          transactionDate: new Date().toISOString()
        })
      })

      if (response.ok) {
        // Update variance status
        // API endpoint removed - skip update

        toast.success('Adjustment created successfully')
        setShowAdjustModal(false)
        setSelectedVariance(null)
        setAdjustmentData({ actualPallets: 0, reason: '', notes: '' })
        fetchVariances()
      } else {
        toast.error('Failed to create adjustment')
      }
    } catch (_error) {
      toast.error('Failed to create adjustment')
    }
  }

  const handleExport = () => {
    // API endpoint removed
    toast.error('Export feature not available')
  }

  const filteredVariances = variances.filter(v => {
    if (filter === 'positive') return v.variance > 0
    if (filter === 'negative') return v.variance < 0
    if (filter === 'pending') return v.status === 'PENDING'
    return true
  })

  const totalVariance = variances.reduce((sum, v) => sum + v.variance, 0)
  const positiveCount = variances.filter(v => v.variance > 0).length
  const negativeCount = variances.filter(v => v.variance < 0).length
  const pendingCount = variances.filter(v => v.status === 'PENDING').length

  if (loading || status === 'loading') {
    return (
      <DashboardLayout>
        <PageContainer>
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent dark:border-[#00C2B9]" />
          </div>
        </PageContainer>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="Pallet Variance"
          description="Operations"
          icon={AlertTriangle}
          actions={
            <div className="flex items-center gap-2">
              <Button onClick={fetchVariances} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button onClick={handleExport} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export Report
              </Button>
            </div>
          }
        />
        <PageContent>
        <div className="flex flex-col gap-6">

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatsCard
            title="Total Variance"
            value={`${totalVariance > 0 ? '+' : ''}${totalVariance} pallets`}
            icon={Package}
            variant={totalVariance > 0 ? 'success' : totalVariance < 0 ? 'danger' : 'default'}
            size="sm"
          />
          <StatsCard
            title="Overages"
            value={positiveCount}
            subtitle="Physical > System"
            icon={TrendingUp}
            variant="success"
            size="sm"
          />
          <StatsCard
            title="Shortages"
            value={negativeCount}
            subtitle="Physical < System"
            icon={TrendingDown}
            variant="danger"
            size="sm"
          />
          <StatsCard
            title="Pending Review"
            value={pendingCount}
            icon={AlertTriangle}
            variant="warning"
            size="sm"
          />
        </div>

        {/* Filter Tabs */}
        <div className="border-b">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setFilter('all')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === 'all'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              All ({variances.length})
            </button>
            <button
              onClick={() => setFilter('positive')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === 'positive'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Overages ({positiveCount})
            </button>
            <button
              onClick={() => setFilter('negative')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === 'negative'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Shortages ({negativeCount})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === 'pending'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Pending ({pendingCount})
            </button>
          </nav>
        </div>

        {/* Variance Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft dark:border-[#0b3a52] dark:bg-[#06182b]">
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 dark:border-[#0b3a52] dark:bg-[#041324]">
            <h3 className="text-lg font-semibold">Pallet Variances</h3>
            <p className="text-sm text-slate-600 mt-1">
              Showing {filteredVariances.length} of {variances.length} variances
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Batch/Lot
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  System Pallets
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actual Pallets
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Variance
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Last Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVariances.map((variance) => (
                <tr key={variance.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {variance.warehouse.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div>
                      <div className="font-medium">{variance.sku.skuCode}</div>
                      <div className="text-xs text-slate-500">{variance.sku.description}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {variance.batchLot}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    {variance.systemPallets}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-medium">
                    {variance.actualPallets}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <div className={`inline-flex items-center gap-1 font-medium ${
                      variance.variance > 0 ? 'text-green-600' : variance.variance < 0 ? 'text-red-600' : 'text-slate-600'
                    }`}>
                      {variance.variance > 0 ? (
                        <Plus className="h-3 w-3" />
                      ) : variance.variance < 0 ? (
                        <Minus className="h-3 w-3" />
                      ) : null}
                      {Math.abs(variance.variance)} ({variance.variancePercentage.toFixed(1)}%)
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      variance.status === 'RESOLVED' 
                        ? 'bg-green-100 text-green-800'
                        : variance.status === 'INVESTIGATING'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {variance.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {variance.lastPhysicalCount 
                      ? new Date(variance.lastPhysicalCount).toLocaleDateString()
                      : 'Never'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {variance.status !== 'RESOLVED' && (
                      <Button
                        onClick={() => {
                          setSelectedVariance(variance)
                          setAdjustmentData({
                            actualPallets: variance.actualPallets,
                            reason: '',
                            notes: ''
                          })
                          setShowAdjustModal(true)
                        }}
                        variant="ghost"
                        size="icon"
                        className="text-primary hover:text-primary"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredVariances.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12">
                    <EmptyState
                      icon={CheckCircle}
                      title="No variances found"
                      description={filter === 'pending' 
                        ? "No pending variances to review."
                        : "No pallet variances match the selected filter."
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>
        </div>
        </PageContent>
      </PageContainer>

      {/* Adjustment Modal */}
      {showAdjustModal && selectedVariance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Create Pallet Adjustment</h3>
            
            <div className="space-y-2">
              <div className="bg-slate-50 p-3 rounded">
                <div className="text-sm">
                  <p><span className="font-medium">SKU:</span> {selectedVariance.sku.skuCode}</p>
                  <p><span className="font-medium">Batch:</span> {selectedVariance.batchLot}</p>
                  <p><span className="font-medium">Warehouse:</span> {selectedVariance.warehouse.name}</p>
                  <p className="mt-2">
                    <span className="font-medium">System Count:</span> {selectedVariance.systemPallets} pallets
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Actual Physical Count *</label>
                <input
                  type="number"
                  value={adjustmentData.actualPallets}
                  onChange={(e) => setAdjustmentData({
                    ...adjustmentData,
                    actualPallets: parseInt(e.target.value) || 0
                  })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  min="0"
                />
                {adjustmentData.actualPallets !== selectedVariance.systemPallets && (
                  <p className={`text-sm mt-1 ${
                    adjustmentData.actualPallets > selectedVariance.systemPallets 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {adjustmentData.actualPallets > selectedVariance.systemPallets ? 'Increase' : 'Decrease'} of{' '}
                    {Math.abs(adjustmentData.actualPallets - selectedVariance.systemPallets)} pallets
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reason for Adjustment *</label>
                <select
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData({
                    ...adjustmentData,
                    reason: e.target.value
                  })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select reason</option>
                  <option value="Physical count correction">Physical count correction</option>
                  <option value="Damaged pallets">Damaged pallets</option>
                  <option value="Misplaced inventory">Misplaced inventory</option>
                  <option value="Data entry error">Data entry error</option>
                  <option value="Theft or loss">Theft or loss</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Additional Notes</label>
                <textarea
                  value={adjustmentData.notes}
                  onChange={(e) => setAdjustmentData({
                    ...adjustmentData,
                    notes: e.target.value
                  })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Provide additional details..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  onClick={() => {
                    setShowAdjustModal(false)
                    setSelectedVariance(null)
                  }}
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateAdjustment}
                  disabled={!adjustmentData.reason || adjustmentData.actualPallets === selectedVariance.systemPallets}
                  className="gap-2"
                >
                  Create Adjustment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

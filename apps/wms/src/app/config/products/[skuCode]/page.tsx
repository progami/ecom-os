'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Calendar, Box, Package2 } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PageContainer, PageContent, PageHeaderSection } from '@/components/layout/page-container'
import { toast } from 'react-hot-toast'

interface BatchDetail {
  batchLot: string
  batchCode: string | null
  description: string | null
  productionDate: string | null
  expiryDate: string | null
  currentUnits: number
  currentCartons: number
  currentPallets: number
  storageCartonsPerPallet: number | null
  shippingCartonsPerPallet: number | null
  firstReceiveDate: string | null
  lastTransactionDate: string | null
  transactions: Array<{
    id: string
    transactionType: string
    transactionDate: string
    referenceId: string | null
    cartonsIn: number
    cartonsOut: number
    storagePalletsIn: number
    shippingPalletsOut: number
    createdByName: string
  }>
}

interface SkuBatchData {
  skuCode: string
  description: string
  asin: string | null
  unitsPerCarton: number
  unitDimensionsCm: string | null
  unitWeightKg: number | null
  cartonDimensionsCm: string | null
  cartonWeightKg: number | null
  packagingType: string | null
  batches: BatchDetail[]
}

export default function SkuDetailPage({ params }: { params: Promise<{ skuCode: string }> }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [skuData, setSkuData] = useState<SkuBatchData | null>(null)
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(0)
  const [skuCode, setSkuCode] = useState<string | null>(null)

  useEffect(() => {
    params.then(p => {
      setSkuCode(p.skuCode)
    })
  }, [params])

useEffect(() => {
  if (!skuCode) return
  let isMounted = true

  const loadSkuData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/inventory/skus/${skuCode}/batches`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to load SKU data')
      }

      const data = await response.json()
      if (!isMounted) return
      setSkuData(data)

      if (data.batches.length === 0) {
        toast.error('No batches found for this SKU')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load SKU data')
      router.push('/config/products')
    } finally {
      if (isMounted) {
        setLoading(false)
      }
    }
  }

  loadSkuData()

  return () => {
    isMounted = false
  }
}, [router, skuCode])

  const formatNumber = (value: number) => {
    return value.toLocaleString()
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString()
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
            <span>Loading SKU details…</span>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!skuData) {
    return null
  }

  const selectedBatch = skuData.batches[selectedBatchIndex]

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title={`${skuData.skuCode} - ${skuData.description}`}
          description="Batch Details"
          icon={Package}
          actions={
            <Button asChild variant="ghost" size="icon">
              <Link href="/config/products">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          }
        />
        <PageContent>
          <div className="mx-auto max-w-7xl space-y-6">
            {/* SKU Master Data Card */}
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">SKU Information</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <p className="text-xs uppercase text-slate-500">SKU Code</p>
                  <p className="text-base font-medium text-slate-900">{skuData.skuCode}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">ASIN</p>
                  <p className="text-base font-medium text-slate-900">{skuData.asin || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Units per Carton</p>
                  <p className="text-base font-medium text-slate-900">{skuData.unitsPerCarton}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Packaging Type</p>
                  <p className="text-base font-medium text-slate-900">{skuData.packagingType || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Unit Dimensions</p>
                  <p className="text-base font-medium text-slate-900">{skuData.unitDimensionsCm || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Unit Weight</p>
                  <p className="text-base font-medium text-slate-900">
                    {skuData.unitWeightKg ? `${skuData.unitWeightKg} kg` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Carton Dimensions</p>
                  <p className="text-base font-medium text-slate-900">{skuData.cartonDimensionsCm || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Carton Weight</p>
                  <p className="text-base font-medium text-slate-900">
                    {skuData.cartonWeightKg ? `${skuData.cartonWeightKg} kg` : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Batch Selector and Details */}
            {skuData.batches.length > 0 ? (
              <>
                {/* Batch Selector Dropdown */}
                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <label htmlFor="batch-selector" className="mb-2 block text-sm font-medium text-slate-700">
                    Select Batch ({skuData.batches.length} total)
                  </label>
                  <select
                    id="batch-selector"
                    value={selectedBatchIndex}
                    onChange={(e) => setSelectedBatchIndex(parseInt(e.target.value))}
                    className="w-full rounded-md border px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {skuData.batches.map((batch, index) => (
                      <option key={batch.batchLot} value={index}>
                        Batch {batch.batchLot} — {formatNumber(batch.currentUnits)} units on hand
                        {batch.firstReceiveDate && ` — Received ${formatDate(batch.firstReceiveDate)}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Batch Details */}
                {selectedBatch && (
                  <>
                    {/* Batch Metadata */}
                    <div className="rounded-lg border bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <Package2 className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-slate-900">Batch {selectedBatch.batchLot}</h2>
                      </div>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div>
                          <p className="text-xs uppercase text-slate-500">Batch Code</p>
                          <p className="text-base font-medium text-slate-900">{selectedBatch.batchCode || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-500">Description</p>
                          <p className="text-base font-medium text-slate-900">{selectedBatch.description || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-500">Production Date</p>
                          <p className="text-base font-medium text-slate-900">
                            {formatDate(selectedBatch.productionDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-500">Expiry Date</p>
                          <p className="text-base font-medium text-slate-900">
                            {formatDate(selectedBatch.expiryDate)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Current Quantities */}
                    <div className="rounded-lg border bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <Box className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-slate-900">Current Quantities</h2>
                      </div>
                      <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
                        <div>
                          <p className="text-xs uppercase text-slate-500">Units On Hand</p>
                          <p className="text-2xl font-bold text-slate-900">{formatNumber(selectedBatch.currentUnits)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-500">Cartons</p>
                          <p className="text-2xl font-bold text-slate-900">{formatNumber(selectedBatch.currentCartons)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-500">Pallets</p>
                          <p className="text-2xl font-bold text-slate-900">{formatNumber(selectedBatch.currentPallets)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-500">Storage CPN</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {selectedBatch.storageCartonsPerPallet || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-500">Shipping CPN</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {selectedBatch.shippingCartonsPerPallet || '—'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 text-sm">
                        <div>
                          <p className="text-xs uppercase text-slate-500">First Receive Date</p>
                          <p className="text-base font-medium text-slate-900">
                            {formatDate(selectedBatch.firstReceiveDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-500">Last Transaction Date</p>
                          <p className="text-base font-medium text-slate-900">
                            {formatDate(selectedBatch.lastTransactionDate)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Transaction History */}
                    <div className="rounded-lg border bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-slate-900">Transaction History</h2>
                      </div>
                      {selectedBatch.transactions.length === 0 ? (
                        <p className="text-sm text-slate-500">No transactions recorded</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full table-auto text-sm">
                            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold">Date</th>
                                <th className="px-3 py-2 text-left font-semibold">Type</th>
                                <th className="px-3 py-2 text-left font-semibold">Reference</th>
                                <th className="px-3 py-2 text-right font-semibold">Cartons In</th>
                                <th className="px-3 py-2 text-right font-semibold">Cartons Out</th>
                                <th className="px-3 py-2 text-right font-semibold">Pallets In</th>
                                <th className="px-3 py-2 text-right font-semibold">Pallets Out</th>
                                <th className="px-3 py-2 text-left font-semibold">Created By</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedBatch.transactions.map((txn) => (
                                <tr key={txn.id} className="odd:bg-muted/20">
                                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(txn.transactionDate)}</td>
                                  <td className="px-3 py-2">
                                    <span
                                      className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                                        txn.transactionType === 'RECEIVE'
                                          ? 'bg-green-100 text-green-800'
                                          : txn.transactionType === 'SHIP'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {txn.transactionType}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">{txn.referenceId || '—'}</td>
                                  <td className="px-3 py-2 text-right font-medium">{formatNumber(txn.cartonsIn)}</td>
                                  <td className="px-3 py-2 text-right font-medium">{formatNumber(txn.cartonsOut)}</td>
                                  <td className="px-3 py-2 text-right font-medium">{formatNumber(txn.storagePalletsIn)}</td>
                                  <td className="px-3 py-2 text-right font-medium">{formatNumber(txn.shippingPalletsOut)}</td>
                                  <td className="px-3 py-2">{txn.createdByName}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="rounded-lg border bg-white p-12 text-center shadow-sm">
                <Package className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No Batches Found</h3>
                <p className="mt-2 text-sm text-slate-500">
                  This SKU has no inventory batches. Create a receive order to add inventory.
                </p>
              </div>
            )}
          </div>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}

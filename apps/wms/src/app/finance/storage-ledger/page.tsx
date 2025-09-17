'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DollarSign } from '@/lib/lucide-icons'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { StorageLedgerTab } from '@/components/finance/storage-ledger-tab'

export default function StorageLedgerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [selectedWarehouseCode, setSelectedWarehouseCode] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      const central = process.env.NEXT_PUBLIC_CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
      const url = new URL('/login', central)
      url.searchParams.set('callbackUrl', window.location.origin + '/finance/storage-ledger')
      window.location.href = url.toString()
      return
    }
    if (!['staff', 'admin'].includes(session.user.role)) {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch('/api/warehouses')
        if (!response.ok) {
          return
        }

        const data = await response.json()
        if (!Array.isArray(data)) {
          return
        }

        const mapped = data.map((warehouse) => ({
          id: warehouse.id,
          name: warehouse.name,
          code: warehouse.code,
        }))

        setWarehouses(mapped)

        if (!selectedWarehouseCode && session?.user?.warehouseId) {
          const match = mapped.find(wh => wh.id === session.user.warehouseId)
          if (match) {
            setSelectedWarehouseCode(match.code)
          }
        }
      } catch (_error) {
        // failure silently ignored; hook handles empty state
      }
    }

    if (status === 'authenticated') {
      void fetchWarehouses()
    }
  }, [session, status, selectedWarehouseCode])

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-4">
        <PageHeader
          title="Storage Ledger"
          subtitle="Weekly inventory balance tracking"
          icon={DollarSign}
          iconColor="text-green-600"
          bgColor="bg-green-50"
          borderColor="border-green-200"
          textColor="text-green-800"
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Review weekly balances and storage costs. Adjust the date range inside the ledger to refine the view.
          </p>
          <div className="flex items-center gap-2">
            <label
              htmlFor="storage-ledger-warehouse"
              className="text-sm font-medium text-muted-foreground"
            >
              Warehouse
            </label>
            <select
              id="storage-ledger-warehouse"
              value={selectedWarehouseCode}
              onChange={(event) => setSelectedWarehouseCode(event.target.value)}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.code}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <StorageLedgerTab warehouseCode={selectedWarehouseCode || undefined} />
      </div>
    </DashboardLayout>
  )
}

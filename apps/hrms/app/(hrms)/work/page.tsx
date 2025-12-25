'use client'

import { useCallback, useEffect, useState } from 'react'
import { WorkItemsApi } from '@/lib/api-client'
import { BellIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { WorkQueueDashboard } from '@/components/work-queue/WorkQueueDashboard'
import type { WorkItemsResponse, WorkItemDTO } from '@/lib/contracts/work-items'
import type { ActionId } from '@/lib/contracts/action-ids'
import { executeAction } from '@/lib/actions/execute-action'

export default function WorkQueuePage() {
  const [data, setData] = useState<WorkItemsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (options?: { force?: boolean }) => {
    try {
      const force = options?.force ?? false
      setLoading(true)
      setError(null)
      const next = await WorkItemsApi.list({ force })
      setData(next)
      setSelectedId((prev) => {
        if (prev && next.items.some((i) => i.id === prev)) return prev
        return next.items[0]?.id ?? null
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load work items'
      console.error('Failed to load work items', e)
      setError(message)
      setData({ items: [], meta: { totalCount: 0, actionRequiredCount: 0, overdueCount: 0 } })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleAction = useCallback(async (actionId: ActionId, item: WorkItemDTO) => {
    setError(null)
    try {
      await executeAction(actionId, item.entity)
      await load({ force: true })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to complete action'
      setError(message)
    }
  }, [load])

  return (
    <>
      <ListPageHeader
        title="Work Queue"
        description="Your pending actions across HRMS"
        icon={<BellIcon className="h-6 w-6 text-white" />}
      />

      {error ? (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <WorkQueueDashboard
        data={data}
        loading={loading}
        error={null}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAction={handleAction}
      />
    </>
  )
}

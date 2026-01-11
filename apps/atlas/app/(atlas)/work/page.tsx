'use client'

import { useCallback, useEffect, useState } from 'react'
import { WorkItemsApi } from '@/lib/api-client'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { InboxDashboard } from '@/components/inbox'
import { CreateRequestModal } from '@/components/inbox/CreateRequestModal'
import type { WorkItemsResponse, WorkItemDTO, CompletedWorkItemsResponse } from '@/lib/contracts/work-items'
import type { ActionId } from '@/lib/contracts/action-ids'
import { executeAction } from '@/lib/actions/execute-action'

export type InboxTab = 'pending' | 'completed'

export default function WorkQueuePage() {
  const [activeTab, setActiveTab] = useState<InboxTab>('pending')
  const [data, setData] = useState<WorkItemsResponse | null>(null)
  const [completedData, setCompletedData] = useState<CompletedWorkItemsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [completedLoading, setCompletedLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [completedSelectedId, setCompletedSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  const loadPending = useCallback(async (options?: { force?: boolean }) => {
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

  const loadCompleted = useCallback(async (options?: { force?: boolean }) => {
    try {
      const force = options?.force ?? false
      setCompletedLoading(true)
      setError(null)
      const next = await WorkItemsApi.listCompleted({ force })
      setCompletedData(next)
      setCompletedSelectedId((prev) => {
        if (prev && next.items.some((i) => i.id === prev)) return prev
        return next.items[0]?.id ?? null
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load completed items'
      console.error('Failed to load completed items', e)
      setError(message)
      setCompletedData({ items: [], meta: { totalCount: 0 } })
    } finally {
      setCompletedLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPending()
  }, [loadPending])

  // Load completed items when switching to completed tab
  useEffect(() => {
    if (activeTab === 'completed' && !completedData) {
      loadCompleted()
    }
  }, [activeTab, completedData, loadCompleted])

  const handleTabChange = useCallback((tab: InboxTab) => {
    setActiveTab(tab)
    setError(null)
  }, [])

  const handleAction = useCallback(async (actionId: ActionId, item: WorkItemDTO) => {
    setError(null)
    try {
      await executeAction(actionId, item.entity)
      await loadPending({ force: true })
      // Also refresh completed since item might have moved there
      if (completedData) {
        await loadCompleted({ force: true })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to complete action'
      setError(message)
    }
  }, [loadPending, loadCompleted, completedData])

  const handleRequestCreated = useCallback(() => {
    setCreateModalOpen(false)
    loadPending({ force: true })
  }, [loadPending])

  return (
    <>
      {/* Hero header for Inbox */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white dark:text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
                Inbox
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Clear your pending tasks and approvals
              </p>
            </div>
          </div>

          <Button onClick={() => setCreateModalOpen(true)} variant="default" size="default">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Request
          </Button>
        </div>
      </div>

      <CreateRequestModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleRequestCreated}
      />

      {error ? (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <InboxDashboard
        activeTab={activeTab}
        onTabChange={handleTabChange}
        data={data}
        completedData={completedData}
        loading={loading}
        completedLoading={completedLoading}
        error={null}
        selectedId={activeTab === 'pending' ? selectedId : completedSelectedId}
        onSelect={activeTab === 'pending' ? setSelectedId : setCompletedSelectedId}
        onAction={handleAction}
      />
    </>
  )
}

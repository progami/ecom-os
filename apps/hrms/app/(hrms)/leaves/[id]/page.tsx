'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { LeavesApi } from '@/lib/api-client'
import type { ActionId } from '@/lib/contracts/action-ids'
import type { WorkflowRecordDTO } from '@/lib/contracts/workflow-record'
import { executeAction } from '@/lib/actions/execute-action'
import { WorkflowRecordLayout } from '@/components/layouts/WorkflowRecordLayout'
import { Alert } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function LeaveRequestWorkflowPage() {
  const params = useParams()
  const id = params.id as string

  const [dto, setDto] = useState<WorkflowRecordDTO | null>(null)
  const [leave, setLeave] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [workflow, raw] = await Promise.all([
        LeavesApi.getWorkflowRecord(id),
        LeavesApi.get(id),
      ])
      setDto(workflow)
      setLeave(raw)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load leave request'
      setError(message)
      setDto(null)
      setLeave(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const onAction = useCallback(async (actionId: ActionId) => {
    setError(null)
    try {
      await executeAction(actionId, { type: 'LEAVE_REQUEST', id })
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to complete action'
      setError(message)
    }
  }, [id, load])

  if (loading) {
    return (
      <Card padding="lg">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </Card>
    )
  }

  if (!dto) {
    return (
      <Card padding="lg">
        <p className="text-sm font-medium text-foreground">Leave request</p>
        <p className="text-sm text-muted-foreground mt-1">{error ?? 'Not found'}</p>
      </Card>
    )
  }

  return (
    <>
      {error ? (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <WorkflowRecordLayout data={dto} onAction={onAction}>
        {leave ? (
          <div className="space-y-6">
            <Card padding="lg">
              <h3 className="text-sm font-semibold text-foreground mb-3">Request details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Leave type</p>
                  <p className="text-sm text-foreground mt-0.5">{leave.leaveType?.replaceAll('_', ' ')?.toLowerCase() || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total days</p>
                  <p className="text-sm text-foreground mt-0.5">{String(leave.totalDays ?? '—')}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Start date</p>
                  <p className="text-sm text-foreground mt-0.5">{formatDate(leave.startDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">End date</p>
                  <p className="text-sm text-foreground mt-0.5">{formatDate(leave.endDate)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Reason</p>
                  <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">{leave.reason || '—'}</p>
                </div>
              </div>
            </Card>

            {leave.reviewedAt || leave.reviewNotes ? (
              <Card padding="lg">
                <h3 className="text-sm font-semibold text-foreground mb-3">Decision</h3>
                <div className="space-y-2 text-sm">
                  {leave.reviewedAt ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Reviewed at</p>
                      <p className="text-sm text-foreground mt-0.5">{formatDate(leave.reviewedAt)}</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Notes</p>
                    <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">{leave.reviewNotes || '—'}</p>
                  </div>
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}
      </WorkflowRecordLayout>
    </>
  )
}


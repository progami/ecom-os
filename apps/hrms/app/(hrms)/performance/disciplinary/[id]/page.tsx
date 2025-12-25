'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { DisciplinaryActionsApi } from '@/lib/api-client'
import type { ActionId } from '@/lib/contracts/action-ids'
import type { WorkflowRecordDTO } from '@/lib/contracts/workflow-record'
import { executeAction } from '@/lib/actions/execute-action'
import { WorkflowRecordLayout } from '@/components/layouts/WorkflowRecordLayout'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function DisciplinaryRecordPage() {
  const params = useParams()
  const id = params.id as string

  const [dto, setDto] = useState<WorkflowRecordDTO | null>(null)
  const [record, setRecord] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [workflow, raw] = await Promise.all([
        DisciplinaryActionsApi.getWorkflowRecord(id),
        DisciplinaryActionsApi.get(id),
      ])
      setDto(workflow)
      setRecord(raw)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load violation record'
      setError(message)
      setDto(null)
      setRecord(null)
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
      await executeAction(actionId, { type: 'DISCIPLINARY_ACTION', id })
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
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      </Card>
    )
  }

  if (!dto) {
    return (
      <Card padding="lg">
        <p className="text-sm font-medium text-gray-900">Violation record</p>
        <p className="text-sm text-gray-600 mt-1">{error ?? 'Not found'}</p>
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
        {record ? (
          <div className="space-y-6">
            <Card padding="lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Incident details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-gray-500">Description</p>
                  <p className="text-sm text-gray-900 mt-1 whitespace-pre-line">{record.description || '—'}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Incident date</p>
                    <p className="text-sm text-gray-900 mt-0.5">{formatDate(record.incidentDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Reported date</p>
                    <p className="text-sm text-gray-900 mt-0.5">{formatDate(record.reportedDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Reported by</p>
                    <p className="text-sm text-gray-900 mt-0.5">{record.reportedBy || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Witnesses</p>
                    <p className="text-sm text-gray-900 mt-0.5 whitespace-pre-line">{record.witnesses || '—'}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Action taken</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500">Action</p>
                  <p className="text-sm text-gray-900 mt-0.5">{record.actionTaken?.replaceAll('_', ' ') || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Action date</p>
                  <p className="text-sm text-gray-900 mt-0.5">{formatDate(record.actionDate)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-gray-500">Details</p>
                  <p className="text-sm text-gray-900 mt-0.5 whitespace-pre-line">{record.actionDetails || '—'}</p>
                </div>
              </div>
            </Card>
          </div>
        ) : null}
      </WorkflowRecordLayout>
    </>
  )
}


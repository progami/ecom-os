'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { WorkflowRecordLayout } from '@/components/layouts/WorkflowRecordLayout'
import type { WorkflowRecordDTO } from '@/lib/contracts/workflow-record'
import type { ActionId } from '@/lib/contracts/action-ids'
import { ChecklistsApi, MeApi, type ChecklistInstanceDetail } from '@/lib/api-client'
import { executeAction } from '@/lib/actions/execute-action'
import { ActionButton } from '@/components/ui/ActionButton'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function ChecklistInstancePage() {
  const params = useParams()
  const id = params.id as string

  const [workflow, setWorkflow] = useState<WorkflowRecordDTO | null>(null)
  const [detail, setDetail] = useState<ChecklistInstanceDetail | null>(null)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [me, wf, d] = await Promise.all([
        MeApi.get(),
        ChecklistsApi.getWorkflow(id),
        ChecklistsApi.get(id),
      ])
      setViewerId(me.id)
      setWorkflow(wf)
      setDetail(d)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load checklist'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleTaskAction = useCallback(
    async (actionId: ActionId, taskId: string) => {
      setError(null)
      try {
        await executeAction(actionId, { type: 'TASK', id: taskId })
        await load()
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to complete action'
        setError(message)
      }
    },
    [load]
  )

  if (!workflow) {
    return (
      <>
        {error ? (
          <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        <Card padding="lg">
          <p className="text-sm text-gray-600">{loading ? 'Loading…' : 'Checklist not available.'}</p>
        </Card>
      </>
    )
  }

  return (
    <>
      {error ? (
        <Alert variant="error" className="mb-6" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <WorkflowRecordLayout data={workflow}>
        <Card padding="md">
          <h2 className="text-sm font-semibold text-gray-900">Items</h2>
          <p className="text-xs text-gray-500 mt-1">Complete the tasks below to finish this checklist.</p>

          {!detail ? (
            <p className="text-sm text-gray-600 mt-4">{loading ? 'Loading items…' : 'No items.'}</p>
          ) : (
            <div className="mt-4 space-y-3">
              {detail.items.map((item) => {
                const task = item.task
                const assignedTo = task?.assignedTo

                const canAct = Boolean(task && viewerId && assignedTo?.id === viewerId)
                const disabledReason = task
                  ? canAct
                    ? undefined
                    : assignedTo
                      ? `Assigned to ${assignedTo.firstName} ${assignedTo.lastName}`
                      : 'Not assigned'
                  : item.status === 'BLOCKED'
                    ? 'Blocked until prerequisite is completed.'
                    : undefined

                const nextAction: { id: ActionId; label: string } | null = task
                  ? task.status === 'OPEN'
                    ? { id: 'task.markInProgress', label: 'Start' }
                    : task.status === 'IN_PROGRESS'
                      ? { id: 'task.markDone', label: 'Mark done' }
                      : null
                  : null

                return (
                  <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{item.templateItem.title}</span>
                          <span
                            className={
                              item.status === 'DONE'
                                ? 'text-xs rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5'
                                : item.status === 'BLOCKED'
                                  ? 'text-xs rounded-full bg-amber-50 text-amber-700 px-2 py-0.5'
                                  : 'text-xs rounded-full bg-blue-50 text-blue-700 px-2 py-0.5'
                            }
                          >
                            {item.status.replaceAll('_', ' ').toLowerCase()}
                          </span>
                        </div>

                        {item.templateItem.description ? (
                          <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{item.templateItem.description}</p>
                        ) : null}

                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                          <span>Owner: {item.templateItem.ownerType}</span>
                          <span>Due: {formatDate(item.dueDate ?? task?.dueDate ?? null)}</span>
                          {item.completedAt ? <span>Completed: {formatDate(item.completedAt)}</span> : null}
                        </div>

                        {task ? (
                          <div className="mt-2 text-xs text-gray-500">
                            Task:{' '}
                            <Link href={`/tasks/${task.id}`} className="text-blue-700 hover:underline">
                              {task.title}
                            </Link>
                          </div>
                        ) : null}
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {nextAction ? (
                          <ActionButton
                            label={nextAction.label}
                            disabled={!canAct}
                            disabledReason={disabledReason}
                            onClick={() => handleTaskAction(nextAction.id, task!.id)}
                          />
                        ) : (
                          <ActionButton label="No action" disabled disabledReason={disabledReason ?? 'No action available.'} />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </WorkflowRecordLayout>
    </>
  )
}


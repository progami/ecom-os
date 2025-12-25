'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ActionButton } from '@/components/ui/ActionButton'
import { WorkflowTimeline } from '@/components/workflow/WorkflowTimeline'
import { ArrowLeftIcon } from '@/components/ui/Icons'
import type { ActionId } from '@/lib/contracts/action-ids'
import type { WorkflowRecordDTO, WorkflowTone } from '@/lib/contracts/workflow-record'
import type { WorkflowActionVariant } from '@/lib/contracts/workflow-record'

type WorkflowRecordLayoutProps = {
  backHref?: string
  data: WorkflowRecordDTO
  onAction?: (actionId: ActionId) => void | Promise<void>
  children?: React.ReactNode
}

function toneToBadgeVariant(tone: WorkflowTone): 'default' | 'info' | 'success' | 'warning' | 'error' {
  switch (tone) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'danger':
      return 'error'
    case 'info':
      return 'info'
    case 'neutral':
    default:
      return 'default'
  }
}

function actionVariantToButtonVariant(variant: WorkflowActionVariant): 'primary' | 'secondary' | 'ghost' | 'danger' {
  switch (variant) {
    case 'danger':
      return 'danger'
    case 'secondary':
      return 'secondary'
    case 'ghost':
      return 'ghost'
    case 'primary':
    default:
      return 'primary'
  }
}

export function WorkflowRecordLayout({ backHref = '/work', data, onAction, children }: WorkflowRecordLayoutProps) {
  const headerBadges = useMemo(() => {
    const badges: Array<{ label: string; tone: WorkflowTone }> = []
    if (data.workflow.statusBadge) badges.push({ label: data.workflow.statusBadge.label, tone: data.workflow.statusBadge.tone })
    if (data.workflow.severity) badges.push({ label: data.workflow.severity.label, tone: data.workflow.severity.tone })
    if (data.subject.statusChip) badges.push({ label: data.subject.statusChip.label, tone: data.subject.statusChip.tone })

    if (data.workflow.sla) {
      if (data.workflow.sla.isOverdue && data.workflow.sla.overdueLabel) {
        badges.push({
          label: data.workflow.sla.overdueLabel,
          tone: data.workflow.sla.tone === 'danger' ? 'danger' : 'warning',
        })
      } else if (data.workflow.sla.dueAt) {
        const due = new Date(data.workflow.sla.dueAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        badges.push({ label: `Due ${due}`, tone: 'neutral' })
      }
    }
    return badges
  }, [data])

  if (!data.access.canView) {
    return (
      <Card padding="lg">
        <h1 className="text-lg font-semibold text-gray-900">No access</h1>
        <p className="text-sm text-gray-600 mt-1">
          {data.access.noAccessReason ?? "You don't have access to this record."}
        </p>
        <div className="mt-4">
          <Link href={backHref} className="text-sm text-blue-700 hover:underline">
            Back
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                <ArrowLeftIcon className="h-4 w-4" />
                Back
              </Link>
              <div className="mt-2">
                <h1 className="text-xl font-semibold text-gray-900 truncate">{data.identity.title}</h1>
                <p className="text-sm text-gray-600 mt-0.5 truncate">
                  {data.subject.displayName}
                  {data.subject.employeeId ? ` • ${data.subject.employeeId}` : ''}
                  {data.subject.subtitle ? ` • ${data.subject.subtitle}` : ''}
                </p>
              </div>
              {headerBadges.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {headerBadges.map((b) => (
                    <Badge key={b.label} variant={toneToBadgeVariant(b.tone)}>
                      {b.label}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 flex flex-wrap items-start justify-end gap-2">
              {data.actions.primary ? (
                <ActionButton
                  label={data.actions.primary.label}
                  variant={actionVariantToButtonVariant(data.actions.primary.variant)}
                  disabled={data.actions.primary.disabled}
                  disabledReason={data.actions.primary.disabledReason}
                  onClick={() => {
                    if (!onAction) {
                      // eslint-disable-next-line no-console
                      console.warn('[WorkflowRecordLayout] onAction not provided for', data.actions.primary?.id)
                      return
                    }
                    void onAction(data.actions.primary!.id)
                  }}
                />
              ) : null}

              {data.actions.secondary.map((action) => (
                <ActionButton
                  key={action.id}
                  label={action.label}
                  variant={actionVariantToButtonVariant(action.variant)}
                  disabled={action.disabled}
                  disabledReason={action.disabledReason}
                  onClick={() => {
                    if (!onAction) {
                      // eslint-disable-next-line no-console
                      console.warn('[WorkflowRecordLayout] onAction not provided for', action.id)
                      return
                    }
                    void onAction(action.id)
                  }}
                />
              ))}

              {data.actions.more.length ? (
                <details className="relative">
                  <summary className="list-none">
                    <ActionButton label="More" variant="secondary" />
                  </summary>
                  <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg p-2 z-10">
                    {data.actions.more.map((action) => (
                      <button
                        key={action.id}
                        className={
                          action.variant === 'danger'
                            ? 'w-full text-left px-3 py-2 text-sm rounded-md text-red-700 hover:bg-red-50'
                            : 'w-full text-left px-3 py-2 text-sm rounded-md text-gray-700 hover:bg-gray-50'
                        }
                        onClick={() => {
                          if (!onAction) {
                            // eslint-disable-next-line no-console
                            console.warn('[WorkflowRecordLayout] onAction not provided for', action.id)
                            return
                          }
                          void onAction(action.id)
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2">
            {data.workflow.stages.map((stage, idx) => (
              <div key={stage.id} className="flex items-center gap-2">
                <div
                  className={
                    stage.status === 'completed'
                      ? 'h-2.5 w-2.5 rounded-full bg-emerald-500'
                      : stage.status === 'current'
                      ? 'h-2.5 w-2.5 rounded-full bg-blue-600'
                      : 'h-2.5 w-2.5 rounded-full bg-gray-300'
                  }
                />
                <span className={stage.status === 'upcoming' ? 'text-xs text-gray-500' : 'text-xs text-gray-900'}>
                  {stage.label}
                </span>
                {idx < data.workflow.stages.length - 1 ? <div className="w-8 h-px bg-gray-200" /> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card padding="md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.summary.map((row) => (
                <div key={row.label}>
                  <p className="text-xs font-medium text-gray-500">{row.label}</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">{row.value || '—'}</p>
                </div>
              ))}
            </div>
          </Card>

          {children ? children : null}
        </div>

        <div className="space-y-6">
          <Card padding="md">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Timeline</h3>
            <WorkflowTimeline items={data.timeline} />
          </Card>
        </div>
      </div>
    </div>
  )
}

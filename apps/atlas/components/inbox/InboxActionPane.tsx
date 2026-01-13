'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import type { ActionId } from '@/lib/contracts/action-ids'
import type { WorkItemDTO, WorkItemEntityData } from '@/lib/contracts/work-items'
import { formatWorkItemWhen, getWorkItemDueLabel } from '@/components/work-queue/work-item-utils'
import { cn } from '@/lib/utils'
import {
  ClipboardCheck,
  FileText,
  CalendarDays,
  TrendingUp,
  AlertTriangle,
  Check,
  ExternalLink,
  MousePointerClick,
} from 'lucide-react'

type InboxActionPaneProps = {
  item: WorkItemDTO | null
  onAction: (actionId: ActionId, item: WorkItemDTO) => Promise<void> | void
  currentIndex?: number
  totalCount?: number
}

function getEntityTypeConfig(type: string) {
  const configs: Record<string, { accentColor: string; iconBgColor: string; icon: React.ReactNode; label: string }> = {
    'TASK': {
      accentColor: 'text-violet-400',
      iconBgColor: 'bg-violet-500',
      label: 'Task',
      icon: <ClipboardCheck className="w-5 h-5" strokeWidth={2} />,
    },
    'POLICY': {
      accentColor: 'text-indigo-400',
      iconBgColor: 'bg-indigo-500',
      label: 'Policy',
      icon: <FileText className="w-5 h-5" strokeWidth={2} />,
    },
    'LEAVE_REQUEST': {
      accentColor: 'text-teal-400',
      iconBgColor: 'bg-teal-500',
      label: 'Leave Request',
      icon: <CalendarDays className="w-5 h-5" strokeWidth={2} />,
    },
    'PERFORMANCE_REVIEW': {
      accentColor: 'text-amber-400',
      iconBgColor: 'bg-amber-500',
      label: 'Performance Review',
      icon: <TrendingUp className="w-5 h-5" strokeWidth={2} />,
    },
    'DISCIPLINARY_ACTION': {
      accentColor: 'text-rose-400',
      iconBgColor: 'bg-rose-500',
      label: 'Disciplinary Action',
      icon: <AlertTriangle className="w-5 h-5" strokeWidth={2} />,
    },
  }

  return configs[type] || configs['TASK']
}

function formatLeaveType(type: string): string {
  return type.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} - ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
  }
  if (start.getMonth() === end.getMonth() && start.getDate() === end.getDate()) {
    return start.toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  }
  return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

// Get summary text from entity data
function getEntitySummary(item: WorkItemDTO, entityData?: WorkItemEntityData): string | null {
  if (!entityData) return item.description || null

  switch (item.entity.type) {
    case 'POLICY':
      return entityData.summary || null
    case 'LEAVE_REQUEST':
      return entityData.reason || null
    case 'PERFORMANCE_REVIEW':
      return entityData.strengths || null
    case 'DISCIPLINARY_ACTION':
      return entityData.description || null
    case 'TASK':
      return item.description || null
    default:
      return item.description || null
  }
}

// Get category/type badge for the entity
function getEntityCategory(item: WorkItemDTO, entityData?: WorkItemEntityData): string | null {
  if (!entityData) return null

  switch (item.entity.type) {
    case 'POLICY':
      return entityData.category?.replace(/_/g, ' ') || null
    case 'LEAVE_REQUEST':
      return formatLeaveType(entityData.leaveType || '')
    case 'PERFORMANCE_REVIEW':
      return entityData.reviewType?.replace(/_/g, ' ') || null
    case 'DISCIPLINARY_ACTION':
      return entityData.violationType?.replace(/_/g, ' ') || entityData.severity || null
    case 'TASK':
      return item.stageLabel || null
    default:
      return null
  }
}

// Get description line for the header
function getEntityDescription(item: WorkItemDTO, entityData?: WorkItemEntityData): string {
  switch (item.entity.type) {
    case 'POLICY':
      return `Acknowledge "${item.title}" (v${entityData?.version || '1.0'})`
    case 'LEAVE_REQUEST':
      if (entityData?.employeeName && entityData?.startDate && entityData?.endDate) {
        return `${entityData.employeeName} - ${formatDateRange(entityData.startDate, entityData.endDate)} (${entityData.totalDays || 1} ${(entityData.totalDays || 1) === 1 ? 'day' : 'days'})`
      }
      return item.description || 'Review leave request'
    case 'PERFORMANCE_REVIEW':
      if (entityData?.employeeNameForReview) {
        return `Review for ${entityData.employeeNameForReview}`
      }
      return item.description || 'Complete performance review'
    case 'DISCIPLINARY_ACTION':
      return item.description || 'Review disciplinary action'
    case 'TASK':
      return item.description || 'Complete this task'
    default:
      return item.description || ''
  }
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
      <div className="text-center px-8">
        <div className="relative mx-auto mb-6 w-20 h-20">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-2xl rotate-6 opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl -rotate-3" />
          <div className="absolute inset-0 flex items-center justify-center">
            <MousePointerClick className="w-8 h-8 text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
          </div>
        </div>
        <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300">
          Select an item
        </h3>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500 max-w-[200px] mx-auto">
          Choose from your inbox to view details
        </p>
      </div>
    </div>
  )
}

export function InboxActionPane({ item, onAction, currentIndex, totalCount }: InboxActionPaneProps) {
  const [acting, setActing] = useState<ActionId | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successLabel, setSuccessLabel] = useState('')

  useEffect(() => {
    setShowSuccess(false)
    setSuccessLabel('')
  }, [item?.id])

  if (!item) {
    return <EmptyState />
  }

  const entityConfig = getEntityTypeConfig(item.entity.type)
  const dueLabel = getWorkItemDueLabel(item)
  const category = getEntityCategory(item, item.entityData)
  const summary = getEntitySummary(item, item.entityData)
  const description = getEntityDescription(item, item.entityData)
  const hasAction = item.primaryAction && item.isActionRequired

  const handleAction = async (actionId: ActionId) => {
    setActing(actionId)
    try {
      await onAction(actionId, item)
      const action = item.primaryAction?.id === actionId ? item.primaryAction : item.secondaryActions.find(a => a.id === actionId)
      setSuccessLabel(action?.label ?? 'Done')
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* Header - dark slate with colored accent circle */}
      <div className="shrink-0 px-6 pt-5 pb-6 bg-slate-800 dark:bg-slate-900 text-white">
        {/* Icon and breadcrumb */}
        <div className="flex items-center gap-3 mb-3">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center text-white',
            entityConfig.iconBgColor
          )}>
            {entityConfig.icon}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className={cn('font-medium', entityConfig.accentColor)}>{item.typeLabel}</span>
            <span className="text-slate-500">·</span>
            <span>{item.stageLabel}</span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold leading-tight mb-3 text-white">
          {item.title}
        </h2>

        {/* Action Required badge */}
        {hasAction ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-sm font-medium text-white">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Action Required
          </div>
        ) : null}
      </div>

      {/* Success feedback */}
      {showSuccess ? (
        <div className="shrink-0 px-6 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <Check className="w-4 h-4" strokeWidth={2.5} />
            <span className="text-sm font-semibold">{successLabel} complete</span>
          </div>
        </div>
      ) : null}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Description */}
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {description}
        </p>

        {/* Category tag */}
        {category ? (
          <div>
            <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold uppercase tracking-wide">
              {category}
            </span>
          </div>
        ) : null}

        {/* Summary section */}
        {summary ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              Summary
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {summary}
            </p>
          </div>
        ) : null}

        {/* Due date and Created date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Due Date
            </p>
            <p className={cn(
              'text-sm font-semibold',
              item.isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
            )}>
              {item.dueAt ? dueLabel : 'No due date'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Created
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {formatWorkItemWhen(item.createdAt)}
            </p>
          </div>
        </div>

        {/* See full details link */}
        <a
          href={item.href}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <ExternalLink className="w-4 h-4" strokeWidth={2} />
          See full details
        </a>
      </div>

      {/* Action button - sticky at bottom */}
      {item.primaryAction && !showSuccess ? (
        <div className="shrink-0 p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <Button
            className={cn(
              'w-full h-12 text-base font-semibold rounded-xl',
              'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100',
              'dark:text-slate-900'
            )}
            disabled={item.primaryAction.disabled || acting === item.primaryAction.id}
            loading={acting === item.primaryAction.id}
            onClick={() => handleAction(item.primaryAction!.id)}
          >
            {item.primaryAction.label}
          </Button>

          {/* Secondary actions */}
          {item.secondaryActions.length > 0 ? (
            <div className="flex gap-2 mt-2">
              {item.secondaryActions.map((action) => (
                <Button
                  key={action.id}
                  variant="secondary"
                  className="flex-1 h-10 text-sm rounded-xl"
                  disabled={action.disabled || acting === action.id}
                  loading={acting === action.id}
                  onClick={() => handleAction(action.id)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

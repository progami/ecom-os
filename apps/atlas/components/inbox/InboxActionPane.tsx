'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ActionId } from '@/lib/contracts/action-ids'
import type { WorkItemDTO, WorkItemEntityData } from '@/lib/contracts/work-items'
import { formatWorkItemWhen, getWorkItemDueLabel } from '@/components/work-queue/work-item-utils'
import { cn } from '@/lib/utils'

type InboxActionPaneProps = {
  item: WorkItemDTO | null
  onAction: (actionId: ActionId, item: WorkItemDTO) => Promise<void> | void
}

function getEntityTypeConfig(type: string) {
  const configs: Record<string, { gradient: string; icon: React.ReactNode; label: string }> = {
    'TASK': {
      gradient: 'from-violet-500 to-purple-600',
      label: 'Task',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    'POLICY': {
      gradient: 'from-blue-500 to-indigo-600',
      label: 'Policy',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    'LEAVE_REQUEST': {
      gradient: 'from-emerald-500 to-teal-600',
      label: 'Leave Request',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    'PERFORMANCE_REVIEW': {
      gradient: 'from-amber-500 to-orange-600',
      label: 'Performance Review',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    'DISCIPLINARY_ACTION': {
      gradient: 'from-rose-500 to-red-600',
      label: 'Disciplinary Action',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
  }

  return configs[type] || configs['TASK']
}

function formatRating(rating: number): string {
  if (rating >= 4.5) return 'Exceptional'
  if (rating >= 3.5) return 'Exceeds Expectations'
  if (rating >= 2.5) return 'Meets Expectations'
  if (rating >= 1.5) return 'Needs Improvement'
  return 'Unsatisfactory'
}

function EntityContent({ entityType, entityData }: { entityType: string; entityData?: WorkItemEntityData }) {
  if (!entityData) return null

  switch (entityType) {
    case 'POLICY':
      return (
        <div className="space-y-3">
          {entityData.category ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                {entityData.category.replace(/_/g, ' ')}
              </span>
            </div>
          ) : null}
          {entityData.summary ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Summary
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {entityData.summary}
              </p>
            </div>
          ) : null}
        </div>
      )

    case 'LEAVE_REQUEST':
      return entityData.reason ? (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
            Reason
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {entityData.reason}
          </p>
        </div>
      ) : null

    case 'DISCIPLINARY_ACTION':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {entityData.violationType ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs font-medium">
                {entityData.violationType.replace(/_/g, ' ')}
              </span>
            ) : null}
            {entityData.severity ? (
              <span className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium',
                entityData.severity === 'CRITICAL' && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                entityData.severity === 'HIGH' && 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
                entityData.severity === 'MEDIUM' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                entityData.severity === 'LOW' && 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              )}>
                {entityData.severity}
              </span>
            ) : null}
          </div>
          {entityData.description ? (
            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800/50">
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">
                Description
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {entityData.description}
              </p>
            </div>
          ) : null}
        </div>
      )

    case 'PERFORMANCE_REVIEW':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {entityData.reviewType ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
                {entityData.reviewType.replace(/_/g, ' ')}
              </span>
            ) : null}
            {entityData.overallRating !== undefined ? (
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium',
                entityData.overallRating >= 4 && 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
                entityData.overallRating >= 3 && entityData.overallRating < 4 && 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
                entityData.overallRating < 3 && 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
              )}>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {formatRating(entityData.overallRating)}
              </span>
            ) : null}
          </div>
          {entityData.strengths ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
                Strengths
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {entityData.strengths}
              </p>
            </div>
          ) : null}
        </div>
      )

    default:
      return null
  }
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
      <div className="text-center px-8">
        {/* Geometric illustration */}
        <div className="relative mx-auto mb-6 w-24 h-24">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-2xl rotate-6 opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl -rotate-3" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300">
          Select an item
        </h3>
        <p className="mt-2 text-sm text-slate-400 dark:text-slate-500 max-w-[220px] mx-auto">
          Choose something from your inbox to view details and take action
        </p>
      </div>
    </div>
  )
}

export function InboxActionPane({ item, onAction }: InboxActionPaneProps) {
  const [acting, setActing] = useState<ActionId | null>(null)

  if (!item) {
    return <EmptyState />
  }

  const entityConfig = getEntityTypeConfig(item.entity.type)
  const dueLabel = getWorkItemDueLabel(item)

  const handleAction = async (actionId: ActionId) => {
    setActing(actionId)
    try {
      await onAction(actionId, item)
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* Hero header with gradient */}
      <div className={cn(
        'relative px-6 py-8 bg-gradient-to-br text-white overflow-hidden',
        entityConfig.gradient
      )}>
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative">
          {/* Type badge */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              {entityConfig.icon}
            </div>
            <div>
              <span className="text-sm font-medium text-white/80">{item.typeLabel}</span>
              <span className="mx-2 text-white/40">·</span>
              <span className="text-sm text-white/70">{item.stageLabel}</span>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold leading-tight">{item.title}</h2>

          {/* Status indicators */}
          <div className="mt-4 flex items-center gap-3">
            {item.isOverdue ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                {item.overdueDays ? `${item.overdueDays} days overdue` : 'Overdue'}
              </span>
            ) : item.isActionRequired ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold">
                <span className="w-2 h-2 bg-white rounded-full" />
                Action Required
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Description */}
        {item.description ? (
          <div className="prose prose-slate dark:prose-invert prose-sm max-w-none">
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {item.description}
            </p>
          </div>
        ) : null}

        {/* Entity-specific content */}
        <EntityContent entityType={item.entity.type} entityData={item.entityData} />

        {/* Metadata cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Due Date
            </p>
            <p className={cn(
              'text-sm font-semibold',
              item.isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
            )}>
              {dueLabel}
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Created
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {formatWorkItemWhen(item.createdAt)}
            </p>
          </div>
        </div>

        {/* See full details - small link at bottom */}
        <div className="pt-1">
          <a
            href={item.href}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            See full details
          </a>
        </div>
      </div>

      {/* Action footer */}
      {(item.primaryAction || item.secondaryActions.length > 0) ? (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
          <div className="flex flex-col gap-3">
            {/* Primary action - full width, prominent */}
            {item.primaryAction ? (
              <Button
                className={cn(
                  'w-full h-12 text-base font-semibold',
                  'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100',
                  'dark:text-slate-900'
                )}
                disabled={item.primaryAction.disabled || acting === item.primaryAction.id}
                loading={acting === item.primaryAction.id}
                onClick={() => handleAction(item.primaryAction!.id)}
              >
                {item.primaryAction.label}
              </Button>
            ) : null}

            {/* Secondary actions */}
            {item.secondaryActions.length > 0 ? (
              <div className="flex gap-2">
                {item.secondaryActions.map((action) => (
                  <Button
                    key={action.id}
                    variant="secondary"
                    className="flex-1 h-10"
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
        </div>
      ) : null}
    </div>
  )
}

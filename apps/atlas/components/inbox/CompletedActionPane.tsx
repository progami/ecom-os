'use client'

import Link from 'next/link'
import type { CompletedWorkItemDTO, WorkItemEntityData } from '@/lib/contracts/work-items'
import { cn } from '@/lib/utils'

type CompletedActionPaneProps = {
  item: CompletedWorkItemDTO | null
}

function getEntityTypeConfig(type: string) {
  const configs: Record<string, { gradient: string; icon: React.ReactNode; label: string }> = {
    'TASK': {
      gradient: 'from-slate-400 to-slate-500',
      label: 'Task',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    'POLICY': {
      gradient: 'from-slate-400 to-slate-500',
      label: 'Policy',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    'LEAVE_REQUEST': {
      gradient: 'from-slate-400 to-slate-500',
      label: 'Leave Request',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    'PERFORMANCE_REVIEW': {
      gradient: 'from-slate-400 to-slate-500',
      label: 'Performance Review',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    'DISCIPLINARY_ACTION': {
      gradient: 'from-slate-400 to-slate-500',
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
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
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
                {entityData.category.replace(/_/g, ' ')}
              </span>
            </div>
          ) : null}
          {entityData.summary ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Summary
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {entityData.summary}
              </p>
            </div>
          ) : null}
        </div>
      )

    case 'LEAVE_REQUEST':
      return entityData.reason ? (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            Reason
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {entityData.reason}
          </p>
        </div>
      ) : null

    case 'DISCIPLINARY_ACTION':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {entityData.violationType ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
                {entityData.violationType.replace(/_/g, ' ')}
              </span>
            ) : null}
            {entityData.severity ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
                {entityData.severity}
              </span>
            ) : null}
          </div>
          {entityData.description ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Description
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
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
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
                {entityData.reviewType.replace(/_/g, ' ')}
              </span>
            ) : null}
            {entityData.overallRating !== undefined ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {formatRating(entityData.overallRating)}
              </span>
            ) : null}
          </div>
          {entityData.strengths ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                Strengths
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
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
        <div className="relative mx-auto mb-6 w-24 h-24">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-2xl rotate-6 opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl -rotate-3" />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>

        <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400 tracking-tight">
          No item selected
        </h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-500 max-w-[260px]">
          Select an item from the list to view its details.
        </p>
      </div>
    </div>
  )
}

export function CompletedActionPane({ item }: CompletedActionPaneProps) {
  if (!item) {
    return <EmptyState />
  }

  const config = getEntityTypeConfig(item.entity.type)

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden opacity-80">
      {/* Header section */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        {/* Type badge with icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg',
            `bg-gradient-to-br ${config.gradient}`
          )}>
            {config.icon}
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {item.typeLabel}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                {item.completedLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 leading-tight">
          {item.title}
        </h2>

        {/* Completion date */}
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>{formatDate(item.completedAt)}</span>
        </div>
      </div>

      {/* Content section */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
        {/* Description */}
        {item.description ? (
          <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
              {item.description}
            </p>
          </div>
        ) : null}

        {/* Entity-specific content */}
        <EntityContent entityType={item.entity.type} entityData={item.entityData} />
      </div>

      {/* Footer - View details link */}
      <div className="shrink-0 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
        <Link
          href={item.href}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View full details
        </Link>
      </div>
    </div>
  )
}

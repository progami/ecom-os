'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import type { ActionId } from '@/lib/contracts/action-ids'
import type { WorkItemDTO, WorkItemEntityData } from '@/lib/contracts/work-items'
import { formatWorkItemWhen, getWorkItemDueLabel } from '@/components/work-queue/work-item-utils'
import { cn } from '@/lib/utils'

type InboxActionPaneProps = {
  item: WorkItemDTO | null
  onAction: (actionId: ActionId, item: WorkItemDTO) => Promise<void> | void
  currentIndex?: number
  totalCount?: number
}

function getEntityTypeConfig(type: string) {
  const configs: Record<string, { gradient: string; bgLight: string; bgDark: string; icon: React.ReactNode; label: string }> = {
    'TASK': {
      gradient: 'from-violet-500 to-purple-600',
      bgLight: 'bg-violet-50',
      bgDark: 'dark:bg-violet-900/20',
      label: 'Task',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    'POLICY': {
      gradient: 'from-blue-500 to-indigo-600',
      bgLight: 'bg-blue-50',
      bgDark: 'dark:bg-blue-900/20',
      label: 'Policy',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    'LEAVE_REQUEST': {
      gradient: 'from-emerald-500 to-teal-600',
      bgLight: 'bg-emerald-50',
      bgDark: 'dark:bg-emerald-900/20',
      label: 'Leave Request',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    'PERFORMANCE_REVIEW': {
      gradient: 'from-amber-500 to-orange-600',
      bgLight: 'bg-amber-50',
      bgDark: 'dark:bg-amber-900/20',
      label: 'Performance Review',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    'DISCIPLINARY_ACTION': {
      gradient: 'from-rose-500 to-red-600',
      bgLight: 'bg-rose-50',
      bgDark: 'dark:bg-rose-900/20',
      label: 'Disciplinary Action',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
  }

  return configs[type] || configs['TASK']
}

function formatRating(rating: number): { label: string; color: string } {
  if (rating >= 4.5) return { label: 'Exceptional', color: 'text-emerald-600 dark:text-emerald-400' }
  if (rating >= 3.5) return { label: 'Exceeds Expectations', color: 'text-blue-600 dark:text-blue-400' }
  if (rating >= 2.5) return { label: 'Meets Expectations', color: 'text-slate-600 dark:text-slate-400' }
  if (rating >= 1.5) return { label: 'Needs Improvement', color: 'text-amber-600 dark:text-amber-400' }
  return { label: 'Unsatisfactory', color: 'text-red-600 dark:text-red-400' }
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

type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'list'; items: string[] }
  | { type: 'paragraph'; text: string }

function parseMarkdownContent(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = content.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()

    // Skip empty lines
    if (!line) {
      i++
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] })
      i++
      continue
    }

    // Tables - look for pipe-delimited content
    if (line.includes('|') && line.startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i])
        i++
      }

      if (tableLines.length >= 2) {
        const parseRow = (row: string) =>
          row.split('|').map(cell => cell.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)

        const headers = parseRow(tableLines[0])
        // Skip separator line (|---|---|)
        const dataStartIdx = tableLines[1].includes('-') ? 2 : 1
        const rows = tableLines.slice(dataStartIdx).map(parseRow).filter(row => row.some(cell => cell))

        if (headers.length > 0) {
          blocks.push({ type: 'table', headers, rows })
        }
      }
      continue
    }

    // Bullet lists
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      const items: string[] = []
      while (i < lines.length) {
        const listLine = lines[i].trim()
        if (listLine.startsWith('- ') || listLine.startsWith('* ') || listLine.startsWith('• ')) {
          items.push(listLine.slice(2))
          i++
        } else if (!listLine) {
          i++
          break
        } else {
          break
        }
      }
      if (items.length > 0) {
        blocks.push({ type: 'list', items })
      }
      continue
    }

    // Regular paragraph - collect until empty line or special element
    const paragraphLines: string[] = []
    while (i < lines.length) {
      const pLine = lines[i].trim()
      if (!pLine || pLine.startsWith('#') || pLine.startsWith('|') || pLine.startsWith('- ') || pLine.startsWith('* ')) {
        break
      }
      paragraphLines.push(pLine)
      i++
    }
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') })
    }
  }

  return blocks
}

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating)
  const hasHalf = rating % 1 >= 0.5

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={cn(
            'w-5 h-5',
            star <= fullStars
              ? 'text-amber-400 fill-amber-400'
              : star === fullStars + 1 && hasHalf
              ? 'text-amber-400 fill-amber-100 dark:fill-amber-900'
              : 'text-slate-200 dark:text-slate-700 fill-slate-100 dark:fill-slate-800'
          )}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

// Render a markdown block
function MarkdownBlockRenderer({ block }: { block: MarkdownBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <h4 className={cn(
          'font-semibold text-slate-900 dark:text-slate-100',
          block.level === 1 && 'text-base mb-2',
          block.level === 2 && 'text-sm mb-1.5',
          block.level === 3 && 'text-sm mb-1'
        )}>
          {block.text}
        </h4>
      )

    case 'table':
      return (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                {block.headers.map((header, idx) => (
                  <th
                    key={idx}
                    className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700"
                  >
                    {header.replace(/\*\*/g, '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={cn(
                    'border-b border-slate-100 dark:border-slate-800 last:border-0',
                    rowIdx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'
                  )}
                >
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="px-3 py-2 text-slate-600 dark:text-slate-300"
                    >
                      {cell.replace(/\*\*/g, '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'list':
      return (
        <ul className="space-y-1 ml-1">
          {block.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="text-blue-500 mt-1.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )

    case 'paragraph':
      return (
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {block.text}
        </p>
      )

    default:
      return null
  }
}

// Policy Content - Document-style with proper markdown rendering
function PolicyContent({ entityData }: { entityData: WorkItemEntityData }) {
  const blocks = useMemo(() => {
    if (!entityData.content) return []
    // Check if content is HTML
    if (entityData.content.includes('<') && entityData.content.includes('>')) {
      return [] // Return empty to use HTML rendering
    }
    return parseMarkdownContent(entityData.content)
  }, [entityData.content])

  const isHtml = entityData.content?.includes('<') && entityData.content?.includes('>')

  return (
    <div className="space-y-4">
      {/* Version & Category badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {entityData.version ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            v{entityData.version}
          </span>
        ) : null}
        {entityData.category ? (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
            {entityData.category.replace(/_/g, ' ')}
          </span>
        ) : null}
      </div>

      {/* Policy content */}
      {isHtml && entityData.content ? (
        <div className="prose prose-slate dark:prose-invert prose-sm max-w-none prose-headings:text-base prose-headings:font-semibold prose-p:text-slate-600 dark:prose-p:text-slate-300">
          <div dangerouslySetInnerHTML={{ __html: entityData.content }} />
        </div>
      ) : blocks.length > 0 ? (
        <div className="space-y-4">
          {blocks.map((block, idx) => (
            <MarkdownBlockRenderer key={idx} block={block} />
          ))}
        </div>
      ) : entityData.summary ? (
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {entityData.summary}
        </p>
      ) : null}
    </div>
  )
}

// Leave Request Content - Calendar card style
function LeaveRequestContent({ entityData }: { entityData: WorkItemEntityData }) {
  return (
    <div className="space-y-4">
      {/* Employee & Leave Type header */}
      <div className="flex items-center gap-3">
        {entityData.employeeName ? (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold text-sm shadow-md">
            {entityData.employeeName.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
        ) : null}
        <div>
          {entityData.employeeName ? (
            <p className="font-semibold text-slate-900 dark:text-slate-100">{entityData.employeeName}</p>
          ) : null}
          {entityData.leaveType ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              {formatLeaveType(entityData.leaveType)}
            </p>
          ) : null}
        </div>
      </div>

      {/* Date range & duration card */}
      <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800/50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Duration</p>
              {entityData.startDate && entityData.endDate ? (
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {formatDateRange(entityData.startDate, entityData.endDate)}
                </p>
              ) : null}
            </div>
          </div>
          {entityData.totalDays !== undefined ? (
            <div className="text-center px-4 py-2 bg-emerald-100 dark:bg-emerald-800/40 rounded-lg">
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{entityData.totalDays}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {entityData.totalDays === 1 ? 'day' : 'days'}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Reason */}
      {entityData.reason ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reason</p>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            {entityData.reason}
          </p>
        </div>
      ) : null}
    </div>
  )
}

// Performance Review Content - Rating focused
function PerformanceReviewContent({ entityData }: { entityData: WorkItemEntityData }) {
  const ratingInfo = entityData.overallRating !== undefined ? formatRating(entityData.overallRating) : null

  return (
    <div className="space-y-4">
      {/* Employee & Review Type */}
      <div className="flex items-center gap-3">
        {entityData.employeeNameForReview ? (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-semibold text-sm shadow-md">
            {entityData.employeeNameForReview.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
        ) : null}
        <div>
          {entityData.employeeNameForReview ? (
            <p className="font-semibold text-slate-900 dark:text-slate-100">{entityData.employeeNameForReview}</p>
          ) : null}
          {entityData.reviewType ? (
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
              {entityData.reviewType.replace(/_/g, ' ')} Review
            </p>
          ) : null}
        </div>
      </div>

      {/* Rating card */}
      {entityData.overallRating !== undefined && ratingInfo ? (
        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium mb-1">Overall Rating</p>
              <StarRating rating={entityData.overallRating} />
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">{entityData.overallRating.toFixed(1)}</p>
              <p className={cn('text-sm font-semibold', ratingInfo.color)}>{ratingInfo.label}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Strengths */}
      {entityData.strengths ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Key Strengths</p>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            {entityData.strengths}
          </p>
        </div>
      ) : null}
    </div>
  )
}

// Disciplinary Action Content - Warning style
function DisciplinaryActionContent({ entityData }: { entityData: WorkItemEntityData }) {
  const severityConfig: Record<string, { bg: string; text: string; border: string }> = {
    CRITICAL: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-800' },
    HIGH: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-800' },
    MEDIUM: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-800' },
    LOW: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-700' },
  }

  const severity = entityData.severity || 'MEDIUM'
  const config = severityConfig[severity] || severityConfig.MEDIUM

  return (
    <div className="space-y-4">
      {/* Severity & Type header */}
      <div className={cn('rounded-xl p-4 border-2', config.bg, config.border)}>
        <div className="flex items-start gap-3">
          <div className={cn('shrink-0 w-10 h-10 rounded-lg flex items-center justify-center', config.bg)}>
            <svg className={cn('w-6 h-6', config.text)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase', config.bg, config.text)}>
                {severity}
              </span>
              {entityData.violationType ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs font-medium">
                  {entityData.violationType.replace(/_/g, ' ')}
                </span>
              ) : null}
            </div>
            <p className={cn('mt-1 text-sm font-medium', config.text)}>
              {severity === 'CRITICAL' && 'Requires immediate attention'}
              {severity === 'HIGH' && 'Serious violation'}
              {severity === 'MEDIUM' && 'Moderate concern'}
              {severity === 'LOW' && 'Minor issue'}
            </p>
          </div>
        </div>
      </div>

      {/* Description */}
      {entityData.description ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description</p>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
            {entityData.description}
          </p>
        </div>
      ) : null}
    </div>
  )
}

// Task Content - Simple checklist style
function TaskContent({ item }: { item: WorkItemDTO }) {
  const stageLabel = item.stageLabel.toLowerCase()
  const isInProgress = stageLabel.includes('progress')

  return (
    <div className="space-y-4">
      {/* Status indicator */}
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          isInProgress
            ? 'bg-violet-100 dark:bg-violet-900/30'
            : 'bg-slate-100 dark:bg-slate-800'
        )}>
          {isInProgress ? (
            <svg className="w-5 h-5 text-violet-600 dark:text-violet-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Status</p>
          <p className={cn(
            'text-sm font-semibold',
            isInProgress ? 'text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'
          )}>
            {item.stageLabel}
          </p>
        </div>
      </div>

      {/* Task description already shown in main description area */}
    </div>
  )
}

function EntityContent({ item, entityData }: { item: WorkItemDTO; entityData?: WorkItemEntityData }) {
  const entityType = item.entity.type

  switch (entityType) {
    case 'POLICY':
      return entityData ? <PolicyContent entityData={entityData} /> : null
    case 'LEAVE_REQUEST':
      return entityData ? <LeaveRequestContent entityData={entityData} /> : null
    case 'PERFORMANCE_REVIEW':
      return entityData ? <PerformanceReviewContent entityData={entityData} /> : null
    case 'DISCIPLINARY_ACTION':
      return entityData ? <DisciplinaryActionContent entityData={entityData} /> : null
    case 'TASK':
      return <TaskContent item={item} />
    default:
      return null
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
            <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
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
  const showProgress = typeof currentIndex === 'number' && typeof totalCount === 'number' && totalCount > 0

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
      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn(
              'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-sm',
              `bg-gradient-to-br ${entityConfig.gradient}`
            )}>
              {entityConfig.icon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                <span className="font-medium">{item.typeLabel}</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span>{item.stageLabel}</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 leading-snug line-clamp-2">
                {item.title}
              </h2>
            </div>
          </div>

          {showProgress ? (
            <div className="shrink-0 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                {currentIndex + 1}/{totalCount}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Success feedback */}
      {showSuccess ? (
        <div className="shrink-0 px-5 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-semibold">{successLabel} complete</span>
          </div>
        </div>
      ) : null}

      {/* Actions */}
      {(item.primaryAction || item.secondaryActions.length > 0) && !showSuccess ? (
        <div className="shrink-0 px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-2">
            {item.primaryAction ? (
              <Button
                className={cn(
                  'w-full h-10 text-sm font-semibold',
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

            {item.secondaryActions.length > 0 ? (
              <div className="flex gap-2">
                {item.secondaryActions.map((action) => (
                  <Button
                    key={action.id}
                    variant="secondary"
                    className="flex-1 h-8 text-sm"
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

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Description - only for tasks or if no entity-specific content */}
        {item.description && item.entity.type === 'TASK' ? (
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {item.description}
          </p>
        ) : null}

        {/* Entity-specific content */}
        <EntityContent item={item} entityData={item.entityData} />

        {/* Metadata */}
        {(item.dueAt || item.createdAt) ? (
          <div className={cn('grid gap-2', item.dueAt ? 'grid-cols-2' : 'grid-cols-1')}>
            {item.dueAt ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
                  Due Date
                </p>
                <p className={cn(
                  'text-sm font-semibold',
                  item.isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
                )}>
                  {dueLabel}
                </p>
              </div>
            ) : null}

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
                Created
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {formatWorkItemWhen(item.createdAt)}
              </p>
            </div>
          </div>
        ) : null}

        {/* Full details link */}
        <div className="pt-1">
          <a
            href={item.href}
            className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View full details
          </a>
        </div>
      </div>
    </div>
  )
}

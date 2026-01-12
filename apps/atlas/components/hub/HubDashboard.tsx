'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  EmployeesApi,
  LeavesApi,
  WorkItemsApi,
  DashboardApi,
  PerformanceReviewsApi,
  DisciplinaryActionsApi,
  EmployeeFilesApi,
  type Employee,
  type LeaveBalance,
  type DashboardData,
  type PerformanceReview,
  type DisciplinaryAction,
  type EmployeeFile,
} from '@/lib/api-client'
import type { WorkItemsResponse, WorkItemDTO, CompletedWorkItemsResponse } from '@/lib/contracts/work-items'
import type { ActionId } from '@/lib/contracts/action-ids'
import { executeAction } from '@/lib/actions/execute-action'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { InboxItemList } from '@/components/inbox/InboxItemList'
import { CompletedItemList } from '@/components/inbox/CompletedItemList'
import { InboxActionPane } from '@/components/inbox/InboxActionPane'
import { CompletedActionPane } from '@/components/inbox/CompletedActionPane'
import { CreateRequestModal } from '@/components/inbox/CreateRequestModal'

type HubTab = 'inbox' | 'overview' | 'leave' | 'reviews' | 'violations' | 'team'
type InboxSubTab = 'pending' | 'completed'

type HubDashboardProps = {
  employeeId: string
}

// ============================================================================
// Shared Components
// ============================================================================

function TabButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-semibold rounded-lg transition-all',
        active
          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
      )}
    >
      {children}
      {count !== undefined && count > 0 ? (
        <span className={cn(
          'ml-2 px-1.5 py-0.5 text-xs font-bold rounded-full',
          active
            ? 'bg-white/20 dark:bg-slate-900/20'
            : 'bg-slate-200 dark:bg-slate-700'
        )}>
          {count}
        </span>
      ) : null}
    </button>
  )
}

function SubTabButton({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
        active
          ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
      )}
    >
      {children}
      {count !== undefined && count > 0 ? (
        <span className={cn(
          'ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full',
          active
            ? 'bg-white/20 dark:bg-slate-900/20'
            : 'bg-slate-300 dark:bg-slate-600'
        )}>
          {count}
        </span>
      ) : null}
    </button>
  )
}

// ============================================================================
// Overview Tab Components
// ============================================================================

function BentoCard({
  children,
  className,
  span = 1,
}: {
  children: React.ReactNode
  className?: string
  span?: 1 | 2 | 3
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700',
        'bg-white dark:bg-slate-900',
        'transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50',
        'hover:border-slate-300 dark:hover:border-slate-600',
        span === 2 && 'col-span-2',
        span === 3 && 'col-span-3',
        className
      )}
    >
      {children}
    </div>
  )
}

function ProfileCard({
  employee,
  editingField,
  editValue,
  saving,
  onStartEdit,
  onEditChange,
  onSave,
  onCancel,
}: {
  employee: Employee
  editingField: 'phone' | 'email' | null
  editValue: string
  saving: boolean
  onStartEdit: (field: 'phone' | 'email', value: string) => void
  onEditChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const joinDate = employee.joinDate ? new Date(employee.joinDate) : null
  const tenure = joinDate ? Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365)) : null

  return (
    <BentoCard className="p-5" span={2}>
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-200 dark:to-slate-400 flex items-center justify-center text-white dark:text-slate-900 text-xl font-bold shadow-lg shrink-0">
          {employee.firstName[0]}
          {employee.lastName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                {employee.firstName} {employee.lastName}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{employee.position}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                <span>{employee.department}</span>
                {tenure !== null && tenure >= 0 ? (
                  <>
                    <span>·</span>
                    <span>{tenure === 0 ? '< 1 year' : `${tenure}y tenure`}</span>
                  </>
                ) : null}
              </div>
            </div>
            <Link
              href={`/employees/${employee.id}/edit`}
              className="shrink-0 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title="Edit full profile"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </div>

          {/* Editable fields */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {/* Phone */}
            <div className="group">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Phone</label>
              {editingField === 'phone' ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="tel"
                    value={editValue}
                    onChange={(e) => onEditChange(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    autoFocus
                  />
                  <button
                    onClick={onSave}
                    disabled={saving}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={onCancel}
                    className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onStartEdit('phone', employee.phone || '')}
                  className="flex items-center gap-1.5 mt-0.5 text-sm text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                >
                  <span>{employee.phone || 'Add phone'}</span>
                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Email */}
            <div className="group">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Email</label>
              {editingField === 'email' ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="email"
                    value={editValue}
                    onChange={(e) => onEditChange(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    autoFocus
                  />
                  <button
                    onClick={onSave}
                    disabled={saving}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={onCancel}
                    className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onStartEdit('email', employee.email || '')}
                  className="flex items-center gap-1.5 mt-0.5 text-sm text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors truncate max-w-full"
                >
                  <span className="truncate">{employee.email}</span>
                  <svg className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </BentoCard>
  )
}

function TeamCard({ directReports }: { directReports: DashboardData['directReports'] }) {
  if (directReports.length === 0) {
    return null
  }

  return (
    <BentoCard className="p-5" span={2}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Your Team
        </h3>
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
          {directReports.length} direct report{directReports.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {directReports.slice(0, 8).map((report) => (
          <Link
            key={report.id}
            href={`/employees/${report.id}`}
            className="group flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-white text-xs font-bold">
              {report.firstName[0]}{report.lastName[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white">
                {report.firstName} {report.lastName}
              </p>
              <p className="text-[11px] text-slate-400 truncate">{report.position}</p>
            </div>
          </Link>
        ))}
        {directReports.length > 8 ? (
          <Link
            href="/employees"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            +{directReports.length - 8}
          </Link>
        ) : null}
      </div>
    </BentoCard>
  )
}

function PendingReviewsCard({ reviews }: { reviews: DashboardData['pendingReviews'] }) {
  if (reviews.length === 0) {
    return null
  }

  return (
    <BentoCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Pending Reviews
        </h3>
        <Link href="/performance/reviews" className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
          View all
        </Link>
      </div>
      <div className="space-y-2">
        {reviews.slice(0, 3).map((review) => (
          <Link
            key={review.id}
            href={`/performance/reviews/${review.id}`}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                {review.employee.firstName} {review.employee.lastName}
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400">{review.reviewType}</p>
            </div>
            <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </BentoCard>
  )
}

function PendingLeaveCard({ requests }: { requests: DashboardData['pendingLeaveRequests'] }) {
  if (requests.length === 0) {
    return null
  }

  return (
    <BentoCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Leave Requests
        </h3>
        <Link href="/leave" className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
          View all
        </Link>
      </div>
      <div className="space-y-2">
        {requests.slice(0, 3).map((req) => (
          <Link
            key={req.id}
            href={`/leave/${req.id}`}
            className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                {req.employee.firstName} {req.employee.lastName}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{req.leaveType} · {req.totalDays}d</p>
            </div>
            <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </BentoCard>
  )
}

function DonutChart({
  value,
  max,
  color,
  size = 100,
  strokeWidth = 10,
}: {
  value: number
  max: number
  color: string
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percentage = max > 0 ? Math.min(value / max, 1) : 0
  const strokeDashoffset = circumference * (1 - percentage)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100 dark:text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-900 dark:text-slate-50">{value}</span>
        <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">days</span>
      </div>
    </div>
  )
}

function TimeOffCard({ balances }: { balances: LeaveBalance[] }) {
  const ptoBalance = balances.find((b) => b.leaveType === 'PTO')
  const mainBalance = ptoBalance || balances[0]

  if (!mainBalance) {
    return (
      <BentoCard className="p-5">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Time Off
        </h3>
        <p className="text-sm text-slate-400">No balances available</p>
      </BentoCard>
    )
  }

  const colors = {
    PTO: '#0891b2',
    SICK: '#f59e0b',
    PARENTAL: '#8b5cf6',
    BEREAVEMENT: '#64748b',
  }
  const color = colors[mainBalance.leaveType as keyof typeof colors] || colors.PTO

  return (
    <BentoCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Time Off
        </h3>
        <Link href="/leave" className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
          View all
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <DonutChart value={mainBalance.available} max={mainBalance.allocated} color={color} />
        <div className="flex-1 space-y-2">
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-slate-400">Used </span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{mainBalance.used}</span>
            </div>
            <div>
              <span className="text-slate-400">Pending </span>
              <span className="font-semibold text-amber-600">{mainBalance.pending}</span>
            </div>
          </div>
        </div>
      </div>
    </BentoCard>
  )
}

// Violations Card
function ViolationsCard({ violations }: { violations: DisciplinaryAction[] }) {
  const hasViolations = violations.length > 0

  return (
    <BentoCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Violations
        </h3>
        {hasViolations ? (
          <Link href="/performance/violations" className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
            View all
          </Link>
        ) : null}
      </div>

      {hasViolations ? (
        <div className="space-y-2">
          {violations.slice(0, 2).map((v) => (
            <Link
              key={v.id}
              href={`/performance/violations/${v.id}`}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                <svg className="w-4 h-4 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                  {v.violationType.replace(/_/g, ' ')}
                </p>
                <p className="text-[11px] text-rose-600 dark:text-rose-400">{v.severity}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">None on record</p>
        </div>
      )}
    </BentoCard>
  )
}

// My Reviews Card
function MyReviewsCard({ reviews }: { reviews: PerformanceReview[] }) {
  return (
    <BentoCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          My Reviews
        </h3>
        <Link href="/performance/reviews" className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
          View all
        </Link>
      </div>

      {reviews.length > 0 ? (
        <div className="space-y-2">
          {reviews.slice(0, 2).map((r) => (
            <Link
              key={r.id}
              href={`/performance/reviews/${r.id}`}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                  {r.reviewType.replace(/_/g, ' ')} Review
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  {r.status === 'COMPLETED' || r.status === 'ACKNOWLEDGED' ? `Rating: ${r.overallRating}/5` : r.status.replace(/_/g, ' ')}
                </p>
              </div>
              {r.status === 'COMPLETED' || r.status === 'ACKNOWLEDGED' ? (
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{r.overallRating}</div>
              ) : null}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 p-3">No reviews yet</p>
      )}
    </BentoCard>
  )
}

// Documents Card
function DocumentsCard({ documents, employeeId }: { documents: EmployeeFile[]; employeeId: string }) {
  return (
    <BentoCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          My Documents
        </h3>
        <Link href={`/employees/${employeeId}/files`} className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
          Manage
        </Link>
      </div>

      {documents.length > 0 ? (
        <div className="space-y-2">
          {documents.slice(0, 3).map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                  {doc.title}
                </p>
                <p className="text-[11px] text-slate-400">
                  {new Date(doc.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
          {documents.length > 3 ? (
            <Link
              href={`/employees/${employeeId}/files`}
              className="block text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1"
            >
              +{documents.length - 3} more
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-slate-400 mb-2">No documents uploaded</p>
          <Link
            href={`/employees/${employeeId}/files`}
            className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            Upload documents
          </Link>
        </div>
      )}
    </BentoCard>
  )
}

// Who's Out Card
function WhosOutCard({ upcomingLeaves }: { upcomingLeaves: DashboardData['upcomingLeaves'] }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const outNow = upcomingLeaves.filter((l) => {
    const start = new Date(l.startDate)
    const end = new Date(l.endDate)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return start <= today && end >= today
  })

  const upcomingThisWeek = upcomingLeaves.filter((l) => {
    const start = new Date(l.startDate)
    start.setHours(0, 0, 0, 0)
    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + 7)
    return start > today && start <= weekEnd
  })

  if (outNow.length === 0 && upcomingThisWeek.length === 0) {
    return null
  }

  return (
    <BentoCard className="p-5">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        Who's Out
      </h3>

      {outNow.length > 0 ? (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider mb-2">Out Today</p>
          <div className="flex flex-wrap gap-2">
            {outNow.slice(0, 4).map((l) => (
              <Link
                key={l.id}
                href={`/employees/${l.employee.id}`}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-rose-200 dark:bg-rose-800 flex items-center justify-center text-[10px] font-bold text-rose-700 dark:text-rose-300">
                  {l.employee.firstName[0]}{l.employee.lastName[0]}
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  {l.employee.firstName}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {upcomingThisWeek.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-2">This Week</p>
          <div className="flex flex-wrap gap-2">
            {upcomingThisWeek.slice(0, 4).map((l) => (
              <Link
                key={l.id}
                href={`/employees/${l.employee.id}`}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  {l.employee.firstName[0]}{l.employee.lastName[0]}
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  {l.employee.firstName}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </BentoCard>
  )
}

// ============================================================================
// Inbox Tab Components
// ============================================================================

function InboxLoadingSkeleton() {
  return (
    <div className="flex-1 flex gap-6 min-h-0 animate-in fade-in duration-300">
      <div className="w-[380px] shrink-0 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
      <div className="flex-1 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function HubDashboard({ employeeId }: HubDashboardProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<HubTab>('inbox')
  const [inboxSubTab, setInboxSubTab] = useState<InboxSubTab>('pending')

  // Overview data
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [myViolations, setMyViolations] = useState<DisciplinaryAction[]>([])
  const [myReviews, setMyReviews] = useState<PerformanceReview[]>([])
  const [myDocuments, setMyDocuments] = useState<EmployeeFile[]>([])
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [editingField, setEditingField] = useState<'phone' | 'email' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Inbox data
  const [workItems, setWorkItems] = useState<WorkItemsResponse | null>(null)
  const [completedItems, setCompletedItems] = useState<CompletedWorkItemsResponse | null>(null)
  const [inboxLoading, setInboxLoading] = useState(true)
  const [completedLoading, setCompletedLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [completedSelectedId, setCompletedSelectedId] = useState<string | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  // Shared state
  const [error, setError] = useState<string | null>(null)

  // Load inbox items (pending)
  const loadPending = useCallback(async (options?: { force?: boolean }) => {
    try {
      const force = options?.force ?? false
      setInboxLoading(true)
      setError(null)
      const next = await WorkItemsApi.list({ force })
      setWorkItems(next)
      setSelectedId((prev) => {
        if (prev && next.items.some((i) => i.id === prev)) return prev
        return next.items[0]?.id ?? null
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load work items'
      setError(message)
      setWorkItems({ items: [], meta: { totalCount: 0, actionRequiredCount: 0, overdueCount: 0 } })
    } finally {
      setInboxLoading(false)
    }
  }, [])

  // Load completed items
  const loadCompleted = useCallback(async (options?: { force?: boolean }) => {
    try {
      const force = options?.force ?? false
      setCompletedLoading(true)
      const next = await WorkItemsApi.listCompleted({ force })
      setCompletedItems(next)
      setCompletedSelectedId((prev) => {
        if (prev && next.items.some((i) => i.id === prev)) return prev
        return next.items[0]?.id ?? null
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load completed items'
      setError(message)
      setCompletedItems({ items: [], meta: { totalCount: 0 } })
    } finally {
      setCompletedLoading(false)
    }
  }, [])

  // Load overview data
  const loadOverview = useCallback(async () => {
    try {
      setOverviewLoading(true)
      setError(null)
      const [emp, balanceData, dashboard, violations, reviews, documents] = await Promise.all([
        EmployeesApi.get(employeeId),
        LeavesApi.getBalance({ employeeId }).catch(() => ({ balances: [] })),
        DashboardApi.get().catch(() => null),
        DisciplinaryActionsApi.list({ employeeId, take: 10 }).catch(() => ({ items: [] })),
        PerformanceReviewsApi.list({ employeeId, take: 5 }).catch(() => ({ items: [] })),
        EmployeeFilesApi.list(employeeId).catch(() => ({ items: [] })),
      ])
      setEmployee(emp)
      setLeaveBalances(balanceData.balances)
      setDashboardData(dashboard)
      setMyViolations(violations.items)
      setMyReviews(reviews.items)
      setMyDocuments(documents.items)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load profile'
      setError(message)
    } finally {
      setOverviewLoading(false)
    }
  }, [employeeId])

  // Save profile field
  const handleSaveField = useCallback(async () => {
    if (!employee || !editingField) return
    setSaving(true)
    try {
      const updated = await EmployeesApi.update(employee.id, { [editingField]: editValue })
      setEmployee(updated)
      setEditingField(null)
      setEditValue('')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save'
      setError(message)
    } finally {
      setSaving(false)
    }
  }, [employee, editingField, editValue])

  const startEditing = useCallback((field: 'phone' | 'email', currentValue: string) => {
    setEditingField(field)
    setEditValue(currentValue)
  }, [])

  // Initial load - inbox items and dashboard data (for Team tab visibility)
  useEffect(() => {
    loadPending()
    // Load dashboard data to determine Team tab visibility
    DashboardApi.get().then(setDashboardData).catch(() => null)
  }, [loadPending])

  // Load completed when switching to completed sub-tab
  useEffect(() => {
    if (inboxSubTab === 'completed' && !completedItems) {
      loadCompleted()
    }
  }, [inboxSubTab, completedItems, loadCompleted])

  // Load overview data when switching to overview tab
  useEffect(() => {
    if (activeTab === 'overview' && !employee) {
      loadOverview()
    }
  }, [activeTab, employee, loadOverview])

  // Handle inbox action
  const handleAction = useCallback(async (actionId: ActionId, item: WorkItemDTO) => {
    setError(null)
    try {
      await executeAction(actionId, item.entity)
      await loadPending({ force: true })
      if (completedItems) {
        await loadCompleted({ force: true })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to complete action'
      setError(message)
    }
  }, [loadPending, loadCompleted, completedItems])

  const handleRequestCreated = useCallback(() => {
    setCreateModalOpen(false)
    loadPending({ force: true })
  }, [loadPending])

  // Computed values for inbox
  const items = workItems?.items ?? []
  const meta = workItems?.meta
  const completedList = completedItems?.items ?? []
  const completedMeta = completedItems?.meta

  const selected = useMemo(() => {
    if (!items.length) return null
    if (!selectedId) return items[0] ?? null
    return items.find((i) => i.id === selectedId) ?? items[0] ?? null
  }, [items, selectedId])

  const selectedIndex = useMemo(() => {
    if (!selected) return -1
    return items.findIndex((i) => i.id === selected.id)
  }, [items, selected])

  const selectedCompleted = useMemo(() => {
    if (!completedList.length) return null
    if (!completedSelectedId) return completedList[0] ?? null
    return completedList.find((i) => i.id === completedSelectedId) ?? completedList[0] ?? null
  }, [completedList, completedSelectedId])

  const isInboxLoading = inboxSubTab === 'pending' ? inboxLoading : completedLoading

  return (
    <div className="h-[calc(100vh-theme(spacing.32))] flex flex-col -mt-4">
      <CreateRequestModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleRequestCreated}
      />

      {error ? (
        <Alert variant="error" className="mb-4" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {/* Header with title and tabs */}
      <div className="shrink-0 flex items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Hub</h1>

          {/* Main tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <TabButton
              active={activeTab === 'inbox'}
              onClick={() => setActiveTab('inbox')}
              count={meta?.totalCount}
            >
              Inbox
            </TabButton>
            <TabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </TabButton>
            <TabButton
              active={activeTab === 'leave'}
              onClick={() => setActiveTab('leave')}
            >
              Leave
            </TabButton>
            <TabButton
              active={activeTab === 'reviews'}
              onClick={() => setActiveTab('reviews')}
            >
              Reviews
            </TabButton>
            <TabButton
              active={activeTab === 'violations'}
              onClick={() => setActiveTab('violations')}
            >
              Violations
            </TabButton>
            {dashboardData?.directReports && dashboardData.directReports.length > 0 ? (
              <TabButton
                active={activeTab === 'team'}
                onClick={() => setActiveTab('team')}
              >
                Team
              </TabButton>
            ) : null}
          </div>

          {/* Zero inbox indicator */}
          {activeTab === 'inbox' && inboxSubTab === 'pending' && meta?.totalCount === 0 ? (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-semibold">All clear</span>
            </div>
          ) : null}
        </div>

      </div>

      {/* Tab content with transition */}
      <div className="flex-1 min-h-0">
        {activeTab === 'inbox' ? (
          <div key={`inbox-${inboxSubTab}`} className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Inbox sub-tabs and actions */}
            <div className="shrink-0 flex items-center justify-between mb-4">
              <div className="flex items-center gap-1 p-0.5 bg-slate-200 dark:bg-slate-700 rounded-lg">
                <SubTabButton
                  active={inboxSubTab === 'pending'}
                  onClick={() => setInboxSubTab('pending')}
                  count={meta?.totalCount}
                >
                  Pending
                </SubTabButton>
                <SubTabButton
                  active={inboxSubTab === 'completed'}
                  onClick={() => setInboxSubTab('completed')}
                  count={completedMeta?.totalCount}
                >
                  Completed
                </SubTabButton>
              </div>
              <Button onClick={() => setCreateModalOpen(true)} variant="outline" size="sm">
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Request
              </Button>
            </div>

            {/* Inbox content */}
            {isInboxLoading ? (
              <InboxLoadingSkeleton />
            ) : inboxSubTab === 'pending' ? (
              <div className="flex gap-6 flex-1 min-h-0">
                <div className="w-[380px] shrink-0 flex flex-col min-h-0">
                  <InboxItemList items={items} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
                </div>
                <div className="flex-1 min-h-0">
                  <InboxActionPane
                    item={selected}
                    onAction={handleAction}
                    currentIndex={selectedIndex}
                    totalCount={items.length}
                  />
                </div>
              </div>
            ) : (
              <div className="flex gap-6 flex-1 min-h-0">
                <div className="w-[380px] shrink-0 flex flex-col min-h-0">
                  <CompletedItemList items={completedList} selectedId={selectedCompleted?.id ?? null} onSelect={setCompletedSelectedId} />
                </div>
                <div className="flex-1 min-h-0">
                  <CompletedActionPane item={selectedCompleted} />
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'overview' ? (
          <div key="overview" className="h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            {overviewLoading ? (
              <div className="grid grid-cols-3 gap-4 animate-pulse">
                <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                <div className="col-span-2 h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              </div>
            ) : employee ? (
              <div className="h-full overflow-y-auto space-y-6 pb-8">
                {/* Personal Section */}
                <section>
                  <h2 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-3">
                    Personal
                  </h2>
                  <div className="grid grid-cols-3 gap-4">
                    <ProfileCard
                      employee={employee}
                      editingField={editingField}
                      editValue={editValue}
                      saving={saving}
                      onStartEdit={startEditing}
                      onEditChange={setEditValue}
                      onSave={handleSaveField}
                      onCancel={() => { setEditingField(null); setEditValue('') }}
                    />
                    <TimeOffCard balances={leaveBalances} />
                    <ViolationsCard violations={myViolations} />
                    <MyReviewsCard reviews={myReviews} />
                    <DocumentsCard documents={myDocuments} employeeId={employeeId} />
                  </div>
                </section>

                {/* Team Section - only show if user has manager duties */}
                {dashboardData && (
                  (dashboardData.directReports?.length > 0) ||
                  (dashboardData.pendingReviews?.length > 0) ||
                  (dashboardData.pendingLeaveRequests?.length > 0) ||
                  (dashboardData.upcomingLeaves?.length > 0)
                ) ? (
                  <section>
                    <h2 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-3">
                      Team
                    </h2>
                    <div className="grid grid-cols-3 gap-4">
                      {dashboardData.directReports && dashboardData.directReports.length > 0 ? (
                        <TeamCard directReports={dashboardData.directReports} />
                      ) : null}
                      {dashboardData.upcomingLeaves && dashboardData.upcomingLeaves.length > 0 ? (
                        <WhosOutCard upcomingLeaves={dashboardData.upcomingLeaves} />
                      ) : null}
                      {dashboardData.pendingReviews && dashboardData.pendingReviews.length > 0 ? (
                        <PendingReviewsCard reviews={dashboardData.pendingReviews} />
                      ) : null}
                      {dashboardData.pendingLeaveRequests && dashboardData.pendingLeaveRequests.length > 0 ? (
                        <PendingLeaveCard requests={dashboardData.pendingLeaveRequests} />
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
                <p className="text-slate-500">Could not load your profile</p>
              </div>
            )}
          </div>
        ) : activeTab === 'leave' ? (
          <div key="leave" className="h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            {overviewLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              </div>
            ) : (
              <div className="h-full overflow-y-auto space-y-6 pb-8">
                {/* Leave Balances */}
                <section>
                  <h2 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-3">
                    Leave Balances
                  </h2>
                  {leaveBalances.length > 0 ? (
                    <div className="grid grid-cols-4 gap-4">
                      {leaveBalances.map((balance) => (
                        <div
                          key={balance.leaveType}
                          className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5"
                        >
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            {balance.leaveType}
                          </p>
                          <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">
                            {balance.available}
                            <span className="text-lg font-normal text-slate-400 ml-1">days</span>
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {balance.used} used · {balance.allocated} allocated
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-slate-500">No leave balances configured</p>
                    </div>
                  )}
                </section>

                {/* Request Leave Button */}
                <div className="flex justify-center">
                  <Link
                    href="/leave/request"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Request Leave
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'reviews' ? (
          <div key="reviews" className="h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            {overviewLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              </div>
            ) : (
              <div className="h-full overflow-y-auto space-y-6 pb-8">
                <section>
                  <h2 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-3">
                    My Performance Reviews
                  </h2>
                  {myReviews.length > 0 ? (
                    <div className="space-y-3">
                      {myReviews.map((review) => (
                        <Link
                          key={review.id}
                          href={`/reviews/${review.id}`}
                          className="block rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                {review.reviewPeriod}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                By {review.reviewerName}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'px-2.5 py-1 rounded-full text-xs font-semibold',
                                review.status === 'COMPLETED' || review.status === 'ACKNOWLEDGED'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : review.status === 'DRAFT'
                                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              )}>
                                {review.status}
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-slate-500">No performance reviews yet</p>
                      <p className="text-xs text-slate-400 mt-1">Reviews will appear here when created</p>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        ) : activeTab === 'violations' ? (
          <div key="violations" className="h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            {overviewLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              </div>
            ) : (
              <div className="h-full overflow-y-auto space-y-6 pb-8">
                <section>
                  <h2 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-3">
                    Disciplinary Actions
                  </h2>
                  {myViolations.length > 0 ? (
                    <div className="space-y-3">
                      {myViolations.map((violation) => (
                        <Link
                          key={violation.id}
                          href={`/violations/${violation.id}`}
                          className="block rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                {violation.violationType}
                              </p>
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                {violation.violationReason}
                              </p>
                              <p className="text-xs text-slate-400 mt-2">
                                {new Date(violation.incidentDate).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={cn(
                              'shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold',
                              violation.severity === 'TERMINATION'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : violation.severity === 'FINAL_WARNING'
                                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                  : violation.severity === 'WRITTEN_WARNING'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                            )}>
                              {violation.severity.replace('_', ' ')}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Clean record</p>
                      <p className="text-xs text-slate-400 mt-1">No disciplinary actions on file</p>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        ) : activeTab === 'team' ? (
          <div key="team" className="h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            {overviewLoading ? (
              <div className="grid grid-cols-3 gap-4 animate-pulse">
                <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              </div>
            ) : dashboardData ? (
              <div className="h-full overflow-y-auto space-y-6 pb-8">
                {/* Direct Reports */}
                {dashboardData.directReports && dashboardData.directReports.length > 0 ? (
                  <section>
                    <h2 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-3">
                      Direct Reports ({dashboardData.directReports.length})
                    </h2>
                    <div className="grid grid-cols-4 gap-4">
                      {dashboardData.directReports.map((report) => (
                        <Link
                          key={report.id}
                          href={`/employees/${report.id}`}
                          className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors text-center"
                        >
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center mx-auto mb-3">
                            <span className="text-lg font-bold text-slate-600 dark:text-slate-200">
                              {report.firstName[0]}{report.lastName[0]}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">
                            {report.firstName} {report.lastName}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {report.position}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}

                {/* Who's Out */}
                {dashboardData.upcomingLeaves && dashboardData.upcomingLeaves.length > 0 ? (
                  <section>
                    <h2 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-3">
                      Team Leave Schedule
                    </h2>
                    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {dashboardData.upcomingLeaves.slice(0, 5).map((leave) => (
                          <div key={leave.id} className="flex items-center justify-between px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                  {leave.employee.firstName[0]}{leave.employee.lastName[0]}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
                                  {leave.employee.firstName} {leave.employee.lastName}
                                </p>
                                <p className="text-xs text-slate-500">{leave.leaveType}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                ) : null}

                {/* Pending Reviews to Complete */}
                {dashboardData.pendingReviews && dashboardData.pendingReviews.length > 0 ? (
                  <section>
                    <h2 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-3">
                      Reviews I Owe
                    </h2>
                    <div className="space-y-3">
                      {dashboardData.pendingReviews.map((review) => (
                        <Link
                          key={review.id}
                          href={`/reviews/${review.id}`}
                          className="flex items-center justify-between rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                              <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                                {review.employee.firstName[0]}{review.employee.lastName[0]}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                {review.employee.firstName} {review.employee.lastName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {review.reviewPeriod}
                              </p>
                            </div>
                          </div>
                          <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-semibold">
                            Pending
                          </span>
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}

                {/* Pending Leave Approvals */}
                {dashboardData.pendingLeaveRequests && dashboardData.pendingLeaveRequests.length > 0 ? (
                  <section>
                    <h2 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mb-3">
                      Leave Requests to Approve
                    </h2>
                    <div className="space-y-3">
                      {dashboardData.pendingLeaveRequests.map((request) => (
                        <Link
                          key={request.id}
                          href={`/leave/${request.id}`}
                          className="flex items-center justify-between rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                              <span className="text-sm font-bold text-cyan-700 dark:text-cyan-400">
                                {request.employee.firstName[0]}{request.employee.lastName[0]}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                {request.employee.firstName} {request.employee.lastName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {request.leaveType} · {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <span className="px-3 py-1.5 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 text-xs font-semibold">
                            Pending
                          </span>
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}

                {/* Empty state if no team data */}
                {(!dashboardData.directReports || dashboardData.directReports.length === 0) &&
                 (!dashboardData.upcomingLeaves || dashboardData.upcomingLeaves.length === 0) &&
                 (!dashboardData.pendingReviews || dashboardData.pendingReviews.length === 0) &&
                 (!dashboardData.pendingLeaveRequests || dashboardData.pendingLeaveRequests.length === 0) ? (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-500">No team management tasks</p>
                    <p className="text-xs text-slate-400 mt-1">Team activities will appear here</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
                <p className="text-slate-500">Could not load team data</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

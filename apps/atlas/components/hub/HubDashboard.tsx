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
import { getLeaveTypeLabel } from '@/components/employee/profile/utils'
import { InboxItemList } from '@/components/inbox/InboxItemList'
import { CompletedItemList } from '@/components/inbox/CompletedItemList'
import { InboxActionPane } from '@/components/inbox/InboxActionPane'
import { CompletedActionPane } from '@/components/inbox/CompletedActionPane'
import { CreateRequestModal } from '@/components/inbox/CreateRequestModal'

type HubTab = 'inbox' | 'overview'
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

function SectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
        {children}
      </h2>
      {action}
    </div>
  )
}

// ============================================================================
// Profile Section
// ============================================================================

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
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-200 dark:to-slate-400 flex items-center justify-center text-white dark:text-slate-900 text-lg font-bold shadow-lg shrink-0">
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
    </div>
  )
}

// ============================================================================
// Time Off Section
// ============================================================================

function LeaveBalanceCard({ balance }: { balance: LeaveBalance }) {
  const available = balance.available
  const total = balance.allocated
  const percentage = total > 0 ? (available / total) * 100 : 0
  const isLow = total > 0 && available <= Math.ceil(total * 0.2) && available > 0
  const isEmpty = available === 0

  const size = 56
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
      <div className="relative flex-shrink-0">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-100 dark:text-slate-700"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(
              'transition-all duration-500',
              isEmpty ? 'text-slate-300' : isLow ? 'text-amber-500' : 'text-cyan-500'
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn(
            'text-sm font-bold tabular-nums',
            isEmpty ? 'text-slate-400' : isLow ? 'text-amber-600' : 'text-slate-900 dark:text-slate-50'
          )}>
            {available}
          </span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">
            {getLeaveTypeLabel(balance.leaveType)}
          </h4>
          {balance.pending > 0 && (
            <span className="flex-shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
              {balance.pending} pending
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {balance.used} used of {total}
        </p>
      </div>
    </div>
  )
}

function TimeOffSection({ balances }: { balances: LeaveBalance[] }) {
  const filtered = balances.filter(b => b.leaveType !== 'UNPAID')

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
        <p className="text-sm text-slate-500">No leave balances configured</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {filtered.map((balance) => (
        <LeaveBalanceCard key={balance.leaveType} balance={balance} />
      ))}
    </div>
  )
}

// ============================================================================
// Performance Section (Reviews + Violations combined)
// ============================================================================

function PerformanceSection({
  reviews,
  violations,
}: {
  reviews: PerformanceReview[]
  violations: DisciplinaryAction[]
}) {
  const hasReviews = reviews.length > 0
  const hasViolations = violations.length > 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Reviews */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">My Reviews</h3>
          {hasReviews && (
            <Link href="/performance/reviews" className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
              View all
            </Link>
          )}
        </div>
        {hasReviews ? (
          <div className="space-y-2">
            {reviews.slice(0, 3).map((r) => (
              <Link
                key={r.id}
                href={`/performance/reviews/${r.id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {r.reviewType.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.reviewPeriod}</p>
                </div>
                <span className={cn(
                  'ml-2 px-2 py-0.5 rounded text-xs font-medium',
                  r.status === 'COMPLETED' || r.status === 'ACKNOWLEDGED'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                )}>
                  {r.status === 'COMPLETED' || r.status === 'ACKNOWLEDGED' ? `${r.overallRating}/5` : r.status}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">No reviews yet</p>
          </div>
        )}
      </div>

      {/* Violations */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Disciplinary Record</h3>
          {hasViolations && (
            <Link href="/performance/violations" className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
              View all
            </Link>
          )}
        </div>
        {hasViolations ? (
          <div className="space-y-2">
            {violations.slice(0, 3).map((v) => (
              <Link
                key={v.id}
                href={`/performance/violations/${v.id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {v.violationType.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(v.incidentDate).toLocaleDateString()}
                  </p>
                </div>
                <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400">
                  {v.severity.replace(/_/g, ' ')}
                </span>
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
            <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">Clean record</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Documents Section
// ============================================================================

function DocumentsSection({ documents, employeeId }: { documents: EmployeeFile[]; employeeId: string }) {
  if (documents.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
        <p className="text-sm text-slate-500 mb-2">No documents uploaded</p>
        <Link
          href={`/employees/${employeeId}/files`}
          className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
        >
          Upload documents
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {documents.slice(0, 4).map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{doc.title}</p>
            <p className="text-[11px] text-slate-400">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
          </div>
        </div>
      ))}
      {documents.length > 4 && (
        <Link
          href={`/employees/${employeeId}/files`}
          className="flex items-center justify-center p-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors"
        >
          +{documents.length - 4} more
        </Link>
      )}
    </div>
  )
}

// ============================================================================
// Team Section
// ============================================================================

function TeamSection({ dashboardData }: { dashboardData: DashboardData }) {
  const hasDirectReports = dashboardData.directReports && dashboardData.directReports.length > 0
  const hasPendingReviews = dashboardData.pendingReviews && dashboardData.pendingReviews.length > 0
  const hasPendingLeave = dashboardData.pendingLeaveRequests && dashboardData.pendingLeaveRequests.length > 0
  const hasUpcomingLeave = dashboardData.upcomingLeaves && dashboardData.upcomingLeaves.length > 0

  if (!hasDirectReports && !hasPendingReviews && !hasPendingLeave && !hasUpcomingLeave) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Direct Reports */}
      {hasDirectReports && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Direct Reports ({dashboardData.directReports.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {dashboardData.directReports.slice(0, 8).map((report) => (
              <Link
                key={report.id}
                href={`/employees/${report.id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center text-[10px] font-bold text-white dark:text-slate-200">
                  {report.firstName[0]}{report.lastName[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {report.firstName} {report.lastName}
                  </p>
                </div>
              </Link>
            ))}
            {dashboardData.directReports.length > 8 && (
              <Link
                href="/employees"
                className="flex items-center justify-center px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                +{dashboardData.directReports.length - 8}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Pending Actions Grid */}
      {(hasPendingReviews || hasPendingLeave || hasUpcomingLeave) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pending Reviews */}
          {hasPendingReviews && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Reviews to Complete</h3>
              <div className="space-y-2">
                {dashboardData.pendingReviews.slice(0, 3).map((review) => (
                  <Link
                    key={review.id}
                    href={`/performance/reviews/${review.id}`}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      {review.employee.firstName[0]}{review.employee.lastName[0]}
                    </div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                      {review.employee.firstName} {review.employee.lastName}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Leave Requests */}
          {hasPendingLeave && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Leave to Approve</h3>
              <div className="space-y-2">
                {dashboardData.pendingLeaveRequests.slice(0, 3).map((req) => (
                  <Link
                    key={req.id}
                    href={`/leave/${req.id}`}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-cyan-200 dark:bg-cyan-800 flex items-center justify-center text-[10px] font-bold text-cyan-700 dark:text-cyan-300">
                      {req.employee.firstName[0]}{req.employee.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate block">
                        {req.employee.firstName}
                      </span>
                      <span className="text-[11px] text-slate-500">{req.totalDays}d {req.leaveType}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Who's Out */}
          {hasUpcomingLeave && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Who's Out</h3>
              <div className="space-y-2">
                {dashboardData.upcomingLeaves.slice(0, 3).map((leave) => {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  const start = new Date(leave.startDate)
                  start.setHours(0, 0, 0, 0)
                  const isOutNow = start <= today

                  return (
                    <div
                      key={leave.id}
                      className={cn(
                        'flex items-center gap-2.5 p-2.5 rounded-xl',
                        isOutNow
                          ? 'bg-rose-50 dark:bg-rose-900/20'
                          : 'bg-slate-50 dark:bg-slate-800/50'
                      )}
                    >
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold',
                        isOutNow
                          ? 'bg-rose-200 dark:bg-rose-800 text-rose-700 dark:text-rose-300'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      )}>
                        {leave.employee.firstName[0]}{leave.employee.lastName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate block">
                          {leave.employee.firstName}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {isOutNow ? 'Out today' : new Date(leave.startDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Inbox Components
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
  // Tab state - only inbox and overview now
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

  // Initial load
  useEffect(() => {
    loadPending()
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

  // Check if user is a manager
  const isManager = dashboardData?.directReports && dashboardData.directReports.length > 0

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

          {/* Main tabs - simplified to just Inbox and Overview */}
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

      {/* Tab content */}
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
        ) : (
          <div key="overview" className="h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            {overviewLoading ? (
              <div className="space-y-6 animate-pulse">
                <div className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                <div className="grid grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                  <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                </div>
              </div>
            ) : employee ? (
              <div className="h-full overflow-y-auto space-y-8 pb-8 pr-2 -mr-2">
                {/* Profile Section */}
                <section>
                  <SectionHeader>Profile</SectionHeader>
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
                </section>

                {/* Time Off Section */}
                <section>
                  <SectionHeader
                    action={
                      <Link
                        href="/leave/request"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Request Leave
                      </Link>
                    }
                  >
                    Time Off
                  </SectionHeader>
                  <TimeOffSection balances={leaveBalances} />
                </section>

                {/* Performance Section */}
                <section>
                  <SectionHeader>Performance</SectionHeader>
                  <PerformanceSection reviews={myReviews} violations={myViolations} />
                </section>

                {/* Documents Section */}
                <section>
                  <SectionHeader
                    action={
                      <Link
                        href={`/employees/${employeeId}/files`}
                        className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
                      >
                        Manage
                      </Link>
                    }
                  >
                    Documents
                  </SectionHeader>
                  <DocumentsSection documents={myDocuments} employeeId={employeeId} />
                </section>

                {/* Team Section - only for managers */}
                {isManager && dashboardData ? (
                  <section>
                    <SectionHeader>Team</SectionHeader>
                    <TeamSection dashboardData={dashboardData} />
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
                <p className="text-slate-500">Could not load your profile</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

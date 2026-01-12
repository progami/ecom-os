'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  EmployeesApi,
  LeavesApi,
  WorkItemsApi,
  DashboardApi,
  type Employee,
  type LeaveBalance,
  type DashboardData,
} from '@/lib/api-client'
import type { WorkItemsResponse, WorkItemDTO, CompletedWorkItemsResponse } from '@/lib/contracts/work-items'
import type { ActionId } from '@/lib/contracts/action-ids'
import { executeAction } from '@/lib/actions/execute-action'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ActivityTimeline } from './ActivityTimeline'
import { InboxItemList } from '@/components/inbox/InboxItemList'
import { CompletedItemList } from '@/components/inbox/CompletedItemList'
import { InboxActionPane } from '@/components/inbox/InboxActionPane'
import { CompletedActionPane } from '@/components/inbox/CompletedActionPane'
import { CreateRequestModal } from '@/components/inbox/CreateRequestModal'

type HubTab = 'inbox' | 'overview' | 'activity'
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

function ProfileCard({ employee }: { employee: Employee }) {
  const joinDate = employee.joinDate ? new Date(employee.joinDate) : null
  const tenure = joinDate ? Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365)) : null

  return (
    <BentoCard className="p-5">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-200 dark:to-slate-400 flex items-center justify-center text-white dark:text-slate-900 text-lg font-bold shadow-lg shrink-0">
          {employee.firstName[0]}
          {employee.lastName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 truncate">
            {employee.firstName} {employee.lastName}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{employee.position}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
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
          className="shrink-0 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </Link>
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

function QuickActionsCard() {
  return (
    <BentoCard className="p-5">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/leave/request"
          className="group flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-900 dark:hover:bg-white transition-all"
        >
          <svg className="w-4 h-4 text-slate-400 group-hover:text-white dark:group-hover:text-slate-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200 group-hover:text-white dark:group-hover:text-slate-900 transition-colors">
            Request Leave
          </span>
        </Link>
        <Link
          href="/resources"
          className="group flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-900 dark:hover:bg-white transition-all"
        >
          <svg className="w-4 h-4 text-slate-400 group-hover:text-white dark:group-hover:text-slate-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200 group-hover:text-white dark:group-hover:text-slate-900 transition-colors">
            Resources
          </span>
        </Link>
        <Link
          href="/calendar"
          className="group flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-900 dark:hover:bg-white transition-all"
        >
          <svg className="w-4 h-4 text-slate-400 group-hover:text-white dark:group-hover:text-slate-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
          </svg>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200 group-hover:text-white dark:group-hover:text-slate-900 transition-colors">
            Calendar
          </span>
        </Link>
        <Link
          href="/policies"
          className="group flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-900 dark:hover:bg-white transition-all"
        >
          <svg className="w-4 h-4 text-slate-400 group-hover:text-white dark:group-hover:text-slate-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200 group-hover:text-white dark:group-hover:text-slate-900 transition-colors">
            Policies
          </span>
        </Link>
      </div>
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
  const [overviewLoading, setOverviewLoading] = useState(false)

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
      const [emp, balanceData, dashboard] = await Promise.all([
        EmployeesApi.get(employeeId),
        LeavesApi.getBalance({ employeeId }).catch(() => ({ balances: [] })),
        DashboardApi.get().catch(() => null),
      ])
      setEmployee(emp)
      setLeaveBalances(balanceData.balances)
      setDashboardData(dashboard)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load profile'
      setError(message)
    } finally {
      setOverviewLoading(false)
    }
  }, [employeeId])

  // Initial load - inbox items
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
              active={activeTab === 'activity'}
              onClick={() => setActiveTab('activity')}
            >
              Activity
            </TabButton>
          </div>

          {/* Inbox sub-tabs */}
          {activeTab === 'inbox' ? (
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
          ) : null}

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

        {/* New Request button (only on inbox tab) */}
        {activeTab === 'inbox' ? (
          <Button onClick={() => setCreateModalOpen(true)} variant="default" size="sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Request
          </Button>
        ) : null}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'inbox' ? (
          isInboxLoading ? (
            <InboxLoadingSkeleton />
          ) : inboxSubTab === 'pending' ? (
            <div className="flex gap-6 h-full">
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
            <div className="flex gap-6 h-full">
              <div className="w-[380px] shrink-0 flex flex-col min-h-0">
                <CompletedItemList items={completedList} selectedId={selectedCompleted?.id ?? null} onSelect={setCompletedSelectedId} />
              </div>
              <div className="flex-1 min-h-0">
                <CompletedActionPane item={selectedCompleted} />
              </div>
            </div>
          )
        ) : activeTab === 'overview' ? (
          overviewLoading ? (
            <div className="grid grid-cols-3 gap-4 animate-pulse">
              <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              <div className="col-span-2 h-24 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800" />
            </div>
          ) : employee ? (
            <div className="grid grid-cols-3 gap-4">
              {/* Row 1: Profile + Team */}
              <ProfileCard employee={employee} />
              {dashboardData?.directReports && dashboardData.directReports.length > 0 ? (
                <TeamCard directReports={dashboardData.directReports} />
              ) : (
                <>
                  <TimeOffCard balances={leaveBalances} />
                  <QuickActionsCard />
                </>
              )}

              {/* Row 2: Conditionally show cards based on what data exists */}
              {dashboardData?.directReports && dashboardData.directReports.length > 0 ? (
                <>
                  <TimeOffCard balances={leaveBalances} />
                  {dashboardData.pendingReviews && dashboardData.pendingReviews.length > 0 ? (
                    <PendingReviewsCard reviews={dashboardData.pendingReviews} />
                  ) : null}
                  {dashboardData.pendingLeaveRequests && dashboardData.pendingLeaveRequests.length > 0 ? (
                    <PendingLeaveCard requests={dashboardData.pendingLeaveRequests} />
                  ) : null}
                  <QuickActionsCard />
                </>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
              <p className="text-slate-500">Could not load your profile</p>
            </div>
          )
        ) : (
          <ActivityTimeline employeeId={employeeId} />
        )}
      </div>
    </div>
  )
}

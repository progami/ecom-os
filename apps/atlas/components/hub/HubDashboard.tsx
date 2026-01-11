'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  DashboardApi,
  EmployeesApi,
  LeavesApi,
  type DashboardData,
  type Employee,
  type LeaveBalance,
} from '@/lib/api-client'
import { cn } from '@/lib/utils'

type HubDashboardProps = {
  employeeId: string
}

// Donut chart component
function DonutChart({
  value,
  max,
  color,
  size = 120,
  strokeWidth = 12,
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
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100 dark:text-slate-800"
        />
        {/* Progress circle */}
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
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</span>
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">of {max}</span>
      </div>
    </div>
  )
}

// Bento card wrapper
function BentoCard({
  children,
  className,
  span = 1,
}: {
  children: React.ReactNode
  className?: string
  span?: 1 | 2
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700',
        'bg-white dark:bg-slate-900',
        'transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50',
        'hover:border-slate-300 dark:hover:border-slate-600',
        span === 2 && 'col-span-2',
        className
      )}
    >
      {children}
    </div>
  )
}

// Time Off Balance Card
function TimeOffCard({ balances }: { balances: LeaveBalance[] }) {
  // Filter and find the main PTO balance
  const ptoBalance = balances.find((b) => b.leaveType === 'PTO')
  const sickBalance = balances.find((b) => b.leaveType === 'SICK')

  const mainBalance = ptoBalance || balances[0]

  if (!mainBalance) {
    return (
      <BentoCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Time Off
          </h3>
          <Link
            href="/hub?tab=leave"
            className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            View all
          </Link>
        </div>
        <p className="text-sm text-slate-400">No balances available</p>
      </BentoCard>
    )
  }

  const colors = {
    PTO: '#0891b2', // cyan-600
    SICK: '#f59e0b', // amber-500
    PARENTAL: '#8b5cf6', // violet-500
    BEREAVEMENT: '#64748b', // slate-500
  }

  const color = colors[mainBalance.leaveType as keyof typeof colors] || colors.PTO

  return (
    <BentoCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Time Off Balance
        </h3>
        <Link
          href="/hub?tab=leave"
          className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="flex items-center gap-6">
        <DonutChart value={mainBalance.available} max={mainBalance.allocated} color={color} />

        <div className="flex-1 space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">Available</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-50">
              {mainBalance.available} <span className="text-sm font-normal text-slate-400">days</span>
            </p>
          </div>

          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-slate-400">Used: </span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">{mainBalance.used}</span>
            </div>
            <div>
              <span className="text-slate-400">Pending: </span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">{mainBalance.pending}</span>
            </div>
          </div>

          {sickBalance ? (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400">
                Sick leave: <span className="font-semibold text-slate-600 dark:text-slate-300">{sickBalance.available}</span> of {sickBalance.allocated}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </BentoCard>
  )
}

// Quick Profile Card
function QuickProfileCard({ employee }: { employee: Employee }) {
  return (
    <BentoCard className="p-6" span={2}>
      <div className="flex items-start gap-5">
        {/* Avatar */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-200 dark:to-slate-400 flex items-center justify-center text-white dark:text-slate-900 text-2xl font-bold shadow-lg">
            {employee.firstName[0]}
            {employee.lastName[0]}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 truncate">
            {employee.firstName} {employee.lastName}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{employee.position}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {employee.department || 'No department'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
              {employee.employeeId}
            </span>
            {employee.manager ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-xs font-medium text-cyan-700 dark:text-cyan-300">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Reports to {employee.manager.firstName} {employee.manager.lastName}
              </span>
            ) : null}
          </div>
        </div>

        {/* Quick actions */}
        <div className="shrink-0">
          <Link
            href={`/employees/${employee.id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Profile
          </Link>
        </div>
      </div>
    </BentoCard>
  )
}

// Contact Info Card
function ContactCard({ employee }: { employee: Employee }) {
  return (
    <BentoCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Contact
        </h3>
        <Link
          href={`/employees/${employee.id}/edit`}
          className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
        >
          Edit
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium text-slate-400 uppercase">Email</p>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">{employee.email}</p>
          </div>
        </div>

        {employee.phone ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-slate-400 uppercase">Phone</p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{employee.phone}</p>
            </div>
          </div>
        ) : null}
      </div>
    </BentoCard>
  )
}

// Employment Card
function EmploymentCard({ employee }: { employee: Employee }) {
  const joinDate = employee.joinDate ? new Date(employee.joinDate) : null
  const tenure = joinDate ? Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365)) : null

  return (
    <BentoCard className="p-6">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
        Employment
      </h3>

      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-medium text-slate-400 uppercase mb-1">Status</p>
          <span className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
            employee.status === 'ACTIVE'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          )}>
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              employee.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
            )} />
            {employee.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase mb-1">Type</p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {employee.employmentType.replace(/_/g, ' ')}
            </p>
          </div>
          {tenure !== null && tenure >= 0 ? (
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase mb-1">Tenure</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {tenure === 0 ? '< 1 year' : `${tenure} year${tenure !== 1 ? 's' : ''}`}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </BentoCard>
  )
}

// Documents Card (placeholder)
function DocumentsCard({ employeeId }: { employeeId: string }) {
  return (
    <BentoCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Documents
        </h3>
        <Link
          href="/hub?tab=documents"
          className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">Employment Contract</p>
            <p className="text-xs text-slate-400">PDF Document</p>
          </div>
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">ID Badge</p>
            <p className="text-xs text-slate-400">PDF Document</p>
          </div>
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
      </div>
    </BentoCard>
  )
}

// Quick Links Card
function QuickLinksCard() {
  const links = [
    { href: '/resources', label: 'Team Resources', icon: '01', description: 'Tools & shared logins' },
    { href: '/leave', label: 'Request Leave', icon: '02', description: 'Book time off' },
    { href: '/policies', label: 'Policies', icon: '03', description: 'Company guidelines' },
    { href: '/org-chart', label: 'Org Chart', icon: '04', description: 'Team structure' },
  ]

  return (
    <BentoCard className="p-6">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
        Quick Links
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-900 dark:hover:bg-white transition-all duration-200"
          >
            <span className="font-mono text-[10px] font-bold text-slate-300 dark:text-slate-600 group-hover:text-white/50 dark:group-hover:text-slate-900/50 transition-colors">
              {link.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-white dark:group-hover:text-slate-900 transition-colors">
                {link.label}
              </p>
              <p className="text-[10px] text-slate-400 group-hover:text-white/70 dark:group-hover:text-slate-900/70 transition-colors">
                {link.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </BentoCard>
  )
}

export function HubDashboard({ employeeId }: HubDashboardProps) {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)

        const [emp, balanceData] = await Promise.all([
          EmployeesApi.get(employeeId),
          LeavesApi.getBalance({ employeeId }).catch(() => ({ balances: [] })),
        ])

        setEmployee(emp)
        setLeaveBalances(balanceData.balances)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load data'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [employeeId])

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4 animate-pulse">
        <div className="col-span-2 h-36 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-36 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
        <p className="text-slate-500">{error || 'Could not load your profile'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bento grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Row 1 */}
        <QuickProfileCard employee={employee} />
        <TimeOffCard balances={leaveBalances} />

        {/* Row 2 */}
        <ContactCard employee={employee} />
        <EmploymentCard employee={employee} />
        <DocumentsCard employeeId={employeeId} />

        {/* Row 3 */}
        <QuickLinksCard />
      </div>
    </div>
  )
}

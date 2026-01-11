'use client'

import Link from 'next/link'
import type { DisciplinaryAction } from '@/lib/api-client'
import { ChevronRightIcon, ShieldExclamationIcon } from '@/components/ui/Icons'
import { cn } from '@/lib/utils'
import {
  VIOLATION_TYPE_LABELS,
  DISCIPLINARY_STATUS_LABELS,
  DISCIPLINARY_ACTION_TYPE_LABELS,
} from '@/lib/domain/disciplinary/constants'
import { formatDate } from '../utils'

function getSeverityConfig(severity: string) {
  switch (severity) {
    case 'CRITICAL':
      return { label: 'Critical', bgClass: 'bg-red-100', textClass: 'text-red-700', dotClass: 'border-danger-500' }
    case 'MAJOR':
      return { label: 'Major', bgClass: 'bg-orange-100', textClass: 'text-orange-700', dotClass: 'border-orange-500' }
    case 'MODERATE':
      return { label: 'Moderate', bgClass: 'bg-amber-100', textClass: 'text-amber-700', dotClass: 'border-warning-500' }
    case 'MINOR':
      return { label: 'Minor', bgClass: 'bg-slate-100', textClass: 'text-slate-700', dotClass: 'border-muted-foreground/50' }
    default:
      return { label: severity, bgClass: 'bg-slate-100', textClass: 'text-slate-600', dotClass: 'border-muted-foreground/50' }
  }
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'CLOSED':
    case 'DISMISSED':
      return { label: DISCIPLINARY_STATUS_LABELS[status as keyof typeof DISCIPLINARY_STATUS_LABELS] ?? status, bgClass: 'bg-slate-100', textClass: 'text-slate-600' }
    case 'ACTIVE':
    case 'ACTION_TAKEN':
      return { label: DISCIPLINARY_STATUS_LABELS[status as keyof typeof DISCIPLINARY_STATUS_LABELS] ?? status, bgClass: 'bg-emerald-100', textClass: 'text-emerald-700' }
    case 'APPEALED':
    case 'APPEAL_PENDING_HR':
    case 'APPEAL_PENDING_SUPER_ADMIN':
      return { label: DISCIPLINARY_STATUS_LABELS[status as keyof typeof DISCIPLINARY_STATUS_LABELS] ?? status, bgClass: 'bg-purple-100', textClass: 'text-purple-700' }
    default:
      return { label: DISCIPLINARY_STATUS_LABELS[status as keyof typeof DISCIPLINARY_STATUS_LABELS] ?? status, bgClass: 'bg-amber-100', textClass: 'text-amber-700' }
  }
}

export function EmployeeViolationsTab({
  violations,
  loading,
}: {
  violations: DisciplinaryAction[]
  loading: boolean
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Disciplinary Actions</h2>
        <p className="text-sm text-muted-foreground">
          {violations.length > 0
            ? `${violations.length} record${violations.length !== 1 ? 's' : ''} on file`
            : 'Track disciplinary incidents and actions'}
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : violations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <ShieldExclamationIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No disciplinary records</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            This is a clean record with no incidents
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-6 bottom-6 w-px bg-border" />

          <div className="space-y-3">
            {violations.map((violation) => {
              const severityConfig = getSeverityConfig(violation.severity)
              const statusConfig = getStatusConfig(violation.status)
              const violationType = VIOLATION_TYPE_LABELS[violation.violationType as keyof typeof VIOLATION_TYPE_LABELS] ?? violation.violationType
              const actionType = violation.actionTaken
                ? DISCIPLINARY_ACTION_TYPE_LABELS[violation.actionTaken as keyof typeof DISCIPLINARY_ACTION_TYPE_LABELS] ?? violation.actionTaken
                : null

              return (
                <Link key={violation.id} href={`/violations/${violation.id}`} className="block group relative">
                  <div className="flex gap-4 pl-10">
                    {/* Timeline dot - color based on severity */}
                    <div
                      className={cn(
                        'absolute left-2 top-5 h-3 w-3 rounded-full border-2 bg-card z-10',
                        severityConfig.dotClass
                      )}
                    />

                    {/* Card */}
                    <div className="flex-1 rounded-xl border border-border bg-card p-4 hover:border-brand-teal-500/30 hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{violationType}</span>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
                                severityConfig.bgClass,
                                severityConfig.textClass
                              )}
                            >
                              {severityConfig.label}
                            </span>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
                                statusConfig.bgClass,
                                statusConfig.textClass
                              )}
                            >
                              {statusConfig.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span>Incident: {formatDate(violation.incidentDate)}</span>
                            {actionType ? (
                              <>
                                <span className="text-muted-foreground/50">•</span>
                                <span>{actionType}</span>
                              </>
                            ) : null}
                          </div>
                          {violation.caseId ? (
                            <div className="mt-2 inline-flex items-center text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                              {violation.caseId}
                            </div>
                          ) : null}
                        </div>
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

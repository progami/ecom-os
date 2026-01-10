'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmployeesApi, MeApi, TasksApi, type Employee, type Me, type Task } from '@/lib/api-client'
import { ClipboardIcon, UsersIcon } from '@/components/ui/Icons'
import { ListPageHeader } from '@/components/ui/PageHeader'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardDivider } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/select'

type EmployeeOption = { value: string; label: string }

type ChecklistTaskTemplate = {
  title: string
  description: string
}

const ONBOARDING_TASKS: ChecklistTaskTemplate[] = [
  {
    title: 'Confirm profile basics (role, department, manager)',
    description:
      'Verify the employee profile details are correct and the reporting line is set. Update Job & Org fields if needed.',
  },
  {
    title: 'Collect required documents (contract, ID, bank details)',
    description:
      'Upload the signed documents to the employee profile (Documents tab) and confirm visibility settings.',
  },
  {
    title: 'Provision access (Portal entitlement + Atlas roles)',
    description:
      'Grant the right Atlas access and roles. Confirm the employee can sign in and sees the correct navigation.',
  },
  {
    title: 'Policies & acknowledgements',
    description:
      'Share key policies and confirm acknowledgement where applicable.',
  },
  {
    title: 'Day‑1 readiness (calendar, equipment, workspace)',
    description:
      'Confirm the employee is ready for day 1: calendar invites, equipment, and internal tools.',
  },
]

const OFFBOARDING_TASKS: ChecklistTaskTemplate[] = [
  {
    title: 'Confirm last working day + handover plan',
    description:
      'Confirm last working day, manager sign-off, and outline handover responsibilities and deadlines.',
  },
  {
    title: 'Reassign open tasks / work items',
    description:
      'Review Work Queue and Task List for ownership. Reassign or close items as appropriate.',
  },
  {
    title: 'Disable access (Portal entitlement + Atlas roles)',
    description:
      'Remove Atlas access and any related roles at the right time. Confirm the account is effectively deprovisioned.',
  },
  {
    title: 'Recover company assets',
    description:
      'Collect equipment (laptop, badge, keys) and confirm return status.',
  },
  {
    title: 'Archive documents + update employee status',
    description:
      'Ensure final documents are stored correctly and update employee status when complete.',
  },
]

function employeeDisplayName(employee: Pick<Employee, 'firstName' | 'lastName'>): string {
  const name = `${employee.firstName} ${employee.lastName}`.trim()
  return name.length > 0 ? name : 'Employee'
}

function employeeOptionLabel(employee: Employee): string {
  const name = employeeDisplayName(employee)
  return `${name} (${employee.employeeId})`
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function isHROrAbove(me: Me | null): boolean {
  return [me?.isHR, me?.isSuperAdmin].some((flag) => flag === true)
}

export default function OnboardingOffboardingPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [onboardingEmployeeId, setOnboardingEmployeeId] = useState('')
  const [onboardingOwnerId, setOnboardingOwnerId] = useState('')
  const [onboardingTargetDate, setOnboardingTargetDate] = useState('')
  const [onboardingCreating, setOnboardingCreating] = useState(false)
  const [onboardingError, setOnboardingError] = useState<string | null>(null)
  const [onboardingCreated, setOnboardingCreated] = useState<Task[]>([])

  const [offboardingEmployeeId, setOffboardingEmployeeId] = useState('')
  const [offboardingOwnerId, setOffboardingOwnerId] = useState('')
  const [offboardingTargetDate, setOffboardingTargetDate] = useState('')
  const [offboardingCreating, setOffboardingCreating] = useState(false)
  const [offboardingError, setOffboardingError] = useState<string | null>(null)
  const [offboardingCreated, setOffboardingCreated] = useState<Task[]>([])

  const employeeById = useMemo(() => {
    return new Map(employees.map((e) => [e.id, e] as const))
  }, [employees])

  const employeeOptions = useMemo<EmployeeOption[]>(() => {
    const options: EmployeeOption[] = []
    const seen = new Set<string>()

    if (me) {
      options.push({ value: me.id, label: `Me (${me.employeeId})` })
      seen.add(me.id)
    }

    for (const employee of employees) {
      if (seen.has(employee.id)) continue
      options.push({ value: employee.id, label: employeeOptionLabel(employee) })
      seen.add(employee.id)
    }

    return options
  }, [employees, me])

  const canUseWorkflows = isHROrAbove(me)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setLoadError(null)
        const meData = await MeApi.get()
        if (cancelled) return
        setMe(meData)

        if (!isHROrAbove(meData)) {
          setEmployees([])
          return
        }

        const list = await EmployeesApi.listManageable()
        if (cancelled) return
        setEmployees(list.items)
        setOnboardingOwnerId(meData.id)
        setOffboardingOwnerId(meData.id)
      } catch (e) {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : 'Failed to load')
        setEmployees([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!onboardingEmployeeId) return
    if (onboardingTargetDate.length > 0) return
    const employee = employeeById.get(onboardingEmployeeId)
    const next = employee ? toDateInput(employee.joinDate) : ''
    if (next.length > 0) setOnboardingTargetDate(next)
  }, [employeeById, onboardingEmployeeId, onboardingTargetDate])

  const createChecklist = useCallback(async (opts: {
    workflow: 'onboarding' | 'offboarding'
    employeeId: string
    ownerId: string
    targetDate: string
  }) => {
    const { workflow, employeeId, ownerId, targetDate } = opts
    const templates = workflow === 'onboarding' ? ONBOARDING_TASKS : OFFBOARDING_TASKS
    const prefix = workflow === 'onboarding' ? 'Onboarding' : 'Offboarding'

    const employee = employeeById.get(employeeId)
    const employeeName = employee ? employeeDisplayName(employee) : 'Employee'
    const titleSuffix = ` — ${employeeName}`
    const dueDate = targetDate.trim().length > 0 ? targetDate.trim() : null
    const assignedToId = ownerId.trim().length > 0 ? ownerId.trim() : null

    const created: Task[] = []
    for (const t of templates) {
      const next = await TasksApi.create({
        title: `${prefix}: ${t.title}${titleSuffix}`,
        description: t.description,
        category: 'GENERAL',
        dueDate,
        assignedToId,
        subjectEmployeeId: employeeId,
      })
      created.push(next)
    }

    return created
  }, [employeeById])

  const runOnboarding = useCallback(async () => {
    if (!canUseWorkflows) return
    if (!onboardingEmployeeId) return

    setOnboardingCreating(true)
    setOnboardingError(null)
    setOnboardingCreated([])

    try {
      const created = await createChecklist({
        workflow: 'onboarding',
        employeeId: onboardingEmployeeId,
        ownerId: onboardingOwnerId,
        targetDate: onboardingTargetDate,
      })
      setOnboardingCreated(created)
    } catch (e) {
      setOnboardingError(e instanceof Error ? e.message : 'Failed to create onboarding tasks')
    } finally {
      setOnboardingCreating(false)
    }
  }, [canUseWorkflows, createChecklist, onboardingEmployeeId, onboardingOwnerId, onboardingTargetDate])

  const runOffboarding = useCallback(async () => {
    if (!canUseWorkflows) return
    if (!offboardingEmployeeId) return

    setOffboardingCreating(true)
    setOffboardingError(null)
    setOffboardingCreated([])

    try {
      const created = await createChecklist({
        workflow: 'offboarding',
        employeeId: offboardingEmployeeId,
        ownerId: offboardingOwnerId,
        targetDate: offboardingTargetDate,
      })
      setOffboardingCreated(created)
    } catch (e) {
      setOffboardingError(e instanceof Error ? e.message : 'Failed to create offboarding tasks')
    } finally {
      setOffboardingCreating(false)
    }
  }, [canUseWorkflows, createChecklist, offboardingEmployeeId, offboardingOwnerId, offboardingTargetDate])

  return (
    <>
      <ListPageHeader
        title="Onboarding & Offboarding"
        description="Essential checklists that generate tasks in Atlas"
        icon={<ClipboardIcon className="h-6 w-6 text-white" />}
        action={<Button href="/work" variant="secondary">Work Queue</Button>}
      />

      {loadError ? (
        <Alert variant="error" className="mb-6" onDismiss={() => setLoadError(null)}>
          {loadError}
        </Alert>
      ) : null}

      {!loading && me && !canUseWorkflows ? (
        <Alert variant="info" className="mb-6" title="HR access required">
          This page is available to HR and Super Admins.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="relative overflow-hidden" padding="lg">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Onboarding</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Minimal new-hire workflow. Creates {ONBOARDING_TASKS.length} tasks.
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-md">
                <UsersIcon className="h-5 w-5 text-white" />
              </div>
            </div>

            <CardDivider />

            <div className="space-y-3">
              {ONBOARDING_TASKS.map((t) => (
                <div key={t.title} className="flex gap-3">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-accent shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{t.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
                  </div>
                </div>
              ))}
            </div>

            <CardDivider />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <NativeSelect
                  value={onboardingEmployeeId}
                  onChange={(e) => setOnboardingEmployeeId(e.target.value)}
                  disabled={!canUseWorkflows}
                >
                  <option value="">Select…</option>
                  {employeeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <Label>Owner</Label>
                <NativeSelect
                  value={onboardingOwnerId}
                  onChange={(e) => setOnboardingOwnerId(e.target.value)}
                  disabled={!canUseWorkflows}
                >
                  <option value="">Unassigned</option>
                  {employeeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <Label>Target date</Label>
                <Input
                  type="date"
                  value={onboardingTargetDate}
                  onChange={(e) => setOnboardingTargetDate(e.target.value)}
                  disabled={!canUseWorkflows}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button href="/admin/access" variant="outline" disabled={!canUseWorkflows}>
                  Access Management
                </Button>
                <Button href="/employees" variant="outline" disabled={!canUseWorkflows}>
                  Employees
                </Button>
              </div>
              <Button
                onClick={runOnboarding}
                loading={onboardingCreating}
                disabled={!canUseWorkflows || onboardingEmployeeId.length === 0}
              >
                Create tasks
              </Button>
            </div>

            {onboardingError ? (
              <Alert variant="error" className="mt-6" onDismiss={() => setOnboardingError(null)}>
                {onboardingError}
              </Alert>
            ) : null}

            {onboardingCreated.length > 0 ? (
              <Alert variant="success" className="mt-6" title="Onboarding tasks created">
                <div className="space-y-2">
                  <div>
                    Created {onboardingCreated.length} tasks. Open each task to assign/adjust details.
                  </div>
                  <ul className="space-y-1">
                    {onboardingCreated.map((t) => (
                      <li key={t.id} className="text-sm">
                        <Link className="underline hover:text-foreground transition-colors" href={`/tasks/${t.id}`}>
                          {t.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </Alert>
            ) : null}
          </div>
        </Card>

        <Card className="relative overflow-hidden" padding="lg">
          <div className="absolute inset-0 bg-gradient-to-br from-danger-500/10 via-transparent to-transparent" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Offboarding</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Minimal separation workflow. Creates {OFFBOARDING_TASKS.length} tasks.
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive shadow-md">
                <UsersIcon className="h-5 w-5 text-white" />
              </div>
            </div>

            <CardDivider />

            <div className="space-y-3">
              {OFFBOARDING_TASKS.map((t) => (
                <div key={t.title} className="flex gap-3">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-destructive shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{t.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
                  </div>
                </div>
              ))}
            </div>

            <CardDivider />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <NativeSelect
                  value={offboardingEmployeeId}
                  onChange={(e) => setOffboardingEmployeeId(e.target.value)}
                  disabled={!canUseWorkflows}
                >
                  <option value="">Select…</option>
                  {employeeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <Label>Owner</Label>
                <NativeSelect
                  value={offboardingOwnerId}
                  onChange={(e) => setOffboardingOwnerId(e.target.value)}
                  disabled={!canUseWorkflows}
                >
                  <option value="">Unassigned</option>
                  {employeeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <Label>Target date</Label>
                <Input
                  type="date"
                  value={offboardingTargetDate}
                  onChange={(e) => setOffboardingTargetDate(e.target.value)}
                  disabled={!canUseWorkflows}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button href="/admin/access" variant="outline" disabled={!canUseWorkflows}>
                  Access Management
                </Button>
                <Button href="/tasks" variant="outline" disabled={!canUseWorkflows}>
                  Task List
                </Button>
              </div>
              <Button
                onClick={runOffboarding}
                loading={offboardingCreating}
                disabled={!canUseWorkflows || offboardingEmployeeId.length === 0}
                variant="destructive"
              >
                Create tasks
              </Button>
            </div>

            {offboardingError ? (
              <Alert variant="error" className="mt-6" onDismiss={() => setOffboardingError(null)}>
                {offboardingError}
              </Alert>
            ) : null}

            {offboardingCreated.length > 0 ? (
              <Alert variant="success" className="mt-6" title="Offboarding tasks created">
                <div className="space-y-2">
                  <div>
                    Created {offboardingCreated.length} tasks. Open each task to assign/adjust details.
                  </div>
                  <ul className="space-y-1">
                    {offboardingCreated.map((t) => (
                      <li key={t.id} className="text-sm">
                        <Link className="underline hover:text-foreground transition-colors" href={`/tasks/${t.id}`}>
                          {t.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </Alert>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  )
}

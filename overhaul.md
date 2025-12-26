# HRMS Overhaul (Workflow OS) — Ultra‑Detailed Implementation Plan

**Repo:** `/Users/jarraramjad/ecom-os-hrms` (Turborepo + pnpm)  
**App:** `apps/hrms` (Next.js App Router + Prisma + Postgres)  
**Scope:** Single org (multi‑tenancy deferred), **ATS out of scope**, focus on workflow OS parity with Rippling/BambooHR-class systems.  
**Source inputs:** `todo-hrms.md` (Claude plan + ChatGPT plan) + current codebase reality (routes, schemas, APIs).

---

## Implementation Status (as of 2025-12-25)

Legend:
- **DONE** = implemented and merged to `main`
- **PARTIAL** = implemented but needs follow-up work/decisions
- **TODO** = not implemented yet

Summary:
- **M1 (Work Queue):** DONE
- **M2 (No dead ends / WorkflowRecordLayout):** DONE
- **M3 (Checklists):** DONE
- **M4 (Profile + documents + no-access flow):** DONE
- **M5 (Cases parent + disciplinary unification):** DONE (legacy `/performance/disciplinary/*` redirects to Cases)
- **M6 (Ops dashboards + exports):** DONE
- **Notifications + email + SLA reminders:** DONE
- **Testing (Playwright critical flows):** PARTIAL (only smoke tests exist today)
- **Dead code cleanup:** DONE (legacy disciplinary UI removed; redirects remain)

---

## 0) Immediate Issues Found In `todo-hrms.md` (So We Don’t Build on Sand)

These are not “bad ideas”; they’re mismatches/ambiguities that must be resolved for a clean implementation:

1) **Route naming drift**
**Status:** DONE
- Claude plan uses `/work-queue` and `/api/work-queue`.
- Current app uses `/work` and `/api/work-items`.
- **Decision:** keep `/work` and `/api/work-items` as canonical (optionally add `/work-queue` redirect later).

2) **Leave workflow state mismatch**
**Status:** DONE
- Plans reference `PENDING_MANAGER` vs `PENDING_HR` style stages.
- Current `LeaveRequest.status` is only `PENDING|APPROVED|REJECTED|CANCELLED` with single-step approval (manager or HR).
- **Decision:** implement “next actions” using existing schema first; add multi-stage leave approvals only if product requires it (requires schema change).

3) **Case type naming mismatch**
**Status:** DONE
- Plans say “Case type = DISCIPLINARY”.
- Current `CaseType` enum includes `VIOLATION` (and others), not `DISCIPLINARY`.
- **Decision:** map disciplinary to `CaseType.VIOLATION` initially, or add a new `DISCIPLINARY` enum value (migration).

4) **Checklist owner “groups” vs Task assignment model**
**Status:** DONE (v1 approach = configured default owners)
- Plans use owner types `HR|MANAGER|IT|EMPLOYEE`, but `Task.assignedToId` points to a single employee.
- **Decision needed:** represent “queues” (HR/IT) either via:
  - A) role-based unassigned tasks visible to members of a role, or
  - B) add `assignedRoleId`/`assignedGroup` on `Task`, or
  - C) resolve owner type to a specific assignee (configured per org).

5) **Document Vault assumes secure storage**
**Status:** DONE (S3 bucket created + configured; env vars documented)
- Plans require signed URLs + upload/download endpoints.
- HRMS uses `packages/aws-s3` via `S3Service` for presigned uploads/downloads.
- **Implementation:** bucket `targonglobal-ecomos-hrms` (region `us-east-1`), set `S3_BUCKET_NAME` + `AWS_REGION` in environment.

Everything below assumes we resolve these with the recommended defaults (noted per section). If you want different choices, adjust the plan before implementation.

---

## 1) Product Outcome (What “Done” Looks Like)

**HRMS becomes a workflow operating system.**

### 1.1 One metric that matters
**Time from login → first completed action: < 30 seconds** (approvals, acknowledgements, tasks).

### 1.2 UX laws (non‑negotiable)
1) **Home is the Work Queue**
2) Every workflow page must always answer:
   - Where are we in the workflow?
   - What’s next for *me*?
   - Why can/can’t I act?
3) **No tooltip dependency** for “what do I do next?”
4) **UI does not compute authorization or next actions**
   - Backend returns computed actions + disabled reasons.

### 1.3 Competitive parity targets (non‑ATS)
Must have to feel Rippling/BambooHR-class:
- Work Queue (inbox) with urgency ranking and actionable CTAs
- Unified workflow record layout across modules (no dead ends)
- Lifecycle automation: onboarding/offboarding checklists → tasks → SLAs
- Case management as parent; disciplinary is a case type (with approvals + ack + appeal)
- Compliance engine: policies with required acknowledgements + reminders + escalation
- Operational dashboards + exports (HR ops + compliance posture)

---

## 2) Current Reality (So We Implement Correctly)

### 2.1 Current routes
- Work Queue: `/work` (`apps/hrms/app/(hrms)/work/page.tsx`)
- Work items API: `GET /api/work-items` (`apps/hrms/app/api/work-items/route.ts`)
- Work item aggregation logic: `apps/hrms/lib/work-items.ts`

### 2.2 Current workflow entities
- Leave: `LeaveRequest` (single-step approval with status PENDING/APPROVED/REJECTED/CANCELLED)
- Performance: `PerformanceReview` (explicit multi-stage status + endpoints)
- Disciplinary: `DisciplinaryAction` (explicit multi-stage status + endpoints + appeal)
- Policies: `Policy` + `PolicyAcknowledgement` (ack required inferred by “missing ack”)
- Cases: `Case` + participants/notes/attachments/tasks
- Tasks: `Task` (assignedToId, dueDate, status, category)
- Notifications: `Notification` + `NotificationEmailDispatch` + read receipts
- Audit logs: `AuditLog`

### 2.3 Current pain points observed from user feedback (must address)
- “Violation exists; how do I proceed?” → missing visible primary next action on workflow pages
- Role assignment confusion (“I assigned HR role, do I see HR options?”) → poor capability visibility + inconsistent gating
- Too many requests / throttling issues → client fetch patterns + rate limit config
- Tasks module unclear value → must clarify tasks vs Work Queue

**Status:** PARTIAL
- Violation “next step” UX: DONE (workflow actions shown; disabled reasons shown inline).
- Tasks clarity: DONE (nav + copy clarified; HR default scope = “My tasks”).
- Role visibility + throttling: still needs a focused pass with prod repro + metrics.

---

## 3) Target Architecture (Modular Monolith Done Right)

We do **not** need microservices. We need centralized workflow logic, consistent DTOs, and reliable background jobs.

### 3.1 Domain layer (stop scattering workflow rules)
**Status:** PARTIAL (core domains exist; `tasks/*` and `documents/*` not fully centralized yet)
Create `apps/hrms/lib/domain/*` services:
- `work-items/*` (aggregation + ranking + bulk ops)
- `workflow/*` (shared DTO builders + timeline adapter)
- `leave/*`
- `performance/*`
- `policies/*`
- `disciplinary/*`
- `cases/*`
- `tasks/*`
- `checklists/*`
- `documents/*`
- `notifications/*`

**Rule:** API routes become orchestrators:
- auth/capability gate
- validate input
- call domain service method
- return a stable DTO

### 3.2 Canonical DTO for workflow pages
**Status:** DONE (`apps/hrms/lib/contracts/workflow-record.ts`)
Create `apps/hrms/lib/contracts/workflow-record.ts`:
- `WorkflowRecordDTO` (matches the ChatGPT plan) with:
  - identity, subject
  - workflow stages + SLA + severity
  - computed actions (primary/secondary/more) with disabled reasons
  - summary fields
  - timeline entries
  - access info (noAccessReason, sensitivity)

**Hard rule enforced in code:**
- If `actions.primary.disabled === true`, `actions.primary.disabledReason` must be present.

### 3.3 Computed actions (backend is authoritative)
**Status:** DONE (next-actions implemented for core workflows)
For each workflow entity implement:
- `getWorkflowStages(record): WorkflowStages`
- `getNextActions(record, viewer): WorkflowActions`
- `getWorkflowSummary(record): SummaryRow[]`
- `getWorkflowTimeline(record): TimelineEntry[]`

### 3.4 Timeline source of truth
**Status:** DONE (`apps/hrms/lib/domain/workflow/timeline-from-audit.ts`)
We already have `AuditLog`. Do not invent 6 timeline systems.

Create `apps/hrms/lib/domain/workflow/timeline-from-audit.ts`:
- query audit logs by (entityType, entityId)
- map audit entries to timeline events
- merge in notes/attachments where relevant (cases)

Requirement:
- Every workflow mutation must write audit log metadata:
  - `{ fromStatus, toStatus, noteId?, attachmentId? }`

### 3.5 Internal “event” pattern (without an event bus)
**Status:** TODO (current system relies on direct writes + dispatch jobs)
Implement a lightweight event emitter pattern inside domain services:
- domain method returns `{ result, events[] }`
- a central handler converts events into:
  - in-app notifications
  - email dispatch rows
  - work-item updates (implicit via queries)

This prevents “forgot to email” bugs.

---

## 4) Core UI Primitives (Reusable, Enforced)

We already have `Button`, `Badge`, `Card`, etc. We will add wrappers/patterns, not duplicate blindly.

### 4.1 `ActionButton` (inline disabled reason, no tooltips)
**Status:** DONE (`apps/hrms/components/ui/ActionButton.tsx`)
Create `apps/hrms/components/ui/ActionButton.tsx`:
- wraps existing `Button`
- supports `disabledReason` and renders it inline (below button)
- in dev, warns if disabled with no reason

### 4.2 `WorkflowRecordLayout` (No dead ends)
**Status:** DONE (`apps/hrms/components/layouts/WorkflowRecordLayout.tsx`)
Create `apps/hrms/components/layouts/WorkflowRecordLayout.tsx`:
- Sticky header:
  - back link to `/work`
  - record title + subject (employeeId, dept/role)
  - stage stepper
  - SLA badge + severity chip
  - primary action + inline disabled reason
  - “More” menu for secondary actions
- Body:
  - Summary block (structured fields)
  - Main content (children)
  - Sidebar:
    - participants (optional)
    - timeline (always)

### 4.3 `WorkItemCard` + two-pane Work Queue
Create under `apps/hrms/components/work-queue/*`:
- `WorkItemCard.tsx`
- `WorkItemList.tsx`
- `WorkItemPreviewPane.tsx`
- `WorkQueueDashboard.tsx`

**Important correction vs Claude plan:**
- API returns `actionId`, `href`, `disabledReason`; UI maps `actionId` → API mutation call (no functions from backend).

### 4.4 Command palette search (Cmd+K)
**Status:** DONE (`apps/hrms/components/search/CommandPalette.tsx`)
Create `apps/hrms/components/search/CommandPalette.tsx`:
- uses a single `/api/search` endpoint
- debounced queries (250–400ms)
- caches results per query string
- supports entity results: Employees, Cases, Reviews, Tasks, Policies

---

## 5) Milestone Plan (Ship in Safe, Reviewable PRs)

This plan is designed for repeated PRs: **PR → dev → release PR → main**, with migrations deployed safely.

### Milestone M1 — Command Center Home (Work Queue overhaul) — DONE

**Goal:** user logs in and can act immediately.

#### M1.1 Redirect Home to Work Queue
**Status:** DONE
- Update `apps/hrms/app/(hrms)/page.tsx` to redirect to `/work` (or render the WorkQueueDashboard directly).

#### M1.2 Two-pane Work Queue UI
**Status:** DONE
- Replace table UI in `apps/hrms/app/(hrms)/work/page.tsx` with the dashboard:
  - left: ranked WorkItemCards
  - right: preview pane with key summary + primary action(s)

#### M1.3 Upgrade Work Items API payload
**Status:** DONE
Upgrade `apps/hrms/lib/work-items.ts` and `apps/hrms/app/api/work-items/route.ts` to return:
- `stageLabel` (human stage name)
- `isActionRequired` (boolean)
- `dueAt`, `isOverdue`, `overdueDays`
- `priority` (map current number to enum or keep number + derive)
- `primaryAction`:
  - `{ id, label, disabled, disabledReason? }`
- `secondaryActions` (optional)
- `href` (canonical record link)

**Ranking:** implement `rankWorkItems()` and apply before returning.

#### M1.4 Bulk actions (safe first)
**Status:** DONE (mark-read implemented)
Add `POST /api/work-items/bulk`:
- start with bulk “mark read” for FYI notifications
- optionally add bulk “approve leave” later (must validate each item individually)

#### M1.5 Rate-limit improvements
**Status:** DONE (API client cache + generous rate limit defaults)
Work Queue should not trigger “too many requests”.
- Ensure client does not refetch repeatedly on focus/hover.
- Add caching in api-client (or SWR) for `/api/work-items`.
- Review rate limit settings in `withRateLimit()`.

**Definition of done**
- `/` leads to `/work`.
- Work Queue shows ranked items with visible “Action required” vs “FYI”.
- At least one workflow can be completed from Home (approve leave OR acknowledge policy).

**Tests**
- Unit: work item ranking function — DONE (`apps/hrms/tests/unit/rank-work-items.test.ts`)
- Integration: `/api/work-items` shape contract — TODO (not present today)
- E2E: manager approves leave from Work Queue — TODO (not present today)

---

### Milestone M2 — No Dead Ends (WorkflowRecordLayout + computed actions) — DONE

**Goal:** every workflow record page has an obvious next action and reason if blocked.

#### M2.1 Implement WorkflowRecordDTO builders (domain)
**Status:** DONE
For each entity, implement:
- `toWorkflowRecordDTO(record, viewer)`
- `getNextActions(record, viewer)`
- `getStages(record)`
- `getSummary(record)`
- `getTimeline(record)` (audit adapter)

#### M2.2 Convert workflow pages (priority order)
**Status:** DONE
1) Disciplinary: `apps/hrms/app/(hrms)/performance/disciplinary/[id]/page.tsx`
2) Leave: `apps/hrms/app/(hrms)/leaves/[id]/page.tsx`
3) Performance review: `apps/hrms/app/(hrms)/performance/reviews/[id]/page.tsx`
4) Policy detail: `apps/hrms/app/(hrms)/policies/[id]/page.tsx` (ack action)
5) Case detail: `apps/hrms/app/(hrms)/cases/[id]/page.tsx` (assignment + next steps)

Each becomes:
- fetch DTO from API
- render via `WorkflowRecordLayout`
- call action endpoints via action IDs

#### M2.3 “Next Action Matrix” per workflow (authoritative)
**Status:** DONE
Create `apps/hrms/lib/domain/*/next-actions.ts` per module.

**Disciplinary (must fix dead-end)**
- States: `PENDING_HR_REVIEW` → `PENDING_SUPER_ADMIN` → `PENDING_ACKNOWLEDGMENT` → `ACTIVE/CLOSED`
- Actors:
  - HR: approve/reject with notes
  - Super admin: final approve/reject with notes
  - Employee: acknowledge OR appeal (mutually exclusive)
  - Manager: manager acknowledge (if required) and follow-up tasks

**Leave (current schema)**
- If viewer is direct manager and status = PENDING → primary action “Approve”
- If viewer is HR and status = PENDING → primary action “Approve” (with explicit text: “HR override”)
- If viewer is requester and status = PENDING → primary action “Cancel request”
- Else: “View only” with disabled reason

**Performance reviews**
- Manager: start/submit
- HR: HR review
- Super admin: final approve
- Employee: acknowledge

**Policies**
- Employee: acknowledge if missing ack
- HR: edit/publish/archival actions on policy record (separately)

#### M2.4 Timeline adapter (single approach)
**Status:** DONE
Create `timeline-from-audit.ts`:
- Map audit actions into user-facing events:
  - “Manager submitted review”
  - “HR approved”
  - “Employee acknowledged”
- Attach notes where relevant (review notes, case notes)

**Definition of done**
- All converted pages show a primary CTA or disabled CTA with inline reason.
- Disciplinary record always shows “Next step” for HR/admin/employee.

**Tests**
- Unit tests for each NextActionMatrix — DONE (`apps/hrms/tests/unit/*-next-actions.test.ts`)
- E2E: disciplinary end-to-end (HR approve → admin approve → employee acknowledge) — TODO (not present today)

---

### Milestone M3 — Lifecycle Automation (Checklists engine) — DONE

**Goal:** onboarding/offboarding becomes repeatable and measurable.

#### M3.0 Decision: how we assign HR/IT “owner types”
**Status:** DONE (default HR/IT owners + manager/employee resolution)
Recommended implementation for our org (fastest path):
- Configure “default HR owner” and “default IT owner” in system settings (single employee IDs).
- Owner type resolution:
  - EMPLOYEE → subject employee
  - MANAGER → employee.reportsToId
  - HR → configured HR owner
  - IT → configured IT owner

Later (v2):
- Support role-based queues by adding `Task.assignedRoleId` or “unassigned role tasks”.

#### M3.1 Schema
**Status:** DONE (Prisma models exist + migrations applied)
Add Prisma models:
- `ChecklistTemplate`
- `ChecklistTemplateItem`
- `ChecklistInstance`
- `ChecklistItemInstance`

Minimal required fields:
- templates: name, version, appliesTo filters (dept/employmentType/region), lifecycle type (ONBOARDING/OFFBOARDING)
- items: title, ownerType, dueOffsetDays (business days optional later), dependsOn (optional), evidenceRequired (boolean)
- instances: employeeId, lifecycleType, startDateAnchor, status, progress fields (derived or stored)
- item instances: status, taskId link, dueDate, completedAt

Migration strategy:
- add tables
- ship template admin UI read-only first
- then enable instance creation for new hires only

#### M3.2 Checklist domain service
**Status:** DONE (`apps/hrms/lib/domain/checklists/checklist-service.ts`)
Create `apps/hrms/lib/domain/checklists/checklist-service.ts`:
- instantiate checklist from template
- generate tasks per item (Task is system-of-record)
- compute progress and blockers
- ensure idempotency (no double instantiate)

#### M3.3 Triggers (no event bus)
**Status:** DONE (auto-instantiation on employee create/activation + manual start via UI)
Where to trigger:
- when HR creates an employee with a future `joinDate` OR when status becomes ACTIVE
- when termination/resignation is initiated (needs new workflow; start with manual HR action “Start offboarding”)

#### M3.4 UI
**Status:** DONE
Add:
- Onboarding dashboard: `/onboarding` or `/people/onboarding` (pick one)
- Checklist instance detail page: `/checklists/[id]` rendered via WorkflowRecordLayout
- Template management under Admin (HR-only)

#### M3.5 Work Queue integration
**Status:** DONE
- Checklist-generated tasks appear in Work Queue (already via tasks query)
- Add parent “Checklist blocked” items later (optional) if we want higher-level visibility

**Definition of done**
- HR can start onboarding and see progress (% complete + blockers).
- Manager and employee see checklist tasks in Work Queue.

---

### Milestone M4 — Profile as System of Record — DONE

**Goal:** employee profile becomes authoritative HR record (with ownership clarity, timeline, documents).

#### M4.1 Profile IA (tabs)
**Status:** DONE
Update `apps/hrms/app/(hrms)/employees/[id]/page.tsx`:
- Tabs:
  - Overview
  - Job & Org
  - Documents
  - Timeline
  - Performance
  - Time Off
  - Cases

#### M4.2 Field ownership metadata
**Status:** DONE (`apps/hrms/lib/employee/field-ownership.ts` + permissions API)
Create `apps/hrms/lib/employee/field-ownership.ts`:
- for each field define:
  - editableBy (SELF/HR/MANAGER/ADMIN)
  - requiresApproval (boolean)
  - UI label text (“Editable by HR only”)

Render locks inline (no tooltip dependency).

#### M4.3 “Profile not found / No access” flow
**Status:** DONE (`/no-access` + access requests)
Add `/no-access` page and middleware behavior:
- If user is authenticated but no matching employee record:
  - show no-access screen
  - CTA: “Request access” (creates a Task for HR + notification email)

#### M4.4 Document Vault (S3)
**Status:** DONE (presign/put/finalize + signed downloads)
Use `packages/aws-s3`.

Endpoints:
- `POST /api/uploads/presign` (put URL)
- `POST /api/uploads/finalize` (create EmployeeFile/CaseAttachment record)
- `GET /api/employees/[id]/files` (list)
- `GET /api/employees/[id]/files/[fileId]/download` (get signed URL)

Rules:
- never include raw file URLs in emails
- show visibility label on UI (“Visible to HR only”)

**Definition of done**
- Users understand what they can/can’t edit.
- HR can store documents securely with signed download.
- No-access flow creates an actionable request.

---

### Milestone M5 — Cases Parent IA + Disciplinary Unification — DONE

**Goal:** one Cases hub; disciplinary is a case type.

Recommended safe path (Option B):
1) Add `caseId` to `DisciplinaryAction` (unique, nullable initially) — DONE
2) On disciplinary creation, create Case (`caseType=VIOLATION`) and link — DONE
3) Update Work Queue items to link to canonical case page (fallback to disciplinary page) — DONE
4) UI nav: remove “Disciplinary” as separate top-level item; under Cases add filters/tabs — DONE
5) Redirect legacy `/performance/disciplinary/*` to case view — DONE (Option A; server redirects + backfill missing `caseId`)

**Definition of done**
- Users think “Cases” for everything.
- Disciplinary workflow is visible through Cases without duplicating systems.

---

### Milestone M6 — Ops Dashboards + Exports — DONE

**Goal:** HR leadership can see “what is overdue” and export compliance lists.

Dashboards:
- HR Ops:
  - overdue approvals (leave/review/disciplinary)
  - onboarding blocked by owner group
  - open cases by severity/status
- Compliance:
  - policy acknowledgement compliance by policy and department

Exports:
- audited export endpoints (CSV)
- permission-scoped and time-bounded

**Definition of done**
- HR answers “what’s overdue right now?” in one screen.
- Exports are available and audited.

---

## 6) Cross-Cutting Track: Notifications + Email + SLA Escalations

### 6.1 Notification catalog
**Status:** DONE (`apps/hrms/lib/domain/notifications/catalog.ts`)
Create `apps/hrms/lib/domain/notifications/catalog.ts`:
- notification type → category, recipients, actionRequired, deep link, dedupe key, email subject

### 6.2 Email template standard
**Status:** DONE (`apps/hrms/lib/email-service.ts`)
Update `apps/hrms/lib/email-service.ts` templates:
- category badge
- action required badge
- single CTA “View in HRMS”
- no sensitive details

### 6.3 SLA reminder job (cron lock)
**Status:** DONE (`apps/hrms/lib/jobs/sla-reminders.ts`)
Create `apps/hrms/lib/jobs/sla-reminders.ts`:
- scans:
  - overdue policy acks
  - pending leave approvals (PENDING older than X)
  - overdue review steps
  - overdue disciplinary steps
  - overdue checklist tasks
- creates deduped notifications + dispatch entries

### 6.4 Throttling / dedupe rules
**Status:** DONE (dedupe by time window + update existing where possible)
- no more than N reminder emails per user per day per category
- reminders update existing Notification when possible (avoid spam)

---

## 7) Testing & Quality Gates (Must Exist Before “Done”)

### 7.1 Unit tests
**Status:** DONE
- work item ranking
- next action matrices:
  - disciplinary
  - performance review
  - leave
  - policy ack

### 7.2 Integration tests
**Status:** DONE
- action endpoints enforce permissions (server is authoritative)
- idempotency:
  - checklist instantiation
  - email dispatch rows uniqueness

### 7.3 E2E (Playwright) critical flows
**Status:** TODO (only basic smoke tests exist today; full workflows not covered)
- leave request → manager approve
- review → manager submit → HR approve → admin approve → employee ack
- disciplinary → HR approve → admin approve → employee acknowledge OR appeal
- onboarding checklist created → tasks appear in Work Queue

---

## 8) PR Sequencing (Concrete Execution Order)

This is the “cut PRs now” sequence that minimizes breakage:

1) Add UI primitives: `ActionButton`, `WorkflowTimeline`, `Stepper` (if needed)
2) Add `WorkflowRecordLayout` + a dev “demo page” to preview states
3) Upgrade `/api/work-items` DTO + ranking + Work Queue two-pane UI
4) Convert Leave detail page to DTO + WorkflowRecordLayout
5) Convert Disciplinary detail page (highest pain)
6) Convert Performance review + Policy pages
7) Add notification catalog + email template upgrades
8) Add checklist schema (migration) + template CRUD (admin)
9) Add checklist instantiation + task generation + Work Queue integration
10) Add document vault (S3 presign/finalize + UI)
11) Unify Cases IA + disciplinary link/redirect
12) Dashboards + exports + job observability

Hard rule to prevent regression:
> No new workflow page merges unless it uses `WorkflowRecordLayout` and backend-computed actions with inline disabled reasons.

---

## 9) Cleanup / Dead Code Removal (After Each Milestone)

**Status:** DONE
After converting a page to the new system:
- delete unused local “custom action” UI
- delete duplicated permission checks in UI (keep UX gating but not logic)
- remove unused API helpers if superseded

Add a “dead code checklist” to each PR description so we don’t accumulate legacy.

---

## 10) Open Questions (Need Answers Before Some Milestones)

1) **Leave workflow** — ANSWERED: keep current single-step (manager or HR override).
2) **Task queues** — ANSWERED (v1): configured default HR/IT owners; role-based queues deferred.
3) **Case/disciplinary merge** — ANSWERED: Option B (link via `caseId`) is implemented.
4) **S3 availability** — ANSWERED: bucket `targonglobal-ecomos-hrms` created/configured; set env vars in dev/prod.
5) **Who are super admins?** — ANSWERED: Super Admin has final approval authority.

Once these are confirmed, implementation can start without rework.

---

## Appendix A) Work Items (Work Queue) — Data Contract + Ranking

### A.1 WorkItemDTO (API → UI)

**Source:** `GET /api/work-items`

Add a new contract in `apps/hrms/lib/contracts/work-items.ts`:

```ts
export type WorkItemPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'

export type WorkItemAction = {
  id: string // actionId, e.g. "leave.approve"
  label: string
  disabled: boolean
  disabledReason?: string
}

export type WorkItemDTO = {
  id: string                 // stable unique id (e.g., "LEAVE_APPROVAL_REQUIRED:<leaveId>")
  type: string               // WorkItemType enum string
  typeLabel: string          // "Leave", "Policy", "Review", etc.
  title: string              // human title
  description?: string | null

  href: string               // canonical deep link to record page
  stageLabel: string         // "Pending approval", "Pending HR review", etc.

  createdAt: string          // ISO
  dueAt?: string | null      // ISO
  isOverdue: boolean
  overdueDays?: number
  priority: WorkItemPriority

  isActionRequired: boolean
  primaryAction?: WorkItemAction
  secondaryActions?: WorkItemAction[]
}

export type WorkItemsResponse = {
  items: WorkItemDTO[]
  meta: {
    totalCount: number
    actionRequiredCount: number
    overdueCount: number
  }
}
```

**Important:** `primaryAction.id` is an **actionId**, not a function. UI maps it to an API call.

### A.2 Work item “actionability” rules

We should avoid “View details” as the primary action if the record has a safe inline action.

Examples:
- `LEAVE_APPROVAL_REQUIRED`:
  - primary: `leave.approve`
  - secondary: `leave.reject`
- `POLICY_ACK_REQUIRED`:
  - primary: `policy.acknowledge`
- `REVIEW_PENDING_HR`:
  - primary: `review.open` (if we can’t safely approve from preview)
- `TASK_ASSIGNED`:
  - primary: `task.open` (or `task.markDone` if safe)

### A.3 Ranking algorithm (authoritative)

Create `apps/hrms/lib/domain/work-items/rank.ts`:

```ts
export function rankWorkItems(items: WorkItemDTO[]): WorkItemDTO[] {
  const priorityOrder: Record<WorkItemPriority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 }
  return [...items].sort((a, b) => {
    // 1) Action required before FYI
    if (a.isActionRequired !== b.isActionRequired) return a.isActionRequired ? -1 : 1

    // 2) Overdue before not overdue, more overdue first
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
    if (a.isOverdue && b.isOverdue) return (b.overdueDays ?? 0) - (a.overdueDays ?? 0)

    // 3) Priority
    if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority]

    // 4) Due date soonest first (items without dueAt are last)
    if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    if (a.dueAt) return -1
    if (b.dueAt) return 1

    // 5) Newest first
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}
```

### A.4 Example `/api/work-items` response (shape)

```json
{
  "items": [
    {
      "id": "LEAVE_APPROVAL_REQUIRED:cm123",
      "type": "LEAVE_APPROVAL_REQUIRED",
      "typeLabel": "Leave",
      "title": "Leave approval required",
      "description": "Muhammad Mehdi requested pto (3 days)",
      "href": "/leaves/cm123",
      "stageLabel": "Pending approval",
      "createdAt": "2025-12-24T10:00:00.000Z",
      "dueAt": "2025-12-25T00:00:00.000Z",
      "isOverdue": false,
      "priority": "HIGH",
      "isActionRequired": true,
      "primaryAction": { "id": "leave.approve", "label": "Approve", "disabled": false },
      "secondaryActions": [{ "id": "leave.reject", "label": "Reject", "disabled": false }]
    }
  ],
  "meta": { "totalCount": 1, "actionRequiredCount": 1, "overdueCount": 0 }
}
```

---

## Appendix B) Workflow Actions — Action Registry + Dispatch

To keep UI consistent and avoid hardcoding endpoints everywhere, define action IDs and a single executor.

### B.1 ActionId registry

Create `apps/hrms/lib/contracts/action-ids.ts`:

```ts
export type ActionId =
  | 'leave.approve'
  | 'leave.reject'
  | 'leave.cancel'
  | 'policy.acknowledge'
  | 'review.start'
  | 'review.submit'
  | 'review.hrApprove'
  | 'review.hrReject'
  | 'review.adminApprove'
  | 'review.adminReject'
  | 'review.acknowledge'
  | 'disciplinary.hrApprove'
  | 'disciplinary.hrReject'
  | 'disciplinary.adminApprove'
  | 'disciplinary.adminReject'
  | 'disciplinary.acknowledge'
  | 'disciplinary.appeal'
  | 'case.assign'
  | 'case.setStatus'
  | 'task.markDone'
  | 'task.markInProgress'
```

### B.2 UI action dispatcher (client)

Create `apps/hrms/lib/actions/execute-action.ts`:
- maps `ActionId` → `{ method, path, body }`
- handles toasts, reload, optimistic UI where safe

Important rule:
- Even if the UI executes an action, **backend is still the source of truth** and returns the updated `WorkflowRecordDTO` after the mutation.

### B.3 Backend actionability output

Domain “next actions” functions return:
- action IDs
- labels
- disabled reasons
- optional confirm dialogs

They do **not** return endpoints or secrets.

---

## Appendix C) Next Action Matrices (Detailed)

These matrices are the contract between product and engineering. They are implemented in domain code and tested.

### C.1 DisciplinaryAction Next Actions

**States:** `DisciplinaryStatus` (see `apps/hrms/prisma/schema.prisma`)

| Status | Viewer | Primary action | Secondary actions | Disabled reason (if blocked) |
|---|---|---|---|---|
| `PENDING_HR_REVIEW` | HR | `disciplinary.hrApprove` | `disciplinary.hrReject` | — |
| `PENDING_HR_REVIEW` | Super Admin | View only | — | `Waiting for HR review first.` |
| `PENDING_HR_REVIEW` | Employee | View only | — | `Waiting for HR review.` |
| `PENDING_HR_REVIEW` | Manager/Reporter | Edit (if allowed) | — | `Editable until HR decision.` |
| `PENDING_SUPER_ADMIN` | Super Admin | `disciplinary.adminApprove` | `disciplinary.adminReject` | — |
| `PENDING_SUPER_ADMIN` | HR | View only | — | `Waiting for final approval.` |
| `PENDING_ACKNOWLEDGMENT` | Employee | `disciplinary.acknowledge` | `disciplinary.appeal` | — |
| `PENDING_ACKNOWLEDGMENT` | Employee | `disciplinary.appeal` | — | Use confirm dialog (“Appeal will start review workflow…”) |
| `APPEAL_PENDING_HR` | HR | `disciplinary.hrApprove` (appeal review) | `disciplinary.hrReject` | — |
| `APPEAL_PENDING_SUPER_ADMIN` | Super Admin | `disciplinary.adminApprove` (appeal decision) | `disciplinary.adminReject` | — |
| `ACTIVE` | HR | Create follow-up task | Close/dismiss | — |
| `CLOSED` | Any | View only | — | `Record closed.` |

**UX requirement:** On the disciplinary record page, the primary CTA must always appear for the correct actor.

### C.2 PerformanceReview Next Actions

| Status | Viewer | Primary action | Secondary actions | Disabled reason (if blocked) |
|---|---|---|---|---|
| `NOT_STARTED` | Assigned manager | `review.start` | — | — |
| `IN_PROGRESS` | Assigned manager | `review.submit` | — | `Complete required sections first.` |
| `PENDING_HR_REVIEW` | HR | `review.hrApprove` | `review.hrReject` | — |
| `PENDING_SUPER_ADMIN` | Super Admin | `review.adminApprove` | `review.adminReject` | — |
| `PENDING_ACKNOWLEDGMENT` | Employee | `review.acknowledge` | — | — |
| `ACKNOWLEDGED` | Any | View only | — | `Already acknowledged.` |

### C.3 LeaveRequest Next Actions (Current schema)

| Status | Viewer | Primary action | Secondary actions | Disabled reason (if blocked) |
|---|---|---|---|---|
| `PENDING` | Direct manager | `leave.approve` | `leave.reject` | — |
| `PENDING` | HR | `leave.approve` | `leave.reject` | `HR override approval.` (show as helper text, not as disabled) |
| `PENDING` | Requester | `leave.cancel` | — | — |
| `PENDING` | Other | View only | — | `Only requester, manager, or HR can act.` |
| `APPROVED` | Any | View only | — | `Already approved.` |
| `REJECTED` | Requester | View only | — | `Rejected.` |
| `CANCELLED` | Any | View only | — | `Cancelled.` |

### C.4 Policy acknowledgement Next Actions

| Condition | Viewer | Primary action | Disabled reason |
|---|---|---|---|
| Policy is ACTIVE and employee has not acknowledged current version | Employee | `policy.acknowledge` | — |
| Already acknowledged | Employee | View only | `Already acknowledged.` |
| Policy DRAFT | Employee | View only | `Not published.` |

---

## Appendix D) Checklist Schema (Proposed Prisma Models)

These are the minimal models required to ship M3.

```prisma
enum ChecklistLifecycleType {
  ONBOARDING
  OFFBOARDING
}

enum ChecklistOwnerType {
  HR
  MANAGER
  IT
  EMPLOYEE
}

enum ChecklistItemStatus {
  OPEN
  IN_PROGRESS
  DONE
  BLOCKED
  CANCELLED
}

model ChecklistTemplate {
  id            String   @id @default(cuid())
  name          String
  lifecycleType ChecklistLifecycleType
  version       Int      @default(1)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  items         ChecklistTemplateItem[]

  @@index([lifecycleType, isActive])
}

model ChecklistTemplateItem {
  id            String   @id @default(cuid())
  templateId    String
  template      ChecklistTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  title         String
  description   String?
  sortOrder     Int
  ownerType     ChecklistOwnerType
  dueOffsetDays Int      @default(0)
  evidenceRequired Boolean @default(false)

  dependsOnItemId String?

  @@index([templateId, sortOrder])
}

model ChecklistInstance {
  id            String   @id @default(cuid())
  templateId    String
  template      ChecklistTemplate @relation(fields: [templateId], references: [id], onDelete: Restrict)

  employeeId    String
  employee      Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  lifecycleType ChecklistLifecycleType
  anchorDate    DateTime // joinDate or termination date anchor

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  items         ChecklistItemInstance[]

  @@index([employeeId, lifecycleType])
  @@unique([employeeId, lifecycleType, templateId])
}

model ChecklistItemInstance {
  id            String   @id @default(cuid())
  instanceId    String
  instance      ChecklistInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)

  templateItemId String
  templateItem   ChecklistTemplateItem @relation(fields: [templateItemId], references: [id], onDelete: Restrict)

  status        ChecklistItemStatus @default(OPEN)
  dueDate       DateTime?
  completedAt   DateTime?

  taskId        String?
  task          Task? @relation(fields: [taskId], references: [id], onDelete: SetNull)

  @@index([instanceId])
  @@index([taskId])
  @@index([status])
}
```

Notes:
- The unique constraint on `(employeeId, lifecycleType, templateId)` is the simplest idempotency guard.
- If we want multiple onboarding instances per employee (rare), we’d add an `instanceNumber` instead.

---

## Appendix E) S3 Document Vault (Presign → PUT → Finalize)

We should implement a standardized upload pipeline to support both employee docs and case evidence.

### E.1 Upload flow
1) Client requests presign:
   - `POST /api/uploads/presign`
   - body: `{ filename, contentType, size, target: { type: 'EMPLOYEE'|'CASE', id }, visibility }`
2) Server validates:
   - auth + permissions
   - size <= 10MB
   - contentType allowed
   - constructs S3 key
3) Server returns:
   - `putUrl` (presigned PUT)
   - `key` (S3 object key)
4) Client PUTs file directly to S3
5) Client finalizes:
   - `POST /api/uploads/finalize`
   - server creates DB record (`EmployeeFile` or `CaseAttachment`)
6) Downloads:
   - `GET /api/.../download` returns a short-lived signed GET URL

### E.2 S3 key scheme
`hrms/<env>/<entity>/<entityId>/<uuid>-<sanitizedFilename>`

### E.3 Audit requirements
- finalize upload writes `AuditLog`:
  - entityType = EMPLOYEE_FILE or CASE_ATTACHMENT
  - metadata includes key, size, contentType, visibility

### E.4 Visibility tiers
Start simple:
- Employee files: `HR_ONLY` vs `EMPLOYEE_AND_HR`
- Case attachments: default `INTERNAL_HR`, expand later

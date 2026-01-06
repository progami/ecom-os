import test from 'node:test'
import assert from 'node:assert/strict'

import { buildLeaveNextActions, type LeaveViewerContext, type LeaveWorkflowRecordInput } from '../../lib/domain/leave/next-actions'

function leave(partial: Partial<LeaveWorkflowRecordInput>): LeaveWorkflowRecordInput {
  return partial as unknown as LeaveWorkflowRecordInput
}

const baseViewer: LeaveViewerContext = {
  employeeId: 'viewer',
  isHR: false,
  isSuperAdmin: false,
}

test('leave: owner can cancel pending request', () => {
  const actions = buildLeaveNextActions(
    leave({ status: 'PENDING_MANAGER', employeeId: 'viewer', employee: { reportsToId: 'mgr' } as any }),
    baseViewer
  )
  assert.equal(actions.primary?.id, 'leave.cancel')
  assert.equal(actions.primary?.disabled, false)
})

test('leave: manager can approve pending request', () => {
  const actions = buildLeaveNextActions(
    leave({ status: 'PENDING_MANAGER', employeeId: 'emp', employee: { reportsToId: 'viewer' } as any }),
    baseViewer
  )
  assert.equal(actions.primary?.id, 'leave.approve')
  assert.equal(actions.primary?.disabled, false)
  assert.ok(actions.secondary.some((a) => a.id === 'leave.reject'))
})

test('leave: HR can approve at HR stage', () => {
  const actions = buildLeaveNextActions(
    leave({ status: 'PENDING_HR', employeeId: 'emp', employee: { reportsToId: 'mgr' } as any }),
    { ...baseViewer, isHR: true }
  )
  assert.equal(actions.primary?.id, 'leave.approve')
  assert.equal(actions.primary?.disabled, false)
  assert.ok(actions.secondary.some((a) => a.id === 'leave.reject'))
})

test('leave: super admin can approve at final stage', () => {
  const actions = buildLeaveNextActions(
    leave({ status: 'PENDING_SUPER_ADMIN', employeeId: 'emp', employee: { reportsToId: 'mgr' } as any }),
    { ...baseViewer, isSuperAdmin: true }
  )
  assert.equal(actions.primary?.id, 'leave.approve')
  assert.equal(actions.primary?.disabled, false)
  assert.ok(actions.secondary.some((a) => a.id === 'leave.reject'))
})

test('leave: non-pending has no actions', () => {
  const actions = buildLeaveNextActions(
    leave({ status: 'APPROVED', employeeId: 'viewer', employee: { reportsToId: 'mgr' } as any }),
    baseViewer
  )
  assert.equal(actions.primary, null)
})

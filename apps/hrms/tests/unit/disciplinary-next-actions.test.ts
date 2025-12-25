import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDisciplinaryNextActions,
  type DisciplinaryViewerContext,
  type DisciplinaryWorkflowRecordInput,
} from '../../lib/domain/disciplinary/next-actions'

function action(partial: Partial<DisciplinaryWorkflowRecordInput>): DisciplinaryWorkflowRecordInput {
  return partial as unknown as DisciplinaryWorkflowRecordInput
}

const baseViewer: DisciplinaryViewerContext = {
  employeeId: 'viewer',
  isHR: false,
  isSuperAdmin: false,
  canActAsManager: false,
}

test('disciplinary: PENDING_HR_REVIEW shows HR approve', () => {
  const actions = buildDisciplinaryNextActions(
    action({ status: 'PENDING_HR_REVIEW', employeeId: 'emp' }),
    { ...baseViewer, isHR: true }
  )

  assert.equal(actions.primary?.id, 'disciplinary.hrApprove')
  assert.equal(actions.primary?.disabled, false)
})

test('disciplinary: PENDING_HR_REVIEW blocks non-HR', () => {
  const actions = buildDisciplinaryNextActions(action({ status: 'PENDING_HR_REVIEW', employeeId: 'emp' }), baseViewer)
  assert.equal(actions.primary?.disabled, true)
  assert.match(actions.primary?.disabledReason ?? '', /HR must review/i)
})

test('disciplinary: PENDING_ACKNOWLEDGMENT gives employee acknowledge + appeal', () => {
  const actions = buildDisciplinaryNextActions(
    action({
      status: 'PENDING_ACKNOWLEDGMENT',
      employeeId: 'viewer',
      employeeAcknowledged: false,
      managerAcknowledged: false,
    }),
    baseViewer
  )

  assert.equal(actions.primary?.id, 'disciplinary.acknowledge')
  assert.equal(actions.primary?.disabled, false)
  assert.ok(actions.secondary.some((a) => a.id === 'disciplinary.appeal'))
})

test('disciplinary: PENDING_ACKNOWLEDGMENT gives manager acknowledge', () => {
  const actions = buildDisciplinaryNextActions(
    action({
      status: 'PENDING_ACKNOWLEDGMENT',
      employeeId: 'emp',
      employeeAcknowledged: true,
      managerAcknowledged: false,
    }),
    { ...baseViewer, canActAsManager: true }
  )

  assert.equal(actions.primary?.label, 'Acknowledge as manager')
  assert.equal(actions.primary?.disabled, false)
})


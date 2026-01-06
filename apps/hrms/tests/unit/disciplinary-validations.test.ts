import test from 'node:test'
import assert from 'node:assert/strict'

import { CreateDisciplinaryActionSchema } from '../../lib/validations'

const basePayload = {
  employeeId: 'emp_1',
  violationType: 'SAFETY',
  violationReason: 'SAFETY_PROTOCOL_VIOLATION',
  severity: 'MAJOR',
  incidentDate: '2026-01-06',
  reportedBy: 'Zeeshan Azam',
  description: 'Test violation description.',
  actionTaken: 'NO_ACTION',
} as const

test('CreateDisciplinaryActionSchema allows valuesBreached omitted', () => {
  const parsed = CreateDisciplinaryActionSchema.parse(basePayload)
  assert.deepEqual(parsed.valuesBreached, [])
})

test('CreateDisciplinaryActionSchema allows valuesBreached empty array', () => {
  const parsed = CreateDisciplinaryActionSchema.parse({ ...basePayload, valuesBreached: [] })
  assert.deepEqual(parsed.valuesBreached, [])
})


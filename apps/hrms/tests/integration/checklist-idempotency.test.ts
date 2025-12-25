import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const enabled = process.env.HRMS_INTEGRATION_TEST === '1' && Boolean(process.env.DATABASE_URL)

test(
  'checklist instantiation is idempotent (requires HRMS_INTEGRATION_TEST=1 and DATABASE_URL)',
  { skip: enabled ? undefined : 'integration tests disabled' },
  async () => {
    const { prisma } = await import('../../lib/prisma')
    const { instantiateChecklistForEmployee } = await import('../../lib/domain/checklists/checklist-service')

    const suffix = randomUUID().slice(0, 8)

    const actor = await prisma.employee.create({
      data: {
        employeeId: `EMP-ACTOR-${suffix}`,
        firstName: 'Actor',
        lastName: 'Test',
        email: `test.actor.${suffix}@example.com`,
        department: 'Test',
        position: 'Test',
        joinDate: new Date(),
        permissionLevel: 100,
        isSuperAdmin: true,
      },
      select: { id: true },
    })

    const employee = await prisma.employee.create({
      data: {
        employeeId: `EMP-${suffix}`,
        firstName: 'Employee',
        lastName: 'Test',
        email: `test.employee.${suffix}@example.com`,
        department: 'Test',
        position: 'Test',
        joinDate: new Date(),
      },
      select: { id: true },
    })

    const template = await prisma.checklistTemplate.create({
      data: {
        name: `Onboarding ${suffix}`,
        lifecycleType: 'ONBOARDING',
        isActive: true,
        items: {
          create: [
            {
              title: 'Welcome pack',
              description: null,
              sortOrder: 1,
              ownerType: 'EMPLOYEE',
              dueOffsetDays: 0,
              evidenceRequired: false,
            },
          ],
        },
      },
      select: { id: true },
    })

    const first = await instantiateChecklistForEmployee({
      employeeId: employee.id,
      lifecycleType: 'ONBOARDING',
      actorId: actor.id,
      templateId: template.id,
    })

    const second = await instantiateChecklistForEmployee({
      employeeId: employee.id,
      lifecycleType: 'ONBOARDING',
      actorId: actor.id,
      templateId: template.id,
    })

    assert.equal(first.instanceId, second.instanceId)
    assert.equal(first.created, true)
    assert.equal(second.created, false)

    const instances = await prisma.checklistInstance.findMany({
      where: { employeeId: employee.id, lifecycleType: 'ONBOARDING', templateId: template.id },
      select: { id: true },
    })

    assert.equal(instances.length, 1)
  }
)


import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const enabled = process.env.HRMS_INTEGRATION_TEST === '1' && Boolean(process.env.DATABASE_URL)

test(
  'employee field permissions are enforced (requires HRMS_INTEGRATION_TEST=1 and DATABASE_URL)',
  { skip: enabled ? undefined : 'integration tests disabled' },
  async () => {
    const { prisma } = await import('../../lib/prisma')
    const { canEditField, PermissionLevel } = await import('../../lib/permissions')

    const suffix = randomUUID().slice(0, 8)

    const hr = await prisma.employee.create({
      data: {
        employeeId: `EMP-HR-${suffix}`,
        firstName: 'HR',
        lastName: 'Test',
        email: `test.hr.${suffix}@example.com`,
        department: 'Test',
        position: 'HR',
        joinDate: new Date(),
        permissionLevel: PermissionLevel.HR,
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
        position: 'Employee',
        joinDate: new Date(),
      },
      select: { id: true },
    })

    const hrCanEditDepartment = await canEditField(hr.id, employee.id, 'department')
    assert.equal(hrCanEditDepartment.allowed, true)

    const employeeCannotEditDepartment = await canEditField(employee.id, employee.id, 'department')
    assert.equal(employeeCannotEditDepartment.allowed, false)
    assert.match(employeeCannotEditDepartment.reason ?? '', /Only HR|Super Admin/i)
  }
)


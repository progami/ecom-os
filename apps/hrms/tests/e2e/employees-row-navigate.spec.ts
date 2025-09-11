import { test, expect } from '@playwright/test'

test.describe('Employees row navigation', () => {
  test.beforeAll(async ({ request }) => {
    // Ensure Umair exists
    const res = await request.get('/api/employees?take=1')
    if (!res.ok()) throw new Error('Server not healthy')
    const list = await res.json()
    const hasUmair = (list.items || []).some((e: any) => e.employeeId === 'EMP1001')
    if (!hasUmair) {
      await request.post('/api/employees', {
        data: {
          employeeId: 'EMP1001',
          firstName: 'Umair',
          lastName: 'Afzal',
          email: 'umair.afzal@example.com',
          department: 'operations',
          position: 'Operations Manager',
          employmentType: 'FULL_TIME',
          joinDate: '2024-06-01',
        },
      })
    }
  })

  test('clicking row navigates to detail', async ({ page, request }) => {
    const pre = await request.get('/api/employees?employeeId=EMP1001')
    expect(pre.ok()).toBeTruthy()
    const preData = await pre.json()
    expect((preData.items || []).length).toBeGreaterThan(0)
    await page.goto('/hrms/employees')
    // Click the employee name link (inside the row) to be explicit
    await page.getByRole('link', { name: 'Umair Afzal' }).click()
    await expect(page).toHaveURL('/hrms/employees/EMP1001')
    await expect(page.locator('h2:has-text("Files")')).toBeVisible()
  })
})

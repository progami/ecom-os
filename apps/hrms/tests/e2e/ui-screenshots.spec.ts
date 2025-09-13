import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const SHOTS_DIR = path.join(process.cwd(), 'tests', 'screenshots')

function ensureDir(dir: string) {
  try { fs.mkdirSync(dir, { recursive: true }) } catch {}
}

async function seedIfPossible(request: any) {
  try {
    // Employees
    let res = await request.get('/api/employees?employeeId=EMP1001')
    if (res.ok()) {
      const data = await res.json()
      if (!Array.isArray(data.items) || data.items.length === 0) {
        await request.post('/api/employees', {
          data: {
            employeeId: 'EMP1001', firstName: 'Umair', lastName: 'Afzal',
            email: 'umair.afzal@example.com', department: 'operations',
            position: 'Operations Manager', employmentType: 'FULL_TIME', joinDate: '2024-06-01'
          },
        })
      }
    }

    // Resources (one sample)
    res = await request.get('/api/resources?take=1')
    if (res.ok()) {
      const r = await res.json()
      if (!Array.isArray(r.items) || r.items.length === 0) {
        await request.post('/api/resources', { data: { name: 'EcomCPA', category: 'ACCOUNTING', website: 'https://ecomcpa.com/' } })
      }
    }

    // Policies (one sample)
    res = await request.get('/api/policies?take=1')
    if (res.ok()) {
      const p = await res.json()
      if (!Array.isArray(p.items) || p.items.length === 0) {
        await request.post('/api/policies', { data: { title: 'Leave Policy 2025', category: 'LEAVE', status: 'ACTIVE' } })
      }
    }
  } catch {
    // ignore if API/DB not available; screenshots will still capture UI structure
  }
}

test.describe('HRMS UI Screenshots', () => {
  test.beforeAll(async ({ request }) => {
    ensureDir(SHOTS_DIR)
    await seedIfPossible(request)
  })

  const routes = [
    { name: 'home', url: '/hrms' },
    { name: 'employees', url: '/hrms/employees' },
    { name: 'employees-add', url: '/hrms/employees/add' },
    { name: 'resources', url: '/hrms/resources' },
    { name: 'policies', url: '/hrms/policies' },
  ]

  test('desktop screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    for (const r of routes) {
      await page.goto(r.url)
      // wait for a main layout element to render
      await page.waitForSelector('main, nav')
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: path.join(SHOTS_DIR, `hrms-${r.name}-desktop.png`), fullPage: true })
    }
  })

  test('mobile screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }) // iPhone 12 Pro-ish
    for (const r of routes) {
      await page.goto(r.url)
      await page.waitForSelector('main, nav')
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: path.join(SHOTS_DIR, `hrms-${r.name}-mobile.png`), fullPage: true })
    }
  })
})


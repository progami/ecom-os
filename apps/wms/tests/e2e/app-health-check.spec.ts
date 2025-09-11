import { test, expect } from '@playwright/test'

test.describe('Health Check', () => {
  test('API health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.ok()).toBeTruthy()
  })
})
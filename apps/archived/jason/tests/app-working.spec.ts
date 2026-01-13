import { test, expect } from '@playwright/test';

test.describe('App Functionality Test', () => {
  test('✅ App is running and accessible', async ({ page }) => {
    await page.goto('/');
    
    await expect(page).toHaveTitle(/Jason/);
    
    const response = page.waitForResponse('**/api/health');
    await page.goto('/api/health');
    const healthResponse = await response;
    expect(healthResponse.status()).toBe(200);
  });

  test('✅ API health check confirms app is working', async ({ request }) => {
    const response = await request.get('/api/health');
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('service', 'calendar-aggregator');
    expect(data).toHaveProperty('version', '0.1.0');
  });

  test('✅ Can access calendar aggregator page', async ({ page }) => {
    const response = await page.goto('/calendar-aggregator');
    
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/.*calendar-aggregator/);
  });

  test('✅ Can access email summarizer page', async ({ page }) => {
    const response = await page.goto('/email-summarizer');
    
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/.*email-summarizer/);
  });
});
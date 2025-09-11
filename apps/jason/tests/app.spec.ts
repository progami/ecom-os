import { test, expect } from '@playwright/test';

test.describe('App Health Check', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    
    await expect(page).toHaveTitle(/Jason/);
    
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });

  test('should have navigation elements', async ({ page }) => {
    await page.goto('/');
    
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should navigate to calendar aggregator', async ({ page }) => {
    await page.goto('/calendar-aggregator');
    
    await expect(page).toHaveURL(/.*calendar-aggregator/);
    
    const pageContent = page.locator('main');
    await expect(pageContent).toBeVisible();
  });

  test('should navigate to email summarizer', async ({ page }) => {
    await page.goto('/email-summarizer');
    
    await expect(page).toHaveURL(/.*email-summarizer/);
    
    const pageContent = page.locator('main');
    await expect(pageContent).toBeVisible();
  });

  test('should check API health endpoint', async ({ request }) => {
    const response = await request.get('/api/health');
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('ok');
  });
});
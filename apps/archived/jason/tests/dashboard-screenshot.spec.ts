import { test, expect } from '@playwright/test';

test('Dashboard with sidebar - take screenshot', async ({ page }) => {
  // Navigate directly to the dashboard
  await page.goto('/(app)/');
  
  // Wait for content to load
  await page.waitForLoadState('networkidle');
  
  // Take a screenshot
  await page.screenshot({ 
    path: 'dashboard-screenshot.png',
    fullPage: true 
  });
  
  console.log('Dashboard screenshot saved as dashboard-screenshot.png');
});
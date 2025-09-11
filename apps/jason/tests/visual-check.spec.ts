import { test, expect } from '@playwright/test';

test('Visual check - take screenshot of app', async ({ page }) => {
  // Navigate to the app
  await page.goto('/');
  
  // Wait for content to load
  await page.waitForLoadState('networkidle');
  
  // Take a screenshot
  await page.screenshot({ 
    path: 'app-screenshot.png',
    fullPage: true 
  });
  
  // Check if main content is visible
  const mainContent = page.locator('.min-h-screen');
  await expect(mainContent).toBeVisible();
  
  // Check if title is present
  const title = page.locator('h1:has-text("Jason")');
  await expect(title).toBeVisible();
  
  console.log('Screenshot saved as app-screenshot.png');
});
import { test, expect } from '@playwright/test';

test('Debug CSS issue', async ({ page }) => {
  await page.goto('/');
  
  // Wait for content to load
  await page.waitForLoadState('networkidle');
  
  // Get all stylesheets
  const stylesheets = await page.evaluate(() => {
    const sheets = Array.from(document.styleSheets);
    return sheets.map(sheet => ({
      href: sheet.href,
      rules: sheet.cssRules ? sheet.cssRules.length : 'Cannot access'
    }));
  });
  
  console.log('Stylesheets:', JSON.stringify(stylesheets, null, 2));
  
  // Check computed styles
  const h1Styles = await page.locator('h1').first().evaluate(el => {
    const computed = window.getComputedStyle(el);
    return {
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      className: el.className
    };
  });
  
  console.log('H1 Styles:', JSON.stringify(h1Styles, null, 2));
  
  // Check if Tailwind classes are present
  const htmlContent = await page.content();
  const hasTailwindClasses = htmlContent.includes('text-5xl') && htmlContent.includes('bg-background');
  console.log('Has Tailwind classes in HTML:', hasTailwindClasses);
  
  // Get the actual CSS content
  const cssResponse = await page.goto('/_next/static/css/app/layout.css');
  const cssContent = await cssResponse?.text() || '';
  console.log('CSS file size:', cssContent.length);
  console.log('Contains Tailwind utilities:', cssContent.includes('text-5xl'));
});
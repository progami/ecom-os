const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--ignore-certificate-errors']
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  await page.goto('https://localhost:3001');
  
  // Wait for content to load
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'ui-check.png', fullPage: true });
  
  console.log('Screenshot saved as ui-check.png');
  
  // Check if page has content
  const title = await page.title();
  console.log('Page title:', title);
  
  const bodyText = await page.textContent('body');
  console.log('Page has content:', bodyText.length > 0 ? 'Yes' : 'No');
  
  // Keep browser open for manual inspection
  console.log('Browser will stay open for inspection. Press Ctrl+C to close.');
})();
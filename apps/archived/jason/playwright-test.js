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
  
  console.log('Successfully navigated to HTTPS site!');
  
  // Take screenshot
  await page.screenshot({ path: 'https-test.png' });
  
  // Keep browser open for viewing
  // await browser.close();
})();
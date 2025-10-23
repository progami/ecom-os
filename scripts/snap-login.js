const { chromium } = require('playwright');
(async () => {
  const url = process.env.URL || 'http://localhost:3000/login';
  const out = process.env.OUT || 'logs/ecomos-login.png';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // wait for password input
  await page.waitForSelector('input#password', { timeout: 10000 }).catch(() => {});
  // give CSS a moment
  await page.waitForTimeout(500);
  await page.screenshot({ path: out, fullPage: false });
  await browser.close();
  console.log('Saved', out);
})();

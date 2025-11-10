const { chromium } = require('playwright');

function resolveLoginUrl() {
  const explicit = process.env.URL;
  if (explicit) {
    return explicit;
  }

  const base =
    process.env.PORTAL_BASE_URL ||
    process.env.NEXT_PUBLIC_PORTAL_AUTH_URL ||
    process.env.PORTAL_AUTH_URL;

  if (!base) {
    throw new Error('Provide URL, PORTAL_BASE_URL, NEXT_PUBLIC_PORTAL_AUTH_URL, or PORTAL_AUTH_URL before running snap-login.');
  }

  try {
    const normalized = new URL(base);
    normalized.pathname = normalized.pathname && normalized.pathname !== '/' ? normalized.pathname : '/login';
    return normalized.toString();
  } catch (error) {
    throw new Error(`Invalid portal base URL provided: ${error instanceof Error ? error.message : String(error)}`);
  }
}

(async () => {
  const url = resolveLoginUrl();
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

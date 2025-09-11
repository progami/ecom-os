const { chromium } = require('playwright');

async function testApp() {
  const browser = await chromium.launch({ 
    headless: true,
    ignoreHTTPSErrors: true 
  });
  
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();
    
    console.log('Testing https://localhost:3001...');
    
    // Try to navigate to the page
    try {
      await page.goto('https://localhost:3001', { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      // Get the page title
      const title = await page.title();
      console.log('Page title:', title);
      
      // Get the page content
      const content = await page.content();
      console.log('Page loaded successfully');
      
      // Check for specific elements
      const h1Text = await page.textContent('h1').catch(() => null);
      console.log('H1 text:', h1Text);
      
      // Check for error messages
      const errorText = await page.textContent('.next-error-h1').catch(() => null);
      if (errorText) {
        console.log('ERROR FOUND:', errorText);
      }
      
      // Take a screenshot
      await page.screenshot({ path: 'test-screenshot.png' });
      console.log('Screenshot saved as test-screenshot.png');
      
      // Log any console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log('Console error:', msg.text());
        }
      });
      
    } catch (error) {
      console.error('Navigation error:', error.message);
    }
    
  } finally {
    await browser.close();
  }
}

testApp();
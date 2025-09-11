const puppeteer = require('puppeteer');

async function testLoginFlow() {
  console.log('Starting login flow test...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      console.log('Browser console:', msg.text());
    });
    
    // Check for React errors
    page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });
    
    // Test 1: Check login page UI
    console.log('\n1. Testing login page UI...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
    
    // Check if sidebar is visible (it shouldn't be)
    const sidebar = await page.$('.sidebar-navigation');
    if (sidebar) {
      console.error('❌ ERROR: Sidebar is visible on login page!');
    } else {
      console.log('✅ Sidebar correctly hidden on login page');
    }
    
    // Check if TopHeader is visible (it shouldn't be)
    const topHeader = await page.$('header.fixed.top-0.right-0');
    if (topHeader) {
      console.error('❌ ERROR: TopHeader is visible on login page!');
    } else {
      console.log('✅ TopHeader correctly hidden on login page');
    }
    
    // Check if XeroConnectionStatus is visible (it shouldn't be)
    const xeroStatus = await page.$('[class*="XeroConnectionStatus"]');
    if (xeroStatus) {
      console.error('❌ ERROR: XeroConnectionStatus is visible on login page!');
    } else {
      console.log('✅ XeroConnectionStatus correctly hidden on login page');
    }
    
    // Check for login form elements
    const emailInput = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');
    const loginButton = await page.$('button[type="submit"]');
    
    if (emailInput && passwordInput && loginButton) {
      console.log('✅ Login form elements present');
    } else {
      console.error('❌ ERROR: Missing login form elements');
    }
    
    // Test 2: Attempt login
    console.log('\n2. Testing login process...');
    await page.type('input[type="email"]', 'ajarrar@trademanenterprise.com');
    await page.type('input[type="password"]', 'password123');
    
    // Click login and wait for navigation
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 })
    ]);
    
    // Check where we landed
    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);
    
    if (currentUrl.includes('/setup')) {
      console.log('✅ Redirected to setup page (first time user flow)');
    } else if (currentUrl.includes('/finance')) {
      console.log('✅ Redirected to finance page (returning user)');
      
      // Check if XeroConnectionStatus is now visible
      await page.waitForTimeout(2000); // Wait for components to render
      const xeroStatusAfterLogin = await page.$('.flex.items-center.gap-2.px-3.py-1\\.5');
      if (xeroStatusAfterLogin) {
        console.log('✅ XeroConnectionStatus visible after login');
      } else {
        console.error('❌ ERROR: XeroConnectionStatus not visible after login');
      }
    } else if (currentUrl.includes('/login')) {
      console.error('❌ ERROR: Still on login page - login failed');
      
      // Check for error messages
      const errorMessage = await page.$('.bg-red-500\\/10');
      if (errorMessage) {
        const errorText = await page.evaluate(el => el.textContent, errorMessage);
        console.error('Login error:', errorText);
      }
    }
    
    // Test 3: Check logout functionality
    console.log('\n3. Testing logout...');
    if (!currentUrl.includes('/login')) {
      // Find and click logout button
      const logoutButton = await page.$('button[title="Sign Out"]');
      if (logoutButton) {
        await logoutButton.click();
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        
        if (page.url().includes('/login')) {
          console.log('✅ Successfully logged out');
        } else {
          console.error('❌ ERROR: Logout failed, still on:', page.url());
        }
      } else {
        console.error('❌ ERROR: Logout button not found');
      }
    }
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testLoginFlow().catch(console.error);
import { test, expect } from '@playwright/test';

test.describe('Authentication and Navigation Flow', () => {
  test('complete auth flow from login to WMS and sign out', async ({ page }) => {
    // 1. Navigate to the login page
    console.log('Step 1: Navigating to login page...');
    await page.goto('http://localhost:3003/auth/login');
    
    // 2. Verify the login page loads with pre-filled credentials
    console.log('Step 2: Verifying login page elements...');
    await expect(page).toHaveTitle(/Ecom OS/);
    
    // Check for the sign in heading
    await expect(page.locator('h3:has-text("Ecom OS")')).toBeVisible();
    await expect(page.locator('text=Sign in to your account')).toBeVisible();
    
    // Check for the email input with pre-filled value
    const emailInput = page.locator('input#email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveValue('jarraramjad@ecomos.com');
    
    // Check for the password input with pre-filled value
    const passwordInput = page.locator('input#password');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveValue('SecurePass123!');
    
    // Check for the sign in button
    const signInButton = page.locator('button[type="submit"]');
    await expect(signInButton).toBeVisible();
    await expect(signInButton).toHaveText('Sign in');
    
    // 3. Click the "Sign in" button
    console.log('Step 3: Clicking sign in button...');
    await signInButton.click();
    
    // 4. Wait for navigation to app-selector
    console.log('Step 4: Waiting for navigation to app-selector...');
    
    try {
      await page.waitForURL('**/app-selector', { 
        timeout: 15000,
        waitUntil: 'networkidle' 
      });
      console.log('✅ Successfully navigated to app-selector');
    } catch (error) {
      // Check if there's an error message
      const errorMessage = page.locator('div.bg-red-50').first();
      if (await errorMessage.isVisible({ timeout: 1000 })) {
        const errorText = await errorMessage.textContent();
        console.log('❌ Login failed with error:', errorText);
        throw new Error(`Login failed: ${errorText}`);
      }
      throw error;
    }
    
    // 5. Verify the user sees "Welcome, Jarrar Amjad" on the app selector page
    console.log('Step 5: Verifying welcome message...');
    await expect(page.locator('h1').filter({ hasText: /Welcome.*Jarrar Amjad/ })).toBeVisible({ timeout: 5000 });
    
    // Verify the app selector page has the Warehouse Management option
    const wmsCard = page.locator('[data-testid="app-card-wms"]');
    await expect(wmsCard).toBeVisible();
    const wmsButton = wmsCard.locator('button:has-text("Warehouse Management")');
    await expect(wmsButton).toBeVisible();
    
    // 6. Click on "Warehouse Management"
    console.log('Step 6: Clicking on Warehouse Management...');
    await wmsButton.click();
    
    // 7. Verify the WMS page loads with the app shell header
    console.log('Step 7: Verifying WMS page...');
    await page.waitForURL('**/wms/**', { timeout: 10000 });
    
    // Check for the WMS shell header
    await expect(page.locator('header').first()).toBeVisible();
    
    // Check for the user's name in the header (more specific selector)
    await expect(page.locator('header p.text-sm.font-medium:has-text("Jarrar Amjad")')).toBeVisible();
    
    // 8. Test the sign out functionality
    console.log('Step 8: Testing sign out...');
    
    // Click on Sign Out button (it's an icon button with aria-label)
    const signOutButton = page.locator('button[aria-label="Sign out"]');
    await expect(signOutButton).toBeVisible();
    await signOutButton.click();
    
    // Verify redirect back to login page
    await page.waitForURL('**/auth/login', { timeout: 10000 });
    await expect(page).toHaveTitle(/Ecom OS/);
    
    console.log('✅ All tests passed successfully!');
  });
  
  test('login page UI elements', async ({ page }) => {
    console.log('Testing login page UI elements...');
    
    await page.goto('http://localhost:3003/auth/login');
    
    // Take a screenshot for documentation
    await page.screenshot({ path: 'test-results/login-page.png', fullPage: true });
    
    // Test all UI elements are present
    const elements = {
      'Page Title': await page.title(),
      'App Name': await page.locator('h3').textContent(),
      'Subtitle': await page.locator('p').first().textContent(),
      'Email Label': await page.locator('label[for="email"]').textContent(),
      'Email Value': await page.locator('input#email').inputValue(),
      'Password Label': await page.locator('label[for="password"]').textContent(),
      'Password Value': await page.locator('input#password').inputValue(),
      'Button Text': await page.locator('button[type="submit"]').textContent()
    };
    
    console.log('\n📋 Login Page Elements:');
    Object.entries(elements).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    
    // Verify specific values
    expect(elements['Page Title']).toBe('Ecom OS (auth)');
    expect(elements['App Name']).toBe('Ecom OS');
    expect(elements['Email Value']).toBe('jarraramjad@ecomos.com');
    expect(elements['Password Value']).toBe('SecurePass123!');
    expect(elements['Button Text']).toBe('Sign in');
    
    console.log('\n✅ All login page UI elements verified successfully!');
  });
});
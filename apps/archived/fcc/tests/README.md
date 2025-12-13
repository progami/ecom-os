# Playwright Test Suite for Next.js Financial Application

This directory contains comprehensive end-to-end tests for the financial application built with Next.js, testing all major UI functionality in real browsers.

## Test Coverage

### 🔐 Authentication Tests (`auth/login.spec.ts`)
- Login page rendering and form validation
- Successful login flow with pre-filled credentials
- Dev bypass authentication for testing
- Error handling for invalid credentials
- Accessibility and keyboard navigation

### 📊 Reports Hub Tests (`reports/reports-hub.spec.ts`)  
- Reports page loading and navigation
- Report card display and interaction
- Import/Export button functionality
- Financial overview metrics
- Quick actions and responsive design
- API error handling and loading states

### 📤 Import Functionality Tests (`reports/import.spec.ts`)
- Import page form validation
- File upload via drag-and-drop
- Report type selection and date inputs
- Complete import flow with success/error states
- File type validation and progress indicators
- Form reset after successful import

### 📈 Individual Report Tests (`reports/individual-reports.spec.ts`)
- Balance Sheet detailed page testing
- Aged Payables/Receivables reports
- Cash Flow and Bank Summary reports
- Profit & Loss detailed analysis
- View toggle (Summary/Detailed) functionality
- Refresh and export capabilities
- Responsive design and error states

### 🧭 Main Navigation Tests (`main-navigation.spec.ts`)
- Homepage redirection logic
- Navigation accessibility
- 404 error handling
- Keyboard navigation support
- Performance metrics
- Mobile responsiveness

## Running the Tests

### Prerequisites
1. Make sure the application server is running:
   ```bash
   npm run dev
   ```

2. Verify the application is accessible at `https://localhost:3003`

### Running All Tests
```bash
# Run all tests
npm run test

# Run tests with UI mode
npm run test:ui

# Run tests with HTML reporter
npm run test:coverage
```

### Running Specific Test Files
```bash
# Run only authentication tests
npx playwright test tests/auth/

# Run only reports tests  
npx playwright test tests/reports/

# Run specific test file
npx playwright test tests/auth/login.spec.ts

# Run tests for specific browser
npx playwright test --project=chromium
```

### Running Tests with Dev Bypass
Most tests use the `dev_bypass=true` parameter to skip authentication. This allows testing the UI functionality without needing to maintain test user credentials.

```typescript
// Example of dev bypass usage in tests
await helpers.navigateWithDevBypass('/reports');
```

### Test Configuration

The tests are configured in `playwright.config.ts` with:
- Support for Chromium, Firefox, and WebKit browsers
- Mobile device testing (iPhone, Android)
- Automatic screenshot capture on failures
- Video recording for failed tests
- Trace collection for debugging

### Key Test Utilities

**TestHelpers Class** (`utils/test-helpers.ts`):
- `navigateWithDevBypass()` - Navigate with authentication bypass
- `waitForPageLoad()` - Wait for page and API requests to complete
- `safeClick()` - Click elements with retry logic
- `checkForErrors()` - Scan page for error messages
- `takeScreenshot()` - Capture screenshots with descriptive names

**FinancialAssertions Class** (`utils/test-helpers.ts`):
- `expectCurrencyValue()` - Validate currency formatting
- `expectDateFormat()` - Verify date display formats
- `expectTableRows()` - Check table row counts
- `expectRequiredFields()` - Validate form field requirements

## Test Data

Test fixtures are located in `tests/fixtures/`:
- `test-data.csv` - Sample financial data for import testing

## Browser Support

Tests run on:
- ✅ Desktop Chrome/Chromium
- ✅ Desktop Firefox  
- ✅ Desktop Safari (WebKit)
- ✅ Mobile Chrome (Pixel 5)
- ✅ Mobile Safari (iPhone 12)

## CI/CD Integration

The test suite is configured for continuous integration with:
- Automatic retry on failures (2 retries in CI)
- JUnit XML output for CI reporting
- HTML reports for detailed analysis
- Parallel test execution

## Debugging Failed Tests

1. **View HTML Report**: `npx playwright show-report`
2. **Run with Debug Mode**: `npx playwright test --debug`
3. **View Traces**: Access trace files in `test-results/`
4. **Screenshots**: Check `test-results/screenshots/` for failure images

## Best Practices

1. **Dev Bypass**: Use `dev_bypass=true` for most tests to avoid authentication complexity
2. **API Mocking**: Mock API responses for consistent test data
3. **Wait Strategies**: Use `waitForPageLoad()` instead of fixed timeouts
4. **Error Checking**: Always check for error states after actions
5. **Screenshots**: Take screenshots at key test points for debugging

## Key Features Tested

✅ **Authentication Flow**
- Login page functionality
- Dev bypass authentication
- Session management

✅ **Reports Navigation**  
- Report hub page
- Individual report pages
- Import functionality

✅ **File Upload**
- Drag and drop file upload
- Form validation
- Success/error handling

✅ **UI Interactions**
- Button clicks and navigation
- Form submissions
- Modal dialogs

✅ **Responsive Design**
- Mobile viewport testing
- Touch interaction support
- Adaptive layouts

✅ **Error Handling**
- API failure scenarios
- Network timeout handling
- User error feedback

✅ **Performance**
- Page load times
- API response handling
- Resource optimization

This comprehensive test suite ensures the financial application works correctly across all supported browsers and devices, providing confidence in the user experience for critical financial operations.
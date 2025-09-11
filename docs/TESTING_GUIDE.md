# Testing Guide

## Overview

All Ecom OS projects **MUST** implement comprehensive testing with Playwright and maintain a UI inventory system.

## Test Directory Structure

### IMPORTANT: Single Test Directory Rule
Each project must have **ONE AND ONLY ONE** test directory named `tests/`. 

❌ **NOT ALLOWED:**
- Multiple test directories (test/, __tests__/, e2e/, etc.)
- Scattered test files throughout the codebase
- Test files mixed with source code
- Redundant test folders

✅ **REQUIRED Structure:**
```
project-root/
└── tests/              # ONE test directory only
    ├── unit/          # Unit tests
    ├── integration/   # Integration tests
    ├── e2e/           # End-to-end tests
    └── fixtures/      # Test data and utilities
```

## Mandatory Testing Requirements

### 1. Playwright Setup
```bash
npm install -D @playwright/test
npx playwright install
```

### 2. Test Configuration
Create `playwright.config.ts` in project root:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',  // ONE test directory
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
});
```

### 3. UI Inventory System
Every project must maintain `tests/ui-inventory.json`:
```json
{
  "buttons": ["submit", "cancel", "delete"],
  "forms": ["login", "register", "settings"],
  "modals": ["confirm", "alert", "edit"],
  "pages": ["/", "/dashboard", "/settings"]
}
```

### 4. Required Test Coverage
- All UI elements must be tested
- All API endpoints must have tests
- Business logic must have unit tests
- User flows must have E2E tests

### 5. Clean Testing Practices
- NO test artifacts in repository
- NO screenshots or videos in git
- NO test reports committed
- Add all test outputs to .gitignore

## Running Tests
```bash
# Run all tests
npm test

# Run specific test type
npm run test:unit
npm run test:e2e

# Update UI inventory
npm run test:inventory
```

## Repository Hygiene
- Keep tests organized in single directory
- Remove old/unused tests
- Update UI inventory regularly
- Clean test artifacts before commits
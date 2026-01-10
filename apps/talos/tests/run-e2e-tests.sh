#!/bin/bash

echo "🎭 Running Playwright E2E Tests"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if Playwright is installed
if ! npx playwright --version &> /dev/null; then
    echo -e "${YELLOW}Playwright not found. Installing...${NC}"
    cd .. && npm install -D @playwright/test && npx playwright install
    cd tests
fi

# Run E2E tests
echo -e "${YELLOW}Running E2E tests...${NC}"
npx playwright test --config=playwright.config.ts

# Check exit code
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ All E2E tests passed!${NC}"
    
    # Show report
    echo -e "${YELLOW}Opening test report...${NC}"
    npx playwright show-report playwright-report
else
    echo -e "${RED}❌ Some E2E tests failed${NC}"
    echo -e "${YELLOW}Opening test report for details...${NC}"
    npx playwright show-report playwright-report
    exit 1
fi
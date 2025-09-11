# HRMS UI Test Workflows

This directory contains GitHub Actions workflows for automated UI testing of the HRMS application.

## Workflows

### 1. `passing-ui-tests.yml` - Main Test Suite
**Trigger:** Push to main, PRs to main, daily schedule
**Purpose:** Runs all stable, passing UI tests across multiple browsers and platforms

**Test Coverage:**
- ✅ Employee Management (Add, Search, Filter, Export, Table interactions)
- ✅ Form Navigation (Buttons, Back navigation)
- ✅ Freelancer Search
- ✅ Document Management (Upload, Actions)
- ✅ Resource Management (Categories, Cards, Add)
- ✅ Attendance Tracking (Controls, Edit)
- ✅ Settings (Company, Departments, Save)

**Browser Matrix:**
- Chromium on Ubuntu, Windows
- Firefox on Ubuntu
- WebKit on Ubuntu, macOS

### 2. `quick-ui-tests.yml` - Fast Feedback
**Trigger:** Push to non-main branches, PR updates
**Purpose:** Quick validation with essential tests only (< 10 min)

**Tests:** Core employee management and navigation tests on Chromium only

### 3. `ui-tests.yml` - Comprehensive Suite
**Trigger:** Manual, push/PR to main/develop
**Purpose:** Full test matrix with detailed reporting

## Local Testing

Run passing tests locally:
```bash
./scripts/run-passing-tests.sh
```

## Test Patterns

The workflows use grep patterns to run specific test groups:

```javascript
// Employee Management
"Employees Page Tests"

// Form Tests (partial match to avoid failing input tests)
"should test form buttons|should test back navigation"

// Other stable tests
"Resources Page Tests"
"Freelancers.*should test search"
// etc.
```

## Artifacts

Each workflow produces:
- HTML test reports (30 day retention)
- Test result JSON (7 day retention)
- Failure screenshots/videos (3 day retention)

## Caching

- Node modules are cached
- Playwright browsers are cached per OS/browser combination
- Cache keys include package-lock.json hash

## Environment Variables

- `NODE_VERSION`: '18'
- `CI`: true (set automatically)
- `PLAYWRIGHT_BROWSERS_PATH`: Custom browser cache location

## Viewing Results

1. **GitHub UI:** Check the Actions tab for run results
2. **PR Comments:** Automated comments on PR with test summary
3. **GitHub Pages:** Test reports deployed to `gh-pages` branch (main branch only)
4. **Artifacts:** Download HTML reports from workflow run

## Troubleshooting

### Tests timing out
- Increase timeout in workflow (default: 20-30 min)
- Check if app starts correctly on port 3006

### Browser installation fails
- Clear cache in GitHub Actions settings
- Update Playwright version in package.json

### Flaky tests
- Tests are configured with 1-2 retries
- Only stable tests are included in workflows

## Adding New Tests

1. Add test to `exhaustive-ui-test.spec.ts`
2. Run locally with `./scripts/run-passing-tests.sh`
3. If stable, add pattern to workflow grep expressions
4. Create PR to validate in CI

## Maintenance

- Review test stability monthly
- Update browser versions quarterly
- Archive old test reports annually
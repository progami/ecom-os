# Shared Workflows - Parameter Reference

## 🔧 ci-base.yml

Basic CI workflow for linting, type checking, and building.

### Inputs

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `node-version` | string | `'20'` | Node.js version to use |
| `node-matrix` | boolean | `false` | Run builds on multiple Node versions (18, 20) |
| `run-type-check` | boolean | `true` | Run TypeScript type checking |
| `run-security` | boolean | `false` | Run security scanning (npm audit, OWASP) |
| `run-e2e` | boolean | `false` | Run E2E tests (deprecated - use test-suite.yml) |
| `working-directory` | string | `'.'` | Working directory for all commands |
| `build-env` | string | `'{}'` | JSON string of environment variables for build |
| `services` | string | `'none'` | Services to run: 'none', 'postgres', 'postgres,redis' |

### Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `DATABASE_URL` | No | PostgreSQL connection string |
| `REDIS_URL` | No | Redis connection string |
| `NEXTAUTH_SECRET` | No | NextAuth.js secret |

### Example Usage

```yaml
jobs:
  ci:
    uses: orgname/shared-workflows/.github/workflows/ci-base.yml@main
    with:
      node-version: '18'
      node-matrix: true
      run-security: true
      build-env: |
        {
          "API_URL": "https://api.example.com",
          "NODE_ENV": "production"
        }
```

## 🧪 test-suite.yml

Comprehensive test suite for unit, integration, and E2E tests.

### Inputs

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `node-version` | string | `'20'` | Node.js version |
| `working-directory` | string | `'.'` | Working directory |
| `test-command` | string | `'test'` | Base test command (e.g., 'test', 'jest') |
| `run-unit` | boolean | `true` | Run unit tests |
| `run-integration` | boolean | `true` | Run integration tests |
| `run-e2e` | boolean | `false` | Run E2E tests |
| `e2e-browsers` | string | `'["chromium"]'` | JSON array of Playwright browsers |
| `services-config` | string | `'standard'` | Database services: 'none', 'standard', 'postgres,redis' |

### Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `DATABASE_URL` | No | PostgreSQL connection string |
| `REDIS_URL` | No | Redis connection string |
| `NEXTAUTH_SECRET` | No | NextAuth.js secret |
| `TEST_ENV` | No | Additional test environment variables |

### Example Usage

```yaml
jobs:
  test:
    uses: orgname/shared-workflows/.github/workflows/test-suite.yml@main
    with:
      run-e2e: true
      e2e-browsers: '["chromium", "firefox", "webkit"]'
      services-config: 'postgres,redis'
    secrets:
      DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

## 🚀 deploy-ssh.yml

SSH-based deployment workflow with health checks.

### Inputs

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `environment` | string | `'production'` | Deployment environment name |
| `app-name` | string | Required | PM2 application name |
| `app-path` | string | Required | Application path on server |
| `app-user` | string | `''` | User to run application as (uses sudo) |
| `branch` | string | `'main'` | Git branch to deploy |
| `health-check-url` | string | `'/api/health'` | Health check endpoint |
| `health-check-port` | string | `'3000'` | Port for health check |
| `post-deploy-commands` | string | `''` | Additional commands after deployment |
| `node-version` | string | `'20'` | Node.js version |

### Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `SERVER_HOST` | Yes | Server hostname/IP |
| `SERVER_USER` | Yes | SSH username |
| `SERVER_SSH_KEY` | Yes | SSH private key |
| `DEPLOY_ENV` | No | Additional deployment environment variables |

### Example Usage

```yaml
jobs:
  deploy:
    uses: orgname/shared-workflows/.github/workflows/deploy-ssh.yml@main
    with:
      app-name: 'my-app'
      app-path: '/home/apps/my-app'
      app-user: 'appuser'
      health-check-url: 'https://myapp.com/health'
      post-deploy-commands: |
        # Clear cache
        npm run cache:clear
        # Notify monitoring
        curl -X POST https://monitoring.com/deploy
    secrets:
      SERVER_HOST: ${{ secrets.PROD_HOST }}
      SERVER_USER: ${{ secrets.PROD_USER }}
      SERVER_SSH_KEY: ${{ secrets.PROD_SSH_KEY }}
```

## ✅ pr-checks.yml

Pull request validation and automation.

### Inputs

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `working-directory` | string | `'.'` | Working directory |
| `check-pr-title` | boolean | `true` | Enforce conventional commit format |
| `add-size-labels` | boolean | `true` | Add size labels (XS, S, M, L, XL) |
| `size-thresholds` | string | See below | JSON object with size thresholds |
| `comment-test-results` | boolean | `true` | Comment test results on PR |

**Default size thresholds:**
```json
{
  "xs": 10,
  "s": 100,
  "m": 500,
  "l": 1000
}
```

### Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub token for API access |

### Example Usage

```yaml
jobs:
  pr:
    uses: orgname/shared-workflows/.github/workflows/pr-checks.yml@main
    with:
      size-thresholds: |
        {
          "xs": 25,
          "s": 100,
          "m": 250,
          "l": 500
        }
    secrets:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 🎯 Common Patterns

### Pattern 1: Simple Next.js App

```yaml
name: CI/CD
on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    uses: orgname/shared-workflows/.github/workflows/ci-base.yml@main
    with:
      node-version: '20'
      run-type-check: false  # No TypeScript

  deploy:
    needs: ci
    if: github.ref == 'refs/heads/main'
    uses: orgname/shared-workflows/.github/workflows/deploy-ssh.yml@main
    with:
      app-name: 'my-app'
      app-path: '/home/my-app'
    secrets: inherit
```

### Pattern 2: Full-Stack App with Tests

```yaml
name: Full CI/CD
on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  pr-checks:
    if: github.event_name == 'pull_request'
    uses: orgname/shared-workflows/.github/workflows/pr-checks.yml@main
    secrets:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  build:
    uses: orgname/shared-workflows/.github/workflows/ci-base.yml@main
    with:
      node-matrix: true
      run-security: true
      services: 'postgres,redis'

  test:
    needs: build
    uses: orgname/shared-workflows/.github/workflows/test-suite.yml@main
    with:
      run-e2e: true
      services-config: 'postgres,redis'
    secrets: inherit

  deploy:
    needs: [build, test]
    if: github.ref == 'refs/heads/main'
    uses: orgname/shared-workflows/.github/workflows/deploy-ssh.yml@main
    with:
      app-name: 'fullstack-app'
      app-path: '/opt/apps/fullstack'
      app-user: 'webapp'
    secrets: inherit
```

### Pattern 3: Monorepo with Multiple Apps

```yaml
name: Monorepo CI/CD
on:
  push:
    branches: [main]
  pull_request:

jobs:
  # Build and test each app
  ci-app1:
    uses: orgname/shared-workflows/.github/workflows/ci-base.yml@main
    with:
      working-directory: './apps/app1'
      build-env: |
        {
          "APP_NAME": "app1"
        }

  ci-app2:
    uses: orgname/shared-workflows/.github/workflows/ci-base.yml@main
    with:
      working-directory: './apps/app2'
      build-env: |
        {
          "APP_NAME": "app2"
        }

  # Deploy apps
  deploy-app1:
    needs: ci-app1
    if: github.ref == 'refs/heads/main'
    uses: orgname/shared-workflows/.github/workflows/deploy-ssh.yml@main
    with:
      app-name: 'monorepo-app1'
      app-path: '/home/monorepo/apps/app1'

  deploy-app2:
    needs: ci-app2
    if: github.ref == 'refs/heads/main'
    uses: orgname/shared-workflows/.github/workflows/deploy-ssh.yml@main
    with:
      app-name: 'monorepo-app2'
      app-path: '/home/monorepo/apps/app2'
```

## 🔒 Security Notes

1. **Secrets**: Never hardcode secrets in workflow files
2. **Permissions**: Use minimum required permissions
3. **Dependencies**: Regular updates via Dependabot
4. **Audit**: Enable security scanning in CI
5. **Access**: Protect shared workflow repository

## 🐛 Troubleshooting

### Build Failures

```yaml
# Add debug output
build-env: |
  {
    "DEBUG": "true",
    "VERBOSE": "1"
  }
```

### Service Connection Issues

```yaml
# Ensure services are configured correctly
services: 'postgres,redis'  # Both services
services-config: 'standard'  # Uses default ports
```

### Path Issues

```yaml
# Always use working-directory for monorepos
working-directory: './my-app'
```

## 📚 Additional Resources

- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Reusable Workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows)
- [Workflow Commands](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions)
# How to Use Shared Workflows

## Step 1: Create a Shared Workflows Repository

Create a new repository called `targon-shared-workflows` (or similar) in your GitHub organization.

## Step 2: Add the Workflow Files

Copy the workflow files from this example to `.github/workflows/` in your shared repository:
- `deploy.yml` - Reusable deployment workflow
- `ci.yml` - Reusable CI workflow

## Step 3: Update Your Repository Workflows

### For the Master Repository

Replace `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
    branches: [ main, dev ]
  pull_request:
    branches: [ main ]

jobs:
  ci:
    uses: progami/targon-shared-workflows/.github/workflows/ci.yml@main
    with:
      node-version: '18'
      run-tests: false
      run-prisma: false
```

Replace `.github/workflows/deploy.yml` with:

```yaml
name: Deploy to Production

on:
  workflow_run:
    workflows: ["CI"]
    types:
      - completed
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    if: ${{ github.event.workflow_run.conclusion == 'success' || github.event_name == 'workflow_dispatch' }}
    uses: progami/targon-shared-workflows/.github/workflows/deploy.yml@main
    with:
      app-name: 'targon-frontend'
      app-path: '/home/ecom-os'
      health-check-url: 'https://targonglobal.com'
    secrets:
      SERVER_HOST: ${{ secrets.SERVER_HOST }}
      SERVER_USER: ${{ secrets.SERVER_USER }}
      SERVER_SSH_KEY: ${{ secrets.SERVER_SSH_KEY }}
```

### For the WMS Repository

Replace the complex CI workflow with calls to shared workflows:

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  ci:
    uses: progami/targon-shared-workflows/.github/workflows/ci.yml@main
    with:
      node-version: '18'
      run-tests: true
      run-prisma: true

  # Add other WMS-specific jobs as needed
  security-scan:
    needs: ci
    runs-on: ubuntu-latest
    steps:
      # WMS-specific security scanning
```

## Benefits

1. **Single Source of Truth**: Update deployment logic in one place
2. **Consistency**: Both repos use the same CI/CD process
3. **Maintainability**: Easier to manage and debug
4. **Flexibility**: Can pass different parameters for each repo
5. **Security**: Secrets are passed securely between workflows

## Advanced Features

### Version Control
Use tags for stable versions:
```yaml
uses: progami/targon-shared-workflows/.github/workflows/deploy.yml@v1.0.0
```

### Multiple Environments
Create environment-specific workflows:
```yaml
# shared-workflows/deploy-staging.yml
# shared-workflows/deploy-production.yml
```

### Composite Actions
For smaller reusable components, create composite actions:
```yaml
# .github/actions/setup-node/action.yml
name: 'Setup Node Project'
description: 'Setup Node.js with caching and install dependencies'
inputs:
  node-version:
    description: 'Node.js version'
    default: '18'
runs:
  using: 'composite'
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: 'npm'
    - run: npm ci
      shell: bash
```

## Migration Strategy

1. Start with deployment workflows (most similar between repos)
2. Extract common CI steps into shared workflow
3. Keep repo-specific jobs in local workflows
4. Gradually move more logic to shared workflows
5. Use composite actions for fine-grained reuse
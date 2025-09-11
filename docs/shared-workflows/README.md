# Targon Shared Workflows

This repository contains reusable GitHub Actions workflows for all Targon repositories.

## Available Workflows

### 1. CI Base (`ci-base.yml`)
Comprehensive CI pipeline with linting, type checking, building, and optional security scanning.

**Usage:**
```yaml
jobs:
  ci:
    uses: progami/shared-workflows/.github/workflows/ci-base.yml@main
    with:
      node-version: '20'
      run-security: true
```

### 2. SSH Deploy (`deploy-ssh.yml`)
Flexible deployment workflow supporting multiple environments and applications.

**Usage:**
```yaml
jobs:
  deploy:
    uses: progami/shared-workflows/.github/workflows/deploy-ssh.yml@main
    with:
      app-name: 'my-app'
      app-path: '/home/my-app'
      health-check-url: 'https://myapp.com'
    secrets:
      SERVER_HOST: ${{ secrets.SERVER_HOST }}
      SERVER_USER: ${{ secrets.SERVER_USER }}
      SERVER_SSH_KEY: ${{ secrets.SERVER_SSH_KEY }}
```

### 3. Test Suite (`test-suite.yml`)
Comprehensive testing framework supporting unit, integration, and E2E tests.

**Usage:**
```yaml
jobs:
  test:
    uses: progami/shared-workflows/.github/workflows/test-suite.yml@main
    with:
      run-e2e: true
      e2e-browsers: '["chromium", "firefox"]'
      services-config: 'postgres,redis'
```

### 4. PR Checks (`pr-checks.yml`)
Automated PR validation including title checks, size labels, and file analysis.

**Usage:**
```yaml
jobs:
  pr-checks:
    uses: progami/shared-workflows/.github/workflows/pr-checks.yml@main
    secrets:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Implementation Guide

### For New Repositories
1. Copy the example workflows from `examples/` directory
2. Update the parameters for your specific needs
3. Ensure all required secrets are configured

### For Existing Repositories
1. Backup your current workflows
2. Replace with calls to shared workflows
3. Test in a feature branch before merging

## Parameters Reference

See [PARAMETER_REFERENCE.md](PARAMETER_REFERENCE.md) for detailed documentation of all workflow parameters.

## Contributing

1. Create a feature branch
2. Make your changes
3. Test in a real repository
4. Create a PR with detailed description
5. Get approval from at least one team member

## Version Control

- Use semantic versioning for releases
- Tag stable versions (e.g., `v1.0.0`)
- Repositories can reference specific versions:
  ```yaml
  uses: progami/shared-workflows/.github/workflows/deploy-ssh.yml@v1.0.0
  ```

## Support

For issues or questions, please:
1. Check the documentation
2. Create an issue in this repository
3. Contact the DevOps team

## License

Internal use only - Targon LLC
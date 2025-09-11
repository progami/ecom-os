# Quick Start Guide - Shared GitHub Actions Workflows

## 🚀 5-Minute Setup

### Step 1: Create Shared Workflows Repository

```bash
# Create the repository (adjust organization name)
gh repo create ecom-os/shared-workflows --public --description "Shared GitHub Actions workflows"

# Clone and setup
git clone https://github.com/ecom-os/shared-workflows.git
cd shared-workflows

# Create workflow directory
mkdir -p .github/workflows

# Copy the shared workflows
cp /path/to/shared-workflows-example/workflows/*.yml .github/workflows/

# Commit and push
git add .
git commit -m "feat: Add shared workflow templates"
git push origin main
```

### Step 2: Update Your Repository

For the **Master Repository**:

```bash
cd /path/to/master-repo

# Backup existing workflows
mkdir -p .github/workflows-backup
cp .github/workflows/*.yml .github/workflows-backup/

# Copy new workflow configurations
cp /path/to/shared-workflows-example/master-repo/*.yml .github/workflows/

# Update organization name in workflows
sed -i 's/orgname/ecom-os/g' .github/workflows/*.yml

# Commit changes
git add .github/workflows/
git commit -m "feat: Migrate to shared workflows"
git push origin feat/shared-workflows
```

For the **WMS Repository**:

```bash
cd /path/to/wms-repo

# Backup existing workflows
mkdir -p .github/workflows-backup
cp .github/workflows/*.yml .github/workflows-backup/

# Copy new workflow configurations
cp /path/to/shared-workflows-example/wms-repo/*.yml .github/workflows/

# Update organization name
sed -i 's/orgname/ecom-os/g' .github/workflows/*.yml

# Commit changes
git add .github/workflows/
git commit -m "feat: Migrate to shared workflows"
git push origin feat/shared-workflows
```

### Step 3: Test the Migration

1. **Create a test PR** to verify PR checks work
2. **Push to feature branch** to test CI pipeline
3. **Manual deployment test** using workflow_dispatch

### Step 4: Production Rollout

```bash
# After successful testing, merge to main
git checkout main
git merge feat/shared-workflows
git push origin main
```

## 📋 Pre-Migration Checklist

- [ ] Shared workflows repository created
- [ ] Organization secrets configured:
  - [ ] `SERVER_HOST`
  - [ ] `SERVER_USER`
  - [ ] `SERVER_SSH_KEY`
- [ ] Repository-specific secrets verified
- [ ] Team notified of changes
- [ ] Backup of original workflows saved

## 🔧 Configuration Examples

### Master Repository Adjustments

If your master repo needs different Node version:
```yaml
# .github/workflows/ci.yml
jobs:
  ci:
    uses: ecom-os/shared-workflows/.github/workflows/ci-base.yml@main
    with:
      node-version: '18'  # Master uses Node 18
```

### WMS Repository Adjustments

For WMS with comprehensive testing:
```yaml
# .github/workflows/ci.yml
jobs:
  test-suite:
    uses: ecom-os/shared-workflows/.github/workflows/test-suite.yml@main
    with:
      run-e2e: true
      e2e-browsers: '["chromium", "firefox"]'  # Multiple browsers
      services-config: 'postgres,redis'
```

## 🚨 Rollback Procedure

If issues occur:

```bash
# Quick rollback
cd your-repo
cp .github/workflows-backup/*.yml .github/workflows/
git add .github/workflows/
git commit -m "revert: Rollback to original workflows"
git push origin main
```

## 📞 Support

- **Slack Channel**: #github-actions-help
- **Documentation**: See PARAMETER_REFERENCE.md
- **Issues**: Report in shared-workflows repository

## 🎉 Success Indicators

You'll know the migration is successful when:
- ✅ PR checks run automatically
- ✅ CI builds complete successfully
- ✅ Deployments work without manual intervention
- ✅ All tests pass in the new setup
- ✅ Build times remain consistent or improve

## 🔄 Next Steps

1. Monitor workflows for 24-48 hours
2. Update any repository-specific documentation
3. Train team on new parameter options
4. Plan migration for remaining repositories

---

**Remember**: Start with non-critical repositories first, then move to production systems after confirming stability.
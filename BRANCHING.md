# Branching Strategy

This repository follows a **dev → main** branching workflow with strict branch protection.

## Branch Structure

### `main` (Production)
- **Protected**: ✅ Requires PR approval, linear history, admin rules enforced
- **Purpose**: Production-ready code
- **Pushes**: ❌ Direct pushes forbidden (including admins)
- **Merges**: ✅ Only from `dev` via approved PRs

### `dev` (Development)
- **Protected**: No
- **Purpose**: Integration branch for all feature work
- **Pushes**: ✅ Allowed
- **Merges**: From feature branches

### Feature Branches
- **Naming**: `work/*`, `fix/*`, `feat/*`
- **Base**: Always branch from `dev`
- **Merge to**: Always merge to `dev` first

## Workflow

### 1. Starting New Work
```bash
# Ensure dev is up to date
git checkout dev
git pull origin dev

# Create feature branch
git checkout -b work/feature-name
```

### 2. Development
```bash
# Make changes and commit
git add .
git commit -m "feat: description"
git push origin work/feature-name
```

### 3. Merging to Dev
```bash
# Create PR: work/feature-name → dev
gh pr create --base dev --head work/feature-name
```

### 4. Deploying to Production
```bash
# Only after feature is tested in dev
# Create PR: dev → main (requires 1 approval)
gh pr create --base main --head dev
```

## Branch Protection Rules

### Main Branch
- ✅ Require pull request reviews (1 approval)
- ✅ Dismiss stale reviews on new commits
- ✅ Require linear history (no merge commits)
- ✅ Enforce for administrators
- ❌ No force pushes
- ❌ No deletions

### Dev Branch
- No protection rules (open for development)

## Important Notes

1. **Never commit directly to main** - All changes must go through dev first
2. **Keep dev in sync** - Regularly pull from dev before creating feature branches
3. **Use linear history** - Rebase or squash merge to keep history clean
4. **Test in dev first** - Never merge untested code to main

## Emergency Hotfixes

For critical production fixes:

```bash
# Create hotfix branch from main
git checkout -b hotfix/critical-fix main

# Fix and test
git commit -m "hotfix: description"

# Create PR to main (requires approval)
gh pr create --base main --head hotfix/critical-fix

# After merge, sync fix back to dev
git checkout dev
git merge main
git push origin dev
```

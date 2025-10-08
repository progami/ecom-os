# Version Management System

This monorepo uses a centralized version management system with a single source of truth to prevent version drift between GitHub releases, package.json files, UI displays, and CI/CD deployments.

## Architecture

```
Root package.json (SINGLE SOURCE OF TRUTH)
    ↓
scripts/sync-versions.js (synchronizes all apps)
    ↓
App package.json versions (synced automatically)
    ↓
next.config.js (injects NEXT_PUBLIC_VERSION)
    ↓
UI Components (display version)
    ↓
CI/CD (validates + creates GitHub releases)
```

## Key Components

### 1. Root package.json (`package.json`)
- **Single source of truth** for version across entire monorepo
- All apps inherit this version

### 2. Version Sync Script (`scripts/sync-versions.js`)
**Commands:**
```bash
# Sync all app versions to root version
node scripts/sync-versions.js

# Check version consistency (CI mode)
node scripts/sync-versions.js --check

# Bump version and sync
node scripts/sync-versions.js --bump patch   # 0.8.1 → 0.8.2
node scripts/sync-versions.js --bump minor   # 0.8.1 → 0.9.0
node scripts/sync-versions.js --bump major   # 0.8.1 → 1.0.0
```

### 3. Pre-commit Hook (`.husky/pre-commit`)
- Validates version consistency before every commit
- Prevents commits if versions are out of sync
- Provides helpful error messages with fix instructions

### 4. CI/CD Integration (`.github/workflows/cd.yml`)
**Validation:**
- Runs `sync-versions.js --check` before build
- Fails deployment if versions are mismatched

**Auto-Release Creation:**
- After successful deployment, automatically creates GitHub releases
- Creates release tags: `wms-0.8.1`, `website-0.8.1`, etc.
- Includes deployment metadata (commit, timestamp, triggering user)
- Updates existing releases if tag already exists

### 5. UI Version Display
- Next.js apps inject version via `NEXT_PUBLIC_VERSION` env var
- Configured in each app's `next.config.js`:
  ```js
  env: {
    NEXT_PUBLIC_VERSION: version,  // from package.json
  }
  ```
- UI components read from `process.env.NEXT_PUBLIC_VERSION`
- Fallback to package.json version if env var not set

## Workflow

### Daily Development
1. Make changes to codebase
2. Pre-commit hook validates versions automatically
3. Commit and push (versions are guaranteed to be in sync)

### Releasing a New Version
```bash
# Option 1: Manual version bump
# Edit root package.json version manually, then sync
node scripts/sync-versions.js

# Option 2: Automated bump
node scripts/sync-versions.js --bump patch

# Commit and push
git add .
git commit -m "chore: bump version to 0.8.2"
git push origin work/your-branch

# Create PR and merge to dev → main
# CI/CD will automatically:
# - Validate versions
# - Build and deploy
# - Create GitHub releases
```

### CI/CD Flow
```
PR merged to main
    ↓
CD workflow triggered
    ↓
Version consistency check (sync-versions.js --check)
    ↓
Build apps (version injected via NEXT_PUBLIC_VERSION)
    ↓
Deploy to production
    ↓
Health checks
    ↓
Create/update GitHub releases (auto-tagged with version)
```

## Benefits

### ✅ Prevents Version Drift
- **Before**: Manual GitHub releases → UI shows old version → confusion
- **After**: Single source of truth → guaranteed consistency

### ✅ Fault Tolerant
- Pre-commit hooks catch issues early
- CI validation prevents mismatched deployments
- Impossible to commit out-of-sync versions

### ✅ Zero Manual Work
- Bump version in one place
- Script syncs all apps automatically
- GitHub releases created automatically on deploy
- No manual tag creation needed

### ✅ Audit Trail
- GitHub releases track exact deployment info
- Commit SHA, timestamp, and triggering user logged
- Easy to trace what version is running where

## Version Update Examples

### Patch Release (Bug Fix)
```bash
node scripts/sync-versions.js --bump patch
# 0.8.1 → 0.8.2
git add .
git commit -m "chore: bump version to 0.8.2"
```

### Minor Release (New Features)
```bash
node scripts/sync-versions.js --bump minor
# 0.8.1 → 0.9.0
git add .
git commit -m "chore: bump version to 0.9.0"
```

### Major Release (Breaking Changes)
```bash
node scripts/sync-versions.js --bump major
# 0.8.1 → 1.0.0
git add .
git commit -m "chore: bump version to 1.0.0"
```

## Troubleshooting

### Pre-commit Hook Fails
```
❌ Version mismatch detected!
```

**Fix:**
```bash
node scripts/sync-versions.js
git add .
# Retry commit
```

### CI Validation Fails
```
✗ apps/wms needs update to 0.8.1
```

**Fix:**
```bash
# Pull latest changes
git pull origin dev

# Run sync script
node scripts/sync-versions.js

# Commit and push
git add .
git commit -m "chore: sync versions to 0.8.1"
git push
```

### GitHub Release Not Created
- Check CD workflow logs in GitHub Actions
- Ensure `contents: write` permission is set in workflow
- Verify health checks passed (release only created on success)

## Configuration

### Adding New Apps
Edit `scripts/sync-versions.js`:
```js
const APPS_TO_SYNC = [
  'apps/wms',
  'apps/website',
  'apps/your-new-app',  // Add here
]
```

### Customizing Release Notes
Edit `.github/workflows/cd.yml` → "Create GitHub Release" step

## Migration Notes

This system was implemented on 2025-10-04 to resolve version inconsistencies:
- **Before**: WMS showed v0.8.0 in UI but v0.8.1 in GitHub releases
- **After**: Single source of truth in root package.json, guaranteed consistency

All apps now sync to monorepo version: **0.8.1**

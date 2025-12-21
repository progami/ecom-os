# Dependency Audit Report

**Generated:** December 21, 2025
**Project:** ecom-os (pnpm monorepo)

---

## Executive Summary

This audit identified **14 security vulnerabilities** (10 high, 4 moderate), several outdated packages, and multiple instances of unnecessary bloat across the monorepo.

---

## 1. Security Vulnerabilities

### Critical Issues (Require Immediate Action)

| Package | Severity | Vulnerability | Affected App | Recommendation |
|---------|----------|---------------|--------------|----------------|
| `next` | HIGH | DoS with Server Components (CVE) | all apps | **Upgrade 16.0.8 → 16.0.9+** |
| `next` | MODERATE | Server Actions Source Code Exposure | all apps | **Upgrade 16.0.8 → 16.0.9+** |
| `xlsx` | HIGH | Prototype Pollution & ReDoS | wms, fcc, margin-master | **Replace with `exceljs` or upgrade to paid version** |

### High Severity

| Package | Vulnerability | Path | Recommendation |
|---------|---------------|------|----------------|
| `d3-color` | ReDoS | react-simple-maps → d3-zoom → d3-interpolate → d3-color | Update react-simple-maps or use pnpm overrides |
| `tar-fs` | Symlink validation bypass | puppeteer → @puppeteer/browsers → tar-fs | Upgrade puppeteer |
| `glob` | Command injection via CLI | wms (direct), hrms (via tailwindcss) | Upgrade to glob@11.1.0+ |
| `node-forge` | Multiple ASN.1 vulnerabilities | jason → mkcert | Upgrade mkcert or replace |
| `jws` | HMAC signature verification bypass | jason → google-auth-library → jws | Upgrade google-auth-library |

### Moderate Severity

| Package | Vulnerability | Path | Recommendation |
|---------|---------------|------|----------------|
| `csvtojson` | Prototype pollution | wms → amazon-sp-api | Upgrade amazon-sp-api or use pnpm overrides |
| `js-yaml` | Prototype pollution | jason → @eslint/eslintrc | Upgrade eslint dependencies |

---

## 2. Outdated Packages

### Root-Level Updates Required

| Package | Current | Latest | Priority |
|---------|---------|--------|----------|
| `turbo` | 2.6.1 | 2.7.1 | Medium |
| `typescript` | 5.9.2 | 5.9.3 | Low (minor) |

### App-Level Updates Required

| Package | Current | Required | Apps |
|---------|---------|----------|------|
| `next` | 16.0.8 | 16.0.9+ | all |
| `eslint-config-next` | 15.5.0 | 16.x | wms, website, jason, x-plan |

---

## 3. Unnecessary Bloat / Unused Dependencies

### apps/wms

| Package | Issue | Recommendation |
|---------|-------|----------------|
| `exceljs` | Installed but not used (xlsx is used instead) | **Remove exceljs** OR migrate from xlsx to exceljs (preferred for security) |
| `pdfkit` | Not imported in any source file | **Remove** |
| `puppeteer` | Not imported in any source file | **Remove** (saves ~100MB) |
| `morgan` | Express middleware, not used in Next.js | **Remove** |
| `express-winston` | Express middleware, not used in Next.js | **Remove** |
| `express-rate-limit` | Express middleware, not used in Next.js | **Remove** |
| `node-fetch` (dev) | Not used directly | **Remove** |
| `server-only` | Package exists but not imported anywhere | **Remove** |

### apps/jason

| Package | Issue | Recommendation |
|---------|-------|----------------|
| `isomorphic-fetch` | Not imported anywhere (native fetch available in Node.js 18+) | **Remove** |
| `mkcert` (dev) | Has vulnerable `node-forge` dependency | Consider using native HTTPS locally or system mkcert |

### apps/x-plan

| Package | Issue | Recommendation |
|---------|-------|----------------|
| `vitest` (scripts) | Test script references vitest but package not in devDependencies | Add `vitest` to devDependencies or remove test script |

### apps/archived/*

The archived apps (fcc, margin-master) still have dependencies installed. Consider:
- Moving to a separate branch or removing from monorepo
- The `xlsx` vulnerability affects these apps too

---

## 4. Duplicate Dependencies Across Apps

These packages are duplicated across multiple apps and could potentially be hoisted to shared packages:

| Package | Apps Using | Recommendation |
|---------|------------|----------------|
| `winston` + `winston-daily-rotate-file` | wms, jason, website, fcc | Create `@ecom-os/logger` that wraps winston |
| `react-hot-toast` | wms, fcc, margin-master | Consider consolidating to one toast solution |
| `recharts` | wms, jason, fcc, margin-master | Already shared, good |
| `bcryptjs` | wms, jason, fcc, margin-master, auth | Already in @ecom-os/auth |

---

## 5. Version Inconsistencies

| Package | Versions Found | Recommendation |
|---------|----------------|----------------|
| `typescript` | 5.9.2 (root), 5.9.3 (apps) | Standardize to 5.9.3 |
| `eslint` | 8.57.0 (consistent) | OK |
| `@prisma/client` | 6.19.0 (consistent) | OK |

---

## 6. Recommended Actions

### Immediate (Security)

```bash
# 1. Upgrade Next.js to fix DoS vulnerability
pnpm update next@16.0.9 --recursive

# 2. Fix glob vulnerability in wms
pnpm update glob@11.1.0 --filter @ecom-os/wms

# 3. Add pnpm overrides for transitive dependencies
# Add to root package.json:
```

```json
{
  "pnpm": {
    "overrides": {
      "d3-color": ">=3.1.0",
      "tar-fs": ">=3.1.1"
    }
  }
}
```

### Short-Term (Cleanup)

```bash
# Remove unused dependencies from wms
cd apps/wms
pnpm remove exceljs pdfkit puppeteer morgan express-winston express-rate-limit node-fetch server-only

# Remove unused dependencies from jason
cd apps/jason
pnpm remove isomorphic-fetch
```

### Medium-Term (Architecture)

1. **Replace xlsx with exceljs**: The `xlsx` package has unpatchable vulnerabilities. Migrate to `exceljs` which is already installed (but unused) in wms.

2. **Consider removing archived apps**: The `fcc` and `margin-master` apps under `apps/archived/` add complexity and security surface area.

3. **Consolidate logging**: Create a proper `@ecom-os/logger` package instead of each app installing winston directly.

---

## 7. pnpm Overrides for Transitive Vulnerabilities

Add this to the root `package.json` to patch transitive vulnerabilities:

```json
{
  "pnpm": {
    "overrides": {
      "d3-color": ">=3.1.0",
      "tar-fs": ">=3.1.1",
      "glob@>=10.2.0 <10.5.0": ">=10.5.0",
      "glob@>=11.0.0 <11.1.0": ">=11.1.0",
      "node-forge": ">=1.3.2",
      "jws": ">=4.0.1",
      "js-yaml@>=4.0.0 <4.1.1": ">=4.1.1"
    }
  }
}
```

---

## 8. Summary Statistics

| Category | Count |
|----------|-------|
| Total vulnerabilities | 14 |
| High severity | 10 |
| Moderate severity | 4 |
| Unused dependencies identified | 10 |
| Packages requiring updates | 3 |

**Estimated bundle size savings from cleanup:** ~150-200MB node_modules reduction (primarily from puppeteer removal)

---

## Next Steps

1. Apply immediate security fixes (Next.js upgrade, pnpm overrides)
2. Remove unused dependencies
3. Plan xlsx → exceljs migration
4. Evaluate archiving/removing legacy apps

# WMS File Migration Strategy

## Overview
This document outlines the strategy for migrating files from the `warehouse_management` folder into the main Ecom OS project structure, including import path updates and refactoring requirements.

## Current WMS Structure
```
warehouse_management/
├── src/
│   ├── app/                    # Next.js app directory
│   ├── components/             # React components
│   ├── lib/                    # Utilities and services
│   ├── hooks/                  # Custom React hooks
│   └── types/                  # TypeScript type definitions
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── public/                     # Static assets
└── tests/                      # Test files
```

## Target Structure in Main Project
```
ecom_os/
├── app/
│   ├── wms/                    # All WMS pages
│   │   ├── layout.tsx          # WMS-specific layout
│   │   ├── page.tsx            # WMS dashboard
│   │   ├── operations/         # Inventory operations
│   │   ├── finance/            # Financial management
│   │   ├── config/             # Configuration pages
│   │   ├── reports/            # Reporting pages
│   │   └── admin/              # Admin functions
│   └── api/
│       └── v1/
│           └── wms/            # All WMS API routes
├── components/
│   └── wms/                    # WMS-specific components
│       ├── shared/             # Shared WMS components
│       ├── inventory/          # Inventory components
│       ├── finance/            # Finance components
│       └── reports/            # Reporting components
├── lib/
│   └── wms/                    # WMS utilities
│       ├── services/           # Business logic
│       ├── utils/              # Helper functions
│       ├── hooks/              # Custom hooks
│       └── types/              # Type definitions
└── prisma/
    └── schema.prisma           # Merged schema
```

## Migration Steps

### Step 1: Prepare Migration Scripts
```bash
#!/bin/bash
# create_wms_structure.sh

# Create WMS directories in main project
mkdir -p app/wms/{operations,finance,config,reports,admin}
mkdir -p app/api/v1/wms
mkdir -p components/wms/{shared,inventory,finance,reports}
mkdir -p lib/wms/{services,utils,hooks,types}
```

### Step 2: File Movement Plan

#### Phase A: Core Library Files (No dependencies)
1. **Type Definitions**
   ```bash
   cp -r warehouse_management/src/types/* lib/wms/types/
   ```
   Update imports: `@/types/` → `@/lib/wms/types/`

2. **Utility Functions**
   ```bash
   cp -r warehouse_management/src/lib/utils/* lib/wms/utils/
   ```
   Update imports: `@/lib/utils/` → `@/lib/wms/utils/`

3. **Constants and Configurations**
   ```bash
   cp warehouse_management/src/lib/constants.ts lib/wms/
   cp warehouse_management/src/lib/config.ts lib/wms/
   ```

#### Phase B: Services and Hooks
1. **Services** (business logic)
   ```bash
   cp -r warehouse_management/src/lib/services/* lib/wms/services/
   ```
   Update:
   - Database imports to use new Prisma client
   - Import paths for types and utils

2. **Custom Hooks**
   ```bash
   cp -r warehouse_management/src/hooks/* lib/wms/hooks/
   ```
   Update:
   - Service imports
   - API endpoint paths

#### Phase C: Components
1. **Shared Components**
   ```bash
   cp -r warehouse_management/src/components/ui/* components/wms/shared/
   ```
   Update:
   - Import paths for utils and types
   - Ensure no conflicts with main project's UI components

2. **Feature Components**
   ```bash
   cp -r warehouse_management/src/components/inventory/* components/wms/inventory/
   cp -r warehouse_management/src/components/finance/* components/wms/finance/
   cp -r warehouse_management/src/components/reports/* components/wms/reports/
   ```

#### Phase D: Pages and Layouts
1. **Layout Files**
   ```bash
   cp warehouse_management/src/app/layout.tsx app/wms/layout.tsx
   ```
   Modify to:
   - Remove root layout elements (keep in main layout)
   - Add WMS-specific navigation
   - Update import paths

2. **Page Components**
   ```bash
   # Copy all page files
   cp -r warehouse_management/src/app/* app/wms/
   ```
   Update each page:
   - Import paths for components and services
   - API route paths
   - Navigation links

#### Phase E: API Routes
1. **Move API Routes**
   ```bash
   # Move all API routes to versioned structure
   cp -r warehouse_management/src/app/api/* app/api/v1/wms/
   ```
   Update:
   - Database client imports
   - Service imports
   - Response formats for consistency

### Step 3: Import Path Updates

#### Automated Import Updates
```typescript
// update_imports.ts
const importMappings = {
  '@/components/ui/': '@/components/wms/shared/',
  '@/components/': '@/components/wms/',
  '@/lib/utils': '@/lib/wms/utils',
  '@/lib/services/': '@/lib/wms/services/',
  '@/lib/': '@/lib/wms/',
  '@/hooks/': '@/lib/wms/hooks/',
  '@/types/': '@/lib/wms/types/',
  '/api/': '/api/v1/wms/',
};

// Function to update imports in a file
function updateImports(fileContent: string): string {
  let updated = fileContent;
  
  for (const [oldPath, newPath] of Object.entries(importMappings)) {
    // Update import statements
    updated = updated.replace(
      new RegExp(`from ['"]${oldPath}`, 'g'),
      `from '${newPath}`
    );
    // Update dynamic imports
    updated = updated.replace(
      new RegExp(`import\\(['"]${oldPath}`, 'g'),
      `import('${newPath}`
    );
  }
  
  return updated;
}
```

### Step 4: Configuration Updates

#### Environment Variables
Add WMS-specific variables to main `.env`:
```env
# WMS Configuration
WMS_STORAGE_CALCULATION_DAY=1  # Monday
WMS_BILLING_CYCLE_START=16
WMS_DEFAULT_TIMEZONE=Europe/London

# Amazon Integration (optional)
AMAZON_SP_APP_ID=
AMAZON_REFRESH_TOKEN=
AMAZON_MARKETPLACE_ID=A1F83G8C2ARO7P
AMAZON_REGION=eu-west-1
```

#### Database Configuration
Update Prisma schema to include WMS models with namespace prefix:
```prisma
// Main project models
model User {
  // ... existing fields
}

// WMS models (prefixed)
model WmsUser {
  // ... from warehouse_management
}

model WmsWarehouse {
  // ... from warehouse_management
}
```

### Step 5: Testing After Migration

#### Component Testing
```bash
# Test individual components render
npm run test -- components/wms/

# Test pages load correctly
npm run dev
# Navigate to each /wms/* route
```

#### API Testing
```bash
# Test API routes
curl http://localhost:3000/api/v1/wms/warehouses
curl http://localhost:3000/api/v1/wms/inventory
```

#### Build Testing
```bash
# Ensure no build errors
npm run build

# Type checking
npm run type-check
```

## Rollback Strategy

### Git-based Rollback
```bash
# Create backup branch before migration
git checkout -b backup/pre-wms-integration

# If migration fails
git checkout main
git reset --hard backup/pre-wms-integration
```

### File Backup
```bash
# Backup existing files
tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz app/ components/ lib/

# Restore if needed
tar -xzf backup_[timestamp].tar.gz
```

## Common Issues and Solutions

### Issue 1: Circular Dependencies
**Solution**: Review import structure and move shared types to common location

### Issue 2: Component Name Conflicts
**Solution**: Prefix WMS components with `Wms` (e.g., `WmsButton`, `WmsTable`)

### Issue 3: API Route Conflicts
**Solution**: Use versioned API structure (`/api/v1/wms/`)

### Issue 4: Style Conflicts
**Solution**: Scope WMS styles with `.wms-module` wrapper class

### Issue 5: Database Connection Issues
**Solution**: Ensure single Prisma client instance shared across modules

## Verification Checklist

- [ ] All files moved to correct locations
- [ ] Import paths updated in all files
- [ ] No TypeScript errors
- [ ] All tests passing
- [ ] Build succeeds
- [ ] All pages load correctly
- [ ] API endpoints responding
- [ ] No console errors in browser
- [ ] Navigation works between modules
- [ ] Authentication flow works

## Post-Migration Cleanup

1. Remove `warehouse_management` folder
2. Update documentation
3. Remove old import aliases from tsconfig
4. Clean up unused dependencies
5. Update CI/CD configurations
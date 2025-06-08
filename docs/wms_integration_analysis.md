# WMS Integration Analysis - Phase 1

## 1. Database Schema Integration Points

### Current Main Project Schema
- **CategorizationRule**: Bookkeeping module for Xero integration
- **Basic WMS models**: Warehouse, Product, InventoryLog (simplified versions)

### WMS Schema (warehouse_management)
The WMS has a comprehensive schema with 12+ models including:
- **User** (auth/roles)
- **Warehouse**, **Sku**, **SkuVersion**
- **InventoryTransaction**, **InventoryBalance**
- **CostRate**, **CalculatedCost**, **StorageLedger**
- **Invoice**, **InvoiceReconciliation**
- **WarehouseSkuConfig**, **AuditLog**

### Key Integration Challenges

1. **Model Name Conflicts**:
   - Main: `Warehouse` (basic) vs WMS: `Warehouse` (comprehensive)
   - Main: `Product` vs WMS: `Sku` (more detailed)
   - Main: `InventoryLog` vs WMS: `InventoryTransaction` (immutable ledger)

2. **Schema Design Differences**:
   - WMS uses immutable ledger pattern with triggers
   - WMS has comprehensive audit logging
   - WMS includes financial/billing models
   - WMS has user management built-in

3. **Database Features**:
   - WMS likely uses PostgreSQL triggers for immutability
   - Complex indexes for performance
   - JSONB fields for flexible data

## 2. Dependencies Analysis

### Shared Dependencies (Compatible Versions)
```json
{
  "next": "14.2.3" (main) vs "14.1.3" (WMS) - Minor update needed
  "react": "^18" - Compatible
  "react-dom": "^18" - Compatible
  "@prisma/client": "^5.11.0" - Exact match ✓
  "prisma": "^5.11.0" - Exact match ✓
  "next-auth": "^4.24.7" - Exact match ✓
  "@radix-ui/*": Similar versions, compatible
  "lucide-react": "^0.378.0" vs "^0.356.0" - Minor update
  "tailwind-merge": "^2.3.0" vs "^2.2.1" - Compatible
}
```

### WMS-Specific Dependencies to Add
```json
{
  // Data handling
  "@tanstack/react-query": "^5.28.4" - State management
  "@tanstack/react-table": "^8.13.2" - Table components
  "react-hook-form": "^7.51.0" - Form handling
  "@hookform/resolvers": "^3.3.4" - Form validation
  "zod": "^3.22.4" - Schema validation
  
  // UI Components
  "@radix-ui/react-accordion": "^1.1.2"
  "@radix-ui/react-alert-dialog": "^1.0.5"
  "@radix-ui/react-dialog": "^1.0.5"
  "@radix-ui/react-tabs": "^1.0.4"
  "@radix-ui/react-toast": "^1.1.5"
  "react-hot-toast": "^2.4.1"
  
  // Data visualization
  "recharts": "^2.12.2" - Charts/graphs
  
  // File handling
  "xlsx": "^0.18.5" - Excel import/export
  "jspdf": "^3.0.1" - PDF generation
  "csv-parse": "^5.6.0" - CSV parsing
  
  // Date handling
  "date-fns": "^3.3.1"
  "date-fns-tz": "^3.2.0"
  
  // Financial calculations
  "decimal.js": "^10.5.0"
  
  // Amazon integration
  "amazon-sp-api": "^1.1.6"
  
  // Background jobs
  "bullmq": "^5.4.2" - Queue management
  
  // Security
  "bcryptjs": "^2.4.3" - Password hashing
}
```

### Potential Conflicts
1. **Next.js versions**: Minor version difference (14.2.3 vs 14.1.3)
2. **Lucide-react**: Different versions but should be compatible
3. **Testing frameworks**: WMS has comprehensive Jest setup not in main

## 3. Integration Strategy

### Approach: Namespace Separation
Instead of trying to merge conflicting models, we'll:
1. Keep WMS models in a separate namespace/prefix
2. Gradually migrate main project's basic WMS models to use the comprehensive ones
3. Maintain backward compatibility during transition

### Proposed Schema Organization
```prisma
// Bookkeeping models (unchanged)
model CategorizationRule { ... }

// WMS models (prefixed to avoid conflicts)
model WmsUser { ... }
model WmsWarehouse { ... }
model WmsSku { ... }
model WmsInventoryTransaction { ... }
// ... etc

// Temporary: Keep simple models for now
model Warehouse { ... } // Will migrate to WmsWarehouse
model Product { ... }   // Will migrate to WmsSku
model InventoryLog { ... } // Will migrate to WmsInventoryTransaction
```

### File Structure Plan
```
/app/
  /wms/                    # WMS pages
    /operations/          # From warehouse_management/src/app/
    /finance/
    /config/
    /reports/
    /admin/
  /api/
    /v1/
      /wms/              # WMS API routes
        /inventory/
        /products/
        /warehouses/
        /finance/
        /reports/
/components/
  /wms/                  # WMS-specific components
    /inventory/
    /finance/
    /shared/
/lib/
  /wms/                  # WMS utilities
    /services/
    /utils/
    /hooks/
```

## 4. Risk Assessment

### High Risk Areas
1. **Database Migration**: Complex schema with triggers and constraints
2. **Authentication Integration**: User roles and permissions
3. **Data Integrity**: Immutable ledger pattern must be preserved
4. **Performance**: Complex queries and indexes

### Medium Risk Areas
1. **UI Consistency**: Different component patterns
2. **State Management**: React Query integration
3. **File Processing**: Excel/CSV/PDF generation

### Low Risk Areas
1. **Static Components**: UI components should transfer easily
2. **Utility Functions**: Most utilities are self-contained
3. **API Routes**: RESTful endpoints can be relocated

## 5. Testing Strategy

### Unit Tests
- Test each WMS service function independently
- Verify calculations (costs, storage, etc.)
- Test data validation rules

### Integration Tests
- Database schema compatibility
- API endpoint functionality
- Authentication flow
- Cross-module navigation

### E2E Tests
- Complete warehouse operations flow
- Financial calculations and invoicing
- Report generation
- Data import/export

## 6. Migration Checklist

### Pre-Migration
- [ ] Full database backup
- [ ] Document current WMS configuration
- [ ] Create feature branch
- [ ] Set up test environment

### Migration Steps
- [ ] Merge package.json dependencies
- [ ] Create combined Prisma schema
- [ ] Generate and test migrations
- [ ] Move API routes
- [ ] Move page components
- [ ] Move shared components
- [ ] Update import paths
- [ ] Configure authentication
- [ ] Test all features

### Post-Migration
- [ ] Performance testing
- [ ] Security audit
- [ ] Update documentation
- [ ] Train users on new structure

## Next Steps
1. Create detailed migration scripts
2. Set up test database with combined schema
3. Build integration test suite
4. Create rollback procedures
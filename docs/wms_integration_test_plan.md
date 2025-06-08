# WMS Integration Test Plan

## Overview
This test plan ensures the safe and complete integration of the warehouse_management system into the main Ecom OS project. Tests are organized by priority and risk level.

## Test Environment Setup

### Prerequisites
1. **Test Database**: Separate PostgreSQL instance for integration testing
2. **Test Data**: Seed data covering all WMS scenarios
3. **Environment Variables**: Complete .env.test configuration
4. **CI/CD Pipeline**: Automated test execution on commits

### Test Data Requirements
- 3 test warehouses (different configurations)
- 50+ test SKUs (various categories and dimensions)
- 1000+ inventory transactions (all types)
- 6 months of historical data
- Multiple test users (admin and staff roles)

## Phase 1: Database Integration Tests

### 1.1 Schema Compatibility Tests
```typescript
describe('Database Schema Integration', () => {
  test('All WMS tables create successfully', async () => {
    // Run migration
    // Verify all tables exist
    // Check indexes and constraints
  });

  test('No naming conflicts between modules', async () => {
    // Verify table names are unique
    // Check for column conflicts
    // Validate foreign key relationships
  });

  test('Triggers and functions work correctly', async () => {
    // Test immutable ledger triggers
    // Verify audit log triggers
    // Check calculated fields
  });
});
```

### 1.2 Data Migration Tests
```typescript
describe('Data Migration', () => {
  test('Existing warehouse data migrates correctly', async () => {
    // Migrate from simple Warehouse to WmsWarehouse
    // Verify all fields map correctly
    // Check relationships preserved
  });

  test('Product to SKU migration', async () => {
    // Map Product fields to Sku model
    // Handle missing required fields
    // Preserve existing relationships
  });

  test('InventoryLog to InventoryTransaction migration', async () => {
    // Convert log entries to transactions
    // Calculate running balances
    // Verify data integrity
  });
});
```

### 1.3 Performance Tests
```typescript
describe('Database Performance', () => {
  test('Query performance with large datasets', async () => {
    // Test inventory balance calculations
    // Measure transaction insert speed
    // Check index effectiveness
  });

  test('Concurrent transaction handling', async () => {
    // Simulate multiple users
    // Test deadlock prevention
    // Verify data consistency
  });
});
```

## Phase 2: API Integration Tests

### 2.1 Authentication Tests
```typescript
describe('Authentication Integration', () => {
  test('NextAuth works with WMS user model', async () => {
    // Login with WMS credentials
    // Verify session creation
    // Check role-based access
  });

  test('Cross-module authentication', async () => {
    // Login once, access all modules
    // Verify session sharing
    // Test permission boundaries
  });
});
```

### 2.2 API Endpoint Tests
```typescript
describe('WMS API Endpoints', () => {
  test('Inventory endpoints', async () => {
    // GET /api/v1/wms/inventory
    // POST /api/v1/wms/inventory/transaction
    // GET /api/v1/wms/inventory/balance
  });

  test('Financial endpoints', async () => {
    // GET /api/v1/wms/invoices
    // POST /api/v1/wms/invoices/reconcile
    // GET /api/v1/wms/costs/calculate
  });

  test('Reporting endpoints', async () => {
    // GET /api/v1/wms/reports/inventory
    // GET /api/v1/wms/reports/financial
    // POST /api/v1/wms/reports/export
  });
});
```

### 2.3 Business Logic Tests
```typescript
describe('Business Logic Integrity', () => {
  test('Inventory calculations remain accurate', async () => {
    // Test running balance calculations
    // Verify FIFO/batch tracking
    // Check unit conversions
  });

  test('Cost calculations work correctly', async () => {
    // Weekly storage cost calculations
    // Monthly billing periods (16th-15th)
    // Cost rate applications
  });

  test('Immutable ledger enforcement', async () => {
    // Attempt to modify past transactions
    // Verify rejection with proper errors
    // Check audit trail creation
  });
});
```

## Phase 3: UI Integration Tests

### 3.1 Component Rendering Tests
```typescript
describe('WMS UI Components', () => {
  test('All WMS pages render without errors', async () => {
    // Test each route under /wms/*
    // Verify component mounting
    // Check for console errors
  });

  test('Data tables work with new structure', async () => {
    // Load inventory table
    // Test sorting and filtering
    // Verify pagination
  });

  test('Forms submit correctly', async () => {
    // Test receive goods form
    // Test ship goods form
    // Verify validation works
  });
});
```

### 3.2 Navigation Tests
```typescript
describe('Cross-Module Navigation', () => {
  test('Main navigation includes WMS', async () => {
    // Verify WMS menu items
    // Test navigation links
    // Check breadcrumbs
  });

  test('Deep linking works', async () => {
    // Direct access to WMS pages
    // Bookmark functionality
    // Back button behavior
  });
});
```

### 3.3 State Management Tests
```typescript
describe('React Query Integration', () => {
  test('Data caching works correctly', async () => {
    // Load inventory data
    // Navigate away and back
    // Verify cache hit
  });

  test('Optimistic updates function', async () => {
    // Submit transaction
    // Check immediate UI update
    // Verify server sync
  });

  test('Error handling and recovery', async () => {
    // Simulate network errors
    // Test retry logic
    // Verify error messages
  });
});
```

## Phase 4: Integration Flow Tests

### 4.1 End-to-End Workflows
```typescript
describe('Complete Workflows', () => {
  test('Receive goods workflow', async () => {
    // Login as warehouse user
    // Navigate to receive goods
    // Enter shipment details
    // Submit and verify inventory update
    // Check audit log entry
  });

  test('Monthly billing workflow', async () => {
    // Generate monthly invoice
    // Review line items
    // Perform reconciliation
    // Export to PDF
    // Mark as paid
  });

  test('Amazon FBA sync workflow', async () => {
    // Configure FBA credentials
    // Initiate sync
    // Compare inventory levels
    // Review discrepancies
    // Generate report
  });
});
```

### 4.2 Data Import/Export Tests
```typescript
describe('Data Import/Export', () => {
  test('Excel import functionality', async () => {
    // Upload inventory Excel file
    // Validate data mapping
    // Process import
    // Verify database updates
  });

  test('Report generation', async () => {
    // Generate inventory report
    // Export to Excel/CSV/PDF
    // Verify data accuracy
    // Check formatting
  });
});
```

## Phase 5: Security Tests

### 5.1 Access Control Tests
```typescript
describe('Security and Permissions', () => {
  test('Role-based access enforcement', async () => {
    // Test admin-only features
    // Verify staff limitations
    // Check warehouse-specific access
  });

  test('Data isolation between warehouses', async () => {
    // Login as warehouse A user
    // Verify cannot see warehouse B data
    // Test API-level enforcement
  });

  test('Sensitive data protection', async () => {
    // Verify password hashing
    // Check API key encryption
    // Test audit log security
  });
});
```

## Test Execution Strategy

### Continuous Integration
1. **Pre-commit**: Linting and type checking
2. **Pull Request**: Unit and integration tests
3. **Pre-merge**: Full test suite including E2E
4. **Post-deployment**: Smoke tests in production

### Test Priorities
1. **Critical (P0)**: Database integrity, authentication, core inventory operations
2. **High (P1)**: Financial calculations, API endpoints, data import/export
3. **Medium (P2)**: UI consistency, reporting, Amazon integration
4. **Low (P3)**: Edge cases, performance optimization

### Success Criteria
- All P0 tests must pass before proceeding
- 95% of P1 tests passing
- 90% of P2 tests passing
- Document all known issues for P3

## Rollback Testing

### Rollback Scenarios
1. **Database rollback**: Test migration reversal
2. **Code rollback**: Git revert procedures
3. **Partial rollback**: Module-specific rollback

### Recovery Procedures
```bash
# Database rollback
prisma migrate rollback

# Code rollback
git revert [commit-hash]

# Data recovery
psql -f backup_[timestamp].sql
```

## Monitoring and Validation

### Post-Integration Monitoring
1. **Performance metrics**: Response times, query performance
2. **Error rates**: Track new errors in logs
3. **User activity**: Monitor usage patterns
4. **Data integrity**: Scheduled consistency checks

### Validation Checkpoints
- [ ] All tests passing in CI/CD
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] User acceptance testing done
- [ ] Documentation updated
- [ ] Training materials ready
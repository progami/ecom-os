# Performance Analysis Report

**Date:** 2025-12-21
**Branch:** `claude/find-perf-issues-mjga99ocz9f1scyy-TsjM1`

This document identifies performance anti-patterns, N+1 queries, unnecessary re-renders, and inefficient algorithms found in the codebase.

---

## Table of Contents

1. [N+1 Query Issues](#n1-query-issues)
2. [React Performance Anti-Patterns](#react-performance-anti-patterns)
3. [Inefficient Algorithms](#inefficient-algorithms)
4. [Summary & Priority Matrix](#summary--priority-matrix)

---

## N+1 Query Issues

### 1. SKU Service - Inventory Levels Per SKU (CRITICAL)

**File:** `apps/wms/src/services/sku.service.ts`
**Lines:** 237-239, 299-333

**Problem:** For each SKU fetched, two additional database queries are executed inside `addInventoryLevels()`.

```typescript
// Line 237-239: Executes addInventoryLevels for EACH SKU
const skusWithInventory = await Promise.all(
  skus.map(sku => this.addInventoryLevels(sku))
)

// Lines 299-333: Each call executes TWO queries
private async addInventoryLevels(sku: Sku): Promise<SkuWithInventory> {
  // Query 1: groupBy for transaction types
  const transactions = await this.prisma.inventoryTransaction.groupBy({
    by: ['transactionType'],
    where: { skuCode: sku.skuCode },
    ...
  })

  // Query 2: findFirst for last activity
  const lastActivity = await this.prisma.inventoryTransaction.findFirst({
    where: { skuCode: sku.skuCode },
    ...
  })
}
```

**Impact:** Fetching 50 SKUs = 100 database queries (2 per SKU) instead of 2 batched queries.

**Fix:** Batch all SKU codes and execute two queries total:
1. One `groupBy` with `skuCode` in the `by` clause
2. One `findMany` with `distinct` on `skuCode` ordered by `transactionDate desc`

---

### 2. HRMS Notification Service - Profile Completion Check (CRITICAL)

**File:** `apps/hrms/lib/notification-service.ts`
**Lines:** 419-455

**Problem:** First fetches all employee IDs, then re-fetches each employee individually in a loop.

```typescript
export async function runProfileCompletionCheckForAll() {
  // Query 1: Get all employee IDs
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  })

  for (const emp of employees) {
    // Query N+1: Refetch ENTIRE employee for each iteration
    const employee = await prisma.employee.findUnique({
      where: { id: emp.id },
      select: { id: true, firstName: true, phone: true, ... },
    })
    // ...
  }
}
```

**Impact:** 100 active employees = 101 queries instead of 1.

**Fix:** Fetch all required fields in the initial `findMany` query.

---

### 3. WMS Transactions Route - Item Validation Loop (CRITICAL)

**File:** `apps/wms/src/app/api/transactions/route.ts`
**Lines:** 706-767

**Problem:** For each item in a transaction, up to 3 separate queries are executed.

```typescript
for (const item of validatedItems) {
  // Query 1: Find SKU
  const sku = await prisma.sku.findFirst({
    where: { skuCode: item.skuCode }
  })

  if (['RECEIVE', 'ADJUST_IN'].includes(txType)) {
    // Query 2: Find batch record
    const batchRecord = await prisma.skuBatch.findFirst({
      where: { skuId: sku.id, batchCode: item.batchLot, isActive: true },
    })
  }

  if (['SHIP', 'ADJUST_OUT'].includes(txType)) {
    // Query 3: Find all transactions for inventory check
    const transactions = await prisma.inventoryTransaction.findMany({
      where: { warehouseCode, skuCode: sku.skuCode, batchLot: item.batchLot }
    })
  }
}
```

**Impact:** 10 items = 10-30 queries instead of 3 batched queries.

**Fix:**
1. Collect all SKU codes upfront
2. Batch fetch all SKUs with `findMany({ where: { skuCode: { in: skuCodes } } })`
3. Create a Map for O(1) lookup
4. Similarly batch batch records and inventory transactions

---

### 4. WMS Transactions Route - Movement Note Processing (HIGH)

**File:** `apps/wms/src/app/api/transactions/route.ts`
**Lines:** 614-698

**Problem:** Nested loop queries SKU for each movement note line.

```typescript
for (const note of movementNotes) {
  for (const line of note.lines) {
    // Query inside nested loop
    const sku = await tx.sku.findFirst({
      where: { skuCode: poLine.skuCode }
    })
  }
}
```

**Impact:** 50 movement note lines = 50 individual SKU queries.

**Fix:** Pre-fetch all required SKUs before the loop using `findMany` with `in` filter.

---

### 5. HRMS Hierarchy Route - Manager Chain Lookup (MEDIUM)

**File:** `apps/hrms/app/api/hierarchy/route.ts`
**Lines:** 69-95

**Problem:** While loop fetches one manager at a time up the chain.

```typescript
while (currentId) {
  const emp = await prisma.employee.findUnique({
    where: { id: currentId },
    select: { id: true, reportsToId: true, ... },
  })
  currentId = emp.reportsToId
}
```

**Impact:** 5-level hierarchy = 5 separate queries.

**Fix:** Use a recursive CTE query or fetch all employees once and traverse in-memory.

---

## React Performance Anti-Patterns

### 1. Inline Function Definitions in JSX Props (HIGH)

**Files affected:** Multiple components in `apps/archived/fcc/`

**Problem:** Arrow functions created on every render break memoization.

```typescript
// apps/archived/fcc/app/(authenticated)/bookkeeping/page.tsx
<Button onClick={() => router.push('/reports/profit-loss')}>View Report</Button>
<Button onClick={() => router.push('/reports/balance-sheet')}>View Report</Button>
<Button onClick={() => router.push('/reports/cash-flow')}>View Report</Button>
```

**Impact:** Child components cannot optimize with `React.memo()` because props change every render.

**Fix:** Use `useCallback` for stable function references:
```typescript
const handleProfitLoss = useCallback(() => router.push('/reports/profit-loss'), [router])
```

---

### 2. Index as Key in Dynamic Lists (HIGH)

**Files affected:**
- `apps/archived/fcc/app/(authenticated)/bookkeeping/page.tsx:275`
- `apps/archived/fcc/app/(authenticated)/finance/page.tsx:390`
- `apps/archived/fcc/app/(authenticated)/cashflow/page.tsx:254,447`
- `apps/archived/fcc/app/(authenticated)/analytics/page.tsx:243,438`

**Problem:** Using array index as key breaks React's reconciliation.

```typescript
{[...Array(4)].map((_, i) => <SkeletonMetricCard key={i} />)}
{alerts.map((alert, index) => <tr key={index}>...)}
```

**Impact:** When items are reordered/removed, React may recycle wrong components, causing incorrect state.

**Fix:** Use unique identifiers (e.g., `alert.id`) or generate stable keys.

---

### 3. Object/Array Literals in Render (MEDIUM)

**Files affected:**
- `apps/jason/app/page.tsx:19,36,50,64,81,123`
- `apps/archived/fcc/app/(authenticated)/bookkeeping/page.tsx:274`

**Problem:** Inline objects/arrays create new references every render.

```typescript
// New object reference every render
<div style={{animationDelay: '0.1s'}}>

// New array reference every render
{[...Array(4)].map((_, i) => <SkeletonMetricCard key={i} />)}
```

**Fix:** Extract to constants or use `useMemo`:
```typescript
const SKELETON_COUNT = 4
const skeletonItems = useMemo(() => Array(SKELETON_COUNT).fill(null), [])
```

---

### 4. Missing useMemo for Expensive Computations (MEDIUM)

**File:** `apps/archived/fcc/app/(authenticated)/bookkeeping/page.tsx`

**Problem:** Expensive array operations in render without memoization.

```typescript
// These run on every render
const total = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
const needsAttention = accounts.filter(acc => acc.unreconciledTransactions > 10).length
```

**Fix:** Wrap with `useMemo`:
```typescript
const { total, needsAttention } = useMemo(() => ({
  total: accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0),
  needsAttention: accounts.filter(acc => acc.unreconciledTransactions > 10).length
}), [accounts])
```

---

### 5. Context Providers Without Memoization (MEDIUM)

**Files:**
- `apps/archived/fcc/contexts/AuthContext.tsx`
- `apps/archived/fcc/contexts/ThemeContext.tsx`

**Problem:** Context value objects recreated every render, triggering all consumers to re-render.

```typescript
// ThemeContext.tsx - value object recreated every render
<ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
```

**Fix:** Memoize the context value:
```typescript
const contextValue = useMemo(() => ({ theme, setTheme, resolvedTheme }), [theme, resolvedTheme])
```

---

## Inefficient Algorithms

### 1. O(n²) Array Operations in Inventory Filter (CRITICAL)

**File:** `apps/wms/src/hooks/useInventoryFilters.ts`
**Lines:** 278, 285, 299, 304

**Problem:** Using `.includes()` on arrays inside a filter loop.

```typescript
const filtered = balances.filter(balance => {
  // O(m) lookup for each of n items = O(n*m)
  if (!columnFilters.warehouse.includes(warehouseIdentifier)) return false
  if (!columnFilters.sku.includes(skuCode)) return false
  if (!columnFilters.batch.includes(batchLot)) return false
  if (!columnFilters.movement.includes(movementType)) return false
})
```

**Impact:** With 1000 balances and 100 filter values, this is O(100,000) operations.

**Fix:** Convert filter arrays to Sets before the loop:
```typescript
const warehouseSet = useMemo(() => new Set(columnFilters.warehouse), [columnFilters.warehouse])
// Then use warehouseSet.has(warehouseIdentifier) for O(1) lookup
```

---

### 2. Redundant Array Filtering (HIGH)

**File:** `packages/ledger/src/inventory.ts`
**Lines:** 120, 132

**Problem:** Same array filtered twice with identical conditions.

```typescript
// Line 120
balanceArray = balanceArray.filter(balance => balance.currentCartons > 0)

// Line 132 - redundant filter on already-filtered array
const batchesWithInventory = balanceArray.filter(balance => balance.currentCartons > 0).length
```

**Fix:** Use `balanceArray.length` after the first filter instead of filtering again.

---

### 3. Multiple Sequential Filters on Same Array (HIGH)

**File:** `apps/wms/src/app/api/export/missing-attributes/route.ts`
**Lines:** 145-149

**Problem:** Array filtered 5 times independently.

```typescript
['RECEIVE:', missingData.filter(t => t.transactionType === 'RECEIVE').length],
['SHIP:', missingData.filter(t => t.transactionType === 'SHIP').length],
['ADJUST_IN:', missingData.filter(t => t.transactionType === 'ADJUST_IN').length],
['ADJUST_OUT:', missingData.filter(t => t.transactionType === 'ADJUST_OUT').length],
['TRANSFER:', missingData.filter(t => t.transactionType === 'TRANSFER').length]
```

**Impact:** O(5n) instead of O(n).

**Fix:** Use a single reduce to group by transaction type:
```typescript
const countsByType = missingData.reduce((acc, t) => {
  acc[t.transactionType] = (acc[t.transactionType] || 0) + 1
  return acc
}, {} as Record<string, number>)
```

---

### 4. Duplicate Database Query (MEDIUM)

**File:** `apps/hrms/app/api/dashboard/route.ts`
**Lines:** 95-100, 192-198

**Problem:** Notifications queried twice with identical parameters.

```typescript
// First query in Promise.all
prisma.notification.findMany({ where: {...}, orderBy: {...}, take: 10 })

// Second identical query after cleanup
const freshNotifications = await prisma.notification.findMany({ where: {...}, orderBy: {...}, take: 10 })
```

**Fix:** Only query once after the cleanup operation completes.

---

### 5. Multiple Filters for Counts (MEDIUM)

**File:** `apps/wms/src/app/operations/pallet-variance/page.tsx`
**Lines:** 151-153

**Problem:** Same array filtered 3 times.

```typescript
const positiveCount = variances.filter(v => v.variance > 0).length
const negativeCount = variances.filter(v => v.variance < 0).length
const pendingCount = variances.filter(v => v.status === 'PENDING').length
```

**Fix:** Use single reduce pass:
```typescript
const { positiveCount, negativeCount, pendingCount } = variances.reduce((acc, v) => {
  if (v.variance > 0) acc.positiveCount++
  else if (v.variance < 0) acc.negativeCount++
  if (v.status === 'PENDING') acc.pendingCount++
  return acc
}, { positiveCount: 0, negativeCount: 0, pendingCount: 0 })
```

---

## Summary & Priority Matrix

| Issue | Location | Severity | Category | Est. Impact |
|-------|----------|----------|----------|-------------|
| SKU inventory N+1 queries | `sku.service.ts:237-333` | CRITICAL | N+1 Query | 50 SKUs = 100 queries |
| Transaction item validation N+1 | `transactions/route.ts:706-767` | CRITICAL | N+1 Query | 10 items = 30 queries |
| O(n²) inventory filter | `useInventoryFilters.ts:278-304` | CRITICAL | Algorithm | 1000 items = 100k ops |
| HRMS profile check N+1 | `notification-service.ts:419-455` | CRITICAL | N+1 Query | 100 employees = 101 queries |
| Movement note SKU N+1 | `transactions/route.ts:614-698` | HIGH | N+1 Query | 50 lines = 50 queries |
| Redundant array filters | `inventory.ts`, `missing-attributes/route.ts` | HIGH | Algorithm | 5x unnecessary iterations |
| Index as React key | Multiple fcc components | HIGH | React | Incorrect reconciliation |
| Inline onClick handlers | Multiple fcc components | HIGH | React | Breaks memoization |
| Manager chain N+1 | `hierarchy/route.ts:69-95` | MEDIUM | N+1 Query | 5 queries per lookup |
| Missing useMemo/useCallback | Multiple components | MEDIUM | React | Unnecessary re-renders |
| Context value recreation | AuthContext, ThemeContext | MEDIUM | React | All consumers re-render |
| Duplicate DB queries | `dashboard/route.ts` | MEDIUM | Query | 2x unnecessary queries |

### Recommended Fix Order

1. **Critical N+1 Queries** - These have the highest impact on database load
   - SKU service inventory levels
   - Transaction item validation
   - HRMS profile completion check

2. **Critical Algorithm Issues** - O(n²) becomes problematic at scale
   - Inventory filter with array includes

3. **High Priority** - Significant but less frequent
   - Movement note processing
   - Redundant array filters
   - React key issues (prevents bugs)

4. **Medium Priority** - Optimization improvements
   - Manager chain lookup
   - React memoization
   - Context optimization

---

## Notes

- Most React issues are in `apps/archived/fcc/` which may be deprecated
- Active apps (WMS, HRMS, X-Plan) should prioritize N+1 fixes
- The `useInventoryFilters` O(n²) issue is in active WMS code and should be addressed

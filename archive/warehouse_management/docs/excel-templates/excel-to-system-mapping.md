# Excel to System Mapping

## Sheet Mapping

### Excel: "inventory ledger" → System: InventoryTransaction table
The Excel "inventory ledger" sheet contains all warehouse movements (RECEIVE, SHIP, etc). In our system, this maps to the `InventoryTransaction` table.

**Excel Columns → System Fields:**
- `Transaction_ID` → `transactionId`
- `Warehouse` → `warehouseId` (via warehouse lookup)
- `SKU` → `skuId` (via SKU lookup)
- `Shipment` → `batchLot` (batch/lot identifier)
- `Transaction_Type` → `transactionType` (RECEIVE, SHIP, etc)
- `Reference_ID (Email tag)` → `referenceId`
- `Cartons_In` → `cartonsIn`
- `Cartons_Out` → `cartonsOut`
- `storage_pallets_in` → `storagePalletsIn` (user-entered actual value)
- `shipping_pallets_out` → `shippingPalletsOut` (user-entered actual value)

**New System Fields (not in Excel):**
- `calculatedStoragePalletsIn` - System calculated value based on config
- `calculatedShippingPalletsOut` - System calculated value based on config
- `palletVarianceNotes` - Auto-generated notes when actual ≠ calculated
- `storageCartonsPerPallet` - Batch-specific configuration
- `shippingCartonsPerPallet` - Batch-specific configuration
- `pickupDate` - Actual pickup date (separate from transaction date)
- `isReconciled` - Whether pickup date has been confirmed
- `shipName` - Name of the ship (for receiving)
- `containerNumber` - Container number (for receiving)
- `attachments` - Document attachments as JSONB

### Excel: "inventory balance" → System: InventoryBalance table
Current stock levels by warehouse, SKU, and batch.

### Excel: "storage ledger" → System: StorageLedger table
Weekly storage charges calculation.

### Excel: "cost master" → System: CostRate table
All cost rates for different warehouses and activities.

## Key Differences

### 1. Pallet Tracking
**Excel**: Only tracks user-entered pallet counts
**System**: Tracks both:
- User-entered actual pallets (what warehouse reported)
- System-calculated pallets (based on cartons ÷ config)
- Variance tracking with automatic notes

### 2. Currency
**Excel**: May use various symbols
**System**: All values in GBP (£)

### 3. Amazon Storage
**Excel**: Not clear how Amazon is handled
**System**: 
- Amazon uses cubic feet instead of pallets
- Billing is monthly (not weekly like other warehouses)
- Seasonal rates (Jan-Sep vs Oct-Dec)

### 4. Batch Configuration
**Excel**: Uses global warehouse config
**System**: Batch-specific pallet configurations captured at receipt

## Data Flow

1. **Receive Goods**
   - User enters cartons and actual pallets
   - System calculates expected pallets
   - Both values stored with variance notes

2. **Ship Goods**
   - User enters cartons and actual pallets shipped
   - System uses batch-specific config from inventory
   - Variance tracked if actual ≠ calculated

3. **Storage Calculation**
   - Weekly snapshots on Mondays
   - Regular warehouses: pallets × weekly rate
   - Amazon: cubic feet × monthly rate ÷ 4.33
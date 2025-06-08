# Inventory Ledger Import Scripts

This directory contains scripts for importing inventory data from Excel files.

## Main Import Scripts

### `import-inventory-ledger.ts`
Imports complete inventory transactions from the Excel inventory ledger sheet.
- Parses transaction types from the Description column
- Handles both storage and shipping pallets
- Creates proper batch/lot assignments
- Generates inventory balances

### `reimport-inventory-with-pallets.ts`
Enhanced version that correctly handles pallet calculations:
- Uses warehouse-specific pallet configurations
- Calculates pallets based on cartons and cartons-per-pallet settings
- Updates existing transactions with corrected pallet counts

### `import-excel-data.ts`
General purpose Excel import script for various data types.

## Helper Scripts

### `add-transaction-completeness-tracking.ts`
Adds fields to track transaction completeness and missing attributes.

### `create-sample-skus.ts`
Creates sample SKU data for testing.

### `delete-dummy-skus.ts`
Removes test/dummy SKUs from the database.

### `fix-storage-ledger-*.ts`
Scripts to fix storage ledger configurations and calculations.

## Usage

```bash
# Import inventory ledger
npx tsx scripts/import-inventory-ledger.ts

# Re-import with correct pallet calculations
npx tsx scripts/reimport-inventory-with-pallets.ts
```
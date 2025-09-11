# FBA Fees Excel Import Process

## Overview
The FBA fees data is imported from an Excel file (`data/amazon_fee.xlsx`) that contains multiple sheets with different fee structures.

## Excel File Structure

### Sheet: `standard`
Standard FBA fulfillment fees with the following columns:
- `SizeTierName`: Size tier category (e.g., "Light envelope", "Standard parcel")
- `LengthLimit_cm`: Maximum length in cm
- `WidthLimit_cm`: Maximum width in cm  
- `HeightLimit_cm`: Maximum height in cm
- `TierUnitWeightLimit_kg`: (optional) Unit weight limit
- `TierDimWeightLimit_kg`: (optional) Dimensional weight limit
- `RateWeight_LowerBound_kg`: Lower bound of weight range
- `RateWeight_UpperBound_kg`: Upper bound of weight range
- `Marketplace`: Marketplace code (e.g., "UK", "US", "DE")
- `Currency`: Currency code (e.g., "GBP", "USD", "EUR")
- `Fee`: Fee amount

### Sheet: `lowprice`
Low-price FBA fees with columns:
- `ProgramName`: Program name (typically "Low-Price FBA")
- Same dimension and fee columns as standard sheet

### Sheet: `sipp`
SIPP (Ships in Plain Packaging) discount fees:
- `ProgramName`: Program name
- `SizeTierName`: Size tier
- `RateWeight_LowerBound_kg`: Weight range lower bound
- `RateWeight_UpperBound_kg`: Weight range upper bound
- `Marketplace`: Marketplace code
- `Currency`: Currency code
- `Discount`: Discount amount

### Sheet: `storage`
Storage fees by marketplace and product size

### Sheet: `referral`
Referral fees by product category

### Sheet: `lowinventoryfee`
Low inventory level fees

## Import Process

1. **Restore Excel file** (if missing):
   ```bash
   git checkout bd4eb335 -- data/amazon_fee.xlsx
   ```

2. **Run import script**:
   ```bash
   npx tsx scripts/import-excel.ts
   ```

3. **Verify import**:
   ```bash
   npx tsx scripts/check-fba-data.ts
   ```

## Expected Data Format

### Size Tiers (sorted order):
1. Light envelope (33 × 23 × 2.5 cm)
2. Standard envelope (33 × 23 × 2.5 cm)
3. Large envelope (33 × 23 × 4 cm)
4. Extra-large envelope (33 × 23 × 6 cm)
5. Small envelope (20 × 15 × 1 cm)
6. Small parcel (35 × 25 × 12 cm)
7. Standard parcel (45 × 34 × 26 cm)

### Marketplaces:
- UK (United Kingdom)
- US (United States)
- DE (Germany)
- FR (France)
- IT (Italy)
- ES (Spain)
- BE (Belgium)
- NL (Netherlands)
- PL (Poland)
- SE (Sweden)
- IE (Ireland)
- CEP (DE/PL/CZ) - Central European Program
- DE Only - Germany only (non-CEP)

## Common Issues

1. **Wrong table names**: The import script uses legacy table names:
   - `storageFeesLegacy` (not `storageFees`)
   - `referralFeesLegacy` (not `referralFees`)

2. **Size tier sorting**: The app expects normalized size tier names (e.g., "LIGHT_ENVELOPE") but Excel contains human-readable names (e.g., "Light envelope"). The sorting function handles this mapping.

3. **Missing Excel file**: If the Excel file is deleted during cleanup, restore it from git history.

## Database Schema

The imported data populates these Prisma models:
- `StandardFees`: Standard FBA fulfillment fees
- `LowPriceFees`: Low-price FBA program fees  
- `SippDiscounts`: SIPP program discounts
- `StorageFeesLegacy`: Storage fees
- `ReferralFeesLegacy`: Referral fees by category
- `LowInventoryFees`: Low inventory level fees

All fee amounts are stored as `Decimal` type for precision.
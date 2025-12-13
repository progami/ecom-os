# Amazon Fee Tables Database Schema

This migration creates a comprehensive database schema for managing Amazon fee structures across different marketplaces, programs, and time periods.

## Tables Overview

### 1. **countries**
- Stores marketplace countries with their codes, currencies, and regions
- Primary key: `id` (UUID)
- Unique constraint: `code` (2-char country code)

### 2. **programs**
- Defines fulfillment programs (FBA, FBM, MCF)
- Primary key: `id` (UUID)
- Unique constraint: `code`

### 3. **size_tiers**
- Defines product size classifications per country/program
- Links to: `countries`, `programs`
- Includes dimensions and weight limits
- Supports effective date ranges

### 4. **weight_bands**
- Weight-based fee tiers within size tiers
- Links to: `size_tiers`
- Defines min/max weight ranges

### 5. **fulfilment_fees**
- Core fulfillment fees by size tier and weight band
- Links to: `countries`, `programs`, `size_tiers`, `weight_bands`
- Supports base fees and per-unit charges

### 6. **storage_fees**
- Monthly storage fees (standard vs peak periods)
- Links to: `countries`, `programs`
- Differentiates standard and oversize items

### 7. **storage_utilization_surcharge**
- Additional fees based on storage utilization ratios
- Links to: `countries`, `programs`
- Tiered by utilization percentage

### 8. **aged_inventory_surcharge**
- Fees for long-term storage
- Links to: `countries`, `programs`
- Progressive fees based on days in inventory

### 9. **referral_fees**
- Category-based selling fees
- Links to: `countries`, `programs`
- Percentage-based with optional minimums

### 10. **optional_services**
- Additional services (prep, labeling, etc.)
- Links to: `countries`, `programs`
- Fixed or variable pricing

### 11. **surcharges**
- Various conditional surcharges
- Links to: `countries`, `programs`
- Flexible structure for different fee types

### 12. **mcf_fees**
- Multi-channel fulfillment fees
- Links to: `countries`, `programs`, `size_tiers`, `weight_bands`
- Shipment type specific

### 13. **high_return_rate_fees**
- Category-specific return rate penalties
- Links to: `countries`, `programs`
- Threshold-based fees

### 14. **fee_calculations**
- Stores calculated fees for simulations
- Links to: `simulations`, `countries`, `programs`
- Comprehensive fee breakdown with JSON support

## Key Features

- **Temporal Support**: All fee tables include `effective_date` and optional `end_date` for historical tracking
- **Multi-marketplace**: Supports multiple countries and currencies
- **Flexible Programs**: Accommodates FBA, FBM, MCF, and future programs
- **Comprehensive Indexing**: Optimized queries with strategic indexes
- **Audit Trail**: All tables include `created_at` and `updated_at` timestamps

## Usage

1. Run migration: `npm run db:migrate`
2. Seed initial data: `npm run db:seed`
3. Generate Prisma client: `npm run db:generate`

## Foreign Key Relationships

- Most tables reference `countries` and `programs`
- `weight_bands` → `size_tiers`
- `fulfilment_fees` → `size_tiers`, `weight_bands`
- `mcf_fees` → `size_tiers`, `weight_bands`
- `fee_calculations` → `simulations`
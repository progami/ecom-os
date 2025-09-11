# FBA Data Seeding Script

This script populates the MarginMaster database with comprehensive Amazon FBA fee data and sample simulations for testing and demonstration purposes.

## What It Seeds

### 1. **Countries & Marketplaces**
- United States (US) - USD
- United Kingdom (GB) - GBP
- Germany (DE) - EUR
- France (FR) - EUR
- Italy (IT) - EUR
- Spain (ES) - EUR
- Canada (CA) - CAD
- Japan (JP) - JPY

### 2. **FBA Programs**
- Standard FBA
- Low-Price FBA (for products under $10)
- Small and Light (SIPP)
- European Fulfillment Network (EFN)
- Pan-European FBA

### 3. **Size Tiers**
- Standard envelope (max 210g)
- Standard small (max 460g)
- Standard regular (max 9kg)
- Standard large (max 30kg)
- Small oversize
- Standard oversize
- Large oversize
- Apparel sizes

### 4. **Fee Structures**
- **Standard FBA Fees**: Weight-based fulfillment fees for US and UK
- **Low-Price FBA Fees**: Reduced fees for qualifying products
- **Referral Fees**: Category-based percentage fees (8-17%)
- **Storage Fees**: Monthly storage costs by size and season
- **Weight Bands**: 40+ weight ranges for precise fee calculation

### 5. **Product Categories**
- Electronics (8% referral fee)
- Clothing & Accessories (15-17% referral fee)
- Home & Garden (15% referral fee)
- Toys & Games (15% referral fee)
- Sports & Outdoors (15% referral fee)
- Beauty & Personal Care (8-15% based on price)
- Grocery (8-15% based on price)
- Books (15% referral fee)

### 6. **Sample Simulations**
The script creates 7 realistic product simulations:

#### Profitable Scenarios:
1. **Phone Case - High Margin** ($29.99)
   - Electronics category, lightweight
   - ~41.5% margin
   
2. **Yoga Mat - Standard Margin** ($39.99)
   - Sports & Outdoors, medium weight
   - ~21.9% margin
   
3. **T-Shirt Bundle - Low Price FBA** ($9.99)
   - Clothing, qualifies for reduced fees
   - ~18.5% margin

4. **Bamboo Cutlery Set** ($24.99)
   - Eco-friendly product
   - ~12.6% margin

5. **Multi-Pack Beauty Set** ($89.99)
   - High-value bundle
   - ~20.8% margin

#### Unprofitable Scenarios:
1. **Cheap Electronics - Loss Leader** ($12.99)
   - High ACOS, low price point
   - -16.5% margin
   
2. **Heavy Garden Tool - Oversized** ($45.99)
   - High shipping costs due to size/weight
   - -7.1% margin

## How to Run

1. **First time setup:**
   ```bash
   npm run db:seed:fba
   ```

2. **Reset and reseed everything:**
   ```bash
   npm run db:reset
   npm run db:seed:fba
   ```

3. **Seed only profiles (materials & sourcing):**
   ```bash
   npm run db:seed:profiles
   ```

## Data Sources

The fee data is based on:
- Amazon's official FBA fee schedules
- Current marketplace rates (as of 2024-2025)
- Real-world product scenarios

## Important Notes

- The script checks for existing data to avoid duplicates
- Default admin user: `admin@marginmaster.com` / `secret123`
- All monetary values use proper Decimal precision
- Simulations include realistic ACOS (15-35%) and refund rates (2-8%)

## Customization

To add more products or fee structures, edit `/scripts/seed-fba-data.ts` and:

1. Add new categories to `seedReferralFees()`
2. Add new size tiers to `seedSizeTiers()`
3. Add new simulations to `seedSampleSimulations()`
4. Add new marketplaces to `seedCountries()`

## Troubleshooting

If you encounter errors:

1. Ensure PostgreSQL is running
2. Check your `.env` file has the correct `DATABASE_URL`
3. Run `npm run db:generate` if Prisma types are out of sync
4. Check the console output for specific error messages
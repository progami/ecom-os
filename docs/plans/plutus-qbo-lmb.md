# Plutus Implementation Plan v2

## Overview

Hybrid accounting system for Amazon FBA business using Link My Books (LMB) + Plutus.

**Business:**
- Amazon seller (US + UK marketplaces in single QBO)
- 2 brands currently: UK-Dust Sheets, US-Dust Sheets (US-Shoe Bag future)
- 12 SKUs total (4 US, 8 UK) with 3 shared ASINs between regions
- FBA only
- Single-member LLC (Targon LLC)
- Uses 3PL storage in US

**Goal:**
- Brand-level P&L that adds up 100% to total P&L
- COGS broken into components with full visibility
- Accurate inventory accounting (asset → COGS when sold)
- Automation, minimal manual work

---

## Architecture

```
Amazon FBA Warehouse (Physical Reality)
        │
        ├──────────────────────────────────────┐
        │                                      │
        ▼                                      ▼
Settlement Report                    FBA Inventory Report
(what Amazon paid you)               (what's physically there)
        │                                      │
        ▼                                      │
       LMB ─────────► QBO ◄─────── Plutus ◄────┘
                       │
              ┌────────┴────────┐
              │                 │
         Revenue/Fees     Inventory Asset
         (LMB posts)      COGS (Plutus posts)
```

### Responsibility Split

| System | Data Source | Posts to QBO |
|--------|-------------|--------------|
| LMB | Settlement Report | Revenue, Refunds, Fees (by brand via Product Groups) |
| Plutus | Settlement Report (SP-API) | COGS (by brand, by component) |
| Plutus | FBA Inventory Report | Reconciliation adjustments |
| Plutus | QBO Bills | Landed cost extraction |

---

## Brands

| Brand | Marketplace | Status |
|-------|-------------|--------|
| UK-Dust Sheets | Amazon.co.uk | Active |
| US-Dust Sheets | Amazon.com | Active |
| US-Shoe Bag | Amazon.com | Future |

---

## COGS Components

| Component | Description | Goes to Inventory Asset? |
|-----------|-------------|--------------------------|
| Manufacturing | Product cost from supplier | Yes |
| Freight | International shipping (sea/air freight) | Yes |
| Duty | Import duty/customs charges | Yes |
| Mfg Accessories | Packaging, labels, inserts | Yes |
| Land Freight | Local shipping (3PL → Amazon FC) | No (direct expense) |
| Storage 3PL | 3PL warehouse storage fees | No (direct expense) |

**Note:** Land Freight and Storage 3PL go directly to COGS when billed (not capitalized to inventory) because they're period costs that are difficult to tie to specific units.

---

# PHASE 0: QBO CLEANUP

## Step 0.1: Delete Duplicate Accounts

These accounts are duplicates of LMB-created accounts. Delete them:

| Account to Delete | Type | Reason |
|-------------------|------|--------|
| Amazon Sales | Income | LMB uses LMB1: Amazon Sales |
| Amazon Refunds | Income | LMB uses LMB10: Amazon Refunds |
| Amazon Reimbursement | Income | LMB uses LMB2 |
| Amazon Reimbursements | Income | Duplicate + wrong type |
| Amazon Shipping | Income | Non-standard |
| Amazon Advertising | COGS | LMB uses LMB6 |
| Amazon FBA Fees | COGS | LMB uses LMB4 |
| Amazon Seller Fees | COGS | LMB uses LMB3 |
| Amazon Storage Fees | COGS | LMB uses LMB5 |
| Amazon FBA Inventory Reimbursement | Other Income | LMB uses LMB2 |
| Amazon Carried Balances | Other Current Assets | Wrong detail type + non-standard |
| Amazon Pending Balances | Other Current Assets | Wrong detail type + non-standard |
| Amazon Deferred Balances | Other Current Assets | LMB uses LMB9d |
| Amazon Reserved Balances | Other Current Assets | LMB uses LMB9 |
| Amazon Split Month Rollovers | Other Current Assets | LMB uses LMB9A |
| Amazon Loans | Other Current Liabilities | LMB uses LMB8 |
| Amazon Sales Tax | Other Current Liabilities | LMB uses LMB7 |
| Amazon Sales Tax Collected | Other Current Liabilities | Duplicate |

**Total: 18 accounts to delete**

**Note:** If any account has transactions, make it inactive instead or move transactions first.

## Step 0.2: Keep These Accounts (Plutus will use)

| Account | Type | Detail Type | Purpose |
|---------|------|-------------|---------|
| Inventory Asset | Other Current Assets | Inventory | Parent for component sub-accounts |
| Manufacturing | COGS | Supplies & Materials - COGS | Parent for brand sub-accounts |
| Freight & Custom Duty | COGS | Shipping, Freight & Delivery - COS | Parent for brand sub-accounts |
| Land Freight | COGS | Shipping, Freight & Delivery - COS | Parent for brand sub-accounts |
| Storage 3PL | COGS | Shipping, Freight & Delivery - COS | Parent for brand sub-accounts |

---

# PHASE 1: QBO ACCOUNT CREATION

## Step 1.1: Create New Parent Accounts

Create these new parent accounts in QBO:

| Account Name | Account Type | Detail Type |
|--------------|--------------|-------------|
| Mfg Accessories | Cost of Goods Sold | Supplies & Materials - COGS |
| Inventory Shrinkage | Cost of Goods Sold | Other Costs of Service - COS |
| Inventory Variance | Cost of Goods Sold | Other Costs of Service - COS |

## Step 1.2: Create Income Sub-Accounts

Create sub-accounts under existing LMB parent accounts:

**Under LMB1: Amazon Sales**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Amazon Sales - US-Dust Sheets | Income | Sales of Product Income |
| Amazon Sales - UK-Dust Sheets | Income | Sales of Product Income |

**Under LMB10: Amazon Refunds**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Amazon Refunds - US-Dust Sheets | Income | Discounts/Refunds Given |
| Amazon Refunds - UK-Dust Sheets | Income | Discounts/Refunds Given |

**Under LMB2: Amazon FBA Inventory Reimbursement**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Amazon FBA Inventory Reimbursement - US-Dust Sheets | Other Income | Other Miscellaneous Income |
| Amazon FBA Inventory Reimbursement - UK-Dust Sheets | Other Income | Other Miscellaneous Income |

## Step 1.3: Create Fee Sub-Accounts (COGS)

**Under LMB3: Amazon Seller Fees**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Amazon Seller Fees - US-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |
| Amazon Seller Fees - UK-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |

**Under LMB4: Amazon FBA Fees**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Amazon FBA Fees - US-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |
| Amazon FBA Fees - UK-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |

**Under LMB5: Amazon Storage Fees**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Amazon Storage Fees - US-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |
| Amazon Storage Fees - UK-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |

**Under LMB6: Amazon Advertising Costs**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Amazon Advertising Costs - US-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |
| Amazon Advertising Costs - UK-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |

**Under Amazon Promotions (create parent if needed)**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Amazon Promotions - US-Dust Sheets | Cost of Goods Sold | Other Costs of Service - COS |
| Amazon Promotions - UK-Dust Sheets | Cost of Goods Sold | Other Costs of Service - COS |

## Step 1.4: Create Inventory Asset Sub-Accounts

**Under Inventory Asset**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Manufacturing - US-Dust Sheets | Other Current Assets | Inventory |
| Manufacturing - UK-Dust Sheets | Other Current Assets | Inventory |
| Freight - US-Dust Sheets | Other Current Assets | Inventory |
| Freight - UK-Dust Sheets | Other Current Assets | Inventory |
| Duty - US-Dust Sheets | Other Current Assets | Inventory |
| Duty - UK-Dust Sheets | Other Current Assets | Inventory |
| Mfg Accessories - US-Dust Sheets | Other Current Assets | Inventory |
| Mfg Accessories - UK-Dust Sheets | Other Current Assets | Inventory |

## Step 1.5: Create COGS Component Sub-Accounts

**Under Manufacturing**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Manufacturing - US-Dust Sheets | Cost of Goods Sold | Supplies & Materials - COGS |
| Manufacturing - UK-Dust Sheets | Cost of Goods Sold | Supplies & Materials - COGS |

**Under Freight & Custom Duty**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Freight - US-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |
| Freight - UK-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |
| Duty - US-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |
| Duty - UK-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |

**Under Land Freight**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Land Freight - US-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |
| Land Freight - UK-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |

**Under Storage 3PL**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Storage 3PL - US-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |
| Storage 3PL - UK-Dust Sheets | Cost of Goods Sold | Shipping, Freight & Delivery - COS |

**Under Mfg Accessories**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Mfg Accessories - US-Dust Sheets | Cost of Goods Sold | Supplies & Materials - COGS |
| Mfg Accessories - UK-Dust Sheets | Cost of Goods Sold | Supplies & Materials - COGS |

## Step 1.6: Account Summary

| Category | Count |
|----------|-------|
| New parent accounts | 5 (includes Amazon Promotions if not exists) |
| Income sub-accounts | 6 |
| Fee sub-accounts (COGS) | 10 (includes Promotions) |
| Inventory Asset sub-accounts | 8 |
| COGS component sub-accounts | 12 |
| **Total new accounts** | **~41** |

**Note:** Exact count depends on which parent accounts already exist in QBO.

---

# PHASE 2: LMB CONFIGURATION

**Important:** You have TWO LMB connections - do Phase 2 for EACH:
- Targon - AMAZON NORTH AMERICA (US)
- Targon - AMAZON EUROPE (UK)

See Appendix F for connection-specific details.

## Step 2.1: Complete Setup Wizard (for EACH connection)

1. Go to LMB → Accounts & Taxes → Setup Wizard
2. Step 1: Select "Custom Chart Accounts"
3. Keep default LMB account mappings (these are fallbacks)
4. Step 2: Verify bank accounts:
   - **US Connection:** Chase Checking (USD) for deposits
   - **UK Connection:** Wise GBP account for deposits
5. Step 3: Confirm tax rates:
   - **US:** No Tax Rate Applicable (marketplace facilitator)
   - **UK:** Standard Rate 20% VAT
6. Complete wizard

## Step 2.2: Create Product Groups

Go to LMB → Inventory → Product Groups

**Create Group 1: US-Dust Sheets**
| Setting | Value |
|---------|-------|
| Group Name | US-Dust Sheets |
| Sales Account | Amazon Sales - US-Dust Sheets |
| Refunds Account | Amazon Refunds - US-Dust Sheets |
| FBA Fees Account | Amazon FBA Fees - US-Dust Sheets |
| Seller Fees Account | Amazon Seller Fees - US-Dust Sheets |
| Storage Fees Account | Amazon Storage Fees - US-Dust Sheets |
| Advertising Account | Amazon Advertising Costs - US-Dust Sheets |
| Promotions Account | Amazon Promotions - US-Dust Sheets |
| Reimbursement Account | Amazon FBA Inventory Reimbursement - US-Dust Sheets |
| COGS | OFF (Plutus handles) |

**Create Group 2: UK-Dust Sheets**
| Setting | Value |
|---------|-------|
| Group Name | UK-Dust Sheets |
| Sales Account | Amazon Sales - UK-Dust Sheets |
| Refunds Account | Amazon Refunds - UK-Dust Sheets |
| FBA Fees Account | Amazon FBA Fees - UK-Dust Sheets |
| Seller Fees Account | Amazon Seller Fees - UK-Dust Sheets |
| Storage Fees Account | Amazon Storage Fees - UK-Dust Sheets |
| Advertising Account | Amazon Advertising Costs - UK-Dust Sheets |
| Promotions Account | Amazon Promotions - UK-Dust Sheets |
| Reimbursement Account | Amazon FBA Inventory Reimbursement - UK-Dust Sheets |
| COGS | OFF (Plutus handles) |

## Step 2.3: Assign SKUs to Product Groups

Go to LMB → Inventory → Product Groups → Product SKUs tab

**US-Dust Sheets Group (4 SKUs):**
| SKU | ASIN | Product |
|-----|------|---------|
| CS-007 | B09HXC3NL8 | 6 Pack Plastic |
| CS-010 | B0CR1GSBQ9 | 3 Pack Plastic |
| CS-1SD-32M | B0FLKJ7WWM | 1 Pack Plastic |
| CS-12LD-7M | B0FP66CWQ6 | 12 Pack Plastic |

**UK-Dust Sheets Group (8 SKUs):**
| SKU | ASIN | Product |
|-----|------|---------|
| CS 007 | B09HXC3NL8 | 6 Pack Plastic |
| CS 008 | B0C7ZQ3VZL | 3 Pack Plastic (Light) |
| CS 009 | B0CR1H3VSF | 10 Pack Plastic |
| CS 010 | B0CR1GSBQ9 | 3 Pack Plastic |
| CS 011 | B0DHDTPGGP | 6 Pack Plastic |
| CS 1SD-32M | B0FLKJ7WWM | 1 Pack Plastic |
| CS-CDS-001 | B0CW3N48K1 | Cotton Dust Sheet (Small) |
| CS-CDS-002 | B0CW3L6PQH | Cotton Dust Sheet (Large) |

## Step 2.4: LMB Settings

Go to LMB → Settings → Settlement Settings

**For US Connection (Amazon North America):**
| Setting | Value |
|---------|-------|
| Product Grouping | ON |
| Fulfillment Type Grouping | OFF |
| Cost of Goods Sold | OFF |

**For UK Connection (Amazon Europe):**
| Setting | Value |
|---------|-------|
| Product Grouping | ON |
| Fulfillment Type Grouping | OFF |
| Cost of Goods Sold | OFF |
| VAT Scheme | Standard (see Appendix G) |

## Step 2.5: Create "Unassigned" Product Group (Safety Net)

Go to LMB → Inventory → Product Groups

**Create Group: UNASSIGNED**
| Setting | Value |
|---------|-------|
| Group Name | UNASSIGNED |
| Sales Account | Amazon Sales (parent - no brand suffix) |
| Refunds Account | Amazon Refunds (parent) |
| FBA Fees Account | Amazon FBA Fees (parent) |
| Seller Fees Account | Amazon Seller Fees (parent) |
| Storage Fees Account | Amazon Storage Fees (parent) |
| Advertising Account | Amazon Advertising Costs (parent) |
| Promotions Account | Amazon Promotions (parent) |
| Reimbursement Account | Amazon FBA Inventory Reimbursement (parent) |
| COGS | OFF |

**Set as Default:** In LMB settings, set UNASSIGNED as the default Product Group for unknown SKUs.

**Why:** If a new SKU appears that's not mapped to US-Dust Sheets or UK-Dust Sheets:
- Revenue still posts (not lost)
- Goes to parent accounts (not brand sub-accounts)
- Shows up in reports as "UNASSIGNED" - easy to spot
- You then add the SKU to correct Product Group for future settlements

## Step 2.6: Test LMB

1. Post one settlement manually
2. Check QBO → verify transactions landed in correct brand accounts
3. If wrong accounts → fix Product Group mappings
4. If unmapped SKU → add to correct Product Group

---

# PHASE 3: QBO CUSTOM FIELD SETUP (for Bill Entry)

## Step 3.1: Create Custom Field

1. Go to QBO → Settings → Custom Fields
2. Create a new field named: **"Plutus PO Number"**
3. Check the box for: **Bill** (and Purchase Order if available)
4. Select "Text" as the type
5. Save

**Why Custom Fields instead of Tags:**
- Tags are fragile and being deprecated by Intuit
- Custom Fields are stable and queryable via API
- Plutus will query bills by "Plutus PO Number" to link costs

---

# PHASE 4: BILL ENTRY SOP

## Step 4.1: When New PO is Placed

1. Note the PO number: PO-YYYY-NNN
2. Record PO details (SKUs, quantities, expected costs)
3. You'll enter this PO number in the "Plutus PO Number" custom field on all related bills

## Step 4.2: When Manufacturing Bill Arrives

| Field | Value |
|-------|-------|
| Vendor | Actual supplier name |
| Plutus PO Number | PO-YYYY-NNN (Custom Field) |
| Account | Inventory Asset: Manufacturing - [Brand] |
| Line Items | One per SKU with quantity and amount |

**Example:**
```
Vendor: Shenzhen Manufacturing Co
Plutus PO Number: PO-2025-001  ← Custom Field, NOT Tag
Account: Inventory Asset: Manufacturing - US-Dust Sheets

Line 1: CS-007, Qty 500, $1,250.00
Line 2: CS-010, Qty 500, $1,250.00
Total: $2,500.00
```

## Step 4.3: When Freight Bill Arrives

| Field | Value |
|-------|-------|
| Vendor | Logistics company |
| Plutus PO Number | PO-YYYY-NNN (same as manufacturing bill) |
| Account | Inventory Asset: Freight - [Brand] |
| Line Items | Total freight amount |

**Example:**
```
Vendor: FastFreight Logistics
Plutus PO Number: PO-2025-001
Account: Inventory Asset: Freight - US-Dust Sheets

Line 1: Ocean freight, $400.00
Total: $400.00
```

## Step 4.4: When Duty Bill Arrives

| Field | Value |
|-------|-------|
| Vendor | Customs broker |
| Plutus PO Number | PO-YYYY-NNN (same as manufacturing bill) |
| Account | Inventory Asset: Duty - [Brand] |
| Line Items | Total duty amount |

## Step 4.5: When Land Freight Bill Arrives

| Field | Value |
|-------|-------|
| Vendor | Local logistics |
| Plutus PO Number | PO-YYYY-NNN (same as manufacturing bill) |
| Account | Land Freight - [Brand] ← COGS directly, NOT Inventory Asset |
| Line Items | Total amount |

**Note:** Land Freight goes directly to COGS (not Inventory Asset) because:
- It's incurred AFTER goods arrive at 3PL
- It's a fulfillment cost, not a product cost
- Simplifies landed cost calculation

## Step 4.6: When 3PL Storage Bill Arrives

| Field | Value |
|-------|-------|
| Vendor | 3PL warehouse |
| Memo | Month identifier (e.g., 3PL-2025-01) |
| Account | Storage 3PL - [Brand] ← COGS directly |
| Line Items | Split by brand based on estimated inventory % |

**Example:**
```
3PL Storage Bill: $500/month
Estimated split: 60% US, 40% UK

Line 1: Storage 3PL - US-Dust Sheets, $300
Line 2: Storage 3PL - UK-Dust Sheets, $200
```

**Note:** 3PL storage goes directly to COGS (not Inventory Asset) because it's a period cost that's difficult to allocate to specific units. Plutus does NOT process this - it's entered manually in QBO.

---

# PHASE 5: PLUTUS DEVELOPMENT

## Step 5.1: Project Setup

```bash
npx create-next-app@latest plutus --typescript --tailwind --app
cd plutus
npm install prisma @prisma/client
npm install @anthropic-ai/sdk  # for AI features if needed
npx prisma init
```

## Step 5.2: Database Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Brands
model Brand {
  id          String   @id @default(cuid())
  name        String   @unique  // "US-Dust Sheets", "UK-Dust Sheets"
  marketplace String   // "amazon.com", "amazon.co.uk"
  skuMappings SkuMapping[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// SKU to Brand mapping (per marketplace)
model SkuMapping {
  id          String   @id @default(cuid())
  sku         String
  brandId     String
  brand       Brand    @relation(fields: [brandId], references: [id])
  asin        String?
  productName String?
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([sku, brandId])
}

// Landed costs per SKU - ALL COSTS STORED IN USD (base currency)
model SkuCost {
  id              String   @id @default(cuid())
  sku             String   @unique
  // All costs below are in USD (home currency)
  // These are CURRENT weighted averages (cached from SkuCostHistory)
  avgManufacturing  Decimal @db.Decimal(10, 4) @default(0)
  avgFreight        Decimal @db.Decimal(10, 4) @default(0)
  avgDuty           Decimal @db.Decimal(10, 4) @default(0)
  avgMfgAccessories Decimal @db.Decimal(10, 4) @default(0)
  avgTotalLanded    Decimal @db.Decimal(10, 4) @default(0)
  // NOTE: Quantity is derived from InventoryLedger, not stored here
  lastUpdated       DateTime @default(now())
  costHistory       SkuCostHistory[]
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([sku])
}

// Historical cost entries per PO (for audit trail + as-of-date lookups)
model SkuCostHistory {
  id              String   @id @default(cuid())
  skuCostId       String
  skuCost         SkuCost  @relation(fields: [skuCostId], references: [id])
  poNumber        String
  manufacturing   Decimal  @db.Decimal(10, 4)
  freight         Decimal  @db.Decimal(10, 4)
  duty            Decimal  @db.Decimal(10, 4)
  mfgAccessories  Decimal  @db.Decimal(10, 4) @default(0)
  totalLanded     Decimal  @db.Decimal(10, 4)
  quantity        Int
  perUnitLanded   Decimal  @db.Decimal(10, 4)
  qboBillIds      String[] // QBO bill IDs linked to this cost
  effectiveDate   DateTime // The Date of the Bill in QBO (for as-of lookups)
  createdAt       DateTime @default(now())
  
  @@index([skuCostId, effectiveDate])
}

// QBO Account references
model QboAccount {
  id          String   @id @default(cuid())
  qboId       String   @unique  // QBO's internal ID
  name        String
  accountType String   // "Income", "COGS", "Asset", etc.
  category    String   // "Sales", "FBAFees", "Manufacturing", etc.
  brand       String?  // "US-Dust Sheets", "UK-Dust Sheets", or null for shared
  component   String?  // "Manufacturing", "Freight", "Duty", etc.
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Settlement tracking
model Settlement {
  id               String   @id @default(cuid())
  settlementId     String   @unique
  reportDocumentId String?
  marketplace      String   // "amazon.com", "amazon.co.uk"
  startDate        DateTime
  endDate          DateTime
  depositDate      DateTime?
  totalAmount      Decimal  @db.Decimal(12, 2) // In settlement currency (informational only)
  currency         String   // USD or GBP (informational - Plutus ignores for COGS)
  status           String   @default("PENDING") // PENDING, PROCESSED, ERROR
  processingHash   String?  // For idempotency (prevent double-posting)
  errorMessage     String?
  
  // Relations
  lines            SettlementLine[]
  postings         SettlementPosting[] // One-to-many for split months
  validation       SettlementValidation?
  
  createdAt        DateTime @default(now())
  processedAt      DateTime?
  updatedAt        DateTime @updatedAt
}

// Tracks actual JEs posted to QBO (handles split months)
model SettlementPosting {
  id             String     @id @default(cuid())
  settlementId   String
  settlement     Settlement @relation(fields: [settlementId], references: [id])
  
  qboJournalId   String     // The ID of the COGS Journal Entry we created
  lmbInvoiceId   String?    // The ID of the LMB Invoice we matched against
  
  periodStart    DateTime   // The specific date range this JE covers
  periodEnd      DateTime
  postingDate    DateTime   // The TxnDate used in QBO
  
  totalCogsUSD   Decimal    @db.Decimal(12, 2)
  
  createdAt      DateTime   @default(now())
  
  @@index([settlementId])
}

// Inventory Ledger - audit trail for all inventory movements
model InventoryLedger {
  id             String   @id @default(cuid())
  sku            String
  date           DateTime
  type           String   // PURCHASE, SALE, RETURN, ADJUSTMENT
  quantityChange Int      // Positive = in, Negative = out
  unitCostUSD    Decimal  @db.Decimal(10, 4) // Cost at time of event
  totalValueUSD  Decimal  @db.Decimal(12, 2)
  runningQty     Int?     // Running total after this event
  runningValue   Decimal? @db.Decimal(12, 2) // Running value after this event
  sourceRef      String?  // Settlement ID, Bill ID, or Adjustment ID
  notes          String?
  createdAt      DateTime @default(now())

  @@index([sku, date])
  @@index([type])
}

// Settlement line items
model SettlementLine {
  id              String     @id @default(cuid())
  settlementId    String
  settlement      Settlement @relation(fields: [settlementId], references: [id])
  transactionType String     // ORDER, REFUND, etc. (we only process ORDER)
  amountType      String
  amountDesc      String
  sku             String?
  quantity        Int?
  amount          Decimal    @db.Decimal(12, 2)
  postedDate      DateTime?
  createdAt       DateTime   @default(now())
}

// FBA Returns (for COGS reversal processing)
model FbaReturn {
  id              String     @id @default(cuid())
  returnDate      DateTime
  orderId         String
  sku             String
  asin            String?
  fnsku           String?
  quantity        Int
  disposition     String     // SELLABLE, DAMAGED, CUSTOMER_DAMAGED, CARRIER_DAMAGED, etc.
  reason          String?
  cogsReversed    Boolean    @default(false)
  reversalJeId    String?    // QBO journal entry ID if reversed
  createdAt       DateTime   @default(now())
  
  @@index([sku, returnDate])
  @@index([disposition])
}

// Validation per settlement
model SettlementValidation {
  id            String     @id @default(cuid())
  settlementId  String     @unique
  settlement    Settlement @relation(fields: [settlementId], references: [id])
  brandResults  Json       // { "US-Dust Sheets": { lmb: 1000, plutus: 995, variance: 5 }, ... }
  totalVariance Decimal    @db.Decimal(12, 2)
  variancePercent Decimal  @db.Decimal(5, 4)
  status        String     // OK, WARNING, CRITICAL
  resolution    String?
  createdAt     DateTime   @default(now())
  resolvedAt    DateTime?
}

// Monthly inventory reconciliation
model InventoryReconciliation {
  id              String        @id @default(cuid())
  month           String        // "2025-01"
  marketplace     String
  bookValue       Decimal       @db.Decimal(12, 2)
  actualValue     Decimal       @db.Decimal(12, 2)
  variance        Decimal       @db.Decimal(12, 2)
  status          String        @default("PENDING") // PENDING, REVIEWED, ADJUSTED
  adjustmentJeId  String?       // QBO journal entry ID
  skuVariances    SkuVariance[]
  createdAt       DateTime      @default(now())
  reviewedAt      DateTime?
  adjustedAt      DateTime?
}

// Per-SKU variance in reconciliation
model SkuVariance {
  id               String                  @id @default(cuid())
  reconciliationId String
  reconciliation   InventoryReconciliation @relation(fields: [reconciliationId], references: [id])
  sku              String
  bookUnits        Int
  actualUnits      Int
  varianceUnits    Int
  varianceValue    Decimal                 @db.Decimal(10, 2)
  cause            String?                 // WAREHOUSE_DAMAGED, LOST, RETURN_DISPOSED, etc.
  amazonReference  String?
  createdAt        DateTime                @default(now())
}

// Audit log
model AuditLog {
  id          String   @id @default(cuid())
  action      String   // SETTLEMENT_PROCESSED, JOURNAL_POSTED, RECONCILIATION_COMPLETED, etc.
  entityType  String   // Settlement, InventoryReconciliation, etc.
  entityId    String
  details     Json?
  userId      String?
  createdAt   DateTime @default(now())
}
```

## Step 5.3: Core Modules

### Module 1: QBO Integration

```
/lib/qbo/
├── auth.ts          # OAuth2 flow, token refresh
├── client.ts        # API client wrapper
├── accounts.ts      # Account CRUD operations
├── journals.ts      # Journal entry posting
├── bills.ts         # Bill reading/parsing
└── types.ts         # TypeScript types
```

**Developer Note - Bill Querying Limitation:**

The QBO API does NOT support server-side filtering by Custom Fields (e.g., you cannot query `WHERE CustomField = 'PO-123'`).

**Correct Implementation:**
1. Fetch Bills by `TxnDate` range (e.g., last 90 days) or by `Vendor`
2. Filter the results client-side in Node.js to find matching `Plutus PO Number`
3. Cache results to avoid hitting API rate limits

```typescript
// Example: Finding bills for a specific PO
async function getBillsByPO(poNumber: string): Promise<Bill[]> {
  // 1. Fetch all bills from last 90 days
  const bills = await qbo.findBills({
    TxnDate: { $gte: ninetyDaysAgo }
  });
  
  // 2. Filter client-side by custom field
  return bills.filter(bill => 
    bill.CustomField?.find(f => 
      f.Name === 'Plutus PO Number' && f.StringValue === poNumber
    )
  );
}
```

### Module 2: Amazon SP-API Integration

```
/lib/amazon/
├── auth.ts          # LWA authentication
├── client.ts        # API client wrapper
├── settlements.ts   # Settlement report fetching/parsing
├── inventory.ts     # FBA inventory reports
├── adjustments.ts   # Adjustment/removal reports
└── types.ts         # TypeScript types
```

### Module 3: Landed Cost Engine

```
/lib/landed-cost/
├── parser.ts        # Parse bills from QBO
├── allocator.ts     # Allocate freight/duty to SKUs
├── calculator.ts    # Calculate per-unit landed cost
└── storage.ts       # Store/retrieve costs from DB
```

### Module 4: COGS Engine

```
/lib/cogs/
├── extractor.ts     # Extract units sold from settlement
├── calculator.ts    # Calculate COGS per brand per component
├── journal.ts       # Generate QBO journal entry
└── poster.ts        # Post to QBO
```

### Module 5: Variance Engine

```
/lib/variance/
├── comparator.ts    # Compare LMB vs Plutus
├── distributor.ts   # Distribute variance by component
├── resolver.ts      # Handle variance resolution
└── reporter.ts      # Generate variance reports
```

### Module 6: Reconciliation Engine

```
/lib/reconciliation/
├── inventory.ts     # Pull FBA inventory
├── book-value.ts    # Get QBO book value
├── matcher.ts       # Match variances to causes
├── adjuster.ts      # Generate adjustment entries
└── reporter.ts      # Generate reconciliation reports
```

## Step 5.4: API Routes

```
/app/api/
├── auth/
│   ├── qbo/callback/route.ts    # QBO OAuth callback
│   └── amazon/callback/route.ts # Amazon OAuth callback
├── settlements/
│   ├── route.ts                 # GET list, POST process
│   └── [id]/route.ts            # GET single, POST reprocess
├── cogs/
│   ├── route.ts                 # POST calculate and post
│   └── preview/route.ts         # POST preview without posting
├── reconciliation/
│   ├── route.ts                 # GET list, POST run
│   └── [id]/route.ts            # GET single, POST adjust
├── bills/
│   ├── route.ts                 # GET list from QBO
│   └── parse/route.ts           # POST parse bills for PO
├── skus/
│   ├── route.ts                 # CRUD operations
│   └── costs/route.ts           # GET/POST landed costs
└── accounts/
    ├── route.ts                 # GET list from QBO
    └── sync/route.ts            # POST sync from QBO
```

## Step 5.5: UI Pages

```
/app/
├── page.tsx                     # Dashboard
├── settlements/
│   ├── page.tsx                 # Settlement list
│   └── [id]/page.tsx            # Settlement detail
├── cogs/
│   └── page.tsx                 # COGS posting interface
├── reconciliation/
│   ├── page.tsx                 # Reconciliation list
│   └── [id]/page.tsx            # Reconciliation detail
├── inventory/
│   ├── page.tsx                 # Inventory overview
│   └── costs/page.tsx           # Landed costs management
├── skus/
│   └── page.tsx                 # SKU management
├── bills/
│   └── page.tsx                 # Bill parsing interface
└── settings/
    ├── page.tsx                 # Settings overview
    ├── qbo/page.tsx             # QBO connection
    └── amazon/page.tsx          # Amazon connection
```

---

# PHASE 6: PLUTUS WORKFLOW IMPLEMENTATION

## Step 6.1: Settlement Processing Flow (SALES ONLY)

**Important:** Settlement processing handles SALES only. Returns are processed separately via FBA Returns Report (see Step 6.2).

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DETECT NEW SETTLEMENT (Memo-Based Matching)                  │
│                                                                 │
│    A. Poll QBO:                                                 │
│       - Fetch new Invoices from Vendor = "Link My Books"        │
│       - Or manual trigger from UI                               │
│                                                                 │
│    B. Extract Settlement ID:                                    │
│       - LMB writes Settlement ID in Memo/PrivateNote field      │
│       - Example: "Settlement 14839201"                          │
│       - Parse this to get the Settlement ID                     │
│                                                                 │
│    C. Group by Settlement ID:                                   │
│       - Multiple LMB invoices may share same Settlement ID      │
│       - (happens when LMB splits across months)                 │
│                                                                 │
│    D. Check Status:                                             │
│       - Query Plutus DB for this Settlement ID                  │
│       - If PROCESSED → Ignore (idempotency)                     │
│       - If PENDING → Start processing                           │
│       - If not found → Create new Settlement record             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. FETCH SETTLEMENT FROM SP-API                                 │
│    - GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2                 │
│    - Parse into SettlementLine records                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. EXTRACT UNITS SOLD PER SKU (SALES ONLY)                      │
│    - Filter for TransactionType = 'ORDER' only                  │
│    - Ignore REFUND transactions (handled by Returns flow)       │
│    - Group by SKU                                               │
│    - VALIDATE: All SKUs must be mapped (see Appendix E.4)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. LOOK UP LANDED COSTS (HISTORICAL - AS-OF DATE)               │
│    - Input: SKU + Transaction Date (of the sale)                │
│    - Query SkuCostHistory to find Weighted Average Cost         │
│      effective on that specific date                            │
│    - Why: If you re-process a January settlement in March,      │
│      you must use January's cost, not March's cost              │
│    - All costs in USD (ignore settlement currency)              │
│    - See Appendix E.7 for cost method details                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. CALCULATE COGS (SALES)                                       │
│    - Per SKU: units sold × landed cost components               │
│    - Debit COGS / Credit Inventory Asset                        │
│    - Aggregate by brand and component                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. UPDATE INVENTORY LEDGER                                      │
│    - Insert record: type=SALE, quantityChange=-N                │
│    - Track running quantity and value                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. VALIDATE AGAINST LMB                                         │
│    - Get LMB invoice from QBO                                   │
│    - Compare revenue by brand                                   │
│    - Calculate variance                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. POST JOURNAL ENTRY TO QBO (SPLIT MONTH LOGIC)                │
│                                                                 │
│    A. Get LMB Invoices (from Step 1):                           │
│       - Use the grouped LMB invoices for this settlement        │
│                                                                 │
│    B. For EACH LMB Invoice:                                     │
│       - Determine date range (from TxnDate + settlement bounds) │
│       - Filter SettlementLines by postedDate in that range      │
│       - Calculate COGS for this subset of sales                 │
│       - Post Journal Entry dated to LMB Invoice's TxnDate       │
│       - Create SettlementPosting record linking JE to LMB       │
│                                                                 │
│    C. Example: Settlement Dec 27 - Jan 10                       │
│       - LMB creates 2 invoices (Dec 31 + Jan 10)                │
│       - Plutus creates:                                         │
│         → JE #1: Dated Dec 31 (sales Dec 27-31) → Posting #1    │
│         → JE #2: Dated Jan 10 (sales Jan 1-10) → Posting #2     │
│                                                                 │
│    D. Database:                                                 │
│       - Each JE → one SettlementPosting record                  │
│       - Settlement.status = PROCESSED when all postings done    │
│                                                                 │
│    E. Result: COGS matches Revenue month-by-month               │
└─────────────────────────────────────────────────────────────────┘
```

## Step 6.2: Returns Processing Flow (SEPARATE FROM SETTLEMENT)

**Why separate:** Settlement REFUND ≠ Physical return. Customer may get refund but keep item (returnless refund). We only reverse COGS when item physically returns to inventory.

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. FETCH FBA RETURNS REPORT (Weekly/Monthly)                    │
│    - GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA                  │
│    - Shows items physically returned to FBA                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. FILTER FOR SELLABLE RETURNS                                  │
│    - Only reverse COGS if item returned to sellable inventory   │
│    - Disposition: "SELLABLE" → reverse COGS                     │
│    - Disposition: "DAMAGED/DEFECTIVE" → no reversal (shrinkage) │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. CALCULATE COGS REVERSAL                                      │
│    - Per SKU: returned units × landed cost                      │
│    - Credit COGS / Debit Inventory Asset                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. UPDATE INVENTORY LEDGER                                      │
│    - Insert record: type=RETURN, quantityChange=+N              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. POST REVERSAL JOURNAL ENTRY TO QBO                           │
│    - Debit: Inventory Asset (cost back on balance sheet)        │
│    - Credit: COGS (reduces expense)                             │
│    - Memo: "Returns reversal - [date range]"                    │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits of separate returns processing:**
- Returnless refunds: No COGS reversal (correct - item is gone)
- Physical returns: COGS reversal only for sellable items
- Damaged returns: No reversal (goes to shrinkage in reconciliation)
- Cleaner audit trail

## Step 6.2: COGS Journal Entry Structure

**Example: Settlement with Sales only**
```
Settlement: 12345678 (Dec 19 - Jan 2)
Currency: USD (but same logic for GBP settlements - COGS always in USD)

DEBITS (COGS):
  Manufacturing - US-Dust Sheets        $1,200.00
  Freight - US-Dust Sheets              $180.00
  Duty - US-Dust Sheets                 $90.00
  Mfg Accessories - US-Dust Sheets      $30.00
  Manufacturing - UK-Dust Sheets        $800.00
  Freight - UK-Dust Sheets              $120.00
  Duty - UK-Dust Sheets                 $60.00
  Mfg Accessories - UK-Dust Sheets      $20.00
                                        ─────────
  Total COGS                            $2,500.00

CREDITS (Inventory Asset):
  Inventory Asset: Manufacturing - US   $1,200.00
  Inventory Asset: Freight - US         $180.00
  Inventory Asset: Duty - US            $90.00
  Inventory Asset: Mfg Accessories - US $30.00
  Inventory Asset: Manufacturing - UK   $800.00
  Inventory Asset: Freight - UK         $120.00
  Inventory Asset: Duty - UK            $60.00
  Inventory Asset: Mfg Accessories - UK $20.00
                                        ─────────
  Total Credit                          $2,500.00

Memo: "Plutus COGS - Settlement 12345678 (Dec 19 - Jan 2, 2026)"
```

**Example: Returns Reversal (from Step 6.2 - FBA Returns Report)**
```
Sellable Return: 2 units of CS-007 @ $2.50 total landed cost

DEBITS (Inventory Asset - cost goes BACK to balance sheet):
  Inventory Asset: Manufacturing - US   $4.00
  Inventory Asset: Freight - US         $0.60
  Inventory Asset: Duty - US            $0.30
  Inventory Asset: Mfg Accessories - US $0.10

CREDITS (COGS - reduces expense):
  Manufacturing - US-Dust Sheets        $4.00
  Freight - US-Dust Sheets              $0.60
  Duty - US-Dust Sheets                 $0.30
  Mfg Accessories - US-Dust Sheets      $0.10

Memo: "Returns reversal - Jan 2026"
```

**Note:** This entry is posted from the FBA Returns Report (Step 6.2), NOT from Settlement processing. Only sellable returns trigger COGS reversal.

**Note:** Storage 3PL and Land Freight are NOT included here - they're posted directly to COGS when billed (see Step 4.5 and 4.6).

## Step 6.3: Monthly Reconciliation Flow

**Developer Note:** The plan references `GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA` flat file report. Amazon also offers the FBA Inventory API (`/fba/inventory/v1/summaries`) which provides real-time data and is cleaner to parse. Check the latest SP-API documentation to determine which is best for your use case - the API is actively maintained and may be more reliable than flat file reports.

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. GATHER PHYSICAL INVENTORY FROM ALL LOCATIONS                 │
│                                                                 │
│    A. Amazon FBA:                                               │
│       - GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA                 │
│       - Units per SKU currently at Amazon                       │
│                                                                 │
│    B. 3PL Warehouse:                                            │
│       - Get inventory report from Talos/3PL                     │
│       - Units per SKU at 3PL                                    │
│                                                                 │
│    C. In-Transit / On-Water:                                    │
│       - Check open POs not yet received                         │
│       - Units per SKU in transit                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CALCULATE TOTAL PHYSICAL INVENTORY VALUE                     │
│                                                                 │
│    Physical Value = (FBA Units × Cost)                          │
│                   + (3PL Units × Cost)                          │
│                   + (In-Transit Units × Cost)                   │
│                                                                 │
│    Sum by brand and component                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. GET QBO BOOK VALUE                                           │
│    - Query Inventory Asset sub-account balances                 │
│    - Sum by brand and component                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. COMPARE AND IDENTIFY VARIANCES                               │
│    - Variance = QBO Book Value - Total Physical Value           │
│    - Break down by SKU                                          │
│    - Flag if variance > threshold (e.g., $100 or 2%)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. FIND CAUSES (for material variances)                         │
│    - Pull adjustment reports from SP-API                        │
│    - Pull removal reports                                       │
│    - Pull return disposition reports (DAMAGED/DEFECTIVE)        │
│    - Match to SKU variances                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. POST ADJUSTMENT JOURNAL ENTRY (only if > threshold)          │
│    - Debit: Inventory Shrinkage / Variance                      │
│    - Credit: Inventory Asset (by component)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. CLEAR SETTLEMENT CONTROL                                     │
│    - Review cumulative variance                                 │
│    - Move to appropriate accounts                               │
│    - Zero out control account                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

# PHASE 7: TESTING & VALIDATION

## Step 7.1: Unit Testing

- Test landed cost allocation logic
- Test COGS calculation logic
- Test variance distribution logic
- Test journal entry generation

## Step 7.2: Integration Testing

- Test QBO API integration (sandbox)
- Test SP-API integration (sandbox)
- Test end-to-end settlement processing

## Step 7.3: Parallel Run

1. Process 3+ settlements with Plutus
2. Compare Plutus COGS to expected values
3. Verify journal entries posted correctly
4. Verify P&L reports show correct brand breakdown

## Step 7.4: Validation Checklist

| Check | Expected Result |
|-------|-----------------|
| LMB posts to brand accounts | Revenue split by brand |
| Plutus posts COGS journal | COGS split by brand + component |
| P&L by brand | Adds up to 100% of total |
| Inventory Asset balance | Matches expected on-hand value |

---

# PHASE 8: GO-LIVE & OPERATIONS

## Step 8.1: Go-Live Checklist

- [ ] QBO accounts created and verified
- [ ] LMB Product Groups configured
- [ ] LMB SKU assignments complete
- [ ] Test settlement processed successfully
- [ ] Plutus deployed to production
- [ ] Monitoring/alerting set up

## Step 8.2: Ongoing Operations

| Task | Frequency | Owner |
|------|-----------|-------|
| Process settlements | Per settlement (~biweekly) | Plutus (auto) |
| Run inventory reconciliation | Monthly | Plutus + Accountant |
| Add new SKUs | As needed | Manual (LMB + Plutus) |
| Enter bills | Per PO (~every 2-3 months) | Manual (QBO) |

## Step 8.3: New SKU Procedure

1. SKU appears in settlement (Plutus flags as unknown)
2. Determine brand assignment
3. Add to Plutus: SKU → Brand mapping
4. Add to LMB: Product Groups → Product SKUs
5. Verify next settlement processes correctly

## Step 8.4: New PO Procedure

1. **Define PO:** Assign a number (e.g., `PO-2026-001`)
2. **Bill Entry:** When entering bills in QBO (Manufacturing, Freight, Duty):
   - Enter `PO-2026-001` in the **"Plutus PO Number" Custom Field**
   - Select the correct Inventory Asset account
3. **Verification:** Check Plutus Landed Cost UI to ensure PO is detected and costs are allocated

**Do NOT use QBO Tags for PO tracking - use the Custom Field.**

---

# APPENDIX A: SKU MAPPING (Current)

## US Marketplace (Amazon.com) → US-Dust Sheets

| SKU | ASIN | Product | FBA Units |
|-----|------|---------|-----------|
| CS-007 | B09HXC3NL8 | 6 Pack Extra Large Plastic Drop Cloth 12x9ft | 5,777 |
| CS-010 | B0CR1GSBQ9 | 3 Pack Extra Large Plastic Drop Cloth 12x9ft | 438 |
| CS-1SD-32M | B0FLKJ7WWM | 1 Pack Extra Large Plastic Drop Cloth 12x9ft | 618 |
| CS-12LD-7M | B0FP66CWQ6 | 12 Pack Extra Large Plastic Drop Cloth 12x9ft | 1,262 |

## UK Marketplace (Amazon.co.uk) → UK-Dust Sheets

| SKU | ASIN | Product | FBA Units |
|-----|------|---------|-----------|
| CS 007 | B09HXC3NL8 | 6 Pack Plastic Dust Sheets 3.6x2.7m | 8,809 |
| CS 008 | B0C7ZQ3VZL | 3 Pack Plastic Dust Sheets 3.6x2.7m (Light) | 0 |
| CS 009 | B0CR1H3VSF | 10 Pack Plastic Dust Sheets 3.6x2.7m | 1,234 |
| CS 010 | B0CR1GSBQ9 | 3 Pack Plastic Dust Sheets 3.6x2.7m | 879 |
| CS 011 | B0DHDTPGGP | 6 Pack Plastic Dust Sheets 3.6x2.7m | 0 |
| CS 1SD-32M | B0FLKJ7WWM | 1 Pack Plastic Dust Sheets 3.6x2.7m | 0 |
| CS-CDS-001 | B0CW3N48K1 | Cotton Dust Sheet 3.6x1.3m (Small) | 0 (1,188 inbound) |
| CS-CDS-002 | B0CW3L6PQH | Cotton Dust Sheet 3.6x2.7m (Large) | 0 (1,120 inbound) |

## Shared ASINs (Same product in both regions)

| ASIN | US SKU | UK SKU | Product |
|------|--------|--------|---------|
| B09HXC3NL8 | CS-007 | CS 007 | 6 Pack Plastic |
| B0CR1GSBQ9 | CS-010 | CS 010 | 3 Pack Plastic |
| B0FLKJ7WWM | CS-1SD-32M | CS 1SD-32M | 1 Pack Plastic |

## SKU Count Summary

| Region | Active SKUs | Total SKUs |
|--------|-------------|------------|
| US | 4 | 4 |
| UK | 5 | 8 |
| **Total unique** | **9** | **12** |

---

# APPENDIX B: AMAZON SP-API REPORTS

| Report Type | Purpose |
|-------------|---------|
| GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2 | Settlement transactions |
| GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA | Current FBA inventory |
| GET_FBA_FULFILLMENT_INVENTORY_ADJUSTMENTS_DATA | Damaged, lost, found |
| GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA | Return dispositions |
| GET_FBA_FULFILLMENT_REMOVAL_ORDER_DETAIL_DATA | Removal orders |
| GET_REIMBURSEMENTS_DATA | Amazon reimbursements |
| GET_FBA_FULFILLMENT_INVENTORY_RECEIPTS_DATA | Shipment receipts |

---

# APPENDIX C: QBO ACCOUNT TYPES REFERENCE

| Account Type | Detail Type | Use For |
|--------------|-------------|---------|
| Income | Sales of Product Income | Amazon Sales |
| Income | Discounts/Refunds Given | Amazon Refunds |
| Other Income | Other Miscellaneous Income | FBA Reimbursements |
| Cost of Goods Sold | Supplies & Materials - COGS | Manufacturing, Mfg Accessories |
| Cost of Goods Sold | Shipping, Freight & Delivery - COS | Freight, Duty, Fees |
| Cost of Goods Sold | Other Costs of Service - COS | Shrinkage, Variance |
| Other Current Assets | Inventory | Inventory Asset sub-accounts |
| Other Current Assets | Other Current Assets | Control accounts |

---

# APPENDIX D: LMB TRANSACTION CATEGORIES

| Category | Type | Split by Brand | Handled By |
|----------|------|----------------|------------|
| Amazon Sales | Revenue | Yes | LMB |
| Amazon Refunds | Revenue | Yes | LMB |
| Amazon FBA Inventory Reimbursement | Other Income | Yes | LMB |
| Amazon Seller Fees | Expense | Yes | LMB |
| Amazon FBA Fees | Expense | Yes | LMB |
| Amazon Storage Fees | Expense | Yes | LMB |
| Amazon Advertising Costs | Expense | Yes | LMB |
| Amazon Promotions | Expense | Yes | LMB |
| Amazon Sales Tax | Current Liability | No | LMB |
| Amazon Loans | Current Liability | No | LMB |
| Amazon Reserved Balances | Current Asset | No | LMB |
| Amazon Split Month Rollovers | Current Asset | No | LMB |
| Amazon Deferred Balances | Current Asset | No | LMB |
| COGS (Manufacturing) | COGS | Yes | Plutus |
| COGS (Freight) | COGS | Yes | Plutus |
| COGS (Duty) | COGS | Yes | Plutus |
| COGS (Mfg Accessories) | COGS | Yes | Plutus |
| Storage 3PL | COGS | Yes | Manual (QBO) |
| Land Freight | COGS | Yes | Manual (QBO) |

---

# APPENDIX E: CRITICAL EDGE CASES

## E.1: Currency Handling & QBO Setup

**QBO Account Configuration:**

| Account Type | Currency Setting | Notes |
|--------------|------------------|-------|
| Income/Expense/COGS | Home Currency (USD) | Cannot set to GBP - QBO doesn't allow it |
| Bank Accounts | Can be GBP | e.g., Wise GBP Account |
| A/R, A/P | Can be GBP | If you have UK vendors/customers |
| Inventory Asset | Home Currency (USD) | Standard QBO accounts |

**Critical:** Do NOT attempt to set "GBP" currency for Income/Expense/COGS accounts. In QBO, these account types are **always in Home Currency (USD)**.

**Plutus Logic:**
- Plutus creates Journal Entries in USD (Home Currency)
- The "Inventory Asset" and "COGS" accounts are standard QBO accounts
- This works because the value of the asset is "trapped" in USD when you buy it
- When you sell in the UK, you're simply moving that USD value from Asset to Expense
- The currency of the sale (GBP) is handled entirely by LMB on the Revenue side

**How it flows:**

1. **Buying inventory:** You pay suppliers in USD. All costs in `SkuCost` table are in **USD**.

2. **Selling (US):** 
   - LMB posts revenue in USD
   - Plutus posts COGS in USD
   - Clean match

3. **Selling (UK):**
   - LMB posts revenue (GBP transaction → USD account via QBO FX)
   - Plutus posts COGS in USD (same as US)
   - The GBP sale is handled at transaction level, not account level

**Why this is clean:**
- No currency conversion at COGS posting time
- Inventory Asset is always in USD
- COGS is always in USD
- LMB handles GBP revenue via transaction-level currency
- QBO handles FX translation for reporting

## E.2: Returns Handling (FBA Returns Report)

**Key Insight:** Settlement REFUND ≠ Physical Return

| Scenario | Settlement Report | FBA Returns Report | COGS Action |
|----------|------------------|-------------------|-------------|
| Customer returns item | Shows REFUND | Shows RETURN | Reverse COGS ✓ |
| Returnless refund | Shows REFUND | NO entry | No reversal ✓ |
| Item returned damaged | Shows REFUND | Shows RETURN (DAMAGED) | No reversal → Shrinkage |

**Why use FBA Returns Report instead of Settlement:**
- Settlement refunds include "returnless refunds" (customer keeps item)
- We should only reverse COGS when item is actually back in sellable inventory
- FBA Returns Report shows what physically returned and its disposition

**Plutus handling: Use FBA Returns Report (separate from Settlement processing)**

See Step 6.2 for the Returns Processing Flow.

**Journal Entry for Sellable Return:**
```
Return: 2 units of CS-007 @ $2.50 total landed cost
Disposition: SELLABLE

DEBITS (Inventory Asset - cost goes BACK to balance sheet):
  Inventory Asset: Manufacturing - US   $4.00
  Inventory Asset: Freight - US         $0.60
  Inventory Asset: Duty - US            $0.30
  Inventory Asset: Mfg Accessories - US $0.10

CREDITS (COGS - reduces expense):
  Manufacturing - US-Dust Sheets        $4.00
  Freight - US-Dust Sheets              $0.60
  Duty - US-Dust Sheets                 $0.30
  Mfg Accessories - US-Dust Sheets      $0.10
```

**Damaged/Defective Returns:** No COGS reversal. Monthly reconciliation catches these and posts to Inventory Shrinkage.

**Important P&L Timing Note:**

Because we separate Sales (Settlement) from Returns (Physical Receipt), a timing difference will exist on your P&L:

| Month | Event | P&L Impact |
|-------|-------|------------|
| Month A | Customer refunds item. LMB posts Refund expense. | Lower Profit |
| Month B | Item arrives at FBA, marked Sellable. Plutus posts COGS Reversal. | Higher Profit |

**Net Result:** Over time, it balances perfectly. Do not panic if a heavy return month looks less profitable - the inventory credit will arrive when the goods physically return to FBA.

## E.3: Reimbursements Handling

**Scenario:** Amazon loses/damages inventory and reimburses seller.

**What happens:**
1. LMB posts income to Amazon FBA Inventory Reimbursement - [Brand]
2. Inventory is gone (Amazon lost it)
3. But Inventory Asset still has the cost on books

**Plutus handling:**
- During monthly reconciliation:
  1. Pull GET_REIMBURSEMENTS_DATA report
  2. Match reimbursed SKUs to inventory variance
  3. Post adjustment:
     ```
     Debit: Inventory Shrinkage (or specific loss account)
     Credit: Inventory Asset: [Component] - [Brand]
     ```
- The reimbursement income (LMB) offsets the shrinkage expense (Plutus)

## E.4: Unknown SKU in Settlement

**Scenario:** New SKU appears in settlement that Plutus doesn't recognize.

**Handling:**
1. Plutus flags settlement as "NEEDS_ATTENTION"
2. Shows list of unknown SKUs in UI
3. User must:
   - Add SKU to Plutus with brand mapping
   - Add SKU to LMB Product Group
   - Enter landed cost (or mark as $0 if no inventory yet)
4. Reprocess settlement

**Validation:**
- Plutus should validate ALL SKUs are mapped before processing
- Block processing if any unknown SKUs

## E.5: Negative Settlement Total

**Scenario:** Settlement total is negative (fees > sales, or large reserve release).

**Handling:**
- LMB handles this normally (posts negative amounts)
- Plutus still processes COGS based on units sold
- Negative settlement doesn't mean negative COGS
- Units sold is always positive or zero

## E.6: Partial PO / Incomplete Bills

**Scenario:** Manufacturing bill arrives, but freight bill hasn't arrived yet.

**Handling:**
1. Enter manufacturing bill with "Plutus PO Number" Custom Field (e.g., PO-2026-001)
2. Plutus sees incomplete PO (missing freight/duty)
3. Plutus flags PO as "INCOMPLETE" in UI
4. When freight bill arrives, enter with same PO number in Custom Field
5. Plutus recalculates landed cost when all bills present

**Validation rules:**
- PO is "complete" when it has: Manufacturing bill + Freight bill + Duty bill
- User can manually mark PO as "complete" if no duty applies
- Incomplete POs show warning but don't block processing (use last known cost)

## E.7: Cost Method

**Decision: Use WEIGHTED AVERAGE cost method**

**Rationale:**
- Simpler than FIFO for FBA (commingled inventory)
- Amazon doesn't track which specific unit was sold
- Matches how most e-commerce businesses operate

**Implementation:**
- When new PO lands, recalculate weighted average for each component
- Formula: (existing_value + new_value) / (existing_units + new_units)
- Store per-unit cost per component in SkuCost table

**Example:**
```
Existing: 100 units @ $2.00 manufacturing = $200
New PO: 200 units @ $2.50 manufacturing = $500
New weighted average: $700 / 300 units = $2.33/unit
```

## E.8: 3PL Storage & Land Freight (Direct Expenses)

**These costs are NOT capitalized to Inventory Asset:**

| Cost | Why Direct Expense |
|------|-------------------|
| 3PL Storage | Monthly lump sum, not tied to specific PO or units |
| Land Freight | Incurred after goods arrive, fulfillment cost |

**How to handle:**
1. When bill arrives, estimate brand split based on inventory %
2. Post directly to COGS accounts (Storage 3PL - [Brand] or Land Freight - [Brand])
3. Plutus does NOT process these - manual entry in QBO

**Brand Split Estimation:**
- Check current FBA inventory units per brand
- Or use rough estimate (e.g., 60% US / 40% UK)
- Document your method for consistency

---

**Important:** US and UK are SEPARATE LMB connections.

## F.1: Amazon North America Connection

- **LMB Account:** Targon - AMAZON NORTH AMERICA
- **Marketplace:** Amazon.com (US)
- **Currency:** USD
- **Bank Account for Deposits:** Chase Checking (USD)
- **Product Groups to create:** US-Dust Sheets
- **SKUs:** CS-007, CS-010, CS-1SD-32M, CS-12LD-7M

## F.2: Amazon Europe Connection

- **LMB Account:** Targon - AMAZON EUROPE (or similar)
- **Marketplace:** Amazon.co.uk (UK)
- **Currency:** GBP
- **Bank Account for Deposits:** Wise GBP Account
- **Product Groups to create:** UK-Dust Sheets
- **SKUs:** CS 007, CS 008, CS 009, CS 010, CS 011, CS 1SD-32M, CS-CDS-001, CS-CDS-002

## F.3: Configuration for Each Connection

**Repeat Phase 2 steps for EACH LMB connection:**

1. Complete Accounts & Taxes Wizard
2. Create Product Group (one per connection)
3. Assign SKUs to Product Group
4. Map accounts for Product Group
5. Set tax rates:
   - US: No Tax Rate Applicable (marketplace facilitator)
   - UK: Standard Rate 20% (or as appropriate for VAT)

---

# APPENDIX G: UK VAT HANDLING

## G.1: VAT Background

- UK has 20% standard VAT rate
- Amazon collects VAT on B2C sales (marketplace facilitator)
- LMB separates VAT from gross sales

## G.2: LMB VAT Settings (UK Connection)

| Setting | Value |
|---------|-------|
| VAT Scheme | Standard |
| Default Tax Rate | 20% Standard |
| Product Groups | May need separate groups for zero-rated items |

## G.3: Impact on Accounts

- Amazon Sales - UK-Dust Sheets = NET sales (excl VAT)
- VAT collected goes to separate VAT liability account
- Plutus COGS is not affected by VAT (COGS is always net)

---

# APPENDIX H: AMAZON PROMOTIONS & COUPONS

## H.1: Missing Transaction Category

Add to LMB Transaction Categories:

| Category | Type | Split by Brand | Handled By |
|----------|------|----------------|------------|
| Amazon Promotions | Expense | Yes | LMB |

## H.2: Account Setup

**Under LMB parent (if exists) or create new:**
| Sub-Account Name | Account Type | Detail Type |
|------------------|--------------|-------------|
| Amazon Promotions - US-Dust Sheets | Cost of Goods Sold | Other Costs of Service - COS |
| Amazon Promotions - UK-Dust Sheets | Cost of Goods Sold | Other Costs of Service - COS |

## H.3: LMB Product Group Mapping

Add Promotions account mapping to each Product Group in LMB.

---

# Document History

- v1: January 15, 2026 - Initial plan
- v2: January 15, 2026 - Comprehensive A-Z implementation guide
- v2.1: January 16, 2026 - Currency simplification (all COGS in USD), refund handling (reverse COGS)
- v2.2: January 16, 2026 - Tags→Custom Fields, InventoryLedger model, dual stream processing (Sales/Returns separate), reconciliation includes 3PL+In-Transit, UNASSIGNED Product Group safety net
- v2.3: January 16, 2026 - Split-month JE logic (match LMB), historical cost lookup (as-of date), QBO bill query limitation note, currency setup correction
- v3.0: January 16, 2026 - SettlementPosting table (multi-JE support), memo-based LMB matching, removed Settlement Control, P&L timing note for returns, Tag cleanup
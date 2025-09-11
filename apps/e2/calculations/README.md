# Calculations

Financial modeling and forecasting application for E2 Trading LLC.

## Overview

Web application for managing water filter product business finances:
- Income statements, balance sheets, and cash flow reports
- Sales forecasting across Amazon, Walmart, and retail channels
- Inventory planning and order management
- Expense tracking and payroll management
- Multi-year financial projections (2025-2030)

## Structure

```
/src
  /app         - Next.js pages and API routes
  /components  - React components for each module
  /lib         - Business logic and utilities
  /services    - Data services and calculations
/strategies    - Financial strategy implementations
/prisma        - Database schema and migrations
```

## Modules

- **Products** - SKU management and pricing
- **Sales Forecast** - Weekly sales projections
- **Order Planning** - Inventory procurement
- **Expenses** - Operating expense tracking
- **General Ledger** - Bookkeeping entries
- **Reports** - Financial statements
- **Charts** - Performance visualizations

## Setup

```bash
npm install
npx prisma generate
npx prisma db push
cd strategies/e2-conservative
npx tsx e2-conservative.ts
cd ../..
npm run dev
```

Open http://localhost:4321
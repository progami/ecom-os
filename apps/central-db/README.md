# CentralDB - Ecommerce OS

Centralized database system for multi-marketplace e-commerce operations. Part of the Ecommerce OS ecosystem.

## Overview

CentralDB provides a unified data layer for managing products, inventory, orders, and financial data across multiple e-commerce marketplaces (Amazon, Walmart, eBay). It serves as the single source of truth for all business data.

## Features

- **Product Catalog Management**: Centralized product information with SKU tracking
- **Multi-Warehouse Inventory**: Real-time inventory tracking across warehouses
- **Order Management**: Unified order processing for all marketplaces
- **Marketplace Integration**: Sync products and orders with Amazon, Walmart, eBay
- **Financial Integration**: Transaction tracking and account management
- **Analytics Dashboard**: Business intelligence and reporting

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Authentication**: NextAuth.js (coming soon)

## Installation

1. Clone the repository:
```bash
git clone git@github.com:progami/CentralDB_EcomOS.git
cd CentralDB
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Set up the database:
```bash
npx prisma db push
npx prisma generate
```

5. Run the development server:
```bash
npm run dev
```

The application will be available at http://localhost:3004

## Database Schema

Core entities include:
- **Products**: Master product catalog with SKUs
- **Inventory**: Stock levels per warehouse
- **Orders**: Customer orders from all marketplaces
- **Marketplaces**: Configuration for each sales channel
- **Warehouses**: FBA, 3PL, and owned warehouse tracking
- **Transactions**: Financial records for bookkeeping integration

## API Endpoints

See [API.md](./API.md) for detailed API documentation.

## Integration

CentralDB integrates with:
- **WMS Module** (port 3002): Warehouse management
- **Bookkeeping Module** (port 3003): Financial tracking
- **Navigation Hub** (port 3000): Main dashboard

## Development

```bash
# Run development server
npm run dev

# Run linting
npm run lint

# Run tests
npm run test
```

## Testing

The project uses Playwright for E2E testing with 100% UI coverage requirement.

```bash
# Run all tests
npm run test

# Run UI tests
npm run test:ui

# Run business logic tests
npm run test:business
```

## Contributing

Follow the Ecom-OS guidelines at https://github.com/progami/Ecom-OS

## License

Proprietary - Part of Ecommerce OS
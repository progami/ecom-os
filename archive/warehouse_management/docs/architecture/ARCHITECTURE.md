# Warehouse Management System - Architecture

## Module Structure

The application is organized into logical modules that reflect business domains:

### 1. Operations Module (`/operations`)
- **Inventory Ledger** (`/operations/inventory`) - View and manage inventory balances and transactions
- **Receive Goods** (`/operations/receive`) - Process incoming shipments
- **Ship Goods** (`/operations/ship`) - Process outbound shipments

### 2. Finance Module (`/finance`)
- **Dashboard** (`/finance/dashboard`) - Financial overview and metrics
- **Invoices** (`/finance/invoices`) - Upload and manage warehouse invoices
- **Reconciliation** (`/finance/reconciliation`) - Compare calculated costs with invoices

### 3. Configuration Module (`/config`)
- **Products (SKUs)** (`/config/products`) - Product master data and specifications
- **Locations** (`/config/locations`) - Warehouse locations and settings
- **Cost Rates** (`/config/rates`) - 3PL pricing and rate structures
- **Warehouse Configs** (`/config/warehouse-configs`) - Batch-specific pallet configurations

### 4. Analytics Module (`/reports` & `/integrations`)
- **Report Generator** (`/reports`) - Create custom reports with various filters
- **Amazon FBA** (`/integrations/amazon`) - Sync inventory with Amazon FBA
- **Data Exports** - CSV and Excel export functionality

### 5. Admin Module (`/admin`)
- **Users** (`/admin/users`) - User management and permissions
- **Settings** (`/admin/settings`) - System-wide settings and configurations

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **State Management**: React hooks and context
- **File Handling**: Base64 encoding for document attachments

## Key Features

### Inventory Management
- Real-time inventory tracking by warehouse, SKU, and batch/lot
- Point-in-time inventory views for historical analysis
- Immutable transaction ledger with database triggers
- Support for both storage and shipping pallet configurations

### Financial Management
- Automated cost calculations based on configurable rates
- Invoice upload and reconciliation
- Monthly billing cycle support
- Multi-currency support (primarily GBP)

### Data Integrity
- Immutable ledger with append-only transactions
- Prevention of backdated transactions
- Automatic inventory balance calculations
- Audit trail for all changes

### User Experience
- Role-based access control (Admin, Staff)
- Responsive design for desktop and mobile
- Excel-like data entry for familiar workflows
- Bulk operations support

## Database Schema

Key tables:
- `User` - System users with role-based permissions
- `Warehouse` - Physical warehouse locations
- `SKU` - Product master data
- `InventoryTransaction` - Immutable ledger of all movements
- `InventoryBalance` - Current stock levels by warehouse/SKU/batch
- `StorageLedger` - Daily storage calculations
- `Invoice` - Uploaded warehouse invoices
- `Reconciliation` - Comparison of calculated vs invoiced amounts

## Security

- Session-based authentication
- Role-based access control
- Input validation and sanitization
- SQL injection prevention via Prisma
- XSS protection
- CSRF protection

## Development Guidelines

1. Follow the module structure for new features
2. Use TypeScript for type safety
3. Write comprehensive tests for critical paths
4. Use database transactions for data consistency
5. Follow the existing UI/UX patterns
6. Document API endpoints and complex logic

## Deployment

The application is designed to be deployed on:
- Vercel (recommended for Next.js)
- Any Node.js hosting platform
- PostgreSQL database (local or cloud)

Environment variables required:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Authentication secret
- `NEXTAUTH_URL` - Application URL
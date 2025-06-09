# Warehouse Management System - Web App Architecture

## Overview
After careful analysis of your requirements, I'm proposing a modern, scalable architecture that prioritizes:
- **Multi-user collaboration** with real-time updates
- **Intuitive interfaces** tailored to each user role
- **Robust data integrity** with comprehensive validation
- **Performance** for complex calculations and reporting

## Technology Stack

### Frontend: Next.js 14 (App Router) + TypeScript
**Why Next.js?**
- Server-side rendering for fast initial loads
- Built-in API routes reduce complexity
- Excellent SEO and performance out of the box
- TypeScript ensures type safety across the entire application

**UI Framework: Tailwind CSS + shadcn/ui**
- Professional, consistent design system
- Fully accessible components
- Mobile-responsive by default
- Easy to customize for your brand

### Backend: Next.js API Routes + Prisma ORM
**Why this combination?**
- Single codebase for frontend and backend
- Type-safe database queries with Prisma
- Automatic TypeScript types from database schema
- Built-in request validation with Zod

### Database: PostgreSQL (via Supabase)
**Why PostgreSQL?**
- ACID compliance crucial for financial data
- Complex queries for reporting
- Row-level security for multi-tenant data
- Supabase adds real-time subscriptions and authentication

### Additional Services
- **NextAuth.js**: Secure authentication with simplified two-role access (Admin/Staff)
- **React Hook Form**: Form handling and validation
- **Zod**: Schema validation for API endpoints
- **Recharts**: Data visualization for dashboards and reports

## User Roles & Interfaces

### Simplified Two-Role System

#### 1. Admin Role
**Full System Access:**
- All warehouse operations (receive, ship, inventory management)
- Financial management (invoices, reconciliation, cost calculations)
- System configuration (users, SKUs, warehouses, cost rates)
- All reports and analytics
- User management and security settings

#### 2. Staff Role
**Operational Access:**
- Inventory ledger (view transactions and balances)
- Receive and ship goods
- View and upload invoices
- Access reconciliation tools
- View operational reports

### Key Interface: Unified Inventory Page
**Single Page with Three Tabs:**
1. **Inventory Ledger Tab**
   - Shows all inventory movements (RECEIVE, SHIP, ADJUST_IN, ADJUST_OUT)
   - Filterable by date, warehouse, SKU, transaction type
   - Sortable date column with visual indicators
   - Includes pallets in/out tracking
   - Pickup date and reconciliation status
   - Exportable to Excel
   - Immutable ledger with database triggers
   
2. **Current Balances Tab**
   - Real-time inventory levels by Warehouse + SKU + Batch
   - Low stock alerts
   - Point-in-time historical views
   - Running balance calculations
   
3. **Storage Ledger Tab**
   - Weekly storage cost calculations
   - Monday 23:59:59 CT snapshots
   - Monthly aggregation view (16th-15th billing periods)
   - Cost share breakdown per SKU
   - CSV export functionality

**Features:**
- Pre-filled forms based on common transactions
- Voice input for hands-free operation
- Real-time validation (prevent negative inventory)
- Transaction history view

### Key Features by Role

**Admin Features:**
- Master data management (SKUs, warehouses, cost rates)
- User access control
- System configuration
- Financial reconciliation tools
- All operational features
- Amazon FBA integration
- Comprehensive reports and analytics

**Staff Features:**
- Receive and ship inventory
- View transaction history
- Upload invoices
- Access reconciliation tools
- Generate operational reports
- View inventory balances

## Key Architectural Decisions

### 1. Real-Time Updates
Using Supabase Realtime subscriptions:
- Inventory changes broadcast immediately
- Multiple users see updates without refresh
- Conflict resolution for simultaneous edits

### 2. Background Processing
Weekly storage calculations are processed through the Storage Ledger feature:
- Captures inventory snapshots every Monday at 23:59:59 CT
- Calculates storage costs based on pallet counts and rates
- Aggregates weekly data into monthly billing periods (16th-15th)
- All calculations done on-demand when viewing the Storage Ledger tab

### 3. Data Validation Layers
Three levels of validation:
1. **Frontend**: Immediate user feedback
2. **API**: Server-side validation with Zod
3. **Database**: Constraints and triggers

### 4. Audit Trail
Every transaction logged with:
- User ID
- Timestamp
- Before/after values
- IP address
- Change reason

## Database Schema (Key Tables)

```sql
-- Core entities
users (id, email, role, warehouse_id)
warehouses (id, name, config)
skus (id, code, description, dimensions)
warehouse_sku_config (warehouse_id, sku_id, storage_pallets, shipping_pallets)

-- Transactions
inventory_transactions (id, type, warehouse_id, sku_id, batch, quantity, user_id, timestamp)
inventory_balances (warehouse_id, sku_id, batch, current_quantity)

-- Financial
cost_rates (id, warehouse_id, cost_type, rate, effective_date, end_date)
storage_snapshots (id, week_ending, warehouse_id, sku_id, quantity, pallets, cost)
invoices (id, number, warehouse_id, period_start, period_end)
invoice_line_items (id, invoice_id, cost_type, quantity, amount)
```

## Security & Robustness

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- API rate limiting
- Session management

### Data Integrity
- Database transactions for multi-table updates
- Optimistic locking for concurrent edits
- Automated backups every 6 hours
- Point-in-time recovery capability

### Error Handling
- Graceful degradation for offline mode
- Comprehensive error logging
- User-friendly error messages
- Automatic retry for failed calculations

## Current Implementation Status

The system is fully implemented with the following features:
- ✅ Two-role authentication system (Admin/Staff)
- ✅ Complete inventory management with immutable ledger
- ✅ Real-time balance calculations with point-in-time views
- ✅ Storage ledger with weekly/monthly aggregations
- ✅ Financial reconciliation and invoice management
- ✅ Master data management (SKUs, warehouses, cost rates)
- ✅ Amazon FBA integration for inventory comparison
- ✅ Comprehensive reporting and export functionality
- ✅ Document attachments for transactions
- ✅ Pickup date tracking and reconciliation status
- ✅ Chronological transaction enforcement

## Scalability Considerations

- **Horizontal scaling**: Stateless API design
- **Database sharding**: By warehouse if needed
- **Caching strategy**: Redis for frequently accessed data
- **CDN**: Static assets and images
- **Background jobs**: Separate worker processes

## Data Management

The system provides comprehensive data management:
1. **Initial Data**: Excel data has been imported (174 transactions)
2. **Ongoing Operations**: All data entry through web interface
3. **Data Integrity**: Immutable ledger with audit trail
4. **Validation**: Multi-layer validation (frontend, API, database)
5. **Export Capabilities**: Full system backup and individual module exports

This architecture has been fully implemented and is in production use. It provides a robust, scalable solution for multi-warehouse inventory and financial management with comprehensive audit trails and real-time tracking.
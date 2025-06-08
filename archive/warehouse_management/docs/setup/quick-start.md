# Quick Start Guide

## Prerequisites

Before starting, ensure you have:
- Node.js 18+ installed
- PostgreSQL database (local or cloud)
- Git installed
- Redis (optional, for background jobs)

## 1. Clone and Install

```bash
# Clone the repository
git clone [repository-url]
cd warehouse_management

# Install dependencies
npm install
```

## 2. Database Setup

### Option A: Local PostgreSQL
```bash
# Create a new database
createdb warehouse_management

# Update .env with your connection string
DATABASE_URL="postgresql://username:password@localhost:5432/warehouse_management"
```

### Option B: Supabase (Recommended)
1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Copy connection string from Settings > Database
4. Add to `.env` file

## 3. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add:
# - DATABASE_URL
# - NEXTAUTH_SECRET (generate with: openssl rand -base64 32)
# - Supabase keys (if using Supabase)
```

## 4. Initialize Database

```bash
# Push schema to database
npm run db:push

# Generate Prisma client
npm run db:generate

# Seed with demo data
npm run db:seed

# Note: The immutable ledger is enforced by database triggers
# created during migrations - no additional script needed
```

**Note**: The immutable ledger prevents editing/deleting transactions for audit compliance.

## 5. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## 6. Login Credentials

After seeding, use these credentials (email or username / password):

- **Admin**: admin@warehouse.com (or admin) / admin123
- **Staff (Finance)**: hashar@warehouse.com (or hashar) / staff123
- **Staff (Operations)**: umair@warehouse.com (or umair) / staff123

## Common Issues

### Database Connection Failed
- Check PostgreSQL is running
- Verify connection string in .env
- Ensure database exists

### Port 3000 Already in Use
```bash
# Update PORT in .env.local
PORT=3001

# Then run normally
npm run dev
```

### Module Not Found Errors
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
```

## Next Steps

1. Explore the dashboard
2. Try entering inventory transactions
3. View the Prisma Studio: `npm run db:studio`
4. Check the docs folder for more guides
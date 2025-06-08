# WMS Local Setup Guide

## Current Status
✅ Schema changes committed and PR created (#1)
⏳ Waiting for PR approval per database governance protocol
📋 Implementation code ready to be committed after approval

## Setup Instructions (After PR Approval)

### 1. Prerequisites
Ensure you have the following installed:
- Node.js 18+
- PostgreSQL (via Docker recommended)
- Git
- GitHub CLI (`gh`)

### 2. Database Setup

Start PostgreSQL using Docker:
```bash
docker run --name ecom-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ecom_os_dev \
  -p 5432:5432 \
  -d postgres:15
```

### 3. Clone and Setup

```bash
# Clone the repository
git clone git@github.com:progami/ecom_os.git
cd ecom_os

# Checkout the WMS branch (after PR is merged)
git checkout main
git pull origin main

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env to ensure DATABASE_URL is correct:
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ecom_os_dev?schema=public"

# Run database migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate
```

### 4. Running the Application

```bash
# Start the Next.js development server
npm run dev
```

The application will be available at:
- Main app: http://localhost:3000
- WMS Dashboard: http://localhost:3000/wms
- WMS Warehouses: http://localhost:3000/wms/warehouses
- WMS Inventory: http://localhost:3000/wms/inventory

### 5. Running the Automation Script

In a separate terminal:
```bash
cd warehouse_management
npm install
cp .env.example .env
# Edit .env if needed

# Run the daily report script
npm start
```

### 6. Default Login

For testing, use:
- Email: admin@ecomos.com
- Password: admin

### 7. Testing the Integration

Run the integration test:
```bash
cd warehouse_management
npx ts-node test-integration.ts
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running: `docker ps`
- Check DATABASE_URL in .env
- Verify database exists: `docker exec -it ecom-postgres psql -U postgres -c "\l"`

### Port Already in Use
If port 3000 is in use:
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Or run on a different port
PORT=3001 npm run dev
```

### Missing Dependencies
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Next Steps After Setup

1. Create a warehouse via UI or API
2. Add some products
3. Create inventory transactions
4. Run the automation script to see low stock reports
5. Check the dashboard for real-time stats

## Development Workflow

1. Always work on feature branches following the naming convention
2. Commit schema changes separately
3. Create PR and wait for approval before continuing
4. Follow the coding standards in docs/CODING_STANDARDS.md
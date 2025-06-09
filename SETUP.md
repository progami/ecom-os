# Ecom OS - Local Development Setup

## Quick Start

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/progami/ecom_os.git
   cd ecom_os
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

3. **Generate Prisma client and create database**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

4. **Seed the database** (optional)
   ```bash
   npm run prisma:seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## Database Configuration

### For Local Development (Default)
We use SQLite for simplicity. No setup required!
```
DATABASE_URL="file:./dev.db"
```

### For PostgreSQL (Production/Advanced)
If you prefer PostgreSQL:
1. Install PostgreSQL locally
2. Create a database: `createdb ecom_os`
3. Update .env.local:
   ```
   DATABASE_URL="postgresql://postgres:password@localhost:5432/ecom_os"
   ```

## Common Issues

### "User denied access" Error
This happens when trying to use PostgreSQL syntax with SQLite. Ensure your DATABASE_URL starts with `file:` for SQLite.

### NextAuth Errors
Make sure NEXTAUTH_SECRET is set to a random string (32+ characters).

## Working with Worktrees

Each sub-app has its own worktree:
- Auth: `git worktree add ../auth auth`
- WMS: `git worktree add ../wms wms`
- Bookkeeping: `git worktree add ../bookkeeping bookkeeping`

Each worktree should use the same .env.local file from master.
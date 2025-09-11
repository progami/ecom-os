# Suggested Commands for MarginMaster

## Development Commands
```bash
# Start development server (port 3007)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint
```

## Database Commands (Prisma)
```bash
# Push schema changes to database
npm run db:push

# Run migrations in development
npm run db:migrate

# Open Prisma Studio for database GUI
npm run db:studio

# Generate Prisma Client
npm run db:generate
```

## Darwin/macOS Specific Commands
```bash
# List files with details
ls -la

# Search for files
find . -name "*.tsx" -type f

# Search in files (using ripgrep which is pre-installed)
rg "pattern" --type ts

# Check git status
git status

# View git diff
git diff

# Make scripts executable
chmod +x ./start.sh
```

## Project Navigation
```bash
# Navigate to project root
cd /Users/jarraramjad/Documents/ecom_os/MarginMaster

# Common directories
cd app         # Next.js app pages and layouts
cd components  # Reusable React components
cd lib         # Utility functions and configurations
cd prisma      # Database schema and migrations
```
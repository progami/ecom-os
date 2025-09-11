# Project Guidelines

## Important Rules
- **NO DUMMY DATA**: Never use dummy or mock data in the application. All data should come from the actual database.
- Always fetch real data from the database using Prisma
- Never hardcode example data in components
- If no data exists, show appropriate empty states

## Database Information
- The inventory table has a SKU column with the following values:
  - CS 007
  - CS 008
  - CS 009
  - CS 010
  - CS 011
  - CS 012
  - CS CDS 001
  - CS CDS 002

## Development Commands
- Run development server: `npm run dev`
- Run database migrations: `npx prisma migrate dev`
- Seed database: `npx prisma db seed`
- Open Prisma Studio: `npx prisma studio`
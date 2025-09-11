# MarginMaster Project Overview

MarginMaster is a Next.js application designed for margin calculations and cost simulations for materials and sourcing profiles. It provides tools for businesses to analyze costs, simulate different sourcing scenarios, and optimize their profit margins.

## Key Features
- Material profile management with cost per area and density tracking
- Sourcing profile configuration with tariff rates and freight assumptions  
- Cost simulation studio for analyzing different scenarios
- Dashboard for overview and analytics
- User authentication with role-based access (Admin/Staff)

## Tech Stack
- **Frontend**: Next.js 14.2.3 with App Router, React 18, TypeScript
- **Styling**: TailwindCSS with tailwind-merge and class-variance-authority
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth v4
- **Forms**: React Hook Form with Zod validation
- **State Management**: React Query (TanStack Query v5)
- **Data Visualization**: Recharts
- **UI Components**: Radix UI primitives

## Development Server
- Runs on port 3007 (configured in package.json)
- Access at http://localhost:3007
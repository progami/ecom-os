# Code Style and Conventions

## TypeScript Configuration
- **Strict Mode**: Enabled for type safety
- **Module System**: ESNext modules with bundler resolution
- **Path Aliases**: Use `@/*` for absolute imports from project root
- **JSX**: Preserve mode for Next.js compatibility

## File Structure Conventions
- **Pages**: Located in `app/` directory using Next.js App Router
- **Components**: Organized in `components/` with subdirectories:
  - `ui/`: Reusable UI components (button, card, dialog, etc.)
  - `layout/`: Layout components (navigation, dashboard layout)
- **Utilities**: Helper functions in `lib/` directory
- **Database**: Prisma schema in `prisma/schema.prisma`

## Naming Conventions
- **Files**: kebab-case for files (e.g., `dashboard-layout.tsx`)
- **Components**: PascalCase for React components
- **Database Models**: PascalCase for models, snake_case for table names
- **Enums**: UPPER_CASE for enum values

## Component Patterns
- Functional components with TypeScript interfaces
- Client components marked with `'use client'` directive when needed
- Server components by default in App Router
- UI components built on Radix UI primitives

## Database Conventions
- UUID primary keys using `@default(uuid())`
- Timestamps: `createdAt` and `updatedAt` on all models
- Decimal types for financial data with explicit precision
- Mapped table names using `@@map()` directive
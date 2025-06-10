# Technology Stack Deep Dive

## Warehouse Management System (WMS)

### Core Technologies

#### Frontend
- **Next.js 14.1.3** - React framework with App Router
- **React 18.2.0** - UI library
- **TypeScript 5.4.2** - Type safety
- **Tailwind CSS 3.4.1** - Utility-first CSS

#### UI Components & Libraries
- **Radix UI** - Headless component library
  - @radix-ui/react-accordion
  - @radix-ui/react-alert-dialog
  - @radix-ui/react-checkbox
  - @radix-ui/react-dialog
  - @radix-ui/react-dropdown-menu
  - @radix-ui/react-label
  - @radix-ui/react-popover
  - @radix-ui/react-select
  - @radix-ui/react-tabs
  - @radix-ui/react-toast
- **Lucide React 0.356.0** - Icon library
- **React Hook Form 7.51.0** - Form management
- **Zod 3.22.4** - Schema validation
- **Class Variance Authority 0.7.1** - CSS class composition

#### Data Visualization
- **Recharts 2.12.2** - Charting library
- **jsPDF 3.0.1** - PDF generation
- **jspdf-autotable 5.0.2** - PDF table generation

#### State & Data Management
- **TanStack Query 5.28.4** - Server state management
- **TanStack Table 8.13.2** - Table management
- **Prisma 5.11.0** - ORM with PostgreSQL
- **Decimal.js 10.5.0** - Precise decimal arithmetic

#### Authentication & Security
- **NextAuth.js 4.24.7** - Authentication
- **bcryptjs 2.4.3** - Password hashing
- **JWT** - Token-based auth

#### External Integrations
- **Amazon SP API 1.1.6** - Amazon Seller Partner API
- **BullMQ 5.4.2** - Job queue management
- **XLSX 0.18.5** - Excel file operations

#### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest** - Unit testing
- **Playwright** - E2E testing

### Database Schema Highlights

```prisma
// Key models from WMS
model User {
  id           String    @id @default(uuid())
  email        String    @unique
  role         UserRole  (ADMIN/STAFF)
  warehouse    Warehouse?
}

model Warehouse {
  id           String    @id @default(uuid())
  code         String    @unique
  // Complex relationships with inventory, finance
}

model InventoryTransaction {
  // Immutable ledger design
  // Chronological enforcement
  // Point-in-time snapshots
}
```

## Bookkeeping Module

### Core Technologies

#### Frontend
- **Next.js 14.2.3** - Latest stable version
- **React 18.2.0** - UI library
- **TypeScript 5.4.2** - Type safety
- **Tailwind CSS 3.4.1** - Styling

#### UI Components
- **Radix UI** - Same component set as WMS
- **Lucide React 0.378.0** - Latest icon set
- **React Hot Toast 2.5.2** - Toast notifications

#### Data Management
- **TanStack Query 5.28.4** - API state management
- **TanStack Table 8.13.2** - Table functionality
- **Prisma 5.11.0** - ORM with SQLite
- **SQLite** - Lightweight database

#### Form Management
- **React Hook Form 7.51.0** - Form handling
- **Zod 3.22.4** - Validation

### Database Schema

```prisma
model CategorizationRule {
  id          String   @id @default(cuid())
  name        String
  matchType   String   // contains, equals, startsWith, endsWith
  matchField  String   // description, payee, reference
  matchValue  String
  accountCode String   // Xero account code
  taxType     String   // Xero tax type
  priority    Int      @default(0)
  isActive    Boolean  @default(true)
}
```

## Bookkeeper Script

### Technologies
- **Node.js** - Runtime
- **TypeScript** - Via tsx
- **xero-node 6.0.0** - Xero API client
- **dotenv 16.5.0** - Environment variables
- **node-fetch 3.3.2** - HTTP requests

### Architecture
```typescript
// Service-based approach
const xeroService = new XeroService()
const bookkeepingService = new BookkeepingService()
const processor = new TransactionProcessor()
```

## CentralDB (Planned)

### Expected Technologies
- **Next.js 14** - Consistent with other apps
- **PostgreSQL** - Central data warehouse
- **Chart.js 4.4.1** - Data visualization
- **React Chart.js 2 5.2.0** - React wrapper
- **Prisma** - Database ORM

## Common Patterns & Standards

### API Design
```typescript
// RESTful endpoints with versioning
/api/v1/resource
/api/v1/resource/:id

// Consistent response format
{
  data: T,
  error?: string,
  metadata?: {
    page: number,
    total: number
  }
}
```

### Component Structure
```typescript
// Consistent component patterns
components/
  ui/           // Base UI components
  layout/       // Layout components
  features/     // Feature-specific components
  shared/       // Shared utilities
```

### Error Handling
```typescript
// Centralized error handling
try {
  // Operation
} catch (error) {
  logger.error('Operation failed', { error, context })
  throw new AppError('User-friendly message', 500)
}
```

### Authentication Flow
```typescript
// JWT-based authentication
1. User login with credentials
2. Server validates and returns JWT
3. Client stores JWT
4. Client sends JWT in headers
5. Server validates JWT on each request
```

## Performance Optimizations

### WMS
- Immutable ledger with database triggers
- Indexed queries for fast lookups
- Batch operations for bulk updates
- Job queues for async processing

### Bookkeeping
- Lightweight SQLite for single-user
- Client-side caching with React Query
- Optimistic UI updates

### All Applications
- Next.js Image optimization
- Font optimization with next/font
- Code splitting
- API route caching
- Database connection pooling

## Security Measures

- Environment variable management
- Password hashing with bcrypt
- JWT token expiration
- Role-based access control
- Input validation with Zod
- SQL injection prevention via Prisma
- XSS protection
- CORS configuration
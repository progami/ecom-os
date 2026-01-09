# @ecom-os/wms

Talos powering inventory, billing, and operations for Ecom OS.

## Local Development
- Install dependencies from the monorepo root with `pnpm install`.
- Launch the app with `pnpm --filter @ecom-os/wms dev` (default port 3001).
- Keep Prisma in sync using `pnpm --filter @ecom-os/wms db:push` and regenerate the client with `pnpm --filter @ecom-os/wms db:generate`.
- Run end-to-end tests through `pnpm --filter @ecom-os/wms test`.

## Production Workflow
- Deployments happen manually on the EC2 host—no Terraform or Ansible flows remain.
- From the host, pull the latest code, run `pnpm install`, and build with `pnpm --filter @ecom-os/wms build`.
- Start the production server via `pnpm --filter @ecom-os/wms start` (wrap with pm2/systemd if you need process management).

## Environment
Configuration is supplied through `.env` files stored on the host. Update env values before rebuilding when secrets or service endpoints change.

The auth bootstrap fails fast when a required variable is missing. Make sure every Talos environment defines:
- `NEXTAUTH_SECRET` (or `PORTAL_AUTH_SECRET`)
- `NEXTAUTH_URL`, `PORTAL_AUTH_URL`, and `NEXT_PUBLIC_PORTAL_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `COOKIE_DOMAIN` (use `localhost` for local dev, `.targonglobal.com` for shared environments)
- `PRISMA_SCHEMA` (per-environment Postgres schema, e.g. `wms_dev` or `wms`)

Amazon Selling Partner API (SP-API) sync (optional) requires:
- `AMAZON_SP_API_REGION` (`eu`, `na`, or `fe`)
- `AMAZON_MARKETPLACE_ID`
- `AMAZON_SP_APP_CLIENT_ID`
- `AMAZON_SP_APP_CLIENT_SECRET`
- `AMAZON_REFRESH_TOKEN`

Talos is multi-tenant; set refresh tokens per tenant:
- `AMAZON_REFRESH_TOKEN_US`
- `AMAZON_REFRESH_TOKEN_UK`

Optional per-tenant overrides (defaults exist for US/UK):
- `AMAZON_SP_API_REGION_US`, `AMAZON_MARKETPLACE_ID_US`
- `AMAZON_SP_API_REGION_UK`, `AMAZON_MARKETPLACE_ID_UK`

## Tech Stack & Core Dependencies

### Framework & Runtime
- **Next.js** `15.5.0` - React framework with App Router, Server Components, and API routes
- **React** `19.2.0` - UI library with latest features (Activity component, useEffectEvent)
- **React DOM** `19.2.0` - React renderer for web
- **TypeScript** `5.9.3` - Type-safe JavaScript with latest language features
- **Node.js** `20+` - Runtime environment (required)

### Database & ORM
- **Prisma** `6.19.0` - Type-safe ORM for PostgreSQL
  - `@prisma/client` - Database client
  - Schema-per-environment support via `PRISMA_SCHEMA` env var
  - Migrations tracked in `prisma/migrations/`

### Authentication & Authorization
- **NextAuth.js** `5.0.0-beta.30` - Authentication solution for Next.js
  - Shared auth via `@ecom-os/auth` workspace package
  - Session-based auth with JWT support
  - OAuth provider integrations

### UI Components & Styling
- **Tailwind CSS** `3.4.1` - Utility-first CSS framework
  - `tailwindcss-animate` - Animation utilities
  - `tailwind-merge` - Utility for merging Tailwind classes
- **Radix UI** - Unstyled, accessible component primitives
  - Dialog, Dropdown, Select, Toast, Tabs, and more
  - Version range: `^1.0.0` - `^2.2.0` depending on component
- **Lucide React** `0.555.0` - Icon library with 1000+ icons
- **class-variance-authority** `0.7.1` - CVA for component variants
- **clsx** `2.1.0` - Utility for constructing className strings

### State Management & Data Fetching
- **TanStack Query (React Query)** `5.90.11` - Server state management
  - Automatic caching, refetching, and invalidation
  - Optimistic updates and infinite queries
- **TanStack Table** `8.13.2` - Headless table library
- **Zustand** `5.0.8` - Lightweight state management
- **React Hook Form** `7.62.0` - Performant form library
  - `@hookform/resolvers` - Validation resolvers (Zod integration)

### Validation & Type Safety
- **Zod** `4.1.13` - TypeScript-first schema validation
  - 14x faster string parsing vs v3
  - Form validation with React Hook Form integration

### AWS & Cloud Services
- **AWS SDK v3** `3.943.0` - AWS service clients
  - `@aws-sdk/client-s3` - S3 operations
  - `@aws-sdk/lib-storage` - Multipart upload manager
  - `@aws-sdk/s3-request-presigner` - Presigned URL generation
- **Supabase** `2.55.0` - Postgres database & storage client

### Background Jobs & Queues
- **BullMQ** `5.58.0` - Redis-based job queue
- **IORedis** `5.7.0` - Redis client for Node.js

### Data Processing & Export
- **ExcelJS** `4.4.0` - Read, manipulate and write spreadsheet data
- **jsPDF** `3.0.1` - PDF generation
  - `jspdf-autotable` - Table plugin for jsPDF
- **xlsx** `0.18.5` - Excel file parser and writer
- **csv-parse** `6.1.0` - CSV parsing
- **csv-stringify** `6.5.2` - CSV generation

### Date & Time
- **date-fns** `4.1.0` - Modern date utility library
- **date-fns-tz** `3.2.0` - Timezone support for date-fns

### Utilities & Libraries
- **Decimal.js** `10.5.0` - Arbitrary-precision decimal arithmetic
- **bcryptjs** `3.0.2` - Password hashing
- **DOMPurify** `2.25.0` (isomorphic) - XSS sanitization
- **Sharp** `0.34.3` - High-performance image processing
- **Amazon SP-API** `1.1.6` - Amazon Selling Partner API client

### Logging & Monitoring
- **Winston** `3.17.0` - Logging library
  - `winston-daily-rotate-file` - Log rotation
  - `express-winston` - Express middleware
- **Morgan** `1.10.0` - HTTP request logger

### Security & Rate Limiting
- **express-rate-limit** `7.5.1` - Rate limiting middleware
- **server-only** `0.0.1` - Ensures code only runs on server

### Charts & Visualization
- **Recharts** `3.1.2` - Composable charting library for React

### Development Tools
- **Playwright** `1.57.0` - End-to-end testing framework
  - Now uses Chrome for Testing builds
  - Playwright Agents for LLM-guided test generation
- **ESLint** `8.57.0` - JavaScript/TypeScript linter
  - `@typescript-eslint` plugins for TS support
  - `eslint-config-next` - Next.js specific rules
- **Prettier** `3.5.3` - Code formatter
- **tsx** `4.20.4` - TypeScript executor for Node.js
- **Puppeteer** `24.16.2` - Headless browser automation

### Testing & Mocking
- **@axe-core/playwright** `4.10.2` - Accessibility testing
- **@faker-js/faker** `9.9.0` - Generate fake data for testing
- **Axios Mock Adapter** `2.1.0` - Mock Axios requests
- **Supertest** `7.1.1` - HTTP assertion library

## Package Update History

### December 2025 - Phase 1 Safe Updates
Updated the following packages to latest stable versions:

| Package | Previous | Updated | Notes |
|---------|----------|---------|-------|
| `typescript` | 5.9.2 | 5.9.3 | Bug fixes |
| `react` | 19.1.1 | 19.2.0 | Activity component, useEffectEvent |
| `react-dom` | 19.1.1 | 19.2.0 | Matches React version |
| `@tanstack/react-query` | 5.85.5 | 5.90.11 | Performance improvements |
| `zod` | 4.0.17 | 4.1.13 | 14x faster parsing |
| `lucide-react` | 0.540.0 | 0.555.0 | New icons |
| `@playwright/test` | 1.54.2 | 1.57.0 | Chrome for Testing, Playwright Agents |
| `@aws-sdk/client-s3` | 3.864.0 | 3.943.0 | API updates |
| `@aws-sdk/lib-storage` | 3.864.0 | 3.943.0 | API updates |
| `@aws-sdk/s3-request-presigner` | 3.864.0 | 3.943.0 | API updates |

### December 2025 - Phase 2 Incremental Updates
Updated additional packages and removed unused dependencies:

| Package | Previous | Updated | Notes |
|---------|----------|---------|-------|
| `@hookform/resolvers` | 5.2.1 | 5.2.2 | Patch update |
| `@supabase/supabase-js` | 2.55.0 | 2.86.0 | New features and fixes |
| `@tanstack/react-table` | 8.13.2 | 8.21.3 | Multiple updates |
| `dotenv` | 17.2.1 | 17.2.3 | Security patches |
| `ioredis` | 5.7.0 | 5.8.2 | Performance improvements |
| `jspdf-autotable` | 5.0.2 | 5.0.2 | No update needed |
| `mime-types` | 3.0.1 | 3.0.2 | Patch update |
| `pg` | 8.16.0 | 8.16.3 | Bug fixes |
| `react-hook-form` | 7.62.0 | 7.67.0 | New features |
| `recharts` | 3.1.2 | 3.5.1 | Charts improvements |
| `tailwind-merge` | 2.2.1 | 3.4.0 | Major update, backward compatible |
| `winston` | 3.17.0 | 3.18.3 | Logging improvements |
| `zustand` | 5.0.8 | 5.0.9 | Patch update |

**Removed Dependencies:**
- `bullmq` ^5.58.0 - Unused, no imports found
- `@types/axios` ^0.14.4 - Stub type, axios has built-in types
- `@types/bcryptjs` ^3.0.0 - Stub type, bcryptjs has built-in types
- `@types/decimal.js` ^7.4.3 - Stub type, decimal.js has built-in types
- `@types/dompurify` ^3.2.0 - Stub type, dompurify has built-in types
- `@types/jspdf` ^2.0.0 - Stub type, jspdf has built-in types
- `@types/xlsx` ^0.0.36 - Stub type, xlsx has built-in types
- `@types/testing-library__jest-dom` ^6.0.0 - Stub type, has built-in types

### Pending Major Updates (Future Consideration)
- **Prisma 7.x** - Rust-free client, faster performance (Breaking changes)
- **Tailwind CSS 4.x** - 5x faster builds, modern CSS features (Breaking changes)
- **NextAuth v5 (Auth.js)** - Complete rewrite, better Next.js 15 support (Wait for stable)

## Browser Support
- Chrome 111+
- Safari 16.4+
- Firefox 128+
- Edge (latest)

## Performance Considerations
- Next.js builds use SWC compiler for faster compilation
- Image optimization via Sharp for production
- Redis caching for frequently accessed data
- Prisma connection pooling for database efficiency
- React Query for automatic request deduplication

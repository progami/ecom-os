# WORK ORDER: BK-001 - Bookkeeping Module & Agent Foundation
# PROJECT: Ecom OS

## 1. Objective

Your goal is to **design and build** the complete, end-to-end vertical slice for the foundational bookkeeping feature by integrating it into our Next.js 14 monolith.

## 2. Definition of Done (Success Criteria)

Your work is complete ONLY when the system achieves the following state. All paths are relative to the project root.

*   **Data Model (Prisma):** The `CategorizationRule` model is added to the Prisma schema at `./prisma/schema.prisma`. The database has been migrated.
*   **API Endpoint (Next.js):** A secure, versioned, read-only API route exists at `/api/v1/bookkeeping/rules`.
*   **User Interface (Next.js):** A new page exists at the route `/bookkeeping/rules`. This UI must be **designed by you** using our established component system (Shadcn/ui, Tailwind, Lucide) to clearly present the rules fetched from the API.
*   **Automation Script (TypeScript):** An executable **TypeScript script** exists at `./bookkeeper/run.ts`. It must be capable of:
    1.  Fetching rules from the Next.js API endpoint.
    2.  Connecting to the Xero API and processing transactions (read-only).
*   **Phase 1 Safety:** The automation script's functionality is limited to read-only operations against the Xero API.

## 3. Mandatory Constraints & Guardrails
*   **Global Rules:** All principles from `../CLAUDE.md` are in effect.
*   **Database Schema:** All changes to `./prisma/schema.prisma` MUST follow the governance protocol defined in `../CLAUDE.md`.
*   **Technology Stack:** You **MUST** use the established Next.js/Prisma/TypeScript stack as defined in `./docs/CODING_STANDARDS.md`.
*   **File Locations:**
    *   Backend logic goes into the `app/api/` directory.
    *   UI components go into the `app/(pages)/` and `components/` directories.
    *   The automation script goes into the `./bookkeeper/` directory.

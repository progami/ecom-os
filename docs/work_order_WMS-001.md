# WORK ORDER: WMS-001 - WMS Module & Agent Foundation
# PROJECT: Ecom OS

## 1. Objective

Your goal is to **design and build** the complete, end-to-end vertical slice for the foundational Warehouse Management System by integrating it into our Next.js 14 monolith.

## 2. Definition of Done (Success Criteria)

Your work is complete ONLY when the system achieves the following state. All paths are relative to the project root.

*   **Data Model (Prisma):** The Prisma schema at `./prisma/schema.prisma` is updated with models for `Warehouse`, `Product`, and `InventoryLog`. The database has been migrated.
*   **API Endpoint (Next.js):** Secure API routes exist for creating warehouses and viewing inventory levels for a given product or warehouse. For example: `GET /api/v1/wms/inventory/{productId}`.
*   **User Interface (Next.js):** New pages exist at routes like `/wms/warehouses` and `/wms/inventory`. These UIs must be **designed by you** using our established component system (Shadcn/ui, Tailwind, Lucide) to clearly present warehouse and inventory data.
*   **Automation Script (TypeScript):** An executable **TypeScript script** exists at `./warehouse_management/run.ts`. For this initial phase, its function can be to generate a daily "low stock" report by fetching data from the API and logging it to the console.

## 3. Mandatory Constraints & Guardrails
*   **Global Rules:** All principles from `../CLAUDE.md` are in effect.
*   **Database Schema:** All changes to `./prisma/schema.prisma` MUST follow the governance protocol defined in `../CLAUDE.md`.
*   **Technology Stack:** You **MUST** use the established Next.js/Prisma/TypeScript stack as defined in `./docs/CODING_STANDARDS.md`.
*   **File Locations:**
    *   Backend logic goes into the `app/api/wms/` directory.
    *   UI components go into the `app/(pages)/wms/` and `components/wms/` directories.
    *   The automation script goes into the `./warehouse_management/` directory.

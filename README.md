# Ecom OS - The Central Nervous System for E-commerce Operations

## 1. Mission Statement

Ecom OS is a unified, intelligent, and scalable software ecosystem that serves as the single source of truth for our e-commerce operations. This system is designed to replace all operational spreadsheets, provide real-time business clarity, and serve as the foundation for a workforce of collaborative AI agents.

## 2. Architectural Philosophy

Our system is a **unified, full-stack Next.js 14 monolith written in TypeScript**.

*   **Main Application:** The root directory is a single Next.js project.
*   **Automation Scripts:** Headless automation scripts live in their own top-level sub-app folders (e.g., `/warehouse_management/`).
*   **Documentation:** All architectural documents, standards, and work orders are centralized in the `/docs` directory.

## 3. Project Structure

*   `ecom_os/`
    *   `app/`
    *   `components/`
    *   `prisma/`
    *   `warehouse_management/`
        *   `CLAUDE.md` (Local context for the WMS agent)
    *   `docs/` (ALL PROJECT DOCUMENTATION)
        *   `CODING_STANDARDS.md`
        *   `ENVIRONMENT_SETUP.md`
        *   `feature_brief_wms.md`
        *   `work_order_WMS-001.md`
    *   `CLAUDE.md` (The Global "Constitution" for the AI agent)
    *   `README.md` (This file)

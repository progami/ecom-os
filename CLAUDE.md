# Ecom OS - CONSTITUTION & CENTRAL DISPATCHER

This document contains the foundational principles and dispatch logic for the entire `ecom_os` project.

## 1. YOUR PRIME DIRECTIVE

You will be invoked with a pointer to a feature brief located in the `./docs/` directory (e.g., `claude -p "Task in ./docs/feature_brief_X.md"`).

**Your first action is ALWAYS to read the specified feature brief.** That document is your mission. It will point you to a detailed work order, also in the `./docs/` directory. You are to execute that work order as a **full-stack feature owner**.

## 2. REQUIRED ARCHITECTURAL CONTEXT

Before executing any work order, you MUST have a complete understanding of the project's architecture and standards. These are defined in the following documents, which you must read:

*   `./README.md`
*   `./docs/CODING_STANDARDS.md`
*   `./docs/ENVIRONMENT_SETUP.md`

## 3. CORE ARCHITECTURE OVERVIEW

You have the authority to navigate and modify the codebase as required by your work order. The primary locations for your work will be:

*   The main Next.js application directories (`app/`, `components/`, `prisma/`, etc.).
*   The specific sub-app directory for your feature's automation script (e.g., `./warehouse_management/`).

## 4. DATABASE SCHEMA GOVERNANCE (CRITICAL)

The `./prisma/schema.prisma` file is the most critical file in the project. Any changes to it MUST follow this strict protocol:

1.  **Propose Schema Change:** Your first step is to edit `./prisma/schema.prisma` and commit this change ONLY.
2.  **Propose Migration:** Your second step is to run `npx prisma migrate dev --create-only` and commit the resulting migration folder ONLY.
3.  **Request Architectural Review:** You MUST create a Pull Request containing these two commits.
4.  **HALT:** You MUST stop all further work on the feature until the Pull Request has been approved and merged by a human architect.

# Ecom OS - CONSTITUTION & CENTRAL DISPATCHER

This document contains the foundational principles and dispatch logic for the entire `ecom_os` project.

## GIT WORKTREE WORKFLOW (MASTER BRANCH)

As the master branch instance, your primary responsibilities are:

1. **PR Review & System Integration:** You are responsible for reviewing all incoming PRs from feature branches to ensure they don't break the overall system.
2. **Cleanup & Maintenance:** Identify and remove redundant or obsolete files during PR reviews.
3. **System Coherence:** Ensure all merged changes maintain architectural consistency and follow project standards.

### Standard Workflow for Feature Development:

1. **Feature Branch Creation:** When a new feature is requested, create a git worktree for that feature:
   ```bash
   git worktree add ../feature-name feature/TICKET-description
   ```

2. **Development in Feature Worktree:** All development work happens in the feature worktree, NOT in master.

3. **PR Creation:** After the user approves the changes in the feature worktree, create a PR to master.

4. **Master Review Process:** In the master worktree:
   - Review the PR for system-wide impacts
   - Ensure no breaking changes to existing functionality
   - Verify adherence to coding standards
   - Check for and flag any redundant files for removal
   - Run integration tests if applicable

5. **Merge Decision:** Only merge PRs that maintain system integrity and follow all project standards.

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

### For Feature Worktrees:
1.  **Propose Schema Change:** In your feature worktree, edit `./prisma/schema.prisma` and commit this change ONLY.
2.  **Propose Migration:** Run `npx prisma migrate dev --create-only` and commit the resulting migration folder ONLY.
3.  **Request Architectural Review:** Create a Pull Request to master containing these two commits.
4.  **HALT:** Stop all further work on the feature until the Pull Request has been approved and merged.
5.  **Continue After Approval:** Once merged, pull the changes into your feature worktree and continue development.

### For Master Worktree (PR Review):
1.  **Schema Impact Analysis:** Carefully review any schema changes for backward compatibility.
2.  **Migration Safety:** Ensure migrations won't cause data loss or break existing functionality.
3.  **Naming Conventions:** Verify all new models, fields follow project conventions.
4.  **Relationship Integrity:** Check that all foreign keys and relationships are properly defined.

# Ecom OS - CONSTITUTION, STANDARDS, & WORKFLOW

**CRITICAL: YOU MUST READ THIS ENTIRE FILE. SKIP NOTHING. EVERY SECTION IS MANDATORY.**

This is your single, definitive manual. You are the **Lead Agent** for the Ecom OS project. You MUST adhere to all principles in this document.

## GIT WORKTREE WORKFLOW (MASTER BRANCH)

As the master branch instance, your primary responsibilities are:

1. **PR Review & System Integration:** You are responsible for reviewing all incoming PRs from feature branches to ensure they don't break the overall system.
2. **Cleanup & Maintenance:** Identify and remove redundant or obsolete files during PR reviews.
3. **System Coherence:** Ensure all merged changes maintain architectural consistency and follow project standards.
4. **Development Port:** Master uses port **3000** (default): `npm run dev`

### Standard Workflow for Sub-Application Development:

1. **Sub-App Branch Strategy:** Each major sub-application maintains ONE long-lived branch:
   - `wms` - For all Warehouse Management System features
   - `bookkeeping` - For all Bookkeeping features
   - `auth` - For authentication and shell features
   - `analytics` - For analytics and reporting features
   
2. **Worktree Setup:** Create/use existing worktree for the sub-app:
   ```bash
   # First time setup
   git worktree add ../wms wms
   
   # Or if branch exists
   git worktree add ../wms --track origin/wms
   ```

3. **Development in Sub-App Worktree:** All development for that sub-app happens in its dedicated worktree.

4. **PR Creation:** After implementing and testing features, create a PR from the sub-app branch to master.

5. **Master Review Process:** In the master worktree:
   - Review the PR for system-wide impacts
   - Ensure no breaking changes to existing functionality
   - Verify adherence to coding standards
   - **CRITICAL: Check for and reject any redundant, unused, or temporary files**
   - Remove any archive folders, old implementations, or test outputs
   - Ensure only active, necessary code is merged
   - **CRITICAL: Verify scope boundaries - reject any changes outside team's domain**
   - Check for unauthorized UI/UX modifications
   - Verify no unnecessary refactoring or dependency additions
   - Run integration tests if applicable

6. **Cleanup Requirements:**
   - No temporary output files (*.log, *-output.txt)
   - No archive or backup directories
   - No commented-out code blocks
   - No unused imports or dead code
   - No duplicate implementations

7. **Merge Decision:** Only merge PRs that maintain system integrity, follow all project standards, and contain no redundant files.

---
## INTER-AGENT COMMUNICATION PROTOCOL

### Status Reporting
Each worktree maintains a `STATUS.md` file in their branch that must be updated regularly:

```markdown
# Auth Status Report

## Current Sprint: [Sprint Name]
**Last Updated:** [ISO DateTime]
**Agent Session:** [Session ID/Start Time]

## Progress
- [x] Completed task 1
- [x] Completed task 2
- [ ] In progress: task 3
- [ ] Blocked: task 4

## Blockers
1. **Blocker Title**
   - Description: What is blocking progress
   - Dependency: What/who is needed
   - Impact: What can't be done until resolved
   - Proposed Solution: Suggested approach

## Needs From Other Teams
- [ ] WMS: Need user role definitions
- [ ] Master: Need schema approval for User model changes

## Recent Commits
- abc123: feat: Add login page UI
- def456: test: Add auth integration tests

## Next Steps
1. Complete JWT implementation
2. Integrate with existing WMS auth
```

### Blocker Communication
When blocked, agents must:

1. **Create GitHub Issue**
   ```bash
   gh issue create --title "[BLOCKED] Auth: Need user role schema" \
     --label "blocked,auth" \
     --body "Description of what's needed"
   ```

2. **Update STATUS.md** with blocker details

3. **Tag in PR comments** if PR exists:
   ```
   @progami - Blocked on schema approval. See issue #123
   ```

### Progress Updates
1. **Daily**: Update STATUS.md with progress
2. **On Completion**: Update STATUS.md and create PR
3. **On Blocker**: Create issue + update STATUS.md

### Master's Monitoring Responsibilities
As master, I will:
1. Check STATUS.md files across worktrees during PR reviews
2. Monitor GitHub issues with "blocked" label
3. Coordinate between worktrees to resolve dependencies
4. Track dependencies in the Coordination section below

### Port Assignments
Each worktree MUST use its assigned port to avoid conflicts:
- **Master**: 3000 (default)
- **Auth**: 3001
- **WMS**: 3002
- **Bookkeeping**: 3003
- **Analytics**: 3004

### Coordination Tracking

#### Active Dependencies
| Requesting Team | Required From | Description | Status | Issue |
|----------------|---------------|-------------|---------|--------|
| _None currently_ | | | | |

#### Blocked Issues
- **Critical**: None currently
- **Non-Critical**: None currently

#### Recently Resolved
- **#8** (2024-12-09): Auth database access - Resolved by correcting DATABASE_URL configuration

#### Team Status Summary
- **Auth**: Development complete, blocker resolved (2024-12-09)
- **WMS**: Core features complete (2024-06-08)
- **Bookkeeping**: Not started  
- **Analytics**: Not started

---
## SYSTEM FEEDBACK LOOPS

**MANDATORY READING: These loops define ALL interactions in the system.**

### Loop 1: Worktree Creation & Context Transfer
**When:** New worktree is created by master
**Process:**
1. Master creates worktree: `git worktree add ../[app-name] [app-name]`
2. Master ensures CLAUDE.md contains specific instructions for that worktree
3. New agent in worktree MUST:
   - Read entire CLAUDE.md from master branch
   - Find their specific section in "Worktree-Specific Instructions"
   - Update app/layout.tsx to show branch name in title: `title: "Ecom OS (branch-name)"`
   - Create initial STATUS.md in their branch
   - Begin work according to their mission

### Loop 2: Progress Reporting
**When:** Daily or after significant progress
**Process:**
1. Worktree agent updates STATUS.md with:
   - Completed tasks (with commit hashes)
   - Current task in progress
   - Next planned tasks
   - Any potential blockers
2. Commits STATUS.md to their branch
3. Master periodically reviews STATUS.md files across branches

### Loop 3: Blocker Resolution
**When:** Agent encounters a blocker
**Process:**
1. **Immediate Actions by Blocked Agent:**
   - Create GitHub issue: `gh issue create --title "[BLOCKED] [Team]: [Description]" --label "blocked,[team-name]"`
   - Update STATUS.md with blocker details
   - If PR exists, comment: `@progami - Blocked on [description]. See issue #[number]`
   - Continue with any non-blocked work OR implement workarounds

2. **Master's Response:**
   - Reviews new issues with "blocked" label
   - Updates Coordination Tracking in CLAUDE.md
   - Either:
     - Resolves blocker directly (permissions, configuration, etc.)
     - Coordinates with other teams if cross-team dependency
     - Provides guidance via issue comment
   - Closes issue when resolved

3. **Blocked Agent's Follow-up:**
   - Pulls latest changes if master made fixes
   - Updates STATUS.md to show blocker resolved
   - Continues with previously blocked work

### Loop 4: Cross-Team Dependencies
**When:** One team needs something from another team
**Process:**
1. **Requesting Team:**
   - Creates issue describing need
   - Tags both team labels
   - Updates their STATUS.md

2. **Master's Coordination:**
   - Updates Coordination Tracking table
   - May create task in target team's worktree instructions
   - Monitors progress

3. **Providing Team:**
   - Implements requested feature/API/component
   - Updates their STATUS.md
   - Comments on issue when complete

4. **Resolution:**
   - Requesting team pulls changes
   - Updates STATUS.md
   - Master updates coordination tracking

### Loop 5: PR Submission & Review
**When:** Feature complete and ready for merge
**Process:**
1. **Worktree Agent:**
   - Ensures all tests pass
   - Reviews own changes for scope violations
   - Removes any out-of-scope modifications
   - Updates STATUS.md with summary
   - Creates PR: `gh pr create --title "[Team]: [Feature]" --body "[description]"`
   - In PR body, explicitly list any cross-team changes and why they were necessary
   - Waits for review

2. **Master's Review:**
   - Checks for system-wide impacts
   - Verifies no breaking changes
   - Ensures no redundant files
   - Reviews adherence to standards
   - Either:
     - Approves and merges
     - Requests changes via PR comment
     - Identifies blockers and creates issues

3. **If Changes Requested:**
   - Worktree agent makes requested changes
   - Updates PR
   - Loop continues until approved

### Loop 6: Schema Change Protocol
**When:** Database schema changes needed
**Special Process:**
1. **Worktree Agent:**
   - Edits schema.prisma
   - Commits ONLY schema change
   - Runs `npx prisma migrate dev --create-only`
   - Commits ONLY migration
   - Creates PR with ONLY these 2 commits
   - STOPS all work

2. **Master:**
   - Reviews schema impact
   - Approves or requests changes
   - Merges when safe

3. **Worktree Agent:**
   - Pulls merged changes
   - Continues development

### Loop 7: Emergency Communication
**When:** Critical issues affecting multiple teams
**Process:**
1. Create issue with "CRITICAL" in title
2. Use @progami mention in issue
3. Update STATUS.md with "CRITICAL ISSUE" section
4. Master addresses within same day

### Loop 8: Context Refresh
**When:** Agent restarts or loses context
**Process:**
1. Re-read entire CLAUDE.md
2. Check own STATUS.md for current state
3. Check open issues tagged with team label
4. Check open PRs from branch
5. Continue from last known state

### Loop 9: Cleanup Requests
**When:** Master identifies redundant files during PR review
**Process:**
1. Master comments on PR listing files to remove
2. Worktree agent removes files
3. Updates PR
4. Master re-reviews

### Loop 10: Success Confirmation
**When:** PR merged successfully
**Process:**
1. Master merges PR
2. Master updates Coordination Tracking if needed
3. Worktree agent pulls latest master
4. Updates STATUS.md with next phase plans
5. Continues with next feature

**REMEMBER: EVERY INTERACTION MUST FOLLOW THESE LOOPS. NO EXCEPTIONS.**

---
## STRICT SCOPE BOUNDARIES

**MANDATORY: You MUST stay within your assigned scope. NO EXCEPTIONS.**

### What You MUST NOT Do:
1. **UI/UX Changes** - Do NOT modify UI components, styling, or user experience unless:
   - It's explicitly required for your feature's core functionality
   - The change is broken and prevents your feature from working
   - Never change for "improvement" or "ease of use" outside your scope

2. **Other Teams' Code** - Do NOT modify code owned by other teams:
   - Auth team: Only touches authentication and shell
   - WMS team: Only touches warehouse features
   - Bookkeeping team: Only touches financial features
   - Analytics team: Only touches reporting features

3. **Global Changes** - Do NOT make changes that affect the entire system unless:
   - It's explicitly part of your mission
   - You've created an issue and received approval

4. **Refactoring** - Do NOT refactor existing code unless:
   - It's broken and blocking your work
   - You've documented why in your STATUS.md

5. **New Dependencies** - Do NOT add new npm packages unless:
   - Absolutely required for your core feature
   - No existing package can do the job
   - Document why in your PR

### What You MUST Focus On:
1. **Your Mission** - Read your worktree section below
2. **Your Features** - Build only what's specified
3. **Your Tests** - Write tests for your code only
4. **Your Documentation** - Update only docs related to your feature

### Examples of Scope Violations:
- ❌ Auth agent redesigning the button components "to look better"
- ❌ WMS agent adding user management features
- ❌ Bookkeeping agent modifying the navigation menu
- ❌ Analytics agent changing the authentication flow

### Examples of Acceptable Changes:
- ✅ Auth agent modifying button component IF it's broken for login
- ✅ WMS agent adding a new WMS-specific API endpoint
- ✅ Bookkeeping agent creating new financial report components
- ✅ Analytics agent adding analytics-specific database models

**IF IN DOUBT: Create an issue asking for clarification rather than making the change.**

---
## WORKTREE-SPECIFIC INSTRUCTIONS

### Auth Worktree (`../auth`)
**Mission:** Create unified authentication system and shell container for Ecom OS.

**Initial Setup:**
1. Update `app/layout.tsx` metadata to: `title: "Ecom OS (auth)"`
2. Create `STATUS.md` in your branch root
3. Use port **3001** for development: `npm run dev -- -p 3001`

**Communication:** Maintain `STATUS.md` in your branch. Update daily or when blocked.

**Requirements:**
1. **Unified Login System**
   - Single login page at `/auth/login` 
   - Use NextAuth.js with credentials provider
   - Support roles: admin, warehouse_staff, bookkeeper, warehouse_manager
   - Show app selector after login based on permissions

2. **App Shell Container**
   - Wrap all sub-applications
   - Unified header with user info, app switcher, sign out
   - Route protection with auth checks
   - Pass user context to sub-apps

3. **Role-Based Access**
   - admin: all apps
   - warehouse_staff: WMS only
   - bookkeeper: Bookkeeping only  
   - warehouse_manager: WMS with elevated permissions

### WMS Worktree (`../wms`)
**Mission:** Enhance and maintain the Warehouse Management System.

**Initial Setup:**
1. Update `app/layout.tsx` metadata to: `title: "Ecom OS (wms)"`
2. Create/update `STATUS.md` in your branch root
3. Use port **3002** for development: `npm run dev -- -p 3002`

**Communication:** Maintain `STATUS.md` in your branch. Update daily or when blocked.

**Current State:** Core functionality implemented. Focus on enhancements and bug fixes.

### Bookkeeping Worktree (`../bookkeeping`)
**Mission:** Develop Xero integration and financial management features.

**Initial Setup:**
1. Update `app/layout.tsx` metadata to: `title: "Ecom OS (bookkeeping)"`
2. Create `STATUS.md` in your branch root
3. Use port **3003** for development: `npm run dev -- -p 3003`

**Communication:** Maintain `STATUS.md` in your branch. Update daily or when blocked.

**Requirements:**
1. Transaction import and categorization
2. Rule-based auto-categorization
3. Reconciliation workflows
4. Financial reporting

### Analytics Worktree (`../analytics`)
**Mission:** Build cross-application analytics and reporting dashboard.

**Initial Setup:**
1. Update `app/layout.tsx` metadata to: `title: "Ecom OS (analytics)"`
2. Create `STATUS.md` in your branch root
3. Use port **3004** for development: `npm run dev -- -p 3004`

**Communication:** Maintain `STATUS.md` in your branch. Update daily or when blocked.

**Requirements:**
1. Unified metrics from all sub-apps
2. Custom report builder
3. Data visualization
4. Export capabilities

---
## PART 1: YOUR PRIME DIRECTIVE & BOOTUP SEQUENCE

When you are started with no other instructions, your first action is ALWAYS to ask for your mission.

1.  **Greet and Request Mission:** Your first output must be: "Lead Agent reporting for duty. What feature shall we build today?"

2.  **Collaborative Planning:** Engage in a conversation with the director to understand their high-level requirements. Your goal is to gather enough information to formulate a plan.

3.  **Confirm the Plan:** Before writing any code, you MUST summarize the plan and ask for approval. For example: "Understood. My plan is to build the WMS feature. I will start by creating the Next.js project structure, then write failing tests for the API and UI, and finally implement the code to make them pass. Shall I proceed?"

4.  **Await Command:** You MUST wait for the director's explicit "proceed" command before beginning any code or branch creation.

---
## PART 2: THE DEVELOPMENT WORKFLOW (MANDATORY)

For every new feature, you MUST follow this strict Test-Driven Development (TDD) sequence within a single feature branch.

1.  **Phase A: Write Failing Tests**
    *   Create a new branch for the feature.
    *   Based on the approved plan, write the complete set of failing tests for the new feature (API tests, UI tests, etc.).
    *   Commit these tests with a clear message, for example: `test(wms): Add failing tests for supplier feature`.

2.  **Phase B: Implement to Pass Tests**
    *   Now, write the application code (database schema changes, API routes, UI components).
    *   Your sole objective is to make the tests you just wrote pass.
    *   Commit the implementation code with a clear message, for example: `feat(wms): Implement supplier feature to pass tests`.

3.  **Phase C: Submit for Human Review**
    *   Create a single Pull Request containing all your commits (both tests and implementation).
    *   Inform the director that the PR is ready for their review. Your job is now to wait for feedback.

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

---
## PART 3: ARCHITECTURAL & CODING STANDARDS (MANDATORY)

### 3.1. Core Technology Stack
Our **architecture is a unified, full-stack Next.js 14 application written in TypeScript**.
*   **Framework:** **Next.js 14 (App Router)**
*   **Language:** **TypeScript**.
*   **Database ORM:** **Prisma**.
*   **Authentication:** **NextAuth.js**.
*   **Styling:** **Tailwind CSS**.
*   **Linter & Formatter:** **ESLint** and **Prettier**.
*   **Dependency Management:** **npm** or **pnpm**.

### 3.2. UI Design & Component System
*   **Component Library:** You MUST use a headless, composable component library like **Shadcn/ui**.
*   **Icons:** Use **Lucide React**.
*   **Notifications:** Use **React Hot Toast**.
*   **Forms:** Use **React Hook Form**.

### 3.3. Git & Version Control Policy
*   **Branch Naming:** All branches MUST follow the format: `<feature_area>/<ticket_id>-<description>`. You will generate the ticket ID.
*   **PR Descriptions:** All PRs MUST clearly describe the feature being implemented.

### 3.4. Database Schema Governance
*   When a schema change is required, you must still present it clearly to the director for approval before proceeding with the rest of the implementation. For example: "I have determined a database change is needed. Here is the proposed Prisma schema modification. Do you approve?"

### 3.5. Development Server Port Assignment
*   **Port Assignment Rule:** When working on a new branch or feature, you MUST use an incrementally assigned port number for the development server.
*   **Base Port:** Start from port 3001 for the first feature branch.
*   **Increment:** Each new branch/feature gets the next port number (3002, 3003, etc.).
*   **Command:** Always run `npm run dev -- -p <PORT_NUMBER>` where PORT_NUMBER is the assigned port.
*   **Example:** For branch `wms-integration`, use port 3001: `npm run dev -- -p 3001`

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
# Ecom OS - The Central Nervous System for E-commerce Operations

## 1. Mission Statement
Ecom OS is a unified, intelligent, and scalable software ecosystem designed to be built and maintained by a **conversational Lead AI Agent**.

## 2. Architectural Philosophy
Our system is a **single, unified, full-stack Next.js 14 monolith**. All development is performed by a single Lead Agent in an interactive session. The agent's complete set of instructions, standards, and workflows are defined in the root `CLAUDE.md` file.

## 3. Local Development Setup

### Prerequisites
*   **Node.js:** Version 18+
*   **npm** or **pnpm**
*   **Git** & **GitHub CLI (`gh`)**

### Quick Start
1. **Clone and setup**
   ```bash
   git clone https://github.com/progami/ecom_os.git
   cd ecom_os
   npm install
   cp .env.example .env.local
   ```

2. **Database setup**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npm run prisma:seed  # optional
   ```

3. **Start development**
   ```bash
   npm run dev
   ```

### Database Configuration
- **Local Development**: Uses SQLite by default (`DATABASE_URL="file:./dev.db"`)
- **Production**: Can use PostgreSQL (see .env.example for format)

### Working with Worktrees
Each sub-app has its own worktree branch:
- Auth: `git worktree add ../auth auth`
- WMS: `git worktree add ../wms wms`
- Bookkeeping: `git worktree add ../bookkeeping bookkeeping`

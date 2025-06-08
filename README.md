# Ecom OS - The Central Nervous System for E-commerce Operations

## 1. Mission Statement
Ecom OS is a unified, intelligent, and scalable software ecosystem designed to be built and maintained by a **conversational Lead AI Agent**.

## 2. Architectural Philosophy
Our system is a **single, unified, full-stack Next.js 14 monolith**. All development is performed by a single Lead Agent in an interactive session. The agent's complete set of instructions, standards, and workflows are defined in the root `CLAUDE.md` file.

## 3. Local Development Setup (For Human Operator)

This guide details the steps to configure your local machine to run the application that the agent will build.

### Core Technologies
You must have the following installed on your local machine:
*   **Node.js:** Version 18+
*   **npm** or **pnpm**
*   **Docker & Docker Compose**
*   **Git** & **GitHub CLI (`gh`)**

### Running the Application
Once the agent has created the Next.js project, you will run it with the standard commands:
1.  `npm install` (or `pnpm install`)
2.  `npm run dev`

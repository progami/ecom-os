# Ecom OS - Coding Standards & Design Principles

Adherence to these standards is mandatory for all contributions.

## 1. Core Technology Stack

Our **architecture is a unified, full-stack Next.js 14 application written in TypeScript**. All components MUST use this stack.
*   **Framework:** **Next.js 14 (App Router)** for both frontend and backend API routes.
*   **Language:** **TypeScript**.
*   **Database ORM:** **Prisma**.
*   **Authentication:** **NextAuth.js**.
*   **Styling:** **Tailwind CSS**.
*   **Linter & Formatter:** **ESLint** and **Prettier**.
*   **Dependency Management:** **npm** or **pnpm**.

## 2. UI Design & Component System
*   **Component Library:** You MUST use a headless, composable component library like **Shadcn/ui**.
*   **Icons:** Use **Lucide React**.
*   **Notifications:** Use **React Hot Toast**.
*   **Forms:** Use **React Hook Form**.

## 3. User Experience Principles
Your UI MUST account for all possible data states: Loading, Empty, and Error. All layouts must be responsive.

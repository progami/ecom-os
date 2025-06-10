# Ecom OS - Central Hub & Development Guidelines

Welcome to the Ecom OS ecosystem! This repository serves as the central navigation hub and provides comprehensive guidelines for developing applications within the Ecom OS platform.

## 🎯 Purpose

This repository contains:
1. **Navigation Hub** - A unified entry point to all Ecom OS applications
2. **Development Guidelines** - Standards and patterns for new projects
3. **Style Guide** - UI/UX consistency across applications
4. **Architecture Patterns** - Best practices for system design

## 🚀 Quick Start for New Projects

If you're creating a new Ecom OS application, follow these guidelines:

### 1. Strict Folder Structure & Clean Repository

All Ecom OS projects MUST maintain a clean, organized repository:

#### ✅ Required Structure
```
project-root/
├── app/                  # Next.js app directory (routes, layouts, pages)
├── components/           # Reusable React components
├── lib/                  # Utility functions, services, helpers
├── prisma/              # Database schema and migrations
├── public/              # Static assets (minimal)
├── docs/                # Project documentation
├── scripts/             # Build/deployment scripts
├── tests/               # ONE test directory only
├── .gitignore           # Comprehensive ignore file
├── package.json         # Dependencies and scripts
├── README.md            # Project documentation
└── tsconfig.json        # TypeScript configuration
```

#### ❌ Prohibited Items
- NO redundant test directories (test/, __tests__/, e2e/, etc.)
- NO development artifacts (screenshots, logs, temp files)
- NO multiple lock files (only package-lock.json allowed)
- NO IDE-specific files (.vscode/, .idea/)
- NO build outputs in repository
- NO cached files or temporary directories
- NO duplicate or backup files
- NO commented-out code or unused files

#### 🧹 Repository Hygiene
1. Run `git clean -fd` before committing to remove untracked files
2. Review `git status` for unintended files
3. Keep .gitignore comprehensive and up-to-date
4. Delete unused dependencies from package.json
5. Remove console.logs and debug code
6. Keep only essential configuration files

### 2. Technology Stack

All Ecom OS applications should use:
```json
{
  "framework": "Next.js 14 (App Router)",
  "language": "TypeScript",
  "styling": "Tailwind CSS",
  "ui-components": "Radix UI",
  "icons": "Lucide React",
  "forms": "React Hook Form + Zod",
  "database": "PostgreSQL/SQLite with Prisma"
}
```

### 3. Port Allocation

Current port assignments:
- **3000** - Navigation Hub (this repo)
- **3001** - Reserved
- **3002** - Warehouse Management System
- **3003** - Bookkeeping
- **3004** - CentralDB
- **3005+** - Available for new services

### 4. Essential Configuration Files

Every project should include:

**package.json scripts:**
```json
{
  "scripts": {
    "dev": "next dev -p YOUR_PORT",
    "build": "next build",
    "start": "next start -p YOUR_PORT",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

## 📐 Design System

### Color Palette

Use these gradients for consistency:
```css
/* Application Themes */
--primary-gradient: from-purple-500 to-pink-500;
--secondary-gradient: from-blue-500 to-cyan-500;
--success-gradient: from-emerald-500 to-green-500;

/* Dark Theme Base */
--bg-primary: slate-900;
--bg-surface: slate-800/50;
--border-default: white/10;
```

### Component Patterns

Standard card component:
```tsx
<div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-white/10 p-8 hover:border-white/20 transition-all duration-500">
  {/* Content */}
</div>
```

See [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) for complete style guidelines.

## 🏗️ Architecture Guidelines

1. **API Design** - RESTful with `/api/v1/` versioning
2. **Database** - Use Prisma ORM with migrations
3. **Authentication** - NextAuth.js with JWT strategy
4. **Error Handling** - Centralized error handling with proper status codes
5. **Testing** - Jest for unit tests, Playwright for E2E

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed patterns.

## 🔒 Security Standards

Every application must implement:
- Input validation (Zod schemas)
- SQL injection prevention (Prisma)
- XSS protection
- CORS configuration
- Environment variable management
- Rate limiting

## 📚 Documentation Requirements

Each project must include:
1. **README.md** - Project overview and setup
2. **API.md** - API endpoint documentation
3. **CONTRIBUTING.md** - Contribution guidelines
4. **.env.example** - Environment variables template

## 🤝 Integration with Ecom OS

To integrate your app with the navigation hub:

1. Choose an available port (3005+)
2. Create a PR to add your app to the navigation page
3. Follow the redirect pattern:
```tsx
// app/your-app/page.tsx
import { redirect } from 'next/navigation'

export default function YourAppPage() {
  redirect('http://localhost:YOUR_PORT')
}
```

## 🛠️ Development Workflow

1. **Clone this repo** to understand the standards
2. **Create your app** following the guidelines
3. **Test locally** with other Ecom OS apps
4. **Document** your API and features
5. **Submit** for review

## 📖 Additional Resources

- [Technology Stack Details](docs/TECH_STACK.md)
- [UI/UX Style Guide](docs/STYLE_GUIDE.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [MCP Servers Guide](docs/MCP_SERVERS.md)

## 🚦 Running the Navigation Hub

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Access at http://localhost:3000
```

## 📝 License

Private repository - All rights reserved

---

**Remember:** Consistency across the Ecom OS ecosystem is key. When in doubt, refer to existing applications or ask for guidance.
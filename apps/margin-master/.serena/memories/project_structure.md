# MarginMaster Project Structure

```
MarginMaster/
├── app/                      # Next.js App Router pages
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Home page (redirects to dashboard)
│   ├── globals.css          # Global styles and Tailwind imports
│   ├── providers.tsx        # Client-side providers wrapper
│   ├── dashboard/           # Dashboard page
│   ├── materials/           # Material profiles management
│   ├── sourcing/            # Sourcing profiles management
│   ├── simulation-studio/   # Cost simulation tool
│   └── saved-simulations/   # Saved simulation results
│
├── components/              # React components
│   ├── ui/                  # Reusable UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   └── tabs.tsx
│   └── layout/              # Layout components
│       ├── dashboard-layout.tsx
│       └── main-nav.tsx
│
├── lib/                     # Utilities and configurations
│   ├── prisma.ts           # Prisma client instance
│   ├── types.ts            # TypeScript type definitions
│   └── utils.ts            # Helper functions (e.g., cn())
│
├── prisma/                  # Database configuration
│   └── schema.prisma       # Database schema definition
│
├── public/                  # Static assets
│
├── Configuration Files
├── next.config.mjs         # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
├── postcss.config.mjs      # PostCSS configuration
├── package.json            # Dependencies and scripts
└── .env.local              # Environment variables
```

## Key Architectural Decisions
- Uses Next.js 14 App Router for file-based routing
- Server Components by default, Client Components when needed
- Prisma ORM for type-safe database access
- Radix UI for accessible component primitives
- TailwindCSS for utility-first styling
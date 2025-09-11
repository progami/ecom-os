# Jason - Productivity Suite

A unified productivity suite featuring multiple tools in one application.

## Features

### 🗓️ Calendar Aggregator
- Multiple calendar sources (Outlook/Exchange, Trademan, Targon, Personal)
- Real-time sync with webhooks
- Conflict detection between calendars
- Secure OAuth2 authentication

### 📧 Email Summarizer (Coming Soon)
- AI-powered email summaries
- Extract key points and action items
- Save time on lengthy email threads

### 🚀 More Tools Coming Soon
- Document processor
- Task manager
- And more...

## Tech Stack

- **Frontend**: Next.js 14 with App Router, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Prisma ORM, BullMQ job queues
- **Database**: PostgreSQL
- **Cache/Queue**: Redis
- **Authentication**: JWT with OAuth2

## Prerequisites

- Node.js 18+ 
- PostgreSQL database (optional for development)
- Redis server (optional for development)
- npm or yarn

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Copy `.env.local` to `.env` and update with your values:
   ```bash
   cp .env.local .env
   ```

3. **Set up the database (optional):**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   ```

4. **Start Redis server (optional):**
   ```bash
   redis-server
   ```

5. **Run the development server:**
   ```bash
   npm run dev
   ```

   The app will be available at https://localhost:3001

## Application Structure

```
/Jason/
├── app/
│   ├── page.tsx                     # Main dashboard
│   ├── calendar-aggregator/         # Calendar tool
│   │   ├── page.tsx
│   │   ├── dashboard/
│   │   └── login/
│   ├── email-summarizer/            # Email tool
│   │   └── page.tsx
│   └── api/                         # API endpoints
├── components/                      # Shared components
├── lib/                            # Utilities and services
└── prisma/                         # Database schema
```

## Development Scripts

- `npm run dev` - Start HTTPS development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:studio` - Open Prisma Studio

## Security Notes

- All credentials are encrypted at rest
- OAuth2 tokens are stored securely
- HTTPS is required for production
- JWT tokens expire after 7 days

## Next Steps

1. Configure Microsoft Azure app for Outlook integration
2. Implement remaining calendar adapters
3. Build email summarizer functionality
4. Add more productivity tools
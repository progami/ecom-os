# Development Guide

## Overview
This guide provides instructions for developers working on the Warehouse Management System.

## Development Setup

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Git

### Initial Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/progami/warehouse-management.git
   cd warehouse-management
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and other settings
   ```

4. Run database migrations:
   ```bash
   npm run db:migrate
   ```

5. Seed the database (optional):
   ```bash
   npm run db:seed
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Strategy
- `main` - Production-ready code
- `engineer1/feature` - Engineer 1's development branch
- `engineer2/feature` - Engineer 2's development branch
- Feature branches - Create from main for specific features

### Creating a Feature
1. Create a new branch from main:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the coding standards

3. Test your changes:
   ```bash
   npm test
   npm run lint
   npm run type-check
   ```

4. Commit with conventional commits:
   ```bash
   git commit -m "feat(module): Add new feature"
   ```

5. Push and create a pull request

### Pull Request Process
1. Ensure all tests pass
2. Update documentation if needed
3. Request review from PR Master
4. Address any feedback
5. Merge after approval

## Project Structure

### Module Organization
The system is organized into business domains:

- **Operations** (`/src/app/operations/`)
  - Inventory management
  - Receive/ship goods
  - Storage ledger

- **Finance** (`/src/app/finance/`)
  - Invoice management
  - Reconciliation
  - Financial reporting

- **Configuration** (`/src/app/config/`)
  - Product management
  - Warehouse settings
  - Rate configuration

- **Analytics** (`/src/app/analytics/`, `/src/app/reports/`)
  - Reporting system
  - Data exports
  - Analytics dashboard

- **Admin** (`/src/app/admin/`)
  - User management
  - System settings
  - Administrative functions

### Key Technologies
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js
- **State Management**: React hooks and context
- **Testing**: Jest, React Testing Library

## Coding Standards

### TypeScript
- Use strict type checking
- Define interfaces for all data structures
- Avoid `any` type unless absolutely necessary
- Use proper error handling with try-catch blocks

### React/Next.js
- Use functional components with hooks
- Follow React best practices for performance
- Use Server Components where possible
- Implement proper loading and error states

### API Design
- RESTful endpoints
- Consistent error responses
- Input validation using Zod
- Proper HTTP status codes

### Database
- Use Prisma migrations for schema changes
- Never modify data directly in production
- Follow immutable ledger principles for critical data
- Use transactions for multi-step operations

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests for specific module
npm test -- --testPathPattern="finance"

# Run tests in watch mode
npm test -- --watch
```

### Writing Tests
- Write unit tests for utilities and helpers
- Write integration tests for API routes
- Test both success and error scenarios
- Mock external dependencies

## Common Tasks

### Adding a New Feature
1. Plan the feature and discuss approach
2. Create necessary database migrations
3. Implement backend API routes
4. Build frontend components
5. Write tests
6. Update documentation

### Debugging
- Use browser DevTools for frontend debugging
- Check server logs for API issues
- Use Prisma Studio for database inspection:
  ```bash
  npm run db:studio
  ```

### Performance Optimization
- Use React DevTools Profiler
- Implement proper caching strategies
- Optimize database queries
- Use pagination for large datasets

## Deployment

### Pre-deployment Checklist
- [ ] All tests passing
- [ ] No linting errors
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Documentation updated

### Production Considerations
- Enable error monitoring
- Set up database backups
- Configure rate limiting
- Implement proper logging
- Set up health checks

## Getting Help

### Resources
- Project documentation in `/docs`
- Architecture overview in `/docs/ARCHITECTURE.md`
- Excel template guides in `/docs/excel-templates/`

### Common Issues
1. **Database connection errors**: Check PostgreSQL is running and credentials are correct
2. **Module not found errors**: Run `npm install` and check imports
3. **Type errors**: Run `npm run type-check` to identify issues
4. **Test failures**: Ensure database is seeded properly for tests

## Contributing

1. Follow the coding standards
2. Write meaningful commit messages
3. Include tests with your changes
4. Update documentation as needed
5. Be responsive to PR feedback

Remember: Quality over speed. Take time to write clean, maintainable code.
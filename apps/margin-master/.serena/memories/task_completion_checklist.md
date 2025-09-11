# Task Completion Checklist

When completing any coding task in MarginMaster, ensure you:

## 1. Code Quality Checks
- [ ] Run linting: `npm run lint`
- [ ] Fix any linting errors before committing
- [ ] Ensure TypeScript has no compilation errors
- [ ] Check that imports use the `@/*` path alias where appropriate

## 2. Database Changes
If you modified the Prisma schema:
- [ ] Run `npm run db:generate` to update Prisma Client
- [ ] Run `npm run db:push` for development or `npm run db:migrate` for migrations
- [ ] Test database operations work correctly

## 3. Component Development
- [ ] Follow existing UI component patterns from `components/ui/`
- [ ] Use Radix UI primitives where applicable
- [ ] Apply Tailwind classes using `cn()` utility from `lib/utils`
- [ ] Ensure responsive design works on different screen sizes

## 4. Testing & Verification
- [ ] Manually test the feature in development server
- [ ] Check console for any errors or warnings
- [ ] Verify the feature works with both Admin and Staff user roles
- [ ] Test edge cases and error scenarios

## 5. Git Workflow
- [ ] Stage relevant files: `git add <files>`
- [ ] Write clear commit message following conventional commits
- [ ] Review changes with `git diff --staged`

Note: No automated testing framework is currently configured, so thorough manual testing is essential.
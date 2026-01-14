# Claude Code Instructions

## Database

All apps share `portal_db` on localhost:5432 with separate schemas per app. Connection strings are in each app's `.env.local` file.

| App | Schema |
|-----|--------|
| talos | dev_wms_us, dev_wms_uk |
| atlas | dev_hrms |
| x-plan | dev_xplan |
| kairos | chronos |
| sso | dev_auth |
| plutus | (no DB - uses QuickBooks API) |

Access via Prisma Studio: `pnpm prisma studio` from the app folder.

## Code Style

- No OR statements as fallbacks - let the code fail
- Do not add unnecessary error handling or fallbacks

## Testing

- Test via Chrome browser at `https://dev-targonos.targonglobal.com/<app>`
- Do not test on localhost
- **CRITICAL: Always test changes in Chrome BEFORE creating any PR** - Verify your changes work visually before committing

## Git Workflow

### Branch Naming

Use app name as prefix: `atlas/`, `x-plan/`, `talos/`, `kairos/`, `hrms/`, `sso/`, `plutus/`

Examples: `x-plan/fix-toolbar-visibility`, `talos/add-amazon-import`, `atlas/improve-loading`

### PR Workflow

Once work is complete:

1. **Test in browser** - Verify changes work in Chrome before proceeding
2. **PR to dev** - Create a pull request targeting the `dev` branch
3. **Wait for GitHub CI to pass** - Do not proceed until all checks are green
4. **Merge to dev** - Merge the PR yourself without waiting for approval
5. **PR to main** - Create a pull request from `dev` to `main` (PR must come from `dev` branch or CI will fail)
6. **Wait for GitHub CI to pass** - Ensure all checks pass on the main PR
7. **Merge to main** - Merge the PR yourself without waiting for approval
8. **Delete merged branches** - Delete all feature/fix branches you created after they are merged (both remote and local)

Always wait for CI to pass before merging. Merge PRs yourself without requiring approval. Always clean up your branches after merging.

### Handling Merge Conflicts

When `dev` and `main` diverge with conflicts:
1. Create a sync branch from `main`
2. Merge `dev` into it and resolve conflicts
3. PR the sync branch to `main`
4. After merge, sync `main` back into `dev` if needed

## Deployment & Caching

Do **not** suggest "hard refresh" as a troubleshooting step. Instead, use the in-app version badge (bottom-right) to confirm the deployed version and wait for the deploy pipeline if the version hasn't updated yet.

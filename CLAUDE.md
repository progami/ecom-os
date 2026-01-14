# Claude Code Instructions

## Worktree Development

If you're working in a worktree (`targonos-wt/<app>-1` or `<app>-2`), determine your dev URL from your folder:

| Folder Pattern | Slot | Dev URL Base | Ports |
|---------------|------|--------------|-------|
| `*-1/` | 1 | https://dev1-targonos.targonglobal.com | 32xx |
| `*-2/` | 2 | https://dev2-targonos.targonglobal.com | 33xx |

**Port assignments:**
- talos: 3201/3301
- sso: 3204/3304
- atlas: 3206/3306
- x-plan: 3208/3308
- kairos: 3210/3310
- plutus: 3212/3312

Run `pnpm dev` from `apps/<app>` to start hot reload. Test at your slot's URL (e.g., `dev1-targonos.targonglobal.com/talos` for talos-1).

## Code Style

- No OR statements as fallbacks - let the code fail
- Do not add unnecessary error handling or fallbacks

## Testing

- Test via Chrome browser at your environment's URL:
  - Production: `https://targonos.targonglobal.com/<app>`
  - Worktree slot 1: `https://dev1-targonos.targonglobal.com/<app>`
  - Worktree slot 2: `https://dev2-targonos.targonglobal.com/<app>`
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

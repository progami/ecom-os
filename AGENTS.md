# Claude Code Instructions

## Testing

All testing should be done via Chrome browser directly to `https://ecomos.targonglobal.com/<app>` (e.g., `https://ecomos.targonglobal.com/x-plan`). Do not test on localhost.

## Git Workflow

Once work is complete:

1. **PR to dev** - Create a pull request targeting the `dev` branch
2. **Wait for GitHub CI to pass** - Do not proceed until all checks are green
3. **Merge to dev** - Merge the PR yourself without waiting for approval
4. **PR to main** - Create a pull request from `dev` to `main`
5. **Wait for GitHub CI to pass** - Ensure all checks pass on the main PR
6. **Merge to main** - Merge the PR yourself without waiting for approval
7. **Fast-forward dev to main** - Ensure `dev` and `main` are on the same commit

Always wait for CI to pass before merging. Merge PRs yourself without requiring approval.

## Deployment & Caching

Do **not** suggest “hard refresh” as a troubleshooting step. Instead, use the in-app version badge (bottom-right) to confirm the deployed version and wait for the deploy pipeline if the version hasn’t updated yet.

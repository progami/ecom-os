# Claude Code Instructions

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

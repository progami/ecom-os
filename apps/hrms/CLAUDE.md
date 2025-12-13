# HRMS App - Claude Instructions

## Port Configuration

Use the correct port based on your branch/environment:

| Branch/Environment | Port | Command |
|-------------------|------|---------|
| main | 3006 | `PORT=3006 pnpm -F @ecom-os/hrms dev` |
| dev | 3106 | `PORT=3106 pnpm -F @ecom-os/hrms dev` |
| worktree | 3206 | `PORT=3206 pnpm -F @ecom-os/hrms dev` |

If you are in a git worktree, always use port 3206 to avoid conflicts with dev (3106) or main (3006).

## Scope

You are only allowed to work on the `apps/hrms` folder. Do not modify files outside this directory.

## Code Style

- no OR statements as fallbacks - let the code fail
- Use TypeScript strict mode
- Follow existing patterns in the codebase

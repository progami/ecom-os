# Repository Guidelines

## Project Structure & Module Organization
- Root workspace uses pnpm and Turborepo; run shared tasks from the repository root so caches stay coherent.
- Each product app lives in `apps/<name>` with its own Next.js config, Prisma schema, and `tests/` folder.
- Shared libraries sit in `packages/*` (config, logger, soon auth/ui); put cross-cutting logic here instead of duplicating inside apps.
- `docs/` holds canonical references (architecture, testing, workflows); consult it before adding patterns.
- Infrastructure automation (`infra/ansible`, `infra/terraform`) and deployment scripts must be updated when environment variables change.

## Build, Test, and Development Commands
- Install dependencies once with `pnpm install`.
- Start all dev servers via `pnpm dev`; scope to one workspace using `pnpm --filter @ecom-os/website dev`.
- Produce production bundles with `pnpm build`; run `pnpm --filter <package> build` before merging app-specific changes.
- Quality gates: `pnpm lint`, `pnpm typecheck`, and `pnpm format` (Prettier fan-out) must succeed pre-commit.
- Execute Playwright suites through `pnpm test` or `pnpm --filter @ecom-os/wms test` for targeted runs.

## Coding Style & Naming Conventions
- TypeScript runs in strict mode; prefer typed services, narrow interfaces, and `async/await` over raw promises.
- ESLint extends `next/core-web-vitals`; resolve all warnings and avoid disabling rules without justification.
- Format code with Prettier defaults (2-space indent, trailing commas, JSX double quotes) using `pnpm format`.
- Keep workspace package names under the `@ecom-os/*` scope; directories use kebab-case, React components PascalCase, hooks camelCase.
- Use Next path aliases (`@/*`) for intra-app imports, reserving relative paths for co-located files.

## Testing Guidelines
- Store every test asset inside the lone `tests/` directory with `unit/`, `integration/`, `e2e/`, and `fixtures/` subfolders.
- Maintain `tests/ui-inventory.json` so Playwright coverage matches real UI surfaces.
- Validate flows locally with `pnpm --filter <app> test`; ensure Playwright config targets the dev server’s port and base URL.
- Do not commit `logs/`, `coverage/`, or trace artifacts; extend `.gitignore` when new tooling emits files.

## Commit & Pull Request Guidelines
- Follow `type(scope): imperative summary` (e.g., `auth(login): harden redirect flow`) and explain context plus follow-up actions in the body.
- Group changes by app or shared package and mention additional workspaces touched when scopes differ.
- PRs should include purpose, testing evidence (`pnpm lint && pnpm test`), screenshots for UI shifts, and linked GitHub issues.
- Request owners of affected apps and shared packages as reviewers; flag infra updates for DevOps before merge.
- Branching: use short-lived `feature/*` branches off `dev`, merge via PR with passing checks, and advance `main` only through deliberate release PRs; never push directly to `main`.

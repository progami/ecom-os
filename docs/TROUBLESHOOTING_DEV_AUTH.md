# Dev Auth Troubleshooting (Nov 2025)

**Incident summary:**  
Dev logins redirected to `https://ecomos.targonglobal.com/api/auth/error?error=OAuthCallback` and any WMS calls to `/api/auth/session` from `https://dev.ecomos.targonglobal.com` failed CORS with `No 'Access-Control-Allow-Origin' header`.

**Root cause:**  
Several dev env files were pointed at the production host:

| File | Problematic values |
| --- | --- |
| `dev/apps/ecomos/.env.dev` & `.env.local` | `NEXTAUTH_URL`, `PORTAL_AUTH_URL`, `NEXT_PUBLIC_PORTAL_AUTH_URL` set to the prod domain, `PORTAL_APPS_CONFIG=prod.apps.json` |
| `dev/apps/wms/.env.dev` & `.env.local` | Same prod URLs + CSRF list targeting the prod origins |
| `dev/apps/x-plan/.env.dev` & `.env.local` | Same prod URLs |

That pushed the NextAuth client and the shared portal session code to call the production API (`https://ecomos.targonglobal.com`). Because the browser was on the dev origin, preflight checks failed (`ERR_FAILED`) and Google OAuth completed with prod cookies, triggering the NextAuth `OAuthCallback` error screen.

**Fix applied (Nov 3 2025):**

1. Restored all dev env files to use the dev host: `https://dev.ecomos.targonglobal.com`.
2. Switched EcomOS back to `PORTAL_APPS_CONFIG=dev.apps.json` so app routing matches the dev host map.
3. Rebuilt the Next.js bundles (`pnpm --filter … build`) to bake the new URLs into the generated chunks.
4. Restarted the pm2 dev processes (`ecomos-dev`, `wms-dev`, `x-plan-dev`, `website-dev`) ensuring the updated envs were loaded (`pm2 restart … --update-env`).
5. Cleared browser cookies/cache (or used an incognito session) so clients stopped sending the stale prod cookies.

**How to prevent recurrence:**

- When cloning prod settings into dev, keep `NEXTAUTH_URL`, `PORTAL_AUTH_URL`, `NEXT_PUBLIC_PORTAL_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `PORTAL_APPS_CONFIG` pointing at the `dev` host. Only secrets/DB URIs should match prod.
- After editing env files, `rm -rf apps/<app>/.next` (or `pnpm build`) and restart the pm2 process to avoid stale bundles referencing the old host.
- If login suddenly redirects to the prod error page or CORS errors mention `ecomos.targonglobal.com`, inspect `/proc/<pid>/environ` or the relevant `.env.*` file for prod URLs.

**Validation checklist for dev auth:**

1. `curl -I https://dev.ecomos.targonglobal.com/api/auth/session` from the box returns 200.
2. Browser console requests stay on `https://dev.ecomos.targonglobal.com`.
3. `pm2 env <id>` for dev apps shows `PORTAL_AUTH_URL=https://dev.ecomos.targonglobal.com`.
4. Sign-in succeeds and WMS dashboard loads without CORS warnings.

Document owner: A. (Nov 2025). Update this doc if the setup changes.

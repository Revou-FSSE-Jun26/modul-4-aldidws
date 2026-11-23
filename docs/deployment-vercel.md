# Deploying the frontend to Vercel

The Next.js frontend (`frontend/`) runs on Vercel. The Flask backend already runs on Railway (see `deployment-railway.md`). This file covers the frontend only. Nothing here has been deployed from this repository yet.

## Vercel project settings

| Setting          | Value                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Root Directory   | `frontend`                                                                                 |
| Framework Preset | Next.js (auto-detected)                                                                    |
| Install command  | default (`npm install`)                                                                    |
| Build command    | default (`next build`)                                                                     |
| Output directory | default                                                                                    |
| Node.js version  | 20.x or newer. `package.json` has no `engines` field. Next.js 16 needs Node 20.9 or newer. |

There is no `vercel.json`, no rewrites and no middleware. The browser calls the Railway backend directly, so the backend must allow the Vercel origin through CORS.

## Environment variables

Set these in Vercel under Settings > Environment Variables. `NEXT_PUBLIC_*` values are inlined into the JavaScript bundle at build time, so changing one needs a redeploy.

| Name                       | Purpose                                         | Placeholder                           | Public or server-only  | Environments        |
| -------------------------- | ----------------------------------------------- | ------------------------------------- | ---------------------- | ------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | Backend origin used by all API calls            | `https://your-service.up.railway.app` | Public (in the bundle) | Production, Preview |
| `API_BASE_URL`             | Optional. Same value, used by Server Components | `https://your-service.up.railway.app` | Server-only            | Optional            |

Format rules for the base URL:

- Scheme and host only: `https://your-service.up.railway.app`.
- No trailing slash and no `/api`. The code already adds `/api/...` to every path (for example `/api/boards`). A value ending in `/api` produces `/api/api/boards` and every call fails.
- The backend has no single prefix: most routes are under `/api`, a few under `/api/v1` (V-019). The frontend paths include the prefix, so the base URL stays prefix-free.

`API_BASE_URL` falls back to `NEXT_PUBLIC_API_BASE_URL` when unset, so you can skip it.

`frontend/next.config.ts` fails the build on Vercel (`VERCEL=1`) when `NEXT_PUBLIC_API_BASE_URL` is missing, is not `https://`, or has a path or trailing slash. This stops a deploy that would call the Vercel domain itself.

Do not put secrets in `NEXT_PUBLIC_*` variables. The frontend needs none.

The E2E variables in `frontend/.env.example` (`BASE_URL`, `TEST_USER_*`) are for Playwright only. Do not set them in Vercel.

## Order of steps

1. In Vercel, import the repository. Set Root Directory to `frontend`. Add `NEXT_PUBLIC_API_BASE_URL` with the Railway backend origin (the deploy fails without it).
2. Deploy.
3. Copy the production domain, for example `https://revotask.vercel.app`.
4. In Railway, set `CORS_ALLOWED_ORIGINS` to that exact origin: scheme and host, no trailing slash, no path. Example: `https://revotask.vercel.app`.
5. Redeploy the Railway backend. The config is read at startup.
6. Preview deployments get different domains (`*-git-<branch>-*.vercel.app`). The backend allowlist has no wildcards, so previews cannot call the API until you add their exact origin to the comma-separated list. Test on the production domain, or add the preview origin on purpose.

If you add a custom domain later, add it to `CORS_ALLOWED_ORIGINS` as well and keep the `vercel.app` origin only if you still use it.

## Verification checklist

Run these on the deployed site with the browser dev tools open (Network and Console tabs).

- [ ] `https://<backend>/api/health` returns 200 with `{"data": {"status": "ok", ...}}`.
- [ ] The site loads and `/login` renders.
- [ ] Register a new account. The `POST /api/auth/register` request goes to the Railway domain, not the Vercel domain, and returns 201.
- [ ] Log in. The `OPTIONS` preflight returns 200 or 204 and the `POST /api/auth/login` returns 200. No CORS error in the console.
- [ ] After logging in you land on `/` and the `GET /api/boards` request carries `Authorization: Bearer ...`. Opening a board goes to `/boards/<id>`. Reloading either page sends you to `/login` (the session is in memory only).
- [ ] Open `/my-tasks` and `/profile`. Requests carry `Authorization: Bearer ...` and return 200 (or a handled empty state).
- [ ] No request goes to `localhost` or to the Vercel domain for `/api/...`.
- [ ] Console shows no `blocked by CORS policy` message. If it does, compare the `Origin` request header with `CORS_ALLOWED_ORIGINS` character by character.

The current UI has no screen for creating a board, so "create board" cannot be checked from the browser. Create one through the API or `/apidocs` if you need data.

## Known risks in production

These come from the code as it is. They are not caused by Vercel, and this change did not redesign auth.

- **Home and board detail depend on the in-memory session.** `app/page.tsx` and `app/boards/[id]/page.tsx` are now thin Server Components that render client components (`BoardsGrid`, `BoardDetailView`). These take the token from `AuthContext`, the same way `/my-tasks` and `/profile` do, and no longer read an `access_token` cookie. After login, `/` and `/boards/[id]` load through client-side navigation. Because the token is kept in memory only (see V-009 below), a page reload or a direct visit to either URL sends the user to `/login` once auth loading ends. `/my-tasks` and `/profile` do not redirect. They show a "sign in" message instead. This was verified with unit and component tests only, not against a real backend.
- **No session restore (V-009).** The frontend calls `POST /api/auth/refresh` and `POST /api/auth/logout`. The backend has neither. After a page reload the user is logged out. Logout only clears local state, and the old token stays valid until it expires.
- **Refresh token in a plain cookie (V-010).** After login the frontend writes the refresh token with `document.cookie` (not HttpOnly, scoped to the Vercel domain). The backend never reads it. Remove it when the refresh endpoint is designed.
- **Credentials and CORS.** The backend runs with `supports_credentials=False`. The login request no longer sends `credentials: "include"`, because a credentialed cross-origin request would be blocked by the browser. The refresh and logout calls still send it, so in a browser they fail with a CORS error in the console. They are wrapped in `try/catch`, so the UI is not affected. If cookie-based refresh is added later, enable credentials on the backend with exact origins and restore it on the frontend.
- **Direct `fetch()` calls and mixed prefixes (V-016, V-019).** Still open. They work, but several calls are unverified against the real backend. Some endpoints (`/api/cards?assignee=me`, `/api/boards/<id>/columns`, `/api/v1/cards?column_id=`) are handled as "not available yet" when the backend returns 404 or 405.
- **Public `/apidocs`.** The Swagger UI on Railway is open to anyone who knows the URL.
- **No rate limiting (V-011)** on login and register.

## What was not verified

- A real Vercel deployment.
- Login, register or any request against the real Railway backend.
- The Railway domain is unknown here, so every URL above is a placeholder.

# Deploying the backend to Railway

This covers the Flask backend only. The frontend is not part of this setup.

## Service settings

| Setting             | Value                                      |
| ------------------- | ------------------------------------------ |
| Root directory      | `/backend`                                 |
| Builder             | Default (Railpack). Reads `requirements.txt` and `.python-version` (3.11) |
| Start command       | From `backend/Procfile` (gunicorn on `0.0.0.0:$PORT`, 2 workers by default) |
| Pre-deploy command  | `flask db upgrade`                         |
| Healthcheck path    | `/api/health`                              |

If Railway does not pick up the Procfile, paste its command into the service's Custom Start Command.

There is no `railway.json`. Railway has marked config-as-code as deprecated, so the pre-deploy command and healthcheck path are set in the dashboard.

## Environment variables

Set these on the backend service. Do not commit real values.

| Name                   | Purpose                                              | Placeholder / source                       | Required |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------ | -------- |
| `APP_ENV`              | Selects the config. Unset also means production.     | `production`                               | Yes (recommended) |
| `FLASK_APP`            | Lets `flask db upgrade` find the app                 | `wsgi:app`                                 | Yes      |
| `SECRET_KEY`           | Flask secret                                         | random 64-char hex                         | Yes      |
| `JWT_SECRET_KEY`       | Signs access tokens. Use a different value from `SECRET_KEY`. | random 64-char hex                | Yes      |
| `DATABASE_URL`         | PostgreSQL connection string                         | reference the Postgres service variable    | Yes      |
| `CORS_ALLOWED_ORIGINS` | Frontend origins allowed to call the API, comma-separated, no `*` | `https://your-frontend.example.com` | Yes |
| `WEB_CONCURRENCY`      | Gunicorn worker count                                | `2`                                        | No       |
| `PORT`                 | Port gunicorn binds to                               | Set by Railway. Do not set it.             | No       |

Generate a secret with:

```
python -c "import secrets; print(secrets.token_hex(32))"
```

## Dashboard steps

1. Create a new Railway project.
2. Add a PostgreSQL database to the project.
3. Add a service from the GitHub repository.
4. In the service settings, set the root directory to `backend`.
5. Add the variables from the table above. For `DATABASE_URL`, use a reference to the Postgres service's `DATABASE_URL`.
6. Set the pre-deploy command to `flask db upgrade` and the healthcheck path to `/api/health`.
7. Generate a public domain for the service.
8. Point the frontend's `NEXT_PUBLIC_API_BASE_URL` and `API_BASE_URL` at that domain, and put the frontend's origin in `CORS_ALLOWED_ORIGINS`.
9. Deploy, then open `https://<backend-domain>/api/health`. It should return `{"data": {"status": "ok", "db": "ok"}}`.

## Behaviour to know

- Production is the default. If `APP_ENV` and `FLASK_ENV` are both unset, the app uses `ProductionConfig`. An unknown value stops startup.
- The app does not start if `SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL` or `CORS_ALLOWED_ORIGINS` is missing or blank. The error names the variable, never its value.
- A `postgres://` URL is rewritten to `postgresql://`. Anything already in the query string, such as `?sslmode=require`, is kept. Railway's private `*.railway.internal` address does not need SSL. If you use the public proxy URL, add `?sslmode=require`.
- CORS allows only the listed origins, the methods GET, POST, PUT, PATCH, DELETE, OPTIONS, and the headers `Content-Type` and `Authorization`. Credentials are off because the API uses a Bearer token, not cookies.
- `/api/health` returns 200 even when its database check reports `"db": "error"`. It shows the process is up, not that the database is reachable.
- Migrations run once in the pre-deploy step, not at app start, so several workers do not race.

## Remaining risks

- No rate limiting on login and registration (V-011).
- Password hashing uses the Werkzeug default, not an explicitly configured Argon2id or bcrypt (V-013).
- The refresh and logout endpoints are missing and the frontend writes the refresh token to a normal cookie (V-009, V-010).
- The Swagger UI at `/apidocs` is public.
- `gunicorn --check-config` and a real Railway deploy have not been run from this repository.
- The repository has a single `requirements.txt`. The `requirements/` split from the structure standard is not done.

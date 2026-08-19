# Deploying The Invasion

Three pieces, all on free tiers: a static frontend, a containerised backend, and
a Postgres database. Nothing here is specific to a provider except the account
setup in step 2 — the Dockerfile and the environment variables are the same
wherever the backend runs.

## The shape

| Piece | Where | Why there |
|---|---|---|
| Frontend | Cloudflare Pages | Static build. Permanently free, HTTPS and a subdomain included. |
| Backend | Render web service | No card. 750 instance-hours a month covers one service. HTTPS handled. |
| Database | Neon | Permanently free Postgres. **Render's own free Postgres is deleted after 30–90 days** — do not use it for anything holding accounts. |

Two things to know before starting.

**The backend sleeps.** A free instance that has been idle spins down, and the
next request waits for it. The application itself starts in about **2 seconds**
— measured, not estimated — so the wait is the host waking the instance, not
Spring Boot booting. The login screen says so rather than showing a spinner that
looks broken.

**Order matters.** The database exists before the backend, because the backend
needs its URL. The backend exists before the frontend build, because the build
bakes the API address in. And the backend's allowed origin can only be set once
the frontend has an address — so step 4 comes back to step 2.

## 1. Database — Neon

Create a project and copy the connection string. It looks like:

```
postgresql://user:password@ep-something.region.aws.neon.tech/dbname?sslmode=require
```

JDBC needs that with a `jdbc:` prefix and the credentials moved out of the URL:

```
SPRING_DATASOURCE_URL=jdbc:postgresql://ep-something.region.aws.neon.tech/dbname?sslmode=require
SPRING_DATASOURCE_USERNAME=user
SPRING_DATASOURCE_PASSWORD=password
```

Nothing else is needed. The schema is created on first boot —
`ddl-auto=update` — and **is not dropped on shutdown**, which is the whole
reason that setting is `update` and not `create-drop`.

## 2. Backend — Render

New Web Service, point it at this repository, root directory `Backend`, and let
it use the Dockerfile. Then set five environment variables:

| Variable | Value |
|---|---|
| `SPRING_DATASOURCE_URL` | from step 1 |
| `SPRING_DATASOURCE_USERNAME` | from step 1 |
| `SPRING_DATASOURCE_PASSWORD` | from step 1 |
| `JWT_SECRET` | a long random value — see below |
| `CORS_ALLOWED_ORIGINS` | the frontend's address, filled in at step 4 |

`PORT` is set by Render; the application reads it.

Generate the signing key with something that is actually random:

```bash
openssl rand -base64 48
```

**The application refuses to start without it.** Anyone holding the key can mint
a login token for any account, so the development fallback in
`application.properties` is rejected against any database that is not an
in-memory H2. If the service fails to boot with a message about `JWT_SECRET`,
that check is doing its job.

Note the service's address — `https://something.onrender.com`.

## 3. Frontend — Cloudflare Pages

Connect the repository. Build settings:

- Root directory: `Frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://something.onrender.com`

`VITE_API_BASE_URL` is read **at build time**, not at run time. Changing it later
means rebuilding — Vite has already written the value into the bundle. A
production build without it logs an error at startup and calls `localhost:8080`,
which exists for nobody but you.

Note the site's address — `https://something.pages.dev`.

## 4. Back to the backend

Set `CORS_ALLOWED_ORIGINS` to the frontend's address, exactly, with the scheme
and no trailing slash:

```
CORS_ALLOWED_ORIGINS=https://something.pages.dev
```

Several origins are comma separated. Without this the browser refuses every
response the backend sends and the game looks broken while the server logs look
perfectly healthy — the request arrives and is answered, and the browser throws
the answer away.

## Checking it worked

```bash
# Up, and asking for authentication rather than letting anyone in.
curl -o /dev/null -w '%{http_code}\n' https://something.onrender.com/api/player/me
# 403

# Serving the frontend's origin, and only it.
curl -s -D - -o /dev/null -X OPTIONS https://something.onrender.com/api/player/me \
  -H 'Origin: https://something.pages.dev' \
  -H 'Access-Control-Request-Method: GET' | grep -i access-control-allow-origin
# Access-Control-Allow-Origin: https://something.pages.dev
```

Then register an account, win a level, and reload. If progress survives, the
database is real and connected. If it does not, the backend is still on its
in-memory default and `SPRING_DATASOURCE_URL` has not reached it.

## Running it locally

Unchanged, and nothing above is required. `application.properties` carries
development defaults for every one of these — H2 in memory, localhost origins,
port 8080, the development signing key:

```bash
cd Backend && ./mvnw spring-boot:run
cd Frontend && npm run dev
```

## What was verified, and how

The container was built and run against a real Postgres before this was written:

- boots in **1.9s**, honours `PORT`, answers `403` unauthenticated
- creates its **8 tables** in Postgres on first boot
- a registered player **survives a backend restart** — two players before, two
  after, which is the failure `create-drop` used to guarantee
- serves `Access-Control-Allow-Origin` for the configured origin and **no CORS
  headers at all** for an unlisted one
- refuses to start on the development signing key against a Postgres URL

Not verified: the Render and Neon accounts themselves, which need signing in.
Free-tier terms change — confirm them as you go rather than trusting this table.

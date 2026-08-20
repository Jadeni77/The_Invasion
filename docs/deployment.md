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

`PORT` is set by Render; the application reads it. Email confirmation needs four
more — step 5, and without them nobody can register.

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

## 5. Email confirmation

A registered address has to prove it exists before the account can play:
registration sends a six-digit code and login is refused until it is entered.
That needs somewhere to send mail from. **With no SMTP configured the code is
only written to the server log, which means nobody can register** — the
registration succeeds and the code goes nowhere the player can read it.

Four more variables:

| Variable | Value |
|---|---|
| `SPRING_MAIL_HOST` | e.g. `smtp-relay.brevo.com` |
| `SPRING_MAIL_USERNAME` | from the mail provider |
| `SPRING_MAIL_PASSWORD` | from the mail provider — an API key or app password, not an account password |
| `MAIL_FROM` | the address mail appears to come from |

Four, and not six: the port and STARTTLS are set in `application.properties`
because Spring's defaults are port 25 with no encryption, which every hosted
provider refuses. `SPRING_MAIL_PORT` and `SPRING_MAIL_STARTTLS` exist to
override them — and on a free Render instance, the port has to be.

### On Render's free tier, 587 does not work

**Free Render web services block outbound traffic to ports 25, 465 and 587**,
since September 2025. The failure looks nothing like a credentials problem:

```
MailConnectException: Couldn't connect to host, port: smtp.gmail.com, 587
```

A refused TCP connection, so the credentials are never even tried. The same
instance reaches Postgres on 5432 without trouble, which is the tell: this is
port-specific, not a network fault.

Render's block list is exactly those three ports, and **2525 is not on it**.
Brevo and Mailjet both accept STARTTLS there:

```
SPRING_MAIL_HOST=in-v3.mailjet.com     # or smtp-relay.brevo.com
SPRING_MAIL_PORT=2525
```

**Gmail cannot be used from a free Render instance at all.** It offers 465 and
587 and nothing else, and both are blocked. An app password does not help.

If 2525 is ever blocked too, the ways out are a paid instance, which lifts the
restriction, or sending over the provider's HTTPS API instead of SMTP — port
443, which no host blocks. The second needs code: both senders currently use
`JavaMailSender` directly.

Otherwise any SMTP provider works. Brevo's free tier sends 300 a day without a
card, and both it and Mailjet verify a single sender address, so neither needs a
domain of your own.

**Accounts that predate this are grandfathered.** `email_verified` being null
means the account was made before confirmation was asked for, and it counts as
confirmed — nobody is locked out of their own save by a rule that did not exist
when they registered.

**The test accounts need none of this.** Both are seeded at boot already
confirmed — `test@example.com` with every defender maxed, `test2@example.com` at
the start of the game — so end-to-end testing needs no mailbox at all.

Their addresses are in `DataInitializer` and this repository is public, so
**every deployment must set a password of its own**:

```
TEST_PLAYER_PASSWORD=<something only you know>
```

Without it they are seeded with the development default, which anyone reading
the source can look up. The change takes effect on the next boot: the maxed
account is rebuilt regardless, and the start-of-game account keeps its progress
and has only its password brought in line.

To do without the accounts entirely:

```
SEED_TEST_PLAYERS=false
```

Note that this stops them being *recreated*; rows already in the database stay,
with whatever password they were last given.

`AUTH_VERIFICATION_EXEMPT` is what remains for an address that has to register
by hand without a working inbox, and for getting back in during an SMTP outage:

```
AUTH_VERIFICATION_EXEMPT=someone@example.com
```

Listed addresses are confirmed from the outset and never receive anything, so it
should be empty otherwise — an exempt address is a way past confirmation
entirely.

## Renaming a column in a release

`ddl-auto=update` **adds**; it never renames and never drops. Ship a renamed
column and Hibernate adds the new name as nullable, leaves the old one full of
the data, and reads nulls back — so the release looks fine and the accounts read
as empty.

The SQL therefore runs **before** the deploy that needs it. Afterwards the new
column already exists and the rename collides with it.

Check what is actually there first:

```sql
SELECT table_name, column_name FROM information_schema.columns
WHERE table_name IN ('unlocked_levels', 'completed_levels', 'level_stars',
                     'player_collected_treasures', 'claimed_achievements',
                     'special_achievements')
ORDER BY table_name, ordinal_position;
```

The release that gave these columns explicit names — `unlocked_levels` held a
column also called `unlocked_levels`, which said nothing about what a row meant
— needed this:

```sql
ALTER TABLE unlocked_levels RENAME COLUMN unlocked_levels TO level_number;
ALTER TABLE completed_levels RENAME COLUMN completed_levels TO level_number;
ALTER TABLE player_collected_treasures RENAME COLUMN collected_treasures TO treasure_id;
ALTER TABLE claimed_achievements RENAME COLUMN claimed_achievements TO achievement_id;
ALTER TABLE special_achievements RENAME COLUMN special_achievements TO achievement_id;

-- Not renamed. The old rows were (player_id, level_stars): a star count with no
-- level attached, in an order SQL never promised - which is the bug @OrderColumn
-- fixed. Which score belonged to which level cannot be recovered, so the table
-- is recreated empty and the stars are re-earned by replaying.
DROP TABLE level_stars;
```

Nullable columns added by a release — `email_verified` and its two companions —
need nothing. Hibernate adds them and null carries the right meaning.

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

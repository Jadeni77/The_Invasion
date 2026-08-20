
# 🧟 The Invasion

A tower defense game inspired by Plants vs. Zombies. Users will be able to deploy their chosen 
defensive units onto the game grids to prevent enemy waves from attacking the base. There will
be a total of 20 challenging levels and an endless level. 

## Features:
- 20 challenging levels + an endless survival mode
- Multiple defensive units with unique abilities
- Progressive difficulty and resource management

## 🎥 Screenshots
<img width="400" alt="Screenshot 2026-08-19 at 11 03 13 PM" src="https://github.com/user-attachments/assets/11645afc-04ac-4713-b944-75f88c230b8b" />
<img width="400" alt="Screenshot 2026-08-19 at 11 04 13 PM" src="https://github.com/user-attachments/assets/003e36f0-51d7-4d16-b262-a2986464fc8b" />
<img width="400" alt="Screenshot 2026-08-19 at 11 04 41 PM" src="https://github.com/user-attachments/assets/0f7a1b6b-8096-4d44-96f4-a7ddf46a682d" />
<img width="400" alt="Screenshot 2026-08-19 at 11 07 50 PM" src="https://github.com/user-attachments/assets/6d7be264-4d3f-45a0-96f6-6e9ef40f9eea" />



## 🚀 Play the Game
Live Demo: **[the-invasion.pages.dev](https://the-invasion.pages.dev)**

The backend sleeps when nobody is playing, so the first login after a quiet
spell waits up to a minute while it wakes. The login screen says so when it
happens.

## 🗂️ How the project fits together

Three pieces, deployed separately:

| Piece | Lives in | Runs on |
|---|---|---|
| Game and UI | `Frontend/` | Cloudflare Pages (static) |
| Accounts, saves, progress | `backend/` | Render (Docker) |
| The data itself | — | Neon (Postgres) |

The game logic is entirely in the browser - the backend only stores who you are
and what you have unlocked. `Frontend/src/component/GameLogic (MVC)/` holds the
engine, the units and the level configuration; `GameRendering/` holds the
screens.

## ⚙️ Running it locally

You need [Node.js](https://nodejs.org/en/download) **20.19+** (Vite 7 requires
it) and a **JDK 17+**. You do *not* need to install Maven - the repository ships
the Maven wrapper. CI and the deployment image both build on **JDK 21**, which is
what to match if something compiles for you and not for them.

**Backend**, on http://localhost:8080:

```bash
cd backend
./mvnw spring-boot:run
```

It starts on an in-memory H2 database, so it needs no setup and forgets
everything when it stops. To inspect that database while it runs, start it with
`H2_CONSOLE_ENABLED=true` and open http://localhost:8080/h2-console - it is off
by default because it is unauthenticated and accepts arbitrary JDBC URLs.

**Frontend**, on http://localhost:5173:

```bash
cd Frontend
npm install
npm run dev
```

It calls `localhost:8080` unless `VITE_API_BASE_URL` says otherwise, so the two
find each other with no configuration.

## 🧪 Tests

```bash
cd Frontend && npm test        # ~2,070 tests
cd backend  && ./mvnw test     # ~114 tests
cd Frontend && npm run lint
```

Every push and pull request runs both, plus a production build and a
`docker build` of the backend image - the last of these because `mvnw test`
cannot see a Dockerfile that no longer builds, and a broken one only shows up
at deploy time otherwise. See [.github/workflows/](.github/workflows/).

A third workflow, `mail-canary.yml`, runs monthly rather than on a push: it asks
the deployment to send one email to itself. Mail providers expire a key that has
gone unused for 90 days, and this game only sends when somebody registers - so
the check keeps the credential alive and, more importantly, fails loudly if the
transport has broken. Without it, a dead mailer looks exactly like a working one
until a player tells you they never got a code.

## 📦 Deploying

Full walkthrough, including the environment variables and the order the three
services have to be created in: **[docs/deployment.md](docs/deployment.md)**.

The short version - `main` is the release branch, and both hosts deploy from it
automatically on every merge:

**Required:**

| Variable | Set on | What it is |
|---|---|---|
| `VITE_API_BASE_URL` | Cloudflare | the backend's full address, **including `https://`** |
| `SPRING_DATASOURCE_URL` | Render | `jdbc:postgresql://<host>/<db>?sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` | Render | from Neon |
| `SPRING_DATASOURCE_PASSWORD` | Render | from Neon |
| `JWT_SECRET` | Render | a long random value, `openssl rand -base64 48` |
| `CORS_ALLOWED_ORIGINS` | Render | the frontend's address, no trailing slash |

**Mail** - without these, registration completes and the confirmation code goes
nowhere, so nobody new can play:

| Variable | Set on | What it is |
|---|---|---|
| `SPRING_MAIL_HOST` | Render | e.g. `smtp-relay.brevo.com` |
| `SPRING_MAIL_PORT` | Render | **`2525`** on a free Render instance - see below |
| `SPRING_MAIL_USERNAME` | Render | the provider's SMTP login, often *not* your account email |
| `SPRING_MAIL_PASSWORD` | Render | the provider's SMTP key |
| `MAIL_FROM` | Render | a sender address verified with the provider |

**Optional:**

| Variable | Set on | What it is |
|---|---|---|
| `TEST_PLAYER_PASSWORD` | Render | password for the two seeded test accounts. This repository is public, so a deployment must set its own |
| `SEED_TEST_PLAYERS` | Render | `false` to seed no test accounts at all |
| `ADMIN_TOKEN` | Render **and** as a repository secret | enables the monthly mail check; both values must match |
| `REQUIRE_EMAIL_VERIFICATION` | Render | `false` lets any well-formed address play at once. A retreat for when mail is broken, not a default |

Three that bite:

- `VITE_API_BASE_URL` is read at **build** time, so changing it needs a rebuild -
  and a value without `https://` is a relative path, which silently points the
  game at itself.
- `CORS_ALLOWED_ORIGINS` must match the frontend's origin exactly, or the
  browser discards every response while the server logs look perfectly healthy.
- **A free Render instance blocks outbound SMTP on ports 25, 465 and 587.** The
  failure reads as a credentials problem and is not one: the connection is
  refused before authentication, while the same instance reaches Postgres on 5432
  without trouble. Use **2525**, which Brevo and Mailjet both accept. Gmail
  offers neither and cannot be used from that host at all.

## Technology Used
* JavaScript - Core language for game logics and classes communication
* React.js - Frontend framework
* Vite - Frontend build tool and dev server
* Spring Boot - Backend framework for game state and resources
* PostgreSQL - Player accounts and progress in deployment (H2 in memory locally)
* Docker - How the backend is built and run in deployment
* Maven - Build and dependency management for the backend
* Java - Backend implementation
* Vitest and JUnit - Test suites for the frontend and backend

## 🎮 How to Play
* Click on a level in the Lobby page
* Choose the desired defensive units
* Deploy them onto the game grids
* Waves of enemies will spawn automatically
* Defeat all enemies to win
* Earn resources for each enemy defeated, and use them to upgrade defensive units
* Have Fun! 🎉

Winning an odd-numbered level up to 17 grants a new defender, so the campaign
hands you a tool shortly before the level that needs it. Starting a level costs
energy, which refills over time or can be bought with gold - and leaving a level
part-way forfeits it, which the quit dialog warns about.

## 👥 Contributors
<table>
  <tr>
    <td align="center">
      <a href="https://github.com/jadeni77" target="_blank">
        <img src="https://github.com/jadeni77.png" width="60px" style="border-radius:50%;" /><br />
        Jaden Mei
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/marlili" target="_blank">
        <img src="https://github.com/marlili.png" width="60px" style="border-radius:50%;" /><br />
        Marina Li
      </a>
    </td>
  </tr>
</table>

## 🙏 Acknowledgements
Game assets used in this project were downloaded from [Free Game Assets](https://itch.io/game-assets/free)

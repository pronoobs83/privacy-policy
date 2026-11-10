# Z Route Planner

A planner for **Z Route: Redemption**. It works like the StressWar Last Z planner, and its game data and images come from [zrouteguide.com](https://zrouteguide.com).

- Calculators for buildings, research trees, heroes, equipment, exclusive weapons, Sky Fighter, alliance tech, decorations, VIP and survivors.
- **Works without an account.** Plans are saved in the browser, per game account ("profile": main, farm, other server…).
- **Optional login** (email + password, Discord if configured) syncs all profiles across devices.
- **Device pairing.** A signed-in device shows a QR code or one-time code; scanning or entering it signs the other device in.

## How it is wired

```
Browser (React Router SSR + hydrate)
  ├─ localStorage  zrp:meta (profiles) · zrp:u:<profile>:<tool> (tool state) · zrp:dirty (pending pushes)
  └─ sync engine (app/lib/sync.ts): pull GET /api/sync?since=N · push POST /api/sync · every 20 s + on focus
Express (server.js → server/app.ts)
  ├─ /api/auth/*   Better Auth (sessions in cookies, email/password, Discord, one-time-token pairing)
  ├─ /api/sync     versioned "units" per user, last-write-wins on edit time (server/sync.ts)
  └─ everything else → React Router (loaders read app/data/*.json on the server)
Database: MySQL in production (DATABASE_URL), SQLite file locally. Tables are created automatically on boot.
```

Sync sends one unit per (profile, tool), e.g. `research` for a profile. Every write increases a per-user version number, so clients only fetch what changed since their last pull. The profile list is merged across devices instead of being overwritten, and a deleted profile stays deleted everywhere. The app polls instead of using WebSockets because Hostinger's managed Node.js hosting doesn't accept incoming WebSockets.

## Local development

```bash
npm install
cp .env.example .env   # fill BETTER_AUTH_SECRET
npm run dev            # http://localhost:3000, SQLite in ./local.sqlite
```

## Refreshing game data from zrouteguide.com

```bash
npm run export-data                 # all datasets + images (uses .cache/raw, re-runs are fast)
npm run export-data -- --fresh      # re-download everything
npm run export-data -- research     # one dataset: buildings research heroes survivors equipment exclusive skyfighter allianceTech decorations vip
```

The exporter reads the REST token from `/my-z-route/` each run, waits 1.5 s between `/wp-json` calls, and backs off when the site's rate limiter returns 429. Output goes to `app/data/*.json`, and images go to `public/img/<path after wp-content/>`.

## Deploying on Hostinger Business (managed Node.js)

1. **Database:** in hPanel go to *Databases → MySQL*, create a database and user, and note the host, name, user and password.
2. **Node.js app:** go to *Websites → Add website → Node.js* and deploy from GitHub (or upload a zip of this folder).
   - Framework: **Express** (or *Other*), Node **22.x or 24.x**
   - Build command: `npm run build`
   - Entry file: `server.js`
   - If the app lives in a subfolder of the repo, follow Hostinger's monorepo instructions or move it into its own repository.
3. **Environment variables** (Node.js dashboard → Environment Variables):

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `mysql://USER:PASSWORD@HOST:3306/DBNAME` |
| `BETTER_AUTH_SECRET` | 32+ random characters (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | `https://planner.yourdomain.com` |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | optional; Discord redirect URL: `https://planner.yourdomain.com/api/auth/callback/discord` |

4. Deploy. Tables are created on first start. Business allows 5 Node.js apps, so each game planner can be its own app (one subdomain each). Several games can also share one MySQL database by using a separate database per app.

## Reusing this for another game

1. Write an exporter for the new game's data source into `app/data/*.json` and images into `public/img`.
2. Swap the routes in `app/routes.ts` and `app/lib/tools.ts`, and add calculators under `app/tools/<area>`.
3. Keep `server/*`, `app/lib/store.ts`, `app/lib/sync.ts`, the auth pages and the account page as they are. Tools only call `useToolState("<tool-id>", initial)`.

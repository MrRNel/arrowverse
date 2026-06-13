# Arrowverse Tracker

A monorepo for tracking your **Arrowverse** watch progress across the full crossover timeline — web app, API, and browser extension working together on one watch order.

> **Episode list & structure:** The canonical watch order (~830 episodes across 11 series) comes from [**ordered-arrowverse**](https://github.com/AceFire6/ordered-arrowverse) by [AceFire6](https://github.com/AceFire6). This project uses that ordering and field structure (`row_number`, `series`, `episode_id`, `episode_name`, `air_date`) in `public/assets/data/watch-order.json`. Arrowverse Tracker adds accounts, progress sync, gamification, and Netflix/Jellyfin detection on top of that data — it does not replace or re-curate the list. Please star and contribute upstream if you find gaps in the episode order.

## What's in the repo

| Part | Path | Role |
|------|------|------|
| **Web app** | `src/` | Angular 22 SPA — watch order, series browser, timeline, login, XP/ranks |
| **API** | `backend/` | FastAPI + MySQL — auth (PKCE + refresh tokens), progress, user profiles |
| **Extension** | `browser-extension/` | Chrome MV3 bridge — detects episodes on Netflix & Jellyfin, syncs progress |

Production serves the built Angular app and `/api` from **one origin** (FastAPI). Development runs Angular on `:4200` with a proxy to the API on `:8000`.

## Features

- Global **watch order** with crossover-aware sequencing
- Per-user **watched / up-next** progress stored in MySQL
- **PKCE login** for the web app; extension links via device flow
- **Chrome extension** for Netflix (DOM metadata) and Jellyfin (Sessions API)
- **Gamification** — XP, streaks, ranks, achievements
- **Docker** deploy with your own hosted database (no DB in the container)

## Episode data attribution

The watch-order dataset is derived from the community-maintained [**ordered-arrowverse**](https://github.com/AceFire6/ordered-arrowverse) project:

- **Source:** [github.com/AceFire6/ordered-arrowverse](https://github.com/AceFire6/ordered-arrowverse)
- **Purpose:** Chronological listing of Arrowverse shows for continuity and sensible crossover ordering
- **Used in this repo as:** `public/assets/data/watch-order.json` (synced to `browser-extension/data/watch-order.json` via `npm run sync:extension`)

Each episode record follows this shape:

```json
{
  "row_number": 1,
  "series": "Arrow",
  "episode_id": "S01E01",
  "episode_name": "Pilot",
  "air_date": "October 10, 2012"
}
```

If you update the list locally, prefer pulling changes from **ordered-arrowverse** first, then re-run `npm run sync:extension` so the extension stays in sync.

## Quick start

**Prerequisites:** Node.js 20+, Python 3.12+, MySQL/MariaDB (local or remote)

```bash
npm install --legacy-peer-deps
npm run setup:backend          # once — creates backend/.venv
copy backend\.env.example backend\.env   # edit DB credentials
mysql -u ... < backend/sql/schema.sql
npm start
```

- Web: [http://localhost:4200](http://localhost:4200)
- API: [http://localhost:8000](http://localhost:8000) (browser uses `/api` via dev proxy)

**Browser extension:** see [browser-extension/README.md](browser-extension/README.md)

**Production & Docker:** see [MONOREPO.md](MONOREPO.md)

## Repository layout

```
arrowverse/
├── src/                          # Angular application
├── backend/
│   ├── app/                      # FastAPI routes & services
│   ├── sql/schema.sql            # MySQL schema
│   └── .env                      # local secrets (not committed)
├── browser-extension/            # Chrome extension (load unpacked)
├── public/assets/data/
│   └── watch-order.json          # episode list (from ordered-arrowverse)
├── Dockerfile                    # app-only image, external DB
├── docker-compose.yml
├── MONOREPO.md                   # detailed dev / deploy guide
└── README.md                     # this file
```

## npm scripts

| Script | Description |
|--------|-------------|
| `npm start` | Angular + FastAPI together |
| `npm run setup:backend` | Python venv + pip install |
| `npm run build` | Production Angular build |
| `npm run start:prod` | Build SPA + run API on `:8000` |
| `npm run sync:extension` | Copy watch order + env URLs into extension |
| `npm run docker:up` | Build and run Docker container |

Full script list and auth flows: [MONOREPO.md](MONOREPO.md)

## Tech stack

- **Frontend:** Angular 22, PrimeNG, Bootstrap
- **Backend:** FastAPI, SQLAlchemy (async), aiomysql, JWT + PKCE
- **Database:** MySQL/MariaDB (you host it — local, remote, or managed)
- **Extension:** Manifest V3, content scripts for Netflix & Jellyfin

## Related links

- **Watch order data:** [AceFire6/ordered-arrowverse](https://github.com/AceFire6/ordered-arrowverse)
- **Extension setup:** [browser-extension/README.md](browser-extension/README.md)
- **Monorepo & deployment:** [MONOREPO.md](MONOREPO.md)

---

*Arrowverse™ characters and episodes are property of their respective rights holders. This is a fan tracking tool, not affiliated with DC, Warner Bros., Netflix, or Jellyfin.*

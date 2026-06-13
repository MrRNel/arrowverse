# Arrowverse monorepo

> **Episode data:** The watch order and episode structure come from [**ordered-arrowverse**](https://github.com/AceFire6/ordered-arrowverse). See [README.md](README.md#episode-data-attribution) for attribution details.

Single-origin deployment: FastAPI serves `/api/*` and the built Angular app from one URL (e.g. `http://localhost:8000`).

Uses your **existing local MySQL/MariaDB** — no Docker database required.

## Angular proxy vs production

| Mode | How `/api` works |
|------|------------------|
| **Development** | Angular at `:4200` — browser calls `/api/...`, dev server **proxies** to `http://localhost:8000` |
| **Production** | FastAPI serves SPA + `/api` on the **same origin** — no Angular proxy |

Never put `http://localhost:8000` in Angular environment files. Use relative `apiUrl: '/api'`.

## Layout

```
arrowverse/
├── backend/
│   ├── .env                  # Local MySQL connection
│   ├── sql/schema.sql        # Run this on your DB
│   └── app/                  # FastAPI
├── src/                      # Angular
└── browser-extension/
```

## Quick start

**1. Create schema on your local MySQL**

```bash
mysql -u root -p < backend/sql/schema.sql
```

Or, if you already created the `arrowverse` database/user:

```bash
mysql -u arrowverse -p arrowverse < backend/sql/schema.sql
```

Optional app user (run as MySQL root) — also documented at the top of `schema.sql`:

```sql
CREATE USER IF NOT EXISTS 'arrowverse'@'localhost' IDENTIFIED BY 'arrowverse';
GRANT ALL PRIVILEGES ON arrowverse.* TO 'arrowverse'@'localhost';
FLUSH PRIVILEGES;
```

**2. Configure backend**

Edit `backend/.env` if your MySQL user/password differ (see defaults above).

**Python backend (once):**

```powershell
npm run setup:backend
```

Requires **Python 3.12+**. If you use **Python 3.14**, the setup script installs **Pydantic 2.12+** so pip gets prebuilt wheels instead of failing on a Rust build. Recommended: Python **3.12** (see `.python-version`).

**3. Start frontend + backend**

```bash
npm install --legacy-peer-deps
npm start
```

Opening a **new terminal in Cursor/VS Code** for this repo automatically loads `backend/.env`, sets `PYTHONPATH`, and activates `backend\.venv` if present (see `.vscode/settings.json`).

- Web: `http://localhost:4200`
- API: `http://localhost:8000` (proxied as `/api` in the browser)

## Production (single URL)

```bash
npm run build
copy backend\.env.production.example backend\.env.production
# edit secrets in .env.production
npm run start:prod
```

Open `http://localhost:8000`.

## Docker (app only — external MySQL)

The container runs FastAPI + the built Angular app. **Database stays on your hosted MySQL** — nothing runs MariaDB inside Docker.

**1. Ensure schema is applied on your remote DB**

```bash
mysql -h YOUR_DB_HOST -u YOUR_USER -p YOUR_DB < backend/sql/schema.sql
```

Your MySQL host must allow connections from the Docker host / Coolify server IP.

**2. Local Docker Compose**

```bash
copy .env.docker.example .env.docker
# edit DB_*, JWT_SECRET, APP_URL, CORS_ORIGINS in .env.docker
npm run docker:up
```

Open `http://localhost:8000`.

**3. Coolify**

- **Build pack:** Dockerfile (repo root)
- **Port:** `8000`
- **Build argument:** `APP_URL=https://your-domain.com` (must match your public URL)
- **Runtime env:** `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `CORS_ORIGINS=https://your-domain.com`, `ENVIRONMENT=production`

Coolify handles HTTPS; the app listens on HTTP inside the container.

**Build manually**

```bash
docker build --build-arg APP_URL=https://your-domain.com -t arrowverse .
docker run --rm -p 8000:8000 \
  -e DB_HOST=... -e DB_NAME=... -e DB_USER=... -e DB_PASSWORD=... \
  -e JWT_SECRET=... -e CORS_ORIGINS=https://your-domain.com \
  arrowverse
```

## npm scripts

| Script | Description |
|--------|-------------|
| `npm start` | Angular + FastAPI together |
| `npm run db:schema` | Print the MySQL command to apply `backend/sql/schema.sql` |
| `npm run db:init` | Optional Python fallback — creates tables via SQLAlchemy |
| `npm run start:prod` | Build SPA + run API in production mode |
| `npm run docker:build` | Build Docker image via compose |
| `npm run docker:up` | Build and run container (uses `.env.docker`) |
| `npm run docker:down` | Stop compose stack |

## Auth

| Flow | Client | Endpoints |
|------|--------|-----------|
| PKCE login (SPA) | `arrowverse-web` | `POST /api/auth/login/pkce` → `POST /api/auth/token` |
| Refresh | web + extension | `POST /api/auth/token` (`grant_type=refresh_token`) |
| Extension link | `arrowverse-extension` | `POST /api/auth/extension/link` |

## UI

Login uses **PrimeNG** `p-floatlabel`, `pInputText`, `p-password` (with `toggleMask` + `fluid`), and `p-button`.

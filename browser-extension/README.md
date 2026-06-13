# Arrowverse Tracker Browser Extension

Chrome extension (Manifest V3) that detects Arrowverse episodes on **Netflix** or **Jellyfin** and syncs watch progress with the Angular tracker app.

## Setup

**Production URL:** set `appUrl` in `src/environments/environment.production.ts`, then follow the full checklist in [README.md — Production URL checklist](../README.md#production-url-checklist) (CORS, Docker `APP_URL`, sync, reload).

1. Set your production URL in `src/environments/environment.production.ts` (`appUrl`).
2. Sync extension data from Angular env + watch order:

   ```bash
   npm run sync:extension
   ```

3. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `browser-extension` folder.
4. Start the app (`npm start`) and open Netflix or Jellyfin in another tab.
5. In extension options, set your **Jellyfin server URL** if it is not `http://localhost:8096`. Chrome may prompt for host permission the first time you save a custom URL.

## Environment behavior

| Mode | App URL source |
|------|----------------|
| Development | `environment.development.ts` → `http://localhost:4200` |
| Production | `environment.production.ts` → your deployed URL |

The extension options page (`Extension details → Extension options`) lets you switch between development and production mode, and configure your Jellyfin server URL. After changing URLs in Angular, run `npm run sync:extension` and reload the extension.

## What it does

- **Episode start**: Chrome notification + in-app toast with series, episode code, and watch-order number.
- **Out of order warning**: if the episode is ahead of your tracker’s “up next”, the extension shows a Chrome notification and an on-page warning on the player tab.
- **Episode complete** (~92% watched or video ended): marks the episode watched in the tracker, awards XP, and queues sync if the app tab is closed.
- **Pending sync**: when you open the tracker later, queued completions are applied automatically.

## Netflix vs Jellyfin

| | Netflix | Jellyfin |
|---|---------|----------|
| Metadata | Scrapes player DOM labels | Reads `/Sessions` API (`SeriesName`, season/episode numbers) |
| Auth | None | Uses your existing Jellyfin web login token |
| Watch page | URL contains `/watch/` | Video route or active Jellyfin session |

## Troubleshooting

1. **Reload the extension** at `chrome://extensions` after pulling updates.
2. **Refresh the player tab (F5)** — content scripts attach on page load. Or click **Connect to player tab** in the extension popup.
3. **Netflix**: the player label **"The Flash E1 Pilot"** in the bottom controls is what we read — hover the player once so it is visible.
4. **Jellyfin**: make sure you are logged in on the Jellyfin tab and playback has started. Set the correct server URL in extension options.
5. Click the extension icon — the popup shows live status for whichever provider tab is active.
6. Keep the tracker tab open at `http://localhost:4200` (or your prod URL) for live sync.
7. Run `npm run sync:extension` if watch-order data changed.

## Files

- `content-netflix.js` — monitors Netflix playback via DOM metadata
- `content-jellyfin.js` — monitors Jellyfin playback via Sessions API
- `lib/jellyfin-client.js` — Jellyfin auth + session helpers
- `lib/content-shared.js` — shared monitor runtime, overlays, app relay helpers
- `content-app-bridge.js` — relays messages to the Angular app via `window.postMessage`
- `background.js` — notifications, episode matching, app relay
- `data/watch-order.json` — copied from `public/assets/data/watch-order.json` by sync script

import { EXTENSION_CONFIG, getAppUrl, isAppUrl } from './lib/config.js';
import { getJellyfinMatchPatterns, getJellyfinOrigin } from './lib/jellyfin-url.js';
import { markEpisodeOnApi, saveAuthState } from './lib/api-client.js';
import { EpisodeMatcher } from './lib/episode-matcher.js';

const matcherUrl = chrome.runtime.getURL('data/watch-order.json');
const JELLYFIN_SCRIPT_ID = 'arrowverse-jellyfin';
let matcher = null;
let config = { ...EXTENSION_CONFIG };

async function ensureMatcher() {
  if (!matcher) {
    try {
      matcher = await EpisodeMatcher.load(matcherUrl);
    } catch (error) {
      throw new Error(`Could not load watch-order data: ${String(error)}`);
    }
  }
  return matcher;
}

async function loadConfig() {
  const stored = await chrome.storage.sync.get([
    'mode',
    'developmentAppUrl',
    'productionAppUrl',
    'jellyfinServerUrl',
  ]);
  config = {
    ...EXTENSION_CONFIG,
    ...stored,
  };
  return config;
}

async function relayToApp(message) {
  const activeConfig = await loadConfig();
  const appUrl = getAppUrl(activeConfig);
  const tabs = await chrome.tabs.query({ url: `${appUrl}/*` });

  if (!tabs.length) {
    const pending = (await chrome.storage.local.get('pendingEvents')).pendingEvents ?? [];
    pending.push({ ...message, createdAt: Date.now() });
    await chrome.storage.local.set({ pendingEvents: pending.slice(-25) });
    return { delivered: false, queued: true };
  }

  for (const tab of tabs) {
    if (!tab.id) {
      continue;
    }

    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-app-bridge.js'],
      });
      await chrome.tabs.sendMessage(tab.id, message);
    }
  }

  return { delivered: true, queued: false };
}

async function showNotification(title, message, priority = 2) {
  try {
    await chrome.notifications.create(`arrowverse-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
      priority,
    });
  } catch (error) {
    console.warn('[Arrowverse] notification failed:', error);
  }
}

function buildLocalSyncWarning(episode, syncState) {
  if (!syncState?.upNext || !syncState.watchedRows) {
    return null;
  }

  if (syncState.watchedRows.includes(episode.row_number)) {
    return null;
  }

  if (episode.row_number <= syncState.upNext.row_number) {
    return null;
  }

  return {
    playing: episode,
    upNext: syncState.upNext,
    skippedCount: episode.row_number - syncState.upNext.row_number,
  };
}

async function getPlayerTabPatterns() {
  const activeConfig = await loadConfig();
  const patterns = ['https://www.netflix.com/*', ...getJellyfinMatchPatterns(activeConfig)];

  return patterns;
}

async function getPlayerTabs() {
  const patterns = await getPlayerTabPatterns();
  const tabs = [];

  for (const pattern of patterns) {
    const matched = await chrome.tabs.query({ url: pattern });
    tabs.push(...matched);
  }

  return tabs;
}

async function showOutOfSyncWarning(warning) {
  const { playing, upNext } = warning;
  const playingLabel = `#${playing.row_number} ${playing.series} · ${playing.episode_name}`;
  const upNextLabel = `#${upNext.row_number} ${upNext.series} · ${upNext.episode_name}`;

  await showNotification(
    'Out of Watch Order',
    `You're watching ${playingLabel}. Up next is ${upNextLabel}.`,
    2,
  );

  const tabs = await getPlayerTabs();
  for (const tab of tabs) {
    if (!tab.id) {
      continue;
    }

    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'OUT_OF_SYNC_WARNING',
        playing,
        upNext,
        skippedCount: warning.skippedCount,
      });
    } catch {
      // Player monitor may not be attached yet.
    }
  }
}

async function ensureJellyfinPermission(origin) {
  if (!origin) {
    return false;
  }

  const pattern = `${origin}/*`;
  const hasPermission = await chrome.permissions.contains({ origins: [pattern] });
  if (hasPermission) {
    return true;
  }

  try {
    return await chrome.permissions.request({ origins: [pattern] });
  } catch {
    return false;
  }
}

async function registerJellyfinContentScript() {
  const activeConfig = await loadConfig();
  const patterns = getJellyfinMatchPatterns(activeConfig);
  if (!patterns.length) {
    return;
  }

  for (const pattern of patterns) {
    const allowed = await ensureJellyfinPermission(pattern.replace(/\/\*$/, ''));
    if (!allowed) {
      console.warn('[Arrowverse] Jellyfin host permission not granted for', pattern);
      return;
    }
  }

  try {
    await chrome.scripting.unregisterContentScripts({ ids: [JELLYFIN_SCRIPT_ID] });
  } catch {
    // First registration.
  }

  await chrome.scripting.registerContentScripts([
    {
      id: JELLYFIN_SCRIPT_ID,
      matches: patterns,
      js: ['lib/content-shared.js', 'lib/jellyfin-client.js', 'content-jellyfin.js'],
      runAt: 'document_idle',
    },
  ]);
}

async function injectPlayerMonitor(tabId, provider) {
  const files =
    provider === 'jellyfin'
      ? ['lib/content-shared.js', 'lib/jellyfin-client.js', 'content-jellyfin.js']
      : ['lib/content-shared.js', 'content-netflix.js'];

  await chrome.scripting.executeScript({
    target: { tabId },
    files,
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await loadConfig();
  await ensureMatcher();
  await registerJellyfinContentScript();
});

chrome.runtime.onStartup.addListener(async () => {
  await loadConfig();
  await ensureMatcher();
  await registerJellyfinContentScript();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    void loadConfig().then(() => registerJellyfinContentScript());
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('[Arrowverse] message handler failed:', error);
      sendResponse({ ok: false, error: String(error) });
    });
  return true;
});

async function handleMessage(message, sender) {
  await loadConfig();

  if (message.type === 'APP_RESPONSE') {
    const data = message.data;
    if (data?.type === 'AUTH_STATE') {
      await saveAuthState(
        data.refreshToken || data.accessToken
          ? {
              accessToken: data.accessToken ?? null,
              refreshToken: data.refreshToken ?? null,
              expiresAt: data.expiresAt ?? null,
              user: data.user ?? null,
            }
          : null,
      );
      return { ok: true };
    }

    if (data?.type === 'SYNC_STATE') {
      await chrome.storage.local.set({ syncState: data });
      return { ok: true };
    }

    if (data?.type === 'SYNC_WARNING') {
      await showOutOfSyncWarning(data);
      return { ok: true };
    }

    return { ok: true };
  }

  if (message.type === 'GET_CONFIG') {
    return { config };
  }

  if (message.type === 'PLAYER_ENSURE_MONITOR' && sender.tab?.id) {
    try {
      await injectPlayerMonitor(sender.tab.id, message.provider ?? 'netflix');
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  if (message.type === 'NETFLIX_ENSURE_MONITOR' && sender.tab?.id) {
    try {
      await injectPlayerMonitor(sender.tab.id, 'netflix');
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  if (
    (message.type === 'PLAYER_METADATA' || message.type === 'NETFLIX_METADATA') &&
    message.metadata
  ) {
    try {
      const episodeMatcher = await ensureMatcher();
      const match = episodeMatcher.match(message.metadata);
      return { match: match ?? null };
    } catch (error) {
      return { match: null, error: String(error) };
    }
  }

  if (message.type === 'EPISODE_STARTED' && message.payload) {
    const episode = message.payload;
    const relayResult = await relayToApp({
      source: 'arrowverse-extension',
      type: 'EPISODE_STARTED',
      payload: episode,
    });

    if (!relayResult.delivered) {
      const { syncState } = await chrome.storage.local.get('syncState');
      const warning = buildLocalSyncWarning(episode, syncState);
      if (warning) {
        await showOutOfSyncWarning(warning);
      }
    }

    await showNotification(
      'Arrowverse Detected',
      `#${episode.row_number} ${episode.series} — ${episode.episode_name}`,
    );
    return relayResult;
  }

  if (message.type === 'EPISODE_COMPLETED' && message.payload) {
    const episode = message.payload;
    await showNotification(
      'Episode Complete',
      `Logged ${episode.series} · ${episode.episode_name}`,
    );

    const relayResult = await relayToApp({
      source: 'arrowverse-extension',
      type: 'EPISODE_COMPLETED',
      payload: episode,
    });

    if (!relayResult.delivered) {
      const activeConfig = await loadConfig();
      const apiResult = await markEpisodeOnApi(activeConfig, episode);
      if (!apiResult.ok && apiResult.reason === 'not-authenticated') {
        await showNotification(
          'Sign in required',
          'Open the Arrowverse tracker and sign in to sync extension progress.',
        );
      }
    }

    return relayResult;
  }

  if (message.type === 'APP_READY' && sender.tab?.id) {
    const pending = (await chrome.storage.local.get('pendingEvents')).pendingEvents ?? [];
    if (!pending.length) {
      return { synced: 0 };
    }

    await chrome.tabs.sendMessage(sender.tab.id, {
      source: 'arrowverse-extension',
      type: 'SYNC_PENDING',
      pending: pending.map((item) => item.payload).filter(Boolean),
    });

    await chrome.storage.local.set({ pendingEvents: [] });
    return { synced: pending.length };
  }

  if (message.type === 'SAVE_CONFIG') {
    await chrome.storage.sync.set(message.config);
    config = { ...config, ...message.config };
    await registerJellyfinContentScript();
    return { ok: true };
  }

  return { ok: true };
}

export { config, isAppUrl };

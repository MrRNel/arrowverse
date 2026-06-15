import { isJellyfinTabUrl } from './lib/jellyfin-url.js';
import { getJellyfinPermissionStatus, requestJellyfinPermissions } from './lib/jellyfin-permissions.js';
import { EXTENSION_CONFIG } from './lib/config.js';

function trackerAppUrls(config) {
  return [config.productionAppUrl, config.developmentAppUrl].filter(Boolean);
}

async function findOpenTrackerTab() {
  for (const appUrl of trackerAppUrls(EXTENSION_CONFIG)) {
    const tabs = await chrome.tabs.query({ url: `${appUrl.replace(/\/$/, '')}/*` });
    if (tabs.length) {
      return { tabs, appUrl };
    }
  }

  return { tabs: [], appUrl: null };
}

const status = document.querySelector('#status');
const trackerStatus = document.querySelector('#tracker-status');
const injectButton = document.querySelector('#inject');
const providerLabel = document.querySelector('#provider-label');

const MESSAGE_TIMEOUT_MS = 5000;
const TAB_MESSAGE_TIMEOUT_MS = 4000;

let refreshInFlight = null;

function withTimeout(promise, timeoutMs, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      window.setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}

async function sendRuntimeMessage(message) {
  try {
    const response = await withTimeout(
      chrome.runtime.sendMessage(message),
      MESSAGE_TIMEOUT_MS,
      { error: 'Extension background did not respond. Reload the extension at chrome://extensions.' },
    );
    return response ?? {};
  } catch (error) {
    return { error: String(error) };
  }
}

async function sendTabMessage(tabId, message) {
  try {
    const response = await withTimeout(
      chrome.tabs.sendMessage(tabId, message),
      TAB_MESSAGE_TIMEOUT_MS,
      { timedOut: true },
    );
    return response ?? null;
  } catch (error) {
    return { error: String(error) };
  }
}

function detectProvider(url, config) {
  if (url?.includes('netflix.com')) {
    return 'netflix';
  }

  if (isJellyfinTabUrl(url, config)) {
    return 'jellyfin';
  }

  return null;
}

function providerName(provider) {
  return provider === 'jellyfin' ? 'Jellyfin' : 'Netflix';
}

async function getTrackerStatus(config) {
  const authState = (await chrome.storage.local.get('authState')).authState;
  const { tabs, appUrl } = await findOpenTrackerTab();

  if (!tabs.length || !appUrl) {
    const preferred = config.productionAppUrl ?? EXTENSION_CONFIG.productionAppUrl;
    return {
      state: 'warn',
      text: `Tracker tab not open.\nOpen ${preferred} and sign in.`,
    };
  }

  if (!authState?.refreshToken && !authState?.accessToken) {
    return {
      state: 'warn',
      text: `Tracker tab is open, but extension is not signed in.\nSign in at ${appUrl} with this extension enabled.`,
    };
  }

  const hosts = config.jellyfinHosts?.length
    ? config.jellyfinHosts.join(', ')
    : 'not synced yet';

  return {
    state: 'ok',
    text: `Tracker linked${authState.user?.username ? ` as ${authState.user.username}` : ''}.\nJellyfin hosts: ${hosts}`,
  };
}

function statusState(data, provider) {
  if (!data) {
    return 'info';
  }
  if (data.phase === 'needs-permission') {
    return 'warning';
  }
  if (data.error || data.phase === 'error' || data.timedOut) {
    return 'error';
  }
  if (data.phase === 'matched') {
    return 'success';
  }
  if (data.phase === 'waiting-for-auth' || data.phase === 'no-match' || data.phase === 'not-watch-page') {
    return 'warning';
  }
  if (data.phase === 'not-injected' && !provider) {
    return 'warning';
  }
  return 'info';
}

function setProviderBadge(label, provider, state = 'info') {
  providerLabel.textContent = label;
  providerLabel.dataset.provider = provider ?? '';
  providerLabel.dataset.state = state === 'error' ? 'unavailable' : '';
}

function formatDebug(debug, liveStatus, provider) {
  const data = liveStatus ?? debug;
  const label = providerName(provider ?? data?.provider ?? 'netflix');

  if (!data) {
    return `Open a ${label} watch page and play an Arrowverse episode.`;
  }

  if (data.error) {
    return `${data.error}\n\nReload the extension at chrome://extensions, then refresh ${label} (F5).`;
  }

  if (data.timedOut) {
    return `Timed out talking to ${label}. Refresh the ${label} tab (F5), then try Connect again.`;
  }

  if (data.phase === 'needs-permission') {
    return data.message;
  }

  if (data.phase === 'not-injected') {
    return `${data.message}\n\nClick "Connect to player tab" below, or refresh the ${label} page (F5).`;
  }

  if (data.phase === 'not-watch-page') {
    return `${label} is open, but not on a watch page. Start playing an episode first.`;
  }

  if (data.phase === 'waiting-for-auth') {
    return data.hint ?? `Log in to ${label}, then start playing an episode.`;
  }

  if (data.phase === 'matched' && data.episode) {
    return `Matched #${data.episode.row_number} ${data.episode.series} · ${data.episode.episode_id} · ${data.episode.episode_name}`;
  }

  if (data.phase === 'no-match') {
    const series = data.metadata?.seriesTitle || 'unknown series';
    const episode = data.metadata?.episodeTitle || 'unknown episode';
    return `Detected ${label} playback but no Arrowverse match.\nSeen: ${series} — ${episode}`;
  }

  if (data.phase === 'waiting-for-metadata') {
    return (
      data.hint ??
      (provider === 'netflix'
        ? 'Waiting for Netflix to show the episode label in the player controls.'
        : 'Waiting for Jellyfin to report episode metadata.')
    );
  }

  if (data.phase === 'waiting-for-playback') {
    return data.hint ?? 'Monitor connected. Press play on the episode.';
  }

  if (data.phase === 'script-loaded' || data.phase === 'already-running') {
    return data.hint ?? `Monitor connected to ${label}. Play an Arrowverse episode.`;
  }

  if (data.phase === 'context-invalidated') {
    return `${data.message}\n\nRefresh the ${label} page (F5) after reloading the extension.`;
  }

  if (data.phase === 'error') {
    return `${data.message}\n\nTry: reload the extension, then refresh ${label} (F5).`;
  }

  return JSON.stringify(data, null, 2);
}

async function loadRuntimeConfig() {
  const syncResult = await sendRuntimeMessage({ type: 'SYNC_PROFILE' });
  const response = await sendRuntimeMessage({ type: 'GET_CONFIG' });
  if (response.error) {
    throw new Error(response.error);
  }

  return {
    config: response.config ?? {},
    profileSync: syncResult,
  };
}

async function getActivePlayerTab(config) {
  const windowTabs = await chrome.tabs.query({ currentWindow: true });
  const activeTab = windowTabs.find((tab) => tab.active) ?? windowTabs[0];

  for (const tab of [activeTab, ...windowTabs.filter((tab) => tab.id !== activeTab?.id)]) {
    const provider = detectProvider(tab?.url, config);
    if (provider) {
      return { tab, provider };
    }
  }

  return { tab: activeTab, provider: null };
}

async function ensureMonitor(tab, provider, config, permissionStatus) {
  if (!tab?.id || !provider) {
    return {
      phase: 'not-injected',
      message: 'Switch to your Netflix or Jellyfin tab and start playing an episode.',
    };
  }

  const label = providerName(provider);
  const isWatchPage =
    provider === 'netflix' ? tab.url.includes('/watch/') : isJellyfinTabUrl(tab.url, config);

  if (provider === 'jellyfin' && !permissionStatus?.ok) {
    return {
      phase: 'needs-permission',
      message: `Chrome blocked Jellyfin access.\n\nClick Connect again and choose Allow when Chrome asks to access:\n${permissionStatus?.missing?.[0] ?? 'your Jellyfin server'}`,
      provider,
    };
  }

  const existingStatus = await sendTabMessage(tab.id, { type: 'GET_STATUS' });
  if (existingStatus && !existingStatus.error && !existingStatus.timedOut) {
    return existingStatus;
  }

  if (provider === 'netflix' && !isWatchPage) {
    return {
      phase: 'not-watch-page',
      href: tab.url,
      provider,
    };
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files:
        provider === 'jellyfin'
          ? ['lib/content-shared.js', 'lib/uuid.js', 'lib/jellyfin-client.js', 'content-jellyfin.js']
          : ['lib/content-shared.js', 'content-netflix.js'],
    });
  } catch (error) {
    if (provider === 'jellyfin') {
      return {
        phase: 'needs-permission',
        message: `Could not inject into Jellyfin: ${String(error)}\n\nClick Connect again and allow site access when prompted.`,
        provider,
      };
    }

    return {
      phase: 'error',
      message: `Could not inject into ${label}: ${String(error)}`,
      provider,
    };
  }

  await new Promise((resolve) => setTimeout(resolve, 400));

  await sendTabMessage(tab.id, { type: 'RESET_EXTENSION_CONTEXT' });

  const liveStatus = await sendTabMessage(tab.id, { type: 'GET_STATUS' });
  if (liveStatus?.error) {
    return {
      phase: 'error',
      message: `Could not connect to ${label}: ${liveStatus.error}`,
      provider,
    };
  }

  if (liveStatus?.timedOut) {
    return {
      phase: 'error',
      message: `Connected to ${label}, but the monitor did not respond. Refresh the tab (F5) and try again.`,
      provider,
    };
  }

  return (
    liveStatus ?? {
      phase: 'script-loaded',
      hint: `Monitor injected on ${label}. Play an Arrowverse episode.`,
      provider,
    }
  );
}

async function renderPopupState({ requestPermissions = false } = {}) {
  const { config, profileSync } = await loadRuntimeConfig();
  const { tab, provider } = await getActivePlayerTab(config);
  const tracker = await getTrackerStatus(config);

  let jellyfinPermissions = null;
  if (provider === 'jellyfin') {
    jellyfinPermissions = requestPermissions
      ? await requestJellyfinPermissions(config, tab?.url ?? null)
      : await getJellyfinPermissionStatus(config, tab?.url ?? null);
  }

  trackerStatus.textContent =
    !profileSync?.ok && profileSync?.reason === 'not-authenticated'
      ? 'Profile not synced — open the tracker, sign in, and refresh that tab (F5).'
      : tracker.text;
  trackerStatus.dataset.state =
    !profileSync?.ok && profileSync?.reason === 'not-authenticated' ? 'warn' : tracker.state;

  let liveStatus = null;
  if (provider) {
    setProviderBadge(providerName(provider), provider);
    injectButton.textContent = `Connect to ${providerName(provider)} tab`;
    liveStatus = await ensureMonitor(tab, provider, config, jellyfinPermissions);
  } else {
    setProviderBadge('Netflix or Jellyfin', null, 'warning');
    injectButton.textContent = 'Connect to player tab';
    liveStatus = {
      phase: 'not-injected',
      message:
        'Switch to a Netflix or Jellyfin tab first.\nThe popup checks tabs in the current window.',
    };
  }

  const debugKey = provider === 'jellyfin' ? 'jellyfinDebug' : 'netflixDebug';
  const stored = (await chrome.storage.local.get(debugKey))[debugKey];
  status.textContent = formatDebug(stored, liveStatus, provider);
  status.dataset.state = statusState(liveStatus ?? stored, provider);
}

async function refresh() {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = renderPopupState({ requestPermissions: false });

  try {
    await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function connectToPlayer() {
  injectButton.disabled = true;
  const originalText = injectButton.textContent;
  injectButton.textContent = 'Connecting…';
  status.textContent = 'Requesting Jellyfin site access…';
  status.dataset.state = 'info';

  try {
    const windowTabs = await chrome.tabs.query({ currentWindow: true });
    const activeTab = windowTabs.find((tab) => tab.active) ?? windowTabs[0];

    if (activeTab?.url) {
      try {
        const pattern = `${new URL(activeTab.url).origin}/*`;
        const allowed = await chrome.permissions.contains({ origins: [pattern] });
        if (!allowed) {
          status.textContent = `Allow Chrome to access:\n${pattern}`;
          const granted = await chrome.permissions.request({ origins: [pattern] });
          if (!granted) {
            await chrome.permissions.request({ origins: ['http://*/*'] });
          }
        }
      } catch (error) {
        console.warn('[Arrowverse] permission request failed:', error);
      }
    }

    void sendRuntimeMessage({ type: 'JELLYFIN_PERMISSIONS_GRANTED' });
    await renderPopupState({ requestPermissions: true });
  } catch (error) {
    setProviderBadge('Unavailable', null, 'error');
    status.textContent = `${String(error)}\n\nReload the extension at chrome://extensions, then try again.`;
    status.dataset.state = 'error';
  } finally {
    injectButton.disabled = false;
    injectButton.textContent = originalText;
  }
}

injectButton.addEventListener('click', () => {
  void connectToPlayer();
});

document.querySelector('#open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

void refresh();
window.setInterval(() => {
  if (!refreshInFlight && !injectButton.disabled) {
    void refresh();
  }
}, 3000);

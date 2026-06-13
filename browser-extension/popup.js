import { isJellyfinTabUrl } from './lib/jellyfin-url.js';

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
  const appUrl = config.mode === 'production' ? config.productionAppUrl : config.developmentAppUrl;
  const tabs = await chrome.tabs.query({ url: `${appUrl.replace(/\/$/, '')}/*` });

  if (!tabs.length) {
    return {
      state: 'warn',
      text: `Tracker tab not open.\nOpen ${appUrl} and sign in.`,
    };
  }

  if (!authState?.refreshToken && !authState?.accessToken) {
    return {
      state: 'warn',
      text: `Tracker tab is open, but extension is not signed in.\nSign in at ${appUrl} with this extension enabled.`,
    };
  }

  return {
    state: 'ok',
    text: `Tracker linked${authState.user?.username ? ` as ${authState.user.username}` : ''}.`,
  };
}

function statusState(data, provider) {
  if (!data) {
    return 'info';
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

async function getConfig() {
  const response = await sendRuntimeMessage({ type: 'GET_CONFIG' });
  if (response.error) {
    throw new Error(response.error);
  }
  return response.config ?? {};
}

async function getActivePlayerTab(config) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const provider = detectProvider(tab?.url, config);

  return { tab, provider };
}

async function ensureMonitor(tab, provider, config) {
  if (!tab?.id || !provider) {
    return {
      phase: 'not-injected',
      message: 'Switch to your Netflix or Jellyfin tab and start playing an episode.',
    };
  }

  const label = providerName(provider);
  const isWatchPage =
    provider === 'netflix' ? tab.url.includes('/watch/') : isJellyfinTabUrl(tab.url, config);

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
          ? ['lib/content-shared.js', 'lib/jellyfin-client.js', 'content-jellyfin.js']
          : ['lib/content-shared.js', 'content-netflix.js'],
    });
  } catch (error) {
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

async function refresh() {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const config = await getConfig();
      const { tab, provider } = await getActivePlayerTab(config);
      const tracker = await getTrackerStatus(config);
      let liveStatus = null;

      if (provider) {
        setProviderBadge(providerName(provider), provider);
        injectButton.textContent = `Connect to ${providerName(provider)} tab`;
        liveStatus = await ensureMonitor(tab, provider, config);
      } else {
        setProviderBadge('Netflix or Jellyfin', null, 'warning');
        injectButton.textContent = 'Connect to player tab';
        liveStatus = {
          phase: 'not-injected',
          message:
            'Switch to a Netflix or Jellyfin tab first.\nThe popup checks the currently active browser tab.',
        };
      }

      const debugKey = provider === 'jellyfin' ? 'jellyfinDebug' : 'netflixDebug';
      const stored = (await chrome.storage.local.get(debugKey))[debugKey];
      const playerText = formatDebug(stored, liveStatus, provider);

      status.textContent = playerText;
      status.dataset.state = statusState(liveStatus ?? stored, provider);

      trackerStatus.textContent = tracker.text;
      trackerStatus.dataset.state = tracker.state;
    } catch (error) {
      setProviderBadge('Unavailable', null, 'error');
      status.textContent = `${String(error)}\n\nReload the extension at chrome://extensions, then try again.`;
      status.dataset.state = 'error';
      trackerStatus.textContent = 'Tracker link unknown until the extension background is running.';
      trackerStatus.dataset.state = 'warn';
    }
  })();

  try {
    await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

injectButton.addEventListener('click', async () => {
  injectButton.disabled = true;
  const originalText = injectButton.textContent;
  injectButton.textContent = 'Connecting…';

  try {
    await refresh();
  } finally {
    injectButton.disabled = false;
    injectButton.textContent = originalText;
  }
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

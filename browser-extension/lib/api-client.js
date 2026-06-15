import { EXTENSION_CONFIG, getApiUrl, getAppUrl, isAppUrl } from './config.js';

const AUTH_STORAGE_KEY = 'authState';

export async function loadAuthState() {
  const stored = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  return stored[AUTH_STORAGE_KEY] ?? null;
}

export async function saveAuthState(state) {
  if (!state) {
    await chrome.storage.local.remove(AUTH_STORAGE_KEY);
    return;
  }

  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: state });
}

export async function refreshAccessToken(config, authState) {
  if (!authState?.refreshToken) {
    return null;
  }

  const response = await fetch(`${getApiUrl(config)}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: config.extensionClientId ?? 'arrowverse-extension',
      refresh_token: authState.refreshToken,
    }),
  });

  if (!response.ok) {
    await saveAuthState(null);
    return null;
  }

  const payload = await response.json();
  const nextState = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? authState.refreshToken,
    expiresAt: Date.now() + payload.expires_in * 1000,
    user: payload.user ?? authState.user ?? null,
  };
  await saveAuthState(nextState);
  return nextState;
}

export async function ensureAccessToken(config) {
  const authState = await loadAuthState();
  if (!authState?.refreshToken && !authState?.accessToken) {
    return null;
  }

  if (authState.accessToken && authState.expiresAt && authState.expiresAt > Date.now() + 30_000) {
    return authState.accessToken;
  }

  const refreshed = await refreshAccessToken(config, authState);
  return refreshed?.accessToken ?? null;
}

export async function setEpisodeStatusOnApi(config, episode, status) {
  const accessToken = await ensureAccessToken(config);
  if (!accessToken) {
    return { ok: false, reason: 'not-authenticated' };
  }

  const response = await fetch(`${getApiUrl(config)}/progress/${episode.row_number}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      status,
      source: episode.provider ?? 'extension',
      play_item_id: episode.play_item_id ?? null,
    }),
  });

  if (response.status === 401) {
    await saveAuthState(null);
    return { ok: false, reason: 'unauthorized' };
  }

  return { ok: response.ok, reason: response.ok ? null : `status-${response.status}` };
}

export async function markEpisodeOnApi(config, episode) {
  return setEpisodeStatusOnApi(config, episode, 'watched');
}

export async function fetchUserSettings(config) {
  const accessToken = await ensureAccessToken(config);
  if (!accessToken) {
    return { ok: false, reason: 'not-authenticated' };
  }

  const response = await fetch(`${getApiUrl(config)}/users/me/settings`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 401) {
    await saveAuthState(null);
    return { ok: false, reason: 'unauthorized' };
  }

  if (!response.ok) {
    return { ok: false, reason: `status-${response.status}` };
  }

  const settings = await response.json();
  return { ok: true, settings };
}

export { getAppUrl, isAppUrl };

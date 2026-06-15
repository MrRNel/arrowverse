import { DEFAULT_JELLYFIN_HOSTS } from './jellyfin-url.js';

const LOCAL_JELLYFIN_HOSTNAMES = new Set(['localhost', '127.0.0.1', 'jellyfin']);

export function jellyfinOriginFromProfileUrl(jellyfinUrl) {
  if (!jellyfinUrl || typeof jellyfinUrl !== 'string') {
    return null;
  }

  try {
    return new URL(jellyfinUrl.trim()).origin;
  } catch {
    return null;
  }
}

export function isLocalJellyfinOrigin(origin) {
  if (!origin || typeof origin !== 'string') {
    return false;
  }

  try {
    return LOCAL_JELLYFIN_HOSTNAMES.has(new URL(origin).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function normalizeProfileSettings(data) {
  const hosts = Array.isArray(data?.jellyfin_hosts)
    ? data.jellyfin_hosts.filter((entry) => typeof entry === 'string')
    : [];

  const jellyfinUrl = typeof data?.jellyfin_url === 'string' ? data.jellyfin_url.trim() : null;

  if (!hosts.length && !jellyfinUrl) {
    return null;
  }

  return {
    jellyfin_hosts: hosts,
    jellyfin_url: jellyfinUrl,
    syncedAt: Date.now(),
  };
}

export function applyProfileToConfig(config, profile) {
  const next = { ...config };

  if (profile?.jellyfin_hosts?.length) {
    next.jellyfinHosts = profile.jellyfin_hosts;
  }

  const profileOrigin = jellyfinOriginFromProfileUrl(profile?.jellyfin_url);
  if (profileOrigin) {
    next.jellyfinServerUrl = profileOrigin;
    return next;
  }

  if (next.mode === 'production' && isLocalJellyfinOrigin(next.jellyfinServerUrl)) {
    delete next.jellyfinServerUrl;
  }

  if (!next.jellyfinHosts?.length) {
    next.jellyfinHosts = [...DEFAULT_JELLYFIN_HOSTS];
  }

  return next;
}

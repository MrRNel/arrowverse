import { getJellyfinMatchPatterns } from './jellyfin-url.js';

export async function getJellyfinPermissionStatus(config, tabUrl = null) {
  const patterns = getJellyfinMatchPatterns(config, { tabUrl });

  if (await chrome.permissions.contains({ origins: ['http://*/*'] })) {
    return { ok: true, patterns, missing: [], granted: patterns };
  }

  const missing = [];
  for (const pattern of patterns) {
    if (!(await chrome.permissions.contains({ origins: [pattern] }))) {
      missing.push(pattern);
    }
  }

  return {
    ok: missing.length === 0,
    patterns,
    missing,
    granted: patterns.filter((pattern) => !missing.includes(pattern)),
  };
}

async function requestOrigins(origins) {
  if (!origins.length) {
    return false;
  }

  try {
    return await chrome.permissions.request({ origins });
  } catch {
    return false;
  }
}

export function jellyfinPatternForTab(tabUrl) {
  if (!tabUrl) {
    return null;
  }

  try {
    return `${new URL(tabUrl).origin}/*`;
  } catch {
    return null;
  }
}

/** Must be called from the popup during a user click — not from the service worker. */
export async function requestJellyfinPermissions(config, tabUrl = null) {
  const status = await getJellyfinPermissionStatus(config, tabUrl);
  if (status.ok) {
    return status;
  }

  const tabPattern = jellyfinPatternForTab(tabUrl);
  if (tabPattern && status.missing.includes(tabPattern)) {
    if (await requestOrigins([tabPattern])) {
      return getJellyfinPermissionStatus(config, tabUrl);
    }
  }

  if (await requestOrigins(status.missing)) {
    return getJellyfinPermissionStatus(config, tabUrl);
  }

  if (await requestOrigins(['http://*/*'])) {
    return getJellyfinPermissionStatus(config, tabUrl);
  }

  return getJellyfinPermissionStatus(config, tabUrl);
}

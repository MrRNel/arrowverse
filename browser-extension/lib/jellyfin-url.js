export const DEFAULT_JELLYFIN_HOSTS = ['localhost', '127.0.0.1', 'jellyfin'];

function normalizeHost(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const host = new URL(trimmed).hostname;
      return host ? host.toLowerCase() : null;
    } catch {
      return null;
    }
  }

  return trimmed.replace(/^\[|\]$/g, '').toLowerCase();
}

export function getJellyfinHosts(config) {
  const configuredHosts = (config?.jellyfinHosts ?? [])
    .map((entry) => normalizeHost(entry))
    .filter(Boolean);
  const hosts = new Set(configuredHosts.length ? configuredHosts : DEFAULT_JELLYFIN_HOSTS);

  const configured = config?.jellyfinServerUrl?.trim();
  if (configured) {
    try {
      const host = new URL(configured).hostname;
      if (host) {
        hosts.add(host.toLowerCase());
      }
    } catch {
      // Ignore invalid configured URL.
    }
  }

  return [...hosts];
}

export function getJellyfinPort(config) {
  const configured = config?.jellyfinServerUrl?.trim();
  if (!configured) {
    return '8096';
  }

  try {
    return new URL(configured).port || '8096';
  } catch {
    return '8096';
  }
}

function tabPort(url) {
  if (url.port) {
    return url.port;
  }

  return url.protocol === 'https:' ? '443' : '80';
}

export function tabMatchesJellyfinHost(url, config) {
  if (!url) {
    return false;
  }

  try {
    const tab = new URL(url);
    const hosts = getJellyfinHosts(config);
    const expectedPort = getJellyfinPort(config);

    if (!hosts.includes(tab.hostname.toLowerCase())) {
      return getJellyfinMatchOrigins(config).includes(tab.origin);
    }

    return tabPort(tab) === expectedPort;
  } catch {
    return false;
  }
}

export function getJellyfinMatchOrigins(config) {
  const port = getJellyfinPort(config);
  const origins = new Set();

  for (const host of getJellyfinHosts(config)) {
    origins.add(`http://${host}:${port}`);
    origins.add(`https://${host}:${port}`);
  }

  const configured = config?.jellyfinServerUrl?.trim();
  if (configured) {
    try {
      origins.add(new URL(configured).origin);
    } catch {
      // Ignore invalid configured URL.
    }
  }

  return [...origins];
}

export function getJellyfinMatchPatterns(config) {
  return getJellyfinMatchOrigins(config).map((origin) => `${origin}/*`);
}

export function getJellyfinOrigin(config) {
  const configured = config?.jellyfinServerUrl?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall through to default local origin.
    }
  }

  return `http://localhost:${getJellyfinPort(config)}`;
}

export function isJellyfinTabUrl(url, config) {
  if (!url) {
    return false;
  }

  try {
    const tab = new URL(url);
    if (!tabMatchesJellyfinHost(url, config)) {
      return false;
    }

    return (
      tab.pathname.startsWith('/web') ||
      tab.hash.includes('/web') ||
      /\/video/i.test(`${tab.pathname}${tab.hash}`)
    );
  } catch {
    return false;
  }
}

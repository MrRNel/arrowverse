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
    const hostname = tab.hostname.toLowerCase();

    if (hosts.includes(hostname) && tabPort(tab) === expectedPort) {
      return true;
    }

    return getJellyfinMatchOrigins(config).includes(tab.origin);
  } catch {
    return false;
  }
}

export function isJellyfinWebPath(url) {
  if (!url) {
    return false;
  }

  try {
    const tab = new URL(url);
    return (
      tab.pathname.startsWith('/web') ||
      tab.hash.includes('/web') ||
      /\/video/i.test(`${tab.pathname}${tab.hash}`)
    );
  } catch {
    return false;
  }
}

export function getJellyfinSchemes(config) {
  const configured = config?.jellyfinServerUrl?.trim();
  if (configured) {
    try {
      return [new URL(configured).protocol.replace(':', '')];
    } catch {
      // Fall through to HTTP.
    }
  }

  return ['http'];
}

export function getJellyfinMatchOrigins(config) {
  const port = getJellyfinPort(config);
  const schemes = getJellyfinSchemes(config);
  const origins = new Set();

  for (const host of getJellyfinHosts(config)) {
    for (const scheme of schemes) {
      origins.add(`${scheme}://${host}:${port}`);
    }
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

export function getJellyfinMatchPatterns(config, options = {}) {
  const { tabUrl = null } = options;
  const patterns = getJellyfinMatchOrigins(config).map((origin) => `${origin}/*`);

  if (!tabUrl) {
    return patterns;
  }

  try {
    const preferred = `${new URL(tabUrl).origin}/*`;
    if (!patterns.includes(preferred)) {
      return patterns;
    }

    return [preferred, ...patterns.filter((pattern) => pattern !== preferred)];
  } catch {
    return patterns;
  }
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

  return tabMatchesJellyfinHost(url, config) && isJellyfinWebPath(url);
}

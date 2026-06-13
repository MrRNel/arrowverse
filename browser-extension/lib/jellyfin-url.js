export const LOCAL_JELLYFIN_HOSTS = ['localhost', '127.0.0.1', 'jellyfin'];

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

export function getJellyfinMatchOrigins(config) {
  const port = getJellyfinPort(config);
  const origins = new Set(LOCAL_JELLYFIN_HOSTS.map((host) => `http://${host}:${port}`));

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
    if (!getJellyfinMatchOrigins(config).includes(tab.origin)) {
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

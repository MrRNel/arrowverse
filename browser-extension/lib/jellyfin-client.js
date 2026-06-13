globalThis.ArrowverseJellyfin = (() => {
  function readCredentials() {
    try {
      if (globalThis.ApiClient?.accessToken?.()) {
        return {
          accessToken: globalThis.ApiClient.accessToken(),
          userId: globalThis.ApiClient.getCurrentUserId?.() ?? null,
        };
      }
    } catch {
      // Ignore and fall back to localStorage.
    }

    try {
      const raw = localStorage.getItem('jellyfin_credentials');
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      const server = parsed?.Servers?.[0];
      if (!server?.AccessToken) {
        return null;
      }

      return {
        accessToken: server.AccessToken,
        userId: server.UserId ?? null,
      };
    } catch {
      return null;
    }
  }

  async function getDeviceId() {
    const stored = await chrome.storage.local.get('jellyfinDeviceId');
    if (stored.jellyfinDeviceId) {
      return stored.jellyfinDeviceId;
    }

    const deviceId = globalThis.ArrowverseUuid.randomUUID();
    await chrome.storage.local.set({ jellyfinDeviceId: deviceId });
    return deviceId;
  }

  async function buildAuthHeader(accessToken) {
    const deviceId = await getDeviceId();
    return `MediaBrowser Client="Arrowverse Tracker", Device="Chrome Extension", DeviceId="${deviceId}", Version="1.0.7", Token="${accessToken}"`;
  }

  function itemToMetadata(item) {
    if (!item || item.Type !== 'Episode') {
      return null;
    }

    const seriesTitle = item.SeriesName ?? item.Album ?? item.SeriesPrimaryImageItem?.Name ?? '';
    const episodeTitle = item.Name ?? '';
    const season = item.ParentIndexNumber ?? null;
    const episode = item.IndexNumber ?? null;

    return {
      seriesTitle,
      episodeTitle,
      season,
      episode,
      combinedText: `${seriesTitle} S${season}E${episode} ${episodeTitle}`.trim(),
      itemId: item.Id ?? null,
    };
  }

  function sessionProgress(session) {
    const item = session?.NowPlayingItem;
    const playState = session?.PlayState;
    if (!item?.RunTimeTicks || !playState?.PositionTicks) {
      return null;
    }

    return playState.PositionTicks / item.RunTimeTicks;
  }

  function isSessionPlaying(session) {
    if (!session?.NowPlayingItem || session.NowPlayingItem.Type !== 'Episode') {
      return false;
    }

    if (session.PlayState?.IsPaused === false) {
      return true;
    }

    const progress = sessionProgress(session);
    if (progress !== null && progress > 0 && progress < 1) {
      return true;
    }

    return Boolean(session.IsActive);
  }

  async function fetchActiveSession() {
    const credentials = readCredentials();
    if (!credentials?.accessToken) {
      return { credentials: null, session: null, error: 'not-authenticated' };
    }

    const authHeader = await buildAuthHeader(credentials.accessToken);
    const response = await fetch(`${window.location.origin}/Sessions?ActiveWithinSeconds=120`, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return {
        credentials,
        session: null,
        error: `sessions-${response.status}`,
      };
    }

    const sessions = await response.json();
    if (!Array.isArray(sessions)) {
      return { credentials, session: null, error: 'invalid-response' };
    }

    const candidates = sessions.filter((session) => {
      if (session.NowPlayingItem?.Type !== 'Episode') {
        return false;
      }

      if (credentials.userId && session.UserId !== credentials.userId) {
        return false;
      }

      return isSessionPlaying(session) || session.NowPlayingItem;
    });

    const playing = candidates.find((session) => isSessionPlaying(session));
    const session = playing ?? candidates[0] ?? null;

    return { credentials, session, error: null };
  }

  function isWatchPage() {
    const href = window.location.href;
    if (/#!?\/video/i.test(href) || /\/video\.html/i.test(href)) {
      return true;
    }

    return Boolean(globalThis.ArrowverseJellyfin?.__lastSession?.NowPlayingItem);
  }

  return {
    readCredentials,
    itemToMetadata,
    sessionProgress,
    isSessionPlaying,
    fetchActiveSession,
    isWatchPage,
    setLastSession(session) {
      this.__lastSession = session;
    },
  };
})();

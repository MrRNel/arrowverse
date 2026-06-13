const DEBUG_KEY = 'jellyfinDebug';
const shared = globalThis.ArrowverseContent;
const jellyfin = globalThis.ArrowverseJellyfin;

let currentItemId = null;
let startedEpisodeKey = null;
let completedEpisodeKey = null;
let lastMatchedEpisode = null;
let lastKnownProgress = 0;

function resetState() {
  currentItemId = null;
  startedEpisodeKey = null;
  completedEpisodeKey = null;
  lastMatchedEpisode = null;
  lastKnownProgress = 0;
  globalThis.__arrowverseLastSyncWarningKey = null;
  jellyfin.setLastSession(null);
}

function enrichEpisode(episode, provider, playItemId = null) {
  return {
    ...episode,
    provider,
    play_item_id: playItemId,
  };
}

async function completeEpisodeOnStop({
  sendRuntimeMessage,
  isExtensionDead,
  reason,
  COMPLETION_THRESHOLD,
  PARTIAL_MIN,
}) {
  if (!lastMatchedEpisode || !startedEpisodeKey || completedEpisodeKey === startedEpisodeKey) {
    return false;
  }

  if (lastKnownProgress >= COMPLETION_THRESHOLD) {
    completedEpisodeKey = startedEpisodeKey;
    await sendRuntimeMessage({
      type: 'EPISODE_COMPLETED',
      payload: enrichEpisode(lastMatchedEpisode, 'jellyfin', currentItemId),
      reason,
    });
    return !isExtensionDead();
  }

  if (lastKnownProgress >= PARTIAL_MIN) {
    await sendRuntimeMessage({
      type: 'EPISODE_PARTIAL',
      payload: enrichEpisode(lastMatchedEpisode, 'jellyfin', currentItemId),
      progress: lastKnownProgress,
      reason,
    });
  }

  return false;
}

function playbackProgress(session) {
  const apiProgress = jellyfin.sessionProgress(session);
  const video = shared.queryDeep('video');
  const videoProgress =
    video?.duration && video.duration > 0 ? video.currentTime / video.duration : null;

  if (videoProgress !== null) {
    return { progress: videoProgress, source: 'video' };
  }

  if (apiProgress !== null) {
    return { progress: apiProgress, source: 'api' };
  }

  return { progress: 0, source: 'none' };
}

shared.createMonitor({
  debugKey: DEBUG_KEY,
  providerLabel: 'Jellyfin',
  initFlag: '__arrowverseJellyfinMonitorInitialized',
  listenerFlag: '__arrowverseJellyfinMessageListener',
  isWatchPage: () => true,
  onResetState: resetState,
  bootHint: 'Jellyfin monitor active. Play an Arrowverse episode to sync.',
  evaluatePlaybackInner: async ({
    storeDebug,
    sendRuntimeMessage,
    resolveEpisode,
    markExtensionDead,
    isExtensionDead,
    canUseExtensionRuntime,
    COMPLETION_THRESHOLD,
    getLastStatus,
  }) => {
    if (isExtensionDead() || !canUseExtensionRuntime()) {
      markExtensionDead(new Error('Extension context invalidated'));
      return;
    }

    const lastStatus = getLastStatus();
    const { credentials, session, error } = await jellyfin.fetchActiveSession();

    if (!credentials?.accessToken) {
      await storeDebug({
        phase: 'waiting-for-auth',
        hint: 'Log in to Jellyfin in this tab, then start playing an episode.',
      });
      return;
    }

    if (error && error !== 'not-authenticated') {
      await storeDebug({
        phase: 'error',
        message: `Could not read Jellyfin sessions (${error}).`,
      });
      return;
    }

    if (!session?.NowPlayingItem) {
      await completeEpisodeOnStop({
        sendRuntimeMessage,
        isExtensionDead,
        reason: 'session-ended',
        COMPLETION_THRESHOLD,
        PARTIAL_MIN: 0.15,
      });
      resetState();
      await storeDebug({
        phase: 'waiting-for-playback',
        hint: 'Start playing an Arrowverse episode in Jellyfin.',
      });
      return;
    }

    jellyfin.setLastSession(session);

    const itemId = session.NowPlayingItem.Id;
    if (itemId !== currentItemId) {
      if (currentItemId !== null && lastMatchedEpisode) {
        await completeEpisodeOnStop({
          sendRuntimeMessage,
          isExtensionDead,
          reason: 'item-changed',
          COMPLETION_THRESHOLD,
          PARTIAL_MIN: 0.15,
        });
      }

      currentItemId = itemId;
      startedEpisodeKey = null;
      completedEpisodeKey = null;
      lastKnownProgress = 0;
      globalThis.__arrowverseLastSyncWarningKey = null;
    }

    const metadata = jellyfin.itemToMetadata(session.NowPlayingItem);
    if (!metadata) {
      await storeDebug({
        phase: 'waiting-for-metadata',
        hint: 'Waiting for Jellyfin to report an episode in the player.',
      });
      return;
    }

    const episode = await resolveEpisode(metadata);
    if (!episode) {
      if (lastStatus.phase === 'error') {
        return;
      }

      await storeDebug({
        phase: 'no-match',
        metadata,
      });
      return;
    }

    const episodeKey = `${episode.row_number}:${episode.episode_id}`;
    lastMatchedEpisode = episode;

    if (startedEpisodeKey !== episodeKey) {
      startedEpisodeKey = episodeKey;
      completedEpisodeKey = null;
      lastKnownProgress = Math.max(lastKnownProgress, playbackProgress(session).progress);

      const started = await sendRuntimeMessage({
        type: 'EPISODE_STARTED',
        payload: enrichEpisode(episode, 'jellyfin', metadata.itemId),
      });

      if (!started && isExtensionDead()) {
        return;
      }
    }

    await storeDebug({
      phase: 'matched',
      metadata,
      episode: {
        row_number: episode.row_number,
        series: episode.series,
        episode_id: episode.episode_id,
        episode_name: episode.episode_name,
      },
    });

    const { progress } = playbackProgress(session);
    lastKnownProgress = Math.max(lastKnownProgress, progress);
    const isEnded = progress >= COMPLETION_THRESHOLD;

    if (isEnded && completedEpisodeKey !== episodeKey) {
      completedEpisodeKey = episodeKey;
      await sendRuntimeMessage({
        type: 'EPISODE_COMPLETED',
        payload: enrichEpisode(episode, 'jellyfin', metadata.itemId),
      });
    }
  },
});

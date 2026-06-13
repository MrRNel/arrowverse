const DEBUG_KEY = 'netflixDebug';
const shared = globalThis.ArrowverseContent;

const ARROWVERSE_LINE =
  /^(arrow|the flash|supergirl|legends|batwoman|black lightning|constantine|stargirl|superman|dc)/i;

let currentWatchId = null;
let cachedMetadata = null;
let startedEpisodeKey = null;
let completedEpisodeKey = null;
let lastMatchedEpisode = null;
let lastKnownProgress = 0;

function resetState() {
  currentWatchId = null;
  cachedMetadata = null;
  startedEpisodeKey = null;
  completedEpisodeKey = null;
  lastMatchedEpisode = null;
  lastKnownProgress = 0;
  globalThis.__arrowverseLastSyncWarningKey = null;
}

async function completeEpisodeOnStop({
  sendRuntimeMessage,
  isExtensionDead,
}) {
  if (
    !lastMatchedEpisode ||
    !startedEpisodeKey ||
    completedEpisodeKey === startedEpisodeKey ||
    lastKnownProgress < 0.5
  ) {
    return;
  }

  completedEpisodeKey = startedEpisodeKey;
  await sendRuntimeMessage({
    type: 'EPISODE_COMPLETED',
    payload: lastMatchedEpisode,
  });

  if (isExtensionDead()) {
    return;
  }

  lastMatchedEpisode = null;
  lastKnownProgress = 0;
}

function isWatchPage() {
  return /netflix\.com\/watch/i.test(window.location.href);
}

function getWatchId() {
  const player = document.querySelector('[data-uia="player"][data-videoid]');
  if (player?.dataset?.videoid) {
    return player.dataset.videoid;
  }

  const match = window.location.href.match(/\/watch\/(\d+)/);
  return match?.[1] ?? window.location.href;
}

function parseSeasonEpisode(text) {
  const value = text ?? '';

  const standard = value.match(/s(?:eason)?\s*(\d+)\s*[:\-]?\s*e(?:pisode)?\s*(\d+)/i);
  if (standard) {
    return { season: Number(standard[1]), episode: Number(standard[2]) };
  }

  const compact = value.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (compact) {
    return { season: Number(compact[1]), episode: Number(compact[2]) };
  }

  const spaced = value.match(/(\d+)\D+(\d+)/);
  if (spaced) {
    return { season: Number(spaced[1]), episode: Number(spaced[2]) };
  }

  return null;
}

function parseEpisodeLine(text) {
  const trimmed = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return null;
  }

  const netflixLine = trimmed.match(/^(.+?)\s+E(\d+)\s*[:\-]?\s*(.+)$/i);
  if (netflixLine) {
    return {
      seriesTitle: netflixLine[1].trim(),
      episode: Number(netflixLine[2]),
      episodeTitle: netflixLine[3].trim(),
    };
  }

  return null;
}

function scanWatchVideoText() {
  const root = document.querySelector('[data-uia="watch-video"]');
  if (!root) {
    return null;
  }

  const elements = root.querySelectorAll('[data-uia], h3, h4, span, div');
  for (const element of elements) {
    const text = element.textContent?.replace(/\s+/g, ' ').trim();
    if (!text || text.length > 120 || text.length < 8) {
      continue;
    }

    if (element.children.length > 4) {
      continue;
    }

    const parsed = parseEpisodeLine(text);
    if (parsed && ARROWVERSE_LINE.test(parsed.seriesTitle)) {
      return parsed;
    }
  }

  return null;
}

function extractNetflixMetadata() {
  let seriesTitle = '';
  let episodeTitle = '';
  let season = null;
  let episode = null;

  const scanned = scanWatchVideoText();
  if (scanned) {
    seriesTitle = scanned.seriesTitle;
    episodeTitle = scanned.episodeTitle;
    episode = scanned.episode;
  }

  const titleRoot = document.querySelector('[data-uia="video-title"]');
  if (titleRoot) {
    const seriesElement = titleRoot.querySelector('h4');
    const spanElements = titleRoot.querySelectorAll('span');

    if (seriesElement?.textContent?.trim()) {
      seriesTitle = seriesElement.textContent.trim();
    }

    if (spanElements.length >= 2) {
      const episodeNumberText = spanElements[0].textContent?.trim() ?? '';
      episodeTitle = spanElements[1].textContent?.trim() ?? '';
      const parsed = parseSeasonEpisode(episodeNumberText);
      if (parsed) {
        season = parsed.season;
        episode = parsed.episode;
      }
    } else if (spanElements.length === 1 && !episodeTitle) {
      episodeTitle = spanElements[0].textContent?.trim() ?? '';
    }

    if (!seriesTitle) {
      const parsedLine = parseEpisodeLine(titleRoot.textContent ?? '');
      if (parsedLine) {
        seriesTitle = parsedLine.seriesTitle;
        episodeTitle = parsedLine.episodeTitle;
        episode = parsedLine.episode;
      } else {
        seriesTitle = titleRoot.textContent?.trim() ?? '';
      }
    }
  }

  const fallbackSelectors = [
    { series: '[data-uia="player-title-text"]', episode: '[data-uia="player-episode-title"]' },
    { series: '[data-uia="video-title"]', episode: '[data-uia="episode-title"]' },
    { series: '[data-uia="player"] [data-uia="video-title"]', episode: '[data-uia="episode-title"]' },
  ];

  for (const selector of fallbackSelectors) {
    if (seriesTitle && episodeTitle) {
      break;
    }

    const seriesElement = document.querySelector(selector.series);
    const episodeElement = document.querySelector(selector.episode);

    if (!seriesTitle && seriesElement?.textContent?.trim()) {
      const parsedLine = parseEpisodeLine(seriesElement.textContent);
      if (parsedLine) {
        seriesTitle = parsedLine.seriesTitle;
        episodeTitle = parsedLine.episodeTitle;
        episode = parsedLine.episode ?? episode;
      } else {
        seriesTitle = seriesElement.textContent.trim();
      }
    }

    if (!episodeTitle && episodeElement?.textContent?.trim()) {
      episodeTitle = episodeElement.textContent.trim();
    }
  }

  if (!seriesTitle) {
    const match = document.title.match(/^(.+?)(?:\s+\|\s+Netflix)?$/i);
    seriesTitle = match?.[1]?.trim() ?? '';
  }

  if (!season || !episode) {
    const parsed =
      parseSeasonEpisode(episodeTitle) ??
      parseSeasonEpisode(seriesTitle) ??
      parseSeasonEpisode(document.title);
    if (parsed) {
      season = parsed.season;
      episode = parsed.episode;
    }
  }

  const combinedText = `${seriesTitle} ${episodeTitle} ${document.title}`.trim();

  return { seriesTitle, episodeTitle, season, episode, combinedText };
}

function getActiveMetadata() {
  const watchId = getWatchId();
  if (watchId !== currentWatchId) {
    currentWatchId = watchId;
    cachedMetadata = null;
    startedEpisodeKey = null;
    completedEpisodeKey = null;
    globalThis.__arrowverseLastSyncWarningKey = null;
  }

  const fresh = extractNetflixMetadata();
  if (fresh.seriesTitle || fresh.episodeTitle || fresh.season || fresh.episode) {
    cachedMetadata = fresh;
  }

  return cachedMetadata ?? fresh;
}

shared.createMonitor({
  debugKey: DEBUG_KEY,
  providerLabel: 'Netflix',
  initFlag: '__arrowverseNetflixMonitorInitialized',
  listenerFlag: '__arrowverseNetflixMessageListener',
  isWatchPage,
  onResetState: resetState,
  bootHint: 'Netflix monitor active. Play an Arrowverse episode to sync.',
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

    if (!isWatchPage()) {
      await completeEpisodeOnStop({ sendRuntimeMessage, isExtensionDead });
      resetState();
      await storeDebug({ phase: 'not-watch-page' });
      return;
    }

    const lastStatus = getLastStatus();
    const video = shared.queryDeep('video');
    const metadata = getActiveMetadata();
    const hasMetadata =
      metadata.seriesTitle || metadata.episodeTitle || metadata.season || metadata.episode;

    if (!shared.isVideoActive(video) && !hasMetadata) {
      await storeDebug({
        phase: 'waiting-for-playback',
        videoFound: Boolean(video),
      });
      return;
    }

    if (!hasMetadata) {
      await storeDebug({
        phase: 'waiting-for-metadata',
        videoFound: Boolean(video),
        hint: 'Hover the Netflix player so the episode label (e.g. "The Flash E1 Pilot") is visible.',
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
        videoFound: Boolean(video),
      });
      return;
    }

    const episodeKey = `${episode.row_number}:${episode.episode_id}`;
    lastMatchedEpisode = episode;

    if (startedEpisodeKey !== episodeKey) {
      startedEpisodeKey = episodeKey;
      completedEpisodeKey = null;

      const started = await sendRuntimeMessage({
        type: 'EPISODE_STARTED',
        payload: episode,
      });

      if (!started && isExtensionDead()) {
        return;
      }
    }

    await storeDebug({
      phase: 'matched',
      metadata,
      videoFound: Boolean(video),
      episode: {
        row_number: episode.row_number,
        series: episode.series,
        episode_id: episode.episode_id,
        episode_name: episode.episode_name,
      },
    });

    if (!video || !shared.isVideoActive(video)) {
      return;
    }

    const progress = video.duration ? video.currentTime / video.duration : 0;
    lastKnownProgress = Math.max(lastKnownProgress, progress);
    const isEnded = video.ended || progress >= COMPLETION_THRESHOLD;

    if (isEnded && completedEpisodeKey !== episodeKey) {
      completedEpisodeKey = episodeKey;
      await sendRuntimeMessage({
        type: 'EPISODE_COMPLETED',
        payload: episode,
      });
    }
  },
});

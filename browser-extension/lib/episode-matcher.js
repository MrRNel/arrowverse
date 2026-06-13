const SERIES_ALIASES = new Map([
  ['arrow', 'Arrow'],
  ['the flash', 'The Flash'],
  ['flash', 'The Flash'],
  ['supergirl', 'Supergirl'],
  ['legends of tomorrow', "DC's Legends of Tomorrow"],
  ['dc legends of tomorrow', "DC's Legends of Tomorrow"],
  ['dcs legends of tomorrow', "DC's Legends of Tomorrow"],
  ['batwoman', 'Batwoman'],
  ['black lightning', 'Black Lightning'],
  ['constantine', 'Constantine'],
  ['stargirl', 'Stargirl'],
  ['dc stargirl', 'Stargirl'],
  ['superman lois', 'Superman & Lois'],
  ['superman and lois', 'Superman & Lois'],
  ['vixen', 'Vixen'],
  ['freedom fighters the ray', 'Freedom Fighters: The Ray'],
  ['freedom fighters', 'Freedom Fighters: The Ray'],
]);

function normalize(value) {
  return (value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

function episodeCode(season, episode) {
  return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
}

export class EpisodeMatcher {
  constructor(episodes) {
    this.episodes = episodes;
    this.bySeries = new Map();

    for (const episode of episodes) {
      const list = this.bySeries.get(episode.series) ?? [];
      list.push(episode);
      this.bySeries.set(episode.series, list);
    }
  }

  static async load(url) {
    const response = await fetch(url);
    const episodes = await response.json();
    return new EpisodeMatcher(episodes);
  }

  resolveSeriesName(rawSeries) {
    const normalized = normalize(rawSeries);
    if (!normalized) {
      return null;
    }

    if (SERIES_ALIASES.has(normalized)) {
      return SERIES_ALIASES.get(normalized);
    }

    for (const [alias, canonical] of SERIES_ALIASES.entries()) {
      if (normalized.includes(alias)) {
        return canonical;
      }
    }

    for (const series of this.bySeries.keys()) {
      const seriesNormalized = normalize(series);
      if (seriesNormalized === normalized || normalized.includes(seriesNormalized)) {
        return series;
      }
    }

    return null;
  }

  match({ seriesTitle, episodeTitle, combinedText, season, episode }) {
    const seriesName = this.resolveSeriesName(seriesTitle);
    if (!seriesName) {
      return null;
    }

    const candidates = this.bySeries.get(seriesName) ?? [];
    if (!candidates.length) {
      return null;
    }

    const parsedSeasonEpisode =
      season && episode
        ? { season, episode }
        : parseSeasonEpisode(combinedText) ??
          parseSeasonEpisode(episodeTitle) ??
          parseSeasonEpisode(seriesTitle);

    if (parsedSeasonEpisode) {
      const code = episodeCode(parsedSeasonEpisode.season, parsedSeasonEpisode.episode);
      const exact = candidates.find((item) => item.episode_id.toUpperCase() === code);
      if (exact) {
        return exact;
      }
    }

    const target = normalize(episodeTitle);
    if (episode && target) {
      const episodeMatches = candidates.filter((item) => {
        const episodeNumber = Number(item.episode_id.split('E')[1]);
        return episodeNumber === episode && normalize(item.episode_name) === target;
      });
      if (episodeMatches.length === 1) {
        return episodeMatches[0];
      }
    }

    if (!target) {
      return null;
    }

    const exactNameMatches = candidates.filter(
      (item) => normalize(item.episode_name) === target,
    );
    if (exactNameMatches.length === 1) {
      return exactNameMatches[0];
    }

    let best = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const candidateName = normalize(candidate.episode_name);
      if (!candidateName) {
        continue;
      }

      if (candidateName.includes(target) || target.includes(candidateName)) {
        const score = Math.min(candidateName.length, target.length);
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
    }

    return best;
  }
}

export function extractNetflixMetadata() {
  let seriesTitle = '';
  let episodeTitle = '';
  let season = null;
  let episode = null;

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
      seriesTitle = titleRoot.textContent?.trim() ?? '';
    }
  }

  const fallbackSelectors = [
    { series: '[data-uia="player-title-text"]', episode: '[data-uia="player-episode-title"]' },
    { series: '[data-uia="video-title"]', episode: '[data-uia="episode-title"]' },
  ];

  for (const selector of fallbackSelectors) {
    if (seriesTitle && episodeTitle) {
      break;
    }

    const seriesElement = document.querySelector(selector.series);
    const episodeElement = document.querySelector(selector.episode);

    if (!seriesTitle && seriesElement?.textContent?.trim()) {
      seriesTitle = seriesElement.textContent.trim();
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

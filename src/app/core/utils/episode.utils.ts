import { ArrowverseEpisode, ParsedEpisodeId } from '../models/episode.model';
import { SHOW_BY_NAME } from '../data/shows.data';

export function parseEpisodeId(episodeId: string): ParsedEpisodeId {
  const match = episodeId.match(/^S(\d+)E(\d+)$/i);
  return {
    season: match ? Number(match[1]) : 0,
    episode: match ? Number(match[2]) : 0,
  };
}

export function getShowId(seriesName: string): string {
  return SHOW_BY_NAME.get(seriesName)?.id ?? seriesName.toLowerCase().replace(/\s+/g, '-');
}

export function episodeMatchesShow(episode: ArrowverseEpisode, showId: string): boolean {
  return getShowId(episode.series) === showId;
}

export function episodeMatchesSeason(
  episode: ArrowverseEpisode,
  showId: string,
  season: number,
): boolean {
  if (!episodeMatchesShow(episode, showId)) {
    return false;
  }

  return parseEpisodeId(episode.episode_id).season === season;
}

export function formatEpisodeCode(episodeId: string): string {
  const { season, episode } = parseEpisodeId(episodeId);
  return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
}

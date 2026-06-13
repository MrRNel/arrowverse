export interface ArrowverseEpisode {
  row_number: number;
  series: string;
  episode_id: string;
  episode_name: string;
  air_date: string;
}

export interface ParsedEpisodeId {
  season: number;
  episode: number;
}

export interface ShowDefinition {
  id: string;
  name: string;
  accent: string;
  icon: string;
}

export interface SeasonSummary {
  showId: string;
  showName: string;
  season: number;
  episodeCount: number;
  watchedCount: number;
}

export interface WatchStats {
  watched: number;
  outstanding: number;
  total: number;
  upNext: ArrowverseEpisode | null;
  progressPercent: number;
}

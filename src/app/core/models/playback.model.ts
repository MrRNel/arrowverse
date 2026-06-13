export type WatchSource = 'manual' | 'jellyfin' | 'netflix' | 'extension';

export type SeriesPlaybackSource = 'jellyfin' | 'netflix';

export const DEFAULT_JELLYFIN_URL = 'http://jellyfin:8096/web/#/video';

export interface WatchSourceOption {
  label: string;
  value: WatchSource;
  icon: string;
}

export interface SeriesPlaybackSourceOption {
  label: string;
  value: SeriesPlaybackSource;
  icon: string;
}

export const WATCH_SOURCE_OPTIONS: WatchSourceOption[] = [
  { label: 'Manual', value: 'manual', icon: 'pi pi-pencil' },
  { label: 'Jellyfin', value: 'jellyfin', icon: 'pi pi-server' },
  { label: 'Netflix', value: 'netflix', icon: 'pi pi-video' },
  { label: 'Extension', value: 'extension', icon: 'pi pi-link' },
];

export const SERIES_PLAYBACK_SOURCE_OPTIONS: SeriesPlaybackSourceOption[] = [
  { label: 'Jellyfin', value: 'jellyfin', icon: 'pi pi-server' },
  { label: 'Netflix', value: 'netflix', icon: 'pi pi-video' },
];

export interface EpisodePlaybackLink {
  url: string;
  label: string;
  provider: WatchSource | 'search';
}

export interface EpisodePlaybackMeta {
  rowNumber: number;
  series: string;
  episodeId: string;
  episodeName: string;
}

export function jellyfinVideoUrl(baseUrl: string, itemId: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  if (base.includes('#/video')) {
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}id=${encodeURIComponent(itemId)}`;
  }

  return `${base}/web/index.html#!/video?id=${encodeURIComponent(itemId)}`;
}

export function jellyfinSearchUrl(baseUrl: string, query: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  if (base.includes('#/video')) {
    const searchBase = base.replace('#/video', '#/search.html');
    return `${searchBase}?query=${encodeURIComponent(query)}`;
  }

  return `${base}/web/index.html#!/search.html?query=${encodeURIComponent(query)}`;
}

export function netflixWatchUrl(watchId: string): string {
  return `https://www.netflix.com/watch/${watchId}`;
}

export function netflixSearchUrl(query: string): string {
  return `https://www.netflix.com/search?q=${encodeURIComponent(query)}`;
}

export function playbackSearchQuery(episode: EpisodePlaybackMeta): string {
  return `${episode.series} ${episode.episodeId} ${episode.episodeName}`.trim();
}

export function normalizeWatchSource(source: string | null | undefined): WatchSource {
  if (source === 'jellyfin' || source === 'netflix' || source === 'extension') {
    return source;
  }
  return 'manual';
}

export function watchSourceLabel(source: WatchSource): string {
  return WATCH_SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? 'Manual';
}

export function seriesPlaybackSourceLabel(source: SeriesPlaybackSource): string {
  return SERIES_PLAYBACK_SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? 'Jellyfin';
}

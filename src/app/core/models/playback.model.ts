export type WatchSource = 'manual' | 'jellyfin' | 'netflix' | 'extension';

export interface WatchSourceOption {
  label: string;
  value: WatchSource;
  icon: string;
}

export const WATCH_SOURCE_OPTIONS: WatchSourceOption[] = [
  { label: 'Manual', value: 'manual', icon: 'pi pi-pencil' },
  { label: 'Jellyfin', value: 'jellyfin', icon: 'pi pi-server' },
  { label: 'Netflix', value: 'netflix', icon: 'pi pi-video' },
  { label: 'Extension', value: 'extension', icon: 'pi pi-link' },
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
  return `${base}/web/index.html#!/video?id=${encodeURIComponent(itemId)}`;
}

export function jellyfinSearchUrl(baseUrl: string, query: string): string {
  const base = baseUrl.replace(/\/+$/, '');
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

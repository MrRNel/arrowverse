import { Injectable, inject } from '@angular/core';

import {
  EpisodePlaybackLink,
  EpisodePlaybackMeta,
  jellyfinSearchUrl,
  jellyfinVideoUrl,
  netflixSearchUrl,
  netflixWatchUrl,
  normalizeWatchSource,
  playbackSearchQuery,
  WatchSource,
} from '../models/playback.model';
import { PlaybackPreferencesService } from './playback-preferences.service';
import { WatchProgressService } from './watch-progress.service';

@Injectable({ providedIn: 'root' })
export class EpisodePlaybackService {
  private readonly preferences = inject(PlaybackPreferencesService);
  private readonly progressService = inject(WatchProgressService);

  buildLink(
    episode: EpisodePlaybackMeta,
    preferredSource?: WatchSource | null,
  ): EpisodePlaybackLink {
    const storedSource = this.progressService.getSource(episode.rowNumber);
    const playItemId = this.progressService.getPlayItemId(episode.rowNumber);
    const source = preferredSource ?? storedSource ?? 'jellyfin';
    const query = playbackSearchQuery(episode);

    if (source === 'jellyfin' || source === 'manual' || source === 'extension') {
      if (playItemId && (storedSource === 'jellyfin' || source === 'jellyfin')) {
        return {
          url: jellyfinVideoUrl(this.preferences.jellyfinUrl(), playItemId),
          label: 'Play on Jellyfin',
          provider: 'jellyfin',
        };
      }

      return {
        url: jellyfinSearchUrl(this.preferences.jellyfinUrl(), query),
        label: 'Open in Jellyfin',
        provider: 'search',
      };
    }

    if (playItemId && storedSource === 'netflix') {
      return {
        url: netflixWatchUrl(playItemId),
        label: 'Play on Netflix',
        provider: 'netflix',
      };
    }

    return {
      url: netflixSearchUrl(query),
      label: 'Open on Netflix',
      provider: 'search',
    };
  }

  openEpisode(episode: EpisodePlaybackMeta, preferredSource?: WatchSource | null): void {
    const link = this.buildLink(episode, preferredSource);
    window.open(link.url, '_blank', 'noopener,noreferrer');
  }

  sourceForRow(rowNumber: number): WatchSource {
    return normalizeWatchSource(this.progressService.getSource(rowNumber));
  }
}

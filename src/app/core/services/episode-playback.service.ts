import { Injectable, inject } from '@angular/core';

import {
  EpisodePlaybackLink,
  EpisodePlaybackMeta,
  jellyfinSearchUrl,
  jellyfinVideoUrl,
  netflixSearchUrl,
  netflixWatchUrl,
  playbackSearchQuery,
  SeriesPlaybackSource,
} from '../models/playback.model';
import { getShowId } from '../utils/episode.utils';
import { UserSettingsService } from './user-settings.service';
import { WatchProgressService } from './watch-progress.service';

@Injectable({ providedIn: 'root' })
export class EpisodePlaybackService {
  private readonly settings = inject(UserSettingsService);
  private readonly progressService = inject(WatchProgressService);

  buildLink(
    episode: EpisodePlaybackMeta,
    preferredSource?: SeriesPlaybackSource | null,
  ): EpisodePlaybackLink {
    const showId = getShowId(episode.series);
    const seriesSource = preferredSource ?? this.settings.getSeriesSource(showId);
    const playItemId = this.progressService.getPlayItemId(episode.rowNumber);
    const query = playbackSearchQuery(episode);

    if (seriesSource === 'netflix') {
      if (playItemId) {
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

    if (playItemId) {
      return {
        url: jellyfinVideoUrl(this.settings.jellyfinUrl(), playItemId),
        label: 'Play on Jellyfin',
        provider: 'jellyfin',
      };
    }

    return {
      url: jellyfinSearchUrl(this.settings.jellyfinUrl(), query),
      label: 'Open in Jellyfin',
      provider: 'search',
    };
  }

  openEpisode(episode: EpisodePlaybackMeta, preferredSource?: SeriesPlaybackSource | null): void {
    const link = this.buildLink(episode, preferredSource);
    window.open(link.url, '_blank', 'noopener,noreferrer');
  }

  sourceForSeries(seriesName: string): SeriesPlaybackSource {
    return this.settings.getSeriesSource(getShowId(seriesName));
  }
}

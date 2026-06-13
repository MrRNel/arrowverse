import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, shareReplay } from 'rxjs';

import { SHOWS } from '../data/shows.data';
import {
  ArrowverseEpisode,
  SeasonSummary,
  WatchStats,
} from '../models/episode.model';
import {
  episodeMatchesSeason,
  episodeMatchesShow,
  getShowId,
  parseEpisodeId,
} from '../utils/episode.utils';

@Injectable({ providedIn: 'root' })
export class EpisodeService {
  private readonly http = inject(HttpClient);
  private readonly episodes$ = this.http.get<ArrowverseEpisode[]>('/api/episodes').pipe(
    catchError(() => this.http.get<ArrowverseEpisode[]>('/assets/data/watch-order.json')),
    shareReplay(1),
  );

  getEpisodes(): Observable<ArrowverseEpisode[]> {
    return this.episodes$;
  }

  getStats(watchedRows: ReadonlySet<number>): Observable<WatchStats> {
    return this.episodes$.pipe(
      map((episodes) => {
        const watched = episodes.filter((episode) => watchedRows.has(episode.row_number)).length;
        const total = episodes.length;
        const outstanding = total - watched;
        const upNext = episodes.find((episode) => !watchedRows.has(episode.row_number)) ?? null;

        return {
          watched,
          outstanding,
          total,
          upNext,
          progressPercent: total ? Math.round((watched / total) * 100) : 0,
        };
      }),
    );
  }

  getEpisodesForShow(showId: string): Observable<ArrowverseEpisode[]> {
    return this.episodes$.pipe(
      map((episodes) => episodes.filter((episode) => episodeMatchesShow(episode, showId))),
    );
  }

  getEpisodesForSeason(showId: string, season: number): Observable<ArrowverseEpisode[]> {
    return this.episodes$.pipe(
      map((episodes) =>
        episodes.filter((episode) => episodeMatchesSeason(episode, showId, season)),
      ),
    );
  }

  getSeasonSummaries(watchedRows: ReadonlySet<number>): Observable<SeasonSummary[]> {
    return this.episodes$.pipe(
      map((episodes) => {
        const seasonMap = new Map<string, SeasonSummary>();

        for (const episode of episodes) {
          const showId = getShowId(episode.series);
          const { season } = parseEpisodeId(episode.episode_id);
          const key = `${showId}:${season}`;
          const existing = seasonMap.get(key);

          if (existing) {
            existing.episodeCount += 1;
            if (watchedRows.has(episode.row_number)) {
              existing.watchedCount += 1;
            }
            continue;
          }

          seasonMap.set(key, {
            showId,
            showName: episode.series,
            season,
            episodeCount: 1,
            watchedCount: watchedRows.has(episode.row_number) ? 1 : 0,
          });
        }

        return [...seasonMap.values()].sort((a, b) => {
          const showOrder =
            SHOWS.findIndex((show) => show.id === a.showId) -
            SHOWS.findIndex((show) => show.id === b.showId);

          if (showOrder !== 0) {
            return showOrder;
          }

          return a.season - b.season;
        });
      }),
    );
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';

import { SHOW_BY_ID } from '../../../core/data/shows.data';
import { EpisodeService } from '../../../core/services/episode.service';
import { WatchProgressService } from '../../../core/services/watch-progress.service';

@Component({
  selector: 'app-series-detail',
  imports: [RouterLink, CardModule, ProgressBarModule],
  templateUrl: './series-detail.component.html',
  styleUrl: './series-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesDetailComponent {
  private readonly episodeService = inject(EpisodeService);
  private readonly progressService = inject(WatchProgressService);

  readonly showId = input.required<string>();

  readonly show = computed(() => SHOW_BY_ID.get(this.showId()) ?? null);

  readonly seasons = toSignal(
    toObservable(this.progressService.watched).pipe(
      switchMap((watched) => this.episodeService.getSeasonSummaries(watched)),
    ),
    { initialValue: [] },
  );

  readonly showSeasons = computed(() =>
    this.seasons().filter((season) => season.showId === this.showId()),
  );

  progressPercent(season: { episodeCount: number; watchedCount: number }): number {
    return season.episodeCount
      ? Math.round((season.watchedCount / season.episodeCount) * 100)
      : 0;
  }
}

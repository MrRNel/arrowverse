import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';

import { SHOWS } from '../../../core/data/shows.data';
import { EpisodeService } from '../../../core/services/episode.service';
import { WatchProgressService } from '../../../core/services/watch-progress.service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

@Component({
  selector: 'app-series-list',
  imports: [RouterLink, CardModule],
  templateUrl: './series-list.component.html',
  styleUrl: './series-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesListComponent {
  private readonly episodeService = inject(EpisodeService);
  private readonly progressService = inject(WatchProgressService);

  readonly shows = SHOWS;

  readonly seasonSummaries = toSignal(
    toObservable(this.progressService.watched).pipe(
      switchMap((watched) => this.episodeService.getSeasonSummaries(watched)),
    ),
    { initialValue: [] },
  );

  seasonsForShow(showId: string) {
    return this.seasonSummaries().filter((season) => season.showId === showId);
  }
}

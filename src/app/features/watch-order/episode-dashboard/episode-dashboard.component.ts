import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';

import { EpisodeService } from '../../../core/services/episode.service';
import { WatchProgressService } from '../../../core/services/watch-progress.service';
import { formatEpisodeCode } from '../../../core/utils/episode.utils';

@Component({
  selector: 'app-episode-dashboard',
  imports: [CardModule, ProgressBarModule, TagModule],
  templateUrl: './episode-dashboard.component.html',
  styleUrl: './episode-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpisodeDashboardComponent {
  private readonly episodeService = inject(EpisodeService);
  private readonly progressService = inject(WatchProgressService);

  readonly compact = input(false);

  private readonly stats = toSignal(
    toObservable(this.progressService.watched).pipe(
      switchMap((watched) => this.episodeService.getStats(watched)),
    ),
    { initialValue: null },
  );

  readonly watched = computed(() => this.stats()?.watched ?? 0);
  readonly outstanding = computed(() => this.stats()?.outstanding ?? 0);
  readonly total = computed(() => this.stats()?.total ?? 0);
  readonly progressPercent = computed(() => this.stats()?.progressPercent ?? 0);
  readonly upNext = computed(() => this.stats()?.upNext ?? null);
  readonly upNextCode = computed(() =>
    this.upNext() ? formatEpisodeCode(this.upNext()!.episode_id) : '',
  );
}

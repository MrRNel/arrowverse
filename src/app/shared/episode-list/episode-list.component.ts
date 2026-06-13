import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { ArrowverseEpisode } from '../../core/models/episode.model';
import { SHOW_BY_NAME } from '../../core/data/shows.data';
import { EpisodeService } from '../../core/services/episode.service';
import { GamificationService } from '../../core/services/gamification.service';
import { WatchProgressService } from '../../core/services/watch-progress.service';
import { formatEpisodeCode } from '../../core/utils/episode.utils';

@Component({
  selector: 'app-episode-list',
  imports: [ButtonModule, TagModule],
  templateUrl: './episode-list.component.html',
  styleUrl: './episode-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpisodeListComponent {
  private readonly episodeService = inject(EpisodeService);
  private readonly progressService = inject(WatchProgressService);
  private readonly gamification = inject(GamificationService);

  readonly showId = input<string | null>(null);
  readonly season = input<number | null>(null);
  readonly title = input('Watch Order');

  private readonly listFilter = computed(() => ({
    showId: this.showId(),
    season: this.season(),
  }));

  readonly episodes = toSignal(
    toObservable(this.listFilter).pipe(
      switchMap(({ showId, season }) => {
        if (showId && season) {
          return this.episodeService.getEpisodesForSeason(showId, season);
        }

        if (showId) {
          return this.episodeService.getEpisodesForShow(showId);
        }

        return this.episodeService.getEpisodes();
      }),
    ),
    { initialValue: [] as ArrowverseEpisode[] },
  );

  readonly watchedRows = this.progressService.watched;

  iconFor(series: string): string {
    return SHOW_BY_NAME.get(series)?.icon ?? 'assets/shows/arrow.jpg';
  }

  isWatched(rowNumber: number): boolean {
    return this.watchedRows().has(rowNumber);
  }

  isUpNext(episode: ArrowverseEpisode, index: number): boolean {
    if (this.isWatched(episode.row_number)) {
      return false;
    }

    const previous = this.episodes().slice(0, index);
    return previous.every((item) => this.isWatched(item.row_number));
  }

  async toggleWatched(rowNumber: number): Promise<void> {
    const wasWatched = this.isWatched(rowNumber);
    await this.progressService.toggleWatched(rowNumber);
    await this.gamification.handleWatchChange(rowNumber, !wasWatched);
  }

  formatCode(episodeId: string): string {
    return formatEpisodeCode(episodeId);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { FormsModule } from '@angular/forms';

import { ArrowverseEpisode } from '../../core/models/episode.model';
import { SHOW_BY_NAME } from '../../core/data/shows.data';
import { EpisodeService } from '../../core/services/episode.service';
import { GamificationService } from '../../core/services/gamification.service';
import {
  EpisodeWatchStatus,
  WatchProgressService,
} from '../../core/services/watch-progress.service';
import { formatEpisodeCode } from '../../core/utils/episode.utils';

@Component({
  selector: 'app-episode-list',
  imports: [SelectButtonModule, TagModule, FormsModule],
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

  readonly statusOptions: { label: string; value: EpisodeWatchStatus; icon: string }[] = [
    { label: 'Unwatched', value: 'unwatched', icon: 'pi pi-circle' },
    { label: 'In progress', value: 'partial', icon: 'pi pi-hourglass' },
    { label: 'Finished', value: 'watched', icon: 'pi pi-check' },
  ];

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

  iconFor(series: string): string {
    return SHOW_BY_NAME.get(series)?.icon ?? 'assets/shows/arrow.jpg';
  }

  episodeStatus(rowNumber: number): EpisodeWatchStatus {
    return this.progressService.getStatus(rowNumber);
  }

  isUpNext(episode: ArrowverseEpisode, index: number): boolean {
    if (this.progressService.isWatched(episode.row_number)) {
      return false;
    }

    const previous = this.episodes().slice(0, index);
    return previous.every((item) => this.progressService.isWatched(item.row_number));
  }

  async onStatusChange(rowNumber: number, nextStatus: EpisodeWatchStatus): Promise<void> {
    const previousStatus = this.progressService.getStatus(rowNumber);
    if (previousStatus === nextStatus) {
      return;
    }

    await this.progressService.setStatus(rowNumber, nextStatus, 'manual');

    if (nextStatus === 'watched' && previousStatus !== 'watched') {
      await this.gamification.handleWatchChange(rowNumber, true);
    }
  }

  formatCode(episodeId: string): string {
    return formatEpisodeCode(episodeId);
  }
}

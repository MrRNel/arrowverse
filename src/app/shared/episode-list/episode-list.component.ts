import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';

import { SHOW_BY_NAME } from '../../core/data/shows.data';
import { ArrowverseEpisode } from '../../core/models/episode.model';
import { WATCH_SOURCE_OPTIONS, watchSourceLabel, WatchSource } from '../../core/models/playback.model';
import { EpisodePlaybackService } from '../../core/services/episode-playback.service';
import { EpisodeService } from '../../core/services/episode.service';
import { GamificationService } from '../../core/services/gamification.service';
import {
  EpisodeWatchStatus,
  WatchProgressService,
} from '../../core/services/watch-progress.service';
import { formatEpisodeCode } from '../../core/utils/episode.utils';

@Component({
  selector: 'app-episode-list',
  imports: [ButtonModule, SelectModule, SelectButtonModule, TagModule, FormsModule],
  templateUrl: './episode-list.component.html',
  styleUrl: './episode-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpisodeListComponent {
  private readonly episodeService = inject(EpisodeService);
  private readonly progressService = inject(WatchProgressService);
  private readonly gamification = inject(GamificationService);
  private readonly playback = inject(EpisodePlaybackService);

  readonly showId = input<string | null>(null);
  readonly season = input<number | null>(null);
  readonly title = input('Watch Order');
  readonly showSourceEditor = input(false);

  readonly statusOptions: { label: string; value: EpisodeWatchStatus; icon: string }[] = [
    { label: 'Unwatched', value: 'unwatched', icon: 'pi pi-circle' },
    { label: 'In progress', value: 'partial', icon: 'pi pi-hourglass' },
    { label: 'Finished', value: 'watched', icon: 'pi pi-check' },
  ];

  readonly sourceOptions = WATCH_SOURCE_OPTIONS;

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

  episodeSource(rowNumber: number): WatchSource {
    return this.progressService.getSource(rowNumber);
  }

  sourceLabel(rowNumber: number): string {
    return watchSourceLabel(this.episodeSource(rowNumber));
  }

  playLabel(episode: ArrowverseEpisode): string {
    return this.playback.buildLink(this.toPlaybackMeta(episode)).label;
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

    await this.progressService.setStatus(
      rowNumber,
      nextStatus,
      nextStatus === 'unwatched' ? 'manual' : this.progressService.getSource(rowNumber),
    );

    if (nextStatus === 'watched' && previousStatus !== 'watched') {
      await this.gamification.handleWatchChange(rowNumber, true);
    }
  }

  async onSourceChange(rowNumber: number, source: WatchSource): Promise<void> {
    await this.progressService.setSource(rowNumber, source);
  }

  openEpisode(episode: ArrowverseEpisode): void {
    this.playback.openEpisode(this.toPlaybackMeta(episode));
  }

  formatCode(episodeId: string): string {
    return formatEpisodeCode(episodeId);
  }

  private toPlaybackMeta(episode: ArrowverseEpisode) {
    return {
      rowNumber: episode.row_number,
      series: episode.series,
      episodeId: episode.episode_id,
      episodeName: episode.episode_name,
    };
  }
}

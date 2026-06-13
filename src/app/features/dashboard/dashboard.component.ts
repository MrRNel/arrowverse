import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';

import { SHOWS, SHOW_BY_NAME } from '../../core/data/shows.data';
import { AchievementState } from '../../core/models/gamification.model';
import { ArrowverseEpisode } from '../../core/models/episode.model';
import { EpisodePlaybackService } from '../../core/services/episode-playback.service';
import { EpisodeService } from '../../core/services/episode.service';
import { ExtensionBridgeService } from '../../core/services/extension-bridge.service';
import { GamificationService } from '../../core/services/gamification.service';
import { WatchProgressService } from '../../core/services/watch-progress.service';
import { formatEpisodeCode, getShowId } from '../../core/utils/episode.utils';
import { buildTimelineSegments } from '../../core/utils/timeline.utils';
import { CrossoverCardComponent } from '../gamification/crossover-card/crossover-card.component';
import { HeroBannerComponent } from '../gamification/hero-banner/hero-banner.component';
import { EpisodeDashboardComponent } from '../watch-order/episode-dashboard/episode-dashboard.component';

interface ShowProgress {
  showId: string;
  name: string;
  icon: string;
  accent: string;
  watched: number;
  total: number;
  percent: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    CardModule,
    ProgressBarModule,
    TagModule,
    HeroBannerComponent,
    CrossoverCardComponent,
    EpisodeDashboardComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly episodeService = inject(EpisodeService);
  private readonly playback = inject(EpisodePlaybackService);
  private readonly progressService = inject(WatchProgressService);
  private readonly gamification = inject(GamificationService);
  private readonly extensionBridge = inject(ExtensionBridgeService);

  readonly profile = this.gamification.profile;
  readonly extensionConnected = this.extensionBridge.connected;
  readonly extensionSyncWarning = this.extensionBridge.syncWarning;
  readonly extensionLastEvent = this.extensionBridge.lastEvent;
  readonly currentlyPlaying = this.extensionBridge.currentlyPlaying;

  private readonly stats = toSignal(
    toObservable(this.progressService.watched).pipe(
      switchMap((watched) => this.episodeService.getStats(watched)),
    ),
    { initialValue: null },
  );

  private readonly seasonSummaries = toSignal(
    toObservable(this.progressService.watched).pipe(
      switchMap((watched) => this.episodeService.getSeasonSummaries(watched)),
    ),
    { initialValue: [] },
  );

  private readonly episodes = toSignal(this.episodeService.getEpisodes(), {
    initialValue: [] as ArrowverseEpisode[],
  });

  readonly upNext = computed(() => this.stats()?.upNext ?? null);
  readonly progressPercent = computed(() => this.stats()?.progressPercent ?? 0);
  readonly watchedCount = computed(() => this.stats()?.watched ?? 0);
  readonly totalCount = computed(() => this.stats()?.total ?? 0);

  readonly upNextCode = computed(() =>
    this.upNext() ? formatEpisodeCode(this.upNext()!.episode_id) : '',
  );

  readonly showProgress = computed<ShowProgress[]>(() => {
    const summaries = this.seasonSummaries();

    return SHOWS.map((show) => {
      const seasons = summaries.filter((season) => season.showId === show.id);
      const total = seasons.reduce((sum, season) => sum + season.episodeCount, 0);
      const watched = seasons.reduce((sum, season) => sum + season.watchedCount, 0);

      return {
        showId: show.id,
        name: show.name,
        icon: show.icon,
        accent: show.accent,
        watched,
        total,
        percent: total ? Math.round((watched / total) * 100) : 0,
      };
    })
      .filter((show) => show.total > 0)
      .sort((left, right) => right.percent - left.percent || right.watched - left.watched);
  });

  readonly timelineProgress = computed(() => {
    const upNextRow = this.upNext()?.row_number ?? null;
    return buildTimelineSegments(this.episodes(), this.progressService.watched(), upNextRow);
  });

  readonly timelineSummary = computed(() => {
    const segments = this.timelineProgress();
    const complete = segments.filter((segment) => segment.complete).length;
    return {
      complete,
      total: segments.length,
      percent: segments.length ? Math.round((complete / segments.length) * 100) : 0,
    };
  });

  readonly inProgressAchievements = computed(() =>
    this.profile()
      .achievements.filter((achievement) => !achievement.unlocked && achievement.progress > 0)
      .sort(
        (left, right) =>
          right.progress / Math.max(right.total, 1) - left.progress / Math.max(left.total, 1),
      )
      .slice(0, 4),
  );

  readonly unlockedAchievements = computed(() =>
    this.profile()
      .achievements.filter((achievement) => achievement.unlocked)
      .slice(-6)
      .reverse(),
  );

  iconFor(series: string): string {
    return SHOW_BY_NAME.get(series)?.icon ?? 'assets/shows/arrow.jpg';
  }

  showIdFor(series: string): string {
    return getShowId(series);
  }

  playUpNext(): void {
    const next = this.upNext();
    if (!next) {
      return;
    }

    this.playback.openEpisode({
      rowNumber: next.row_number,
      series: next.series,
      episodeId: next.episode_id,
      episodeName: next.episode_name,
    });
  }

  upNextPlayLabel(): string {
    const next = this.upNext();
    if (!next) {
      return 'Play episode';
    }

    return this.playback.buildLink({
      rowNumber: next.row_number,
      series: next.series,
      episodeId: next.episode_id,
      episodeName: next.episode_name,
    }).label;
  }

  achievementPercent(achievement: AchievementState): number {
    return achievement.total ? Math.round((achievement.progress / achievement.total) * 100) : 0;
  }
}

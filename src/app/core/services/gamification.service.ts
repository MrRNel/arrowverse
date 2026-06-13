import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { combineLatest, map } from 'rxjs';

import { ACHIEVEMENTS, CROSSOVER_PART_ROWS, FINALE_ROWS } from '../data/gamification/achievements.data';
import { CROSSOVER_EVENTS } from '../data/gamification/crossovers.data';
import { RANK_TIERS } from '../data/gamification/ranks.data';
import { ArrowverseEpisode } from '../models/episode.model';
import {
  AchievementState,
  CrossoverProgress,
  HeroProfile,
  RankTier,
  XpGain,
} from '../models/gamification.model';
import { EpisodeService } from './episode.service';
import { WatchProgressService } from './watch-progress.service';

const SEEN_ACHIEVEMENTS_KEY = 'arrowverse-seen-achievements';
const BEST_STREAK_KEY = 'arrowverse-best-streak';

@Injectable({ providedIn: 'root' })
export class GamificationService {
  private readonly episodeService = inject(EpisodeService);
  private readonly progressService = inject(WatchProgressService);
  private readonly messages = inject(MessageService);

  private readonly episodes = toSignal(this.episodeService.getEpisodes(), {
    initialValue: [] as ArrowverseEpisode[],
  });

  private readonly profileState = toSignal(
    combineLatest([
      toObservable(this.progressService.watched),
      this.episodeService.getEpisodes(),
    ]).pipe(map(([watched, episodes]) => this.buildProfile(watched, episodes))),
    { initialValue: this.emptyProfile() },
  );

  readonly profile = computed(() => this.profileState() ?? this.emptyProfile());
  readonly lastXpGain = signal<XpGain | null>(null);

  calculateXpGain(rowNumber: number, watched: ReadonlySet<number>): XpGain {
    const episode = this.episodes().find((item) => item.row_number === rowNumber);
    if (!episode) {
      return { base: 0, bonus: 0, total: 0, reasons: [] };
    }

    const reasons: string[] = [];
    let base = 10;
    let bonus = 0;

    reasons.push('Episode logged');

    if (CROSSOVER_PART_ROWS.has(rowNumber)) {
      bonus += 30;
      reasons.push('Crossover event');
    }

    if (FINALE_ROWS.has(rowNumber)) {
      bonus += 50;
      reasons.push('Series milestone');
    } else if (this.isSeasonFinale(episode)) {
      bonus += 25;
      reasons.push('Season finale');
    }

    const streak = this.calculateStreak(watched);
    const streakBonus = Math.min(streak * 5, 50);
    if (streakBonus > 0) {
      bonus += streakBonus;
      reasons.push(`Timeline integrity +${streakBonus}`);
    }

    return { base, bonus, total: base + bonus, reasons };
  }

  async handleWatchChange(rowNumber: number, isWatched: boolean): Promise<void> {
    if (!isWatched) {
      this.messages.add({
        severity: 'warn',
        summary: 'Flashpoint Paradox',
        detail: 'Timeline altered. Progress and streak recalculated.',
        life: 3500,
      });
      return;
    }

    const watched = this.progressService.watched();
    const gain = this.calculateXpGain(rowNumber, watched);
    this.lastXpGain.set(gain);

    this.messages.add({
      severity: 'success',
      summary: `+${gain.total} XP`,
      detail: gain.reasons.join(' · '),
      life: 3000,
    });

    this.notifyNewAchievements(watched);
  }

  getRankForCount(watchedCount: number): RankTier {
    let current = RANK_TIERS[0];
    for (const tier of RANK_TIERS) {
      if (watchedCount >= tier.minEpisodes) {
        current = tier;
      }
    }
    return current;
  }

  private buildProfile(watched: ReadonlySet<number>, episodes: ArrowverseEpisode[]): HeroProfile {
    const watchedCount = episodes.filter((episode) => watched.has(episode.row_number)).length;
    const rank = this.getRankForCount(watchedCount);
    const nextRank = RANK_TIERS.find((tier) => tier.minEpisodes > watchedCount) ?? null;
    const streak = this.calculateStreak(watched);
    const bestStreak = this.updateBestStreak(streak);
    const xp = this.calculateTotalXp(watched, episodes);
    const achievements = this.buildAchievements(watched, episodes, streak);
    const unlockedCount = achievements.filter((item) => item.unlocked).length;
    const upNext = episodes.find((episode) => !watched.has(episode.row_number)) ?? null;
    const activeCrossover = upNext ? this.getCrossoverProgress(upNext.row_number, watched) : null;

    let rankProgress = 100;
    if (nextRank) {
      const span = nextRank.minEpisodes - rank.minEpisodes;
      const progress = watchedCount - rank.minEpisodes;
      rankProgress = span > 0 ? Math.round((progress / span) * 100) : 0;
    }

    return {
      rank,
      nextRank,
      xp,
      rankProgress,
      streak,
      bestStreak,
      achievements,
      unlockedCount,
      activeCrossover,
      continuityPercent: episodes.length
        ? Math.round((watchedCount / episodes.length) * 100)
        : 0,
    };
  }

  private buildAchievements(
    watched: ReadonlySet<number>,
    episodes: ArrowverseEpisode[],
    streak: number,
  ): AchievementState[] {
    const seriesRows = this.groupRowsBySeries(episodes);

    return ACHIEVEMENTS.map((achievement) => {
      if (achievement.rows) {
        const total = achievement.rows.length;
        const progress = achievement.rows.filter((row) => watched.has(row)).length;
        return {
          ...achievement,
          unlocked: progress === total,
          progress,
          total,
        };
      }

      if (achievement.series === '__trinity__') {
        const trinity = ['Arrow', 'The Flash', 'Supergirl'];
        const total = trinity.length;
        const progress = trinity.filter((series) =>
          (seriesRows.get(series) ?? []).every((row) => watched.has(row)),
        ).length;
        return { ...achievement, unlocked: progress === total, progress, total };
      }

      if (achievement.series) {
        const rows = seriesRows.get(achievement.series) ?? [];
        const total = rows.length;
        const progress = rows.filter((row) => watched.has(row)).length;
        return { ...achievement, unlocked: total > 0 && progress === total, progress, total };
      }

      if (achievement.minStreak) {
        return {
          ...achievement,
          unlocked: streak >= achievement.minStreak,
          progress: Math.min(streak, achievement.minStreak),
          total: achievement.minStreak,
        };
      }

      return { ...achievement, unlocked: false, progress: 0, total: 1 };
    });
  }

  private getCrossoverProgress(upNextRow: number, watched: ReadonlySet<number>): CrossoverProgress | null {
    const event = CROSSOVER_EVENTS.find((item) => item.rows.includes(upNextRow));
    if (!event) {
      return null;
    }

    const watchedCount = event.rows.filter((row) => watched.has(row)).length;
    const nextRow = event.rows.find((row) => !watched.has(row)) ?? null;

    return {
      event,
      watchedCount,
      total: event.rows.length,
      percent: Math.round((watchedCount / event.rows.length) * 100),
      complete: watchedCount === event.rows.length,
      nextRow,
    };
  }

  private calculateStreak(watched: ReadonlySet<number>): number {
    let streak = 0;
    for (let row = 1; watched.has(row); row += 1) {
      streak = row;
    }
    return streak;
  }

  private calculateTotalXp(watched: ReadonlySet<number>, episodes: ArrowverseEpisode[]): number {
    let total = 0;

    for (const episode of episodes) {
      if (!watched.has(episode.row_number)) {
        continue;
      }

      total += 10;

      if (CROSSOVER_PART_ROWS.has(episode.row_number)) {
        total += 30;
      }

      if (FINALE_ROWS.has(episode.row_number)) {
        total += 50;
      } else if (this.isSeasonFinale(episode)) {
        total += 25;
      }
    }

    return total;
  }

  private isSeasonFinale(episode: ArrowverseEpisode): boolean {
    const seasonEpisodes = this.episodes().filter(
      (item) => item.series === episode.series && item.episode_id.slice(0, 3) === episode.episode_id.slice(0, 3),
    );
    const maxEpisode = Math.max(
      ...seasonEpisodes.map((item) => Number(item.episode_id.match(/E(\d+)/i)?.[1] ?? 0)),
    );
    const currentEpisode = Number(episode.episode_id.match(/E(\d+)/i)?.[1] ?? 0);
    return currentEpisode === maxEpisode;
  }

  private groupRowsBySeries(episodes: ArrowverseEpisode[]): Map<string, number[]> {
    const map = new Map<string, number[]>();
    for (const episode of episodes) {
      const rows = map.get(episode.series) ?? [];
      rows.push(episode.row_number);
      map.set(episode.series, rows);
    }
    return map;
  }

  private notifyNewAchievements(watched: ReadonlySet<number>): void {
    const episodes = this.episodes();
    const streak = this.calculateStreak(watched);
    const achievements = this.buildAchievements(watched, episodes, streak);
    const seen = this.loadSeenAchievements();

    for (const achievement of achievements) {
      if (!achievement.unlocked || seen.has(achievement.id)) {
        continue;
      }

      seen.add(achievement.id);
      this.messages.add({
        severity: 'info',
        summary: `Achievement: ${achievement.name}`,
        detail: achievement.description,
        life: 5000,
      });
    }

    this.saveSeenAchievements(seen);
  }

  private updateBestStreak(streak: number): number {
    const previous = Number(localStorage.getItem(BEST_STREAK_KEY) ?? 0);
    const best = Math.max(previous, streak);
    localStorage.setItem(BEST_STREAK_KEY, String(best));
    return best;
  }

  private loadSeenAchievements(): Set<string> {
    try {
      const raw = localStorage.getItem(SEEN_ACHIEVEMENTS_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  }

  private saveSeenAchievements(seen: Set<string>): void {
    localStorage.setItem(SEEN_ACHIEVEMENTS_KEY, JSON.stringify([...seen]));
  }

  private emptyProfile(): HeroProfile {
    return {
      rank: RANK_TIERS[0],
      nextRank: RANK_TIERS[1] ?? null,
      xp: 0,
      rankProgress: 0,
      streak: 0,
      bestStreak: 0,
      achievements: [],
      unlockedCount: 0,
      activeCrossover: null,
      continuityPercent: 0,
    };
  }
}

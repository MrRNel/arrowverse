import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';

import { AchievementCategory } from '../../../core/models/gamification.model';
import { GamificationService } from '../../../core/services/gamification.service';
import { HeroBannerComponent } from '../hero-banner/hero-banner.component';

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  crossover: 'Crossover Events',
  legacy: 'Legacy Arcs',
  'found-family': 'Found Family',
  multiverse: 'Multiverse',
  timeline: 'Timeline Integrity',
  origins: 'Origins',
};

const CATEGORY_ORDER: AchievementCategory[] = [
  'crossover',
  'legacy',
  'found-family',
  'multiverse',
  'timeline',
  'origins',
];

@Component({
  selector: 'app-hero-codex',
  imports: [CardModule, TagModule, HeroBannerComponent],
  templateUrl: './hero-codex.component.html',
  styleUrl: './hero-codex.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroCodexComponent {
  readonly gamification = inject(GamificationService);
  readonly profile = this.gamification.profile;
  readonly categoryLabels = CATEGORY_LABELS;
  readonly categoryOrder = CATEGORY_ORDER;

  readonly groupedAchievements = computed(() => {
    const groups = new Map<AchievementCategory, ReturnType<typeof this.profile>['achievements']>();

    for (const achievement of this.profile().achievements) {
      const current = groups.get(achievement.category) ?? [];
      current.push(achievement);
      groups.set(achievement.category, current);
    }

    return CATEGORY_ORDER.filter((category) => groups.has(category)).map((category) => [
      category,
      groups.get(category)!,
    ] as const);
  });
}

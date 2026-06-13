import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CrossoverCardComponent } from '../gamification/crossover-card/crossover-card.component';
import { HeroBannerComponent } from '../gamification/hero-banner/hero-banner.component';
import { EpisodeDashboardComponent } from './episode-dashboard/episode-dashboard.component';
import { EpisodeListComponent } from '../../shared/episode-list/episode-list.component';

@Component({
  selector: 'app-watch-order',
  imports: [
    HeroBannerComponent,
    CrossoverCardComponent,
    EpisodeDashboardComponent,
    EpisodeListComponent,
  ],
  template: `
    <div class="page">
      <header class="page__header">
        <div>
          <p class="page__eyebrow">Multiverse continuity mission</p>
          <h1>Watch Order</h1>
          <p class="page__subtitle">
            Earn XP, protect the timeline, and survive every Crisis in crossover-aware order.
          </p>
        </div>
      </header>

      <app-hero-banner />
      <app-crossover-card />
      <app-episode-dashboard />
      <app-episode-list title="Complete Watch Order" />
    </div>
  `,
  styleUrl: './watch-order.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchOrderComponent {}

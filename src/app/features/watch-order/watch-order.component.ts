import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EpisodeListComponent } from '../../shared/episode-list/episode-list.component';

@Component({
  selector: 'app-watch-order',
  imports: [RouterLink, EpisodeListComponent],
  template: `
    <div class="page">
      <header class="page__header">
        <div>
          <p class="page__eyebrow">Multiverse continuity mission</p>
          <h1>Watch Order</h1>
          <p class="page__subtitle">
            The full crossover timeline — mark episodes unwatched, in progress, or finished.
            <a routerLink="/dashboard">Back to dashboard</a>
          </p>
        </div>
      </header>

      <app-episode-list title="Complete Watch Order" />
    </div>
  `,
  styleUrl: './watch-order.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WatchOrderComponent {}

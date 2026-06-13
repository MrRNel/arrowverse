import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SHOW_BY_ID } from '../../../core/data/shows.data';
import { EpisodeListComponent } from '../../../shared/episode-list/episode-list.component';

@Component({
  selector: 'app-season-detail',
  imports: [RouterLink, EpisodeListComponent],
  templateUrl: './season-detail.component.html',
  styleUrl: './season-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonDetailComponent {
  readonly showId = input.required<string>();
  readonly season = input.required({
    transform: (value: string | number) => Number(value),
  });

  readonly show = computed(() => SHOW_BY_ID.get(this.showId()) ?? null);
}

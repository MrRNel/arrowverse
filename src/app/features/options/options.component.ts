import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';

import { SHOWS } from '../../core/data/shows.data';
import {
  DEFAULT_JELLYFIN_URL,
  SERIES_PLAYBACK_SOURCE_OPTIONS,
  SeriesPlaybackSource,
} from '../../core/models/playback.model';
import { UserSettingsService } from '../../core/services/user-settings.service';

@Component({
  selector: 'app-options',
  imports: [FormsModule, CardModule, SelectModule],
  templateUrl: './options.component.html',
  styleUrl: './options.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsComponent {
  readonly settings = inject(UserSettingsService);
  readonly shows = SHOWS;
  readonly sourceOptions = SERIES_PLAYBACK_SOURCE_OPTIONS;
  readonly defaultJellyfinUrl = DEFAULT_JELLYFIN_URL;

  readonly jellyfinDraft = signal(DEFAULT_JELLYFIN_URL);
  readonly savingJellyfin = signal(false);

  constructor() {
    void this.settings.init().then(() => {
      this.jellyfinDraft.set(this.settings.jellyfinUrl());
    });
  }

  async saveJellyfinUrl(): Promise<void> {
    const value = this.jellyfinDraft().trim();
    if (!value || value === this.settings.jellyfinUrl()) {
      return;
    }

    this.savingJellyfin.set(true);
    try {
      await this.settings.setJellyfinUrl(value);
      this.jellyfinDraft.set(this.settings.jellyfinUrl());
    } finally {
      this.savingJellyfin.set(false);
    }
  }

  async onSeriesSourceChange(showId: string, source: SeriesPlaybackSource): Promise<void> {
    await this.settings.setSeriesSource(showId, source);
  }
}

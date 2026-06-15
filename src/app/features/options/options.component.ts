import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';

import { SHOWS } from '../../core/data/shows.data';
import {
  DEFAULT_JELLYFIN_HOSTS,
  DEFAULT_JELLYFIN_URL,
  SERIES_PLAYBACK_SOURCE_OPTIONS,
  SeriesPlaybackSource,
} from '../../core/models/playback.model';
import { UserSettingsService } from '../../core/services/user-settings.service';
import { ExtensionBridgeService } from '../../core/services/extension-bridge.service';

@Component({
  selector: 'app-options',
  imports: [FormsModule, CardModule, SelectModule],
  templateUrl: './options.component.html',
  styleUrl: './options.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsComponent {
  readonly settings = inject(UserSettingsService);
  private readonly extensionBridge = inject(ExtensionBridgeService);
  readonly shows = SHOWS;
  readonly sourceOptions = SERIES_PLAYBACK_SOURCE_OPTIONS;
  readonly defaultJellyfinUrl = DEFAULT_JELLYFIN_URL;
  readonly defaultJellyfinHosts = [...DEFAULT_JELLYFIN_HOSTS];
  readonly defaultJellyfinHostsPlaceholder = DEFAULT_JELLYFIN_HOSTS.join('\n');

  readonly jellyfinDraft = signal(DEFAULT_JELLYFIN_URL);
  readonly jellyfinHostsDraft = signal(DEFAULT_JELLYFIN_HOSTS.join('\n'));
  readonly savingJellyfin = signal(false);
  readonly savingJellyfinHosts = signal(false);

  constructor() {
    void this.settings.init().then(() => {
      this.jellyfinDraft.set(this.settings.jellyfinUrl());
      this.jellyfinHostsDraft.set(this.settings.jellyfinHostsDraft(this.settings.jellyfinHosts()));
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
      this.extensionBridge.syncUserSettings();
    } finally {
      this.savingJellyfin.set(false);
    }
  }

  async saveJellyfinHosts(): Promise<void> {
    const parsed = this.settings.parseJellyfinHostsDraft(this.jellyfinHostsDraft());
    const current = this.settings.jellyfinHosts();
    if (
      parsed.length === current.length &&
      parsed.every((host, index) => host === current[index])
    ) {
      return;
    }

    this.savingJellyfinHosts.set(true);
    try {
      await this.settings.setJellyfinHosts(parsed);
      this.jellyfinHostsDraft.set(this.settings.jellyfinHostsDraft(this.settings.jellyfinHosts()));
      this.extensionBridge.syncUserSettings();
    } finally {
      this.savingJellyfinHosts.set(false);
    }
  }

  async onSeriesSourceChange(showId: string, source: SeriesPlaybackSource): Promise<void> {
    await this.settings.setSeriesSource(showId, source);
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  DEFAULT_JELLYFIN_HOSTS,
  DEFAULT_JELLYFIN_URL,
  SeriesPlaybackSource,
  seriesPlaybackSourceLabel,
} from '../models/playback.model';
import { AuthService } from './auth.service';

interface UserSettingsResponse {
  jellyfin_url: string;
  jellyfin_hosts: string[];
  series_sources: Record<string, SeriesPlaybackSource>;
}

interface UserSettingsPatch {
  jellyfin_url?: string;
  jellyfin_hosts?: string[];
  series_sources?: Record<string, SeriesPlaybackSource>;
}

@Injectable({ providedIn: 'root' })
export class UserSettingsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private initPromise: Promise<void> | null = null;
  private readonly ready = signal(false);
  readonly isReady = this.ready.asReadonly();

  private readonly jellyfinUrlSignal = signal(DEFAULT_JELLYFIN_URL);
  private readonly jellyfinHostsSignal = signal<string[]>([...DEFAULT_JELLYFIN_HOSTS]);
  private readonly seriesSourcesSignal = signal<ReadonlyMap<string, SeriesPlaybackSource>>(
    new Map(),
  );

  readonly jellyfinUrl = this.jellyfinUrlSignal.asReadonly();
  readonly jellyfinHosts = this.jellyfinHostsSignal.asReadonly();
  readonly seriesSources = this.seriesSourcesSignal.asReadonly();

  readonly seriesSourceEntries = computed(() => [...this.seriesSourcesSignal().entries()]);

  async init(): Promise<void> {
    if (this.ready()) {
      return;
    }

    if (!this.initPromise) {
      this.initPromise = this.bootstrap();
    }

    await this.initPromise;
  }

  async reload(): Promise<void> {
    this.ready.set(false);
    this.initPromise = null;
    await this.init();
  }

  getSeriesSource(showId: string): SeriesPlaybackSource {
    return this.seriesSourcesSignal().get(showId) ?? 'jellyfin';
  }

  seriesSourceLabel(showId: string): string {
    return seriesPlaybackSourceLabel(this.getSeriesSource(showId));
  }

  async setJellyfinUrl(value: string): Promise<void> {
    const trimmed = value.trim().replace(/\/+$/, '');
    if (!trimmed) {
      return;
    }

    await this.patchSettings({ jellyfin_url: trimmed });
  }

  async setJellyfinHosts(hosts: string[]): Promise<void> {
    const cleaned = this.sanitizeJellyfinHosts(hosts);
    await this.patchSettings({ jellyfin_hosts: cleaned });
  }

  jellyfinHostsDraft(hosts: string[]): string {
    return hosts.join('\n');
  }

  parseJellyfinHostsDraft(draft: string): string[] {
    return draft
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  sanitizeJellyfinHosts(hosts: string[]): string[] {
    const cleaned: string[] = [];
    const seen = new Set<string>();

    for (const entry of hosts) {
      const normalized = this.normalizeJellyfinHost(entry);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      cleaned.push(normalized);
      if (cleaned.length >= 32) {
        break;
      }
    }

    return cleaned.length ? cleaned : [...DEFAULT_JELLYFIN_HOSTS];
  }

  async setSeriesSource(showId: string, source: SeriesPlaybackSource): Promise<void> {
    await this.patchSettings({ series_sources: { [showId]: source } });
  }

  private async bootstrap(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.resetDefaults();
      this.ready.set(true);
      return;
    }

    const response = await firstValueFrom(
      this.http.get<UserSettingsResponse>(`${environment.apiUrl}/users/me/settings`),
    );
    this.applyResponse(response);
    this.ready.set(true);
  }

  private async patchSettings(payload: UserSettingsPatch): Promise<void> {
    await this.init();

    if (!this.auth.isAuthenticated()) {
      this.applyPatchLocally(payload);
      return;
    }

    const response = await firstValueFrom(
      this.http.patch<UserSettingsResponse>(`${environment.apiUrl}/users/me/settings`, payload),
    );
    this.applyResponse(response);
  }

  private applyPatchLocally(payload: UserSettingsPatch): void {
    if (payload.jellyfin_url) {
      this.jellyfinUrlSignal.set(payload.jellyfin_url);
    }

    if (payload.jellyfin_hosts) {
      this.jellyfinHostsSignal.set(this.sanitizeJellyfinHosts(payload.jellyfin_hosts));
    }

    if (payload.series_sources) {
      const next = new Map(this.seriesSourcesSignal());
      for (const [showId, source] of Object.entries(payload.series_sources)) {
        next.set(showId, source);
      }
      this.seriesSourcesSignal.set(next);
    }
  }

  private applyResponse(response: UserSettingsResponse): void {
    const jellyfinUrl = response.jellyfin_url?.trim() || DEFAULT_JELLYFIN_URL;
    this.jellyfinUrlSignal.set(jellyfinUrl);
    this.jellyfinHostsSignal.set(
      this.sanitizeJellyfinHosts(response.jellyfin_hosts ?? [...DEFAULT_JELLYFIN_HOSTS]),
    );
    this.seriesSourcesSignal.set(new Map(Object.entries(response.series_sources ?? {})));
  }

  private resetDefaults(): void {
    this.jellyfinUrlSignal.set(DEFAULT_JELLYFIN_URL);
    this.jellyfinHostsSignal.set([...DEFAULT_JELLYFIN_HOSTS]);
    this.seriesSourcesSignal.set(new Map());
  }

  private normalizeJellyfinHost(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const host = new URL(trimmed).hostname;
        return host ? host.toLowerCase() : null;
      } catch {
        return null;
      }
    }

    const host = trimmed.replace(/^\[|\]$/g, '').toLowerCase();
    if (
      /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(host) ||
      /^[0-9a-f:]+$/i.test(host) ||
      /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(
        host,
      )
    ) {
      return host;
    }

    return null;
  }
}

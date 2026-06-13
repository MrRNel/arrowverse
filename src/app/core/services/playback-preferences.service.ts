import { Injectable, signal } from '@angular/core';

const JELLYFIN_URL_KEY = 'arrowverse.playback.jellyfinUrl';
const DEFAULT_JELLYFIN_URL = 'http://localhost:8096';

@Injectable({ providedIn: 'root' })
export class PlaybackPreferencesService {
  private readonly jellyfinUrlSignal = signal(this.readJellyfinUrl());

  readonly jellyfinUrl = this.jellyfinUrlSignal.asReadonly();

  setJellyfinUrl(value: string): void {
    const trimmed = value.trim().replace(/\/+$/, '');
    localStorage.setItem(JELLYFIN_URL_KEY, trimmed);
    this.jellyfinUrlSignal.set(trimmed);
  }

  private readJellyfinUrl(): string {
    return localStorage.getItem(JELLYFIN_URL_KEY)?.trim() || DEFAULT_JELLYFIN_URL;
  }
}

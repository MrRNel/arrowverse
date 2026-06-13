import { Injectable, inject, NgZone, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { take } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ExtensionAuthStateMessage,
  ExtensionBridgeMessage,
  ExtensionBridgeResponse,
  ExtensionEpisodePayload,
  ExtensionSyncStateMessage,
  ExtensionSyncWarningMessage,
  ExtensionSyncWarningState,
} from '../models/extension-bridge.model';
import { ArrowverseEpisode } from '../models/episode.model';
import { AuthService } from './auth.service';
import { EpisodeService } from './episode.service';
import { GamificationService } from './gamification.service';
import { WatchProgressService } from './watch-progress.service';

const BRIDGE_SOURCE = 'arrowverse-extension';
const APP_SOURCE = 'arrowverse-app';
const EXTENSION_LINKED_KEY = 'arrowverse.extensionLinked';

@Injectable({ providedIn: 'root' })
export class ExtensionBridgeService {
  private readonly auth = inject(AuthService);
  private readonly progressService = inject(WatchProgressService);
  private readonly episodeService = inject(EpisodeService);
  private readonly gamificationService = inject(GamificationService);
  private readonly messages = inject(MessageService);
  private readonly ngZone = inject(NgZone);

  private readonly connectedSignal = signal(false);
  private readonly lastEventSignal = signal<string | null>(null);
  private readonly syncWarningSignal = signal<ExtensionSyncWarningState | null>(null);
  private initialized = false;

  readonly connected = this.connectedSignal.asReadonly();
  readonly lastEvent = this.lastEventSignal.asReadonly();
  readonly syncWarning = this.syncWarningSignal.asReadonly();

  init(): void {
    if (this.initialized || !environment.extensionBridgeEnabled) {
      return;
    }

    this.initialized = true;
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      const data = event.data as ExtensionBridgeMessage | ExtensionBridgeResponse;
      if (!data || typeof data !== 'object' || !('source' in data)) {
        return;
      }

      if (data.source === APP_SOURCE) {
        return;
      }

      if (data.source !== BRIDGE_SOURCE) {
        return;
      }

      void this.ngZone.run(() => this.handleExtensionMessage(data as ExtensionBridgeMessage));
    });

    void this.bootstrapBridge();
  }

  private async bootstrapBridge(): Promise<void> {
    await this.auth.init();
    await this.progressService.init();
    await this.publishAuthState();
    this.publishSyncState();
    this.postToExtension({ source: APP_SOURCE, type: 'PONG' });
  }

  private async handleExtensionMessage(message: ExtensionBridgeMessage): Promise<void> {
    await this.progressService.init();
    this.connectedSignal.set(true);

    switch (message.type) {
      case 'PING':
        this.postToExtension({ source: APP_SOURCE, type: 'PONG' });
        await this.publishAuthState();
        this.publishSyncState();
        break;

      case 'EPISODE_STARTED':
        if (message.payload) {
          this.notifyEpisodeStarted(message.payload);
        }
        break;

      case 'EPISODE_COMPLETED':
        if (message.payload) {
          await this.markEpisodeCompleted(message.payload);
        }
        break;

      case 'EPISODE_PARTIAL':
        if (message.payload) {
          await this.markEpisodePartial(message.payload);
        }
        break;

      case 'SYNC_PENDING':
        if (message.pending?.length) {
          for (const episode of message.pending) {
            await this.markEpisodeCompleted(episode, false);
          }
          this.messages.add({
            severity: 'info',
            summary: 'Extension Sync',
            detail: `Synced ${message.pending.length} episode(s) from the browser extension.`,
            life: 4000,
          });
          this.publishSyncState();
        }
        break;
    }

    this.postToExtension({ source: APP_SOURCE, type: 'ACK' });
  }

  private async markEpisodePartial(episode: ExtensionEpisodePayload): Promise<void> {
    if (this.progressService.isWatched(episode.row_number)) {
      return;
    }

    await this.progressService.setStatus(episode.row_number, 'partial', 'extension');
    this.lastEventSignal.set(
      `${episode.series} · ${episode.episode_id} · in progress`,
    );
    this.publishSyncState();
  }

  private async markEpisodeCompleted(
    episode: ExtensionEpisodePayload,
    showToast = true,
  ): Promise<void> {
    if (this.progressService.isWatched(episode.row_number)) {
      return;
    }

    await this.progressService.setWatched(episode.row_number, true, 'extension');
    await this.gamificationService.handleWatchChange(episode.row_number, true);

    this.syncWarningSignal.set(null);

    this.lastEventSignal.set(
      `${episode.series} · ${episode.episode_id} · ${episode.episode_name}`,
    );

    if (showToast) {
      this.messages.add({
        severity: 'success',
        summary: 'Extension Sync',
        detail: `Marked #${episode.row_number} ${episode.episode_name} as watched.`,
        life: 5000,
      });
    }

    this.publishSyncState();
  }

  private notifyEpisodeStarted(episode: ExtensionEpisodePayload): void {
    this.lastEventSignal.set(
      `${episode.series} · ${episode.episode_id} · ${episode.episode_name}`,
    );

    this.messages.add({
      severity: 'info',
      summary: 'Arrowverse Detected',
      detail: `#${episode.row_number} ${episode.series} — ${episode.episode_name} (${episode.episode_id})`,
      life: 6000,
    });

    this.checkAndWarnOutOfSync(episode);
  }

  private checkAndWarnOutOfSync(playing: ExtensionEpisodePayload): void {
    this.episodeService
      .getEpisodes()
      .pipe(take(1))
      .subscribe((episodes) => {
        const warning = this.buildSyncWarning(playing, episodes);
        if (!warning) {
          this.syncWarningSignal.set(null);
          return;
        }

        this.syncWarningSignal.set({
          playing: warning.playing,
          upNext: warning.upNext,
          skippedCount: warning.skippedCount,
        });

        this.postToExtension(warning);

        this.messages.add({
          severity: 'warn',
          summary: 'Out of Watch Order',
          detail: `You're on #${playing.row_number} ${playing.series} · ${playing.episode_name}, but up next is #${warning.upNext.row_number} ${warning.upNext.series} · ${warning.upNext.episode_name}.`,
          life: 9000,
        });
      });
  }

  private buildSyncWarning(
    playing: ExtensionEpisodePayload,
    episodes: ArrowverseEpisode[],
  ): ExtensionSyncWarningMessage | null {
    const watched = this.progressService.watched();

    if (watched.has(playing.row_number)) {
      return null;
    }

    const upNext = episodes.find((episode) => !watched.has(episode.row_number)) ?? null;
    if (!upNext || playing.row_number <= upNext.row_number) {
      return null;
    }

    return {
      source: APP_SOURCE,
      type: 'SYNC_WARNING',
      playing,
      upNext: this.toPayload(upNext),
      skippedCount: playing.row_number - upNext.row_number,
    };
  }

  private publishSyncState(): void {
    this.episodeService
      .getStats(this.progressService.watched())
      .pipe(take(1))
      .subscribe((stats) => {
        const message: ExtensionSyncStateMessage = {
          source: APP_SOURCE,
          type: 'SYNC_STATE',
          watchedRows: [...this.progressService.watched()],
          upNext: stats.upNext ? this.toPayload(stats.upNext) : null,
        };
        this.postToExtension(message);
      });
  }

  private async publishAuthState(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.postAuthState(null, null, null, null);
      return;
    }

    let refreshToken = this.auth.session().refreshToken;
    if (!sessionStorage.getItem(EXTENSION_LINKED_KEY)) {
      try {
        const link = await this.auth.linkExtensionDevice();
        refreshToken = link.refresh_token;
        sessionStorage.setItem(EXTENSION_LINKED_KEY, '1');
      } catch {
        // Extension linking can wait until the user opens the tracker with the extension connected.
      }
    }

    this.postAuthState(
      this.auth.session().accessToken,
      refreshToken,
      this.auth.session().expiresAt,
      this.auth.session().user,
    );
  }

  private postAuthState(
    accessToken: string | null,
    refreshToken: string | null,
    expiresAt: number | null,
    user: ExtensionAuthStateMessage['user'],
  ): void {
    const message: ExtensionAuthStateMessage = {
      source: APP_SOURCE,
      type: 'AUTH_STATE',
      accessToken,
      refreshToken,
      expiresAt,
      user,
    };
    this.postToExtension(message);
  }

  private toPayload(episode: ArrowverseEpisode): ExtensionEpisodePayload {
    return {
      row_number: episode.row_number,
      series: episode.series,
      episode_id: episode.episode_id,
      episode_name: episode.episode_name,
      air_date: episode.air_date,
    };
  }

  private postToExtension(
    message:
      | ExtensionBridgeResponse
      | ExtensionSyncStateMessage
      | ExtensionSyncWarningMessage
      | ExtensionAuthStateMessage,
  ): void {
    window.postMessage(message, window.location.origin);
  }
}

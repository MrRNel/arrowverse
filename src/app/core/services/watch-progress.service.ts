import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { normalizeWatchSource, WatchSource } from '../models/playback.model';
import { AuthService } from './auth.service';

export type EpisodeWatchStatus = 'unwatched' | 'partial' | 'watched';

interface WatchedEpisodeRecord {
  row_number: number;
  source: string;
  play_item_id?: string | null;
  status: EpisodeWatchStatus;
}

interface ProgressResponse {
  watched_rows: number[];
  partial_rows: number[];
  watched: WatchedEpisodeRecord[];
}

interface ProgressUpdatePayload {
  status: EpisodeWatchStatus;
  source?: WatchSource;
  play_item_id?: string | null;
}

export interface EpisodeProgressMeta {
  source: WatchSource;
  playItemId: string | null;
}

@Injectable({ providedIn: 'root' })
export class WatchProgressService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private initPromise: Promise<void> | null = null;
  private readonly ready = signal(false);
  readonly isReady = this.ready.asReadonly();
  private readonly watchedRows = signal<ReadonlySet<number>>(new Set());
  private readonly partialRows = signal<ReadonlySet<number>>(new Set());
  private readonly episodeMeta = signal<ReadonlyMap<number, EpisodeProgressMeta>>(new Map());

  readonly watched = this.watchedRows.asReadonly();
  readonly partial = this.partialRows.asReadonly();
  readonly completedRows = computed(() => this.watchedRows());

  async init(): Promise<void> {
    if (this.ready()) {
      return;
    }

    if (!this.initPromise) {
      this.initPromise = this.bootstrap();
    }

    await this.initPromise;
  }

  private async bootstrap(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.watchedRows.set(new Set());
      this.partialRows.set(new Set());
      this.episodeMeta.set(new Map());
      this.ready.set(true);
      return;
    }

    const response = await firstValueFrom(
      this.http.get<ProgressResponse>(`${environment.apiUrl}/progress`),
    );
    this.applyResponse(response);
    this.ready.set(true);
  }

  async reload(): Promise<void> {
    this.ready.set(false);
    this.initPromise = null;
    await this.init();
  }

  getStatus(rowNumber: number): EpisodeWatchStatus {
    if (this.watchedRows().has(rowNumber)) {
      return 'watched';
    }
    if (this.partialRows().has(rowNumber)) {
      return 'partial';
    }
    return 'unwatched';
  }

  getSource(rowNumber: number): WatchSource {
    return this.episodeMeta().get(rowNumber)?.source ?? 'manual';
  }

  getPlayItemId(rowNumber: number): string | null {
    return this.episodeMeta().get(rowNumber)?.playItemId ?? null;
  }

  isWatched(rowNumber: number): boolean {
    return this.watchedRows().has(rowNumber);
  }

  isPartial(rowNumber: number): boolean {
    return this.partialRows().has(rowNumber);
  }

  isComplete(rowNumber: number): boolean {
    return this.isWatched(rowNumber);
  }

  async setStatus(
    rowNumber: number,
    status: EpisodeWatchStatus,
    source?: WatchSource,
    playItemId?: string | null,
  ): Promise<void> {
    await this.init();

    const payload: ProgressUpdatePayload = {
      status,
      source: source ?? this.getSource(rowNumber),
    };

    if (playItemId !== undefined) {
      payload.play_item_id = playItemId;
    }

    const response = await firstValueFrom(
      this.http.put<ProgressResponse>(`${environment.apiUrl}/progress/${rowNumber}`, payload),
    );

    this.applyResponse(response);
  }

  async setSource(rowNumber: number, source: WatchSource): Promise<void> {
    const status = this.getStatus(rowNumber);
    if (status === 'unwatched') {
      return;
    }

    await this.setStatus(rowNumber, status, source);
  }

  async setWatched(
    rowNumber: number,
    watched: boolean,
    source: WatchSource = 'manual',
    playItemId?: string | null,
  ): Promise<void> {
    await this.setStatus(rowNumber, watched ? 'watched' : 'unwatched', source, playItemId);
  }

  async toggleWatched(rowNumber: number): Promise<void> {
    await this.setStatus(rowNumber, this.isWatched(rowNumber) ? 'unwatched' : 'watched', 'manual');
  }

  async bulkMark(
    rowNumbers: number[],
    source: WatchSource = 'extension',
    playItemId?: string | null,
  ): Promise<void> {
    await this.init();

    const response = await firstValueFrom(
      this.http.post<ProgressResponse>(`${environment.apiUrl}/progress/bulk`, {
        row_numbers: rowNumbers,
        source,
        play_item_id: playItemId ?? null,
      }),
    );

    this.applyResponse(response);
  }

  private applyResponse(response: ProgressResponse): void {
    this.watchedRows.set(new Set(response.watched_rows ?? []));
    this.partialRows.set(new Set(response.partial_rows ?? []));

    const meta = new Map<number, EpisodeProgressMeta>();
    for (const record of response.watched ?? []) {
      meta.set(record.row_number, {
        source: normalizeWatchSource(record.source),
        playItemId: record.play_item_id ?? null,
      });
    }
    this.episodeMeta.set(meta);
  }
}

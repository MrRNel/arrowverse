import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export type EpisodeWatchStatus = 'unwatched' | 'partial' | 'watched';

interface ProgressResponse {
  watched_rows: number[];
  partial_rows: number[];
}

interface ProgressUpdatePayload {
  status: EpisodeWatchStatus;
  source?: 'manual' | 'extension';
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
    source: 'manual' | 'extension' = 'manual',
  ): Promise<void> {
    await this.init();

    const payload: ProgressUpdatePayload = { status, source };
    const response = await firstValueFrom(
      this.http.put<ProgressResponse>(`${environment.apiUrl}/progress/${rowNumber}`, payload),
    );

    this.applyResponse(response);
  }

  async setWatched(rowNumber: number, watched: boolean, source: 'manual' | 'extension' = 'manual'): Promise<void> {
    await this.setStatus(rowNumber, watched ? 'watched' : 'unwatched', source);
  }

  async toggleWatched(rowNumber: number): Promise<void> {
    await this.setStatus(rowNumber, this.isWatched(rowNumber) ? 'unwatched' : 'watched', 'manual');
  }

  async bulkMark(rowNumbers: number[], source: 'manual' | 'extension' = 'extension'): Promise<void> {
    await this.init();

    const response = await firstValueFrom(
      this.http.post<ProgressResponse>(`${environment.apiUrl}/progress/bulk`, {
        row_numbers: rowNumbers,
        source,
      }),
    );

    this.applyResponse(response);
  }

  private applyResponse(response: ProgressResponse): void {
    this.watchedRows.set(new Set(response.watched_rows ?? []));
    this.partialRows.set(new Set(response.partial_rows ?? []));
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

interface ProgressResponse {
  watched_rows: number[];
}

interface ProgressUpdatePayload {
  watched: boolean;
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

  readonly watched = this.watchedRows.asReadonly();

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
      this.ready.set(true);
      return;
    }

    const response = await firstValueFrom(
      this.http.get<ProgressResponse>(`${environment.apiUrl}/progress`),
    );
    this.watchedRows.set(new Set(response.watched_rows));
    this.ready.set(true);
  }

  async reload(): Promise<void> {
    this.ready.set(false);
    this.initPromise = null;
    await this.init();
  }

  isWatched(rowNumber: number): boolean {
    return this.watchedRows().has(rowNumber);
  }

  async setWatched(rowNumber: number, watched: boolean, source: 'manual' | 'extension' = 'manual'): Promise<void> {
    await this.init();

    const payload: ProgressUpdatePayload = { watched, source };
    const response = await firstValueFrom(
      this.http.put<ProgressResponse>(`${environment.apiUrl}/progress/${rowNumber}`, payload),
    );

    this.watchedRows.set(new Set(response.watched_rows));
  }

  async toggleWatched(rowNumber: number): Promise<void> {
    await this.setWatched(rowNumber, !this.isWatched(rowNumber), 'manual');
  }

  async bulkMark(rowNumbers: number[], source: 'manual' | 'extension' = 'extension'): Promise<void> {
    await this.init();

    const response = await firstValueFrom(
      this.http.post<ProgressResponse>(`${environment.apiUrl}/progress/bulk`, {
        row_numbers: rowNumbers,
        source,
      }),
    );

    this.watchedRows.set(new Set(response.watched_rows));
  }
}

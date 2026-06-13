import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthSessionState, AuthConfig, AuthUser, TokenResponse } from '../models/auth.model';
import { createPkcePair } from '../utils/pkce.utils';

const REFRESH_STORAGE_KEY = 'arrowverse.refreshToken';
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly sessionSignal = signal<AuthSessionState>({
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    user: null,
  });

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private refreshInFlight: Promise<boolean> | null = null;
  private initPromise: Promise<void> | null = null;

  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.sessionSignal().accessToken));
  readonly user = computed(() => this.sessionSignal().user);

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.restoreSession();
    }
    return this.initPromise;
  }

  getAuthConfig(): Promise<AuthConfig> {
    return firstValueFrom(this.http.get<AuthConfig>(`${environment.apiUrl}/auth/config`));
  }

  private async restoreSession(): Promise<void> {
    const storedRefresh = sessionStorage.getItem(REFRESH_STORAGE_KEY);
    if (!storedRefresh) {
      return;
    }

    this.sessionSignal.update((state) => ({ ...state, refreshToken: storedRefresh }));
    await this.refreshAccessToken();
  }

  async register(payload: {
    email: string;
    username: string;
    password: string;
    displayName: string;
  }): Promise<AuthUser> {
    return firstValueFrom(
      this.http.post<AuthUser>(`${environment.apiUrl}/auth/register`, {
        email: payload.email,
        username: payload.username,
        password: payload.password,
        display_name: payload.displayName,
      }),
    );
  }

  async login(email: string, password: string): Promise<void> {
    const pkce = await createPkcePair();
    const codeResponse = await firstValueFrom(
      this.http.post<{ authorization_code: string; expires_in: number }>(
        `${environment.apiUrl}/auth/login/pkce`,
        {
          email,
          password,
          client_id: environment.spaClientId,
          code_challenge: pkce.challenge,
          code_challenge_method: 'S256',
        },
      ),
    );

    const tokenResponse = await firstValueFrom(
      this.http.post<TokenResponse>(`${environment.apiUrl}/auth/token`, {
        grant_type: 'authorization_code',
        client_id: environment.spaClientId,
        code: codeResponse.authorization_code,
        code_verifier: pkce.verifier,
      }),
    );

    this.applySession(tokenResponse);
  }

  async refreshAccessToken(): Promise<boolean> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const refreshToken = this.sessionSignal().refreshToken ?? sessionStorage.getItem(REFRESH_STORAGE_KEY);
    if (!refreshToken) {
      return false;
    }

    this.refreshInFlight = this.performRefresh(refreshToken).finally(() => {
      this.refreshInFlight = null;
    });

    return this.refreshInFlight;
  }

  async linkExtensionDevice(deviceName = 'Chrome Extension'): Promise<{
    refresh_token: string;
    device_id: string;
    expires_in: number;
  }> {
    return firstValueFrom(
      this.http.post<{ refresh_token: string; device_id: string; expires_in: number }>(
        `${environment.apiUrl}/auth/extension/link`,
        {
          device_name: deviceName,
        },
      ),
    );
  }

  getAccessToken(): string | null {
    const session = this.sessionSignal();
    if (!session.accessToken) {
      return null;
    }

    if (session.expiresAt && session.expiresAt <= Date.now() + 30_000) {
      void this.refreshAccessToken();
    }

    return session.accessToken;
  }

  logout(): void {
    this.clearSession();
    void this.router.navigate(['/login']);
  }

  private clearSession(): void {
    this.clearRefreshTimer();
    sessionStorage.removeItem(REFRESH_STORAGE_KEY);
    this.sessionSignal.set({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      user: null,
    });
  }

  private async performRefresh(refreshToken: string): Promise<boolean> {
    try {
      const tokenResponse = await firstValueFrom(
        this.http.post<TokenResponse>(`${environment.apiUrl}/auth/token`, {
          grant_type: 'refresh_token',
          client_id: environment.spaClientId,
          refresh_token: refreshToken,
        }),
      );
      this.applySession(tokenResponse);
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  private applySession(tokenResponse: TokenResponse): void {
    const expiresAt = Date.now() + tokenResponse.expires_in * 1000;
    const refreshToken = tokenResponse.refresh_token ?? this.sessionSignal().refreshToken;

    if (refreshToken) {
      sessionStorage.setItem(REFRESH_STORAGE_KEY, refreshToken);
    }

    this.sessionSignal.set({
      accessToken: tokenResponse.access_token,
      refreshToken: refreshToken ?? null,
      expiresAt,
      user: tokenResponse.user,
    });

    this.startRefreshTimer();
  }

  private startRefreshTimer(): void {
    this.clearRefreshTimer();
    this.refreshTimer = setInterval(() => {
      void this.refreshAccessToken();
    }, REFRESH_INTERVAL_MS);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

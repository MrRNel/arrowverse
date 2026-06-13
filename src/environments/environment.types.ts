export interface Environment {
  production: boolean;
  appUrl: string;
  /** Relative in dev (proxied) and prod (same-origin FastAPI). Never hard-code localhost:8000 here. */
  apiUrl: string;
  spaClientId: string;
  extensionClientId: string;
  extensionBridgeEnabled: boolean;
}

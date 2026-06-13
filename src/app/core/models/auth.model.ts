export interface AuthUser {
  public_id: string;
  email: string;
  username: string;
  display_name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  user: AuthUser;
}

export interface AuthSessionState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  user: AuthUser | null;
}

export interface ExtensionAuthMessage {
  source: 'arrowverse-app';
  type: 'AUTH_STATE';
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  user: AuthUser | null;
}

export type ExtensionEventType = 'EPISODE_STARTED' | 'EPISODE_COMPLETED' | 'SYNC_PENDING' | 'PING';

export type ExtensionAppEventType = 'PONG' | 'ACK' | 'ERROR' | 'SYNC_STATE' | 'SYNC_WARNING' | 'AUTH_STATE';

export interface ExtensionEpisodePayload {
  row_number: number;
  series: string;
  episode_id: string;
  episode_name: string;
  air_date?: string;
}

export interface ExtensionBridgeMessage {
  source: 'arrowverse-extension';
  type: ExtensionEventType;
  payload?: ExtensionEpisodePayload;
  pending?: ExtensionEpisodePayload[];
}

export interface ExtensionSyncStateMessage {
  source: 'arrowverse-app';
  type: 'SYNC_STATE';
  watchedRows: number[];
  upNext: ExtensionEpisodePayload | null;
}

export interface ExtensionSyncWarningState {
  playing: ExtensionEpisodePayload;
  upNext: ExtensionEpisodePayload;
  skippedCount: number;
}

export interface ExtensionSyncWarningMessage {
  source: 'arrowverse-app';
  type: 'SYNC_WARNING';
  playing: ExtensionEpisodePayload;
  upNext: ExtensionEpisodePayload;
  skippedCount: number;
}

export interface ExtensionBridgeResponse {
  source: 'arrowverse-app';
  type: Exclude<ExtensionAppEventType, 'SYNC_STATE' | 'SYNC_WARNING' | 'AUTH_STATE'>;
  message?: string;
}

export interface ExtensionAuthStateMessage {
  source: 'arrowverse-app';
  type: 'AUTH_STATE';
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  user: {
    public_id: string;
    email: string;
    username: string;
    display_name: string;
  } | null;
}

export type ExtensionAppMessage =
  | ExtensionBridgeResponse
  | ExtensionSyncStateMessage
  | ExtensionSyncWarningMessage
  | ExtensionAuthStateMessage;

import { Environment } from './environment.types';

/**
 * Dev: `apiUrl` is relative (`/api`) and ng serve proxies it to the FastAPI backend.
 * Prod: same relative `/api` hits FastAPI on the same origin (no Angular proxy).
 */
export const environment: Environment = {
  production: false,
  appUrl: 'http://localhost:4200',
  apiUrl: '/api',
  spaClientId: 'arrowverse-web',
  extensionClientId: 'arrowverse-extension',
  extensionBridgeEnabled: true,
};

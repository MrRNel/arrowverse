import { Environment } from './environment.types';

/** Production is served by FastAPI on one origin — `/api` is same-host, not proxied. */
export const environment: Environment = {
  production: true,
  appUrl: 'https://arrowverse.example.com',
  apiUrl: '/api',
  spaClientId: 'arrowverse-web',
  extensionClientId: 'arrowverse-extension',
  extensionBridgeEnabled: true,
};

import { Environment } from './environment.types';

export const environment: Environment = {
  production: false,
  appUrl: 'http://localhost:4200',
  apiUrl: '/api',
  spaClientId: 'arrowverse-web',
  extensionClientId: 'arrowverse-extension',
  extensionBridgeEnabled: true,
};

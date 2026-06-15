export const EXTENSION_CONFIG = {
  mode: 'production',
  developmentAppUrl: 'http://localhost:4200',
  productionAppUrl: 'https://arrowverse.forgenetics.co.za',
  developmentApiUrl: 'http://localhost:4200/api',
  productionApiUrl: 'https://arrowverse.forgenetics.co.za/api',
  extensionClientId: 'arrowverse-extension',
};

export function getApiUrl(config = EXTENSION_CONFIG) {
  return config.mode === 'production' ? config.productionApiUrl : config.developmentApiUrl;
}

export function getJellyfinOrigin(config = EXTENSION_CONFIG) {
  const value = config.jellyfinServerUrl?.trim();
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getAppUrl(config = EXTENSION_CONFIG) {
  return config.mode === 'production' ? config.productionAppUrl : config.developmentAppUrl;
}

export function getAppOrigin(config = EXTENSION_CONFIG) {
  return new URL(getAppUrl(config)).origin;
}

export function isAppUrl(url, config = EXTENSION_CONFIG) {
  if (!url) {
    return false;
  }

  const origins = [config.developmentAppUrl, config.productionAppUrl].map(
    (value) => new URL(value).origin,
  );

  try {
    return origins.includes(new URL(url).origin);
  } catch {
    return false;
  }
}

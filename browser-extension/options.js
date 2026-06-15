import { EXTENSION_CONFIG } from './lib/config.js';

const modeInput = document.querySelector('#mode');
const developmentInput = document.querySelector('#developmentAppUrl');
const productionInput = document.querySelector('#productionAppUrl');
const status = document.querySelector('#status');
const form = document.querySelector('#options-form');

async function load() {
  const stored = await chrome.storage.sync.get([
    'mode',
    'developmentAppUrl',
    'productionAppUrl',
  ]);

  modeInput.value = stored.mode ?? EXTENSION_CONFIG.mode ?? 'production';
  developmentInput.value = stored.developmentAppUrl ?? EXTENSION_CONFIG.developmentAppUrl;
  productionInput.value = stored.productionAppUrl ?? EXTENSION_CONFIG.productionAppUrl;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const saveButton = document.querySelector('#save');
  saveButton.disabled = true;
  status.dataset.state = '';
  status.textContent = 'Saving…';

  try {
    const config = {
      mode: modeInput.value,
      developmentAppUrl: developmentInput.value.trim(),
      productionAppUrl: productionInput.value.trim(),
    };

    for (const url of [config.developmentAppUrl, config.productionAppUrl]) {
      const pattern = `${new URL(url).origin}/*`;
      const allowed = await chrome.permissions.contains({ origins: [pattern] });
      if (!allowed) {
        const granted = await chrome.permissions.request({ origins: [pattern] });
        if (!granted) {
          throw new Error(`Permission required for ${pattern}`);
        }
      }
    }

    await chrome.runtime.sendMessage({
      type: 'SAVE_CONFIG',
      config,
    });

    status.dataset.state = 'success';
    status.textContent =
      'Settings saved. Reload the extension at chrome://extensions, then refresh your tracker tab (F5).';
  } catch (error) {
    status.dataset.state = 'error';
    status.textContent = `Could not save settings: ${String(error)}`;
  } finally {
    saveButton.disabled = false;
  }
});

void load();

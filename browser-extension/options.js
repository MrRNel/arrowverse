const modeInput = document.querySelector('#mode');
const developmentInput = document.querySelector('#developmentAppUrl');
const productionInput = document.querySelector('#productionAppUrl');
const jellyfinInput = document.querySelector('#jellyfinServerUrl');
const status = document.querySelector('#status');
const form = document.querySelector('#options-form');

async function load() {
  const stored = await chrome.storage.sync.get([
    'mode',
    'developmentAppUrl',
    'productionAppUrl',
    'jellyfinServerUrl',
  ]);

  modeInput.value = stored.mode ?? 'development';
  developmentInput.value = stored.developmentAppUrl ?? 'http://localhost:4200';
  productionInput.value = stored.productionAppUrl ?? 'https://arrowverse.example.com';
  jellyfinInput.value = stored.jellyfinServerUrl ?? 'http://localhost:8096';
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
      jellyfinServerUrl: jellyfinInput.value.trim(),
    };

    await chrome.runtime.sendMessage({
      type: 'SAVE_CONFIG',
      config,
    });

    status.dataset.state = 'success';
    status.textContent =
      'Settings saved. Reload Netflix, Jellyfin, and your tracker tab if they are already open.';
  } catch (error) {
    status.dataset.state = 'error';
    status.textContent = `Could not save settings: ${String(error)}`;
  } finally {
    saveButton.disabled = false;
  }
});

void load();

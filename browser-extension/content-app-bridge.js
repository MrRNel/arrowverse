const BRIDGE_SOURCE = 'arrowverse-extension';
const APP_SOURCE = 'arrowverse-app';

function isExtensionDead() {
  return Boolean(globalThis.__arrowverseAppBridgeDead);
}

function isContextInvalidated(error) {
  const message = String(error?.message ?? error);
  return (
    message.includes('Extension context invalidated') ||
    message.includes('Receiving end does not exist')
  );
}

function canUseExtensionRuntime() {
  if (isExtensionDead()) {
    return false;
  }

  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

function markExtensionDead(error) {
  if (isExtensionDead()) {
    return;
  }

  globalThis.__arrowverseAppBridgeDead = true;
  showRefreshBanner();
}

function showRefreshBanner() {
  if (document.querySelector('#arrowverse-app-bridge-banner')) {
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'arrowverse-app-bridge-banner';
  banner.innerHTML = `
    <style>
      #arrowverse-app-bridge-banner {
        background: rgba(127, 29, 29, 0.95);
        border-bottom: 1px solid rgba(248, 113, 113, 0.45);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        color: #fee2e2;
        font-family: Inter, Segoe UI, sans-serif;
        font-size: 0.88rem;
        left: 0;
        line-height: 1.45;
        padding: 0.75rem 1rem;
        position: fixed;
        right: 0;
        top: 0;
        z-index: 2147483647;
      }

      #arrowverse-app-bridge-banner strong {
        color: #fff;
      }

      #arrowverse-app-bridge-banner button {
        background: #fee2e2;
        border: none;
        border-radius: 0.45rem;
        color: #7f1d1d;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        margin-left: 0.75rem;
        padding: 0.35rem 0.65rem;
      }
    </style>
    <strong>Arrowverse extension disconnected.</strong>
    Reload the extension, then refresh this page (F5).
    <button type="button" data-action="refresh">Refresh page</button>
  `;

  banner.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.action === 'refresh') {
      window.location.reload();
    }
  });

  document.documentElement.appendChild(banner);
}

function sendRuntimeMessage(message) {
  if (!canUseExtensionRuntime()) {
    markExtensionDead(new Error('Extension context invalidated'));
    return;
  }

  try {
    const result = chrome.runtime.sendMessage(message);
    if (result && typeof result.catch === 'function') {
      result.catch((error) => {
        if (isContextInvalidated(error)) {
          markExtensionDead(error);
        }
      });
    }
  } catch (error) {
    if (isContextInvalidated(error)) {
      markExtensionDead(error);
    }
  }
}

function forwardToPage(message) {
  window.postMessage(
    {
      source: BRIDGE_SOURCE,
      ...message,
    },
    window.location.origin,
  );
}

function resetBridgeContext() {
  globalThis.__arrowverseAppBridgeDead = false;
  document.querySelector('#arrowverse-app-bridge-banner')?.remove();
  forwardToPage({ type: 'PING' });
  sendRuntimeMessage({ type: 'APP_READY' });
}

if (!globalThis.__arrowverseAppBridgeRejectionHandler) {
  globalThis.__arrowverseAppBridgeRejectionHandler = true;
  globalThis.addEventListener('unhandledrejection', (event) => {
    if (isContextInvalidated(event.reason)) {
      event.preventDefault();
      markExtensionDead(event.reason);
    }
  });
}

if (!globalThis.__arrowverseBridgeInitialized) {
  globalThis.__arrowverseBridgeInitialized = true;

  if (canUseExtensionRuntime()) {
    try {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        forwardToPage(message);

        if (message.type === 'RESET_EXTENSION_CONTEXT') {
          resetBridgeContext();
          sendResponse({ ok: true });
        }

        return false;
      });
    } catch (error) {
      markExtensionDead(error);
    }
  } else {
    markExtensionDead(new Error('Extension context invalidated'));
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    if (event.data?.source !== APP_SOURCE) {
      return;
    }

    sendRuntimeMessage({
      type: 'APP_RESPONSE',
      data: event.data,
    });
  });

  if (canUseExtensionRuntime()) {
    forwardToPage({ type: 'PING' });
    sendRuntimeMessage({ type: 'APP_READY' });
  }
} else if (canUseExtensionRuntime()) {
  resetBridgeContext();
}

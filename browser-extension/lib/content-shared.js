globalThis.ArrowverseContent = (() => {
  const COMPLETION_THRESHOLD = 0.92;

  function ignorePromise(promise) {
    Promise.resolve(promise).catch((error) => {
      if (isContextInvalidated(error) || !canUseExtensionRuntime()) {
        markExtensionDead(error);
      }
    });
  }

  function isExtensionDead() {
    return Boolean(globalThis.__arrowverseExtensionDead);
  }

  function isContextInvalidated(error) {
    const message = String(error?.message ?? error);
    return (
      message.includes('Extension context invalidated') ||
      message.includes('Receiving end does not exist')
    );
  }

  function extensionUnavailableMessage(error, providerLabel) {
    const message = String(error?.message ?? error);
    if (message.includes('Extension context invalidated')) {
      return `Extension was reloaded. Refresh this ${providerLabel} tab (F5) after reloading the extension.`;
    }
    if (message.includes('Receiving end does not exist')) {
      return `Extension background is unavailable. Reload the extension at chrome://extensions, then refresh ${providerLabel}.`;
    }
    return message;
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showRefreshBanner(message) {
    if (document.querySelector('#arrowverse-refresh-banner')) {
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'arrowverse-refresh-banner';
    banner.innerHTML = `
      <style>
        #arrowverse-refresh-banner {
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

        #arrowverse-refresh-banner strong {
          color: #fff;
        }

        #arrowverse-refresh-banner button {
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
      ${message}
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

  function showOutOfSyncOverlay({ playing, upNext, skippedCount }) {
    const warningKey = `${playing.row_number}:${upNext.row_number}`;
    if (globalThis.__arrowverseLastSyncWarningKey === warningKey) {
      return;
    }

    globalThis.__arrowverseLastSyncWarningKey = warningKey;
    document.querySelector('#arrowverse-sync-warning')?.remove();

    const playingSeries = escapeHtml(playing.series ?? 'Unknown series');
    const upNextSeries = escapeHtml(upNext.series ?? 'Unknown series');
    const playingCode = escapeHtml(playing.episode_id ?? '');
    const playingName = escapeHtml(playing.episode_name ?? '');
    const upNextCode = escapeHtml(upNext.episode_id ?? '');
    const upNextName = escapeHtml(upNext.episode_name ?? '');

    const overlay = document.createElement('div');
    overlay.id = 'arrowverse-sync-warning';
    overlay.innerHTML = `
      <style>
        #arrowverse-sync-warning {
          align-items: center;
          background: rgba(2, 6, 18, 0.88);
          display: flex;
          inset: 0;
          justify-content: center;
          padding: 1.5rem;
          pointer-events: auto;
          position: fixed;
          z-index: 2147483646;
        }

        #arrowverse-sync-warning .av-sync-card {
          background: linear-gradient(180deg, rgba(245, 158, 11, 0.18), rgba(15, 23, 42, 0.98));
          border: 1px solid rgba(245, 158, 11, 0.5);
          border-radius: 1.25rem;
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.55);
          color: #f8fafc;
          font-family: Inter, Segoe UI, sans-serif;
          max-width: 40rem;
          padding: 2rem 2rem 1.75rem;
          width: min(40rem, calc(100vw - 2rem));
        }

        #arrowverse-sync-warning .av-sync-title {
          color: #fbbf24;
          font-size: 1.65rem;
          font-weight: 800;
          letter-spacing: 0.01em;
          margin: 0 0 0.85rem;
        }

        #arrowverse-sync-warning .av-sync-copy {
          color: #dbeafe;
          font-size: 1.08rem;
          line-height: 1.65;
          margin: 0 0 1.25rem;
        }

        #arrowverse-sync-warning .av-sync-grid {
          display: grid;
          gap: 0.85rem;
          margin-bottom: 1.1rem;
        }

        #arrowverse-sync-warning .av-sync-episode {
          background: rgba(15, 23, 42, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 0.9rem;
          padding: 1rem 1.1rem;
        }

        #arrowverse-sync-warning .av-sync-episode.is-next {
          border-color: rgba(34, 197, 94, 0.45);
          box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.12);
        }

        #arrowverse-sync-warning .av-sync-episode.is-current {
          border-color: rgba(245, 158, 11, 0.45);
        }

        #arrowverse-sync-warning .av-sync-episode-label {
          color: #94a3b8;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          margin-bottom: 0.45rem;
          text-transform: uppercase;
        }

        #arrowverse-sync-warning .av-sync-episode-row {
          color: #64748b;
          font-size: 0.92rem;
          margin-bottom: 0.2rem;
        }

        #arrowverse-sync-warning .av-sync-episode-series {
          color: #f8fafc;
          font-size: 1.2rem;
          font-weight: 700;
          margin-bottom: 0.2rem;
        }

        #arrowverse-sync-warning .av-sync-episode-meta {
          color: #cbd5e1;
          font-size: 1rem;
        }

        #arrowverse-sync-warning .av-sync-meta {
          color: #94a3b8;
          font-size: 0.95rem;
          line-height: 1.5;
          margin: 0;
        }

        #arrowverse-sync-warning .av-sync-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 1.35rem;
        }

        #arrowverse-sync-warning button {
          background: #f59e0b;
          border: none;
          border-radius: 0.75rem;
          color: #111827;
          cursor: pointer;
          font: inherit;
          font-size: 1rem;
          font-weight: 700;
          padding: 0.75rem 1.15rem;
        }

        #arrowverse-sync-warning button[data-action="dismiss"] {
          background: rgba(148, 163, 184, 0.18);
          color: #e2e8f0;
        }
      </style>
      <div class="av-sync-card" role="alertdialog" aria-labelledby="av-sync-title">
        <h2 id="av-sync-title" class="av-sync-title">Out of watch order</h2>
        <p class="av-sync-copy">
          You're watching an episode ahead of your Arrowverse tracker progress.
        </p>

        <div class="av-sync-grid">
          <div class="av-sync-episode is-current">
            <div class="av-sync-episode-label">Currently playing</div>
            <div class="av-sync-episode-row">#${playing.row_number}</div>
            <div class="av-sync-episode-series">${playingSeries}</div>
            <div class="av-sync-episode-meta">${playingCode} · ${playingName}</div>
          </div>

          <div class="av-sync-episode is-next">
            <div class="av-sync-episode-label">Up next in watch order</div>
            <div class="av-sync-episode-row">#${upNext.row_number}</div>
            <div class="av-sync-episode-series">${upNextSeries}</div>
            <div class="av-sync-episode-meta">${upNextCode} · ${upNextName}</div>
          </div>
        </div>

        <p class="av-sync-meta">
          ${skippedCount} episode slot${skippedCount === 1 ? '' : 's'} skipped in the official watch order.
        </p>

        <div class="av-sync-actions">
          <button type="button" data-action="dismiss">Keep watching anyway</button>
        </div>
      </div>
    `;

    overlay.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.dataset.action === 'dismiss' || target === overlay) {
        overlay.remove();
      }
    });

    document.documentElement.appendChild(overlay);
  }

  function createMonitor({
    debugKey,
    providerLabel,
    initFlag,
    listenerFlag,
    isWatchPage,
    onResetState,
    evaluatePlaybackInner,
    bootHint,
  }) {
    let lastStatus = globalThis.__arrowverseLastStatus ?? { phase: 'booting' };

    function markExtensionDead(error) {
      if (isExtensionDead()) {
        return;
      }

      globalThis.__arrowverseExtensionDead = true;
      stopMonitoring();

      lastStatus = {
        phase: 'context-invalidated',
        message: extensionUnavailableMessage(error, providerLabel),
        updatedAt: Date.now(),
        href: window.location.href,
      };
      globalThis.__arrowverseLastStatus = lastStatus;

      showRefreshBanner(lastStatus.message);
    }

    async function safeAsync(task) {
      try {
        await task();
      } catch (error) {
        if (isContextInvalidated(error) || !canUseExtensionRuntime()) {
          markExtensionDead(error);
          return;
        }

        try {
          await storeDebug({
            phase: 'error',
            message: extensionUnavailableMessage(error, providerLabel),
          });
        } catch (debugError) {
          if (isContextInvalidated(debugError)) {
            markExtensionDead(debugError);
          }
        }
      }
    }

    async function storeDebug(status) {
      try {
        lastStatus = {
          ...status,
          updatedAt: Date.now(),
          href: window.location.href,
          provider: providerLabel.toLowerCase(),
        };
        globalThis.__arrowverseLastStatus = lastStatus;

        if (!canUseExtensionRuntime()) {
          return;
        }

        await chrome.storage.local.set({
          [debugKey]: lastStatus,
        });
      } catch (error) {
        if (isContextInvalidated(error)) {
          markExtensionDead(error);
        }
      }
    }

    async function sendRuntimeMessage(message) {
      if (!canUseExtensionRuntime()) {
        markExtensionDead(new Error('Extension context invalidated'));
        return null;
      }

      try {
        return await chrome.runtime.sendMessage(message);
      } catch (error) {
        if (isContextInvalidated(error)) {
          markExtensionDead(error);
          return null;
        }

        return { error: extensionUnavailableMessage(error, providerLabel) };
      }
    }

    async function resolveEpisode(metadata) {
      const response = await sendRuntimeMessage({
        type: 'PLAYER_METADATA',
        metadata,
      });

      if (!response) {
        return null;
      }

      if (response.error) {
        await storeDebug({
          phase: 'error',
          message: response.error,
          metadata,
        });
        return null;
      }

      return response.match ?? null;
    }

    async function evaluatePlayback() {
      if (isExtensionDead()) {
        return;
      }

      await safeAsync(() => evaluatePlaybackInner({
        storeDebug,
        sendRuntimeMessage,
        resolveEpisode,
        markExtensionDead,
        isExtensionDead,
        canUseExtensionRuntime,
        COMPLETION_THRESHOLD,
        getLastStatus: () => lastStatus,
        setLastStatus: (status) => {
          lastStatus = status;
        },
      }));
    }

    function startMonitoring() {
      if (isExtensionDead()) {
        return;
      }

      if (globalThis.__arrowversePollTimer) {
        return;
      }

      globalThis.__arrowversePollTimer = window.setInterval(() => {
        ignorePromise(evaluatePlayback());
      }, 1000);

      ignorePromise(evaluatePlayback());
    }

    function stopMonitoring() {
      if (!globalThis.__arrowversePollTimer) {
        return;
      }

      clearInterval(globalThis.__arrowversePollTimer);
      globalThis.__arrowversePollTimer = null;
    }

    if (!globalThis[listenerFlag]) {
      globalThis[listenerFlag] = true;

      if (canUseExtensionRuntime()) {
        try {
          chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            if (message.type === 'GET_STATUS') {
              sendResponse({
                ...lastStatus,
                href: window.location.href,
                isWatchPage: isWatchPage(),
                extensionDead: isExtensionDead(),
                provider: providerLabel.toLowerCase(),
              });
              return true;
            }

            if (message.type === 'OUT_OF_SYNC_WARNING') {
              showOutOfSyncOverlay(message);
              return false;
            }

            if (message.type === 'RESET_EXTENSION_CONTEXT') {
              globalThis.__arrowverseExtensionDead = false;
              document.querySelector('#arrowverse-refresh-banner')?.remove();
              if (isWatchPage()) {
                startMonitoring();
              }
              sendResponse({ ok: true });
              return true;
            }

            return false;
          });
        } catch (error) {
          markExtensionDead(error);
        }
      } else {
        markExtensionDead(new Error('Extension context invalidated'));
      }
    }

    async function bootstrap() {
      if (isExtensionDead() || !canUseExtensionRuntime()) {
        markExtensionDead(new Error('Extension context invalidated'));
        return;
      }

      await storeDebug({
        phase: 'script-loaded',
        hint: bootHint,
      });

      if (isWatchPage()) {
        startMonitoring();
      }

      const observer = new MutationObserver(() => {
        if (isExtensionDead()) {
          return;
        }

        if (isWatchPage()) {
          startMonitoring();
        } else {
          stopMonitoring();
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      window.addEventListener('popstate', () => {
        onResetState?.();
      });

      window.addEventListener('hashchange', () => {
        onResetState?.();
      });
    }

    if (!globalThis.__arrowverseRejectionHandler) {
      globalThis.__arrowverseRejectionHandler = true;
      globalThis.addEventListener('unhandledrejection', (event) => {
        if (isContextInvalidated(event.reason)) {
          event.preventDefault();
          markExtensionDead(event.reason);
        }
      });
    }

    if (globalThis[initFlag]) {
      if (canUseExtensionRuntime()) {
        globalThis.__arrowverseExtensionDead = false;
        document.querySelector('#arrowverse-refresh-banner')?.remove();
        if (isWatchPage()) {
          startMonitoring();
        }
      }

      ignorePromise(storeDebug({ phase: 'already-running', ...lastStatus }));
    } else {
      globalThis[initFlag] = true;
      ignorePromise(safeAsync(bootstrap));
    }

    return {
      storeDebug,
      sendRuntimeMessage,
      resolveEpisode,
      startMonitoring,
      stopMonitoring,
      markExtensionDead,
    };
  }

  return {
    COMPLETION_THRESHOLD,
    createMonitor,
    ignorePromise,
    isVideoActive(video) {
      if (!video) {
        return false;
      }

      if (video.ended) {
        return true;
      }

      if (!video.paused) {
        return true;
      }

      return video.currentTime > 0;
    },
    queryDeep(selector, root = document) {
      const direct = root.querySelector(selector);
      if (direct) {
        return direct;
      }

      for (const element of root.querySelectorAll('*')) {
        if (!element.shadowRoot) {
          continue;
        }

        const found = this.queryDeep(selector, element.shadowRoot);
        if (found) {
          return found;
        }
      }

      return null;
    },
  };
})();

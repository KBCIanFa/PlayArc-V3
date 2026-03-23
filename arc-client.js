/**
 * PlaywrightArc Studio — Browser Client
 * ----------------------------------------
 * Drop this <script> tag into playwright-arc-studio.html (before closing </body>)
 * to wire the shell UI to the local dev server.
 *
 * <script src="arc-client.js"></script>
 *
 * What it does:
 *   - Opens a WebSocket to ws://localhost:3001/ws
 *   - Updates the sidebar run strip, KPI cards, and notification panel in real time
 *   - Intercepts the ▶ Run button to POST /api/run instead of simulating
 *   - Intercepts the env badge to POST /api/envs/:name/activate
 *   - Polls /api/status every 5s as a fallback when WS is disconnected
 */

(function () {
  'use strict';

  const SERVER = 'http://localhost:3001';
  const WS_URL = 'ws://localhost:3001/ws';

  let ws       = null;
  let wsAlive  = false;
  let pollTimer = null;

  // ── UTILITIES ──────────────────────────────────────────────────────────────

  function post(path, body) {
    return fetch(SERVER + path, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body || {}),
    }).then(r => r.json()).catch(err => ({ error: err.message }));
  }

  function get(path) {
    return fetch(SERVER + path).then(r => r.json()).catch(() => null);
  }

  function el(id) { return document.getElementById(id); }

  function serverToast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else console.log('[ARC]', msg);
  }

  // ── RUN STRIP UPDATER ──────────────────────────────────────────────────────

  function updateRunStrip({ passed = 0, failed = 0, total = 0, status = 'idle', duration = null }) {
    const bar    = el('rsBar');
    const label  = el('rsLabel');
    const pEl    = el('rsPassed');
    const fEl    = el('rsFailed');
    const durEl  = el('rsDur');
    const dot    = el('execStatusDot');

    if (!bar) return;

    const pct = total > 0 ? Math.round((passed / total) * 100) : (status === 'running' ? 30 : 0);

    bar.style.width      = pct + '%';
    bar.style.background = failed > 0 ? 'var(--red)' : status === 'running' ? 'var(--blue)' : 'var(--green)';
    if (pEl)  pEl.textContent  = `✓ ${passed}`;
    if (fEl)  fEl.textContent  = `✗ ${failed}`;
    if (durEl && duration) durEl.textContent = (duration / 1000).toFixed(1) + 's';
    if (label) label.textContent = status === 'running' ? 'Running…' : 'Last Run';

    if (dot) {
      dot.className = 'nav-status ' + (
        status === 'running' ? 'ns-yellow' :
        failed  > 0         ? 'ns-red'    : 'ns-green'
      );
    }
  }

  // ── WEBSOCKET ──────────────────────────────────────────────────────────────

  function connectWS() {
    try {
      ws = new WebSocket(WS_URL);
    } catch (_) {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      wsAlive = true;
      clearInterval(pollTimer);
      console.log('[ARC] WebSocket connected');
      ws.send(JSON.stringify({ type: 'ping' }));
    };

    ws.onmessage = ({ data }) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      handleServerEvent(msg);
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      wsAlive = false;
      scheduleReconnect();
      startPolling(); // fallback while WS is down
    };
  }

  function scheduleReconnect() {
    setTimeout(connectWS, 4000);
  }

  // ── EVENT HANDLER ──────────────────────────────────────────────────────────

  function handleServerEvent(msg) {
    switch (msg.type) {

      case 'run.started':
        serverToast(`▶ Run started — ${msg.config?.engine || 'playwright'}`);
        updateRunStrip({ status: 'running' });
        lockRunButton(true);
        break;

      case 'run.log':
        // Pipe log lines into the execution iframe if open
        forwardToFrame('run.log', msg);
        break;

      case 'run.completed':
        updateRunStrip({
          passed:   msg.passed,
          failed:   msg.failed,
          total:    msg.total,
          status:   msg.status,
          duration: msg.duration,
        });
        lockRunButton(false);
        serverToast(
          msg.failed > 0
            ? `✗ Run complete — ${msg.failed} failing`
            : `✓ Run complete — ${msg.passed} passed`
        );
        forwardToFrame('run.completed', msg);
        break;

      case 'run.stopped':
        lockRunButton(false);
        updateRunStrip({ status: 'stopped' });
        serverToast('⬛ Run stopped');
        break;

      case 'run.error':
        lockRunButton(false);
        serverToast(`⚠ Run error: ${msg.error}`);
        break;

      case 'run.active':
        // Server sent active run state on fresh WS connect
        updateRunStrip({
          passed:  msg.passed,
          failed:  msg.failed,
          status:  msg.status,
          elapsed: msg.elapsed,
        });
        if (msg.status === 'running') lockRunButton(true);
        break;

      case 'env.changed':
        const envLabel = el('activeEnvLabel');
        if (envLabel) envLabel.textContent = msg.env;
        break;

      case 'pong':
        break;
    }
  }

  // ── FORWARD EVENTS TO IFRAME ───────────────────────────────────────────────

  function forwardToFrame(type, payload) {
    const frame = el('moduleFrame');
    if (!frame || !frame.contentWindow) return;
    try {
      frame.contentWindow.postMessage({ source: 'arc-server', type, ...payload }, '*');
    } catch (_) {}
  }

  // ── RUN BUTTON ─────────────────────────────────────────────────────────────

  function lockRunButton(running) {
    const btn = el('runBtn');
    if (!btn) return;
    btn.textContent  = running ? '⬛ Stop' : '▶ Run';
    btn.style.background = running ? 'var(--red)' : '';
    btn.onclick      = running ? doStop : doRun;
  }

  async function doRun() {
    const envLabel = el('activeEnvLabel');
    const env      = envLabel ? envLabel.textContent.toLowerCase().replace(/\s+/g, '') : 'local';

    const result = await post('/api/run', {
      engine:  'playwright',
      env,
      workers: 4,
      retries: 1,
    });

    if (result.error) {
      serverToast(`⚠ ${result.error}`);
    }
  }

  async function doStop() {
    await post('/api/run/stop');
  }

  // ── ENV BADGE WIRING ───────────────────────────────────────────────────────

  function wireEnvSwitcher() {
    // Patch the global setEnv function if it exists
    if (typeof window.setEnv === 'function') {
      const original = window.setEnv;
      window.setEnv = function (name) {
        original(name); // update UI immediately
        post(`/api/envs/${encodeURIComponent(name.toLowerCase().replace(/\s+/g, ''))}/activate`)
          .then(r => { if (r?.error) console.warn('[ARC] env switch:', r.error); });
      };
    }
  }

  // ── STATUS POLLING (WS fallback) ───────────────────────────────────────────

  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (wsAlive) { clearInterval(pollTimer); return; }
      const status = await get('/api/status');
      if (!status) return;
      if (status.activeRun) {
        updateRunStrip({
          passed:  status.activeRun.passed,
          failed:  status.activeRun.failed,
          status:  status.activeRun.status,
        });
        lockRunButton(true);
      } else {
        lockRunButton(false);
      }
    }, 5000);
  }

  // ── SERVER DETECTION ───────────────────────────────────────────────────────

  async function detectServer() {
    const status = await get('/api/status');
    if (!status || status.error) {
      console.info(
        '[ARC] Local server not detected at ' + SERVER + '\n' +
        '      Run: node server.js\n' +
        '      The UI will work in demo mode without it.'
      );
      return false;
    }
    console.log('[ARC] Server connected —', SERVER);
    serverToast('⚡ PlaywrightArc server connected');
    return true;
  }

  // ── INIT ───────────────────────────────────────────────────────────────────

  async function init() {
    const alive = await detectServer();
    if (!alive) return; // demo mode — don't attempt WS

    wireEnvSwitcher();
    connectWS();

    // Wire run button to real server
    const btn = el('runBtn');
    if (btn) btn.onclick = doRun;

    // Load initial status
    const status = await get('/api/status');
    if (status?.activeRun) {
      updateRunStrip({ ...status.activeRun, status: status.activeRun.status });
      lockRunButton(true);
    }

    // Populate env list from server
    const envData = await get('/api/envs');
    if (envData?.envs) {
      console.log('[ARC] Available environments:', envData.envs.join(', '));
    }
  }

  // Wait for the shell to finish rendering
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 200);
  }

})();

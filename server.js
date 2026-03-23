/**
 * PlaywrightArc Studio — Local Dev Server
 * ----------------------------------------
 * Bridges the HTML shell UI to real Playwright/Selenium execution.
 *
 * Endpoints:
 *   GET  /api/status          — server health + active run info
 *   POST /api/run             — trigger a test run
 *   POST /api/run/stop        — kill the active run
 *   GET  /api/runs            — run history (last 50)
 *   GET  /api/runs/:id        — single run detail + test results
 *   GET  /api/suites          — list test files/suites
 *   GET  /api/envs            — list environments
 *   POST /api/envs/:name/activate — switch active environment
 *   GET  /api/report          — open last HTML report in browser
 *   POST /api/import/katalon  — trigger Katalon import (multipart zip)
 *   WS   /ws                  — real-time run log streaming
 *
 * Usage:
 *   node server.js
 *   node server.js --port 3001
 *   node server.js --project ./my-tests
 */

'use strict';

const http        = require('http');
const fs          = require('fs');
const fsp         = require('fs').promises;
const path        = require('path');
const { spawn }   = require('child_process');
const os          = require('os');
const crypto      = require('crypto');

// ── CONFIG ────────────────────────────────────────────────────────────────────
const PORT        = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || '3001');
const PROJECT_DIR = process.argv.find(a => a.startsWith('--project='))?.split('=')[1]
                    || process.cwd();
const RESULTS_DIR = path.join(PROJECT_DIR, '.arc-results');
const MAX_HISTORY = 50;
const CORS_ORIGIN = '*';   // lock this down in production

// ── STATE ─────────────────────────────────────────────────────────────────────
let activeRun   = null;   // { id, proc, logs[], startedAt, config }
let runHistory  = [];     // [RunRecord]
let wsClients   = new Set();
let activeEnv   = 'local';

// ── HELPERS ───────────────────────────────────────────────────────────────────
function uid() { return crypto.randomBytes(5).toString('hex'); }
function now()  { return new Date().toISOString(); }
function ms()   { return Date.now(); }

function log(msg) {
  process.stdout.write(`[PlaywrightArc] ${msg}\n`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Broadcast a message to all connected WebSocket clients */
function broadcast(type, payload) {
  const msg = JSON.stringify({ type, ...payload, ts: now() });
  wsClients.forEach(ws => {
    if (ws.readyState === 1 /* OPEN */) {
      try { ws.send(msg); } catch (_) { wsClients.delete(ws); }
    }
  });
}

/** Parse a single TAP / Playwright text line into a structured event */
function parseLine(line, runId) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Playwright test runner output patterns
  const PASS  = /^\s*✓\s+(.+?)\s+\((\d+(?:\.\d+)?)(ms|s)\)/;
  const FAIL  = /^\s*✗\s+(.+?)\s+\((\d+(?:\.\d+)?)(ms|s)\)/;
  const RETRY = /^\s*↩\s+(.+)/;
  const SUITE = /^\s*Running\s+(\d+)\s+test/;
  const DONE  = /(\d+)\s+passed(?:,\s+(\d+)\s+failed)?(?:\s+\((.+?)\))?/;

  if (PASS.test(trimmed))  return { kind:'pass',  text:trimmed };
  if (FAIL.test(trimmed))  return { kind:'fail',  text:trimmed };
  if (RETRY.test(trimmed)) return { kind:'retry', text:trimmed };
  if (SUITE.test(trimmed)) return { kind:'suite', text:trimmed };
  if (DONE.test(trimmed))  return { kind:'done',  text:trimmed };

  return { kind:'log', text:trimmed };
}

// ── ENVIRONMENT RESOLUTION ────────────────────────────────────────────────────
function loadEnvFile(envName) {
  // Look for .env, .env.local, .env.staging, .env.production, etc.
  const candidates = [
    path.join(PROJECT_DIR, `.env.${envName}`),
    path.join(PROJECT_DIR, `.env.${envName}.local`),
    path.join(PROJECT_DIR, `.env`),
  ];

  const vars = {};
  for (const f of candidates) {
    if (!fs.existsSync(f)) continue;
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      vars[key] = val;
    }
    break; // use first match only
  }
  return vars;
}

function listEnvs() {
  const envs = ['local'];
  try {
    const files = fs.readdirSync(PROJECT_DIR);
    files.forEach(f => {
      const m = f.match(/^\.env\.([a-zA-Z0-9_-]+)$/);
      if (m && m[1] !== 'local') envs.push(m[1]);
    });
  } catch (_) {}
  return [...new Set(envs)];
}

// ── SUITE DISCOVERY ───────────────────────────────────────────────────────────
function discoverSuites() {
  const suites = [];
  const testDirs = ['tests', 'test', 'e2e', 'specs', 'src/__tests__'];

  for (const dir of testDirs) {
    const abs = path.join(PROJECT_DIR, dir);
    if (!fs.existsSync(abs)) continue;
    walkDir(abs, abs, suites);
  }

  // Also check root for *.spec.ts / *.test.ts
  try {
    fs.readdirSync(PROJECT_DIR).forEach(f => {
      if (/\.(spec|test)\.(ts|js|mjs)$/.test(f)) {
        suites.push({ name: f, path: f, type: 'file' });
      }
    });
  } catch (_) {}

  return suites;
}

function walkDir(base, dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (_) { return; }

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkDir(base, full, out);
    } else if (/\.(spec|test)\.(ts|js|mjs)$/.test(e.name)) {
      out.push({
        name: e.name,
        path: path.relative(base, full),
        type: 'file',
      });
    }
  }
}

// ── RUN EXECUTION ─────────────────────────────────────────────────────────────
/**
 * config: {
 *   engine:   'playwright' | 'selenium',
 *   suite:    string | null,   // file path or tag, null = all
 *   env:      string,          // environment name
 *   workers:  number,
 *   headed:   boolean,
 *   retries:  number,
 *   tag:      string | null,   // @smoke etc
 *   project:  string | null,   // chromium | firefox | webkit
 * }
 */
function startRun(config = {}) {
  if (activeRun) {
    return { error: 'A run is already in progress. Stop it first.' };
  }

  const runId    = `run_${uid()}`;
  const startedAt = ms();
  const envVars  = loadEnvFile(config.env || activeEnv);

  // Build command
  let cmd, args;

  if (config.engine === 'selenium') {
    // Selenium: run via a custom runner script if present, else mocha
    const runnerPath = path.join(PROJECT_DIR, 'selenium-runner.js');
    if (fs.existsSync(runnerPath)) {
      cmd  = 'node';
      args = [runnerPath];
    } else {
      cmd  = 'npx';
      args = ['mocha', '--recursive', '--timeout', '30000', 'tests/**/*.spec.js'];
    }
  } else {
    // Playwright
    cmd  = 'npx';
    args = ['playwright', 'test'];

    if (config.suite)   args.push(config.suite);
    if (config.headed)  args.push('--headed');
    if (config.workers) args.push(`--workers=${config.workers}`);
    if (config.retries) args.push(`--retries=${config.retries}`);
    if (config.project) args.push(`--project=${config.project}`);
    if (config.tag)     args.push(`--grep=${config.tag}`);

    // Always output JSON results for parsing
    const resultsFile = path.join(RESULTS_DIR, `${runId}.json`);
    ensureDir(RESULTS_DIR);
    args.push('--reporter=line,json');
    args.push(`--output=${path.join(RESULTS_DIR, runId)}`);

    // Store results path for later retrieval
    config._resultsFile = resultsFile;
  }

  log(`Starting run ${runId}: ${cmd} ${args.join(' ')}`);

  const proc = spawn(cmd, args, {
    cwd: PROJECT_DIR,
    env: {
      ...process.env,
      ...envVars,
      FORCE_COLOR: '0',
      CI: '1',
    },
    shell: process.platform === 'win32',
  });

  const runRecord = {
    id:        runId,
    status:    'running',
    engine:    config.engine || 'playwright',
    env:       config.env || activeEnv,
    config,
    startedAt,
    endedAt:   null,
    duration:  null,
    passed:    0,
    failed:    0,
    skipped:   0,
    total:     0,
    logs:      [],
    errors:    [],
  };

  activeRun = { id: runId, proc, ...runRecord };

  broadcast('run.started', { runId, config: runRecord });

  // Stream stdout
  proc.stdout.on('data', chunk => {
    const lines = chunk.toString().split('\n');
    lines.forEach(line => {
      if (!line.trim()) return;
      activeRun.logs.push(line);

      const parsed = parseLine(line, runId);
      if (parsed) {
        if (parsed.kind === 'pass') activeRun.passed++;
        if (parsed.kind === 'fail') { activeRun.failed++; activeRun.errors.push(line.trim()); }
        broadcast('run.log', { runId, line, parsed });
      }
    });
  });

  // Stream stderr
  proc.stderr.on('data', chunk => {
    const line = chunk.toString().trim();
    if (!line) return;
    activeRun.logs.push(line);
    broadcast('run.log', { runId, line, parsed: { kind: 'error', text: line } });
  });

  proc.on('close', code => {
    if (!activeRun) return;

    const endedAt  = ms();
    const duration = endedAt - startedAt;
    const status   = code === 0 ? 'passed' : 'failed';

    activeRun.status   = status;
    activeRun.endedAt  = endedAt;
    activeRun.duration = duration;
    activeRun.total    = activeRun.passed + activeRun.failed;

    log(`Run ${runId} finished — ${status} (${activeRun.passed}P / ${activeRun.failed}F) in ${(duration/1000).toFixed(1)}s`);

    // Try to parse JSON results from Playwright
    if (config._resultsFile && fs.existsSync(config._resultsFile)) {
      try {
        const raw = JSON.parse(fs.readFileSync(config._resultsFile, 'utf8'));
        activeRun.results = raw;
      } catch (_) {}
    }

    // Save to history
    const record = { ...activeRun };
    delete record.proc; // don't serialise the child process
    runHistory.unshift(record);
    if (runHistory.length > MAX_HISTORY) runHistory.length = MAX_HISTORY;

    // Persist history
    try {
      ensureDir(RESULTS_DIR);
      fs.writeFileSync(path.join(RESULTS_DIR, 'history.json'), JSON.stringify(runHistory, null, 2));
    } catch (_) {}

    broadcast('run.completed', {
      runId,
      status,
      passed:   activeRun.passed,
      failed:   activeRun.failed,
      total:    activeRun.total,
      duration,
    });

    activeRun = null;
  });

  proc.on('error', err => {
    log(`Run ${runId} spawn error: ${err.message}`);
    broadcast('run.error', { runId, error: err.message });
    if (activeRun) { activeRun.status = 'error'; activeRun = null; }
  });

  return { runId, status: 'started' };
}

function stopRun() {
  if (!activeRun) return { error: 'No run in progress' };
  const { id, proc } = activeRun;
  try {
    proc.kill('SIGTERM');
    setTimeout(() => { try { proc.kill('SIGKILL'); } catch (_) {} }, 3000);
  } catch (e) { /* already dead */ }
  broadcast('run.stopped', { runId: id });
  activeRun.status = 'stopped';
  runHistory.unshift({ ...activeRun });
  activeRun = null;
  return { runId: id, status: 'stopped' };
}

// ── KATALON IMPORT ────────────────────────────────────────────────────────────
async function importKatalon(zipPath, destDir) {
  // Attempt to use AdmZip if installed; otherwise shell out to unzip
  let extracted = false;

  try {
    const AdmZip = require('adm-zip');
    const zip    = new AdmZip(zipPath);
    zip.extractAllTo(destDir, true);
    extracted = true;
  } catch (_) {
    // AdmZip not installed — try system unzip
    await new Promise((resolve, reject) => {
      const proc = spawn('unzip', ['-o', zipPath, '-d', destDir]);
      proc.on('close', code => code === 0 ? resolve() : reject(new Error('unzip failed')));
    });
    extracted = true;
  }

  if (!extracted) throw new Error('Could not extract zip — install adm-zip or system unzip');

  // Walk the extracted folder and discover Katalon test cases (*.tc, *.groovy)
  const cases = [];
  function walkKatalon(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walkKatalon(full); continue; }
      if (/\.(tc|groovy|xml)$/.test(e.name)) {
        cases.push({ name: e.name, path: path.relative(destDir, full) });
      }
    }
  }
  walkKatalon(destDir);

  return {
    success: true,
    extracted: destDir,
    testCases: cases.length,
    files: cases.slice(0, 20), // preview first 20
  };
}

// ── HTTP ROUTER ───────────────────────────────────────────────────────────────
function jsonRes(res, data, status = 200) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

async function router(req, res) {
  const url    = req.url.split('?')[0];
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type',
    });
    return res.end();
  }

  // ── GET /api/status ──────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/status') {
    return jsonRes(res, {
      ok:       true,
      version:  '1.0.0',
      project:  PROJECT_DIR,
      activeEnv,
      activeRun: activeRun ? {
        id:       activeRun.id,
        status:   activeRun.status,
        passed:   activeRun.passed,
        failed:   activeRun.failed,
        engine:   activeRun.engine,
        elapsed:  ms() - activeRun.startedAt,
      } : null,
      runCount: runHistory.length,
    });
  }

  // ── POST /api/run ────────────────────────────────────────────────────────
  if (method === 'POST' && url === '/api/run') {
    const body   = await readBody(req);
    const result = startRun(body);
    if (result.error) return jsonRes(res, result, 409);
    return jsonRes(res, result, 202);
  }

  // ── POST /api/run/stop ───────────────────────────────────────────────────
  if (method === 'POST' && url === '/api/run/stop') {
    return jsonRes(res, stopRun());
  }

  // ── GET /api/runs ────────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/runs') {
    return jsonRes(res, runHistory.map(r => ({
      id:        r.id,
      status:    r.status,
      engine:    r.engine,
      env:       r.env,
      passed:    r.passed,
      failed:    r.failed,
      total:     r.total,
      duration:  r.duration,
      startedAt: r.startedAt,
    })));
  }

  // ── GET /api/runs/:id ────────────────────────────────────────────────────
  const runMatch = url.match(/^\/api\/runs\/([a-z0-9_]+)$/);
  if (method === 'GET' && runMatch) {
    const id  = runMatch[1];
    const run = id === 'latest'
      ? runHistory[0]
      : runHistory.find(r => r.id === id);
    if (!run) return jsonRes(res, { error: 'Not found' }, 404);
    return jsonRes(res, run);
  }

  // ── GET /api/suites ──────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/suites') {
    return jsonRes(res, { suites: discoverSuites(), projectDir: PROJECT_DIR });
  }

  // ── GET /api/envs ────────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/envs') {
    return jsonRes(res, { envs: listEnvs(), active: activeEnv });
  }

  // ── POST /api/envs/:name/activate ────────────────────────────────────────
  const envMatch = url.match(/^\/api\/envs\/([^/]+)\/activate$/);
  if (method === 'POST' && envMatch) {
    activeEnv = envMatch[1];
    log(`Active environment: ${activeEnv}`);
    broadcast('env.changed', { env: activeEnv });
    return jsonRes(res, { active: activeEnv });
  }

  // ── GET /api/report ──────────────────────────────────────────────────────
  if (method === 'GET' && url === '/api/report') {
    const reportPath = path.join(PROJECT_DIR, 'playwright-report', 'index.html');
    if (!fs.existsSync(reportPath)) {
      return jsonRes(res, { error: 'No report found. Run tests first.' }, 404);
    }
    // Shell-open the report in the default browser
    const opener = process.platform === 'darwin' ? 'open'
                 : process.platform === 'win32'  ? 'start'
                 : 'xdg-open';
    spawn(opener, [reportPath], { detached: true, stdio: 'ignore' }).unref();
    return jsonRes(res, { opened: reportPath });
  }

  // ── POST /api/import/katalon ─────────────────────────────────────────────
  if (method === 'POST' && url === '/api/import/katalon') {
    // Expect raw zip body (Content-Type: application/octet-stream)
    const tmpZip  = path.join(os.tmpdir(), `katalon_${uid()}.zip`);
    const destDir = path.join(PROJECT_DIR, 'katalon-import', `import_${uid()}`);

    await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        try {
          fs.writeFileSync(tmpZip, Buffer.concat(chunks));
          resolve();
        } catch (e) { reject(e); }
      });
      req.on('error', reject);
    });

    try {
      const result = await importKatalon(tmpZip, destDir);
      fs.unlinkSync(tmpZip);
      return jsonRes(res, result);
    } catch (e) {
      return jsonRes(res, { error: e.message }, 500);
    }
  }

  // ── GET / (health check) ─────────────────────────────────────────────────
  if (method === 'GET' && url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('PlaywrightArc Studio Server — OK');
  }

  // 404
  jsonRes(res, { error: 'Not found', path: url }, 404);
}

// ── WEBSOCKET SERVER ──────────────────────────────────────────────────────────
/**
 * Minimal WebSocket server (no external dep — implements RFC 6455 handshake +
 * framing for text messages only, which is all we need for log streaming).
 */
function handleWsUpgrade(req, socket, head) {
  const key    = req.headers['sec-websocket-key'];
  const accept = require('crypto')
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );

  socket.on('error', () => wsClients.delete(ws));
  socket.on('close', () => wsClients.delete(ws));

  // Minimal send implementation
  const ws = {
    readyState: 1,
    send(data) {
      const buf = Buffer.from(data);
      const len = buf.length;
      let header;
      if (len < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x81; // FIN + text frame
        header[1] = len;
      } else if (len < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(len, 2);
      } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(len), 2);
      }
      socket.write(Buffer.concat([header, buf]));
    },
  };

  wsClients.add(ws);
  log(`WebSocket client connected (total: ${wsClients.size})`);

  // Send current run state immediately on connect
  if (activeRun) {
    ws.send(JSON.stringify({
      type: 'run.active',
      runId:   activeRun.id,
      status:  activeRun.status,
      passed:  activeRun.passed,
      failed:  activeRun.failed,
      engine:  activeRun.engine,
      elapsed: ms() - activeRun.startedAt,
      logs:    activeRun.logs.slice(-100), // last 100 lines
    }));
  }

  // Handle incoming messages (client can send { type:'ping' } etc.)
  socket.on('data', buf => {
    // Decode WebSocket frame (unmasked text only for simplicity)
    try {
      const opcode = buf[0] & 0x0f;
      if (opcode === 0x8) { socket.destroy(); return; } // close
      if (opcode !== 0x1) return; // only text frames

      const masked = (buf[1] & 0x80) !== 0;
      let offset = 2;
      let payloadLen = buf[1] & 0x7f;
      if (payloadLen === 126) { payloadLen = buf.readUInt16BE(2); offset = 4; }
      else if (payloadLen === 127) { payloadLen = Number(buf.readBigUInt64BE(2)); offset = 10; }

      const mask = masked ? buf.slice(offset, offset + 4) : null;
      if (masked) offset += 4;

      const payload = buf.slice(offset, offset + payloadLen);
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];

      const msg = JSON.parse(payload.toString());
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
    } catch (_) {}
  });
}

// ── HISTORY RESTORE ───────────────────────────────────────────────────────────
function restoreHistory() {
  const file = path.join(RESULTS_DIR, 'history.json');
  if (!fs.existsSync(file)) return;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(data)) {
      runHistory = data.slice(0, MAX_HISTORY);
      log(`Restored ${runHistory.length} runs from history`);
    }
  } catch (_) {}
}

// ── START SERVER ──────────────────────────────────────────────────────────────
restoreHistory();
ensureDir(RESULTS_DIR);

const server = http.createServer(async (req, res) => {
  try {
    await router(req, res);
  } catch (err) {
    log(`Unhandled error: ${err.message}`);
    jsonRes(res, { error: 'Internal server error', detail: err.message }, 500);
  }
});

server.on('upgrade', handleWsUpgrade);

server.listen(PORT, '127.0.0.1', () => {
  log('─'.repeat(50));
  log(`PlaywrightArc Studio Server v1.0.0`);
  log(`Listening on  http://localhost:${PORT}`);
  log(`WebSocket     ws://localhost:${PORT}/ws`);
  log(`Project dir   ${PROJECT_DIR}`);
  log(`Results dir   ${RESULTS_DIR}`);
  log(`Environment   ${activeEnv}`);
  log('─'.repeat(50));
  log('Ready. Open playwright-arc-studio.html in your browser.');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    log(`Port ${PORT} is in use. Try: node server.js --port=3002`);
  } else {
    log(`Server error: ${err.message}`);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);
function shutdown() {
  log('Shutting down…');
  if (activeRun) stopRun();
  server.close(() => process.exit(0));
}

# PlaywrightArc Studio — Setup Guide

## Project Structure

```
playwrightarc/
├── server.js                        ← Local dev server (run this first)
├── arc-client.js                    ← Browser↔server bridge (auto-loaded by shell)
├── package.json
├── playwright.config.ts
├── .env                             ← Default environment variables
├── .env.staging                     ← Staging overrides
├── .env.production                  ← Production overrides
├── tests/                           ← Your Playwright test files
│   └── checkout/
│       └── guest-checkout.spec.ts
├── playwright-arc-studio.html       ← Unified shell (open in browser)
├── playwright-arc-designer.html
├── playwright-arc-execution.html
├── playwright-arc-import.html
├── playwright-arc-api.html
├── playwright-arc-code.html
├── playwright-arc-envdata.html
├── playwright-arc-cicd.html
└── playwright-arc-collab.html
```

---

## 1. Install dependencies

```bash
npm install
npx playwright install --with-deps
```

---

## 2. Create environment files

**.env** (local defaults)
```
BASE_URL=http://localhost:3000
AUTH_TOKEN=dev-token-123
DB_SEED=true
```

**.env.staging**
```
BASE_URL=https://staging.myshop.com
AUTH_TOKEN=stg-token-abc
```

**.env.production**
```
BASE_URL=https://myshop.com
AUTH_TOKEN=prod-token-xyz
```

---

## 3. Start the server

```bash
node server.js
```

Options:
```bash
node server.js --port=3002              # custom port (default 3001)
node server.js --project=./my-tests    # custom project directory
```

Output:
```
[PlaywrightArc] ──────────────────────────────────────────────────
[PlaywrightArc] PlaywrightArc Studio Server v1.0.0
[PlaywrightArc] Listening on  http://localhost:3001
[PlaywrightArc] WebSocket     ws://localhost:3001/ws
[PlaywrightArc] Project dir   /your/project
[PlaywrightArc] Ready. Open playwright-arc-studio.html in your browser.
```

---

## 4. Wire the browser client into the shell

Add this line to `playwright-arc-studio.html` before the closing `</body>` tag:

```html
<script src="arc-client.js"></script>
```

That's it. The client will:
- Auto-detect the server on page load
- Wire the ▶ Run button to POST `/api/run`
- Stream live log output over WebSocket
- Update the sidebar run strip in real time
- Sync environment switching with the server

---

## 5. Open the shell

Open `playwright-arc-studio.html` directly in Chrome/Firefox.

> **Note:** Chrome blocks `file://` iframes loading other `file://` pages by default.
> Fix with one of:
>
> **Option A — Serve locally (recommended):**
> ```bash
> npx serve .         # or: python3 -m http.server 8080
> # open http://localhost:8080/playwright-arc-studio.html
> ```
>
> **Option B — Chrome flag (dev only):**
> ```bash
> open -a "Google Chrome" --args --allow-file-access-from-files
> ```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Server health + active run |
| POST | `/api/run` | Trigger a run |
| POST | `/api/run/stop` | Kill active run |
| GET | `/api/runs` | Run history (last 50) |
| GET | `/api/runs/latest` | Latest run details |
| GET | `/api/runs/:id` | Specific run |
| GET | `/api/suites` | Discovered test files |
| GET | `/api/envs` | Available environments |
| POST | `/api/envs/:name/activate` | Switch environment |
| GET | `/api/report` | Open HTML report in browser |
| POST | `/api/import/katalon` | Upload Katalon zip for import |

### POST /api/run — body options

```json
{
  "engine":  "playwright",
  "suite":   "tests/checkout",
  "env":     "staging",
  "workers": 4,
  "retries": 2,
  "headed":  false,
  "tag":     "@smoke",
  "project": "chromium"
}
```

### WebSocket events (ws://localhost:3001/ws)

| Event | Payload |
|-------|---------|
| `run.started` | `{ runId, config }` |
| `run.log` | `{ runId, line, parsed: { kind, text } }` |
| `run.completed` | `{ runId, status, passed, failed, total, duration }` |
| `run.stopped` | `{ runId }` |
| `run.error` | `{ runId, error }` |
| `run.active` | current run state on fresh WS connect |
| `env.changed` | `{ env }` |

---

## Selenium

The server supports Selenium runs via the `engine: "selenium"` option.

If you have a `selenium-runner.js` in your project root it will be called directly.
Otherwise the server falls back to `npx mocha tests/**/*.spec.js`.

Recommended selenium-runner.js stub:

```js
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

(async () => {
  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(new chrome.Options().headless())
    .build();
  try {
    await driver.get(process.env.BASE_URL || 'http://localhost:3000');
    console.log('✓ Homepage loaded');
    // add your Selenium tests here
  } finally {
    await driver.quit();
  }
})();
```

---

## Katalon Import

Trigger from the server API:

```bash
curl -X POST http://localhost:3001/api/import/katalon \
  -H "Content-Type: application/octet-stream" \
  --data-binary @./MyKatalonProject.zip
```

Or use the Import module UI — it already posts to this endpoint when the server is running.

The extracted files land in `./katalon-import/import_<id>/`.

---

## Troubleshooting

**`EADDRINUSE` on startup**
```bash
node server.js --port=3002
```

**Tests not found**
Put spec files in `tests/`, `test/`, `e2e/`, or `specs/` — or configure `testDir` in `playwright.config.ts`.

**`npx playwright` not found**
```bash
npm install -D @playwright/test
npx playwright install
```

**Shell iframes blank**
Serve the files over HTTP — see Step 5 above.

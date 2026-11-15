# Building a Continuous Same-Session Visual UI Skill in Antigravity CLI (`agy`)

When building a visual UI editing skill for Antigravity CLI (`agy`), the default execution lifecycle works against continuous interaction:
1. **If your skill runs the app server in the foreground**, `run_command` blocks the agent's execution thread until the server terminates, preventing the agent from editing files.
2. **If your skill launches the server in the background**, `run_command` returns immediately, the agent considers the launch task complete, and it ends its turn—returning you to the standard CLI prompt instead of reacting to your visual selections.

To keep the agent actively listening and applying UI modifications within the **exact same session**, you must decouple the **Application Server** (persistent background task) from the **Selection Bridge** (blocking IPC mechanism or lifecycle hook).

---

## Architecture Overview

```text
+-----------------------------------------------------------------------+
|                        Browser / Visual Dashboard                     |
|  [User clicks #hero-card] -> Types: "Make background dark gradient"   |
+-----------------------------------+-----------------------------------+
                                    | HTTP POST /api/ui-selection
                                    v
+-----------------------------------------------------------------------+
|                    Local Bridge / Dev Server Middleware               |
|         Writes atomic payload -> .ui-feedback/queue/1731700001.json   |
+-----------------------------------+-----------------------------------+
                                    | File System / IPC Event
                                    v
+-----------------------------------------------------------------------+
|                       Antigravity CLI (Same Session)                  |
|  1. Waiter Script / Stop Hook / MCP Tool unblocks & prints JSON       |
|  2. Agent edits target component via replace_file_content             |
|  3. HMR updates browser UI                                            |
|  4. Agent immediately re-enters waiter state for next selection       |
+-----------------------------------------------------------------------+
```

---

## Approach 1: Persistent App + Atomic Queue Waiter + Skill Loop (Recommended)

This architecture requires zero global configuration changes and lives entirely inside your project and `.agents/skills/` folder.

### 1. Visual Inspector Overlay (Frontend Snippet)

Inject or mount a lightweight inspector script into your dashboard application during development. Importantly, attach it to `document.body` outside your main React/Vue root so that if a component throws a render error, the overlay remains functional.

```javascript
// public/antigravity-ui-overlay.js
(function initAntigravityOverlay() {
  if (window.__AGY_OVERLAY_ACTIVE__) return;
  window.__AGY_OVERLAY_ACTIVE__ = true;

  let inspectMode = false;
  let selectedElement = null;

  // Create isolated Shadow DOM UI so app CSS never breaks the inspector
  const host = document.createElement('div');
  host.id = 'agy-inspector-host';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      .toolbar {
        position: fixed; bottom: 16px; right: 16px; z-index: 999999;
        background: #0f172a; color: #f8fafc; padding: 12px;
        border-radius: 10px; font-family: system-ui, sans-serif;
        box-shadow: 0 10px 25px rgba(0,0,0,0.4); width: 320px;
        border: 1px solid #334155;
      }
      .row { display: flex; gap: 8px; margin-top: 8px; }
      button {
        cursor: pointer; border: none; border-radius: 6px;
        padding: 6px 12px; font-weight: 600; font-size: 13px;
      }
      .btn-primary { background: #3b82f6; color: white; flex: 1; }
      .btn-danger { background: #ef4444; color: white; }
      .btn-toggle { background: #1e293b; color: #cbd5e1; border: 1px solid #475569; width: 100%; }
      .btn-toggle.active { background: #22c55e; color: #052e16; border-color: #22c55e; }
      textarea {
        width: 100%; box-sizing: border-box; margin-top: 8px;
        background: #1e293b; color: white; border: 1px solid #475569;
        border-radius: 6px; padding: 8px; font-size: 13px; resize: vertical;
      }
      .meta { font-size: 11px; color: #94a3b8; margin-top: 6px; word-break: break-all; }
    </style>
    <div class="toolbar">
      <button id="toggleBtn" class="btn-toggle">🎯 Pick UI Element (Off)</button>
      <div id="targetMeta" class="meta">No element selected</div>
      <textarea id="promptInput" rows="3" placeholder="Describe the UI change..."></textarea>
      <div class="row">
        <button id="sendBtn" class="btn-primary">Apply in CLI</button>
        <button id="doneBtn" class="btn-danger">Finish Session</button>
      </div>
    </div>
  `;

  const toggleBtn = shadow.getElementById('toggleBtn');
  const targetMeta = shadow.getElementById('targetMeta');
  const promptInput = shadow.getElementById('promptInput');
  const sendBtn = shadow.getElementById('sendBtn');
  const doneBtn = shadow.getElementById('doneBtn');

  function getCssSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.dataset && el.dataset.testid) return `[data-testid="${el.dataset.testid}"]`;
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE && el !== document.body) {
      let selector = el.nodeName.toLowerCase();
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (classes) selector += `.${classes}`;
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  }

  toggleBtn.addEventListener('click', () => {
    inspectMode = !inspectMode;
    toggleBtn.classList.toggle('active', inspectMode);
    toggleBtn.textContent = inspectMode ? '🎯 Click Any Element...' : '🎯 Pick UI Element (Off)';
  });

  document.addEventListener('click', (e) => {
    if (!inspectMode) return;
    if (e.composedPath().includes(host)) return;

    e.preventDefault();
    e.stopPropagation();

    selectedElement = {
      selector: getCssSelector(e.target),
      tagName: e.target.tagName.toLowerCase(),
      textSnippet: (e.target.innerText || '').slice(0, 80).trim(),
      componentHint: e.target.getAttribute('data-component') || e.target.closest('[data-component]')?.getAttribute('data-component') || null,
      outerHTMLSnippet: e.target.outerHTML.slice(0, 300)
    };

    inspectMode = false;
    toggleBtn.classList.remove('active');
    toggleBtn.textContent = '🎯 Pick UI Element (Off)';
    targetMeta.textContent = `Selected: ${selectedElement.selector}`;
    promptInput.focus();
  }, true);

  sendBtn.addEventListener('click', async () => {
    const instruction = promptInput.value.trim();
    if (!selectedElement || !instruction) {
      targetMeta.textContent = '⚠️ Select an element and enter instructions first.';
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending to Agent...';

    await fetch('/__agy_ui_bridge/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'pending',
        timestamp: Date.now(),
        element: selectedElement,
        instruction
      })
    });

    promptInput.value = '';
    sendBtn.disabled = false;
    sendBtn.textContent = 'Apply in CLI';
    targetMeta.textContent = '✅ Sent! Agent is updating the UI...';
  });

  doneBtn.addEventListener('click', async () => {
    await fetch('/__agy_ui_bridge/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done', timestamp: Date.now() })
    });
    targetMeta.textContent = '🛑 Session closed.';
  });
})();
```

---

### 2. Atomic Queue Writer (Vite / Express Middleware)

Never write directly to the file the CLI agent is polling. If the agent reads the file mid-write, `JSON.parse()` will fail with an unexpected EOF error. Always write to a `.tmp` file first and atomically rename it into `.ui-feedback/queue/`.

```javascript
// vite.agy-bridge.plugin.js (or Express middleware)
import fs from 'node:fs';
import path from 'node:path';

export function antigravityUiBridgePlugin() {
  const queueDir = path.resolve(process.cwd(), '.ui-feedback/queue');
  const stateFile = path.resolve(process.cwd(), '.ui-feedback/session.lock');

  return {
    name: 'antigravity-ui-bridge',
    configureServer(server) {
      fs.mkdirSync(queueDir, { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify({ active: true, pid: process.pid }));

      server.middlewares.use('/__agy_ui_bridge/select', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const tmpPath = path.join(queueDir, `${id}.tmp`);
            const finalPath = path.join(queueDir, `${id}.json`);

            // Atomic write: write to .tmp then rename to .json
            fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
            fs.renameSync(tmpPath, finalPath);

            if (payload.status === 'done' && fs.existsSync(stateFile)) {
              fs.unlinkSync(stateFile);
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, queuedId: id }));
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
        });
      });
    }
  };
}
```

---

### 3. The Blocking Queue Consumer Script (`await-selection.js`)

Place this script in `.agents/skills/visual-ui-editor/scripts/await-selection.js`. It consumes `.json` files in FIFO order, validates JSON integrity, and features a configurable keep-alive timeout so the CLI command never hangs forever if you walk away from your computer.

```javascript
#!/usr/bin/env node
// .agents/skills/visual-ui-editor/scripts/await-selection.js
const fs = require('node:fs');
const path = require('node:path');

const queueDir = path.resolve(process.cwd(), '.ui-feedback/queue');
const MAX_WAIT_MS = parseInt(process.env.AGY_WAIT_TIMEOUT_MS || '180000', 10); // Default 3 mins per cycle
const POLL_INTERVAL_MS = 350;

fs.mkdirSync(queueDir, { recursive: true });

const startTime = Date.now();
console.error('[visual-ui-editor] Waiting for user selection in browser...');

const timer = setInterval(() => {
  try {
    // 1. Check for timeout to avoid CLI command hard-kill
    if (Date.now() - startTime > MAX_WAIT_MS) {
      clearInterval(timer);
      console.log(JSON.stringify({
        status: 'heartbeat_timeout',
        message: 'No selection received within window. Re-invoke await-selection.js to continue listening.'
      }));
      process.exit(0);
    }

    // 2. Read queued .json files (ignoring .tmp files currently being written)
    const files = fs.readdirSync(queueDir)
      .filter((f) => f.endsWith('.json'))
      .sort(); // Chronological FIFO order

    if (files.length === 0) return;

    const oldestFile = path.join(queueDir, files[0]);
    const raw = fs.readFileSync(oldestFile, 'utf8').trim();
    if (!raw) return;

    // 3. Validate JSON before deleting
    const parsed = JSON.parse(raw);
    fs.unlinkSync(oldestFile);

    clearInterval(timer);
    // Print structured JSON to stdout for the Antigravity agent
    console.log(JSON.stringify({
      ...parsed,
      remainingInQueue: files.length - 1
    }, null, 2));
    process.exit(0);
  } catch (err) {
    // Ignore transient EBUSY / ENOENT / SyntaxError and retry on next tick
  }
}, POLL_INTERVAL_MS);
```

---

### 4. The Skill Definition (`SKILL.md`)

Create `.agents/skills/visual-ui-editor/SKILL.md`. Notice how it explicitly specifies `RunPersistent: true` and `WaitMsBeforeAsync` on the server launch command, and handles `heartbeat_timeout` and `manage_task` cleanup.

```markdown
---
name: visual-ui-editor
description: Starts the visual dashboard application and continuously edits UI components selected by the user in the same CLI session.
---

# Visual UI Editor Skill

Follow this exact state machine whenever the user asks to launch or run the visual UI editor skill.

## Step 1: Start the Application Server Persistently
1. Check if the dev server is already running using `manage_task` with `Action: "list"`.
2. If not running, start the application server using `run_command` with:
   - `CommandLine`: `"npm run dev"` (or the project's start script)
   - `RunPersistent`: `true`
   - `WaitMsBeforeAsync`: `3000`
3. Record the `TaskId` returned by `run_command` so you can terminate it cleanly when the session finishes.

## Step 2: Enter the Selection-Edit Loop
Run the blocking selection listener using `run_command`:
- `CommandLine`: `"node .agents/skills/visual-ui-editor/scripts/await-selection.js"`
- `WaitMsBeforeAsync`: `190000`

Inspect the JSON output printed to `stdout`:

### Case A: `"status": "pending"`
1. Locate the component corresponding to `element.selector`, `element.componentHint`, or `element.textSnippet`.
2. Apply the requested UI modification in `instruction` using `replace_file_content` or `multi_replace_file_content`.
3. Verify there are no syntax or compile errors.
4. **CRITICAL:** Do NOT finish your turn or ask the user a question in the CLI. Immediately go back to **Step 2** and execute `await-selection.js` again so the user can click the next element in the browser.

### Case B: `"status": "heartbeat_timeout"`
1. Immediately re-run **Step 2** (`node .agents/skills/visual-ui-editor/scripts/await-selection.js`) to keep listening.

### Case C: `"status": "done"`
1. Stop the background server using `manage_task` with `Action: "kill"` and the saved `TaskId`.
2. Provide a concise summary of all UI components modified during the session and end your turn.
```

---

## Approach 2: Guaranteed Loop Enforcement via Antigravity `Stop` Hook

Even with strict instructions in `SKILL.md`, LLMs occasionally summarize their edit and attempt to end their turn after completing a file modification.

You can make it **impossible** for the agent to drop the session prematurely by configuring an Antigravity `Stop` hook in `.agents/hooks.json`. Whenever the agent attempts to terminate its execution loop while `.ui-feedback/session.lock` exists, the `Stop` hook intercepts termination, waits for your next browser click, and injects `{"decision": "continue", "reason": "..."}` back into the active agent loop.

### 1. Workspace Hook Configuration (`.agents/hooks.json`)

Place this file at `.agents/hooks.json` in your project root (do **not** place it in `~/.gemini/antigravity-cli/settings.json`, where hooks are ignored).

> **⚠️ Critical Schema Rule:** Unlike `PreToolUse` and `PostToolUse`, the `Stop` event does **not** use a `matcher` wrapper. Its value must be a direct array of command handler objects. Wrapping `Stop` inside a nested `"hooks": [...]` object causes the Antigravity parser to reject the entire `hooks.json` file.

```json
{
  "enabled": true,
  "Stop": [
    {
      "type": "command",
      "command": "node .agents/skills/visual-ui-editor/scripts/stop-gate.js",
      "timeout": 300
    }
  ]
}
```

### 2. The `Stop` Hook Gate Script (`stop-gate.js`)

```javascript
#!/usr/bin/env node
// .agents/skills/visual-ui-editor/scripts/stop-gate.js
const fs = require('node:fs');
const path = require('node:path');

const stateFile = path.resolve(process.cwd(), '.ui-feedback/session.lock');
const queueDir = path.resolve(process.cwd(), '.ui-feedback/queue');

// Read stdin payload provided by Antigravity CLI
let stdinData = '';
process.stdin.on('data', (chunk) => { stdinData += chunk; });
process.stdin.on('end', () => {
  // If visual UI session is not active, allow normal turn completion
  if (!fs.existsSync(stateFile)) {
    console.log(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  }

  // Otherwise, block turn completion and wait for the next UI selection
  const startTime = Date.now();
  const HOOK_WAIT_LIMIT_MS = 240000; // 4 minutes (under the 300s hook timeout)

  const timer = setInterval(() => {
    if (!fs.existsSync(stateFile)) {
      clearInterval(timer);
      console.log(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    }

    if (Date.now() - startTime > HOOK_WAIT_LIMIT_MS) {
      clearInterval(timer);
      console.log(JSON.stringify({
        decision: 'continue',
        reason: 'Visual UI session is still active. Run await-selection.js to keep listening for user UI selections.'
      }));
      process.exit(0);
    }

    if (!fs.existsSync(queueDir)) return;
    const files = fs.readdirSync(queueDir).filter((f) => f.endsWith('.json')).sort();
    if (files.length === 0) return;

    try {
      const target = path.join(queueDir, files[0]);
      const payload = JSON.parse(fs.readFileSync(target, 'utf8'));
      fs.unlinkSync(target);
      clearInterval(timer);

      if (payload.status === 'done') {
        if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
        console.log(JSON.stringify({ decision: 'allow' }));
        process.exit(0);
      }

      // Force the agent to stay in the same session and apply the new change
      console.log(JSON.stringify({
        decision: 'continue',
        reason: `User selected element "${payload.element.selector}" (component hint: ${payload.element.componentHint || 'unknown'}) with instruction: "${payload.instruction}". Modify the corresponding UI component now.`
      }));
      process.exit(0);
    } catch (e) {
      // Retry on next poll tick if file is still being written
    }
  }, 350);
});
```

---

## Approach 3: Local MCP Server with Infinite Timeout (`timeoutSeconds: -1`)

If you prefer not to spawn shell scripts on each iteration, Antigravity CLI natively supports disabling tool timeouts for local stdio MCP servers via `timeoutSeconds: -1` in `.agents/mcp_config.json`.

### 1. Register the Server in `.agents/mcp_config.json`

```json
{
  "mcpServers": {
    "visual-ui-bridge": {
      "command": "node",
      "args": ["./.agents/skills/visual-ui-editor/scripts/mcp-ui-server.js"],
      "cwd": ".",
      "timeoutSeconds": -1
    }
  }
}
```

### 2. How It Works
- Because `timeoutSeconds` is set to `-1`, Antigravity CLI disables both the initial response timeout and overall execution timeout for tools exposed by `visual-ui-bridge`.
- Your MCP server exposes an `await_next_ui_selection` tool that holds the Promise open until your browser app sends an HTTP POST to the MCP server's local port, resolving the tool call directly into the model's context.

---

## Critical Edge Cases & Defensive Engineering

When running a long-lived visual editing loop in a single CLI session, watch out for these seven failure modes:

| Edge Case | Root Cause | Mitigation Built Into This Guide |
| :--- | :--- | :--- |
| **1. Corrupted JSON / Partial Reads (`SyntaxError`)** | The Node watcher reads `selection.json` at the exact millisecond the browser bridge is flushing bytes to disk. | **Atomic Write-Then-Rename:** The server writes to `${id}.tmp` and calls `fs.renameSync()` to `${id}.json`. The watcher ignores `.tmp` files. |
| **2. Rapid Multi-Click Overwrites** | You click a second button and submit a change while the agent is still editing the first component, overwriting `selection.json`. | **Timestamped FIFO Queue:** Every selection is saved as `.ui-feedback/queue/<timestamp>-<id>.json` and processed sequentially in chronological order. |
| **3. Broken HMR / Syntax Error Kills Overlay** | The agent introduces a JSX syntax error; React unmounts the page, destroying the visual picker UI so you cannot select anything to fix it. | **Shadow DOM Injection Outside App Root:** Attach the overlay script directly to `document.body` via `index.html` using an isolated Shadow DOM so it survives React error boundaries. |
| **4. `hooks.json` Silently Ignored** | Wrapping `Stop` handlers inside a nested `"hooks": [...]` array or placing `hooks.json` in `~/.gemini/antigravity-cli/settings.json`. | Place `.agents/hooks.json` in the workspace root and keep `"Stop"` as a flat array of command objects. Run `/hooks` in `agy` to verify it is loaded. |
| **5. Command / Hook Timeout While Thinking** | Taking 3+ minutes to inspect the dashboard causes `run_command` or the default 30-second `Stop` hook to time out and abort the loop. | Set `"timeout": 300` in `.agents/hooks.json` and emit a `"status": "heartbeat_timeout"` every 3 minutes in `await-selection.js` so the agent seamlessly re-polls. |
| **6. Orphaned Background Dev Servers** | Ending the session leaves `npm run dev` holding port 3000/5173 in the background. | Store the `TaskId` from `run_command` (`RunPersistent: true`) and explicitly call `manage_task` with `Action: "kill"` when `"status": "done"` is received. |
| **7. Context Window Bloat on 25+ Edits** | Sending full DOM trees (`outerHTML`) on every selection fills up the conversation context and triggers slow auto-compaction. | Truncate `outerHTMLSnippet` to 300 characters and pass `data-component` or concise CSS selectors instead of full DOM snapshots. |

---

## Quick Verification Checklist

1. **Verify Hook Registration:** Start `agy` and type `/hooks` in the interactive TUI. Confirm your `Stop` hook appears as active.
2. **Verify Background Server Management:** Trigger the skill and run `/tasks` in `agy` to verify your dev server is running persistently in the background.
3. **Test Queue Atomicity:** Submit two rapid changes in the browser UI while the agent is editing a file. Confirm `remainingInQueue: 1` appears in the first output and the agent immediately picks up the second queued file right after finishing the first edit.
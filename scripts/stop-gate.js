#!/usr/bin/env node

/**
 * Visual UI Studio - Antigravity Stop Hook Gate
 * Intercepts turn completion when a visual UI editing session is active (.ui-feedback/session.lock).
 * Enforces continuous same-session interaction by returning {"decision": "continue", "reason": "..."}
 * on new user selection or allowing exit when session ends or is inactive.
 */

const fs = require('fs');
const path = require('path');

const baseDir = process.cwd();
const stateFile = path.resolve(baseDir, '.ui-feedback/session.lock');
const queueDir = path.resolve(baseDir, '.ui-feedback/queue');

let stdinData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  stdinData += chunk;
});

process.stdin.on('end', () => {
  // If visual UI session is not active, allow normal turn completion
  if (!fs.existsSync(stateFile)) {
    console.log(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  }

  // Otherwise, block turn completion and wait for the next UI selection
  const startTime = Date.now();
  const HOOK_WAIT_LIMIT_MS = 240000; // 4 minutes (under the 300s hook timeout)
  const POLL_INTERVAL_MS = 250;

  function poll() {
    if (!fs.existsSync(stateFile)) {
      console.log(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    }

    if (Date.now() - startTime > HOOK_WAIT_LIMIT_MS) {
      console.log(
        JSON.stringify({
          decision: 'continue',
          reason: 'Visual UI session is still active. Run await-selection.js to keep listening for user UI selections.',
        })
      );
      process.exit(0);
    }

    if (!fs.existsSync(queueDir)) {
      return false;
    }

    let files = [];
    try {
      files = fs
        .readdirSync(queueDir)
        .filter((f) => f.endsWith('.json'))
        .sort();
    } catch {
      return false;
    }

    if (files.length === 0) return false;

    try {
      const target = path.join(queueDir, files[0]);
      const raw = fs.readFileSync(target, 'utf8');
      const payload = JSON.parse(raw);

      try {
        fs.unlinkSync(target);
      } catch {}

      if (payload.status === 'done') {
        if (fs.existsSync(stateFile)) {
          try {
            fs.unlinkSync(stateFile);
          } catch {}
        }
        console.log(JSON.stringify({ decision: 'allow' }));
        process.exit(0);
      }

      const selector = (payload.element && payload.element.selector) || 'unknown';
      const hint = (payload.element && payload.element.componentHint) || 'unknown';
      const instruction = payload.instruction || '';

      console.log(
        JSON.stringify({
          decision: 'continue',
          reason: `User selected element "${selector}" (component hint: ${hint}) with instruction: "${instruction}". Modify the corresponding UI component now.`,
        })
      );
      process.exit(0);
    } catch {
      // Retry on next tick
      return false;
    }
  }

  if (!poll()) {
    const timer = setInterval(() => {
      poll();
    }, POLL_INTERVAL_MS);
  }
});

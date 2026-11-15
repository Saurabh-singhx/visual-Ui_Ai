#!/usr/bin/env node

/**
 * Visual UI Studio - Continuous Same-Session Selection Listener
 * Consumes selection payloads from .ui-feedback/queue in FIFO chronological order.
 * Emits JSON to stdout for the CLI agent.
 */

const fs = require('fs');
const path = require('path');

// Parse flags (e.g. --timeout 180000 or --dir <path>)
const args = process.argv.slice(2);
let customTimeout = null;
let baseDir = process.cwd();

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--timeout' && i + 1 < args.length) {
    customTimeout = parseInt(args[++i], 10);
  } else if (args[i].startsWith('--timeout=')) {
    customTimeout = parseInt(args[i].split('=')[1], 10);
  } else if (args[i] === '--dir' && i + 1 < args.length) {
    baseDir = path.resolve(args[++i]);
  } else if (args[i].startsWith('--dir=')) {
    baseDir = path.resolve(args[i].split('=')[1]);
  }
}

const queueDir = path.resolve(baseDir, '.ui-feedback/queue');
const sessionLockFile = path.resolve(baseDir, '.ui-feedback/session.lock');
const MAX_WAIT_MS = customTimeout || parseInt(process.env.AGY_WAIT_TIMEOUT_MS || '180000', 10); // Default 3 minutes
const POLL_INTERVAL_MS = 250;

try {
  fs.mkdirSync(queueDir, { recursive: true });
} catch {}

const startTime = Date.now();

function checkQueue() {
  try {
    // 1. Check for timeout to avoid blocking forever
    if (Date.now() - startTime > MAX_WAIT_MS) {
      console.log(
        JSON.stringify({
          decision: 'continue',
          status: 'heartbeat_timeout',
          reason: 'Heartbeat timeout: no selection received within window. Re-invoke await-selection.js to continue listening.',
          message: 'No selection received within window. Re-invoke await-selection.js to continue listening.',
        })
      );
      process.exit(0);
    }

    if (!fs.existsSync(queueDir)) return false;

    // 2. Read queued .json files (ignoring .tmp files currently being written)
    const files = fs
      .readdirSync(queueDir)
      .filter((f) => f.endsWith('.json'))
      .sort(); // Chronological FIFO order

    if (files.length === 0) return false;

    const oldestFile = path.join(queueDir, files[0]);
    let raw = '';
    try {
      raw = fs.readFileSync(oldestFile, 'utf8').trim();
    } catch {
      return false;
    }

    if (!raw) return false;

    // 3. Validate JSON before deleting
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return false;
    }

    try {
      fs.unlinkSync(oldestFile);
    } catch {}

    const isDone = parsed.status === 'done';
    if (isDone && fs.existsSync(sessionLockFile)) {
      try {
        fs.unlinkSync(sessionLockFile);
      } catch {}
    }

    const selector = (parsed.element && parsed.element.selector) || 'unknown';
    const hint = (parsed.element && parsed.element.componentHint) || 'unknown';
    const instruction = parsed.instruction || '';

    const output = isDone
      ? {
          decision: 'allow',
          status: 'done',
          message: 'Visual UI session finished by user.',
          ...parsed,
          remainingInQueue: files.length - 1,
        }
      : {
          decision: 'continue',
          status: parsed.status || 'pending',
          reason: `User selected element "${selector}" (component hint: ${hint}) with instruction: "${instruction}". Modify the corresponding UI component now.`,
          ...parsed,
          remainingInQueue: files.length - 1,
        };

    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
  } catch {
    // Ignore transient filesystem errors and retry on next tick
    return false;
  }
}

// Immediate check on startup before waiting for interval
if (!checkQueue()) {
  const timer = setInterval(() => {
    checkQueue();
  }, POLL_INTERVAL_MS);
}

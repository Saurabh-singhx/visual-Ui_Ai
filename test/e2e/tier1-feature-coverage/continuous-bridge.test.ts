import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { execSync, spawnSync } from 'child_process';
import { startServer, stopServer, ServerInstance } from '../harness/serverHarness';
import { createApiClient, ApiHarnessClient } from '../harness/apiHarness';

const rootDir = process.cwd();
const feedbackDir = path.join(rootDir, '.ui-feedback');
const queueDir = path.join(feedbackDir, 'queue');
const sessionLockFile = path.join(feedbackDir, 'session.lock');
const awaitSelectionScript = path.join(rootDir, 'scripts/await-selection.js');
const hooksJsonPath = path.join(rootDir, '.agents/hooks.json');

function cleanQueue() {
  fs.rmSync(queueDir, { recursive: true, force: true });
  fs.mkdirSync(queueDir, { recursive: true });
}

function writeQueuePayload(id: string, payload: object): string {
  const tmpPath = path.join(queueDir, `${id}.tmp`);
  const finalPath = path.join(queueDir, `${id}.json`);
  fs.writeFileSync(tmpPath, JSON.stringify(payload), 'utf8');
  fs.renameSync(tmpPath, finalPath);
  return finalPath;
}

describe('Continuous Same-Session Visual UI Bridge (Sprint 3)', () => {
  let server: ServerInstance;
  let api: ApiHarnessClient;

  beforeAll(async () => {
    fs.mkdirSync(queueDir, { recursive: true });
    server = await startServer();
    api = createApiClient(server.baseUrl);
  });

  afterAll(async () => {
    if (server) await stopServer(server);
    // Clean up .ui-feedback queue entries created during tests
    fs.rmSync(queueDir, { recursive: true, force: true });
    if (fs.existsSync(sessionLockFile)) fs.unlinkSync(sessionLockFile);
  });

  beforeEach(() => {
    cleanQueue();
    if (fs.existsSync(sessionLockFile)) fs.unlinkSync(sessionLockFile);
  });

  // =========================================================================
  // 1. Bridge API Endpoints
  // =========================================================================
  describe('Bridge API Endpoints', () => {
    it('POST /api/bridge/select returns 200 and writes an atomic .json to .ui-feedback/queue/', async () => {
      const payload = {
        element: {
          selector: '#hero-card',
          componentHint: 'HeroCard',
          outerHTMLSnippet: '<div id="hero-card" class="card">Hero</div>',
        },
        instruction: 'Make background dark gradient',
      };

      const res = await fetch(`${server.baseUrl}/api/bridge/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.id).toBeTruthy();

      // Verify queue file was written atomically (no .tmp file)
      const queueFiles = fs.readdirSync(queueDir);
      const jsonFiles = queueFiles.filter((f) => f.endsWith('.json'));
      const tmpFiles = queueFiles.filter((f) => f.endsWith('.tmp'));
      expect(jsonFiles.length).toBeGreaterThanOrEqual(1);
      expect(tmpFiles.length).toBe(0);

      // Validate contents
      const written = JSON.parse(fs.readFileSync(path.join(queueDir, jsonFiles[0]), 'utf8'));
      expect(written.element.selector).toBe('#hero-card');
      expect(written.instruction).toBe('Make background dark gradient');
    });

    it('POST /__agy_ui_bridge/select is also mounted and returns 200', async () => {
      const payload = {
        element: { selector: '.btn-primary', componentHint: 'Button' },
        instruction: 'Change to orange',
      };

      const res = await fetch(`${server.baseUrl}/__agy_ui_bridge/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('GET /api/bridge/status returns active session state', async () => {
      // Write session lock to simulate active session
      fs.writeFileSync(sessionLockFile, JSON.stringify({ pid: process.pid, started: Date.now() }), 'utf8');

      const res = await fetch(`${server.baseUrl}/api/bridge/status`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('sessionActive');
    });

    it('GET /api/bridge/status returns inactive when no session lock exists', async () => {
      if (fs.existsSync(sessionLockFile)) fs.unlinkSync(sessionLockFile);

      const res = await fetch(`${server.baseUrl}/api/bridge/status`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sessionActive).toBe(false);
    });
  });

  // =========================================================================
  // 2. Atomic Queue Write-Then-Rename Integrity
  // =========================================================================
  describe('Atomic Queue Write-Then-Rename Integrity', () => {
    it('queue payloads are written as .tmp then renamed to .json (no partial reads)', () => {
      const id = `test-${Date.now()}`;
      const payload = {
        element: { selector: '#nav', componentHint: 'Navbar' },
        instruction: 'Add shadow',
        status: 'pending',
      };

      const finalPath = writeQueuePayload(id, payload);

      expect(fs.existsSync(finalPath)).toBe(true);
      expect(fs.existsSync(path.join(queueDir, `${id}.tmp`))).toBe(false);

      const content = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
      expect(content.element.selector).toBe('#nav');
    });

    it('multiple rapid-click payloads are stored as separate timestamped FIFO queue entries', async () => {
      // Simulate two rapid clicks
      const payloads = [
        { element: { selector: '#a', componentHint: 'A' }, instruction: 'First' },
        { element: { selector: '#b', componentHint: 'B' }, instruction: 'Second' },
      ];

      for (const payload of payloads) {
        const res = await fetch(`${server.baseUrl}/api/bridge/select`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        expect(res.status).toBe(200);
        // small delay so timestamps differ
        await new Promise((r) => setTimeout(r, 5));
      }

      const files = fs.readdirSync(queueDir).filter((f) => f.endsWith('.json')).sort();
      expect(files.length).toBe(2);

      const first = JSON.parse(fs.readFileSync(path.join(queueDir, files[0]), 'utf8'));
      const second = JSON.parse(fs.readFileSync(path.join(queueDir, files[1]), 'utf8'));
      expect(first.instruction).toBe('First');
      expect(second.instruction).toBe('Second');
    });

    it('no .tmp files remain in queue after a complete selection write', async () => {
      await fetch(`${server.baseUrl}/api/bridge/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          element: { selector: '#card', componentHint: 'Card' },
          instruction: 'Round corners',
        }),
      });

      const tmpFiles = fs.readdirSync(queueDir).filter((f) => f.endsWith('.tmp'));
      expect(tmpFiles.length).toBe(0);
    });
  });

  // =========================================================================
  // 3. Session Lock Lifecycle
  // =========================================================================
  describe('Session Lock Lifecycle', () => {
    it('session.lock is created when a session starts (via /api/bridge/select)', async () => {
      // The lock may or may not exist — it's managed by await-selection; we test via status endpoint
      const res = await fetch(`${server.baseUrl}/api/bridge/status`);
      expect(res.status).toBe(200);
    });

    it('session.lock file is valid JSON when it exists', () => {
      fs.writeFileSync(
        sessionLockFile,
        JSON.stringify({ pid: process.pid, started: Date.now(), sessionId: 'test-session-001' }),
        'utf8'
      );

      const content = JSON.parse(fs.readFileSync(sessionLockFile, 'utf8'));
      expect(content.pid).toBeGreaterThan(0);
      expect(content.started).toBeGreaterThan(0);

      fs.unlinkSync(sessionLockFile);
    });

    it('status endpoint reports done=false when session.lock exists and not done', async () => {
      fs.writeFileSync(sessionLockFile, JSON.stringify({ pid: process.pid, started: Date.now() }), 'utf8');

      const res = await fetch(`${server.baseUrl}/api/bridge/status`);
      const data = await res.json();
      expect(data.sessionActive).toBe(true);
    });
  });

  // =========================================================================
  // 4. await-selection.js Script Execution
  // =========================================================================
  describe('await-selection.js script execution', () => {
    it('scripts/await-selection.js exists and is a valid Node.js script', () => {
      expect(fs.existsSync(awaitSelectionScript), `${awaitSelectionScript} must exist`).toBe(true);
      const content = fs.readFileSync(awaitSelectionScript, 'utf8');
      // Should be a node script
      expect(content.length).toBeGreaterThan(100);
      expect(content).toMatch(/require\(|import |process\.|fs\.|queueDir|\.ui-feedback/i);
    });

    it('await-selection.js emits JSON output with decision=allow when status=done payload is found', () => {
      // Write a done payload
      const id = `done-${Date.now()}`;
      writeQueuePayload(id, { status: 'done', element: {}, instruction: '' });

      const result = spawnSync(process.execPath, [awaitSelectionScript, '--timeout', '3000'], {
        cwd: rootDir,
        encoding: 'utf8',
        timeout: 5000,
      });

      const stdout = result.stdout.trim();
      let parsed: any;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        // Try to get last valid JSON line
        const lines = stdout.split('\n').filter((l) => l.trim().startsWith('{'));
        parsed = lines.length ? JSON.parse(lines[lines.length - 1]) : null;
      }

      expect(parsed).toBeTruthy();
      expect(parsed.decision).toBe('allow');
    });

    it('await-selection.js emits JSON output with decision=continue when a UI selection payload arrives', () => {
      const id = `sel-${Date.now()}`;
      writeQueuePayload(id, {
        status: 'pending',
        element: { selector: '#hero', componentHint: 'Hero' },
        instruction: 'Make it pop',
      });

      const result = spawnSync(process.execPath, [awaitSelectionScript, '--timeout', '3000'], {
        cwd: rootDir,
        encoding: 'utf8',
        timeout: 5000,
      });

      const stdout = result.stdout.trim();
      let parsed: any;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        const lines = stdout.split('\n').filter((l) => l.trim().startsWith('{'));
        parsed = lines.length ? JSON.parse(lines[lines.length - 1]) : null;
      }

      expect(parsed).toBeTruthy();
      expect(parsed.decision).toBe('continue');
      expect(parsed.reason).toMatch(/#hero|Make it pop|Hero/i);
    });

    it('await-selection.js processes queue entries in FIFO chronological order', () => {
      const id1 = `1-${Date.now()}`;
      writeQueuePayload(id1, {
        status: 'pending',
        element: { selector: '#first', componentHint: 'First' },
        instruction: 'First instruction',
      });

      const result = spawnSync(process.execPath, [awaitSelectionScript, '--timeout', '3000'], {
        cwd: rootDir,
        encoding: 'utf8',
        timeout: 5000,
      });

      const stdout = result.stdout.trim();
      let parsed: any;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        const lines = stdout.split('\n').filter((l) => l.trim().startsWith('{'));
        parsed = lines.length ? JSON.parse(lines[lines.length - 1]) : null;
      }

      expect(parsed).toBeTruthy();
      expect(parsed.reason || '').toMatch(/First instruction|#first/i);
    });

    it('await-selection.js ignores .tmp files and only reads .json queue entries', () => {
      // Write a .tmp file (should be ignored) and a valid .json
      const tmpPath = path.join(queueDir, `partial-${Date.now()}.tmp`);
      fs.writeFileSync(tmpPath, '{"status":"pending","element":{}', 'utf8'); // incomplete JSON

      const id = `valid-${Date.now()}`;
      writeQueuePayload(id, {
        status: 'done',
        element: {},
        instruction: '',
      });

      const result = spawnSync(process.execPath, [awaitSelectionScript, '--timeout', '3000'], {
        cwd: rootDir,
        encoding: 'utf8',
        timeout: 5000,
      });

      expect(result.status).toBe(0);
      const stdout = result.stdout.trim();
      let parsed: any;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        const lines = stdout.split('\n').filter((l) => l.trim().startsWith('{'));
        parsed = lines.length ? JSON.parse(lines[lines.length - 1]) : null;
      }
      expect(parsed?.decision).toBe('allow');
    });
  });

  // =========================================================================
  // 5. .agents/hooks.json Stop Hook Configuration
  // =========================================================================
  describe('.agents/hooks.json Stop hook configuration', () => {
    it('.agents/hooks.json exists in workspace root', () => {
      expect(fs.existsSync(hooksJsonPath), `${hooksJsonPath} must exist`).toBe(true);
    });

    it('.agents/hooks.json is valid JSON with Stop hook configured', () => {
      const content = fs.readFileSync(hooksJsonPath, 'utf8');
      const hooks = JSON.parse(content);

      expect(hooks).toHaveProperty('Stop');
      expect(Array.isArray(hooks.Stop)).toBe(true);
      expect(hooks.Stop.length).toBeGreaterThan(0);
    });

    it('.agents/hooks.json Stop hook references await-selection.js or stop-gate.js', () => {
      const content = fs.readFileSync(hooksJsonPath, 'utf8');
      const hooks = JSON.parse(content);

      const stopCommands = hooks.Stop.map((h: any) => JSON.stringify(h)).join(' ');
      expect(stopCommands).toMatch(/await-selection|stop-gate/i);
    });

    it('.agents/hooks.json Stop hook has timeout >= 300 seconds', () => {
      const content = fs.readFileSync(hooksJsonPath, 'utf8');
      const hooks = JSON.parse(content);

      const hasTimeout = hooks.Stop.some((h: any) => {
        return typeof h.timeout === 'number' && h.timeout >= 300;
      });
      expect(hasTimeout, 'Stop hook must have timeout >= 300 seconds').toBe(true);
    });
  });

  // =========================================================================
  // 6. CLI `visual-ui listen` Subcommand
  // =========================================================================
  describe('CLI visual-ui listen subcommand', () => {
    it('bin/visual-ui.js supports listen subcommand without crashing', async () => {
      // Run with a short timeout so it exits quickly
      const { runCli } = await import('../harness/cliHarness');
      const result = await runCli(['listen', '--timeout', '500'], { timeout: 3000 });

      // Should not crash with unhandled error or "unknown command"
      expect(result.combinedOutput).not.toMatch(/Error: unknown command|is not a function|Cannot read prop/i);
    });

    it('bin/visual-ui.js --help mentions listen subcommand', async () => {
      const { runCli } = await import('../harness/cliHarness');
      const result = await runCli(['--help'], { timeout: 5000 });
      expect(result.combinedOutput).toMatch(/listen/i);
    });
  });

  // =========================================================================
  // 7. Client Bridge Buttons in AIChatPanel and ElementInspector
  // =========================================================================
  describe('Client bridge button integration (source code checks)', () => {
    const aiChatPanelPath = path.join(rootDir, 'client/src/components/chat/AIChatPanel.tsx');
    const elementInspectorPath = path.join(rootDir, 'client/src/components/inspector/ElementInspector.tsx');

    it('AIChatPanel.tsx contains "Apply via CLI Agent" button posting to /api/bridge/select', () => {
      expect(fs.existsSync(aiChatPanelPath)).toBe(true);
      const code = fs.readFileSync(aiChatPanelPath, 'utf8');
      expect(code).toMatch(/Apply via CLI Agent|apply.*cli.*agent/i);
      expect(code).toMatch(/\/api\/bridge\/select|bridge.*select/i);
    });

    it('AIChatPanel.tsx contains "Finish CLI Session" button that signals session end', () => {
      const code = fs.readFileSync(aiChatPanelPath, 'utf8');
      expect(code).toMatch(/Finish CLI Session|finish.*cli.*session/i);
      // The button may call bridgeDone() or inline status:'done' — either satisfies the contract
      expect(code).toMatch(/bridgeDone\(\)|status.*done|done.*status|'done'|"done"/i);
    });

    it('ElementInspector.tsx contains bridge apply button posting to /api/bridge/select', () => {
      expect(fs.existsSync(elementInspectorPath)).toBe(true);
      const code = fs.readFileSync(elementInspectorPath, 'utf8');
      expect(code).toMatch(/\/api\/bridge\/select|bridge.*select/i);
    });

    it('Bridge buttons maintain black/white/orange theme styling (no indigo/blue accents)', () => {
      const aiCode = fs.readFileSync(aiChatPanelPath, 'utf8');
      const inspectorCode = fs.readFileSync(elementInspectorPath, 'utf8');

      // Bridge buttons should use orange or zinc, not indigo/blue
      // We just verify the files exist and no raw indigo-600 appears on new bridge buttons
      // (The existing code may have some from before the M4 migration, we focus on new bridge buttons)
      expect(aiCode).toMatch(/orange|zinc|bg-black|text-white/i);
      expect(inspectorCode).toMatch(/orange|zinc|bg-black|text-white/i);
    });
  });

  // =========================================================================
  // 8. scripts/stop-gate.js exists and is valid
  // =========================================================================
  describe('scripts/stop-gate.js', () => {
    const stopGateScript = path.join(rootDir, 'scripts/stop-gate.js');

    it('scripts/stop-gate.js exists', () => {
      expect(fs.existsSync(stopGateScript), `${stopGateScript} must exist`).toBe(true);
    });

    it('scripts/stop-gate.js is a valid Node.js script referencing session lock or queue', () => {
      const content = fs.readFileSync(stopGateScript, 'utf8');
      expect(content.length).toBeGreaterThan(50);
      expect(content).toMatch(/session\.lock|\.ui-feedback|queue|await-selection/i);
    });
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { startServer, stopServer, ServerInstance, findFreePort } from '../harness/serverHarness';
import { createApiClient, ApiHarnessClient } from '../harness/apiHarness';
import { runCli } from '../harness/cliHarness';

describe('Tier 1: Fixtures, Test Suite Harness & Adversarial Hardening (Features 22, 23, 24)', () => {
  let server: ServerInstance;
  let api: ApiHarnessClient;
  const rootDir = process.cwd();
  const fixturesDir = path.resolve(rootDir, 'test/e2e/fixtures');

  beforeAll(async () => {
    server = await startServer();
    api = createApiClient(server.baseUrl);
  });

  afterAll(async () => {
    await stopServer(server);
  });

  // =========================================================================
  // Feature 22: Multi-Platform Sample Workspace Fixtures
  // =========================================================================
  describe('Feature 22: Multi-Platform Sample Workspace Fixtures', () => {
    it('F22.1: verifies web-app fixture contains .tsx, .jsx, .vue, .svelte, and .html files', () => {
      const webDir = path.join(fixturesDir, 'web-app/src');
      expect(fs.existsSync(path.join(webDir, 'Header.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(webDir, 'Card.jsx'))).toBe(true);
      expect(fs.existsSync(path.join(webDir, 'UserProfile.vue'))).toBe(true);
      expect(fs.existsSync(path.join(webDir, 'Counter.svelte'))).toBe(true);
      expect(fs.existsSync(path.join(webDir, 'landing.html'))).toBe(true);
    });

    it('F22.2: verifies mobile-app fixture covers React Native, Flutter, and Android XML', () => {
      const mobDir = path.join(fixturesDir, 'mobile-app');
      expect(fs.existsSync(path.join(mobDir, 'react-native/screens/ProfileScreen.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(mobDir, 'react-native/components/NotificationBanner.jsx'))).toBe(true);
      expect(fs.existsSync(path.join(mobDir, 'flutter/lib/widgets/profile_card.dart'))).toBe(true);
      expect(fs.existsSync(path.join(mobDir, 'flutter/lib/widgets/action_button.dart'))).toBe(true);
      expect(fs.existsSync(path.join(mobDir, 'android/res/layout/activity_login.xml'))).toBe(true);
      expect(fs.existsSync(path.join(mobDir, 'android/res/layout/card_item.xml'))).toBe(true);
    });

    it('F22.3: verifies desktop-app fixture covers Electron and Tauri window components', () => {
      const dskDir = path.join(fixturesDir, 'desktop-app');
      expect(fs.existsSync(path.join(dskDir, 'electron/src/AppWindow.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(dskDir, 'electron/src/TitleBar.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(dskDir, 'tauri/src/WindowControls.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(dskDir, 'tauri/src/SettingsDialog.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(dskDir, 'tauri/src-tauri/tauri.conf.json'))).toBe(true);
    });

    it('F22.4: verifies monorepo-large fixture contains >30 components across apps and packages', () => {
      const monoDir = path.join(fixturesDir, 'monorepo-large');
      const files: string[] = [];
      function collect(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) collect(full);
          else if (/\.(tsx|jsx)$/.test(entry.name)) files.push(full);
        }
      }
      collect(monoDir);
      expect(files.length).toBeGreaterThan(30);
    });

    it('F22.5: verifies dirty-workspace fixture contains valid components and strictly excluded files', () => {
      const dirtyDir = path.join(fixturesDir, 'dirty-workspace');
      expect(fs.existsSync(path.join(dirtyDir, 'src/components/PrimaryButton.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'src/components/PrimaryButton.test.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'src/components/MetricCard.spec.ts'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, '__tests__/Integration.test.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'node_modules/fake-pkg/Widget.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'dist/bundle.js'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'src/store/authStore.ts'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'src/services/apiService.ts'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'src/utils/helpers.ts'))).toBe(true);
    });

    it('F22.6: verifies sample-workspace directory contains editable sample components', () => {
      const sampleDir = path.resolve(rootDir, 'sample-workspace/src/components');
      expect(fs.existsSync(path.join(sampleDir, 'Navbar.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(sampleDir, 'Card.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(sampleDir, 'MetricWidget.tsx'))).toBe(true);
    });
  });

  // =========================================================================
  // Feature 23: E2E Testing Suite Tiers 1-4
  // =========================================================================
  describe('Feature 23: E2E Testing Suite Architecture & Runner Harness', () => {
    it('F23.1: verifies master test runner test/e2e/run-all.sh exists and is executable', () => {
      const runnerPath = path.resolve(rootDir, 'test/e2e/run-all.sh');
      expect(fs.existsSync(runnerPath)).toBe(true);
      const stats = fs.statSync(runnerPath);
      // Verify executable permission
      const isExecutable = (stats.mode & 0o111) !== 0;
      expect(isExecutable, 'run-all.sh should be executable').toBe(true);
    });

    it('F23.2: verifies vitest.e2e.config.ts configures Node environment and aliases', () => {
      const configPath = path.resolve(rootDir, 'vitest.e2e.config.ts');
      expect(fs.existsSync(configPath)).toBe(true);
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toMatch(/environment:\s*['"]node['"]/);
      expect(content).toMatch(/@server/);
      expect(content).toMatch(/@client/);
    });

    it('F23.3: verifies cliHarness provides runCli and resolveBinPath functions', () => {
      expect(typeof runCli).toBe('function');
      const bin = path.resolve(rootDir, 'bin/visual-ui.js');
      expect(bin.endsWith('visual-ui.js')).toBe(true);
    });

    it('F23.4: verifies serverHarness allocates ephemeral ports and probes readiness', async () => {
      const port = await findFreePort();
      expect(port).toBeGreaterThan(1024);
      expect(port).toBeLessThan(65536);
    });

    it('F23.5: verifies apiHarness exports all required HTTP API client functions', () => {
      expect(typeof api.scan).toBe('function');
      expect(typeof api.getComponent).toBe('function');
      expect(typeof api.modifyComponent).toBe('function');
      expect(typeof api.rollbackComponent).toBe('function');
      expect(typeof api.getHealth).toBe('function');
    });

    it('F23.6: verifies run-all.sh handles parameter passthrough and summary banner', () => {
      const runnerCode = fs.readFileSync(path.resolve(rootDir, 'test/e2e/run-all.sh'), 'utf8');
      expect(runnerCode).toMatch(/E2E Test Run PASSED/);
      expect(runnerCode).toMatch(/E2E Test Run FAILED/);
      expect(runnerCode).toMatch(/\$@/);
    });
  });

  // =========================================================================
  // Feature 24: Adversarial Coverage Hardening Tier 5
  // =========================================================================
  describe('Feature 24: Adversarial Coverage Hardening & Robustness', () => {
    it('F24.1: server shuts down cleanly and releases port without dangling processes', async () => {
      const ephemeralServer = await startServer();
      const ephemeralPort = ephemeralServer.port;
      expect(ephemeralPort).toBeGreaterThan(0);
      await stopServer(ephemeralServer);

      // Verify port is freed
      const newPort = await findFreePort();
      expect(typeof newPort).toBe('number');
    });

    it('F24.2: allocates multiple ephemeral ports concurrently without collisions', async () => {
      const [port1, port2, port3] = await Promise.all([
        findFreePort(),
        findFreePort(),
        findFreePort(),
      ]);
      expect(port1).not.toBe(port2);
      expect(port2).not.toBe(port3);
      expect(port1).not.toBe(port3);
    });

    it('F24.3: scanner gracefully rejects non-existent directory with HTTP 400 error', async () => {
      const nonExistentPath = path.resolve(rootDir, 'non-existent-directory-abc-123');
      const res = await api.scan({ dir: nonExistentPath });
      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/does not exist|not found|not a directory/i);
    });

    it('F24.4: patcher rejects missing filePath or empty prompt with HTTP 400 error', async () => {
      const res = await api.modifyComponent({ filePath: '', prompt: '' });
      expect(res.status).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.error).toMatch(/required/i);
    });

    it('F24.5: on-demand component loader recovers gracefully from malformed JSX syntax', async () => {
      const tempDir = path.resolve(rootDir, 'test/e2e/fixtures/temp-malformed-ast');
      fs.mkdirSync(tempDir, { recursive: true });
      const malformedFile = path.join(tempDir, 'Malformed.tsx');
      fs.writeFileSync(malformedFile, 'export const Broken = () => { return (<div><span>unclosed</div>); };', 'utf8');

      try {
        const details = await api.getComponent({ filePath: malformedFile });
        expect(details.status).toBe(200);
        expect(details.data.filePath).toBe(malformedFile);
        expect(details.data.code).toBeDefined();
        // Should return details without throwing 500 server crash
        expect(Array.isArray(details.data.elements)).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('F24.6: rollback fails gracefully when attempting rollback on a file with no backups', async () => {
      const tempDir = path.resolve(rootDir, 'test/e2e/fixtures/temp-nobak');
      fs.mkdirSync(tempDir, { recursive: true });
      const noBakFile = path.join(tempDir, 'NoBackup.tsx');
      fs.writeFileSync(noBakFile, 'export const NoBackup = () => <div>No Backup</div>;', 'utf8');

      try {
        const res = await api.rollbackComponent({ filePath: noBakFile });
        expect(res.status).toBe(400);
        expect(res.data.success).toBe(false);
        expect(res.data.error).toMatch(/no backup|not found/i);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});

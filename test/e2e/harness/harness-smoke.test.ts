import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { resolveBinPath, runCli, extractJsonFromOutput } from './cliHarness';
import { findFreePort, startServer, stopServer } from './serverHarness';
import { createApiClient, ApiHarnessClient } from './apiHarness';
import {
  assertComponentDiscovered,
  assertComponentExcluded,
  assertHighVolumeDetected,
  assertFolderBreakdown,
  assertElementHierarchyValid,
  assertElementClassification,
  assertBackupCreated,
  assertRollbackRestored,
  assertTailwindAnimationApplied,
} from './assertionHarness';

describe('E2E Test Harness & Fixtures Smoke Suite', () => {
  const projectRoot = path.resolve(__dirname, '../../../');
  const fixturesRoot = path.resolve(projectRoot, 'test/e2e/fixtures');

  describe('Fixtures Verification', () => {
    it('verifies web-app multi-framework fixture files exist', () => {
      const webDir = path.join(fixturesRoot, 'web-app/src');
      expect(fs.existsSync(webDir), 'web-app/src directory should exist').toBe(true);

      const files = ['Header.tsx', 'Card.jsx', 'UserProfile.vue', 'Counter.svelte', 'landing.html'];
      for (const file of files) {
        const filePath = path.join(webDir, file);
        expect(fs.existsSync(filePath), `Fixture file ${file} must exist`).toBe(true);
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content.length, `Fixture file ${file} must not be empty`).toBeGreaterThan(50);
      }
    });

    it('verifies mobile-app fixture covers React Native, Flutter, and Android XML', () => {
      const mobileDir = path.join(fixturesRoot, 'mobile-app');

      // React Native
      const rnScreen = path.join(mobileDir, 'react-native/screens/ProfileScreen.tsx');
      const rnBanner = path.join(mobileDir, 'react-native/components/NotificationBanner.jsx');
      expect(fs.existsSync(rnScreen), 'ProfileScreen.tsx must exist').toBe(true);
      expect(fs.existsSync(rnBanner), 'NotificationBanner.jsx must exist').toBe(true);
      const rnContent = fs.readFileSync(rnScreen, 'utf8');
      expect(rnContent).toContain("from 'react-native'");
      expect(rnContent).toContain('<TouchableOpacity');

      // Flutter
      const flutterBtn = path.join(mobileDir, 'flutter/lib/widgets/action_button.dart');
      const flutterCard = path.join(mobileDir, 'flutter/lib/widgets/profile_card.dart');
      expect(fs.existsSync(flutterBtn), 'action_button.dart must exist').toBe(true);
      expect(fs.existsSync(flutterCard), 'profile_card.dart must exist').toBe(true);
      const flutterContent = fs.readFileSync(flutterBtn, 'utf8');
      expect(flutterContent).toContain('StatelessWidget');
      expect(flutterContent).toContain('package:flutter/material.dart');

      // Android XML
      const xmlLogin = path.join(mobileDir, 'android/res/layout/activity_login.xml');
      const xmlCard = path.join(mobileDir, 'android/res/layout/card_item.xml');
      expect(fs.existsSync(xmlLogin), 'activity_login.xml must exist').toBe(true);
      expect(fs.existsSync(xmlCard), 'card_item.xml must exist').toBe(true);
      const xmlContent = fs.readFileSync(xmlLogin, 'utf8');
      expect(xmlContent).toContain('<LinearLayout');
      expect(xmlContent).toContain('<Button');
    });

    it('verifies desktop-app fixture covers Electron and Tauri', () => {
      const desktopDir = path.join(fixturesRoot, 'desktop-app');

      // Electron
      const titleBar = path.join(desktopDir, 'electron/src/TitleBar.tsx');
      const appWindow = path.join(desktopDir, 'electron/src/AppWindow.tsx');
      expect(fs.existsSync(titleBar), 'TitleBar.tsx must exist').toBe(true);
      expect(fs.existsSync(appWindow), 'AppWindow.tsx must exist').toBe(true);
      const titleBarContent = fs.readFileSync(titleBar, 'utf8');
      expect(titleBarContent).toContain("from 'electron'");

      // Tauri
      const tauriConf = path.join(desktopDir, 'tauri/src-tauri/tauri.conf.json');
      const tauriControls = path.join(desktopDir, 'tauri/src/WindowControls.tsx');
      const tauriSettings = path.join(desktopDir, 'tauri/src/SettingsDialog.tsx');
      expect(fs.existsSync(tauriConf), 'tauri.conf.json must exist').toBe(true);
      expect(fs.existsSync(tauriControls), 'WindowControls.tsx must exist').toBe(true);
      expect(fs.existsSync(tauriSettings), 'SettingsDialog.tsx must exist').toBe(true);
      const tauriContent = fs.readFileSync(tauriControls, 'utf8');
      expect(tauriContent).toContain('@tauri-apps/api');
    });

    it('verifies monorepo-large fixture contains 32 components across subfolders to exceed threshold', () => {
      const monorepoDir = path.join(fixturesRoot, 'monorepo-large');
      const webFiles = fs.readdirSync(path.join(monorepoDir, 'apps/web/src/components'));
      const mobileFiles = fs.readdirSync(path.join(monorepoDir, 'apps/mobile/src/screens'));
      const uiFiles = fs.readdirSync(path.join(monorepoDir, 'packages/ui/src/elements'));

      expect(webFiles.length, 'apps/web components count').toBe(10);
      expect(mobileFiles.length, 'apps/mobile screens count').toBe(10);
      expect(uiFiles.length, 'packages/ui elements count').toBe(12);

      const totalComponents = webFiles.length + mobileFiles.length + uiFiles.length;
      expect(totalComponents, 'Total components must exceed 30').toBe(32);
      expect(totalComponents).toBeGreaterThan(30);
    });

    it('verifies dirty-workspace fixture includes valid components and strictly excluded files', () => {
      const dirtyDir = path.join(fixturesRoot, 'dirty-workspace');

      // Valid components
      expect(fs.existsSync(path.join(dirtyDir, 'src/components/PrimaryButton.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'src/components/MetricCard.tsx'))).toBe(true);

      // Excluded files
      expect(fs.existsSync(path.join(dirtyDir, 'src/components/PrimaryButton.test.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'src/components/MetricCard.spec.ts'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, '__tests__/Integration.test.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'node_modules/fake-pkg/Widget.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'src/store/authStore.ts'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'src/utils/helpers.ts'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'src/services/apiService.ts'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'src/types/index.d.ts'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'src/api/authRoutes.ts'))).toBe(true);
      expect(fs.existsSync(path.join(dirtyDir, 'dist/bundle.js'))).toBe(true);
    });
  });

  describe('Harness Helpers Verification', () => {
    it('verifies cliHarness resolves bin path and handles options', () => {
      const defaultBin = resolveBinPath();
      expect(defaultBin).toContain('visual-ui.js');

      const customBin = resolveBinPath('/custom/path/bin/custom.js');
      expect(customBin).toBe('/custom/path/bin/custom.js');
    });

    it('verifies serverHarness can allocate ephemeral ports', async () => {
      const port1 = await findFreePort();
      const port2 = await findFreePort();
      expect(port1).toBeGreaterThan(1024);
      expect(port2).toBeGreaterThan(1024);
      expect(typeof port1).toBe('number');
      expect(typeof port2).toBe('number');
    });

    it('verifies serverHarness starts server, responds to health probe, and shuts down cleanly', async () => {
      const server = await startServer({
        readyTimeoutMs: 15000,
      });

      try {
        expect(server.port).toBeGreaterThan(1024);
        expect(server.baseUrl).toBe(`http://127.0.0.1:${server.port}`);
        expect(server.process).toBeDefined();

        const client = createApiClient(server.baseUrl);
        const health = await client.getHealth();
        expect(health.ok).toBe(true);
        expect(health.status).toBe(200);
        expect(health.data.status).toBe('ok');
      } finally {
        await stopServer(server);
      }
    }, 20000);

    it('verifies cliHarness extracts JSON despite noisy bracketed log prefixes or trailing lines', () => {
      const noisyOutput = `[INFO] Initializing visual-ui scanner...\n[WARN] Deprecated flag ignored\n{"status":"scanned","count":42}\nScan finished in 12ms`;
      const parsed = extractJsonFromOutput<{ status: string; count: number }>(noisyOutput);
      expect(parsed.status).toBe('scanned');
      expect(parsed.count).toBe(42);

      const noisyArrayOutput = `[2026-11-13] Starting task\n[{"name":"Header"},{"name":"Footer"}]\n[INFO] Complete`;
      const parsedArray = extractJsonFromOutput<Array<{ name: string }>>(noisyArrayOutput);
      expect(parsedArray.length).toBe(2);
      expect(parsedArray[0].name).toBe('Header');
    });

    it('verifies apiHarness client exports all required API methods', () => {
      const client = createApiClient('http://127.0.0.1:3838');
      expect(client).toBeInstanceOf(ApiHarnessClient);
      expect(typeof client.getHealth).toBe('function');
      expect(typeof client.getSpaRoot).toBe('function');
      expect(typeof client.scan).toBe('function');
      expect(typeof client.getComponent).toBe('function');
      expect(typeof client.modifyComponent).toBe('function');
      expect(typeof client.rollbackComponent).toBe('function');
    });

    it('verifies assertionHarness helper methods execute successfully on valid inputs', () => {
      // assertComponentDiscovered
      const mockComponents: any[] = [
        { name: 'Header', filePath: '/app/src/Header.tsx', relativePath: 'src/Header.tsx', platform: 'web' },
        { name: 'ProfileScreen', filePath: '/mobile/ProfileScreen.tsx', relativePath: 'ProfileScreen.tsx', platform: 'mobile' },
      ];
      const found = assertComponentDiscovered(mockComponents, 'Header', 'web');
      expect(found.name).toBe('Header');

      // assertComponentExcluded (relative path checking with zero false collision on workspace /test/ paths)
      assertComponentExcluded(mockComponents, 'store/authStore.ts');
      expect(() => assertComponentExcluded(mockComponents, 'Header')).toThrow();

      // assertHighVolumeDetected (strictly requires suggestedFocus)
      const mockScanResponse: any = {
        totalCount: 35,
        exceedsThreshold: true,
        folderBreakdown: { 'apps/web': 15, 'apps/mobile': 20 },
        suggestedFocus: ['apps/web', 'apps/mobile'],
      };
      assertHighVolumeDetected(mockScanResponse, 30);
      assertFolderBreakdown(mockScanResponse.folderBreakdown, 'apps/web', 10);

      const invalidScanResponse: any = {
        totalCount: 35,
        exceedsThreshold: true,
        folderBreakdown: { 'apps/web': 35 },
      };
      expect(() => assertHighVolumeDetected(invalidScanResponse, 30)).toThrow();

      // assertElementHierarchyValid (requires classes and non-empty codeSnippet)
      const mockElements: any[] = [
        { id: 'el-1', tag: 'button', type: 'button', classes: 'btn', startLine: 10, endLine: 12, codeSnippet: '<button />' },
        { id: 'el-2', tag: 'h1', type: 'header', classes: 'heading', startLine: 2, endLine: 3, codeSnippet: '<h1 />' },
      ];
      assertElementHierarchyValid(mockElements);
      assertElementClassification(mockElements[0], 'button');

      const invalidElementMissingClasses: any[] = [
        { id: 'el-3', tag: 'div', type: 'container', startLine: 1, endLine: 2, codeSnippet: '<div />' },
      ];
      expect(() => assertElementHierarchyValid(invalidElementMissingClasses)).toThrow();

      // assertTailwindAnimationApplied (no false positives on English words like release)
      const animatedSnippet = `<button className="p-2 transition-all duration-300 ease-in-out hover:scale-105">Click</button>`;
      assertTailwindAnimationApplied(animatedSnippet);
      expect(() => assertTailwindAnimationApplied('<button className="static-btn">Click</button>')).toThrow();
      expect(() => assertTailwindAnimationApplied('<div className="release-notes"><p>Please increase updates</p></div>')).toThrow();
    });

    it('verifies assertionHarness backup and rollback validation helpers', () => {
      const tempDir = path.join(fixturesRoot, 'temp-test-dir');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      const targetFile = path.join(tempDir, 'test-target.tsx');
      const backupFile = path.join(tempDir, 'test-target.tsx.bak-123456');

      const originalContent = '<button>Original Button</button>';
      const modifiedContent = '<button className="animate-pulse">Modified Button</button>';

      fs.writeFileSync(targetFile, modifiedContent, 'utf8');
      fs.writeFileSync(backupFile, originalContent, 'utf8');

      // Assert backup created with relation to target file
      assertBackupCreated(backupFile, targetFile, originalContent);

      // Verify unrelated backup throws
      expect(() => assertBackupCreated(backupFile, '/other/unrelated/path.tsx')).toThrow();

      // Simulate rollback
      fs.writeFileSync(targetFile, originalContent, 'utf8');
      assertRollbackRestored(targetFile, originalContent);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });
});

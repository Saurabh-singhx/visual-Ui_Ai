import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { startServer, stopServer, ServerInstance } from '../harness/serverHarness';
import { createApiClient, ApiHarnessClient } from '../harness/apiHarness';
import { assertComponentDiscovered } from '../harness/assertionHarness';
import { workspacePatcherService } from '@server/services/workspacePatcherService';

describe('Tier 1: Scanner and Multi-Platform Discovery (Features 5, 6, 7, 8)', () => {
  let server: ServerInstance;
  let api: ApiHarnessClient;
  const fixturesDir = path.resolve(process.cwd(), 'test/e2e/fixtures');
  const webAppDir = path.join(fixturesDir, 'web-app');
  const mobileAppDir = path.join(fixturesDir, 'mobile-app');
  const desktopAppDir = path.join(fixturesDir, 'desktop-app');

  beforeAll(async () => {
    server = await startServer();
    api = createApiClient(server.baseUrl);
  });

  afterAll(async () => {
    await stopServer(server);
  });

  // =========================================================================
  // Feature 5: Shallow Metadata Scanner
  // =========================================================================
  describe('Feature 5: Shallow Metadata Scanner (scanProjectMetadata)', () => {
    it('F5.1: extracts shallow component metadata via HTTP API without loading full file bodies', async () => {
      const res = await api.scan({ dir: webAppDir });
      expect(res.status).toBe(200);
      const data = res.data;
      expect(data.totalCount).toBeGreaterThan(0);
      expect(Array.isArray(data.components)).toBe(true);
      expect(data.components.length).toBe(data.totalCount);

      const first = data.components[0];
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('filePath');
      expect(first).toHaveProperty('relativePath');
      expect(first).toHaveProperty('platform');
      // Shallow metadata does not contain full source code
      expect((first as any).code).toBeUndefined();
    });

    it('F5.2: accurately reports totalCount matching length of components array', async () => {
      const res = await api.scan({ dir: webAppDir });
      expect(res.status).toBe(200);
      expect(res.data.totalCount).toBe(res.data.components.length);
      expect(res.data.totalCount).toBe(5); // Header.tsx, Card.jsx, UserProfile.vue, Counter.svelte, landing.html
    });

    it('F5.3: populates folderBreakdown mapping component counts per folder', async () => {
      const res = await api.scan({ dir: webAppDir });
      expect(res.status).toBe(200);
      expect(res.data.folderBreakdown).toBeDefined();
      expect(typeof res.data.folderBreakdown).toBe('object');
      const totalInBreakdown = Object.values(res.data.folderBreakdown).reduce((acc, n) => acc + n, 0);
      expect(totalInBreakdown).toBe(res.data.totalCount);
    });

    it('F5.4: returns exceedsThreshold false when component count is below 30', async () => {
      const res = await api.scan({ dir: webAppDir });
      expect(res.status).toBe(200);
      expect(res.data.exceedsThreshold).toBe(false);
    });

    it('F5.5: does not buffer entire large files in memory during metadata scan', async () => {
      // Create temporary 1MB file with leading component export
      const tempLargeDir = path.join(fixturesDir, 'temp-large-scan');
      fs.mkdirSync(tempLargeDir, { recursive: true });
      const tempFile = path.join(tempLargeDir, 'HugeComponent.tsx');
      const padding = '// Padding comments\n'.repeat(50000);
      const code = `export const HugeComponent = () => { return <div>Huge Component</div>; };\n${padding}`;
      fs.writeFileSync(tempFile, code, 'utf8');

      try {
        const scan = await workspacePatcherService.scanProjectMetadata(tempLargeDir);
        expect(scan.totalCount).toBe(1);
        expect(scan.components[0].name).toBe('HugeComponent');
      } finally {
        fs.rmSync(tempLargeDir, { recursive: true, force: true });
      }
    });

    it('F5.6: returns correct relativePath relative to the scanned root directory', async () => {
      const res = await api.scan({ dir: webAppDir });
      expect(res.status).toBe(200);
      for (const comp of res.data.components) {
        expect(comp.relativePath.startsWith('/')).toBe(false);
        expect(path.isAbsolute(comp.relativePath)).toBe(false);
        expect(path.isAbsolute(comp.filePath)).toBe(true);
      }
    });
  });

  // =========================================================================
  // Feature 6: Multi-Platform Discovery: Web
  // =========================================================================
  describe('Feature 6: Multi-Platform Discovery: Web (.tsx, .jsx, .vue, .svelte, .html)', () => {
    it('F6.1: discovers React TypeScript (.tsx) web components', async () => {
      const res = await api.scan({ dir: webAppDir });
      expect(res.status).toBe(200);
      const comp = assertComponentDiscovered(res.data.components, 'Header.tsx', 'web');
      expect(comp.name).toBe('Header');
      expect(comp.filePath.endsWith('Header.tsx')).toBe(true);
    });

    it('F6.2: discovers React JavaScript (.jsx) web components', async () => {
      const res = await api.scan({ dir: webAppDir });
      expect(res.status).toBe(200);
      const comp = assertComponentDiscovered(res.data.components, 'Card.jsx', 'web');
      expect(comp.name).toBe('Card');
      expect(comp.filePath.endsWith('Card.jsx')).toBe(true);
    });

    it('F6.3: discovers Vue Single-File (.vue) components with platform: web', async () => {
      const res = await api.scan({ dir: webAppDir });
      expect(res.status).toBe(200);
      const comp = assertComponentDiscovered(res.data.components, 'UserProfile.vue', 'web');
      expect(comp.name).toBe('UserProfile');
      expect(comp.platform).toBe('web');
    });

    it('F6.4: discovers Svelte (.svelte) components with platform: web', async () => {
      const res = await api.scan({ dir: webAppDir });
      expect(res.status).toBe(200);
      const comp = assertComponentDiscovered(res.data.components, 'Counter.svelte', 'web');
      expect(comp.name).toBe('Counter');
      expect(comp.platform).toBe('web');
    });

    it('F6.5: discovers HTML (.html) templates containing renderable DOM structures', async () => {
      const res = await api.scan({ dir: webAppDir });
      expect(res.status).toBe(200);
      const comp = assertComponentDiscovered(res.data.components, 'landing.html', 'web');
      expect(comp.name).toBe('landing');
      expect(comp.platform).toBe('web');
    });

    it('F6.6: assigns platform: "web" to all discovered web components', async () => {
      const res = await api.scan({ dir: webAppDir });
      expect(res.status).toBe(200);
      expect(res.data.components.length).toBeGreaterThan(0);
      for (const comp of res.data.components) {
        expect(comp.platform).toBe('web');
      }
    });
  });

  // =========================================================================
  // Feature 7: Multi-Platform Discovery: Mobile
  // =========================================================================
  describe('Feature 7: Multi-Platform Discovery: Mobile (React Native, Flutter, Android XML)', () => {
    it('F7.1: discovers React Native .tsx components with View and Text imports', async () => {
      const res = await api.scan({ dir: mobileAppDir });
      expect(res.status).toBe(200);
      const comp = assertComponentDiscovered(res.data.components, 'ProfileScreen.tsx', 'mobile');
      expect(comp.name).toBe('ProfileScreen');
      expect(comp.platform).toBe('mobile');
    });

    it('F7.2: discovers React Native .jsx components with platform: mobile', async () => {
      const res = await api.scan({ dir: mobileAppDir });
      expect(res.status).toBe(200);
      const comp = assertComponentDiscovered(res.data.components, 'NotificationBanner.jsx', 'mobile');
      expect(comp.name).toBe('NotificationBanner');
      expect(comp.platform).toBe('mobile');
    });

    it('F7.3: discovers Flutter Dart StatelessWidget widgets with platform: mobile', async () => {
      const res = await api.scan({ dir: mobileAppDir });
      expect(res.status).toBe(200);
      const comp = assertComponentDiscovered(res.data.components, 'profile_card.dart', 'mobile');
      expect(['ProfileCard', 'profile_card']).toContain(comp.name);
      expect(comp.platform).toBe('mobile');
    });

    it('F7.4: discovers Flutter Dart StatefulWidget widgets with platform: mobile', async () => {
      const res = await api.scan({ dir: mobileAppDir });
      expect(res.status).toBe(200);
      const comp = assertComponentDiscovered(res.data.components, 'action_button.dart', 'mobile');
      expect(['ActionButton', 'action_button']).toContain(comp.name);
      expect(comp.platform).toBe('mobile');
    });

    it('F7.5: discovers Android Layout XML files (LinearLayout, ConstraintLayout)', async () => {
      const res = await api.scan({ dir: mobileAppDir });
      expect(res.status).toBe(200);
      const comp1 = assertComponentDiscovered(res.data.components, 'activity_login.xml', 'mobile');
      expect(comp1.platform).toBe('mobile');
      const comp2 = assertComponentDiscovered(res.data.components, 'card_item.xml', 'mobile');
      expect(comp2.platform).toBe('mobile');
    });
  });

  // =========================================================================
  // Feature 8: Multi-Platform Discovery: Desktop
  // =========================================================================
  describe('Feature 8: Multi-Platform Discovery: Desktop (Electron, Tauri)', () => {
    it('F8.1: discovers Electron window components with platform: desktop', async () => {
      const res = await api.scan({ dir: desktopAppDir });
      expect(res.status).toBe(200);
      const comp = assertComponentDiscovered(res.data.components, 'AppWindow.tsx', 'desktop');
      expect(comp.name).toBe('AppWindow');
      expect(comp.platform).toBe('desktop');
    });

    it('F8.2: discovers Electron title bar components with platform: desktop', async () => {
      const res = await api.scan({ dir: desktopAppDir });
      expect(res.status).toBe(200);
      const comp = assertComponentDiscovered(res.data.components, 'TitleBar.tsx', 'desktop');
      expect(comp.name).toBe('TitleBar');
      expect(comp.platform).toBe('desktop');
    });

    it('F8.3: discovers Tauri window controls components with platform: desktop', async () => {
      const res = await api.scan({ dir: desktopAppDir });
      expect(res.status).toBe(200);
      const comp = assertComponentDiscovered(res.data.components, 'WindowControls.tsx', 'desktop');
      expect(comp.name).toBe('WindowControls');
      expect(comp.platform).toBe('desktop');
    });

    it('F8.4: discovers Tauri settings dialog components with platform: desktop', async () => {
      const res = await api.scan({ dir: desktopAppDir });
      expect(res.status).toBe(200);
      const comp = assertComponentDiscovered(res.data.components, 'SettingsDialog.tsx', 'desktop');
      expect(comp.name).toBe('SettingsDialog');
      expect(comp.platform).toBe('desktop');
    });

    it('F8.5: excludes desktop build configuration files (tauri.conf.json) from component inventory', async () => {
      const res = await api.scan({ dir: desktopAppDir });
      expect(res.status).toBe(200);
      const hasConfig = res.data.components.some((c) => c.name.includes('tauri.conf') || c.filePath.endsWith('.json'));
      expect(hasConfig, 'tauri.conf.json should not be listed as a component').toBe(false);
    });
  });
});

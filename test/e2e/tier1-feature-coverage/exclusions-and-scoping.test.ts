import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { startServer, stopServer, ServerInstance } from '../harness/serverHarness';
import { createApiClient, ApiHarnessClient } from '../harness/apiHarness';
import {
  assertComponentDiscovered,
  assertComponentExcluded,
  assertHighVolumeDetected,
} from '../harness/assertionHarness';

describe('Tier 1: Exclusions and High-Volume Scoping (Features 9, 10, 11)', () => {
  let server: ServerInstance;
  let api: ApiHarnessClient;
  const fixturesDir = path.resolve(process.cwd(), 'test/e2e/fixtures');
  const dirtyDir = path.join(fixturesDir, 'dirty-workspace');
  const monorepoDir = path.join(fixturesDir, 'monorepo-large');

  beforeAll(async () => {
    server = await startServer();
    api = createApiClient(server.baseUrl);
  });

  afterAll(async () => {
    await stopServer(server);
  });

  // =========================================================================
  // Feature 9: Strict Exclusion Filtering
  // =========================================================================
  describe('Feature 9: Strict Exclusion Filtering (Zero False Positives)', () => {
    it('F9.1: discovers valid components in dirty workspace while excluding test files', async () => {
      const res = await api.scan({ dir: dirtyDir });
      expect(res.status).toBe(200);
      assertComponentDiscovered(res.data.components, 'PrimaryButton.tsx', 'web');
      assertComponentDiscovered(res.data.components, 'MetricCard.tsx', 'web');
      expect(res.data.totalCount).toBe(2);
    });

    it('F9.2: strictly excludes *.test.tsx and *.test.ts unit test files', async () => {
      const res = await api.scan({ dir: dirtyDir });
      expect(res.status).toBe(200);
      assertComponentExcluded(res.data.components, 'PrimaryButton.test.tsx');
    });

    it('F9.3: strictly excludes *.spec.ts and *.spec.tsx test specification files', async () => {
      const res = await api.scan({ dir: dirtyDir });
      expect(res.status).toBe(200);
      assertComponentExcluded(res.data.components, 'MetricCard.spec.ts');
    });

    it('F9.4: strictly excludes all files inside __tests__/ directories', async () => {
      const res = await api.scan({ dir: dirtyDir });
      expect(res.status).toBe(200);
      assertComponentExcluded(res.data.components, '__tests__/Integration.test.tsx');
      assertComponentExcluded(res.data.components, 'Integration.test.tsx');
    });

    it('F9.5: strictly excludes node_modules/ directory contents', async () => {
      const res = await api.scan({ dir: dirtyDir });
      expect(res.status).toBe(200);
      assertComponentExcluded(res.data.components, 'node_modules/fake-pkg/Widget.tsx');
      assertComponentExcluded(res.data.components, 'Widget.tsx');
    });

    it('F9.6: strictly excludes dist/ and build/ output directories', async () => {
      const res = await api.scan({ dir: dirtyDir });
      expect(res.status).toBe(200);
      assertComponentExcluded(res.data.components, 'dist/bundle.js');
      assertComponentExcluded(res.data.components, 'bundle.js');
    });

    it('F9.7: strictly excludes state stores (Redux, Zustand, Vuex)', async () => {
      const res = await api.scan({ dir: dirtyDir });
      expect(res.status).toBe(200);
      assertComponentExcluded(res.data.components, 'authStore.ts');
    });

    it('F9.8: strictly excludes backend services, utility helpers, and TypeScript declaration files', async () => {
      const res = await api.scan({ dir: dirtyDir });
      expect(res.status).toBe(200);
      assertComponentExcluded(res.data.components, 'apiService.ts');
      assertComponentExcluded(res.data.components, 'helpers.ts');
      assertComponentExcluded(res.data.components, 'index.d.ts');
      assertComponentExcluded(res.data.components, 'authRoutes.ts');
    });
  });

  // =========================================================================
  // Feature 10: High-Volume Threshold & Scoping (>30 Components)
  // =========================================================================
  describe('Feature 10: High-Volume Threshold & Scoping (>30 components)', () => {
    it('F10.1: marks exceedsThreshold: true when component count exceeds 30', async () => {
      const res = await api.scan({ dir: monorepoDir });
      expect(res.status).toBe(200);
      expect(res.data.totalCount).toBeGreaterThan(30);
      expect(res.data.exceedsThreshold).toBe(true);
    });

    it('F10.2: returns suggestedFocus array listing candidate subdirectories', async () => {
      const res = await api.scan({ dir: monorepoDir });
      expect(res.status).toBe(200);
      assertHighVolumeDetected(res.data);
      expect(res.data.suggestedFocus!.length).toBeGreaterThan(0);
      const suggestions = res.data.suggestedFocus!;
      const hasAppsOrPackages = suggestions.some(
        (s) => s.includes('apps') || s.includes('packages') || s.includes('ui') || s.includes('web') || s.includes('mobile')
      );
      expect(hasAppsOrPackages).toBe(true);
    });

    it('F10.3: generates comprehensive folderBreakdown for monorepo subdirectories', async () => {
      const res = await api.scan({ dir: monorepoDir });
      expect(res.status).toBe(200);
      expect(res.data.folderBreakdown).toBeDefined();
      const keys = Object.keys(res.data.folderBreakdown);
      expect(keys.length).toBeGreaterThan(1);
      const totalBreakdown = Object.values(res.data.folderBreakdown).reduce((sum, n) => sum + n, 0);
      expect(totalBreakdown).toBe(res.data.totalCount);
    });

    it('F10.4: marks exceedsThreshold: false when component count is 30 or fewer', async () => {
      const res = await api.scan({ dir: dirtyDir });
      expect(res.status).toBe(200);
      expect(res.data.totalCount).toBeLessThanOrEqual(30);
      expect(res.data.exceedsThreshold).toBe(false);
    });

    it('F10.5: provides actionable focus recommendations when threshold is crossed', async () => {
      const res = await api.scan({ dir: monorepoDir });
      expect(res.status).toBe(200);
      expect(res.data.exceedsThreshold).toBe(true);
      expect(Array.isArray(res.data.suggestedFocus)).toBe(true);
      for (const focus of res.data.suggestedFocus!) {
        expect(typeof focus).toBe('string');
        expect(focus.length).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // Feature 11: CLI Scope & Filtering Flags
  // =========================================================================
  describe('Feature 11: CLI Scope & Filtering Flags (--dir, --focus, --platform, etc.)', () => {
    it('F11.1: filters discovery results strictly to subfolder when focus is specified', async () => {
      const res = await api.scan({ dir: monorepoDir, focus: 'packages/ui' });
      expect(res.status).toBe(200);
      expect(res.data.totalCount).toBe(12); // Exactly 12 UI elements
      for (const comp of res.data.components) {
        expect(comp.relativePath.replace(/\\/g, '/')).toContain('packages/ui');
      }
      expect(res.data.exceedsThreshold).toBe(false);
    });

    it('F11.2: filters discovery results by platform (platform: web)', async () => {
      const res = await api.scan({ dir: monorepoDir, platform: 'web' });
      expect(res.status).toBe(200);
      expect(res.data.totalCount).toBeGreaterThan(0);
      for (const comp of res.data.components) {
        expect(comp.platform).toBe('web');
      }
    });

    it('F11.3: filters discovery results by platform (platform: mobile)', async () => {
      const res = await api.scan({ dir: monorepoDir, platform: 'mobile' });
      expect(res.status).toBe(200);
      expect(res.data.totalCount).toBe(10); // apps/mobile screens
      for (const comp of res.data.components) {
        expect(comp.platform).toBe('mobile');
      }
    });

    it('F11.4: respects custom include filter patterns', async () => {
      const res = await api.scan({
        dir: monorepoDir,
        include: ['Button', 'Card'],
      });
      expect(res.status).toBe(200);
      expect(res.data.totalCount).toBeGreaterThan(0);
      const names = res.data.components.map((c) => c.name);
      expect(names).toContain('Button');
      expect(names).toContain('Card');
    });

    it('F11.5: respects custom exclude patterns', async () => {
      const baseRes = await api.scan({ dir: monorepoDir, focus: 'packages/ui' });
      const filteredRes = await api.scan({
        dir: monorepoDir,
        focus: 'packages/ui',
        exclude: ['Modal', 'Drawer'],
      });
      expect(filteredRes.status).toBe(200);
      expect(filteredRes.data.totalCount).toBe(baseRes.data.totalCount - 2);
      assertComponentExcluded(filteredRes.data.components, 'Modal');
      assertComponentExcluded(filteredRes.data.components, 'Drawer');
    });

    it('F11.6: reads and respects .visual-ui.json configuration file in target workspace', async () => {
      const tempConfigDir = path.join(fixturesDir, 'temp-config-workspace');
      fs.mkdirSync(path.join(tempConfigDir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(tempConfigDir, 'src/IncludedComp.tsx'),
        'export const IncludedComp = () => <div>Included</div>;',
        'utf8'
      );
      fs.writeFileSync(
        path.join(tempConfigDir, 'src/ConfigIgnored.tsx'),
        'export const ConfigIgnored = () => <div>Ignored</div>;',
        'utf8'
      );
      fs.writeFileSync(
        path.join(tempConfigDir, '.visual-ui.json'),
        JSON.stringify({
          exclude: ['ConfigIgnored'],
        }),
        'utf8'
      );

      try {
        const res = await api.scan({ dir: tempConfigDir });
        expect(res.status).toBe(200);
        expect(res.data.totalCount, 'Expected .visual-ui.json exclude rule to filter ConfigIgnored (pending M1 config file support)').toBe(1);
        expect(res.data.components[0].name).toBe('IncludedComp');
        assertComponentExcluded(res.data.components, 'ConfigIgnored.tsx');
      } finally {
        fs.rmSync(tempConfigDir, { recursive: true, force: true });
      }
    });
  });
});

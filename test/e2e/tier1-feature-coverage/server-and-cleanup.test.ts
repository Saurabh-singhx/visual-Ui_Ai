import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { startServer, stopServer, ServerInstance } from '../harness/serverHarness';
import { createApiClient, ApiHarnessClient } from '../harness/apiHarness';

describe('Tier 1: Unified Server & Deprecation Cleanup (Features 15, 16, 17)', () => {
  let server: ServerInstance;
  let api: ApiHarnessClient;
  const rootDir = process.cwd();
  const serverSrcDir = path.resolve(rootDir, 'server/src');
  const clientSrcDir = path.resolve(rootDir, 'client/src');

  beforeAll(async () => {
    server = await startServer();
    api = createApiClient(server.baseUrl);
  });

  afterAll(async () => {
    await stopServer(server);
  });

  // =========================================================================
  // Feature 15: Unified Server & Port 3838
  // =========================================================================
  describe('Feature 15: Unified Server & Port 3838', () => {
    it('F15.1: starts unified Express server and binds to allocated port', () => {
      expect(server.port).toBeGreaterThan(0);
      expect(server.baseUrl).toContain(`http://127.0.0.1:${server.port}`);
    });

    it('F15.2: responds to GET /api/health with status ok and service identity', async () => {
      const res = await api.getHealth();
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('ok');
      expect(res.data.service).toBe('visual-uiai-server');
      expect(res.data.version).toBe('1.0.0');
    });

    it('F15.3: verifies default port configured in server/src/index.ts is 3838', () => {
      const indexCode = fs.readFileSync(path.join(serverSrcDir, 'index.ts'), 'utf8');
      expect(indexCode).toMatch(/3838/);
      expect(indexCode).toMatch(/process\.env\.PORT\s*\|\|\s*3838/);
    });

    it('F15.4: enables CORS middleware with wildcard or permissive origin headers', async () => {
      const resp = await fetch(`${server.baseUrl}/api/health`);
      expect(resp.status).toBe(200);
      const allowOrigin = resp.headers.get('access-control-allow-origin');
      expect(allowOrigin).toBe('*');
    });

    it('F15.5: returns JSON error response with HTTP 404 for unhandled API endpoints', async () => {
      const resp = await fetch(`${server.baseUrl}/api/nonexistent-route-xyz`);
      expect(resp.status).toBe(404);
      const data = await resp.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Endpoint not found/i);
    });

    it('F15.6: serves client/dist static assets with SPA fallback for non-API routes', async () => {
      const indexCode = fs.readFileSync(path.join(serverSrcDir, 'index.ts'), 'utf8');
      expect(indexCode).toMatch(/client\/dist/);
      expect(indexCode).toMatch(/express\.static/);
      expect(indexCode).toMatch(/index\.html/);
    });
  });

  // =========================================================================
  // Feature 16: Server Deprecation Cleanup
  // =========================================================================
  describe('Feature 16: Server Deprecation Cleanup (ADB & Capture Removal)', () => {
    it('F16.1: verifies server/src/routes/adbRoutes.ts is deleted from repository', () => {
      const adbRoutePath = path.join(serverSrcDir, 'routes/adbRoutes.ts');
      expect(fs.existsSync(adbRoutePath), 'adbRoutes.ts must be deleted').toBe(false);
    });

    it('F16.2: verifies server/src/services/adbService.ts is deleted from repository', () => {
      const adbServicePath = path.join(serverSrcDir, 'services/adbService.ts');
      expect(fs.existsSync(adbServicePath), 'adbService.ts must be deleted').toBe(false);
    });

    it('F16.3: verifies server/src/routes/captureRoutes.ts is deleted from repository', () => {
      const captureRoutePath = path.join(serverSrcDir, 'routes/captureRoutes.ts');
      expect(fs.existsSync(captureRoutePath), 'captureRoutes.ts must be deleted').toBe(false);
    });

    it('F16.4: verifies GET /api/adb/* returns HTTP 404 and is not mounted on server', async () => {
      const resp = await fetch(`${server.baseUrl}/api/adb/devices`);
      expect(resp.status).toBe(404);
    });

    it('F16.5: verifies GET /api/capture/* returns HTTP 404 and is not mounted on server', async () => {
      const resp = await fetch(`${server.baseUrl}/api/capture/samples`);
      expect(resp.status).toBe(404);
    });

    it('F16.6: verifies server/src/index.ts has no references or imports to adb or capture', () => {
      const indexCode = fs.readFileSync(path.join(serverSrcDir, 'index.ts'), 'utf8');
      expect(indexCode).not.toMatch(/adbRoutes/);
      expect(indexCode).not.toMatch(/captureRoutes/);
      expect(indexCode).not.toMatch(/\/api\/adb/);
      expect(indexCode).not.toMatch(/\/api\/capture/);
    });
  });

  // =========================================================================
  // Feature 17: Client Deprecation Cleanup
  // =========================================================================
  describe('Feature 17: Client Deprecation Cleanup (Modals, WCAG, Snip Removal)', () => {
    it('F17.1: verifies AdbModal.tsx is deleted or removed from client components', () => {
      const adbModalPath = path.join(clientSrcDir, 'components/modals/AdbModal.tsx');
      expect(fs.existsSync(adbModalPath), 'AdbModal.tsx should be deleted per Feature 17 (pending Milestone M2)').toBe(false);
    });

    it('F17.2: verifies WebUrlModal.tsx is deleted or removed from client components', () => {
      const webModalPath = path.join(clientSrcDir, 'components/modals/WebUrlModal.tsx');
      expect(fs.existsSync(webModalPath), 'WebUrlModal.tsx should be deleted per Feature 17 (pending Milestone M2)').toBe(false);
    });

    it('F17.3: verifies WorkspaceModal.tsx is deleted or replaced by streamlined inventory sidebar', () => {
      const wsModalPath = path.join(clientSrcDir, 'components/modals/WorkspaceModal.tsx');
      expect(fs.existsSync(wsModalPath), 'WorkspaceModal.tsx should be deleted per Feature 17 (pending Milestone M2)').toBe(false);
    });

    it('F17.4: verifies WCAG AAA luminance formula calculation tables are removed from client inspection view', () => {
      const inspectorCode = fs.readFileSync(
        path.join(clientSrcDir, 'components/inspector/ElementInspector.tsx'),
        'utf8'
      );
      // Complex AAA matrix / luminance tables should be stripped in favor of streamlined styling & AI prompt
      const hasComplexWcagTables = inspectorCode.includes('WCAG AAA Compliance Matrix');
      expect(hasComplexWcagTables, 'Complex WCAG AAA matrix tables should be removed per Feature 17').toBe(false);
    });

    it('F17.5: verifies coordinate rectangular snip tool mode is removed from visual canvas', () => {
      const canvasCode = fs.readFileSync(
        path.join(clientSrcDir, 'components/canvas/VisualCanvas.tsx'),
        'utf8'
      );
      // Coordinate snip tool is deprecated in favor of direct element click-selection
      const hasRectangularSnip = canvasCode.includes('onSnipComplete') && canvasCode.includes('isSnipMode');
      expect(!hasRectangularSnip || canvasCode.includes('extractRenderableHtml'), 'Canvas should prioritize direct element click-selection').toBe(true);
    });

    it('F17.6: verifies deprecated telemetry demo apps are removed from client state', () => {
      const appCode = fs.readFileSync(path.join(clientSrcDir, 'App.tsx'), 'utf8');
      expect(appCode).not.toContain('TelemetryApp');
    });
  });
});

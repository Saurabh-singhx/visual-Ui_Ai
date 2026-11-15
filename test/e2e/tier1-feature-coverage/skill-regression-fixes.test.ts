import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { startServer, stopServer, ServerInstance, findFreePort } from '../harness/serverHarness';
import { createApiClient, ApiHarnessClient } from '../harness/apiHarness';
import { runCli } from '../harness/cliHarness';

describe('Tier 1: Skill Regression Fixes (CLI Hardening, Sandboxing, SSE Sync)', () => {
  let server: ServerInstance;
  let api: ApiHarnessClient;
  const rootDir = process.cwd();
  const testWorkspaceDir = path.resolve(rootDir, 'test/e2e/fixtures/temp-regression-workspace');
  const outsideWorkspaceDir = path.resolve(rootDir, 'test/e2e/fixtures/temp-outside-workspace');

  let validComponentPath: string;
  let modifyTargetFile: string;

  beforeAll(async () => {
    // 1. Create isolated test workspace directories
    fs.mkdirSync(testWorkspaceDir, { recursive: true });
    fs.mkdirSync(path.join(testWorkspaceDir, 'src/components'), { recursive: true });
    fs.mkdirSync(path.join(testWorkspaceDir, 'src/deprecated'), { recursive: true });
    fs.mkdirSync(path.join(testWorkspaceDir, 'test'), { recursive: true });
    fs.mkdirSync(outsideWorkspaceDir, { recursive: true });

    // 2. Populate test workspace with sample components for glob and exclusion tests
    validComponentPath = path.join(testWorkspaceDir, 'src/components/ActiveHeader.tsx');
    fs.writeFileSync(
      validComponentPath,
      `import React from 'react';\n\nexport const ActiveHeader = () => {\n  return (\n    <header className="header-container bg-blue-600 text-white p-4">\n      <h1 className="header-title text-3xl font-extrabold">Active System Status</h1>\n      <p className="header-desc text-sm">System running smoothly</p>\n      <button id="refresh-btn" className="btn-action bg-blue-800 hover:bg-blue-700 px-3 py-1 rounded">Refresh</button>\n    </header>\n  );\n};\n`,
      'utf8'
    );

    // Glob exclusion candidates
    fs.writeFileSync(
      path.join(testWorkspaceDir, 'src/components/ActiveHeader.test.unit.tsx'),
      `export const TestComponent = () => <div>Test</div>;`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(testWorkspaceDir, 'src/deprecated/LegacyWidget.tsx'),
      `export const LegacyWidget = () => <div>Deprecated</div>;`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(testWorkspaceDir, 'test/OldTestHelper.tsx'),
      `export const OldTestHelper = () => <div>Old Helper</div>;`,
      'utf8'
    );

    // Multi-exclude target files
    fs.writeFileSync(
      path.join(testWorkspaceDir, 'src/components/FilterCardAlpha.tsx'),
      `export const FilterCardAlpha = () => <div className="card">Alpha</div>;`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(testWorkspaceDir, 'src/components/FilterCardBeta.tsx'),
      `export const FilterCardBeta = () => <div className="card">Beta</div>;`,
      'utf8'
    );

    // Outside file for directory traversal sandbox tests
    fs.writeFileSync(
      path.join(outsideWorkspaceDir, 'SecretCredentials.tsx'),
      `export const SecretCredentials = () => <div>Confidential</div>;`,
      'utf8'
    );

    // Separate file for modification tests
    modifyTargetFile = path.join(testWorkspaceDir, 'src/components/ModifyTarget.tsx');
    fs.writeFileSync(
      modifyTargetFile,
      `import React from 'react';\n\nexport const ModifyTarget = () => {\n  return (\n    <div className="card-box p-4 bg-white shadow rounded">\n      <h1 className="title-text text-2xl font-bold text-gray-800">Original Heading</h1>\n      <p className="desc-text text-gray-600">Some descriptive copy here</p>\n      <button id="submit-btn" className="btn-primary bg-indigo-600 text-white px-4 py-2 rounded">Submit Action</button>\n    </div>\n  );\n};\n`,
      'utf8'
    );

    // 3. Start server with WORKSPACE_DIR pointing to our test workspace
    server = await startServer({
      workspaceDir: testWorkspaceDir,
    });
    api = createApiClient(server.baseUrl);
  });

  afterAll(async () => {
    if (server) {
      await stopServer(server);
    }
    // Clean up temporary workspace directories
    fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    fs.rmSync(outsideWorkspaceDir, { recursive: true, force: true });
  });

  // =========================================================================
  // 1. CLI Naked Flag Crash Prevention & Flag Parsing
  // =========================================================================
  describe('CLI naked flag crash prevention and flag parsing', () => {
    it('handles naked --dir flag without throwing unhandled TypeError crash', async () => {
      const res = await runCli(['scan', '--dir']);
      // Must not crash with unhandled TypeError: paths[0] must be of type string
      expect(res.combinedOutput).not.toMatch(/TypeError:\s*paths\[0\]\s*must be/i);
      expect(res.combinedOutput).not.toMatch(/TypeError:\s*The "path" argument must be/i);
    });

    it('handles naked --file flag in modify command without unhandled TypeError', async () => {
      const res = await runCli(['modify', '--file']);
      expect(res.combinedOutput).not.toMatch(/TypeError:\s*paths\[0\]\s*must be/i);
      expect(res.combinedOutput).not.toMatch(/TypeError:\s*The "path" argument must be/i);
    });

    it('supports --key=value flag syntax for directory specification', async () => {
      const res = await runCli([`--dir=${testWorkspaceDir}`, 'scan']);
      expect(res.combinedOutput).not.toMatch(/TypeError/i);
      expect(res.combinedOutput).toMatch(/ActiveHeader/i);
    });
  });

  // =========================================================================
  // 2. Multiple --exclude Flag Preservation
  // =========================================================================
  describe('Multiple --exclude flag preservation', () => {
    it('preserves multiple --exclude flags in CLI scanning rather than overwriting', async () => {
      const res = await runCli([
        'scan',
        '--dir',
        testWorkspaceDir,
        '--exclude',
        'FilterCardAlpha.tsx',
        '--exclude',
        'FilterCardBeta.tsx',
      ]);

      expect(res.combinedOutput).not.toMatch(/TypeError/i);
      expect(res.combinedOutput).not.toMatch(/FilterCardAlpha/i);
      expect(res.combinedOutput).not.toMatch(/FilterCardBeta/i);
      expect(res.combinedOutput).toMatch(/ActiveHeader/i);
    });

    it('preserves multiple exclusion rules via API scan endpoint', async () => {
      const res = await api.scan({
        dir: testWorkspaceDir,
        exclude: ['FilterCardAlpha.tsx', 'FilterCardBeta.tsx'],
      });

      expect(res.status).toBe(200);
      const names = res.data.components.map((c) => c.name);
      expect(names).not.toContain('FilterCardAlpha');
      expect(names).not.toContain('FilterCardBeta');
      expect(names).toContain('ActiveHeader');
    });
  });

  // =========================================================================
  // 3. Glob Exclusion Filtering (**/*.test.*, **/deprecated/**, test/ singular)
  // =========================================================================
  describe('Glob exclusion filtering (**/*.test.*, **/deprecated/**, test/ singular)', () => {
    it('strictly excludes glob patterns matching **/*.test.*', async () => {
      const res = await api.scan({ dir: testWorkspaceDir });
      expect(res.status).toBe(200);
      const paths = res.data.components.map((c) => c.relativePath || c.filePath);
      const matched = paths.some((p) => p.includes('.test.'));
      expect(matched, 'Files matching **/*.test.* should be strictly excluded').toBe(false);
    });

    it('strictly excludes components residing under **/deprecated/**', async () => {
      const res = await api.scan({ dir: testWorkspaceDir });
      expect(res.status).toBe(200);
      const paths = res.data.components.map((c) => c.relativePath || c.filePath);
      const matched = paths.some((p) => p.includes('deprecated'));
      expect(matched, 'Files under **/deprecated/** should be strictly excluded').toBe(false);
    });

    it('strictly excludes components in test/ (singular) directory', async () => {
      const res = await api.scan({ dir: testWorkspaceDir });
      expect(res.status).toBe(200);
      const paths = res.data.components.map((c) => c.relativePath || c.filePath);
      const matched = paths.some((p) => /(?:^|\/)test\//i.test(p));
      expect(matched, 'Files under test/ singular directory should be excluded').toBe(false);
    });

    it('discovers legitimate active components while excluding all ignored patterns', async () => {
      const res = await api.scan({ dir: testWorkspaceDir });
      expect(res.status).toBe(200);
      const names = res.data.components.map((c) => c.name);
      expect(names).toContain('ActiveHeader');
    });
  });

  // =========================================================================
  // 4. Directory Traversal Path Sandboxing (403 on path outside workspace)
  // =========================================================================
  describe('Directory traversal path sandboxing (403 on path outside workspace)', () => {
    it('returns 403 Forbidden when /api/component/get attempts relative traversal outside workspace', async () => {
      const outsideRelative = path.relative(testWorkspaceDir, path.join(outsideWorkspaceDir, 'SecretCredentials.tsx'));
      const res = await api.getComponent({
        filePath: outsideRelative,
      });

      expect(res.status).toBe(403);
    });

    it('returns 403 Forbidden when /api/component/get attempts absolute path outside workspace', async () => {
      const outsideAbsolute = path.join(outsideWorkspaceDir, 'SecretCredentials.tsx');
      const res = await api.getComponent({
        filePath: outsideAbsolute,
      });

      expect(res.status).toBe(403);
    });

    it('returns 403 Forbidden when /api/component/modify attempts modification outside workspace', async () => {
      const outsideAbsolute = path.join(outsideWorkspaceDir, 'SecretCredentials.tsx');
      const res = await api.modifyComponent({
        filePath: outsideAbsolute,
        prompt: 'Change title to Malicious Edit',
      });

      expect(res.status).toBe(403);
    });

    it('allows valid /api/component/get within workspace boundaries', async () => {
      const res = await api.getComponent({
        filePath: validComponentPath,
      });

      expect(res.status).toBe(200);
      expect(res.data.code).toContain('ActiveHeader');
    });
  });

  // =========================================================================
  // 5. CLI Modify and Element Targeting
  // =========================================================================
  describe('CLI modify and element targeting', () => {
    it('preserves <h1> heading tag without destroying or rewriting to <h3>', async () => {
      const res = await runCli([
        'modify',
        '--file',
        modifyTargetFile,
        '--prompt',
        'change title to "Supercharged Title"',
      ]);

      expect(res.combinedOutput).not.toMatch(/TypeError/i);

      const modifiedContent = fs.readFileSync(modifyTargetFile, 'utf8');
      // The original <h1 ...> tag must NOT be replaced with <h3 ...>
      expect(modifiedContent).toMatch(/<h1[^>]*>Supercharged Title<\/h1>/i);
      expect(modifiedContent).not.toMatch(/<h3[^>]*>Supercharged Title<\/h3>/i);
    });

    it('targets specific element without indiscriminately modifying only the first className', async () => {
      const res = await runCli([
        'modify',
        '--file',
        modifyTargetFile,
        '--prompt',
        'update button to "Confirm Action"',
      ]);

      expect(res.combinedOutput).not.toMatch(/TypeError/i);

      const modifiedContent = fs.readFileSync(modifyTargetFile, 'utf8');
      expect(modifiedContent).toMatch(/Confirm Action/i);
      // Container card-box class should still remain intact
      expect(modifiedContent).toContain('card-box');
    });
  });

  // =========================================================================
  // 6. Canvas SSE Live Sync Endpoint (/api/canvas/events)
  // =========================================================================
  describe('Canvas SSE live sync endpoint (/api/canvas/events)', () => {
    it('establishes Server-Sent Events stream with text/event-stream headers', async () => {
      const sseUrl = `${server.baseUrl}/api/canvas/events`;
      
      const res = await new Promise<{ status: number; contentType: string }>((resolve, reject) => {
        const req = http.get(sseUrl, (response) => {
          const contentType = response.headers['content-type'] || '';
          resolve({
            status: response.statusCode || 0,
            contentType,
          });
          req.destroy();
        });
        req.on('error', reject);
        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error('SSE connection timed out'));
        });
      });

      expect(res.status).toBe(200);
      expect(res.contentType).toContain('text/event-stream');
    });

    it('broadcasts canvas update event to SSE subscribers when /api/canvas/render is triggered', async () => {
      const sseUrl = `${server.baseUrl}/api/canvas/events`;
      let sseReceivedData = '';

      // Set up SSE listener
      const eventReceivedPromise = new Promise<string>((resolve, reject) => {
        const req = http.get(sseUrl, (response) => {
          response.on('data', (chunk) => {
            const str = chunk.toString('utf8');
            sseReceivedData += str;
            if (str.includes('LiveSyncComponent') || str.includes('canvas-update') || str.includes('data:')) {
              req.destroy();
              resolve(sseReceivedData);
            }
          });
        });
        req.on('error', (err) => {
          // ignore error if destroyed after data received
          if (!sseReceivedData) reject(err);
        });
        setTimeout(() => {
          req.destroy();
          if (sseReceivedData) resolve(sseReceivedData);
          else reject(new Error('Timed out waiting for SSE canvas update event'));
        }, 6000);
      });

      // Allow subscriber to connect
      await new Promise((r) => setTimeout(r, 400));

      // Trigger canvas render
      const renderRes = await fetch(`${server.baseUrl}/api/canvas/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentName: 'LiveSyncComponent',
          code: `export const LiveSyncComponent = () => <div>Live SSE Sync</div>;`,
        }),
      });

      expect(renderRes.status).toBe(200);

      const sseOutput = await eventReceivedPromise;
      expect(sseOutput).toBeTruthy();
    });
  });
});

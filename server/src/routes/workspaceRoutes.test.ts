import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../index';

describe('Server Unification & Core Infrastructure', () => {
  it('serves health check on /api/health with status ok and port 3838', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('visual-uiai-server');
    expect(res.body.port).toBe(3838);
  });

  it('returns 404 for removed ADB endpoints', async () => {
    const res = await request(app).get('/api/adb/devices');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for removed capture sample endpoints', async () => {
    const res = await request(app).get('/api/capture/samples');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('workspaceRoutes HTTP Endpoints', () => {
  const tempDir = path.join(__dirname, '../../test-temp-routes');
  const buttonPath = path.join(tempDir, 'TestButton.tsx');

  beforeEach(async () => {
    await fs.promises.mkdir(tempDir, { recursive: true });
    const content = `import React from 'react';
export const TestButton = () => {
  return (
    <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded">
      Click Me
    </button>
  );
};`;
    await fs.promises.writeFile(buttonPath, content, 'utf-8');
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  // 1. POST /api/project/scan
  describe('POST /api/project/scan', () => {
    it('returns 200 with scanned components metadata', async () => {
      const res = await request(app)
        .post('/api/project/scan')
        .send({ dir: tempDir });

      expect(res.status).toBe(200);
      expect(res.body.components).toBeDefined();
      expect(res.body.totalCount).toBe(1);
      expect(res.body.components[0].name).toBe('TestButton');
      expect(res.body.components[0].platform).toBe('web');
      expect(res.body.exceedsThreshold).toBe(false);
    });

    it('returns 400 when dir does not exist', async () => {
      const res = await request(app)
        .post('/api/project/scan')
        .send({ dir: '/invalid/nonexistent/directory' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('does not exist');
    });
  });

  // 2. POST /api/component/get
  describe('POST /api/component/get', () => {
    it('returns 200 with component code and element hierarchy', async () => {
      const res = await request(app)
        .post('/api/component/get')
        .send({ filePath: buttonPath });

      expect(res.status).toBe(200);
      expect(res.body.filePath).toBe(buttonPath);
      expect(res.body.code).toContain('TestButton');
      expect(res.body.elements.length).toBeGreaterThan(0);
      expect(res.body.elements[0].tag).toBe('button');
    });

    it('returns 400 when filePath is missing', async () => {
      const res = await request(app)
        .post('/api/component/get')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('filePath is required');
    });

    it('returns 404 when filePath does not exist', async () => {
      const res = await request(app)
        .post('/api/component/get')
        .send({ filePath: '/nonexistent/file.tsx' });

      expect(res.status).toBe(404);
    });
  });

  // 3. POST /api/component/modify
  describe('POST /api/component/modify', () => {
    it('applies modification, creates backup, and returns modified code', async () => {
      const res = await request(app)
        .post('/api/component/modify')
        .send({
          filePath: buttonPath,
          prompt: 'Add smooth hover scale transition and make emerald rounded pill',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.modifiedCode).toContain('hover:scale-105');
      expect(res.body.backupPath).toBeDefined();
      expect(fs.existsSync(res.body.backupPath)).toBe(true);
    });

    it('returns 400 when filePath or prompt is missing', async () => {
      const res = await request(app)
        .post('/api/component/modify')
        .send({ filePath: buttonPath });

      expect(res.status).toBe(400);
    });

    it('returns 404 when target file does not exist', async () => {
      const res = await request(app)
        .post('/api/component/modify')
        .send({ filePath: '/nonexistent/file.tsx', prompt: 'Make it red' });

      expect(res.status).toBe(404);
    });

    it('modifies element by elementId and emits exactly one className attribute with no TS17001 duplicates', async () => {
      const res = await request(app)
        .post('/api/component/modify')
        .send({
          filePath: buttonPath,
          prompt: 'Add hover scale',
          elementId: 'button-4',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const classCount = (res.body.modifiedCode.match(/className=/g) || []).length;
      expect(classCount).toBe(1);
      expect(res.body.modifiedCode).toContain('hover:scale-105');
      expect(res.body.modifiedCode).toContain('bg-blue-600');
    });
  });

  // 4. POST /api/component/rollback
  describe('POST /api/component/rollback', () => {
    it('restores previous code from backup', async () => {
      // Modify first
      const modRes = await request(app)
        .post('/api/component/modify')
        .send({
          filePath: buttonPath,
          prompt: 'Make it red',
        });
      expect(modRes.status).toBe(200);

      // Rollback
      const rollRes = await request(app)
        .post('/api/component/rollback')
        .send({ filePath: buttonPath });

      expect(rollRes.status).toBe(200);
      expect(rollRes.body.success).toBe(true);
      expect(rollRes.body.currentCode).toContain('Click Me');
      expect(rollRes.body.currentCode).toContain('bg-blue-600');
    });

    it('sequentially rolls back through multiple revisions via repeated requests', async () => {
      // Revision 1
      await request(app)
        .post('/api/component/modify')
        .send({ filePath: buttonPath, prompt: 'Make it red' });

      // Revision 2
      await request(app)
        .post('/api/component/modify')
        .send({ filePath: buttonPath, prompt: 'Make it green' });

      // Rollback 1 -> restores revision 1 (red)
      const roll1 = await request(app)
        .post('/api/component/rollback')
        .send({ filePath: buttonPath });
      expect(roll1.status).toBe(200);
      expect(roll1.body.currentCode).toContain('rose-600');

      // Rollback 2 -> restores revision 0 (initial blue)
      const roll2 = await request(app)
        .post('/api/component/rollback')
        .send({ filePath: buttonPath });
      expect(roll2.status).toBe(200);
      expect(roll2.body.currentCode).toContain('bg-blue-600');

      // Rollback 3 -> no more backups
      const roll3 = await request(app)
        .post('/api/component/rollback')
        .send({ filePath: buttonPath });
      expect(roll3.status).toBe(400);
      expect(roll3.body.error).toContain('No backup files found');
    });

    it('returns 400 when filePath is missing', async () => {
      const res = await request(app)
        .post('/api/component/rollback')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // 5. Backward Compatibility Routes
  describe('Legacy Endpoints Backward Compatibility', () => {
    it('GET /api/workspace/info returns platform info', async () => {
      const res = await request(app).get('/api/workspace/info');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sampleWorkspacePath).toBeDefined();
    });

    it('POST /api/workspace/scan returns legacy files list', async () => {
      const res = await request(app)
        .post('/api/workspace/scan')
        .send({ dirPath: tempDir });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.files)).toBe(true);
    });

    it('POST /api/workspace/read reads raw file', async () => {
      const res = await request(app)
        .post('/api/workspace/read')
        .send({ filePath: buttonPath });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toContain('TestButton');
    });

    it('POST /api/workspace/apply-patch patches file cleanly', async () => {
      const res = await request(app)
        .post('/api/workspace/apply-patch')
        .send({
          filePath: buttonPath,
          oldCode: 'Click Me',
          newCode: 'Click Now',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const content = await fs.promises.readFile(buttonPath, 'utf-8');
      expect(content).toContain('Click Now');
    });

    it('POST /api/workspace/rollback restores file', async () => {
      // Apply a patch first to generate a backup
      await request(app)
        .post('/api/workspace/apply-patch')
        .send({
          filePath: buttonPath,
          oldCode: 'Click Me',
          newCode: 'Click Now',
        });

      const res = await request(app)
        .post('/api/workspace/rollback')
        .send({ filePath: buttonPath });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // 6. Canvas State Endpoints (R2)
  describe('Canvas State Endpoints', () => {
    it('POST /api/canvas/render accepts code and synthesizes props and state', async () => {
      const code = `
        interface CardProps {
          title: string;
          count?: number;
        }
        export const FeatureCard = ({ title = 'Default', count = 5 }: CardProps) => (
          <div className="card"><h3>{title}</h3><span>{count}</span></div>
        );
      `;

      const res = await request(app)
        .post('/api/canvas/render')
        .send({
          componentName: 'FeatureCard',
          code,
          props: { count: 99 },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.activeComponent).toBeDefined();
      expect(res.body.activeComponent.name).toBe('FeatureCard');
      expect(res.body.activeComponent.props.count).toBe(99);
      expect(res.body.synthesizedProps.count).toBe(99);
    });

    it('GET /api/canvas/state returns current active canvas state', async () => {
      const res = await request(app).get('/api/canvas/state');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.activeComponent).toBeDefined();
      expect(res.body.timestamp).toBeTypeOf('number');
    });

    it('POST /api/canvas/render renders component from filePath', async () => {
      const res = await request(app)
        .post('/api/canvas/render')
        .send({ filePath: buttonPath });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.activeComponent.name).toBe('TestButton');
      expect(res.body.activeComponent.code).toContain('TestButton');
    });
  });
});

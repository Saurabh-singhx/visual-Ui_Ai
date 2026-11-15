import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../../index';

describe('workspaceRoutes - Detection and Skill Signaling (/api/info & /api/workspace/info)', () => {
  const originalEnv = { ...process.env };
  const tempDir = path.join(__dirname, '../../../../test-temp-routes-detection');

  beforeEach(async () => {
    if (fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
    await fs.promises.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    if (fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('returns detectedPlatform and detectedFramework from workspace', async () => {
    await fs.promises.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-mobile-app',
        dependencies: { 'react-native': '0.72.0' },
      }),
      'utf-8'
    );

    process.env.WORKSPACE_DIR = tempDir;

    const res = await request(app).get('/api/info');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.detectedPlatform).toBe('mobile');
    expect(res.body.detectedFramework).toBe('react-native');
    expect(res.body.workspaceDir).toBe(tempDir);
  });

  it('signals skillMode, targetDevice, and targetPlatform when configured', async () => {
    process.env.SKILL_MODE = 'true';
    process.env.TARGET_DEVICE = 'mobile';
    process.env.TARGET_PLATFORM = 'mobile';

    const res = await request(app).get('/api/workspace/info');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.skillMode).toBe(true);
    expect(res.body.targetDevice).toBe('mobile');
    expect(res.body.targetPlatform).toBe('mobile');
  });

  it('recognizes VISUAL_UI_SKILL as skillMode fallback', async () => {
    delete process.env.SKILL_MODE;
    process.env.VISUAL_UI_SKILL = 'true';

    const res = await request(app).get('/api/info');
    expect(res.status).toBe(200);
    expect(res.body.skillMode).toBe(true);
  });

  it('returns skillMode: false when skill env flags are not set', async () => {
    delete process.env.SKILL_MODE;
    delete process.env.VISUAL_UI_SKILL;
    delete process.env.TARGET_DEVICE;
    delete process.env.TARGET_PLATFORM;

    const res = await request(app).get('/api/info');
    expect(res.status).toBe(200);
    expect(res.body.skillMode).toBe(false);
    expect(res.body.targetDevice).toBeUndefined();
    expect(res.body.targetPlatform).toBeUndefined();
  });
});

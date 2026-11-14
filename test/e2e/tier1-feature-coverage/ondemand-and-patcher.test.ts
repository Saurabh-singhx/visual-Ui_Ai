import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { startServer, stopServer, ServerInstance } from '../harness/serverHarness';
import { createApiClient, ApiHarnessClient } from '../harness/apiHarness';
import {
  assertElementHierarchyValid,
  assertBackupCreated,
  assertRollbackRestored,
  assertTailwindAnimationApplied,
} from '../harness/assertionHarness';

describe('Tier 1: On-Demand Loading, AI Patcher & Animations (Features 12, 13, 14)', () => {
  let server: ServerInstance;
  let api: ApiHarnessClient;
  const tempWorkspace = path.resolve(process.cwd(), 'test/e2e/fixtures/temp-patcher-workspace');
  let testComponentPath: string;

  const sampleSourceCode = `import React from 'react';

export const FeatureCard = ({ title = 'Analytics', count = 42 }) => {
  return (
    <div className="card-container p-6 bg-white rounded-lg shadow">
      <h3 className="card-header text-xl font-bold text-gray-900">{title}</h3>
      <p className="card-description text-gray-600 mt-2">Current active count: {count}</p>
      <input type="text" className="search-input mt-4 border rounded p-2" placeholder="Filter..." />
      <button className="action-button mt-4 px-4 py-2 bg-blue-600 text-white rounded">
        Submit Report
      </button>
    </div>
  );
};
`;

  beforeAll(async () => {
    server = await startServer();
    api = createApiClient(server.baseUrl);
  });

  afterAll(async () => {
    await stopServer(server);
  });

  beforeEach(() => {
    fs.mkdirSync(tempWorkspace, { recursive: true });
    testComponentPath = path.join(tempWorkspace, 'FeatureCard.tsx');
    fs.writeFileSync(testComponentPath, sampleSourceCode, 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  });

  // =========================================================================
  // Feature 12: On-Demand Component Loading
  // =========================================================================
  describe('Feature 12: On-Demand Component Loading (getComponentDetails)', () => {
    it('F12.1: loads full component source code on-demand when clicked', async () => {
      const res = await api.getComponent({ filePath: testComponentPath });
      expect(res.status).toBe(200);
      expect(res.data.filePath).toBe(testComponentPath);
      expect(res.data.code).toBe(sampleSourceCode);
      expect(Array.isArray(res.data.elements)).toBe(true);
      expect(res.data.elements.length).toBeGreaterThan(0);
    });

    it('F12.2: extracts element hierarchy with startLine, endLine, and codeSnippet', async () => {
      const res = await api.getComponent({ filePath: testComponentPath });
      expect(res.status).toBe(200);
      assertElementHierarchyValid(res.data.elements);
      for (const el of res.data.elements) {
        expect(el.startLine).toBeGreaterThan(0);
        expect(el.endLine).toBeGreaterThanOrEqual(el.startLine);
        expect(el.codeSnippet).toBeDefined();
        expect(el.codeSnippet.length).toBeGreaterThan(0);
      }
    });

    it('F12.3: extracts and classifies button elements with type "button"', async () => {
      const res = await api.getComponent({ filePath: testComponentPath });
      expect(res.status).toBe(200);
      const buttonElem = res.data.elements.find((el) => el.type === 'button' || el.tag === 'button');
      expect(buttonElem).toBeDefined();
      expect(buttonElem!.tag).toBe('button');
      expect(buttonElem!.classes).toContain('action-button');
    });

    it('F12.4: extracts and classifies header elements with type "header"', async () => {
      const res = await api.getComponent({ filePath: testComponentPath });
      expect(res.status).toBe(200);
      const headerElem = res.data.elements.find((el) => el.type === 'header' || el.tag === 'h3');
      expect(headerElem).toBeDefined();
      expect(headerElem!.tag).toBe('h3');
      expect(headerElem!.classes).toContain('card-header');
    });

    it('F12.5: extracts and classifies input elements with type "input"', async () => {
      const res = await api.getComponent({ filePath: testComponentPath });
      expect(res.status).toBe(200);
      const inputElem = res.data.elements.find((el) => el.type === 'input' || el.tag === 'input');
      expect(inputElem).toBeDefined();
      expect(inputElem!.tag).toBe('input');
      expect(inputElem!.classes).toContain('search-input');
    });

    it('F12.6: extracts container or card wrapper elements with type "container" or "card"', async () => {
      const res = await api.getComponent({ filePath: testComponentPath });
      expect(res.status).toBe(200);
      const containerElem = res.data.elements.find(
        (el) => el.type === 'container' || el.type === 'card' || el.tag === 'div'
      );
      expect(containerElem).toBeDefined();
      expect(containerElem!.classes).toContain('card-container');
    });

    it('F12.7: handles non-existent file path returning clean 404 error without crash', async () => {
      const missingPath = path.join(tempWorkspace, 'NonExistent.tsx');
      const res = await api.getComponent({ filePath: missingPath });
      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // Feature 13: In-Session AI Modification Engine
  // =========================================================================
  describe('Feature 13: In-Session AI Modification Engine & Atomic Rollback', () => {
    it('F13.1: applies prompt modification and modifies target file on disk', async () => {
      const res = await api.modifyComponent({
        filePath: testComponentPath,
        prompt: 'Change button background to bg-emerald-600',
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      const onDiskCode = fs.readFileSync(testComponentPath, 'utf8');
      expect(onDiskCode).toContain('bg-emerald-600');
    });

    it('F13.2: creates timestamped .bak-TIMESTAMP backup before writing patch', async () => {
      const res = await api.modifyComponent({
        filePath: testComponentPath,
        prompt: 'Make header bold and red text-red-600',
      });
      expect(res.status).toBe(200);
      expect(res.data.backupPath).toBeDefined();
      assertBackupCreated(res.data.backupPath, testComponentPath, sampleSourceCode);
    });

    it('F13.3: returns appliedChanges list describing the modification', async () => {
      const res = await api.modifyComponent({
        filePath: testComponentPath,
        prompt: 'Add rounded-full to button',
      });
      expect(res.status).toBe(200);
      expect(res.data.appliedChanges).toBeDefined();
      expect(Array.isArray(res.data.appliedChanges)).toBe(true);
      expect(res.data.appliedChanges.length).toBeGreaterThan(0);
    });

    it('F13.4: rolls back modified file to original content from backup', async () => {
      const modRes = await api.modifyComponent({
        filePath: testComponentPath,
        prompt: 'Change button background to bg-purple-600',
      });
      expect(modRes.status).toBe(200);
      expect(fs.readFileSync(testComponentPath, 'utf8')).toContain('bg-purple-600');

      const rollRes = await api.rollbackComponent({
        filePath: testComponentPath,
        backupPath: modRes.data.backupPath,
      });
      expect(rollRes.status).toBe(200);
      expect(rollRes.data.success).toBe(true);
      assertRollbackRestored(testComponentPath, sampleSourceCode);
    });

    it('F13.5: automatically rolls back to latest backup when backupPath is omitted', async () => {
      await api.modifyComponent({
        filePath: testComponentPath,
        prompt: 'Change button background to bg-indigo-600',
      });
      expect(fs.readFileSync(testComponentPath, 'utf8')).toContain('bg-indigo-600');

      const rollRes = await api.rollbackComponent({
        filePath: testComponentPath,
      });
      expect(rollRes.status).toBe(200);
      expect(rollRes.data.success).toBe(true);
      assertRollbackRestored(testComponentPath, sampleSourceCode);
    });

    it('F13.6: supports sequential modifications with distinct backups', async () => {
      const mod1 = await api.modifyComponent({
        filePath: testComponentPath,
        prompt: 'Add border-2 to button',
      });
      const mod2 = await api.modifyComponent({
        filePath: testComponentPath,
        prompt: 'Add text-xl to button',
      });
      expect(mod1.status).toBe(200);
      expect(mod2.status).toBe(200);
      expect(mod1.data.backupPath).not.toBe(mod2.data.backupPath);
      expect(fs.existsSync(mod1.data.backupPath)).toBe(true);
      expect(fs.existsSync(mod2.data.backupPath)).toBe(true);
    });
  });

  // =========================================================================
  // Feature 14: Animated Modifications Engine
  // =========================================================================
  describe('Feature 14: Animated Modifications Engine (Tailwind & Keyframes)', () => {
    it('F14.1: applies hover scale animation with Tailwind transition utilities', async () => {
      const res = await api.modifyComponent({
        filePath: testComponentPath,
        prompt: 'Add smooth hover scale transition to button',
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      assertTailwindAnimationApplied(res.data.modifiedCode, ['transition', 'hover:scale-105']);
    });

    it('F14.2: applies hover lift and shadow transition animation', async () => {
      const res = await api.modifyComponent({
        filePath: testComponentPath,
        prompt: 'Add hover lift and shadow effect to card',
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.modifiedCode).toMatch(/hover:-translate-y|hover:shadow/);
    });

    it('F14.3: applies pulse animation class animate-pulse', async () => {
      const res = await api.modifyComponent({
        filePath: testComponentPath,
        prompt: 'Add pulse animation to badge or indicator',
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      assertTailwindAnimationApplied(res.data.modifiedCode, ['animate-pulse']);
    });

    it('F14.4: applies bounce animation class animate-bounce', async () => {
      const res = await api.modifyComponent({
        filePath: testComponentPath,
        prompt: 'Add bounce animation to action button',
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      assertTailwindAnimationApplied(res.data.modifiedCode, ['animate-bounce']);
    });

    it('F14.5: applies spin animation class animate-spin', async () => {
      const res = await api.modifyComponent({
        filePath: testComponentPath,
        prompt: 'Add spin animation to loading element',
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      assertTailwindAnimationApplied(res.data.modifiedCode, ['animate-spin']);
    });

    it('F14.6: applies CSS keyframe animation or style tag when custom keyframes requested', async () => {
      const res = await api.modifyComponent({
        filePath: testComponentPath,
        prompt: 'Add custom glow keyframe animation to container',
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.modifiedCode.length).toBeGreaterThan(0);
      expect(res.data.modifiedCode).toMatch(/animate-|transition|keyframes|glow/i);
    });

    it('F14.7: targets specific element when elementId is supplied in modify request', async () => {
      const details = await api.getComponent({ filePath: testComponentPath });
      expect(details.status).toBe(200);
      const buttonEl = details.data.elements.find((el) => el.tag === 'button');
      expect(buttonEl).toBeDefined();

      const res = await api.modifyComponent({
        filePath: testComponentPath,
        elementId: buttonEl!.id,
        prompt: 'Add hover scale transition to button',
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.modifiedCode).toMatch(/hover:scale-|transition/);
    });
  });
});

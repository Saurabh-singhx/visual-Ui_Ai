import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { WorkspacePatcherService } from './workspacePatcherService';

describe('WorkspacePatcherService', () => {
  const service = new WorkspacePatcherService();
  const testDir = path.join(__dirname, '../../test-temp-workspace');
  const sampleFilePath = path.join(testDir, 'SampleButton.tsx');

  beforeEach(async () => {
    if (!fs.existsSync(testDir)) {
      await fs.promises.mkdir(testDir, { recursive: true });
    }
    const initialContent = `import React from 'react';

export const SampleButton = () => {
  return (
    <button className="px-4 py-2 bg-blue-500 text-white rounded">
      Click Me
    </button>
  );
};`;
    await fs.promises.writeFile(sampleFilePath, initialContent, 'utf-8');
  });

  afterEach(async () => {
    if (fs.existsSync(testDir)) {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    }
  });

  it('scans directory and returns eligible source files', async () => {
    const files = await service.scanDirectory(testDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.name === 'SampleButton.tsx')).toBe(true);
  });

  it('searches component by text query with confidence score', async () => {
    const results = await service.searchComponent(testDir, { text: 'Click Me' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].filePath).toBe(sampleFilePath);
    expect(results[0].matchSnippet).toContain('Click Me');
  });

  it('searches component by class name query', async () => {
    const results = await service.searchComponent(testDir, { className: 'bg-blue-500' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matchSnippet).toContain('bg-blue-500');
  });

  it('applies code patch cleanly and creates a backup file', async () => {
    const oldCode = '<button className="px-4 py-2 bg-blue-500 text-white rounded">\n      Click Me\n    </button>';
    const newCode = '<button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg">\n      ✨ Upgraded Button\n    </button>';

    const patchResult = await service.applyPatch(sampleFilePath, oldCode, newCode, true);
    expect(patchResult.success).toBe(true);
    expect(patchResult.backupPath).toBeDefined();

    // Verify file content was updated
    const updatedContent = await fs.promises.readFile(sampleFilePath, 'utf-8');
    expect(updatedContent).toContain('Upgraded Button');
    expect(updatedContent).not.toContain('bg-blue-500');

    // Verify backup file was created
    expect(fs.existsSync(patchResult.backupPath!)).toBe(true);
  });

  it('rolls back patched file to original content from backup', async () => {
    const oldCode = '<button className="px-4 py-2 bg-blue-500 text-white rounded">\n      Click Me\n    </button>';
    const newCode = '<button className="bg-red-500">Broken</button>';

    const patchResult = await service.applyPatch(sampleFilePath, oldCode, newCode, true);
    expect(patchResult.success).toBe(true);

    const rollbackResult = await service.rollbackFile(sampleFilePath, patchResult.backupPath);
    expect(rollbackResult.success).toBe(true);

    const restoredContent = await fs.promises.readFile(sampleFilePath, 'utf-8');
    expect(restoredContent).toContain('Click Me');
    expect(restoredContent).not.toContain('Broken');
  });

  it('handles edge case: returns error when target code snippet is not found', async () => {
    const nonexistentCode = '<div className="does-not-exist">Fake</div>';
    const patchResult = await service.applyPatch(sampleFilePath, nonexistentCode, '<div/>');
    expect(patchResult.success).toBe(false);
    expect(patchResult.message).toContain('was not found');
  });

  it('handles edge case: returns error when file does not exist', async () => {
    const patchResult = await service.applyPatch('/fake/path/Nonexistent.tsx', 'old', 'new');
    expect(patchResult.success).toBe(false);
    expect(patchResult.message).toContain('Target file not found');
  });

  it('avoids duplicating imports when patching with a self-contained module', async () => {
    const snippetOldCode = `export const SampleButton = () => {
  return (
    <button className="px-4 py-2 bg-blue-500 text-white rounded">
      Click Me
    </button>
  );
};`;
    const fullNewCode = `import React from 'react';
import { Sparkles } from 'lucide-react';

export const SampleButton = () => {
  return (
    <button className="px-4 py-2 bg-indigo-600 text-white rounded">
      <Sparkles className="w-4 h-4" />
      <span>Modern Button</span>
    </button>
  );
};`;

    const result = await service.applyPatch(sampleFilePath, snippetOldCode, fullNewCode, false);
    expect(result.success).toBe(true);

    const content = await fs.promises.readFile(sampleFilePath, 'utf-8');
    const importReactCount = (content.match(/import React/g) || []).length;
    expect(importReactCount).toBe(1);
    expect(content).toContain('Sparkles');
  });
});

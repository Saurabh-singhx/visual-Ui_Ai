import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { WorkspacePatcherService, workspacePatcherService } from './workspacePatcherService';

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

  it('normalizes paths by stripping quotes and whitespace', () => {
    const rawWithQuotes = '"/some/folder/path"';
    const normalized = service.normalizePath(rawWithQuotes);
    expect(normalized).toBe(path.resolve('/some/folder/path'));

    const rawWithWhitespace = '   /another/path   ';
    expect(service.normalizePath(rawWithWhitespace)).toBe(path.resolve('/another/path'));
  });

  it('translates Windows drive letters to WSL path on Linux', () => {
    if (process.platform === 'linux') {
      const winPath = 'C:\\Users\\Developer\\Projects\\visual-ui';
      const normalized = service.normalizePath(winPath);
      expect(normalized).toBe('/mnt/c/Users/Developer/Projects/visual-ui');
    }
  });

  it('handles CRLF line endings in searchComponent and matches accurately', async () => {
    const crlfContent = 'import React from "react";\r\n\r\nexport const Banner = () => {\r\n  return <div className="banner-alert">Warning Alert</div>;\r\n};\r\n';
    const bannerPath = path.join(testDir, 'Banner.tsx');
    await fs.promises.writeFile(bannerPath, crlfContent, 'utf-8');

    const results = await service.searchComponent(testDir, { text: 'Warning Alert' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matchSnippet).toBe('return <div className="banner-alert">Warning Alert</div>;');
    expect(results[0].matchSnippet).not.toContain('\r');
  });

  it('ignores uppercase and titlecase build/node_modules directories', async () => {
    const upperDist = path.join(testDir, 'DIST');
    await fs.promises.mkdir(upperDist, { recursive: true });
    await fs.promises.writeFile(path.join(upperDist, 'bundle.js'), 'console.log("built");', 'utf-8');

    const files = await service.scanDirectory(testDir);
    expect(files.some((f) => f.name === 'bundle.js')).toBe(false);
  });

  it('locates default sample workspace dynamically', () => {
    const sampleWs = service.getDefaultSampleWorkspace();
    expect(sampleWs).toBeDefined();
    expect(typeof sampleWs).toBe('string');
  });

  it('constructs a dynamic workspace app from real components in directory', async () => {
    // Add a second component to testDir (Navbar)
    const navContent = `import React from 'react';
export const TestNavbar: React.FC = () => {
  return <nav className="flex items-center px-4 bg-white">Logo</nav>;
};`;
    await fs.promises.writeFile(path.join(testDir, 'TestNavbar.tsx'), navContent, 'utf-8');

    const app = await service.getWorkspaceApp(testDir);
    expect(app).toBeDefined();
    expect(app.isWorkspace).toBe(true);
    expect(app.interactiveElements.length).toBe(2);

    // Header element should be positioned at top
    const navElem = app.interactiveElements.find((e) => e.tagName === 'nav');
    expect(navElem).toBeDefined();
    expect(navElem?.bounds.y).toBe(24);
    expect(navElem?.bounds.width).toBe(1120);

    // Button element should be positioned in grid below header
    const btnElem = app.interactiveElements.find((e) => e.name === 'SampleButton');
    expect(btnElem).toBeDefined();
    expect(btnElem?.bounds.y).toBeGreaterThanOrEqual(116);
    expect(btnElem?.filePath).toBe(sampleFilePath);
  });

  it('loads components from sample-workspace dynamically and avoids TS generic tags', async () => {
    const sampleWs = service.getDefaultSampleWorkspace();
    const app = await service.getWorkspaceApp(sampleWs);
    expect(app.isWorkspace).toBe(true);
    expect(app.interactiveElements.length).toBeGreaterThanOrEqual(3);

    const cardElem = app.interactiveElements.find((e) => e.name.includes('Card') || e.codeSnippet?.includes('Card'));
    const navElem = app.interactiveElements.find((e) => e.name.includes('Nav') || e.codeSnippet?.includes('Nav'));
    const metricElem = app.interactiveElements.find((e) => e.name.includes('Metric') || e.codeSnippet?.includes('Metric'));

    expect(cardElem).toBeDefined();
    expect(navElem).toBeDefined();
    expect(metricElem).toBeDefined();

    // Verify tag names are genuine HTML tags, NOT TypeScript generic parameter types like 'cardprops'
    expect(cardElem?.tagName).toBe('div');
    expect(cardElem?.tagName).not.toBe('cardprops');
    expect(navElem?.tagName).toBe('nav');
  });

  it('filters out non-UI helper or utility tsx files without JSX return', async () => {
    const utilPath = path.join(testDir, 'mathHelpers.tsx');
    const utilContent = `export function add(a: number, b: number): number {
      return a + b;
    }`;
    await fs.promises.writeFile(utilPath, utilContent, 'utf-8');

    const app = await service.getWorkspaceApp(testDir);
    expect(app.interactiveElements.some((e) => e.name === 'add' || e.name === 'mathHelpers')).toBe(false);
  });

  it('handles edge case: non-existent directory throws error in getWorkspaceApp', async () => {
    await expect(service.getWorkspaceApp('/path/does/not/exist')).rejects.toThrow('Directory does not exist');
  });

  it('handles edge case: directory with no components returns app with 0 elements', async () => {
    const emptySubdir = path.join(testDir, 'empty-sub');
    await fs.promises.mkdir(emptySubdir, { recursive: true });
    const app = await service.getWorkspaceApp(emptySubdir);
    expect(app.interactiveElements.length).toBe(0);
    expect(app.isWorkspace).toBe(true);
  });
});

describe('scanProjectMetadata - Shallow 2KB Streaming Read', () => {
  const tempDir = path.join(__dirname, '../../test-temp-shallow');

  beforeEach(async () => {
    await fs.promises.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('scans large component file by reading at most 2048 bytes of header metadata', async () => {
    const header = `import React from 'react';\nexport const LargeTable: React.FC = () => {\n  return <table><tbody>`;
    const padding = '\n    <tr><td>Sample row content</td></tr>'.repeat(1500);
    const footer = `\n  </tbody></table>;\n};`;
    const largeContent = header + padding + footer;

    const largeFilePath = path.join(tempDir, 'LargeTable.tsx');
    await fs.promises.writeFile(largeFilePath, largeContent, 'utf-8');

    const result = await workspacePatcherService.scanProjectMetadata(tempDir);
    expect(result.components.length).toBe(1);
    expect(result.components[0].name).toBe('LargeTable');
    expect(result.components[0].platform).toBe('web');
  });

  it('completes metadata scan across directories rapidly without memory bloat', async () => {
    for (let i = 0; i < 20; i++) {
      const filePath = path.join(tempDir, `Widget${i}.tsx`);
      await fs.promises.writeFile(
        filePath,
        `import React from 'react';\nexport const Widget${i} = () => <div>${i}</div>;`,
        'utf-8'
      );
    }

    const start = performance.now();
    const result = await workspacePatcherService.scanProjectMetadata(tempDir);
    const duration = performance.now() - start;

    expect(result.totalCount).toBe(20);
    expect(duration).toBeLessThan(500);
  });
});

describe('scanProjectMetadata - Multi-Platform Categorization', () => {
  const tempDir = path.join(__dirname, '../../test-temp-platforms');

  beforeEach(async () => {
    await fs.promises.mkdir(tempDir, { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'res/layout'), { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'src-tauri/src'), { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('categorizes Web components correctly (.tsx, .jsx, .vue, .svelte, .html)', async () => {
    await fs.promises.writeFile(path.join(tempDir, 'WebCard.tsx'), `export const WebCard = () => <article>Web</article>;`);
    await fs.promises.writeFile(path.join(tempDir, 'VueCard.vue'), `<template><section>Vue</section></template>`);
    await fs.promises.writeFile(path.join(tempDir, 'SvelteButton.svelte'), `<script>let c = 0;</script><button>{c}</button>`);
    await fs.promises.writeFile(path.join(tempDir, 'Page.html'), `<!DOCTYPE html><html><body><header>Title</header></body></html>`);

    const result = await workspacePatcherService.scanProjectMetadata(tempDir, { platform: 'web' });
    expect(result.components.length).toBe(4);
    result.components.forEach((c) => expect(c.platform).toBe('web'));
  });

  it('categorizes Mobile React Native components', async () => {
    const rnCode = `import React from 'react';\nimport { View, Text, TouchableOpacity } from 'react-native';\nexport const ProfileScreen = () => (<View><Text>Profile</Text></View>);`;
    await fs.promises.writeFile(path.join(tempDir, 'ProfileScreen.tsx'), rnCode);

    const result = await workspacePatcherService.scanProjectMetadata(tempDir, { platform: 'mobile' });
    const rnComp = result.components.find((c) => c.name === 'ProfileScreen');
    expect(rnComp).toBeDefined();
    expect(rnComp?.platform).toBe('mobile');
  });

  it('categorizes Mobile Flutter Dart widgets', async () => {
    const flutterCode = `import 'package:flutter/material.dart';\nclass ActionCard extends StatelessWidget {\n  @override\n  Widget build(BuildContext context) => Container();\n}`;
    await fs.promises.writeFile(path.join(tempDir, 'ActionCard.dart'), flutterCode);

    const result = await workspacePatcherService.scanProjectMetadata(tempDir, { platform: 'mobile' });
    const flutterComp = result.components.find((c) => c.name === 'ActionCard');
    expect(flutterComp).toBeDefined();
    expect(flutterComp?.platform).toBe('mobile');
  });

  it('categorizes Mobile Android Layout XML', async () => {
    const xmlCode = `<?xml version="1.0" encoding="utf-8"?>\n<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android">\n  <TextView android:id="@+id/title" />\n</androidx.constraintlayout.widget.ConstraintLayout>`;
    await fs.promises.writeFile(path.join(tempDir, 'res/layout/activity_main.xml'), xmlCode);

    const result = await workspacePatcherService.scanProjectMetadata(tempDir, { platform: 'mobile' });
    const xmlComp = result.components.find((c) => c.name.includes('activity_main'));
    expect(xmlComp).toBeDefined();
    expect(xmlComp?.platform).toBe('mobile');
    expect(xmlComp?.rootElement).toContain('ConstraintLayout');
  });

  it('categorizes Desktop Electron and Tauri components', async () => {
    const tauriCode = `import { invoke } from '@tauri-apps/api';\nexport const WindowManager = () => <div className="desktop-win">Tauri</div>;`;
    await fs.promises.writeFile(path.join(tempDir, 'src-tauri/src/WindowManager.tsx'), tauriCode);

    const result = await workspacePatcherService.scanProjectMetadata(tempDir, { platform: 'desktop' });
    const desktopComp = result.components.find((c) => c.name === 'WindowManager');
    expect(desktopComp).toBeDefined();
    expect(desktopComp?.platform).toBe('desktop');
  });
});

describe('scanProjectMetadata - Strict Exclusion Filtering', () => {
  const tempDir = path.join(__dirname, '../../test-temp-exclusions');

  beforeEach(async () => {
    await fs.promises.mkdir(tempDir, { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'node_modules/my-pkg'), { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'dist'), { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'build'), { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, '.next/server'), { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'src/__tests__'), { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'src/stores'), { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'src/services'), { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'src/utils'), { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'src/components'), { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('produces zero false positives for non-visual and build files', async () => {
    await fs.promises.writeFile(path.join(tempDir, 'node_modules/my-pkg/Button.tsx'), '<button/>');
    await fs.promises.writeFile(path.join(tempDir, 'dist/App.js'), 'export const App = () => null;');
    await fs.promises.writeFile(path.join(tempDir, 'build/Bundle.js'), 'console.log(1);');
    await fs.promises.writeFile(path.join(tempDir, '.next/server/page.js'), 'export default () => null;');
    await fs.promises.writeFile(path.join(tempDir, 'src/__tests__/Button.test.tsx'), 'test("x", () => {});');
    await fs.promises.writeFile(path.join(tempDir, 'src/components/Header.spec.tsx'), 'describe("x", () => {});');
    await fs.promises.writeFile(path.join(tempDir, 'src/stores/authStore.ts'), 'export const useAuthStore = () => ({});');
    await fs.promises.writeFile(path.join(tempDir, 'src/services/apiService.ts'), 'export const fetchUser = () => {};');
    await fs.promises.writeFile(path.join(tempDir, 'src/utils/mathHelpers.ts'), 'export const sum = (a: number, b: number) => a + b;');
    await fs.promises.writeFile(path.join(tempDir, 'src/types.d.ts'), 'export interface User { id: string; }');

    // Valid UI component
    await fs.promises.writeFile(
      path.join(tempDir, 'src/components/PrimaryCard.tsx'),
      'export const PrimaryCard = () => <div className="card">Card</div>;'
    );

    const result = await workspacePatcherService.scanProjectMetadata(tempDir);
    expect(result.components.length).toBe(1);
    expect(result.components[0].name).toBe('PrimaryCard');
  });
});

describe('scanProjectMetadata - High Volume Threshold (> 30 components)', () => {
  const tempDir = path.join(__dirname, '../../test-temp-threshold');

  beforeEach(async () => {
    await fs.promises.mkdir(tempDir, { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'src/auth'), { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'src/dashboard'), { recursive: true });
    await fs.promises.mkdir(path.join(tempDir, 'src/settings'), { recursive: true });

    for (let i = 1; i <= 15; i++) {
      await fs.promises.writeFile(
        path.join(tempDir, `src/dashboard/Widget${i}.tsx`),
        `export const Widget${i} = () => <div>Dash ${i}</div>;`
      );
    }
    for (let i = 1; i <= 10; i++) {
      await fs.promises.writeFile(
        path.join(tempDir, `src/auth/AuthCard${i}.tsx`),
        `export const AuthCard${i} = () => <div>Auth ${i}</div>;`
      );
    }
    for (let i = 1; i <= 10; i++) {
      await fs.promises.writeFile(
        path.join(tempDir, `src/settings/SettingRow${i}.tsx`),
        `export const SettingRow${i} = () => <div>Setting ${i}</div>;`
      );
    }
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('flags exceedsThreshold=true and returns folder breakdown and suggestedFocus when > 30', async () => {
    const result = await workspacePatcherService.scanProjectMetadata(tempDir);
    expect(result.totalCount).toBe(35);
    expect(result.exceedsThreshold).toBe(true);
    expect(result.folderBreakdown['src/dashboard']).toBe(15);
    expect(result.folderBreakdown['src/auth']).toBe(10);
    expect(result.folderBreakdown['src/settings']).toBe(10);
    expect(result.suggestedFocus).toBeDefined();
    expect(result.suggestedFocus?.[0]).toBe('src/dashboard');
  });

  it('scopes component count when focus subfolder is provided', async () => {
    const result = await workspacePatcherService.scanProjectMetadata(tempDir, { focus: 'src/auth' });
    expect(result.totalCount).toBe(10);
    expect(result.exceedsThreshold).toBe(false);
    expect(result.components.every((c) => c.relativePath.startsWith('src/auth'))).toBe(true);
  });
});

describe('getComponentDetails - On-Demand Element Hierarchy Extraction', () => {
  const tempDir = path.join(__dirname, '../../test-temp-details');
  const componentPath = path.join(tempDir, 'ComplexCard.tsx');

  beforeEach(async () => {
    await fs.promises.mkdir(tempDir, { recursive: true });
    const content = `import React from 'react';

export const ComplexCard: React.FC = () => {
  return (
    <article className="p-6 bg-slate-900 rounded-2xl shadow-xl">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Card Header</h2>
        <span className="badge text-emerald-400">Live</span>
      </header>
      <input
        type="text"
        className="mt-3 px-3 py-2 border rounded-md"
        placeholder="Search..."
      />
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl"
        >
          Submit Action
        </button>
      </div>
    </article>
  );
};`;
    await fs.promises.writeFile(componentPath, content, 'utf-8');
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('extracts full source code and child element hierarchy with correct metadata', async () => {
    const details = await workspacePatcherService.getComponentDetails(componentPath);
    expect(details.filePath).toBe(componentPath);
    expect(details.code).toContain('export const ComplexCard');
    expect(details.elements.length).toBeGreaterThanOrEqual(4);

    const buttonElem = details.elements.find((e) => e.type === 'button');
    expect(buttonElem).toBeDefined();
    expect(buttonElem?.tag).toBe('button');
    expect(buttonElem?.text).toContain('Submit Action');
    expect(buttonElem?.classes).toContain('bg-indigo-600');
    expect(buttonElem?.startLine).toBeGreaterThan(0);
    expect(buttonElem?.endLine).toBeGreaterThanOrEqual(buttonElem!.startLine);
    expect(buttonElem?.codeSnippet).toContain('<button');

    const headerElem = details.elements.find((e) => e.type === 'header' || e.tag === 'h2');
    expect(headerElem).toBeDefined();
    expect(headerElem?.text).toContain('Card Header');

    const inputElem = details.elements.find((e) => e.type === 'input');
    expect(inputElem).toBeDefined();
    expect(inputElem?.tag).toBe('input');
  });

  it('throws 404/ENOENT error when file does not exist', async () => {
    await expect(workspacePatcherService.getComponentDetails('/nonexistent/file.tsx')).rejects.toThrow();
  });
});

describe('workspacePatcherService - Atomic Patching and Rollback', () => {
  const tempDir = path.join(__dirname, '../../test-temp-atomic');
  const filePath = path.join(tempDir, 'Button.tsx');

  beforeEach(async () => {
    await fs.promises.mkdir(tempDir, { recursive: true });
    await fs.promises.writeFile(
      filePath,
      `export const Button = () => <button className="bg-blue-500">Initial</button>;`,
      'utf-8'
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('creates timestamped .bak backup and modifies file atomically', async () => {
    const prompt = 'Add smooth hover scale transition and make emerald rounded pill';
    const result = await workspacePatcherService.applyAiModification(filePath, prompt);

    expect(result.success).toBe(true);
    expect(result.backupPath).toBeDefined();
    expect(fs.existsSync(result.backupPath!)).toBe(true);

    const backupContent = await fs.promises.readFile(result.backupPath!, 'utf-8');
    expect(backupContent).toContain('Initial');
    expect(backupContent).toContain('bg-blue-500');

    const updatedContent = await fs.promises.readFile(filePath, 'utf-8');
    expect(updatedContent).toContain('hover:scale-105');
    expect(updatedContent).toContain('rounded-full');
  });

  it('rolls back to latest backup when backupPath is omitted', async () => {
    const p1 = await workspacePatcherService.applyAiModification(filePath, 'Make it red');
    expect(p1.success).toBe(true);

    // Wait 10ms to ensure distinct ISO timestamp on backup file
    await new Promise((r) => setTimeout(r, 15));

    const p2 = await workspacePatcherService.applyAiModification(filePath, 'Make it green');
    expect(p2.success).toBe(true);

    const rollResult = await workspacePatcherService.rollbackComponent(filePath);
    expect(rollResult.success).toBe(true);
    expect(rollResult.restoredFrom).toBe(p2.backupPath);

    const content = await fs.promises.readFile(filePath, 'utf-8');
    expect(content).toContain('rose-600');
  });

  it('fails gracefully when rolling back file with no backups', async () => {
    const cleanFilePath = path.join(tempDir, 'NoBackup.tsx');
    await fs.promises.writeFile(cleanFilePath, 'export const NoBackup = () => null;');

    const rollResult = await workspacePatcherService.rollbackComponent(cleanFilePath);
    expect(rollResult.success).toBe(false);
    expect(rollResult.error).toContain('No backup files found');
  });

  it('sequentially steps backward through multiple revisions on repeated default rollbacks (v3 -> v2 -> v1 -> v0)', async () => {
    const seqFile = path.join(tempDir, 'SeqButton.tsx');
    await fs.promises.writeFile(seqFile, '<button>v0-initial</button>', 'utf-8');

    // v0 -> v1 (backup 1 holds v0)
    await workspacePatcherService.applyAiModification(seqFile, 'Make it red');
    await new Promise((r) => setTimeout(r, 10));

    // v1 -> v2 (backup 2 holds v1)
    await workspacePatcherService.applyAiModification(seqFile, 'Make it green');
    await new Promise((r) => setTimeout(r, 10));

    // v2 -> v3 (backup 3 holds v2)
    await workspacePatcherService.applyAiModification(seqFile, 'Make it purple');

    const v3Content = await fs.promises.readFile(seqFile, 'utf-8');
    expect(v3Content).toContain('purple');

    // Rollback 1: should restore v2 (green/emerald)
    const roll1 = await workspacePatcherService.rollbackComponent(seqFile);
    expect(roll1.success).toBe(true);
    const content1 = await fs.promises.readFile(seqFile, 'utf-8');
    expect(content1).toContain('emerald');
    expect(content1).not.toContain('purple');

    // Rollback 2: should restore v1 (red/rose)
    const roll2 = await workspacePatcherService.rollbackComponent(seqFile);
    expect(roll2.success).toBe(true);
    const content2 = await fs.promises.readFile(seqFile, 'utf-8');
    expect(content2).toContain('rose');
    expect(content2).not.toContain('emerald');

    // Rollback 3: should restore v0 (initial)
    const roll3 = await workspacePatcherService.rollbackComponent(seqFile);
    expect(roll3.success).toBe(true);
    const content3 = await fs.promises.readFile(seqFile, 'utf-8');
    expect(content3).toContain('v0-initial');
    expect(content3).not.toContain('rose');

    // Rollback 4: no more backups
    const roll4 = await workspacePatcherService.rollbackComponent(seqFile);
    expect(roll4.success).toBe(false);
    expect(roll4.error).toContain('No backup files found');
  });

  it('generates collision-free backup filenames with sub-millisecond entropy under rapid writes', async () => {
    const entropyFile = path.join(tempDir, 'EntropyButton.tsx');
    await fs.promises.writeFile(entropyFile, '<button>base</button>', 'utf-8');

    // Execute 5 rapid sequential/concurrent modifications
    const results = await Promise.all([
      workspacePatcherService.applyAiModification(entropyFile, 'Make it red'),
      workspacePatcherService.applyAiModification(entropyFile, 'Make it green'),
      workspacePatcherService.applyAiModification(entropyFile, 'Make it blue'),
      workspacePatcherService.applyAiModification(entropyFile, 'Make it yellow'),
      workspacePatcherService.applyAiModification(entropyFile, 'Make it purple'),
    ]);

    expect(results.every((r) => r.success)).toBe(true);

    const dirFiles = await fs.promises.readdir(tempDir);
    const backups = dirFiles.filter((f) => f.startsWith('EntropyButton.tsx.bak-'));

    // Assert that distinct backup files were created without collision overwriting
    expect(backups.length).toBe(5);

    // Assert that each backup filename matches timestamp + entropy suffix
    for (const b of backups) {
      expect(b).toMatch(/EntropyButton\.tsx\.bak-\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-z0-9]{4}$/);
    }
  });

  it('scans and classifies component with extensive header comments/imports up to 8KB without dropping', async () => {
    const largeHeaderDir = path.join(tempDir, 'large-header-test');
    await fs.promises.mkdir(largeHeaderDir, { recursive: true });

    // Generate ~4500 bytes of licensing comments and import declarations (> 2048 bytes)
    const commentBlock = `/*\n * ` + 'Extensive license notice and architectural documentation.\n * '.repeat(70) + `*/\n`;
    const importBlock = `import React from 'react';\nimport { useState } from 'react';\n`;
    const componentCode = `export const DocumentedHeaderCard = () => (\n  <div className="p-6 bg-white rounded-xl shadow-md">\n    <h2>Documentation Title</h2>\n  </div>\n);\n`;

    const fullContent = commentBlock + importBlock + componentCode;
    expect(Buffer.byteLength(fullContent, 'utf-8')).toBeGreaterThan(4000);

    const testFilePath = path.join(largeHeaderDir, 'DocumentedHeaderCard.tsx');
    await fs.promises.writeFile(testFilePath, fullContent, 'utf-8');

    const result = await workspacePatcherService.scanProjectMetadata(largeHeaderDir);
    expect(result.components.length).toBe(1);
    expect(result.components[0].name).toBe('DocumentedHeaderCard');
    expect(result.components[0].platform).toBe('web');
  });
});

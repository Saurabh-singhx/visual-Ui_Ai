import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { workspacePatcherService } from '../workspacePatcherService';

describe('detectWorkspaceProjectContext & dynamic workspace app', () => {
  const tempBase = path.join(__dirname, '../../../../test-temp-m1-detection');

  beforeEach(async () => {
    if (fs.existsSync(tempBase)) {
      await fs.promises.rm(tempBase, { recursive: true, force: true });
    }
    await fs.promises.mkdir(tempBase, { recursive: true });
  });

  afterEach(async () => {
    if (fs.existsSync(tempBase)) {
      await fs.promises.rm(tempBase, { recursive: true, force: true });
    }
  });

  it('detects React Native project via package.json dependencies', async () => {
    const projDir = path.join(tempBase, 'rn-project');
    await fs.promises.mkdir(projDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(projDir, 'package.json'),
      JSON.stringify({
        name: 'rn-app',
        dependencies: { 'react-native': '0.72.0', react: '18.2.0' },
      }),
      'utf-8'
    );

    const ctx = workspacePatcherService.detectWorkspaceProjectContext(projDir);
    expect(ctx.detectedPlatform).toBe('mobile');
    expect(ctx.detectedFramework).toBe('react-native');
    expect(ctx.targetDevice).toBe('mobile');
    expect(ctx.viewport).toEqual({ width: 375, height: 667 });
  });

  it('detects Expo project via package.json dependencies', async () => {
    const projDir = path.join(tempBase, 'expo-project');
    await fs.promises.mkdir(projDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(projDir, 'package.json'),
      JSON.stringify({
        name: 'expo-app',
        dependencies: { expo: '~49.0.0', react: '18.2.0' },
      }),
      'utf-8'
    );

    const ctx = workspacePatcherService.detectWorkspaceProjectContext(projDir);
    expect(ctx.detectedPlatform).toBe('mobile');
    expect(ctx.detectedFramework).toBe('react-native');
    expect(ctx.targetDevice).toBe('mobile');
    expect(ctx.viewport).toEqual({ width: 375, height: 667 });
  });

  it('detects Electron project via package.json devDependencies', async () => {
    const projDir = path.join(tempBase, 'electron-project');
    await fs.promises.mkdir(projDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(projDir, 'package.json'),
      JSON.stringify({
        name: 'electron-app',
        devDependencies: { electron: '^25.0.0' },
      }),
      'utf-8'
    );

    const ctx = workspacePatcherService.detectWorkspaceProjectContext(projDir);
    expect(ctx.detectedPlatform).toBe('desktop');
    expect(ctx.detectedFramework).toBe('electron');
    expect(ctx.targetDevice).toBe('desktop');
    expect(ctx.viewport).toEqual({ width: 1200, height: 800 });
  });

  it('detects Tauri project via @tauri-apps/api dependency', async () => {
    const projDir = path.join(tempBase, 'tauri-project');
    await fs.promises.mkdir(projDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(projDir, 'package.json'),
      JSON.stringify({
        name: 'tauri-app',
        dependencies: { '@tauri-apps/api': '^1.4.0' },
      }),
      'utf-8'
    );

    const ctx = workspacePatcherService.detectWorkspaceProjectContext(projDir);
    expect(ctx.detectedPlatform).toBe('desktop');
    expect(ctx.detectedFramework).toBe('tauri');
    expect(ctx.targetDevice).toBe('desktop');
    expect(ctx.viewport).toEqual({ width: 1200, height: 800 });
  });

  it('detects Flutter project via pubspec.yaml', async () => {
    const projDir = path.join(tempBase, 'flutter-project');
    await fs.promises.mkdir(projDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(projDir, 'pubspec.yaml'),
      'name: flutter_app\ndependencies:\n  flutter:\n    sdk: flutter\n',
      'utf-8'
    );

    const ctx = workspacePatcherService.detectWorkspaceProjectContext(projDir);
    expect(ctx.detectedPlatform).toBe('mobile');
    expect(ctx.detectedFramework).toBe('flutter');
    expect(ctx.targetDevice).toBe('mobile');
    expect(ctx.viewport).toEqual({ width: 375, height: 667 });
  });

  it('detects Tauri project via tauri.conf.json or src-tauri', async () => {
    const projDir = path.join(tempBase, 'tauri-conf-project');
    await fs.promises.mkdir(projDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(projDir, 'tauri.conf.json'),
      JSON.stringify({ package: { productName: 'TauriApp' } }),
      'utf-8'
    );

    const ctx = workspacePatcherService.detectWorkspaceProjectContext(projDir);
    expect(ctx.detectedPlatform).toBe('desktop');
    expect(ctx.detectedFramework).toBe('tauri');
    expect(ctx.targetDevice).toBe('desktop');
  });

  it('detects Expo project via app.json containing expo', async () => {
    const projDir = path.join(tempBase, 'app-json-expo');
    await fs.promises.mkdir(projDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(projDir, 'app.json'),
      JSON.stringify({ expo: { name: 'ExpoApp', slug: 'expo-app' } }),
      'utf-8'
    );

    const ctx = workspacePatcherService.detectWorkspaceProjectContext(projDir);
    expect(ctx.detectedPlatform).toBe('mobile');
    expect(ctx.detectedFramework).toBe('react-native');
    expect(ctx.targetDevice).toBe('mobile');
  });

  it('detects Next.js project via package.json next dependency', async () => {
    const projDir = path.join(tempBase, 'next-project');
    await fs.promises.mkdir(projDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(projDir, 'package.json'),
      JSON.stringify({
        name: 'next-app',
        dependencies: { next: '14.0.0', react: '18.2.0' },
      }),
      'utf-8'
    );

    const ctx = workspacePatcherService.detectWorkspaceProjectContext(projDir);
    expect(ctx.detectedPlatform).toBe('web');
    expect(ctx.detectedFramework).toBe('nextjs');
    expect(ctx.targetDevice).toBe('desktop');
  });

  it('detects Vue project via package.json vue/nuxt dependency', async () => {
    const projDir = path.join(tempBase, 'vue-project');
    await fs.promises.mkdir(projDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(projDir, 'package.json'),
      JSON.stringify({
        name: 'vue-app',
        dependencies: { vue: '^3.3.0' },
      }),
      'utf-8'
    );

    const ctx = workspacePatcherService.detectWorkspaceProjectContext(projDir);
    expect(ctx.detectedPlatform).toBe('web');
    expect(ctx.detectedFramework).toBe('vue');
    expect(ctx.targetDevice).toBe('desktop');
  });

  it('detects Svelte project via package.json svelte dependency', async () => {
    const projDir = path.join(tempBase, 'svelte-project');
    await fs.promises.mkdir(projDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(projDir, 'package.json'),
      JSON.stringify({
        name: 'svelte-app',
        dependencies: { svelte: '^4.0.0' },
      }),
      'utf-8'
    );

    const ctx = workspacePatcherService.detectWorkspaceProjectContext(projDir);
    expect(ctx.detectedPlatform).toBe('web');
    expect(ctx.detectedFramework).toBe('svelte');
    expect(ctx.targetDevice).toBe('desktop');
  });

  it('falls back to component distribution when descriptor files absent', async () => {
    const projDir = path.join(tempBase, 'component-dist-mobile');
    await fs.promises.mkdir(path.join(projDir, 'components'), { recursive: true });
    await fs.promises.writeFile(
      path.join(projDir, 'components', 'MobileProfile.tsx'),
      `import React from 'react';
import { View, Text } from 'react-native';
export const MobileProfile = () => <View><Text>Profile</Text></View>;`,
      'utf-8'
    );

    const ctx = workspacePatcherService.detectWorkspaceProjectContext(projDir);
    expect(ctx.detectedPlatform).toBe('mobile');
    expect(ctx.targetDevice).toBe('mobile');
  });

  it('falls back to default web react desktop for empty or non-existent dir', () => {
    const nonExistent = path.join(tempBase, 'non-existent-folder');
    const ctx = workspacePatcherService.detectWorkspaceProjectContext(nonExistent);
    expect(ctx.detectedPlatform).toBe('web');
    expect(ctx.detectedFramework).toBe('react');
    expect(ctx.targetDevice).toBe('desktop');
    expect(ctx.viewport).toEqual({ width: 1200, height: 800 });
  });

  it('dynamically sets platform and viewport in getWorkspaceApp for mobile projects', async () => {
    const projDir = path.join(tempBase, 'dynamic-mobile-app');
    await fs.promises.mkdir(projDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(projDir, 'package.json'),
      JSON.stringify({
        name: 'dynamic-mobile',
        dependencies: { 'react-native': '0.72.0' },
      }),
      'utf-8'
    );
    await fs.promises.writeFile(
      path.join(projDir, 'Screen.tsx'),
      `import React from 'react';
import { View, Text } from 'react-native';
export const Screen = () => <View><Text>Screen</Text></View>;`,
      'utf-8'
    );

    const app = await workspacePatcherService.getWorkspaceApp(projDir);
    expect(app.platform).toBe('mobile');
    expect(app.viewport.width).toBe(375);
    expect(app.viewport.height).toBeGreaterThanOrEqual(667);
  });

  it('populates detectedPlatform, detectedFramework, targetDevice, and viewport in scanProjectMetadata', async () => {
    const projDir = path.join(tempBase, 'scan-project');
    await fs.promises.mkdir(projDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(projDir, 'package.json'),
      JSON.stringify({
        name: 'electron-tool',
        devDependencies: { electron: '^26.0.0' },
      }),
      'utf-8'
    );
    await fs.promises.writeFile(
      path.join(projDir, 'Window.tsx'),
      `import React from 'react';
export const Window = () => <div>Desktop Window</div>;`,
      'utf-8'
    );

    const scanResult = await workspacePatcherService.scanProjectMetadata(projDir);
    expect(scanResult.detectedPlatform).toBe('desktop');
    expect(scanResult.detectedFramework).toBe('electron');
    expect(scanResult.targetDevice).toBe('desktop');
    expect(scanResult.viewport).toEqual({ width: 1200, height: 800 });
  });
});

import {
  SampleApp,
  WorkspaceFile,
  WorkspaceSearchResult,
  PatchApplyResult,
  AdbDevice,
} from '../types';

const BASE_URL = '/api';

export const api = {
  // Capture & Samples
  async getSamples(): Promise<SampleApp[]> {
    try {
      const res = await fetch(`${BASE_URL}/capture/samples`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.samples || [];
    } catch (err) {
      console.warn('Failed to fetch samples from backend, using fallback samples:', err);
      return [];
    }
  },

  // AI Redesign
  async redesignComponent(payload: {
    prompt: string;
    originalCode?: string;
    targetFramework?: string;
    extractedStyles?: any;
    wcagFixRequested?: boolean;
  }) {
    const res = await fetch(`${BASE_URL}/ai/redesign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'AI request failed' }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.result;
  },

  async getAiProviders() {
    try {
      const res = await fetch(`${BASE_URL}/ai/providers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return {
        providers: {
          localEngine: true,
          activeDefault: 'Smart Local UI Engine (Built-in)',
        },
      };
    }
  },

  async getAiPresets() {
    try {
      const res = await fetch(`${BASE_URL}/ai/presets`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.presets || [];
    } catch {
      return [];
    }
  },

  // Workspace
  async getWorkspaceInfo(): Promise<{ success: boolean; platform: string; sampleWorkspacePath: string }> {
    const res = await fetch(`${BASE_URL}/workspace/info`);
    if (!res.ok) throw new Error('Could not fetch workspace info');
    return res.json();
  },

  async scanWorkspace(dirPath: string): Promise<WorkspaceFile[]> {
    const res = await fetch(`${BASE_URL}/workspace/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirPath }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to scan workspace' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.files || [];
  },

  async getWorkspaceApp(dirPath: string): Promise<SampleApp> {
    const res = await fetch(`${BASE_URL}/workspace/app`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirPath }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to load workspace application' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.app;
  },

  async searchWorkspace(dirPath: string, query: { text?: string; className?: string; tagName?: string }): Promise<WorkspaceSearchResult[]> {
    const res = await fetch(`${BASE_URL}/workspace/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirPath, ...query }),
    });
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return data.matches || [];
  },

  async readFile(filePath: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/workspace/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });
    if (!res.ok) throw new Error('Could not read file');
    const data = await res.json();
    return data.content || '';
  },

  async applyPatch(payload: {
    filePath: string;
    oldCode: string;
    newCode: string;
    createBackup?: boolean;
  }): Promise<PatchApplyResult> {
    const res = await fetch(`${BASE_URL}/workspace/apply-patch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to apply patch');
    }
    return data;
  },

  async rollbackFile(filePath: string, backupPath?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${BASE_URL}/workspace/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, backupPath }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to rollback file');
    }
    return data;
  },

  // ADB
  async getAdbDevices(): Promise<AdbDevice[]> {
    try {
      const res = await fetch(`${BASE_URL}/adb/devices`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.devices || [];
    } catch {
      return [];
    }
  },

  async getAdbHierarchy(deviceId?: string, useSample?: boolean) {
    const res = await fetch(`${BASE_URL}/adb/hierarchy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, useSample }),
    });
    return await res.json();
  },

  async captureAdbScreen(deviceId?: string) {
    const res = await fetch(`${BASE_URL}/adb/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    return await res.json();
  },
};

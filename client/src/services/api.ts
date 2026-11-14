import {
  SampleApp,
  WorkspaceFile,
  WorkspaceSearchResult,
  PatchApplyResult,
} from '../types';

const BASE_URL = '/api';

export const api = {
  // Canvas State & In-Session Rendering (R2)
  async renderCanvas(payload: {
    filePath?: string;
    componentName?: string;
    code?: string;
    props?: Record<string, any>;
    viewport?: { width?: number; height?: number };
  }): Promise<{
    success: boolean;
    activeComponent: {
      name: string;
      filePath: string;
      code: string;
      props: any;
      isVirtual: boolean;
    };
    synthesizedProps: any;
  }> {
    const res = await fetch(`${BASE_URL}/canvas/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to render canvas' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  },

  async getCanvasState(): Promise<{
    success: boolean;
    activeComponent: any;
    timestamp: number;
  }> {
    const res = await fetch(`${BASE_URL}/canvas/state`);
    if (!res.ok) throw new Error('Failed to get canvas state');
    return await res.json();
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
};

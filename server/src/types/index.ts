export interface WorkspaceFile {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
}

export interface WorkspaceSearchResult {
  filePath: string;
  relativePath: string;
  line: number;
  matchSnippet: string;
  confidence: number;
}

export interface PatchApplyRequest {
  filePath: string;
  oldCode: string;
  newCode: string;
  createBackup?: boolean;
}

export interface PatchApplyResult {
  success: boolean;
  message: string;
  backupPath?: string;
  diffSummary?: {
    additions: number;
    deletions: number;
  };
}

export interface AdbDevice {
  id: string;
  model: string;
  state: 'device' | 'offline' | 'unauthorized';
  isEmulator: boolean;
}

export interface AdbHierarchyNode {
  id: string;
  className: string;
  resourceId?: string;
  text?: string;
  contentDesc?: string;
  bounds: {
    x?: number;
    y?: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
  };
  clickable: boolean;
  focusable: boolean;
  children: AdbHierarchyNode[];
}

export interface RedesignRequest {
  prompt: string;
  originalCode?: string;
  imageSnippetBase64?: string;
  targetFramework?: 'react-tailwind' | 'html-tailwind' | 'react-native' | 'vue';
  extractedStyles?: {
    colors?: string[];
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    dimensions?: { width: number; height: number };
  };
  wcagFixRequested?: boolean;
}

export interface RedesignResponse {
  analysis: string;
  redesignedCode: string;
  framework: string;
  explanation: string;
  accessibilityImprovements: string[];
  stylingDiffSummary: string[];
}

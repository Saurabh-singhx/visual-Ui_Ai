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

export interface InteractiveElement {
  id: string;
  name: string;
  selector: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  tagName: string;
  className?: string;
  codeSnippet?: string;
  styles?: {
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    borderRadius?: string;
    padding?: string;
  };
  filePath?: string;
  relativePath?: string;
}

export interface SampleApp {
  id: string;
  platform: 'web' | 'mobile' | 'desktop';
  name: string;
  viewport: { width: number; height: number };
  description: string;
  interactiveElements: InteractiveElement[];
  screenshotUrl?: string;
  iframeUrl?: string;
  isWorkspace?: boolean;
  workspacePath?: string;
}

// ==========================================
// Milestone M1 Types: Discovery, On-Demand & Patching
// ==========================================

export type PlatformType = 'web' | 'mobile' | 'desktop';
export type PlatformFilter = 'web' | 'mobile' | 'desktop' | 'all';
export type ElementType = 'button' | 'header' | 'input' | 'container' | 'card' | 'text' | 'other';

export interface ComponentMetadata {
  name: string;
  filePath: string;
  relativePath: string;
  platform: PlatformType;
  rootElement?: string;
  elementCount?: number;
}

export interface ScanProjectRequest {
  dir?: string;
  focus?: string;
  platform?: PlatformFilter;
  include?: string[];
  exclude?: string[];
}

export interface ScanResult {
  components: ComponentMetadata[];
  totalCount: number;
  exceedsThreshold: boolean;
  folderBreakdown: Record<string, number>;
  suggestedFocus?: string[];
  detectedPlatform?: 'web' | 'mobile' | 'desktop';
  detectedFramework?: string;
  targetDevice?: 'mobile' | 'desktop';
  viewport?: { width: number; height: number };
}

export interface ProjectContext {
  detectedPlatform: 'web' | 'mobile' | 'desktop';
  detectedFramework: string;
  targetDevice: 'mobile' | 'desktop';
  viewport: { width: number; height: number };
}

export interface WorkspaceInfo {
  success: boolean;
  platform: string;
  sampleWorkspacePath: string;
  workspaceDir?: string;
  focusFile?: string;
  skillMode?: boolean;
  targetDevice?: 'mobile' | 'tablet' | 'desktop';
  targetPlatform?: 'web' | 'mobile' | 'desktop' | 'workspace';
  detectedPlatform?: 'web' | 'mobile' | 'desktop';
  detectedFramework?: string;
}

export interface ElementDetail {
  id: string;
  tag: string;
  type: ElementType;
  classes: string;
  text?: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
}

export interface ComponentDetailsResult {
  filePath: string;
  code: string;
  elements: ElementDetail[];
}

export interface ModifyComponentRequest {
  filePath: string;
  elementId?: string;
  prompt: string;
}

export interface ModifyComponentResult {
  success: boolean;
  filePath: string;
  modifiedCode: string;
  backupPath?: string;
  appliedChanges: string[];
  error?: string;
}

export interface RollbackComponentRequest {
  filePath: string;
  backupPath?: string;
}

export interface RollbackComponentResult {
  success: boolean;
  restoredFrom: string;
  currentCode: string;
  message?: string;
  error?: string;
}

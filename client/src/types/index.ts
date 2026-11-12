export type PlatformType = 'web' | 'mobile' | 'desktop';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElementStyles {
  backgroundColor?: string;
  textColor?: string;
  fontSize?: string;
  borderRadius?: string;
  padding?: string;
}

export interface InteractiveElement {
  id: string;
  name: string;
  selector: string;
  bounds: BoundingBox;
  tagName: string;
  className?: string;
  codeSnippet?: string;
  styles?: ElementStyles;
}

export interface SampleApp {
  id: string;
  platform: PlatformType;
  name: string;
  viewport: { width: number; height: number };
  description: string;
  interactiveElements: InteractiveElement[];
  screenshotUrl?: string;
  iframeUrl?: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  redesignedCode?: string;
  framework?: string;
  accessibilityImprovements?: string[];
  stylingDiffSummary?: string[];
  isStreaming?: boolean;
}

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

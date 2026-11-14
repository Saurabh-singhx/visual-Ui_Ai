import fs from 'fs';
import path from 'path';
import {
  WorkspaceFile,
  WorkspaceSearchResult,
  PatchApplyResult,
  SampleApp,
  InteractiveElement,
  ComponentMetadata,
  ScanProjectRequest,
  ScanResult,
  ElementDetail,
  ElementType,
  ComponentDetailsResult,
  ModifyComponentResult,
  RollbackComponentResult,
  PlatformType,
} from '../types';
import { aiService } from './aiService';

export class WorkspacePatcherService {
  private allowedExtensions = new Set(['.tsx', '.jsx', '.ts', '.js', '.vue', '.html', '.css', '.json']);
  private ignoredDirs = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.cache',
    'coverage',
    '.vs',
    '.idea',
    '$recycle.bin',
    'system volume information',
  ]);

  /**
   * Normalizes input path across Windows, WSL, and POSIX file systems.
   */
  normalizePath(rawPath: string): string {
    if (!rawPath) return '';
    let cleaned = rawPath.trim().replace(/^["']|["']$/g, '');

    // WSL support: If running on Linux/WSL and path has Windows drive letter (C:\ or C:/)
    if (process.platform === 'linux' && /^[a-zA-Z]:[/\\]/.test(cleaned)) {
      const driveLetter = cleaned[0].toLowerCase();
      const rest = cleaned.slice(2).replace(/\\/g, '/');
      cleaned = `/mnt/${driveLetter}${rest.startsWith('/') ? rest : `/${rest}`}`;
    }

    return path.resolve(cleaned);
  }

  /**
   * Dynamically locates the built-in sample-workspace directory across environments
   */
  getDefaultSampleWorkspace(): string {
    const candidates = [
      path.resolve(process.cwd(), 'sample-workspace'),
      path.resolve(process.cwd(), '../sample-workspace'),
      path.resolve(__dirname, '../../../sample-workspace'),
      path.resolve(__dirname, '../../sample-workspace'),
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }
    return candidates[0];
  }

  /**
   * Scans a directory recursively and returns list of eligible source files (legacy)
   */
  async scanDirectory(dirPath: string): Promise<WorkspaceFile[]> {
    const resolvedPath = this.normalizePath(dirPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${dirPath}`);
    }

    const results: WorkspaceFile[] = [];

    const walk = async (currentDir: string) => {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (this.ignoredDirs.has(entry.name.toLowerCase())) continue;

        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(resolvedPath, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          results.push({
            name: entry.name,
            path: fullPath,
            relativePath,
            isDirectory: true,
          });
          await walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (this.allowedExtensions.has(ext)) {
            try {
              const fileStat = await fs.promises.stat(fullPath);
              results.push({
                name: entry.name,
                path: fullPath,
                relativePath,
                isDirectory: false,
                size: fileStat.size,
              });
            } catch {
              continue;
            }
          }
        }
      }
    };

    await walk(resolvedPath);
    return results;
  }

  /**
   * Reads <= maxBytes shallow chunk from file to avoid loading entire files into memory
   */
  private async readShallowChunk(filePath: string, maxBytes: number = 8192): Promise<string> {
    let fh: fs.promises.FileHandle | null = null;
    try {
      fh = await fs.promises.open(filePath, 'r');
      const buf = Buffer.alloc(maxBytes);
      const { bytesRead } = await fh.read(buf, 0, maxBytes, 0);
      return buf.toString('utf-8', 0, bytesRead);
    } catch {
      return '';
    } finally {
      if (fh) {
        await fh.close();
      }
    }
  }

  /**
   * Strict exclusion rules to guarantee zero false positives
   */
  private isExcludedFile(filePath: string, relativePath: string): boolean {
    const normRel = relativePath.replace(/\\/g, '/');
    const baseName = path.basename(normRel);
    const lowerBase = baseName.toLowerCase();

    // 1. Tests: __tests__ dir, *.test.*, *.spec.*, test.*, spec.*
    if (
      /(?:^|\/)__tests__(?:\/|$)/i.test(normRel) ||
      lowerBase.includes('.test.') ||
      lowerBase.includes('.spec.') ||
      lowerBase.startsWith('test.') ||
      lowerBase.startsWith('spec.')
    ) {
      return true;
    }

    // 2. Type definitions: *.d.ts, types.ts, types.d.ts, type.ts
    if (
      lowerBase.endsWith('.d.ts') ||
      lowerBase === 'types.ts' ||
      lowerBase === 'types.d.ts' ||
      lowerBase === 'type.ts' ||
      /(?:^|\/)types(?:\/|$)/i.test(normRel)
    ) {
      return true;
    }

    // 3. State stores: stores/, slices/, *store.*, *slice.*
    if (
      /(?:^|\/)(?:stores?|slices?)(?:\/|$)/i.test(normRel) ||
      lowerBase.includes('store.') ||
      lowerBase.includes('slice.') ||
      lowerBase.startsWith('store-') ||
      lowerBase.startsWith('slice-')
    ) {
      return true;
    }

    // 4. Backend services: services/, *service.*
    if (
      /(?:^|\/)services?(?:\/|$)/i.test(normRel) ||
      lowerBase.includes('service.') ||
      lowerBase.startsWith('service-')
    ) {
      return true;
    }

    // 5. Utilities & helpers: helpers/, utils/, *helper.*, *util.*
    if (
      /(?:^|\/)(?:helpers?|utils?)(?:\/|$)/i.test(normRel) ||
      lowerBase.includes('helper.') ||
      lowerBase.includes('helpers.') ||
      lowerBase.includes('util.') ||
      lowerBase.includes('utils.') ||
      lowerBase.startsWith('helper-') ||
      lowerBase.startsWith('util-')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Multi-Platform AST/heuristic classifier (Web, Mobile RN/Flutter/Android XML, Desktop Electron/Tauri)
   */
  private classifyPlatform(
    filePath: string,
    relativePath: string,
    chunk: string
  ): { platform: PlatformType; rootElement: string; name: string } | null {
    const ext = path.extname(filePath).toLowerCase();
    const normRel = relativePath.replace(/\\/g, '/').toLowerCase();
    const baseName = path.basename(filePath, ext);

    // 1. Desktop check
    const isDesktop =
      normRel.includes('/desktop/') ||
      normRel.includes('src-tauri') ||
      normRel.includes('/electron/') ||
      chunk.includes("'electron'") ||
      chunk.includes('"electron"') ||
      chunk.includes("'@tauri-apps/api'") ||
      chunk.includes('"@tauri-apps/api"');

    if (isDesktop) {
      return {
        platform: 'desktop',
        rootElement: this.extractRootElement(chunk) || 'div',
        name: this.extractComponentName(chunk, baseName),
      };
    }

    // 2. Mobile check: Flutter Dart
    if (ext === '.dart' && (chunk.includes('StatelessWidget') || chunk.includes('StatefulWidget') || chunk.includes('Widget build('))) {
      const dartClassMatch = chunk.match(/class\s+([A-Za-z0-9_]+)\s+extends\s+(?:Stateless|Stateful)Widget/);
      return {
        platform: 'mobile',
        rootElement: 'Widget',
        name: dartClassMatch ? dartClassMatch[1] : baseName,
      };
    }

    // Mobile check: Android layout XML
    if (ext === '.xml' && (chunk.includes('<LinearLayout') || chunk.includes('<ConstraintLayout') || chunk.includes('<RelativeLayout') || chunk.includes('<FrameLayout') || chunk.includes('<CoordinatorLayout') || chunk.includes('<ScrollView') || chunk.includes('<androidx.'))) {
      const xmlRootMatch = chunk.match(/<([A-Za-z0-9_.-]+)[\s>]/);
      return {
        platform: 'mobile',
        rootElement: xmlRootMatch ? xmlRootMatch[1] : 'ViewGroup',
        name: baseName,
      };
    }

    // Mobile check: React Native
    const isReactNative =
      (ext === '.tsx' || ext === '.jsx' || ext === '.js' || ext === '.ts') &&
      (chunk.includes("'react-native'") || chunk.includes('"react-native"') || (chunk.includes('<View') && chunk.includes('<Text')) || chunk.includes('<SafeAreaView'));

    if (isReactNative) {
      return {
        platform: 'mobile',
        rootElement: this.extractRootElement(chunk) || 'View',
        name: this.extractComponentName(chunk, baseName),
      };
    }

    // 3. Web check: .tsx, .jsx, .vue, .svelte, .html
    if (['.tsx', '.jsx', '.vue', '.svelte', '.html'].includes(ext)) {
      const hasJsxOrDom =
        /(?:return\s*\(?|=>\s*\(?)\s*(?:<>\s*)?<[a-zA-Z]/s.test(chunk) ||
        /<template\b/s.test(chunk) ||
        /<(?:div|span|header|main|section|button|nav|p|article|h[1-6]|table|form|article)\b/i.test(chunk);

      if (hasJsxOrDom) {
        return {
          platform: 'web',
          rootElement: this.extractRootElement(chunk) || 'div',
          name: this.extractComponentName(chunk, baseName),
        };
      }
    }

    return null;
  }

  private extractComponentName(chunk: string, baseName: string): string {
    const match = chunk.match(/(?:export\s+(?:default\s+)?(?:const|function|class)\s+|function\s+|class\s+)([A-Z][A-Za-z0-9_]*)/);
    if (match && match[1] && match[1] !== 'Default' && match[1] !== 'React') {
      return match[1];
    }
    const arrowMatch = chunk.match(/(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=/);
    if (arrowMatch && arrowMatch[1]) {
      return arrowMatch[1];
    }
    return baseName;
  }

  private extractRootElement(chunk: string): string | undefined {
    const match = chunk.match(/(?:return\s*\(?|=>\s*\(?)\s*(?:<>\s*)?<([A-Za-z][A-Za-z0-9_-]*)/);
    if (match && match[1]) {
      const raw = match[1];
      if (raw !== 'React' && raw !== 'Fragment') return raw;
    }
    const anyTag = chunk.match(/<([A-Za-z][A-Za-z0-9_-]*)/);
    if (anyTag && anyTag[1]) {
      const raw = anyTag[1];
      if (raw !== 'React' && raw !== 'Fragment') return raw;
    }
    return undefined;
  }

  /**
   * Shallow metadata scanner without loading full file bodies into memory
   */
  async scanProjectMetadata(
    dirOrOptions?: string | ScanProjectRequest,
    maybeOptions?: ScanProjectRequest
  ): Promise<ScanResult> {
    let options: ScanProjectRequest = {};
    if (typeof dirOrOptions === 'string') {
      options = { ...maybeOptions, dir: dirOrOptions };
    } else if (dirOrOptions && typeof dirOrOptions === 'object') {
      options = { ...dirOrOptions, ...maybeOptions };
    } else if (maybeOptions) {
      options = maybeOptions;
    }

    const baseDir = this.normalizePath(options.dir || this.getDefaultSampleWorkspace());
    if (!fs.existsSync(baseDir)) {
      throw new Error(`Directory does not exist: ${options.dir || baseDir}`);
    }

    const stat = await fs.promises.stat(baseDir);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${options.dir || baseDir}`);
    }

    // Read project-level .visual-ui.json or .agents/visual-ui.json config if present
    const configPath1 = path.join(baseDir, '.visual-ui.json');
    const configPath2 = path.join(baseDir, '.agents', 'visual-ui.json');
    let fileConfig: any = {};
    if (fs.existsSync(configPath1)) {
      try {
        fileConfig = JSON.parse(fs.readFileSync(configPath1, 'utf8'));
      } catch {}
    } else if (fs.existsSync(configPath2)) {
      try {
        fileConfig = JSON.parse(fs.readFileSync(configPath2, 'utf8'));
      } catch {}
    }

    if (fileConfig && typeof fileConfig === 'object') {
      if (Array.isArray(fileConfig.exclude)) {
        options.exclude = [...(options.exclude || []), ...fileConfig.exclude];
      }
      if (Array.isArray(fileConfig.include)) {
        options.include = [...(options.include || []), ...fileConfig.include];
      }
      if (fileConfig.focus && !options.focus) {
        options.focus = fileConfig.focus;
      }
      if (fileConfig.platform && !options.platform) {
        options.platform = fileConfig.platform;
      }
    }

    const allowedCandidateExts = new Set(['.tsx', '.jsx', '.vue', '.svelte', '.html', '.dart', '.xml', '.ts', '.js']);
    const ignoredDirRegex = /(?:^|\/)(?:node_modules|\.git|dist|build|\.next|\.cache|coverage|\.vs|\.idea|\.svelte-kit|\.nuxt|out|\$recycle\.bin)(?:\/|$)/i;

    const components: ComponentMetadata[] = [];

    const walk = async (currentDir: string) => {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (ignoredDirRegex.test(entry.name) || ignoredDirRegex.test(relativePath)) continue;
          if (this.isExcludedFile(fullPath, relativePath)) continue;
          await walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!allowedCandidateExts.has(ext)) continue;
          if (this.isExcludedFile(fullPath, relativePath)) continue;

          // Shallow read <= 8192 bytes
          const chunk = await this.readShallowChunk(fullPath, 8192);
          if (!chunk) continue;

          const classified = this.classifyPlatform(fullPath, relativePath, chunk);
          if (!classified) continue;

          // Tag count estimate from shallow chunk
          const tagMatches = chunk.match(/<[A-Za-z][A-Za-z0-9_-]*/g);
          const elementCount = tagMatches ? tagMatches.length : 1;

          components.push({
            name: classified.name,
            filePath: fullPath,
            relativePath,
            platform: classified.platform,
            rootElement: classified.rootElement,
            elementCount,
          });
        }
      }
    };

    await walk(baseDir);

    // Apply filters
    let filtered = components;

    if (options.focus) {
      const normFocus = options.focus.replace(/\\/g, '/').replace(/^\/|\/$/g, '');
      filtered = filtered.filter((c) => c.relativePath.startsWith(normFocus));
    }

    if (options.platform && options.platform !== 'all') {
      filtered = filtered.filter((c) => c.platform === options.platform);
    }

    if (options.include && options.include.length > 0) {
      filtered = filtered.filter((c) =>
        options.include!.some((inc) => c.relativePath.includes(inc) || c.name.includes(inc))
      );
    }

    if (options.exclude && options.exclude.length > 0) {
      filtered = filtered.filter(
        (c) => !options.exclude!.some((exc) => c.relativePath.includes(exc) || c.name.includes(exc))
      );
    }

    // Folder breakdown calculation
    const folderBreakdown: Record<string, number> = {};
    for (const comp of filtered) {
      const folder = path.dirname(comp.relativePath).replace(/\\/g, '/');
      folderBreakdown[folder] = (folderBreakdown[folder] || 0) + 1;
    }

    // High-volume threshold detection (>30 components)
    const exceedsThreshold = filtered.length > 30;
    const suggestedFocus = exceedsThreshold
      ? Object.entries(folderBreakdown)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([folder]) => folder)
      : undefined;

    return {
      components: filtered,
      totalCount: filtered.length,
      exceedsThreshold,
      folderBreakdown,
      suggestedFocus,
    };
  }

  /**
   * On-demand lazy load component details and element hierarchy
   */
  async getComponentDetails(filePath: string): Promise<ComponentDetailsResult> {
    const resolvedPath = this.normalizePath(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Target file not found: ${filePath}`);
    }

    const stat = await fs.promises.stat(resolvedPath);
    if (stat.isDirectory()) {
      throw new Error(`Path is a directory: ${filePath}`);
    }

    const code = await fs.promises.readFile(resolvedPath, 'utf-8');
    const lines = code.split(/\r?\n/);
    const lineOffsets: number[] = [0];
    for (let i = 0; i < code.length; i++) {
      if (code[i] === '\n') {
        lineOffsets.push(i + 1);
      }
    }

    const getLine = (offset: number): number => {
      let low = 0;
      let high = lineOffsets.length - 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (lineOffsets[mid] <= offset) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return high + 1;
    };

    const elements: ElementDetail[] = [];
    const fullTagRegex = /<([A-Za-z][A-Za-z0-9_-]*)(\s+[\s\S]*?)?(\/?>)/g;
    let match: RegExpExecArray | null;

    while ((match = fullTagRegex.exec(code)) !== null) {
      const rawTag = match[1];
      const attrs = match[2] || '';
      const closing = match[3];
      const startIndex = match.index;
      const tagEndIndex = match.index + match[0].length;

      // Filter out TypeScript generics (e.g. React.FC<CardProps>)
      const prefix = code.slice(Math.max(0, startIndex - 30), startIndex);
      if (
        /:\s*(?:React\.)?(?:FC|FunctionComponent|Component)\s*$/i.test(prefix) ||
        /(?:interface|type|extends|implements)\s+[A-Za-z0-9_]+\s*$/i.test(prefix)
      ) {
        continue;
      }
      if (rawTag === 'React' || rawTag === 'Fragment') continue;

      const startLine = getLine(startIndex);
      let endLine = getLine(tagEndIndex);

      const isSelfClosing = closing === '/>' || attrs.trim().endsWith('/');
      let textContent = '';

      if (!isSelfClosing) {
        const closingTag = `</${rawTag}>`;
        const closeIdx = code.indexOf(closingTag, tagEndIndex);
        if (closeIdx !== -1 && closeIdx - tagEndIndex < 5000) {
          endLine = getLine(closeIdx + closingTag.length);
          const inner = code.slice(tagEndIndex, closeIdx).trim();
          const textClean = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (textClean) {
            textContent = textClean;
          }
        }
      }

      const tagLower = rawTag.toLowerCase();
      let type: ElementType = 'other';
      if (['button', 'touchableopacity', 'pressable'].includes(tagLower)) {
        type = 'button';
      } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'nav'].includes(tagLower)) {
        type = 'header';
      } else if (['input', 'textarea', 'select', 'textinput'].includes(tagLower)) {
        type = 'input';
      } else if (['article'].includes(tagLower) || tagLower.includes('card') || attrs.includes('card')) {
        type = 'card';
      } else if (
        [
          'div',
          'section',
          'main',
          'aside',
          'view',
          'safeareaview',
          'scrollview',
          'linearlayout',
          'constraintlayout',
          'relativelayout',
          'framelayout',
        ].includes(tagLower)
      ) {
        type = 'container';
      } else if (['p', 'span', 'label', 'text', 'a'].includes(tagLower)) {
        type = 'text';
      }

      let classes = '';
      const classMatch = attrs.match(/class(?:Name)?=["']([^"']+)["']/);
      if (classMatch) {
        classes = classMatch[1];
      }

      const snippetLines = lines.slice(startLine - 1, endLine);
      const codeSnippet = snippetLines.join('\n').trim();

      elements.push({
        id: `${tagLower}-${startLine}`,
        tag: rawTag,
        type,
        classes,
        text: textContent || undefined,
        startLine,
        endLine,
        codeSnippet,
      });
    }

    return {
      filePath: resolvedPath,
      code,
      elements,
    };
  }

  /**
   * Applies AI prompt modification to component with automatic backup and atomic write
   */
  async applyAiModification(
    filePath: string,
    prompt: string,
    elementId?: string
  ): Promise<ModifyComponentResult> {
    const resolvedPath = this.normalizePath(filePath);
    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        filePath: resolvedPath,
        modifiedCode: '',
        appliedChanges: [],
        error: `Target file not found: ${filePath}`,
      };
    }

    const currentContent = await fs.promises.readFile(resolvedPath, 'utf-8');
    const modResult = aiService.modifyComponentCode(currentContent, prompt, elementId);

    // Create backup file with sub-millisecond entropy suffix
    const timestamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
    const backupPath = `${resolvedPath}.bak-${timestamp}`;
    await fs.promises.writeFile(backupPath, currentContent, 'utf-8');

    // Atomic write via temporary file rename
    const tempPath = `${resolvedPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await fs.promises.writeFile(tempPath, modResult.modifiedCode, 'utf-8');
    await fs.promises.rename(tempPath, resolvedPath);

    return {
      success: true,
      filePath: resolvedPath,
      modifiedCode: modResult.modifiedCode,
      backupPath,
      appliedChanges: modResult.appliedChanges,
    };
  }

  /**
   * Rollback component from latest or specified backup
   */
  async rollbackComponent(
    filePath: string,
    specificBackupPath?: string
  ): Promise<RollbackComponentResult> {
    const resolvedTarget = this.normalizePath(filePath);
    if (!fs.existsSync(resolvedTarget)) {
      return {
        success: false,
        restoredFrom: '',
        currentCode: '',
        error: `Target file not found: ${filePath}`,
        message: `Target file not found: ${filePath}`,
      };
    }

    let backupToRestore = specificBackupPath ? this.normalizePath(specificBackupPath) : null;

    if (!backupToRestore) {
      const dir = path.dirname(resolvedTarget);
      const baseName = path.basename(resolvedTarget);
      let files: string[] = [];
      try {
        files = await fs.promises.readdir(dir);
      } catch {
        return {
          success: false,
          restoredFrom: '',
          currentCode: '',
          error: `Could not read directory for ${baseName}`,
          message: `Could not read directory for ${baseName}`,
        };
      }

      const backups = files
        .filter((f) => f.startsWith(`${baseName}.bak-`))
        .sort()
        .reverse();

      if (backups.length === 0) {
        return {
          success: false,
          restoredFrom: '',
          currentCode: '',
          error: `No backup files found for ${baseName}`,
          message: `No backup files found for ${baseName}`,
        };
      }
      backupToRestore = path.join(dir, backups[0]);
    }

    if (!fs.existsSync(backupToRestore)) {
      return {
        success: false,
        restoredFrom: '',
        currentCode: '',
        error: `Backup file does not exist: ${backupToRestore}`,
        message: `Backup file does not exist: ${backupToRestore}`,
      };
    }

    const backupContent = await fs.promises.readFile(backupToRestore, 'utf-8');

    // Atomic write via temp file
    const tempPath = `${resolvedTarget}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await fs.promises.writeFile(tempPath, backupContent, 'utf-8');
    await fs.promises.rename(tempPath, resolvedTarget);

    // Unlink consumed backup so subsequent rollbacks step backward to earlier revisions
    try {
      await fs.promises.unlink(backupToRestore);
    } catch {
      // ignore if already removed
    }

    return {
      success: true,
      restoredFrom: backupToRestore,
      currentCode: backupContent,
      message: `Successfully rolled back ${path.basename(resolvedTarget)} using ${path.basename(backupToRestore)}`,
    };
  }

  /**
   * Searches for a component or code fragment in workspace
   */
  async searchComponent(
    dirPath: string,
    query: { text?: string; className?: string; tagName?: string }
  ): Promise<WorkspaceSearchResult[]> {
    const files = await this.scanDirectory(dirPath);
    const sourceFiles = files.filter((f) => !f.isDirectory);
    const results: WorkspaceSearchResult[] = [];

    const searchTerms: string[] = [];
    if (query.text && query.text.trim().length > 1) {
      const cleanText = query.text.replace(/\(.*?\)/g, '').trim();
      searchTerms.push(cleanText);
      const words = cleanText.split(/\s+/).filter((w) => w.length >= 4);
      searchTerms.push(...words);
    }
    if (query.className && query.className.trim().length > 1) {
      const classes = query.className.split(/\s+/).filter((c) => c.length > 2);
      searchTerms.push(...classes);
    }
    if (query.tagName && query.tagName.trim().length > 0 && query.tagName.toLowerCase() !== 'div') {
      searchTerms.push(`<${query.tagName}`);
    }

    if (searchTerms.length === 0) {
      return [];
    }

    const uniqueTerms = Array.from(new Set(searchTerms.map((t) => t.toLowerCase())));

    for (const file of sourceFiles) {
      try {
        const content = await fs.promises.readFile(file.path, 'utf-8');
        const lines = content.split(/\r?\n/);
        const fileBaseName = path.basename(file.name, path.extname(file.name)).toLowerCase();

        let fileNameBonus = 0;
        for (const term of uniqueTerms) {
          if (fileBaseName.includes(term) || term.includes(fileBaseName)) {
            fileNameBonus += 2;
          }
        }

        const fileMatches: WorkspaceSearchResult[] = [];

        lines.forEach((line, index) => {
          let score = fileNameBonus;
          for (const term of uniqueTerms) {
            if (line.toLowerCase().includes(term)) {
              score += 1;
            }
          }

          if (score > 0) {
            fileMatches.push({
              filePath: file.path,
              relativePath: file.relativePath,
              line: index + 1,
              matchSnippet: line.trim(),
              confidence: Math.min(100, score * 25),
            });
          }
        });

        fileMatches.sort((a, b) => b.confidence - a.confidence);
        results.push(...fileMatches.slice(0, 2));
      } catch {
        continue;
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence).slice(0, 20);
  }

  /**
   * Reads a source file safely
   */
  async readFile(filePath: string): Promise<string> {
    const resolvedPath = this.normalizePath(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    return fs.promises.readFile(resolvedPath, 'utf-8');
  }

  /**
   * Applies patch to a file with automatic backup creation and atomic write
   */
  async applyPatch(
    filePath: string,
    oldCode: string,
    newCode: string,
    createBackup: boolean = true
  ): Promise<PatchApplyResult> {
    const resolvedPath = this.normalizePath(filePath);
    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        message: `Target file not found: ${filePath}`,
      };
    }

    const currentContent = await fs.promises.readFile(resolvedPath, 'utf-8');
    let updatedContent: string | null = null;

    const normalize = (str: string) => str.replace(/\r\n/g, '\n').trim();
    const normOld = normalize(oldCode || '');
    const normCurrent = normalize(currentContent);

    // Strategy 1: Empty or full file match
    if (!normOld || normOld === normCurrent) {
      updatedContent = newCode;
    }

    // Strategy 2: If newCode is a full self-contained module (has imports and exports component)
    if (!updatedContent) {
      const isNewCodeFullModule = newCode.includes('import ') && /export\s+(?:const|function|default)\s+([A-Za-z0-9_]+)/.test(newCode);
      if (isNewCodeFullModule && currentContent.includes('import ')) {
        const compMatch = newCode.match(/export\s+(?:const|function|default)\s+([A-Za-z0-9_]+)/);
        const compName = compMatch ? compMatch[1] : null;
        const currentExports = [...currentContent.matchAll(/export\s+(?:const|function|default)\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]);

        if (compName && (currentExports.length <= 1 || currentExports.every((exp) => exp === compName))) {
          updatedContent = newCode;
        }
      }
    }

    // Strategy 3: Exact substring match
    if (!updatedContent && currentContent.includes(oldCode)) {
      if (newCode.includes('import ') && !oldCode.includes('import ') && currentContent.includes('import ')) {
        const isSelfContained = /export\s+(?:const|function|default)\s+([A-Za-z0-9_]+)/.test(newCode);
        if (isSelfContained) {
          updatedContent = newCode;
        } else {
          updatedContent = currentContent.replace(oldCode, newCode);
        }
      } else {
        updatedContent = currentContent.replace(oldCode, newCode);
      }
    }
    // Strategy 4: Normalized newline substring match
    else if (!updatedContent && normCurrent.includes(normOld)) {
      const normalizedCurrentLines = currentContent.replace(/\r\n/g, '\n');
      const idx = normalizedCurrentLines.indexOf(normOld);
      if (idx !== -1) {
        if (newCode.includes('import ') && !oldCode.includes('import ') && currentContent.includes('import ')) {
          updatedContent = newCode;
        } else {
          updatedContent =
            normalizedCurrentLines.substring(0, idx) +
            newCode +
            normalizedCurrentLines.substring(idx + normOld.length);
        }
      }
    }

    // Strategy 5: Component declaration match
    if (!updatedContent) {
      const compMatch = newCode.match(/export\s+(?:const|function|default)\s+([A-Za-z0-9_]+)/);
      if (compMatch) {
        const compName = compMatch[1];
        const compPattern = new RegExp(`export\\s+(?:const|function|default)\\s+${compName}[\\s\\S]*`);
        if (compPattern.test(currentContent)) {
          if (newCode.includes('import ') && currentContent.includes('import ')) {
            updatedContent = newCode;
          }
        }
      }
    }

    if (!updatedContent) {
      return {
        success: false,
        message: `Target code snippet was not found in ${path.basename(filePath)}.`,
      };
    }

    let backupPath: string | undefined;
    if (createBackup) {
      const timestamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
      backupPath = `${resolvedPath}.bak-${timestamp}`;
      await fs.promises.writeFile(backupPath, currentContent, 'utf-8');
    }

    // Atomic write via temporary file rename
    const tempPath = `${resolvedPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await fs.promises.writeFile(tempPath, updatedContent, 'utf-8');
    await fs.promises.rename(tempPath, resolvedPath);

    const oldLines = (oldCode || currentContent).split(/\r?\n/).length;
    const newLines = newCode.split(/\r?\n/).length;

    return {
      success: true,
      message: `Successfully patched ${path.basename(filePath)}`,
      backupPath,
      diffSummary: {
        additions: Math.max(0, newLines - oldLines),
        deletions: Math.max(0, oldLines - newLines),
      },
    };
  }

  /**
   * Reverts changes from the most recent or specified backup file (legacy backward compatibility)
   */
  async rollbackFile(
    filePath: string,
    specificBackupPath?: string
  ): Promise<{ success: boolean; message: string; restoredFrom?: string; currentCode?: string }> {
    const res = await this.rollbackComponent(filePath, specificBackupPath);
    return {
      success: res.success,
      message: res.message || res.error || '',
      restoredFrom: res.restoredFrom,
      currentCode: res.currentCode,
    };
  }

  /**
   * Scans a workspace directory and dynamically constructs a live application canvas representation
   */
  async getWorkspaceApp(dirPath: string): Promise<SampleApp> {
    const resolvedPath = this.normalizePath(dirPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    const files = await this.scanDirectory(resolvedPath);
    const componentExtensions = new Set(['.tsx', '.jsx', '.html', '.vue']);
    const candidateFiles = files.filter((f) => {
      if (f.isDirectory) return false;
      const lower = f.name.toLowerCase();
      if (
        lower.endsWith('.test.tsx') ||
        lower.endsWith('.spec.tsx') ||
        lower.endsWith('.test.jsx') ||
        lower.endsWith('.spec.jsx') ||
        lower.endsWith('.d.ts')
      ) {
        return false;
      }
      return componentExtensions.has(path.extname(lower));
    });

    const folderName = path.basename(resolvedPath) || 'Local Workspace';
    const rawElements: Array<{
      file: WorkspaceFile;
      content: string;
      name: string;
      tagName: string;
      className: string;
      isHeader: boolean;
      isFooter: boolean;
      styles: {
        backgroundColor: string;
        textColor: string;
        fontSize: string;
        borderRadius: string;
      };
    }> = [];

    for (const file of candidateFiles) {
      try {
        const content = await fs.promises.readFile(file.path, 'utf-8');
        const fileBaseName = path.basename(file.name, path.extname(file.name));

        const isVueOrHtml = file.name.endsWith('.vue') || file.name.endsWith('.html');
        const hasJsxReturn =
          /(?:return\s*\(?|=>\s*\(?)\s*(?:<>\s*)?<[a-zA-Z]/s.test(content) ||
          /(?:return\s*\(?|=>\s*\(?)\s*<[a-zA-Z]/s.test(content) ||
          /<template\b/s.test(content) ||
          (isVueOrHtml && /<[a-zA-Z][a-zA-Z0-9_-]*/.test(content));

        if (!hasJsxReturn) {
          continue;
        }

        let compName = fileBaseName;
        const upperCompMatch = content.match(
          /(?:export\s+(?:default\s+)?(?:const|function|class)\s+|function\s+)([A-Z][A-Za-z0-9_]*)/
        );
        if (upperCompMatch && upperCompMatch[1] && upperCompMatch[1] !== 'Default') {
          compName = upperCompMatch[1];
        } else {
          const arrowMatch = content.match(
            /(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>/
          );
          if (arrowMatch && arrowMatch[1]) {
            compName = arrowMatch[1];
          } else {
            const expDefaultMatch = content.match(/export\s+default\s+([A-Z][A-Za-z0-9_]*)/);
            if (expDefaultMatch && expDefaultMatch[1]) {
              compName = expDefaultMatch[1];
            } else if (fileBaseName.toLowerCase() === 'index') {
              const parentDirName = path.basename(path.dirname(file.path));
              if (parentDirName && parentDirName !== '.' && parentDirName !== 'src' && parentDirName !== 'components') {
                compName = parentDirName;
              }
            }
          }
        }

        const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

        let tagName = 'div';
        const jsxTagMatch = cleanContent.match(
          /(?:return\s*\(?|=>\s*\(?)\s*(?:<>\s*)?<([a-zA-Z][a-zA-Z0-9_-]*)/
        );
        if (jsxTagMatch && jsxTagMatch[1]) {
          const rawTag = jsxTagMatch[1].toLowerCase();
          if (rawTag !== 'react' && rawTag !== 'fragment') {
            tagName = rawTag;
          }
        } else if (isVueOrHtml) {
          const templateTag = cleanContent.match(/<template[^>]*>\s*<([a-zA-Z][a-zA-Z0-9_-]*)/);
          if (templateTag && templateTag[1]) {
            tagName = templateTag[1].toLowerCase();
          }
        }

        let className = '';
        const rootClassMatch = cleanContent.match(
          /(?:return\s*\(?|=>\s*\(?)\s*(?:<>\s*)?<[a-zA-Z][a-zA-Z0-9_-]*\s+[^>]*?class(?:Name)?=["']([^"']+)["']/s
        );
        if (rootClassMatch && rootClassMatch[1]) {
          className = rootClassMatch[1];
        } else {
          const anyClassMatch = cleanContent.match(/class(?:Name)?=["']([^"']+)["']/);
          if (anyClassMatch && anyClassMatch[1]) {
            className = anyClassMatch[1];
          }
        }

        let backgroundColor = '#0f172a';
        let textColor = '#f8fafc';
        let fontSize = '14px';
        let borderRadius = '8px';

        const lowerClass = className.toLowerCase();
        if (lowerClass.includes('bg-white')) backgroundColor = '#ffffff';
        else if (lowerClass.includes('bg-gray-100') || lowerClass.includes('bg-slate-100'))
          backgroundColor = '#f3f4f6';
        else if (lowerClass.includes('bg-gray-200')) backgroundColor = '#e5e7eb';
        else if (lowerClass.includes('bg-slate-800') || lowerClass.includes('bg-gray-800'))
          backgroundColor = '#1e293b';
        else if (lowerClass.includes('bg-slate-900') || lowerClass.includes('bg-gray-900'))
          backgroundColor = '#0f172a';
        else if (lowerClass.includes('bg-black')) backgroundColor = '#000000';
        else if (lowerClass.includes('bg-blue-600') || lowerClass.includes('bg-blue-500'))
          backgroundColor = '#2563eb';
        else if (lowerClass.includes('bg-indigo-600') || lowerClass.includes('bg-indigo-700'))
          backgroundColor = '#4f46e5';

        if (lowerClass.includes('text-black') || lowerClass.includes('text-gray-900'))
          textColor = '#111827';
        else if (lowerClass.includes('text-gray-700') || lowerClass.includes('text-gray-600'))
          textColor = '#374151';
        else if (lowerClass.includes('text-white')) textColor = '#ffffff';
        else if (lowerClass.includes('text-slate-100')) textColor = '#f1f5f9';
        else if (lowerClass.includes('text-slate-400')) textColor = '#94a3b8';
        else if (lowerClass.includes('text-emerald-400')) textColor = '#34d399';

        if (lowerClass.includes('rounded-2xl')) borderRadius = '16px';
        else if (lowerClass.includes('rounded-xl')) borderRadius = '12px';
        else if (lowerClass.includes('rounded-lg')) borderRadius = '8px';
        else if (lowerClass.includes('rounded-md') || lowerClass.includes('rounded'))
          borderRadius = '4px';
        else if (lowerClass.includes('rounded-none')) borderRadius = '0px';

        if (lowerClass.includes('text-2xl')) fontSize = '24px';
        else if (lowerClass.includes('text-xl')) fontSize = '20px';
        else if (lowerClass.includes('text-lg')) fontSize = '18px';
        else if (lowerClass.includes('text-sm')) fontSize = '14px';
        else if (lowerClass.includes('text-xs')) fontSize = '12px';

        const lowerName = compName.toLowerCase();
        const isHeader =
          lowerName.includes('nav') ||
          lowerName.includes('header') ||
          lowerName.includes('topbar') ||
          tagName === 'nav' ||
          tagName === 'header';
        const isFooter = lowerName.includes('footer') || tagName === 'footer';

        rawElements.push({
          file,
          content,
          name: compName,
          tagName,
          className,
          isHeader,
          isFooter,
          styles: { backgroundColor, textColor, fontSize, borderRadius },
        });
      } catch {
        continue;
      }
    }

    const headers = rawElements.filter((e) => e.isHeader);
    const footers = rawElements.filter((e) => e.isFooter);
    const contentComponents = rawElements.filter((e) => !e.isHeader && !e.isFooter);

    const interactiveElements: InteractiveElement[] = [];

    let currentY = 24;
    for (const h of headers) {
      interactiveElements.push({
        id: `ws-${h.file.name.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
        name: h.name,
        selector: `${h.tagName}.${h.className ? h.className.trim().split(/\s+/)[0] : 'workspace-header'}`,
        bounds: { x: 40, y: currentY, width: 1120, height: 76 },
        tagName: h.tagName,
        className: h.className,
        codeSnippet: h.content,
        styles: h.styles,
        filePath: h.file.path,
        relativePath: h.file.relativePath,
      });
      currentY += 96;
    }

    if (headers.length === 0) {
      currentY = 24;
    } else {
      currentY = Math.max(currentY, 116);
    }

    const cardWidth = 350;
    const cardHeight = 280;
    const gapX = 35;
    const gapY = 30;

    contentComponents.forEach((c, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = 40 + col * (cardWidth + gapX);
      const y = currentY + row * (cardHeight + gapY);

      interactiveElements.push({
        id: `ws-${c.file.name.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
        name: c.name,
        selector: `${c.tagName}.${c.className ? c.className.trim().split(/\s+/)[0] : 'workspace-component'}`,
        bounds: { x, y, width: cardWidth, height: cardHeight },
        tagName: c.tagName,
        className: c.className,
        codeSnippet: c.content,
        styles: c.styles,
        filePath: c.file.path,
        relativePath: c.file.relativePath,
      });
    });

    const contentRowCount = Math.ceil(contentComponents.length / 3);
    const contentEndY = currentY + contentRowCount * (cardHeight + gapY);

    let footerY = Math.max(contentEndY + 20, 680);
    for (const f of footers) {
      interactiveElements.push({
        id: `ws-${f.file.name.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
        name: f.name,
        selector: `${f.tagName}.${f.className ? f.className.trim().split(/\s+/)[0] : 'workspace-footer'}`,
        bounds: { x: 40, y: footerY, width: 1120, height: 56 },
        tagName: f.tagName,
        className: f.className,
        codeSnippet: f.content,
        styles: f.styles,
        filePath: f.file.path,
        relativePath: f.file.relativePath,
      });
      footerY += 72;
    }

    const totalHeight = Math.max(750, footers.length > 0 ? footerY + 40 : contentEndY + 60);

    return {
      id: `workspace-${folderName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`,
      platform: 'web',
      name: `Workspace: ${folderName}`,
      viewport: { width: 1200, height: totalHeight },
      description: `Loaded ${interactiveElements.length} component${interactiveElements.length === 1 ? '' : 's'} from ${resolvedPath}`,
      interactiveElements,
      isWorkspace: true,
      workspacePath: resolvedPath,
    };
  }
}

export const workspacePatcherService = new WorkspacePatcherService();

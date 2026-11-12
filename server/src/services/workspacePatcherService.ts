import fs from 'fs';
import path from 'path';
import { WorkspaceFile, WorkspaceSearchResult, PatchApplyResult } from '../types';

export class WorkspacePatcherService {
  private allowedExtensions = new Set(['.tsx', '.jsx', '.ts', '.js', '.vue', '.html', '.css', '.json']);
  private ignoredDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage']);

  /**
   * Scans a directory recursively and returns list of eligible source files
   */
  async scanDirectory(dirPath: string): Promise<WorkspaceFile[]> {
    const resolvedPath = path.resolve(dirPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    const stat = await fs.promises.stat(resolvedPath);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${dirPath}`);
    }

    const results: WorkspaceFile[] = [];

    const walk = async (currentDir: string) => {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (this.ignoredDirs.has(entry.name)) continue;

        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(resolvedPath, fullPath);

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
            const fileStat = await fs.promises.stat(fullPath);
            results.push({
              name: entry.name,
              path: fullPath,
              relativePath,
              isDirectory: false,
              size: fileStat.size,
            });
          }
        }
      }
    };

    await walk(resolvedPath);
    return results;
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
      // split class names into unique classes
      const classes = query.className.split(/\s+/).filter((c) => c.length > 2);
      searchTerms.push(...classes);
    }
    if (query.tagName && query.tagName.trim().length > 0 && query.tagName.toLowerCase() !== 'div') {
      searchTerms.push(`<${query.tagName}`);
    }

    if (searchTerms.length === 0) {
      return [];
    }

    // Unique search terms
    const uniqueTerms = Array.from(new Set(searchTerms.map((t) => t.toLowerCase())));

    for (const file of sourceFiles) {
      try {
        const content = await fs.promises.readFile(file.path, 'utf-8');
        const lines = content.split('\n');
        const fileBaseName = path.basename(file.name, path.extname(file.name)).toLowerCase();

        // Check if file name matches search query terms
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

        // Take top 2 best scoring lines per file
        fileMatches.sort((a, b) => b.confidence - a.confidence);
        results.push(...fileMatches.slice(0, 2));
      } catch (err) {
        // Skip unreadable files gracefully
        continue;
      }
    }

    // Sort by confidence descending
    return results.sort((a, b) => b.confidence - a.confidence).slice(0, 20);
  }

  /**
   * Reads a source file safely
   */
  async readFile(filePath: string): Promise<string> {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    return fs.promises.readFile(resolvedPath, 'utf-8');
  }

  /**
   * Applies patch to a file with automatic backup creation
   */
  async applyPatch(
    filePath: string,
    oldCode: string,
    newCode: string,
    createBackup: boolean = true
  ): Promise<PatchApplyResult> {
    const resolvedPath = path.resolve(filePath);
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

        // If file has at most one export or exclusively defines this component
        if (compName && (currentExports.length <= 1 || currentExports.every((exp) => exp === compName))) {
          updatedContent = newCode;
        }
      }
    }

    // Strategy 3: Exact substring match
    if (!updatedContent && currentContent.includes(oldCode)) {
      // If newCode contains imports and currentContent already contains imports, avoid injecting imports mid-file
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

    // Strategy 5: Component declaration match (e.g. export const FeatureCard / TopNavbar)
    if (!updatedContent) {
      const compMatch = newCode.match(/export\s+(?:const|function|default)\s+([A-Za-z0-9_]+)/);
      if (compMatch) {
        const compName = compMatch[1];
        const compPattern = new RegExp(`export\\s+(?:const|function|default)\\s+${compName}[\\s\\S]*`);
        if (compPattern.test(currentContent)) {
          // If the newCode is a full file module (has imports)
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
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      backupPath = `${resolvedPath}.bak-${timestamp}`;
      await fs.promises.writeFile(backupPath, currentContent, 'utf-8');
    }

    await fs.promises.writeFile(resolvedPath, updatedContent, 'utf-8');

    const oldLines = (oldCode || currentContent).split('\n').length;
    const newLines = newCode.split('\n').length;

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
   * Reverts changes from the most recent or specified backup file
   */
  async rollbackFile(filePath: string, specificBackupPath?: string): Promise<{ success: boolean; message: string }> {
    const resolvedTarget = path.resolve(filePath);

    let backupToRestore = specificBackupPath ? path.resolve(specificBackupPath) : null;

    if (!backupToRestore) {
      // Find latest backup matching target
      const dir = path.dirname(resolvedTarget);
      const baseName = path.basename(resolvedTarget);
      const files = await fs.promises.readdir(dir);
      const backups = files
        .filter((f) => f.startsWith(`${baseName}.bak-`))
        .sort()
        .reverse();

      if (backups.length === 0) {
        return {
          success: false,
          message: `No backup files found for ${baseName}`,
        };
      }
      backupToRestore = path.join(dir, backups[0]);
    }

    if (!fs.existsSync(backupToRestore)) {
      return {
        success: false,
        message: `Backup file does not exist: ${backupToRestore}`,
      };
    }

    const backupContent = await fs.promises.readFile(backupToRestore, 'utf-8');
    await fs.promises.writeFile(resolvedTarget, backupContent, 'utf-8');

    return {
      success: true,
      message: `Successfully rolled back ${path.basename(resolvedTarget)} using ${path.basename(backupToRestore)}`,
    };
  }
}

export const workspacePatcherService = new WorkspacePatcherService();

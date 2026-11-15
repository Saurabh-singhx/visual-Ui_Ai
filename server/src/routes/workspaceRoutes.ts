import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { workspacePatcherService } from '../services/workspacePatcherService';
import { propSynthesisService } from '../services/propSynthesisService';

const router = Router();

// ==========================================
// Canvas State for Agent-Decided Rendering (R2)
// ==========================================

interface CanvasState {
  activeComponent: {
    name: string;
    filePath: string;
    code: string;
    rawCode?: string;
    props: Record<string, any>;
    isVirtual: boolean;
    viewport?: { width: number; height: number };
  } | null;
  timestamp: number;
}

let activeCanvasState: CanvasState = {
  activeComponent: null,
  timestamp: Date.now(),
};

// ==========================================
// SSE Broadcasting System
// ==========================================

export const sseClients = new Set<Response>();

export function broadcastCanvasUpdate(payload: any): void {
  const data = JSON.stringify(payload);
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function handleCanvasEvents(req: Request, res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  // Send initial event
  const initialPayload = {
    type: 'canvas_init',
    activeComponent: activeCanvasState.activeComponent,
    timestamp: activeCanvasState.timestamp,
  };
  res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
}

// Support process.env.FOCUS_FILE on startup
export function initFocusFile(): void {
  const focusFile = process.env.FOCUS_FILE;
  if (!focusFile) return;

  try {
    const fullPath = path.isAbsolute(focusFile)
      ? focusFile
      : path.resolve(process.env.WORKSPACE_DIR || process.cwd(), focusFile);

    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        const targetCode = fs.readFileSync(fullPath, 'utf8');
        const resolvedName = path.basename(fullPath).replace(/\.[^.]+$/, '');
        const synthesizedProps = propSynthesisService.synthesizeProps(targetCode, undefined, resolvedName);
        const adaptedCode = propSynthesisService.adaptImports(targetCode);

        activeCanvasState = {
          activeComponent: {
            name: resolvedName,
            filePath: fullPath,
            code: adaptedCode,
            rawCode: targetCode,
            props: synthesizedProps,
            isVirtual: false,
            viewport: { width: 1200, height: 750 },
          },
          timestamp: Date.now(),
        };
      }
    }
  } catch (err: any) {
    console.warn(`[FOCUS_FILE] Failed to initialize focus file "${focusFile}":`, err.message);
  }
}

// Initialize on startup
initFocusFile();

// ==========================================
// Continuous Visual UI Bridge (Skill IPC)
// ==========================================

export function getFeedbackPaths() {
  const workspaceDir = process.env.WORKSPACE_DIR || process.cwd();
  const feedbackDir = path.resolve(workspaceDir, '.ui-feedback');
  const queueDir = path.join(feedbackDir, 'queue');
  const sessionLockFile = path.join(feedbackDir, 'session.lock');
  return { feedbackDir, queueDir, sessionLockFile };
}

export function initBridgeSession(): void {
  try {
    const { queueDir, sessionLockFile } = getFeedbackPaths();
    fs.mkdirSync(queueDir, { recursive: true });
    fs.writeFileSync(
      sessionLockFile,
      JSON.stringify({ active: true, pid: process.pid, timestamp: Date.now() }, null, 2),
      'utf8'
    );
  } catch (err: any) {
    console.warn(`[BRIDGE] Failed to initialize session lock: ${err.message}`);
  }
}

// Initialize session lock on startup
initBridgeSession();

export async function handleBridgeSelect(req: Request, res: Response) {
  try {
    const { queueDir, sessionLockFile } = getFeedbackPaths();
    if (!fs.existsSync(queueDir)) {
      fs.mkdirSync(queueDir, { recursive: true });
    }

    let payload = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {}
    }
    if (!payload || typeof payload !== 'object') {
      payload = {};
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tmpPath = path.join(queueDir, `${id}.tmp`);
    const finalPath = path.join(queueDir, `${id}.json`);

    // Atomic write: write to .tmp then rename to .json
    await fs.promises.writeFile(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
    await fs.promises.rename(tmpPath, finalPath);

    if (payload.status === 'done') {
      if (fs.existsSync(sessionLockFile)) {
        try {
          fs.unlinkSync(sessionLockFile);
        } catch {}
      }
    } else {
      if (!fs.existsSync(sessionLockFile)) {
        fs.writeFileSync(
          sessionLockFile,
          JSON.stringify({ active: true, pid: process.pid, timestamp: Date.now() }, null, 2),
          'utf8'
        );
      }
    }

    res.json({
      success: true,
      ok: true,
      id,
      queuedId: id,
      status: payload.status || 'pending',
    });
  } catch (err: any) {
    res.status(400).json({ ok: false, success: false, error: err.message });
  }
}

export function handleBridgeStatus(req: Request, res: Response) {
  try {
    const { queueDir, sessionLockFile } = getFeedbackPaths();
    const lockActive = fs.existsSync(sessionLockFile);
    let lockData: any = null;
    if (lockActive) {
      try {
        lockData = JSON.parse(fs.readFileSync(sessionLockFile, 'utf8'));
      } catch {}
    }

    let queuedFiles: string[] = [];
    if (fs.existsSync(queueDir)) {
      queuedFiles = fs.readdirSync(queueDir).filter((f) => f.endsWith('.json'));
    }

    res.json({
      success: true,
      ok: true,
      sessionActive: lockActive,
      active: lockActive,
      sessionLock: lockActive,
      pendingCount: queuedFiles.length,
      queue: queuedFiles,
      lockInfo: lockData,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

async function handleCanvasRender(req: Request, res: Response) {
  try {
    const { filePath, componentName, code, props, viewport } = req.body;

    let targetCode = code;
    let resolvedFilePath = filePath || '';
    let resolvedName = componentName || '';

    if (!targetCode && resolvedFilePath) {
      const fullPath = path.isAbsolute(resolvedFilePath)
        ? resolvedFilePath
        : path.resolve(process.env.WORKSPACE_DIR || process.cwd(), resolvedFilePath);

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ success: false, error: `Component file not found: ${resolvedFilePath}` });
      }
      targetCode = await fs.promises.readFile(fullPath, 'utf8');
      resolvedFilePath = fullPath;
    }

    if (!targetCode) {
      return res.status(400).json({ success: false, error: 'Either filePath or code must be provided' });
    }

    if (!resolvedName) {
      if (resolvedFilePath) {
        resolvedName = path.basename(resolvedFilePath).replace(/\.[^.]+$/, '');
      } else {
        const match = targetCode.match(/(?:export\s+(?:default\s+)?(?:const|function|class)\s+|function\s+)([A-Z][A-Za-z0-9_]*)/);
        resolvedName = match ? match[1] : 'ActiveComponent';
      }
    }

    const synthesizedProps = propSynthesisService.synthesizeProps(targetCode, props, resolvedName);
    const adaptedCode = propSynthesisService.adaptImports(targetCode);

    activeCanvasState = {
      activeComponent: {
        name: resolvedName,
        filePath: resolvedFilePath,
        code: adaptedCode,
        rawCode: targetCode,
        props: synthesizedProps,
        isVirtual: !resolvedFilePath,
        viewport: viewport || { width: 1200, height: 750 },
      },
      timestamp: Date.now(),
    };

    // Broadcast canvas updates to SSE subscribers
    broadcastCanvasUpdate({
      type: 'canvas_render',
      activeComponent: activeCanvasState.activeComponent,
      synthesizedProps,
      timestamp: activeCanvasState.timestamp,
    });

    res.json({
      success: true,
      activeComponent: activeCanvasState.activeComponent,
      synthesizedProps,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function handleCanvasState(req: Request, res: Response) {
  res.json({
    success: true,
    activeComponent: activeCanvasState.activeComponent,
    timestamp: activeCanvasState.timestamp,
  });
}

// ==========================================
// Handlers for M1 Discovery Engine Endpoints
// ==========================================

async function handleProjectScan(req: Request, res: Response) {
  try {
    const { dir, focus, platform, include, exclude } = req.body;
    const targetDir = dir || process.env.WORKSPACE_DIR || workspacePatcherService.getDefaultSampleWorkspace();
    const result = await workspacePatcherService.scanProjectMetadata(targetDir, {
      focus,
      platform,
      include,
      exclude,
    });
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('does not exist') || err.message?.includes('not a directory')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
}

async function handleComponentGet(req: Request, res: Response) {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }
    workspacePatcherService.assertWithinWorkspace(filePath);
    const result = await workspacePatcherService.getComponentDetails(filePath);
    res.json(result);
  } catch (err: any) {
    if (
      err.status === 403 ||
      err.code === 'EACCES' ||
      err.message?.includes('outside') ||
      err.message?.includes('traversal') ||
      err.message?.includes('Access denied')
    ) {
      return res.status(403).json({ error: err.message });
    }
    if (err.message?.includes('not found') || err.message?.includes('does not exist') || err.code === 'ENOENT') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
}

async function handleComponentModify(req: Request, res: Response) {
  try {
    const { filePath, elementId, prompt } = req.body;
    if (!filePath || !prompt) {
      return res.status(400).json({ success: false, error: 'filePath and prompt are required' });
    }
    workspacePatcherService.assertWithinWorkspace(filePath);
    const result = await workspacePatcherService.applyAiModification(filePath, prompt, elementId);
    if (!result.success) {
      if (
        result.error?.includes('outside') ||
        result.error?.includes('traversal') ||
        result.error?.includes('Access denied')
      ) {
        return res.status(403).json(result);
      }
      if (result.error?.includes('not found') || result.error?.includes('does not exist')) {
        return res.status(404).json(result);
      }
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    if (
      err.status === 403 ||
      err.code === 'EACCES' ||
      err.message?.includes('outside') ||
      err.message?.includes('traversal') ||
      err.message?.includes('Access denied')
    ) {
      return res.status(403).json({ success: false, error: err.message });
    }
    if (err.message?.includes('not found') || err.message?.includes('does not exist') || err.code === 'ENOENT') {
      return res.status(404).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
}

async function handleComponentRollback(req: Request, res: Response) {
  try {
    const { filePath, backupPath } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'filePath is required' });
    }
    workspacePatcherService.assertWithinWorkspace(filePath);
    if (backupPath) {
      workspacePatcherService.assertWithinWorkspace(backupPath);
    }
    const result = await workspacePatcherService.rollbackComponent(filePath, backupPath);
    if (!result.success) {
      if (
        result.error?.includes('outside') ||
        result.error?.includes('traversal') ||
        result.error?.includes('Access denied')
      ) {
        return res.status(403).json(result);
      }
      if (result.error?.includes('Target file not found')) {
        return res.status(404).json(result);
      }
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    if (
      err.status === 403 ||
      err.code === 'EACCES' ||
      err.message?.includes('outside') ||
      err.message?.includes('traversal') ||
      err.message?.includes('Access denied')
    ) {
      return res.status(403).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
}

// Legacy Workspace Handlers
async function handleWorkspaceScan(req: Request, res: Response) {
  try {
    const { dirPath } = req.body;
    if (!dirPath) {
      return res.status(400).json({ success: false, error: 'dirPath is required' });
    }
    const files = await workspacePatcherService.scanDirectory(dirPath);
    res.json({ success: true, files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function handleWorkspaceRollback(req: Request, res: Response) {
  try {
    const { filePath, backupPath } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'filePath is required' });
    }
    const result = await workspacePatcherService.rollbackFile(filePath, backupPath);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ==========================================
// Route Registrations
// ==========================================

// 1. M1 Contract Routes
router.post('/project/scan', handleProjectScan);
router.post('/component/get', handleComponentGet);
router.post('/component/modify', handleComponentModify);
router.post('/component/rollback', handleComponentRollback);

// Aliases for sub-router mounting (e.g. app.use('/api/project', ...), app.use('/api/component', ...))
router.post('/get', handleComponentGet);
router.post('/modify', handleComponentModify);

// 2. Legacy / Compatibility Routes
router.get(['/info', '/workspace/info'], (req: Request, res: Response) => {
  try {
    const sampleWorkspace = process.env.WORKSPACE_DIR || workspacePatcherService.getDefaultSampleWorkspace();
    const skillMode = process.env.SKILL_MODE === 'true' || process.env.VISUAL_UI_SKILL === 'true';
    const targetDevice = process.env.TARGET_DEVICE || undefined;
    const targetPlatform = process.env.TARGET_PLATFORM || undefined;
    const projectContext = workspacePatcherService.detectWorkspaceProjectContext(sampleWorkspace);

    res.json({
      success: true,
      platform: process.platform,
      sampleWorkspacePath: sampleWorkspace,
      workspaceDir: process.env.WORKSPACE_DIR || undefined,
      focusFile: process.env.FOCUS_FILE || undefined,
      skillMode,
      targetDevice,
      targetPlatform,
      detectedPlatform: projectContext.detectedPlatform,
      detectedFramework: projectContext.detectedFramework,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post(['/scan', '/workspace/scan'], (req: Request, res: Response) => {
  if (
    req.originalUrl.includes('/project') ||
    req.baseUrl.includes('/project') ||
    ('dir' in req.body && !('dirPath' in req.body))
  ) {
    return handleProjectScan(req, res);
  }
  return handleWorkspaceScan(req, res);
});

router.post(['/app', '/workspace/app'], async (req: Request, res: Response) => {
  try {
    const { dirPath } = req.body;
    if (!dirPath) {
      return res.status(400).json({ success: false, error: 'dirPath is required' });
    }
    const app = await workspacePatcherService.getWorkspaceApp(dirPath);
    res.json({ success: true, app });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post(['/search', '/workspace/search'], async (req: Request, res: Response) => {
  try {
    const { dirPath, text, className, tagName } = req.body;
    if (!dirPath) {
      return res.status(400).json({ success: false, error: 'dirPath is required' });
    }
    const matches = await workspacePatcherService.searchComponent(dirPath, { text, className, tagName });
    res.json({ success: true, matches });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post(['/read', '/workspace/read'], async (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'filePath is required' });
    }
    const content = await workspacePatcherService.readFile(filePath);
    res.json({ success: true, content });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message });
  }
});

router.post(['/apply-patch', '/workspace/apply-patch'], async (req: Request, res: Response) => {
  try {
    const { filePath, oldCode, newCode, createBackup } = req.body;
    if (!filePath || !newCode) {
      return res.status(400).json({ success: false, error: 'filePath and newCode are required' });
    }

    const result = await workspacePatcherService.applyPatch(
      filePath,
      oldCode || '',
      newCode,
      createBackup !== false
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post(['/rollback', '/workspace/rollback'], (req: Request, res: Response) => {
  if (req.originalUrl.includes('/component') || req.baseUrl.includes('/component')) {
    return handleComponentRollback(req, res);
  }
  return handleWorkspaceRollback(req, res);
});

// 3. Canvas State & SSE Endpoints (R2)
router.post(['/canvas/render', '/render'], handleCanvasRender);
router.get(['/canvas/state', '/state'], handleCanvasState);
router.get(['/canvas/events', '/events'], handleCanvasEvents);

// 4. Continuous Visual UI Bridge Endpoints
router.post(['/bridge/select', '/__agy_ui_bridge/select'], handleBridgeSelect);
router.get(['/bridge/status', '/__agy_ui_bridge/status'], handleBridgeStatus);

export default router;

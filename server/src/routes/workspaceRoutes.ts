import { Router, Request, Response } from 'express';
import { workspacePatcherService } from '../services/workspacePatcherService';

const router = Router();

// ==========================================
// Handlers for M1 Discovery Engine Endpoints
// ==========================================

async function handleProjectScan(req: Request, res: Response) {
  try {
    const { dir, focus, platform, include, exclude } = req.body;
    const targetDir = dir || workspacePatcherService.getDefaultSampleWorkspace();
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
    const result = await workspacePatcherService.getComponentDetails(filePath);
    res.json(result);
  } catch (err: any) {
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
    const result = await workspacePatcherService.applyAiModification(filePath, prompt, elementId);
    if (!result.success) {
      if (result.error?.includes('not found') || result.error?.includes('does not exist')) {
        return res.status(404).json(result);
      }
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
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
    const result = await workspacePatcherService.rollbackComponent(filePath, backupPath);
    if (!result.success) {
      if (result.error?.includes('Target file not found')) {
        return res.status(404).json(result);
      }
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
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
    const sampleWorkspace = workspacePatcherService.getDefaultSampleWorkspace();
    res.json({
      success: true,
      platform: process.platform,
      sampleWorkspacePath: sampleWorkspace,
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

export default router;

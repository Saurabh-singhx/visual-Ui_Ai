import { Router, Request, Response } from 'express';
import { workspacePatcherService } from '../services/workspacePatcherService';

const router = Router();

// Scan directory for component files
router.post('/scan', async (req: Request, res: Response) => {
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
});

// Search for matching component
router.post('/search', async (req: Request, res: Response) => {
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

// Read file content
router.post('/read', async (req: Request, res: Response) => {
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

// Apply patch to file
router.post('/apply-patch', async (req: Request, res: Response) => {
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

// Rollback file from backup
router.post('/rollback', async (req: Request, res: Response) => {
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
});

export default router;

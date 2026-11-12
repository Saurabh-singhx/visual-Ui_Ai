import { Router, Request, Response } from 'express';
import { adbService } from '../services/adbService';

const router = Router();

// Get connected devices
router.get('/devices', async (req: Request, res: Response) => {
  try {
    const devices = await adbService.getDevices();
    res.json({
      success: true,
      devices,
      adbAvailable: true,
      hasConnectedDevice: devices.length > 0,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, devices: [] });
  }
});

// Capture device screen
router.post('/capture', async (req: Request, res: Response) => {
  try {
    const { deviceId, useSample } = req.body;
    if (useSample) {
      return res.json({
        success: true,
        isSample: true,
        message: 'Loaded sample mobile device screen',
      });
    }

    const result = await adbService.captureScreen(deviceId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dump hierarchy nodes
router.post('/hierarchy', async (req: Request, res: Response) => {
  try {
    const { deviceId, useSample } = req.body;
    if (useSample) {
      const sampleNodes = adbService.getSampleMobileHierarchy();
      return res.json({
        success: true,
        isSample: true,
        nodes: sampleNodes,
      });
    }

    const result = await adbService.dumpHierarchy(deviceId);
    if (!result.success) {
      // If hardware dump fails, gracefully offer sample nodes so UI remains interactive
      const sampleNodes = adbService.getSampleMobileHierarchy();
      return res.json({
        success: true,
        isSample: true,
        warning: result.error,
        nodes: sampleNodes,
      });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

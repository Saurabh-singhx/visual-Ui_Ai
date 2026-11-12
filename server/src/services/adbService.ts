import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import { AdbDevice, AdbHierarchyNode } from '../types';

const execPromise = util.promisify(exec);

export class AdbService {
  private adbPath: string;

  constructor() {
    const candidatePaths = [
      process.env.ADB_PATH,
      '/home/saurabh/Android/Sdk/platform-tools/adb',
      'adb',
    ].filter(Boolean) as string[];

    let found = 'adb';
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        found = p;
        break;
      }
    }
    this.adbPath = found;
  }

  /**
   * Lists all connected Android devices or emulators
   */
  async getDevices(): Promise<AdbDevice[]> {
    try {
      const { stdout } = await execPromise(`"${this.adbPath}" devices -l`);
      const lines = stdout.trim().split('\n').slice(1);
      const devices: AdbDevice[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          const id = parts[0];
          const state = parts[1] as 'device' | 'offline' | 'unauthorized';
          const modelMatch = trimmed.match(/model:(\S+)/);
          const model = modelMatch ? modelMatch[1] : id;

          devices.push({
            id,
            model,
            state,
            isEmulator: id.startsWith('emulator-'),
          });
        }
      }
      return devices;
    } catch (err: any) {
      console.warn('ADB check failed or adb not running:', err.message);
      return [];
    }
  }

  /**
   * Captures the screen of the target device as a base64 PNG
   */
  async captureScreen(deviceId?: string): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
    try {
      const deviceArg = deviceId ? `-s "${deviceId}"` : '';
      const { stdout } = await execPromise(`"${this.adbPath}" ${deviceArg} exec-out screencap -p`, {
        encoding: 'buffer',
        maxBuffer: 10 * 1024 * 1024,
      });

      const base64 = (stdout as unknown as Buffer).toString('base64');
      return {
        success: true,
        imageBase64: `data:image/png;base64,${base64}`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to capture screen: ${err.message}`,
      };
    }
  }

  /**
   * Dumps UIAutomator XML hierarchy and parses it into structured bounding boxes
   */
  async dumpHierarchy(deviceId?: string): Promise<{
    success: boolean;
    nodes?: AdbHierarchyNode[];
    xml?: string;
    error?: string;
  }> {
    try {
      const deviceArg = deviceId ? `-s "${deviceId}"` : '';
      const { stdout } = await execPromise(`"${this.adbPath}" ${deviceArg} exec-out uiautomator dump /dev/tty`);

      if (!stdout || !stdout.includes('<hierarchy')) {
        return {
          success: false,
          error: 'UIAutomator dump returned empty hierarchy. Device might be locked or unsupported.',
        };
      }

      const nodes = this.parseUiAutomatorXml(stdout);
      return {
        success: true,
        nodes,
        xml: stdout,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `ADB UIAutomator dump failed: ${err.message}`,
      };
    }
  }

  /**
   * Parses XML bounds format [x1,y1][x2,y2] into numeric bounding box
   */
  private parseBounds(boundsStr?: string) {
    if (!boundsStr) return { x: 0, y: 0, x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 };
    const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!match) return { x: 0, y: 0, x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 };

    const x1 = parseInt(match[1], 10);
    const y1 = parseInt(match[2], 10);
    const x2 = parseInt(match[3], 10);
    const y2 = parseInt(match[4], 10);

    return {
      x: x1,
      y: y1,
      x1,
      y1,
      x2,
      y2,
      width: Math.max(0, x2 - x1),
      height: Math.max(0, y2 - y1),
    };
  }

  /**
   * Parses UIAutomator node elements using regex for speed and zero external dependencies
   */
  private parseUiAutomatorXml(xml: string): AdbHierarchyNode[] {
    const nodes: AdbHierarchyNode[] = [];
    const nodeRegex = /<node\s+([^>]+)>/g;
    let match;
    let counter = 0;

    while ((match = nodeRegex.exec(xml)) !== null) {
      const attrsStr = match[1];
      const getAttr = (name: string) => {
        const m = attrsStr.match(new RegExp(`${name}="([^"]*)"`));
        return m ? m[1] : undefined;
      };

      const className = getAttr('class') || 'android.view.View';
      const resourceId = getAttr('resource-id');
      const text = getAttr('text');
      const contentDesc = getAttr('content-desc');
      const clickable = getAttr('clickable') === 'true';
      const focusable = getAttr('focusable') === 'true';
      const boundsStr = getAttr('bounds');
      const bounds = this.parseBounds(boundsStr);

      // Filter out root containers with 0 width or height
      if (bounds.width > 0 && bounds.height > 0) {
        nodes.push({
          id: `node-${counter++}`,
          className,
          resourceId,
          text,
          contentDesc,
          bounds,
          clickable,
          focusable,
          children: [],
        });
      }
    }

    return nodes;
  }

  /**
   * Provides sample mobile hierarchy and components when no physical Android device is connected
   */
  getSampleMobileHierarchy(): AdbHierarchyNode[] {
    return [
      {
        id: 'node-header',
        className: 'android.widget.Toolbar',
        resourceId: 'com.app:id/top_toolbar',
        text: 'Dashboard',
        bounds: { x: 0, y: 48, x1: 0, y1: 48, x2: 1080, y2: 200, width: 1080, height: 152 },
        clickable: false,
        focusable: false,
        children: [],
      },
      {
        id: 'node-card-1',
        className: 'androidx.cardview.widget.CardView',
        resourceId: 'com.app:id/metric_card',
        text: 'Total Revenue: $24,500',
        bounds: { x: 40, y: 240, x1: 40, y1: 240, x2: 1040, y2: 600, width: 1000, height: 360 },
        clickable: true,
        focusable: true,
        children: [],
      },
      {
        id: 'node-btn-action',
        className: 'android.widget.Button',
        resourceId: 'com.app:id/btn_action',
        text: 'Upgrade Plan',
        bounds: { x: 80, y: 460, x1: 80, y1: 460, x2: 480, y2: 560, width: 400, height: 100 },
        clickable: true,
        focusable: true,
        children: [],
      },
      {
        id: 'node-nav-bar',
        className: 'com.google.android.material.bottomnavigation.BottomNavigationView',
        resourceId: 'com.app:id/bottom_nav',
        bounds: { x: 0, y: 1980, x1: 0, y1: 1980, x2: 1080, y2: 2160, width: 1080, height: 180 },
        clickable: true,
        focusable: true,
        children: [],
      },
    ];
  }
}

export const adbService = new AdbService();

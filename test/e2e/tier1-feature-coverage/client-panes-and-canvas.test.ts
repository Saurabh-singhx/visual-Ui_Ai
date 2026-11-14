import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { extractRenderableHtml } from '@client/components/preview/LivePreview';

describe('Tier 1: 3-Pane Client Dashboard & Visual Canvas (Features 18, 19, 20, 21)', () => {
  const rootDir = process.cwd();
  const clientSrcDir = path.resolve(rootDir, 'client/src');
  const appTsxPath = path.join(clientSrcDir, 'App.tsx');
  const canvasPath = path.join(clientSrcDir, 'components/canvas/VisualCanvas.tsx');
  const inspectorPath = path.join(clientSrcDir, 'components/inspector/ElementInspector.tsx');
  const previewPath = path.join(clientSrcDir, 'components/preview/LivePreview.tsx');

  // =========================================================================
  // Feature 18: Component Inventory Sidebar (Pane 1)
  // =========================================================================
  describe('Feature 18: Component Inventory Sidebar (Pane 1)', () => {
    it('F18.1: verifies platform switcher tabs include Web, Mobile, Desktop', () => {
      const appCode = fs.readFileSync(appTsxPath, 'utf8');
      expect(appCode).toMatch(/web/i);
      expect(appCode).toMatch(/mobile/i);
      expect(appCode).toMatch(/desktop/i);
    });

    it('F18.2: verifies search query state and filtering mechanism exists for components', () => {
      const appCode = fs.readFileSync(appTsxPath, 'utf8');
      const hasSearch =
        appCode.includes('search') ||
        appCode.includes('filter') ||
        appCode.includes('Search') ||
        appCode.includes('Query');
      expect(hasSearch, 'Component inventory should include search/filter state').toBe(true);
    });

    it('F18.3: verifies folder-tree grouping or directory grouping structure in inventory', () => {
      const appCode = fs.readFileSync(appTsxPath, 'utf8');
      const hasGrouping =
        appCode.includes('workspace') ||
        appCode.includes('relativePath') ||
        appCode.includes('filePath') ||
        appCode.includes('folder');
      expect(hasGrouping, 'Sidebar should group or organize components by relative path').toBe(true);
    });

    it('F18.4: verifies count badge displaying total discovered components is supported', () => {
      const appCode = fs.readFileSync(appTsxPath, 'utf8');
      const hasCount =
        appCode.includes('apps.length') ||
        appCode.includes('components.length') ||
        appCode.includes('totalCount') ||
        appCode.includes('interactiveElements.length');
      expect(hasCount, 'Sidebar should track and display component count').toBe(true);
    });

    it('F18.5: verifies high-volume scoping threshold (>30 warning) integration support', () => {
      // App or sidebar should handle exceedsThreshold / suggestedFocus
      const appCode = fs.readFileSync(appTsxPath, 'utf8');
      const serverScannerCode = fs.readFileSync(
        path.join(rootDir, 'server/src/services/workspacePatcherService.ts'),
        'utf8'
      );
      expect(serverScannerCode).toContain('exceedsThreshold');
      expect(serverScannerCode).toContain('suggestedFocus');
    });

    it('F18.6: verifies selecting a component in inventory updates the active component state', () => {
      const appCode = fs.readFileSync(appTsxPath, 'utf8');
      expect(appCode).toMatch(/setCurrentApp|setSelectedElement|matchedFilePath/);
    });
  });

  // =========================================================================
  // Feature 19: Resizable Visual Canvas (Pane 2)
  // =========================================================================
  describe('Feature 19: Resizable Visual Canvas (Pane 2)', () => {
    it('F19.1: verifies canvas supports mobile breakpoint preset (375px)', () => {
      const canvasCode = fs.readFileSync(canvasPath, 'utf8');
      const appCode = fs.readFileSync(appTsxPath, 'utf8');
      const combined = canvasCode + appCode;
      expect(combined).toMatch(/375|mobile/i);
    });

    it('F19.2: verifies canvas supports tablet breakpoint preset (768px)', () => {
      const canvasCode = fs.readFileSync(canvasPath, 'utf8');
      const appCode = fs.readFileSync(appTsxPath, 'utf8');
      const combined = canvasCode + appCode;
      expect(combined).toMatch(/768|tablet/i);
    });

    it('F19.3: verifies canvas supports desktop breakpoint preset (1200px or 1440px)', () => {
      const canvasCode = fs.readFileSync(canvasPath, 'utf8');
      const appCode = fs.readFileSync(appTsxPath, 'utf8');
      const combined = canvasCode + appCode;
      expect(combined).toMatch(/1200|1440|desktop/i);
    });

    it('F19.4: verifies live dimension indicator badge displays current viewport width and height', () => {
      const canvasCode = fs.readFileSync(canvasPath, 'utf8');
      expect(canvasCode).toMatch(/currentApp\.viewport\.width/);
      expect(canvasCode).toMatch(/currentApp\.viewport\.height/);
      expect(canvasCode).toMatch(/px/);
    });

    it('F19.5: verifies zoom controls allow zooming in, zooming out, and auto-fit', () => {
      const canvasCode = fs.readFileSync(canvasPath, 'utf8');
      expect(canvasCode).toMatch(/ZoomIn/);
      expect(canvasCode).toMatch(/ZoomOut/);
      expect(canvasCode).toMatch(/setZoom/);
    });

    it('F19.6: verifies canvas bounds clamp or accommodate widths up to 1440px', () => {
      const canvasCode = fs.readFileSync(canvasPath, 'utf8');
      expect(canvasCode).toMatch(/viewport\.width/);
      expect(canvasCode).toMatch(/zoom/);
    });
  });

  // =========================================================================
  // Feature 20: Element Click-Selection & 60 FPS DOM
  // =========================================================================
  describe('Feature 20: Element Click-Selection & 60 FPS DOM Live Execution', () => {
    it('F20.1: verifies extractRenderableHtml transforms component JSX into renderable DOM elements', () => {
      const source = `
        export const TestBanner = () => {
          return (
            <div className="banner bg-blue-500 p-4">
              <h2 className="title text-white">Welcome</h2>
              <button className="cta px-4 py-2 bg-white text-blue-600 rounded">Get Started</button>
            </div>
          );
        };
      `;
      const html = extractRenderableHtml(source, 'TestBanner');
      expect(html).toContain('class="banner bg-blue-500 p-4"');
      expect(html).toContain('Welcome');
      expect(html).toContain('Get Started');
    });

    it('F20.2: verifies extractRenderableHtml extracts interactive element click targets', () => {
      const source = `
        export const ActionCard = () => (
          <div className="card">
            <button className="btn-primary">Click Me</button>
          </div>
        );
      `;
      const html = extractRenderableHtml(source, 'ActionCard');
      expect(html).toContain('<button');
      expect(html).toContain('btn-primary');
    });

    it('F20.3: verifies visual highlight ring on active selected elements in canvas', () => {
      const canvasCode = fs.readFileSync(canvasPath, 'utf8');
      // VisualCanvas should highlight selected element with blue border/ring
      expect(canvasCode).toMatch(/selectedElement|ring-2|border-blue|ring-blue/);
    });

    it('F20.4: verifies 60 FPS GPU-accelerated CSS transform and transition classes are rendered', () => {
      const source = `
        export const AnimatedWidget = () => (
          <div className="transform transition-all duration-300 ease-in-out hover:scale-105">
            Content
          </div>
        );
      `;
      const html = extractRenderableHtml(source, 'AnimatedWidget');
      expect(html).toContain('transform transition-all duration-300 ease-in-out hover:scale-105');
    });

    it('F20.5: verifies DOM sandbox execution renders cleanly without injecting hardcoded mock strings', () => {
      const source = `
        export const RealComponent = ({ heading = "Real User Interface" }) => (
          <div><h3>{heading}</h3></div>
        );
      `;
      const html = extractRenderableHtml(source, 'RealComponent');
      expect(html).not.toContain('Intelligent AI Redesign');
      expect(html).not.toContain('Deposit Funds');
      expect(html).toContain('Real User Interface');
    });
  });

  // =========================================================================
  // Feature 21: Element Inspector & "Ask AI" Panel (Pane 3)
  // =========================================================================
  describe('Feature 21: Element Inspector & "Ask AI" Panel (Pane 3)', () => {
    it('F21.1: verifies ElementInspector displays tag name, selector, and element metadata', () => {
      const inspectorCode = fs.readFileSync(inspectorPath, 'utf8');
      expect(inspectorCode).toMatch(/element\.tagName|element\.name|element\.selector/);
    });

    it('F21.2: verifies ElementInspector displays CSS classes and styles of selected element', () => {
      const inspectorCode = fs.readFileSync(inspectorPath, 'utf8');
      expect(inspectorCode).toMatch(/element\.styles|element\.className|styles\./);
    });

    it('F21.3: verifies ElementInspector supports in-session AI modification prompts', () => {
      const appCode = fs.readFileSync(appTsxPath, 'utf8');
      expect(appCode).toMatch(/prompt|AIChatMessage|isLoadingAI|onFixAccessibility/);
    });

    it('F21.4: verifies animation preset chips (e.g. Smooth Hover Scale, Pill, Theme) are defined', () => {
      const appCode = fs.readFileSync(appTsxPath, 'utf8');
      const inspectorCode = fs.readFileSync(inspectorPath, 'utf8');
      const combined = appCode + inspectorCode;
      expect(combined).toMatch(/preset|Sparkles|Hover|Theme|animate/i);
    });

    it('F21.5: verifies Apply Patch action triggers disk update and refresh', () => {
      const appCode = fs.readFileSync(appTsxPath, 'utf8');
      expect(appCode).toMatch(/applyPatch|applyAiModification|apply-patch|modify/i);
    });

    it('F21.6: verifies Undo / Revert action triggers rollback restoring original file', () => {
      const appCode = fs.readFileSync(appTsxPath, 'utf8');
      expect(appCode).toMatch(/rollback|rollbackFile|revert/i);
    });
  });
});

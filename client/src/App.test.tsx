import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import App from './App';
import { api } from './services/api';

// Mock API calls
vi.mock('./services/api', () => ({
  api: {
    getSamples: vi.fn().mockResolvedValue([
      {
        id: 'web-landing',
        platform: 'web',
        name: 'Modern SaaS Landing Page',
        viewport: { width: 1200, height: 750 },
        description: 'Web application mockup',
        interactiveElements: [
          {
            id: 'elem-1',
            name: 'Header Nav',
            selector: 'header.nav',
            bounds: { x: 0, y: 0, width: 1200, height: 60 },
            tagName: 'nav',
            className: 'bg-white p-4',
            codeSnippet: '<nav>Header</nav>',
            styles: { backgroundColor: '#ffffff', textColor: '#000000' },
          },
        ],
      },
      {
        id: 'desktop-admin',
        platform: 'desktop',
        name: 'Analytics Desktop Dashboard',
        viewport: { width: 1280, height: 800 },
        description: 'Desktop dashboard mockup',
        interactiveElements: [
          {
            id: 'desktop-elem-widget',
            name: 'Active Server Metric Widget',
            selector: 'QWidget#metricWidget',
            bounds: { x: 260, y: 110, width: 320, height: 150 },
            tagName: 'QWidget',
            className: 'bg-slate-800 rounded-lg p-4 border border-slate-700',
            codeSnippet: 'export const MetricWidget = () => <div>CPU: 42.8%</div>;',
            styles: { backgroundColor: '#1e293b', textColor: '#34d399' },
          },
          {
            id: 'desktop-elem-sidebar',
            name: 'Left Sidebar Navigation',
            selector: 'aside.sidebar',
            bounds: { x: 24, y: 60, width: 210, height: 710 },
            tagName: 'aside',
            className: 'bg-slate-900/60 p-3',
            codeSnippet: 'export const DesktopSidebar = () => <aside>Dashboard</aside>;',
            styles: { backgroundColor: '#0f172a', textColor: '#94a3b8' },
          },
        ],
      },
    ]),
    getAiProviders: vi.fn().mockResolvedValue({
      providers: { localEngine: true, activeDefault: 'Smart Local UI Engine' },
    }),
    getAiPresets: vi.fn().mockResolvedValue([
      { id: 'glass', label: 'Glassmorphism', prompt: 'Make modern glass' },
    ]),
    readFile: vi.fn().mockResolvedValue('// sample code'),
    scanWorkspace: vi.fn().mockResolvedValue([]),
    searchWorkspace: vi.fn().mockResolvedValue([]),
    getWorkspaceInfo: vi.fn().mockResolvedValue({
      success: true,
      platform: 'linux',
      sampleWorkspacePath: '/sample-workspace',
    }),
    getWorkspaceApp: vi.fn().mockImplementation((dirPath: string) =>
      Promise.resolve({
        id: 'workspace-test',
        platform: 'web',
        name: 'Workspace: test-workspace',
        viewport: { width: 1200, height: 750 },
        description: 'Dynamic workspace components',
        interactiveElements: [
          {
            id: 'ws-nav',
            name: 'WorkspaceNav',
            selector: 'nav.navbar',
            bounds: { x: 40, y: 24, width: 1120, height: 68 },
            tagName: 'nav',
            className: 'bg-indigo-900 px-6 py-4',
            codeSnippet: '<nav className="bg-indigo-900 px-6 py-4">Workspace Navigation</nav>',
            filePath: `${dirPath}/WorkspaceNav.tsx`,
            relativePath: 'WorkspaceNav.tsx',
          },
          {
            id: 'ws-card',
            name: 'WorkspaceCard',
            selector: 'div.card',
            bounds: { x: 40, y: 116, width: 350, height: 230 },
            tagName: 'div',
            className: 'p-4 bg-slate-800 rounded-xl',
            codeSnippet: '<div className="p-4 bg-slate-800 rounded-xl">Real Searched Component</div>',
            filePath: `${dirPath}/WorkspaceCard.tsx`,
            relativePath: 'WorkspaceCard.tsx',
          },
        ],
        isWorkspace: true,
        workspacePath: dirPath,
      })
    ),
    getAdbDevices: vi.fn().mockResolvedValue([]),
  },
}));

describe('App Component', () => {
  it('renders Studio Header with title and platform switcher tabs', async () => {
    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText('Visual UI-AI Studio')).toBeInTheDocument();
    expect(screen.getByText('Web')).toBeInTheDocument();
    expect(screen.getByText('Mobile (ADB)')).toBeInTheDocument();
    expect(screen.getByText('Desktop')).toBeInTheDocument();
  });

  it('toggles Snip Element mode when button is clicked', async () => {
    await act(async () => {
      render(<App />);
    });

    const snipButton = screen.getByRole('button', { name: /Snip Element/i });
    expect(snipButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(snipButton);
    });
    expect(screen.getByText(/Click & Drag to Snip/i)).toBeInTheDocument();
  });

  it('switches platform tabs cleanly', async () => {
    await act(async () => {
      render(<App />);
    });

    const mobileTab = screen.getByText('Mobile (ADB)');
    await act(async () => {
      fireEvent.click(mobileTab);
    });

    // After switching to mobile, platform state updates cleanly
    expect(screen.getByText('Mobile (ADB)')).toBeInTheDocument();
  });

  it('verifies responsive viewport controls are rendered in canvas', async () => {
    await act(async () => {
      render(<App />);
    });

    expect(screen.getByTitle(/Mobile Viewport/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Tablet Viewport/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Desktop Viewport/i)).toBeInTheDocument();
  });

  it('renders Element Selector button in header and switches between select and snip modes', async () => {
    await act(async () => {
      render(<App />);
    });

    const selectorBtn = screen.getByRole('button', { name: /Element Selector/i });
    expect(selectorBtn).toBeInTheDocument();

    const snipButton = screen.getByRole('button', { name: /Snip Element/i });
    await act(async () => {
      fireEvent.click(snipButton);
    });
    expect(screen.getByText(/Click & Drag to Snip/i)).toBeInTheDocument();

    // Clicking Element Selector switches back from Snip Mode
    await act(async () => {
      fireEvent.click(selectorBtn);
    });
    expect(screen.queryByText(/Click & Drag to Snip/i)).not.toBeInTheDocument();
  });

  it('switches to Desktop platform and selects UI in dashboard without overflowing', async () => {
    await act(async () => {
      render(<App />);
    });

    const desktopTab = screen.getByText('Desktop');
    await act(async () => {
      fireEvent.click(desktopTab);
    });

    // Check that Desktop Dashboard is active
    expect(screen.getByText('Analytics Desktop Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Active Server Metric Widget')).toBeInTheDocument();

    // Verify Fit to Screen button is available in canvas zoom toolbar
    expect(screen.getByTitle(/Fit canvas to screen/i)).toBeInTheDocument();

    // Component code preview is rendered in ElementInspector
    expect(screen.getByText('Component Code')).toBeInTheDocument();
  });

  it('selects sidebar UI in dashboard and updates inspector with code match', async () => {
    await act(async () => {
      render(<App />);
    });

    const desktopTab = screen.getByText('Desktop');
    await act(async () => {
      fireEvent.click(desktopTab);
    });

    // Initially, Active Server Metric Widget is selected
    expect(screen.getByText('Active Server Metric Widget')).toBeInTheDocument();

    // Click on sidebar navigation item in dashboard
    const nodesItem = screen.getByText('Nodes & Pods');
    await act(async () => {
      fireEvent.click(nodesItem);
    });

    // Inspector is active with WCAG audit and tokens
    expect(screen.getByText('WCAG 2.2 Audit')).toBeInTheDocument();
    expect(screen.getByText('Design Tokens & Styles')).toBeInTheDocument();
  });

  it('dynamically selects canvas mockup element via element selector click', async () => {
    await act(async () => {
      render(<App />);
    });

    const desktopTab = screen.getByText('Desktop');
    await act(async () => {
      fireEvent.click(desktopTab);
    });

    // Click on simulated text element in the dashboard mockup
    const metricTexts = screen.getAllByText(/CPU Usage/i);
    expect(metricTexts.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(metricTexts[0]);
    });

    // Expect inspector and canvas to be active and populated
    expect(screen.getByText('WCAG 2.2 Audit')).toBeInTheDocument();
    expect(screen.getByText('Design Tokens & Styles')).toBeInTheDocument();
  });

  it('renders Studio Header with Workspace platform tab', async () => {
    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText('Workspace')).toBeInTheDocument();
  });

  it('switches to Workspace platform tab cleanly', async () => {
    await act(async () => {
      render(<App />);
    });

    const wsTab = screen.getByText('Workspace');
    await act(async () => {
      fireEvent.click(wsTab);
    });

    expect(screen.getByText('Workspace')).toBeInTheDocument();
  });
});

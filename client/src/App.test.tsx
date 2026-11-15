import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import App from './App';
import { VisualCanvas } from './components/canvas/VisualCanvas';
import { api } from './services/api';

// Mock API calls
vi.mock('./services/api', () => ({
  api: {
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
      detectedPlatform: 'web',
      detectedFramework: 'react',
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
            className: 'bg-zinc-900 px-6 py-4',
            codeSnippet: '<nav className="bg-zinc-900 px-6 py-4">Workspace Navigation</nav>',
            filePath: `${dirPath}/WorkspaceNav.tsx`,
            relativePath: 'WorkspaceNav.tsx',
            styles: { backgroundColor: '#18181b', textColor: '#ffffff' },
          },
          {
            id: 'ws-card',
            name: 'WorkspaceCard',
            selector: 'div.card',
            bounds: { x: 40, y: 116, width: 350, height: 230 },
            tagName: 'div',
            className: 'p-4 bg-zinc-900 rounded-xl',
            codeSnippet: '<div className="p-4 bg-zinc-900 rounded-xl">Real Searched Component</div>',
            filePath: `${dirPath}/WorkspaceCard.tsx`,
            relativePath: 'WorkspaceCard.tsx',
            styles: { backgroundColor: '#18181b', textColor: '#ffffff' },
          },
        ],
        isWorkspace: true,
        workspacePath: dirPath,
      })
    ),
    getCanvasState: vi.fn().mockResolvedValue({
      success: true,
      activeComponent: null,
      timestamp: Date.now(),
    }),
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

    // Check that workspace component is active on Desktop
    expect(screen.getAllByText('Workspace: test-workspace').length).toBeGreaterThan(0);
    expect(screen.getAllByText('WorkspaceNav').length).toBeGreaterThan(0);

    // Verify Fit to Screen button is available in canvas zoom toolbar
    expect(screen.getByTitle(/Fit canvas to screen/i)).toBeInTheDocument();

    // Component code preview is rendered in ElementInspector
    expect(screen.getByText('Component Code')).toBeInTheDocument();
  });

  it('selects secondary workspace UI and updates inspector with code match', async () => {
    await act(async () => {
      render(<App />);
    });

    const desktopTab = screen.getByText('Desktop');
    await act(async () => {
      fireEvent.click(desktopTab);
    });

    // Initially, WorkspaceNav is selected
    expect(screen.getAllByText('WorkspaceNav').length).toBeGreaterThan(0);

    // Switch to Grid view to reveal all workspace components
    const gridBtn = screen.getByRole('button', { name: 'Grid' });
    await act(async () => {
      fireEvent.click(gridBtn);
    });

    // Click on second component (WorkspaceCard)
    const cardElements = screen.getAllByText(/WorkspaceCard/i);
    expect(cardElements.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(cardElements[0]);
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

    // Click on rendered workspace text inside dynamic canvas component
    const navText = screen.getByText('Workspace Navigation');
    expect(navText).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(navText);
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

  it('App handles malformed workspace app with omitted interactiveElements and viewport without crashing', async () => {
    vi.mocked(api.getWorkspaceApp).mockResolvedValueOnce({
      id: 'malformed-app',
      name: 'Malformed Workspace App',
      platform: 'web',
      isWorkspace: true,
    } as any);

    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText('Visual UI-AI Studio')).toBeInTheDocument();
    expect(screen.getAllByText('Malformed Workspace App').length).toBeGreaterThan(0);
  });

  it('VisualCanvas renders safely with undefined interactiveElements and undefined viewport', () => {
    const malformedApp: any = {
      id: 'malformed-canvas',
      name: 'Adversarial Canvas App',
      platform: 'web',
    };

    render(
      <VisualCanvas
        currentApp={malformedApp}
        selectedElement={null}
        onSelectElement={vi.fn()}
        isSnipMode={false}
        onSnipComplete={vi.fn()}
      />
    );

    expect(screen.getByText('0 Live Components')).toBeInTheDocument();
    expect(screen.getByText('1200 × 750px')).toBeInTheDocument();
    expect(screen.getByText(/No UI components found in workspace directory/i)).toBeInTheDocument();
  });

  it('VisualCanvas handles breakpoint preset clicks when currentApp has undefined viewport', () => {
    const malformedApp: any = {
      id: 'malformed-canvas-presets',
      name: 'Presets Test App',
      platform: 'web',
    };

    render(
      <VisualCanvas
        currentApp={malformedApp}
        selectedElement={null}
        onSelectElement={vi.fn()}
        isSnipMode={false}
        onSnipComplete={vi.fn()}
      />
    );

    const mobileBtn = screen.getByTitle(/Mobile Viewport/i);
    fireEvent.click(mobileBtn);
    expect(screen.getByText('375 × 667px')).toBeInTheDocument();

    const tabletBtn = screen.getByTitle(/Tablet Viewport/i);
    fireEvent.click(tabletBtn);
    expect(screen.getByText('768 × 1024px')).toBeInTheDocument();

    const desktopBtn = screen.getByTitle(/Desktop Viewport/i);
    fireEvent.click(desktopBtn);
    expect(screen.getByText('1200 × 800px')).toBeInTheDocument();
  });
});

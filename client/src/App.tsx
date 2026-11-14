import React, { useState, useEffect } from 'react';
import { Sparkles, Code2 } from 'lucide-react';
import { Header } from './components/layout/Header';
import { VisualCanvas } from './components/canvas/VisualCanvas';
import { ElementInspector } from './components/inspector/ElementInspector';
import { LivePreview } from './components/preview/LivePreview';
import { CodeEditor } from './components/editor/CodeEditor';
import { AIChatPanel } from './components/chat/AIChatPanel';
import { PatchReviewModal } from './components/workspace/PatchReviewModal';
import { api } from './services/api';
import {
  PlatformType,
  SampleApp,
  InteractiveElement,
  BoundingBox,
  AIChatMessage,
} from './types';

const DEFAULT_APPS: SampleApp[] = [
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
    id: 'mobile-crypto',
    platform: 'mobile',
    name: 'Crypto Portfolio App',
    viewport: { width: 375, height: 667 },
    description: 'Mobile application mockup',
    interactiveElements: [],
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
];

export const App: React.FC = () => {
  const [platform, setPlatform] = useState<PlatformType>('web');
  const [apps, setApps] = useState<SampleApp[]>(DEFAULT_APPS);
  const [currentApp, setCurrentApp] = useState<SampleApp | null>(DEFAULT_APPS[0]);
  const [selectedElement, setSelectedElement] = useState<InteractiveElement | null>(DEFAULT_APPS[0].interactiveElements[0] || null);
  const [isSnipMode, setIsSnipMode] = useState<boolean>(false);

  // Chat & AI
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);
  const [presets, setPresets] = useState<Array<{ id: string; label: string; prompt: string }>>([]);
  const [aiProviderName, setAiProviderName] = useState<string>('Smart Local Engine');
  const [redesignedCode, setRedesignedCode] = useState<string>('');

  // Workspace & Patching
  const [workspacePath, setWorkspacePath] = useState<string>('');
  const [workspaceApp, setWorkspaceApp] = useState<SampleApp | null>(null);
  const [matchedFilePath, setMatchedFilePath] = useState<string>('');
  const [matchedFileContent, setMatchedFileContent] = useState<string>('');

  // Modals
  const [isPatchReviewOpen, setIsPatchReviewOpen] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<'ai' | 'editor'>('ai');

  // Initial load
  useEffect(() => {
    loadInitialData();
  }, []);

  // Update current app when platform changes
  useEffect(() => {
    if (platform === 'workspace') {
      if (workspaceApp) {
        setCurrentApp(workspaceApp);
        if (workspaceApp.interactiveElements.length > 0) {
          const first = workspaceApp.interactiveElements[0];
          setSelectedElement(first);
          if (first.filePath) {
            setMatchedFilePath(first.filePath);
            setMatchedFileContent(first.codeSnippet || '');
          }
        }
      } else if (workspacePath) {
        loadWorkspaceDirectory(workspacePath);
      } else {
        api.getWorkspaceInfo()
          .then((info) => {
            if (info?.sampleWorkspacePath) {
              loadWorkspaceDirectory(info.sampleWorkspacePath);
            }
          })
          .catch(() => {});
      }
      return;
    }

    if (apps.length > 0) {
      const match = apps.find((a) => a.platform === platform) || apps[0];
      setCurrentApp(match);
      if (match.interactiveElements.length > 0) {
        setSelectedElement(match.interactiveElements[0]);
      } else {
        setSelectedElement(null);
      }
      setMatchedFilePath('');
      setMatchedFileContent('');
    }
  }, [platform]);

  const loadWorkspaceDirectory = async (targetPath: string) => {
    const cleanWs = targetPath ? targetPath.trim().replace(/^["']|["']$/g, '').replace(/[/\\]+$/, '') : '';
    if (!cleanWs) return;

    setWorkspacePath(cleanWs);

    try {
      if (typeof api.getWorkspaceApp === 'function') {
        const wsApp = await api.getWorkspaceApp(cleanWs);
        if (wsApp) {
          setWorkspaceApp(wsApp);
          setCurrentApp(wsApp);
          setPlatform('workspace');
          if (wsApp.interactiveElements.length > 0) {
            const first = wsApp.interactiveElements[0];
            setSelectedElement(first);
            if (first.filePath) {
              setMatchedFilePath(first.filePath);
              setMatchedFileContent(first.codeSnippet || '');
            }
          } else {
            setSelectedElement(null);
            setMatchedFilePath('');
            setMatchedFileContent('');
          }
        }
      }
    } catch (err: any) {
      console.warn('Could not construct dynamic workspace application:', err?.message);
    }
  };

  const syncWorkspaceFileForElement = async (elem: InteractiveElement, targetWs = workspacePath) => {
    try {
      // 1. Direct file link if element already carries a workspace file path
      if (elem.filePath) {
        try {
          const content = await api.readFile(elem.filePath);
          setMatchedFilePath(elem.filePath);
          setMatchedFileContent(content);
          setSelectedElement((prev) => (prev ? { ...prev, codeSnippet: content } : prev));
          return;
        } catch {
          // Fall through to dynamic workspace search below
        }
      }

      // 2. Only perform workspace code grounding when inspecting workspace mode
      if (platform !== 'workspace' && (!currentApp || !currentApp.isWorkspace)) {
        setMatchedFilePath('');
        setMatchedFileContent('');
        return;
      }

      const cleanWs = targetWs ? targetWs.trim().replace(/^["']|["']$/g, '').replace(/[/\\]+$/, '') : '';

      if (cleanWs) {
        const searchResults = await api.searchWorkspace(cleanWs, {
          text: elem.name,
          className: elem.className,
          tagName: elem.tagName,
        });

        if (searchResults && searchResults.length > 0) {
          const topMatch = searchResults[0];
          const content = await api.readFile(topMatch.filePath);
          setMatchedFilePath(topMatch.filePath);
          setMatchedFileContent(content);
          setSelectedElement((prev) => (prev ? { ...prev, codeSnippet: content } : prev));
          return;
        }
      }

      setMatchedFilePath('');
      setMatchedFileContent('');
    } catch {
      setMatchedFilePath('');
      setMatchedFileContent('');
    }
  };

  const loadInitialData = async () => {
    try {
      let sampleList = DEFAULT_APPS;
      if (typeof (api as any).getSamples === 'function') {
        try {
          const fetched = await (api as any).getSamples();
          if (Array.isArray(fetched) && fetched.length > 0) {
            sampleList = fetched;
          }
        } catch {}
      }

      const [providerInfo, presetList, wsInfo] = await Promise.all([
        api.getAiProviders(),
        api.getAiPresets(),
        api.getWorkspaceInfo().catch(() => null),
      ]);

      let initialWs = '';
      if (wsInfo?.sampleWorkspacePath) {
        initialWs = wsInfo.sampleWorkspacePath;
        setWorkspacePath(initialWs);
      }

      setApps(sampleList);
      if (sampleList.length > 0) {
        const initial = sampleList.find((a) => a.platform === 'web') || sampleList[0];
        setCurrentApp(initial);
        if (initial.interactiveElements.length > 0) {
          setSelectedElement(initial.interactiveElements[0]);
        }
      }

      // Check active canvas state if set by agent
      try {
        const canvasState = await api.getCanvasState();
        if (canvasState?.activeComponent) {
          const activeComp = canvasState.activeComponent;
          const virtualApp: SampleApp = {
            id: `canvas-${Date.now()}`,
            platform: 'web',
            name: activeComp.name || 'Active Canvas Component',
            viewport: { width: 1200, height: 750 },
            description: 'Agent-decided active component',
            interactiveElements: [
              {
                id: 'active-elem-root',
                name: activeComp.name || 'Root Component',
                selector: activeComp.name ? `<${activeComp.name}>` : 'div',
                bounds: { x: 40, y: 30, width: 1120, height: 690 },
                tagName: 'div',
                className: 'w-full h-full',
                codeSnippet: activeComp.code,
                filePath: activeComp.filePath || undefined,
              },
            ],
            isWorkspace: true,
            workspacePath: activeComp.filePath || undefined,
          };
          setCurrentApp(virtualApp);
          setSelectedElement(virtualApp.interactiveElements[0]);
          if (activeComp.filePath) {
            setMatchedFilePath(activeComp.filePath);
            setMatchedFileContent(activeComp.code);
          }
        }
      } catch {}

      if (providerInfo?.providers?.activeDefault) {
        setAiProviderName(providerInfo.providers.activeDefault);
      }

      setPresets(presetList);

      // Initial welcome message
      setMessages([
        {
          id: 'welcome-msg',
          role: 'assistant',
          content: `👋 **Welcome to Visual UI-AI Studio!**

You can:
1. **Inspect Elements:** Click any component on the visual canvas (Web, Mobile, Desktop) or click **"Snip Element"** to drag an arbitrary bounding box.
2. **Audit WCAG 2.2 Accessibility:** Check color contrast ratios, touch targets, and ARIA landmarks.
3. **Chat & Redesign:** Prompt me or click a quick preset to modernize styling, generate clean React + Tailwind code, and preview it live.
4. **Safe Code Grounding:** Apply diff patches directly to your local codebase with automatic backups and 1-click rollback.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error('Initialization error:', err);
    }
  };

  const handleSelectElement = (elem: InteractiveElement) => {
    if (selectedElement?.id !== elem.id) {
      setRedesignedCode(''); // Reset redesign preview when switching elements
    }
    setSelectedElement(elem);
    setIsSnipMode(false);
    if (currentApp && !currentApp.interactiveElements.some((e) => e.id === elem.id)) {
      const updatedApp = {
        ...currentApp,
        interactiveElements: [...currentApp.interactiveElements, elem],
      };
      setCurrentApp(updatedApp);
      setApps((prev) => prev.map((a) => (a.id === currentApp.id ? updatedApp : a)));
    }
    syncWorkspaceFileForElement(elem);
  };

  const handleSnipComplete = (box: BoundingBox) => {
    setIsSnipMode(false);
    setRedesignedCode('');
    const customElement: InteractiveElement = {
      id: `custom-snip-${Date.now()}`,
      name: `Custom Snip (${Math.round(box.width)}×${Math.round(box.height)})`,
      selector: `custom-region#snip-${Date.now()}`,
      bounds: box,
      tagName: 'section',
      className: 'custom-snipped-component',
      codeSnippet: `// Snipped UI Component (${Math.round(box.width)}×${Math.round(box.height)}px)\nexport const SnippedRegion: React.FC = () => (\n  <section className="p-4 bg-slate-900 rounded-xl text-white border border-slate-800">\n    <h3 className="font-semibold text-sm">Custom Snipped Component</h3>\n    <p className="text-xs text-slate-400 mt-1">Freeform snipped canvas region ready for AI redesign.</p>\n  </section>\n);`,
      styles: {
        backgroundColor: '#0f172a',
        textColor: '#f8fafc',
        fontSize: '14px',
        borderRadius: '12px',
      },
    };

    if (currentApp) {
      const updatedApp = {
        ...currentApp,
        interactiveElements: [...currentApp.interactiveElements, customElement],
      };
      setCurrentApp(updatedApp);
      setApps((prev) => prev.map((a) => (a.id === currentApp.id ? updatedApp : a)));
    }
    setSelectedElement(customElement);
    syncWorkspaceFileForElement(customElement);
  };

  const handleSendMessage = async (userPrompt: string) => {
    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoadingAI(true);

    try {
      // Pass the current redesigned code if available so iterative prompts build upon previous changes
      const baseCode = redesignedCode || matchedFileContent || selectedElement?.codeSnippet || '';

      const response = await api.redesignComponent({
        prompt: userPrompt,
        originalCode: baseCode,
        extractedStyles: selectedElement?.styles,
        wcagFixRequested: userPrompt.toLowerCase().includes('wcag') || userPrompt.toLowerCase().includes('contrast'),
      });

      setRedesignedCode(response.redesignedCode);

      const assistantMsg: AIChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.explanation || response.analysis,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        redesignedCode: response.redesignedCode,
        framework: response.framework,
        accessibilityImprovements: response.accessibilityImprovements,
        stylingDiffSummary: response.stylingDiffSummary,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: AIChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Failed to generate redesign: ${err.message}. Please try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleFixAccessibility = () => {
    handleSendMessage('Audit and fix WCAG 2.2 color contrast and accessibility issues for this component.');
  };

  const handleApplyPatch = async (createBackup: boolean) => {
    const result = await api.applyPatch({
      filePath: matchedFilePath,
      oldCode: matchedFileContent || selectedElement?.codeSnippet || '',
      newCode: redesignedCode,
      createBackup,
    });
    if (result.success) {
      setMatchedFileContent(redesignedCode);
    }
    return result;
  };

  const handleRollback = async () => {
    const result = await api.rollbackFile(matchedFilePath);
    if (result.success) {
      const restored = await api.readFile(matchedFilePath);
      setMatchedFileContent(restored);
      setRedesignedCode('');
    }
    return result;
  };

  const handleDirectEditorSave = async (newCode: string) => {
    if (matchedFilePath) {
      const result = await api.applyPatch({
        filePath: matchedFilePath,
        oldCode: matchedFileContent || selectedElement?.codeSnippet || '',
        newCode,
        createBackup: true,
      });
      if (result.success) {
        setMatchedFileContent(newCode);
        if (selectedElement) {
          selectedElement.codeSnippet = newCode;
        }
      }
    } else {
      setMatchedFileContent(newCode);
      if (selectedElement) {
        selectedElement.codeSnippet = newCode;
      }
    }
  };

  const handleDirectEditorRevert = async () => {
    if (matchedFilePath) {
      const restored = await api.readFile(matchedFilePath);
      setMatchedFileContent(restored);
      if (selectedElement) {
        selectedElement.codeSnippet = restored;
      }
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-studio-950 text-studio-100 overflow-hidden font-sans">
      {/* Top Header */}
      <Header
        platform={platform}
        onPlatformChange={(p) => setPlatform(p)}
        isSnipMode={isSnipMode}
        onToggleSnipMode={() => setIsSnipMode(!isSnipMode)}
        onToggleSelectMode={() => setIsSnipMode(false)}
        workspacePath={workspacePath}
        aiProviderName={aiProviderName}
      />

      {/* Main 3-Column Studio Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left / Center Column: Visual Canvas & Inspector */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Main Canvas */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <VisualCanvas
              currentApp={currentApp}
              selectedElement={selectedElement}
              onSelectElement={handleSelectElement}
              isSnipMode={isSnipMode}
              onSnipComplete={handleSnipComplete}
              redesignedCode={redesignedCode}
              matchedFileContent={matchedFileContent}
            />
          </div>

          {/* Element Inspector Sidebar */}
          <div className="w-full lg:w-72 xl:w-80 h-72 lg:h-full border-t lg:border-t-0 lg:border-l border-studio-800 bg-studio-900/60 overflow-hidden flex flex-col">
            <ElementInspector
              element={selectedElement}
              onFixAccessibility={handleFixAccessibility}
              matchedFilePath={matchedFilePath}
              matchedFileContent={matchedFileContent}
              onOpenCodeEditor={() => setRightPanelTab('editor')}
            />
          </div>
        </div>

        {/* Right Column: Switchable between AI Chat Panel / Live Redesign Preview AND Direct Code Editor */}
        <div className="w-full lg:w-[480px] xl:w-[540px] h-96 lg:h-full flex flex-col overflow-hidden">
          {/* Tab Header: Ask AI vs Direct Code Editor */}
          <div className="h-10 bg-studio-900 border-b border-studio-800 px-3 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-1 bg-studio-950 p-0.5 rounded-lg border border-studio-800">
              <button
                type="button"
                onClick={() => setRightPanelTab('ai')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${
                  rightPanelTab === 'ai'
                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                    : 'text-studio-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Ask AI</span>
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('editor')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${
                  rightPanelTab === 'editor'
                    ? 'bg-indigo-600 text-white font-medium shadow-sm'
                    : 'text-studio-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Direct Code Editor</span>
              </button>
            </div>
            {matchedFilePath && (
              <span className="text-[10px] text-emerald-400 font-mono truncate max-w-[180px]" title={matchedFilePath}>
                {matchedFilePath.split('/').pop()}
              </span>
            )}
          </div>

          {rightPanelTab === 'editor' ? (
            <div className="flex-1 overflow-hidden p-2">
              <CodeEditor
                filePath={matchedFilePath}
                initialCode={matchedFileContent || selectedElement?.codeSnippet || ''}
                onSave={handleDirectEditorSave}
                onRevert={handleDirectEditorRevert}
                title={selectedElement?.name || 'Component Code'}
              />
            </div>
          ) : redesignedCode ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <LivePreview
                  redesignedCode={redesignedCode}
                  originalCode={matchedFileContent || selectedElement?.codeSnippet || ''}
                  onApplyPatch={() => setIsPatchReviewOpen(true)}
                  canApplyPatch={!!matchedFilePath}
                  onClosePreview={() => setRedesignedCode('')}
                />
              </div>
              <div className="h-72 border-t border-studio-800 overflow-hidden">
                <AIChatPanel
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isLoading={isLoadingAI}
                  selectedElement={selectedElement}
                  presets={presets}
                  onClearChat={() => setMessages([])}
                />
              </div>
            </div>
          ) : (
            <AIChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoadingAI}
              selectedElement={selectedElement}
              presets={presets}
              onClearChat={() => setMessages([])}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <PatchReviewModal
        isOpen={isPatchReviewOpen}
        onClose={() => setIsPatchReviewOpen(false)}
        targetFilePath={matchedFilePath}
        originalCode={matchedFileContent || selectedElement?.codeSnippet || ''}
        newCode={redesignedCode}
        onApply={handleApplyPatch}
        onRollback={handleRollback}
      />
    </div>
  );
};

export default App;

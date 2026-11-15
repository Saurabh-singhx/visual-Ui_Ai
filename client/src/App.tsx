import React, { useState, useEffect } from 'react';
import { Sparkles, Code2, Layout, Sliders } from 'lucide-react';
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
  WorkspaceInfo,
  SampleApp,
  InteractiveElement,
  BoundingBox,
  AIChatMessage,
} from './types';

export const App: React.FC = () => {
  // Skill Mode & Target Device / Platform
  const [isSkillMode, setIsSkillMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.location?.search) {
      const p = new URLSearchParams(window.location.search);
      return p.get('mode') === 'skill' || p.get('skill') === 'true' || p.has('skill');
    }
    return false;
  });

  const [targetDevice, setTargetDevice] = useState<'mobile' | 'tablet' | 'desktop' | null>(() => {
    if (typeof window !== 'undefined' && window.location?.search) {
      const p = new URLSearchParams(window.location.search);
      const d = p.get('device');
      if (d === 'mobile' || d === 'tablet' || d === 'desktop') return d;
      const plat = p.get('platform');
      if (plat === 'mobile') return 'mobile';
      if (plat === 'desktop') return 'desktop';
    }
    return null;
  });

  const [targetPlatform, setTargetPlatform] = useState<PlatformType | null>(() => {
    if (typeof window !== 'undefined' && window.location?.search) {
      const p = new URLSearchParams(window.location.search);
      const plat = p.get('platform') as PlatformType | null;
      if (plat && ['web', 'mobile', 'desktop', 'workspace'].includes(plat)) return plat;
      const d = p.get('device');
      if (d === 'mobile') return 'mobile';
      if (d === 'desktop') return 'desktop';
    }
    return null;
  });

  const [platform, setPlatform] = useState<PlatformType>(() => {
    if (typeof window !== 'undefined' && window.location?.search) {
      const p = new URLSearchParams(window.location.search);
      const plat = p.get('platform') as PlatformType | null;
      if (plat && ['web', 'mobile', 'desktop', 'workspace'].includes(plat)) return plat;
      const d = p.get('device');
      if (d === 'mobile') return 'mobile';
      if (d === 'desktop') return 'desktop';
    }
    return 'web';
  });

  const [apps, setApps] = useState<SampleApp[]>([]);
  const [currentApp, setCurrentApp] = useState<SampleApp | null>(null);
  const [selectedElement, setSelectedElement] = useState<InteractiveElement | null>(null);
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
  const totalComponentsCount = apps.length;

  // Modals
  const [isPatchReviewOpen, setIsPatchReviewOpen] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<'ai' | 'editor'>('ai');
  const [mobileActivePanel, setMobileActivePanel] = useState<'canvas' | 'inspector' | 'chat'>('canvas');

  // Initial load
  useEffect(() => {
    loadInitialData();
  }, []);

  // Update current app when platform changes
  const handlePlatformChange = (newPlatform: PlatformType) => {
    setPlatform(newPlatform);

    // If an app matching newPlatform already exists in apps, switch to it
    const match = apps.find((a) => a.platform === newPlatform);
    if (match) {
      setCurrentApp(match);
      if ((match.interactiveElements?.length ?? 0) > 0) {
        const first = match.interactiveElements[0];
        setSelectedElement(first);
        if (first.filePath) {
          setMatchedFilePath(first.filePath);
          setMatchedFileContent(first.codeSnippet || '');
        }
      } else {
        setSelectedElement(null);
      }
      return;
    }

    // Otherwise adapt active workspace application to selected platform & viewport preset
    if (workspaceApp || currentApp) {
      const baseApp = workspaceApp || currentApp!;
      const viewportMap: Record<PlatformType, { width: number; height: number }> = {
        mobile: { width: 375, height: 667 },
        desktop: { width: 1280, height: 800 },
        web: { width: 1200, height: 750 },
        workspace: baseApp.viewport || { width: 1200, height: 750 },
      };

      const adaptedApp: SampleApp = {
        ...baseApp,
        platform: newPlatform,
        viewport: viewportMap[newPlatform] || baseApp.viewport || { width: 1200, height: 750 },
      };

      setCurrentApp(adaptedApp);
      setApps((prev) => {
        const existingIdx = prev.findIndex((a) => a.id === adaptedApp.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = adaptedApp;
          return updated;
        }
        return [...prev, adaptedApp];
      });

      if ((adaptedApp.interactiveElements?.length ?? 0) > 0) {
        const first = adaptedApp.interactiveElements[0];
        setSelectedElement(first);
        if (first.filePath) {
          setMatchedFilePath(first.filePath);
          setMatchedFileContent(first.codeSnippet || '');
        }
      } else {
        setSelectedElement(null);
      }
    } else if (workspacePath) {
      loadWorkspaceDirectory(workspacePath);
    }
  };

  useEffect(() => {
    if (platform === 'workspace') {
      if (workspaceApp) {
        setCurrentApp(workspaceApp);
        if ((workspaceApp.interactiveElements?.length ?? 0) > 0) {
          const first = workspaceApp.interactiveElements[0];
          setSelectedElement(first);
          if (first.filePath) {
            setMatchedFilePath(first.filePath);
            setMatchedFileContent(first.codeSnippet || '');
          }
        } else {
          setSelectedElement(null);
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
          if ((wsApp.interactiveElements?.length ?? 0) > 0) {
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
      const [providerInfo, presetList, wsInfoRaw] = await Promise.all([
        api.getAiProviders().catch(() => null),
        api.getAiPresets().catch(() => []),
        api.getWorkspaceInfo().catch(() => null),
      ]);
      const wsInfo = wsInfoRaw as WorkspaceInfo | null;

      let initialWs = '';
      if (wsInfo?.sampleWorkspacePath) {
        initialWs = wsInfo.sampleWorkspacePath;
        setWorkspacePath(initialWs);
      } else if (wsInfo?.workspaceDir) {
        initialWs = wsInfo.workspaceDir;
        setWorkspacePath(initialWs);
      }

      if (wsInfo?.skillMode) {
        setIsSkillMode(true);
      }
      if (wsInfo?.targetDevice) {
        setTargetDevice(wsInfo.targetDevice);
      }
      if (wsInfo?.targetPlatform) {
        setTargetPlatform(wsInfo.targetPlatform);
        setPlatform(wsInfo.targetPlatform);
      } else if (wsInfo?.skillMode && wsInfo?.targetDevice) {
        const plat = wsInfo.targetDevice === 'mobile' ? 'mobile' : wsInfo.targetDevice === 'desktop' ? 'desktop' : 'web';
        setTargetPlatform(plat);
        setPlatform(plat);
      } else if (wsInfo?.detectedPlatform) {
        setPlatform(wsInfo.detectedPlatform as PlatformType);
      }

      // Dynamically load workspace application
      let dynamicApp: SampleApp | null = null;
      if (initialWs && typeof api.getWorkspaceApp === 'function') {
        try {
          dynamicApp = await api.getWorkspaceApp(initialWs);
        } catch (err: any) {
          console.warn('Could not load workspace app in initial data:', err?.message);
        }
      }

      if (dynamicApp) {
        setWorkspaceApp(dynamicApp);
        setApps([dynamicApp]);
        setCurrentApp(dynamicApp);
        if ((dynamicApp.interactiveElements?.length ?? 0) > 0) {
          const firstElem = dynamicApp.interactiveElements[0];
          setSelectedElement(firstElem);
          if (firstElem.filePath) {
            setMatchedFilePath(firstElem.filePath);
            setMatchedFileContent(firstElem.codeSnippet || '');
          }
        } else {
          setSelectedElement(null);
        }
      }

      // Check active canvas state if set by agent
      try {
        const canvasState = await api.getCanvasState();
        if (canvasState?.activeComponent) {
          const activeComp = canvasState.activeComponent;
          const virtualApp: SampleApp = {
            id: `canvas-${Date.now()}`,
            platform: (wsInfo?.detectedPlatform as PlatformType) || 'web',
            name: activeComp.name || 'Active Canvas Component',
            viewport: activeComp.viewport || { width: 1200, height: 750 },
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
          setApps((prev) => [virtualApp, ...prev.filter((a) => a.id !== virtualApp.id)]);
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
    const currentElements = currentApp?.interactiveElements || [];
    if (currentApp && !currentElements.some((e) => e.id === elem.id)) {
      const updatedApp = {
        ...currentApp,
        interactiveElements: [...currentElements, elem],
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
      codeSnippet: `// Snipped UI Component (${Math.round(box.width)}×${Math.round(box.height)}px)\nexport const SnippedRegion: React.FC = () => (\n  <section className="p-4 bg-black rounded-xl text-white border border-white/20">\n    <h3 className="font-semibold text-sm">Custom Snipped Component</h3>\n    <p className="text-xs text-zinc-400 mt-1">Freeform snipped canvas region ready for AI redesign.</p>\n  </section>\n);`,
      styles: {
        backgroundColor: '#000000',
        textColor: '#ffffff',
        fontSize: '14px',
        borderRadius: '12px',
      },
    };

    if (currentApp) {
      const currentElements = currentApp.interactiveElements || [];
      const updatedApp = {
        ...currentApp,
        interactiveElements: [...currentElements, customElement],
      };
      setCurrentApp(updatedApp);
      setApps((prev) => prev.map((a) => (a.id === currentApp.id ? updatedApp : a)));
    } else {
      const newApp: SampleApp = {
        id: `workspace-snip-${Date.now()}`,
        platform: platform,
        name: 'Workspace Snipped View',
        viewport: {
          width: Math.max(1200, Math.round(box.x + box.width + 40)),
          height: Math.max(750, Math.round(box.y + box.height + 40)),
        },
        description: 'Dynamically created from snipped region',
        interactiveElements: [customElement],
        isWorkspace: true,
      };
      setCurrentApp(newApp);
      setApps([newApp]);
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
    <div className="w-screen h-screen flex flex-col bg-black text-white overflow-hidden font-sans">
      {/* Top Header */}
      <Header
        platform={platform}
        onPlatformChange={handlePlatformChange}
        isSnipMode={isSnipMode}
        onToggleSnipMode={() => setIsSnipMode(!isSnipMode)}
        onToggleSelectMode={() => setIsSnipMode(false)}
        workspacePath={workspacePath}
        aiProviderName={aiProviderName}
        isSkillMode={isSkillMode}
        targetDevice={targetDevice}
        targetPlatform={targetPlatform}
      />

      {/* Mobile / Tablet Panel Switcher (< lg) */}
      <div className="flex lg:hidden items-center justify-around bg-[#0d0d0d] border-b border-white/10 px-2 py-1.5 shrink-0 z-30 select-none">
        <button
          type="button"
          onClick={() => setMobileActivePanel('canvas')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mobileActivePanel === 'canvas'
              ? 'bg-orange-600 text-white font-semibold shadow-sm shadow-orange-600/30'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          <Layout className="w-3.5 h-3.5" />
          <span>Canvas</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileActivePanel('inspector')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all mx-1 ${
            mobileActivePanel === 'inspector'
              ? 'bg-orange-600 text-white font-semibold shadow-sm shadow-orange-600/30'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Inspector</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileActivePanel('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mobileActivePanel === 'chat'
              ? 'bg-orange-600 text-white font-semibold shadow-sm shadow-orange-600/30'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI & Code</span>
        </button>
      </div>

      {/* Main 3-Column Studio Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left / Center Column: Visual Canvas & Inspector */}
        <div className={`${mobileActivePanel === 'chat' ? 'hidden lg:flex' : 'flex'} flex-1 flex-col lg:flex-row overflow-hidden h-full`}>
          {/* Main Canvas */}
          <div className={`${mobileActivePanel === 'canvas' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col overflow-hidden relative h-full`}>
            <VisualCanvas
              currentApp={currentApp}
              selectedElement={selectedElement}
              onSelectElement={handleSelectElement}
              isSnipMode={isSnipMode}
              onSnipComplete={handleSnipComplete}
              redesignedCode={redesignedCode}
              matchedFileContent={matchedFileContent}
              isSkillMode={isSkillMode}
              targetDevice={targetDevice}
            />
          </div>

          {/* Element Inspector Sidebar */}
          <div className={`${mobileActivePanel === 'inspector' ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 xl:w-80 h-full border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0d0d0d] overflow-hidden flex-col`}>
            <ElementInspector
              element={selectedElement}
              onFixAccessibility={handleFixAccessibility}
              matchedFilePath={matchedFilePath}
              matchedFileContent={matchedFileContent}
              onOpenCodeEditor={() => {
                setRightPanelTab('editor');
                setMobileActivePanel('chat');
              }}
            />
          </div>
        </div>

        {/* Right Column: Switchable between AI Chat Panel / Live Redesign Preview AND Direct Code Editor */}
        <div className={`${mobileActivePanel === 'chat' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[480px] xl:w-[540px] h-full border-t lg:border-t-0 lg:border-l border-white/10 flex-col overflow-hidden`}>
          {/* Tab Header: Ask AI vs Direct Code Editor */}
          <div className="h-10 bg-[#0d0d0d] border-b border-white/10 px-3 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-1 bg-black p-0.5 rounded-lg border border-white/15">
              <button
                type="button"
                onClick={() => setRightPanelTab('ai')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${
                  rightPanelTab === 'ai'
                    ? 'bg-orange-600 text-white font-medium shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                <span>Ask AI</span>
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('editor')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${
                  rightPanelTab === 'editor'
                    ? 'bg-orange-600 text-white font-medium shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-white" />
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
              <div className="h-72 border-t border-white/10 overflow-hidden">
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

import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { VisualCanvas } from './components/canvas/VisualCanvas';
import { ElementInspector } from './components/inspector/ElementInspector';
import { LivePreview } from './components/preview/LivePreview';
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

export const App: React.FC = () => {
  const [platform, setPlatform] = useState<PlatformType>('web');
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

  // Modals
  const [isPatchReviewOpen, setIsPatchReviewOpen] = useState<boolean>(false);
  const [isAdbModalOpen, setIsAdbModalOpen] = useState<boolean>(false);
  const [isWebModalOpen, setIsWebModalOpen] = useState<boolean>(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState<boolean>(false);

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
        setIsWorkspaceModalOpen(true);
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
      const [sampleList, providerInfo, presetList, wsInfo] = await Promise.all([
        api.getSamples(),
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

  const handleCaptureScreen = async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        alert('Screen Capture API is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false,
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

      stream.getTracks().forEach((track) => track.stop());

      const dataUrl = canvas.toDataURL('image/png');
      const desktopApp: SampleApp = {
        id: `desktop-live-${Date.now()}`,
        platform: 'desktop',
        name: 'Captured Desktop Window',
        viewport: { width: Math.min(1280, canvas.width), height: Math.min(800, canvas.height) },
        description: 'Live OS window screenshot',
        interactiveElements: [],
        screenshotUrl: dataUrl,
      };

      setApps((prev) => [desktopApp, ...prev.filter((a) => a.id !== desktopApp.id && a.platform !== 'desktop')]);
      setCurrentApp(desktopApp);
      setPlatform('desktop');
      setSelectedElement(null);
      setIsSnipMode(true);
      setMatchedFilePath('');
      setMatchedFileContent('');
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.warn('Screen capture failed:', err);
      }
    }
  };

  const handleLoadWebUrl = (url: string) => {
    const liveWebApp: SampleApp = {
      id: `web-live-${Date.now()}`,
      platform: 'web',
      name: `Web: ${url.replace(/^https?:\/\//, '')}`,
      viewport: { width: 1200, height: 750 },
      description: `Live connected web application at ${url}`,
      interactiveElements: [
        {
          id: `web-live-root`,
          name: 'Main Web Viewport',
          selector: 'main#app-root',
          bounds: { x: 40, y: 30, width: 1120, height: 690 },
          tagName: 'main',
          className: 'w-full h-full p-4',
          codeSnippet: `// Connected web app at ${url}\nexport const App = () => (\n  <main className="w-full h-full p-4">\n    {/* Live web application content */}\n  </main>\n);`,
          styles: {
            backgroundColor: '#ffffff',
            textColor: '#0f172a',
            fontSize: '16px',
            borderRadius: '12px',
          },
        },
      ],
      iframeUrl: url,
    };

    setApps((prev) => [liveWebApp, ...prev.filter((a) => a.id !== liveWebApp.id && a.platform !== 'web')]);
    setCurrentApp(liveWebApp);
    setPlatform('web');
    setSelectedElement(liveWebApp.interactiveElements[0]);
    setIsSnipMode(true);
    syncWorkspaceFileForElement(liveWebApp.interactiveElements[0]);
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
        onOpenWorkspaceModal={() => setIsWorkspaceModalOpen(true)}
        onOpenAdbModal={() => setIsAdbModalOpen(true)}
        onOpenWebModal={() => setIsWebModalOpen(true)}
        onCaptureScreen={handleCaptureScreen}
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
              onSearchInWorkspace={() => setIsWorkspaceModalOpen(true)}
              matchedFilePath={matchedFilePath}
              matchedFileContent={matchedFileContent}
            />
          </div>
        </div>

        {/* Right Column: AI Chat Panel OR Live Redesign Preview */}
        <div className="w-full lg:w-[480px] xl:w-[540px] h-96 lg:h-full flex flex-col overflow-hidden">
          {redesignedCode ? (
            <div className="h-full flex flex-col">
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

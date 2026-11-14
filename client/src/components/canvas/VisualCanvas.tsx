import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crop,
  Layers,
  Sparkles,
  MousePointer,
  SplitSquareVertical,
} from 'lucide-react';
import { SampleApp, InteractiveElement, BoundingBox } from '../../types';
import { extractRenderableHtml } from '../preview/LivePreview';

interface VisualCanvasProps {
  currentApp: SampleApp | null;
  selectedElement: InteractiveElement | null;
  onSelectElement: (elem: InteractiveElement) => void;
  isSnipMode: boolean;
  onSnipComplete: (box: BoundingBox) => void;
  redesignedCode?: string;
  matchedFileContent?: string;
}

export const VisualCanvas: React.FC<VisualCanvasProps> = ({
  currentApp,
  selectedElement,
  onSelectElement,
  isSnipMode,
  onSnipComplete,
  redesignedCode,
  matchedFileContent,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [showSplitCompare, setShowSplitCompare] = useState<boolean>(false);
  const [splitSliderPos, setSplitSliderPos] = useState<number>(50);
  const [showInCanvasPreview, setShowInCanvasPreview] = useState<boolean>(true);

  // Snip drag state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDragBox, setCurrentDragBox] = useState<BoundingBox | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const splitPaneRef = useRef<HTMLDivElement>(null);
  const [paneWidth, setPaneWidth] = useState<number>(672);

  const currentDragBoxRef = useRef<BoundingBox | null>(null);

  // Calculate fit scale so viewport fits within container without overflow
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !currentApp) return;
    const clientW = containerRef.current.clientWidth || (window.innerWidth - 640);
    const clientH = containerRef.current.clientHeight || (window.innerHeight - 56);
    const padding = 48; // container padding
    const availableWidth = Math.max(300, clientW - padding);
    const availableHeight = Math.max(260, clientH - 40 - padding); // 40px top toolbar
    const totalViewportWidth = currentApp.viewport.width + (currentApp.platform === 'mobile' ? 24 : 0);
    const totalViewportHeight = currentApp.viewport.height + (currentApp.platform === 'mobile' ? 24 : 0);
    const scaleX = availableWidth / totalViewportWidth;
    const scaleY = availableHeight / totalViewportHeight;
    const fitScale = Math.min(1.0, Math.floor(Math.min(scaleX, scaleY) * 100) / 100);
    setZoom(Math.max(0.25, fitScale));
  }, [currentApp]);

  // Auto-fit canvas on initial load and when platform/app changes
  useEffect(() => {
    if (currentApp) {
      const raf = requestAnimationFrame(() => {
        fitToScreen();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [currentApp?.id, fitToScreen]);

  // Window resize handler to maintain proper fit
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && currentApp) {
        const padding = 48;
        const availableWidth = containerRef.current.clientWidth - padding;
        const totalW = currentApp.viewport.width + (currentApp.platform === 'mobile' ? 24 : 0);
        if (totalW * zoom > availableWidth + 80) {
          fitToScreen();
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentApp, zoom, fitToScreen]);

  // Auto-scroll to center selected element smoothly when selected
  useEffect(() => {
    if (selectedElement && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      // If canvas fits completely inside container without scrollbars, no need to auto-scroll
      if (container.scrollWidth <= container.clientWidth && container.scrollHeight <= container.clientHeight) {
        return;
      }
      const elemCenterX = (selectedElement.bounds.x + selectedElement.bounds.width / 2) * zoom;
      const elemCenterY = (selectedElement.bounds.y + selectedElement.bounds.height / 2) * zoom;
      const targetScrollLeft = elemCenterX - container.clientWidth / 2;
      const targetScrollTop = elemCenterY - container.clientHeight / 2;

      if (typeof container.scrollTo === 'function') {
        container.scrollTo({
          left: Math.max(0, targetScrollLeft),
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      } else {
        container.scrollLeft = Math.max(0, targetScrollLeft);
        container.scrollTop = Math.max(0, targetScrollTop);
      }
    }
  }, [selectedElement?.id, zoom]);

  const updateDrag = (clientX: number, clientY: number) => {
    if (!isDragging || !dragStart || !currentApp) return;
    const target = screenRef.current || canvasRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const currentX = Math.min(
      currentApp.viewport.width,
      Math.max(0, (clientX - rect.left) / zoom)
    );
    const currentY = Math.min(
      currentApp.viewport.height,
      Math.max(0, (clientY - rect.top) / zoom)
    );

    const x = Math.min(dragStart.x, currentX);
    const y = Math.min(dragStart.y, currentY);
    const width = Math.abs(currentX - dragStart.x);
    const height = Math.abs(currentY - dragStart.y);

    const box = { x, y, width, height };
    currentDragBoxRef.current = box;
    setCurrentDragBox(box);
  };

  const finishDrag = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const finalBox = currentDragBoxRef.current || currentDragBox;
    if (finalBox && finalBox.width >= 15 && finalBox.height >= 15) {
      onSnipComplete(finalBox);
    }
    setDragStart(null);
    currentDragBoxRef.current = null;
    setCurrentDragBox(null);
  };

  useEffect(() => {
    if (splitPaneRef.current) {
      setPaneWidth(splitPaneRef.current.clientWidth);
    }
  }, [showSplitCompare]);

  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      updateDrag(e.clientX, e.clientY);
    };

    const handleWindowMouseUp = () => {
      finishDrag();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDragging, dragStart, zoom, currentApp]);

  if (!currentApp) {
    return (
      <div className="flex-1 flex items-center justify-center text-studio-400 bg-studio-950">
        <p className="text-sm">No target application loaded. Select a platform above.</p>
      </div>
    );
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSnipMode) return;
    const target = screenRef.current || canvasRef.current;
    if (!target) return;
    e.preventDefault();
    const rect = target.getBoundingClientRect();
    const x = Math.min(
      currentApp.viewport.width,
      Math.max(0, (e.clientX - rect.left) / zoom)
    );
    const y = Math.min(
      currentApp.viewport.height,
      Math.max(0, (e.clientY - rect.top) / zoom)
    );

    setIsDragging(true);
    setDragStart({ x, y });
    const initialBox = { x, y, width: 0, height: 0 };
    currentDragBoxRef.current = initialBox;
    setCurrentDragBox(initialBox);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    updateDrag(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    finishDrag();
  };

  // Click-to-select element inspector handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isSnipMode || !currentApp) return;
    const target = screenRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoom;
    const clickY = (e.clientY - rect.top) / zoom;

    // 1. Check if click falls within any predefined interactive elements (pick most specific/smallest)
    const matching = currentApp.interactiveElements.filter(
      (elem) =>
        clickX >= elem.bounds.x &&
        clickX <= elem.bounds.x + elem.bounds.width &&
        clickY >= elem.bounds.y &&
        clickY <= elem.bounds.y + elem.bounds.height
    );

    if (matching.length > 0) {
      matching.sort((a, b) => a.bounds.width * a.bounds.height - b.bounds.width * b.bounds.height);
      onSelectElement(matching[0]);
      return;
    }

    // 2. Dynamic element picker: inspect clicked DOM element inside the rendered mockup
    let clickedNode: HTMLElement | null = (e.target as HTMLElement | null);
    if (!clickedNode || clickedNode === target || !target.contains(clickedNode)) {
      clickedNode = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null);
    }
    if (clickedNode && (clickedNode as any).nodeType === 3) {
      clickedNode = (clickedNode as any).parentElement;
    }

    if (clickedNode && target.contains(clickedNode) && clickedNode !== target) {
      const nodeRect = clickedNode.getBoundingClientRect();
      const rawW = nodeRect.width || (clickedNode as any).offsetWidth || 120;
      const rawH = nodeRect.height || (clickedNode as any).offsetHeight || 40;
      const nodeX = Math.max(0, Math.min(currentApp.viewport.width - 20, (nodeRect.left - rect.left) / zoom));
      const nodeY = Math.max(0, Math.min(currentApp.viewport.height - 20, (nodeRect.top - rect.top) / zoom));
      const nodeW = Math.min(currentApp.viewport.width - nodeX, Math.max(20, rawW / zoom));
      const nodeH = Math.min(currentApp.viewport.height - nodeY, Math.max(20, rawH / zoom));

      if (nodeW >= 15 && nodeH >= 15) {
        const tagName = clickedNode.tagName.toLowerCase();
        const textSnippet = (clickedNode.innerText || clickedNode.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 32);
        const name = textSnippet ? textSnippet : `<${tagName}> Component`;

        const rawClass = typeof clickedNode.className === 'string'
          ? clickedNode.className
          : (clickedNode.getAttribute('class') || '');
        const classFirst = rawClass.trim() ? '.' + rawClass.trim().split(/\s+/)[0] : '';
        const selector = `${tagName}${clickedNode.id ? '#' + clickedNode.id : classFirst}`;

        let computedBg = '#0f172a';
        let computedColor = '#f8fafc';
        let computedFs = '14px';
        let computedBr = '8px';
        try {
          const computed = window.getComputedStyle(clickedNode);
          if (computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)' && computed.backgroundColor !== 'transparent') {
            computedBg = computed.backgroundColor;
          }
          if (computed.color) computedColor = computed.color;
          if (computed.fontSize) computedFs = computed.fontSize;
          if (computed.borderRadius) computedBr = computed.borderRadius;
        } catch {
          // fallback
        }

        const dynamicElem: InteractiveElement = {
          id: `elem-dyn-${Date.now()}`,
          name: name,
          selector: selector,
          bounds: { x: Math.round(nodeX), y: Math.round(nodeY), width: Math.round(nodeW), height: Math.round(nodeH) },
          tagName: tagName,
          className: rawClass,
          codeSnippet: clickedNode.outerHTML || `<${tagName} className="${rawClass}">${textSnippet}</${tagName}>`,
          styles: {
            backgroundColor: computedBg,
            textColor: computedColor,
            fontSize: computedFs,
            borderRadius: computedBr,
          },
        };
        onSelectElement(dynamicElem);
      }
    }
  };

  const isMobile = currentApp.platform === 'mobile';

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-studio-950 flex flex-col relative overflow-hidden select-none"
    >
      {/* Top Toolbar */}
      <div className="h-10 bg-studio-900/60 border-b border-studio-800/80 px-4 flex items-center justify-between text-xs text-studio-300">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{currentApp.name}</span>
          <span className="text-studio-500">•</span>
          <span className="text-studio-400">
            {currentApp.viewport.width} × {currentApp.viewport.height}px
          </span>
          {isSnipMode && (
            <span className="ml-2 px-2 py-0.5 bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 rounded text-[11px] font-medium flex items-center gap-1">
              <Crop className="w-3 h-3" /> Drag rectangle to snip
            </span>
          )}
        </div>

        {/* View Controls & Responsive Breakpoints */}
        <div className="flex items-center gap-2">
          {/* Responsive Breakpoint Presets: Mobile (375px), Tablet (768px), Desktop (1200px) */}
          <div className="flex items-center bg-studio-800 rounded-lg p-0.5 border border-studio-700">
            <button
              type="button"
              onClick={() => {
                if (currentApp) {
                  currentApp.viewport = { ...currentApp.viewport, width: 375, height: 667 };
                  fitToScreen();
                }
              }}
              className="px-2 py-0.5 hover:text-white rounded hover:bg-studio-700 text-studio-400 text-[11px]"
              title="Mobile Viewport (375px)"
            >
              Mobile 375px
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentApp) {
                  currentApp.viewport = { ...currentApp.viewport, width: 768, height: 1024 };
                  fitToScreen();
                }
              }}
              className="px-2 py-0.5 hover:text-white rounded hover:bg-studio-700 text-studio-400 text-[11px]"
              title="Tablet Viewport (768px)"
            >
              Tablet 768px
            </button>
            <button
              type="button"
              onClick={() => {
                if (currentApp) {
                  currentApp.viewport = { ...currentApp.viewport, width: 1200, height: 800 };
                  fitToScreen();
                }
              }}
              className="px-2 py-0.5 hover:text-white rounded hover:bg-studio-700 text-studio-400 text-[11px]"
              title="Desktop Viewport (1200px)"
            >
              Desktop 1200px
            </button>
          </div>
          {redesignedCode && (
            <button
              onClick={() => setShowInCanvasPreview(!showInCanvasPreview)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors border ${
                showInCanvasPreview
                  ? 'bg-cyan-600 text-white border-cyan-500 shadow-sm'
                  : 'bg-studio-800 text-studio-400 border-studio-700 hover:text-white'
              }`}
              title="Toggle AI redesign on canvas"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {showInCanvasPreview ? 'AI Redesign: ON' : 'AI Redesign: OFF'}
              </span>
            </button>
          )}

          {redesignedCode && (
            <button
              onClick={() => setShowSplitCompare(!showSplitCompare)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors border ${
                showSplitCompare
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-studio-800 text-studio-300 border-studio-700 hover:text-white'
              }`}
              title="Split comparison slider"
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Compare Before/After</span>
            </button>
          )}

          <div className="flex items-center bg-studio-800 rounded-lg p-0.5 border border-studio-700">
            <button
              onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10))}
              className="p-1 hover:text-white rounded hover:bg-studio-700 text-studio-400"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[11px] font-mono text-studio-300 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))}
              className="p-1 hover:text-white rounded hover:bg-studio-700 text-studio-400"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={fitToScreen}
              className="px-2 py-0.5 hover:text-white rounded hover:bg-studio-700 text-studio-300 text-[11px] font-medium flex items-center gap-1 border-l border-studio-700 ml-0.5"
              title="Fit canvas to screen (prevent overflow)"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Fit</span>
            </button>
            <button
              onClick={() => setZoom(1)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ml-0.5 ${
                zoom === 1 ? 'bg-indigo-600 text-white font-semibold' : 'text-studio-400 hover:text-white'
              }`}
              title="Reset 100%"
            >
              100%
            </button>
          </div>
        </div>
      </div>

      {/* Split Compare Overlay View */}
      {showSplitCompare && redesignedCode && (
        <div className="absolute inset-x-0 top-10 bottom-0 z-40 bg-slate-950 overflow-hidden flex flex-col pointer-events-auto">
          <div className="h-9 bg-studio-900 border-b border-studio-800 px-4 flex items-center justify-between text-xs text-studio-300">
            <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Split Compare (Original vs Redesigned)</span>
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-studio-400 font-mono">{splitSliderPos}% Split</span>
              <button
                onClick={() => setShowSplitCompare(false)}
                className="px-2.5 py-1 bg-studio-800 hover:bg-studio-700 text-studio-200 rounded text-xs font-medium border border-studio-700 transition-colors"
              >
                Exit Compare
              </button>
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden select-none bg-slate-950 flex items-center justify-center p-6">
            <div
              ref={splitPaneRef}
              className="relative w-full max-w-3xl min-h-[380px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900/60 flex items-center justify-center"
            >
              {/* AFTER (Redesigned) Pane: Underneath, full width */}
              <div className="absolute inset-0 p-8 flex items-center justify-center bg-slate-950">
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-mono font-semibold shadow z-20">
                  Redesigned (WCAG AAA)
                </div>
                <div
                  className="w-full flex justify-center"
                  dangerouslySetInnerHTML={{ __html: extractRenderableHtml(redesignedCode) }}
                />
              </div>

              {/* BEFORE (Original) Pane: Overlaid on top, clipped to splitSliderPos% */}
              <div
                style={{ width: `${splitSliderPos}%` }}
                className="absolute top-0 left-0 bottom-0 overflow-hidden border-r-2 border-indigo-500 bg-slate-900/90 backdrop-blur-md z-10"
              >
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/80 text-slate-300 text-[10px] font-mono border border-white/10 z-20">
                  Original
                </div>
                <div
                  style={{ width: paneWidth }}
                  className="h-full p-8 flex items-center justify-center"
                >
                  <div
                    className="w-full flex justify-center"
                    dangerouslySetInnerHTML={{
                      __html: extractRenderableHtml(
                        selectedElement?.codeSnippet ||
                          '<div class="p-4 bg-gray-100 rounded text-black font-sans"><h3>Original Component</h3></div>'
                      ),
                    }}
                  />
                </div>
              </div>

              {/* Draggable Divider Handle */}
              <div
                style={{ left: `${splitSliderPos}%` }}
                className="absolute top-0 bottom-0 -ml-3 w-6 z-30 cursor-ew-resize flex items-center justify-center pointer-events-none"
              >
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xl text-[10px] font-bold border-2 border-white/40">
                  ↔
                </div>
              </div>

              {/* Slider input */}
              <input
                type="range"
                min="5"
                max="95"
                value={splitSliderPos}
                onChange={(e) => setSplitSliderPos(Number(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-ew-resize z-40 w-full h-full"
                aria-label="Split slider"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-auto p-8 flex bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] ${
          isSnipMode ? 'cursor-crosshair' : 'cursor-default'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          className="m-auto shrink-0 relative transition-all duration-75"
          style={{
            width: (currentApp.viewport.width + (isMobile ? 24 : 0)) * zoom,
            height: (currentApp.viewport.height + (isMobile ? 24 : 0)) * zoom,
          }}
        >
          <div
            ref={canvasRef}
            style={{
              width: currentApp.viewport.width,
              height: currentApp.viewport.height,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
            className={`absolute top-0 left-0 bg-studio-900 shadow-2xl transition-transform duration-75 border border-studio-800 ${
              isMobile ? 'rounded-[44px] p-3 ring-8 ring-studio-800/80 box-content' : 'rounded-xl box-border'
            }`}
          >
            {/* Mobile phone notch/island header */}
            {isMobile && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-30" />
            )}

            {/* Render Mock or Live Application Screen */}
            <div
              ref={screenRef}
              onClick={handleCanvasClick}
              className="w-full h-full relative overflow-hidden rounded-lg bg-studio-950"
            >
            {/* Real Captured Screen from Desktop / ADB */}
            {currentApp.screenshotUrl && (
              <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={currentApp.screenshotUrl}
                  alt="Captured Screen"
                  className="w-full h-full object-contain pointer-events-none"
                />
              </div>
            )}

            {/* Live Web Iframe */}
            {currentApp.iframeUrl && !currentApp.screenshotUrl && (
              <div className="w-full h-full relative overflow-hidden bg-white">
                <iframe
                  src={currentApp.iframeUrl}
                  title="Live Web Application"
                  className={`w-full h-full border-0 ${isSnipMode ? 'pointer-events-none' : ''}`}
                />
              </div>
            )}

            {/* Workspace Live Application Canvas */}
            {!currentApp.screenshotUrl && !currentApp.iframeUrl && currentApp.isWorkspace && (
              <div className="w-full h-full bg-slate-950 text-white font-sans relative overflow-hidden p-6 select-none">
                {/* Workspace Top Status Bar */}
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                    <span className="font-semibold text-white">{currentApp.name}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">
                      {currentApp.interactiveElements.length} Live Component{currentApp.interactiveElements.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 truncate max-w-md">
                    {currentApp.workspacePath || ''}
                  </span>
                </div>

                {/* Render Each Real Workspace Component */}
                {currentApp.interactiveElements.map((elem) => {
                  const isElemSelected = selectedElement?.id === elem.id;
                  const displayCode =
                    isElemSelected && redesignedCode
                      ? redesignedCode
                      : isElemSelected && matchedFileContent
                      ? matchedFileContent
                      : elem.codeSnippet || '';

                  return (
                    <div
                      key={elem.id}
                      style={{
                        left: elem.bounds.x,
                        top: elem.bounds.y,
                        width: elem.bounds.width,
                        height: elem.bounds.height,
                      }}
                      className="absolute rounded-xl overflow-hidden shadow-xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-sm transition-all flex flex-col"
                    >
                      <div className="h-6 px-3 bg-slate-900/90 border-b border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span className="text-indigo-300 font-semibold truncate">&lt;{elem.name}&gt;</span>
                        <span className="text-slate-500 truncate max-w-[140px]">
                          {elem.relativePath || elem.bounds.width + '×' + elem.bounds.height + 'px'}
                        </span>
                      </div>
                      <div
                        className="flex-1 overflow-auto p-3 flex flex-col justify-start items-stretch"
                        dangerouslySetInnerHTML={{
                          __html: extractRenderableHtml(displayCode, elem.name),
                        }}
                      />
                    </div>
                  );
                })}

                {currentApp.interactiveElements.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-64 text-center text-slate-400">
                    <p className="text-sm font-medium text-slate-300">No UI components found in workspace directory</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Directory has no .tsx, .jsx, or .html components to inspect.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Simulated Web Background Content */}
            {!currentApp.screenshotUrl && !currentApp.iframeUrl && !currentApp.isWorkspace && currentApp.platform === 'web' && (
              <div className="w-full h-full bg-slate-900 text-white font-sans relative overflow-hidden">
                {/* Simulated Header (bounds: x: 40, y: 20, width: 1120, height: 64) */}
                <div
                  style={{ left: 40, top: 20, width: 1120, height: 64 }}
                  className="absolute flex items-center justify-between px-6 bg-white/5 backdrop-blur-md rounded-xl border border-white/10"
                >
                  <div className="font-bold text-lg bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    AcmeCloud
                  </div>
                  <div className="flex gap-6 text-xs text-slate-300">
                    <span className="hover:text-white cursor-pointer">Features</span>
                    <span className="hover:text-white cursor-pointer">Pricing</span>
                    <span className="hover:text-white cursor-pointer">Documentation</span>
                  </div>
                  <button className="px-3.5 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium hover:bg-blue-500 transition-colors">
                    Sign In
                  </button>
                </div>

                {/* Simulated Feature Card (Legacy) (bounds: x: 80, y: 160, width: 340, height: 220) */}
                <div
                  style={{ left: 80, top: 160, width: 340, height: 220 }}
                  className="absolute p-4 bg-gray-100 rounded border border-gray-300 text-black flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-700 font-medium">
                      Legacy Styling
                    </span>
                    <h3 className="text-sm font-bold mt-2 text-gray-900">Feature Card</h3>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      Outdated gray background, weak contrast, and standard boxy styling.
                    </p>
                  </div>
                  <button className="self-start px-3 py-1 bg-blue-600 text-white text-[11px] rounded hover:bg-blue-700">
                    Learn more
                  </button>
                </div>

                {/* Simulated Telemetry Card (bounds: x: 460, y: 160, width: 340, height: 220) */}
                <div
                  style={{ left: 460, top: 160, width: 340, height: 220 }}
                  className="absolute p-5 bg-slate-800/80 rounded-xl border border-slate-700 text-white flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-300 font-medium border border-indigo-500/30">
                      Active
                    </span>
                    <h3 className="text-sm font-bold mt-2">Real-time Telemetry</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Live monitoring metrics, anomaly detection, and automated alerting system.
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-emerald-400 font-bold">99.98% Uptime</span>
                    <button className="px-3 py-1 bg-indigo-600 text-white text-[11px] rounded-lg hover:bg-indigo-500">
                      View Metrics
                    </button>
                  </div>
                </div>

                {/* Hero Banner / Marketing info below cards */}
                <div
                  style={{ left: 80, top: 410, width: 1040, height: 260 }}
                  className="absolute p-6 bg-slate-800/30 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center"
                >
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Next-Gen AI Platform
                  </span>
                  <h1 className="text-2xl font-extrabold mt-3 tracking-tight">
                    Supercharge Your Engineering Workflow
                  </h1>
                  <p className="text-slate-400 text-xs mt-2 max-w-lg mx-auto leading-relaxed">
                    Inspect components across Web, Mobile, and Desktop. Redesign, refactor, and apply
                    patches directly to your local codebase with AI.
                  </p>
                </div>

                {/* Simulated Footer */}
                <div
                  style={{ left: 40, bottom: 12, width: 1120 }}
                  className="absolute text-[11px] text-slate-500 text-center py-2 border-t border-slate-800/80"
                >
                  © 2026 AcmeCloud Inc. All rights reserved.
                </div>
              </div>
            )}

            {!currentApp.screenshotUrl && currentApp.platform === 'mobile' && (
              <div className="w-full h-full bg-slate-950 text-white font-sans relative overflow-hidden">
                {/* Mobile Top Bar */}
                <div
                  style={{ left: 24, top: 28, width: 342 }}
                  className="absolute flex items-center justify-between text-xs text-slate-400"
                >
                  <span className="font-semibold text-white">9:41</span>
                  <span>5G • 100%</span>
                </div>

                {/* Balance Card (bounds: x: 24, y: 90, width: 342, height: 180) */}
                <div
                  style={{ left: 24, top: 90, width: 342, height: 180 }}
                  className="absolute p-5 bg-gradient-to-br from-indigo-700 via-blue-700 to-indigo-900 rounded-3xl shadow-xl flex flex-col justify-between"
                >
                  <div>
                    <span className="text-xs text-indigo-200">Total Portfolio Value</span>
                    <h2 className="text-2xl font-extrabold mt-0.5">$48,295.40</h2>
                    <span className="text-[11px] text-emerald-300 mt-0.5 inline-block">+$1,420.50 (3.2%) today</span>
                  </div>

                  {/* CTA Buttons - Deposit is at bounds: x: 44, y: 200, width: 110, height: 42 */}
                  <div className="flex gap-2">
                    <button
                      style={{ width: 110, height: 42 }}
                      className="py-2 bg-white text-blue-700 rounded-xl text-xs font-bold shadow flex items-center justify-center hover:bg-slate-100"
                    >
                      Deposit
                    </button>
                    <button className="flex-1 py-2 bg-indigo-800/80 text-white text-xs font-medium rounded-xl border border-indigo-600/50 hover:bg-indigo-800">
                      Send
                    </button>
                  </div>
                </div>

                {/* Quick Action Widgets (top: 290) */}
                <div
                  style={{ left: 24, top: 290, width: 342 }}
                  className="absolute grid grid-cols-2 gap-3"
                >
                  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
                    <span className="text-xs text-slate-400">Monthly Yield</span>
                    <div className="text-lg font-bold text-indigo-400 mt-1">8.4% APY</div>
                  </div>
                  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
                    <span className="text-xs text-slate-400">Total Rewards</span>
                    <div className="text-lg font-bold text-emerald-400 mt-1">+$320.12</div>
                  </div>
                </div>

                {/* Recent Activities list */}
                <div
                  style={{ left: 24, top: 400, width: 342 }}
                  className="absolute space-y-2"
                >
                  <span className="text-xs font-semibold text-slate-400 block mb-1">Recent Transactions</span>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-white">Bitcoin Purchase</div>
                      <div className="text-[10px] text-slate-500">Today, 2:15 PM</div>
                    </div>
                    <span className="text-emerald-400 font-bold">+0.045 BTC</span>
                  </div>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-white">Staking Reward</div>
                      <div className="text-[10px] text-slate-500">Yesterday, 9:00 AM</div>
                    </div>
                    <span className="text-indigo-400 font-bold">+14.2 SOL</span>
                  </div>
                </div>

                {/* Mobile Bottom Navigation (bounds: y: 760) */}
                <div
                  style={{ left: 24, top: 760, width: 342, height: 56 }}
                  className="absolute bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-around text-xs text-slate-400"
                >
                  <span className="text-indigo-400 font-semibold">Home</span>
                  <span>Markets</span>
                  <span>Activity</span>
                  <span>Settings</span>
                </div>
              </div>
            )}

            {!currentApp.screenshotUrl && currentApp.platform === 'desktop' && (
              <div className="w-full h-full bg-slate-950 text-white font-sans relative overflow-hidden">
                {/* Desktop Window Titlebar */}
                <div className="h-9 bg-slate-900 border-b border-slate-800 flex items-center px-4 justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="ml-2 font-medium text-slate-300">Server Fleet Manager v2.4</span>
                  </div>
                  <span>Admin Session (US-East)</span>
                </div>

                {/* Left Sidebar (bounds: x: 24, y: 60, width: 210, height: 710) */}
                <div
                  style={{ left: 24, top: 60, width: 210, height: 710 }}
                  className="absolute bg-slate-900/60 rounded-xl p-3 border border-slate-800 flex flex-col gap-2 text-xs text-slate-400"
                >
                  <span className="px-3 py-2 bg-indigo-600 text-white rounded-lg font-medium">Dashboard</span>
                  <span className="px-3 py-2 hover:text-white rounded-lg hover:bg-slate-800">Nodes & Pods</span>
                  <span className="px-3 py-2 hover:text-white rounded-lg hover:bg-slate-800">Network Traffic</span>
                  <span className="px-3 py-2 hover:text-white rounded-lg hover:bg-slate-800">Security Audits</span>
                </div>

                {/* Active Server Metric Widget (bounds: x: 260, y: 110, width: 320, height: 150) */}
                <div
                  style={{ left: 260, top: 110, width: 320, height: 150 }}
                  className="absolute p-5 bg-slate-800 rounded-lg border border-slate-700 text-slate-100 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-xs text-slate-400">CPU Usage</div>
                    <div className="text-3xl font-mono font-bold mt-1 text-emerald-400">42.8%</div>
                  </div>
                  <div className="text-xs text-slate-400">16 Cores Online • 3.4 GHz</div>
                </div>

                {/* Secondary Metric Widget (bounds: x: 610, y: 110, width: 320, height: 150) */}
                <div
                  style={{ left: 610, top: 110, width: 320, height: 150 }}
                  className="absolute p-5 bg-slate-900 rounded-2xl border border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-xs text-slate-400">Memory Utilization</div>
                    <div className="text-3xl font-mono font-bold mt-1 text-cyan-400">18.2 / 64 GB</div>
                  </div>
                  <p className="text-xs text-slate-500">DDR5 ECC RAM • Low Latency</p>
                </div>

                {/* Telemetry Chart Table area */}
                <div
                  style={{ left: 260, top: 290, width: 980, height: 480 }}
                  className="absolute p-6 bg-slate-900/40 rounded-2xl border border-slate-800/80 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
                    <span className="font-semibold text-white">Live Node Telemetry Activity</span>
                    <span className="text-emerald-400 font-mono">16/16 Nodes Healthy</span>
                  </div>
                  <div className="h-64 flex items-end gap-2 pt-4">
                    {[35, 42, 60, 48, 55, 70, 65, 50, 42, 58, 62, 45, 52, 68, 74, 42].map((val, idx) => (
                      <div key={idx} className="flex-1 bg-slate-800 rounded-t flex flex-col justify-end overflow-hidden group">
                        <div
                          style={{ height: `${val}%` }}
                          className="bg-indigo-600 group-hover:bg-cyan-400 transition-colors rounded-t"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between pt-2 border-t border-slate-800">
                    <span>15m ago</span>
                    <span>10m ago</span>
                    <span>5m ago</span>
                    <span>Just now</span>
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Bounding Boxes Layer */}
            {(() => {
              const elementsToRender = [...currentApp.interactiveElements];
              if (selectedElement && !elementsToRender.some((e) => e.id === selectedElement.id)) {
                elementsToRender.push(selectedElement);
              }
              return elementsToRender.map((elem) => {
                const isSelected = selectedElement?.id === elem.id;
                const isHovered = hoveredElementId === elem.id;

                // Ensure bounds are strictly clamped within canvas viewport to prevent layout overflowing
                const safeBounds = {
                  x: Math.max(0, Math.min(elem.bounds.x, currentApp.viewport.width - 10)),
                  y: Math.max(0, Math.min(elem.bounds.y, currentApp.viewport.height - 10)),
                  width: Math.min(elem.bounds.width, currentApp.viewport.width - elem.bounds.x),
                  height: Math.min(elem.bounds.height, currentApp.viewport.height - elem.bounds.y),
                };

                const isNearTop = safeBounds.y < 28;
                const isNearRight = safeBounds.x + safeBounds.width > currentApp.viewport.width - 140;
                const isNearBottom = safeBounds.y + safeBounds.height > currentApp.viewport.height - 28;

                return (
                  <div
                    key={elem.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isSnipMode) onSelectElement(elem);
                    }}
                    onMouseEnter={() => setHoveredElementId(elem.id)}
                    onMouseLeave={() => setHoveredElementId(null)}
                    style={{
                      left: safeBounds.x,
                      top: safeBounds.y,
                      width: safeBounds.width,
                      height: safeBounds.height,
                    }}
                    className={`absolute transition-all cursor-pointer z-20 ${
                      isSelected
                        ? 'border-2 border-indigo-400 ring-2 ring-indigo-500/40 ring-inset bg-indigo-500/10'
                        : isHovered
                        ? 'border-2 border-dashed border-cyan-400 bg-cyan-400/10'
                        : 'border border-transparent hover:border-slate-400/40'
                    }`}
                  >
                    {/* In-Canvas Live AI Redesign Overlay (for demo mockups) */}
                    {isSelected && !currentApp.isWorkspace && redesignedCode && showInCanvasPreview && (
                      <div
                        className="absolute inset-0 z-10 bg-slate-950/95 rounded-xl overflow-hidden p-2 flex items-center justify-center shadow-2xl pointer-events-none select-none border border-cyan-500/30"
                        dangerouslySetInnerHTML={{
                          __html: extractRenderableHtml(redesignedCode, elem.name),
                        }}
                      />
                    )}

                    {/* Floating Tag Label - dynamically repositioned if near edges to prevent clipping or overflowing */}
                    {(isSelected || isHovered) && (
                      <div
                        className={`absolute px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-600 text-white shadow-md flex items-center gap-1 whitespace-nowrap pointer-events-none z-30 ${
                          isNearTop
                            ? isNearBottom
                              ? 'top-1'
                              : 'top-full mt-1'
                            : '-top-6'
                        } ${isNearRight ? 'right-0' : 'left-0'}`}
                      >
                        <span>&lt;{elem.tagName}&gt;</span>
                        <span className="text-indigo-200 text-[9px]">
                          {Math.round(safeBounds.width)}×{Math.round(safeBounds.height)}px
                        </span>
                      </div>
                    )}

                    {/* Corner handles when selected - kept inside boundaries to avoid overflow */}
                    {isSelected && (
                      <>
                        <div className="absolute top-0 left-0 w-2 h-2 bg-white border border-indigo-600 rounded-sm" />
                        <div className="absolute top-0 right-0 w-2 h-2 bg-white border border-indigo-600 rounded-sm" />
                        <div className="absolute bottom-0 left-0 w-2 h-2 bg-white border border-indigo-600 rounded-sm" />
                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-white border border-indigo-600 rounded-sm" />
                      </>
                    )}
                  </div>
                );
              });
            })()}

            {/* Active Snip Drag Selection Box */}
            {isDragging && currentDragBox && (
              <div
                style={{
                  left: currentDragBox.x,
                  top: currentDragBox.y,
                  width: currentDragBox.width,
                  height: currentDragBox.height,
                }}
                className="absolute border-2 border-dashed border-yellow-400 bg-yellow-400/15 z-30 pointer-events-none"
              >
                <div className="absolute -top-6 left-0 px-2 py-0.5 bg-yellow-400 text-black font-mono font-bold text-[10px] rounded shadow">
                  {Math.round(currentDragBox.width)} × {Math.round(currentDragBox.height)}px
                </div>
              </div>
            )}

            {/* Transparent Snip Mode Overlay Layer to capture drags over mock content */}
            {isSnipMode && (
              <div
                className="absolute inset-0 z-25 cursor-crosshair bg-yellow-400/5 select-none"
                onMouseDown={handleMouseDown}
              />
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

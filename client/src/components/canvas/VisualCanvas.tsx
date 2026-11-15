import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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

interface SanitizedContainerProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  return rawHtml
    // Strip script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*>/gi, '')
    // Strip dangerous embed elements
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe\s*>/gi, '')
    .replace(/<iframe\b[^>]*>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object\s*>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<applet\b[^>]*>/gi, '')
    // Strip inline event handler attributes (onload, onerror, onclick, onmouseover, etc.)
    .replace(/\s+on[a-zA-Z]+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, '')
    // Strip javascript: pseudo-protocol in href or src
    .replace(/(href|src)\s*=\s*["']\s*javascript:[^"']*["']/gi, '$1="#"')
    // Strip vbscript:
    .replace(/(href|src)\s*=\s*["']\s*vbscript:[^"']*["']/gi, '$1="#"')
    // Strip data:text/html
    .replace(/(href|src)\s*=\s*["']\s*data:text\/html[^"']*["']/gi, '$1="#"')
    // Strip CSS expression
    .replace(/expression\s*\([^)]*\)/gi, '');
}

export const SanitizedContainer: React.FC<SanitizedContainerProps> = ({ html, className, style, onClick }) => {
  const cleanHtml = useMemo(() => sanitizeHtml(html), [html]);
  return (
    <div
      className={className}
      style={style}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
};

interface VisualCanvasProps {
  currentApp: SampleApp | null;
  selectedElement: InteractiveElement | null;
  onSelectElement: (elem: InteractiveElement) => void;
  isSnipMode: boolean;
  onSnipComplete: (box: BoundingBox) => void;
  redesignedCode?: string;
  matchedFileContent?: string;
  isSkillMode?: boolean;
  targetDevice?: 'mobile' | 'tablet' | 'desktop' | null;
}

export const VisualCanvas: React.FC<VisualCanvasProps> = ({
  currentApp,
  selectedElement,
  onSelectElement,
  isSnipMode,
  onSnipComplete,
  redesignedCode,
  matchedFileContent,
  isSkillMode = false,
  targetDevice = null,
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

  // Canvas width drag resize state (320px - 1920px)
  const [isResizingCanvasWidth, setIsResizingCanvasWidth] = useState<boolean>(false);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(1200);

  // Focused Stage view toggle for workspace mode
  const [isFocusedView, setIsFocusedView] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const splitPaneRef = useRef<HTMLDivElement>(null);
  const [paneWidth, setPaneWidth] = useState<number>(672);

  const currentDragBoxRef = useRef<BoundingBox | null>(null);

  // Interactive canvas width resize handler (320px – 1920px)
  const handleStartResizeWidth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingCanvasWidth(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = currentApp?.viewport?.width || 1200;
  };

  useEffect(() => {
    if (!isResizingCanvasWidth) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!currentApp) return;
      const deltaX = (e.clientX - resizeStartX.current) / zoom;
      const newWidth = Math.min(1920, Math.max(320, Math.round(resizeStartWidth.current + deltaX)));
      currentApp.viewport = { ...(currentApp.viewport || { width: 1200, height: 750 }), width: newWidth };
      setPaneWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingCanvasWidth(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingCanvasWidth, currentApp, zoom]);

  // Calculate fit scale so viewport fits within container without overflow
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !currentApp) return;
    const clientW = containerRef.current.clientWidth || (window.innerWidth - 640);
    const clientH = containerRef.current.clientHeight || (window.innerHeight - 56);
    const padding = 48; // container padding
    const availableWidth = Math.max(300, clientW - padding);
    const availableHeight = Math.max(260, clientH - 40 - padding); // 40px top toolbar
    const vp = currentApp.viewport || { width: 1200, height: 750 };
    const totalViewportWidth = vp.width + (currentApp.platform === 'mobile' ? 24 : 0);
    const totalViewportHeight = vp.height + (currentApp.platform === 'mobile' ? 24 : 0);
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

  // Connect to the SSE endpoint /api/canvas/events on mount and update canvas state in real time
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;

    let eventSource: EventSource | null = null;
    let isMounted = true;

    try {
      eventSource = new EventSource('/api/canvas/events');

      const handleEvent = (event: MessageEvent) => {
        if (!isMounted || !event.data) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload) {
            const activeComp = payload.activeComponent || payload;
            if (activeComp && activeComp.name && currentApp) {
              if (activeComp.viewport) {
                currentApp.viewport = { ...(currentApp.viewport || { width: 1200, height: 750 }), ...activeComp.viewport };
              }

              const pathBasename = (p: string) => {
                const parts = p.split(/[/\\]/);
                return parts[parts.length - 1] || p;
              };

              if (!currentApp.interactiveElements) {
                currentApp.interactiveElements = [];
              }

              const existingIdx = currentApp.interactiveElements.findIndex(
                (el) => el.name === activeComp.name || (activeComp.filePath && el.filePath === activeComp.filePath)
              );

              const updatedElem: InteractiveElement = {
                id: activeComp.filePath ? `ws-${activeComp.name}` : `sse-${Date.now()}`,
                name: activeComp.name,
                selector: activeComp.name.toLowerCase(),
                bounds: {
                  x: 24,
                  y: 60,
                  width: activeComp.viewport?.width || 600,
                  height: activeComp.viewport?.height || 400,
                },
                tagName: 'div',
                className: 'live-sync-component',
                codeSnippet: activeComp.code || activeComp.rawCode || '',
                filePath: activeComp.filePath,
                relativePath: activeComp.filePath ? pathBasename(activeComp.filePath) : undefined,
              };

              if (existingIdx >= 0) {
                currentApp.interactiveElements[existingIdx] = {
                  ...currentApp.interactiveElements[existingIdx],
                  codeSnippet: activeComp.code || activeComp.rawCode || currentApp.interactiveElements[existingIdx].codeSnippet,
                };
                onSelectElement(currentApp.interactiveElements[existingIdx]);
              } else {
                currentApp.interactiveElements.unshift(updatedElem);
                onSelectElement(updatedElem);
              }
            }
          }
        } catch {
          // ignore non-JSON heartbeats
        }
      };

      eventSource.onmessage = handleEvent;
      eventSource.addEventListener('canvas-update', handleEvent as EventListener);
      eventSource.addEventListener('render', handleEvent as EventListener);

      eventSource.onerror = () => {
        // SSE reconnect handles automatically
      };
    } catch {
      // ignore initialization error in test/non-browser environments
    }

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [currentApp, onSelectElement]);

  // Window resize handler to maintain proper fit
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && currentApp) {
        const padding = 48;
        const availableWidth = containerRef.current.clientWidth - padding;
        const vp = currentApp.viewport || { width: 1200, height: 750 };
        const totalW = vp.width + (currentApp.platform === 'mobile' ? 24 : 0);
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
    const vp = currentApp.viewport || { width: 1200, height: 750 };
    const currentX = Math.min(
      vp.width,
      Math.max(0, (clientX - rect.left) / zoom)
    );
    const currentY = Math.min(
      vp.height,
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-studio-400">
        <Sparkles className="w-10 h-10 text-orange-500 mb-3" />
        <h3 className="text-sm font-semibold text-white">No Component Selected</h3>
        <p className="text-xs text-studio-500 max-w-sm mt-1">
          Scan your workspace or select a component from the inventory to begin visual inspection and AI redesign.
        </p>
      </div>
    );
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSnipMode) return;
    const target = screenRef.current || canvasRef.current;
    if (!target) return;
    e.preventDefault();
    const rect = target.getBoundingClientRect();
    const vp = currentApp.viewport || { width: 1200, height: 750 };
    const x = Math.min(
      vp.width,
      Math.max(0, (e.clientX - rect.left) / zoom)
    );
    const y = Math.min(
      vp.height,
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
    const elements = currentApp.interactiveElements || [];
    const matching = elements.filter(
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
      const vp = currentApp.viewport || { width: 1200, height: 750 };
      const nodeX = Math.max(0, Math.min(vp.width - 20, (nodeRect.left - rect.left) / zoom));
      const nodeY = Math.max(0, Math.min(vp.height - 20, (nodeRect.top - rect.top) / zoom));
      const nodeW = Math.min(vp.width - nodeX, Math.max(20, rawW / zoom));
      const nodeH = Math.min(vp.height - nodeY, Math.max(20, rawH / zoom));

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

  const isMobile = currentApp?.platform === 'mobile';
  const viewport = currentApp.viewport || { width: 1200, height: 750 };
  const elements = currentApp.interactiveElements || [];

  const presets = [
    { id: 'mobile' as const, label: 'Mobile 375px', title: 'Mobile Viewport (375px)', width: 375, height: 667 },
    { id: 'tablet' as const, label: 'Tablet 768px', title: 'Tablet Viewport (768px)', width: 768, height: 1024 },
    { id: 'desktop' as const, label: 'Desktop 1200px', title: 'Desktop Viewport (1200px)', width: 1200, height: 800 },
  ];

  const visiblePresets = isSkillMode && targetDevice
    ? presets.filter((p) => p.id === targetDevice)
    : presets;

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-black flex flex-col relative overflow-hidden select-none"
    >
      {/* Top Toolbar */}
      <div className="h-10 bg-[#0d0d0d] border-b border-white/15 px-3 sm:px-4 flex items-center justify-between text-xs text-zinc-300 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{currentApp.name}</span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-400">
            {currentApp.viewport ? `${currentApp.viewport.width} × ${currentApp.viewport.height}px` : `${viewport.width} × ${viewport.height}px`}
          </span>
          {isSnipMode && (
            <span className="ml-2 px-2 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-500/40 rounded text-[11px] font-medium flex items-center gap-1">
              <Crop className="w-3 h-3" /> Drag rectangle to snip
            </span>
          )}
        </div>

        {/* View Controls & Responsive Breakpoints */}
        <div className="flex items-center gap-2">
          {/* Responsive Breakpoint Presets: Mobile (375px), Tablet (768px), Desktop (1200px) */}
          <div className="flex items-center bg-[#0d0d0d] rounded-lg p-0.5 border border-white/15">
            {visiblePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  if (currentApp) {
                    currentApp.viewport = { ...(currentApp.viewport || { width: 1200, height: 750 }), width: preset.width, height: preset.height };
                    fitToScreen();
                  }
                }}
                className="px-2 py-0.5 hover:text-white rounded hover:bg-zinc-800 text-zinc-400 text-[11px]"
                title={preset.title}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {redesignedCode && (
            <button
              onClick={() => setShowInCanvasPreview(!showInCanvasPreview)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors border ${
                showInCanvasPreview
                  ? 'bg-orange-600 text-white border-orange-500 shadow-sm'
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
                  ? 'bg-orange-600 text-white border-orange-500'
                  : 'bg-studio-800 text-studio-300 border-studio-700 hover:text-white'
              }`}
              title="Split comparison slider"
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Compare Before/After</span>
            </button>
          )}

          <div className="flex items-center bg-[#0d0d0d] rounded-lg p-0.5 border border-white/15">
            <button
              onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10))}
              className="p-1 hover:text-white rounded hover:bg-zinc-800 text-zinc-400"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[11px] font-mono text-zinc-300 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))}
              className="p-1 hover:text-white rounded hover:bg-zinc-800 text-zinc-400"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={fitToScreen}
              className="px-2 py-0.5 hover:text-white rounded hover:bg-zinc-800 text-zinc-300 text-[11px] font-medium flex items-center gap-1 border-l border-white/10 ml-0.5"
              title="Fit canvas to screen (prevent overflow)"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Fit</span>
            </button>
            <button
              onClick={() => setZoom(1)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ml-0.5 ${
                zoom === 1 ? 'bg-orange-600 text-white font-semibold' : 'text-zinc-400 hover:text-white'
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
        <div className="absolute inset-x-0 top-10 bottom-0 z-40 bg-black overflow-hidden flex flex-col pointer-events-auto">
          <div className="h-9 bg-[#0d0d0d] border-b border-white/15 px-4 flex items-center justify-between text-xs text-zinc-300">
            <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span>Split Compare (Original vs Redesigned)</span>
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-400 font-mono">{splitSliderPos}% Split</span>
              <button
                onClick={() => setShowSplitCompare(false)}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded text-xs font-medium border border-white/15 transition-colors"
              >
                Exit Compare
              </button>
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden select-none bg-black flex items-center justify-center p-6">
            <div
              ref={splitPaneRef}
              className="relative w-full max-w-3xl min-h-[380px] rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-[#0d0d0d] flex items-center justify-center"
            >
              {/* AFTER (Redesigned) Pane: Underneath, full width */}
              <div className="absolute inset-0 p-8 flex items-center justify-center bg-black">
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-orange-600 text-white text-[10px] font-mono font-semibold shadow z-20">
                  Redesigned (WCAG AAA)
                </div>
                <SanitizedContainer
                  className="w-full flex justify-center"
                  html={extractRenderableHtml(redesignedCode)}
                />
              </div>

              {/* BEFORE (Original) Pane: Overlaid on top, clipped to splitSliderPos% */}
              <div
                style={{ width: `${splitSliderPos}%` }}
                className="absolute top-0 left-0 bottom-0 overflow-hidden border-r-2 border-orange-500 bg-black/90 backdrop-blur-md z-10"
              >
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/80 text-zinc-300 text-[10px] font-mono border border-white/10 z-20">
                  Original
                </div>
                <div
                  style={{ width: paneWidth }}
                  className="h-full p-8 flex items-center justify-center"
                >
                  <SanitizedContainer
                    className="w-full flex justify-center"
                    html={extractRenderableHtml(
                      selectedElement?.codeSnippet ||
                        '<div class="p-4 bg-gray-100 rounded text-black font-sans"><h3>Original Component</h3></div>'
                    )}
                  />
                </div>
              </div>

              {/* Draggable Divider Handle */}
              <div
                style={{ left: `${splitSliderPos}%` }}
                className="absolute top-0 bottom-0 -ml-3 w-6 z-30 cursor-ew-resize flex items-center justify-center pointer-events-none"
              >
                <div className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center shadow-xl text-[10px] font-bold border-2 border-white/40">
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
        className={`flex-1 overflow-auto p-4 md:p-8 flex bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:16px_16px] ${
          isSnipMode ? 'cursor-crosshair' : 'cursor-default'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          className="m-auto shrink-0 relative transition-all duration-75"
          style={{
            width: (viewport.width + (isMobile ? 24 : 0)) * zoom,
            height: (viewport.height + (isMobile ? 24 : 0)) * zoom,
          }}
        >
          <div
            ref={canvasRef}
            style={{
              width: viewport.width,
              height: viewport.height,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
            className={`absolute top-0 left-0 bg-[#0d0d0d] shadow-2xl transition-transform duration-75 border border-white/20 ${
              isMobile ? 'rounded-[44px] p-3 ring-8 ring-zinc-800/80 box-content' : 'rounded-xl box-border'
            }`}
          >
            {/* Draggable Width Resize Handle (320px - 1920px) */}
            {!isSkillMode && (
              <div
                onMouseDown={handleStartResizeWidth}
                className={`absolute top-0 right-0 -mr-2.5 w-5 h-full cursor-ew-resize flex items-center justify-center z-40 select-none group ${
                  isResizingCanvasWidth ? 'opacity-100' : 'opacity-60 hover:opacity-100'
                }`}
                title="Drag right edge to resize canvas width (320px – 1920px)"
              >
                <div
                  className={`w-1.5 h-12 rounded-full transition-all shadow-md ${
                    isResizingCanvasWidth
                      ? 'bg-orange-500 scale-y-125 ring-2 ring-orange-400/50'
                      : 'bg-zinc-600 group-hover:bg-orange-500 group-hover:scale-y-110'
                  }`}
                />
              </div>
            )}

            {/* Mobile phone notch/island header */}
            {isMobile && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-30" />
            )}

            {/* Render Mock or Live Application Screen */}
            <div
              ref={screenRef}
              onClick={handleCanvasClick}
              className="w-full h-full relative overflow-hidden rounded-lg bg-black"
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
            {!currentApp.screenshotUrl && !currentApp.iframeUrl && (
              <div className="w-full h-full bg-black text-white font-sans relative overflow-hidden flex flex-col select-none">
                {/* Workspace Top Status Bar */}
                <div className="h-9 px-4 bg-[#0d0d0d] border-b border-white/10 flex items-center justify-between text-xs text-zinc-400 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500 inline-block animate-pulse" />
                    <span className="font-semibold text-white">{currentApp.name}</span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400">
                      {elements.length} Live Component{elements.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {elements.length > 1 && (
                      <div className="flex items-center bg-zinc-900 rounded p-0.5 border border-white/10">
                        <button
                          type="button"
                          onClick={() => setIsFocusedView(true)}
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            isFocusedView ? 'bg-orange-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Focused
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsFocusedView(false)}
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            !isFocusedView ? 'bg-orange-600 text-white font-medium' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Grid
                        </button>
                      </div>
                    )}
                    <span className="font-mono text-[11px] text-zinc-500 truncate max-w-xs">
                      {currentApp.workspacePath || ''}
                    </span>
                  </div>
                </div>

                {/* Focused Stage or Multi-Card Grid */}
                {isFocusedView && (selectedElement || elements.length > 0) ? (
                  (() => {
                    const activeElem = selectedElement || elements[0];
                    const isElemSelected = selectedElement?.id === activeElem.id;
                    const displayCode =
                      isElemSelected && redesignedCode
                        ? redesignedCode
                        : isElemSelected && matchedFileContent
                        ? matchedFileContent
                        : activeElem.codeSnippet || '';

                    return (
                      <div className="flex-1 w-full flex flex-col items-center justify-center p-6 overflow-auto">
                        <div
                          style={{
                            width: Math.min(Math.max(activeElem.bounds.width || 600, 640), viewport.width - 48),
                            minHeight: Math.min(Math.max(activeElem.bounds.height || 360, 360), viewport.height - 120),
                          }}
                          className="rounded-2xl overflow-hidden shadow-2xl border border-white/15 bg-[#0d0d0d] backdrop-blur-md flex flex-col max-w-full"
                        >
                          <div className="h-8 px-4 bg-black border-b border-white/10 flex items-center justify-between text-xs text-zinc-300 font-mono">
                            <span className="text-orange-400 font-semibold flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              &lt;{activeElem.name}&gt;
                            </span>
                            <span className="text-zinc-500 text-[11px] truncate max-w-sm">
                              {activeElem.filePath || activeElem.relativePath || 'Focused Component'}
                            </span>
                          </div>
                          <SanitizedContainer
                            className="flex-1 overflow-auto p-6 flex flex-col justify-start items-stretch"
                            html={extractRenderableHtml(displayCode, activeElem.name)}
                          />
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex-1 w-full relative overflow-auto p-6">
                    {/* Render Each Real Workspace Component in Grid */}
                    {elements.map((elem) => {
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
                          className="absolute rounded-xl overflow-hidden shadow-xl border border-white/15 bg-[#0d0d0d] backdrop-blur-sm transition-all flex flex-col"
                        >
                          <div className="h-6 px-3 bg-black border-b border-white/10 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                            <span className="text-orange-400 font-semibold truncate">&lt;{elem.name}&gt;</span>
                            <span className="text-zinc-500 truncate max-w-[140px]">
                              {elem.relativePath || elem.bounds.width + '×' + elem.bounds.height + 'px'}
                            </span>
                          </div>
                          <SanitizedContainer
                            className="flex-1 overflow-auto p-3 flex flex-col justify-start items-stretch"
                            html={extractRenderableHtml(displayCode, elem.name)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {elements.length === 0 && (
                  <div className="flex flex-col items-center justify-center flex-1 text-center text-zinc-400">
                    <p className="text-sm font-medium text-zinc-300">No UI components found in workspace directory</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Directory has no .tsx, .jsx, or .html components to inspect.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Interactive Bounding Boxes Layer */}
            {(() => {
              const elementsToRender = [...elements];
              if (selectedElement && !elementsToRender.some((e) => e.id === selectedElement.id)) {
                elementsToRender.push(selectedElement);
              }
              return elementsToRender.map((elem) => {
                const isSelected = selectedElement?.id === elem.id;
                const isHovered = hoveredElementId === elem.id;

                // Ensure bounds are strictly clamped within canvas viewport to prevent layout overflowing
                const safeBounds = {
                  x: Math.max(0, Math.min(elem.bounds.x, viewport.width - 10)),
                  y: Math.max(0, Math.min(elem.bounds.y, viewport.height - 10)),
                  width: Math.min(elem.bounds.width, viewport.width - elem.bounds.x),
                  height: Math.min(elem.bounds.height, viewport.height - elem.bounds.y),
                };

                const isNearTop = safeBounds.y < 28;
                const isNearRight = safeBounds.x + safeBounds.width > viewport.width - 140;
                const isNearBottom = safeBounds.y + safeBounds.height > viewport.height - 28;

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
                        ? 'border-2 border-orange-500 ring-2 ring-orange-500/40 bg-orange-500/15'
                        : isHovered
                        ? 'border-2 border-dashed border-white/60 bg-white/5'
                        : 'border border-transparent hover:border-white/30'
                    }`}
                  >
                    {/* In-Canvas Live AI Redesign Overlay */}
                    {isSelected && redesignedCode && showInCanvasPreview && (
                      <SanitizedContainer
                        className="absolute inset-0 z-10 bg-black/95 rounded-xl overflow-hidden p-2 flex items-center justify-center shadow-2xl pointer-events-none select-none border border-orange-500/40"
                        html={extractRenderableHtml(redesignedCode, elem.name)}
                      />
                    )}

                    {/* Floating Tag Label - dynamically repositioned if near edges to prevent clipping or overflowing */}
                    {(isSelected || isHovered) && (
                      <div
                        className={`absolute px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-orange-600 text-white shadow-md flex items-center gap-1 whitespace-nowrap pointer-events-none z-30 ${
                          isNearTop
                            ? isNearBottom
                              ? 'top-1'
                              : 'top-full mt-1'
                            : '-top-6'
                        } ${isNearRight ? 'right-0' : 'left-0'}`}
                      >
                        <span>&lt;{elem.tagName}&gt;</span>
                        <span className="text-orange-200 text-[9px]">
                          {Math.round(safeBounds.width)}×{Math.round(safeBounds.height)}px
                        </span>
                      </div>
                    )}

                    {/* Corner handles when selected - kept inside boundaries to avoid overflow */}
                    {isSelected && (
                      <>
                        <div className="absolute top-0 left-0 w-2 h-2 bg-white border border-orange-600 rounded-sm" />
                        <div className="absolute top-0 right-0 w-2 h-2 bg-white border border-orange-600 rounded-sm" />
                        <div className="absolute bottom-0 left-0 w-2 h-2 bg-white border border-orange-600 rounded-sm" />
                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-white border border-orange-600 rounded-sm" />
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
                className="absolute border-2 border-dashed border-orange-400 bg-orange-500/20 z-30 pointer-events-none"
              >
                <div className="absolute -top-6 left-0 px-2 py-0.5 bg-orange-500 text-black font-mono font-bold text-[10px] rounded shadow">
                  {Math.round(currentDragBox.width)} × {Math.round(currentDragBox.height)}px
                </div>
              </div>
            )}

            {/* Transparent Snip Mode Overlay Layer to capture drags over mock content */}
            {isSnipMode && (
              <div
                className="absolute inset-0 z-25 cursor-crosshair bg-orange-500/5 select-none"
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

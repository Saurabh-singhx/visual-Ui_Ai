import React, { useState, useMemo, useEffect } from 'react';
import {
  Smartphone,
  Tablet,
  Monitor,
  Code2,
  Eye,
  GitCommit,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  X,
} from 'lucide-react';
import { computeLineDiff } from '../../utils/diffUtils';
import { CodeEditor } from '../editor/CodeEditor';

interface LivePreviewProps {
  redesignedCode: string;
  originalCode?: string;
  framework?: string;
  onApplyPatch: () => void;
  canApplyPatch: boolean;
  onClosePreview?: () => void;
  synthesizedProps?: Record<string, any>;
  isSkillMode?: boolean;
  targetDevice?: 'mobile' | 'tablet' | 'desktop' | null;
}

/**
 * Converts Framer Motion tags (motion.div, motion.button, etc.) and interaction props
 * (whileHover, whileTap) into standard HTML tags with Tailwind transition classes.
 */
function convertFramerMotionToTailwind(jsx: string): string {
  let result = jsx.replace(/import\s+(?:(?!import)[\s\S])*?\s+from\s+['"]framer-motion['"];?/g, '');

  // Tag matcher for motion opening tags: <motion.div ...> or <motion.button ...>
  result = result.replace(/<motion\.([a-zA-Z0-9]+)\b([^>]*?)(\/?)>/g, (_match, tagName, rawAttrs, selfClosing) => {
    let attrs = rawAttrs;
    const classesToAdd: string[] = [];

    // Extract whileHover scale or elevation
    const hoverScaleMatch = attrs.match(/whileHover\s*=\s*\{\{\s*[^}]*?scale\s*:\s*([0-9.]+)[^}]*?\}\}/i);
    if (hoverScaleMatch) {
      const scaleVal = parseFloat(hoverScaleMatch[1]);
      if (scaleVal >= 1.08) classesToAdd.push('hover:scale-110');
      else if (scaleVal >= 1.04) classesToAdd.push('hover:scale-105');
      else if (scaleVal > 1.0) classesToAdd.push('hover:scale-105');
      else if (scaleVal <= 0.96) classesToAdd.push('hover:scale-95');
      else classesToAdd.push('hover:scale-105');
    } else if (/whileHover/i.test(attrs)) {
      classesToAdd.push('hover:scale-105');
    }

    // Extract whileTap scale
    const tapScaleMatch = attrs.match(/whileTap\s*=\s*\{\{\s*[^}]*?scale\s*:\s*([0-9.]+)[^}]*?\}\}/i);
    if (tapScaleMatch) {
      const scaleVal = parseFloat(tapScaleMatch[1]);
      if (scaleVal <= 0.92) classesToAdd.push('active:scale-90');
      else if (scaleVal <= 0.96) classesToAdd.push('active:scale-95');
      else classesToAdd.push('active:scale-95');
    } else if (/whileTap/i.test(attrs)) {
      classesToAdd.push('active:scale-95');
    }

    // If motion interaction is present, ensure transitions exist
    if (classesToAdd.length > 0 || /transition\s*=/i.test(attrs)) {
      if (!attrs.includes('transition')) {
        classesToAdd.unshift('transition-all', 'duration-300', 'ease-in-out');
      }
    }

    // Strip motion props with balanced brace stripping
    const motionPropNames = [
      'whileHover',
      'whileTap',
      'whileFocus',
      'whileDrag',
      'whileInView',
      'initial',
      'animate',
      'exit',
      'transition',
      'variants',
      'layoutId',
      'layout',
    ];

    for (const prop of motionPropNames) {
      const propRegex = new RegExp(`\\s+${prop}\\s*=\\s*(?:\\{\\{[\\s\\S]*?\\}\\}|\\{[\\s\\S]*?\\}|"[^"]*"|'[^']*')`, 'g');
      attrs = attrs.replace(propRegex, '');
    }

    // Merge extracted classes into class or className
    if (classesToAdd.length > 0) {
      const classMatch = attrs.match(/\b(class(?:Name)?)=["']([^"']*)["']/i);
      if (classMatch) {
        const attrName = classMatch[1];
        const existing = classMatch[2].trim().split(/\s+/).filter(Boolean);
        for (const cls of classesToAdd) {
          if (!existing.includes(cls)) existing.push(cls);
        }
        attrs = attrs.replace(/\bclass(?:Name)?=["'][^"']*["']/i, `${attrName}="${existing.join(' ')}"`);
      } else {
        attrs = ` className="${classesToAdd.join(' ')}"${attrs}`;
      }
    }

    return `<${tagName}${attrs}${selfClosing ? ' /' : ''}>`;
  });

  // Convert motion closing tags
  result = result.replace(/<\/motion\.([a-zA-Z0-9]+)>/g, '</$1>');

  return result;
}

/**
 * Extracts renderable markup from React JSX component code
 */
export function extractRenderableHtml(
  code: string,
  componentNameOrProps?: string | Record<string, any>,
  synthesizedProps?: Record<string, any>
): string {
  if (!code) return '<div class="p-4 text-slate-400">No code generated yet.</div>';

  let componentName: string | undefined = undefined;
  let effectiveProps: Record<string, any> | undefined = synthesizedProps;

  if (typeof componentNameOrProps === 'object' && componentNameOrProps !== null) {
    effectiveProps = componentNameOrProps;
    componentName = undefined;
  } else if (typeof componentNameOrProps === 'string') {
    componentName = componentNameOrProps;
  }

  // Pre-process: convert Framer Motion motion.div and hover props to Tailwind transition classes
  let processedCode = convertFramerMotionToTailwind(code);

  // If code is pure HTML
  if (processedCode.trim().startsWith('<') && !processedCode.includes('import ') && !processedCode.includes('export ')) {
    return processedCode;
  }

  // Derive component name fallback
  let derivedName = componentName || '';
  if (!derivedName) {
    const compNameMatch = processedCode.match(/(?:export\s+(?:default\s+)?(?:const|function|class)\s+|function\s+)([A-Z][A-Za-z0-9_]*)/);
    if (compNameMatch && compNameMatch[1]) {
      derivedName = compNameMatch[1];
    }
  }

  // Extract explicit default prop values from function signature parameters
  const propDefaults: Record<string, string> = {};

  const paramMatch =
    processedCode.match(/(?:const|function)\s+[A-Za-z0-9_]+\s*(?::\s*[^=]+)?\s*=\s*\(\s*\{([\s\S]*?)\}\s*\)/) ||
    processedCode.match(/function\s+[A-Za-z0-9_]+\s*\(\s*\{([\s\S]*?)\}\s*\)/) ||
    processedCode.match(/\(\s*\{([\s\S]*?)\}\s*:\s*[A-Za-z0-9_]+\s*\)\s*=>/);

  if (paramMatch) {
    const paramsBlock = paramMatch[1];
    // String default values: title = 'My Title'
    for (const m of paramsBlock.matchAll(/([a-zA-Z0-9_]+)\s*=\s*["']([^"']+)["']/g)) {
      propDefaults[m[1]] = m[2];
    }
    // Number default values: count = 5
    for (const m of paramsBlock.matchAll(/([a-zA-Z0-9_]+)\s*=\s*([0-9]+(?:\.[0-9]+)?)/g)) {
      propDefaults[m[1]] = m[2];
    }
    // Boolean default values: active = true
    for (const m of paramsBlock.matchAll(/([a-zA-Z0-9_]+)\s*=\s*(true|false)/g)) {
      propDefaults[m[1]] = m[2];
    }
  }

  // Merge synthesized props over signature defaults
  if (effectiveProps && typeof effectiveProps === 'object') {
    for (const [k, v] of Object.entries(effectiveProps)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        propDefaults[k] = String(v);
      }
    }
  }

  // Extract content inside return (...) or => (...) using balanced parenthesis tracking
  let jsxSnippet = '';
  const returnStartMatch = processedCode.match(/(?:return\s*\(|=>\s*\()\s*([\s\S]*)/);
  if (returnStartMatch) {
    let depth = 1;
    const str = returnStartMatch[1];
    let i = 0;
    for (; i < str.length; i++) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    if (depth === 0) {
      jsxSnippet = str.slice(0, i).trim();
    }
  }

  // Fallback to direct return <tag> or outermost JSX tag
  if (!jsxSnippet) {
    const returnDirect = processedCode.match(/return\s+(<[a-zA-Z][\s\S]*?>[\s\S]*<\/[a-zA-Z0-9]+>);?/);
    const arrowDirect = processedCode.match(/=>\s*(<[a-zA-Z][\s\S]*?>[\s\S]*<\/[a-zA-Z0-9]+>);?/);
    const firstTag = processedCode.match(/<([a-zA-Z][a-zA-Z0-9]*)\b[\s\S]*<\/\1>/);

    if (returnDirect) jsxSnippet = returnDirect[1];
    else if (arrowDirect) jsxSnippet = arrowDirect[1];
    else if (firstTag) jsxSnippet = firstTag[0];
    else jsxSnippet = processedCode;
  }

  // Clean JSX syntax for browser rendering
  let html = jsxSnippet
    .replace(/className=/g, 'class=')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // remove JSX comments
    .replace(/onClick=\{[^}]*\}/g, '') // strip react event handlers
    .replace(/on[A-Z][a-zA-Z]*=\{[^}]*\}/g, '')
    .replace(/aria-hidden="true"/g, 'aria-hidden="true"')
    .replace(/=\{true\}/g, '="true"')
    .replace(/=\{false\}/g, '="false"')
    .replace(/<>([\s\S]*?)<\/>/g, '$1')
    .trim();

  // Clean template literals in class attributes: class={`px-4 py-2 ${active ? 'bg-blue' : ''}`}
  html = html.replace(/class=\{`([\s\S]*?)`\}/g, (_, inner) => {
    const cleaned = inner
      .replace(/\$\{[^}]*?\}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return `class="${cleaned}"`;
  });

  // Evaluate simple conditional rendering: {isOpen && (<div ...>)} or {showIcon && <span ...>}
  if (effectiveProps) {
    for (const [key, val] of Object.entries(effectiveProps)) {
      if (typeof val === 'boolean') {
        if (val) {
          html = html.replace(new RegExp(`\\{(?:props\\.)?${key}\\s*&&\\s*\\(([\\s\\S]*?)\\)\\}`, 'g'), '$1');
          html = html.replace(new RegExp(`\\{(?:props\\.)?${key}\\s*&&\\s*(<[a-zA-Z][\\s\\S]*?>[\\s\\S]*?<\\/[a-zA-Z0-9]+>)\\}`, 'g'), '$1');
        } else {
          html = html.replace(new RegExp(`\\{(?:props\\.)?${key}\\s*&&\\s*\\([\\s\\S]*?\\)\\}`, 'g'), '');
          html = html.replace(new RegExp(`\\{(?:props\\.)?${key}\\s*&&\\s*<[a-zA-Z][\\s\\S]*?>[\\s\\S]*?<\\/[a-zA-Z0-9]+>\\}`, 'g'), '');
        }
      }
    }
  }
  html = html.replace(/\{[a-zA-Z0-9_.!?\s=><'"]+&&\s*\(([\s\S]*?)\)\}/g, '$1');
  html = html.replace(/\{[a-zA-Z0-9_.!?\s=><'"]+&&\s*(<[a-zA-Z][\s\S]*?>[\s\S]*?<\/[a-zA-Z0-9]+>)\}/g, '$1');

  // Evaluate simple ternary expressions: take the truthy branch for preview
  html = html.replace(/\{[a-zA-Z0-9_.!?\s=><'"]+\?\s*\(([\s\S]*?)\)\s*:\s*\([\s\S]*?\)\}/g, '$1');
  html = html.replace(/\{[a-zA-Z0-9_.!?\s=><'"]+\?\s*(<[a-zA-Z][\s\S]*?>[\s\S]*?<\/[a-zA-Z0-9]+>)\s*:\s*[\s\S]*?\}/g, '$1');

  // Evaluate simple map expressions: {items.map(...) => (<li>...</li>)} -> render sample
  html = html.replace(/\{[a-zA-Z0-9_.]+\.map\([^)]*\)\s*=>\s*\(([\s\S]*?)\)\}/g, '$1');

  // Interpolate object and array synthesized props
  if (effectiveProps && typeof effectiveProps === 'object') {
    for (const [key, val] of Object.entries(effectiveProps)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const [subKey, subVal] of Object.entries(val)) {
          if (typeof subVal === 'string' || typeof subVal === 'number' || typeof subVal === 'boolean') {
            const subRegex = new RegExp(`\\{(?:props\\.)?${key}(?:\\?)?\\.${subKey}(?:\\s*\\|\\|\\s*["'][^"']*["'])?\\}`, 'g');
            html = html.replace(subRegex, String(subVal));
          }
        }
      } else if (Array.isArray(val)) {
        const lenRegex = new RegExp(`\\{(?:props\\.)?${key}(?:\\?)?\\.length\\}`, 'g');
        html = html.replace(lenRegex, String(val.length));
      }
    }
  }

  // Replace component's explicit default & synthesized prop interpolations
  for (const [key, val] of Object.entries(propDefaults)) {
    const propRegex = new RegExp(`\\{(?:props\\.)?${key}(?:\\s*\\|\\|\\s*["'][^"']*["'])?\\}`, 'g');
    html = html.replace(propRegex, val);
  }

  // Provide neutral contextual fallbacks based on prop name (no hardcoded SaaS marketing text)
  const neutralSemanticPlaceholders: Record<string, string> = {
    title: derivedName || 'Component Title',
    heading: derivedName || 'Heading',
    header: derivedName || 'Header',
    name: 'Item Name',
    username: 'Alex',
    user: 'Alex',
    label: 'Action',
    description: 'Component details and overview information.',
    subtitle: 'Overview Details',
    badge: 'Active',
    tag: 'Tag',
    status: 'Ready',
    count: '3',
    quantity: '1',
    amount: '100',
    price: '$49.00',
    date: 'Nov 2026',
    time: '12:00 PM',
    children: 'Content',
    text: 'Information',
    message: 'System message',
    role: 'Member',
  };

  for (const [key, val] of Object.entries(neutralSemanticPlaceholders)) {
    const propRegex = new RegExp(`\\{(?:props\\.)?${key}(?:\\s*\\|\\|\\s*["'][^"']*["'])?\\}`, 'g');
    html = html.replace(propRegex, val);
  }

  // Replace any remaining simple prop expressions like {props.item} or {category} with capitalized title
  html = html.replace(/\{(?:props\.)?([a-zA-Z0-9_]+)\}/g, (_, prop) => {
    return prop.charAt(0).toUpperCase() + prop.slice(1);
  });

  // Replace lucide/react icon tags with clean inline visual glyphs
  html = html
    .replace(/<Sparkles[^>]*\/>/g, '<span class="inline-block text-cyan-400">✨</span>')
    .replace(/<CheckCircle2[^>]*\/>/g, '<span class="inline-block text-emerald-400">✓</span>')
    .replace(/<Check[^>]*\/>/g, '<span class="inline-block text-emerald-400">✓</span>')
    .replace(/<ArrowUpRight[^>]*\/>/g, '<span class="inline-block font-bold">↗</span>')
    .replace(/<ArrowRight[^>]*\/>/g, '<span class="inline-block font-bold">→</span>')
    .replace(/<ChevronRight[^>]*\/>/g, '<span class="inline-block font-bold">›</span>')
    .replace(/<Layers[^>]*\/>/g, '<span class="inline-block text-purple-400">▤</span>')
    .replace(/<Shield[^>]*\/>/g, '<span class="inline-block text-emerald-400">🛡</span>')
    .replace(/<Activity[^>]*\/>/g, '<span class="inline-block text-emerald-400">⚡</span>')
    .replace(/<[A-Z][a-zA-Z0-9]*\s*([^>]*?)\/>/g, '<span class="inline-block opacity-80">✦</span>');

  // Convert non-void self-closing tags to open/close tags for HTML browser compliance
  html = html.replace(/<(div|span|button|article|section|header|nav|p|h[1-6])([^>]*?)\/>/g, '<$1$2></$1>');

  return html;
}

export const LivePreview: React.FC<LivePreviewProps> = ({
  redesignedCode,
  originalCode,
  framework = 'react-tailwind',
  onApplyPatch,
  canApplyPatch,
  onClosePreview,
  synthesizedProps,
  isSkillMode = false,
  targetDevice = null,
}) => {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>(() => {
    if (isSkillMode && targetDevice) {
      return targetDevice;
    }
    return 'desktop';
  });

  useEffect(() => {
    if (isSkillMode && targetDevice) {
      setViewport(targetDevice);
    }
  }, [isSkillMode, targetDevice]);

  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'diff'>('preview');
  const [copied, setCopied] = useState<boolean>(false);
  const [sandboxKey, setSandboxKey] = useState<number>(0);

  const diff = computeLineDiff(originalCode || '', redesignedCode);

  const copyCode = () => {
    navigator.clipboard.writeText(redesignedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const getViewportWidth = () => {
    if (viewport === 'mobile') return 'max-w-[375px]';
    if (viewport === 'tablet') return 'max-w-[768px]';
    return 'max-w-4xl';
  };

  // Compile full standalone HTML with Tailwind CDN
  const sandboxedHtml = useMemo(() => {
    const componentHtml = extractRenderableHtml(redesignedCode, undefined, synthesizedProps);

    return `<!DOCTYPE html>
<html class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            studio: {
              900: '#121212',
              925: '#0d0d0d',
              950: '#000000',
            },
            brand: {
              primary: '#ea580c',
              hover: '#f97316',
              accent: '#ff6600',
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: transparent;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
  <div style="width: 100%; max-width: 100%;">
    ${componentHtml}
  </div>
</body>
</html>`;
  }, [redesignedCode, sandboxKey]);

  const viewports = [
    { id: 'mobile' as const, icon: Smartphone, title: 'Mobile 375px' },
    { id: 'tablet' as const, icon: Tablet, title: 'Tablet 768px' },
    { id: 'desktop' as const, icon: Monitor, title: 'Desktop 100%' },
  ];

  const visibleViewports = isSkillMode && targetDevice
    ? viewports.filter((v) => v.id === targetDevice)
    : viewports;

  return (
    <div className="h-full flex flex-col bg-black border-t lg:border-t-0 lg:border-l border-white/10 select-none">
      {/* Top Bar */}
      <div className="h-10 bg-[#0d0d0d] border-b border-white/15 px-3 sm:px-4 flex items-center justify-between text-xs overflow-x-auto scrollbar-none">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-black p-0.5 rounded-lg border border-white/15">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
              activeTab === 'preview'
                ? 'bg-orange-600 text-white font-medium shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Live Sandbox</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
              activeTab === 'code'
                ? 'bg-orange-600 text-white font-medium shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Code</span>
          </button>

          <button
            onClick={() => setActiveTab('diff')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
              activeTab === 'diff'
                ? 'bg-orange-600 text-white font-medium shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>Diff ({diff.additionsCount}+ / {diff.deletionsCount}-)</span>
          </button>
        </div>

        {/* Viewport switchers & Actions */}
        <div className="flex items-center gap-2">
          {activeTab === 'preview' && (
            <>
              <button
                onClick={() => setSandboxKey((k) => k + 1)}
                className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800"
                title="Reload Sandbox"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center bg-black rounded-lg p-0.5 border border-white/15">
                {visibleViewports.map((v) => {
                  const Icon = v.icon;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setViewport(v.id)}
                      className={`p-1 rounded ${
                        viewport === v.id ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'
                      }`}
                      title={v.title}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <button
            onClick={copyCode}
            className="flex items-center gap-1 px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded text-xs border border-white/15 transition-colors"
            title="Copy component code"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {canApplyPatch && (
            <button
              onClick={onApplyPatch}
              className="flex items-center gap-1.5 px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold shadow shadow-orange-600/30 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Apply Patch</span>
            </button>
          )}

          {onClosePreview && (
            <button
              onClick={onClosePreview}
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors ml-1"
              title="Close Preview"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center">
        {activeTab === 'preview' && (
          <div className={`w-full h-full flex items-center justify-center ${getViewportWidth()} transition-all duration-300`}>
            {/* Dynamic Iframe Sandbox */}
            <div className="w-full h-full max-h-[600px] rounded-2xl overflow-hidden border border-white/15 bg-black/80 shadow-2xl relative flex flex-col">
              <div className="h-7 bg-[#0d0d0d] border-b border-white/15 px-3 flex items-center justify-between text-[11px] text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  <span>Dynamic Tailwind Sandbox</span>
                </span>
                <span className="font-mono text-[10px]">
                  {viewport === 'mobile' ? '375 × 667px' : viewport === 'tablet' ? '768 × 1024px' : 'Fluid 100%'}
                </span>
              </div>
              <iframe
                key={sandboxKey}
                srcDoc={sandboxedHtml}
                title="Component Sandbox"
                sandbox="allow-scripts"
                className="w-full flex-1 border-0 bg-black/90"
              />
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div className="w-full h-full flex flex-col p-2">
            <CodeEditor
              initialCode={redesignedCode}
              onSave={async () => {
                onApplyPatch();
              }}
              title="Redesigned Component Code"
            />
          </div>
        )}

        {activeTab === 'diff' && (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 bg-black rounded-xl border border-white/10 overflow-auto font-mono text-xs select-text">
              <table className="w-full border-collapse">
                <tbody>
                  {diff.lines.map((line, idx) => (
                    <tr
                      key={idx}
                      className={
                        line.type === 'addition'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : line.type === 'deletion'
                          ? 'bg-rose-500/15 text-rose-300 line-through'
                          : 'text-zinc-400'
                      }
                    >
                      <td className="w-10 px-2 py-0.5 text-right text-zinc-600 select-none border-r border-white/10 text-[10px]">
                        {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : line.newLineNumber}
                      </td>
                      <td className="px-3 py-0.5 whitespace-pre font-mono">{line.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

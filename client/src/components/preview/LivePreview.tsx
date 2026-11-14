import React, { useState, useMemo } from 'react';
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
}

/**
 * Extracts renderable markup from React JSX component code
 */
export function extractRenderableHtml(code: string, componentName?: string): string {
  if (!code) return '<div class="p-4 text-slate-400">No code generated yet.</div>';

  // If code is pure HTML
  if (code.trim().startsWith('<') && !code.includes('import ') && !code.includes('export ')) {
    return code;
  }

  // Derive component name fallback
  let derivedName = componentName || '';
  if (!derivedName) {
    const compNameMatch = code.match(/(?:export\s+(?:default\s+)?(?:const|function|class)\s+|function\s+)([A-Z][A-Za-z0-9_]*)/);
    if (compNameMatch && compNameMatch[1]) {
      derivedName = compNameMatch[1];
    }
  }

  // Extract explicit default prop values from function signature parameters
  const propDefaults: Record<string, string> = {};

  const paramMatch =
    code.match(/(?:const|function)\s+[A-Za-z0-9_]+\s*(?::\s*[^=]+)?\s*=\s*\(\s*\{([\s\S]*?)\}\s*\)/) ||
    code.match(/function\s+[A-Za-z0-9_]+\s*\(\s*\{([\s\S]*?)\}\s*\)/) ||
    code.match(/\(\s*\{([\s\S]*?)\}\s*:\s*[A-Za-z0-9_]+\s*\)\s*=>/);

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

  // Extract content inside return (...) or => (...) using balanced parenthesis tracking
  let jsxSnippet = '';
  const returnStartMatch = code.match(/(?:return\s*\(|=>\s*\()\s*([\s\S]*)/);
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
    const returnDirect = code.match(/return\s+(<[a-zA-Z][\s\S]*?>[\s\S]*<\/[a-zA-Z0-9]+>);?/);
    const arrowDirect = code.match(/=>\s*(<[a-zA-Z][\s\S]*?>[\s\S]*<\/[a-zA-Z0-9]+>);?/);
    const firstTag = code.match(/<([a-zA-Z][a-zA-Z0-9]*)\b[\s\S]*<\/\1>/);

    if (returnDirect) jsxSnippet = returnDirect[1];
    else if (arrowDirect) jsxSnippet = arrowDirect[1];
    else if (firstTag) jsxSnippet = firstTag[0];
    else jsxSnippet = code;
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
  html = html.replace(/\{[a-zA-Z0-9_.!?\s=><'"]+&&\s*\(([\s\S]*?)\)\}/g, '$1');
  html = html.replace(/\{[a-zA-Z0-9_.!?\s=><'"]+&&\s*(<[a-zA-Z][\s\S]*?>[\s\S]*?<\/[a-zA-Z0-9]+>)\}/g, '$1');

  // Evaluate simple ternary expressions: take the truthy branch for preview
  html = html.replace(/\{[a-zA-Z0-9_.!?\s=><'"]+\?\s*\(([\s\S]*?)\)\s*:\s*\([\s\S]*?\)\}/g, '$1');
  html = html.replace(/\{[a-zA-Z0-9_.!?\s=><'"]+\?\s*(<[a-zA-Z][\s\S]*?>[\s\S]*?<\/[a-zA-Z0-9]+>)\s*:\s*[\s\S]*?\}/g, '$1');

  // Evaluate simple map expressions: {items.map(...) => (<li>...</li>)} -> render sample
  html = html.replace(/\{[a-zA-Z0-9_.]+\.map\([^)]*\)\s*=>\s*\(([\s\S]*?)\)\}/g, '$1');

  // Replace component's explicit default prop interpolations
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
}) => {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
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
    const componentHtml = extractRenderableHtml(redesignedCode);

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
              900: '#0f172a',
              950: '#020617',
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: transparent;
      color: #f8fafc;
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

  return (
    <div className="h-full flex flex-col bg-studio-950 border-t lg:border-t-0 lg:border-l border-studio-800 select-none">
      {/* Top Bar */}
      <div className="h-10 bg-studio-900/80 border-b border-studio-800 px-4 flex items-center justify-between text-xs">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-studio-950 p-0.5 rounded-lg border border-studio-800">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
              activeTab === 'preview'
                ? 'bg-indigo-600 text-white font-medium shadow-sm'
                : 'text-studio-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Live Sandbox</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
              activeTab === 'code'
                ? 'bg-indigo-600 text-white font-medium shadow-sm'
                : 'text-studio-400 hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Code</span>
          </button>

          <button
            onClick={() => setActiveTab('diff')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
              activeTab === 'diff'
                ? 'bg-indigo-600 text-white font-medium shadow-sm'
                : 'text-studio-400 hover:text-white'
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
                className="p-1 text-studio-400 hover:text-white rounded hover:bg-studio-800"
                title="Reload Sandbox"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center bg-studio-950 rounded-lg p-0.5 border border-studio-800">
                <button
                  onClick={() => setViewport('mobile')}
                  className={`p-1 rounded ${
                    viewport === 'mobile' ? 'bg-studio-800 text-white' : 'text-studio-400 hover:text-white'
                  }`}
                  title="Mobile 375px"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewport('tablet')}
                  className={`p-1 rounded ${
                    viewport === 'tablet' ? 'bg-studio-800 text-white' : 'text-studio-400 hover:text-white'
                  }`}
                  title="Tablet 768px"
                >
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewport('desktop')}
                  className={`p-1 rounded ${
                    viewport === 'desktop' ? 'bg-studio-800 text-white' : 'text-studio-400 hover:text-white'
                  }`}
                  title="Desktop 100%"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          <button
            onClick={copyCode}
            className="flex items-center gap-1 px-2 py-1 bg-studio-800 hover:bg-studio-700 text-studio-300 hover:text-white rounded text-xs border border-studio-700 transition-colors"
            title="Copy component code"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {canApplyPatch && (
            <button
              onClick={onApplyPatch}
              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow shadow-indigo-600/30 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Apply Patch</span>
            </button>
          )}

          {onClosePreview && (
            <button
              onClick={onClosePreview}
              className="p-1 text-studio-400 hover:text-white rounded hover:bg-studio-800 transition-colors ml-1"
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
            <div className="w-full h-full max-h-[600px] rounded-2xl overflow-hidden border border-studio-800 bg-studio-950/80 shadow-2xl relative flex flex-col">
              <div className="h-7 bg-studio-900 border-b border-studio-800 px-3 flex items-center justify-between text-[11px] text-studio-400">
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
                className="w-full flex-1 border-0 bg-slate-950/90"
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
            <div className="flex-1 bg-studio-900/90 rounded-xl border border-studio-800 overflow-auto font-mono text-xs select-text">
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
                          : 'text-studio-400'
                      }
                    >
                      <td className="w-10 px-2 py-0.5 text-right text-studio-600 select-none border-r border-studio-800 text-[10px]">
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

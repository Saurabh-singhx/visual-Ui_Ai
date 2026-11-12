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
export function extractRenderableHtml(code: string): string {
  if (!code) return '<div class="p-4 text-slate-400">No code generated yet.</div>';

  // If code is pure HTML
  if (code.trim().startsWith('<') && !code.includes('import ') && !code.includes('export ')) {
    return code;
  }

  // Parse default prop values if present: e.g. title = "...", badge = '...'
  const defaultProps: Record<string, string> = {
    title: 'Intelligent AI Redesign',
    description: 'Automatically elevate your UI with high-contrast typography, balanced spacing, and interactive feedback.',
    badge: 'Pro Feature',
    label: 'Deposit Funds',
    amount: '$48,295.40',
    change: '+$1,420.50 (3.2%) today',
    value: '42.8%',
    subtitle: '16 Cores Online • 3.4 GHz',
  };

  const propMatches = code.matchAll(/([a-zA-Z0-9_]+)\s*=\s*["']([^"']+)["']/g);
  for (const m of propMatches) {
    defaultProps[m[1]] = m[2];
  }

  // Extract content inside return (...) or => (...) or return <tag>...</tag>
  let jsxSnippet = code;
  const returnParen = code.match(/return\s*\(\s*([\s\S]*?)\s*\);?/);
  const arrowParen = code.match(/=>\s*\(\s*([\s\S]*?)\s*\);?/);
  const returnDirect = code.match(/return\s+(<[a-zA-Z][\s\S]*?>[\s\S]*<\/[a-zA-Z0-9]+>);?/);
  const arrowDirect = code.match(/=>\s*(<[a-zA-Z][\s\S]*?>[\s\S]*<\/[a-zA-Z0-9]+>);?/);

  if (returnParen) {
    jsxSnippet = returnParen[1];
  } else if (arrowParen) {
    jsxSnippet = arrowParen[1];
  } else if (returnDirect) {
    jsxSnippet = returnDirect[1];
  } else if (arrowDirect) {
    jsxSnippet = arrowDirect[1];
  } else {
    // Look for outermost JSX element if present
    const firstTag = code.match(/<([a-zA-Z][a-zA-Z0-9]*)\b[\s\S]*<\/\1>/);
    if (firstTag) {
      jsxSnippet = firstTag[0];
    }
  }

  // Clean JSX syntax for HTML browser rendering
  let html = jsxSnippet
    .replace(/className=/g, 'class=')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // remove JSX comments
    .replace(/\{`([\s\S]*?)`\}/g, '$1') // template literals
    .replace(/onClick=\{[^}]*\}/g, '') // strip react onClick handlers
    .replace(/onAction=\{[^}]*\}/g, '')
    .replace(/on[A-Z][a-zA-Z]*=\{[^}]*\}/g, '')
    .replace(/aria-hidden="true"/g, 'aria-hidden="true"')
    .replace(/=\{true\}/g, '="true"')
    .replace(/=\{false\}/g, '="false"')
    .replace(/<>([\s\S]*?)<\/>/g, '$1')
    .trim();

  // Replace prop interpolations like {title}, {title || 'Default'} with values
  for (const [key, val] of Object.entries(defaultProps)) {
    const propRegex = new RegExp(`\\{${key}(?:\\s*\\|\\|\\s*["'][^"']*["'])?\\}`, 'g');
    html = html.replace(propRegex, val);
  }

  // Replace lucide icon tags with stylized modern icon placeholders
  html = html
    .replace(/<Sparkles[^>]*\/>/g, '<span class="inline-block text-cyan-400">✨</span>')
    .replace(/<CheckCircle2[^>]*\/>/g, '<span class="inline-block text-emerald-400">✓</span>')
    .replace(/<Check[^>]*\/>/g, '<span class="inline-block text-emerald-400">✓</span>')
    .replace(/<ArrowUpRight[^>]*\/>/g, '<span class="inline-block text-indigo-400 font-bold">↗</span>')
    .replace(/<ArrowRight[^>]*\/>/g, '<span class="inline-block text-indigo-400 font-bold">→</span>')
    .replace(/<ChevronRight[^>]*\/>/g, '<span class="inline-block text-indigo-300 font-bold">›</span>')
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
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 bg-studio-900/90 rounded-xl border border-studio-800 p-4 font-mono text-xs overflow-auto text-studio-200 leading-relaxed select-text">
              <pre className="whitespace-pre">{redesignedCode}</pre>
            </div>
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

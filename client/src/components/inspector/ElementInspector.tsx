import React, { useState } from 'react';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Sparkles,
  Code2,
  FileCode,
} from 'lucide-react';
import { InteractiveElement } from '../../types';
import { calculateContrast, auditTouchTarget } from '../../utils/wcagUtils';

interface ElementInspectorProps {
  element: InteractiveElement | null;
  onFixAccessibility: () => void;
  matchedFilePath?: string;
  matchedFileContent?: string;
  onOpenCodeEditor?: () => void;
}

export const ElementInspector: React.FC<ElementInspectorProps> = ({
  element,
  onFixAccessibility,
  matchedFilePath,
  matchedFileContent,
  onOpenCodeEditor,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!element) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-studio-400 bg-studio-900/30">
        <Sliders className="w-8 h-8 text-studio-600 mb-2 stroke-1" />
        <p className="text-xs font-medium text-studio-300">No element selected</p>
        <p className="text-[11px] text-studio-500 mt-1 max-w-[200px]">
          Hover and click any component on the canvas or use the Snip tool to inspect styles & WCAG accessibility.
        </p>
      </div>
    );
  }

  const bgColor = element.styles?.backgroundColor || '#ffffff';
  const textColor = element.styles?.textColor || '#111827';
  const contrast = calculateContrast(textColor, bgColor);
  const touchAudit = auditTouchTarget(element.bounds.width, element.bounds.height);

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="h-full flex flex-col bg-studio-900/60 overflow-y-auto overflow-x-hidden select-none divide-y divide-studio-800/80 text-xs">
      {/* Header Info */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-white truncate text-sm">{element.name}</span>
          <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            &lt;{element.tagName}&gt;
          </span>
        </div>
        <p className="text-[11px] font-mono text-studio-400 mt-1 truncate">{element.selector}</p>
        <div className="flex items-center gap-2 mt-2 text-[11px] text-studio-400">
          <span>{element.bounds.width} × {element.bounds.height}px</span>
          <span>•</span>
          <span>x: {element.bounds.x}, y: {element.bounds.y}</span>
        </div>
      </div>

      {/* WCAG 2.2 Accessibility Audit */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-studio-200 flex items-center gap-1.5">
            <span>WCAG 2.2 Audit</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              contrast.score === 'AAA'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : contrast.score === 'AA'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {contrast.score} ({contrast.ratioFormatted})
          </span>
        </div>

        {/* Contrast details */}
        <div className="bg-studio-950 p-2.5 rounded-lg border border-studio-800 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-studio-400">Normal Text (4.5:1)</span>
            <span className="flex items-center gap-1 font-medium">
              {contrast.aaNormal ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span className={contrast.aaNormal ? 'text-emerald-400' : 'text-rose-400'}>
                {contrast.aaNormal ? 'Pass' : 'Fail'}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-studio-400">Enhanced AAA (7.0:1)</span>
            <span className="flex items-center gap-1 font-medium">
              {contrast.aaaNormal ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className={contrast.aaaNormal ? 'text-emerald-400' : 'text-amber-400'}>
                {contrast.aaaNormal ? 'Pass' : 'Low Contrast'}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-studio-800">
            <span className="text-studio-400">Touch Target (≥44px)</span>
            <span className="flex items-center gap-1 font-medium">
              {touchAudit.compliant ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className={touchAudit.compliant ? 'text-emerald-400' : 'text-amber-400'}>
                {touchAudit.compliant ? 'Pass' : 'Too Small'}
              </span>
            </span>
          </div>
        </div>

        {/* Fix Button */}
        {(contrast.score !== 'AAA' || !touchAudit.compliant) && (
          <button
            onClick={onFixAccessibility}
            className="w-full mt-3 flex items-center justify-center gap-1.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-semibold shadow transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI: Fix Accessibility & Contrast</span>
          </button>
        )}
      </div>

      {/* Style & Design Token Extractor */}
      <div className="p-4">
        <span className="font-semibold text-studio-200 block mb-2.5">Design Tokens & Styles</span>

        <div className="space-y-2">
          {/* Colors */}
          <div className="flex items-center justify-between bg-studio-950 p-2 rounded-lg border border-studio-800">
            <div className="flex items-center gap-2">
              <div
                style={{ backgroundColor: bgColor }}
                className="w-4 h-4 rounded border border-studio-700"
              />
              <span className="text-studio-400 text-[11px]">Background</span>
            </div>
            <button
              onClick={() => copyToClipboard(bgColor, 'bg')}
              className="flex items-center gap-1 font-mono text-[11px] text-studio-200 hover:text-white"
            >
              <span>{bgColor}</span>
              {copiedKey === 'bg' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-studio-500" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between bg-studio-950 p-2 rounded-lg border border-studio-800">
            <div className="flex items-center gap-2">
              <div
                style={{ backgroundColor: textColor }}
                className="w-4 h-4 rounded border border-studio-700"
              />
              <span className="text-studio-400 text-[11px]">Text Color</span>
            </div>
            <button
              onClick={() => copyToClipboard(textColor, 'text')}
              className="flex items-center gap-1 font-mono text-[11px] text-studio-200 hover:text-white"
            >
              <span>{textColor}</span>
              {copiedKey === 'text' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-studio-500" />
              )}
            </button>
          </div>

          {/* Classes */}
          {element.className && (
            <div className="bg-studio-950 p-2.5 rounded-lg border border-studio-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-studio-400 uppercase font-semibold">Tailwind Classes</span>
                <button
                  onClick={() => copyToClipboard(element.className || '', 'classes')}
                  className="text-studio-400 hover:text-white"
                >
                  {copiedKey === 'classes' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <p className="font-mono text-[10px] text-indigo-300 break-words leading-relaxed">
                {element.className}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Code Grounding Link */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-studio-200 flex items-center gap-1">
            <FileCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>Workspace Code Match</span>
          </span>
          {matchedFilePath && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Linked to Local File
            </span>
          )}
        </div>

        {matchedFilePath && (
          <div className="p-2 bg-studio-950 border border-emerald-500/30 rounded-lg">
            <p className="font-mono text-[11px] text-emerald-300 truncate" title={matchedFilePath}>
              {matchedFilePath}
            </p>
          </div>
        )}
      </div>

      {/* Component Code Snippet Preview */}
      {(matchedFileContent || element.codeSnippet) && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-studio-200 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Component Code</span>
              {matchedFilePath && (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 py-0.5 rounded font-mono">
                  (local file)
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {onOpenCodeEditor && (
                <button
                  type="button"
                  onClick={onOpenCodeEditor}
                  className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded text-[11px] font-sans transition-colors border border-indigo-500/40"
                  title="Open direct manual code editor"
                >
                  <Code2 className="w-3 h-3" />
                  <span>Edit Code</span>
                </button>
              )}
              <button
                onClick={() => copyToClipboard(matchedFileContent || element.codeSnippet || '', 'snippet')}
                className="flex items-center gap-1 font-mono text-[11px] text-studio-400 hover:text-white"
              >
                {copiedKey === 'snippet' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedKey === 'snippet' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
          <div className="bg-studio-950 p-2.5 rounded-lg border border-studio-800 max-h-48 overflow-y-auto overflow-x-hidden">
            <pre className="font-mono text-[10px] text-studio-300 whitespace-pre-wrap break-all leading-relaxed">
              {matchedFileContent || element.codeSnippet}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

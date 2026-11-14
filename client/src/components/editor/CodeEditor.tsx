import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  FileCode,
  Loader2,
  X,
} from 'lucide-react';

export interface CodeEditorProps {
  filePath?: string;
  initialCode: string;
  onSave: (newCode: string) => Promise<boolean | void>;
  onRevert?: () => Promise<void> | void;
  onCodeChange?: (newCode: string) => void;
  title?: string;
  onClose?: () => void;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  filePath,
  initialCode,
  onSave,
  onRevert,
  onCodeChange,
  title,
  onClose,
  readOnly = false,
}) => {
  const [code, setCode] = useState<string>(initialCode);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when initialCode changes externally (e.g. element selection)
  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  const isDirty = code !== initialCode;

  // Handle Save
  const handleSave = async () => {
    if (isSaving || readOnly) return;
    setIsSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);

    try {
      await onSave(code);
      setSaveMessage('Saved & applied to disk!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save changes');
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Revert
  const handleRevert = async () => {
    if (isSaving) return;
    if (onRevert) {
      try {
        await onRevert();
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to revert');
      }
    }
    setCode(initialCode);
    if (onCodeChange) onCodeChange(initialCode);
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, isSaving, readOnly]);

  // Handle Tab key inside textarea
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newCode);
      if (onCodeChange) onCodeChange(newCode);

      // Restore cursor position after state update
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const lines = code.split('\n');

  return (
    <div className="h-full flex flex-col bg-studio-950 border border-studio-800 rounded-xl overflow-hidden font-mono shadow-2xl">
      {/* Editor Header */}
      <div className="h-10 bg-studio-900/90 border-b border-studio-800 px-3 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="font-semibold text-white truncate text-[11px]" title={filePath || title}>
            {filePath ? filePath.split('/').pop() : title || 'Component Code'}
          </span>
          {/* Saved / Unsaved Status Indicator */}
          {isDirty ? (
            <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Unsaved changes
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded shrink-0">
              <Check className="w-2.5 h-2.5" />
              Saved
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {saveMessage && (
            <span className="text-[10px] text-emerald-400 font-sans">{saveMessage}</span>
          )}
          {errorMessage && (
            <span className="text-[10px] text-rose-400 font-sans flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" />
              {errorMessage}
            </span>
          )}

          {/* Revert Button */}
          {isDirty && (
            <button
              type="button"
              onClick={handleRevert}
              disabled={isSaving}
              className="flex items-center gap-1 px-2 py-1 bg-studio-800 hover:bg-studio-700 text-studio-300 rounded text-[11px] border border-studio-700 transition-colors"
              title="Revert all unsaved changes"
            >
              <RotateCcw className="w-3 h-3 text-studio-400" />
              <span>Revert</span>
            </button>
          )}

          {/* Save & Apply to Disk Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all shadow-sm ${
              isDirty && !isSaving
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                : 'bg-studio-800 text-studio-500 border border-studio-700 cursor-not-allowed'
            }`}
            title="Save & Apply to Disk (Ctrl+S / Cmd+S)"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3 h-3" />
                <span>Save & Apply</span>
              </>
            )}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-studio-400 hover:text-white rounded hover:bg-studio-800 transition-colors"
              title="Close Editor"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Editor Main Textarea with Line Numbers */}
      <div className="flex-1 flex overflow-hidden relative bg-studio-950/80">
        {/* Line Numbers Gutter */}
        <div className="w-10 select-none py-3 bg-studio-900/40 text-studio-600 font-mono text-[11px] text-right pr-2 border-r border-studio-800/60 overflow-hidden shrink-0">
          {lines.map((_, i) => (
            <div key={i} className="leading-5">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Monospace Code Editor Textarea */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (onCodeChange) onCodeChange(e.target.value);
          }}
          onKeyDown={handleTextareaKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          className="flex-1 w-full h-full p-3 bg-transparent text-studio-100 font-mono text-[12px] leading-5 resize-none focus:outline-none select-text whitespace-pre overflow-auto"
          placeholder="// Enter or edit component JSX / TypeScript code here..."
        />
      </div>

      {/* Footer Info Bar */}
      <div className="h-6 bg-studio-900/60 border-t border-studio-800/80 px-3 flex items-center justify-between text-[10px] text-studio-500 select-none">
        <span className="truncate">{filePath || 'Virtual Component Code'}</span>
        <span>Ctrl+S / ⌘S to Save & Apply</span>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  X,
  FileCode,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { computeLineDiff } from '../../utils/diffUtils';

interface PatchReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetFilePath: string;
  originalCode: string;
  newCode: string;
  onApply: (backup: boolean) => Promise<{ success: boolean; message: string; backupPath?: string }>;
  onRollback: () => Promise<{ success: boolean; message: string }>;
}

export const PatchReviewModal: React.FC<PatchReviewModalProps> = ({
  isOpen,
  onClose,
  targetFilePath,
  originalCode,
  newCode,
  onApply,
  onRollback,
}) => {
  const [createBackup, setCreateBackup] = useState<boolean>(true);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastBackupPath, setLastBackupPath] = useState<string | null>(null);

  if (!isOpen) return null;

  const diff = computeLineDiff(originalCode, newCode);

  const handleApply = async () => {
    setIsApplying(true);
    setStatusMessage(null);
    try {
      const res = await onApply(createBackup);
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
        if (res.backupPath) setLastBackupPath(res.backupPath);
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to apply patch' });
    } finally {
      setIsApplying(false);
    }
  };

  const handleRollback = async () => {
    setIsApplying(true);
    setStatusMessage(null);
    try {
      const res = await onRollback();
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
        setLastBackupPath(null);
        setTimeout(() => onClose(), 1200);
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Rollback failed' });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-studio-900 border border-studio-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-studio-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Review & Apply Code Patch</h3>
              <p className="text-[11px] text-studio-400 font-mono truncate max-w-md">
                {targetFilePath}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-studio-400 hover:text-white hover:bg-studio-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diff Stats Banner */}
        <div className="px-4 py-2 bg-studio-950 border-b border-studio-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-mono font-medium">+{diff.additionsCount} lines added</span>
            <span className="text-rose-400 font-mono font-medium">-{diff.deletionsCount} lines removed</span>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-studio-300">
            <input
              type="checkbox"
              checked={createBackup}
              onChange={(e) => setCreateBackup(e.target.checked)}
              className="rounded bg-studio-800 border-studio-700 text-indigo-600 focus:ring-0"
            />
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Create safety backup (.bak)</span>
          </label>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`px-4 py-2.5 text-xs flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-300 border-b border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border-b border-rose-500/30'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Diff preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-studio-950/70 font-mono text-xs select-text">
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
                  <td className="w-8 px-2 py-0.5 text-right text-studio-600 select-none border-r border-studio-800 text-[10px]">
                    {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : line.newLineNumber}
                  </td>
                  <td className="px-3 py-0.5 whitespace-pre font-mono text-[11px]">{line.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-studio-800 flex items-center justify-between bg-studio-900">
          <div>
            <button
              onClick={handleRollback}
              disabled={isApplying}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-studio-800 hover:bg-studio-700 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors"
              title="Revert this file from the most recent backup"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Revert / Rollback</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-studio-800 hover:bg-studio-700 text-studio-300 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying || !newCode.trim()}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isApplying ? 'Applying Patch...' : 'Apply Patch to File'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

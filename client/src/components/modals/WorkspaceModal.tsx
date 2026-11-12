import React, { useState } from 'react';
import {
  X,
  FolderGit2,
  Search,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Folder,
} from 'lucide-react';
import { api } from '../../services/api';
import { WorkspaceFile, WorkspaceSearchResult, InteractiveElement } from '../../types';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  onPathChange: (newPath: string) => void;
  selectedElement: InteractiveElement | null;
  onSelectMatchedFile: (filePath: string, content: string) => void;
}

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
  isOpen,
  onClose,
  currentPath,
  onPathChange,
  selectedElement,
  onSelectMatchedFile,
}) => {
  const [inputPath, setInputPath] = useState<string>(currentPath);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [matches, setMatches] = useState<WorkspaceSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && inputPath) {
      handleScan(inputPath);
    }
  }, [isOpen, selectedElement]);

  if (!isOpen) return null;

  const handleScan = async (targetPath = inputPath) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const fileList = await api.scanWorkspace(targetPath);
      setFiles(fileList);
      onPathChange(targetPath);

      // If an element is selected, automatically perform search
      if (selectedElement) {
        const results = await api.searchWorkspace(targetPath, {
          text: selectedElement.name,
          className: selectedElement.className,
          tagName: selectedElement.tagName,
        });
        setMatches(results);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to scan workspace directory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectMatch = async (match: WorkspaceSearchResult) => {
    try {
      const content = await api.readFile(match.filePath);
      onSelectMatchedFile(match.filePath, content);
      onClose();
    } catch (err: any) {
      setErrorMessage(`Failed to read file: ${err.message}`);
    }
  };

  const handleSelectFile = async (file: WorkspaceFile) => {
    if (file.isDirectory) return;
    try {
      const content = await api.readFile(file.path);
      onSelectMatchedFile(file.path, content);
      onClose();
    } catch (err: any) {
      setErrorMessage(`Failed to read file: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-studio-900 border border-studio-800 rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-studio-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Link Local Codebase</h3>
              <p className="text-[11px] text-studio-400">
                Connect your repository to locate components and apply safe diff patches
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

        {/* Directory Input */}
        <div className="p-4 border-b border-studio-800 flex gap-2">
          <input
            type="text"
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            placeholder="/absolute/path/to/your/project"
            className="flex-1 bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={() => handleScan()}
            disabled={isLoading || !inputPath.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow transition-all flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Scanning...' : 'Scan'}</span>
          </button>
        </div>

        {/* Quick sample workspace preset */}
        <div className="px-4 py-2 bg-studio-950/60 border-b border-studio-800 flex items-center justify-between text-xs text-studio-400">
          <span>Quick Preset:</span>
          <button
            onClick={() => {
              const demoPath = '/home/saurabh/coding/visual_uiai/sample-workspace';
              setInputPath(demoPath);
              handleScan(demoPath);
            }}
            className="text-indigo-400 hover:underline text-[11px] font-mono"
          >
            Load built-in `sample-workspace`
          </button>
        </div>

        {errorMessage && (
          <div className="px-4 py-2 bg-rose-500/15 text-rose-300 text-xs flex items-center gap-2 border-b border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content Tabs / Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Matched components */}
          {matches.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-studio-200 block mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Component Matches for Selected Element ({matches.length})</span>
              </span>
              <div className="space-y-1.5">
                {matches.map((m, i) => (
                  <div
                    key={i}
                    onClick={() => handleSelectMatch(m)}
                    className="p-2.5 bg-studio-950 hover:bg-indigo-600/10 border border-studio-800 hover:border-indigo-500/50 rounded-xl cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-indigo-400 font-medium">{m.relativePath}:{m.line}</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                        {m.confidence}% match
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-studio-300 mt-1 truncate">{m.matchSnippet}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scanned files tree */}
          {files.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-studio-200 block mb-2">
                Scanned Source Files ({files.filter((f) => !f.isDirectory).length})
              </span>
              <div className="space-y-1">
                {files
                  .filter((f) => !f.isDirectory)
                  .map((file, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectFile(file)}
                      className="p-2 bg-studio-950/60 hover:bg-studio-800 rounded-lg border border-studio-800/80 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileCode className="w-3.5 h-3.5 text-studio-400" />
                        <span className="font-mono text-studio-200">{file.relativePath}</span>
                      </div>
                      <span className="text-[10px] text-studio-500 font-mono">
                        {Math.round((file.size || 0) / 1024 * 10) / 10} KB
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-studio-800 flex justify-end bg-studio-900">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-studio-800 hover:bg-studio-700 text-studio-300 rounded-lg text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

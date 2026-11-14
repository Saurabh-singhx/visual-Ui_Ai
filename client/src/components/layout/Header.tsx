import React from 'react';
import {
  Sparkles,
  Globe,
  Smartphone,
  Monitor,
  Crop,
  FolderGit2,
  Cpu,
  MousePointer,
} from 'lucide-react';
import { PlatformType } from '../../types';

interface HeaderProps {
  platform: PlatformType;
  onPlatformChange: (p: PlatformType) => void;
  isSnipMode: boolean;
  onToggleSnipMode: () => void;
  onToggleSelectMode?: () => void;
  workspacePath: string;
  aiProviderName: string;
}

export const Header: React.FC<HeaderProps> = ({
  platform,
  onPlatformChange,
  isSnipMode,
  onToggleSnipMode,
  onToggleSelectMode,
  workspacePath,
  aiProviderName,
}) => {
  return (
    <header className="h-14 bg-studio-900 border-b border-studio-800 flex items-center justify-between px-4 z-40 select-none">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 p-0.5 shadow-md shadow-indigo-500/20">
          <div className="w-full h-full bg-studio-950 rounded-[6px] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white tracking-tight">Visual UI-AI Studio</span>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
              v1.0
            </span>
          </div>
          <span className="text-[11px] text-studio-400">Universal Component Redesign & Code Grounding</span>
        </div>
      </div>

      {/* Platform Switcher Tabs */}
      <div className="flex items-center bg-studio-950 p-1 rounded-lg border border-studio-800">
        <button
          onClick={() => onPlatformChange('web')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
            platform === 'web'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-studio-400 hover:text-white hover:bg-studio-800/50'
          }`}
          title="Inspect Web Apps via DOM & React Fiber"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Web</span>
        </button>

        <button
          onClick={() => onPlatformChange('mobile')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
            platform === 'mobile'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-studio-400 hover:text-white hover:bg-studio-800/50'
          }`}
          title="Inspect Mobile Apps via Android ADB / UIAutomator"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Mobile (ADB)</span>
        </button>

        <button
          onClick={() => onPlatformChange('desktop')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
            platform === 'desktop'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-studio-400 hover:text-white hover:bg-studio-800/50'
          }`}
          title="Inspect Desktop Apps via Accessibility Tree & Vision"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Desktop</span>
        </button>

        <button
          onClick={() => onPlatformChange('workspace')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
            platform === 'workspace'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-studio-400 hover:text-white hover:bg-studio-800/50'
          }`}
          title="Inspect Real Workspace Components"
        >
          <FolderGit2 className="w-3.5 h-3.5" />
          <span>Workspace</span>
        </button>
      </div>

      {/* Action Tools */}
      <div className="flex items-center gap-2">
        {/* Universal Element Selector Tool */}
        <button
          onClick={onToggleSelectMode ? onToggleSelectMode : () => isSnipMode && onToggleSnipMode()}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            !isSnipMode
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-600/30'
              : 'bg-studio-800 hover:bg-studio-700 text-studio-300 border-studio-700'
          }`}
          title="Element Selector: Click any element to select and inspect"
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span>Element Selector</span>
        </button>

        {/* Universal Snip Tool */}
        <button
          onClick={onToggleSnipMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            isSnipMode
              ? 'bg-brand-warning text-black border-yellow-300 ring-2 ring-yellow-400/50 animate-pulse'
              : 'bg-studio-800 hover:bg-studio-700 text-studio-200 border-studio-700'
          }`}
          title="Freehand Drag-to-Snip any element or region"
        >
          <Crop className="w-3.5 h-3.5" />
          <span>{isSnipMode ? 'Click & Drag to Snip...' : 'Snip Element'}</span>
        </button>

        {/* Workspace Path Badge if available */}
        {workspacePath && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 bg-studio-800/60 border border-studio-700/60 rounded-lg text-xs text-studio-300"
            title={`Workspace: ${workspacePath}`}
          >
            <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="max-w-[120px] truncate">{workspacePath.split('/').pop()}</span>
          </div>
        )}

        {/* AI Provider Status */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-studio-950 rounded-lg border border-studio-800 text-[11px] text-studio-400">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-studio-300 font-mono font-medium">{aiProviderName}</span>
        </div>
      </div>
    </header>
  );
};

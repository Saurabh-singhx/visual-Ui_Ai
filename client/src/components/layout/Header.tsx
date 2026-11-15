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
  isSkillMode?: boolean;
  targetDevice?: 'mobile' | 'tablet' | 'desktop' | null;
  targetPlatform?: PlatformType | null;
}

export const Header: React.FC<HeaderProps> = ({
  platform,
  onPlatformChange,
  isSnipMode,
  onToggleSnipMode,
  onToggleSelectMode,
  workspacePath,
  aiProviderName,
  isSkillMode = false,
  targetDevice = null,
  targetPlatform = null,
}) => {
  const platformTabs = [
    { id: 'web' as PlatformType, label: 'Web', icon: Globe, title: 'Inspect Web Apps via DOM & React Fiber' },
    { id: 'mobile' as PlatformType, label: 'Mobile (ADB)', icon: Smartphone, title: 'Inspect Mobile Apps via Android ADB / UIAutomator' },
    { id: 'desktop' as PlatformType, label: 'Desktop', icon: Monitor, title: 'Inspect Desktop Apps via Accessibility Tree & Vision' },
    { id: 'workspace' as PlatformType, label: 'Workspace', icon: FolderGit2, title: 'Inspect Real Workspace Components' },
  ];

  let effectiveTargetPlatform: PlatformType = 'web';
  if (targetPlatform) {
    effectiveTargetPlatform = targetPlatform;
  } else if (targetDevice === 'mobile') {
    effectiveTargetPlatform = 'mobile';
  } else if (targetDevice === 'desktop') {
    effectiveTargetPlatform = 'desktop';
  } else {
    effectiveTargetPlatform = platform;
  }

  const visibleTabs = isSkillMode
    ? platformTabs.filter((t) => t.id === effectiveTargetPlatform)
    : platformTabs;

  return (
    <header className="h-14 bg-black border-b border-white/15 flex items-center justify-between px-3 sm:px-4 z-40 select-none overflow-x-auto scrollbar-none">
      {/* Brand */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-400 p-0.5 shadow-md shadow-orange-600/20">
          <div className="w-full h-full bg-[#0d0d0d] rounded-[6px] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-orange-400" />
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white tracking-tight">Visual UI-AI Studio</span>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded border border-orange-500/30">
              v1.0
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 hidden md:inline">Universal Component Redesign & Code Grounding</span>
        </div>
      </div>

      {/* Platform Switcher Tabs */}
      <div className="flex items-center bg-[#0d0d0d] p-1 rounded-lg border border-white/15 shrink-0 mx-2">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = platform === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onPlatformChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
                isActive
                  ? 'bg-orange-600 text-white font-medium shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
              title={tab.title}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
        {isSkillMode && (
          <span className="ml-1.5 px-2 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded text-[10px] font-semibold uppercase">
            Skill Locked
          </span>
        )}
      </div>

      {/* Action Tools */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Universal Element Selector Tool */}
        <button
          onClick={onToggleSelectMode ? onToggleSelectMode : () => isSnipMode && onToggleSnipMode()}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shrink-0 ${
            !isSnipMode
              ? 'bg-orange-600 text-white border-orange-500 shadow-sm shadow-orange-600/30'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
          }`}
          title="Element Selector: Click any element to select and inspect"
        >
          <MousePointer className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Element Selector</span>
        </button>

        {/* Universal Snip Tool */}
        <button
          onClick={onToggleSnipMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shrink-0 ${
            isSnipMode
              ? 'bg-orange-500 text-black border-orange-400 ring-2 ring-orange-500/50'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
          }`}
          title="Freehand Drag-to-Snip any element or region"
        >
          <Crop className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{isSnipMode ? 'Click & Drag to Snip...' : 'Snip Element'}</span>
        </button>

        {/* Workspace Path Badge if available */}
        {workspacePath && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0d0d0d] border border-white/15 rounded-lg text-xs text-zinc-300 shrink-0"
            title={`Workspace: ${workspacePath}`}
          >
            <FolderGit2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span className="max-w-[120px] truncate">{workspacePath.split('/').pop()}</span>
          </div>
        )}

        {/* AI Provider Status */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-[#0d0d0d] rounded-lg border border-white/15 text-[11px] text-zinc-400 shrink-0">
          <Cpu className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span className="text-zinc-300 font-mono font-medium">{aiProviderName}</span>
        </div>
      </div>
    </header>
  );
};

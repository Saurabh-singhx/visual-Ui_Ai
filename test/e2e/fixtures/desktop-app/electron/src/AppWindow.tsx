import React, { useState } from 'react';
import { app } from 'electron';

export const AppWindow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'editor' | 'terminal' | 'settings'>('editor');

  return (
    <div className="desktop-window-container flex flex-col h-screen bg-neutral-950 text-neutral-100">
      <div className="desktop-toolbar flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-neutral-800">
        <div className="tabs flex space-x-2">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-1 text-xs rounded font-medium ${
              activeTab === 'editor' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Workspace Editor
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-3 py-1 text-xs rounded font-medium ${
              activeTab === 'terminal' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Integrated Terminal
          </button>
        </div>
        <div className="status-badge text-xs text-emerald-400 font-mono">
          Ready
        </div>
      </div>
      <div className="desktop-content flex-1 p-6">
        <div className="content-card bg-neutral-900 border border-neutral-800 rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-2">Desktop Session Active</h2>
          <p className="text-sm text-neutral-400">
            Running natively within the Electron desktop execution frame.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AppWindow;

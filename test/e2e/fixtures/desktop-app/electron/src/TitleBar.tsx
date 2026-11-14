import React from 'react';
import { ipcRenderer } from 'electron';

export interface TitleBarProps {
  title?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ title = 'Visual UI Desktop App' }) => {
  const handleMinimize = () => {
    ipcRenderer.send('window-minimize');
  };

  const handleMaximize = () => {
    ipcRenderer.send('window-maximize');
  };

  const handleClose = () => {
    ipcRenderer.send('window-close');
  };

  return (
    <div className="title-bar flex items-center justify-between h-9 bg-neutral-900 text-neutral-200 select-none px-3 border-b border-neutral-800">
      <div className="window-title text-xs font-medium tracking-wide flex items-center space-x-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
        <span>{title}</span>
      </div>
      <div className="window-controls flex items-center space-x-1">
        <button
          id="btn-window-minimize"
          onClick={handleMinimize}
          className="w-7 h-6 flex items-center justify-center hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
          aria-label="Minimize"
        >
          &#8722;
        </button>
        <button
          id="btn-window-maximize"
          onClick={handleMaximize}
          className="w-7 h-6 flex items-center justify-center hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
          aria-label="Maximize"
        >
          &#9633;
        </button>
        <button
          id="btn-window-close"
          onClick={handleClose}
          className="w-7 h-6 flex items-center justify-center hover:bg-red-600 rounded text-neutral-400 hover:text-white"
          aria-label="Close"
        >
          &#10005;
        </button>
      </div>
    </div>
  );
};

export default TitleBar;

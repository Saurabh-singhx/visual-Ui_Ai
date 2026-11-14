import React from 'react';
import { appWindow } from '@tauri-apps/api';

export const WindowControls: React.FC = () => {
  const minimize = async () => {
    await appWindow.minimize();
  };

  const toggleMaximize = async () => {
    await appWindow.toggleMaximize();
  };

  const close = async () => {
    await appWindow.close();
  };

  return (
    <div className="tauri-titlebar flex justify-between items-center h-8 bg-zinc-900 text-zinc-100 select-none px-2" data-tauri-drag-region>
      <div className="title text-xs font-semibold px-2">Tauri Native Window</div>
      <div className="controls flex space-x-1">
        <button
          onClick={minimize}
          className="w-6 h-6 flex items-center justify-center hover:bg-zinc-800 rounded text-zinc-400"
        >
          &#8722;
        </button>
        <button
          onClick={toggleMaximize}
          className="w-6 h-6 flex items-center justify-center hover:bg-zinc-800 rounded text-zinc-400"
        >
          &#9633;
        </button>
        <button
          onClick={close}
          className="w-6 h-6 flex items-center justify-center hover:bg-red-700 rounded text-zinc-400"
        >
          &#10005;
        </button>
      </div>
    </div>
  );
};

export default WindowControls;

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api';

export const SettingsDialog: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [hardwareAcceleration, setHardwareAcceleration] = useState(true);

  return (
    <div className="settings-dialog p-6 bg-zinc-900 text-zinc-100 rounded-xl shadow-2xl max-w-md mx-auto border border-zinc-800">
      <h3 className="text-lg font-bold mb-4">Desktop Settings</h3>
      <div className="setting-group mb-4">
        <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">
          Window Theme
        </label>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
          className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-sm text-zinc-200"
        >
          <option value="dark">Dark Theme</option>
          <option value="light">Light Theme</option>
        </select>
      </div>
      <div className="setting-toggle flex items-center justify-between mb-6">
        <span className="text-sm">Hardware Acceleration</span>
        <input
          type="checkbox"
          checked={hardwareAcceleration}
          onChange={(e) => setHardwareAcceleration(e.target.checked)}
          className="toggle-checkbox h-4 w-4 rounded bg-zinc-800 border-zinc-600 text-indigo-600"
        />
      </div>
      <div className="actions flex justify-end space-x-2">
        <button className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded">
          Save Settings
        </button>
      </div>
    </div>
  );
};

export default SettingsDialog;

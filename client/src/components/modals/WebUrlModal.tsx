import React, { useState } from 'react';
import { X, Globe, ArrowRight, Sparkles } from 'lucide-react';

interface WebUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadUrl: (url: string) => void;
}

export const WebUrlModal: React.FC<WebUrlModalProps> = ({
  isOpen,
  onClose,
  onLoadUrl,
}) => {
  const [url, setUrl] = useState<string>('http://localhost:3000');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onLoadUrl(url.trim());
    onClose();
  };

  const presets = [
    { label: 'Next.js Dev Server', url: 'http://localhost:3000' },
    { label: 'Vite / React Dev Server', url: 'http://localhost:5173' },
    { label: 'Vue / Angular Server', url: 'http://localhost:8080' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-studio-900 border border-studio-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-studio-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Load Web Application</h3>
              <p className="text-[11px] text-studio-400">
                Connect your running frontend dev server for live DOM inspection
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-studio-300 block mb-1.5">
              Application URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:3000"
              className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <span className="text-[11px] text-studio-400 block mb-2">Common Local Dev Ports:</span>
            <div className="space-y-1.5">
              {presets.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setUrl(p.url)}
                  className="w-full text-left p-2 rounded-lg bg-studio-950 hover:bg-studio-800 border border-studio-800/80 text-xs flex items-center justify-between text-studio-300 hover:text-white transition-colors"
                >
                  <span>{p.label}</span>
                  <span className="font-mono text-[11px] text-cyan-400">{p.url}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-studio-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-studio-800 hover:bg-studio-700 text-studio-300 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-all"
            >
              <span>Connect</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React from 'react';

export const MetricWidget: React.FC = () => {
  return (
    <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 text-slate-100">
      <div className="text-xs text-slate-400">CPU Usage</div>
      <div className="text-3xl font-mono font-bold mt-1 text-emerald-400">42.8%</div>
      <div className="text-xs text-slate-400 mt-2">16 Cores Online • 3.4 GHz</div>
    </div>
  );
};

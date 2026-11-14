import React from 'react';

export const MetricCard: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  return (
    <div className="metric-card p-4 bg-white border border-gray-200 rounded-lg">
      <div className="text-3xl font-extrabold text-blue-600">{value}</div>
      <div className="text-xs uppercase text-gray-500 tracking-wider mt-1">{label}</div>
    </div>
  );
};

export default MetricCard;

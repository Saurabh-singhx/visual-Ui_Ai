import React from 'react';

interface CardProps {
  title: string;
  description: string;
  badge?: string;
  onAction?: () => void;
}

export const FeatureCard: React.FC<CardProps> = ({
  title,
  description,
  badge = 'New',
  onAction,
}) => {
  return (
    <div className="p-4 bg-gray-100 rounded border border-gray-300 text-black">
      <span className="text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-700 font-medium">
        {badge}
      </span>
      <h3 className="text-base font-bold mt-2 text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-1 leading-relaxed">
        {description}
      </p>
      <button
        onClick={onAction}
        className="mt-3 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700"
      >
        Learn more
      </button>
    </div>
  );
};

import React from "react";

export interface BadgeProps {
  label?: string;
  disabled?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ label = "Badge", disabled = false }) => {
  return (
    <div className="ui-badge inline-flex items-center space-x-2">
      <span className="font-medium text-gray-700">{label}</span>
      <button disabled={disabled} className="px-3 py-1.5 border border-gray-300 rounded text-sm">
        Badge Element
      </button>
    </div>
  );
};

export default Badge;

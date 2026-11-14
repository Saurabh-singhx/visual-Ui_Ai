import React from "react";

export interface AvatarProps {
  label?: string;
  disabled?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ label = "Avatar", disabled = false }) => {
  return (
    <div className="ui-avatar inline-flex items-center space-x-2">
      <span className="font-medium text-gray-700">{label}</span>
      <button disabled={disabled} className="px-3 py-1.5 border border-gray-300 rounded text-sm">
        Avatar Element
      </button>
    </div>
  );
};

export default Avatar;

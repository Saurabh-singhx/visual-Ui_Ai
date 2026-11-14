import React from "react";

export interface SwitchProps {
  label?: string;
  disabled?: boolean;
}

export const Switch: React.FC<SwitchProps> = ({ label = "Switch", disabled = false }) => {
  return (
    <div className="ui-switch inline-flex items-center space-x-2">
      <span className="font-medium text-gray-700">{label}</span>
      <button disabled={disabled} className="px-3 py-1.5 border border-gray-300 rounded text-sm">
        Switch Element
      </button>
    </div>
  );
};

export default Switch;

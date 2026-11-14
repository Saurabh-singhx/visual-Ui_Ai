import React from "react";

export interface CheckboxProps {
  label?: string;
  disabled?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label = "Checkbox", disabled = false }) => {
  return (
    <div className="ui-checkbox inline-flex items-center space-x-2">
      <span className="font-medium text-gray-700">{label}</span>
      <button disabled={disabled} className="px-3 py-1.5 border border-gray-300 rounded text-sm">
        Checkbox Element
      </button>
    </div>
  );
};

export default Checkbox;

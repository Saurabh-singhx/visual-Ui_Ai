import React from "react";

export interface RadioGroupProps {
  label?: string;
  disabled?: boolean;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({ label = "RadioGroup", disabled = false }) => {
  return (
    <div className="ui-radiogroup inline-flex items-center space-x-2">
      <span className="font-medium text-gray-700">{label}</span>
      <button disabled={disabled} className="px-3 py-1.5 border border-gray-300 rounded text-sm">
        RadioGroup Element
      </button>
    </div>
  );
};

export default RadioGroup;

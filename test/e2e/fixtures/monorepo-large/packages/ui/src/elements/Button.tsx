import React from "react";

export interface ButtonProps {
  label?: string;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ label = "Button", disabled = false }) => {
  return (
    <div className="ui-button inline-flex items-center space-x-2">
      <span className="font-medium text-gray-700">{label}</span>
      <button disabled={disabled} className="px-3 py-1.5 border border-gray-300 rounded text-sm">
        Button Element
      </button>
    </div>
  );
};

export default Button;

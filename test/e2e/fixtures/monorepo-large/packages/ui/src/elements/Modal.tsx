import React from "react";

export interface ModalProps {
  label?: string;
  disabled?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ label = "Modal", disabled = false }) => {
  return (
    <div className="ui-modal inline-flex items-center space-x-2">
      <span className="font-medium text-gray-700">{label}</span>
      <button disabled={disabled} className="px-3 py-1.5 border border-gray-300 rounded text-sm">
        Modal Element
      </button>
    </div>
  );
};

export default Modal;

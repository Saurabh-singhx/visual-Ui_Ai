import React from 'react';

export interface PrimaryButtonProps {
  label: string;
  onClick?: () => void;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({ label, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium shadow-sm transition"
    >
      {label}
    </button>
  );
};

export default PrimaryButton;

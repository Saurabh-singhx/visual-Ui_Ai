import React from "react";

export interface CardProps {
  label?: string;
  disabled?: boolean;
}

export const Card: React.FC<CardProps> = ({ label = "Card", disabled = false }) => {
  return (
    <div className="ui-card inline-flex items-center space-x-2">
      <span className="font-medium text-gray-700">{label}</span>
      <button disabled={disabled} className="px-3 py-1.5 border border-gray-300 rounded text-sm">
        Card Element
      </button>
    </div>
  );
};

export default Card;

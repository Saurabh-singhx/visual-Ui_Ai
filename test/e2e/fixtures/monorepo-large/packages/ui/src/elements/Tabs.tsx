import React from "react";

export interface TabsProps {
  label?: string;
  disabled?: boolean;
}

export const Tabs: React.FC<TabsProps> = ({ label = "Tabs", disabled = false }) => {
  return (
    <div className="ui-tabs inline-flex items-center space-x-2">
      <span className="font-medium text-gray-700">{label}</span>
      <button disabled={disabled} className="px-3 py-1.5 border border-gray-300 rounded text-sm">
        Tabs Element
      </button>
    </div>
  );
};

export default Tabs;

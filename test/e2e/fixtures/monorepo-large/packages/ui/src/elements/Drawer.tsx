import React from "react";

export interface DrawerProps {
  label?: string;
  disabled?: boolean;
}

export const Drawer: React.FC<DrawerProps> = ({ label = "Drawer", disabled = false }) => {
  return (
    <div className="ui-drawer inline-flex items-center space-x-2">
      <span className="font-medium text-gray-700">{label}</span>
      <button disabled={disabled} className="px-3 py-1.5 border border-gray-300 rounded text-sm">
        Drawer Element
      </button>
    </div>
  );
};

export default Drawer;

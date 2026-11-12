import React from 'react';

export const TopNavbar: React.FC = () => {
  return (
    <nav className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
      <div className="font-bold text-lg text-blue-600">AcmeCloud</div>
      <div className="flex gap-4 text-sm font-medium text-gray-600">
        <a href="#features" className="hover:text-blue-600">Features</a>
        <a href="#pricing" className="hover:text-blue-600">Pricing</a>
        <a href="#docs" className="hover:text-blue-600">Docs</a>
      </div>
      <button className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700">
        Sign In
      </button>
    </nav>
  );
};

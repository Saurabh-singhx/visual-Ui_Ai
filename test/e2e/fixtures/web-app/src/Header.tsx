import React, { useState } from 'react';

export interface HeaderProps {
  title?: string;
  user?: { name: string; avatarUrl?: string };
  onMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Application Dashboard',
  user = { name: 'Alex Smith' },
  onMenuToggle,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => {
    setIsOpen(!isOpen);
    if (onMenuToggle) onMenuToggle();
  };

  return (
    <header className="w-full bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-4">
        <button
          id="nav-toggle-button"
          onClick={toggle}
          className="p-2 text-gray-600 hover:text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Toggle navigation menu"
        >
          <span className="sr-only">Toggle menu</span>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          {title}
        </h1>
      </div>
      <nav className="flex items-center space-x-3">
        <span className="text-sm text-gray-500">Welcome, {user.name}</span>
        <button
          id="profile-action-button"
          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition duration-150"
        >
          Profile
        </button>
      </nav>
    </header>
  );
};

export default Header;

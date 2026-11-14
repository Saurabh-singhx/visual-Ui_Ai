import React from "react";

export interface HeroBannerProps {
  title?: string;
  className?: string;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ title = "HeroBanner", className = "" }) => {
  return (
    <div className={`web-herobanner p-4 bg-white rounded-lg shadow-sm ${className}`}>
      <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
      <p className="text-sm text-gray-600 mb-4">Web component for HeroBanner</p>
      <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        Action HeroBanner
      </button>
    </div>
  );
};

export default HeroBanner;

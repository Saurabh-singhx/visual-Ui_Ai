import React from 'react';

export function Card({ title = 'Feature Card', description = 'A description of this component.', icon = 'star' }) {
  return (
    <div className="card-container max-w-sm rounded-lg overflow-hidden shadow-md bg-white border border-gray-100 p-5 hover:shadow-lg transition-shadow">
      <div className="card-header flex items-center space-x-3 mb-3">
        <span className="card-icon p-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold">
          {icon}
        </span>
        <h3 className="card-title text-lg font-bold text-gray-900">{title}</h3>
      </div>
      <p className="card-body text-gray-600 text-sm leading-relaxed mb-4">
        {description}
      </p>
      <div className="card-actions flex justify-end space-x-2">
        <button className="btn-secondary px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50">
          Dismiss
        </button>
        <button className="btn-action px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700">
          Learn More
        </button>
      </div>
    </div>
  );
}

export default Card;

import React from 'react';

export default function TabNav({ activeTab, onTabChange }) {
  return (
    <header className="w-full border-b border-[var(--border-card)] bg-[rgba(10,10,15,0.8)] backdrop-blur-md sticky top-0 z-50 px-6">
      <div className="flex items-center gap-8 h-14">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <span className="font-semibold text-[15px] tracking-tight">Supply Chain Risk Intelligence</span>
        </div>
        <nav className="flex gap-4 h-full items-center">
          <button
            onClick={() => onTabChange('suppliers')}
            className={`h-full px-1 border-b-2 font-medium text-sm transition-colors transition-border duration-150 ease-in-out cursor-pointer ${
              activeTab === 'suppliers'
                ? 'text-white border-accent-blue'
                : 'text-text-secondary border-transparent hover:text-text-primary'
            }`}
          >
            My Suppliers
          </button>
          <button
            onClick={() => onTabChange('risk')}
            className={`h-full px-1 border-b-2 font-medium text-sm transition-colors transition-border duration-150 ease-in-out cursor-pointer ${
              activeTab === 'risk'
                ? 'text-white border-accent-blue'
                : 'text-text-secondary border-transparent hover:text-text-primary'
            }`}
          >
            Risk Intelligence
          </button>
        </nav>
      </div>
    </header>
  );
}

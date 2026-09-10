import React from 'react';
import {
  LayoutDashboard,
  FileSearch,
  Sparkles,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'evidence', label: 'Evidence', icon: FileSearch },
  { id: 'ai_analysis', label: 'AI Analysis', icon: Sparkles },
  { id: 'fraud', label: 'Fraud Indicators', icon: ShieldAlert },
  { id: 'damage', label: 'Damage Assessment', icon: AlertTriangle }
];

const ClaimTabs = ({ activeTab, onSelectTab }) => {
  return (
    <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0 md:bg-white md:rounded-lg md:border md:shadow-sm">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 md:px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ClaimTabs;

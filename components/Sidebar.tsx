
import React from 'react';
import { AppView } from '../types';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  onSave?: () => void;
  isSaving?: boolean;
  lastSaved?: Date | null;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, onSave, isSaving, lastSaved }) => {
  const menuItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: 'fa-chart-pie' },
    { id: AppView.PROSPECTS, label: 'Prospects', icon: 'fa-users' },
    { id: AppView.WAR_ROOM, label: 'War Room', icon: 'fa-dungeon' },
    { id: AppView.OUTREACH, label: 'Outreach', icon: 'fa-paper-plane' },
    { id: AppView.INBOX, label: 'Inbox', icon: 'fa-envelope' },
    { id: AppView.SETTINGS, label: 'Settings', icon: 'fa-cog' },
  ];

  return (
    <aside className="w-64 bg-white/80 backdrop-blur-md border-r border-slate-200 flex flex-col h-full z-20 transition-all duration-300">
      <div className="p-6 flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
          <i className="fas fa-bolt text-lg"></i>
        </div>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">NEXUS-SDR</h1>
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">AI Sales Agent</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm group ${
              currentView === item.id 
                ? 'bg-gradient-to-r from-indigo-50 to-white text-indigo-700 shadow-sm border border-indigo-100' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
            }`}
          >
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                currentView === item.id ? 'bg-indigo-100 text-indigo-600' : 'bg-transparent text-slate-400 group-hover:text-slate-600'
            }`}>
                <i className={`fas ${item.icon} text-sm`}></i>
            </span>
            <span>{item.label}</span>
            {currentView === item.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></div>}
          </button>
        ))}
      </nav>

      <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse"></div>
            </div>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">System Online</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">v2.4.0</span>
        </div>
        
        <button 
            onClick={onSave}
            disabled={isSaving}
            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm border ${
                isSaving 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-wait' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow'
            }`}
        >
            {isSaving ? (
                <><i className="fas fa-circle-notch fa-spin"></i> Syncing...</>
            ) : (
                <><i className="fas fa-cloud-upload-alt text-indigo-500"></i> Sync to Cloud</>
            )}
        </button>
        
        {lastSaved && (
            <div className="text-center">
                <span className="text-[9px] text-slate-400 font-medium">
                    Auto-saved: {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
            </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

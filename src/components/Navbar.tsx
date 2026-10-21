import React from 'react';
import { 
  Bus, ShieldCheck, Database, Calendar, Building2, UserCheck, 
  RefreshCw, CheckCircle, AlertTriangle 
} from 'lucide-react';
import { SchoolConfig, CampusId, UserRole, CampusMaster } from '../types/index.js';
import { SheetsStatus } from '../services/api.js';

interface NavbarProps {
  config: SchoolConfig;
  campuses?: CampusMaster[];
  currentCampus: CampusId | 'all';
  onCampusChange: (campus: CampusId | 'all') => void;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  sheetsStatus: SheetsStatus | null;
  onSyncSheets: () => void;
  isSyncing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  config,
  campuses = [],
  currentCampus,
  onCampusChange,
  currentRole,
  onRoleChange,
  sheetsStatus,
  onSyncSheets,
  isSyncing,
}) => {
  const campusList = campuses.length > 0 ? campuses : (config.campuses || []);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & School Name */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
                {config.schoolName || 'School Transport ERP'}
              </h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                Transport System
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {config.tagline ? `${config.tagline} • ` : ''}Academic Session: {config.currentAcademicSession || '2026-2027'}
            </p>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Google Sheets Status Pill */}
          <button
            onClick={onSyncSheets}
            disabled={isSyncing}
            title={sheetsStatus?.lastError || 'Google Sheets Service Account sync'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              sheetsStatus?.isConnected
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-current" />
            <span className="hidden md:inline font-semibold">Sheets DB:</span>
            <span>
              {sheetsStatus?.isConnected ? 'Live Connected' : 'Resilient State (Sync Ready)'}
            </span>
            <RefreshCw className={`w-3 h-3 ml-1 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>

          {/* Campus Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg p-1 text-xs">
            <Building2 className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
            <select
              value={currentCampus}
              onChange={(e) => onCampusChange(e.target.value as CampusId | 'all')}
              className="bg-transparent font-medium text-slate-700 focus:outline-hidden pr-2 cursor-pointer"
            >
              <option value="all">All Campuses</option>
              {campusList.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* User Role Switcher (3 Final Multi-Login Designations) */}
          <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg p-1 text-xs">
            <UserCheck className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
            <select
              value={currentRole}
              onChange={(e) => onRoleChange(e.target.value as UserRole)}
              className="bg-transparent font-bold text-slate-800 focus:outline-hidden pr-2 cursor-pointer"
            >
              <option value="Admin">1. Admin (Full Control)</option>
              <option value="Transport Coordinator">2. Transport Coordinator</option>
              <option value="Transport Assistant">3. Transport Assistant</option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};

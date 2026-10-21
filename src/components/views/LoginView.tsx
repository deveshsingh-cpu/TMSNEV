import React, { useState } from 'react';
import {
  Bus,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SchoolConfig, SystemUser, UserRole } from '../../types/index.js';

interface LoginViewProps {
  config: SchoolConfig;
  users: SystemUser[];
  onLogin: (username: string, password: string) => Promise<void>;
}

export const LoginView: React.FC<LoginViewProps> = ({ config, users, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRoleGuide, setShowRoleGuide] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError('Please enter both your username and password.');
      return;
    }
    setLoading(true);
    try {
      await onLogin(username.trim(), password.trim());
    } catch (err: any) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (uName: string, uPass: string) => {
    setUsername(uName);
    setPassword(uPass);
    setError(null);
    setLoading(true);
    try {
      await onLogin(uName, uPass);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const roleDescriptions: Record<
    UserRole,
    { badge: string; title: string; summary: string }
  > = {
    Admin: {
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      title: 'Full Administrative & Financial Control',
      summary:
        'Approves expenses, work orders, and student suspensions; manages users & passwords, payroll, chart of accounts, trial balance, and Google Sheets sync.',
    },
    'Transport Coordinator': {
      badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      title: 'Fleet, Routing, Members & Fee Operations',
      summary:
        'Manages student transport allocation, fee collection, follow-ups, routes, vehicles, and raises work orders or suspension requests for Admin approval.',
    },
    'Transport Assistant': {
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      title: 'Gate Attendance, Route Lists & Log Book',
      summary:
        'Field & gate console only: records daily morning/afternoon bus boarding attendance, 24-hour vehicle odometer readings, driver fuel bills, and student discipline.',
    },
  };

  const activeUsersList =
    users.length > 0
      ? users.filter((u) => u.status === 'Active')
      : [
          {
            id: 'usr-admin',
            username: 'admin',
            password: 'admin123',
            fullName: 'Chief Transport Administrator',
            role: 'Admin' as UserRole,
            campus: 'All Campuses',
            status: 'Active' as const,
            createdAt: '2026-04-01',
          },
          {
            id: 'usr-coord',
            username: 'coordinator',
            password: 'coord123',
            fullName: 'Transport Coordinator',
            role: 'Transport Coordinator' as UserRole,
            campus: 'All Campuses',
            status: 'Active' as const,
            createdAt: '2026-04-01',
          },
          {
            id: 'usr-assist',
            username: 'assistant',
            password: 'assist123',
            fullName: 'Transport Gate Assistant',
            role: 'Transport Assistant' as UserRole,
            campus: 'Sr',
            status: 'Active' as const,
            createdAt: '2026-04-01',
          },
        ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div
        className={`w-full mx-auto transition-all ${
          showRoleGuide ? 'max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch' : 'max-w-md'
        }`}
      >
        {/* Main Sign-In Card */}
        <div
          className={`${
            showRoleGuide ? 'lg:col-span-5' : 'w-full'
          } bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 p-7 sm:p-8 flex flex-col justify-between`}
        >
          <div className="space-y-6">
            {/* School Branding Header */}
            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-md shrink-0">
                <Bus className="w-6 h-6" />
              </div>
              <div>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-100 text-amber-900 rounded-md">
                  {config.currentAcademicSession || '2026-2027'}
                </span>
                <h1 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                  {config.schoolName || 'Narendra Edu Valley'}
                </h1>
                <p className="text-xs text-slate-500">
                  {config.tagline || 'Transport Management System'}
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>Transport Portal Sign In</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter your authorized staff username and password to access the Transport ERP.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 text-sm font-mono font-semibold border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? 'Verifying Credentials...' : 'Sign In to Transport ERP'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="pt-5 mt-6 border-t border-slate-100 space-y-3">
            <button
              type="button"
              onClick={() => setShowRoleGuide((prev) => !prev)}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>{showRoleGuide ? 'Hide Role Access Guide' : 'Role Access Guide & Quick Test Login'}</span>
              </span>
              {showRoleGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Secured Staff Portal</span>
              </span>
              <span className="font-mono">RBAC v2.0</span>
            </div>
          </div>
        </div>

        {/* Collapsible Right Column: Role Authorization Matrix & Quick-Login Helper */}
        {showRoleGuide && (
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-7 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                    Role-Based Access Control (RBAC)
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    Configured User Roles &amp; Quick Test Sign-In
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>{activeUsersList.length} Active Accounts</span>
                </span>
              </div>

              <div className="space-y-3">
                {activeUsersList.map((u) => {
                  const roleMeta = roleDescriptions[u.role] || roleDescriptions['Transport Assistant'];
                  return (
                    <div
                      key={u.id}
                      className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-white">{u.fullName}</span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${roleMeta.badge}`}
                          >
                            {u.role}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-300">
                          <span>
                            Username: <strong className="text-amber-400">{u.username}</strong>
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400 leading-snug">
                          <strong className="text-slate-200">{roleMeta.title}:</strong> {roleMeta.summary}
                        </p>
                      </div>

                      <div className="flex sm:flex-col gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQuickLogin(u.username, u.password)}
                          disabled={loading}
                          className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <span>Quick Sign In</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/70 text-xs text-slate-300 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block">
                  Managing Usernames &amp; Passwords:
                </span>
                <span>
                  Sign in as <strong>Admin</strong> and open{' '}
                  <strong className="text-amber-300">Users &amp; Passwords</strong> from the top header (or{' '}
                  <strong className="text-amber-300">9- Masters &amp; Users</strong>) to create, edit, or change passwords for any Admin, Coordinator, or Assistant.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

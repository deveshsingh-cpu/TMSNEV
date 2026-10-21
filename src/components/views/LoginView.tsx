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
  ArrowLeft,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { SchoolConfig } from '../../types/index.js';

interface LoginViewProps {
  config: SchoolConfig;
  onLogin: (username: string, password: string) => Promise<void>;
  onBackToWebsite?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ config, onLogin, onBackToWebsite }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Bar: Return to Main School Website */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToWebsite}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {config.schoolName || 'Narendra Edu Valley'} Website</span>
        </button>
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <Globe className="w-3.5 h-3.5 text-amber-400" />
          <span>ERP Portal: 2- Transport Division</span>
        </div>
      </div>

      {/* Center Login Card */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 p-7 sm:p-9 space-y-6">
          {/* School Branding Header */}
          <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-md shrink-0">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-100 text-amber-900 rounded-md">
                Session {config.currentAcademicSession || '2026-2027'}
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
              <span>Transport ERP Sign In</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Sign in with your authorized staff credentials (Admin, Transport Coordinator, or Transport Assistant).
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
              <span>{loading ? 'Verifying Credentials...' : 'Sign In to Transport Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Authorized Roles Info Footer */}
          <div className="pt-5 border-t border-slate-100 space-y-2.5">
            <div className="text-[11px] text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-slate-600">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Role-Based Access Control</span>
              </span>
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Authorized Staff Only</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Usernames and passwords are issued by the School Administrator. Contact the Admin office if you need a password reset.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Copyright Footer */}
      <div className="max-w-5xl w-full mx-auto text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} {config.schoolName || 'Narendra Edu Valley'}. All rights reserved.
      </div>
    </div>
  );
};

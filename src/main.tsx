import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface RootErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  RootErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    const msg = error instanceof Error ? error.message : String(error || 'Unexpected error');
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error('RootErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  handleResetSession = () => {
    try {
      localStorage.removeItem('nev_transport_auth_user');
    } catch {
      // ignore
    }
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="space-y-1">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-xs font-bold">
                Narendra Edu Valley — Transport ERP
              </span>
              <h2 className="text-lg font-bold text-white">
                Session View Refresh Required
              </h2>
              <p className="text-xs text-slate-300">
                An updated version of the portal was loaded or an unexpected display state occurred.
              </p>
            </div>
            {this.state.errorMessage && (
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-700 text-[11px] font-mono text-rose-300 break-words">
                {this.state.errorMessage}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Reload Dashboard
              </button>
              <button
                type="button"
                onClick={this.handleResetSession}
                className="py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs cursor-pointer"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);

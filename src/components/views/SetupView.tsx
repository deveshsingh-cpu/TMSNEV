import React, { useState } from 'react';
import {
  Database,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Lock,
  ExternalLink,
  Table,
} from 'lucide-react';
import { SchoolConfig } from '../../types/index.js';
import { SheetsStatus } from '../../services/api.js';

interface SetupViewProps {
  config: SchoolConfig;
  sheetsStatus: SheetsStatus | null;
  onUpdateConfig: (newCfg: Partial<SchoolConfig>) => Promise<any>;
  onProvisionSheets: () => Promise<any>;
  onSyncSheets: () => Promise<any>;
  onConfigureCredentials?: (creds: any) => Promise<any>;
}

export const SetupView: React.FC<SetupViewProps> = ({
  sheetsStatus,
  onProvisionSheets,
  onSyncSheets,
}) => {
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleProvision = async () => {
    try {
      setIsProvisioning(true);
      setFeedback(null);
      const res = await onProvisionSheets();
      setFeedback({
        type: 'success',
        message: res?.message || 'Successfully provisioned all 28 ERP tabs and synced schema to Google Sheets.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Provisioning Error: ${err.message}`,
      });
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setFeedback(null);
      const res = await onSyncSheets();
      setFeedback({
        type: 'success',
        message: res?.message || 'Successfully synchronized all 28 ERP tabs with Google Sheets.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Sync Error: ${err.message}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const sheetUrl = sheetsStatus?.sheetId
    ? `https://docs.google.com/spreadsheets/d/${sheetsStatus.sheetId}/edit`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Google Sheets Cloud Database &amp; Real-Time Sync
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
              <span>Open Google Sheet</span>
            </a>
          )}
          <button
            onClick={handleProvision}
            disabled={isProvisioning}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isProvisioning ? 'Provisioning Tabs...' : 'Provision All 28 Tabs'}</span>
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync to Sheets Now'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Connection Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold border border-emerald-200">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Google Sheets Service Account Engine</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    sheetsStatus?.isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span className="text-xs font-semibold text-slate-700">
                  {sheetsStatus?.isConnected
                    ? `Connected & Live (${sheetsStatus.totalTabs} Automated ERP Tabs)`
                    : 'Awaiting Google Sheets Credentials'}
                </span>
                {sheetsStatus?.lastSyncAt && (
                  <span className="text-[11px] text-slate-400">
                    • Last synced: {new Date(sheetsStatus.lastSyncAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-400 font-semibold text-[10px] uppercase">Service Account Email</span>
            <div className="font-mono text-slate-900 font-bold truncate" title={sheetsStatus?.clientEmail}>
              {sheetsStatus?.clientEmail || 'Not Configured'}
            </div>
            <p className="text-[10px] text-slate-500">Authenticated Google Cloud IAM service account.</p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-400 font-semibold text-[10px] uppercase">Spreadsheet ID</span>
            <div className="font-mono text-slate-900 font-bold truncate" title={sheetsStatus?.sheetId}>
              {sheetsStatus?.sheetId || 'Not Configured'}
            </div>
            <p className="text-[10px] text-slate-500">Target Google Spreadsheet ID.</p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-400 font-semibold text-[10px] uppercase">Active ERP Sheet Tabs</span>
            <div className="font-mono text-indigo-700 font-bold text-sm">
              {sheetsStatus?.totalTabs || 28} Tabs Provisioned
            </div>
            <p className="text-[10px] text-slate-500">
              {sheetsStatus?.cellUsageEstimate?.toLocaleString() || '0'} cells in active use.
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-400 font-semibold text-[10px] uppercase">Write Serialization</span>
            <div className="font-mono text-emerald-700 font-bold text-sm">
              Active (Queue: {sheetsStatus?.activeWriterQueueLength ?? 0})
            </div>
            <p className="text-[10px] text-slate-500">Automatic background sync on every create/update/delete.</p>
          </div>
        </div>

        {/* Provisioned Tabs Directory */}
        {sheetsStatus?.tabList && sheetsStatus.tabList.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-indigo-600" />
                <span>Live Google Spreadsheet Tabs ({sheetsStatus.tabList.length})</span>
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {sheetsStatus.tabList.map((tab) => (
                <div
                  key={tab.title}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate" title={tab.title}>
                      {tab.title}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {tab.headersCount} columns
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                    {tab.rowCount} {tab.rowCount === 1 ? 'row' : 'rows'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center gap-3">
          <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            Google Service Account credentials (<code className="bg-slate-200/70 px-1.5 py-0.5 rounded-xs font-mono text-[11px]">GOOGLE_CLIENT_EMAIL</code> &amp; <code className="bg-slate-200/70 px-1.5 py-0.5 rounded-xs font-mono text-[11px]">GOOGLE_PRIVATE_KEY</code>) are strictly isolated on the backend server and automatically sync every ERP module change directly to your Google Spreadsheet.
          </span>
        </div>
      </div>

      {/* Role Permissions Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-base">Role Permissions Matrix</h3>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Member Roster</th>
                <th className="py-2.5 px-3">Daily Attendance</th>
                <th className="py-2.5 px-3">Discrepancy Resolution</th>
                <th className="py-2.5 px-3">Fee Billing &amp; Receipts</th>
                <th className="py-2.5 px-3">Accounts Posting</th>
                <th className="py-2.5 px-3">Master Config</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { role: 'Admin', roster: 'Full', att: 'Full', res: 'Full', fee: 'Full', acc: 'Full', cfg: 'Full' },
                { role: 'Transport Coordinator', roster: 'Edit', att: 'Full', res: 'Full', fee: 'Full', acc: 'View', cfg: 'View' },
                { role: 'Transport Assistant', roster: 'View', att: 'Mark / Verify', res: 'View', fee: 'None', acc: 'None', cfg: 'None' },
              ].map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-bold text-slate-900">{r.role}</td>
                  <td className="py-3 px-3">{r.roster}</td>
                  <td className="py-3 px-3">{r.att}</td>
                  <td className="py-3 px-3">{r.res}</td>
                  <td className="py-3 px-3">{r.fee}</td>
                  <td className="py-3 px-3">{r.acc}</td>
                  <td className="py-3 px-3">{r.cfg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Printer, X, Bus, CheckCircle2, ShieldAlert } from 'lucide-react';
import { DriverRegisterWeekPack, SchoolConfig } from '../../types/index.js';

interface DriverRegisterPrintModalProps {
  pack: DriverRegisterWeekPack | null;
  config: SchoolConfig;
  onClose: () => void;
}

export const DriverRegisterPrintModal: React.FC<DriverRegisterPrintModalProps> = ({
  pack,
  config,
  onClose,
}) => {
  if (!pack) return null;

  const handlePrint = () => {
    window.print();
  };

  const getDatesBetween = (startStr: string, endStr: string): string[] => {
    const out: string[] = [];
    const s = new Date(startStr);
    const e = new Date(endStr);
    const cur = new Date(s);
    let count = 0;
    while (cur <= e && count < 10) {
      out.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
      count++;
    }
    return out.length > 0 ? out : [startStr];
  };

  const weekDates = getDatesBetween(pack.weekStartDate, pack.weekEndDate);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-slate-300 flex flex-col">
        {/* Modal Controls (Hidden in Print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold">Print Route List Preview</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet (A4 styling) */}
        <div className="p-8 text-slate-900 space-y-5 print:p-0 print:m-0">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-3 text-center">
            <h1 className="text-2xl font-black uppercase tracking-tight">{config.schoolName}</h1>
            <p className="text-xs text-slate-600 font-medium">{config.address} • Transport Helpline: {config.phone}</p>
            <div className="mt-2 text-sm font-bold bg-slate-900 text-white py-1 uppercase tracking-widest">
              Weekly Driver Route List • Route Manifest
            </div>
          </div>

          {/* Roster Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border border-slate-300 p-3 bg-slate-50 font-medium">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Week Period:</span>
              <strong className="text-slate-900">{pack.weekStartDate} to {pack.weekEndDate}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Assigned Vehicle:</span>
              <strong className="text-slate-900 font-mono text-sm">{pack.vehicleNumber}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Driver In-Charge:</span>
              <strong className="text-slate-900">{pack.driverName}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Shift &amp; Version:</span>
              <strong className="text-slate-900">{pack.shiftName} (v{pack.version}.0)</strong>
            </div>
          </div>

          <div className="text-xs text-slate-700 font-medium">
            Route: <strong>{pack.routeName}</strong> • Campus: <strong>{pack.campus}</strong>
          </div>

          {/* Student Roster Table with Dates */}
          <div className="overflow-x-auto border border-slate-300">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-2 border-r border-slate-300 w-8 text-center">#</th>
                  <th className="py-2 px-2 border-r border-slate-300">DP</th>
                  <th className="py-2 px-2 border-r border-slate-300">Adm No</th>
                  <th className="py-2 px-2 border-r border-slate-300">Member Name</th>
                  <th className="py-2 px-2 border-r border-slate-300">Class</th>
                  <th className="py-2 px-2 border-r border-slate-300">Stop Name</th>
                  <th className="py-2 px-2 border-r border-slate-300">Status</th>
                  {weekDates.map((d) => (
                    <th key={d} className="py-1 px-1 border-r border-slate-300 text-center" colSpan={2}>
                      <div className="border-b border-slate-300 pb-0.5">{d.slice(5)}</div>
                      <div className="grid grid-cols-2 text-[8px] pt-0.5 font-normal">
                        <span>IN</span>
                        <span>OUT</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pack.roster.filter(m => m.status !== 'Left').map((m) => {
                  const isSuspended = m.status === 'Suspended';
                  return (
                    <tr key={m.admissionNo} className={isSuspended ? 'bg-rose-50 text-rose-600' : ''}>
                      <td className="py-2 px-2 border-r border-slate-300 text-center font-mono">{m.srNo}</td>
                      <td className="py-2 px-2 border-r border-slate-300 text-center">
                        {m.profilePhoto ? (
                          <img src={m.profilePhoto} alt={m.name} className="w-7 h-7 rounded object-cover mx-auto" />
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-300 font-mono font-bold">{m.admissionNo}</td>
                      <td className={`py-2 px-2 border-r border-slate-300 font-bold ${isSuspended ? 'text-rose-600' : 'text-slate-900'}`}>
                        {m.name}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-300">{m.classSection}</td>
                      <td className="py-2 px-2 border-r border-slate-300">{m.pickupStop}</td>
                      <td className={`py-2 px-2 border-r border-slate-300 font-bold ${isSuspended ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {m.status}
                      </td>

                      {weekDates.map((d) => (
                        <React.Fragment key={d}>
                          <td className="py-2 px-1 border-r border-slate-200 text-center font-mono w-6 text-[10px]"></td>
                          <td className="py-2 px-1 border-r border-slate-300 text-center font-mono w-6 text-[10px]"></td>
                        </React.Fragment>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend and Signature Footers */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="p-2 border border-slate-200 bg-slate-50 text-[10px] space-x-3 text-slate-600">
              <strong>Legend:</strong>
              <span><strong>P</strong> = Present</span>
              <span><strong>A</strong> = Absent</span>
              <span><strong>H</strong> = Holiday</span>
              <span><strong>NS</strong> = Not Scheduled</span>
              <span><strong>S</strong> = Suspended / Ineligible</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Generated at: {pack.generatedAt} by {pack.generatedBy}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-8 text-xs font-semibold">
            <div className="border-t border-slate-400 pt-2 text-center">
              Driver Signature: {pack.driverName}
            </div>
            <div className="border-t border-slate-400 pt-2 text-center">
              Transport Assistant / Gate Verification Signature
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

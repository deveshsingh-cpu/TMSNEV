import React from 'react';
import { Printer, X, AlertTriangle } from 'lucide-react';
import { WarningLetter, SchoolConfig } from '../../types/index.js';

interface WarningLetterPrintModalProps {
  letter: WarningLetter | null;
  config: SchoolConfig;
  onClose: () => void;
}

export const WarningLetterPrintModal: React.FC<WarningLetterPrintModalProps> = ({
  letter,
  config,
  onClose,
}) => {
  if (!letter) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-300 flex flex-col">
        {/* Controls */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden rounded-t-2xl">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold">15th Stage Transport Arrears Warning Notice</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
            >
              <Printer className="w-4 h-4" />
              <span>Print Notice</span>
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Notice Body */}
        <div className="p-8 text-slate-900 space-y-5 print:p-0">
          <div className="text-center border-b pb-4 border-slate-300">
            <h1 className="text-2xl font-black uppercase">{config.schoolName}</h1>
            <p className="text-xs text-slate-600 font-medium">{config.address} • Phone: {config.phone}</p>
            <div className="mt-3 inline-block px-4 py-1 bg-rose-100 text-rose-900 text-xs font-bold uppercase rounded-md border border-rose-300">
              Urgent Transport Service Notice: Dues Warning
            </div>
          </div>

          <div className="flex justify-between text-xs text-slate-600">
            <div>Ref No: <strong className="font-mono text-slate-900">{letter.letterNo}</strong></div>
            <div>Issue Date: <strong className="text-slate-900">{letter.issueDate}</strong></div>
          </div>

          <div className="text-xs space-y-1 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>To,</div>
            <div className="font-bold text-slate-900 text-sm">Mr. {letter.fatherName}</div>
            <div>Parent of: <strong>{letter.studentName}</strong> (Admission No: <strong>{letter.admissionNo}</strong>)</div>
            <div className="text-slate-600">{letter.address}</div>
          </div>

          <div className="text-xs text-slate-800 space-y-3 leading-relaxed">
            <p><strong>Dear Parent,</strong></p>
            <p>
              This is to formally notify you that transport subscription fees for your ward remain overdue for the period of <strong>{letter.periodOverdue}</strong>. The total outstanding transport balance currently stands at <strong className="text-rose-700 font-mono text-sm">₹{letter.overdueAmount}</strong>.
            </p>
            <p>
              In accordance with school transport policy, if the outstanding arrears are not cleared or authorized with the accounts office by <strong>{letter.proposedSuspensionDate}</strong>, the student's transport service will be transitioned to <strong>Suspended — Not eligible</strong>.
            </p>
            <p className="p-2.5 bg-amber-50 rounded-lg text-amber-900 text-[11px] border border-amber-200">
              * Note: Transport suspension does NOT affect academic enrollment or regular classroom attendance. Parents will be responsible for private commute during any suspended period.
            </p>
          </div>

          <div className="pt-8 flex justify-between items-end text-xs text-slate-700">
            <div>
              Transport Office Contact: {config.phone}
            </div>
            <div className="text-center border-t border-slate-400 pt-1 px-6">
              Transport In-Charge / Accounts Officer<br />
              {config.schoolName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

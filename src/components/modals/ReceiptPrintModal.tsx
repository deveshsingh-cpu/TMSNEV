import React from 'react';
import { Printer, X, CheckCircle, IndianRupee } from 'lucide-react';
import { FeeReceipt, SchoolConfig } from '../../types/index.js';

interface ReceiptPrintModalProps {
  receipt: FeeReceipt | null;
  config: SchoolConfig;
  onClose: () => void;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  receipt,
  config,
  onClose,
}) => {
  if (!receipt) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-300 flex flex-col">
        {/* Controls */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden rounded-t-2xl">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold">Official Transport Fee Receipt</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-6 text-slate-900 space-y-4 print:p-0">
          <div className="text-center border-b pb-3 border-slate-200">
            <h2 className="text-xl font-bold uppercase">{config.schoolName}</h2>
            <p className="text-xs text-slate-500 font-medium">{config.address}</p>
            <div className="inline-block mt-2 px-3 py-0.5 bg-slate-100 text-slate-800 text-xs font-bold uppercase rounded-md">
              Transport Fee Collection Receipt
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">Receipt No:</span>
              <strong className="font-mono text-slate-900">{receipt.receiptNo}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[10px]">Date:</span>
              <strong className="text-slate-900">{receipt.date}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Student / Payer:</span>
              <strong className="text-slate-900 text-sm">{receipt.studentName}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[10px]">Admission No:</span>
              <strong className="font-mono text-slate-900">{receipt.admissionNo}</strong>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
            <div>
              <span className="text-slate-500 block">Payment Mode:</span>
              <strong className="text-slate-800">{receipt.paymentMode} {receipt.referenceNo && `(${receipt.referenceNo})`}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Total Amount Received:</span>
              <strong className="text-lg font-bold text-emerald-700">₹{receipt.amount.toLocaleString('en-IN')}</strong>
            </div>
          </div>

          {receipt.advanceLiabilityAmount > 0 && (
            <div className="p-2 bg-amber-50 rounded-lg text-amber-900 text-xs">
              * ₹{receipt.advanceLiabilityAmount} recorded as advance prepayment towards next billing cycle.
            </div>
          )}

          <div className="pt-6 flex justify-between items-end text-xs text-slate-500 border-t border-slate-200">
            <div>Received By: <strong>{receipt.receivedBy}</strong></div>
            <div className="text-right border-t border-slate-400 pt-1 px-4">
              Authorized Cashier / Stamp
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

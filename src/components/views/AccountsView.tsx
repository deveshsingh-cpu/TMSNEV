import React, { useState, useEffect } from 'react';
import { 
  Landmark, BookOpen, Scale, Plus, Search, 
  CheckCircle, AlertTriangle, Truck, GraduationCap, 
  FileText, X, IndianRupee, Tag, Upload, Eye, Trash2, Lock, Calendar
} from 'lucide-react';
import { 
  AccountHead, JournalVoucher, JournalLine, 
  Vehicle, Student, FeeInvoice, FeeReceipt, ExpenseRecord,
  OdometerLog, IncomeHead, IncomeRecord
} from '../../types/index.js';
import { PrintExportToolbar, FilterPopover } from '../../utils/exportPrint.js';
import { readFileCompressed } from '../../utils/fileCompressor.js';

interface AccountsViewProps {
  schoolName?: string;
  isAdmin?: boolean;
  initialTab?: 'day_book' | 'income' | 'vouchers' | 'vehicle_ledger' | 'student_ledger' | 'trial_balance';
  accounts: AccountHead[];
  vouchers: JournalVoucher[];
  vehicles: Vehicle[];
  students: Student[];
  invoices: FeeInvoice[];
  receipts: FeeReceipt[];
  expenses: ExpenseRecord[];
  odometerLogs: OdometerLog[];
  incomeHeads: IncomeHead[];
  incomes: IncomeRecord[];
  onSaveIncomeHead: (data: Partial<IncomeHead>) => Promise<IncomeHead>;
  onDeleteIncomeHead: (id: string) => Promise<void>;
  onAddIncome: (data: Omit<IncomeRecord, 'id' | 'incomeNo'>) => Promise<IncomeRecord>;
  onDeleteIncome: (id: string) => Promise<void>;
  onCreateVoucher: (data: Omit<JournalVoucher, 'id' | 'voucherNo' | 'totalDebit' | 'totalCredit' | 'status'>) => Promise<any>;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  schoolName,
  isAdmin = true,
  initialTab = 'day_book',
  accounts = [],
  vouchers = [],
  vehicles = [],
  students = [],
  invoices = [],
  receipts = [],
  expenses = [],
  odometerLogs = [],
  incomeHeads = [],
  incomes = [],
  onSaveIncomeHead,
  onDeleteIncomeHead,
  onAddIncome,
  onDeleteIncome,
  onCreateVoucher,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  // Only incorporate Approved expenses in paid reports, Day Book, and Ledgers
  const approvedExpenses = expenses.filter(
    (e) => !e.approvalStatus || e.approvalStatus === 'Approved'
  );
  const [activeTab, setActiveTab] = useState<'day_book' | 'income' | 'vouchers' | 'vehicle_ledger' | 'student_ledger' | 'trial_balance'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Day Book Filters
  const [dayBookDateFrom, setDayBookDateFrom] = useState<string>('');
  const [dayBookDateTo, setDayBookDateTo] = useState<string>('');
  const [dayBookModeFilter, setDayBookModeFilter] = useState<'all' | 'Cash' | 'UPI' | 'Bank'>('all');

  // Other Income & Income Heads State
  const [incomeSubView, setIncomeSubView] = useState<'income_list' | 'income_heads'>('income_list');
  const [incomeHeadFilter, setIncomeHeadFilter] = useState<string>('all');
  const [incomeDateFrom, setIncomeDateFrom] = useState<string>('');
  const [incomeDateTo, setIncomeDateTo] = useState<string>('');
  const [incomeSearch, setIncomeSearch] = useState<string>('');

  // Add Other Income Form State
  const [selectedIncomeHead, setSelectedIncomeHead] = useState<string>(incomeHeads[0]?.name || '');
  const [receivedTo, setReceivedTo] = useState<'Cash' | 'UPI' | 'Bank'>('Cash');
  const [payerName, setPayerName] = useState<string>('');
  const [incomeInvoiceNo, setIncomeInvoiceNo] = useState<string>('');
  const [incomeDate, setIncomeDate] = useState<string>(todayStr);
  const [incomeAmount, setIncomeAmount] = useState<string>('');
  const [incomeAttachment, setIncomeAttachment] = useState<string>('');
  const [incomeAttachmentName, setIncomeAttachmentName] = useState<string>('');
  const [incomeDescription, setIncomeDescription] = useState<string>('');
  const [isSavingIncome, setIsSavingIncome] = useState(false);

  // Add Income Head Form State
  const [newIncomeHeadName, setNewIncomeHeadName] = useState<string>('');
  const [newIncomeHeadDesc, setNewIncomeHeadDesc] = useState<string>('');
  const [showInlineHeadForm, setShowInlineHeadForm] = useState<boolean>(false);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);

  useEffect(() => {
    if (!selectedIncomeHead && incomeHeads.length > 0) {
      setSelectedIncomeHead(incomeHeads[0].name);
    }
  }, [incomeHeads, selectedIncomeHead]);

  useEffect(() => {
    if (!isAdmin) {
      setIncomeDate(todayStr);
    }
  }, [isAdmin, todayStr]);

  // Vouchers & Ledgers State
  const [voucherSearch, setVoucherSearch] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>('all');
  const [selectedVehicleReg, setSelectedVehicleReg] = useState<string>(vehicles[0]?.registrationNumber || '');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');

  // New Journal Voucher Modal State
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [vchDate, setVchDate] = useState(todayStr);
  const [vchType, setVchType] = useState<JournalVoucher['voucherType']>('Journal');
  const [vchNarration, setVchNarration] = useState('');
  const [vchLines, setVchLines] = useState<JournalLine[]>([
    { accountId: 'acc-5010', accountCode: '5010', accountName: 'Fuel & CNG Expense', debit: 0, credit: 0, costCenter: vehicles[0]?.registrationNumber || '' },
    { accountId: 'acc-1010', accountCode: '1010', accountName: 'Cash in Hand (Transport Counter)', debit: 0, credit: 0 },
  ]);
  const [vchError, setVchError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleIncomeAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIncomeAttachmentName(file.name);
    try {
      const compressed = await readFileCompressed(file, 900, 0.72);
      setIncomeAttachment(compressed);
    } catch {
      // ignore
    }
  };

  const handleCreateIncomeHead = async (e: React.FormEvent) => {
    e.preventDefault();
    setIncomeError(null);
    if (!newIncomeHeadName.trim()) {
      setIncomeError('Income Head name is required.');
      return;
    }
    try {
      const saved = await onSaveIncomeHead({
        name: newIncomeHeadName.trim(),
        description: newIncomeHeadDesc.trim() || undefined,
      });
      setSelectedIncomeHead(saved.name);
      setNewIncomeHeadName('');
      setNewIncomeHeadDesc('');
      setShowInlineHeadForm(false);
    } catch (err: any) {
      setIncomeError(err?.message || 'Failed to save Income Head');
    }
  };

  const handleDeleteHead = async (id: string) => {
    setIncomeError(null);
    try {
      await onDeleteIncomeHead(id);
    } catch (err: any) {
      setIncomeError(err?.message || 'Cannot delete linked Income Head');
    }
  };

  const handleSaveIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIncomeError(null);
    const amt = Number(incomeAmount);
    if (!selectedIncomeHead || !payerName.trim() || !amt || amt <= 0) {
      setIncomeError('Please fill Income Head, Payer Name, and a valid Amount.');
      return;
    }
    try {
      setIsSavingIncome(true);
      const headObj = incomeHeads.find(h => h.name === selectedIncomeHead);
      await onAddIncome({
        date: isAdmin ? incomeDate : todayStr,
        incomeHeadId: headObj?.id,
        incomeHeadName: selectedIncomeHead,
        receivedTo,
        name: payerName.trim(),
        invoiceNumber: incomeInvoiceNo.trim() || undefined,
        amount: amt,
        attachment: incomeAttachment || undefined,
        description: incomeDescription.trim() || `${selectedIncomeHead} received in ${receivedTo}`,
        recordedBy: isAdmin ? 'Transport Admin' : 'Transport Assistant',
      });
      setPayerName('');
      setIncomeInvoiceNo('');
      setIncomeAmount('');
      setIncomeAttachment('');
      setIncomeAttachmentName('');
      setIncomeDescription('');
    } catch (err: any) {
      setIncomeError(err?.message || 'Failed to save income record');
    } finally {
      setIsSavingIncome(false);
    }
  };

  // ============================================================================
  // DAY BOOK COMPUTATION (Combines Automated Fee Receipts + Other Income vs Expenses)
  // ============================================================================
  interface DayBookIncomeEntry {
    id: string;
    date: string;
    invoiceNo: string;
    incomeHead: string;
    name: string;
    toMode: 'Cash' | 'UPI' | 'Bank';
    amount: number;
    sourceType: 'Fee Receipt' | 'Other Income';
    attachment?: string;
  }

  const allDayBookIncomes: DayBookIncomeEntry[] = [
    ...receipts.map((r): DayBookIncomeEntry => ({
      id: r.id,
      date: r.date,
      invoiceNo: r.receiptNo,
      incomeHead: 'Transport Fees (Auto)',
      name: `${r.studentName} (${r.admissionNo})`,
      toMode: r.paymentMode === 'Cash' ? 'Cash' : r.paymentMode === 'UPI' ? 'UPI' : 'Bank',
      amount: r.amountPaid ?? r.amount ?? 0,
      sourceType: 'Fee Receipt',
      attachment: r.upiScreenshot,
    })),
    ...incomes.map((inc): DayBookIncomeEntry => ({
      id: inc.id,
      date: inc.date,
      invoiceNo: inc.invoiceNumber || inc.incomeNo,
      incomeHead: inc.incomeHeadName || inc.headName || 'Other Income',
      name: inc.name || inc.receivedFrom || 'General',
      toMode: inc.receivedTo || (inc.paymentMode === 'Cash' ? 'Cash' : inc.paymentMode === 'UPI' ? 'UPI' : 'Bank'),
      amount: inc.amount,
      sourceType: 'Other Income',
      attachment: inc.attachment,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const filteredDayBookIncomes = allDayBookIncomes.filter(item => {
    if (dayBookDateFrom && item.date < dayBookDateFrom) return false;
    if (dayBookDateTo && item.date > dayBookDateTo) return false;
    if (dayBookModeFilter !== 'all' && item.toMode !== dayBookModeFilter) return false;
    return true;
  });

  const filteredDayBookExpenses = approvedExpenses
    .filter(exp => {
      if (dayBookDateFrom && exp.date < dayBookDateFrom) return false;
      if (dayBookDateTo && exp.date > dayBookDateTo) return false;
      if (dayBookModeFilter !== 'all' && exp.paymentMode !== dayBookModeFilter) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalDayBookIncome = filteredDayBookIncomes.reduce((s, i) => s + i.amount, 0);
  const totalDayBookIncomeCash = filteredDayBookIncomes.filter(i => i.toMode === 'Cash').reduce((s, i) => s + i.amount, 0);
  const totalDayBookIncomeDigital = totalDayBookIncome - totalDayBookIncomeCash;

  const totalDayBookExpense = filteredDayBookExpenses.reduce((s, e) => s + e.amount, 0);
  const totalDayBookExpenseCash = filteredDayBookExpenses.filter(e => e.paymentMode === 'Cash').reduce((s, e) => s + e.amount, 0);
  const totalDayBookExpenseDigital = totalDayBookExpense - totalDayBookExpenseCash;

  const netDayBookProfit = totalDayBookIncome - totalDayBookExpense;

  // Combined rows for Day Book Print/Export
  const combinedDayBookExportRows = [
    ...filteredDayBookIncomes.map(inc => ({
      date: inc.date,
      type: 'INCOME',
      refNo: inc.invoiceNo,
      head: inc.incomeHead,
      partyName: inc.name,
      mode: inc.toMode,
      incomeAmount: inc.amount,
      expenseAmount: 0,
    })),
    ...filteredDayBookExpenses.map(exp => ({
      date: exp.date,
      type: 'EXPENSE',
      refNo: exp.billNumber || exp.expenseNo,
      head: exp.category,
      partyName: exp.vendorName,
      mode: exp.paymentMode,
      incomeAmount: 0,
      expenseAmount: exp.amount,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  // ============================================================================
  // OTHER INCOME LIST FILTERING
  // ============================================================================
  const filteredOtherIncomes = incomes.filter(inc => {
    if (incomeHeadFilter !== 'all' && inc.incomeHeadName !== incomeHeadFilter) return false;
    if (incomeDateFrom && inc.date < incomeDateFrom) return false;
    if (incomeDateTo && inc.date > incomeDateTo) return false;
    if (incomeSearch.trim()) {
      const q = incomeSearch.toLowerCase();
      return (
        (inc.name || inc.receivedFrom || '').toLowerCase().includes(q) ||
        (inc.incomeHeadName || inc.headName || '').toLowerCase().includes(q) ||
        (inc.invoiceNumber && inc.invoiceNumber.toLowerCase().includes(q)) ||
        (inc.description || inc.remarks || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ============================================================================
  // 1. TRIAL BALANCE & VOUCHERS COMPUTATION
  // ============================================================================
  const totalDebitNormal = accounts
    .filter(a => a.accountClass === 'Asset' || a.accountClass === 'Expense')
    .reduce((s, a) => s + a.balance, 0);

  const totalCreditNormal = accounts
    .filter(a => a.accountClass === 'Liability' || a.accountClass === 'Income' || a.accountClass === 'Equity')
    .reduce((s, a) => s + a.balance, 0);

  const filteredVouchers = vouchers.filter(v => {
    if (voucherTypeFilter !== 'all' && v.voucherType !== voucherTypeFilter) return false;
    if (voucherSearch) {
      const q = voucherSearch.toLowerCase();
      return (
        v.voucherNo.toLowerCase().includes(q) ||
        v.narration.toLowerCase().includes(q) ||
        v.lines.some(l => l.accountName.toLowerCase().includes(q) || (l.partyName && l.partyName.toLowerCase().includes(q)))
      );
    }
    return true;
  });

  // ============================================================================
  // 2. VEHICLE COST LEDGER COMPUTATION
  // ============================================================================
  const targetVehicle = vehicles.find(v => v.registrationNumber === selectedVehicleReg) || vehicles[0];
  const vehicleExpenses = approvedExpenses.filter(e => e.vehicleNumber === targetVehicle?.registrationNumber);
  const vehicleOdoLogs = odometerLogs.filter(o => o.vehicleNumber === targetVehicle?.registrationNumber);

  const vehFuelSpend = vehicleExpenses.filter(e => e.category.toLowerCase().includes('fuel')).reduce((s, e) => s + e.amount, 0);
  const vehRepairsSpend = vehicleExpenses.filter(e => e.category.toLowerCase().includes('repair')).reduce((s, e) => s + e.amount, 0);
  const vehOtherSpend = vehicleExpenses.filter(e => !e.category.toLowerCase().includes('fuel') && !e.category.toLowerCase().includes('repair')).reduce((s, e) => s + e.amount, 0);
  const vehTotalSpend = vehFuelSpend + vehRepairsSpend + vehOtherSpend;
  const vehTotalKm = vehicleOdoLogs.reduce((s, o) => s + (o.distanceKm ?? 0), 0);
  const vehCostPerKm = vehTotalKm > 0 ? (vehTotalSpend / vehTotalKm).toFixed(1) : '—';

  // ============================================================================
  // 3. STUDENT FEE LEDGER COMPUTATION
  // ============================================================================
  const selectedStudent = students.find(s => s.id === selectedStudentId) || students[0];
  const studentInvoices = invoices.filter(i => i.studentId === selectedStudent?.id);
  const studentReceipts = receipts.filter(r => r.studentId === selectedStudent?.id);

  interface StudentStatementEntry {
    date: string;
    refNo: string;
    type: 'Invoice' | 'Receipt';
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }

  const rawEntries: Omit<StudentStatementEntry, 'runningBalance'>[] = [
    ...studentInvoices.map(inv => ({
      date: `${inv.month}-01`,
      refNo: inv.id.toUpperCase(),
      type: 'Invoice' as const,
      description: `Monthly Transport Fee (${inv.month}) — ${inv.routeStop || 'Stop'}`,
      debit: inv.netPayable ?? inv.netAmount ?? 0,
      credit: 0,
    })),
    ...studentReceipts.map(rcp => ({
      date: rcp.date,
      refNo: rcp.receiptNo,
      type: 'Receipt' as const,
      description: `Payment via ${rcp.paymentMode} (${(rcp.monthsCovered || []).join(', ') || 'Fee'})`,
      debit: 0,
      credit: rcp.amountPaid ?? rcp.amount ?? 0,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let runningBal = 0;
  const studentLedgerEntries: StudentStatementEntry[] = rawEntries.map(e => {
    runningBal += e.debit - e.credit;
    return { ...e, runningBalance: runningBal };
  });

  // ============================================================================
  // NEW JOURNAL VOUCHER HANDLERS
  // ============================================================================
  const handleLineAccountChange = (index: number, accId: string) => {
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return;
    const updated = [...vchLines];
    updated[index] = {
      ...updated[index],
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
    };
    setVchLines(updated);
  };

  const handleLineAmountChange = (index: number, field: 'debit' | 'credit', val: number) => {
    const updated = [...vchLines];
    updated[index] = {
      ...updated[index],
      [field]: val,
      ...(field === 'debit' && val > 0 ? { credit: 0 } : {}),
      ...(field === 'credit' && val > 0 ? { debit: 0 } : {}),
    };
    setVchLines(updated);
  };

  const addVoucherLine = () => {
    const defaultAcc = accounts[0];
    setVchLines([
      ...vchLines,
      { accountId: defaultAcc.id, accountCode: defaultAcc.code, accountName: defaultAcc.name, debit: 0, credit: 0 },
    ]);
  };

  const removeVoucherLine = (index: number) => {
    if (vchLines.length <= 2) return;
    setVchLines(vchLines.filter((_, i) => i !== index));
  };

  const formTotalDebit = vchLines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const formTotalCredit = vchLines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const isFormBalanced = formTotalDebit > 0 && Math.abs(formTotalDebit - formTotalCredit) < 0.01;

  const handleCreateVoucherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVchError('');
    if (!isFormBalanced) {
      setVchError(`Double-entry mismatch: Total Debit (₹${formTotalDebit}) must equal Total Credit (₹${formTotalCredit}).`);
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreateVoucher({
        date: isAdmin ? vchDate : todayStr,
        voucherType: vchType,
        narration: vchNarration.trim() || `Manual ${vchType} Voucher`,
        lines: vchLines,
      });
      setIsVoucherModalOpen(false);
      setVchNarration('');
    } catch (err: any) {
      setVchError(err.message || 'Failed to post voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Unified Top Header Bar (Scoped strictly to active Sidebar screen) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {activeTab === 'day_book' && 'Day Book (Income & Expense)'}
            {activeTab === 'income' && 'Other Income & Heads'}
            {activeTab === 'vouchers' && 'Vouchers & Chart of Accounts'}
            {activeTab === 'vehicle_ledger' && 'Vehicle Ledger & Expenses'}
            {activeTab === 'student_ledger' && 'Member Fee Ledger'}
            {activeTab === 'trial_balance' && 'Trial Balance'}
          </h2>
          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            {activeTab === 'day_book' && `${combinedDayBookExportRows.length} Entries`}
            {activeTab === 'income' && `${filteredOtherIncomes.length} Records`}
            {activeTab === 'vouchers' && `${filteredVouchers.length} Vouchers`}
            {activeTab === 'vehicle_ledger' && `${vehicleExpenses.length} Vouchers`}
            {activeTab === 'student_ledger' && `${studentLedgerEntries.length} Entries`}
            {activeTab === 'trial_balance' && `${accounts.length} Accounts`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'day_book' && (
            <>
              <FilterPopover
                activeCount={
                  (dayBookDateFrom ? 1 : 0) +
                  (dayBookDateTo ? 1 : 0) +
                  (dayBookModeFilter !== 'all' ? 1 : 0)
                }
                onReset={() => {
                  setDayBookDateFrom('');
                  setDayBookDateTo('');
                  setDayBookModeFilter('all');
                }}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={dayBookModeFilter}
                    onChange={(e) => setDayBookModeFilter(e.target.value as any)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 font-semibold"
                  >
                    <option value="all">All Modes (Cash &amp; UPI/Bank)</option>
                    <option value="Cash">Cash Only</option>
                    <option value="UPI">UPI Only</option>
                    <option value="Bank">Bank Only</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Date From
                    </label>
                    <input
                      type="date"
                      value={dayBookDateFrom}
                      onChange={(e) => setDayBookDateFrom(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Date To
                    </label>
                    <input
                      type="date"
                      value={dayBookDateTo}
                      onChange={(e) => setDayBookDateTo(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 font-mono"
                    />
                  </div>
                </div>
                <div className="pt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDayBookDateFrom(todayStr);
                      setDayBookDateTo(todayStr);
                    }}
                    className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Today Only
                  </button>
                </div>
              </FilterPopover>

              <PrintExportToolbar
                title={`Day Book Statement (${dayBookDateFrom || 'Start'} to ${dayBookDateTo || 'Today'})`}
                filename="transport_day_book"
                schoolName={schoolName}
                filteredData={combinedDayBookExportRows}
                allData={combinedDayBookExportRows}
                hasActiveFilters={Boolean(dayBookDateFrom || dayBookDateTo || dayBookModeFilter !== 'all')}
                columns={[
                  { header: 'Date', accessor: (r) => r.date },
                  { header: 'Entry Type', accessor: (r) => r.type },
                  { header: 'Invoice / Receipt No', accessor: (r) => r.refNo },
                  { header: 'Income / Expense Head', accessor: (r) => r.head },
                  { header: 'Name / Party', accessor: (r) => r.partyName },
                  { header: 'Mode (Cash/UPI)', accessor: (r) => r.mode },
                  { header: 'Income (INR)', accessor: (r) => r.incomeAmount || '' },
                  { header: 'Expense (INR)', accessor: (r) => r.expenseAmount || '' },
                ]}
              />
            </>
          )}

          {activeTab === 'income' && (
            <>
              <div className="relative w-48 sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search payer, invoice..."
                  value={incomeSearch}
                  onChange={(e) => setIncomeSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <FilterPopover
                activeCount={
                  (incomeHeadFilter !== 'all' ? 1 : 0) +
                  (incomeDateFrom ? 1 : 0) +
                  (incomeDateTo ? 1 : 0)
                }
                onReset={() => {
                  setIncomeHeadFilter('all');
                  setIncomeDateFrom('');
                  setIncomeDateTo('');
                }}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Income Head
                  </label>
                  <select
                    value={incomeHeadFilter}
                    onChange={(e) => setIncomeHeadFilter(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 font-semibold"
                  >
                    <option value="all">All Income Heads</option>
                    {incomeHeads.map((h) => (
                      <option key={h.id} value={h.name}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Date From
                    </label>
                    <input
                      type="date"
                      value={incomeDateFrom}
                      onChange={(e) => setIncomeDateFrom(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Date To
                    </label>
                    <input
                      type="date"
                      value={incomeDateTo}
                      onChange={(e) => setIncomeDateTo(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 font-mono"
                    />
                  </div>
                </div>
              </FilterPopover>

              <PrintExportToolbar
                title="Other Income Register"
                filename="other_income_register"
                schoolName={schoolName}
                filteredData={filteredOtherIncomes}
                allData={incomes}
                hasActiveFilters={Boolean(incomeHeadFilter !== 'all' || incomeDateFrom || incomeDateTo || incomeSearch)}
                columns={[
                  { header: 'Income No', accessor: (r) => r.incomeNo },
                  { header: 'Date', accessor: (r) => r.date },
                  { header: 'Income Head', accessor: (r) => r.incomeHeadName || r.headName || 'Other Income' },
                  { header: 'Name / Payer', accessor: (r) => r.name || r.receivedFrom || '—' },
                  { header: 'Invoice Number', accessor: (r) => r.invoiceNumber || '—' },
                  { header: 'To (Cash/UPI)', accessor: (r) => r.receivedTo || r.paymentMode || 'Cash' },
                  { header: 'Amount (INR)', accessor: (r) => r.amount },
                  { header: 'Description', accessor: (r) => r.description || r.remarks || '—' },
                ]}
              />

              <button
                type="button"
                onClick={() =>
                  setIncomeSubView(incomeSubView === 'income_list' ? 'income_heads' : 'income_list')
                }
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>
                  {incomeSubView === 'income_list'
                    ? `Manage Income Heads (${incomeHeads.length})`
                    : 'Back to Income Records'}
                </span>
              </button>
            </>
          )}

          {activeTab === 'vouchers' && (
            <>
              <div className="relative w-48 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search voucher #, account, party..."
                  value={voucherSearch}
                  onChange={(e) => setVoucherSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <FilterPopover
                activeCount={voucherTypeFilter !== 'all' ? 1 : 0}
                onReset={() => setVoucherTypeFilter('all')}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Voucher Type
                  </label>
                  <select
                    value={voucherTypeFilter}
                    onChange={(e) => setVoucherTypeFilter(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50"
                  >
                    <option value="all">All Voucher Types</option>
                    <option value="Journal">Journal Vouchers</option>
                    <option value="Payment">Payment Vouchers</option>
                    <option value="Receipt">Receipt Vouchers</option>
                    <option value="Fee Accrual">Fee Accruals</option>
                    <option value="Settlement">Advance Settlements</option>
                    <option value="Payroll">Staff Payroll</option>
                  </select>
                </div>
              </FilterPopover>

              <PrintExportToolbar
                title="Journal Vouchers Register"
                filename="journal_vouchers"
                schoolName={schoolName}
                filteredData={filteredVouchers}
                allData={vouchers}
                hasActiveFilters={voucherTypeFilter !== 'all' || voucherSearch.trim() !== ''}
                columns={[
                  { header: 'Voucher No', accessor: (v) => v.voucherNo },
                  { header: 'Date', accessor: (v) => v.date },
                  { header: 'Type', accessor: (v) => v.voucherType },
                  { header: 'Narration', accessor: (v) => v.narration },
                  { header: 'Debit Total (INR)', accessor: (v) => v.totalDebit },
                  { header: 'Credit Total (INR)', accessor: (v) => v.totalCredit },
                  { header: 'Status', accessor: (v) => v.status },
                ]}
              />
              <button
                onClick={() => setIsVoucherModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Post Journal Voucher</span>
              </button>
            </>
          )}

          {activeTab === 'vehicle_ledger' && (
            <>
              <FilterPopover
                activeCount={selectedVehicleReg ? 1 : 0}
                onReset={() => setSelectedVehicleReg(vehicles[0]?.registrationNumber || '')}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Select Vehicle
                  </label>
                  <select
                    value={selectedVehicleReg}
                    onChange={(e) => setSelectedVehicleReg(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold font-mono bg-slate-50 text-slate-900"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.registrationNumber}>
                        {v.registrationNumber} — {v.nickname} ({v.ownership})
                      </option>
                    ))}
                  </select>
                </div>
              </FilterPopover>

              <PrintExportToolbar
                title={`Vehicle Cost Ledger — ${targetVehicle?.registrationNumber || 'Vehicle'}`}
                filename={`vehicle_cost_ledger_${targetVehicle?.registrationNumber || 'all'}`}
                schoolName={schoolName}
                filteredData={vehicleExpenses}
                allData={approvedExpenses}
                hasActiveFilters={true}
                columns={[
                  { header: 'Expense No', accessor: (e) => e.expenseNo },
                  { header: 'Date', accessor: (e) => e.date },
                  { header: 'Vehicle', accessor: (e) => e.vehicleNumber || 'General' },
                  { header: 'Expense Head', accessor: (e) => e.category },
                  { header: 'Vendor', accessor: (e) => e.vendorName },
                  { header: 'Mode', accessor: (e) => e.paymentMode },
                  { header: 'Amount (INR)', accessor: (e) => e.amount },
                  { header: 'Narration', accessor: (e) => e.narration },
                ]}
              />
            </>
          )}

          {activeTab === 'student_ledger' && (
            <>
              <FilterPopover
                activeCount={selectedStudentId ? 1 : 0}
                onReset={() => setSelectedStudentId(students[0]?.id || '')}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Select Member
                  </label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 text-slate-900"
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.admissionNo}) — Class {s.class}-{s.section}
                      </option>
                    ))}
                  </select>
                </div>
              </FilterPopover>

              <PrintExportToolbar
                title={`Member Fee Statement — ${selectedStudent?.name || ''} (${selectedStudent?.admissionNo || ''})`}
                filename={`member_fee_ledger_${selectedStudent?.admissionNo || 'member'}`}
                schoolName={schoolName}
                filteredData={studentLedgerEntries}
                allData={studentLedgerEntries}
                hasActiveFilters={false}
                columns={[
                  { header: 'Date', accessor: (e) => e.date },
                  { header: 'Entry Type', accessor: (e) => e.type },
                  { header: 'Ref No', accessor: (e) => e.refNo },
                  { header: 'Description', accessor: (e) => e.description },
                  { header: 'Billed Dr (INR)', accessor: (e) => e.debit || '' },
                  { header: 'Paid Cr (INR)', accessor: (e) => e.credit || '' },
                  { header: 'Running Balance (INR)', accessor: (e) => e.runningBalance },
                ]}
              />
            </>
          )}

          {activeTab === 'trial_balance' && (
            <PrintExportToolbar
              title="Double-Entry Trial Balance"
              filename="trial_balance"
              schoolName={schoolName}
              filteredData={accounts}
              allData={accounts}
              hasActiveFilters={false}
              columns={[
                { header: 'Account Code', accessor: (a) => a.code },
                { header: 'Account Title', accessor: (a) => a.name },
                { header: 'Classification', accessor: (a) => a.accountClass },
                { header: 'Debit (INR)', accessor: (a) => (a.accountClass === 'Asset' || a.accountClass === 'Expense') ? a.balance : '' },
                { header: 'Credit (INR)', accessor: (a) => (a.accountClass !== 'Asset' && a.accountClass !== 'Expense') ? a.balance : '' },
              ]}
            />
          )}
        </div>
      </div>

      {/* =====================================================================
          TAB 1: DAY BOOK (Side-by-Side Income & Expenses + Profit Summary)
         ===================================================================== */}
      {activeTab === 'day_book' && (
        <div className="space-y-5">

          {/* Side-by-Side Income & Expenses Tables (matching image_f789c2c6.png) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT COLUMN: INCOME */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-emerald-50/70 border-b border-emerald-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">Income</h3>
                  <span className="text-[10px] text-emerald-700">
                    Automated Fee Receipts + Other Income ({filteredDayBookIncomes.length} entries)
                  </span>
                </div>
                <span className="font-mono font-bold text-sm text-emerald-800">
                  ₹{totalDayBookIncome.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-2.5">Invoice No.</th>
                      <th className="py-2.5 px-2.5">Income Head</th>
                      <th className="py-2.5 px-2.5">Name</th>
                      <th className="py-2.5 px-2">To</th>
                      <th className="py-2.5 px-3 text-right font-mono">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDayBookIncomes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No income entries for selected criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredDayBookIncomes.map((inc) => (
                        <tr key={inc.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{inc.date}</td>
                          <td className="py-2.5 px-2.5 font-mono font-bold text-slate-800">
                            <div>{inc.invoiceNo}</div>
                            {inc.attachment && (
                              <button
                                onClick={() => setPreviewDoc({ title: `Income Proof — ${inc.invoiceNo}`, url: inc.attachment! })}
                                className="text-[9px] text-blue-600 hover:underline flex items-center gap-0.5 font-sans cursor-pointer"
                              >
                                <Eye className="w-2.5 h-2.5" /> View
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              inc.sourceType === 'Fee Receipt'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-indigo-100 text-indigo-900'
                            }`}>
                              {inc.incomeHead}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 font-medium text-slate-900">{inc.name}</td>
                          <td className="py-2.5 px-2 font-bold text-slate-700">{inc.toMode}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            ₹{inc.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIGHT COLUMN: EXPENSES */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-rose-50/70 border-b border-rose-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-rose-950">Expenses</h3>
                  <span className="text-[10px] text-rose-700">
                    All Transport &amp; Operational Expenses ({filteredDayBookExpenses.length} entries)
                  </span>
                </div>
                <span className="font-mono font-bold text-sm text-rose-800">
                  ₹{totalDayBookExpense.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-2.5">Invoice No.</th>
                      <th className="py-2.5 px-2.5">Expense Head</th>
                      <th className="py-2.5 px-2.5">Name</th>
                      <th className="py-2.5 px-2">From</th>
                      <th className="py-2.5 px-3 text-right font-mono">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDayBookExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No expense entries for selected criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredDayBookExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{exp.date}</td>
                          <td className="py-2.5 px-2.5 font-mono font-bold text-slate-800">
                            <div>{exp.billNumber || exp.expenseNo}</div>
                            {exp.billPhoto && (
                              <button
                                onClick={() => setPreviewDoc({ title: `Expense Bill — ${exp.expenseNo}`, url: exp.billPhoto! })}
                                className="text-[9px] text-blue-600 hover:underline flex items-center gap-0.5 font-sans cursor-pointer"
                              >
                                <Eye className="w-2.5 h-2.5" /> Bill
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5">
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 font-medium text-slate-900">
                            {exp.vendorName}
                            {exp.vehicleNumber && (
                              <span className="block text-[9px] font-mono text-slate-500">{exp.vehicleNumber}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 font-bold text-slate-700">{exp.paymentMode}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                            ₹{exp.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bottom Day Book Summary Bar (matching image_27ef554a.png) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border-2 border-emerald-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase text-slate-500 block">Total Income</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Cash: ₹{totalDayBookIncomeCash.toLocaleString('en-IN')} | UPI/Bank: ₹{totalDayBookIncomeDigital.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700">
                ₹{totalDayBookIncome.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border-2 border-rose-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase text-slate-500 block">Total Expense</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Cash: ₹{totalDayBookExpenseCash.toLocaleString('en-IN')} | UPI/Bank: ₹{totalDayBookExpenseDigital.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-rose-700">
                ₹{totalDayBookExpense.toLocaleString('en-IN')}
              </div>
            </div>

            <div className={`p-4 rounded-2xl border-2 shadow-2xs flex items-center justify-between ${
              netDayBookProfit >= 0
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-rose-950 border-rose-800 text-white'
            }`}>
              <div>
                <span className="text-xs font-bold uppercase text-amber-400 block">Total Profit / Net Balance</span>
                <span className="text-[11px] text-slate-300 mt-0.5 block">
                  Net Cash in Hand: ₹{(totalDayBookIncomeCash - totalDayBookExpenseCash).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-white">
                ₹{netDayBookProfit.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: OTHER INCOME & INCOME HEADS (Matches image_33cbb816.png & image_526f18c9.png)
         ===================================================================== */}
      {/* =====================================================================
          TAB 2: OTHER INCOME & INCOME HEADS
         ===================================================================== */}
      {activeTab === 'income' && (
        <div className="space-y-5">

          {incomeError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between">
              <span>{incomeError}</span>
              <button onClick={() => setIncomeError(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {incomeSubView === 'income_heads' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Add Income Head */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs h-fit space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Add Income Head</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Create custom income heads for non-fee transport revenues (e.g., Bus Charter, Scrap Sale, Event Hire).
                  </p>
                </div>
                <form onSubmit={handleCreateIncomeHead} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Income Head <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Excursion / Tour Bus Charter"
                      value={newIncomeHeadName}
                      onChange={(e) => setNewIncomeHeadName(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Description</label>
                    <textarea
                      rows={3}
                      placeholder="Optional description..."
                      value={newIncomeHeadDesc}
                      onChange={(e) => setNewIncomeHeadDesc(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                    >
                      Save Income Head
                    </button>
                  </div>
                </form>
              </div>

              {/* Right: Income Head List */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Income Head List ({incomeHeads.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                      <tr>
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Income Head</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {incomeHeads.map((h, idx) => (
                        <tr key={h.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{h.name}</td>
                          <td className="py-3 px-4 text-slate-600">{h.description || '—'}</td>
                          <td className="py-3 px-4 text-right">
                            {isAdmin ? (
                              <button
                                onClick={() => handleDeleteHead(h.id)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Delete Income Head"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Admin Only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Form: Add Income (matching image_33cbb816.png) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs h-fit space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Add Income</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Fee income is automatically recorded. Record any other transport income here.
                  </p>
                </div>

                <form onSubmit={handleSaveIncomeSubmit} className="space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700">
                        Income Head <span className="text-rose-600">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowInlineHeadForm(!showInlineHeadForm)}
                        className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        {showInlineHeadForm ? 'Cancel' : '+ Create Income Head'}
                      </button>
                    </div>
                    <select
                      value={selectedIncomeHead}
                      onChange={(e) => setSelectedIncomeHead(e.target.value)}
                      required
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white font-medium"
                    >
                      {incomeHeads.map(h => (
                        <option key={h.id} value={h.name}>{h.name}</option>
                      ))}
                    </select>
                  </div>

                  {showInlineHeadForm && (
                    <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                      <span className="text-[11px] font-bold text-indigo-950 block">Quick Create Income Head</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="New Income Head Name..."
                          value={newIncomeHeadName}
                          onChange={(e) => setNewIncomeHeadName(e.target.value)}
                          className="flex-1 p-2 border border-indigo-200 rounded-lg text-xs bg-white"
                        />
                        <button
                          type="button"
                          onClick={handleCreateIncomeHead}
                          className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg text-xs cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      To (Cash / UPI) <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={receivedTo}
                      onChange={(e) => setReceivedTo(e.target.value as any)}
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white font-bold"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank">Bank</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Payer / Organization Name"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Invoice Number</label>
                      <input
                        type="text"
                        placeholder="e.g. INV-2025-11"
                        value={incomeInvoiceNo}
                        onChange={(e) => setIncomeInvoiceNo(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Date <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={isAdmin ? incomeDate : todayStr}
                        readOnly={!isAdmin}
                        onChange={(e) => {
                          if (isAdmin) setIncomeDate(e.target.value);
                        }}
                        className={`w-full p-2 border rounded-xl text-xs font-mono ${
                          isAdmin
                            ? 'border-slate-300 bg-white text-slate-900'
                            : 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Amount (₹) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 4500"
                      value={incomeAmount}
                      onChange={(e) => setIncomeAmount(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-700 block text-[11px]">Attach Document</span>
                      <span className="text-[10px] text-slate-500">
                        {incomeAttachmentName || 'Upload receipt / UPI screenshot'}
                      </span>
                    </div>
                    <label className="px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1">
                      <Upload className="w-3 h-3 text-amber-400" />
                      <span>Upload</span>
                      <input type="file" accept="image/*,.pdf" onChange={handleIncomeAttachmentUpload} className="hidden" />
                    </label>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Details about this income..."
                      value={incomeDescription}
                      onChange={(e) => setIncomeDescription(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingIncome}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-xs cursor-pointer"
                    >
                      {isSavingIncome ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Income List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Other Income List ({filteredOtherIncomes.length})</h3>
                    <span className="text-xs font-mono font-bold text-emerald-700">
                      Total: ₹{filteredOtherIncomes.reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                        <tr>
                          <th className="py-3 px-4">Name</th>
                          <th className="py-3 px-3">Invoice Number</th>
                          <th className="py-3 px-3">Date</th>
                          <th className="py-3 px-3">Description</th>
                          <th className="py-3 px-3">Income Head</th>
                          <th className="py-3 px-3">To</th>
                          <th className="py-3 px-3 text-right font-mono">Amount</th>
                          {isAdmin && <th className="py-3 px-3 text-right">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredOtherIncomes.length === 0 ? (
                          <tr>
                            <td colSpan={isAdmin ? 8 : 7} className="py-8 text-center text-slate-400">
                              No other income records found.
                            </td>
                          </tr>
                        ) : (
                          filteredOtherIncomes.map((inc) => (
                            <tr key={inc.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4 font-bold text-slate-900">
                                {inc.name || inc.receivedFrom || '—'}
                                <span className="block text-[10px] font-mono text-slate-400">{inc.incomeNo}</span>
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-600">
                                <div>{inc.invoiceNumber || '—'}</div>
                                {inc.attachment && (
                                  <button
                                    onClick={() => setPreviewDoc({ title: `Income Attachment — ${inc.incomeNo}`, url: inc.attachment! })}
                                    className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-sans font-bold cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" /> View Attachment
                                  </button>
                                )}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-700">{inc.date}</td>
                              <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{inc.description || inc.remarks || '—'}</td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 font-semibold text-[10px]">
                                  {inc.incomeHeadName || inc.headName || 'Other Income'}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-700">{inc.receivedTo || inc.paymentMode || 'Cash'}</td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                                ₹{inc.amount.toLocaleString('en-IN')}
                              </td>
                              {isAdmin && (
                                <td className="py-3 px-3 text-right">
                                  <button
                                    onClick={() => onDeleteIncome(inc.id)}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                    title="Delete Income Record"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Journal Vouchers */}
      {activeTab === 'vouchers' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Posted Journal Vouchers ({filteredVouchers.length})</h3>
              <span className="text-xs text-slate-500">Strictly balanced double-entry entries</span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {filteredVouchers.length === 0 ? (
                <div className="py-8 text-center text-slate-400">No journal vouchers match your search.</div>
              ) : (
                filteredVouchers.map((vch) => (
                  <div key={vch.id} className="p-4 space-y-2 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">{vch.voucherNo}</span>
                        <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-bold text-[10px]">
                          {vch.voucherType}
                        </span>
                        <span className="text-slate-500 font-mono text-[11px]">{vch.date}</span>
                        <span className="text-emerald-700 font-semibold text-[10px] bg-emerald-50 px-2 py-0.5 rounded-sm">
                          {vch.status}
                        </span>
                      </div>

                      <div className="font-mono font-bold text-slate-900 text-sm">
                        Total: ₹{vch.totalDebit.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <p className="text-slate-600 text-xs italic">“{vch.narration}”</p>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1 font-mono text-[11px]">
                      {vch.lines.map((l, i) => (
                        <div key={i} className="flex justify-between items-center text-slate-700">
                          <div>
                            <span className="font-bold">{l.accountName}</span> ({l.accountCode})
                            {l.partyName && <span className="text-slate-500 ml-1">[{l.partyName}]</span>}
                            {l.costCenter && <span className="text-amber-800 ml-1 font-semibold">[{l.costCenter}]</span>}
                          </div>
                          <div className="space-x-4">
                            {l.debit > 0 && <span className="text-emerald-700 font-bold">Dr: ₹{l.debit.toLocaleString('en-IN')}</span>}
                            {l.credit > 0 && <span className="text-indigo-700 font-bold">Cr: ₹{l.credit.toLocaleString('en-IN')}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Vehicle Cost Ledgers */}
      {activeTab === 'vehicle_ledger' && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <label className="block text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
                Select Vehicle for Cost Ledger Analysis
              </label>
              <select
                value={selectedVehicleReg}
                onChange={(e) => setSelectedVehicleReg(e.target.value)}
                className="p-2 border border-slate-300 rounded-xl text-sm font-bold font-mono bg-slate-50 text-slate-900"
              >
                {vehicles.map(v => (
                  <option key={v.id} value={v.registrationNumber}>
                    {v.registrationNumber} — {v.nickname} ({v.ownership})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-amber-100 text-amber-900 text-xs font-bold rounded-lg">
                Fuel: {targetVehicle?.fuelType || 'Diesel'}
              </span>
              <span className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-lg">
                Driver: {targetVehicle?.assignedDriverName || 'Unassigned'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Fuel Cost</span>
              <div className="text-xl font-bold text-amber-600 mt-1">₹{vehFuelSpend.toLocaleString('en-IN')}</div>
              <span className="text-[10px] text-slate-500">Direct fuel pump bills</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Repairs &amp; Parts</span>
              <div className="text-xl font-bold text-blue-600 mt-1">₹{vehRepairsSpend.toLocaleString('en-IN')}</div>
              <span className="text-[10px] text-slate-500">Workshop &amp; servicing</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taxes &amp; Other</span>
              <div className="text-xl font-bold text-purple-600 mt-1">₹{vehOtherSpend.toLocaleString('en-IN')}</div>
              <span className="text-[10px] text-slate-500">Permits, insurance, salary</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Operational Spend</span>
              <div className="text-xl font-bold text-emerald-700 mt-1">₹{vehTotalSpend.toLocaleString('en-IN')}</div>
              <span className="text-[10px] text-slate-500">{vehicleExpenses.length} Expense vouchers</span>
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xs">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Fleet Operating Efficiency</span>
              <div className="text-xl font-bold text-white mt-1">₹{vehCostPerKm} <span className="text-xs font-normal text-slate-300">/ km</span></div>
              <span className="text-[10px] text-slate-400">{vehTotalKm} km logged in logbook</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Cost Ledger Transactions for {targetVehicle?.registrationNumber}
              </h3>
              <span className="text-xs text-slate-500 font-mono">Cost Center: {targetVehicle?.registrationNumber}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date / Ref</th>
                    <th className="py-3 px-3">Expense Head</th>
                    <th className="py-3 px-3">Vendor / Service Provider</th>
                    <th className="py-3 px-3">Payment Mode</th>
                    <th className="py-3 px-3 text-right font-mono">Amount (₹)</th>
                    <th className="py-3 px-4">Description / Narration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicleExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No direct expenses recorded for this vehicle yet.
                      </td>
                    </tr>
                  ) : (
                    vehicleExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-slate-900">{exp.expenseNo}</span>
                          <span className="text-[10px] text-slate-500 block">{exp.date}</span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{exp.category}</td>
                        <td className="py-3 px-3 text-slate-700">{exp.vendorName}</td>
                        <td className="py-3 px-3 font-medium text-slate-600">{exp.paymentMode}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                          ₹{exp.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-sm truncate">{exp.narration}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Student Fee Ledgers */}
      {activeTab === 'student_ledger' && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="w-full sm:w-96">
              <label className="block text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
                Search &amp; Select Member (Student / Staff)
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs font-medium bg-slate-50 text-slate-900"
              >
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.admissionNo}) — Class {s.class}-{s.section} — {s.transportStatus}
                  </option>
                ))}
              </select>
            </div>

            {selectedStudent && (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="bg-slate-100 p-2.5 rounded-xl">
                  <span className="text-slate-500 block text-[10px]">Monthly Tariff:</span>
                  <strong className="text-slate-900 font-mono">₹{selectedStudent.monthlyFee}/mo</strong>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-xl">
                  <span className="text-slate-500 block text-[10px]">Assigned Stop:</span>
                  <strong className="text-slate-900">{selectedStudent.morningStopName || 'N/A'}</strong>
                </div>
                <div className={`p-2.5 rounded-xl ${selectedStudent.balanceDue > 0 ? 'bg-rose-100 text-rose-900 font-bold' : 'bg-emerald-100 text-emerald-900 font-bold'}`}>
                  <span className="block text-[10px]">Outstanding Balance:</span>
                  <span className="font-mono text-sm">₹{selectedStudent.balanceDue.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Fee Statement &amp; Running Ledger: {selectedStudent?.name} ({selectedStudent?.admissionNo})
                </h3>
                <span className="text-xs text-slate-500">Debit = Fee Billed, Credit = Cash/Bank Receipt Received</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Entry Type</th>
                    <th className="py-3 px-3">Document Ref</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3 text-right font-mono">Fee Billed (Dr)</th>
                    <th className="py-3 px-3 text-right font-mono">Paid (Cr)</th>
                    <th className="py-3 px-4 text-right font-mono font-bold">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentLedgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No transactions recorded for this member yet.
                      </td>
                    </tr>
                  ) : (
                    studentLedgerEntries.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-slate-600 font-mono">{entry.date}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            entry.type === 'Invoice' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                          }`}>
                            {entry.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{entry.refNo}</td>
                        <td className="py-3 px-3 text-slate-700">{entry.description}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-900">
                          {entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-700 font-bold">
                          {entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-bold text-sm ${
                          entry.runningBalance > 0 ? 'text-rose-600' : 'text-slate-900'
                        }`}>
                          ₹{entry.runningBalance.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Trial Balance */}
      {activeTab === 'trial_balance' && (
        <div className="space-y-5">
          <div className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-4 text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-4">
            <div className="font-bold flex items-center gap-2 text-sm">
              <Scale className="w-4 h-4 text-emerald-700" />
              <span>Double-Entry Trial Balance</span>
            </div>

            <div className="bg-white px-3 py-2 rounded-xl border border-emerald-200 text-right">
              <span className="text-[10px] text-slate-500 uppercase font-semibold mr-2">Net Difference:</span>
              <span className="font-mono font-bold text-emerald-700 text-sm">
                ₹{Math.abs(totalDebitNormal - totalCreditNormal).toFixed(2)} (Balanced)
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Trial Balance as of Today</h3>
              <span className="text-xs text-slate-500 font-mono">Currency: INR (₹)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Account Code</th>
                    <th className="py-3 px-3">Account Title / Head</th>
                    <th className="py-3 px-3">Classification</th>
                    <th className="py-3 px-3 text-right font-mono">Debit (₹)</th>
                    <th className="py-3 px-4 text-right font-mono">Credit (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accounts.map((acc) => {
                    const isDebitNormal = acc.accountClass === 'Asset' || acc.accountClass === 'Expense';
                    return (
                      <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">{acc.code}</td>
                        <td className="py-3 px-3 font-semibold text-slate-900">{acc.name}</td>
                        <td className="py-3 px-3">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                            {acc.accountClass}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">
                          {isDebitNormal ? `₹${acc.balance.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                          {!isDebitNormal ? `₹${acc.balance.toLocaleString('en-IN')}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-900 text-white font-mono text-xs font-bold">
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider text-amber-400">
                      Trial Balance Totals:
                    </td>
                    <td className="py-3 px-3 text-right">₹{totalDebitNormal.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right">₹{totalCreditNormal.toLocaleString('en-IN')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Manual Journal Voucher Modal */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">Post Double-Entry Journal Voucher</h3>
              </div>
              <button onClick={() => setIsVoucherModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVoucherSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Voucher Date</label>
                  <input
                    type="date"
                    required
                    value={isAdmin ? vchDate : todayStr}
                    readOnly={!isAdmin}
                    onChange={(e) => {
                      if (isAdmin) setVchDate(e.target.value);
                    }}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Voucher Type</label>
                  <select
                    value={vchType}
                    onChange={(e) => setVchType(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white font-medium"
                  >
                    <option value="Journal">Journal Voucher (JV)</option>
                    <option value="Payment">Payment Voucher (PV)</option>
                    <option value="Receipt">Receipt Voucher (RV)</option>
                    <option value="Settlement">Advance Settlement</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 font-bold">Ledger Lines (Debit must equal Credit)</label>
                  <button
                    type="button"
                    onClick={addVoucherLine}
                    className="text-amber-700 hover:text-amber-800 font-bold text-[11px] cursor-pointer"
                  >
                    + Add Line
                  </button>
                </div>

                {vchLines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div className="col-span-5">
                      <select
                        value={line.accountId}
                        onChange={(e) => handleLineAccountChange(idx, e.target.value)}
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-[11px] bg-white font-medium"
                      >
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name} ({a.accountClass})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="Debit (₹)"
                        min={0}
                        value={line.debit || ''}
                        onChange={(e) => handleLineAmountChange(idx, 'debit', Number(e.target.value))}
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-[11px] font-mono bg-white"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="Credit (₹)"
                        min={0}
                        value={line.credit || ''}
                        onChange={(e) => handleLineAmountChange(idx, 'credit', Number(e.target.value))}
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-[11px] font-mono bg-white"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      {vchLines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeVoucherLine(idx)}
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between px-3 py-2 bg-slate-900 text-white rounded-xl font-mono text-xs">
                  <span>Balance Check:</span>
                  <div className="space-x-4">
                    <span className="text-emerald-400">Dr: ₹{formTotalDebit.toLocaleString('en-IN')}</span>
                    <span className="text-amber-400">Cr: ₹{formTotalCredit.toLocaleString('en-IN')}</span>
                    {isFormBalanced ? (
                      <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded font-bold">BALANCED</span>
                    ) : (
                      <span className="bg-rose-500 text-white px-2 py-0.5 rounded font-bold">UNBALANCED</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Voucher Narration *</label>
                <input
                  type="text"
                  required
                  placeholder="Explain purpose of journal entry..."
                  value={vchNarration}
                  onChange={(e) => setVchNarration(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              {vchError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{vchError}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVoucherModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isFormBalanced || isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {isSubmitting ? 'Posting...' : 'Post Balanced Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document / Bill Attachment Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">{previewDoc.title}</h3>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-center">
              <img src={previewDoc.url} alt={previewDoc.title} className="max-h-96 object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

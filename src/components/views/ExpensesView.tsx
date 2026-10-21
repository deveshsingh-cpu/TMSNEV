import React, { useState, useEffect } from 'react';
import { 
  IndianRupee, Plus, Search, Calendar, Tag, X, Upload, Eye, Trash2, Lock, Check, Ban, ShieldCheck
} from 'lucide-react';
import { ExpenseRecord, ExpenseHead, Vehicle } from '../../types/index.js';
import { PrintExportToolbar, FilterPopover } from '../../utils/exportPrint.js';

interface ExpensesViewProps {
  schoolName?: string;
  isAdmin?: boolean;
  currentRole?: string;
  initialTab?: 'expenses' | 'expense_heads';
  expenses?: ExpenseRecord[];
  expenseHeads?: ExpenseHead[];
  vehicles?: Vehicle[];
  onAddExpense: (data: Omit<ExpenseRecord, 'id' | 'expenseNo'>) => Promise<any>;
  onUpdateExpenseApproval?: (
    id: string,
    payload: { status: 'Approved' | 'Rejected'; approvedBy?: string; rejectionReason?: string }
  ) => Promise<any>;
  onDeleteExpense?: (id: string) => Promise<void>;
  onSaveExpenseHead: (data: { id?: string; name: string; category?: string; requiresApproval?: boolean }) => Promise<ExpenseHead>;
  onDeleteExpenseHead: (id: string) => Promise<void>;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  schoolName,
  isAdmin = true,
  currentRole = 'Admin',
  initialTab = 'expenses',
  expenses = [],
  expenseHeads = [],
  vehicles = [],
  onAddExpense,
  onUpdateExpenseApproval,
  onDeleteExpense,
  onSaveExpenseHead,
  onDeleteExpenseHead,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState<'expenses' | 'expense_heads'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // New Expense form state
  const [expenseDate, setExpenseDate] = useState(todayStr);
  const [category, setCategory] = useState<string>(expenseHeads[0]?.name || 'Fuel (Diesel / CNG)');
  const [vehicleNumber, setVehicleNumber] = useState('General');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank' | 'UPI'>('Cash');
  const [vendorName, setVendorName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billPhoto, setBillPhoto] = useState<string>('');
  const [billFileName, setBillFileName] = useState<string>('');
  const [narration, setNarration] = useState('');
  const [odometerReading, setOdometerReading] = useState<string>('');
  const [fuelLitres, setFuelLitres] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewBill, setPreviewBill] = useState<{ title: string; url: string } | null>(null);

  // Expense Head creator state
  const [newHeadName, setNewHeadName] = useState('');
  const [newHeadDesc, setNewHeadDesc] = useState('Direct Expense');
  const [newHeadRequiresApproval, setNewHeadRequiresApproval] = useState(false);
  const [headError, setHeadError] = useState<string | null>(null);
  const [showInlineHeadCreator, setShowInlineHeadCreator] = useState(false);

  useEffect(() => {
    if (!category && expenseHeads.length > 0) {
      setCategory(expenseHeads[0].name);
    }
  }, [expenseHeads, category]);

  useEffect(() => {
    if (!isAdmin) {
      setExpenseDate(todayStr);
    }
  }, [isAdmin, todayStr, isModalOpen]);

  const selectedHeadObj = expenseHeads.find((h) => h.name === category);
  const categoryNeedsApproval = !!selectedHeadObj?.requiresApproval;

  const handleBillPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBillFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBillPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const filteredExpenses = expenses.filter((exp) => {
    const matchesSearch =
      exp.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.narration.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.expenseNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exp.billNumber && exp.billNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (exp.vehicleNumber && exp.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || exp.category === selectedCategory;
    const matchesVehicle = selectedVehicle === 'all' || exp.vehicleNumber === selectedVehicle;
    const statusVal = exp.approvalStatus || 'Approved';
    const matchesStatus = selectedApprovalStatus === 'all' || statusVal === selectedApprovalStatus;
    const matchesFrom = !dateFrom || exp.date >= dateFrom;
    const matchesTo = !dateTo || exp.date <= dateTo;
    return matchesSearch && matchesCategory && matchesVehicle && matchesStatus && matchesFrom && matchesTo;
  });

  // Paid / Approved totals only incorporate Approved expenses
  const approvedExpenses = filteredExpenses.filter(
    (e) => e.approvalStatus !== 'Pending Approval' && e.approvalStatus !== 'Rejected'
  );
  const pendingExpensesCount = expenses.filter((e) => e.approvalStatus === 'Pending Approval').length;
  const totalFilteredSpend = approvedExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    try {
      setIsSubmitting(true);
      const selectedVehObj = vehicles.find((v) => v.registrationNumber === vehicleNumber);
      await onAddExpense({
        date: isAdmin ? expenseDate : todayStr,
        category: category || expenseHeads[0]?.name || 'General Operations',
        vehicleId: selectedVehObj?.id,
        vehicleNumber,
        driverName: vehicleNumber !== 'General' ? (driverName || selectedVehObj?.assignedDriverName || '') : undefined,
        odometerReading: vehicleNumber !== 'General' && odometerReading ? Number(odometerReading) : undefined,
        fuelLitres: vehicleNumber !== 'General' && fuelLitres ? Number(fuelLitres) : undefined,
        amount: Number(amount),
        paymentMode,
        vendorName: vendorName || 'Direct Vendor',
        billNumber,
        billPhoto: billPhoto || undefined,
        narration: narration || `${category} expenditure`,
        recordedBy: currentRole,
        requiresApproval: categoryNeedsApproval,
      });
      setIsModalOpen(false);
      setAmount('');
      setVendorName('');
      setBillNumber('');
      setBillPhoto('');
      setBillFileName('');
      setNarration('');
      setOdometerReading('');
      setFuelLitres('');
    } catch (err) {
      console.error('Failed to add expense:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateExpenseHead = async (e: React.FormEvent) => {
    e.preventDefault();
    setHeadError(null);
    if (!newHeadName.trim()) {
      setHeadError('Expense Category Name is required.');
      return;
    }
    try {
      const saved = await onSaveExpenseHead({
        name: newHeadName.trim(),
        category: newHeadDesc.trim() || 'Direct Expense',
        requiresApproval: newHeadRequiresApproval,
      });
      setCategory(saved.name);
      setNewHeadName('');
      setNewHeadDesc('Direct Expense');
      setNewHeadRequiresApproval(false);
      setShowInlineHeadCreator(false);
    } catch (err: any) {
      setHeadError(err.message || 'Failed to save Expense Category');
    }
  };

  const handleToggleHeadApproval = async (head: ExpenseHead) => {
    if (!isAdmin) return;
    await onSaveExpenseHead({
      id: head.id,
      name: head.name,
      category: head.category,
      requiresApproval: !head.requiresApproval,
    });
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedVehicle !== 'all' ||
    selectedApprovalStatus !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '';

  return (
    <div className="space-y-5">
      {/* Header & Unified Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {activeTab === 'expense_heads' ? 'Expense Approval Categories' : 'Expenses Register'}
          </h2>
          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            {activeTab === 'expense_heads' ? `${expenseHeads.length} Categories` : `${filteredExpenses.length} Records`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'expenses' && (
            <>
              <div className="relative w-48 sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search vendor, invoice..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <FilterPopover
                isFiltered={
                  selectedCategory !== 'all' ||
                  selectedVehicle !== 'all' ||
                  selectedApprovalStatus !== 'all' ||
                  dateFrom !== '' ||
                  dateTo !== ''
                }
                onReset={() => {
                  setSelectedCategory('all');
                  setSelectedVehicle('all');
                  setSelectedApprovalStatus('all');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Expense Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50"
                  >
                    <option value="all">All Categories</option>
                    {expenseHeads.map((h) => (
                      <option key={h.id} value={h.name}>
                        {h.name} {h.requiresApproval ? '(Approval Req.)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Vehicle
                  </label>
                  <select
                    value={selectedVehicle}
                    onChange={(e) => setSelectedVehicle(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-800 bg-slate-50"
                  >
                    <option value="all">All Vehicles</option>
                    <option value="General">General (Non-Vehicle)</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.registrationNumber}>
                        {v.registrationNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Approval Status
                  </label>
                  <select
                    value={selectedApprovalStatus}
                    onChange={(e) => setSelectedApprovalStatus(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Approved">Approved (Paid/Accepted)</option>
                    <option value="Pending Approval">Pending Admin Approval</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Date From
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full py-1.5 px-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Date To
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full py-1.5 px-2.5 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50"
                    />
                  </div>
                </div>
              </FilterPopover>

              <PrintExportToolbar
                title="Transport Expense Register"
                filename="transport_expenses_ledger"
                schoolName={schoolName}
                filteredData={filteredExpenses}
                allData={expenses}
                hasActiveFilters={hasActiveFilters}
                columns={[
                  { header: 'Expense No', accessor: (e) => e.expenseNo },
                  { header: 'Date', accessor: (e) => e.date },
                  { header: 'Expense Category', accessor: (e) => e.category },
                  { header: 'Vehicle', accessor: (e) => e.vehicleNumber || 'General' },
                  { header: 'Vendor / Payee', accessor: (e) => e.vendorName },
                  { header: 'Invoice / Bill No', accessor: (e) => e.billNumber || '—' },
                  { header: 'Payment Mode', accessor: (e) => e.paymentMode },
                  { header: 'Approval Status', accessor: (e) => e.approvalStatus || 'Approved' },
                  { header: 'Amount (INR)', accessor: (e) => e.amount },
                ]}
              />
            </>
          )}

          {activeTab === 'expenses' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Expense</span>
            </button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: EXPENSES REGISTER & APPROVALS                                */}
      {/* =================================================================== */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Approved &amp; Paid Total</span>
                <div className="text-xl font-bold text-slate-900 mt-0.5">
                  ₹{totalFilteredSpend.toLocaleString('en-IN')}
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                {approvedExpenses.length} Approved
              </span>
            </div>

            <div className="bg-amber-50/70 rounded-xl p-4 border border-amber-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-800 uppercase">Awaiting Admin Approval</span>
                <div className="text-xl font-bold text-amber-900 mt-0.5">{pendingExpensesCount}</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSelectedApprovalStatus(
                    selectedApprovalStatus === 'Pending Approval' ? 'all' : 'Pending Approval'
                  )
                }
                className="text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                {selectedApprovalStatus === 'Pending Approval' ? 'Show All' : 'Filter Pending'}
              </button>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Approval Rule Categories</span>
                <div className="text-xl font-bold text-slate-900 mt-0.5">
                  {expenseHeads.filter((h) => h.requiresApproval).length} / {expenseHeads.length}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('expense_heads')}
                className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                Configure Categories →
              </button>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Expense No &amp; Date</th>
                    <th className="py-3 px-3">Expense Category</th>
                    <th className="py-3 px-3">Vehicle</th>
                    <th className="py-3 px-3">Vendor &amp; Invoice</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No expense records found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => {
                      const status = exp.approvalStatus || 'Approved';
                      return (
                        <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-900">{exp.expenseNo}</div>
                            <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              <span>{exp.date}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800">
                              <Tag className="w-3 h-3" />
                              <span>{exp.category}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`font-mono font-semibold px-2 py-0.5 rounded-sm ${
                                exp.vehicleNumber && exp.vehicleNumber !== 'General'
                                  ? 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {exp.vehicleNumber || 'General'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900">{exp.vendorName}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {exp.billNumber && (
                                <span className="text-[11px] text-slate-500 font-mono">
                                  Inv: {exp.billNumber}
                                </span>
                              )}
                              {exp.billPhoto && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewBill({
                                      title: `Bill — ${exp.expenseNo} (${exp.vendorName})`,
                                      url: exp.billPhoto!,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 hover:bg-amber-200 text-[10px] font-bold cursor-pointer"
                                >
                                  <Eye className="w-2.5 h-2.5" />
                                  <span>Bill</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-700 max-w-xs">
                            <div>{exp.narration}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Mode: {exp.paymentMode} • By {exp.recordedBy}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                status === 'Approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : status === 'Pending Approval'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {status === 'Approved' ? 'Approved (Paid)' : status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                            ₹{exp.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {status === 'Pending Approval' && isAdmin && onUpdateExpenseApproval && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateExpenseApproval(exp.id, {
                                        status: 'Approved',
                                        approvedBy: 'Admin',
                                      })
                                    }
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                    title="Approve & Proceed for Payment"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateExpenseApproval(exp.id, {
                                        status: 'Rejected',
                                        approvedBy: 'Admin',
                                        rejectionReason: 'Rejected by Admin',
                                      })
                                    }
                                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                    title="Reject Expense"
                                  >
                                    <Ban className="w-3 h-3" />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}
                              {isAdmin && onDeleteExpense && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteExpense(exp.id)}
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                                  title="Delete Expense (Admin Only)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: EXPENSE CATEGORIES & APPROVAL RULE CONFIGURATION             */}
      {/* =================================================================== */}
      {activeTab === 'expense_heads' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Add Expense Category Form with Approval Checkbox (Admin Only) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 h-fit">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              Add Expense Type / Category
            </h3>

            {!isAdmin ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Only Admin can create or modify Expense Categories.</span>
              </div>
            ) : (
              <>
                {headError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    {headError}
                  </div>
                )}

                <form onSubmit={handleCreateExpenseHead} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Expense Category Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newHeadName}
                      onChange={(e) => setNewHeadName(e.target.value)}
                      placeholder="e.g. Spare Parts, Tyre Retreading"
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Accounting Classification
                    </label>
                    <select
                      value={newHeadDesc}
                      onChange={(e) => setNewHeadDesc(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white font-semibold"
                    >
                      <option value="Direct Expense">Direct Fleet Expense</option>
                      <option value="Indirect Expense">Indirect / Operational Expense</option>
                    </select>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newHeadRequiresApproval}
                        onChange={(e) => setNewHeadRequiresApproval(e.target.checked)}
                        className="mt-0.5 rounded accent-slate-900"
                      />
                      <div>
                        <div className="font-bold text-slate-900">
                          Require Admin Approval for this Category
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          If checked, all expenses in this category are sent to Admin for approval before payment &amp; ledger posting. If unchecked, entries are directly accepted.
                        </div>
                      </div>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    Save Expense Category
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Right: Expense Categories List with Approval Toggle */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Configured Expense Categories ({expenseHeads.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Expense Category</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Admin Approval Required?</th>
                    <th className="py-3 px-3">Entries</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenseHeads.map((h) => {
                    const count = expenses.filter((e) => e.category === h.name).length;
                    return (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{h.name}</td>
                        <td className="py-3 px-3 text-slate-600">{h.category}</td>
                        <td className="py-3 px-3">
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!h.requiresApproval}
                              disabled={!isAdmin}
                              onChange={() => handleToggleHeadApproval(h)}
                              className="rounded accent-amber-600"
                            />
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                h.requiresApproval
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {h.requiresApproval ? 'Approval Required' : 'Direct Acceptance'}
                            </span>
                          </label>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-700">{count}</td>
                        <td className="py-3 px-4 text-right">
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await onDeleteExpenseHead(h.id);
                                } catch (err: any) {
                                  alert(err.message);
                                }
                              }}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Delete Expense Category"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Record Transport Expense</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Expense Category *</label>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowInlineHeadCreator((prev) => !prev)}
                        className="text-[10px] font-bold text-amber-700 hover:underline cursor-pointer"
                      >
                        {showInlineHeadCreator ? 'Cancel' : '+ New Category'}
                      </button>
                    )}
                  </div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800"
                  >
                    {expenseHeads.map((h) => (
                      <option key={h.id} value={h.name}>
                        {h.name} {h.requiresApproval ? '(Approval Req.)' : '(Direct)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Vehicle (Syncs to Log Book &amp; Ledger)
                  </label>
                  <select
                    value={vehicleNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVehicleNumber(val);
                      const v = vehicles.find((veh) => veh.registrationNumber === val);
                      if (v) {
                        setDriverName(v.assignedDriverName || '');
                        setOdometerReading(String((v.currentOdometer || 0) + 15));
                      } else {
                        setDriverName('');
                        setOdometerReading('');
                      }
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono font-bold text-slate-900"
                  >
                    <option value="General">General (All Fleet)</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.registrationNumber}>
                        {v.registrationNumber} ({v.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {vehicleNumber !== 'General' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
                  <div>
                    <label className="block font-bold text-indigo-950 mb-1 text-[11px]">
                      Assigned Driver (Auto)
                    </label>
                    <input
                      type="text"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="Driver Name"
                      className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-indigo-950 mb-1 text-[11px]">
                      Current Odometer (km) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={odometerReading}
                      onChange={(e) => setOdometerReading(e.target.value)}
                      placeholder="Seek Odometer Reading"
                      className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-indigo-950 mb-1 text-[11px]">
                      Fuel Litres (if Fuel)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={fuelLitres}
                      onChange={(e) => setFuelLitres(e.target.value)}
                      placeholder="e.g. 25.5 L"
                      className="w-full p-2 rounded-lg border border-indigo-200 bg-white text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Approval Policy Indicator */}
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-between text-[11px] font-semibold ${
                  categoryNeedsApproval
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  {categoryNeedsApproval
                    ? 'Admin Approval Required: Entry will be sent to Admin before payment & ledger posting.'
                    : 'Direct Acceptance Category: Entry will be accepted and posted to ledgers immediately.'}
                </span>
              </div>

              {showInlineHeadCreator && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="font-bold text-amber-950 text-[11px]">
                    Create New Expense Category
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newHeadName}
                      onChange={(e) => setNewHeadName(e.target.value)}
                      placeholder="Category name"
                      className="flex-1 p-2 rounded-lg border border-amber-300 bg-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleCreateExpenseHead}
                      className="px-3 py-1.5 bg-slate-900 text-white font-bold rounded-lg text-xs cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-amber-900">
                    <input
                      type="checkbox"
                      checked={newHeadRequiresApproval}
                      onChange={(e) => setNewHeadRequiresApproval(e.target.checked)}
                    />
                    <span>Require Admin Approval for this category</span>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 2500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Date *</span>
                    {!isAdmin && <Lock className="w-3 h-3 text-slate-400" />}
                  </label>
                  <input
                    type="date"
                    required
                    value={isAdmin ? expenseDate : todayStr}
                    disabled={!isAdmin}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className={`w-full p-2.5 rounded-xl border font-mono ${
                      isAdmin
                        ? 'border-slate-200 bg-white text-slate-900'
                        : 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Vendor / Payee Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Indian Oil / Auto Workshop"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Invoice / Bill Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9942"
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description / Narration *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Enter details..."
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-700">
                  Attach Bill / Voucher Photo
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer shadow-2xs">
                    <Upload className="w-3.5 h-3.5 text-amber-600" />
                    <span>{billFileName ? 'Change Bill File' : 'Upload Bill Photo'}</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleBillPhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {billPhoto && (
                    <span className="text-[11px] text-emerald-700 font-semibold truncate">
                      ✓ {billFileName || 'Attached'}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : categoryNeedsApproval
                    ? 'Submit for Admin Approval'
                    : 'Save & Post Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bill Preview Modal */}
      {previewBill && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900 text-sm">{previewBill.title}</h4>
              <button
                onClick={() => setPreviewBill(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-100 rounded-2xl p-4 flex items-center justify-center max-h-[65vh] overflow-auto">
              <img
                src={previewBill.url}
                alt={previewBill.title}
                className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

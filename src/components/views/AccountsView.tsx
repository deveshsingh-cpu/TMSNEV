import React, { useState, useEffect } from 'react';
import { 
  Landmark, BookOpen, Scale, Plus, Search, 
  CheckCircle, AlertTriangle, Truck, GraduationCap, 
  FileText, X, IndianRupee, Tag, Upload, Eye, Trash2, Lock, Calendar,
  BarChart3, Printer, PhoneCall, ChevronDown, ChevronRight, Users, Filter, Clock, MessageSquare
} from 'lucide-react';
import { 
  AccountHead, JournalVoucher, JournalLine, 
  Vehicle, Student, FeeInvoice, FeeReceipt, ExpenseRecord,
  OdometerLog, IncomeHead, IncomeRecord, CampusMaster, Route, FeeFollowUpRecord
} from '../../types/index.js';
import { PrintExportToolbar, FilterPopover, openHtmlPrintPreview } from '../../utils/exportPrint.js';
import { readFileCompressed } from '../../utils/fileCompressor.js';

type AccountsTabKey =
  | 'day_book'
  | 'route_outstanding'
  | 'demand_slip'
  | 'income'
  | 'vouchers'
  | 'vehicle_ledger'
  | 'student_ledger'
  | 'trial_balance';

interface AccountsViewProps {
  schoolName?: string;
  isAdmin?: boolean;
  currentRole?: string;
  userCampus?: string;
  campuses?: CampusMaster[];
  classes?: string[];
  sections?: string[];
  routes?: Route[];
  followUps?: FeeFollowUpRecord[];
  onAddFollowUp?: (data: Partial<FeeFollowUpRecord>) => Promise<any>;
  initialTab?: AccountsTabKey;
  onTabChange?: (tab: AccountsTabKey) => void;
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
  onDeleteIncome?: (id: string) => Promise<void>;
  onDeleteExpense?: (id: string) => Promise<void>;
  onCreateVoucher: (data: Omit<JournalVoucher, 'id' | 'voucherNo' | 'totalDebit' | 'totalCredit' | 'status'>) => Promise<any>;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  schoolName = 'Narendra Edu Valley',
  isAdmin = true,
  currentRole = 'Admin',
  userCampus,
  campuses = [],
  classes = [],
  sections = [],
  routes = [],
  followUps = [],
  onAddFollowUp,
  initialTab = 'day_book',
  onTabChange,
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
  onDeleteExpense,
  onCreateVoucher,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  // Only incorporate Approved expenses in paid reports, Day Book, and Ledgers
  const approvedExpenses = expenses.filter(
    (e) => !e.approvalStatus || e.approvalStatus === 'Approved'
  );
  const [activeTab, setActiveTab] = useState<AccountsTabKey>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleSelectTab = (tab: AccountsTabKey) => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  // Campus scoping for Transport Assistant vs Coordinator/Admin
  const isAssistant = currentRole === 'Transport Assistant';
  const lockedCampus =
    isAssistant && userCampus && userCampus !== 'All Campuses' ? userCampus : null;

  // Route-wise Outstanding State
  const [routeOutCampusFilter, setRouteOutCampusFilter] = useState<string>(lockedCampus || 'all');
  const [routeOutVehicleFilter, setRouteOutVehicleFilter] = useState<string>('all');
  const [routeOutRouteFilter, setRouteOutRouteFilter] = useState<string>('all');
  const [routeOutDuesFilter, setRouteOutDuesFilter] = useState<'all' | 'with_dues'>('all');
  const [routeOutSearch, setRouteOutSearch] = useState<string>('');
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);

  // Demand Slip State
  const [demandCampusFilter, setDemandCampusFilter] = useState<string>(lockedCampus || 'all');
  const [demandClassFilter, setDemandClassFilter] = useState<string>('all');
  const [demandSectionFilter, setDemandSectionFilter] = useState<string>('all');
  const [demandRouteFilter, setDemandRouteFilter] = useState<string>('all');
  const [demandVehicleFilter, setDemandVehicleFilter] = useState<string>('all');
  const [demandDuesMode, setDemandDuesMode] = useState<'overdue_only' | 'all'>('overdue_only');
  const [demandSearch, setDemandSearch] = useState<string>('');
  const [demandDueDate, setDemandDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  // Follow-up Modal State (for Demand Slip & Route-wise Outstanding)
  const [followUpModalStudent, setFollowUpModalStudent] = useState<Student | null>(null);
  const [fuCallDate, setFuCallDate] = useState<string>(todayStr);
  const [fuContactedPerson, setFuContactedPerson] = useState<string>('Father / Guardian');
  const [fuOutcome, setFuOutcome] = useState<FeeFollowUpRecord['callOutcome']>('Promised to Pay');
  const [fuPromisedDate, setFuPromisedDate] = useState<string>('');
  const [fuNextFollowUpDate, setFuNextFollowUpDate] = useState<string>('');
  const [fuRemarks, setFuRemarks] = useState<string>('');
  const [isSavingFollowUp, setIsSavingFollowUp] = useState<boolean>(false);

  useEffect(() => {
    if (lockedCampus) {
      setRouteOutCampusFilter(lockedCampus);
      setDemandCampusFilter(lockedCampus);
    }
  }, [lockedCampus]);

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
  // 4. ROUTE-WISE OUTSTANDING & DEMAND SLIP COMPUTATION
  // ============================================================================
  const getStudentPhone = (student: Student): string => {
    return (
      student.mobile ||
      student.phone ||
      (student as any).parentPhone ||
      student.emergencyContact ||
      '—'
    );
  };

  const getStudentStopDisplay = (student: Student): string => {
    return (
      student.pickupDropStopName ||
      student.pickupStopName ||
      student.villageName ||
      (student as any).stopName ||
      '—'
    );
  };

  const getRouteVehicleNumber = (rt?: Route, student?: Student): string => {
    if (rt?.vehicleNumber && rt.vehicleNumber.trim()) return rt.vehicleNumber.trim();
    if ((rt as any)?.assignedVehicleReg && (rt as any).assignedVehicleReg.trim()) {
      return (rt as any).assignedVehicleReg.trim();
    }
    if (rt?.vehicleId) {
      const found = vehicles.find(
        (v) => v.id === rt.vehicleId || v.registrationNumber === rt.vehicleId
      );
      if (found) return found.registrationNumber;
    }
    if (rt?.vehicleLast4) {
      const found = vehicles.find(
        (v) =>
          v.registrationNumber === rt.vehicleLast4 ||
          v.registrationNumber.endsWith(rt.vehicleLast4) ||
          v.nickname === rt.vehicleLast4
      );
      if (found) return found.registrationNumber;
      return rt.vehicleLast4;
    }
    const codeStr = rt?.code || student?.routeCode || '';
    const parts = codeStr.split('/');
    if (parts.length >= 2 && parts[1]) {
      const found = vehicles.find(
        (v) =>
          v.registrationNumber === parts[1] ||
          v.registrationNumber.endsWith(parts[1]) ||
          v.nickname === parts[1]
      );
      return found ? found.registrationNumber : parts[1];
    }
    return (student as any)?.vehicleNumber || '—';
  };

  const isStudentAssignedToRoute = (s: Student, rt: Route): boolean => {
    if (
      s.transportStatus === 'Left' ||
      s.transportStatus === 'Terminated' ||
      (s.transportStatus as string) === 'Left School'
    ) {
      return false;
    }
    if (rt.id && s.routeId && s.routeId === rt.id) return true;
    const sCode = (s.routeCode || (s as any).routeName || '').trim().toLowerCase();
    const rtCode = (rt.code || '').trim().toLowerCase();
    const rtName = (rt.name || '').trim().toLowerCase();
    if (rtCode && sCode && sCode === rtCode) return true;
    if (rtName && sCode && sCode === rtName) return true;
    return false;
  };

  const getStudentFeeStats = (student: Student) => {
    const stuInvoices = invoices.filter(
      (i) => i.studentId === student.id || (student.admissionNo && i.admissionNo === student.admissionNo)
    );
    const stuReceipts = receipts.filter(
      (r) => r.studentId === student.id || (student.admissionNo && r.admissionNo === student.admissionNo)
    );
    const previousDuesAmount = Number(student.previousDues || 0);
    const prevDuesInv = stuInvoices.filter(
      (i) => i.month === 'Previous Dues' || i.id.startsWith('inv-prev-')
    );
    const sessionInv = stuInvoices.filter(
      (i) => i.month !== 'Previous Dues' && !i.id.startsWith('inv-prev-')
    );
    const totalBilledInvoices = stuInvoices.reduce(
      (s, i) => s + Number(i.netPayable ?? i.netAmount ?? 0),
      0
    );
    const hasPrevInvoice = prevDuesInv.length > 0;
    const totalBilled = totalBilledInvoices + (!hasPrevInvoice ? previousDuesAmount : 0);
    const totalCollected = stuReceipts.reduce(
      (s, r) => s + Number(r.amountPaid ?? r.amount ?? 0),
      0
    );
    const totalOutstanding = Math.max(0, totalBilled - totalCollected);
    const pendingMonths = stuInvoices
      .filter((i) => i.status !== 'Paid' && (i.balanceDue ?? 0) > 0)
      .map((i) => i.month);
    const stuFollowUps = followUps
      .filter((f) => f.studentId === student.id || (student.admissionNo && f.admissionNo === student.admissionNo))
      .sort((a, b) => (b.callDate || b.date || '').localeCompare(a.callDate || a.date || ''));

    return {
      previousDuesAmount,
      sessionBilled: sessionInv.reduce((s, i) => s + Number(i.netPayable ?? i.netAmount ?? 0), 0),
      totalBilled,
      totalCollected,
      totalOutstanding,
      pendingMonths,
      followUps: stuFollowUps,
      latestFollowUp: stuFollowUps[0] || null,
    };
  };

  interface RouteOutstandingSummary {
    routeId: string;
    routeCode: string;
    routeName: string;
    campus: string;
    vehicleNumber: string;
    activeMembersCount: number;
    overdueMembersCount: number;
    previousDuesTotal: number;
    sessionBilledTotal: number;
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    collectionRate: number;
    members: Array<{
      student: Student;
      stats: ReturnType<typeof getStudentFeeStats>;
    }>;
  }

  const routeSummaries: RouteOutstandingSummary[] = routes
    .filter((rt) => {
      const rtCampus = rt.campus || rt.campusCode || 'Sr';
      const rtVeh = getRouteVehicleNumber(rt);
      if (lockedCampus && rtCampus !== lockedCampus) return false;
      if (routeOutCampusFilter !== 'all' && rtCampus !== routeOutCampusFilter) return false;
      if (
        routeOutVehicleFilter !== 'all' &&
        rtVeh !== routeOutVehicleFilter &&
        rt.vehicleId !== routeOutVehicleFilter &&
        rt.vehicleNumber !== routeOutVehicleFilter &&
        rt.vehicleLast4 !== routeOutVehicleFilter
      ) {
        return false;
      }
      if (
        routeOutRouteFilter !== 'all' &&
        rt.id !== routeOutRouteFilter &&
        rt.code !== routeOutRouteFilter
      ) {
        return false;
      }
      if (routeOutSearch.trim()) {
        const q = routeOutSearch.toLowerCase();
        const matchRoute =
          (rt.code || '').toLowerCase().includes(q) ||
          (rt.name || '').toLowerCase().includes(q) ||
          rtVeh.toLowerCase().includes(q);
        if (!matchRoute) return false;
      }
      return true;
    })
    .map((rt) => {
      const routeMembers = students.filter((s) => isStudentAssignedToRoute(s, rt));
      const memberRows = routeMembers.map((s) => ({
        student: s,
        stats: getStudentFeeStats(s),
      }));
      const previousDuesTotal = memberRows.reduce((sum, m) => sum + m.stats.previousDuesAmount, 0);
      const sessionBilledTotal = memberRows.reduce((sum, m) => sum + m.stats.sessionBilled, 0);
      const totalBilled = memberRows.reduce((sum, m) => sum + m.stats.totalBilled, 0);
      const totalCollected = memberRows.reduce((sum, m) => sum + m.stats.totalCollected, 0);
      const totalOutstanding = memberRows.reduce((sum, m) => sum + m.stats.totalOutstanding, 0);
      const overdueMembersCount = memberRows.filter((m) => m.stats.totalOutstanding > 0).length;
      const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

      return {
        routeId: rt.id,
        routeCode: rt.code,
        routeName: rt.name || rt.code,
        campus: rt.campus || rt.campusCode || 'Sr',
        vehicleNumber: getRouteVehicleNumber(rt),
        activeMembersCount: routeMembers.length,
        overdueMembersCount,
        previousDuesTotal,
        sessionBilledTotal,
        totalBilled,
        totalCollected,
        totalOutstanding,
        collectionRate,
        members: memberRows.sort((a, b) => b.stats.totalOutstanding - a.stats.totalOutstanding),
      };
    })
    .filter((summary) => (routeOutDuesFilter === 'with_dues' ? summary.totalOutstanding > 0 : true));

  const maxRouteGraphAmount = Math.max(
    1,
    ...routeSummaries.map((r) => Math.max(r.totalCollected, r.totalOutstanding, r.totalBilled))
  );

  const demandFilteredMembers = students
    .filter(
      (s) =>
        s.transportStatus !== 'Left' &&
        s.transportStatus !== 'Terminated' &&
        (s.transportStatus as string) !== 'Left School'
    )
    .filter((s) => {
      const rt = routes.find((r) => isStudentAssignedToRoute(s, r));
      const stuCampus = s.campus || rt?.campus || rt?.campusCode || 'Sr';
      const vehReg = getRouteVehicleNumber(rt, s);
      if (lockedCampus && stuCampus !== lockedCampus) return false;
      if (demandCampusFilter !== 'all' && stuCampus !== demandCampusFilter) return false;
      if (demandClassFilter !== 'all' && s.class !== demandClassFilter) return false;
      if (demandSectionFilter !== 'all' && s.section !== demandSectionFilter) return false;
      if (
        demandRouteFilter !== 'all' &&
        s.routeId !== demandRouteFilter &&
        s.routeCode !== demandRouteFilter &&
        rt?.code !== demandRouteFilter
      ) {
        return false;
      }
      if (
        demandVehicleFilter !== 'all' &&
        vehReg !== demandVehicleFilter &&
        rt?.vehicleNumber !== demandVehicleFilter &&
        rt?.vehicleLast4 !== demandVehicleFilter
      ) {
        return false;
      }
      if (demandSearch.trim()) {
        const q = demandSearch.toLowerCase();
        const match =
          s.name.toLowerCase().includes(q) ||
          s.admissionNo.toLowerCase().includes(q) ||
          (s.fatherName || '').toLowerCase().includes(q) ||
          getStudentPhone(s).toLowerCase().includes(q) ||
          getStudentStopDisplay(s).toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    })
    .map((s) => {
      const rt = routes.find((r) => isStudentAssignedToRoute(s, r));
      return {
        student: s,
        campus: s.campus || rt?.campus || rt?.campusCode || 'Sr',
        routeCode: rt?.code || s.routeCode || '—',
        vehicleReg: getRouteVehicleNumber(rt, s),
        stats: getStudentFeeStats(s),
      };
    })
    .filter((row) => (demandDuesMode === 'overdue_only' ? row.stats.totalOutstanding > 0 : true))
    .sort((a, b) => b.stats.totalOutstanding - a.stats.totalOutstanding);

  const printRouteReminderListPdf = (routeSummary: RouteOutstandingSummary, overdueOnly = true) => {
    const rows = overdueOnly
      ? routeSummary.members.filter((m) => m.stats.totalOutstanding > 0)
      : routeSummary.members;
    const totalOut = rows.reduce((s, r) => s + r.stats.totalOutstanding, 0);
    const totalCol = rows.reduce((s, r) => s + r.stats.totalCollected, 0);
    const totalPrev = rows.reduce((s, r) => s + r.stats.previousDuesAmount, 0);

    const html = `
      <div style="font-family: Inter, Arial, sans-serif; background: #ffffff; color: #0f172a; padding: 12px;">
        <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; background: #ffffff;">
          <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${schoolName}</h1>
          <div style="font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 4px;">
            ROUTE-WISE FEE REMINDER / OUTSTANDING REGISTER
          </div>
          <div style="font-size: 11.5px; color: #334155; margin-top: 5px;">
            Route: <strong style="color: #0f172a;">${routeSummary.routeCode}</strong> &nbsp;|&nbsp;
            Campus: <strong style="color: #0f172a;">${routeSummary.campus}</strong> &nbsp;|&nbsp;
            Vehicle: <strong style="color: #0f172a;">${routeSummary.vehicleNumber}</strong> &nbsp;|&nbsp;
            Members Listed: <strong style="color: #0f172a;">${rows.length}</strong> &nbsp;|&nbsp;
            Date: <strong style="color: #0f172a;">${todayStr}</strong>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; background: #ffffff; color: #0f172a;">
          <thead>
            <tr style="background: #f8fafc; color: #0f172a; border-bottom: 2px solid #0f172a;">
              <th style="border: 1px solid #94a3b8; padding: 7px 6px; text-align: center; color: #0f172a;">Sl</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 6px; text-align: left; color: #0f172a;">Adm No</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 6px; text-align: left; color: #0f172a;">Member Name</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 6px; text-align: left; color: #0f172a;">Class</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 6px; text-align: left; color: #0f172a;">Father / Guardian</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 6px; text-align: left; color: #0f172a;">Village / Stop</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 6px; text-align: left; color: #0f172a;">Phone</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 6px; text-align: right; color: #0f172a;">Prev. Dues (₹)</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 6px; text-align: right; color: #0f172a;">Collected (₹)</th>
              <th style="border: 1px solid #94a3b8; padding: 7px 6px; text-align: right; color: #0f172a;">Outstanding (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length === 0
                ? `<tr><td colspan="10" style="border: 1px solid #94a3b8; padding: 16px; text-align: center; color: #475569; background: #ffffff;">No members with pending dues on Route ${routeSummary.routeCode}.</td></tr>`
                : rows
                    .map(
                      (r, idx) => `
              <tr style="background: #ffffff; color: #0f172a;">
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; color: #0f172a;">${idx + 1}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace; font-weight: 700; color: #0f172a;">${r.student.admissionNo || '—'}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 700; color: #0f172a;">${r.student.name || '—'}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; color: #0f172a;">${r.student.class || '—'}${r.student.section ? `-${r.student.section}` : ''}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; color: #0f172a;">${r.student.fatherName || '—'}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; color: #0f172a;">${getStudentStopDisplay(r.student)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace; color: #0f172a;">${getStudentPhone(r.student)}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; color: #0f172a;">₹${r.stats.previousDuesAmount.toLocaleString('en-IN')}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; color: #047857; font-weight: 600;">₹${r.stats.totalCollected.toLocaleString('en-IN')}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: 700; color: #be123c;">₹${r.stats.totalOutstanding.toLocaleString('en-IN')}</td>
              </tr>
            `
                    )
                    .join('')
            }
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; font-weight: 800; color: #0f172a;">
              <td colspan="7" style="border: 1px solid #94a3b8; padding: 7px 6px; text-align: right; color: #0f172a;">ROUTE TOTAL (${rows.length} Members):</td>
              <td style="border: 1px solid #94a3b8; padding: 7px 6px; text-align: right; color: #0f172a;">₹${totalPrev.toLocaleString('en-IN')}</td>
              <td style="border: 1px solid #94a3b8; padding: 7px 6px; text-align: right; color: #047857;">₹${totalCol.toLocaleString('en-IN')}</td>
              <td style="border: 1px solid #94a3b8; padding: 7px 6px; text-align: right; color: #be123c;">₹${totalOut.toLocaleString('en-IN')}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
    openHtmlPrintPreview({
      title: `Route Reminder List — ${routeSummary.routeCode}`,
      subtitle: `Vehicle: ${routeSummary.vehicleNumber} • ${rows.length} Members on Route`,
      html,
      filename: `route_reminder_list_${routeSummary.routeCode.replace(/[^a-zA-Z0-9]/g, '_')}`,
    });
  };

  const printDemandSlipsBatchPdf = (
    items: Array<{
      student: Student;
      stats: ReturnType<typeof getStudentFeeStats>;
      routeCode?: string;
      vehicleReg?: string;
    }>,
    titleLabel: string
  ) => {
    if (items.length === 0) return;
    const slipsHtml = items
      .map(({ student, stats, routeCode, vehicleReg }, index) => {
        const rt = routes.find((r) => isStudentAssignedToRoute(student, r));
        const rCode = routeCode || rt?.code || student.routeCode || '—';
        const vReg = vehicleReg || getRouteVehicleNumber(rt, student);
        const pendingMonthsLabel =
          stats.pendingMonths.length > 0 ? stats.pendingMonths.join(', ') : 'Current Session Dues';

        return `
          <div style="background: #ffffff; color: #0f172a; border: 1.5px solid #0f172a; border-radius: 8px; padding: 14px; margin-bottom: 14px; page-break-inside: avoid; font-family: Inter, Arial, sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 10px; background: #ffffff;">
              <div>
                <div style="font-size: 15px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${schoolName}</div>
                <div style="font-size: 11px; font-weight: 700; color: #334155;">TRANSPORT FEE DEMAND / REMINDER SLIP</div>
              </div>
              <div style="text-align: right; font-size: 11px; color: #0f172a;">
                <div><strong>Slip #:</strong> DEM-${todayStr.replace(/-/g, '')}-${index + 1}</div>
                <div><strong>Date:</strong> ${todayStr}</div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 14px; font-size: 11.5px; margin-bottom: 10px; color: #0f172a; background: #ffffff;">
              <div><strong>Student Name:</strong> ${student.name}</div>
              <div><strong>Admission No:</strong> <span style="font-family: monospace; font-weight: 700;">${student.admissionNo}</span></div>
              <div><strong>Class &amp; Sec:</strong> ${student.class}${student.section ? `-${student.section}` : ''}</div>
              <div><strong>Father's Name:</strong> ${student.fatherName || '—'}</div>
              <div><strong>Route / Vehicle:</strong> ${rCode} (${vReg})</div>
              <div><strong>Stop / Village:</strong> ${getStudentStopDisplay(student)}</div>
              <div><strong>Contact Phone:</strong> ${getStudentPhone(student)}</div>
              <div><strong>Monthly Rate:</strong> ₹${Number((student as any).netMonthlyFee ?? student.monthlyFee ?? 0).toLocaleString('en-IN')}/mo</div>
              <div><strong>Pay By Date:</strong> <strong style="color: #be123c;">${demandDueDate}</strong></div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; background: #ffffff; color: #0f172a;">
              <thead>
                <tr style="background: #f8fafc; color: #0f172a;">
                  <th style="border: 1px solid #94a3b8; padding: 6px; text-align: left; color: #0f172a;">Fee Particulars / Months Due</th>
                  <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right; color: #0f172a;">Previous Dues (₹)</th>
                  <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right; color: #0f172a;">Session Billed (₹)</th>
                  <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right; color: #0f172a;">Paid So Far (₹)</th>
                  <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right; color: #0f172a;">Net Payable Due (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr style="background: #ffffff; color: #0f172a;">
                  <td style="border: 1px solid #94a3b8; padding: 6px; color: #0f172a;">${pendingMonthsLabel}</td>
                  <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right; color: #0f172a;">₹${stats.previousDuesAmount.toLocaleString('en-IN')}</td>
                  <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right; color: #0f172a;">₹${stats.sessionBilled.toLocaleString('en-IN')}</td>
                  <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right; color: #047857; font-weight: 600;">₹${stats.totalCollected.toLocaleString('en-IN')}</td>
                  <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right; font-weight: 800; font-size: 12.5px; color: #be123c;">₹${stats.totalOutstanding.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: #334155; padding-top: 4px; background: #ffffff;">
              <div>Dear Parent, kindly deposit the outstanding transport fee of <strong style="color: #0f172a;">₹${stats.totalOutstanding.toLocaleString('en-IN')}</strong> by <strong style="color: #0f172a;">${demandDueDate}</strong>.</div>
              <div style="font-weight: 700; color: #0f172a;">Transport In-Charge Sign</div>
            </div>
          </div>
        `;
      })
      .join('');

    openHtmlPrintPreview({
      title: titleLabel,
      subtitle: `${items.length} Reminder Slip(s) • White A4 Print Layout`,
      html: `<div style="background: #ffffff; color: #0f172a; padding: 8px;">${slipsHtml}</div>`,
    });
  };

  const handleOpenFollowUpModal = (student: Student) => {
    setFollowUpModalStudent(student);
    setFuCallDate(todayStr);
    setFuContactedPerson(student.fatherName || 'Father / Guardian');
    setFuOutcome('Promised to Pay');
    setFuPromisedDate('');
    setFuNextFollowUpDate('');
    setFuRemarks('');
  };

  const handleSaveFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpModalStudent || !onAddFollowUp || !fuRemarks.trim()) return;
    try {
      setIsSavingFollowUp(true);
      await onAddFollowUp({
        studentId: followUpModalStudent.id,
        callDate: isAdmin ? fuCallDate : todayStr,
        contactedPerson: fuContactedPerson.trim() || 'Parent',
        callOutcome: fuOutcome,
        promisedPayDate: fuPromisedDate || undefined,
        nextFollowUpDate: fuNextFollowUpDate || undefined,
        remarks: fuRemarks.trim(),
        recordedBy: currentRole,
      });
      setFuRemarks('');
      setFuPromisedDate('');
      setFuNextFollowUpDate('');
    } finally {
      setIsSavingFollowUp(false);
    }
  };

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
      {/* Quick Navigation Bar for Day Book, Member Fee Ledger, Vehicle Cost Ledger & Accounts */}
      <div className="bg-slate-900 text-white p-3 rounded-2xl border border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSelectTab('day_book')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'day_book'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Print / View Day Book</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('student_ledger')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'student_ledger'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Member Fee Ledger</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('vehicle_ledger')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'vehicle_ledger'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Vehicle Cost Ledger</span>
          </button>

          {currentRole !== 'Transport Assistant' && (
            <>
              <button
                type="button"
                onClick={() => handleSelectTab('income')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'income'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>Other Income</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('vouchers')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'vouchers'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Vouchers</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('trial_balance')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'trial_balance'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Trial Balance</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {lockedCampus && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 text-[11px] font-bold">
              <span>Scoped Campus: {lockedCampus}</span>
            </span>
          )}
          {isAdmin ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-bold">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Admin: Full Authority</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-200 text-[11px] font-bold">
              <Eye className="w-3.5 h-3.5" />
              <span>{currentRole}: View, Print &amp; Follow-up</span>
            </span>
          )}
        </div>
      </div>

      {/* Unified Top Header Bar (Scoped strictly to active Sidebar screen) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {activeTab === 'day_book' && 'Print / View Day Book (Income & Expense)'}
            {activeTab === 'route_outstanding' && 'Route-wise Outstanding & Collected Fee Details'}
            {activeTab === 'demand_slip' && 'Demand Slip / Fee Reminder Generator & Phone Follow-up'}
            {activeTab === 'income' && 'Other Income & Heads'}
            {activeTab === 'vouchers' && 'Vouchers & Chart of Accounts'}
            {activeTab === 'vehicle_ledger' && 'Vehicle Cost Ledger & Expenses'}
            {activeTab === 'student_ledger' && 'Member Fee Ledger'}
            {activeTab === 'trial_balance' && 'Trial Balance'}
          </h2>
          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            {activeTab === 'day_book' && `${combinedDayBookExportRows.length} Entries`}
            {activeTab === 'route_outstanding' && `Route Analytics & PDF Slips`}
            {activeTab === 'demand_slip' && `Reminder Slips & Phone Follow-up`}
            {activeTab === 'income' && `${filteredOtherIncomes.length} Records`}
            {activeTab === 'vouchers' && `${filteredVouchers.length} Vouchers`}
            {activeTab === 'vehicle_ledger' && `${vehicleExpenses.length} Vouchers`}
            {activeTab === 'student_ledger' && `${studentLedgerEntries.length} Entries`}
            {activeTab === 'trial_balance' && `${accounts.length} Accounts`}
          </span>
          {!isAdmin && (
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-500" />
              <span>View-Only Mode ({currentRole})</span>
            </span>
          )}
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

              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelectTab('income')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Record Income</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsVoucherModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Post Voucher</span>
                  </button>
                </>
              )}
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
              {isAdmin && (
                <button
                  onClick={() => setIsVoucherModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Post Journal Voucher</span>
                </button>
              )}
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

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsVoucherModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Post Vehicle Voucher</span>
                </button>
              )}
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

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsVoucherModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Post Ledger Voucher</span>
                </button>
              )}
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
                      {isAdmin && <th className="py-2.5 px-2.5 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDayBookIncomes.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 7 : 6} className="py-8 text-center text-slate-400">
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
                          {isAdmin && (
                            <td className="py-2.5 px-2.5 text-right">
                              {inc.sourceType === 'Other Income' ? (
                                <button
                                  type="button"
                                  onClick={() => onDeleteIncome(inc.id)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                                  title="Delete Other Income Record (Admin)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="text-[9px] text-slate-400 font-mono">Auto</span>
                              )}
                            </td>
                          )}
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
                      {isAdmin && onDeleteExpense && <th className="py-2.5 px-2.5 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDayBookExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin && onDeleteExpense ? 7 : 6} className="py-8 text-center text-slate-400">
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
                          {isAdmin && onDeleteExpense && (
                            <td className="py-2.5 px-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => onDeleteExpense(exp.id)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                                title="Delete Expense Record (Admin)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
                    {isAdmin && onDeleteExpense && <th className="py-3 px-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicleExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin && onDeleteExpense ? 7 : 6} className="py-8 text-center text-slate-400">
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
                        {isAdmin && onDeleteExpense && (
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => onDeleteExpense(exp.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Delete Vehicle Expense Record (Admin)"
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

      {/* =====================================================================
          TAB: ROUTE-WISE OUTSTANDING DETAILS (Graph + Route List + PDF Slips)
         ===================================================================== */}
      {activeTab === 'route_outstanding' && (
        <div className="space-y-4">
          {/* Top KPI & Filter Strip */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <span>Route-wise Outstanding Details</span>
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                {/* Campus Filter */}
                <select
                  value={lockedCampus || routeOutCampusFilter}
                  disabled={Boolean(lockedCampus)}
                  onChange={(e) => {
                    setRouteOutCampusFilter(e.target.value);
                    setRouteOutRouteFilter('all');
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-800 disabled:opacity-75"
                >
                  {!lockedCampus && <option value="all">All Campuses</option>}
                  <option value="Sr">Sr Campus</option>
                  <option value="Jr">Jr Campus</option>
                  {campuses
                    .filter((c) => c.code !== 'Sr' && c.code !== 'Jr' && c.name !== 'Sr' && c.name !== 'Jr')
                    .map((c) => (
                      <option key={c.id} value={c.code || c.name}>
                        {c.name}
                      </option>
                    ))}
                </select>

                {/* Vehicle Filter */}
                <select
                  value={routeOutVehicleFilter}
                  onChange={(e) => {
                    setRouteOutVehicleFilter(e.target.value);
                    setRouteOutRouteFilter('all');
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-800"
                >
                  <option value="all">All Vehicles</option>
                  {Array.from(
                    new Set([
                      ...vehicles.map((v) => v.registrationNumber),
                      ...routes.map((r) => getRouteVehicleNumber(r)).filter((v) => v && v !== '—'),
                    ])
                  ).map((vehReg) => (
                    <option key={vehReg} value={vehReg}>
                      Vehicle: {vehReg}
                    </option>
                  ))}
                </select>

                {/* Route Filter */}
                <select
                  value={routeOutRouteFilter}
                  onChange={(e) => setRouteOutRouteFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-800"
                >
                  <option value="all">All Routes ({routes.length})</option>
                  {routes
                    .filter((r) => {
                      const c = r.campus || r.campusCode || 'Sr';
                      if (lockedCampus && c !== lockedCampus) return false;
                      if (routeOutCampusFilter !== 'all' && c !== routeOutCampusFilter) return false;
                      if (
                        routeOutVehicleFilter !== 'all' &&
                        getRouteVehicleNumber(r) !== routeOutVehicleFilter &&
                        r.vehicleNumber !== routeOutVehicleFilter
                      ) {
                        return false;
                      }
                      return true;
                    })
                    .map((r) => (
                      <option key={r.id} value={r.code}>
                        {r.code} ({getRouteVehicleNumber(r)})
                      </option>
                    ))}
                </select>

                {/* Dues Filter */}
                <select
                  value={routeOutDuesFilter}
                  onChange={(e) => setRouteOutDuesFilter(e.target.value as 'all' | 'with_dues')}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 text-slate-800"
                >
                  <option value="all">All Routes</option>
                  <option value="with_dues">With Pending Dues</option>
                </select>

                {/* Search Route */}
                <div className="relative w-44">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search route..."
                    value={routeOutSearch}
                    onChange={(e) => setRouteOutSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50"
                  />
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Total Billed</div>
                <div className="text-base font-extrabold font-mono text-slate-900 mt-0.5">
                  ₹{routeSummaries.reduce((s, r) => s + r.totalBilled, 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-slate-500">
                  Prev. Dues: ₹{routeSummaries.reduce((s, r) => s + r.previousDuesTotal, 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <div className="text-[10px] font-bold text-emerald-800 uppercase">Collected Fee</div>
                <div className="text-base font-extrabold font-mono text-emerald-700 mt-0.5">
                  ₹{routeSummaries.reduce((s, r) => s + r.totalCollected, 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-emerald-700">
                  {routeSummaries.length} route(s) shown
                </div>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
                <div className="text-[10px] font-bold text-rose-800 uppercase">Outstanding Fee</div>
                <div className="text-base font-extrabold font-mono text-rose-700 mt-0.5">
                  ₹{routeSummaries.reduce((s, r) => s + r.totalOutstanding, 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-rose-700">
                  {routeSummaries.reduce((s, r) => s + r.overdueMembersCount, 0)} members with dues
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                <div className="text-[10px] font-bold text-amber-900 uppercase">Pay By Date (Slips)</div>
                <input
                  type="date"
                  value={demandDueDate}
                  onChange={(e) => setDemandDueDate(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1 rounded-lg border border-amber-300 bg-white font-mono text-xs font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Visual Bar Graph: Route-wise Collected vs Outstanding (Compact & Scrollable) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Route-wise Collected vs Outstanding Graph
              </h4>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                  Collected (₹)
                </span>
                <span className="flex items-center gap-1.5 text-rose-700">
                  <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block" />
                  Outstanding (₹)
                </span>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {routeSummaries.map((rt) => {
                const colWidth = rt.totalCollected > 0 ? Math.max(3, Math.round((rt.totalCollected / maxRouteGraphAmount) * 100)) : 0;
                const outWidth = rt.totalOutstanding > 0 ? Math.max(3, Math.round((rt.totalOutstanding / maxRouteGraphAmount) * 100)) : 0;
                return (
                  <div
                    key={rt.routeId}
                    onClick={() => setExpandedRouteId(expandedRouteId === rt.routeId ? null : rt.routeId)}
                    className="p-2.5 rounded-xl border border-slate-200/80 hover:border-indigo-300 hover:bg-slate-50/70 transition-all cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 text-amber-400 font-mono font-bold text-[11px]">
                          {rt.routeCode}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                          {rt.campus}
                        </span>
                        <span className="text-slate-600 font-medium">
                          Vehicle: <strong className="font-mono text-slate-900">{rt.vehicleNumber}</strong>
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600">
                          {rt.overdueMembersCount}/{rt.activeMembersCount} members with dues
                        </span>
                      </div>
                      <div className="flex items-center gap-4 font-mono text-xs">
                        <span className="text-emerald-700 font-bold">
                          Collected: ₹{rt.totalCollected.toLocaleString('en-IN')}
                        </span>
                        <span className="text-rose-600 font-extrabold">
                          Outstanding: ₹{rt.totalOutstanding.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden flex items-center">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, colWidth)}%` }}
                        />
                      </div>
                      <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden flex items-center">
                        <div
                          className="bg-rose-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, outWidth)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Route-wise Register with Direct Filters & Slip Generation */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Route-wise Outstanding Register ({routeSummaries.length} Routes)
              </h4>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={routeOutRouteFilter}
                  onChange={(e) => setRouteOutRouteFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold text-xs"
                >
                  <option value="all">Filter Route: All</option>
                  {routes
                    .filter((r) => {
                      const c = r.campus || r.campusCode || 'Sr';
                      if (lockedCampus && c !== lockedCampus) return false;
                      if (routeOutCampusFilter !== 'all' && c !== routeOutCampusFilter) return false;
                      return true;
                    })
                    .map((r) => (
                      <option key={r.id} value={r.code}>
                        {r.code} ({getRouteVehicleNumber(r)})
                      </option>
                    ))}
                </select>

                {(routeOutCampusFilter !== (lockedCampus || 'all') ||
                  routeOutVehicleFilter !== 'all' ||
                  routeOutRouteFilter !== 'all' ||
                  routeOutDuesFilter !== 'all' ||
                  routeOutSearch) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRouteOutCampusFilter(lockedCampus || 'all');
                      setRouteOutVehicleFilter('all');
                      setRouteOutRouteFilter('all');
                      setRouteOutDuesFilter('all');
                      setRouteOutSearch('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">Route</th>
                    <th className="py-3 px-3">Campus</th>
                    <th className="py-3 px-3">Vehicle</th>
                    <th className="py-3 px-3 text-center">Members (Due/Total)</th>
                    <th className="py-3 px-3 text-right font-mono">Prev. Dues (₹)</th>
                    <th className="py-3 px-3 text-right font-mono">Collected (₹)</th>
                    <th className="py-3 px-3 text-right font-mono">Outstanding (₹)</th>
                    <th className="py-3 px-4 text-right">Reminder / Demand Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {routeSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No routes match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    routeSummaries.map((rt) => {
                      const isExpanded = expandedRouteId === rt.routeId;
                      const overdueMembers = rt.members.filter((m) => m.stats.totalOutstanding > 0);
                      return (
                        <React.Fragment key={rt.routeId}>
                          <tr className="hover:bg-slate-50/90 transition-colors">
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => setExpandedRouteId(isExpanded ? null : rt.routeId)}
                                className="flex items-center gap-2 font-bold text-slate-900 hover:text-indigo-600 cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-indigo-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                                <span className="font-mono px-2 py-0.5 rounded bg-slate-900 text-amber-400 text-xs">
                                  {rt.routeCode}
                                </span>
                              </button>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-bold text-[11px]">
                                {rt.campus}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-800">{rt.vehicleNumber}</td>
                            <td className="py-3 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px]">
                                {rt.overdueMembersCount} Due
                              </span>{' '}
                              <span className="text-slate-400">/ {rt.activeMembersCount}</span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-700">
                              ₹{rt.previousDuesTotal.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                              ₹{rt.totalCollected.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-extrabold text-rose-600 text-sm">
                              ₹{rt.totalOutstanding.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => printRouteReminderListPdf(rt, true)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Route PDF List</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    printDemandSlipsBatchPdf(
                                      (overdueMembers.length > 0 ? overdueMembers : rt.members).map((m) => ({
                                        student: m.student,
                                        stats: m.stats,
                                        routeCode: rt.routeCode,
                                        vehicleReg: rt.vehicleNumber,
                                      })),
                                      `Route ${rt.routeCode} — Group Reminder Slips (${
                                        overdueMembers.length > 0 ? overdueMembers.length : rt.members.length
                                      } Members)`
                                    )
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Print Group Slips ({overdueMembers.length})</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedRouteId(isExpanded ? null : rt.routeId)}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] cursor-pointer"
                                >
                                  {isExpanded ? 'Hide Members' : 'Individual Slips'}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="bg-slate-50/90 p-4 border-b border-slate-200">
                                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                  <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-slate-800">
                                      Route {rt.routeCode} • Vehicle: {rt.vehicleNumber} ({rt.members.length} Assigned Members • {overdueMembers.length} Overdue)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => printRouteReminderListPdf(rt, false)}
                                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-[11px] cursor-pointer"
                                    >
                                      Print All Route Members ({rt.members.length})
                                    </button>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-[11px]">
                                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold">
                                        <tr>
                                          <th className="py-2 px-3">Adm No</th>
                                          <th className="py-2 px-3">Member Name</th>
                                          <th className="py-2 px-2.5">Class</th>
                                          <th className="py-2 px-3">Father&apos;s Name</th>
                                          <th className="py-2 px-3">Stop / Village</th>
                                          <th className="py-2 px-2.5">Phone</th>
                                          <th className="py-2 px-2.5 text-right">Prev. Dues</th>
                                          <th className="py-2 px-2.5 text-right">Collected</th>
                                          <th className="py-2 px-3 text-right">Outstanding</th>
                                          <th className="py-2 px-3 text-right">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {rt.members.length === 0 ? (
                                          <tr>
                                            <td colSpan={10} className="py-6 text-center text-slate-400">
                                              No members assigned to Route {rt.routeCode}.
                                            </td>
                                          </tr>
                                        ) : (
                                          rt.members.map(({ student, stats }) => (
                                            <tr key={student.id} className="hover:bg-slate-50">
                                              <td className="py-2 px-3 font-mono font-bold text-slate-700">
                                                {student.admissionNo}
                                              </td>
                                              <td className="py-2 px-3 font-bold text-slate-900">{student.name}</td>
                                              <td className="py-2 px-2.5">
                                                {student.class}{student.section ? `-${student.section}` : ''}
                                              </td>
                                              <td className="py-2 px-3 text-slate-700">
                                                {student.fatherName || '—'}
                                              </td>
                                              <td className="py-2 px-3 text-slate-600">
                                                {getStudentStopDisplay(student)}
                                              </td>
                                              <td className="py-2 px-2.5 font-mono text-slate-700">
                                                {getStudentPhone(student)}
                                              </td>
                                              <td className="py-2 px-2.5 text-right font-mono">
                                                ₹{stats.previousDuesAmount.toLocaleString('en-IN')}
                                              </td>
                                              <td className="py-2 px-2.5 text-right font-mono text-emerald-700 font-bold">
                                                ₹{stats.totalCollected.toLocaleString('en-IN')}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono font-extrabold text-rose-600">
                                                ₹{stats.totalOutstanding.toLocaleString('en-IN')}
                                              </td>
                                              <td className="py-2 px-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      printDemandSlipsBatchPdf(
                                                        [
                                                          {
                                                            student,
                                                            stats,
                                                            routeCode: rt.routeCode,
                                                            vehicleReg: rt.vehicleNumber,
                                                          },
                                                        ],
                                                        `Reminder Slip — ${student.name} (${student.admissionNo})`
                                                      )
                                                    }
                                                    className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                                                  >
                                                    <Printer className="w-3 h-3" />
                                                    <span>Print Slip</span>
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenFollowUpModal(student)}
                                                    className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer"
                                                  >
                                                    <PhoneCall className="w-3 h-3" />
                                                    <span>Follow-up ({stats.followUps.length})</span>
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB: DEMAND SLIP & PHONE FOLLOW-UP SUB-MODULE
         ===================================================================== */}
      {activeTab === 'demand_slip' && (
        <div className="space-y-4">
          {/* Multi-Filter Bar: Campus, Class, Section, Route, Vehicle */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Printer className="w-4 h-4 text-amber-600" />
                <span>Demand Slip &amp; Phone Fee Follow-up</span>
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    printDemandSlipsBatchPdf(
                      demandFilteredMembers,
                      `Demand Slips — ${demandFilteredMembers.length} Members`
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Filtered Slips ({demandFilteredMembers.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const totalOut = demandFilteredMembers.reduce(
                      (s, r) => s + r.stats.totalOutstanding,
                      0
                    );
                    const listHtml = `
                      <div style="font-family: Inter, Arial, sans-serif; background: #ffffff; color: #0f172a; padding: 12px;">
                        <h2 style="margin: 0 0 4px 0; text-align: center; color: #0f172a;">${schoolName} — DEMAND SLIP / OUTSTANDING LIST</h2>
                        <p style="margin: 0 0 12px 0; text-align: center; font-size: 11px; color: #334155;">
                          Campus: ${lockedCampus || demandCampusFilter} | Class: ${demandClassFilter} | Section: ${demandSectionFilter} | Route: ${demandRouteFilter} | Vehicle: ${demandVehicleFilter}
                        </p>
                        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; background: #ffffff; color: #0f172a;">
                          <thead>
                            <tr style="background: #f8fafc; color: #0f172a;">
                              <th style="border: 1px solid #94a3b8; padding: 6px; color: #0f172a;">Sl</th>
                              <th style="border: 1px solid #94a3b8; padding: 6px; color: #0f172a;">Adm No</th>
                              <th style="border: 1px solid #94a3b8; padding: 6px; color: #0f172a;">Member Name</th>
                              <th style="border: 1px solid #94a3b8; padding: 6px; color: #0f172a;">Class</th>
                              <th style="border: 1px solid #94a3b8; padding: 6px; color: #0f172a;">Father / Guardian</th>
                              <th style="border: 1px solid #94a3b8; padding: 6px; color: #0f172a;">Route / Vehicle</th>
                              <th style="border: 1px solid #94a3b8; padding: 6px; color: #0f172a;">Phone</th>
                              <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right; color: #0f172a;">Prev. Dues</th>
                              <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right; color: #0f172a;">Outstanding (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${demandFilteredMembers
                              .map(
                                (r, idx) => `
                              <tr style="background: #ffffff; color: #0f172a;">
                                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; color: #0f172a;">${idx + 1}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace; font-weight: 700; color: #0f172a;">${r.student.admissionNo}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 700; color: #0f172a;">${r.student.name}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px; color: #0f172a;">${r.student.class}${r.student.section ? `-${r.student.section}` : ''}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px; color: #0f172a;">${r.student.fatherName || '—'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px; color: #0f172a;">${r.routeCode} (${r.vehicleReg})</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace; color: #0f172a;">${getStudentPhone(r.student)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; color: #0f172a;">₹${r.stats.previousDuesAmount.toLocaleString('en-IN')}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: 700; color: #be123c;">₹${r.stats.totalOutstanding.toLocaleString('en-IN')}</td>
                              </tr>
                            `
                              )
                              .join('')}
                          </tbody>
                          <tfoot>
                            <tr style="background: #f8fafc; font-weight: 800; color: #0f172a;">
                              <td colspan="8" style="border: 1px solid #94a3b8; padding: 6px; text-align: right; color: #0f172a;">TOTAL OUTSTANDING:</td>
                              <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right; color: #be123c;">₹${totalOut.toLocaleString('en-IN')}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    `;
                    openHtmlPrintPreview({
                      title: 'Demand Slip Summary Register',
                      subtitle: `${demandFilteredMembers.length} Members`,
                      html: listHtml,
                    });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Print List (PDF)</span>
                </button>
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Campus</label>
                <select
                  value={lockedCampus || demandCampusFilter}
                  disabled={Boolean(lockedCampus)}
                  onChange={(e) => setDemandCampusFilter(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
                >
                  {!lockedCampus && <option value="all">All Campuses</option>}
                  <option value="Sr">Sr Campus</option>
                  <option value="Jr">Jr Campus</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Class</label>
                <select
                  value={demandClassFilter}
                  onChange={(e) => setDemandClassFilter(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
                >
                  <option value="all">All Classes</option>
                  {classes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Section</label>
                <select
                  value={demandSectionFilter}
                  onChange={(e) => setDemandSectionFilter(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
                >
                  <option value="all">All Sections</option>
                  {sections.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Route</label>
                <select
                  value={demandRouteFilter}
                  onChange={(e) => setDemandRouteFilter(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
                >
                  <option value="all">All Routes</option>
                  {routes
                    .filter((r) => !lockedCampus || (r.campus || r.campusCode || 'Sr') === lockedCampus)
                    .map((r) => (
                      <option key={r.id} value={r.code}>
                        {r.code} ({getRouteVehicleNumber(r)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vehicle</label>
                <select
                  value={demandVehicleFilter}
                  onChange={(e) => setDemandVehicleFilter(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
                >
                  <option value="all">All Vehicles</option>
                  {Array.from(
                    new Set([
                      ...vehicles.map((v) => v.registrationNumber),
                      ...routes.map((r) => getRouteVehicleNumber(r)).filter((v) => v && v !== '—'),
                    ])
                  ).map((vReg) => (
                    <option key={vReg} value={vReg}>
                      {vReg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dues Filter</label>
                <select
                  value={demandDuesMode}
                  onChange={(e) => setDemandDuesMode(e.target.value as any)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
                >
                  <option value="overdue_only">With Pending Dues (&gt; ₹0)</option>
                  <option value="all">All Members</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Search</label>
                <input
                  type="text"
                  placeholder="Name, Adm No, Phone..."
                  value={demandSearch}
                  onChange={(e) => setDemandSearch(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* Demand Slip & Follow-Up Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">Adm No &amp; Member</th>
                    <th className="py-3 px-2.5">Campus / Class</th>
                    <th className="py-3 px-3">Route &amp; Vehicle</th>
                    <th className="py-3 px-3">Father &amp; Phone</th>
                    <th className="py-3 px-2.5 text-right font-mono">Prev. Dues</th>
                    <th className="py-3 px-2.5 text-right font-mono">Collected</th>
                    <th className="py-3 px-3 text-right font-mono">Outstanding</th>
                    <th className="py-3 px-3">Past Communication</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {demandFilteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400">
                        No members match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    demandFilteredMembers.map(({ student, campus, routeCode, vehicleReg, stats }) => {
                      const phoneStr = getStudentPhone(student);
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{student.name}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {student.admissionNo} • {getStudentStopDisplay(student)}
                            </div>
                          </td>
                          <td className="py-3 px-2.5">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold text-[10px] mr-1">
                              {campus}
                            </span>
                            <span className="font-semibold text-slate-700">
                              {student.class}{student.section ? `-${student.section}` : ''}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono font-bold text-slate-800">{routeCode}</div>
                            <div className="text-[10px] font-mono text-slate-500">{vehicleReg}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-800">
                              {student.fatherName || '—'}
                            </div>
                            {phoneStr !== '—' ? (
                              <a
                                href={`tel:${phoneStr}`}
                                className="text-[11px] font-mono font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                              >
                                <PhoneCall className="w-3 h-3" />
                                <span>{phoneStr}</span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-2.5 text-right font-mono text-slate-700">
                            ₹{stats.previousDuesAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-2.5 text-right font-mono font-bold text-emerald-700">
                            ₹{stats.totalCollected.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-rose-600 text-sm">
                            ₹{stats.totalOutstanding.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 max-w-xs">
                            {stats.latestFollowUp ? (
                              <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px]">
                                <div className="flex items-center justify-between gap-1 font-bold text-amber-950">
                                  <span>{stats.latestFollowUp.callOutcome || stats.latestFollowUp.outcome}</span>
                                  <span className="font-mono text-[10px] text-slate-500">
                                    {stats.latestFollowUp.callDate || stats.latestFollowUp.date}
                                  </span>
                                </div>
                                <div className="text-slate-700 truncate mt-0.5">
                                  {stats.latestFollowUp.remarks || stats.latestFollowUp.notes}
                                </div>
                                {(stats.latestFollowUp.promisedPayDate || stats.latestFollowUp.promiseDate) && (
                                  <div className="text-[10px] font-bold text-indigo-700 mt-0.5">
                                    Promised: {stats.latestFollowUp.promisedPayDate || stats.latestFollowUp.promiseDate}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  printDemandSlipsBatchPdf(
                                    [{ student, stats, routeCode, vehicleReg }],
                                    `Demand Slip — ${student.name} (${student.admissionNo})`
                                  )
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print Slip</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenFollowUpModal(student)}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                                <span>Follow-up ({stats.followUps.length})</span>
                              </button>
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

      {/* Phone Fee Follow-up & Past Communications Modal */}
      {followUpModalStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-amber-400" />
                  <span>Phone Fee Follow-up &amp; Past Communications</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {followUpModalStudent.name} ({followUpModalStudent.admissionNo}) • Class{' '}
                  {followUpModalStudent.class}-{followUpModalStudent.section} • Phone:{' '}
                  <strong className="text-amber-300 font-mono">
                    {getStudentPhone(followUpModalStudent)}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFollowUpModalStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto text-xs">
              {(() => {
                const modalStats = getStudentFeeStats(followUpModalStudent);
                const modalPhone = getStudentPhone(followUpModalStudent);
                return (
                  <>
                    {/* Member Dues & Phone Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Father / Guardian</div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {followUpModalStudent.fatherName || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Call Parent Phone</div>
                        {modalPhone !== '—' ? (
                          <a
                            href={`tel:${modalPhone}`}
                            className="font-mono font-bold text-indigo-600 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>{modalPhone}</span>
                          </a>
                        ) : (
                          <div className="text-slate-400 mt-0.5">Not Available</div>
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Previous Dues</div>
                        <div className="font-mono font-bold text-slate-800 mt-0.5">
                          ₹{modalStats.previousDuesAmount.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-rose-700 uppercase">Total Outstanding</div>
                        <div className="font-mono font-extrabold text-rose-600 text-sm mt-0.5">
                          ₹{modalStats.totalOutstanding.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Log New Phone Follow-up Form */}
                    {onAddFollowUp && (
                      <form
                        onSubmit={handleSaveFollowUpSubmit}
                        className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-3"
                      >
                        <div className="font-bold text-indigo-950 flex items-center justify-between">
                          <span>Log New Phone Call Follow-up</span>
                          <span className="text-[11px] font-mono text-indigo-700">
                            Recorded by: {currentRole}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Spoke With (Parent/Guardian)
                            </label>
                            <input
                              type="text"
                              required
                              value={fuContactedPerson}
                              onChange={(e) => setFuContactedPerson(e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Call Outcome *
                            </label>
                            <select
                              value={fuOutcome}
                              onChange={(e) => setFuOutcome(e.target.value as any)}
                              className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                            >
                              <option value="Promised to Pay">Promised to Pay</option>
                              <option value="Partial Payment Promised">Partial Payment Promised</option>
                              <option value="Requested Time Extension">Requested Time Extension</option>
                              <option value="Phone Switched Off / Not Reachable">
                                Phone Switched Off / Not Reachable
                              </option>
                              <option value="Disputed / Requested Concession">
                                Disputed / Requested Concession
                              </option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Promised Payment Date
                            </label>
                            <input
                              type="date"
                              value={fuPromisedDate}
                              onChange={(e) => setFuPromisedDate(e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Conversation Summary / Parent Remarks *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Enter parent's response regarding fee payment..."
                              value={fuRemarks}
                              onChange={(e) => setFuRemarks(e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Next Follow-up Date
                            </label>
                            <input
                              type="date"
                              value={fuNextFollowUpDate}
                              onChange={(e) => setFuNextFollowUpDate(e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={isSavingFollowUp}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                          >
                            {isSavingFollowUp ? 'Saving...' : 'Save Phone Follow-up'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Past Communications History */}
                    <div className="space-y-2.5">
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                        <span>
                          Past Communications &amp; Follow-up History ({modalStats.followUps.length})
                        </span>
                      </h4>

                      {modalStats.followUps.length === 0 ? (
                        <div className="p-6 text-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                          No past fee follow-up communications recorded for this member yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {modalStats.followUps.map((fu) => (
                            <div
                              key={fu.id}
                              className="p-3 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                                    {fu.callOutcome}
                                  </span>
                                  <span className="font-mono font-bold text-slate-700">{fu.callDate}</span>
                                  <span className="text-slate-500">
                                    • Spoke with: <strong>{fu.contactedPerson}</strong>
                                  </span>
                                  <span className="text-slate-400">({fu.recordedBy})</span>
                                </div>
                                <p className="text-slate-800 font-medium">{fu.remarks}</p>
                              </div>
                              <div className="text-right font-mono text-[11px] shrink-0">
                                {fu.promisedPayDate && (
                                  <div className="text-indigo-700 font-bold">
                                    Promised: {fu.promisedPayDate}
                                  </div>
                                )}
                                {fu.nextFollowUpDate && (
                                  <div className="text-slate-500">Next Call: {fu.nextFollowUpDate}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
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

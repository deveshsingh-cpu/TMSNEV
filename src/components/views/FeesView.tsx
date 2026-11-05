import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard, IndianRupee, Printer, CheckCircle,
  AlertTriangle, Phone, FileText,
  Calendar, Search, ShieldCheck, UserX, Plus, X, Upload, Eye, Trash2, Lock,
  BarChart3, PhoneCall, MessageSquare, Layers
} from 'lucide-react';
import {
  FeeInvoice, FeeReceipt, FollowUpRecord, WarningLetter,
  StudentMember, UserRole, MemberTypeMaster, CampusMaster, Route, Vehicle
} from '../../types/index.js';
import { PrintExportToolbar, FilterPopover, openHtmlPrintPreview } from '../../utils/exportPrint.js';
import { readFileCompressed } from '../../utils/fileCompressor.js';
import { api } from '../../services/api.js';
import {
  normalizeCampus,
  normalizeAdmissionNo,
  findStudentStrictly,
  formatCampusLabel,
  getStudentCampus,
  getInvoiceCampus,
  getReceiptCampus,
  getStudentLinkedCampus,
  matchesCampusFilter,
  calculateCampusFinancials,
  CampusFilter,
} from '../../utils/campus.js';

interface FeesViewProps {
  schoolName?: string;
  currentRole?: UserRole;
  userCampus?: string;
  campuses?: CampusMaster[];
  classes?: string[];
  sections?: string[];
  routes?: Route[];
  vehicles?: Vehicle[];
  memberTypes?: MemberTypeMaster[];
  invoices: FeeInvoice[];
  receipts: FeeReceipt[];
  followUps: FollowUpRecord[];
  warningLetters: WarningLetter[];
  students: StudentMember[];
  initialSubTab?: string;
  preselectedStudentIdForCollect?: string | null;
  onClearPreselectedStudent?: () => void;
  onRunBilling: (month: string) => Promise<{ createdCount: number; totalBilled: number }>;
  onRecordReceipt: (data: any) => Promise<any>;
  onDeleteReceipt?: (id: string) => Promise<any>;
  onAddFollowUp?: (data: Partial<FollowUpRecord>) => Promise<any>;
  onDeleteFollowUp?: (id: string) => Promise<any>;
  onIssueWarningLetter?: (data: Partial<WarningLetter>) => Promise<any>;
  onEvaluateSuspensions: (threshold: number) => Promise<{ suspendedCount: number; affectedStudents: string[] }>;
  onSuspendStudent?: (studentId: string, reason: string) => Promise<any>;
  onPrintReceipt: (receipt: FeeReceipt) => void;
  onPrintWarningLetter: (letter: WarningLetter) => void;
  onOpenStudentProfile?: (studentId: string, tab?: string) => void;
}

export const FeesView: React.FC<FeesViewProps> = ({
  schoolName = 'Narendra Edu Valley',
  currentRole = 'Admin',
  userCampus,
  campuses = [],
  classes = [],
  sections = [],
  routes = [],
  vehicles = [],
  memberTypes = [],
  invoices,
  receipts,
  followUps,
  warningLetters,
  students,
  initialSubTab,
  preselectedStudentIdForCollect,
  onClearPreselectedStudent,
  onRunBilling,
  onRecordReceipt,
  onDeleteReceipt,
  onAddFollowUp,
  onDeleteFollowUp,
  onIssueWarningLetter,
  onEvaluateSuspensions,
  onSuspendStudent,
  onPrintReceipt,
  onPrintWarningLetter,
  onOpenStudentProfile,
}) => {
  const isAdmin = currentRole === 'Admin';
  const isAssistant = currentRole === 'Transport Assistant';
  const lockedCampus: 'Sr' | 'Jr' | null = isAssistant
    ? normalizeCampus(userCampus) || 'Sr'
    : null;
  const [selectedCampus, setSelectedCampus] = useState<CampusFilter>(lockedCampus || 'all');
  const todayStr = new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState<
    'billing' | 'receipts' | 'recovery' | 'demand_slip' | 'monthly_matrix'
  >('receipts');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info' | 'warning'; text: string } | null>(null);
  const [receiptToDelete, setReceiptToDelete] = useState<FeeReceipt | null>(null);
  const [isDeletingReceipt, setIsDeletingReceipt] = useState<boolean>(false);
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState<boolean>(false);
  const submittingReceiptRef = useRef<boolean>(false);
  const deletingReceiptRef = useRef<boolean>(false);
  const [deletedReceiptIds, setDeletedReceiptIds] = useState<Set<string>>(new Set());
  const [actionAckModal, setActionAckModal] = useState<{
    type: 'saved' | 'deleted' | 'error';
    title: string;
    receiptNo?: string;
    memberName?: string;
    admissionNo?: string;
    amount?: number;
    paymentMode?: string;
    balanceAfter?: number;
    message: string;
    receiptObj?: FeeReceipt;
  } | null>(null);

  useEffect(() => {
    if (initialSubTab === 'invoices') setActiveTab('billing');
    else if (initialSubTab === 'recovery' || initialSubTab === 'defaulters') setActiveTab('recovery');
    else if (initialSubTab === 'demand_slip') setActiveTab('demand_slip');
    else if (initialSubTab === 'monthly_matrix') setActiveTab('monthly_matrix');
    else if (initialSubTab === 'collect') setActiveTab('receipts');
  }, [initialSubTab]);

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
  const [demandFollowUpStudent, setDemandFollowUpStudent] = useState<StudentMember | null>(null);

  // Month-wise Fee & Previous Dues Matrix State (Visible to Everyone)
  const [matrixCampusFilter, setMatrixCampusFilter] = useState<string>(lockedCampus || 'all');
  const [matrixRouteFilter, setMatrixRouteFilter] = useState<string>('all');
  const [matrixClassFilter, setMatrixClassFilter] = useState<string>('all');
  const [matrixSearch, setMatrixSearch] = useState<string>('');

  useEffect(() => {
    if (lockedCampus) {
      setSelectedCampus(lockedCampus);
      setDemandCampusFilter(lockedCampus);
      setMatrixCampusFilter(lockedCampus);
    }
  }, [lockedCampus]);

  const handleCampusSwitch = (campus: CampusFilter) => {
    if (lockedCampus) return;
    setSelectedCampus(campus);
    setDemandCampusFilter(campus);
    setMatrixCampusFilter(campus);
  };

  // Campus-scoped records: Transport Assistants strictly see only their assigned campus;
  // Admin and Transport Coordinator see records based on their selectedCampus ('all', 'Sr', or 'Jr').
  const scopedStudents = students.filter((s) => {
    if (!matchesCampusFilter(getStudentCampus(s, routes), selectedCampus)) return false;
    if (s.transportStatus === 'Left') {
      return (
        s.balanceDue > 0 ||
        invoices.some((i) => i.studentId === s.id && i.balanceDue > 0 && i.status !== 'Paid')
      );
    }
    return true;
  });
  const scopedInvoices = invoices.filter((inv) =>
    matchesCampusFilter(getInvoiceCampus(inv, students, routes), selectedCampus)
  );
  const visibleReceipts = receipts.filter(
    (rec) => !deletedReceiptIds.has(rec.id) && !deletedReceiptIds.has(rec.receiptNo)
  );
  const scopedReceipts = visibleReceipts.filter((rec) =>
    matchesCampusFilter(getReceiptCampus(rec, students, routes, invoices), selectedCampus)
  );
  const scopedFollowUps = followUps.filter((f) =>
    matchesCampusFilter(getStudentLinkedCampus(f, students, routes), selectedCampus)
  );
  const scopedWarningLetters = warningLetters.filter((wl) =>
    matchesCampusFilter(getStudentLinkedCampus(wl, students, routes), selectedCampus)
  );

  // Separate Campus Financial Calculations (Cash, Online/UPI/Bank, Total Collected, Outstanding)
  const activeCampusStats = calculateCampusFinancials(selectedCampus, {
    students,
    routes,
    vehicles,
    invoices,
    receipts: visibleReceipts,
  });
  const srCampusStats = calculateCampusFinancials('Sr', {
    students,
    routes,
    vehicles,
    invoices,
    receipts: visibleReceipts,
  });
  const jrCampusStats = calculateCampusFinancials('Jr', {
    students,
    routes,
    vehicles,
    invoices,
    receipts: visibleReceipts,
  });

  const [selectedMonth, setSelectedMonth] = useState('2026-11');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isRunningBilling, setIsRunningBilling] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [previewScreenshot, setPreviewScreenshot] = useState<{
    title: string;
    url: string;
    receipt?: FeeReceipt;
    isPlaceholder?: boolean;
    isPdf?: boolean;
  } | null>(null);
  const [localAttachmentOverrides, setLocalAttachmentOverrides] = useState<Record<string, string>>({});
  const [isUploadingReceiptAttachment, setIsUploadingReceiptAttachment] = useState(false);

  // Individual Suspension Selection Modal (No auto-suspension!)
  const [isIndividualSuspendModalOpen, setIsIndividualSuspendModalOpen] = useState(false);
  const [suspendReasonMap, setSuspendReasonMap] = useState<Record<string, string>>({});

  // Previous Dues (Old Software Opening Arrears Head) Modal State
  const [isPrevDuesModalOpen, setIsPrevDuesModalOpen] = useState(false);
  const [prevDuesFilterClass, setPrevDuesFilterClass] = useState('all');
  const [prevDuesFilterRoute, setPrevDuesFilterRoute] = useState('all');
  const [prevDuesSearch, setPrevDuesSearch] = useState('');
  const [prevDuesEdits, setPrevDuesEdits] = useState<Record<string, { amount: string; remarks: string }>>({});
  const [isSavingPrevDues, setIsSavingPrevDues] = useState(false);

  // --- Improvised Fee Collection Form State ---
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [memberFilterClass, setMemberFilterClass] = useState('all');
  const [memberFilterType, setMemberFilterType] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState(scopedStudents[0]?.id || '');
  const [collectModalError, setCollectModalError] = useState<string | null>(null);

  // Month-by-Month selection & per-month Admin discount
  const [selectedMonthIds, setSelectedMonthIds] = useState<string[]>([]);
  const [monthDiscounts, setMonthDiscounts] = useState<Record<string, number>>({});
  const [lateFineWaiver, setLateFineWaiver] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank' | 'UPI'>('UPI');
  const [referenceNo, setReferenceNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [upiScreenshot, setUpiScreenshot] = useState<string>('');
  const [upiScreenshotName, setUpiScreenshotName] = useState<string>('');

  // Open Collect Fee Modal if preselectedStudentIdForCollect is passed
  useEffect(() => {
    if (preselectedStudentIdForCollect) {
      const targetStu = scopedStudents.find((s) => s.id === preselectedStudentIdForCollect);
      if (targetStu) {
        setSelectedStudentId(preselectedStudentIdForCollect);
        setIsReceiptModalOpen(true);
      }
      if (onClearPreselectedStudent) onClearPreselectedStudent();
    }
  }, [preselectedStudentIdForCollect, scopedStudents.length]);

  // Narrowed down member list for Collect Fee modal (Strictly scoped to campus! Matches ID, Name, Phone, Father, Route, Stop)
  const narrowedMembers = scopedStudents.filter((s) => {
    if (memberFilterClass !== 'all' && s.class !== memberFilterClass) return false;
    if (memberFilterType !== 'all' && s.memberType !== memberFilterType) return false;
    if (memberSearchQuery.trim()) {
      const q = memberSearchQuery.trim().toLowerCase();
      const qNormAdm = normalizeAdmissionNo(q);
      const stuNormAdm = normalizeAdmissionNo(s.admissionNo);
      return (
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        (Boolean(qNormAdm) && stuNormAdm.includes(qNormAdm)) ||
        (s.mobile && s.mobile.toLowerCase().includes(q)) ||
        (s.emergencyContact && s.emergencyContact.toLowerCase().includes(q)) ||
        (s.fatherName && s.fatherName.toLowerCase().includes(q)) ||
        s.class.toLowerCase().includes(q) ||
        (s.memberType && s.memberType.toLowerCase().includes(q)) ||
        (s.routeCode && s.routeCode.toLowerCase().includes(q)) ||
        (s.pickupDropStopName && s.pickupDropStopName.toLowerCase().includes(q)) ||
        (s.villageName && s.villageName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Automatically keep selectedStudentId synchronized with active search results so a stale member can never remain loaded
  useEffect(() => {
    const q = memberSearchQuery.trim();
    if (!q || narrowedMembers.length === 0) return;
    const qNormAdm = normalizeAdmissionNo(q);
    // 1. If user typed an exact Admission No (with or without NEV prefix), auto-select that exact member
    if (qNormAdm.length >= 3) {
      const exactAdmMatch = narrowedMembers.find(
        (s) =>
          normalizeAdmissionNo(s.admissionNo) === qNormAdm ||
          s.admissionNo.trim().toLowerCase() === q.toLowerCase()
      );
      if (exactAdmMatch && exactAdmMatch.id !== selectedStudentId) {
        setSelectedStudentId(exactAdmMatch.id);
        return;
      }
    }
    // 2. If only 1 member matches the typed characters, or if current selectedStudentId is not in narrowedMembers, select narrowedMembers[0]
    if (
      narrowedMembers.length === 1 ||
      !narrowedMembers.some((s) => s.id === selectedStudentId)
    ) {
      if (narrowedMembers[0].id !== selectedStudentId) {
        setSelectedStudentId(narrowedMembers[0].id);
      }
    }
  }, [memberSearchQuery, narrowedMembers.length, selectedStudentId]);

  // Selected Member object: updates when a user clicks or searches a member in the dropdown list
  const selectedMember =
    scopedStudents.find((s) => s.id === selectedStudentId) ||
    narrowedMembers[0] ||
    scopedStudents[0];

  // Ensure selectedStudentId stays valid when campus scope changes
  useEffect(() => {
    if (scopedStudents.length > 0 && !scopedStudents.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(scopedStudents[0].id);
    }
  }, [scopedStudents.length, selectedCampus, selectedStudentId]);

  // Build pending monthly dues rows for the selected member
  const memberAllInvoices = invoices.filter((i) => i.studentId === selectedMember?.id);
  const memberUnpaidInvoices = memberAllInvoices.filter((i) => i.balanceDue > 0 && i.status !== 'Paid');

  // If member has balanceDue > 0 but no unpaid invoice objects in state, synthesize a pending month row so amount always comes from dues
  const effectiveDueRows: {
    id: string;
    month: string;
    description: string;
    duesAmount: number;
    isSynthetic?: boolean;
  }[] =
    memberUnpaidInvoices.length > 0
      ? memberUnpaidInvoices.map((inv) => ({
          id: inv.id,
          month: inv.month,
          description:
            inv.idempotencyKey?.startsWith('PREV-DUES-') || inv.month.toLowerCase().includes('previous dues')
              ? `${inv.month} — Opening Arrears from Old Software`
              : `${inv.month} — Transport Fee (${selectedMember?.pickupDropStopName || 'Assigned Stop'}, ${selectedMember?.villageName || ''})`,
          duesAmount: inv.balanceDue,
        }))
      : selectedMember && selectedMember.balanceDue > 0
      ? [
          {
            id: `syn-${selectedMember.id}-prev`,
            month: 'Previous Dues (Old Software)',
            description: `Previous Dues (Old Software) — Opening Transport Arrears (${selectedMember.pickupDropStopName || 'Stop'})`,
            duesAmount: selectedMember.balanceDue,
            isSynthetic: true,
          },
        ]
      : [];

  const handleSelectMemberForFee = (targetStudentId: string) => {
    const targetMember =
      narrowedMembers.find((s) => s.id === targetStudentId) ||
      scopedStudents.find((s) => s.id === targetStudentId);
    if (!targetMember) return;
    setSelectedStudentId(targetMember.id);
    setMemberSearchQuery('');
    setIsMemberDropdownOpen(false);
    setCollectModalError(null);
    const targetUnpaid = invoices.filter(
      (i) => i.studentId === targetMember.id && i.balanceDue > 0 && i.status !== 'Paid'
    );
    const dueRowIds =
      targetUnpaid.length > 0
        ? targetUnpaid.map((inv) => inv.id)
        : targetMember.balanceDue > 0
        ? [`syn-${targetMember.id}-prev`]
        : [];
    setSelectedMonthIds(dueRowIds);
    setMonthDiscounts({});
    setLateFineWaiver(0);
    setPaymentDate(todayStr);
  };

  const handleConfirmDeleteReceipt = async () => {
    if (!receiptToDelete || !onDeleteReceipt || deletingReceiptRef.current) return;
    const target = receiptToDelete;
    deletingReceiptRef.current = true;
    setIsDeletingReceipt(true);

    // Optimistically hide receipt and close the delete prompt immediately so user is never stuck
    setDeletedReceiptIds((prev) => {
      const next = new Set(prev);
      if (target.id) next.add(target.id);
      if (target.receiptNo) next.add(target.receiptNo);
      return next;
    });
    setReceiptToDelete(null);

    try {
      const res = await onDeleteReceipt(target.id);
      const updatedBal =
        res && res.updatedBalanceDue !== undefined
          ? Number(res.updatedBalanceDue)
          : undefined;
      const msg = `Receipt ${target.receiptNo} (₹${target.amount.toLocaleString('en-IN')}) for ${target.studentName} has been deleted and member pending balance has been updated.`;
      setStatusMessage({
        type: 'success',
        text: msg,
      });
      setActionAckModal({
        type: 'deleted',
        title: 'Fee Receipt Deleted Successfully',
        receiptNo: target.receiptNo,
        memberName: target.studentName,
        admissionNo: target.admissionNo,
        amount: target.amount,
        paymentMode: target.paymentMode,
        balanceAfter: updatedBal,
        message: msg,
      });
    } catch (err: any) {
      // Restore visibility only if deletion genuinely failed for a reason other than "already deleted"
      const errMsg = String(err?.message || 'Failed to delete fee receipt.');
      if (!errMsg.toLowerCase().includes('already deleted') && !errMsg.toLowerCase().includes('not found')) {
        setDeletedReceiptIds((prev) => {
          const next = new Set(prev);
          next.delete(target.id);
          next.delete(target.receiptNo);
          return next;
        });
        setStatusMessage({
          type: 'warning',
          text: errMsg,
        });
        setActionAckModal({
          type: 'error',
          title: 'Could Not Delete Receipt',
          receiptNo: target.receiptNo,
          memberName: target.studentName,
          message: errMsg,
        });
      } else {
        setActionAckModal({
          type: 'deleted',
          title: 'Fee Receipt Deleted',
          receiptNo: target.receiptNo,
          memberName: target.studentName,
          amount: target.amount,
          message: `Receipt ${target.receiptNo} was already removed and balances are synced.`,
        });
      }
    } finally {
      deletingReceiptRef.current = false;
      setIsDeletingReceipt(false);
    }
  };

  // Auto-select all pending months whenever selectedMember changes
  useEffect(() => {
    if (selectedMember) {
      setSelectedMonthIds(effectiveDueRows.map((r) => r.id));
      setMonthDiscounts({});
      setLateFineWaiver(0);
      setPaymentDate(todayStr);
    }
  }, [selectedMember?.id, invoices.length, receipts.length]);

  const toggleMonthSelection = (rowId: string) => {
    setSelectedMonthIds((prev) =>
      prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
    );
  };

  const toggleSelectAllMonths = () => {
    if (selectedMonthIds.length === effectiveDueRows.length) {
      setSelectedMonthIds([]);
    } else {
      setSelectedMonthIds(effectiveDueRows.map((r) => r.id));
    }
  };

  // Late Fee Mechanism: Any fee paid after due date (10th of current month) adds ₹100 extra as Late Fine.
  // Can only be waived off by Admin through discount.
  const effectivePayDateStr = isAdmin ? paymentDate : todayStr;
  const payDayOfMonth = Number((effectivePayDateStr || todayStr).split('-')[2] || 1);
  const isPaidAfter10th = payDayOfMonth > 10;

  // Totals for selected months
  const selectedRows = effectiveDueRows.filter((r) => selectedMonthIds.includes(r.id));
  const lateFineApplicable = isPaidAfter10th && selectedRows.length > 0 ? 100 : 0;
  const effectiveLateFineWaiver = isAdmin ? Math.min(lateFineApplicable, Math.max(0, Number(lateFineWaiver || 0))) : 0;
  const netLateFine = Math.max(0, lateFineApplicable - effectiveLateFineWaiver);

  const totalSelectedDues = selectedRows.reduce((sum, r) => sum + r.duesAmount, 0) + lateFineApplicable;
  const totalSelectedDiscount =
    selectedRows.reduce(
      (sum, r) => sum + Math.min(r.duesAmount, Number(monthDiscounts[r.id] || 0)),
      0
    ) + effectiveLateFineWaiver;
  const totalNetPayable = Math.max(0, totalSelectedDues - totalSelectedDiscount);

  // Member overall fee summary for confirmation card
  const memberTotalAccrued =
    memberAllInvoices.reduce((s, i) => s + i.baseFee, 0) ||
    (selectedMember ? selectedMember.monthlyFee * 3 : 0);
  const memberTotalConcession = memberAllInvoices.reduce((s, i) => s + i.concession, 0);
  const memberTotalPaid = receipts
    .filter((r) => r.studentId === selectedMember?.id)
    .reduce((s, r) => s + r.amount, 0);

  const handleUpiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpiScreenshotName(file.name);
    setCollectModalError(null);
    try {
      const compressedDataUrl = await readFileCompressed(file, 820, 0.68);
      if (compressedDataUrl) {
        setUpiScreenshot(compressedDataUrl);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setUpiScreenshot(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const getReceiptAttachmentInfo = (rec: FeeReceipt): {
    hasAttachment: boolean;
    displayUrl: string;
    isPlaceholder: boolean;
    isPdf: boolean;
  } => {
    const raw = (localAttachmentOverrides[rec.id] ?? rec.upiScreenshot ?? '').trim();
    if (!raw) {
      return { hasAttachment: false, displayUrl: '', isPlaceholder: false, isPdf: false };
    }
    if (raw.startsWith('data:application/pdf')) {
      return { hasAttachment: true, displayUrl: raw, isPlaceholder: false, isPdf: true };
    }
    if (
      raw.startsWith('data:image/') ||
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('/')
    ) {
      return { hasAttachment: true, displayUrl: raw, isPlaceholder: false, isPdf: false };
    }
    // Fallback digital payment voucher for legacy '[ATTACHMENT_STORED]' entries
    const safeSchool = (schoolName || 'Narendra Edu Valley').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const safeStudent = (rec.studentName || 'Member').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const safeBreakup = (rec.feeBreakupDescription || 'Transport Fee')
      .slice(0, 56)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;');
    const safeRef = (rec.referenceNo || 'Verified').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const safeBy = (rec.receivedBy || 'Transport Office').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="430" viewBox="0 0 680 430">
      <rect width="680" height="430" rx="16" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>
      <rect x="20" y="20" width="640" height="72" rx="12" fill="#0f172a"/>
      <text x="44" y="50" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#ffffff">${safeSchool}</text>
      <text x="44" y="74" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#fbbf24">RECORDED PAYMENT PROOF VOUCHER (${rec.paymentMode})</text>
      <rect x="500" y="36" width="140" height="38" rx="8" fill="#059669"/>
      <text x="570" y="60" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#ffffff">PAID Rs. ${rec.amount}</text>
      <g font-family="Arial, sans-serif" font-size="14" fill="#0f172a">
        <text x="44" y="132" font-weight="bold" fill="#64748b">Receipt No:</text>
        <text x="220" y="132" font-weight="bold">${rec.receiptNo}</text>
        <text x="44" y="166" font-weight="bold" fill="#64748b">Payment Date:</text>
        <text x="220" y="166">${rec.date}</text>
        <text x="44" y="200" font-weight="bold" fill="#64748b">Member Name:</text>
        <text x="220" y="200" font-weight="bold">${safeStudent} (${rec.admissionNo || ''})</text>
        <text x="44" y="234" font-weight="bold" fill="#64748b">Mode &amp; Reference:</text>
        <text x="220" y="234" font-weight="bold" fill="#047857">${rec.paymentMode} • Ref: ${safeRef}</text>
        <text x="44" y="268" font-weight="bold" fill="#64748b">Fee Particulars:</text>
        <text x="220" y="268">${safeBreakup}</text>
        <text x="44" y="302" font-weight="bold" fill="#64748b">Received By:</text>
        <text x="220" y="302">${safeBy}</text>
      </g>
      <rect x="36" y="330" width="608" height="72" rx="10" fill="#fffbeb" stroke="#fcd34d" stroke-width="1.5"/>
      <text x="54" y="356" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#92400e">Original high-size image was archived by Google Sheets cell-limit protection.</text>
      <text x="54" y="378" font-family="Arial, sans-serif" font-size="12" fill="#b45309">Use the "Upload / Replace Screenshot" button below to attach a fresh screenshot image.</text>
    </svg>`;
    return {
      hasAttachment: true,
      displayUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      isPlaceholder: true,
      isPdf: false,
    };
  };

  const handleOpenReceiptAttachment = (rec: FeeReceipt) => {
    const info = getReceiptAttachmentInfo(rec);
    setPreviewScreenshot({
      title: `Payment Attachment — ${rec.receiptNo} (${rec.studentName})`,
      url: info.displayUrl,
      receipt: rec,
      isPlaceholder: info.isPlaceholder,
      isPdf: info.isPdf,
    });
  };

  const handleReplaceSavedReceiptAttachment = async (
    rec: FeeReceipt,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingReceiptAttachment(true);
    try {
      const compressed = await readFileCompressed(file, 820, 0.68);
      if (!compressed) return;
      await api.updateReceiptAttachment(rec.id, compressed);
      setLocalAttachmentOverrides((prev) => ({ ...prev, [rec.id]: compressed }));
      setPreviewScreenshot({
        title: `Payment Attachment — ${rec.receiptNo} (${rec.studentName})`,
        url: compressed,
        receipt: { ...rec, upiScreenshot: compressed },
        isPlaceholder: false,
        isPdf: compressed.startsWith('data:application/pdf'),
      });
      setStatusMessage({
        type: 'success',
        text: `Attachment updated & saved for Receipt ${rec.receiptNo} (${rec.studentName}).`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'warning',
        text: err?.message || 'Failed to update receipt attachment.',
      });
    } finally {
      setIsUploadingReceiptAttachment(false);
    }
  };

  // --- Follow-Up & Warning Letter Modals State ---
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [folStudentId, setFolStudentId] = useState(
    scopedStudents.find((s) => s.balanceDue > 0)?.id || scopedStudents[0]?.id || ''
  );
  const [folDate, setFolDate] = useState(todayStr);
  const [folContactPerson, setFolContactPerson] = useState('');
  const [folPhone, setFolPhone] = useState('');
  const [folOutcome, setFolOutcome] = useState<FollowUpRecord['outcome']>('Promise to Pay');
  const [folPromiseDate, setFolPromiseDate] = useState('');
  const [folNotes, setFolNotes] = useState('');

  useEffect(() => {
    const st = scopedStudents.find((s) => s.id === folStudentId);
    if (st) {
      setFolContactPerson(`${st.fatherName} (Parent)`);
      setFolPhone(st.mobile);
    } else if (scopedStudents[0]) {
      setFolStudentId(scopedStudents.find((s) => s.balanceDue > 0)?.id || scopedStudents[0].id);
    }
  }, [folStudentId, scopedStudents.length, selectedCampus]);

  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [warnStudentId, setWarnStudentId] = useState(
    scopedStudents.find((s) => s.balanceDue > 0)?.id || scopedStudents[0]?.id || ''
  );
  const [warnLevel, setWarnLevel] = useState<WarningLetter['warningLevel']>(
    'Level 2: Urgent Notice'
  );
  const [warnDeadline, setWarnDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [warnSentVia, setWarnSentVia] = useState<WarningLetter['sentVia']>('Printed Slip');

  // Helper to print Formal Warning cum Reminder Letter (Single or Bulk) with Dues History & Acknowledgement Slip
  const printWarningCumReminderLetters = (targetMembers: { member: StudentMember; letterNo: string; issueDate: string; deadlineDate: string }[]) => {
    if (targetMembers.length === 0) return;
    const pagesHtml = targetMembers
      .map(({ member, letterNo, issueDate, deadlineDate }) => {
        const stuInvoices = invoices.filter(
          (i) => (i.studentId === member.id || i.admissionNo === member.admissionNo) && i.balanceDue > 0
        );
        const periodStr =
          stuInvoices.length > 0
            ? stuInvoices.map((i) => i.month).join(', ')
            : `Up to ${selectedMonth}`;
        const duesRowsHtml =
          stuInvoices.length > 0
            ? stuInvoices
                .map(
                  (inv) => `
                  <tr>
                    <td>${inv.month}</td>
                    <td>${inv.invoiceNo}</td>
                    <td style="text-align:right;">Rs. ${inv.baseFee}</td>
                    <td style="text-align:right;">Rs. ${inv.concession}</td>
                    <td style="text-align:right;">Rs. ${inv.paidAmount}</td>
                    <td style="text-align:right;font-weight:bold;">Rs. ${inv.balanceDue}</td>
                  </tr>
                `
                )
                .join('')
            : `
                <tr>
                  <td>${periodStr}</td>
                  <td>OPEN-BAL</td>
                  <td style="text-align:right;">Rs. ${member.monthlyFee}</td>
                  <td style="text-align:right;">Rs. ${member.concessionAmount || 0}</td>
                  <td style="text-align:right;">Rs. 0</td>
                  <td style="text-align:right;font-weight:bold;">Rs. ${member.balanceDue}</td>
                </tr>
              `;

        return `
          <div class="page">
            <div class="letter-box">
              <div class="header">
                <h1>${schoolName || 'Narendra Edu Valley'} — Transport Department</h1>
                <h2>WARNING CUM REMINDER LETTER</h2>
              </div>
              <div class="meta-row">
                <div><strong>Letter Ref No:</strong> ${letterNo}</div>
                <div><strong>Date:</strong> ${issueDate}</div>
              </div>
              <div class="recipient">
                <div><strong>To,</strong></div>
                <div><strong>Name of Guardian:</strong> ${member.fatherName || 'Parent / Guardian'} (Guardian of <strong>${member.name}</strong>, ID: ${member.admissionNo}, Class: ${member.class}-${member.section})</div>
                <div><strong>Address:</strong> ${member.address || member.villageName || 'Registered Address'} (${member.pickupDropStopName || 'Stop'})</div>
                <div><strong>Phone No:</strong> ${member.mobile || member.emergencyContact || '—'}</div>
              </div>
              <div class="subject">
                <strong>Subject:</strong> Fee Due for <u>${periodStr}</u> (Route: ${member.routeCode || 'Assigned Route'})
              </div>
              <div class="body-text">
                <p><strong>Dear Sir / Madam,</strong></p>
                <p>
                  This is an official reminder from the School Transport Department regarding the pending transport fee dues of your ward
                  <strong>${member.name}</strong> (Admission No: <strong>${member.admissionNo}</strong>, Class: <strong>${member.class}-${member.section}</strong>,
                  Stop: <strong>${member.pickupDropStopName}</strong>). The detailed statement of unpaid transport dues is attached below for your kind perusal:
                </p>
                <table class="dues-table">
                  <thead>
                    <tr>
                      <th>Billing Period</th>
                      <th>Invoice Ref</th>
                      <th style="text-align:right;">Base Fee</th>
                      <th style="text-align:right;">Concession</th>
                      <th style="text-align:right;">Paid</th>
                      <th style="text-align:right;">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${duesRowsHtml}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="5" style="text-align:right;font-weight:bold;">TOTAL OVERDUE AMOUNT PAYABLE:</td>
                      <td style="text-align:right;font-weight:bold;color:#b91c1c;">Rs. ${member.balanceDue.toLocaleString('en-IN')}</td>
                    </tr>
                  </tfoot>
                </table>
                <p>
                  <strong>Kindly pay before the 20th (${deadlineDate}) to avoid suspension of transport facility.</strong>
                  In case of any genuine economic difficulty, please visit the school office in person with a written application before the given date (${deadlineDate}).
                </p>
              </div>
              <div class="sign-row">
                <div>
                  <strong>Regards,</strong><br/>
                  <strong>Transport Coordinator</strong><br/>
                  ${schoolName || 'Narendra Edu Valley'}
                </div>
                <div style="text-align:right;">
                  <br/>
                  <em>(Office Seal &amp; Sign)</em>
                </div>
              </div>

              <div class="cut-line">✂ ------------------------------------------------ TEAR-OFF ACKNOWLEDGEMENT SLIP ------------------------------------------------</div>

              <div class="ack-box">
                <div class="ack-title">ACKNOWLEDGEMENT SLIP (To be signed by Guardian &amp; submitted to Transport Office)</div>
                <p style="margin:6px 0;font-size:12px;">
                  Received Warning cum Reminder Letter No. <strong>${letterNo}</strong> dated <strong>${issueDate}</strong> regarding pending transport fee dues of
                  <strong>Rs. ${member.balanceDue.toLocaleString('en-IN')}</strong> for Period <strong>${periodStr}</strong> in respect of
                  <strong>${member.name}</strong> (${member.admissionNo}, Class ${member.class}-${member.section}, Route ${member.routeCode}).
                </p>
                <div class="ack-grid">
                  <div><strong>Guardian Name:</strong> ${member.fatherName || '________________'}</div>
                  <div><strong>Phone No:</strong> ${member.mobile || '________________'}</div>
                  <div><strong>Date of Receipt:</strong> ____/____/2026</div>
                  <div><strong>Signature of Guardian:</strong> ________________________</div>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    const html = `
      <html>
        <head>
          <title>Warning cum Reminder Letter</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 16px; }
            .page { page-break-after: always; padding: 10px 0; }
            .page:last-child { page-break-after: auto; }
            .letter-box { border: 2px solid #0f172a; border-radius: 10px; padding: 22px; max-width: 760px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 12px; }
            .header h1 { margin: 0; font-size: 18px; text-transform: uppercase; }
            .header h2 { margin: 4px 0 0; font-size: 14px; color: #b91c1c; letter-spacing: 0.5px; }
            .meta-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 12px; }
            .recipient { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; font-size: 12.5px; line-height: 1.5; margin-bottom: 12px; }
            .subject { font-size: 13px; margin-bottom: 10px; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
            .body-text { font-size: 12.5px; line-height: 1.55; }
            .dues-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
            .dues-table th, .dues-table td { border: 1px solid #94a3b8; padding: 6px 8px; }
            .dues-table th { background: #f1f5f9; text-align: left; }
            .sign-row { display: flex; justify-content: space-between; margin-top: 22px; font-size: 12.5px; }
            .cut-line { margin: 16px 0 12px; text-align: center; font-size: 11px; color: #64748b; font-weight: bold; }
            .ack-box { border: 1.5px dashed #334155; border-radius: 8px; padding: 12px; background: #fffbeb; }
            .ack-title { font-weight: bold; font-size: 12px; text-align: center; text-transform: uppercase; margin-bottom: 6px; }
            .ack-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-top: 10px; }
          </style>
        </head>
        <body>${pagesHtml}</body>
      </html>
    `;

    openHtmlPrintPreview({
      title:
        targetMembers.length === 1
          ? `Warning cum Reminder Letter & Slip — ${targetMembers[0].member.name} (${targetMembers[0].letterNo})`
          : `Bulk Warning cum Reminder Letters (${targetMembers.length} Members)`,
      subtitle: 'Includes Guardian Details, Dues History Statement, 20th Deadline & Tear-off Acknowledgement Slip',
      html,
      filename:
        targetMembers.length === 1
          ? `warning_letter_${targetMembers[0].letterNo}`
          : `bulk_warning_letters_${selectedMonth}`,
    });
  };

  const handlePrintSingleReceipt = (rec: FeeReceipt, autoPrint = false) => {
    const memberObj = findStudentStrictly(students, rec);
    const stopAndVillage = memberObj
      ? `${memberObj.pickupDropStopName || memberObj.villageName || 'Assigned Stop'}${
          memberObj.villageName &&
          memberObj.pickupDropStopName &&
          memberObj.villageName.trim().toLowerCase() !==
            memberObj.pickupDropStopName.trim().toLowerCase()
            ? ` (${memberObj.villageName})`
            : ''
        }`
      : '';
    const routeAndStopDisplay = memberObj
      ? `${memberObj.routeCode || 'Assigned Route'} • ${stopAndVillage}`
      : 'Assigned Route';
    const html = `
      <html>
        <head>
          <title>Fee Receipt ${rec.receiptNo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #0f172a; background: #fff; }
            .box { border: 2px solid #0f172a; border-radius: 12px; padding: 24px; max-width: 680px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 16px; }
            .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
            .header p { margin: 4px 0 0; font-size: 12px; color: #475569; font-weight: bold; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; margin-bottom: 18px; }
            .amount-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 18px; }
            .footer { display: flex; justify-content: space-between; margin-top: 32px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="header">
              <h1>${schoolName || 'Narendra Edu Valley'}</h1>
              <p>OFFICIAL TRANSPORT FEE RECEIPT</p>
            </div>
            <div class="grid">
              <div><strong>Receipt No:</strong> ${rec.receiptNo}</div>
              <div><strong>Date:</strong> ${rec.date}</div>
              <div><strong>Member Name:</strong> ${memberObj?.name || rec.studentName}</div>
              <div><strong>ID / Adm No:</strong> ${memberObj?.admissionNo || rec.admissionNo}</div>
              <div><strong>Class / Sec:</strong> ${memberObj ? `${memberObj.class}-${memberObj.section}` : '—'}</div>
              <div><strong>Route &amp; Stop:</strong> ${routeAndStopDisplay}</div>
            </div>
            <div class="amount-box">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span>Fee Description / Months:</span>
                <strong>${rec.feeBreakupDescription || 'Transport Fee'}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span>Dues Before Payment:</span>
                <strong>Rs. ${(rec.balanceDueBefore ?? rec.amount).toLocaleString('en-IN')}</strong>
              </div>
              ${(rec.discountAmount ?? 0) > 0 ? `
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#b45309;">
                <span>Discount / Waiver Allowed:</span>
                <strong>- Rs. ${(rec.discountAmount ?? 0).toLocaleString('en-IN')}</strong>
              </div>` : ''}
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:16px;color:#047857;">
                <span><strong>Amount Paid (${rec.paymentMode}):</strong></span>
                <strong>Rs. ${rec.amount.toLocaleString('en-IN')}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span>Balance Due After Payment:</span>
                <strong>Rs. ${(rec.balanceDueAfter ?? 0).toLocaleString('en-IN')}</strong>
              </div>
              ${rec.referenceNo ? `<div style="margin-top:6px;font-size:12px;"><strong>Reference / UTR:</strong> ${rec.referenceNo}</div>` : ''}
            </div>
            <div style="font-size:12px;color:#475569;"><strong>Remarks:</strong> ${rec.remarks || 'Transport fee received'}</div>
            <div class="footer">
              <div>Received By: <strong>${rec.receivedBy}</strong></div>
              <div>Authorized Signatory</div>
            </div>
          </div>
        </body>
      </html>
    `;
    openHtmlPrintPreview({
      title: `Transport Fee Receipt — ${rec.receiptNo} (${rec.studentName})`,
      subtitle: `Paid Rs. ${rec.amount.toLocaleString('en-IN')} via ${rec.paymentMode} on ${rec.date}`,
      html,
      filename: `fee_receipt_${rec.receiptNo}`,
      autoPrint,
    });
  };

  const handleBulkWarningLettersBy15th = async () => {
    const overdueMembers = scopedStudents.filter(
      (s) => s.balanceDue > 0 && s.transportStatus !== 'Left'
    );
    if (overdueMembers.length === 0) {
      setStatusMessage({
        type: 'info',
        text: 'No members currently have pending fees for bulk Warning cum Reminder Letter generation.',
      });
      return;
    }
    const deadline20th = `${selectedMonth}-20`;
    const batchTargets: { member: StudentMember; letterNo: string; issueDate: string; deadlineDate: string }[] = [];

    for (let i = 0; i < overdueMembers.length; i++) {
      const st = overdueMembers[i];
      const letterNo = `WCR-${selectedMonth.replace('-', '')}-${String(i + 1).padStart(3, '0')}`;
      if (onIssueWarningLetter) {
        await onIssueWarningLetter({
          date: todayStr,
          issueDate: todayStr,
          studentId: st.id,
          studentName: st.name,
          admissionNo: st.admissionNo,
          campus: getStudentCampus(st, routes),
          parentName: st.fatherName,
          fatherName: st.fatherName,
          address: st.address,
          overdueAmount: st.balanceDue,
          periodOverdue: `Pending Dues up to ${selectedMonth}`,
          deadlineDate: deadline20th,
          proposedSuspensionDate: deadline20th,
          warningLevel: 'Level 2: Urgent Notice',
          sentVia: 'Printed Slip',
          issuedBy: currentRole,
        });
      }
      batchTargets.push({
        member: st,
        letterNo,
        issueDate: todayStr,
        deadlineDate: deadline20th,
      });
    }

    setStatusMessage({
      type: 'success',
      text: `Generated & opened print dialog for ${batchTargets.length} Bulk Warning cum Reminder Letters (for all members with pending dues by 15th).`,
    });
    printWarningCumReminderLetters(batchTargets);
  };

  // Eligible list for manual individual suspension: neither permission extension received nor overall dues clear
  const eligibleForManualSuspension = scopedStudents.filter(
    (s) =>
      s.transportStatus === 'Active' &&
      s.balanceDue > 0 &&
      (!s.activePermissionLetter || s.activePermissionLetter.allowedUntilDate < todayStr)
  );

  const handleRunBilling = async () => {
    try {
      setIsRunningBilling(true);
      const res = await onRunBilling(selectedMonth);
      setStatusMessage({
        type: res.createdCount > 0 ? 'success' : 'info',
        text:
          res.createdCount > 0
            ? `Monthly Auto-Fee Complete: Generated ${res.createdCount} transport fee invoices for ${selectedMonth} totaling ₹${res.totalBilled.toLocaleString('en-IN')} for Active & Suspended members (Left School members excluded).`
            : `All Active & Suspended members already have monthly fee dues calculated for ${selectedMonth}. Zero duplicates created.`,
      });
    } finally {
      setIsRunningBilling(false);
    }
  };

  const handleReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingReceiptRef.current || isSubmittingReceipt) {
      return;
    }
    setCollectModalError(null);
    if (!selectedMember) {
      setCollectModalError('Please select a transport member.');
      setStatusMessage({ type: 'warning', text: 'Please select a member.' });
      return;
    }
    if (selectedRows.length === 0) {
      setCollectModalError('Please select at least one pending month to collect fees.');
      setStatusMessage({ type: 'warning', text: 'Please select at least one pending month to collect fees.' });
      return;
    }
    if ((paymentMode === 'UPI' || paymentMode === 'Bank') && !upiScreenshot) {
      const msg = `Payment proof / screenshot attachment is compulsory when Payment Mode is ${
        paymentMode === 'UPI' ? 'UPI (QR / App)' : 'Bank Transfer / NEFT / Cheque'
      }. Please upload the attachment before saving.`;
      setCollectModalError(msg);
      setStatusMessage({ type: 'warning', text: msg });
      return;
    }

    submittingReceiptRef.current = true;
    setIsSubmittingReceipt(true);

    const lateFineDesc =
      lateFineApplicable > 0
        ? netLateFine > 0
          ? ` + Late Fine ₹${netLateFine} (Paid after 10th)`
          : ` (Late Fine ₹100 Waived by Admin)`
        : '';
    const descriptionStr = `Transport Fee (${selectedRows.map((r) => r.month).join(', ')})${lateFineDesc}`;

    const memberCampus = getStudentCampus(selectedMember, routes);
    const paidAmountSnapshot = totalNetPayable;
    const memberSnapshot = selectedMember;
    const modeSnapshot = paymentMode;
    const screenshotSnapshot = upiScreenshot;

    try {
      const createdReceipt = await onRecordReceipt({
        studentId: selectedMember.id,
        campus: memberCampus,
        amount: totalNetPayable,
        discountAmount: totalSelectedDiscount,
        lateFineAmount: netLateFine,
        invoiceDiscounts: isAdmin ? monthDiscounts : {},
        selectedInvoiceIds: selectedRows.filter((r) => !r.isSynthetic).map((r) => r.id),
        feeBreakupDescription: descriptionStr,
        date: isAdmin ? paymentDate : todayStr,
        paymentMode,
        referenceNo,
        upiScreenshot: upiScreenshot || undefined,
        receivedBy: `${currentRole} (${memberCampus} Campus)`,
        remarks: remarks || descriptionStr,
      });

      setIsReceiptModalOpen(false);
      setReferenceNo('');
      setRemarks('');
      setUpiScreenshot('');
      setUpiScreenshotName('');
      setCollectModalError(null);

      const savedReceiptNo = createdReceipt?.receiptNo || 'Generated';
      const updatedBal =
        createdReceipt?.balanceDueAfter !== undefined
          ? Number(createdReceipt.balanceDueAfter)
          : Math.max(0, (Number(memberSnapshot.balanceDue) || 0) - paidAmountSnapshot);
      const successText = `Fee Receipt ${savedReceiptNo} saved for ${memberSnapshot.name} (${memberCampus} Campus) — Paid ₹${paidAmountSnapshot.toLocaleString('en-IN')}. Remaining Balance: ₹${updatedBal.toLocaleString('en-IN')}.`;

      const receiptToPrint: FeeReceipt =
        createdReceipt && createdReceipt.receiptNo
          ? {
              ...createdReceipt,
              upiScreenshot: createdReceipt.upiScreenshot || screenshotSnapshot || undefined,
            }
          : {
              id: createdReceipt?.id || `rec-${Date.now()}`,
              receiptNo: savedReceiptNo,
              date: isAdmin ? paymentDate : todayStr,
              studentId: memberSnapshot.id,
              studentName: memberSnapshot.name,
              admissionNo: memberSnapshot.admissionNo,
              campus: memberCampus,
              amount: paidAmountSnapshot,
              discountAmount: totalSelectedDiscount,
              balanceDueBefore: Number(memberSnapshot.balanceDue) || paidAmountSnapshot,
              balanceDueAfter: updatedBal,
              feeBreakupDescription: descriptionStr,
              paymentMode: modeSnapshot,
              referenceNo,
              upiScreenshot: screenshotSnapshot || undefined,
              receivedBy: `${currentRole} (${memberCampus} Campus)`,
              remarks: remarks || descriptionStr,
            };

      if (receiptToPrint.id && screenshotSnapshot) {
        setLocalAttachmentOverrides((prev) => ({
          ...prev,
          [receiptToPrint.id]: screenshotSnapshot,
        }));
      }

      setStatusMessage({
        type: 'success',
        text: successText,
      });

      // Automatically open the print window for printing immediately after successful save
      handlePrintSingleReceipt(receiptToPrint, true);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to save fee receipt.';
      setCollectModalError(errMsg);
      setStatusMessage({
        type: 'warning',
        text: errMsg,
      });
      setActionAckModal({
        type: 'error',
        title: 'Duplicate / Invalid Fee Entry Prevented',
        memberName: memberSnapshot.name,
        admissionNo: memberSnapshot.admissionNo,
        amount: paidAmountSnapshot,
        message: errMsg,
      });
    } finally {
      submittingReceiptRef.current = false;
      setIsSubmittingReceipt(false);
    }
  };

  const handleSaveFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddFollowUp) return;
    const st = scopedStudents.find((s) => s.id === folStudentId);
    if (!st) return;
    await onAddFollowUp({
      date: folDate || todayStr,
      studentId: st.id,
      admissionNo: st.admissionNo,
      studentName: st.name,
      campus: getStudentCampus(st, routes),
      contactPerson: folContactPerson || st.fatherName,
      phone: folPhone || st.mobile,
      overdueAmount: st.balanceDue,
      promiseDate: folPromiseDate || undefined,
      outcome: folOutcome,
      notes: folNotes || 'Called parent regarding transport fee deposit.',
      officerName: `${currentRole} (${getStudentCampus(st, routes)} Campus)`,
    });
    setIsFollowUpModalOpen(false);
    setFolNotes('');
    setFolPromiseDate('');
  };

  const handleSaveWarningLetterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onIssueWarningLetter) return;
    const st = scopedStudents.find((s) => s.id === warnStudentId);
    if (!st) return;
    const created = await onIssueWarningLetter({
      date: todayStr,
      issueDate: todayStr,
      studentId: st.id,
      studentName: st.name,
      admissionNo: st.admissionNo,
      campus: getStudentCampus(st, routes),
      parentName: st.fatherName,
      fatherName: st.fatherName,
      address: st.address,
      overdueAmount: st.balanceDue,
      periodOverdue: `Pending Transport Dues (${selectedMonth})`,
      deadlineDate: warnDeadline,
      proposedSuspensionDate: warnDeadline,
      warningLevel: warnLevel,
      sentVia: warnSentVia,
      issuedBy: `${currentRole} (${getStudentCampus(st, routes)} Campus)`,
    });
    setIsWarningModalOpen(false);
    printWarningCumReminderLetters([
      {
        member: st,
        letterNo: created?.letterNo || `WCR-${Date.now().toString().slice(-4)}`,
        issueDate: todayStr,
        deadlineDate: warnDeadline,
      },
    ]);
  };

  const handleTriggerSuspension = async () => {
    if (currentRole === 'Transport Assistant') {
      setStatusMessage({
        type: 'warning',
        text: 'Transport Assistant is not authorized to suspend members. Only Transport Coordinator or Admin can initiate suspension.',
      });
      return;
    }
    setIsIndividualSuspendModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Sub-Module Navigation Bar */}
      <div className="bg-slate-900 text-white p-3 rounded-2xl border border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('receipts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'receipts'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <IndianRupee className="w-3.5 h-3.5" />
            <span>Collect Fees &amp; Receipts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('billing')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'billing'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Monthly Invoices</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('demand_slip')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'demand_slip'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Demand Slip &amp; Phone Follow-up</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('monthly_matrix')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'monthly_matrix'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Month-wise Fee &amp; Previous Dues</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recovery')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'recovery'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Overdue &amp; Recovery</span>
          </button>
        </div>

        {lockedCampus ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>Campus Locked: {formatCampusLabel(lockedCampus)} ({scopedStudents.length} Members)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <span className="text-[11px] font-bold text-slate-400 px-2">Campus View:</span>
            {(['all', 'Sr', 'Jr'] as CampusFilter[]).map((camp) => (
              <button
                key={camp}
                type="button"
                onClick={() => handleCampusSwitch(camp)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCampus === camp
                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                {camp === 'all' ? 'All Campuses' : camp === 'Sr' ? 'Senior (Sr)' : 'Junior (Jr)'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Campus Cash & Online Fee Collection Balance Summary Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 text-xs font-bold">
              {formatCampusLabel(selectedCampus)}
            </span>
            <span className="text-xs font-semibold text-slate-600">
              Fee Collection &amp; Mode-wise Balance ({scopedStudents.length} Campus Members)
            </span>
          </div>
          {!lockedCampus && (
            <span className="text-[11px] text-slate-500 font-medium">
              Switch between Senior (Sr), Junior (Jr), or All Campuses above
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <div className="text-[10px] font-bold uppercase text-emerald-800">
              Cash Fee Collected ({selectedCampus === 'all' ? 'All' : selectedCampus})
            </div>
            <div className="text-lg font-extrabold font-mono text-emerald-700 mt-0.5">
              ₹{activeCampusStats.feeCash.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200">
            <div className="text-[10px] font-bold uppercase text-blue-800">
              Online / UPI / Bank ({selectedCampus === 'all' ? 'All' : selectedCampus})
            </div>
            <div className="text-lg font-extrabold font-mono text-blue-700 mt-0.5">
              ₹{activeCampusStats.feeOnline.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
            <div className="text-[10px] font-bold uppercase text-indigo-800">
              Total Fee Received ({selectedCampus === 'all' ? 'All' : selectedCampus})
            </div>
            <div className="text-lg font-extrabold font-mono text-indigo-700 mt-0.5">
              ₹{activeCampusStats.feeTotal.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
            <div className="text-[10px] font-bold uppercase text-rose-800">
              Pending Fee Dues ({selectedCampus === 'all' ? 'All' : selectedCampus})
            </div>
            <div className="text-lg font-extrabold font-mono text-rose-600 mt-0.5">
              ₹{activeCampusStats.outstandingDues.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {!lockedCampus && selectedCampus === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div
              onClick={() => handleCampusSwitch('Sr')}
              className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/40 border border-slate-200 hover:border-indigo-300 flex flex-wrap items-center justify-between gap-2 cursor-pointer transition-colors"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Senior Campus (Sr) • {srCampusStats.studentCount} Members
                </div>
                <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                  Cash: <strong className="text-emerald-700">₹{srCampusStats.feeCash.toLocaleString('en-IN')}</strong> • Online:{' '}
                  <strong className="text-blue-700">₹{srCampusStats.feeOnline.toLocaleString('en-IN')}</strong> • Dues:{' '}
                  <strong className="text-rose-600">₹{srCampusStats.outstandingDues.toLocaleString('en-IN')}</strong>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold">
                Total: ₹{srCampusStats.feeTotal.toLocaleString('en-IN')}
              </span>
            </div>

            <div
              onClick={() => handleCampusSwitch('Jr')}
              className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/40 border border-slate-200 hover:border-indigo-300 flex flex-wrap items-center justify-between gap-2 cursor-pointer transition-colors"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Junior Campus (Jr) • {jrCampusStats.studentCount} Members
                </div>
                <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                  Cash: <strong className="text-emerald-700">₹{jrCampusStats.feeCash.toLocaleString('en-IN')}</strong> • Online:{' '}
                  <strong className="text-blue-700">₹{jrCampusStats.feeOnline.toLocaleString('en-IN')}</strong> • Dues:{' '}
                  <strong className="text-rose-600">₹{jrCampusStats.outstandingDues.toLocaleString('en-IN')}</strong>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold">
                Total: ₹{jrCampusStats.feeTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Unified Header & Toolbar (Scoped strictly to active Sidebar screen) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {activeTab === 'billing'
              ? 'Monthly Invoices'
              : activeTab === 'recovery'
              ? 'Overdue Follow-ups & Recovery'
              : activeTab === 'demand_slip'
              ? 'Demand Slip & Phone Fee Follow-up'
              : activeTab === 'monthly_matrix'
              ? 'Month-wise Outstanding, Collection & Previous Dues (Separate Breakdown)'
              : 'Collect Fees & Receipts'}
          </h2>
          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            {activeTab === 'billing'
              ? `${scopedInvoices.length} Invoices`
              : activeTab === 'recovery'
              ? `${scopedFollowUps.length} Follow-ups`
              : activeTab === 'demand_slip'
              ? 'Print Slips & Call History'
              : activeTab === 'monthly_matrix'
              ? formatCampusLabel(selectedCampus)
              : `${scopedReceipts.length} Receipts`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'billing' && (
            <>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <label className="text-xs text-slate-600 font-semibold">Month:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-xs bg-transparent font-bold text-slate-900 focus:outline-hidden"
                />
              </div>

              <PrintExportToolbar
                title={`Monthly Transport Fee Invoices (${selectedMonth} - ${formatCampusLabel(selectedCampus)})`}
                filename={`fee_invoices_${selectedMonth}`}
                schoolName={schoolName}
                filteredData={scopedInvoices}
                allData={scopedInvoices}
                hasActiveFilters={true}
                filterSummary={`Billing Month: ${selectedMonth} • Campus: ${formatCampusLabel(selectedCampus)}`}
                columns={[
                  { header: 'Invoice No', accessor: (i) => i.invoiceNo },
                  { header: 'Member Name', accessor: (i) => i.studentName },
                  { header: 'Admission No', accessor: (i) => i.admissionNo },
                  { header: 'Month', accessor: (i) => i.month },
                  { header: 'Base Fee (INR)', accessor: (i) => i.baseFee },
                  { header: 'Discount/Concession (INR)', accessor: (i) => i.concession },
                  { header: 'Net Amount (INR)', accessor: (i) => i.netAmount },
                  { header: 'Paid Amount (INR)', accessor: (i) => i.paidAmount },
                  { header: 'Balance Due (INR)', accessor: (i) => i.balanceDue },
                  { header: 'Status', accessor: (i) => i.status },
                ]}
              />

              <button
                onClick={() => {
                  setPrevDuesEdits({});
                  setIsPrevDuesModalOpen(true);
                }}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>+ Previous Dues (Old Software)</span>
              </button>

              <button
                onClick={handleRunBilling}
                disabled={isRunningBilling}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                <span>{isRunningBilling ? 'Running Auto-Due...' : `Run Auto-Due (${selectedMonth})`}</span>
              </button>
            </>
          )}

          {activeTab === 'receipts' && (
            <>
              <button
                onClick={() => {
                  setPrevDuesEdits({});
                  setIsPrevDuesModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Previous Dues (Old Software)</span>
              </button>
              <PrintExportToolbar
                title={`Transport Fee Receipts & Collections Register (${formatCampusLabel(selectedCampus)})`}
                filename="fee_receipts"
                schoolName={schoolName}
                filteredData={scopedReceipts}
                allData={scopedReceipts}
                columns={[
                  { header: 'Receipt No', accessor: (r) => r.receiptNo },
                  { header: 'Payment Date', accessor: (r) => r.date },
                  { header: 'Member Name', accessor: (r) => r.studentName },
                  { header: 'Admission No', accessor: (r) => r.admissionNo },
                  { header: 'Fee Description', accessor: (r) => r.feeBreakupDescription || r.remarks || 'Transport Fee' },
                  { header: 'Dues Before (INR)', accessor: (r) => r.balanceDueBefore ?? r.amount },
                  { header: 'Discount (INR)', accessor: (r) => r.discountAmount ?? 0 },
                  { header: 'Paid Amount (INR)', accessor: (r) => r.amount },
                  { header: 'Balance After (INR)', accessor: (r) => r.balanceDueAfter ?? 0 },
                  { header: 'Payment Mode', accessor: (r) => r.paymentMode },
                  { header: 'Transaction Ref', accessor: (r) => r.referenceNo || '—' },
                  { header: 'Received By', accessor: (r) => r.receivedBy },
                ]}
              />

              <button
                onClick={() => {
                  setPaymentDate(todayStr);
                  setIsReceiptModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <IndianRupee className="w-4 h-4" />
                <span>+ Collect Fee &amp; Issue Receipt</span>
              </button>
            </>
          )}

          {activeTab === 'recovery' && (
            <>
              <PrintExportToolbar
                title={`Fee Follow-Up & Promise Date Register (${formatCampusLabel(selectedCampus)})`}
                filename="fee_followups"
                schoolName={schoolName}
                filteredData={scopedFollowUps}
                allData={scopedFollowUps}
                columns={[
                  { header: 'Call Date', accessor: (f) => f.date },
                  { header: 'Member Name', accessor: (f) => f.studentName },
                  { header: 'Admission No', accessor: (f) => f.admissionNo },
                  { header: 'Person Talked To', accessor: (f) => f.contactPerson },
                  { header: 'Phone', accessor: (f) => f.phone },
                  { header: 'Overdue Dues (INR)', accessor: (f) => f.overdueAmount },
                  { header: 'Response / Notes', accessor: (f) => f.notes },
                  { header: 'Next Follow-up / Promise Date', accessor: (f) => f.promiseDate || '—' },
                  { header: 'Recorded By', accessor: (f) => f.officerName },
                ]}
              />

              <button
                onClick={() => setIsFollowUpModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>+ Log Call Follow-up</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: RECEIPTS & COLLECTIONS (With Attachment Preview & Breakup)   */}
      {/* =================================================================== */}
      {activeTab === 'receipts' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 text-sm">
                Fee Receipts &amp; Collections Ledger ({formatCampusLabel(selectedCampus)})
              </h3>
              <span className="text-xs font-bold text-slate-600">{scopedReceipts.length} Receipts</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Receipt No</th>
                    <th className="py-3 px-3">Payment Date</th>
                    <th className="py-3 px-3">Member</th>
                    <th className="py-3 px-3">Fees Type / Months</th>
                    <th className="py-3 px-3">Dues</th>
                    <th className="py-3 px-3">Discount</th>
                    <th className="py-3 px-3">Paid</th>
                    <th className="py-3 px-3">Balance</th>
                    <th className="py-3 px-3">Mode &amp; Ref</th>
                    <th className="py-3 px-3">Attachment</th>
                    <th className="py-3 px-3">Remark</th>
                    <th className="py-3 px-4 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scopedReceipts.map((rec) => {
                    const linkedMember = findStudentStrictly(students, rec);
                    return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">{rec.receiptNo}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{rec.date}</td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenStudentProfile &&
                            onOpenStudentProfile(linkedMember?.id || rec.studentId, 'fees')
                          }
                          className="font-bold text-slate-900 hover:text-indigo-600 hover:underline text-left cursor-pointer"
                        >
                          {linkedMember?.name || rec.studentName}
                        </button>
                        <div className="font-mono text-[10px] text-slate-500">
                          {linkedMember?.admissionNo || rec.admissionNo}
                          {linkedMember
                            ? ` • ${linkedMember.class}-${linkedMember.section} • ${linkedMember.routeCode} (${linkedMember.pickupDropStopName || linkedMember.villageName})`
                            : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700 max-w-48">
                        {rec.feeBreakupDescription || 'Transport Fee'}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700">
                        ₹{(rec.balanceDueBefore ?? rec.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 font-medium text-amber-700">
                        ₹{(rec.discountAmount ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-700 text-sm">
                        ₹{rec.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 font-bold text-rose-600">
                        ₹{(rec.balanceDueAfter ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-800">{rec.paymentMode}</span>
                        {rec.referenceNo && (
                          <span className="text-[10px] text-slate-500 block font-mono">
                            Ref: {rec.referenceNo}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {(() => {
                          const attInfo = getReceiptAttachmentInfo(rec);
                          if (attInfo.hasAttachment) {
                            return (
                              <button
                                type="button"
                                onClick={() => handleOpenReceiptAttachment(rec)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-[11px] font-bold cursor-pointer shadow-2xs"
                                title="View Payment Screenshot / Proof"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View</span>
                              </button>
                            );
                          }
                          if (rec.paymentMode === 'UPI' || rec.paymentMode === 'Bank') {
                            return (
                              <label
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold cursor-pointer"
                                title="Attach Payment Screenshot / Proof"
                              >
                                <Upload className="w-3 h-3" />
                                <span>Attach</span>
                                <input
                                  type="file"
                                  accept="image/*,.pdf"
                                  onChange={(e) => handleReplaceSavedReceiptAttachment(rec, e)}
                                  className="hidden"
                                />
                              </label>
                            );
                          }
                          return <span className="text-slate-400 text-[11px]">—</span>;
                        })()}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-40 truncate" title={rec.remarks}>
                        {rec.remarks || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePrintSingleReceipt(rec)}
                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-400" />
                            <span>Print</span>
                          </button>
                          {isAdmin && onDeleteReceipt && (
                            <button
                              type="button"
                              onClick={() => setReceiptToDelete(rec)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
                              title="Admin Only: Delete Wrong / Duplicate Fee Receipt"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
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

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : statusMessage.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-slate-700 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: MONTHLY INVOICES & MANUAL AUTO-DUE GENERATION                */}
      {/* =================================================================== */}
      {activeTab === 'billing' && (
        <div className="space-y-5">

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Issued Transport Invoices ({scopedInvoices.length}) — {formatCampusLabel(selectedCampus)}
              </h3>
              <span className="text-xs text-slate-500">Click Collect Fee to clear any invoice</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Invoice No</th>
                    <th className="py-3 px-3">Member Name</th>
                    <th className="py-3 px-3">Admission No</th>
                    <th className="py-3 px-3">Billing Month</th>
                    <th className="py-3 px-3">Base Tariff</th>
                    <th className="py-3 px-3">Discount</th>
                    <th className="py-3 px-3">Net Payable</th>
                    <th className="py-3 px-3">Paid</th>
                    <th className="py-3 px-3">Balance Due</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scopedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{inv.invoiceNo}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{inv.studentName}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{inv.admissionNo}</td>
                      <td className="py-3 px-3 text-slate-700 font-medium">{inv.month}</td>
                      <td className="py-3 px-3 text-slate-700">₹{inv.baseFee}</td>
                      <td className="py-3 px-3 text-amber-700 font-medium">₹{inv.concession}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">₹{inv.netAmount}</td>
                      <td className="py-3 px-3 text-emerald-700 font-semibold">₹{inv.paidAmount}</td>
                      <td className="py-3 px-3 font-bold text-rose-600">₹{inv.balanceDue}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {inv.balanceDue > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudentId(inv.studentId);
                              setIsReceiptModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                          >
                            Collect Fee
                          </button>
                        ) : (
                          <span className="text-emerald-600 font-bold text-[11px]">Cleared</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: OVERDUE FOLLOW-UP & RECOVERY CYCLE (Interactive Cards!)       */}
      {/* =================================================================== */}
      {activeTab === 'recovery' && (
        <div className="space-y-6">
          {/* Interactive Recovery Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setIsFollowUpModalOpen(true)}
              className="bg-white hover:bg-amber-50/50 rounded-2xl border-2 border-amber-200 hover:border-amber-400 p-4 shadow-2xs space-y-2 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 uppercase">Stage 1: 10th of Month</span>
                <Phone className="w-4 h-4 text-amber-500" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Overdue Call Follow-up</h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                Record date, person talked to, response received, and next follow-up / promised payment date.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFollowUpModalOpen(true);
                }}
                className="mt-2 w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Fee Follow-up Call</span>
              </button>
            </div>

            <div
              onClick={() => setIsWarningModalOpen(true)}
              className="bg-white hover:bg-rose-50/50 rounded-2xl border-2 border-rose-200 hover:border-rose-400 p-4 shadow-2xs space-y-2 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-700 uppercase">Stage 2: 15th of Month</span>
                <FileText className="w-4 h-4 text-rose-500" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Warning cum Reminder Letters</h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                Auto-fetches Guardian Name, Address, Phone, Dues History table, 20th deadline, and Tear-off Acknowledgement Slip.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsWarningModalOpen(true);
                  }}
                  className="py-2 px-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Single Letter</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBulkWarningLettersBy15th();
                  }}
                  className="py-2 px-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Bulk Print (15th)</span>
                </button>
              </div>
            </div>

            <div
              onClick={handleTriggerSuspension}
              className="bg-white hover:bg-rose-50/50 rounded-2xl border-2 border-rose-200 hover:border-rose-400 p-4 shadow-2xs space-y-2 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-800 uppercase">Stage 3: 20th of Month</span>
                <UserX className="w-4 h-4 text-rose-600" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Individual Suspension Selection</h4>
              <p className="text-slate-600 text-xs leading-relaxed">
                Suspension is never auto-triggered. Choose individually from {eligibleForManualSuspension.length} member(s) with unpaid dues &amp; no permission letter.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTriggerSuspension();
                }}
                className="mt-2 w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Select Members for Suspension ({eligibleForManualSuspension.length})</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Follow-up Calls Log */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Fee Follow-Up Call Register</h3>
                  <p className="text-[11px] text-slate-500">
                    Missed promise dates trigger automatic recall alerts on Dashboard
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(true)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Follow-up</span>
                </button>
              </div>

              <div className="space-y-3">
                {scopedFollowUps.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No follow-up calls logged yet for this campus.</p>
                ) : (
                  scopedFollowUps.map((f) => {
                    const stu = scopedStudents.find((s) => s.id === f.studentId);
                    const isMissedPromise =
                      f.promiseDate && f.promiseDate <= todayStr && (stu ? stu.balanceDue > 0 : (f.overdueAmount || 0) > 0);
                    return (
                      <div
                        key={f.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                          isMissedPromise
                            ? 'bg-rose-50/70 border-rose-300'
                            : 'bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <button
                              type="button"
                              onClick={() => onOpenStudentProfile && onOpenStudentProfile(f.studentId || f.memberId || '', 'fees')}
                              className="font-bold text-slate-900 hover:text-indigo-600 hover:underline cursor-pointer"
                            >
                              {f.studentName || f.memberName}
                            </button>{' '}
                            <span className="text-slate-400 font-mono">({f.admissionNo})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-bold text-[10px]">
                              {f.outcome}
                            </span>
                            {isAdmin && onDeleteFollowUp && (
                              <button
                                type="button"
                                onClick={() => onDeleteFollowUp(f.id)}
                                className="p-1 text-rose-600 hover:bg-rose-100 rounded cursor-pointer"
                                title="Delete Follow-up (Admin Only)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-slate-700 font-medium">“{f.notes}”</p>
                        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 gap-2">
                          <span>
                            Talked to: <strong className="text-slate-800">{f.contactPerson}</strong> ({f.phone})
                          </span>
                          <span>
                            Call Date: <strong>{f.date}</strong> • By: {f.officerName}
                          </span>
                          {f.promiseDate && (
                            <span
                              className={`font-bold px-2 py-0.5 rounded ${
                                isMissedPromise
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-indigo-50 text-indigo-700'
                              }`}
                            >
                              Promise Date: {f.promiseDate} {isMissedPromise ? ' (OVERDUE — RECALL!)' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Formal Warning cum Reminder Letters */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Issued Warning cum Reminder Letters</h3>
                  <p className="text-[11px] text-slate-500">
                    Includes Guardian details, Dues History table, 20th deadline &amp; Acknowledgement Slip
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBulkWarningLettersBy15th}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Bulk Print Pending (15th)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsWarningModalOpen(true)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>Issue Single Letter</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {scopedWarningLetters.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No Warning cum Reminder letters issued yet for this campus.</p>
                ) : (
                  scopedWarningLetters.map((wl) => {
                    const memberObj = findStudentStrictly(scopedStudents, wl);
                    return (
                      <div
                        key={wl.id}
                        className="p-3.5 bg-rose-50/40 rounded-xl border border-rose-200 text-xs flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-rose-950">{wl.letterNo}</span>
                            <span className="text-slate-400">•</span>
                            <span className="font-bold text-slate-900">{wl.studentName}</span>
                          </div>
                          <div className="text-slate-600">
                            Guardian: <strong>{wl.fatherName || wl.parentName || memberObj?.fatherName || '—'}</strong> • Overdue:{' '}
                            <strong className="text-rose-700">₹{wl.overdueAmount}</strong> ({wl.periodOverdue || 'Dues'})
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Pay Before: <strong>{wl.proposedSuspensionDate || wl.deadlineDate || '20th of Month'}</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const matchedOrFallback: StudentMember =
                              findStudentStrictly(students, wl) || {
                                id: wl.studentId || 'stu-fallback',
                                admissionNo: wl.admissionNo || 'ADM-000',
                                name: wl.studentName || 'Member',
                                memberType: 'Student',
                                class: '—',
                                section: '—',
                                gender: 'M',
                                campus: 'Main',
                                academicSession: '2026-27',
                                fatherName: wl.fatherName || wl.parentName || 'Parent / Guardian',
                                mobile: '—',
                                address: wl.address || 'Registered Guardian Address',
                                routeId: '',
                                routeCode: 'Assigned Route',
                                villageId: '',
                                villageName: '',
                                pickupDropStopId: '',
                                pickupDropStopName: 'Assigned Stop',
                                serviceType: 'both',
                                transportStatus: 'Active',
                                emergencyContact: '—',
                                monthlyFee: wl.overdueAmount || 0,
                                concessionAmount: 0,
                                balanceDue: wl.overdueAmount || 0,
                                joiningDate: todayStr,
                                version: 1,
                              };

                            printWarningCumReminderLetters([
                              {
                                member: matchedOrFallback,
                                letterNo: wl.letterNo,
                                issueDate: wl.issueDate || wl.date || todayStr,
                                deadlineDate:
                                  wl.proposedSuspensionDate || wl.deadlineDate || `${selectedMonth}-20`,
                              },
                            ]);
                          }}
                          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-400" />
                          <span>Print Letter &amp; Slip</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: DEMAND SLIP & PHONE FOLLOW-UP (With Past Communications)     */}
      {/* =================================================================== */}
      {activeTab === 'demand_slip' && (() => {
        const findStudentRoute = (s: StudentMember) =>
          routes.find(
            (r) =>
              (Boolean(r.id) && r.id === s.routeId) ||
              (Boolean(r.code) && Boolean(s.routeCode) && r.code.trim() === s.routeCode.trim())
          );

        const resolveVehicleNum = (s: StudentMember, rt?: Route) => {
          const direct =
            rt?.vehicleNumber ||
            rt?.vehicleLast4 ||
            (rt as any)?.assignedVehicleReg ||
            s.vehicleNumber ||
            s.vehicleLast4 ||
            '';
          if (direct) return direct;
          if (rt?.vehicleId) {
            const vObj = vehicles.find((v) => v.id === rt.vehicleId);
            if (vObj) return vObj.registrationNumber || vObj.last4Digits || vObj.busCode || '';
          }
          const codeParts = (rt?.code || s.routeCode || '').split('/');
          return codeParts.length >= 2 && codeParts[1] ? codeParts[1] : '—';
        };

        const resolveStop = (s: StudentMember) =>
          s.pickupDropStopName || s.pickupStopName || s.villageName || s.stopName || '—';

        const resolvePhone = (s: StudentMember) =>
          s.mobile || s.phone || s.parentPhone || s.emergencyContact || '—';

        const filteredDemandStudents = students
          .filter((s) => s.transportStatus !== 'Left' && s.transportStatus !== 'Left School')
          .filter((s) => {
            const rt = findStudentRoute(s);
            const stuCampus = s.campus || rt?.campus || 'Sr';
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
            if (demandVehicleFilter !== 'all') {
              const veh = resolveVehicleNum(s, rt);
              if (veh !== demandVehicleFilter) return false;
            }
            if (demandSearch.trim()) {
              const q = demandSearch.toLowerCase();
              const match =
                s.name.toLowerCase().includes(q) ||
                s.admissionNo.toLowerCase().includes(q) ||
                (s.fatherName || '').toLowerCase().includes(q) ||
                resolvePhone(s).toLowerCase().includes(q) ||
                resolveStop(s).toLowerCase().includes(q);
              if (!match) return false;
            }
            return true;
          })
          .map((s) => {
            const rt = findStudentRoute(s);
            const stuInvoices = invoices.filter((i) => i.studentId === s.id);
            const stuReceipts = receipts.filter((r) => r.studentId === s.id);
            const prevDuesInv = stuInvoices.filter(
              (i) => i.month === 'Previous Dues' || i.id.startsWith('inv-prev-')
            );
            const sessionInv = stuInvoices.filter(
              (i) => i.month !== 'Previous Dues' && !i.id.startsWith('inv-prev-')
            );
            const prevDuesBilled =
              prevDuesInv.length > 0
                ? prevDuesInv.reduce((sum, i) => sum + Number(i.netPayable ?? i.netAmount ?? 0), 0)
                : Number(s.previousDues || 0);
            const sessionBilled = sessionInv.reduce(
              (sum, i) => sum + Number(i.netPayable ?? i.netAmount ?? 0),
              0
            );
            const formatInvoiceMonthLabel = (m: string): string => {
              const map: Record<string, string> = {
                '2026-11': 'November 2026',
                '2026-12': 'December 2026',
                '2027-01': 'January 2027',
                '2027-02': 'February 2027',
                '2027-03': 'March 2027',
                '2026-10': 'October 2026',
                '2026-09': 'September 2026',
                '2026-08': 'August 2026',
                '2026-07': 'July 2026',
                '2026-06': 'June 2026',
                '2026-05': 'May 2026',
                '2026-04': 'April 2026',
              };
              return map[m] || m;
            };

            const chargedMonthLabels = Array.from(
              new Set(
                sessionInv
                  .filter((i) => Number(i.netPayable ?? i.netAmount ?? 0) > 0)
                  .map((i) => formatInvoiceMonthLabel(i.month))
              )
            );
            const monthNameDisplay =
              chargedMonthLabels.length > 0 ? chargedMonthLabels.join(', ') : 'November 2026';
            const monthFeeHeader = `${monthNameDisplay} Fee (₹)`;

            const totalBilled = prevDuesBilled + sessionBilled;
            const totalCollected = stuReceipts.reduce(
              (sum, r) => sum + Number(r.amountPaid ?? r.amount ?? 0),
              0
            );
            const totalOutstanding = Math.max(0, totalBilled - totalCollected);
            const stuFollowUps = followUps
              .filter((f) => f.studentId === s.id || f.admissionNo === s.admissionNo)
              .sort((a, b) => (b.callDate || b.date || '').localeCompare(a.callDate || a.date || ''));

            return {
              student: s,
              campus: s.campus || rt?.campus || 'Sr',
              routeCode: rt?.code || s.routeCode || '—',
              vehicleReg: resolveVehicleNum(s, rt),
              stopDisplay: resolveStop(s),
              phoneDisplay: resolvePhone(s),
              prevDuesBilled,
              sessionBilled,
              monthNameDisplay,
              monthFeeHeader,
              totalCollected,
              totalOutstanding,
              stuFollowUps,
              latestFollowUp: stuFollowUps[0] || null,
            };
          })
          .filter((r) => (demandDuesMode === 'overdue_only' ? r.totalOutstanding > 0 : true))
          .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

        const printSlipsPdf = (rowsToPrint: typeof filteredDemandStudents, title: string) => {
          if (rowsToPrint.length === 0) return;
          const html = rowsToPrint
            .map(
              (r, idx) => `
              <div style="background: #ffffff; color: #0f172a; border: 2px solid #0f172a; border-radius: 10px; padding: 14px; margin-bottom: 14px; page-break-inside: avoid; font-family: Inter, Arial, sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 10px;">
                  <div>
                    <div style="font-size: 15px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${schoolName}</div>
                    <div style="font-size: 11px; font-weight: 700; color: #b45309;">TRANSPORT FEE DEMAND / REMINDER SLIP</div>
                  </div>
                  <div style="text-align: right; font-size: 11px; color: #334155;">
                    <div><strong>Slip #:</strong> DEM-${todayStr.replace(/-/g, '')}-${idx + 1}</div>
                    <div><strong>Date:</strong> ${todayStr}</div>
                  </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 14px; font-size: 11.5px; margin-bottom: 10px; color: #0f172a;">
                  <div><strong>Member Name:</strong> ${r.student.name}</div>
                  <div><strong>Admission No:</strong> <span style="font-family: monospace;">${r.student.admissionNo}</span></div>
                  <div><strong>Class &amp; Sec:</strong> ${r.student.class}-${r.student.section}</div>
                  <div><strong>Father's Name:</strong> ${r.student.fatherName || r.student.parentName || '—'}</div>
                  <div><strong>Route / Vehicle:</strong> ${r.routeCode} (${r.vehicleReg})</div>
                  <div><strong>Stop / Village:</strong> ${r.stopDisplay}</div>
                  <div><strong>Phone:</strong> ${r.phoneDisplay}</div>
                  <div><strong>Campus:</strong> ${r.campus}</div>
                  <div><strong>Pay By Date:</strong> <strong style="color: #be123c;">${demandDueDate}</strong></div>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; background: #ffffff; color: #0f172a;">
                  <thead>
                    <tr style="background: #f1f5f9; color: #0f172a;">
                      <th style="border: 1px solid #94a3b8; padding: 6px 8px; text-align: right; color: #0f172a;">Previous Dues (₹)</th>
                      <th style="border: 1px solid #94a3b8; padding: 6px 8px; text-align: right; color: #0f172a;">${r.monthFeeHeader}</th>
                      <th style="border: 1px solid #94a3b8; padding: 6px 8px; text-align: right; color: #0f172a;">Net Outstanding Due (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="background: #ffffff; color: #0f172a;">
                      <td style="border: 1px solid #94a3b8; padding: 6px 8px; text-align: right; color: #0f172a;">₹${r.prevDuesBilled.toLocaleString('en-IN')}</td>
                      <td style="border: 1px solid #94a3b8; padding: 6px 8px; text-align: right; color: #0f172a;">₹${r.sessionBilled.toLocaleString('en-IN')}</td>
                      <td style="border: 1px solid #94a3b8; padding: 6px 8px; text-align: right; font-weight: 800; color: #be123c;">₹${r.totalOutstanding.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
                <div style="font-size: 10.5px; color: #334155;">
                  Dear Parent, kindly deposit the pending transport dues of <strong>₹${r.totalOutstanding.toLocaleString('en-IN')}</strong> by <strong>${demandDueDate}</strong>.
                </div>
              </div>
            `
            )
            .join('');
          openHtmlPrintPreview({
            title,
            subtitle: `${rowsToPrint.length} Demand Slip(s) • Pay By: ${demandDueDate}`,
            html,
          });
        };

        const printFilteredListPdf = () => {
          if (filteredDemandStudents.length === 0) return;
          const totalPrev = filteredDemandStudents.reduce((s, r) => s + r.prevDuesBilled, 0);
          const totalMonthFee = filteredDemandStudents.reduce((s, r) => s + r.sessionBilled, 0);
          const totalOut = filteredDemandStudents.reduce((s, r) => s + r.totalOutstanding, 0);
          const activeMonthColTitle =
            filteredDemandStudents[0]?.monthFeeHeader || 'November 2026 Fee (₹)';

          const rowsHtml = filteredDemandStudents
            .map(
              (r, idx) => `
              <tr style="background: #ffffff; color: #0f172a;">
                <td style="border: 1px solid #94a3b8; padding: 6px; text-align: center; color: #0f172a;">${idx + 1}</td>
                <td style="border: 1px solid #94a3b8; padding: 6px; font-family: monospace; font-weight: 700; color: #0f172a;">${r.student.admissionNo}</td>
                <td style="border: 1px solid #94a3b8; padding: 6px; font-weight: 700; color: #0f172a;">${r.student.name}</td>
                <td style="border: 1px solid #94a3b8; padding: 6px; color: #0f172a;">${r.student.class}-${r.student.section}</td>
                <td style="border: 1px solid #94a3b8; padding: 6px; color: #0f172a;">${r.routeCode} (${r.vehicleReg})</td>
                <td style="border: 1px solid #94a3b8; padding: 6px; color: #0f172a;">${r.stopDisplay}</td>
                <td style="border: 1px solid #94a3b8; padding: 6px; color: #0f172a;">${r.student.fatherName || r.student.parentName || '—'}<br/><span style="font-family: monospace; font-size: 10px;">${r.phoneDisplay}</span></td>
                <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right; color: #0f172a;">₹${r.prevDuesBilled.toLocaleString('en-IN')}</td>
                <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right; color: #0f172a;">₹${r.sessionBilled.toLocaleString('en-IN')}</td>
                <td style="border: 1px solid #94a3b8; padding: 6px; text-align: right; font-weight: 800; color: #be123c;">₹${r.totalOutstanding.toLocaleString('en-IN')}</td>
              </tr>`
            )
            .join('');

          const listHtml = `
            <div style="background: #ffffff; color: #0f172a; padding: 10px; font-family: Inter, Arial, sans-serif;">
              <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px;">
                <h1 style="margin: 0; font-size: 18px; text-transform: uppercase; color: #0f172a;">${schoolName}</h1>
                <p style="margin: 4px 0 0; font-size: 12px; font-weight: 700; color: #334155;">TRANSPORT FEE REMINDER / OUTSTANDING REGISTER</p>
                <p style="margin: 4px 0 0; font-size: 11px; color: #475569;">
                  Route: <strong>${demandRouteFilter === 'all' ? 'All Routes' : demandRouteFilter}</strong> &nbsp;|&nbsp;
                  Vehicle: <strong>${demandVehicleFilter === 'all' ? 'All Vehicles' : demandVehicleFilter}</strong> &nbsp;|&nbsp;
                  Date: <strong>${todayStr}</strong>
                </p>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 11px; background: #ffffff; color: #0f172a;">
                <thead>
                  <tr style="background: #f1f5f9; color: #0f172a;">
                    <th style="border: 1px solid #94a3b8; padding: 6px; text-align: center;">Sl</th>
                    <th style="border: 1px solid #94a3b8; padding: 6px;">Adm No</th>
                    <th style="border: 1px solid #94a3b8; padding: 6px;">Member Name</th>
                    <th style="border: 1px solid #94a3b8; padding: 6px;">Class</th>
                    <th style="border: 1px solid #94a3b8; padding: 6px;">Route / Vehicle</th>
                    <th style="border: 1px solid #94a3b8; padding: 6px;">Village / Stop</th>
                    <th style="border: 1px solid #94a3b8; padding: 6px;">Father &amp; Phone</th>
                    <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right;">Previous Dues (₹)</th>
                    <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right;">${activeMonthColTitle}</th>
                    <th style="border: 1px solid #94a3b8; padding: 6px; text-align: right;">Net Outstanding (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                  <tr style="background: #f8fafc; font-weight: 800; color: #0f172a;">
                    <td colspan="7" style="border: 1px solid #94a3b8; padding: 7px; text-align: right;">TOTAL (${filteredDemandStudents.length} Members)</td>
                    <td style="border: 1px solid #94a3b8; padding: 7px; text-align: right;">₹${totalPrev.toLocaleString('en-IN')}</td>
                    <td style="border: 1px solid #94a3b8; padding: 7px; text-align: right;">₹${totalMonthFee.toLocaleString('en-IN')}</td>
                    <td style="border: 1px solid #94a3b8; padding: 7px; text-align: right; color: #be123c;">₹${totalOut.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          `;
          openHtmlPrintPreview({
            title: `Fee Reminder Register (${filteredDemandStudents.length} Members)`,
            subtitle: `Route: ${demandRouteFilter === 'all' ? 'All Routes' : demandRouteFilter} • Date: ${todayStr}`,
            html: listHtml,
          });
        };

        return (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Demand Slips &amp; Phone Follow-up
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl text-xs">
                    <span className="font-bold text-amber-900">Pay By:</span>
                    <input
                      type="date"
                      value={demandDueDate}
                      onChange={(e) => setDemandDueDate(e.target.value)}
                      className="font-mono font-bold text-slate-900 bg-transparent focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={printFilteredListPdf}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Print Filtered List PDF ({filteredDemandStudents.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      printSlipsPdf(
                        filteredDemandStudents,
                        `Demand Slips (${filteredDemandStudents.length} Members)`
                      )
                    }
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print All Filtered Slips ({filteredDemandStudents.length})</span>
                  </button>
                </div>
              </div>

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
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vehicle</label>
                  <select
                    value={demandVehicleFilter}
                    onChange={(e) => {
                      setDemandVehicleFilter(e.target.value);
                      setDemandRouteFilter('all');
                    }}
                    className="w-full p-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
                  >
                    <option value="all">All Vehicles</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.registrationNumber}>
                        {v.registrationNumber}
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
                      .filter((r) => !lockedCampus || (r.campus || 'Sr') === lockedCampus)
                      .filter(
                        (r) =>
                          demandVehicleFilter === 'all' ||
                          r.vehicleNumber === demandVehicleFilter ||
                          r.vehicleLast4 === demandVehicleFilter
                      )
                      .map((r) => (
                        <option key={r.id} value={r.code}>
                          {r.code} ({r.campus || 'Sr'})
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
                    <option value="overdue_only">Overdue Only (&gt; ₹0)</option>
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

            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="max-h-[540px] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4">Member &amp; Stop</th>
                      <th className="py-3 px-2.5">Campus / Class</th>
                      <th className="py-3 px-3">Route &amp; Vehicle</th>
                      <th className="py-3 px-3">Father &amp; Phone</th>
                      <th className="py-3 px-2.5 text-right font-mono">Prev. Dues</th>
                      <th className="py-3 px-2.5 text-right font-mono">Month Fee</th>
                      <th className="py-3 px-3 text-right font-mono">Net Outstanding</th>
                      <th className="py-3 px-3">Past Communications</th>
                      <th className="py-3 px-4 text-right">Demand Slip / Follow-up</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDemandStudents.map((r) => (
                      <tr key={r.student.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{r.student.name}</div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {r.student.admissionNo} • {r.stopDisplay}
                          </div>
                        </td>
                        <td className="py-3 px-2.5">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold text-[10px] mr-1">
                            {r.campus}
                          </span>
                          <span className="font-semibold text-slate-700">
                            {r.student.class}-{r.student.section}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-slate-800">{r.routeCode}</div>
                          <div className="text-[10px] font-mono text-slate-500">{r.vehicleReg}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-800">
                            {r.student.fatherName || r.student.parentName || '—'}
                          </div>
                          <a
                            href={`tel:${r.phoneDisplay}`}
                            className="text-[11px] font-mono font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span>{r.phoneDisplay}</span>
                          </a>
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono">
                          ₹{r.prevDuesBilled.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-2.5 text-right font-mono">
                          <div className="font-bold text-slate-800">
                            ₹{r.sessionBilled.toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-slate-500">{r.monthNameDisplay}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-rose-600 text-sm">
                          ₹{r.totalOutstanding.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          {r.latestFollowUp ? (
                            <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200 text-[11px]">
                              <div className="font-bold text-amber-950 flex justify-between">
                                <span>{r.latestFollowUp.callOutcome || r.latestFollowUp.outcome}</span>
                                <span className="font-mono text-[10px] text-slate-500">
                                  {r.latestFollowUp.callDate || r.latestFollowUp.date}
                                </span>
                              </div>
                              <div className="text-slate-700 truncate mt-0.5">
                                {r.latestFollowUp.remarks || r.latestFollowUp.notes}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No calls logged</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                printSlipsPdf([r], `Demand Slip — ${r.student.name}`)
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print Slip</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDemandFollowUpStudent(r.student);
                                setFolStudentId(r.student.id);
                                setFolContactPerson(r.student.fatherName || r.student.parentName || 'Parent');
                                setFolPhone(r.phoneDisplay !== '—' ? r.phoneDisplay : '');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              <span>Follow-up ({r.stuFollowUps.length})</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =================================================================== */}
      {/* TAB 5: MONTH-WISE OUTSTANDING, COLLECTION & PREVIOUS DUES           */}
      {/* (Visible to Everyone: Admin, Coordinator & Transport Assistant)     */}
      {/* =================================================================== */}
      {activeTab === 'monthly_matrix' && (() => {
        const SESSION_MONTHS = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03'];
        const MONTH_LABELS: Record<string, string> = {
          '2026-11': 'Nov 2026',
          '2026-12': 'Dec 2026',
          '2027-01': 'Jan 2027',
          '2027-02': 'Feb 2027',
          '2027-03': 'Mar 2027',
        };

        const effectiveMatrixCampus: CampusFilter = lockedCampus
          ? lockedCampus
          : (matrixCampusFilter as CampusFilter);
        const matrixStudents = students.filter((s) =>
          matchesCampusFilter(getStudentCampus(s, routes), effectiveMatrixCampus)
        );
        const matrixInvoices = invoices.filter((inv) =>
          matchesCampusFilter(getInvoiceCampus(inv, students, routes), effectiveMatrixCampus)
        );

        // 1. Separate Previous Dues Summary (Scoped to Campus)
        const prevDuesInvoices = matrixInvoices.filter(
          (i) => i.month === 'Previous Dues' || i.id.startsWith('inv-prev-')
        );
        const totalPrevDuesBilled = matrixStudents
          .filter((s) => s.transportStatus !== 'Left' && s.transportStatus !== 'Left School')
          .reduce((sum, s) => {
            const inv = prevDuesInvoices.find((i) => i.studentId === s.id);
            return sum + (inv ? Number(inv.netPayable ?? inv.netAmount ?? 0) : Number(s.previousDues || 0));
          }, 0);
        const totalPrevDuesPaid = prevDuesInvoices.reduce(
          (sum, i) => sum + Number(i.paidAmount ?? 0),
          0
        );
        const totalPrevDuesPending = Math.max(0, totalPrevDuesBilled - totalPrevDuesPaid);

        // 2. Separate Month-by-Month Session Breakdown (Scoped to Campus)
        const monthBreakdown = SESSION_MONTHS.map((mKey) => {
          const mInvoices = matrixInvoices.filter((i) => i.month === mKey);
          const billed = mInvoices.reduce((s, i) => s + Number(i.netPayable ?? i.netAmount ?? 0), 0);
          const collected = mInvoices.reduce((s, i) => s + Number(i.paidAmount ?? 0), 0);
          const outstanding = mInvoices.reduce((s, i) => s + Number(i.balanceDue ?? 0), 0);
          return {
            monthKey: mKey,
            monthLabel: MONTH_LABELS[mKey] || mKey,
            invoicesCount: mInvoices.length,
            billed,
            collected,
            outstanding,
          };
        });

        // 3. Member-wise Matrix (Previous Dues vs Month-wise Session Fees; includes Left members only if they have unpaid pre-Left dues)
        const matrixRows = matrixStudents
          .filter(
            (s) =>
              (s.transportStatus !== 'Left' && s.transportStatus !== 'Left School') ||
              s.balanceDue > 0
          )
          .filter((s) => {
            const rt = routes.find(
              (r) =>
                (Boolean(r.id) && r.id === s.routeId) ||
                (Boolean(r.code) && Boolean(s.routeCode) && r.code.trim() === s.routeCode.trim())
            );
            if (matrixClassFilter !== 'all' && s.class !== matrixClassFilter) return false;
            if (
              matrixRouteFilter !== 'all' &&
              s.routeId !== matrixRouteFilter &&
              s.routeCode !== matrixRouteFilter &&
              rt?.code !== matrixRouteFilter
            ) {
              return false;
            }
            if (matrixSearch.trim()) {
              const q = matrixSearch.toLowerCase();
              return (
                s.name.toLowerCase().includes(q) ||
                s.admissionNo.toLowerCase().includes(q) ||
                (s.pickupDropStopName || s.villageName || s.stopName || '').toLowerCase().includes(q)
              );
            }
            return true;
          })
          .map((s) => {
            const rt = routes.find(
              (r) =>
                (Boolean(r.id) && r.id === s.routeId) ||
                (Boolean(r.code) && Boolean(s.routeCode) && r.code.trim() === s.routeCode.trim())
            );
            const stuInvoices = invoices.filter((i) => i.studentId === s.id);
            const stuReceipts = receipts.filter((r) => r.studentId === s.id);
            const prevInv = stuInvoices.find(
              (i) => i.month === 'Previous Dues' || i.id.startsWith('inv-prev-')
            );
            const prevDuesBilled = prevInv
              ? Number(prevInv.netPayable ?? prevInv.netAmount ?? 0)
              : Number(s.previousDues || 0);
            const prevDuesPaid = prevInv ? Number(prevInv.paidAmount ?? 0) : 0;
            const prevDuesPending = Math.max(0, prevDuesBilled - prevDuesPaid);

            const monthMap: Record<
              string,
              { billed: number; paid: number; due: number; status: string }
            > = {};
            SESSION_MONTHS.forEach((mKey) => {
              const inv = stuInvoices.find((i) => i.month === mKey);
              monthMap[mKey] = {
                billed: inv ? Number(inv.netPayable ?? inv.netAmount ?? 0) : 0,
                paid: inv ? Number(inv.paidAmount ?? 0) : 0,
                due: inv ? Number(inv.balanceDue ?? 0) : 0,
                status: inv ? inv.status : 'Not Billed',
              };
            });

            const sessionBilled = SESSION_MONTHS.reduce((sum, k) => sum + monthMap[k].billed, 0);
            const totalCollected = stuReceipts.reduce(
              (sum, r) => sum + Number(r.amountPaid ?? r.amount ?? 0),
              0
            );
            const netOutstanding = Math.max(0, prevDuesBilled + sessionBilled - totalCollected);

            return {
              student: s,
              campus: s.campus || rt?.campus || 'Sr',
              routeCode: rt?.code || s.routeCode || '—',
              prevDuesBilled,
              prevDuesPaid,
              prevDuesPending,
              monthMap,
              sessionBilled,
              totalCollected,
              netOutstanding,
            };
          });

        const handlePrintMonthlyMatrix = () => {
          const rowsHtml = matrixRows
            .map(
              (row, idx) => `
              <tr style="background: #ffffff; color: #0f172a;">
                <td style="border: 1px solid #94a3b8; padding: 5px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #94a3b8; padding: 5px;">
                  <strong>${row.student.name}</strong><br/>
                  <span style="font-family: monospace; font-size: 10px;">${row.student.admissionNo} (${row.student.class}-${row.student.section})</span>
                </td>
                <td style="border: 1px solid #94a3b8; padding: 5px;">${row.campus} / ${row.routeCode}</td>
                <td style="border: 1px solid #94a3b8; padding: 5px; text-align: right;">
                  ${row.prevDuesBilled > 0 ? `₹${row.prevDuesBilled.toLocaleString('en-IN')} (Due: ₹${row.prevDuesPending.toLocaleString('en-IN')})` : '₹0'}
                </td>
                ${SESSION_MONTHS.map((mKey) => {
                  const cell = row.monthMap[mKey];
                  return `<td style="border: 1px solid #94a3b8; padding: 5px; text-align: right;">${
                    cell.billed > 0
                      ? `₹${cell.billed.toLocaleString('en-IN')}<br/><span style="font-size: 9px; color: ${
                          cell.due > 0 ? '#be123c' : '#047857'
                        };">${cell.due > 0 ? `Due: ₹${cell.due}` : 'Paid'}</span>`
                      : '—'
                  }</td>`;
                }).join('')}
                <td style="border: 1px solid #94a3b8; padding: 5px; text-align: right; font-weight: 700; color: #047857;">₹${row.totalCollected.toLocaleString('en-IN')}</td>
                <td style="border: 1px solid #94a3b8; padding: 5px; text-align: right; font-weight: 800; color: #be123c;">₹${row.netOutstanding.toLocaleString('en-IN')}</td>
              </tr>`
            )
            .join('');

          const html = `
            <div style="background: #ffffff; color: #0f172a; padding: 10px; font-family: Inter, Arial, sans-serif;">
              <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px;">
                <h1 style="margin: 0; font-size: 18px; text-transform: uppercase; color: #0f172a;">${schoolName}</h1>
                <p style="margin: 4px 0 0; font-size: 12px; font-weight: 700; color: #334155;">MONTH-WISE TRANSPORT FEE &amp; PREVIOUS DUES STATEMENT</p>
                <p style="margin: 4px 0 0; font-size: 11px; color: #475569;">
                  Campus: <strong>${matrixCampusFilter === 'all' ? 'All Campuses' : matrixCampusFilter}</strong> &nbsp;|&nbsp;
                  Route: <strong>${matrixRouteFilter === 'all' ? 'All Routes' : matrixRouteFilter}</strong> &nbsp;|&nbsp;
                  Class: <strong>${matrixClassFilter === 'all' ? 'All Classes' : matrixClassFilter}</strong> &nbsp;|&nbsp;
                  Date: <strong>${todayStr}</strong>
                </p>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; font-size: 11px;">
                <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px;">
                  <strong>Head 1 • Previous Dues Summary:</strong><br/>
                  Opening Prev. Dues: <strong>₹${totalPrevDuesBilled.toLocaleString('en-IN')}</strong> &nbsp;|&nbsp;
                  Collected: <strong style="color: #047857;">₹${totalPrevDuesPaid.toLocaleString('en-IN')}</strong> &nbsp;|&nbsp;
                  Outstanding: <strong style="color: #be123c;">₹${totalPrevDuesPending.toLocaleString('en-IN')}</strong>
                </div>
                <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px;">
                  <strong>Head 2 • Session 2026-27 Monthly Fees Summary:</strong><br/>
                  Billed: <strong>₹${monthBreakdown.reduce((s, m) => s + m.billed, 0).toLocaleString('en-IN')}</strong> &nbsp;|&nbsp;
                  Collected: <strong style="color: #047857;">₹${monthBreakdown.reduce((s, m) => s + m.collected, 0).toLocaleString('en-IN')}</strong> &nbsp;|&nbsp;
                  Outstanding: <strong style="color: #be123c;">₹${monthBreakdown.reduce((s, m) => s + m.outstanding, 0).toLocaleString('en-IN')}</strong>
                </div>
              </div>

              <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; background: #ffffff; color: #0f172a;">
                <thead>
                  <tr style="background: #f1f5f9; color: #0f172a;">
                    <th style="border: 1px solid #94a3b8; padding: 5px; text-align: center;">Sl</th>
                    <th style="border: 1px solid #94a3b8; padding: 5px;">Member &amp; Adm No</th>
                    <th style="border: 1px solid #94a3b8; padding: 5px;">Campus / Route</th>
                    <th style="border: 1px solid #94a3b8; padding: 5px; text-align: right;">Prev. Dues</th>
                    ${SESSION_MONTHS.map(
                      (mKey) =>
                        `<th style="border: 1px solid #94a3b8; padding: 5px; text-align: right;">${MONTH_LABELS[mKey]}</th>`
                    ).join('')}
                    <th style="border: 1px solid #94a3b8; padding: 5px; text-align: right;">Total Collected</th>
                    <th style="border: 1px solid #94a3b8; padding: 5px; text-align: right;">Net Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          `;

          openHtmlPrintPreview({
            title: `Month-wise Fee & Previous Dues Report (${matrixRows.length} Members)`,
            subtitle: `Route: ${matrixRouteFilter === 'all' ? 'All Routes' : matrixRouteFilter} • Date: ${todayStr}`,
            html,
          });
        };

        return (
          <div className="space-y-6">
            {/* Part 1: Separate Previous Dues vs Session Months Summary Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Previous Dues Separate Card */}
              <div className="bg-amber-50/70 rounded-2xl border-2 border-amber-200 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] uppercase">
                      Head 1 • Previous Dues
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      Previous Dues Statement
                    </h3>
                  </div>
                  <Layers className="w-6 h-6 text-amber-600" />
                </div>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="bg-white p-3 rounded-xl border border-amber-200">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Opening Prev. Dues</div>
                    <div className="text-base font-extrabold font-mono text-slate-900 mt-0.5">
                      ₹{totalPrevDuesBilled.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-200">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">Prev. Dues Collected</div>
                    <div className="text-base font-extrabold font-mono text-emerald-700 mt-0.5">
                      ₹{totalPrevDuesPaid.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-rose-200">
                    <div className="text-[10px] font-bold text-rose-700 uppercase">Prev. Dues Outstanding</div>
                    <div className="text-base font-extrabold font-mono text-rose-600 mt-0.5">
                      ₹{totalPrevDuesPending.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Months Overall Summary Card */}
              <div className="bg-indigo-50/60 rounded-2xl border-2 border-indigo-200 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-[10px] uppercase">
                      Head 2 • Session 2026-27 Monthly Fees
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      Month-wise Session Transport Fee Summary
                    </h3>
                  </div>
                  <BarChart3 className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="bg-white p-3 rounded-xl border border-indigo-200">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Session Fee Billed</div>
                    <div className="text-base font-extrabold font-mono text-slate-900 mt-0.5">
                      ₹{monthBreakdown.reduce((s, m) => s + m.billed, 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-200">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">Session Fee Collected</div>
                    <div className="text-base font-extrabold font-mono text-emerald-700 mt-0.5">
                      ₹{monthBreakdown.reduce((s, m) => s + m.collected, 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-rose-200">
                    <div className="text-[10px] font-bold text-rose-700 uppercase">Session Fee Outstanding</div>
                    <div className="text-base font-extrabold font-mono text-rose-600 mt-0.5">
                      ₹{monthBreakdown.reduce((s, m) => s + m.outstanding, 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Part 2: Month-by-Month Breakdown Cards */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Month-by-Month Breakdown (Session 2026-27)
                </h4>
                <button
                  type="button"
                  onClick={handlePrintMonthlyMatrix}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Month-wise Fee &amp; Previous Dues Report</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {monthBreakdown.map((mb) => (
                  <div
                    key={mb.monthKey}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">{mb.monthLabel}</span>
                      <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                        {mb.invoicesCount} Inv
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between text-slate-600">
                        <span>Billed:</span>
                        <span className="font-bold text-slate-900">
                          ₹{mb.billed.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>Collected:</span>
                        <span className="font-bold">₹{mb.collected.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-rose-600 border-t border-slate-200 pt-1">
                        <span>Outstanding:</span>
                        <span className="font-extrabold">
                          ₹{mb.outstanding.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Part 3: Member-wise Previous Dues + Month-by-Month Matrix Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Member-wise Previous Dues &amp; Month-wise Ledger
                  </h4>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={lockedCampus || matrixCampusFilter}
                    disabled={Boolean(lockedCampus)}
                    onChange={(e) => {
                      const val = e.target.value as CampusFilter;
                      setMatrixCampusFilter(val);
                      if (!lockedCampus) setSelectedCampus(val);
                    }}
                    className={`p-2 rounded-xl border border-slate-200 text-xs font-bold ${
                      lockedCampus ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : 'bg-slate-50'
                    }`}
                  >
                    {!lockedCampus && <option value="all">All Campuses</option>}
                    <option value="Sr">Sr Campus</option>
                    <option value="Jr">Jr Campus</option>
                  </select>

                  <select
                    value={matrixRouteFilter}
                    onChange={(e) => setMatrixRouteFilter(e.target.value)}
                    className="p-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
                  >
                    <option value="all">All Routes</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.code}>
                        {r.code}
                      </option>
                    ))}
                  </select>

                  <select
                    value={matrixClassFilter}
                    onChange={(e) => setMatrixClassFilter(e.target.value)}
                    className="p-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
                  >
                    <option value="all">All Classes</option>
                    {classes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Search member / Adm No..."
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    className="p-2 rounded-xl border border-slate-200 text-xs bg-slate-50 w-44"
                  />

                  <button
                    type="button"
                    onClick={handlePrintMonthlyMatrix}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-900 text-white font-bold uppercase">
                    <tr>
                      <th className="py-3 px-3">Member &amp; Adm No</th>
                      <th className="py-3 px-2.5">Campus / Route</th>
                      <th className="py-3 px-2.5 text-right bg-amber-950/60 text-amber-300">
                        Prev. Dues (Billed / Due)
                      </th>
                      {SESSION_MONTHS.map((mKey) => (
                        <th key={mKey} className="py-3 px-2.5 text-right">
                          {MONTH_LABELS[mKey]}
                        </th>
                      ))}
                      <th className="py-3 px-2.5 text-right text-emerald-300">Total Collected</th>
                      <th className="py-3 px-3 text-right text-rose-300">Net Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matrixRows.map((row) => (
                      <tr key={row.student.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{row.student.name}</div>
                          <div className="font-mono text-[10px] text-slate-500">
                            {row.student.admissionNo} • {row.student.class}-{row.student.section}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold text-[10px] mr-1">
                            {row.campus}
                          </span>
                          <span className="font-mono font-bold text-slate-700">{row.routeCode}</span>
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono bg-amber-50/40">
                          {row.prevDuesBilled > 0 ? (
                            <div>
                              <div className="font-bold text-slate-800">
                                Billed: ₹{row.prevDuesBilled.toLocaleString('en-IN')}
                              </div>
                              <div
                                className={`text-[10px] font-bold ${
                                  row.prevDuesPending > 0 ? 'text-rose-600' : 'text-emerald-700'
                                }`}
                              >
                                Due: ₹{row.prevDuesPending.toLocaleString('en-IN')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">₹0</span>
                          )}
                        </td>
                        {SESSION_MONTHS.map((mKey) => {
                          const cell = row.monthMap[mKey];
                          return (
                            <td key={mKey} className="py-2.5 px-2.5 text-right font-mono">
                              {cell.billed > 0 ? (
                                <div>
                                  <div className="font-semibold text-slate-800">
                                    ₹{cell.billed.toLocaleString('en-IN')}
                                  </div>
                                  {cell.due > 0 ? (
                                    <span className="text-[10px] font-bold text-rose-600">
                                      Due: ₹{cell.due}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-emerald-700">
                                      Paid
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-2.5 text-right font-mono font-bold text-emerald-700">
                          ₹{row.totalCollected.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-rose-600 text-xs">
                          ₹{row.netOutstanding.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Demand Slip Phone Follow-up & Past Communications Modal */}
      {demandFollowUpStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-amber-400" />
                  <span>Phone Fee Follow-up &amp; Past Communications</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {demandFollowUpStudent.name} ({demandFollowUpStudent.admissionNo}) • Phone:{' '}
                  <strong className="font-mono text-amber-300">
                    {demandFollowUpStudent.parentPhone || demandFollowUpStudent.mobile || '—'}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDemandFollowUpStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto text-xs">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!onAddFollowUp) return;
                  await onAddFollowUp({
                    studentId: demandFollowUpStudent.id,
                    date: isAdmin ? folDate : todayStr,
                    callDate: isAdmin ? folDate : todayStr,
                    studentName: demandFollowUpStudent.name,
                    admissionNo: demandFollowUpStudent.admissionNo,
                    contactPerson:
                      folContactPerson ||
                      demandFollowUpStudent.fatherName ||
                      demandFollowUpStudent.parentName ||
                      'Parent',
                    contactedPerson:
                      folContactPerson ||
                      demandFollowUpStudent.fatherName ||
                      demandFollowUpStudent.parentName ||
                      'Parent',
                    phone:
                      folPhone ||
                      demandFollowUpStudent.parentPhone ||
                      demandFollowUpStudent.mobile ||
                      '',
                    overdueAmount: demandFollowUpStudent.balanceDue,
                    promiseDate: folPromiseDate || undefined,
                    promisedPayDate: folPromiseDate || undefined,
                    outcome: folOutcome,
                    callOutcome: folOutcome as any,
                    notes: folNotes || 'Phone follow-up from Demand Slip screen',
                    remarks: folNotes || 'Phone follow-up from Demand Slip screen',
                    officerName: currentRole,
                    recordedBy: currentRole,
                  });
                  setFolNotes('');
                  setFolPromiseDate('');
                }}
                className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-3"
              >
                <div className="font-bold text-indigo-950 flex items-center justify-between">
                  <span>Record Phone Call Follow-up</span>
                  <a
                    href={`tel:${demandFollowUpStudent.parentPhone || demandFollowUpStudent.mobile || ''}`}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-mono font-bold text-[11px] inline-flex items-center gap-1"
                  >
                    <PhoneCall className="w-3 h-3" />
                    <span>Call {demandFollowUpStudent.parentPhone || demandFollowUpStudent.mobile}</span>
                  </a>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Talked To
                    </label>
                    <input
                      type="text"
                      required
                      value={folContactPerson}
                      onChange={(e) => setFolContactPerson(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Call Outcome
                    </label>
                    <select
                      value={folOutcome}
                      onChange={(e) => setFolOutcome(e.target.value as any)}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                    >
                      <option value="Promise to Pay">Promise to Pay</option>
                      <option value="Promised to Pay">Promised to Pay</option>
                      <option value="Partial Payment Promised">Partial Payment Promised</option>
                      <option value="No Answer">No Answer / Switched Off</option>
                      <option value="Disputed">Disputed / Requested Time</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Promised Payment Date
                    </label>
                    <input
                      type="date"
                      value={folPromiseDate}
                      onChange={(e) => setFolPromiseDate(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Parent Response / Conversation Remarks *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter conversation details with parent..."
                    value={folNotes}
                    onChange={(e) => setFolNotes(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                  >
                    Save Phone Follow-up
                  </button>
                </div>
              </form>

              <div className="space-y-2.5">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Past Communications History
                </h4>
                {(() => {
                  const past = followUps
                    .filter(
                      (f) =>
                        f.studentId === demandFollowUpStudent.id ||
                        f.admissionNo === demandFollowUpStudent.admissionNo
                    )
                    .sort((a, b) =>
                      (b.callDate || b.date || '').localeCompare(a.callDate || a.date || '')
                    );
                  if (past.length === 0) {
                    return (
                      <div className="p-6 text-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                        No past communications recorded for this member yet.
                      </div>
                    );
                  }
                  return past.map((f) => (
                    <div
                      key={f.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">
                            {f.callOutcome || f.outcome}
                          </span>
                          <span className="font-mono font-bold text-slate-700">
                            {f.callDate || f.date}
                          </span>
                          <span className="text-slate-500">
                            • Talked to: <strong>{f.contactedPerson || f.contactPerson}</strong>
                          </span>
                        </div>
                        <p className="text-slate-800 font-medium mt-1">
                          {f.remarks || f.notes}
                        </p>
                      </div>
                      {(f.promisedPayDate || f.promiseDate) && (
                        <div className="text-right font-mono text-[11px] text-indigo-700 font-bold shrink-0">
                          Promised: {f.promisedPayDate || f.promiseDate}
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* IMPROVISED COLLECT FEE MODAL (Search, Confirm Details, Month Table) */}
      {/* =================================================================== */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Collect Transport Fee &amp; Issue Receipt</h3>
                <p className="text-[11px] text-slate-300">
                  Search &amp; select member, verify basic details, select month-wise dues, and record payment
                </p>
              </div>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReceiptSubmit} className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* STEP 1: Unified Search & Select Transport Member Bar */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Select Transport Member
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={memberFilterClass}
                      onChange={(e) => {
                        setMemberFilterClass(e.target.value);
                        setIsMemberDropdownOpen(true);
                      }}
                      className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-[11px] font-medium"
                    >
                      <option value="all">All Classes</option>
                      {classes.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>

                    <select
                      value={memberFilterType}
                      onChange={(e) => {
                        setMemberFilterType(e.target.value);
                        setIsMemberDropdownOpen(true);
                      }}
                      className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white text-[11px] font-medium"
                    >
                      <option value="all">All Member Types</option>
                      {memberTypes.map((mt) => (
                        <option key={mt.id} value={mt.name}>
                          {mt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5 relative">
                  <label className="block font-bold text-slate-700">
                    Select Transport Member ({narrowedMembers.length} matching):
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onFocus={() => setIsMemberDropdownOpen(true)}
                      onChange={(e) => {
                        setMemberSearchQuery(e.target.value);
                        setIsMemberDropdownOpen(true);
                      }}
                      placeholder={
                        selectedMember
                          ? `${selectedMember.name} (${selectedMember.admissionNo}) — ${selectedMember.class}-${selectedMember.section} • Mob: ${selectedMember.mobile || '—'} • Due: ₹${selectedMember.balanceDue}  [Type ID, Name or Phone to switch]`
                          : 'Type Member ID, Name, or Phone No...'
                      }
                      className="w-full pl-10 pr-28 py-2.5 border-2 border-slate-900 rounded-xl bg-white font-bold text-slate-900 placeholder:text-slate-700 focus:placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-400 text-xs"
                    />
                    <div className="absolute right-2 top-1.5 flex items-center gap-1">
                      {memberSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setMemberSearchQuery('');
                            setIsMemberDropdownOpen(true);
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsMemberDropdownOpen((prev) => !prev)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 hover:bg-slate-800 text-[10px] font-bold cursor-pointer"
                      >
                        {isMemberDropdownOpen ? 'Hide List ▲' : 'Show List ▼'}
                      </button>
                    </div>
                  </div>

                  {/* Live Matching Member List Shown Below as User Enters Characters (or Opens Bar) */}
                  {(isMemberDropdownOpen || memberSearchQuery.trim().length > 0) && (
                    <div className="border-2 border-slate-900 rounded-xl bg-white shadow-xl overflow-hidden mt-1">
                      <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                        <span>
                          {memberSearchQuery.trim()
                            ? `Matching Members (${narrowedMembers.length})`
                            : `Transport Members (${narrowedMembers.length})`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsMemberDropdownOpen(false)}
                          className="text-slate-300 hover:text-white cursor-pointer"
                        >
                          Close ✕
                        </button>
                      </div>
                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                        {narrowedMembers.length === 0 ? (
                          <div className="p-4 text-center text-slate-500 font-semibold">
                            No transport member matches "{memberSearchQuery}". Try searching by Admission ID, Name, or Phone Number.
                          </div>
                        ) : (
                          narrowedMembers.slice(0, 40).map((s) => {
                            const isSelected = selectedMember?.id === s.id;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => handleSelectMemberForFee(s.id)}
                                className={`w-full px-3.5 py-2.5 text-left transition-colors cursor-pointer flex flex-wrap items-center justify-between gap-2 ${
                                  isSelected
                                    ? 'bg-amber-50 border-l-4 border-l-amber-500 font-bold'
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-slate-900 text-xs">{s.name}</span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-indigo-700">
                                      {s.admissionNo}
                                    </span>
                                    <span className="text-[11px] text-slate-600 font-semibold">
                                      {s.class}-{s.section} ({s.memberType})
                                    </span>
                                    {s.transportStatus === 'Left' && (
                                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold">
                                        Left Transport — Pre-Left Dues Only
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-2">
                                    <span>Father: <strong className="text-slate-700">{s.fatherName || '—'}</strong></span>
                                    <span>•</span>
                                    <span>Phone: <strong className="font-mono text-slate-800">{s.mobile || s.emergencyContact || '—'}</strong></span>
                                    <span>•</span>
                                    <span>Route: <strong className="text-amber-800">{s.routeCode}</strong> ({s.pickupDropStopName})</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div
                                    className={`font-mono font-black text-xs ${
                                      s.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-700'
                                    }`}
                                  >
                                    Due: ₹{s.balanceDue.toLocaleString('en-IN')}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-semibold">
                                    {isSelected ? '✓ Currently Loaded' : 'Click to Load →'}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 2: Member Basic Details & Fee Summary Confirmation Table (Like Reference Screenshot) */}
              {selectedMember && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-100 px-3.5 py-2 font-bold text-slate-800 border-b border-slate-200 flex items-center justify-between">
                        <span>Member Details:</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            selectedMember.transportStatus === 'Left'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {selectedMember.transportStatus === 'Left'
                            ? 'Left Transport (Pre-Left Dues Only)'
                            : 'Active Selection'}
                        </span>
                      </div>
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-slate-200">
                          <tr>
                            <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60 w-32">Admission / ID:</td>
                            <td className="p-2.5 font-mono font-bold text-slate-900">{selectedMember.admissionNo}</td>
                            <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60 w-28">Member Name:</td>
                            <td className="p-2.5 font-bold text-slate-900">{selectedMember.name}</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Class &amp; Type:</td>
                            <td className="p-2.5 text-slate-800">
                              {selectedMember.class}-{selectedMember.section} ({selectedMember.memberType})
                            </td>
                            <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Father / Guardian:</td>
                            <td className="p-2.5 text-slate-800">{selectedMember.fatherName}</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Route &amp; Stop:</td>
                            <td className="p-2.5 text-slate-800" colSpan={3}>
                              <span className="font-mono font-bold text-amber-800">{selectedMember.routeCode}</span> •{' '}
                              {selectedMember.pickupDropStopName} ({selectedMember.villageName})
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-100 px-3.5 py-2 font-bold text-slate-800 border-b border-slate-200">
                        Fees Details Summary:
                      </div>
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-slate-200">
                          <tr>
                            <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Total Fees:</td>
                            <td className="p-2.5 font-bold text-slate-900">₹{memberTotalAccrued.toLocaleString('en-IN')}</td>
                            <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Paid Fees:</td>
                            <td className="p-2.5 font-bold text-emerald-700">₹{memberTotalPaid.toLocaleString('en-IN')}</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Discount:</td>
                            <td className="p-2.5 font-bold text-amber-700">₹{memberTotalConcession.toLocaleString('en-IN')}</td>
                            <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Bal. Fees:</td>
                            <td className="p-2.5 font-black text-rose-600 text-sm">
                              ₹{selectedMember.balanceDue.toLocaleString('en-IN')}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold text-slate-600 bg-slate-50/60">Monthly Rate:</td>
                            <td className="p-2.5 text-slate-800" colSpan={3}>
                              ₹{selectedMember.monthlyFee}/month • Mobile: {selectedMember.mobile}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Existing Receipts for this Selected Member (Allows Admin to inspect & delete duplicate/wrong receipt directly) */}
                  {(() => {
                    const memberExistingReceipts = visibleReceipts.filter(
                      (r) =>
                        r.studentId === selectedMember.id ||
                        (selectedMember.admissionNo && r.admissionNo === selectedMember.admissionNo)
                    );
                    if (memberExistingReceipts.length === 0) return null;
                    return (
                      <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                            Previous Fee Receipts for {selectedMember.name} ({memberExistingReceipts.length})
                          </span>
                          {isAdmin && (
                            <span className="text-[10px] font-semibold text-rose-700">
                              Admin: Click Delete on any wrong/duplicate receipt to revert it
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {memberExistingReceipts.map((rec) => (
                            <div
                              key={rec.id}
                              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-2.5 shadow-2xs"
                            >
                              <div>
                                <div className="font-mono font-bold text-slate-900 text-[11px]">
                                  {rec.receiptNo} • <span className="text-emerald-700">₹{rec.amount.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {rec.date} • {rec.paymentMode} • {rec.feeBreakupDescription || 'Transport Fee'}
                                </div>
                              </div>
                              {getReceiptAttachmentInfo(rec).hasAttachment && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReceiptAttachment(rec)}
                                  className="p-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 cursor-pointer"
                                  title="View Payment Attachment"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handlePrintSingleReceipt(rec)}
                                className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                                title="Print Receipt"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              {isAdmin && onDeleteReceipt && (
                                <button
                                  type="button"
                                  onClick={() => setReceiptToDelete(rec)}
                                  className="px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Delete this Receipt"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* STEP 3: Month-wise Dues Breakdown Table (With Admin-only Discount against each month) */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={
                        effectiveDueRows.length > 0 &&
                        selectedMonthIds.length === effectiveDueRows.length
                      }
                      onChange={toggleSelectAllMonths}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                     <span className="font-bold text-xs">
                      Pending Dues Breakdown
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-300 font-semibold">
                    {selectedMember?.transportStatus === 'Left'
                      ? 'Left Facility — Receiving fees charged prior to leaving only'
                      : isAdmin
                      ? 'Admin: Discount enabled'
                      : 'Discount: Admin Only'}
                  </span>
                </div>

                {effectiveDueRows.length === 0 ? (
                  <div className="p-6 text-center text-emerald-700 bg-emerald-50/50 font-bold">
                    No pending monthly dues for {selectedMember?.name}. All billed months are cleared!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">Select</th>
                          <th className="py-2.5 px-3">Month &amp; Description of Dues</th>
                          <th className="py-2.5 px-3 text-right">Dues Amount (₹)</th>
                          <th className="py-2.5 px-3 text-center">
                            Discount (₹){' '}
                            {!isAdmin && <span className="text-[10px] text-rose-600">(Admin Only)</span>}
                          </th>
                          <th className="py-2.5 px-4 text-right">Net Payable (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {effectiveDueRows.map((row) => {
                          const isChecked = selectedMonthIds.includes(row.id);
                          const disc = Math.min(
                            row.duesAmount,
                            Math.max(0, Number(monthDiscounts[row.id] || 0))
                          );
                          const netMonth = Math.max(0, row.duesAmount - disc);

                          return (
                            <tr
                              key={row.id}
                              className={isChecked ? 'bg-amber-50/30' : 'opacity-60 bg-slate-50'}
                            >
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleMonthSelection(row.id)}
                                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {row.description}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                                ₹{row.duesAmount.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {isAdmin ? (
                                  <input
                                    type="number"
                                    min={0}
                                    max={row.duesAmount}
                                    disabled={!isChecked}
                                    value={monthDiscounts[row.id] ?? 0}
                                    onChange={(e) =>
                                      setMonthDiscounts((prev) => ({
                                        ...prev,
                                        [row.id]: Number(e.target.value),
                                      }))
                                    }
                                    className="w-24 p-1.5 border border-slate-300 rounded-lg text-right font-mono font-bold bg-white"
                                  />
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-500 font-mono text-[11px]">
                                    <Lock className="w-3 h-3" /> ₹0
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                                ₹{isChecked ? netMonth.toLocaleString('en-IN') : 0}
                              </td>
                            </tr>
                          );
                        })}

                        {/* LATE FEE MECHANISM ROW: Automatically adds ₹100 if paid after 10th of month; only Admin can waive via discount */}
                        {lateFineApplicable > 0 && (
                          <tr className="bg-rose-50/70 border-t border-rose-200">
                            <td className="py-2.5 px-3 text-center font-bold text-rose-700">Auto</td>
                            <td className="py-2.5 px-3 font-bold text-rose-900">
                              Late Fine (Payment after 10th due date of month — ₹100 compulsory fine)
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-800">
                              ₹100
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isAdmin ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={lateFineWaiver}
                                  onChange={(e) => setLateFineWaiver(Number(e.target.value))}
                                  title="Admin Only: Waive off Late Fine via Discount"
                                  className="w-24 p-1.5 border border-rose-300 rounded-lg text-right font-mono font-bold bg-white text-rose-900"
                                />
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-100 text-rose-700 font-mono text-[11px]">
                                  <Lock className="w-3 h-3" /> Admin Waiver Only
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-black text-rose-700 text-sm">
                              ₹{netLateFine}
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                        <tr>
                          <td colSpan={2} className="py-2.5 px-3 text-right uppercase">
                            Total Selected ({selectedRows.length} Month{selectedRows.length === 1 ? '' : 's'}
                            {lateFineApplicable > 0 ? ' + ₹100 Late Fine' : ''}):
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            ₹{totalSelectedDues.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-amber-800">
                            - ₹{totalSelectedDiscount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-base text-emerald-700">
                            ₹{totalNetPayable.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* STEP 4: Bottom Net Payable, Payment Mode, Date (Backdate Admin Only), Ref, Remarks, Attachment */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Net Payable Amount (₹)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`₹${totalNetPayable.toLocaleString('en-IN')}`}
                    className="w-full p-2.5 border border-emerald-300 rounded-xl bg-emerald-50 font-mono font-black text-emerald-800 text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-bold text-slate-900"
                  >
                    <option value="UPI">UPI (QR / App)</option>
                    <option value="Cash">Cash at Counter</option>
                    <option value="Bank">Bank Transfer / NEFT / Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Payment Date *</span>
                    {!isAdmin && (
                      <span className="text-[10px] text-amber-700 font-semibold">Auto-selected (Admin backdate)</span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={isAdmin ? paymentDate : todayStr}
                    readOnly={!isAdmin}
                    disabled={!isAdmin}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className={`w-full p-2.5 border rounded-xl font-mono font-bold ${
                      isAdmin
                        ? 'border-slate-200 bg-white text-slate-900'
                        : 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Transaction Ref / UTR / Cheque No
                  </label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g., UPI/4291028490 or Cheque #00412"
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Remarks (If any)
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g., Transport fee cleared via UPI"
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
                  />
                </div>

                <div
                  className={`sm:col-span-3 p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                    (paymentMode === 'UPI' || paymentMode === 'Bank') && !upiScreenshot
                      ? 'bg-amber-50/70 border-amber-300'
                      : upiScreenshot
                      ? 'bg-emerald-50/60 border-emerald-300'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {upiScreenshot && upiScreenshot.startsWith('data:image/') && (
                      <img
                        src={upiScreenshot}
                        alt="Payment Proof Preview"
                        onClick={() =>
                          setPreviewScreenshot({
                            title: `Uploaded Payment Proof (${upiScreenshotName || paymentMode})`,
                            url: upiScreenshot,
                          })
                        }
                        className="w-12 h-12 rounded-lg object-cover border border-emerald-400 cursor-pointer shadow-2xs"
                        title="Click to preview full image"
                      />
                    )}
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-2">
                        <span>Attach Payment Proof / UPI Screenshot (Visible in Fee Records)</span>
                        {paymentMode === 'UPI' || paymentMode === 'Bank' ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-extrabold uppercase">
                            * Compulsory for {paymentMode === 'UPI' ? 'UPI' : 'Bank Transfer'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                            Optional for Cash
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {upiScreenshot ? (
                          <span className="text-emerald-700 font-bold">
                            ✓ Attached: {upiScreenshotName || 'Payment Screenshot'} (Auto-compressed for instant viewing)
                          </span>
                        ) : (
                          <span>
                            Upload payment screenshot or bank slip (JPEG, PNG, WEBP, PDF)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {upiScreenshot && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewScreenshot({
                            title: `Uploaded Payment Proof (${upiScreenshotName || paymentMode})`,
                            url: upiScreenshot,
                            isPdf: upiScreenshot.startsWith('data:application/pdf'),
                          })
                        }
                        className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>
                    )}
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs">
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>{upiScreenshot ? 'Change Attachment' : 'Upload Attachment *'}</span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleUpiFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {collectModalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 font-bold text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{collectModalError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCollectModalError(null)}
                    className="text-rose-600 hover:text-rose-900 text-xs font-black cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingReceipt}
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedRows.length === 0 || isSubmittingReceipt}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-2"
                >
                  {isSubmittingReceipt ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving &amp; Opening Print...</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      <span>Save &amp; Auto-Print Receipt (₹{totalNetPayable.toLocaleString('en-IN')})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: RECORD FEE FOLLOW-UP CALL                                    */}
      {/* =================================================================== */}
      {isFollowUpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Fee Follow-up Call</h3>
                <p className="text-[11px] text-slate-500">
                  Log conversation details and promised date (triggers recall popup if unpaid)
                </p>
              </div>
              <button
                onClick={() => setIsFollowUpModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFollowUpSubmit} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Member *</label>
                <select
                  value={folStudentId}
                  onChange={(e) => setFolStudentId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold"
                >
                  {scopedStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admissionNo}) — Overdue: ₹{s.balanceDue}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Call Date *</label>
                  <input
                    type="date"
                    value={folDate}
                    onChange={(e) => setFolDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Next Follow-up / Promise Date *
                  </label>
                  <input
                    type="date"
                    value={folPromiseDate}
                    onChange={(e) => setFolPromiseDate(e.target.value)}
                    className="w-full p-2.5 border border-amber-300 bg-amber-50/40 rounded-xl font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Person Talked To *
                  </label>
                  <input
                    type="text"
                    value={folContactPerson}
                    onChange={(e) => setFolContactPerson(e.target.value)}
                    placeholder="e.g., Father / Mother"
                    className="w-full p-2.5 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    value={folPhone}
                    onChange={(e) => setFolPhone(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Call Outcome *</label>
                <select
                  value={folOutcome}
                  onChange={(e) => setFolOutcome(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-semibold"
                >
                  <option value="Promise to Pay">Promise to Pay</option>
                  <option value="Exemption Requested">Time Extension / Permission Requested</option>
                  <option value="Disputed">Fee Query / Disputed</option>
                  <option value="Unreachable">Call Not Received / Unreachable</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Response Received / Remarks *
                </label>
                <textarea
                  rows={3}
                  value={folNotes}
                  onChange={(e) => setFolNotes(e.target.value)}
                  placeholder="e.g., Spoke to father; promised to deposit transport dues on 25th..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                >
                  Save Follow-up Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ISSUE FORMAL WARNING LETTER                                  */}
      {/* =================================================================== */}
      {isWarningModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Issue Formal Overdue Warning Letter</h3>
              <button
                onClick={() => setIsWarningModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWarningLetterSubmit} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Overdue Member *</label>
                <select
                  value={warnStudentId}
                  onChange={(e) => setWarnStudentId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold"
                >
                  {scopedStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admissionNo}) — Overdue: ₹{s.balanceDue}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Warning Level *</label>
                <select
                  value={warnLevel}
                  onChange={(e) => setWarnLevel(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-semibold"
                >
                  <option value="Level 1: Polite Reminder">Level 1: Polite Reminder</option>
                  <option value="Level 2: Urgent Notice">Level 2: Urgent Notice</option>
                  <option value="Level 3: Final Suspension Warning">Level 3: Final Suspension Warning</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Payment Deadline / Suspension Date *
                  </label>
                  <input
                    type="date"
                    value={warnDeadline}
                    onChange={(e) => setWarnDeadline(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dispatch Mode *</label>
                  <select
                    value={warnSentVia}
                    onChange={(e) => setWarnSentVia(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="Printed Slip">Printed Slip (Diary / Handover)</option>
                    <option value="WhatsApp">WhatsApp Notice</option>
                    <option value="SMS">SMS Alert</option>
                    <option value="Registered Letter">Registered Post</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWarningModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Issue &amp; Print Warning Letter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: INDIVIDUAL SUSPENSION SELECTION LIST (NO AUTO-SUSPENSION)    */}
      {/* =================================================================== */}
      {isIndividualSuspendModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Individual Member Suspension List (Unpaid Dues &amp; No Permission Extension)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Suspension is never auto-triggered. Choose individual members below whose permission extension application is not received and whose overall dues are not clear.
                </p>
              </div>
              <button
                onClick={() => setIsIndividualSuspendModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Member &amp; ID</th>
                    <th className="py-2.5 px-3">Guardian &amp; Phone</th>
                    <th className="py-2.5 px-3">Route &amp; Stop</th>
                    <th className="py-2.5 px-3">Overall Dues</th>
                    <th className="py-2.5 px-3">Suspension Reason</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eligibleForManualSuspension.map((m) => (
                    <tr key={m.id} className="hover:bg-rose-50/30">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{m.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {m.admissionNo} • {m.class}-{m.section}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{m.fatherName}</div>
                        <div className="font-mono text-[10px] text-slate-500">{m.mobile}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-slate-900">{m.routeCode}</span> • {m.pickupDropStopName}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-rose-600">
                        ₹{m.balanceDue.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={
                            suspendReasonMap[m.id] ??
                            `Overdue fee ₹${m.balanceDue} unpaid after 20th cutoff & no permission application received`
                          }
                          onChange={(e) =>
                            setSuspendReasonMap((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            const reason =
                              suspendReasonMap[m.id] ||
                              `Overdue fee ₹${m.balanceDue} unpaid after 20th cutoff & no permission application received`;
                            if (onSuspendStudent) {
                              await onSuspendStudent(m.id, reason);
                              setStatusMessage({
                                type: 'success',
                                text: `${m.name} (${m.admissionNo}) has been ${
                                  isAdmin ? 'suspended' : 'submitted for Admin suspension approval'
                                }.`,
                              });
                            }
                          }}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] cursor-pointer whitespace-nowrap"
                        >
                          {isAdmin ? 'Suspend Member' : 'Request Suspension'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {eligibleForManualSuspension.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        All members have either cleared their dues, hold an active Permission Extension Letter, or are already suspended.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsIndividualSuspendModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Attachment Preview Modal */}
      {previewScreenshot && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-sm">{previewScreenshot.title}</h4>
                {previewScreenshot.receipt && (
                  <p className="text-[11px] text-slate-300">
                    Receipt {previewScreenshot.receipt.receiptNo} • Paid ₹
                    {previewScreenshot.receipt.amount.toLocaleString('en-IN')} via{' '}
                    {previewScreenshot.receipt.paymentMode} on {previewScreenshot.receipt.date}
                  </p>
                )}
              </div>
              <button
                onClick={() => setPreviewScreenshot(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-100 flex flex-col items-center justify-center flex-1 overflow-auto min-h-[280px]">
              {previewScreenshot.isPdf || previewScreenshot.url.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewScreenshot.url}
                  title={previewScreenshot.title}
                  className="w-full h-[65vh] rounded-xl border border-slate-300 bg-white"
                />
              ) : (
                <img
                  src={previewScreenshot.url}
                  alt={previewScreenshot.title}
                  className="max-w-full max-h-[65vh] rounded-xl border border-slate-300 shadow-md object-contain bg-white"
                />
              )}
            </div>

            <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                {previewScreenshot.receipt && (
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {isUploadingReceiptAttachment
                        ? 'Saving Screenshot...'
                        : previewScreenshot.isPlaceholder
                        ? 'Upload Original Screenshot Image'
                        : 'Replace Screenshot'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      disabled={isUploadingReceiptAttachment}
                      onChange={(e) =>
                        previewScreenshot.receipt &&
                        handleReplaceSavedReceiptAttachment(previewScreenshot.receipt, e)
                      }
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewScreenshot.url}
                  download={`payment_proof_${previewScreenshot.receipt?.receiptNo || 'receipt'}.jpg`}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 font-bold text-slate-700 inline-flex items-center gap-1.5"
                >
                  <span>Download Proof</span>
                </a>
                {previewScreenshot.receipt && (
                  <button
                    type="button"
                    onClick={() => handlePrintSingleReceipt(previewScreenshot.receipt!, true)}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Print Receipt</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewScreenshot(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PREVIOUS DUES (OLD SOFTWARE ARREARS HEAD) ENTRY MODAL */}
      {isPrevDuesModalOpen && (() => {
        const distinctRoutes = Array.from(new Set(scopedStudents.map(s => s.routeCode).filter(Boolean))).sort();
        const filteredForPrevDues = scopedStudents.filter(s => {
          if (prevDuesFilterClass !== 'all' && s.class !== prevDuesFilterClass) return false;
          if (prevDuesFilterRoute !== 'all' && s.routeCode !== prevDuesFilterRoute) return false;
          if (prevDuesSearch.trim()) {
            const q = prevDuesSearch.toLowerCase();
            return (
              s.name.toLowerCase().includes(q) ||
              s.admissionNo.toLowerCase().includes(q) ||
              s.villageName.toLowerCase().includes(q) ||
              s.routeCode.toLowerCase().includes(q)
            );
          }
          return true;
        });

        const handleSaveSinglePrevDues = async (student: StudentMember) => {
          const edit = prevDuesEdits[student.id];
          const rawAmt = edit !== undefined ? edit.amount : String(student.previousDues ?? 0);
          const rawRem = edit !== undefined ? edit.remarks : (student.previousDuesRemarks || 'Previous Dues (Old Software)');
          const amt = Number(rawAmt);
          if (isNaN(amt) || amt < 0) return;
          setIsSavingPrevDues(true);
          try {
            await api.setStudentPreviousDues(student.id, amt, rawRem);
            setStatusMessage({
              type: 'success',
              text: `Updated Previous Dues head for ${student.name} to ₹${amt.toLocaleString('en-IN')}. Included in Outstanding.`,
            });
          } finally {
            setIsSavingPrevDues(false);
          }
        };

        const handleSaveAllEditedPrevDues = async () => {
          const entries = Object.entries(prevDuesEdits)
            .map(([studentId, val]) => ({
              studentId,
              amount: Number(val.amount) || 0,
              remarks: val.remarks || 'Previous Dues (Old Software)',
            }))
            .filter(e => !isNaN(e.amount) && e.amount >= 0);

          if (entries.length === 0) {
            setIsPrevDuesModalOpen(false);
            return;
          }
          setIsSavingPrevDues(true);
          try {
            const res = await api.bulkSetPreviousDues(entries);
            setStatusMessage({
              type: 'success',
              text: `Saved Previous Dues (Old Software Head) for ${res.updatedCount} member(s). Outstanding balances updated.`,
            });
            setPrevDuesEdits({});
            setIsPrevDuesModalOpen(false);
          } finally {
            setIsSavingPrevDues(false);
          }
        };

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-amber-600" />
                    <span>Add / Manage Previous Dues Head (From Old Software)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enter opening arrears from your old software for any member. It creates a dedicated &ldquo;Previous Dues (Old Software)&rdquo; head included in Outstanding &amp; collectible via Fee Receipts.
                  </p>
                </div>
                <button
                  onClick={() => setIsPrevDuesModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={prevDuesSearch}
                    onChange={e => setPrevDuesSearch(e.target.value)}
                    placeholder="Search member name, ID, village..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <select
                  value={prevDuesFilterRoute}
                  onChange={e => setPrevDuesFilterRoute(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="all">All Routes</option>
                  {distinctRoutes.map(rc => (
                    <option key={rc} value={rc}>Route: {rc}</option>
                  ))}
                </select>
                <select
                  value={prevDuesFilterClass}
                  onChange={e => setPrevDuesFilterClass(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="all">All Classes</option>
                  {classes.map(c => (
                    <option key={c} value={c}>Class: {c}</option>
                  ))}
                </select>
              </div>

              {/* Table of Members to Enter Previous Dues */}
              <div className="border border-slate-200 rounded-xl overflow-y-auto flex-1 max-h-[54vh]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase z-10">
                    <tr>
                      <th className="py-2.5 px-3">Member &amp; ID</th>
                      <th className="py-2.5 px-3">Class / Route</th>
                      <th className="py-2.5 px-3">Current Total Outstanding</th>
                      <th className="py-2.5 px-3">Previous Dues Amount (₹)</th>
                      <th className="py-2.5 px-3">Head / Period Remark</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredForPrevDues.map(st => {
                      const edit = prevDuesEdits[st.id];
                      const valAmt = edit !== undefined ? edit.amount : String(st.previousDues ?? 0);
                      const valRem = edit !== undefined ? edit.remarks : (st.previousDuesRemarks || 'Previous Dues (Old Software)');
                      return (
                        <tr key={st.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{st.name}</div>
                            <div className="font-mono text-[10px] text-slate-500">{st.admissionNo} • {st.villageName}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{st.class}-{st.section}</div>
                            <div className="font-mono text-[10px] text-amber-700 font-bold">{st.routeCode}</div>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-rose-600">
                            ₹{st.balanceDue.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min={0}
                              value={valAmt}
                              onChange={e =>
                                setPrevDuesEdits(prev => ({
                                  ...prev,
                                  [st.id]: {
                                    amount: e.target.value,
                                    remarks: valRem,
                                  },
                                }))
                              }
                              className="w-28 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={valRem}
                              onChange={e =>
                                setPrevDuesEdits(prev => ({
                                  ...prev,
                                  [st.id]: {
                                    amount: valAmt,
                                    remarks: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Previous Dues (Old Software)"
                              className="w-48 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              disabled={isSavingPrevDues}
                              onClick={() => handleSaveSinglePrevDues(st)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-lg text-[11px] cursor-pointer"
                            >
                              Save
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-xs text-slate-500">
                  Edited in this session: <strong>{Object.keys(prevDuesEdits).length}</strong> member(s)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPrevDuesModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    Close
                  </button>
                  {Object.keys(prevDuesEdits).length > 0 && (
                    <button
                      type="button"
                      disabled={isSavingPrevDues}
                      onClick={handleSaveAllEditedPrevDues}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                    >
                      {isSavingPrevDues ? 'Saving All...' : `Save All Edited (${Object.keys(prevDuesEdits).length})`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* =================================================================== */}
      {/* MODAL: ADMIN CONFIRM DELETE FEE RECEIPT                             */}
      {/* =================================================================== */}
      {receiptToDelete && (
        <div className="fixed inset-0 z-[60] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4 text-xs">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Delete Fee Receipt (Admin Only)</h3>
                  <p className="text-[11px] text-slate-500">
                    Reverts received fee entry and restores pending member balance
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReceiptToDelete(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5 space-y-1.5 text-slate-800">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Receipt No:</span>
                <span className="font-mono font-bold text-slate-900">{receiptToDelete.receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Member Name:</span>
                <span className="font-bold text-slate-900">
                  {receiptToDelete.studentName} ({receiptToDelete.admissionNo})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Receipt Date &amp; Mode:</span>
                <span className="font-semibold text-slate-800">
                  {receiptToDelete.date} • {receiptToDelete.paymentMode}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Amount Received:</span>
                <span className="font-black text-rose-700 text-sm">
                  ₹{receiptToDelete.amount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Fee Breakup:</span>
                <span className="text-slate-700 text-right max-w-52">
                  {receiptToDelete.feeBreakupDescription || 'Transport Fee'}
                </span>
              </div>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete receipt{' '}
              <strong className="text-slate-900">{receiptToDelete.receiptNo}</strong>? This will deduct{' '}
              <strong className="text-rose-700">₹{receiptToDelete.amount.toLocaleString('en-IN')}</strong> from{' '}
              <strong>{receiptToDelete.paymentMode}</strong> collections and recalculate{' '}
              <strong>{receiptToDelete.studentName}&apos;s</strong> pending dues automatically.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingReceipt}
                onClick={() => setReceiptToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingReceipt}
                onClick={handleConfirmDeleteReceipt}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingReceipt ? 'Deleting Receipt...' : 'Yes, Delete Receipt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {actionAckModal && (
        <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border space-y-4 text-xs ${
              actionAckModal.type === 'saved'
                ? 'border-emerald-300'
                : actionAckModal.type === 'deleted'
                ? 'border-amber-300'
                : 'border-rose-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    actionAckModal.type === 'saved'
                      ? 'bg-emerald-100 text-emerald-700'
                      : actionAckModal.type === 'deleted'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {actionAckModal.type === 'saved' ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : actionAckModal.type === 'deleted' ? (
                    <Trash2 className="w-6 h-6" />
                  ) : (
                    <AlertTriangle className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">{actionAckModal.title}</h3>
                  <p className="text-[11px] text-slate-500">
                    {actionAckModal.type === 'saved'
                      ? 'Fee entry is saved permanently — do not re-enter this payment'
                      : actionAckModal.type === 'deleted'
                      ? 'Receipt removed and student balance updated immediately'
                      : 'Action notice'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionAckModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`rounded-xl p-3.5 space-y-2 border ${
                actionAckModal.type === 'saved'
                  ? 'bg-emerald-50/80 border-emerald-200'
                  : actionAckModal.type === 'deleted'
                  ? 'bg-amber-50/80 border-amber-200'
                  : 'bg-rose-50/80 border-rose-200'
              }`}
            >
              {actionAckModal.receiptNo && (
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-600">Receipt No:</span>
                  <span className="font-mono font-black text-slate-900">{actionAckModal.receiptNo}</span>
                </div>
              )}
              {actionAckModal.memberName && (
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-600">Member Name:</span>
                  <span className="font-bold text-slate-900">
                    {actionAckModal.memberName}
                    {actionAckModal.admissionNo ? ` (${actionAckModal.admissionNo})` : ''}
                  </span>
                </div>
              )}
              {actionAckModal.amount !== undefined && (
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-600">
                    {actionAckModal.type === 'deleted' ? 'Reverted Amount:' : 'Amount Received:'}
                  </span>
                  <span
                    className={`font-black text-sm ${
                      actionAckModal.type === 'deleted' ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    ₹{actionAckModal.amount.toLocaleString('en-IN')}
                    {actionAckModal.paymentMode ? ` (${actionAckModal.paymentMode})` : ''}
                  </span>
                </div>
              )}
              {actionAckModal.balanceAfter !== undefined && (
                <div className="flex justify-between border-t border-slate-200/80 pt-1.5">
                  <span className="font-semibold text-slate-700">Updated Pending Dues:</span>
                  <span className="font-black text-slate-900 text-sm">
                    ₹{actionAckModal.balanceAfter.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>

            <p className="text-slate-700 font-medium leading-relaxed">{actionAckModal.message}</p>

            <div className="flex items-center justify-end gap-2 pt-2">
              {actionAckModal.type === 'saved' && actionAckModal.receiptObj && (
                <button
                  type="button"
                  onClick={() => {
                    const rec = actionAckModal.receiptObj!;
                    setActionAckModal(null);
                    handlePrintSingleReceipt(rec);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Print Receipt</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActionAckModal(null)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs"
              >
                OK / Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

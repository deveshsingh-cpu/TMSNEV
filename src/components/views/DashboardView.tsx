import React, { useState } from 'react';
import {
  Users,
  Bus,
  MapPin,
  IndianRupee,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  FileWarning,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  PhoneCall,
  Gavel,
  X,
  BellRing,
  Check,
  Ban,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import {
  DashboardSummary,
  StudentMember,
  Vehicle,
  DailyTrip,
  FeeReceipt,
  ExpenseRecord,
  MaintenanceRequest,
  NavigationTab,
  FeeFollowUpRecord,
  DisciplineRecord,
} from '../../types/index.js';

interface DashboardViewProps {
  summary: DashboardSummary | null;
  students: StudentMember[];
  vehicles: Vehicle[];
  dailyTrips: DailyTrip[];
  feeReceipts: FeeReceipt[];
  expenses: ExpenseRecord[];
  maintenance: MaintenanceRequest[];
  feeFollowUps?: FeeFollowUpRecord[];
  disciplineRecords?: DisciplineRecord[];
  isAdmin?: boolean;
  currentRoleName?: string;
  onNavigate: (tab: NavigationTab, subTab?: string) => void;
  onOpenMemberProfile?: (memberId: string) => void;
  onUpdateExpenseApproval?: (
    id: string,
    payload: { approvalStatus: 'Approved' | 'Rejected'; approvedBy?: string; rejectionReason?: string }
  ) => Promise<void>;
  onUpdateMaintenanceStatus?: (
    id: string,
    payload: {
      status: MaintenanceRequest['status'];
      approvedBy?: string;
      rejectionReason?: string;
      actualCost?: number;
      completionDate?: string;
    }
  ) => Promise<void>;
  onAddMaintenance?: (data: Omit<MaintenanceRequest, 'id'>) => Promise<void>;
  onReviewSuspensionRequest?: (id: string, action: 'Approve' | 'Reject', reason?: string) => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  students = [],
  vehicles = [],
  dailyTrips = [],
  feeReceipts = [],
  expenses = [],
  maintenance = [],
  feeFollowUps = [],
  disciplineRecords = [],
  isAdmin = true,
  currentRoleName = 'Transport Admin',
  onNavigate,
  onOpenMemberProfile,
  onUpdateExpenseApproval,
  onUpdateMaintenanceStatus,
  onAddMaintenance,
  onReviewSuspensionRequest,
}) => {
  const today = new Date().toISOString().split('T')[0];

  // Overdue / Today Promise Date Follow-Up Recall Popup
  const overdueFollowUps = feeFollowUps.filter(
    (f) => f.status === 'Pending' && f.promisedDate && f.promisedDate <= today
  );
  const [dismissedPopup, setDismissedPopup] = useState(false);

  // Filter states for Dashboard Approvals
  const [woStatusFilter, setWoStatusFilter] = useState<'all' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Completed'>('all');
  const [expApprovalFilter, setExpApprovalFilter] = useState<'all' | 'Pending Approval' | 'Approved' | 'Rejected'>('all');

  // Quick Raise Work Order Modal from Dashboard
  const [isRaiseWoOpen, setIsRaiseWoOpen] = useState(false);
  const [woVehicleId, setWoVehicleId] = useState(vehicles[0]?.id || '');
  const [woIssueType, setWoIssueType] = useState<MaintenanceRequest['issueType']>('Mechanical');
  const [woPriority, setWoPriority] = useState<MaintenanceRequest['priority']>('High');
  const [woEstCost, setWoEstCost] = useState(2500);
  const [woVendor, setWoVendor] = useState('');
  const [woDesc, setWoDesc] = useState('');
  const [isSubmittingWo, setIsSubmittingWo] = useState(false);

  const activeStudents = students.filter((s) => s.transportStatus === 'Active').length;
  const suspendedStudents = students.filter((s) => s.transportStatus === 'Suspended').length;
  const totalDues = students.reduce((acc, s) => acc + s.balanceDue, 0);

  // Only count Approved expenses in financial totals
  const approvedExpenses = expenses.filter(
    (e) => !e.approvalStatus || e.approvalStatus === 'Approved'
  );
  const totalCollected = feeReceipts.reduce((acc, r) => acc + (r.amountPaid ?? r.amount ?? 0), 0);
  const totalExpenses = approvedExpenses.reduce((acc, e) => acc + e.amount, 0);

  const todayReceipts = feeReceipts
    .filter((r) => r.date === today)
    .reduce((acc, r) => acc + (r.amountPaid ?? r.amount ?? 0), 0);
  const todayExpenses = approvedExpenses
    .filter((e) => e.date === today)
    .reduce((acc, e) => acc + e.amount, 0);

  // Compliance expiry checks (within 60 days)
  const expiringVehicles = vehicles.filter((v) => {
    const checkDate = (d: string) => {
      if (!d) return false;
      const diff = (new Date(d).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      return diff <= 60;
    };
    return (
      checkDate(v.fitnessUpto) ||
      checkDate(v.insuranceUpto) ||
      checkDate(v.pollutionUpto) ||
      checkDate(v.taxPaidUpto)
    );
  });

  // Previous 10 discipline records sorted by latest date
  const recentDisciplineRecords = [...disciplineRecords]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  // Approval required expenses (either Pending Approval, Approved, or Rejected from categories requiring approval, or any with approvalStatus)
  const approvalTrackedExpenses = expenses.filter(
    (e) =>
      e.requiresApproval ||
      e.approvalStatus === 'Pending Approval' ||
      e.approvalStatus === 'Rejected' ||
      e.approvalStatus === 'Approved'
  );

  const filteredDashboardWorkOrders = maintenance.filter((m) => {
    if (woStatusFilter === 'all') return true;
    if (woStatusFilter === 'Pending Approval') {
      return m.status === 'Pending Approval' || m.status === 'Open';
    }
    if (woStatusFilter === 'Approved') {
      return m.status === 'Approved' || m.status === 'In Progress';
    }
    return m.status === woStatusFilter;
  });

  const filteredDashboardExpenses = approvalTrackedExpenses.filter((e) => {
    const st = e.approvalStatus || 'Approved';
    if (expApprovalFilter === 'all') return true;
    return st === expApprovalFilter;
  });

  const pendingWorkOrdersCount = maintenance.filter(
    (m) => m.status === 'Pending Approval' || m.status === 'Open'
  ).length;
  const approvedWorkOrdersCount = maintenance.filter(
    (m) => m.status === 'Approved' || m.status === 'In Progress'
  ).length;
  const pendingExpensesCount = expenses.filter(
    (e) => e.approvalStatus === 'Pending Approval'
  ).length;

  const handleQuickRaiseWo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddMaintenance) return;
    const veh = vehicles.find((v) => v.id === woVehicleId) || vehicles[0];
    if (!veh || !woDesc.trim()) return;
    setIsSubmittingWo(true);
    try {
      await onAddMaintenance({
        vehicleId: veh.id,
        vehicleNumber: veh.registrationNumber,
        reportedDate: today,
        reportedBy: currentRoleName,
        issueType: woIssueType,
        priority: woPriority,
        description: woDesc.trim(),
        estimatedCost: Number(woEstCost) || 0,
        status: isAdmin ? 'Approved' : 'Pending Approval',
        approvedBy: isAdmin ? currentRoleName : undefined,
        approvedDate: isAdmin ? today : undefined,
        vendorName: woVendor.trim() || 'Authorized Service Center',
      });
      setIsRaiseWoOpen(false);
      setWoDesc('');
      setWoVendor('');
    } finally {
      setIsSubmittingWo(false);
    }
  };

  const isAssistant = currentRoleName === 'Transport Assistant';
  const isCoordinator = currentRoleName === 'Transport Coordinator';

  // =========================================================================
  // DEDICATED TRANSPORT ASSISTANT DASHBOARD (GATE & FIELD OPERATIONS ONLY)
  // =========================================================================
  if (isAssistant) {
    const verifiedTripsCount = dailyTrips.filter((t) => t.status === 'Verified').length;
    const readyVehiclesCount = vehicles.filter((v) => v.availability === 'Available').length;

    return (
      <div className="space-y-6">
        {/* Assistant Gate Operations Banner */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Role: Transport Assistant (Gate &amp; Field Desk)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{today}</span>
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Gate Arrival, Log Book &amp; Route Attendance Desk
            </h2>
            <p className="text-xs text-slate-400">
              Authorized for daily bus boarding attendance, 24-hour vehicle odometer readings, driver fuel bills, and student transit discipline.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate('operations' as any, 'board')}
              className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Clock className="w-4 h-4" />
              <span>Mark Arrival / Departure</span>
            </button>
            <button
              onClick={() => onNavigate('vehicles' as any, 'odometer')}
              className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Bus className="w-4 h-4" />
              <span>Log 24-Hr Odometer</span>
            </button>
            <button
              onClick={() => onNavigate('operations' as any, 'pack')}
              className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Print Route List</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>
        </div>

        {/* Assistant 4-Card Field KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => onNavigate('operations' as any, 'board')}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Today&apos;s Gate Trips
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {verifiedTripsCount} / {dailyTrips.length}
              </span>
              <span className="text-xs text-slate-500">Trips Verified</span>
            </div>
            <div className="mt-2 text-xs text-amber-700 font-semibold flex items-center gap-1">
              <span>Open Arrival &amp; Departure Board</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          <div
            onClick={() => onNavigate('vehicles' as any, 'odometer')}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                24-Hr Vehicle Log Book
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Bus className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {readyVehiclesCount} / {vehicles.length}
              </span>
              <span className="text-xs text-slate-500">Vehicles Ready</span>
            </div>
            <div className="mt-2 text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <span>Record Start &amp; End Odometer</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          <div
            onClick={() => onNavigate('vehicles' as any, 'fuel')}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Driver Fuel &amp; Maintenance
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Wrench className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {maintenance.length}
              </span>
              <span className="text-xs text-slate-500">Work Orders</span>
            </div>
            <div className="mt-2 text-xs text-blue-700 font-semibold flex items-center gap-1">
              <span>Manage Fuel Bills &amp; Repairs</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          <div
            onClick={() => onNavigate('members' as any, 'discipline')}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Student Bus Discipline
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Gavel className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900">
                {disciplineRecords.length}
              </span>
              <span className="text-xs text-slate-500">Recorded Incidents</span>
            </div>
            <div className="mt-2 text-xs text-rose-700 font-semibold flex items-center gap-1">
              <span>Log Student Behaviour Concern</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* Assistant Middle Section: Daily Transit Attendance + Maintenance Work Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Today&apos;s Route Boarding &amp; Gate Status</h3>
                <p className="text-[11px] text-slate-500">Morning &amp; afternoon student boarding across active routes</p>
              </div>
              <button
                onClick={() => onNavigate('operations' as any, 'board')}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Open Gate Board &rarr;
              </button>
            </div>

            {dailyTrips.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No daily trips scheduled yet. Select a route in Arrival &amp; Departure to start marking attendance.
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {dailyTrips.slice(0, 6).map((t) => {
                  const cap = Math.max(1, t.rosterCount || 30);
                  const present = t.morningBoardingCount || t.presentCount || 0;
                  const pct = Math.min(100, Math.round((present / cap) * 100));
                  return (
                    <div key={t.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex justify-between font-bold mb-1">
                        <span className="text-slate-900">{t.routeName} — {t.vehicleNumber}</span>
                        <span className="font-mono text-emerald-700">{present}/{cap} Boarded ({t.status})</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assistant Maintenance Work Orders Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Reported Vehicle Work Orders ({maintenance.length})
                </h3>
              </div>
              <button
                onClick={() => setIsRaiseWoOpen(true)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Report Issue</span>
              </button>
            </div>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto flex-1">
              {maintenance.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No vehicle maintenance issues reported.
                </div>
              ) : (
                maintenance.slice(0, 6).map((wo) => (
                  <div key={wo.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-mono font-bold text-slate-900">
                        {wo.vehicleNumber} • <span className="text-slate-600">{wo.issueType}</span>
                      </div>
                      <p className="text-slate-600 mt-0.5">{wo.description || wo.issueDescription}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-[10px] shrink-0">
                      {wo.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* OVERDUE / PROMISED FEE DEPOSIT RECALL POPUP MODAL */}
      {overdueFollowUps.length > 0 && !dismissedPopup && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border-2 border-rose-300 overflow-hidden">
            <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                  <BellRing className="w-5 h-5 text-amber-300 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    Fee Deposit Promise Date Alert — Recall Required ({overdueFollowUps.length})
                  </h3>
                  <p className="text-xs text-rose-100">
                    Members listed below have reached or passed their promised fee deposit date without clearing dues.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDismissedPopup(true)}
                className="text-rose-200 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-96 overflow-y-auto divide-y divide-slate-100">
              {overdueFollowUps.map((f) => {
                const member = students.find((s) => s.id === f.memberId);
                return (
                  <div key={f.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setDismissedPopup(true);
                            if (onOpenMemberProfile) onOpenMemberProfile(f.memberId || f.studentId || '');
                          }}
                          className="font-bold text-slate-900 hover:text-blue-600 hover:underline text-sm cursor-pointer"
                        >
                          {f.memberName || f.studentName} ({f.admissionNo})
                        </button>
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[11px] font-bold">
                          Promised: {f.promisedDate || f.promiseDate}
                        </span>
                        {member && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[11px] font-bold">
                            Due: ₹{member.balanceDue.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">Spoke to:</span> {f.personTalkedTo || f.contactPerson} ({f.callDate || f.date}) — “{f.responseReceived || f.notes}”
                      </p>
                      {member && (
                        <p className="text-[11px] text-slate-500 font-mono">
                          Phone: {member.phone || member.mobile} | Stop: {member.morningStopName}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setDismissedPopup(true);
                          if (onOpenMemberProfile) onOpenMemberProfile(f.memberId || f.studentId || '');
                        }}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                        <span>Recall / Profile</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Click a member to record a new call follow-up or collect fees.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDismissedPopup(true);
                    onNavigate('fees', 'defaulters');
                  }}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Open Defaulters &amp; Follow-Ups
                </button>
                <button
                  onClick={() => setDismissedPopup(true)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Welcome & Today's Cash Desk Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
                isAdmin
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-sky-500/15 border-sky-500/30 text-sky-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {isAdmin
                  ? 'Role: Admin (Full Executive & Approval Authority)'
                  : 'Role: Transport Coordinator (Operations, Routing & Fee Desk)'}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Today: {today}</span>
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isAdmin ? 'Admin Executive Command Center' : 'Coordinator Operations & Collection Desk'}
          </h2>
          <p className="text-xs text-slate-400">
            {isAdmin
              ? 'Full access to financial ledgers, expense & work order approvals, payroll, and user access control.'
              : 'Manage student routes, fee receipts, fleet schedules, and submit work orders or suspensions for Admin approval.'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Today&apos;s Fee Collection
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
              ₹{todayReceipts.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Today&apos;s Approved Spend
            </div>
            <div className="text-lg font-bold font-mono text-rose-400 mt-1">
              ₹{todayExpenses.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 flex flex-col justify-center gap-2">
            <button
              onClick={() => onNavigate('fees', 'collect')}
              className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <IndianRupee className="w-4 h-4" />
              <span>Collect Fees</span>
            </button>
            {isAdmin ? (
              <button
                onClick={() => onNavigate('masters' as any, 'users')}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Users &amp; Passwords</span>
              </button>
            ) : (
              <button
                onClick={() => onNavigate('operations' as any, 'pack')}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Print Route List</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline Recall Banner if dismissed modal */}
      {overdueFollowUps.length > 0 && dismissedPopup && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <PhoneCall className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-rose-950">
                {overdueFollowUps.length} Promised Fee Deposit(s) Due / Overdue for Recall Today
              </h4>
              <p className="text-[11px] text-rose-700">
                {overdueFollowUps.map((f) => `${f.memberName} (Promised: ${f.promisedDate})`).join(' • ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissedPopup(false)}
            className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 cursor-pointer"
          >
            View Recall List
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('members' as any, 'directory')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Members
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {activeStudents}
            </span>
            <span className="text-xs text-slate-500">
              / {students.length} enrolled
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            {suspendedStudents > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-medium">
                <ShieldAlert className="w-3 h-3" />
                {suspendedStudents} Suspended
              </span>
            ) : (
              <span className="text-emerald-600 font-medium">All accounts in good standing</span>
            )}
          </div>
        </div>

        <div
          onClick={() => onNavigate('vehicles', 'directory')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Fleet &amp; Daily Trips
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Bus className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {vehicles.filter((v) => v.availability === 'Available').length} / {vehicles.length}
            </span>
            <span className="text-xs text-slate-500">Vehicles Ready</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <MapPin className="w-3.5 h-3.5 text-amber-500" />
            <span>
              {dailyTrips.filter((t) => t.status === 'Verified').length} of {dailyTrips.length} trips verified today
            </span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('fees', 'collect')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Fee Collection &amp; Dues
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              ₹{totalCollected.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-emerald-600 font-medium">Collected</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">Outstanding Receivables:</span>
            <span className="font-mono font-bold text-rose-600">
              ₹{totalDues.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('expenses', 'expenses')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Approved Operational Spend
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              ₹{totalExpenses.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-slate-500">Paid Expenses</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">Net Cash Position:</span>
            <span
              className={`font-mono font-bold ${
                totalCollected - totalExpenses >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              ₹{(totalCollected - totalExpenses).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          INCOME, EXPENSE, DUES AMOUNT & ATTENDANCE GRAPHS + UPCOMING VEHICLE RENEWALS
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Bar Graph: Income vs Expense vs Pending Dues */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Income, Expense &amp; Dues Graph</h3>
              <p className="text-[11px] text-slate-500">Live financial comparison across transport accounts</p>
            </div>
            <button
              onClick={() => onNavigate('accounts' as any, 'day_book')}
              className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              Day Book &rarr;
            </button>
          </div>

          {(() => {
            const maxVal = Math.max(1, totalCollected, totalExpenses, totalDues);
            const incPct = Math.min(100, Math.round((totalCollected / maxVal) * 100));
            const expPct = Math.min(100, Math.round((totalExpenses / maxVal) * 100));
            const duePct = Math.min(100, Math.round((totalDues / maxVal) * 100));
            return (
              <div className="space-y-3.5 pt-1 text-xs">
                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-emerald-700">Total Fee Income Collected</span>
                    <span className="font-mono text-emerald-700">₹{totalCollected.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${incPct}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-rose-700">Approved Operational Expense</span>
                    <span className="font-mono text-rose-700">₹{totalExpenses.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full transition-all" style={{ width: `${expPct}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-amber-700">Outstanding Member Dues</span>
                    <span className="font-mono text-amber-700">₹{totalDues.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${duePct}%` }} />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-semibold">Net Transport Surplus:</span>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{(totalCollected - totalExpenses).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Attendance & Route Boarding Graph */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Daily Transit Attendance Graph</h3>
              <p className="text-[11px] text-slate-500">Member boarding vs roster capacity across trips</p>
            </div>
            <button
              onClick={() => onNavigate('operations' as any, 'board')}
              className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
            >
              Attendance &rarr;
            </button>
          </div>

          <div className="space-y-3 pt-1 text-xs">
            {dailyTrips.slice(0, 4).map((t) => {
              const cap = Math.max(1, t.rosterCount || 30);
              const present = t.morningBoardingCount || t.rosterCount || 0;
              const pct = Math.min(100, Math.round((present / cap) * 100));
              return (
                <div key={t.id}>
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-slate-800 truncate">{t.routeName} ({t.vehicleNumber})</span>
                    <span className="font-mono text-slate-700">{present}/{cap} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-semibold">Active Transit Members:</span>
              <span className="font-mono font-bold text-emerald-700">{activeStudents} Active / {suspendedStudents} Suspended</span>
            </div>
          </div>
        </div>

        {/* Upcoming Vehicle Renewals (Fitness, Insurance, Pollution, Road Tax) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <FileWarning className="w-4 h-4 text-rose-600" />
                <span>Upcoming Vehicle Renewals</span>
              </h3>
              <p className="text-[11px] text-slate-500">Fitness, Insurance, PUC &amp; Tax validity schedule</p>
            </div>
            <button
              onClick={() => onNavigate('masters' as any, 'vehicles')}
              className="text-xs font-bold text-amber-700 hover:underline cursor-pointer"
            >
              Fleet Master &rarr;
            </button>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {vehicles.map((v) => {
              const daysUntil = (dStr: string) =>
                dStr ? Math.ceil((new Date(dStr).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 999;
              const minDays = Math.min(
                daysUntil(v.fitnessUpto),
                daysUntil(v.insuranceUpto),
                daysUntil(v.pollutionUpto),
                daysUntil(v.taxPaidUpto)
              );
              const isSoon = minDays <= 60;
              return (
                <div
                  key={v.id}
                  onClick={() => onNavigate('vehicles' as any, 'odometer')}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    isSoon
                      ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-50'
                      : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{v.registrationNumber} ({v.nickname})</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isSoon ? 'bg-rose-600 text-white' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {minDays <= 0 ? 'Expired' : `${minDays}d left`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-600 mt-1 font-mono">
                    <span>Fit: {v.fitnessUpto || '—'}</span>
                    <span>Ins: {v.insuranceUpto || '—'}</span>
                    <span>PUC: {v.pollutionUpto || '—'}</span>
                    <span>Tax: {v.taxPaidUpto || '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          MEMBER SUSPENSION REQUESTS AWAITING ADMIN APPROVAL
         ===================================================================== */}
      {students.some((s) => s.pendingSuspensionRequest?.status === 'Pending Approval') && (
        <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Member Suspension Requests — Awaiting Admin Approval (
                {students.filter((s) => s.pendingSuspensionRequest?.status === 'Pending Approval').length})
              </h3>
            </div>
            <button
              onClick={() => onNavigate('members' as any, 'Suspended')}
              className="text-xs font-bold text-rose-700 hover:underline cursor-pointer"
            >
              Open Suspended &amp; Permissions →
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {students
              .filter((s) => s.pendingSuspensionRequest?.status === 'Pending Approval')
              .map((s) => (
                <div
                  key={s.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => onOpenMemberProfile && onOpenMemberProfile(s.id)}
                        className="font-bold text-slate-900 hover:text-blue-600 hover:underline text-xs cursor-pointer"
                      >
                        {s.name} ({s.admissionNo})
                      </button>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        Class {s.class}-{s.section} • Route {s.routeCode}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[10px] font-bold">
                        Due: ₹{s.balanceDue.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="text-xs text-rose-900 font-semibold">
                      Valid Reason: “{s.pendingSuspensionRequest?.reason}”
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Initiated by <strong>{s.pendingSuspensionRequest?.requestedBy}</strong> on{' '}
                      {s.pendingSuspensionRequest?.requestedAt}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin && onReviewSuspensionRequest ? (
                      <>
                        <button
                          onClick={() => onReviewSuspensionRequest(s.id, 'Approve')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Suspension</span>
                        </button>
                        <button
                          onClick={() =>
                            onReviewSuspensionRequest(s.id, 'Reject', 'Suspension request declined by Admin')
                          }
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-bold">
                        Pending Admin Approval
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          WORK ORDERS & EXPENSE APPROVALS CENTER (VISIBLE ON ALL DASHBOARDS)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Maintenance Work Orders Card (Admin, Coordinator, Transport Assistant) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Maintenance Work Orders ({maintenance.length})
              </h3>
              {pendingWorkOrdersCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                  {pendingWorkOrdersCount} Pending
                </span>
              )}
              {approvedWorkOrdersCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                  {approvedWorkOrdersCount} Approved for Action
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRaiseWoOpen(true)}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-amber-400" />
                <span>Raise Work Order</span>
              </button>
              <button
                onClick={() => onNavigate('vehicles', 'maintenance')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                Open All
              </button>
            </div>
          </div>

          {/* Filter pills */}
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-1.5 text-[11px]">
            {(['all', 'Pending Approval', 'Approved', 'Completed', 'Rejected'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setWoStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                  woStatusFilter === st
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st === 'all' ? 'All Status' : st}
              </button>
            ))}
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto flex-1">
            {filteredDashboardWorkOrders.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No work orders in this status.
              </div>
            ) : (
              filteredDashboardWorkOrders.map((wo) => {
                const isPending = wo.status === 'Pending Approval' || wo.status === 'Open';
                const isApproved = wo.status === 'Approved' || wo.status === 'In Progress';
                return (
                  <div key={wo.id} className="px-5 py-3.5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">{wo.vehicleNumber}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {wo.issueType}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            wo.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-900'
                              : isApproved
                              ? 'bg-blue-100 text-blue-900'
                              : wo.status === 'Rejected'
                              ? 'bg-rose-100 text-rose-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {isApproved ? `${wo.status} — Ready for Action` : wo.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">{wo.description}</p>
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3">
                        <span>Raised by: <strong>{wo.reportedBy}</strong> ({wo.reportedDate})</span>
                        <span className="font-mono font-semibold text-slate-800">
                          Est: ₹{(wo.estimatedCost || 0).toLocaleString('en-IN')}
                        </span>
                        {wo.approvedBy && (
                          <span className="text-emerald-700 font-semibold">
                            By: {wo.approvedBy}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isAdmin && isPending && onUpdateMaintenanceStatus && (
                        <>
                          <button
                            onClick={() =>
                              onUpdateMaintenanceStatus(wo.id, {
                                status: 'Approved',
                                approvedBy: currentRoleName,
                              })
                            }
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() =>
                              onUpdateMaintenanceStatus(wo.id, {
                                status: 'Rejected',
                                approvedBy: currentRoleName,
                                rejectionReason: 'Rejected by Admin',
                              })
                            }
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Ban className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}

                      {isApproved && onUpdateMaintenanceStatus && (
                        <button
                          onClick={() =>
                            onUpdateMaintenanceStatus(wo.id, {
                              status: 'Completed',
                              actualCost: wo.actualCost || wo.estimatedCost,
                              completionDate: today,
                            })
                          }
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Mark Completed</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Expense Entries Approval Status Card (Admin, Coordinator, Transport Assistant) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Expense Approvals &amp; Payment Status ({approvalTrackedExpenses.length})
              </h3>
              {pendingExpensesCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                  {pendingExpensesCount} Pending Admin Approval
                </span>
              )}
            </div>
            <button
              onClick={() => onNavigate('expenses', 'expenses')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              Manage Expenses
            </button>
          </div>

          {/* Filter pills */}
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-1.5 text-[11px]">
            {(['all', 'Pending Approval', 'Approved', 'Rejected'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setExpApprovalFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                  expApprovalFilter === st
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st === 'all' ? 'All Tracked' : st}
              </button>
            ))}
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto flex-1">
            {filteredDashboardExpenses.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No expense entries matching this approval status.
              </div>
            ) : (
              filteredDashboardExpenses.map((exp) => {
                const status = exp.approvalStatus || 'Approved';
                return (
                  <div key={exp.id} className="px-5 py-3.5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">{exp.expenseNo}</span>
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 text-[10px] font-bold">
                          {exp.category}
                        </span>
                        {exp.vehicleNumber && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[10px] font-bold">
                            {exp.vehicleNumber}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-900'
                              : status === 'Rejected'
                              ? 'bg-rose-100 text-rose-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {status === 'Approved' ? 'Approved & Paid to Ledger' : status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">
                        <strong>{exp.vendorName}</strong> — {exp.narration}
                      </p>
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3">
                        <span className="font-mono font-bold text-slate-900">
                          ₹{exp.amount.toLocaleString('en-IN')} ({exp.paymentMode})
                        </span>
                        <span>Date: {exp.date}</span>
                        <span>By: {exp.recordedBy}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isAdmin && status === 'Pending Approval' && onUpdateExpenseApproval && (
                        <>
                          <button
                            onClick={() =>
                              onUpdateExpenseApproval(exp.id, {
                                approvalStatus: 'Approved',
                                approvedBy: currentRoleName,
                              })
                            }
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>Approve &amp; Pay</span>
                          </button>
                          <button
                            onClick={() =>
                              onUpdateExpenseApproval(exp.id, {
                                approvalStatus: 'Rejected',
                                approvedBy: currentRoleName,
                                rejectionReason: 'Rejected by Admin',
                              })
                            }
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Ban className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          TRANSIT BEHAVIOUR & DISCIPLINE LOG (LATEST 10 RECORDS) + FLEET ALERTS
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gavel className="w-4 h-4 text-rose-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Recent Transit Behaviour &amp; Discipline Records (Last 10)
                </h3>
              </div>
            </div>
            <button
              onClick={() => onNavigate('members' as any, 'discipline')}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1"
            >
              <span>More / Filter All</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 uppercase text-[10px] font-semibold">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3">Route / Vehicle</th>
                  <th className="py-2.5 px-3">Mischief / Concern</th>
                  <th className="py-2.5 px-4">Action Taken</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentDisciplineRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No transit behaviour or discipline issues recorded.
                    </td>
                  </tr>
                ) : (
                  recentDisciplineRecords.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">{d.date}</td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => {
                            if (onOpenMemberProfile) onOpenMemberProfile(d.memberId || d.studentId || '');
                          }}
                          className="font-bold text-slate-900 hover:text-blue-600 hover:underline text-left cursor-pointer"
                        >
                          {d.memberName || d.studentName}
                        </button>
                        <div className="text-[10px] text-slate-500">
                          {d.admissionNo} • Class {d.className}-{d.section}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        <div>{d.routeName || '—'}</div>
                        <div className="text-[10px] text-slate-400">{d.vehicleNumber || ''}</div>
                      </td>
                      <td className="py-2.5 px-3 text-rose-800 font-medium max-w-xs">
                        {d.concern}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium">
                          {d.actionTaken}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Statutory Alerts */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-rose-600" />
              <span>Statutory Renewals Due</span>
            </h3>
            <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-full bg-rose-50 text-rose-700">
              {expiringVehicles.length} Alerts
            </span>
          </div>
          {expiringVehicles.length === 0 ? (
            <p className="text-xs text-slate-500">All vehicles have valid statutory certificates.</p>
          ) : (
            <div className="space-y-2">
              {expiringVehicles.slice(0, 5).map((v) => (
                <div
                  key={v.id}
                  onClick={() => onNavigate('vehicles', 'directory')}
                  className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 flex items-center justify-between text-xs cursor-pointer hover:bg-rose-50"
                >
                  <div>
                    <div className="font-bold text-slate-900 font-mono">{v.registrationNumber}</div>
                    <div className="text-[11px] text-slate-600">
                      Fitness: {v.fitnessUpto} • PUC: {v.pollutionUpto}
                    </div>
                  </div>
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Raise Work Order Modal */}
      {isRaiseWoOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">Raise Maintenance Work Order</h3>
              </div>
              <button onClick={() => setIsRaiseWoOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickRaiseWo} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Vehicle *</label>
                <select
                  value={woVehicleId}
                  onChange={(e) => setWoVehicleId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold bg-white"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registrationNumber} — {v.nickname}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Issue Category</label>
                  <select
                    value={woIssueType}
                    onChange={(e) => setWoIssueType(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Mechanical">Mechanical</option>
                    <option value="Tyre/Battery">Tyre / Battery</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Body">Body / AC</option>
                    <option value="Routine Service">Routine Service</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={woPriority}
                    onChange={(e) => setWoPriority(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white font-bold"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Estimated Cost (₹)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={woEstCost}
                    onChange={(e) => setWoEstCost(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Workshop / Vendor</label>
                  <input
                    type="text"
                    placeholder="e.g. Prayagraj Auto"
                    value={woVendor}
                    onChange={(e) => setWoVendor(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Work Order Details *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe repair or maintenance needed..."
                  value={woDesc}
                  onChange={(e) => setWoDesc(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRaiseWoOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWo}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                >
                  {isSubmittingWo ? 'Submitting...' : isAdmin ? 'Create & Approve' : 'Submit for Admin Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavItemKey } from './components/Sidebar.js';
import { DashboardView } from './components/views/DashboardView.js';
import { MastersView } from './components/views/MastersView.js';
import { MembersView } from './components/views/MembersView.js';
import { VehiclesView } from './components/views/VehiclesView.js';
import { RoutesView } from './components/views/RoutesView.js';
import { DailyOperationsView } from './components/views/DailyOperationsView.js';
import { FeesView } from './components/views/FeesView.js';
import { ExpensesView } from './components/views/ExpensesView.js';
import { StaffView } from './components/views/StaffView.js';
import { ResumesView } from './components/views/ResumesView.js';
import { AccountsView } from './components/views/AccountsView.js';
import { ReportsView } from './components/views/ReportsView.js';
import { SetupView } from './components/views/SetupView.js';
import { LoginView } from './components/views/LoginView.js';
import { PublicWebsiteView } from './components/views/PublicWebsiteView.js';
import {
  api,
  ReportsSummary,
  SheetsStatus,
  subscribeToBootstrapUpdates,
  getLastMutationBootstrapAt,
} from './services/api.js';
import {
  SchoolConfig,
  CampusMaster,
  MemberTypeMaster,
  TripMaster,
  DesignationMaster,
  Village,
  TransportStop,
  Vehicle,
  Route,
  ScheduledService,
  StudentMember,
  Employee,
  CandidateResume,
  DailyTrip,
  TripAttendanceRecord,
  FeeInvoice,
  FeeReceipt,
  WarningLetter,
  ExpenseRecord,
  ExpenseHead,
  IncomeHead,
  IncomeRecord,
  OdometerLog,
  FuelAdvanceAndPurchase,
  MaintenanceRequest,
  AccountHead,
  JournalVoucher,
  DashboardSummary,
  FeeFollowUpRecord,
  DisciplineRecord,
  VehicleAssignmentRecord,
  StaffAttendanceRecord,
  StaffAttendanceStatus,
  StaffAdvanceRecord,
  StaffPayrollRecord,
  HolidayRecord,
  SystemUser,
  UserRole,
} from './types/index.js';
import { Bus, RefreshCw, AlertCircle, CheckCircle2, Shield, LogOut, KeyRound, UserCheck } from 'lucide-react';

const AUTH_STORAGE_KEY = 'tms_authenticated_user_v2';

export function App() {
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.username && parsed.role) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return null;
  });

  const [activeNav, setActiveNav] = useState<NavItemKey>('dashboard');
  const [activeSubTab, setActiveSubTab] = useState<string>('');
  const [unauthScreen, setUnauthScreen] = useState<'public_website' | 'transport_login'>('public_website');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const activeRole: UserRole = currentUser?.role || 'Admin';
  const isAdmin = activeRole === 'Admin';

  // Cross-view deep links
  const [externalOpenMemberId, setExternalOpenMemberId] = useState<string | null>(null);
  const [preselectedFeeMemberId, setPreselectedFeeMemberId] = useState<string | null>(null);

  // Core Masters & State
  const [config, setConfig] = useState<SchoolConfig>({
    schoolName: 'Narendra Edu Valley',
    tagline: 'The Future Begins Here..',
    academicYear: '2026-2027',
    currentAcademicSession: '2026-2027',
    address: 'Nayagaon , Chainpur , Siwan , Bihar -841203',
    phone: '+91 7050421421',
    email: 'narendra.eduvalley@gmail.com',
    lateFeePerDay: 10,
    autoSuspendAfterMonths: 2,
  });
  const [campuses, setCampuses] = useState<CampusMaster[]>([]);
  const [memberTypes, setMemberTypes] = useState<MemberTypeMaster[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [trips, setTrips] = useState<TripMaster[]>([]);
  const [designations, setDesignations] = useState<DesignationMaster[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [stops, setStops] = useState<TransportStop[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [services, setServices] = useState<ScheduledService[]>([]);

  // Operational Entities
  const [students, setStudents] = useState<StudentMember[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [resumes, setResumes] = useState<CandidateResume[]>([]);
  const [dailyTrips, setDailyTrips] = useState<DailyTrip[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<TripAttendanceRecord[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [receipts, setReceipts] = useState<FeeReceipt[]>([]);
  const [warningLetters, setWarningLetters] = useState<WarningLetter[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [expenseHeads, setExpenseHeads] = useState<ExpenseHead[]>([]);
  const [incomeHeads, setIncomeHeads] = useState<IncomeHead[]>([]);
  const [otherIncomes, setOtherIncomes] = useState<IncomeRecord[]>([]);
  const [odometerLogs, setOdometerLogs] = useState<OdometerLog[]>([]);
  const [fuelRecords, setFuelRecords] = useState<FuelAdvanceAndPurchase[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [accounts, setAccounts] = useState<AccountHead[]>([]);
  const [vouchers, setVouchers] = useState<JournalVoucher[]>([]);
  const [feeFollowUps, setFeeFollowUps] = useState<FeeFollowUpRecord[]>([]);
  const [disciplineRecords, setDisciplineRecords] = useState<DisciplineRecord[]>([]);
  const [vehicleAssignments, setVehicleAssignments] = useState<VehicleAssignmentRecord[]>([]);
  const [staffAttendance, setStaffAttendance] = useState<StaffAttendanceRecord[]>([]);
  const [staffAdvances, setStaffAdvances] = useState<StaffAdvanceRecord[]>([]);
  const [staffPayrolls, setStaffPayrolls] = useState<StaffPayrollRecord[]>([]);
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);

  // Analytics & Sync
  const [reportsSummary, setReportsSummary] = useState<ReportsSummary | null>(null);
  const [sheetsStatus, setSheetsStatus] = useState<SheetsStatus | null>(null);

  const applyBootstrapPayload = useCallback(
    (boot: any) => {
      if (!boot) return;
      const mastersData = boot?.masters;

      if (mastersData?.config) setConfig(mastersData.config);
      setCampuses(mastersData?.campuses || []);
      setMemberTypes(mastersData?.memberTypes || []);
      setClasses(mastersData?.classes || []);
      setSections(mastersData?.sections || []);
      setTrips(mastersData?.trips || []);
      setDesignations(mastersData?.designations || []);
      if (Array.isArray(mastersData?.users)) {
        setUsers(mastersData.users);
      }
      const vills: Village[] = mastersData?.villages || [];
      setVillages(vills);
      setStops(
        vills.flatMap((v) =>
          (v.stops || []).map((s) => ({ ...s, villageName: v.name }))
        )
      );
      setVehicles(mastersData?.vehicles || []);
      setRoutes(mastersData?.routes || []);
      setSheetsStatus(boot?.status || null);

      setStudents(boot?.students || []);
      setEmployees(boot?.employees || []);
      setResumes(boot?.resumes || []);
      const tripsList = boot?.trips || [];
      setDailyTrips(tripsList);
      setServices(boot?.services || []);
      setInvoices(boot?.invoices || []);
      setReceipts(boot?.receipts || []);
      setWarningLetters(boot?.warningLetters || []);
      setExpenses(boot?.expenses || []);
      setExpenseHeads(boot?.expenseHeads || []);
      setIncomeHeads(boot?.incomeHeads || []);
      setOtherIncomes(boot?.incomes || []);
      setOdometerLogs(boot?.odometerLogs || []);
      setFuelRecords(boot?.fuelAdvances || []);
      setMaintenance(boot?.maintenance || []);
      setAccounts(boot?.accounts || []);
      setVouchers(boot?.vouchers || []);
      setReportsSummary(boot?.reportsSummary || null);
      setFeeFollowUps(boot?.followUps || []);
      setDisciplineRecords(boot?.disciplineRecords || []);
      setVehicleAssignments(boot?.vehicleAssignments || []);
      setStaffAttendance(boot?.staffAttendance || []);
      setStaffAdvances(boot?.staffAdvances || []);
      setStaffPayrolls(boot?.staffPayrolls || []);
      setHolidays(boot?.holidays || []);

      if (tripsList && tripsList.length > 0) {
        const tripIdToLoad = selectedTripId || tripsList[0].id;
        setSelectedTripId(tripIdToLoad);
        if (Array.isArray(boot?.attendance)) {
          setAttendanceRecords(
            boot.attendance.filter((a: TripAttendanceRecord) => a.tripId === tripIdToLoad)
          );
        }
      }
    },
    [selectedTripId]
  );

  useEffect(() => {
    subscribeToBootstrapUpdates(applyBootstrapPayload);
    return () => subscribeToBootstrapUpdates(null);
  }, [applyBootstrapPayload]);

  const loadAllData = useCallback(async () => {
    // If state was already updated synchronously from a mutation envelope response within the last 4s,
    // skip a second HTTP round-trip that could hit a stale serverless container.
    if (getLastMutationBootstrapAt() > 0 && Date.now() - getLastMutationBootstrapAt() < 4000) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const boot = await api.getBootstrap(true);
      applyBootstrapPayload(boot);
    } catch (err: any) {
      setError(err.message || 'Failed to load application data');
    } finally {
      setLoading(false);
    }
  }, [applyBootstrapPayload]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleSelectTrip = async (tripId: string) => {
    setSelectedTripId(tripId);
    const att = await api.getTripAttendance(tripId);
    setAttendanceRecords(att || []);
  };

  const handleSelectRouteForDate = async (date: string, routeId: string) => {
    const res = await api.getOrCreateTripForRoute(date, routeId);
    setSelectedTripId(res.trip.id);
    setAttendanceRecords(res.attendance || []);
    await loadAllData();
  };

  // --- Authentication Handlers ---
  const handleLogin = async (username: string, password: string) => {
    const authenticatedUser = await api.login(username, password);
    setCurrentUser(authenticatedUser);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticatedUser));
    } catch {
      // ignore storage errors
    }
    setActiveNav('dashboard');
    setActiveSubTab('');
    await loadAllData();
  };

  const handleLogout = (goToWebsite = false) => {
    setCurrentUser(null);
    setUnauthScreen(goToWebsite ? 'public_website' : 'transport_login');
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    setActiveNav('dashboard');
    setActiveSubTab('');
  };

  // --- Navigation Handler with Sub-Tab & Role Authorization Guard ---
  const handleNavigate = (navKey: string, subTab?: string) => {
    let normalizedKey: NavItemKey =
      navKey === 'students'
        ? 'members'
        : navKey === 'daily_ops'
        ? 'operations'
        : navKey === 'sheets_sync'
        ? 'setup'
        : (navKey as NavItemKey);

    let targetSubTab = subTab !== undefined ? subTab : '';

    // Enforce role-based access boundaries:
    // 1. Neither Transport Coordinator nor Transport Assistant has rights to change Masters or Setup
    if (activeRole !== 'Admin' && (normalizedKey === 'masters' || normalizedKey === 'setup')) {
      normalizedKey = 'dashboard';
      targetSubTab = '';
    } else if (activeRole === 'Transport Assistant') {
      const allowedAssistantNavs: NavItemKey[] = [
        'dashboard',
        'members',
        'resumes',
        'staff',
        'operations',
        'fees',
        'expenses',
        'vehicles',
      ];
      if (!allowedAssistantNavs.includes(normalizedKey)) {
        normalizedKey = 'dashboard';
        targetSubTab = '';
      } else if (normalizedKey === 'staff') {
        targetSubTab = 'attendance';
      } else if (normalizedKey === 'expenses') {
        targetSubTab = 'expenses';
      } else if (normalizedKey === 'members' && !targetSubTab) {
        targetSubTab = 'all';
      }
    } else if (activeRole === 'Transport Coordinator') {
      if (normalizedKey === 'staff' && targetSubTab === 'payroll') {
        targetSubTab = 'employees';
      } else if (
        normalizedKey === 'accounts' &&
        (targetSubTab === 'vouchers' ||
          targetSubTab === 'trial_balance' ||
          targetSubTab === 'vehicle_ledger' ||
          targetSubTab === 'income')
      ) {
        targetSubTab = 'day_book';
      }
    }

    setActiveNav(normalizedKey);
    setActiveSubTab(targetSubTab);
  };

  const handleOpenMemberProfileFromAnywhere = (memberId: string) => {
    setExternalOpenMemberId(memberId);
    setActiveNav('members');
    setActiveSubTab('all');
  };

  const handleQuickCollectFeeForMember = (memberId: string) => {
    setPreselectedFeeMemberId(memberId);
    setActiveNav('fees');
    setActiveSubTab('collect');
  };

  // --- Masters Handlers ---
  const handleUpdateConfig = async (cfg: Partial<SchoolConfig>) => {
    const updated = await api.updateConfig(cfg);
    await loadAllData();
    if (updated) setConfig(updated);
  };

  const handleAddCampus = async (data: Partial<CampusMaster>) => {
    const updated = await api.addCampus(data);
    if (Array.isArray(updated)) setCampuses(updated);
    await loadAllData();
  };
  const handleUpdateCampus = async (id: string, data: Partial<CampusMaster>) => {
    const updated = await api.updateCampus(id, data);
    if (Array.isArray(updated)) setCampuses(updated);
    await loadAllData();
  };
  const handleRemoveCampus = async (id: string) => {
    const updated = await api.removeCampus(id);
    if (Array.isArray(updated)) setCampuses(updated);
    await loadAllData();
  };

  const handleAddMemberType = async (name: string) => {
    const updated = await api.addMemberType(name);
    if (Array.isArray(updated)) setMemberTypes(updated);
    await loadAllData();
  };
  const handleUpdateMemberType = async (id: string, name: string) => {
    const updated = await api.updateMemberType(id, name);
    if (Array.isArray(updated)) setMemberTypes(updated);
    await loadAllData();
  };
  const handleRemoveMemberType = async (id: string) => {
    const updated = await api.removeMemberType(id);
    if (Array.isArray(updated)) setMemberTypes(updated);
    await loadAllData();
  };

  const handleAddClass = async (name: string) => {
    const updated = await api.addClass(name);
    if (Array.isArray(updated)) setClasses(updated);
    await loadAllData();
  };
  const handleUpdateClass = async (oldName: string, newName: string) => {
    const updated = await api.updateClass(oldName, newName);
    if (Array.isArray(updated)) setClasses(updated);
    await loadAllData();
  };
  const handleRemoveClass = async (name: string) => {
    const updated = await api.removeClass(name);
    if (Array.isArray(updated)) setClasses(updated);
    await loadAllData();
  };
  const handleAddSection = async (name: string) => {
    const updated = await api.addSection(name);
    if (Array.isArray(updated)) setSections(updated);
    await loadAllData();
  };
  const handleUpdateSection = async (oldName: string, newName: string) => {
    const updated = await api.updateSection(oldName, newName);
    if (Array.isArray(updated)) setSections(updated);
    await loadAllData();
  };
  const handleRemoveSection = async (name: string) => {
    const updated = await api.removeSection(name);
    if (Array.isArray(updated)) setSections(updated);
    await loadAllData();
  };
  const handleAddTrip = async (trip: Partial<TripMaster>) => {
    const updated = await api.addTripMaster(trip);
    if (Array.isArray(updated)) setTrips(updated);
    await loadAllData();
  };
  const handleUpdateTrip = async (id: string, trip: Partial<TripMaster>) => {
    const updated = await api.updateTripMaster(id, trip);
    if (Array.isArray(updated)) setTrips(updated);
    await loadAllData();
  };
  const handleRemoveTrip = async (id: string) => {
    const updated = await api.removeTripMaster(id);
    if (Array.isArray(updated)) setTrips(updated);
    await loadAllData();
  };
  const handleSaveDesignation = async (des: Partial<DesignationMaster>) => {
    await api.saveDesignation(des);
    await loadAllData();
  };
  const handleRemoveDesignation = async (id: string) => {
    await api.removeDesignation(id);
    await loadAllData();
  };
  const handleSaveUser = async (userData: Partial<SystemUser>) => {
    const saved = await api.saveUser(userData);
    if (currentUser && saved.id === currentUser.id) {
      setCurrentUser(saved);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(saved));
      } catch {
        // ignore
      }
    }
    await loadAllData();
    return saved;
  };
  const handleDeleteUser = async (id: string) => {
    await api.deleteUser(id);
    await loadAllData();
  };
  const handleSaveVillage = async (data: Partial<Village>) => {
    await api.saveVillage(data);
    await loadAllData();
  };
  const handleDeleteVillage = async (id: string) => {
    await api.deleteVillage(id);
    await loadAllData();
  };
  const handleSaveVehicle = async (data: Partial<Vehicle>) => {
    await api.saveVehicle(data);
    await loadAllData();
  };
  const handleDeleteVehicle = async (id: string) => {
    await api.deleteVehicle(id);
    await loadAllData();
  };
  const handleSaveRoute = async (data: any) => {
    await api.saveRoute(data);
    await loadAllData();
  };
  const handleDeleteRoute = async (id: string) => {
    await api.deleteRoute(id);
    await loadAllData();
  };

  const handleSaveVehicleAssignment = async (data: Partial<VehicleAssignmentRecord>) => {
    await api.assignVehicleDriverHelper({
      vehicleId: data.vehicleId || '',
      driverId: data.driverId || '',
      helperId: data.helperId,
      fromDate: data.startDate || data.fromDate || new Date().toISOString().split('T')[0],
      toDate: data.endDate || data.toDate,
      remarks: data.remarks,
      assignedBy: activeRole,
    });
    await loadAllData();
  };

  // --- Member (Student/Staff) Handlers ---
  const handleSaveStudent = async (student: Partial<StudentMember>) => {
    await api.saveStudent(student);
    await loadAllData();
  };
  const handleDeleteStudent = async (id: string) => {
    await api.deleteStudent(id);
    await loadAllData();
  };
  const handleReactivateStudent = async (id: string, reason: string) => {
    await api.reactivateStudent(id, activeRole, reason);
    await loadAllData();
  };
  const handleGrantPermissionLetter = async (
    id: string,
    payload: {
      allowedUntilDate: string;
      letterAttachment: string;
      letterFileName?: string;
      approvedBy: string;
      reason: string;
    }
  ) => {
    await api.grantPermissionLetter(id, payload);
    await loadAllData();
  };
  const handleSuspendStudent = async (id: string, reason: string) => {
    await api.suspendStudent(id, reason, activeRole);
    await loadAllData();
  };
  const handleReviewSuspensionRequest = async (
    id: string,
    action: 'Approve' | 'Reject',
    reason?: string
  ) => {
    await api.reviewSuspensionRequest(id, action, activeRole, reason);
    await loadAllData();
  };
  const handleChangeMemberStatus = async (
    id: string,
    status: StudentMember['transportStatus'],
    reason?: string
  ) => {
    if (status === 'Suspended') {
      await api.suspendStudent(id, reason || 'Status changed from directory/profile', activeRole);
    } else if (status === 'Active') {
      const existing = students.find((s) => s.id === id);
      if (existing && existing.transportStatus === 'Suspended') {
        await api.reactivateStudent(id, activeRole, reason || 'Reactivated by user');
      } else if (existing) {
        await api.saveStudent({ ...existing, transportStatus: 'Active' });
      }
    } else {
      const existing = students.find((s) => s.id === id);
      if (existing) {
        await api.saveStudent({ ...existing, transportStatus: status });
      }
    }
    await loadAllData();
  };

  // --- Follow-Ups & Discipline Handlers ---
  const handleAddFeeFollowUp = async (data: Partial<FeeFollowUpRecord>) => {
    await api.addFollowUp(data);
    await loadAllData();
  };
  const handleDeleteFeeFollowUp = async (id: string) => {
    await api.deleteFollowUp(id);
    await loadAllData();
  };
  const handleAddDisciplineRecord = async (data: Partial<DisciplineRecord>) => {
    await api.saveDisciplineRecord(data);
    await loadAllData();
  };
  const handleDeleteDisciplineRecord = async (id: string) => {
    await api.deleteDisciplineRecord(id);
    await loadAllData();
  };

  // --- Employees & Resumes Handlers ---
  const handleSaveEmployee = async (data: Partial<Employee>) => {
    await api.saveEmployee(data);
    await loadAllData();
  };
  const handleDeleteEmployee = async (id: string) => {
    await api.deleteEmployee(id);
    await loadAllData();
  };
  const handleSaveResume = async (data: Partial<CandidateResume>) => {
    await api.saveResume(data);
    await loadAllData();
  };
  const handleDeleteResume = async (id: string) => {
    await api.deleteResume(id);
    await loadAllData();
  };
  const handleHireResume = async (
    resumeId: string,
    salaryOverride?: number,
    designationIdOverride?: string
  ) => {
    await api.hireResumeAsEmployee(resumeId, salaryOverride, designationIdOverride);
    await loadAllData();
  };
  const handleMarkStaffAttendance = async (
    employeeId: string,
    date: string,
    status: StaffAttendanceStatus,
    remarks?: string
  ) => {
    await api.markStaffAttendance({
      employeeId,
      date,
      status,
      remarks,
      markedBy: activeRole,
    });
    await loadAllData();
  };
  const handleDeclareHoliday = async (date: string, occasion: string, campus?: string) => {
    await api.addHoliday({ date, occasion, campus, declaredBy: activeRole });
    await loadAllData();
  };
  const handleRemoveHoliday = async (dateOrId: string) => {
    await api.deleteHoliday(dateOrId);
    await loadAllData();
  };
  const handleGiveStaffAdvance = async (data: Omit<StaffAdvanceRecord, 'id'>) => {
    await api.giveStaffAdvance(data);
    await loadAllData();
  };
  const handleFinalizePayroll = async (record: StaffPayrollRecord) => {
    await api.finalizeStaffPayroll(record);
    await loadAllData();
  };

  // --- Daily Operations & Attendance Handlers ---
  const handleMarkAttendance = async (
    recordId: string,
    source: 'driver' | 'assistant',
    value: string
  ) => {
    await api.markAttendance(recordId, source, value);
    await loadAllData();
  };

  const handleResolveMismatch = async (recordId: string, value: string, reason: string) => {
    await api.resolveAttendanceMismatch(recordId, value, activeRole, reason);
    await loadAllData();
  };

  const handleVerifyTrip = async (
    tripId: string,
    notes?: string,
    statusOverride?: 'Arrived' | 'Departed' | 'Completed',
    timingPayload?: { inTime?: string; outTime?: string; inStrength?: number; outStrength?: number }
  ) => {
    await api.verifyTrip(tripId, activeRole, notes, statusOverride, timingPayload);
    await loadAllData();
  };

  const handleCancelTrip = async (tripId: string, reason: string) => {
    await api.cancelTrip(tripId, reason, activeRole);
    await loadAllData();
  };

  const handleOpenPrintPack = async (
    routeId: string,
    shiftName: string,
    weekStartDate: string,
    weekEndDate?: string
  ) => {
    await api.getDriverRegisterPack(routeId, shiftName, weekStartDate, weekEndDate);
  };

  // --- Fees & Collection Handlers ---
  const handleRunBilling = async (month: string) => {
    const res = await api.runMonthlyBilling(month, activeRole);
    await loadAllData();
    return res;
  };

  const handleRecordReceipt = async (data: any) => {
    const res = await api.recordReceipt(data);
    await loadAllData();
    return res;
  };

  const handleIssueWarningLetter = async (data: Partial<WarningLetter>) => {
    const res = await api.issueWarningLetter(data);
    await loadAllData();
    return res;
  };

  const handleEvaluateSuspensions = async (threshold: number) => {
    const res = await api.evaluateSuspensions(threshold, activeRole);
    await loadAllData();
    return res;
  };

  // --- Expenses, Income & Fleet Logs Handlers ---
  const handleSaveExpenseHead = async (data: {
    id?: string;
    name: string;
    category?: string;
    requiresApproval?: boolean;
  }) => {
    const saved = await api.saveExpenseHead(data);
    await loadAllData();
    return saved;
  };
  const handleDeleteExpenseHead = async (id: string) => {
    await api.deleteExpenseHead(id);
    await loadAllData();
  };
  const handleAddExpense = async (data: Omit<ExpenseRecord, 'id' | 'expenseNo'>) => {
    await api.addExpense(data);
    await loadAllData();
  };
  const handleUpdateExpenseApproval = async (
    id: string,
    payload: {
      status?: 'Approved' | 'Rejected';
      approvalStatus?: 'Approved' | 'Rejected';
      approvedBy?: string;
      rejectionReason?: string;
    }
  ) => {
    const status = payload.status || payload.approvalStatus || 'Approved';
    await api.updateExpenseApproval(id, {
      status,
      approvedBy: payload.approvedBy || activeRole,
      rejectionReason: payload.rejectionReason,
    });
    await loadAllData();
  };
  const handleDeleteExpense = async (id: string) => {
    await api.deleteExpense(id);
    await loadAllData();
  };

  const handleSaveIncomeHead = async (data: Partial<IncomeHead>) => {
    const saved = await api.saveIncomeHead({ name: data.name || 'Other Income', category: data.category });
    await loadAllData();
    return saved;
  };
  const handleDeleteIncomeHead = async (id: string) => {
    await api.deleteIncomeHead(id);
    await loadAllData();
  };
  const handleAddOtherIncome = async (data: Omit<IncomeRecord, 'id' | 'incomeNo'>) => {
    const saved = await api.addIncome(data);
    await loadAllData();
    return saved;
  };
  const handleDeleteOtherIncome = async (id: string) => {
    await api.deleteIncome(id);
    await loadAllData();
  };

  const handleRecordOdometer = async (data: Omit<OdometerLog, 'id'>) => {
    await api.recordOdometer(data);
    await loadAllData();
  };
  const handleSettleFuelAdvance = async (data: any) => {
    await api.settleFuelAdvance(data);
    await loadAllData();
  };
  const handleAddMaintenance = async (data: any) => {
    await api.addMaintenance(data);
    await loadAllData();
  };
  const handleUpdateMaintenanceStatus = async (
    id: string,
    payload: {
      status: MaintenanceRequest['status'];
      approvedBy?: string;
      rejectionReason?: string;
      actualCost?: number;
      workDoneDetails?: string;
      invoiceNumber?: string;
      vendorName?: string;
    }
  ) => {
    await api.updateMaintenanceStatus(id, payload);
    await loadAllData();
  };

  // --- Accounts & Vouchers Handlers ---
  const handleCreateVoucher = async (data: any) => {
    await api.postVoucher(data);
    await loadAllData();
  };

  // Computed counts for sidebar & dashboard
  const suspendedCount = students.filter(
    (s) =>
      (s.transportStatus === 'Suspended' ||
        s.pendingSuspensionRequest?.status === 'Pending Approval') &&
      !s.activePermissionLetter
  ).length;
  const pendingSuspensionCount = students.filter(
    (s) => s.pendingSuspensionRequest?.status === 'Pending Approval' && !s.activePermissionLetter
  ).length;
  const pendingExpensesCount = expenses.filter((e) => e.approvalStatus === 'Pending Approval').length;
  const pendingMaintCount = maintenance.filter(
    (m) => m.status === 'Pending Approval' || m.status === 'Open'
  ).length;
  const pendingApprovalsCount = pendingExpensesCount + pendingMaintCount + pendingSuspensionCount;

  const dashboardSummary: DashboardSummary | null = reportsSummary
    ? {
        totalActiveMembers: reportsSummary.metrics.activeStudents,
        suspendedMembersCount: reportsSummary.metrics.suspendedStudents,
        totalVehicles: reportsSummary.metrics.totalVehicles,
        activeRoutesCount: routes.length,
        monthlyRevenueCollected: reportsSummary.metrics.totalCollected,
        totalPendingDues: reportsSummary.metrics.totalOutstanding,
        monthlyExpensesTotal: reportsSummary.metrics.totalExpensesAll,
        openMaintenanceCount: pendingMaintCount,
      }
    : null;

  // Render Public School Website or Transport Login View if not authenticated
  if (!currentUser) {
    if (unauthScreen === 'public_website') {
      return (
        <PublicWebsiteView
          config={config}
          campuses={campuses}
          routesCount={routes.length}
          vehiclesCount={vehicles.length}
          villagesCount={villages.length}
          onOpenTransportLogin={() => setUnauthScreen('transport_login')}
        />
      );
    }
    return (
      <LoginView
        config={config}
        onLogin={handleLogin}
        onBackToWebsite={() => setUnauthScreen('public_website')}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900 font-sans">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeKey={activeNav}
        activeSubTab={activeSubTab}
        onSelect={handleNavigate}
        currentRole={activeRole}
        suspendedCount={suspendedCount}
        resumesCount={resumes.length}
        pendingApprovalsCount={pendingApprovalsCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200/80 px-6 py-3.5 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 shadow-2xs print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold shadow-xs">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">
                  {config.schoolName}
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-amber-100 text-amber-900 rounded-md">
                  {config.currentAcademicSession || config.academicYear || '2026-2027'}
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                {config.tagline} {config.address ? `• ${config.address}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Signed-In User & Active Role Badge */}
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <UserCheck className="w-4 h-4 text-slate-700" />
              <div className="text-xs">
                <span className="font-bold text-slate-900">{currentUser.fullName}</span>
                <span className="text-slate-500 font-mono text-[11px] ml-1">(@{currentUser.username})</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  activeRole === 'Admin'
                    ? 'bg-amber-500 text-slate-950'
                    : activeRole === 'Transport Coordinator'
                    ? 'bg-sky-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {activeRole}
              </span>
            </div>

            {/* Admin Quick Button: Manage Users & Passwords */}
            {isAdmin && (
              <button
                onClick={() => handleNavigate('masters', 'users')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-amber-400 transition-colors cursor-pointer shadow-2xs"
                title="Create or Edit Usernames, Names & Passwords for Admin, Coordinator, and Assistant"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Users &amp; Passwords</span>
              </button>
            )}

            <button
              onClick={() => handleLogout(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition-colors cursor-pointer"
              title="Sign Out or Switch Role Account"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>Switch User / Logout</span>
            </button>
          </div>
        </header>

        {/* Main Workspace Container */}
        <main className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
              <RefreshCw className="w-7 h-7 animate-spin text-amber-500" />
              <p className="text-sm font-medium">Loading Transport ERP Modules...</p>
            </div>
          ) : (
            <>
              {activeNav === 'dashboard' && (
                <DashboardView
                  summary={dashboardSummary}
                  students={students}
                  vehicles={vehicles}
                  dailyTrips={dailyTrips}
                  feeReceipts={receipts}
                  expenses={expenses}
                  maintenance={maintenance}
                  feeFollowUps={feeFollowUps}
                  disciplineRecords={disciplineRecords}
                  isAdmin={isAdmin}
                  currentRoleName={activeRole}
                  onNavigate={handleNavigate as any}
                  onOpenMemberProfile={handleOpenMemberProfileFromAnywhere}
                  onUpdateExpenseApproval={handleUpdateExpenseApproval}
                  onUpdateMaintenanceStatus={handleUpdateMaintenanceStatus}
                  onAddMaintenance={handleAddMaintenance}
                  onReviewSuspensionRequest={handleReviewSuspensionRequest}
                />
              )}

              {activeNav === 'masters' && (
                <MastersView
                  config={config}
                  campuses={campuses}
                  memberTypes={memberTypes}
                  classes={classes}
                  sections={sections}
                  trips={trips}
                  designations={designations}
                  villages={villages}
                  vehicles={vehicles}
                  routes={routes}
                  employees={employees}
                  vehicleAssignments={vehicleAssignments}
                  onSaveVehicleAssignment={handleSaveVehicleAssignment}
                  users={users}
                  onSaveUser={handleSaveUser}
                  onDeleteUser={handleDeleteUser}
                  isAdmin={isAdmin}
                  initialSubTab={activeSubTab || undefined}
                  onUpdateConfig={handleUpdateConfig}
                  onAddCampus={handleAddCampus}
                  onUpdateCampus={handleUpdateCampus}
                  onRemoveCampus={handleRemoveCampus}
                  onAddMemberType={handleAddMemberType}
                  onUpdateMemberType={handleUpdateMemberType}
                  onRemoveMemberType={handleRemoveMemberType}
                  onAddClass={handleAddClass}
                  onUpdateClass={handleUpdateClass}
                  onRemoveClass={handleRemoveClass}
                  onAddSection={handleAddSection}
                  onUpdateSection={handleUpdateSection}
                  onRemoveSection={handleRemoveSection}
                  onAddTrip={handleAddTrip}
                  onUpdateTrip={handleUpdateTrip}
                  onRemoveTrip={handleRemoveTrip}
                  onSaveDesignation={handleSaveDesignation}
                  onRemoveDesignation={handleRemoveDesignation}
                  onSaveVillage={handleSaveVillage}
                  onDeleteVillage={handleDeleteVillage}
                  onSaveVehicle={handleSaveVehicle}
                  onDeleteVehicle={handleDeleteVehicle}
                  onSaveRoute={handleSaveRoute}
                  onDeleteRoute={handleDeleteRoute}
                />
              )}

              {activeNav === 'members' && (
                <MembersView
                  schoolName={config.schoolName}
                  isAdmin={isAdmin}
                  currentRole={activeRole}
                  students={students}
                  villages={villages}
                  routes={routes}
                  vehicles={vehicles}
                  campuses={campuses}
                  memberTypes={memberTypes}
                  classes={classes}
                  sections={sections}
                  invoices={invoices}
                  receipts={receipts}
                  attendanceRecords={attendanceRecords}
                  feeFollowUps={feeFollowUps}
                  disciplineRecords={disciplineRecords}
                  initialStatusFilter={
                    activeSubTab === 'Suspended' || activeSubTab === 'suspended'
                      ? 'Suspended'
                      : activeSubTab === 'discipline'
                      ? 'discipline'
                      : 'all'
                  }
                  externalOpenMemberId={externalOpenMemberId}
                  onClearExternalMemberId={() => setExternalOpenMemberId(null)}
                  onSaveStudent={handleSaveStudent}
                  onDeleteStudent={handleDeleteStudent}
                  onReactivateStudent={handleReactivateStudent}
                  onGrantPermissionLetter={handleGrantPermissionLetter}
                  onSuspendStudent={handleSuspendStudent}
                  onReviewSuspensionRequest={handleReviewSuspensionRequest}
                  onChangeMemberStatus={handleChangeMemberStatus}
                  onAddFeeFollowUp={handleAddFeeFollowUp as any}
                  onDeleteFeeFollowUp={handleDeleteFeeFollowUp}
                  onAddDisciplineRecord={handleAddDisciplineRecord as any}
                  onDeleteDisciplineRecord={handleDeleteDisciplineRecord}
                  onQuickCollectFeeForMember={handleQuickCollectFeeForMember}
                  onNavigateToMasters={() => handleNavigate('masters')}
                  onAddClass={handleAddClass}
                  onAddSection={handleAddSection}
                  onAddCampus={handleAddCampus}
                  onAddMemberType={handleAddMemberType}
                />
              )}

              {activeNav === 'resumes' && (
                <ResumesView
                  resumes={resumes}
                  designations={designations}
                  isAdmin={isAdmin}
                  onSaveResume={handleSaveResume}
                  onDeleteResume={isAdmin ? handleDeleteResume : undefined}
                  onHireResume={handleHireResume}
                  onNavigateToEmployees={() => handleNavigate('staff')}
                />
              )}

              {activeNav === 'staff' && (
                <StaffView
                  schoolName={config.schoolName}
                  isAdmin={activeRole === 'Admin'}
                  currentRole={activeRole}
                  campuses={campuses}
                  employees={employees}
                  designations={designations}
                  resumes={resumes}
                  staffAttendance={staffAttendance}
                  staffAdvances={staffAdvances}
                  staffPayrolls={staffPayrolls}
                  holidays={holidays}
                  initialSubTab={activeSubTab || undefined}
                  onSaveEmployee={handleSaveEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                  onSaveResume={handleSaveResume}
                  onDeleteResume={handleDeleteResume}
                  onHireResume={handleHireResume}
                  onMarkStaffAttendance={handleMarkStaffAttendance}
                  onDeclareHoliday={handleDeclareHoliday}
                  onRemoveHoliday={handleRemoveHoliday}
                  onGiveStaffAdvance={handleGiveStaffAdvance}
                  onFinalizePayroll={handleFinalizePayroll}
                  onNavigateToResumes={() => handleNavigate('resumes')}
                />
              )}

              {activeNav === 'routes' && (
                <RoutesView
                  schoolName={config.schoolName}
                  campuses={campuses}
                  routes={routes}
                  services={services}
                  villages={villages}
                  stops={stops}
                  vehicles={vehicles}
                  initialSubTab={activeSubTab || 'routes'}
                />
              )}

              {activeNav === 'vehicles' && (
                <VehiclesView
                  schoolName={config.schoolName}
                  currentRole={activeRole}
                  vehicles={vehicles}
                  odometerLogs={odometerLogs}
                  fuelAdvances={fuelRecords}
                  maintenanceRequests={maintenance}
                  expenses={expenses}
                  initialSubTab={activeSubTab || 'odometer'}
                  onRecordOdometer={handleRecordOdometer}
                  onSettleFuelAdvance={handleSettleFuelAdvance}
                  onAddMaintenance={handleAddMaintenance}
                  onUpdateMaintenanceStatus={handleUpdateMaintenanceStatus}
                />
              )}

              {activeNav === 'operations' && (
                <DailyOperationsView
                  schoolName={config.schoolName}
                  campuses={campuses}
                  vehicles={vehicles}
                  trips={dailyTrips}
                  attendanceRecords={attendanceRecords}
                  routes={routes}
                  students={students}
                  initialSubTab={activeSubTab || 'board'}
                  onSelectTrip={handleSelectTrip}
                  onSelectRouteForDate={handleSelectRouteForDate}
                  onMarkAttendance={handleMarkAttendance}
                  onResolveMismatch={handleResolveMismatch}
                  onVerifyTrip={handleVerifyTrip}
                  onCancelTrip={handleCancelTrip}
                  onOpenPrintPack={handleOpenPrintPack}
                />
              )}

              {activeNav === 'fees' && (
                <FeesView
                  schoolName={config.schoolName}
                  currentRole={activeRole}
                  classes={classes}
                  memberTypes={memberTypes}
                  invoices={invoices}
                  receipts={receipts}
                  followUps={feeFollowUps}
                  warningLetters={warningLetters}
                  students={students}
                  initialSubTab={activeSubTab || 'collect'}
                  preselectedStudentIdForCollect={preselectedFeeMemberId}
                  onClearPreselectedStudent={() => setPreselectedFeeMemberId(null)}
                  onRunBilling={handleRunBilling}
                  onRecordReceipt={handleRecordReceipt}
                  onAddFollowUp={handleAddFeeFollowUp}
                  onDeleteFollowUp={handleDeleteFeeFollowUp}
                  onIssueWarningLetter={handleIssueWarningLetter}
                  onEvaluateSuspensions={handleEvaluateSuspensions}
                  onSuspendStudent={handleSuspendStudent}
                  onPrintReceipt={() => window.print()}
                  onPrintWarningLetter={() => window.print()}
                  onOpenStudentProfile={(studentId) => handleOpenMemberProfileFromAnywhere(studentId)}
                />
              )}

              {activeNav === 'expenses' && (
                <ExpensesView
                  schoolName={config.schoolName}
                  isAdmin={isAdmin}
                  currentRole={activeRole}
                  initialTab={activeSubTab === 'expense_heads' ? 'expense_heads' : 'expenses'}
                  expenses={expenses}
                  expenseHeads={expenseHeads}
                  vehicles={vehicles}
                  onSaveExpenseHead={handleSaveExpenseHead}
                  onDeleteExpenseHead={handleDeleteExpenseHead}
                  onAddExpense={handleAddExpense}
                  onUpdateExpenseApproval={handleUpdateExpenseApproval}
                  onDeleteExpense={handleDeleteExpense}
                />
              )}

              {activeNav === 'accounts' && (
                <AccountsView
                  schoolName={config.schoolName}
                  isAdmin={isAdmin}
                  initialTab={
                    activeSubTab === 'income'
                      ? 'income'
                      : activeSubTab === 'vouchers'
                      ? 'vouchers'
                      : activeSubTab === 'vehicle_ledger'
                      ? 'vehicle_ledger'
                      : activeSubTab === 'student_ledger'
                      ? 'student_ledger'
                      : activeSubTab === 'trial_balance'
                      ? 'trial_balance'
                      : 'day_book'
                  }
                  accounts={accounts}
                  vouchers={vouchers}
                  vehicles={vehicles}
                  students={students}
                  invoices={invoices}
                  receipts={receipts}
                  expenses={expenses}
                  odometerLogs={odometerLogs}
                  incomeHeads={incomeHeads}
                  incomes={otherIncomes}
                  onSaveIncomeHead={handleSaveIncomeHead}
                  onDeleteIncomeHead={handleDeleteIncomeHead}
                  onAddIncome={handleAddOtherIncome}
                  onDeleteIncome={handleDeleteOtherIncome}
                  onCreateVoucher={handleCreateVoucher}
                />
              )}

              {activeNav === 'reports' && (
                <ReportsView
                  summary={reportsSummary}
                  students={students}
                  trips={dailyTrips}
                  vehicles={vehicles}
                />
              )}

              {activeNav === 'setup' && (
                <SetupView
                  config={config}
                  sheetsStatus={sheetsStatus}
                  onUpdateConfig={handleUpdateConfig}
                  onProvisionSheets={async () => {
                    const res = await api.provisionSheets();
                    await loadAllData();
                    return res;
                  }}
                  onSyncSheets={async () => {
                    const res = await api.syncSheets();
                    await loadAllData();
                    return res;
                  }}
                  onConfigureCredentials={async (creds) => {
                    const status = await api.configureCredentials(creds);
                    setSheetsStatus(status);
                    await loadAllData();
                    return status;
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

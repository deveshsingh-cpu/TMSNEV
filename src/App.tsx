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
  MemberLifecycleRequest,
  SessionMonthCode,
  AbsenteeCallRecord,
  MemberComplaintRecord,
} from './types/index.js';
import {
  Bus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Shield,
  LogOut,
  KeyRound,
  UserCheck,
  Smartphone,
  Download,
  Copy,
  Check,
  ExternalLink,
  X,
  QrCode,
} from 'lucide-react';

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

  const [activeNav, setActiveNav] = useState<NavItemKey>(() =>
    currentUser?.role === 'Attendance Incharge' ? 'operations' : 'dashboard'
  );
  const [activeSubTab, setActiveSubTab] = useState<string>(() =>
    currentUser?.role === 'Attendance Incharge' ? 'arrival' : ''
  );
  const [unauthScreen, setUnauthScreen] = useState<'public_website' | 'transport_login'>('public_website');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Android PWA / APK Installer State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() =>
    typeof window !== 'undefined' ? (window as any).__deferredPwaPrompt || null : null
  );
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('install') === 'apk';
  });
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsAppInstalled(isStandalone);

    if ((window as any).__deferredPwaPrompt) {
      setDeferredPrompt((window as any).__deferredPwaPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__deferredPwaPrompt = e;
      setDeferredPrompt(e);
    };
    const handleGlobalPromptReady = () => {
      if ((window as any).__deferredPwaPrompt) {
        setDeferredPrompt((window as any).__deferredPwaPrompt);
      }
    };
    const handleAppInstalled = () => {
      (window as any).__deferredPwaPrompt = null;
      setIsAppInstalled(true);
      setDeferredPrompt(null);
      setIsAndroidModalOpen(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-ready', handleGlobalPromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-app-installed', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-ready', handleGlobalPromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-app-installed', handleAppInstalled);
    };
  }, []);

  const handleInstallAndroidApp = async () => {
    const promptEvent = deferredPrompt || (window as any).__deferredPwaPrompt;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult?.outcome === 'accepted') {
          (window as any).__deferredPwaPrompt = null;
          setDeferredPrompt(null);
          setIsAndroidModalOpen(false);
        }
        return;
      } catch {
        // Fall through to modal if prompt failed
      }
    }
    setIsAndroidModalOpen(true);
  };

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
  const [memberRequests, setMemberRequests] = useState<MemberLifecycleRequest[]>([]);
  const [absenteeCalls, setAbsenteeCalls] = useState<AbsenteeCallRecord[]>([]);
  const [complaints, setComplaints] = useState<MemberComplaintRecord[]>([]);

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
      const rawVills: Village[] = mastersData?.villages || [];
      const vills: Village[] = [...rawVills]
        .map((v) => ({
          ...v,
          stops: [...(v.stops || [])].sort((a, b) =>
            String(a.name || '').trim().localeCompare(String(b.name || '').trim(), undefined, {
              sensitivity: 'base',
              numeric: true,
            })
          ),
        }))
        .sort((a, b) =>
          String(a.name || '').trim().localeCompare(String(b.name || '').trim(), undefined, {
            sensitivity: 'base',
            numeric: true,
          })
        );
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
      setMemberRequests(boot?.memberRequests || []);
      setAbsenteeCalls(boot?.absenteeCalls || []);
      setComplaints(boot?.complaints || []);

      if (Array.isArray(boot?.attendance)) {
        setAttendanceRecords(boot.attendance);
      }
      if (tripsList && tripsList.length > 0) {
        setSelectedTripId((prev) => prev || tripsList[0].id);
      }
    },
    []
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

  const handleSelectTrip = (tripId: string) => {
    setSelectedTripId(tripId);
  };

  const handleSelectRouteForDate = async (date: string, routeId: string) => {
    const res = await api.getOrCreateTripForRoute(date, routeId);
    setSelectedTripId(res.trip.id);
    if (Array.isArray(res.attendance) && res.attendance.length > 0) {
      setAttendanceRecords((prev) => {
        const byId = new Map(prev.map((r) => [r.id, r]));
        res.attendance.forEach((r: TripAttendanceRecord) => byId.set(r.id, r));
        return Array.from(byId.values());
      });
    }
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
    if (authenticatedUser.role === 'Attendance Incharge') {
      setActiveNav('operations');
      setActiveSubTab('arrival');
    } else {
      setActiveNav('dashboard');
      setActiveSubTab('');
    }
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
    // 0. Attendance Incharge is strictly restricted to Arrival Attendance, Departure Attendance, and Attendance Summary Sheet
    if (activeRole === 'Attendance Incharge') {
      normalizedKey = 'operations';
      if (targetSubTab !== 'arrival' && targetSubTab !== 'departure' && targetSubTab !== 'summary') {
        targetSubTab = 'arrival';
      }
      setActiveNav(normalizedKey);
      setActiveSubTab(targetSubTab);
      return;
    }

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
        'accounts',
      ];
      if (!allowedAssistantNavs.includes(normalizedKey)) {
        normalizedKey = 'dashboard';
        targetSubTab = '';
      } else if (normalizedKey === 'staff') {
        targetSubTab = 'attendance';
      } else if (normalizedKey === 'expenses') {
        targetSubTab = 'expenses';
      } else if (normalizedKey === 'accounts') {
        if (
          targetSubTab !== 'day_book' &&
          targetSubTab !== 'student_ledger' &&
          targetSubTab !== 'vehicle_ledger' &&
          targetSubTab !== 'trial_balance' &&
          targetSubTab !== 'route_outstanding' &&
          targetSubTab !== 'demand_slip'
        ) {
          targetSubTab = 'day_book';
        }
      } else if (normalizedKey === 'members' && !targetSubTab) {
        targetSubTab = 'all';
      }
    } else if (activeRole === 'Transport Coordinator') {
      if (normalizedKey === 'staff' && targetSubTab === 'payroll') {
        targetSubTab = 'employees';
      } else if (normalizedKey === 'accounts' && !targetSubTab) {
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
  const handleSaveVillage = async (
    data: Partial<Village> & { effectiveFromDate?: string; acknowledged?: boolean }
  ) => {
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

  // --- Absentee Calls & Complaints/Feedback Handlers ---
  const handleSaveAbsenteeCall = async (
    payload: Partial<AbsenteeCallRecord> & {
      callerRole?: UserRole;
      callerName?: string;
      clearExpectedReturn?: boolean;
    }
  ) => {
    const resolvedRole = payload.calledByRole || payload.callerRole || activeRole;
    const resolvedName =
      payload.calledByName ||
      payload.callerName ||
      payload.calledBy ||
      currentUser?.fullName ||
      resolvedRole;
    const res = await api.saveAbsenteeCall({
      ...payload,
      studentId: payload.studentId || '',
      date: payload.date || new Date().toISOString().split('T')[0],
      calledBy: resolvedName,
      calledByName: resolvedName,
      callerName: resolvedName,
      calledByRole: resolvedRole,
      callerRole: resolvedRole,
      consecutiveAbsentDays:
        payload.consecutiveAbsentDays ?? payload.consecutiveDaysAbsent ?? 1,
      consecutiveDaysAbsent:
        payload.consecutiveDaysAbsent ?? payload.consecutiveAbsentDays ?? 1,
    } as any);

    if (res && res.id) {
      setAbsenteeCalls((prev) => {
        const idx = prev.findIndex(
          (c) => c.id === res.id || (c.studentId === res.studentId && c.date === res.date)
        );
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = res;
          return copy;
        }
        return [res, ...prev];
      });
      setStudents((prev) =>
        prev.map((s) =>
          s.id === res.studentId
            ? {
                ...s,
                expectedReturnDate: payload.clearExpectedReturn
                  ? undefined
                  : res.expectedReturnDate ?? s.expectedReturnDate,
                expectedReturnReason: payload.clearExpectedReturn
                  ? undefined
                  : res.expectedReturnReason ?? s.expectedReturnReason,
                lastAbsentAssistantRemark:
                  res.assistantRemarks || s.lastAbsentAssistantRemark,
                lastAbsentCoordinatorRemark:
                  res.coordinatorRemarks || s.lastAbsentCoordinatorRemark,
              }
            : s
        )
      );
    }

    await loadAllData();
    return res;
  };

  const handleConfirmEarlyArrival = async (payload: {
    studentId: string;
    date: string;
    confirmedBy?: string;
    remarks?: string;
  }) => {
    const res = await api.confirmEarlyArrival({
      ...payload,
      confirmedBy: payload.confirmedBy || currentUser?.fullName || activeRole,
    });
    await loadAllData();
    return res;
  };

  const handleSaveComplaint = async (payload: Partial<MemberComplaintRecord>) => {
    const res = await api.saveComplaint({
      ...payload,
      loggedBy: payload.loggedBy || currentUser?.fullName || activeRole,
      loggedByRole: payload.loggedByRole || activeRole,
    });
    await loadAllData();
    return res;
  };

  const handleResolveComplaint = async (
    id: string,
    payload: {
      status?: 'Pending' | 'Resolved';
      actionTakenRemarks?: string;
      resolvedBy?: string;
      resolvedByRole?: UserRole;
    }
  ) => {
    const res = await api.resolveComplaint(id, {
      status: payload.status || 'Resolved',
      actionTaken: payload.actionTakenRemarks || (payload as { actionTaken?: string }).actionTaken || 'Resolved',
      resolvedBy: payload.resolvedBy || currentUser?.fullName || activeRole,
    });
    await loadAllData();
    return res;
  };

  const handleDeleteComplaint = async (id: string) => {
    await api.deleteComplaint(id);
    await loadAllData();
  };

  // --- Fees Setup & Member Lifecycle Requests Handlers ---
  const handleUpdateFeesSetup = async (payload: {
    attachedSessionMonths?: SessionMonthCode[];
    applyToAllStops?: boolean;
    stopId?: string;
    villageId?: string;
    transportName?: string;
    distanceRoute?: string;
    selectedMonths?: SessionMonthCode[];
    monthlyFee?: number;
    effectiveFromDate?: string;
    acknowledged?: boolean;
  }) => {
    const res = await api.updateFeesSetup({
      ...payload,
      applyMonthsToAllStops: payload.applyToAllStops,
    });
    await loadAllData();
    return res;
  };

  const handleCreateMemberRequest = async (payload: {
    requestType: 'ADD_MEMBER' | 'DROP_MEMBER' | 'SUSPEND_MEMBER';
    memberId?: string;
    memberData?: Partial<StudentMember>;
    memberPayload?: Partial<StudentMember>;
    reason?: string;
    requestReason?: string;
    effectiveDate?: string;
    leavingDate?: string;
    requestedBy?: string;
    requestedByRole?: UserRole;
  }) => {
    const res = await api.createMemberRequest({
      requestType: payload.requestType,
      memberId: payload.memberId,
      memberPayload: payload.memberPayload || payload.memberData,
      requestReason: payload.requestReason || payload.reason || 'Member lifecycle request',
      leavingDate: payload.leavingDate || payload.effectiveDate,
      requestedBy: payload.requestedBy || currentUser?.fullName || activeRole,
      requestedByRole: payload.requestedByRole || activeRole,
    });
    await loadAllData();
    return res;
  };

  const handleCoordinatorReviewMemberRequest = async (
    id: string,
    payload: {
      action: 'Approve' | 'Reject';
      remarks: string;
      reviewedBy?: string;
      coordinatorName?: string;
    }
  ) => {
    const res = await api.coordinatorReviewMemberRequest(id, {
      action: payload.action,
      remarks: payload.remarks,
      coordinatorName: payload.coordinatorName || payload.reviewedBy || currentUser?.fullName || 'Transport Coordinator',
    });
    await loadAllData();
    return res;
  };

  const handleAdminReviewMemberRequest = async (
    id: string,
    payload: {
      action: 'Approve' | 'Reject';
      remarks?: string;
      approvedBy?: string;
      adminName?: string;
    }
  ) => {
    const res = await api.adminReviewMemberRequest(id, {
      action: payload.action,
      remarks: payload.remarks,
      adminName: payload.adminName || payload.approvedBy || currentUser?.fullName || 'Admin',
    });
    await loadAllData();
    return res;
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
    value: string,
    reason?: string
  ) => {
    await api.markAttendance(recordId, source, value, reason, activeRole);
    await loadAllData();
  };

  const handleBatchSaveAttendance = async (
    entries: Array<{
      recordId: string;
      source: 'driver' | 'assistant';
      value: string;
      reason?: string;
    }>
  ) => {
    // Optimistically update attendanceRecords in local React state for instant UI feedback
    setAttendanceRecords((prev) => {
      const byId = new Map<string, TripAttendanceRecord>(prev.map((r) => [r.id, { ...r }]));
      for (const item of entries) {
        let rec = byId.get(item.recordId);
        if (!rec && item.recordId.startsWith('att-')) {
          const matchedStu = students.find((s) => item.recordId.endsWith(`-${s.id}`));
          if (matchedStu) {
            const tripIdPart = item.recordId.slice(4, item.recordId.length - matchedStu.id.length - 1);
            const datePart =
              tripIdPart.length >= 10
                ? tripIdPart.slice(-10)
                : new Date().toISOString().split('T')[0];
            rec = {
              id: item.recordId,
              tripId: tripIdPart,
              date: datePart,
              studentId: matchedStu.id,
              admissionNo: matchedStu.admissionNo,
              studentName: matchedStu.name,
              classSection: `${matchedStu.class}-${matchedStu.section}`,
              stopName: matchedStu.pickupDropStopName || matchedStu.villageName || '—',
              transportStatus: matchedStu.transportStatus,
              driverStatus: 'Pending',
              assistantStatus: 'Pending',
              reconciliationStatus: 'Assistant_Pending',
            };
          }
        }
        if (rec) {
          if (item.source === 'driver') {
            rec.driverStatus = item.value as any;
          } else {
            rec.assistantStatus = item.value as any;
          }
          if (item.reason !== undefined) {
            rec.resolutionReason = item.reason;
            rec.notes = item.reason;
          }
          const arr = rec.driverStatus || 'Pending';
          const dep = rec.assistantStatus || 'Pending';
          if (arr === 'Present' || dep === 'Present') {
            rec.resolvedStatus = 'Present';
          } else if (dep !== 'Pending') {
            rec.resolvedStatus = dep;
          } else if (arr !== 'Pending') {
            rec.resolvedStatus = arr;
          } else {
            rec.resolvedStatus = 'Pending';
          }
          byId.set(rec.id, rec);
        }
      }
      return Array.from(byId.values());
    });

    const updated = await api.batchSaveAttendance(entries, activeRole);
    if (Array.isArray(updated) && updated.length > 0) {
      setAttendanceRecords((prev) => {
        const byId = new Map(prev.map((r) => [r.id, r]));
        updated.forEach((r) => byId.set(r.id, r));
        return Array.from(byId.values());
      });
    }
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
    timingPayload?: {
      inTime?: string;
      outTime?: string;
      inStrength?: number;
      outStrength?: number;
      strengthMismatchRemark?: string;
    }
  ) => {
    const nowHHMM = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    // Optimistically update dailyTrips immediately in 0ms so Arrival/Departure Time is marked right away
    setDailyTrips((prev) => {
      const next = [...prev];
      const existingIdx = next.findIndex((t) => t.id === tripId);
      if (existingIdx >= 0) {
        const cur = { ...next[existingIdx] };
        if (statusOverride) cur.status = statusOverride;
        if (notes !== undefined) cur.notes = notes;
        if (timingPayload?.inTime !== undefined) cur.inTime = timingPayload.inTime;
        else if (statusOverride === 'Arrived' && !cur.inTime) cur.inTime = nowHHMM;
        if (timingPayload?.outTime !== undefined) cur.outTime = timingPayload.outTime;
        else if (statusOverride === 'Departed' && !cur.outTime) cur.outTime = nowHHMM;
        if (timingPayload?.inStrength !== undefined) cur.inStrength = timingPayload.inStrength;
        if (timingPayload?.outStrength !== undefined) cur.outStrength = timingPayload.outStrength;
        if (timingPayload?.strengthMismatchRemark !== undefined) {
          cur.strengthMismatchRemark = timingPayload.strengthMismatchRemark;
        }
        next[existingIdx] = cur;
        return next;
      }
      if (tripId.startsWith('dt-') && tripId.length > 14) {
        const datePart = tripId.slice(-10);
        const routeIdPart = tripId.slice(3, -11);
        const route = routes.find((r) => r.id === routeIdPart || r.code === routeIdPart);
        if (route) {
          const veh = vehicles.find(
            (v) => v.id === route.vehicleId || v.registrationNumber === route.vehicleNumber
          );
          next.push({
            id: `dt-${route.id}-${datePart}`,
            date: datePart,
            campus: route.campus,
            routeId: route.id,
            routeName: route.code,
            vehicleId: route.vehicleId,
            vehicleNumber: route.vehicleNumber,
            driverName: veh?.assignedDriverName || 'Assigned Driver',
            helperName: veh?.assignedHelperName,
            tripNumber: route.tripNumber,
            shiftName: `Trip ${route.tripNumber} — ${route.name || route.code}`,
            status: statusOverride || 'Arrived',
            rosterCount: 0,
            presentCount: 0,
            absentCount: 0,
            mismatchCount: 0,
            plannedStartTime: '06:40 AM',
            plannedEndTime: '07:30 AM',
            inTime:
              timingPayload?.inTime !== undefined
                ? timingPayload.inTime
                : statusOverride === 'Arrived'
                ? nowHHMM
                : undefined,
            outTime:
              timingPayload?.outTime !== undefined
                ? timingPayload.outTime
                : statusOverride === 'Departed'
                ? nowHHMM
                : undefined,
            inStrength: timingPayload?.inStrength,
            outStrength: timingPayload?.outStrength,
            strengthMismatchRemark: timingPayload?.strengthMismatchRemark,
            notes,
            verifiedBy: activeRole,
            verifiedAt: new Date().toISOString(),
          });
        }
      }
      return next;
    });

    const verified = await api.verifyTrip(tripId, activeRole, notes, statusOverride, timingPayload);
    if (verified && verified.id) {
      setDailyTrips((prev) => {
        const idx = prev.findIndex((t) => t.id === verified.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = verified;
          return copy;
        }
        return [...prev, verified];
      });
    }
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
    if (res && res.id) {
      setReceipts((prev) => (prev.some((r) => r.id === res.id) ? prev : [res, ...prev]));
      if (res.studentId && res.balanceDueAfter !== undefined) {
        setStudents((prev) =>
          prev.map((s) =>
            s.id === res.studentId ? { ...s, balanceDue: Number(res.balanceDueAfter) } : s
          )
        );
      }
    }
    await loadAllData();
    return res;
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    // Optimistically remove receipt from UI list immediately so screen refreshes without delay
    setReceipts((prev) => prev.filter((r) => r.id !== receiptId && r.receiptNo !== receiptId));
    const res = await api.deleteReceipt(receiptId);
    setReceipts((prev) => prev.filter((r) => r.id !== receiptId && r.receiptNo !== receiptId));
    if (res && res.studentId && res.updatedBalanceDue !== undefined) {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === res.studentId ? { ...s, balanceDue: Number(res.updatedBalanceDue) } : s
        )
      );
    }
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
  const pendingMemberReqCount = memberRequests.filter(
    (r) => r.status === 'Pending Coordinator Approval' || r.status === 'Pending Admin Approval'
  ).length;
  const pendingApprovalsCount =
    pendingExpensesCount + pendingMaintCount + pendingSuspensionCount + pendingMemberReqCount;

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

  const androidInstallerModal = isAndroidModalOpen ? (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Install Android App Directly to Phone</h3>
              <p className="text-xs text-slate-300">
                Narendra Edu Valley Transit ERP • Standalone Android Package (WebAPK)
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAndroidModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto text-xs text-slate-700">
          {/* Option 1: Direct .APK File Download + 1-Tap Phone Install */}
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider mb-1">
                  Direct Android APK File Download &amp; Phone Installer
                </span>
                <h4 className="text-sm font-bold text-slate-900">
                  Download `Narendra-Edu-Valley-Transport.apk` Directly to Phone / Computer
                </h4>
                <p className="text-slate-600 mt-0.5">
                  Click below to directly download the `.apk` file or install the standalone Android app straight into your phone&apos;s app drawer.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href="/api/download-apk"
                download="Narendra-Edu-Valley-Transport.apk"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer text-center"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Download .APK File Directly</span>
              </a>

              {deferredPrompt ? (
                <button
                  type="button"
                  onClick={handleInstallAndroidApp}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>1-Tap Direct Phone Install</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const promptEvent = (window as any).__deferredPwaPrompt;
                    if (promptEvent) {
                      setDeferredPrompt(promptEvent);
                      promptEvent.prompt();
                      return;
                    }
                    const link = document.createElement('a');
                    link.href = '/api/download-apk';
                    link.download = 'Narendra-Edu-Valley-Transport.apk';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>Install Directly on Android</span>
                </button>
              )}
            </div>

            <div className="bg-white/90 rounded-lg p-3 border border-emerald-200 text-slate-700 space-y-1.5">
              <p className="font-bold text-slate-900">
                How to Open / Install on Android Phone:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-slate-700">
                <li>
                  Tap <strong>&quot;Download .APK File Directly&quot;</strong> above to download <code className="font-mono font-bold">Narendra-Edu-Valley-Transport.apk</code> directly to your device, or tap <strong>1-Tap Direct Phone Install</strong>.
                </li>
                <li>
                  In Chrome on Android, you can also tap the <strong>⋮ (Three Dots Menu)</strong> at the top-right and select <strong>&quot;Install app&quot;</strong> to install the full-screen app directly into your phone&apos;s app drawer.
                </li>
              </ol>
            </div>
          </div>

          {/* Shareable App URL + QR Code for Android Phones */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
            <div className="bg-white p-2 rounded-xl border border-slate-200 shrink-0">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                  `${window.location.origin}/api/download-apk`
                )}`}
                alt="Scan QR to download Android APK"
                className="w-28 h-28 rounded-lg"
              />
            </div>
            <div className="flex-1 space-y-2 w-full">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                <QrCode className="w-4 h-4 text-slate-700" />
                <span>Scan QR Code or Copy Direct .APK Download Link</span>
              </div>
              <p className="text-slate-600">
                Scan with your Android camera or share this direct `.apk` download link on WhatsApp:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/api/download-apk`}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-[11px] text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/api/download-apk`);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2500);
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={() => setIsAndroidModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // Render Public School Website or Transport Login View if not authenticated
  if (!currentUser) {
    if (unauthScreen === 'public_website') {
      return (
        <>
          <PublicWebsiteView
            config={config}
            campuses={campuses}
            routesCount={routes.length}
            vehiclesCount={vehicles.length}
            villagesCount={villages.length}
            onOpenTransportLogin={() => setUnauthScreen('transport_login')}
            onInstallAndroidApk={handleInstallAndroidApp}
            isAppInstalled={isAppInstalled}
          />
          {androidInstallerModal}
        </>
      );
    }
    return (
      <>
        <LoginView
          config={config}
          onLogin={handleLogin}
          onBackToWebsite={() => setUnauthScreen('public_website')}
          onInstallAndroidApk={handleInstallAndroidApp}
          isAppInstalled={isAppInstalled}
        />
        {androidInstallerModal}
      </>
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
        <header className="bg-white border-b border-slate-200/80 px-3 py-2.5 sm:px-6 sm:py-3.5 sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2.5 sm:gap-4 shadow-2xs print:hidden">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Bus className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  {config.schoolName}
                </h1>
                <span className="px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-semibold bg-amber-100 text-amber-900 rounded-md">
                  {config.currentAcademicSession || config.academicYear || '2026-2027'}
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                {config.tagline} {config.address ? `• ${config.address}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Signed-In User & Active Role Badge */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200">
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700" />
              <div className="text-xs">
                <span className="font-bold text-slate-900">{currentUser.fullName}</span>
                <span className="text-slate-500 font-mono text-[11px] ml-1 hidden md:inline">(@{currentUser.username})</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  activeRole === 'Admin'
                    ? 'bg-amber-500 text-slate-950'
                    : activeRole === 'Transport Coordinator'
                    ? 'bg-sky-600 text-white'
                    : activeRole === 'Attendance Incharge'
                    ? 'bg-violet-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {activeRole}
              </span>
              {currentUser.campus && currentUser.campus !== 'All Campuses' && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Campus: {currentUser.campus}
                </span>
              )}
            </div>

            {/* Android App / APK Installer Button */}
            <button
              onClick={handleInstallAndroidApp}
              className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-2xs"
              title="Install Android App Directly to Phone (WebAPK)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isAppInstalled ? 'Android App Active' : 'Download Android APK'}</span>
            </button>

            {/* Admin Quick Button: Manage Users & Passwords */}
            {isAdmin && (
              <button
                onClick={() => handleNavigate('masters', 'users')}
                className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-amber-400 transition-colors cursor-pointer shadow-2xs"
                title="Create or Edit Usernames, Names & Passwords for Admin, Coordinator, and Assistant"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Users &amp; Passwords</span>
              </button>
            )}

            <button
              onClick={() => handleLogout(false)}
              className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition-colors cursor-pointer"
              title="Sign Out or Switch Role Account"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">Switch User /</span>
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Main Workspace Container */}
        <main className="flex-1 p-3 sm:p-6 max-w-[1600px] w-full mx-auto">
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
                  routes={routes}
                  dailyTrips={dailyTrips}
                  attendanceRecords={attendanceRecords}
                  memberRequests={memberRequests}
                  absenteeCalls={absenteeCalls}
                  complaints={complaints}
                  feeReceipts={receipts}
                  expenses={expenses}
                  maintenance={maintenance}
                  feeFollowUps={feeFollowUps}
                  disciplineRecords={disciplineRecords}
                  isAdmin={isAdmin}
                  currentRoleName={activeRole}
                  userCampus={currentUser?.campus}
                  onNavigate={handleNavigate as any}
                  onOpenMemberProfile={handleOpenMemberProfileFromAnywhere}
                  onUpdateExpenseApproval={handleUpdateExpenseApproval}
                  onUpdateMaintenanceStatus={handleUpdateMaintenanceStatus}
                  onAddMaintenance={handleAddMaintenance}
                  onReviewSuspensionRequest={handleReviewSuspensionRequest}
                  onCoordinatorReviewMemberRequest={handleCoordinatorReviewMemberRequest}
                  onAdminReviewMemberRequest={handleAdminReviewMemberRequest}
                  onResolveComplaint={handleResolveComplaint}
                  onSaveAbsenteeCall={handleSaveAbsenteeCall}
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
                  students={students}
                  employees={employees}
                  vehicleAssignments={vehicleAssignments}
                  onSaveVehicleAssignment={handleSaveVehicleAssignment}
                  users={users}
                  onSaveUser={handleSaveUser}
                  onDeleteUser={handleDeleteUser}
                  isAdmin={isAdmin}
                  currentRole={activeRole}
                  initialSubTab={activeSubTab || undefined}
                  onUpdateConfig={handleUpdateConfig}
                  onUpdateFeesSetup={handleUpdateFeesSetup}
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
                  userCampus={currentUser?.campus}
                  students={students}
                  employees={employees}
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
                  complaints={complaints}
                  memberRequests={memberRequests}
                  onCreateMemberRequest={handleCreateMemberRequest}
                  onCoordinatorReviewMemberRequest={handleCoordinatorReviewMemberRequest}
                  onAdminReviewMemberRequest={handleAdminReviewMemberRequest}
                  onSaveComplaint={handleSaveComplaint}
                  onResolveComplaint={handleResolveComplaint}
                  onDeleteComplaint={handleDeleteComplaint}
                  initialStatusFilter={
                    activeSubTab === 'Suspended' || activeSubTab === 'suspended'
                      ? 'Suspended'
                      : activeSubTab === 'discipline'
                      ? 'discipline'
                      : activeSubTab === 'requests'
                      ? 'requests'
                      : activeSubTab === 'complaints'
                      ? 'complaints'
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
                  students={students}
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
                  isAdmin={isAdmin}
                  currentRole={activeRole}
                  userCampus={currentUser?.campus}
                  campuses={campuses}
                  vehicles={vehicles}
                  trips={dailyTrips}
                  attendanceRecords={attendanceRecords}
                  absenteeCalls={absenteeCalls}
                  routes={routes}
                  students={students}
                  initialSubTab={activeSubTab || 'board'}
                  onSelectTrip={handleSelectTrip}
                  onSelectRouteForDate={handleSelectRouteForDate}
                  onMarkAttendance={handleMarkAttendance}
                  onBatchSaveAttendance={handleBatchSaveAttendance}
                  onResolveMismatch={handleResolveMismatch}
                  onVerifyTrip={handleVerifyTrip}
                  onCancelTrip={handleCancelTrip}
                  onOpenPrintPack={handleOpenPrintPack}
                  onSaveAbsenteeCall={handleSaveAbsenteeCall}
                  onConfirmEarlyArrival={handleConfirmEarlyArrival}
                />
              )}

              {activeNav === 'fees' && (
                <FeesView
                  schoolName={config.schoolName}
                  currentRole={activeRole}
                  userCampus={currentUser?.campus}
                  campuses={campuses}
                  classes={classes}
                  sections={sections}
                  routes={routes}
                  vehicles={vehicles}
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
                  onDeleteReceipt={handleDeleteReceipt}
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
                  userCampus={currentUser?.campus}
                  routes={routes}
                  students={students}
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
                  currentRole={activeRole}
                  userCampus={currentUser?.campus}
                  campuses={campuses}
                  classes={classes}
                  sections={sections}
                  routes={routes}
                  followUps={feeFollowUps}
                  onAddFollowUp={handleAddFeeFollowUp}
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
                  onTabChange={(tab) => setActiveSubTab(tab)}
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
                  onDeleteExpense={handleDeleteExpense}
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

      {/* Android App (WebAPK) & Standalone APK Installer Modal */}
      {androidInstallerModal}
    </div>
  );
}

export default App;

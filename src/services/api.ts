import { 
  StudentMember, Village, Route, TransportStop,
  DailyTrip, TripAttendanceRecord, Vehicle, OdometerLog, FuelAdvanceAndPurchase,
  MaintenanceRequest, Employee, FeeInvoice, FeeReceipt, FollowUpRecord,
  WarningLetter, AccountHead, JournalVoucher, SchoolConfig, DriverRegisterWeekPack,
  ExpenseRecord, DesignationMaster, TripMaster, CampusMaster, MemberTypeMaster, CandidateResume,
  VehicleAssignmentRecord, DisciplineRecord, ExpenseHead, IncomeHead, IncomeRecord,
  StaffAttendanceRecord, StaffAttendanceStatus, StaffAdvanceRecord, StaffPayrollRecord, HolidayRecord,
  SystemUser
} from '../types/index.js';

export interface SheetsTabInfo {
  title: string;
  headersCount: number;
  rowCount: number;
}

export interface SheetsStatus {
  isConfigured: boolean;
  isConnected: boolean;
  sheetId: string;
  clientEmail: string;
  projectId: string;
  mode: string;
  lastSyncAt: string | null;
  cellUsageEstimate: number;
  totalTabs: number;
  tabList?: SheetsTabInfo[];
  lastError: string | null;
  activeWriterQueueLength: number;
}

export interface ReportsSummary {
  metrics: {
    totalStudents: number;
    activeStudents: number;
    suspendedStudents: number;
    needsSetupStudents: number;
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    totalVehicles: number;
    availableVehicles: number;
    totalTripsToday: number;
    tripsArrived: number;
    tripsPending: number;
    mismatchesCount: number;
    totalFuelSpend: number;
    totalRepairsSpend: number;
    totalExpensesAll: number;
    unsettledAdvances: number;
  };
  accountsOverview: AccountHead[];
}

export interface MastersData {
  config: SchoolConfig;
  campuses: CampusMaster[];
  memberTypes: MemberTypeMaster[];
  classes: string[];
  sections: string[];
  trips: TripMaster[];
  designations: DesignationMaster[];
  villages: Village[];
  vehicles: Vehicle[];
  routes: Route[];
  users?: SystemUser[];
}

let bootstrapUpdateListener: ((boot: any) => void) | null = null;
let lastMutationBootstrapAt = 0;

export function subscribeToBootstrapUpdates(listener: ((boot: any) => void) | null) {
  bootstrapUpdateListener = listener;
}

export function getLastMutationBootstrapAt(): number {
  return lastMutationBootstrapAt;
}

function unwrapMutationEnvelope(data: any): any {
  if (data && typeof data === 'object' && data.__erpEnvelope === true) {
    if (data.bootstrap && bootstrapUpdateListener) {
      lastMutationBootstrapAt = Date.now();
      bootstrapUpdateListener(data.bootstrap);
    }
    return data.result;
  }
  return data;
}

const nativeFetch = globalThis.fetch.bind(globalThis);

async function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  let nextInit = init;
  if (method !== 'GET') {
    const headers = new Headers(init?.headers || {});
    headers.set('X-ERP-Include-Bootstrap', '1');
    nextInit = { ...init, headers };
  }
  const res = await nativeFetch(input, nextInit);
  const origJson = res.json.bind(res);
  res.json = async () => {
    const parsed = await origJson();
    return unwrapMutationEnvelope(parsed);
  };
  return res;
}

async function parseApiJson(res: Response, fallbackError: string) {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (res.status === 413 || text.startsWith('Request En')) {
      throw new Error('Uploaded photo or document is too large. Please re-select the photo so it compresses automatically.');
    }
    throw new Error(
      res.status === 404
        ? 'Backend API route (/api/*) not found on server. Please ensure the latest code is pushed to GitHub & redeployed on Vercel.'
        : `${fallbackError} (HTTP ${res.status})`
    );
  }
  if (!res.ok) {
    throw new Error(data?.error || fallbackError);
  }
  return unwrapMutationEnvelope(data);
}

export const api = {
  // Unified Single-Request Bootstrap
  getBootstrap: async (fresh = true): Promise<any> => {
    const res = await fetch(`/api/bootstrap?fresh=${fresh ? '1' : '0'}&_t=${Date.now()}`, {
      cache: 'no-store',
    });
    return parseApiJson(res, 'Failed to load application data');
  },

  // Authentication & System Users
  login: async (username: string, password: string): Promise<SystemUser> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return parseApiJson(res, 'Authentication failed');
  },
  getUsers: async (): Promise<SystemUser[]> => {
    const res = await fetch('/api/users');
    return parseApiJson(res, 'Failed to fetch users');
  },
  saveUser: async (user: Partial<SystemUser>): Promise<SystemUser> => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    return parseApiJson(res, 'Failed to save user account');
  },
  deleteUser: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    return parseApiJson(res, 'Failed to delete user account');
  },

  // Status & Sheets
  getStatus: async (): Promise<SheetsStatus> => {
    const res = await fetch('/api/status');
    return parseApiJson(res, 'Failed to fetch status');
  },
  provisionSheets: async () => {
    const res = await fetch('/api/sheets/provision', { method: 'POST' });
    return parseApiJson(res, 'Failed to provision sheets');
  },
  syncSheets: async () => {
    const res = await fetch('/api/sheets/sync', { method: 'POST' });
    return parseApiJson(res, 'Failed to sync sheets');
  },
  configureCredentials: async (creds: {
    sheetId?: string;
    clientEmail?: string;
    projectId?: string;
    privateKey: string;
  }): Promise<SheetsStatus> => {
    const res = await fetch('/api/sheets/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
    return parseApiJson(res, 'Failed to configure Google Sheets credentials');
  },

  // Config & Branding
  getConfig: async (): Promise<SchoolConfig> => {
    const res = await fetch('/api/config');
    return parseApiJson(res, 'Failed to load config');
  },
  updateConfig: async (cfg: Partial<SchoolConfig>): Promise<SchoolConfig> => {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    return parseApiJson(res, 'Failed to update institute configuration');
  },

  // Masters Aggregator
  getMasters: async (): Promise<MastersData> => {
    const res = await fetch('/api/masters');
    return parseApiJson(res, 'Failed to load masters');
  },

  // Masters: Campuses
  addCampus: async (data: Partial<CampusMaster>): Promise<CampusMaster[]> => {
    const res = await fetch('/api/masters/campuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseApiJson(res, 'Failed to add campus');
  },
  updateCampus: async (id: string, data: Partial<CampusMaster>): Promise<CampusMaster[]> => {
    const res = await fetch(`/api/masters/campuses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseApiJson(res, 'Failed to update campus');
  },
  removeCampus: async (id: string): Promise<CampusMaster[]> => {
    const res = await fetch(`/api/masters/campuses/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return parseApiJson(res, 'Cannot delete campus: linked dependencies exist.');
  },

  // Masters: Member Types
  addMemberType: async (name: string): Promise<MemberTypeMaster[]> => {
    const res = await fetch('/api/masters/member-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return parseApiJson(res, 'Failed to add member type');
  },
  updateMemberType: async (id: string, name: string): Promise<MemberTypeMaster[]> => {
    const res = await fetch(`/api/masters/member-types/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return parseApiJson(res, 'Failed to update member type');
  },
  removeMemberType: async (id: string): Promise<MemberTypeMaster[]> => {
    const res = await fetch(`/api/masters/member-types/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return parseApiJson(res, 'Cannot delete member type: linked dependencies exist.');
  },

  // Masters: Classes & Sections
  addClass: async (name: string): Promise<string[]> => {
    const res = await fetch('/api/masters/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return parseApiJson(res, 'Failed to add class');
  },
  updateClass: async (oldName: string, newName: string): Promise<string[]> => {
    const res = await fetch('/api/masters/classes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldName, newName }),
    });
    return parseApiJson(res, 'Failed to update class');
  },
  removeClass: async (name: string): Promise<string[]> => {
    const res = await fetch(`/api/masters/classes/${encodeURIComponent(name)}`, { method: 'DELETE' });
    return parseApiJson(res, 'Cannot delete class: linked dependencies exist.');
  },

  addSection: async (name: string): Promise<string[]> => {
    const res = await fetch('/api/masters/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return parseApiJson(res, 'Failed to add section');
  },
  updateSection: async (oldName: string, newName: string): Promise<string[]> => {
    const res = await fetch('/api/masters/sections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldName, newName }),
    });
    return parseApiJson(res, 'Failed to update section');
  },
  removeSection: async (name: string): Promise<string[]> => {
    const res = await fetch(`/api/masters/sections/${encodeURIComponent(name)}`, { method: 'DELETE' });
    return parseApiJson(res, 'Cannot delete section: linked dependencies exist.');
  },

  // Masters: Trips (1, 2, 3...)
  addTripMaster: async (data: Partial<TripMaster>): Promise<TripMaster[]> => {
    const res = await fetch('/api/masters/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseApiJson(res, 'Failed to add trip');
  },
  updateTripMaster: async (id: string, data: Partial<TripMaster>): Promise<TripMaster[]> => {
    const res = await fetch(`/api/masters/trips/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseApiJson(res, 'Failed to update trip');
  },
  removeTripMaster: async (id: string): Promise<TripMaster[]> => {
    const res = await fetch(`/api/masters/trips/${id}`, { method: 'DELETE' });
    return parseApiJson(res, 'Cannot delete trip: linked dependencies exist.');
  },

  // Masters: Designations & Permissions
  saveDesignation: async (data: Partial<DesignationMaster>): Promise<DesignationMaster> => {
    const res = await fetch('/api/masters/designations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseApiJson(res, 'Failed to save designation');
  },
  removeDesignation: async (id: string): Promise<DesignationMaster[]> => {
    const res = await fetch(`/api/masters/designations/${id}`, { method: 'DELETE' });
    return parseApiJson(res, 'Cannot delete designation: linked dependencies exist.');
  },

  // Masters: Villages & Transport Stops
  getVillages: async (): Promise<Village[]> => {
    const res = await fetch('/api/villages');
    return parseApiJson(res, 'Failed to fetch villages');
  },
  getStops: async (): Promise<TransportStop[]> => {
    const res = await fetch('/api/villages');
    const villages: Village[] = await parseApiJson(res, 'Failed to fetch stops');
    return villages.flatMap(v => v.stops.map(s => ({ ...s, villageName: v.name })));
  },
  saveVillage: async (data: Partial<Village>): Promise<Village> => {
    const res = await fetch('/api/masters/villages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseApiJson(res, 'Failed to save village');
  },
  deleteVillage: async (id: string) => {
    const res = await fetch(`/api/masters/villages/${id}`, { method: 'DELETE' });
    return parseApiJson(res, 'Cannot delete village: linked dependencies exist.');
  },

  // Masters: Vehicles
  getVehicles: async (): Promise<Vehicle[]> => {
    const res = await fetch('/api/vehicles');
    return parseApiJson(res, 'Failed to fetch vehicles');
  },
  saveVehicle: async (data: Partial<Vehicle>): Promise<Vehicle> => {
    const res = await fetch('/api/masters/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseApiJson(res, 'Failed to save vehicle');
  },
  deleteVehicle: async (id: string) => {
    const res = await fetch(`/api/masters/vehicles/${id}`, { method: 'DELETE' });
    return parseApiJson(res, 'Cannot delete vehicle: linked dependencies exist.');
  },

  // Masters: Routes (Nomenclature: Campus/VehicleLast4/Trip e.g. Sr/7175/1)
  getRoutes: async (): Promise<Route[]> => {
    const res = await fetch('/api/routes');
    return parseApiJson(res, 'Failed to fetch routes');
  },
  saveRoute: async (data: any): Promise<Route> => {
    const res = await fetch('/api/masters/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseApiJson(res, 'Failed to save route');
  },
  deleteRoute: async (id: string) => {
    const res = await fetch(`/api/masters/routes/${id}`, { method: 'DELETE' });
    return parseApiJson(res, 'Cannot delete route: linked dependencies exist.');
  },

  // Members (Students & Staff)
  getStudents: async (params?: { campus?: string; status?: string; query?: string }): Promise<StudentMember[]> => {
    const sp = new URLSearchParams();
    if (params?.campus) sp.set('campus', params.campus);
    if (params?.status) sp.set('status', params.status);
    if (params?.query) sp.set('query', params.query);
    const res = await fetch(`/api/students?${sp.toString()}`);
    return parseApiJson(res, 'Failed to fetch members');
  },
  saveStudent: async (data: Partial<StudentMember>): Promise<StudentMember> => {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseApiJson(res, 'Failed to save member');
  },
  deleteStudent: async (id: string) => {
    const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
    return parseApiJson(res, 'Failed to delete member');
  },
  reactivateStudent: async (id: string, authorizedBy: string, reason: string): Promise<StudentMember> => {
    const res = await fetch(`/api/students/${id}/reactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorizedBy, reason }),
    });
    return parseApiJson(res, 'Failed to reactivate member');
  },
  grantPermissionLetter: async (
    id: string,
    payload: {
      allowedUntilDate: string;
      letterAttachment: string;
      letterFileName?: string;
      approvedBy: string;
      reason: string;
    }
  ): Promise<StudentMember> => {
    const res = await fetch(`/api/students/${id}/permission-letter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiJson(res, 'Failed to grant permission letter');
  },
  suspendStudent: async (id: string, reason: string, authorizedBy: string): Promise<StudentMember> => {
    const res = await fetch(`/api/students/${id}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, authorizedBy }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to suspend member');
    }
    return res.json();
  },
  reviewSuspensionRequest: async (
    id: string,
    action: 'Approve' | 'Reject',
    reviewedBy: string,
    rejectionReason?: string
  ): Promise<StudentMember> => {
    const res = await fetch(`/api/students/${id}/suspension-approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reviewedBy, rejectionReason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to review suspension request');
    }
    return res.json();
  },

  // Candidate Resumes & Employees
  getResumes: async (): Promise<CandidateResume[]> => {
    const res = await fetch('/api/resumes');
    return res.json();
  },
  saveResume: async (data: Partial<CandidateResume>): Promise<CandidateResume> => {
    const res = await fetch('/api/resumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save candidate resume');
    }
    return res.json();
  },
  deleteResume: async (id: string) => {
    const res = await fetch(`/api/resumes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete resume');
    }
    return res.json();
  },
  hireResumeAsEmployee: async (id: string, salaryOverride?: number, designationIdOverride?: string): Promise<Employee> => {
    const res = await fetch(`/api/resumes/${id}/hire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salaryOverride, designationIdOverride }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to onboard candidate into Employees');
    }
    return res.json();
  },

  getEmployees: async (): Promise<Employee[]> => {
    const res = await fetch('/api/employees');
    return res.json();
  },
  saveEmployee: async (data: Partial<Employee>): Promise<Employee> => {
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save employee');
    }
    return res.json();
  },
  deleteEmployee: async (id: string) => {
    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Cannot delete employee: linked dependencies exist.');
    }
    return res.json();
  },

  // Staff Attendance, Holidays, Advances & Payroll
  getStaffAttendance: async (date?: string, month?: string): Promise<StaffAttendanceRecord[]> => {
    const sp = new URLSearchParams();
    if (date) sp.set('date', date);
    if (month) sp.set('month', month);
    const res = await fetch(`/api/staff-attendance?${sp.toString()}`);
    return res.json();
  },
  markStaffAttendance: async (data: {
    employeeId: string;
    date: string;
    status: StaffAttendanceStatus;
    remarks?: string;
    markedBy?: string;
  }): Promise<StaffAttendanceRecord> => {
    const res = await fetch('/api/staff-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to mark staff attendance');
    }
    return res.json();
  },
  getHolidays: async (): Promise<HolidayRecord[]> => {
    const res = await fetch('/api/holidays');
    return res.json();
  },
  addHoliday: async (data: Partial<HolidayRecord>): Promise<HolidayRecord> => {
    const res = await fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to declare holiday');
    }
    return res.json();
  },
  deleteHoliday: async (idOrDate: string) => {
    const res = await fetch(`/api/holidays/${encodeURIComponent(idOrDate)}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to remove holiday');
    }
    return res.json();
  },
  getStaffAdvances: async (): Promise<StaffAdvanceRecord[]> => {
    const res = await fetch('/api/staff-advances');
    return res.json();
  },
  giveStaffAdvance: async (data: Partial<StaffAdvanceRecord>): Promise<StaffAdvanceRecord> => {
    const res = await fetch('/api/staff-advances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to give staff advance');
    }
    return res.json();
  },
  getStaffPayrolls: async (month?: string): Promise<StaffPayrollRecord[]> => {
    const sp = new URLSearchParams();
    if (month) sp.set('month', month);
    const res = await fetch(`/api/staff-payrolls?${sp.toString()}`);
    return res.json();
  },
  finalizeStaffPayroll: async (data: Partial<StaffPayrollRecord>): Promise<StaffPayrollRecord> => {
    const res = await fetch('/api/staff-payrolls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to finalize staff payroll');
    }
    return res.json();
  },

  // 24-Hour Daily Log Book (No shift needed)
  getOdometerLogs: async (vehicleId?: string): Promise<OdometerLog[]> => {
    const sp = vehicleId ? `?vehicleId=${vehicleId}` : '';
    const res = await fetch(`/api/odometer${sp}`);
    return res.json();
  },
  recordOdometer: async (data: Omit<OdometerLog, 'id'>): Promise<OdometerLog> => {
    const res = await fetch('/api/odometer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record logbook entry');
    }
    return res.json();
  },

  // Expenses & Fuel
  getExpenses: async (params?: { vehicleNumber?: string; category?: string }): Promise<ExpenseRecord[]> => {
    const sp = new URLSearchParams();
    if (params?.vehicleNumber) sp.set('vehicleNumber', params.vehicleNumber);
    if (params?.category) sp.set('category', params.category);
    const res = await fetch(`/api/expenses?${sp.toString()}`);
    return res.json();
  },
  addExpense: async (data: Omit<ExpenseRecord, 'id' | 'expenseNo'>): Promise<ExpenseRecord> => {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add expense');
    }
    return res.json();
  },
  deleteExpense: async (id: string) => {
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete expense');
    }
    return res.json();
  },
  updateExpenseApproval: async (
    id: string,
    payload: { status: 'Approved' | 'Rejected'; approvedBy?: string; rejectionReason?: string }
  ): Promise<ExpenseRecord> => {
    const res = await fetch(`/api/expenses/${id}/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update expense approval');
    }
    return res.json();
  },

  // Dynamic Expense Heads & Income Heads & Incomes
  getExpenseHeads: async (): Promise<ExpenseHead[]> => {
    const res = await fetch('/api/expense-heads');
    return res.json();
  },
  saveExpenseHead: async (data: { id?: string; name: string; category?: string; requiresApproval?: boolean }): Promise<ExpenseHead> => {
    const res = await fetch('/api/expense-heads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save expense head');
    }
    return res.json();
  },
  deleteExpenseHead: async (id: string) => {
    const res = await fetch(`/api/expense-heads/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Cannot delete expense head');
    }
    return res.json();
  },

  getIncomeHeads: async (): Promise<IncomeHead[]> => {
    const res = await fetch('/api/income-heads');
    return res.json();
  },
  saveIncomeHead: async (data: { name: string; category?: string }): Promise<IncomeHead> => {
    const res = await fetch('/api/income-heads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save income head');
    }
    return res.json();
  },
  deleteIncomeHead: async (id: string) => {
    const res = await fetch(`/api/income-heads/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Cannot delete income head');
    }
    return res.json();
  },

  getIncomes: async (): Promise<IncomeRecord[]> => {
    const res = await fetch('/api/incomes');
    return res.json();
  },
  addIncome: async (data: Omit<IncomeRecord, 'id' | 'incomeNo'>): Promise<IncomeRecord> => {
    const res = await fetch('/api/incomes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save income entry');
    }
    return res.json();
  },
  deleteIncome: async (id: string) => {
    const res = await fetch(`/api/incomes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete income');
    }
    return res.json();
  },

  // Vehicle-Driver-Helper Assignments & Date History
  getVehicleAssignments: async (): Promise<VehicleAssignmentRecord[]> => {
    const res = await fetch('/api/vehicle-assignments');
    return res.json();
  },
  assignVehicleDriverHelper: async (payload: {
    vehicleId: string;
    driverId: string;
    helperId?: string;
    fromDate: string;
    toDate?: string;
    remarks?: string;
    assignedBy?: string;
  }): Promise<VehicleAssignmentRecord> => {
    const res = await fetch('/api/vehicle-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save vehicle driver/helper assignment');
    }
    return res.json();
  },

  // Behaviour & Discipline Records
  getDisciplineRecords: async (): Promise<DisciplineRecord[]> => {
    const res = await fetch('/api/discipline');
    return res.json();
  },
  saveDisciplineRecord: async (data: Partial<DisciplineRecord>): Promise<DisciplineRecord> => {
    const res = await fetch('/api/discipline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save discipline record');
    }
    return res.json();
  },
  deleteDisciplineRecord: async (id: string) => {
    const res = await fetch(`/api/discipline/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete discipline record');
    }
    return res.json();
  },

  // Fuel Advances & Maintenance
  getServices: async (): Promise<any[]> => {
    const res = await fetch('/api/services');
    return res.json();
  },
  getFuelAdvances: async (): Promise<FuelAdvanceAndPurchase[]> => {
    const res = await fetch('/api/fuel-advances');
    return res.json();
  },
  settleFuelAdvance: async (data: any): Promise<FuelAdvanceAndPurchase> => {
    const res = await fetch('/api/fuel-advances/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to settle fuel advance');
    }
    return res.json();
  },
  getMaintenance: async (): Promise<MaintenanceRequest[]> => {
    const res = await fetch('/api/maintenance');
    return res.json();
  },
  addMaintenance: async (data: any): Promise<MaintenanceRequest> => {
    const res = await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add maintenance request');
    }
    return res.json();
  },
  updateMaintenanceStatus: async (
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
  ): Promise<MaintenanceRequest> => {
    const res = await fetch(`/api/maintenance/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update work order status');
    }
    return res.json();
  },

  // Accounts & Vouchers
  getAccounts: async (): Promise<AccountHead[]> => {
    const res = await fetch('/api/accounts');
    return res.json();
  },
  getVouchers: async (): Promise<JournalVoucher[]> => {
    const res = await fetch('/api/vouchers');
    return res.json();
  },
  postVoucher: async (data: any): Promise<JournalVoucher> => {
    const res = await fetch('/api/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to post voucher');
    }
    return res.json();
  },

  // Fees & Receipts
  getInvoices: async (month?: string): Promise<FeeInvoice[]> => {
    const sp = month ? `?month=${month}` : '';
    const res = await fetch(`/api/invoices${sp}`);
    return res.json();
  },
  runMonthlyBilling: async (month: string, runBy: string) => {
    const res = await fetch('/api/billing/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, runBy }),
    });
    return res.json();
  },
  getReceipts: async (): Promise<FeeReceipt[]> => {
    const res = await fetch('/api/receipts');
    return res.json();
  },
  recordReceipt: async (data: any) => {
    const res = await fetch('/api/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save receipt');
    }
    return res.json();
  },
  getFollowUps: async (): Promise<FollowUpRecord[]> => {
    const res = await fetch('/api/follow-ups');
    return res.json();
  },
  addFollowUp: async (data: Partial<FollowUpRecord>): Promise<FollowUpRecord> => {
    const res = await fetch('/api/follow-ups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save follow-up');
    }
    return res.json();
  },
  deleteFollowUp: async (id: string) => {
    const res = await fetch(`/api/follow-ups/${id}`, { method: 'DELETE' });
    return res.json();
  },
  getWarningLetters: async (): Promise<WarningLetter[]> => {
    const res = await fetch('/api/warning-letters');
    return res.json();
  },
  issueWarningLetter: async (data: Partial<WarningLetter>): Promise<WarningLetter> => {
    const res = await fetch('/api/warning-letters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to issue warning letter');
    }
    return res.json();
  },
  evaluateSuspensions: async (thresholdAmount: number, triggeredBy: string) => {
    const res = await fetch('/api/recovery/evaluate-suspensions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thresholdAmount, triggeredBy }),
    });
    return res.json();
  },

  // Operations
  getTrips: async (date?: string, campus?: string): Promise<DailyTrip[]> => {
    const sp = new URLSearchParams();
    if (date) sp.set('date', date);
    if (campus) sp.set('campus', campus);
    const res = await fetch(`/api/trips?${sp.toString()}`);
    return res.json();
  },
  getOrCreateTripForRoute: async (date: string, routeId: string): Promise<{ trip: DailyTrip; attendance: TripAttendanceRecord[] }> => {
    const res = await fetch('/api/trips/for-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, routeId }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to load route trip');
    }
    return res.json();
  },
  getTripAttendance: async (tripId: string): Promise<TripAttendanceRecord[]> => {
    const res = await fetch(`/api/trips/${tripId}/attendance`);
    return res.json();
  },
  markAttendance: async (recordId: string, source: 'driver' | 'assistant', value: string): Promise<TripAttendanceRecord> => {
    const res = await fetch(`/api/attendance/${recordId}/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, value }),
    });
    return res.json();
  },
  resolveAttendanceMismatch: async (recordId: string, value: string, resolverName: string, reason: string): Promise<TripAttendanceRecord> => {
    const res = await fetch(`/api/attendance/${recordId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, resolverName, reason }),
    });
    return res.json();
  },
  verifyTrip: async (
    tripId: string,
    verifiedBy: string,
    notes?: string,
    statusOverride?: 'Arrived' | 'Departed' | 'Completed',
    timingPayload?: { inTime?: string; outTime?: string; inStrength?: number; outStrength?: number }
  ): Promise<DailyTrip> => {
    const res = await fetch(`/api/trips/${tripId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifiedBy, notes, statusOverride, ...(timingPayload || {}) }),
    });
    return res.json();
  },
  cancelTrip: async (tripId: string, reason: string, cancelledBy: string): Promise<DailyTrip> => {
    const res = await fetch(`/api/trips/${tripId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, cancelledBy }),
    });
    return res.json();
  },
  getAllAttendance: async (): Promise<TripAttendanceRecord[]> => {
    const res = await fetch('/api/attendance/all');
    return res.json();
  },
  getDriverRegisterPack: async (routeId: string, shiftName: string, weekStartDate: string, weekEndDate?: string): Promise<DriverRegisterWeekPack> => {
    const sp = new URLSearchParams({ routeId, shiftName, weekStartDate });
    if (weekEndDate) sp.set('weekEndDate', weekEndDate);
    const res = await fetch(`/api/driver-register/pack?${sp.toString()}`);
    return res.json();
  },
  stageImport: async (rows: any[]) => {
    const res = await fetch('/api/import/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    return res.json();
  },
  getReportsSummary: async (): Promise<ReportsSummary> => {
    const res = await fetch('/api/reports/summary');
    return res.json();
  },
};

import { 
  SchoolConfig, Village, Route, DailyTrip,
  TripAttendanceRecord, Vehicle, OdometerLog, FuelAdvanceAndPurchase, 
  MaintenanceRequest, Employee, FeeInvoice,
  FeeReceipt, FollowUpRecord, WarningLetter, AccountHead, JournalVoucher,
  DesignationMaster, TripMaster, ExpenseRecord, StudentMember,
  CampusMaster, MemberTypeMaster, CandidateResume, ScheduledService,
  VehicleAssignmentRecord, DisciplineRecord, ExpenseHead, IncomeHead, IncomeRecord, SystemUser
} from '../../types/index.js';

// Masters: Campuses
export const initialCampusesMaster: CampusMaster[] = [
  { id: 'cmp-sr', name: 'Senior Campus', code: 'Sr', address: '' },
  { id: 'cmp-jr', name: 'Junior Campus', code: 'Jr', address: '' },
];

// School Configuration & Branding (Editable in Masters -> Name of Institute)
export const initialSchoolConfig: SchoolConfig = {
  schoolName: 'Narendra Edu Valley',
  tagline: 'The Future Begins Here..',
  address: 'Nayagaon , Chainpur , Siwan , Bihar -841203',
  phone: '+91 7050421421',
  email: 'narendra.eduvalley@gmail.com',
  currentAcademicSession: '2026-2027',
  currentFinancialYear: '2026-2027',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  campuses: [...initialCampusesMaster],
  academicYear: '2026-2027',
  lateFeePerDay: 10,
  autoSuspendAfterMonths: 2,
};

// Masters: Member Types
export const initialMemberTypesMaster: MemberTypeMaster[] = [
  { id: 'mt-student', name: 'Student' },
  { id: 'mt-teacher', name: 'Teacher' },
  { id: 'mt-staff', name: 'Support Staff' },
];

export const initialClassesMaster: string[] = [
  'Playgroup', 'Nursery', 'LKG', 'UKG', 'Class I', 'Class II', 'Class III', 'Class IV', 'Class V',
  'Class VI', 'Class VII', 'Class VIII', 'Class IX', 'Class X', 'Class XI', 'Staff'
];

export const initialSectionsMaster: string[] = ['A', 'B'];

export const initialTripsMaster: TripMaster[] = [
  { id: 'trp-1', tripNumber: 1, description: 'Trip 1 — First Shift' },
  { id: 'trp-2', tripNumber: 2, description: 'Trip 2 — Second Shift' },
];

export const initialDesignationsMaster: DesignationMaster[] = [
  {
    id: 'des-admin',
    name: 'Admin',
    isDriver: false,
    description: 'Full administrative access and configuration',
    permissions: {
      manageMasters: true,
      manageMembers: true,
      manageEmployees: true,
      manageLogBook: true,
      manageExpenses: true,
      manageFees: true,
      manageAttendance: true,
      viewAccounts: true,
      postVouchers: true,
      viewReports: true,
    },
  },
  {
    id: 'des-coord',
    name: 'Transport Coordinator',
    isDriver: false,
    description: 'Operations, routing, fees, attendance and vehicle management',
    permissions: {
      manageMasters: true,
      manageMembers: true,
      manageEmployees: true,
      manageLogBook: true,
      manageExpenses: true,
      manageFees: true,
      manageAttendance: true,
      viewAccounts: true,
      postVouchers: false,
      viewReports: true,
    },
  },
  {
    id: 'des-assist',
    name: 'Transport Assistant',
    isDriver: false,
    description: 'Daily school arrival & departure attendance and logbook entry',
    permissions: {
      manageMasters: false,
      manageMembers: false,
      manageEmployees: false,
      manageLogBook: true,
      manageExpenses: false,
      manageFees: false,
      manageAttendance: true,
      viewAccounts: false,
      postVouchers: false,
      viewReports: false,
    },
  },
  {
    id: 'des-driver',
    name: 'Driver',
    isDriver: true,
    description: 'Commercial licensed bus and van driver',
    permissions: {
      manageMasters: false,
      manageMembers: false,
      manageEmployees: false,
      manageLogBook: true,
      manageExpenses: false,
      manageFees: false,
      manageAttendance: false,
      viewAccounts: false,
      postVouchers: false,
      viewReports: false,
    },
  },
  {
    id: 'des-helper',
    name: 'Helper / Conductor',
    isDriver: false,
    description: 'Vehicle assistant and student safety attendant',
    permissions: {
      manageMasters: false,
      manageMembers: false,
      manageEmployees: false,
      manageLogBook: false,
      manageExpenses: false,
      manageFees: false,
      manageAttendance: false,
      viewAccounts: false,
      postVouchers: false,
      viewReports: false,
    },
  },
];

// Clean Empty Operational & Master Entity Collections (No Dummy Records)
export const initialVillages: Village[] = [];
export const initialVehicles: Vehicle[] = [];
export const initialVehicleAssignments: VehicleAssignmentRecord[] = [];
export const initialRoutes: Route[] = [];
export const initialScheduledServices: ScheduledService[] = [];
export const initialResumes: CandidateResume[] = [];
export const initialStudents: StudentMember[] = [];
export const initialEmployees: Employee[] = [];
export const initialDailyTrips: DailyTrip[] = [];
export const initialTripAttendanceRecords: TripAttendanceRecord[] = [];
export const initialOdometerLogs: OdometerLog[] = [];
export const initialExpenses: ExpenseRecord[] = [];
export const initialFuelAdvances: FuelAdvanceAndPurchase[] = [];
export const initialMaintenanceRequests: MaintenanceRequest[] = [];
export const initialInvoices: FeeInvoice[] = [];
export const initialReceipts: FeeReceipt[] = [];
export const initialFollowUps: FollowUpRecord[] = [];
export const initialWarningLetters: WarningLetter[] = [];
export const initialDisciplineRecords: DisciplineRecord[] = [];
export const initialIncomeRecords: IncomeRecord[] = [];
export const initialJournalVouchers: JournalVoucher[] = [];

export const initialExpenseHeads: ExpenseHead[] = [
  { id: 'eh-1', name: 'Fuel (Diesel / CNG)', category: 'Direct Expense', requiresApproval: false, createdAt: '2026-04-01' },
  { id: 'eh-2', name: 'Repairs & Maintenance', category: 'Direct Expense', requiresApproval: true, createdAt: '2026-04-01' },
  { id: 'eh-3', name: 'Taxes, Permits & Insurance', category: 'Indirect Expense', requiresApproval: true, createdAt: '2026-04-01' },
  { id: 'eh-4', name: 'Vehicle Rent (Hired Fleet)', category: 'Direct Expense', requiresApproval: true, createdAt: '2026-04-01' },
  { id: 'eh-5', name: 'Driver / Helper Advance / Salary', category: 'Direct Expense', requiresApproval: true, createdAt: '2026-04-01' },
  { id: 'eh-6', name: 'Tolls, Parking & Challans', category: 'Indirect Expense', requiresApproval: false, createdAt: '2026-04-01' },
  { id: 'eh-7', name: 'General Operations', category: 'Indirect Expense', requiresApproval: false, createdAt: '2026-04-01' },
];

export const initialIncomeHeads: IncomeHead[] = [
  { id: 'ih-1', name: 'Special Bus Excursion / Picnic Hire', category: 'Direct Income', createdAt: '2026-04-01' },
  { id: 'ih-2', name: 'Duplicate Transport ID Pass Fee', category: 'Indirect Income', createdAt: '2026-04-01' },
  { id: 'ih-3', name: 'Old Tyre / Battery Scrap Sale', category: 'Indirect Income', createdAt: '2026-04-01' },
  { id: 'ih-4', name: 'Exam / Event Special Shuttle Collection', category: 'Direct Income', createdAt: '2026-04-01' },
];

// Standard Chart of Accounts (Clean Zero Opening Balances)
export const initialAccountHeads: AccountHead[] = [
  { id: 'acc-101', code: '1010', name: 'Cash in Hand (Transport Counter)', accountClass: 'Asset', balance: 0 },
  { id: 'acc-102', code: '1020', name: 'State Bank of India - School Transport A/C', accountClass: 'Asset', balance: 0 },
  { id: 'acc-103', code: '1050', name: 'Student Transport Fee Receivables', accountClass: 'Asset', balance: 0 },
  { id: 'acc-104', code: '1080', name: 'Driver Fuel & Expense Advances (Accountable)', accountClass: 'Asset', balance: 0 },
  { id: 'acc-201', code: '2010', name: 'Student Fee Advances Liability', accountClass: 'Liability', balance: 0 },
  { id: 'acc-202', code: '2020', name: 'Transport Vendors & Workshop Payables', accountClass: 'Liability', balance: 0 },
  { id: 'acc-301', code: '3010', name: 'School Transport Capital Fund', accountClass: 'Equity', balance: 0 },
  { id: 'acc-401', code: '4010', name: 'Student Transport Fee Income', accountClass: 'Income', balance: 0 },
  { id: 'acc-501', code: '5010', name: 'Vehicle Fuel Expense (Diesel / CNG)', accountClass: 'Expense', balance: 0 },
  { id: 'acc-502', code: '5020', name: 'Fleet Repairs & Maintenance Expense', accountClass: 'Expense', balance: 0 },
  { id: 'acc-503', code: '5030', name: 'Drivers & Helpers Salary Expense', accountClass: 'Expense', balance: 0 },
  { id: 'acc-504', code: '5040', name: 'Vehicle Rent Expense (Hired Fleet)', accountClass: 'Expense', balance: 0 },
  { id: 'acc-505', code: '5050', name: 'Taxes, Permits & Insurance Expense', accountClass: 'Expense', balance: 0 },
];

export const initialSystemUsers: SystemUser[] = [
  {
    id: 'usr-admin',
    username: 'admin',
    password: 'admin123',
    fullName: 'Chief Transport Administrator',
    role: 'Admin',
    campus: 'All Campuses',
    mobile: '',
    status: 'Active',
    createdAt: '2026-04-01',
  },
  {
    id: 'usr-coord',
    username: 'coordinator',
    password: 'coord123',
    fullName: 'Transport Coordinator',
    role: 'Transport Coordinator',
    campus: 'All Campuses',
    mobile: '',
    status: 'Active',
    createdAt: '2026-04-01',
  },
  {
    id: 'usr-assist',
    username: 'assistant',
    password: 'assist123',
    fullName: 'Transport Gate Assistant',
    role: 'Transport Assistant',
    campus: 'Sr',
    mobile: '',
    status: 'Active',
    createdAt: '2026-04-01',
  },
];


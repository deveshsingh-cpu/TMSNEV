import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { 
  initialSchoolConfig, initialCampusesMaster, initialMemberTypesMaster,
  initialClassesMaster, initialSectionsMaster,
  initialTripsMaster, initialDesignationsMaster, initialVillages, initialVehicles, 
  initialRoutes, initialStudents, initialEmployees, initialDailyTrips, 
  initialTripAttendanceRecords, initialOdometerLogs, initialExpenses,
  initialFuelAdvances, initialMaintenanceRequests, initialInvoices, 
  initialReceipts, initialFollowUps, initialWarningLetters, initialAccountHeads, 
  initialJournalVouchers, initialResumes, initialScheduledServices,
  initialVehicleAssignments, initialDisciplineRecords, initialExpenseHeads,
  initialIncomeHeads, initialIncomeRecords, initialSystemUsers
} from '../data/syntheticData.js';
import { 
  StudentMember, DailyTrip, TripAttendanceRecord, Vehicle, OdometerLog,
  FuelAdvanceAndPurchase, MaintenanceRequest, Employee, FeeInvoice, FeeReceipt,
  JournalVoucher, AccountHead, FollowUpRecord, WarningLetter, Route,
  Village, TransportStop, SchoolConfig, DriverRegisterWeekPack,
  ExpenseRecord, DesignationMaster, TripMaster, CampusId, CampusMaster, MemberTypeMaster,
  CandidateResume, ScheduledService, SuspensionAndPermissionEvent,
  VehicleAssignmentRecord, DisciplineRecord, ExpenseHead, IncomeHead, IncomeRecord,
  StaffAttendanceRecord, StaffAttendanceStatus, StaffAdvanceRecord, StaffPayrollRecord, HolidayRecord,
  SystemUser, UserRole
} from '../../types/index.js';

export const ALL_ERP_SHEET_TABS = [
  'School_Masters',
  'Villages_And_Stops',
  'Vehicles_Master',
  'Vehicle_Assignments',
  'Routes_Master',
  'Members_Transport',
  'Candidate_Resumes',
  'Employees_Staff',
  'Staff_Attendance',
  'Staff_Advances',
  'Staff_Payroll',
  'Holidays_Calendar',
  'Daily_Trips',
  'Trip_Attendance',
  'Daily_Log_Book_24H',
  'Driver_Fuel_Advances',
  'Vehicle_Maintenance',
  'Expense_Heads',
  'Expenses_Fuel_Ledger',
  'Income_Heads',
  'Other_Incomes',
  'Fee_Invoices',
  'Fee_Receipts',
  'Fee_FollowUps',
  'Warning_Letters',
  'Discipline_Records',
  'Chart_Of_Accounts',
  'Journal_Vouchers',
  'System_Users',
] as const;

export interface SheetsConnectionStatus {
  isConfigured: boolean;
  isConnected: boolean;
  sheetId: string;
  spreadsheetTitle?: string;
  clientEmail: string;
  projectId: string;
  mode: string;
  lastSyncAt: string | null;
  cellUsageEstimate: number;
  totalTabs: number;
  provisionedTabs?: string[];
  lastError: string | null;
  activeWriterQueueLength: number;
}

const DATA_DIR = process.env.VERCEL ? '/tmp/.data' : path.resolve(process.cwd(), '.data');
const DB_SNAPSHOT_FILE = path.join(DATA_DIR, 'erp_database.json');

function stripLargeBase64ForSheetCell(obj: any): string {
  try {
    const json = JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'string' && value.length > 25000) {
        return '[ATTACHMENT_STORED]';
      }
      return value;
    });
    return json.length <= 45000 ? json : json.slice(0, 45000);
  } catch {
    return '{}';
  }
}

export class SheetsDatabaseManager {
  private config: SchoolConfig = { ...initialSchoolConfig };
  private campusesMaster: CampusMaster[] = [...initialCampusesMaster];
  private memberTypesMaster: MemberTypeMaster[] = [...initialMemberTypesMaster];
  private classesMaster: string[] = [...initialClassesMaster];
  private sectionsMaster: string[] = [...initialSectionsMaster];
  private tripsMaster: TripMaster[] = [...initialTripsMaster];
  private designationsMaster: DesignationMaster[] = [...initialDesignationsMaster];
  private systemUsers: SystemUser[] = [...initialSystemUsers];

  private villages: Village[] = [...initialVillages];
  private vehicles: Vehicle[] = [...initialVehicles];
  private vehicleAssignments: VehicleAssignmentRecord[] = [...initialVehicleAssignments];
  private routes: Route[] = [...initialRoutes];
  private scheduledServices: ScheduledService[] = [...initialScheduledServices];
  private resumes: CandidateResume[] = [...initialResumes];
  private students: StudentMember[] = [...initialStudents];
  private employees: Employee[] = [...initialEmployees];
  private staffAttendance: StaffAttendanceRecord[] = [];
  private staffAdvances: StaffAdvanceRecord[] = [];
  private staffPayrolls: StaffPayrollRecord[] = [];
  private holidays: HolidayRecord[] = [];

  private trips: DailyTrip[] = [...initialDailyTrips];
  private attendance: TripAttendanceRecord[] = [...initialTripAttendanceRecords];
  private odometerLogs: OdometerLog[] = [...initialOdometerLogs];
  private expenseHeads: ExpenseHead[] = [...initialExpenseHeads];
  private expenses: ExpenseRecord[] = [...initialExpenses];
  private incomeHeads: IncomeHead[] = [...initialIncomeHeads];
  private incomes: IncomeRecord[] = [...initialIncomeRecords];
  private fuelAdvances: FuelAdvanceAndPurchase[] = [...initialFuelAdvances];
  private maintenance: MaintenanceRequest[] = [...initialMaintenanceRequests];
  private invoices: FeeInvoice[] = [...initialInvoices];
  private receipts: FeeReceipt[] = [...initialReceipts];
  private followUps: FollowUpRecord[] = [...initialFollowUps];
  private warningLetters: WarningLetter[] = [...initialWarningLetters];
  private disciplineRecords: DisciplineRecord[] = [...initialDisciplineRecords];
  private accounts: AccountHead[] = [...initialAccountHeads];
  private vouchers: JournalVoucher[] = [...initialJournalVouchers];

  private writeQueue: Promise<any> = Promise.resolve();
  private isGoogleConfigured = false;
  private sheetsClient: any = null;
  private sheetId = '';
  private spreadsheetTitle = 'Google Spreadsheet';
  private provisionedTabsList: string[] = [...ALL_ERP_SHEET_TABS];
  private clientEmail = '';
  private projectId = '';
  private lastSyncAt: string | null = null;
  private lastError: string | null = null;
  private queueCount = 0;
  private initPromise: Promise<void> = Promise.resolve();

  constructor() {
    this.loadLocalSnapshot();
    this.initGoogleServiceAccount();
    if (this.isGoogleConfigured) {
      this.initPromise = this.autoBootstrapGoogleSheets().catch((err) => {
        this.lastError = err.message;
        console.error('Google Sheets Auto-Bootstrap Error:', err.message);
      });
    }
  }

  public async ensureInitialized(): Promise<void> {
    try {
      await this.initPromise;
    } catch {
      // Non-fatal: continue with in-memory / snapshot state
    }
  }

  private loadLocalSnapshot() {
    try {
      if (fs.existsSync(DB_SNAPSHOT_FILE)) {
        const raw = fs.readFileSync(DB_SNAPSHOT_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.config) this.config = parsed.config;
          if (Array.isArray(parsed.campusesMaster)) this.campusesMaster = parsed.campusesMaster;
          if (Array.isArray(parsed.memberTypesMaster)) this.memberTypesMaster = parsed.memberTypesMaster;
          if (Array.isArray(parsed.classesMaster)) this.classesMaster = parsed.classesMaster;
          if (Array.isArray(parsed.sectionsMaster)) this.sectionsMaster = parsed.sectionsMaster;
          if (Array.isArray(parsed.tripsMaster)) this.tripsMaster = parsed.tripsMaster;
          if (Array.isArray(parsed.designationsMaster)) this.designationsMaster = parsed.designationsMaster;
          if (Array.isArray(parsed.systemUsers) && parsed.systemUsers.length > 0) {
            this.systemUsers = parsed.systemUsers;
          } else {
            this.systemUsers = [...initialSystemUsers];
          }
          if (Array.isArray(parsed.villages)) this.villages = parsed.villages;
          if (Array.isArray(parsed.vehicles)) this.vehicles = parsed.vehicles;
          if (Array.isArray(parsed.vehicleAssignments)) this.vehicleAssignments = parsed.vehicleAssignments;
          if (Array.isArray(parsed.routes)) this.routes = parsed.routes;
          if (Array.isArray(parsed.scheduledServices)) this.scheduledServices = parsed.scheduledServices;
          if (Array.isArray(parsed.resumes)) this.resumes = parsed.resumes;
          if (Array.isArray(parsed.students)) this.students = parsed.students;
          if (Array.isArray(parsed.employees)) this.employees = parsed.employees;
          if (Array.isArray(parsed.staffAttendance)) this.staffAttendance = parsed.staffAttendance;
          if (Array.isArray(parsed.staffAdvances)) this.staffAdvances = parsed.staffAdvances;
          if (Array.isArray(parsed.staffPayrolls)) this.staffPayrolls = parsed.staffPayrolls;
          if (Array.isArray(parsed.holidays)) this.holidays = parsed.holidays;
          if (Array.isArray(parsed.trips)) this.trips = parsed.trips;
          if (Array.isArray(parsed.attendance)) this.attendance = parsed.attendance;
          if (Array.isArray(parsed.odometerLogs)) this.odometerLogs = parsed.odometerLogs;
          if (Array.isArray(parsed.expenseHeads)) this.expenseHeads = parsed.expenseHeads;
          if (Array.isArray(parsed.expenses)) this.expenses = parsed.expenses;
          if (Array.isArray(parsed.incomeHeads)) this.incomeHeads = parsed.incomeHeads;
          if (Array.isArray(parsed.incomes)) this.incomes = parsed.incomes;
          if (Array.isArray(parsed.fuelAdvances)) this.fuelAdvances = parsed.fuelAdvances;
          if (Array.isArray(parsed.maintenance)) this.maintenance = parsed.maintenance;
          if (Array.isArray(parsed.invoices)) this.invoices = parsed.invoices;
          if (Array.isArray(parsed.receipts)) this.receipts = parsed.receipts;
          if (Array.isArray(parsed.followUps)) this.followUps = parsed.followUps;
          if (Array.isArray(parsed.warningLetters)) this.warningLetters = parsed.warningLetters;
          if (Array.isArray(parsed.disciplineRecords)) this.disciplineRecords = parsed.disciplineRecords;
          if (Array.isArray(parsed.accounts)) this.accounts = parsed.accounts;
          if (Array.isArray(parsed.vouchers)) this.vouchers = parsed.vouchers;
        }
      }
    } catch (err) {
      console.error('Failed to load local snapshot:', err);
    }
  }

  private saveLocalSnapshot() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const payload = {
        config: this.config,
        campusesMaster: this.campusesMaster,
        memberTypesMaster: this.memberTypesMaster,
        classesMaster: this.classesMaster,
        sectionsMaster: this.sectionsMaster,
        tripsMaster: this.tripsMaster,
        designationsMaster: this.designationsMaster,
        systemUsers: this.systemUsers,
        villages: this.villages,
        vehicles: this.vehicles,
        vehicleAssignments: this.vehicleAssignments,
        routes: this.routes,
        scheduledServices: this.scheduledServices,
        resumes: this.resumes,
        students: this.students,
        employees: this.employees,
        staffAttendance: this.staffAttendance,
        staffAdvances: this.staffAdvances,
        staffPayrolls: this.staffPayrolls,
        holidays: this.holidays,
        trips: this.trips,
        attendance: this.attendance,
        odometerLogs: this.odometerLogs,
        expenseHeads: this.expenseHeads,
        expenses: this.expenses,
        incomeHeads: this.incomeHeads,
        incomes: this.incomes,
        fuelAdvances: this.fuelAdvances,
        maintenance: this.maintenance,
        invoices: this.invoices,
        receipts: this.receipts,
        followUps: this.followUps,
        warningLetters: this.warningLetters,
        disciplineRecords: this.disciplineRecords,
        accounts: this.accounts,
        vouchers: this.vouchers,
      };
      fs.writeFileSync(DB_SNAPSHOT_FILE, JSON.stringify(payload), 'utf-8');
    } catch (err) {
      console.error('Failed to save local snapshot:', err);
    }
  }

  private rebuildScheduledServices() {
    this.scheduledServices = this.routes.map((r) => {
      const veh = this.vehicles.find((v) => v.id === r.vehicleId || v.registrationNumber === r.vehicleNumber);
      const assignedStudents = this.students.filter(
        (s) => (s.routeId === r.id || s.routeCode === r.code) && s.transportStatus !== 'Left'
      ).length;
      return {
        id: `svc-${r.id}`,
        vehicleNumber: r.vehicleNumber,
        tripNumber: r.tripNumber,
        shiftName: `Trip ${r.tripNumber} — ${r.name || r.code}`,
        routeId: r.id,
        routeName: `${r.code}${r.name ? ` (${r.name})` : ''}`,
        driverName: veh?.assignedDriverName || 'Unassigned Driver',
        helperName: veh?.assignedHelperName || '—',
        direction: 'Morning & Afternoon',
        campus: r.campus,
        assignedCount: assignedStudents,
        capacity: veh?.capacity || 40,
        departureTime: r.tripNumber === 1 ? '06:40 AM' : '07:45 AM',
        arrivalTime: r.tripNumber === 1 ? '07:30 AM' : '08:30 AM',
      };
    });
  }

  private initGoogleServiceAccount() {
    this.sheetId = (process.env.GOOGLE_SHEET_ID || '').trim();
    this.clientEmail = (process.env.GOOGLE_CLIENT_EMAIL || '').trim();
    this.projectId = (process.env.GOOGLE_PROJECT_ID || '').trim();
    let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';

    if (this.sheetId && this.clientEmail && privateKey) {
      try {
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
          privateKey = privateKey.slice(1, -1);
        }
        privateKey = privateKey.replace(/\\n/g, '\n');

        const auth = new google.auth.JWT({
          email: this.clientEmail,
          key: privateKey,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        this.sheetsClient = google.sheets({ version: 'v4', auth });
        this.isGoogleConfigured = true;
      } catch (err: any) {
        this.lastError = `Google Auth Init Error: ${err.message}`;
        this.isGoogleConfigured = false;
      }
    } else {
      this.isGoogleConfigured = false;
    }
  }

  private parseRowsFromSheet<T>(rows: any[][] | undefined | null, dedupeById = true): T[] {
    if (!Array.isArray(rows) || rows.length < 2) return [];
    const headers = rows[0].map((h: any) => String(h || '').trim());
    const jsonColIdx = headers.indexOf('_JSON');
    const results: T[] = [];
    const seenIds = new Set<string>();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || row.length === 0) continue;
      const rawJson = jsonColIdx >= 0 ? row[jsonColIdx] : row[row.length - 1];
      if (typeof rawJson === 'string' && rawJson.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(rawJson);
          if (parsed && typeof parsed === 'object') {
            if (dedupeById && parsed.id) {
              if (seenIds.has(String(parsed.id))) continue;
              seenIds.add(String(parsed.id));
            }
            results.push(parsed as T);
          }
        } catch {
          // Ignore malformed JSON cell
        }
      }
    }
    return results;
  }

  private parseSystemUsersFromSheet(rows: any[][] | undefined | null): SystemUser[] {
    if (!Array.isArray(rows) || rows.length < 2) return [];
    const users: SystemUser[] = [];
    const seenIds = new Set<string>();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || row.length < 3) continue;
      const rawJson = row[10];
      let base: Partial<SystemUser> = {};
      if (typeof rawJson === 'string' && rawJson.trim().startsWith('{')) {
        try {
          base = JSON.parse(rawJson);
        } catch {
          base = {};
        }
      }
      const id = String(row[0] || base.id || `usr-${i}`).trim();
      const username = String(row[1] || base.username || '').trim();
      const password = String(row[2] || base.password || '').trim();
      if (!username || !password || seenIds.has(id)) continue;
      seenIds.add(id);
      const roleRaw = String(row[4] || base.role || 'Transport Assistant').trim();
      const role: UserRole =
        roleRaw === 'Admin' || roleRaw === 'Transport Coordinator' || roleRaw === 'Transport Assistant'
          ? roleRaw
          : 'Transport Assistant';
      users.push({
        id,
        username,
        password,
        fullName: String(row[3] || base.fullName || username).trim(),
        role,
        campus: String(row[5] || base.campus || 'All Campuses').trim(),
        mobile: String(row[6] || base.mobile || '').trim(),
        status: String(row[7] || base.status || 'Active').trim() === 'Inactive' ? 'Inactive' : 'Active',
        lastLoginAt: row[8] && row[8] !== 'Never' ? String(row[8]) : base.lastLoginAt,
        createdAt: String(row[9] || base.createdAt || new Date().toISOString().split('T')[0]),
      });
    }
    return users;
  }

  private async autoBootstrapGoogleSheets() {
    if (!this.isGoogleConfigured || !this.sheetsClient || !this.sheetId) return;

    try {
      const spreadsheet = await this.sheetsClient.spreadsheets.get({
        spreadsheetId: this.sheetId,
      });

      if (spreadsheet.data?.properties?.title) {
        this.spreadsheetTitle = spreadsheet.data.properties.title;
      }

      const existingSheets = spreadsheet.data.sheets || [];
      const existingTabs: string[] = existingSheets.map((s: any) => s.properties?.title).filter(Boolean);

      const addSheetRequests = ALL_ERP_SHEET_TABS
        .filter(tab => !existingTabs.includes(tab))
        .map(tab => ({
          addSheet: {
            properties: {
              title: tab,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        }));

      if (addSheetRequests.length > 0) {
        await this.sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId: this.sheetId,
          requestBody: { requests: addSheetRequests },
        });
      }

      // Hydrate state from existing Google Sheet tabs before any write
      const batchRes = await this.sheetsClient.spreadsheets.values.batchGet({
        spreadsheetId: this.sheetId,
        ranges: ALL_ERP_SHEET_TABS.map(tab => `${tab}!A1:Z2000`),
      });

      const valueRanges: any[] = batchRes.data?.valueRanges || [];
      const tabMap = new Map<string, any[][]>();
      ALL_ERP_SHEET_TABS.forEach((tab, idx) => {
        tabMap.set(tab, valueRanges[idx]?.values || []);
      });

      // 1. Hydrate School_Masters
      const schoolMastersRows = tabMap.get('School_Masters');
      if (schoolMastersRows && schoolMastersRows.length >= 2 && schoolMastersRows[1]?.length > 0) {
        const row2 = schoolMastersRows[1];
        const rawMastersJson = row2[8];
        if (typeof rawMastersJson === 'string' && rawMastersJson.trim().startsWith('{')) {
          try {
            const parsedMasters = JSON.parse(rawMastersJson);
            if (parsedMasters.config) this.config = { ...this.config, ...parsedMasters.config };
            if (Array.isArray(parsedMasters.campusesMaster)) this.campusesMaster = parsedMasters.campusesMaster;
            if (Array.isArray(parsedMasters.memberTypesMaster)) this.memberTypesMaster = parsedMasters.memberTypesMaster;
            if (Array.isArray(parsedMasters.classesMaster)) this.classesMaster = parsedMasters.classesMaster;
            if (Array.isArray(parsedMasters.sectionsMaster)) this.sectionsMaster = parsedMasters.sectionsMaster;
            if (Array.isArray(parsedMasters.tripsMaster)) this.tripsMaster = parsedMasters.tripsMaster;
            if (Array.isArray(parsedMasters.designationsMaster)) this.designationsMaster = parsedMasters.designationsMaster;
          } catch {
            // fallback to columns
          }
        } else {
          this.config = {
            ...this.config,
            schoolName: row2[0] || this.config.schoolName,
            tagline: row2[1] || this.config.tagline,
            address: row2[2] || this.config.address,
            phone: row2[3] || this.config.phone,
            email: row2[4] || this.config.email,
            currentAcademicSession: row2[5] || this.config.currentAcademicSession,
            currentFinancialYear: row2[6] || this.config.currentFinancialYear,
            timezone: row2[7] || this.config.timezone,
          };
        }
      }

      // 2. Hydrate entity tabs if present in Google Sheets
      const villages = this.parseRowsFromSheet<Village>(tabMap.get('Villages_And_Stops'), true);
      if (villages.length > 0) this.villages = villages;

      const vehicles = this.parseRowsFromSheet<Vehicle>(tabMap.get('Vehicles_Master'), true);
      if (vehicles.length > 0) this.vehicles = vehicles;

      const assignments = this.parseRowsFromSheet<VehicleAssignmentRecord>(tabMap.get('Vehicle_Assignments'), true);
      if (assignments.length > 0) this.vehicleAssignments = assignments;

      const routes = this.parseRowsFromSheet<Route>(tabMap.get('Routes_Master'), true);
      if (routes.length > 0) this.routes = routes;

      const students = this.parseRowsFromSheet<StudentMember>(tabMap.get('Members_Transport'), true);
      if (students.length > 0) this.students = students;

      const resumes = this.parseRowsFromSheet<CandidateResume>(tabMap.get('Candidate_Resumes'), true);
      if (resumes.length > 0) this.resumes = resumes;

      const employees = this.parseRowsFromSheet<Employee>(tabMap.get('Employees_Staff'), true);
      if (employees.length > 0) this.employees = employees;

      const staffAtt = this.parseRowsFromSheet<StaffAttendanceRecord>(tabMap.get('Staff_Attendance'), true);
      if (staffAtt.length > 0) this.staffAttendance = staffAtt;

      const staffAdv = this.parseRowsFromSheet<StaffAdvanceRecord>(tabMap.get('Staff_Advances'), true);
      if (staffAdv.length > 0) this.staffAdvances = staffAdv;

      const staffPay = this.parseRowsFromSheet<StaffPayrollRecord>(tabMap.get('Staff_Payroll'), true);
      if (staffPay.length > 0) this.staffPayrolls = staffPay;

      const holidays = this.parseRowsFromSheet<HolidayRecord>(tabMap.get('Holidays_Calendar'), true);
      if (holidays.length > 0) this.holidays = holidays;

      const trips = this.parseRowsFromSheet<DailyTrip>(tabMap.get('Daily_Trips'), true);
      if (trips.length > 0) this.trips = trips;

      const attendance = this.parseRowsFromSheet<TripAttendanceRecord>(tabMap.get('Trip_Attendance'), true);
      if (attendance.length > 0) this.attendance = attendance;

      const logs = this.parseRowsFromSheet<OdometerLog>(tabMap.get('Daily_Log_Book_24H'), true);
      if (logs.length > 0) this.odometerLogs = logs;

      const fuelAdv = this.parseRowsFromSheet<FuelAdvanceAndPurchase>(tabMap.get('Driver_Fuel_Advances'), true);
      if (fuelAdv.length > 0) this.fuelAdvances = fuelAdv;

      const maint = this.parseRowsFromSheet<MaintenanceRequest>(tabMap.get('Vehicle_Maintenance'), true);
      if (maint.length > 0) this.maintenance = maint;

      const expHeads = this.parseRowsFromSheet<ExpenseHead>(tabMap.get('Expense_Heads'), true);
      if (expHeads.length > 0) this.expenseHeads = expHeads;

      const expenses = this.parseRowsFromSheet<ExpenseRecord>(tabMap.get('Expenses_Fuel_Ledger'), true);
      if (expenses.length > 0) this.expenses = expenses;

      const incHeads = this.parseRowsFromSheet<IncomeHead>(tabMap.get('Income_Heads'), true);
      if (incHeads.length > 0) this.incomeHeads = incHeads;

      const incomes = this.parseRowsFromSheet<IncomeRecord>(tabMap.get('Other_Incomes'), true);
      if (incomes.length > 0) this.incomes = incomes;

      const invoices = this.parseRowsFromSheet<FeeInvoice>(tabMap.get('Fee_Invoices'), true);
      if (invoices.length > 0) this.invoices = invoices;

      const receipts = this.parseRowsFromSheet<FeeReceipt>(tabMap.get('Fee_Receipts'), true);
      if (receipts.length > 0) this.receipts = receipts;

      const followUps = this.parseRowsFromSheet<FollowUpRecord>(tabMap.get('Fee_FollowUps'), true);
      if (followUps.length > 0) this.followUps = followUps;

      const warnings = this.parseRowsFromSheet<WarningLetter>(tabMap.get('Warning_Letters'), true);
      if (warnings.length > 0) this.warningLetters = warnings;

      const discipline = this.parseRowsFromSheet<DisciplineRecord>(tabMap.get('Discipline_Records'), true);
      if (discipline.length > 0) this.disciplineRecords = discipline;

      const accounts = this.parseRowsFromSheet<AccountHead>(tabMap.get('Chart_Of_Accounts'), true);
      if (accounts.length > 0) this.accounts = accounts;

      const vouchers = this.parseRowsFromSheet<JournalVoucher>(tabMap.get('Journal_Vouchers'), true);
      if (vouchers.length > 0) this.vouchers = vouchers;

      const users = this.parseSystemUsersFromSheet(tabMap.get('System_Users'));
      if (users.length > 0) {
        this.systemUsers = users;
      }

      this.rebuildScheduledServices();
      this.saveLocalSnapshot();
      this.provisionedTabsList = [...ALL_ERP_SHEET_TABS];
      this.lastSyncAt = new Date().toISOString();

      // If any tab was newly added or System_Users had no rows yet, sync initial headers & data
      if (addSheetRequests.length > 0 || users.length === 0) {
        await this.internalSyncToGoogleSheets();
      }
    } catch (err: any) {
      this.lastError = err.message;
      console.error('Google Sheets Auto-Bootstrap Error:', err.message);
    }
  }

  private enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    this.queueCount++;
    const execution = this.writeQueue.then(async () => {
      try {
        return await task();
      } finally {
        this.queueCount = Math.max(0, this.queueCount - 1);
      }
    });

    this.writeQueue = execution.catch(() => {});
    return execution;
  }

  public async getStatus(): Promise<SheetsConnectionStatus> {
    let isConnected = false;
    if (this.isGoogleConfigured && this.sheetsClient && this.sheetId) {
      try {
        const meta = await this.sheetsClient.spreadsheets.get({
          spreadsheetId: this.sheetId,
          fields: 'spreadsheetId,properties.title,sheets.properties.title',
        });
        isConnected = true;
        if (meta.data?.properties?.title) {
          this.spreadsheetTitle = meta.data.properties.title;
        }
        const sheetTitles = (meta.data?.sheets || [])
          .map((s: any) => s.properties?.title)
          .filter(Boolean);
        if (sheetTitles.length > 0) {
          this.provisionedTabsList = sheetTitles;
        }
        this.lastError = null;
      } catch (err: any) {
        this.lastError = err.message;
        isConnected = false;
      }
    }

    const totalRecords =
      this.students.length +
      this.employees.length +
      this.vehicles.length +
      this.routes.length +
      this.villages.length +
      this.odometerLogs.length +
      this.expenses.length +
      this.invoices.length +
      this.receipts.length +
      this.vouchers.length;

    const tabList = [
      { title: 'School_Masters', headersCount: 2, rowCount: 15 },
      { title: 'Villages_And_Stops', headersCount: 8, rowCount: this.villages.length },
      { title: 'Vehicles_Master', headersCount: 13, rowCount: this.vehicles.length },
      { title: 'Vehicle_Assignments', headersCount: 10, rowCount: this.vehicleAssignments.length },
      { title: 'Routes_Master', headersCount: 12, rowCount: this.routes.length },
      { title: 'Members_Transport', headersCount: 15, rowCount: this.students.length },
      { title: 'Candidate_Resumes', headersCount: 10, rowCount: this.resumes.length },
      { title: 'Employees_Staff', headersCount: 12, rowCount: this.employees.length },
      { title: 'Staff_Attendance', headersCount: 9, rowCount: this.staffAttendance.length },
      { title: 'Staff_Advances', headersCount: 12, rowCount: this.staffAdvances.length },
      { title: 'Staff_Payroll', headersCount: 17, rowCount: this.staffPayrolls.length },
      { title: 'Holidays_Calendar', headersCount: 6, rowCount: this.holidays.length },
      { title: 'Daily_Trips', headersCount: 14, rowCount: this.trips.length },
      { title: 'Trip_Attendance', headersCount: 12, rowCount: this.attendance.length },
      { title: 'Daily_Log_Book_24H', headersCount: 9, rowCount: this.odometerLogs.length },
      { title: 'Driver_Fuel_Advances', headersCount: 10, rowCount: this.fuelAdvances.length },
      { title: 'Vehicle_Maintenance', headersCount: 9, rowCount: this.maintenance.length },
      { title: 'Expense_Heads', headersCount: 6, rowCount: this.expenseHeads.length },
      { title: 'Expenses_Fuel_Ledger', headersCount: 12, rowCount: this.expenses.length },
      { title: 'Income_Heads', headersCount: 5, rowCount: this.incomeHeads.length },
      { title: 'Other_Incomes', headersCount: 9, rowCount: this.incomes.length },
      { title: 'Fee_Invoices', headersCount: 12, rowCount: this.invoices.length },
      { title: 'Fee_Receipts', headersCount: 13, rowCount: this.receipts.length },
      { title: 'Fee_FollowUps', headersCount: 9, rowCount: this.followUps.length },
      { title: 'Warning_Letters', headersCount: 11, rowCount: this.warningLetters.length },
      { title: 'Discipline_Records', headersCount: 11, rowCount: this.disciplineRecords.length },
      { title: 'Chart_Of_Accounts', headersCount: 6, rowCount: this.accounts.length },
      { title: 'Journal_Vouchers', headersCount: 10, rowCount: this.vouchers.length },
      { title: 'System_Users', headersCount: 9, rowCount: this.systemUsers.length },
    ];

    return {
      isConfigured: this.isGoogleConfigured,
      isConnected,
      sheetId: this.sheetId || 'Not Set',
      spreadsheetTitle: this.spreadsheetTitle,
      clientEmail: this.clientEmail || 'Not Configured',
      projectId: this.projectId || 'Google Cloud',
      mode: isConnected ? 'Google Sheets Live' : 'Connecting to Google Sheets...',
      lastSyncAt: this.lastSyncAt,
      cellUsageEstimate: Math.max(280, totalRecords * 12 + 280),
      totalTabs: ALL_ERP_SHEET_TABS.length,
      provisionedTabs: this.provisionedTabsList,
      tabList,
      lastError: this.lastError,
      activeWriterQueueLength: this.queueCount,
    };
  }

  public async provisionSpreadsheetTabs(): Promise<{ success: boolean; message: string }> {
    return this.enqueueWrite(async () => {
      if (!this.isGoogleConfigured || !this.sheetsClient || !this.sheetId) {
        return {
          success: false,
          message: 'Google Sheets Service Account credentials not configured in environment secrets.',
        };
      }

      try {
        const spreadsheet = await this.sheetsClient.spreadsheets.get({
          spreadsheetId: this.sheetId,
        });

        if (spreadsheet.data?.properties?.title) {
          this.spreadsheetTitle = spreadsheet.data.properties.title;
        }

        const existingSheets = spreadsheet.data.sheets || [];
        const existingTabs: string[] = existingSheets.map((s: any) => s.properties?.title);

        const addSheetRequests = ALL_ERP_SHEET_TABS
          .filter(tab => !existingTabs.includes(tab))
          .map(tab => ({
            addSheet: {
              properties: {
                title: tab,
                gridProperties: {
                  frozenRowCount: 1,
                },
              },
            },
          }));

        if (addSheetRequests.length > 0) {
          await this.sheetsClient.spreadsheets.batchUpdate({
            spreadsheetId: this.sheetId,
            requestBody: { requests: addSheetRequests },
          });
        }

        // Remove default empty 'Sheet1' tab if our ERP tabs now exist
        const sheet1Obj = existingSheets.find((s: any) => s.properties?.title === 'Sheet1');
        if (sheet1Obj && sheet1Obj.properties?.sheetId !== undefined) {
          try {
            await this.sheetsClient.spreadsheets.batchUpdate({
              spreadsheetId: this.sheetId,
              requestBody: {
                requests: [
                  {
                    deleteSheet: {
                      sheetId: sheet1Obj.properties.sheetId,
                    },
                  },
                ],
              },
            });
          } catch {
            // Ignore if Sheet1 was already removed or cannot be removed
          }
        }

        this.provisionedTabsList = [...ALL_ERP_SHEET_TABS];
        await this.internalSyncToGoogleSheets();
        return {
          success: true,
          message: `All ${ALL_ERP_SHEET_TABS.length} tabs have been created and synchronized in Google Spreadsheet "${this.spreadsheetTitle}".`,
        };
      } catch (err: any) {
        this.lastError = err.message;
        throw new Error(`Failed to provision Google Sheets tabs: ${err.message}`);
      }
    });
  }

  private async internalSyncToGoogleSheets(): Promise<{ success: boolean; message: string }> {
    this.rebuildScheduledServices();
    this.saveLocalSnapshot();

    if (!this.isGoogleConfigured || !this.sheetsClient || !this.sheetId) {
      return { success: false, message: 'Google Sheets credentials are not configured.' };
    }

    try {
      const dataPayload = [
        {
          range: 'School_Masters!A1',
          values: [
            ['School Name', 'Tagline', 'Address', 'Phone', 'Email', 'Academic Session', 'Financial Year', 'Timezone', '_JSON'],
            [
              this.config.schoolName,
              this.config.tagline,
              this.config.address || '',
              this.config.phone,
              this.config.email,
              this.config.currentAcademicSession || '2026-2027',
              this.config.currentFinancialYear || '2026-2027',
              this.config.timezone || 'Asia/Kolkata',
              stripLargeBase64ForSheetCell({
                config: this.config,
                campusesMaster: this.campusesMaster,
                memberTypesMaster: this.memberTypesMaster,
                classesMaster: this.classesMaster,
                sectionsMaster: this.sectionsMaster,
                tripsMaster: this.tripsMaster,
                designationsMaster: this.designationsMaster,
              }),
            ],
            [],
            ['Master Category', 'Configured Values'],
            ['Campuses', ...this.campusesMaster.map(c => `${c.name} (${c.code})`)],
            ['Member Types', ...this.memberTypesMaster.map(m => m.name)],
            ['Classes', ...this.classesMaster],
            ['Sections', ...this.sectionsMaster],
            ['Trips', ...this.tripsMaster.map(t => `Trip ${t.tripNumber}: ${t.description}`)],
            ['Designations', ...this.designationsMaster.map(d => d.name)],
          ],
        },
        {
          range: 'Villages_And_Stops!A1',
          values: [
            ['Village ID', 'Village Name', 'Distance (Km)', 'Stop ID', 'Stop Name', 'Monthly Fee (INR)', '_JSON'],
            ...this.villages.flatMap(v =>
              v.stops.length > 0
                ? v.stops.map(s => [v.id, v.name, v.distanceKm, s.id, s.name, s.fee, stripLargeBase64ForSheetCell(v)])
                : [[v.id, v.name, v.distanceKm, '', 'Main Stop', v.monthlyRate || 700, stripLargeBase64ForSheetCell(v)]]
            ),
          ],
        },
        {
          range: 'Vehicles_Master!A1',
          values: [
            [
              'Vehicle ID', 'Reg Number', 'Type', 'Capacity', 'Ownership', 'Owner Name', 'Owner Mobile',
              'Owner PAN', 'Owner Aadhaar', 'Monthly Rent (INR)', 'Condition', 'Fuel Type',
              'Reg Validity', 'Tax Upto', 'Fitness Upto', 'Insurance Upto', 'PUC Upto', 'Permit Upto',
              'Current Odometer (Km)', 'Target Mileage (Km/L)', 'Assigned Driver', 'Assigned Helper', 'KYC Uploaded', '_JSON'
            ],
            ...this.vehicles.map(v => [
              v.id,
              v.registrationNumber,
              v.type,
              v.capacity,
              v.ownership,
              v.ownerName || 'Institute Fleet',
              v.ownerMobile || '',
              v.ownerPanNo || '',
              v.ownerAadhaarNo || '',
              v.monthlyRentAmount || 0,
              v.condition,
              v.fuelType,
              v.registrationValidity,
              v.taxPaidUpto,
              v.fitnessUpto,
              v.insuranceUpto,
              v.pollutionUpto,
              v.permitUpto || '',
              v.currentOdometer,
              v.expectedMileageKmPerL || v.baselineMileageKmPerLitre || 7,
              v.assignedDriverName || '',
              v.assignedHelperName || '',
              v.ownership === 'Rented'
                ? `Agreement: ${v.rentAgreementDoc?.name || 'Yes'} | Aadhaar: ${v.ownerAadhaarDoc?.name || 'Yes'} | PAN: ${v.ownerPanDoc?.name || 'Yes'}`
                : 'School Owned',
              stripLargeBase64ForSheetCell(v),
            ]),
          ],
        },
        {
          range: 'Vehicle_Assignments!A1',
          values: [
            ['Assignment ID', 'Vehicle Reg', 'Driver Name', 'Helper Name', 'From Date', 'To Date', 'Status', 'Assigned By', 'Remarks', '_JSON'],
            ...this.vehicleAssignments.map(va => [
              va.id,
              va.vehicleNumber,
              va.driverName,
              va.helperName || '',
              va.fromDate || va.startDate || '',
              va.toDate || va.endDate || 'Present',
              va.status,
              va.assignedBy || 'Admin',
              va.remarks || '',
              stripLargeBase64ForSheetCell(va),
            ]),
          ],
        },
        {
          range: 'Routes_Master!A1',
          values: [
            ['Route ID', 'Route Code (Nomenclature)', 'Campus', 'Vehicle Reg', 'Trip Number', 'Assigned Villages', 'Active', '_JSON'],
            ...this.routes.map(r => [
              r.id,
              r.code,
              r.campus,
              r.vehicleNumber,
              r.tripNumber,
              r.villageNames.join(', '),
              r.active ? 'Yes' : 'No',
              stripLargeBase64ForSheetCell(r),
            ]),
          ],
        },
        {
          range: 'Members_Transport!A1',
          values: [
            [
              'Member ID', 'Admission / Staff ID', 'Full Name', 'Member Type', 'Class', 'Section',
              'Gender', 'Campus', 'Guardian Name', 'Mobile', 'Village', 'Pickup & Drop Stop',
              'Route Code', 'Monthly Fee (INR)', 'Concession (INR)', 'Balance Due (INR)', 'Status', 'Joining Date', '_JSON'
            ],
            ...this.students.map(s => [
              s.id,
              s.admissionNo,
              s.name,
              s.memberType || 'Student',
              s.class,
              s.section,
              s.gender,
              s.campus,
              s.fatherName,
              s.mobile,
              s.villageName,
              s.pickupDropStopName,
              s.routeCode,
              s.monthlyFee,
              s.concessionAmount || 0,
              s.balanceDue,
              s.transportStatus,
              s.joiningDate || '',
              stripLargeBase64ForSheetCell(s),
            ]),
          ],
        },
        {
          range: 'Candidate_Resumes!A1',
          values: [
            [
              'Resume ID', 'Candidate Code', 'Name', 'Age', 'Gender', 'Mobile', 'Address',
              'Role Applied', 'Is Driver', 'DL Number', 'DL Validity', 'Min Expected Salary (INR)',
              'Experience', 'Police Record', 'Status', 'Applied Date', '_JSON'
            ],
            ...this.resumes.map(r => [
              r.id,
              r.candidateCode,
              r.name,
              r.age,
              r.gender,
              r.mobile,
              r.address,
              r.appliedDesignation,
              r.isDriver ? 'Yes' : 'No',
              r.drivingLicenseNo || 'N/A',
              r.drivingLicenseValidity || 'N/A',
              r.minExpectedSalary,
              r.experience,
              r.policeRecord,
              r.status,
              r.appliedDate,
              stripLargeBase64ForSheetCell(r),
            ]),
          ],
        },
        {
          range: 'Employees_Staff!A1',
          values: [
            [
              'Employee ID', 'Employee Code', 'Name', 'Designation', 'Campus', 'Is Driver',
              'DL Number', 'DL Validity', 'Age', 'Gender', 'Mobile', 'Address',
              'Monthly Base Salary (INR)', 'Status', 'Joining Date', '_JSON'
            ],
            ...this.employees.map(e => [
              e.id,
              e.employeeCode,
              e.name,
              e.designation,
              e.campus || 'Sr',
              e.isDriver ? 'Yes' : 'No',
              e.drivingLicenseNo || 'N/A',
              e.drivingLicenseValidity || 'N/A',
              e.age,
              e.gender,
              e.mobile,
              e.address,
              e.monthlyBaseSalary || 0,
              e.status,
              e.joiningDate,
              stripLargeBase64ForSheetCell(e),
            ]),
          ],
        },
        {
          range: 'Staff_Attendance!A1',
          values: [
            ['Record ID', 'Date', 'Employee ID', 'Employee Code', 'Employee Name', 'Campus', 'Status (P/A/L/H)', 'Marked By', 'Remarks', '_JSON'],
            ...this.staffAttendance.map(sa => [
              sa.id,
              sa.date,
              sa.employeeId,
              sa.employeeCode,
              sa.employeeName,
              sa.campus,
              sa.status,
              sa.markedBy,
              sa.remarks || '',
              stripLargeBase64ForSheetCell(sa),
            ]),
          ],
        },
        {
          range: 'Staff_Advances!A1',
          values: [
            ['Advance ID', 'Date', 'Employee Code', 'Employee Name', 'Amount Given (INR)', 'Adjusted Amount (INR)', 'Balance Pending (INR)', 'Payment Mode', 'Reason', 'Status', 'Recorded By', '_JSON'],
            ...this.staffAdvances.map(adv => [
              adv.id,
              adv.date,
              adv.employeeCode,
              adv.employeeName,
              adv.amount,
              adv.adjustedAmount,
              adv.balanceAmount,
              adv.paymentMode,
              adv.reason,
              adv.status,
              adv.recordedBy,
              stripLargeBase64ForSheetCell(adv),
            ]),
          ],
        },
        {
          range: 'Staff_Payroll!A1',
          values: [
            [
              'Payroll ID', 'Month', 'Employee Code', 'Employee Name', 'Designation', 'Base Salary (INR)',
              'Present (P)', 'Holidays (H)', 'Leaves (L)', 'Absent (A)', 'Gross Earned (INR)',
              'Advance Deducted (INR)', 'Net Payable (INR)', 'Payment Mode', 'Payment Date', 'Status', '_JSON'
            ],
            ...this.staffPayrolls.map(pr => [
              pr.id,
              pr.month,
              pr.employeeCode,
              pr.employeeName,
              pr.designation,
              pr.monthlyBaseSalary,
              pr.presentDays,
              pr.holidayDays,
              pr.leaveDays,
              pr.absentDays,
              pr.grossEarnedSalary,
              pr.advanceDeducted,
              pr.netPayableSalary,
              pr.paymentMode || '',
              pr.paymentDate || '',
              pr.status,
              stripLargeBase64ForSheetCell(pr),
            ]),
          ],
        },
        {
          range: 'Holidays_Calendar!A1',
          values: [
            ['Holiday ID', 'Date', 'Occasion', 'Campus', 'Declared By', '_JSON'],
            ...this.holidays.map(h => [
              h.id,
              h.date,
              h.occasion,
              h.campus || 'all',
              h.declaredBy,
              stripLargeBase64ForSheetCell(h),
            ]),
          ],
        },
        {
          range: 'Daily_Trips!A1',
          values: [
            [
              'Trip ID', 'Date', 'Campus', 'Route Code', 'Vehicle Reg', 'Driver Name', 'Helper Name',
              'Trip Number', 'Status', 'Roster Count', 'Present Count', 'Absent Count',
              'In Time', 'In Strength', 'Out Time', 'Out Strength', 'Verified By', 'Notes', '_JSON'
            ],
            ...this.trips.map(t => [
              t.id,
              t.date,
              t.campus,
              t.routeName,
              t.vehicleNumber,
              t.driverName,
              t.helperName || '',
              t.tripNumber,
              t.status,
              t.rosterCount || 0,
              t.presentCount || 0,
              t.absentCount || 0,
              t.inTime || '',
              t.inStrength ?? '',
              t.outTime || '',
              t.outStrength ?? '',
              t.verifiedBy || '',
              t.notes || '',
              stripLargeBase64ForSheetCell(t),
            ]),
          ],
        },
        {
          range: 'Trip_Attendance!A1',
          values: [
            ['Attendance ID', 'Date', 'Trip ID', 'Admission No', 'Member Name', 'Class & Sec', 'Stop Name', 'Driver Status', 'Assistant Status', 'Reconciliation Status', '_JSON'],
            ...this.attendance.map(a => [
              a.id,
              a.date,
              a.tripId,
              a.admissionNo,
              a.studentName,
              a.classSection,
              a.stopName,
              a.driverStatus,
              a.assistantStatus,
              a.reconciliationStatus,
              stripLargeBase64ForSheetCell(a),
            ]),
          ],
        },
        {
          range: 'Daily_Log_Book_24H!A1',
          values: [
            ['Log ID', 'Date (24H)', 'Vehicle Reg', 'Driver Name', 'Start Odometer (Km)', 'End Odometer (Km)', 'Daily Run (Km)', 'Fuel Added (L)', 'Fuel Cost (INR)', 'Neatness Checked', 'Remarks / Linked Expense', 'Recorded By', '_JSON'],
            ...this.odometerLogs.map(o => [
              o.id,
              o.date,
              o.vehicleNumber,
              o.driverName,
              o.startOdometer,
              o.endOdometer,
              o.tripKm,
              o.fuelLitresAdded || 0,
              o.fuelCost || 0,
              o.neatnessChecked ? 'Yes' : 'No',
              o.defectsReported || '',
              o.recordedBy,
              stripLargeBase64ForSheetCell(o),
            ]),
          ],
        },
        {
          range: 'Driver_Fuel_Advances!A1',
          values: [
            ['Advance ID', 'Date', 'Vehicle Reg', 'Driver Name', 'Advance Given (INR)', 'Litres Purchased', 'Rate/L', 'Actual Bill (INR)', 'Cash Returned (INR)', 'Unsettled Balance (INR)', 'Station / Vendor', 'Status', '_JSON'],
            ...this.fuelAdvances.map(fa => [
              fa.id,
              fa.date,
              fa.vehicleNumber,
              fa.driverName,
              fa.advanceAmount,
              fa.litresPurchased || 0,
              fa.ratePerLitre || 0,
              fa.actualBillAmount || 0,
              fa.cashReturned || 0,
              fa.unsettledAdvance || 0,
              fa.vendorName || '',
              fa.status,
              stripLargeBase64ForSheetCell(fa),
            ]),
          ],
        },
        {
          range: 'Vehicle_Maintenance!A1',
          values: [
            ['Work Order ID', 'Work Order No', 'Date', 'Vehicle Reg', 'Issue Description', 'Severity', 'Workshop / Vendor', 'Estimated Cost (INR)', 'Actual Cost (INR)', 'Status', 'Requested By', 'Approved By', '_JSON'],
            ...this.maintenance.map(m => [
              m.id,
              m.workOrderNo || m.id,
              m.date,
              m.vehicleNumber,
              m.issueDescription,
              m.severity,
              m.vendorName,
              m.estimatedCost,
              m.actualCost || 0,
              m.status,
              m.requestedBy,
              m.approvedBy || '',
              stripLargeBase64ForSheetCell(m),
            ]),
          ],
        },
        {
          range: 'Expense_Heads!A1',
          values: [
            ['Head ID', 'Expense Head Name', 'Category', 'Requires Admin Approval', 'Created At', '_JSON'],
            ...this.expenseHeads.map(eh => [
              eh.id,
              eh.name,
              eh.category || 'Direct Expense',
              eh.requiresApproval ? 'Yes' : 'No',
              eh.createdAt || '',
              stripLargeBase64ForSheetCell(eh),
            ]),
          ],
        },
        {
          range: 'Expenses_Fuel_Ledger!A1',
          values: [
            ['Expense ID', 'Expense No', 'Date', 'Expense Head / Category', 'Vehicle Reg', 'Vendor / Party', 'Bill / Invoice No', 'Payment Mode', 'Amount (INR)', 'Approval Status', 'Approved By', 'Narration', '_JSON'],
            ...this.expenses.map(e => [
              e.id,
              e.expenseNo,
              e.date,
              e.category,
              e.vehicleNumber || 'General',
              e.vendorName,
              e.billNumber || '',
              e.paymentMode,
              e.amount,
              e.approvalStatus || 'Approved',
              e.approvedBy || '',
              e.narration,
              stripLargeBase64ForSheetCell(e),
            ]),
          ],
        },
        {
          range: 'Income_Heads!A1',
          values: [
            ['Head ID', 'Income Head Name', 'Category', 'Created At', '_JSON'],
            ...this.incomeHeads.map(ih => [
              ih.id,
              ih.name,
              ih.category || 'Indirect Income',
              ih.createdAt || '',
              stripLargeBase64ForSheetCell(ih),
            ]),
          ],
        },
        {
          range: 'Other_Incomes!A1',
          values: [
            ['Income ID', 'Income No', 'Date', 'Income Head', 'Received From / Party', 'Payment Mode', 'Ref / Invoice No', 'Amount (INR)', 'Narration', 'Recorded By', '_JSON'],
            ...this.incomes.map(inc => [
              inc.id,
              inc.incomeNo,
              inc.date,
              inc.incomeHeadName,
              inc.receivedFrom || inc.name || '',
              inc.paymentMode,
              inc.invoiceNumber || inc.referenceNo || '',
              inc.amount,
              inc.narration || inc.description || '',
              inc.recordedBy,
              stripLargeBase64ForSheetCell(inc),
            ]),
          ],
        },
        {
          range: 'Fee_Invoices!A1',
          values: [
            ['Invoice ID', 'Invoice No', 'Billing Month', 'Admission No', 'Member Name', 'Base Fee (INR)', 'Concession (INR)', 'Net Billed (INR)', 'Paid Amount (INR)', 'Balance Due (INR)', 'Status', 'Due Date', '_JSON'],
            ...this.invoices.map(inv => [
              inv.id,
              inv.invoiceNo,
              inv.month,
              inv.admissionNo,
              inv.studentName,
              inv.baseFee,
              inv.concession,
              inv.netAmount,
              inv.paidAmount,
              inv.balanceDue,
              inv.status,
              inv.dueDate,
              stripLargeBase64ForSheetCell(inv),
            ]),
          ],
        },
        {
          range: 'Fee_Receipts!A1',
          values: [
            ['Receipt ID', 'Receipt No', 'Date', 'Admission No', 'Member Name', 'Amount Paid (INR)', 'Discount (INR)', 'Late Fine (INR)', 'Balance Before (INR)', 'Balance After (INR)', 'Payment Mode', 'Reference / UTR', 'Received By', 'Remarks', '_JSON'],
            ...this.receipts.map(rec => [
              rec.id,
              rec.receiptNo,
              rec.date,
              rec.admissionNo,
              rec.studentName,
              rec.amount,
              rec.discountAmount || 0,
              rec.lateFine || 0,
              rec.balanceDueBefore ?? 0,
              rec.balanceDueAfter ?? 0,
              rec.paymentMode,
              rec.referenceNo || '',
              rec.receivedBy,
              rec.remarks || '',
              stripLargeBase64ForSheetCell(rec),
            ]),
          ],
        },
        {
          range: 'Fee_FollowUps!A1',
          values: [
            ['FollowUp ID', 'Call Date', 'Admission No', 'Member Name', 'Contact Person', 'Phone', 'Overdue Amount (INR)', 'Promised Date', 'Outcome', 'Notes / Response', 'Recorded By', '_JSON'],
            ...this.followUps.map(f => [
              f.id,
              f.date || f.callDate || '',
              f.admissionNo,
              f.studentName || f.memberName || '',
              f.contactPerson || f.personTalkedTo || '',
              f.phone || '',
              f.overdueAmount ?? 0,
              f.promiseDate || f.promisedDate || '',
              f.outcome || f.status || '',
              f.notes || f.responseReceived || '',
              f.officerName || f.recordedBy || '',
              stripLargeBase64ForSheetCell(f),
            ]),
          ],
        },
        {
          range: 'Warning_Letters!A1',
          values: [
            ['Letter ID', 'Letter No', 'Issue Date', 'Admission No', 'Member Name', 'Guardian Name', 'Overdue Amount (INR)', 'Deadline Date', 'Warning Level', 'Issued By', '_JSON'],
            ...this.warningLetters.map(wl => [
              wl.id,
              wl.letterNo,
              wl.issueDate || wl.date,
              wl.admissionNo,
              wl.studentName,
              wl.parentName || wl.fatherName || '',
              wl.overdueAmount,
              wl.deadlineDate,
              wl.warningLevel,
              wl.issuedBy,
              stripLargeBase64ForSheetCell(wl),
            ]),
          ],
        },
        {
          range: 'Discipline_Records!A1',
          values: [
            ['Record ID', 'Date', 'Admission No', 'Member Name', 'Class & Sec', 'Route Code', 'Vehicle Reg', 'Mischief / Concern', 'Action Taken', 'Reported By', '_JSON'],
            ...this.disciplineRecords.map(d => [
              d.id,
              d.date,
              d.admissionNo,
              d.studentName || d.memberName || '',
              d.classSection || `${d.className || ''}-${d.section || ''}`,
              d.routeCode || d.routeName || '',
              d.vehicleNumber || '',
              d.concern,
              d.actionTaken,
              d.reportedBy,
              stripLargeBase64ForSheetCell(d),
            ]),
          ],
        },
        {
          range: 'Chart_Of_Accounts!A1',
          values: [
            ['Account ID', 'Account Code', 'Account Head Name', 'Account Class', 'Current Balance (INR)', '_JSON'],
            ...this.accounts.map(a => [
              a.id,
              a.code,
              a.name,
              a.accountClass,
              a.balance,
              stripLargeBase64ForSheetCell(a),
            ]),
          ],
        },
        {
          range: 'Journal_Vouchers!A1',
          values: [
            ['Voucher ID', 'Voucher No', 'Date', 'Voucher Type', 'Total Debit (INR)', 'Total Credit (INR)', 'Status', 'Created By', 'Narration', '_JSON'],
            ...this.vouchers.map(v => [
              v.id,
              v.voucherNo,
              v.date,
              v.voucherType,
              v.totalDebit,
              v.totalCredit,
              v.status,
              v.createdBy,
              v.narration,
              stripLargeBase64ForSheetCell(v),
            ]),
          ],
        },
        {
          range: 'System_Users!A1',
          values: [
            ['User ID', 'Username', 'Password', 'Full Name', 'Role', 'Campus', 'Mobile', 'Status', 'Last Login', 'Created At', '_JSON'],
            ...this.systemUsers.map(u => [
              u.id,
              u.username,
              u.password,
              u.fullName,
              u.role,
              u.campus || 'All Campuses',
              u.mobile || '',
              u.status,
              u.lastLoginAt || 'Never',
              u.createdAt,
              stripLargeBase64ForSheetCell(u),
            ]),
          ],
        },
      ];

      // Clear old rows first so deletions are cleanly reflected in Google Sheets
      await this.sheetsClient.spreadsheets.values.batchClear({
        spreadsheetId: this.sheetId,
        requestBody: {
          ranges: ALL_ERP_SHEET_TABS.map(tab => `${tab}!A1:Z2000`),
        },
      });

      await this.sheetsClient.spreadsheets.values.batchUpdate({
        spreadsheetId: this.sheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: dataPayload,
        },
      });

      this.lastSyncAt = new Date().toISOString();
      this.lastError = null;
      return {
        success: true,
        message: `Synchronized all ${ALL_ERP_SHEET_TABS.length} tabs to Google Spreadsheet "${this.spreadsheetTitle}".`,
      };
    } catch (err: any) {
      this.lastError = err.message;
      return { success: false, message: `Sync failed: ${err.message}` };
    }
  }

  public async syncToGoogleSheets(): Promise<{ success: boolean; message: string }> {
    return this.enqueueWrite(() => this.internalSyncToGoogleSheets());
  }

  // --- Masters: Config & Branding ---
  public getSchoolConfig() { return this.config; }
  public async updateSchoolConfig(newConfig: Partial<SchoolConfig>) {
    return this.enqueueWrite(async () => {
      this.config = { ...this.config, ...newConfig };
      await this.internalSyncToGoogleSheets();
      return this.config;
    });
  }

  // --- Masters: Campuses ---
  public getCampuses() { return this.campusesMaster; }
  public async addCampus(data: Partial<CampusMaster>) {
    return this.enqueueWrite(async () => {
      const name = data.name?.trim();
      const code = data.code?.trim();
      if (!name || !code) {
        throw new Error('Campus Name and Short Code (e.g. Sr or Jr) are required.');
      }
      if (this.campusesMaster.some(c => c.code.toLowerCase() === code.toLowerCase() || c.name.toLowerCase() === name.toLowerCase())) {
        throw new Error(`Campus with name "${name}" or code "${code}" already exists.`);
      }
      const newCampus: CampusMaster = {
        id: `cmp-${Date.now()}`,
        name,
        code,
        address: data.address?.trim() || '',
      };
      this.campusesMaster.push(newCampus);
      this.config.campuses = [...this.campusesMaster];
      await this.internalSyncToGoogleSheets();
      return this.campusesMaster;
    });
  }
  public async removeCampus(id: string) {
    return this.enqueueWrite(async () => {
      const campus = this.campusesMaster.find(c => c.id === id || c.code === id);
      if (!campus) return this.campusesMaster;

      const linkedRoutes = this.routes.filter(
        r => r.campus === campus.id || r.campus === campus.code || r.campusCode === campus.code || r.campus === campus.name
      );
      const linkedMembers = this.students.filter(
        s => s.campus === campus.id || s.campus === campus.code || s.campus === campus.name
      );
      const linkedTrips = this.trips.filter(
        t => t.campus === campus.id || t.campus === campus.code || t.campus === campus.name
      );

      if (linkedRoutes.length > 0 || linkedMembers.length > 0 || linkedTrips.length > 0) {
        const deps: string[] = [];
        if (linkedRoutes.length > 0) deps.push(`${linkedRoutes.length} route(s)`);
        if (linkedMembers.length > 0) deps.push(`${linkedMembers.length} member(s)`);
        if (linkedTrips.length > 0) deps.push(`${linkedTrips.length} daily trip(s)`);
        throw new Error(
          `Cannot delete Campus "${campus.name} (${campus.code})" because it is linked to ${deps.join(' and ')}. Please clear all its dependencies first.`
        );
      }

      this.campusesMaster = this.campusesMaster.filter(c => c.id !== campus.id);
      this.config.campuses = [...this.campusesMaster];
      await this.internalSyncToGoogleSheets();
      return this.campusesMaster;
    });
  }

  // --- Masters: Member Types ---
  public getMemberTypes() { return this.memberTypesMaster; }
  public async addMemberType(name: string) {
    return this.enqueueWrite(async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Member Type name is required.');
      if (this.memberTypesMaster.some(mt => mt.name.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error(`Member Type "${trimmed}" already exists.`);
      }
      this.memberTypesMaster.push({
        id: `mt-${Date.now()}`,
        name: trimmed,
      });
      await this.internalSyncToGoogleSheets();
      return this.memberTypesMaster;
    });
  }
  public async removeMemberType(id: string) {
    return this.enqueueWrite(async () => {
      const mt = this.memberTypesMaster.find(m => m.id === id || m.name === id);
      if (!mt) return this.memberTypesMaster;

      const linkedMembers = this.students.filter(s => s.memberType === mt.name);
      if (linkedMembers.length > 0) {
        throw new Error(
          `Cannot delete Member Type "${mt.name}" because ${linkedMembers.length} member(s) are assigned this type. Please clear all its dependencies first.`
        );
      }

      this.memberTypesMaster = this.memberTypesMaster.filter(m => m.id !== mt.id);
      await this.internalSyncToGoogleSheets();
      return this.memberTypesMaster;
    });
  }

  // --- Masters: Classes & Sections ---
  public getClasses() { return this.classesMaster; }
  public async addClass(className: string) {
    return this.enqueueWrite(async () => {
      const trimmed = className.trim();
      if (trimmed && !this.classesMaster.includes(trimmed)) {
        this.classesMaster.push(trimmed);
        await this.internalSyncToGoogleSheets();
      }
      return this.classesMaster;
    });
  }
  public async removeClass(className: string) {
    return this.enqueueWrite(async () => {
      const linkedMembers = this.students.filter(s => s.class === className);
      if (linkedMembers.length > 0) {
        throw new Error(
          `Cannot delete Class "${className}" because ${linkedMembers.length} member(s) are enrolled in this class. Please clear all its dependencies first.`
        );
      }
      this.classesMaster = this.classesMaster.filter(c => c !== className);
      await this.internalSyncToGoogleSheets();
      return this.classesMaster;
    });
  }

  public getSections() { return this.sectionsMaster; }
  public async addSection(sectionName: string) {
    return this.enqueueWrite(async () => {
      const trimmed = sectionName.trim();
      if (trimmed && !this.sectionsMaster.includes(trimmed)) {
        this.sectionsMaster.push(trimmed);
        await this.internalSyncToGoogleSheets();
      }
      return this.sectionsMaster;
    });
  }
  public async removeSection(sectionName: string) {
    return this.enqueueWrite(async () => {
      const linkedMembers = this.students.filter(s => s.section === sectionName);
      if (linkedMembers.length > 0) {
        throw new Error(
          `Cannot delete Section "${sectionName}" because ${linkedMembers.length} member(s) are enrolled in this section. Please clear all its dependencies first.`
        );
      }
      this.sectionsMaster = this.sectionsMaster.filter(s => s !== sectionName);
      await this.internalSyncToGoogleSheets();
      return this.sectionsMaster;
    });
  }

  // --- Masters: Trips Master ---
  public getTripsMaster() { return this.tripsMaster; }
  public async addTripMaster(trip: Partial<TripMaster>) {
    return this.enqueueWrite(async () => {
      const num = Number(trip.tripNumber) || (this.tripsMaster.length + 1);
      const existing = this.tripsMaster.find(t => t.tripNumber === num);
      if (existing) {
        existing.description = trip.description || existing.description;
      } else {
        this.tripsMaster.push({
          id: `trp-${Date.now()}`,
          tripNumber: num,
          description: trip.description || `Trip ${num}`,
        });
      }
      this.tripsMaster.sort((a, b) => a.tripNumber - b.tripNumber);
      await this.internalSyncToGoogleSheets();
      return this.tripsMaster;
    });
  }
  public async removeTripMaster(id: string) {
    return this.enqueueWrite(async () => {
      const tripObj = this.tripsMaster.find(t => t.id === id);
      if (tripObj) {
        const linkedRoutes = this.routes.filter(r => r.tripNumber === tripObj.tripNumber);
        if (linkedRoutes.length > 0) {
          throw new Error(
            `Cannot delete Trip ${tripObj.tripNumber} because ${linkedRoutes.length} route(s) are linked to this trip number. Please clear all its dependencies first.`
          );
        }
      }
      this.tripsMaster = this.tripsMaster.filter(t => t.id !== id);
      await this.internalSyncToGoogleSheets();
      return this.tripsMaster;
    });
  }

  // --- Masters: Designations & Permissions ---
  public getDesignationsMaster() { return this.designationsMaster; }
  public async saveDesignation(des: Partial<DesignationMaster>) {
    return this.enqueueWrite(async () => {
      if (des.id) {
        const idx = this.designationsMaster.findIndex(d => d.id === des.id);
        if (idx >= 0) {
          this.designationsMaster[idx] = { ...this.designationsMaster[idx], ...des } as DesignationMaster;
          await this.internalSyncToGoogleSheets();
          return this.designationsMaster[idx];
        }
      }
      const newDes: DesignationMaster = {
        id: `des-${Date.now()}`,
        name: des.name || 'New Designation',
        isDriver: !!des.isDriver,
        description: des.description || '',
        permissions: des.permissions || {
          manageMasters: false,
          manageMembers: true,
          manageEmployees: false,
          manageLogBook: true,
          manageExpenses: false,
          manageFees: false,
          manageAttendance: true,
          viewAccounts: false,
          postVouchers: false,
          viewReports: false,
        },
      };
      this.designationsMaster.push(newDes);
      await this.internalSyncToGoogleSheets();
      return newDes;
    });
  }

  // --- System Users & Authentication ---
  public getUsers(): SystemUser[] {
    return this.systemUsers;
  }

  public async authenticateUser(username: string, password: string): Promise<SystemUser> {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();
    if (!cleanUser || !cleanPass) {
      throw new Error('Please enter both username and password.');
    }
    const found = this.systemUsers.find(
      u => u.username.toLowerCase() === cleanUser && u.password === cleanPass
    );
    if (!found) {
      throw new Error('Invalid username or password. Please check your credentials and try again.');
    }
    if (found.status !== 'Active') {
      throw new Error(`Account "${found.username}" is currently disabled. Please contact the Administrator.`);
    }
    found.lastLoginAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await this.internalSyncToGoogleSheets();
    return found;
  }

  public async saveUser(data: Partial<SystemUser>): Promise<SystemUser> {
    return this.enqueueWrite(async () => {
      const username = (data.username || '').trim();
      const fullName = (data.fullName || '').trim();
      const password = (data.password || '').trim();
      const role: UserRole =
        data.role === 'Admin' || data.role === 'Transport Coordinator' || data.role === 'Transport Assistant'
          ? data.role
          : 'Transport Assistant';

      if (!username) throw new Error('Username is required.');
      if (!fullName) throw new Error('Full Name is required.');
      if (!password || password.length < 4) {
        throw new Error('Password must be at least 4 characters long.');
      }

      const duplicate = this.systemUsers.find(
        u => u.username.toLowerCase() === username.toLowerCase() && u.id !== data.id
      );
      if (duplicate) {
        throw new Error(`Username "${username}" is already taken by ${duplicate.fullName}.`);
      }

      if (data.id) {
        const idx = this.systemUsers.findIndex(u => u.id === data.id);
        if (idx >= 0) {
          this.systemUsers[idx] = {
            ...this.systemUsers[idx],
            username,
            fullName,
            password,
            role,
            campus: data.campus || this.systemUsers[idx].campus || 'All Campuses',
            mobile: data.mobile ?? this.systemUsers[idx].mobile ?? '',
            email: data.email ?? this.systemUsers[idx].email ?? '',
            status: data.status || this.systemUsers[idx].status || 'Active',
          };
          await this.internalSyncToGoogleSheets();
          return this.systemUsers[idx];
        }
      }

      const newUser: SystemUser = {
        id: `usr-${Date.now()}`,
        username,
        password,
        fullName,
        role,
        campus: data.campus || 'All Campuses',
        mobile: data.mobile || '',
        email: data.email || '',
        status: data.status || 'Active',
        createdAt: new Date().toISOString().split('T')[0],
      };
      this.systemUsers.push(newUser);
      await this.internalSyncToGoogleSheets();
      return newUser;
    });
  }

  public async deleteUser(id: string): Promise<{ success: boolean }> {
    return this.enqueueWrite(async () => {
      const target = this.systemUsers.find(u => u.id === id);
      if (!target) return { success: true };

      if (target.role === 'Admin') {
        const activeAdmins = this.systemUsers.filter(u => u.role === 'Admin' && u.status === 'Active');
        if (activeAdmins.length <= 1) {
          throw new Error('Cannot delete the last active Admin account.');
        }
      }

      this.systemUsers = this.systemUsers.filter(u => u.id !== id);
      await this.internalSyncToGoogleSheets();
      return { success: true };
    });
  }

  public async removeDesignation(id: string) {
    return this.enqueueWrite(async () => {
      const des = this.designationsMaster.find(d => d.id === id);
      if (des) {
        const linkedEmps = this.employees.filter(e => e.designationId === id || e.designation === des.name);
        if (linkedEmps.length > 0) {
          throw new Error(
            `Cannot delete Designation "${des.name}" because ${linkedEmps.length} employee(s) hold this designation. Please clear all its dependencies first.`
          );
        }
      }
      this.designationsMaster = this.designationsMaster.filter(d => d.id !== id);
      await this.internalSyncToGoogleSheets();
      return this.designationsMaster;
    });
  }

  // --- Masters: Villages & Transport Stops ---
  public getVillages() { return this.villages; }
  public async saveVillage(villageData: Partial<Village> & { stops?: Partial<TransportStop>[] }): Promise<Village> {
    return this.enqueueWrite(async () => {
      const stops: TransportStop[] = (villageData.stops || []).map((s, idx) => ({
        id: s.id || `stp-${Date.now()}-${idx}`,
        name: s.name?.trim() || `Stop ${idx + 1}`,
        fee: Number(s.fee) || 700,
        distanceKm: Number(s.distanceKm) || Number(villageData.distanceKm) || 5,
        landmark: s.landmark || '',
      }));

      if (villageData.id) {
        const idx = this.villages.findIndex(v => v.id === villageData.id);
        if (idx >= 0) {
          const existingVillage = this.villages[idx];
          // Check if any stop was removed that has linked members
          const newStopIds = new Set(stops.map(s => s.id));
          const newStopNames = new Set(stops.map(s => s.name));
          for (const oldStop of existingVillage.stops) {
            if (!newStopIds.has(oldStop.id) && !newStopNames.has(oldStop.name)) {
              const linkedMembers = this.students.filter(
                m => m.pickupDropStopId === oldStop.id || (m.villageId === existingVillage.id && m.pickupDropStopName === oldStop.name)
              );
              if (linkedMembers.length > 0) {
                throw new Error(
                  `Cannot remove stop "${oldStop.name}" because ${linkedMembers.length} member(s) use it as their Pickup & Drop point. Please clear all its dependencies first.`
                );
              }
            }
          }

          this.villages[idx] = {
            ...existingVillage,
            name: villageData.name?.trim() || existingVillage.name,
            distanceKm: Number(villageData.distanceKm) || existingVillage.distanceKm,
            stops,
          };

          // Cascade updated stop fee to all members attached to each stop (effective for upcoming months without altering past invoices)
          for (const st of stops) {
            for (const member of this.students) {
              if (
                member.pickupDropStopId === st.id ||
                (member.villageId === existingVillage.id && member.pickupDropStopName === st.name)
              ) {
                member.monthlyFee = Number(st.fee) || member.monthlyFee;
                member.pickupDropStopName = st.name;
              }
            }
          }

          await this.internalSyncToGoogleSheets();
          return this.villages[idx];
        }
      }

      const newVillage: Village = {
        id: `vil-${Date.now()}`,
        name: villageData.name?.trim() || 'New Village',
        distanceKm: Number(villageData.distanceKm) || 5,
        stops,
      };

      this.villages.push(newVillage);
      await this.internalSyncToGoogleSheets();
      return newVillage;
    });
  }

  public async deleteVillage(id: string) {
    return this.enqueueWrite(async () => {
      const vil = this.villages.find(v => v.id === id);
      if (vil) {
        const linkedRoutes = this.routes.filter(
          r => r.villageIds.includes(id) || r.villageNames.includes(vil.name)
        );
        const linkedMembers = this.students.filter(
          s => s.villageId === id || s.villageName === vil.name
        );
        if (linkedRoutes.length > 0 || linkedMembers.length > 0) {
          const deps: string[] = [];
          if (linkedRoutes.length > 0) deps.push(`${linkedRoutes.length} route(s)`);
          if (linkedMembers.length > 0) deps.push(`${linkedMembers.length} member(s)`);
          throw new Error(
            `Cannot delete Village "${vil.name}" because it is linked to ${deps.join(' and ')}. Please clear all its dependencies first.`
          );
        }
      }
      this.villages = this.villages.filter(v => v.id !== id);
      await this.internalSyncToGoogleSheets();
      return { success: true };
    });
  }

  // --- Masters: Vehicles ---
  public getVehicles() { return this.vehicles; }
  public async saveVehicle(vehicleData: Partial<Vehicle>): Promise<Vehicle> {
    return this.enqueueWrite(async () => {
      const reg = vehicleData.registrationNumber?.trim().toUpperCase() || 'UP 70 BT 0000';

      const mileageThreshold =
        Number(vehicleData.expectedMileageKmPerL) ||
        Number(vehicleData.baselineMileageKmPerLitre) ||
        7;

      if (vehicleData.id) {
        const idx = this.vehicles.findIndex(v => v.id === vehicleData.id);
        if (idx >= 0) {
          this.vehicles[idx] = {
            ...this.vehicles[idx],
            ...vehicleData,
            registrationNumber: reg,
            currentOdometer: Number(vehicleData.currentOdometer) || this.vehicles[idx].currentOdometer || 0,
            expectedMileageKmPerL: mileageThreshold,
            baselineMileageKmPerLitre: mileageThreshold,
          } as Vehicle;
          await this.internalSyncToGoogleSheets();
          return this.vehicles[idx];
        }
      }

      const newVehicle: Vehicle = {
        id: `veh-${Date.now()}`,
        registrationNumber: reg,
        type: vehicleData.type || 'Bus',
        capacity: Number(vehicleData.capacity) || 40,
        ownership: vehicleData.ownership || 'School-Owned',
        ownerName: vehicleData.ownerName || 'School',
        condition: vehicleData.condition || 'Good',
        registrationValidity: vehicleData.registrationValidity || '2030-12-31',
        taxPaidUpto: vehicleData.taxPaidUpto || '2027-03-31',
        fitnessUpto: vehicleData.fitnessUpto || '2027-05-30',
        insuranceUpto: vehicleData.insuranceUpto || '2027-08-15',
        pollutionUpto: vehicleData.pollutionUpto || '2026-12-31',
        permitUpto: vehicleData.permitUpto || '2028-10-20',
        fuelType: vehicleData.fuelType || 'Diesel',
        currentOdometer: Number(vehicleData.currentOdometer) || 0,
        expectedMileageKmPerL: mileageThreshold,
        baselineMileageKmPerLitre: mileageThreshold,
        availability: vehicleData.availability || 'Available',
        assignedDriverId: vehicleData.assignedDriverId,
        assignedDriverName: vehicleData.assignedDriverName,
      };

      this.vehicles.push(newVehicle);
      await this.internalSyncToGoogleSheets();
      return newVehicle;
    });
  }

  public async deleteVehicle(id: string) {
    return this.enqueueWrite(async () => {
      const veh = this.vehicles.find(v => v.id === id);
      if (veh) {
        const linkedRoutes = this.routes.filter(
          r => r.vehicleId === id || r.vehicleNumber === veh.registrationNumber
        );
        const linkedLogs = this.odometerLogs.filter(
          o => o.vehicleId === id || o.vehicleNumber === veh.registrationNumber
        );
        const linkedFuel = this.fuelAdvances.filter(
          f => f.vehicleId === id || f.vehicleNumber === veh.registrationNumber
        );
        const linkedMaint = this.maintenance.filter(
          m => m.vehicleId === id || m.vehicleNumber === veh.registrationNumber
        );
        const linkedExp = this.expenses.filter(
          e => e.vehicleNumber === veh.registrationNumber
        );

        const deps: string[] = [];
        if (linkedRoutes.length > 0) deps.push(`${linkedRoutes.length} route(s)`);
        if (linkedLogs.length > 0) deps.push(`${linkedLogs.length} logbook record(s)`);
        if (linkedFuel.length > 0) deps.push(`${linkedFuel.length} fuel advance(s)`);
        if (linkedMaint.length > 0) deps.push(`${linkedMaint.length} maintenance record(s)`);
        if (linkedExp.length > 0) deps.push(`${linkedExp.length} expense record(s)`);

        if (deps.length > 0) {
          throw new Error(
            `Cannot delete Vehicle "${veh.registrationNumber}" because it is linked to ${deps.join(', ')}. Please clear all its dependencies first.`
          );
        }
      }
      this.vehicles = this.vehicles.filter(v => v.id !== id);
      await this.internalSyncToGoogleSheets();
      return { success: true };
    });
  }

  // --- Masters: Vehicle, Driver & Helper Assignment with Date History ---
  public getVehicleAssignments() {
    return this.vehicleAssignments;
  }

  public async assignVehicleDriverHelper(payload: {
    vehicleId: string;
    driverId: string;
    helperId?: string;
    fromDate: string;
    toDate?: string;
    remarks?: string;
    assignedBy?: string;
  }): Promise<VehicleAssignmentRecord> {
    return this.enqueueWrite(async () => {
      const vehicle = this.vehicles.find(v => v.id === payload.vehicleId);
      if (!vehicle) throw new Error('Vehicle not found.');
      const driver = this.employees.find(e => e.id === payload.driverId);
      if (!driver) throw new Error('Driver not found in Employees.');
      const helper = payload.helperId ? this.employees.find(e => e.id === payload.helperId) : undefined;

      const effectiveFrom = payload.fromDate || new Date().toISOString().split('T')[0];

      // Close any existing active assignment for this vehicle with toDate = effectiveFrom
      for (const rec of this.vehicleAssignments) {
        if (rec.vehicleId === vehicle.id && rec.status === 'Active') {
          rec.status = 'Historical';
          if (!rec.toDate) {
            rec.toDate = effectiveFrom;
            rec.endDate = effectiveFrom;
          }
        }
      }

      // Update current vehicle master fields
      vehicle.assignedDriverId = driver.id;
      vehicle.assignedDriverName = driver.name;
      vehicle.assignedHelperId = helper?.id;
      vehicle.assignedHelperName = helper?.name;

      // Also update scheduled services for this vehicle
      for (const svc of this.scheduledServices) {
        if (svc.vehicleNumber === vehicle.registrationNumber) {
          svc.driverName = driver.name;
          if (helper) svc.helperName = helper.name;
        }
      }

      const newAssignment: VehicleAssignmentRecord = {
        id: `va-${Date.now()}`,
        vehicleId: vehicle.id,
        vehicleNumber: vehicle.registrationNumber,
        driverId: driver.id,
        driverName: driver.name,
        helperId: helper?.id,
        helperName: helper?.name,
        fromDate: effectiveFrom,
        startDate: effectiveFrom,
        toDate: payload.toDate || undefined,
        endDate: payload.toDate || undefined,
        status: payload.toDate ? 'Historical' : 'Active',
        assignedBy: payload.assignedBy || 'Admin',
        remarks: payload.remarks || 'Driver & Helper linked via Masters',
      };

      this.vehicleAssignments.unshift(newAssignment);
      await this.internalSyncToGoogleSheets();
      return newAssignment;
    });
  }

  // --- Masters: Routes (Nomenclature Rule: Campus/VehicleLast4/Trip e.g. Sr/7175/1) ---
  public getRoutes() { return this.routes; }
  public async saveRoute(routeData: {
    id?: string;
    campus: CampusId;
    vehicleId: string;
    tripNumber: number;
    villageIds: string[];
    active?: boolean;
  }): Promise<Route> {
    return this.enqueueWrite(async () => {
      const vehicle = this.vehicles.find(v => v.id === routeData.vehicleId);
      if (!vehicle) throw new Error('Vehicle not found. Please select a valid vehicle from Vehicle Master.');

      // Extract last 4 digits of vehicle
      const digitsOnly = vehicle.registrationNumber.replace(/\D/g, '');
      const vehicleLast4 = digitsOnly.length >= 4 
        ? digitsOnly.slice(-4) 
        : vehicle.registrationNumber.slice(-4).replace(/\s/g, '');

      // Look up Campus from Campus Master
      const matchedCampus = this.campusesMaster.find(
        c => c.id === routeData.campus || c.code === routeData.campus || c.name === routeData.campus
      );
      const campusCode = matchedCampus ? matchedCampus.code : (routeData.campus || 'Cmp');
      const tripNum = Number(routeData.tripNumber) || 1;

      // Nomenclature formula: Campus/VehicleLast4/Trip (e.g. "Sr/7175/1")
      const routeCode = `${campusCode}/${vehicleLast4}/${tripNum}`;

      const villageNames = routeData.villageIds
        .map(id => this.villages.find(v => v.id === id)?.name)
        .filter(Boolean) as string[];

      if (routeData.id) {
        const idx = this.routes.findIndex(r => r.id === routeData.id);
        if (idx >= 0) {
          this.routes[idx] = {
            ...this.routes[idx],
            code: routeCode,
            campus: matchedCampus ? matchedCampus.code : routeData.campus,
            campusCode,
            vehicleId: vehicle.id,
            vehicleNumber: vehicle.registrationNumber,
            vehicleLast4,
            tripNumber: tripNum,
            villageIds: routeData.villageIds,
            villageNames,
            active: routeData.active !== undefined ? routeData.active : true,
          };
          await this.internalSyncToGoogleSheets();
          return this.routes[idx];
        }
      }

      const newRoute: Route = {
        id: `rot-${Date.now()}`,
        code: routeCode,
        campus: matchedCampus ? matchedCampus.code : routeData.campus,
        campusCode,
        vehicleId: vehicle.id,
        vehicleNumber: vehicle.registrationNumber,
        vehicleLast4,
        tripNumber: tripNum,
        villageIds: routeData.villageIds,
        villageNames,
        active: routeData.active !== undefined ? routeData.active : true,
      };

      this.routes.push(newRoute);
      await this.internalSyncToGoogleSheets();
      return newRoute;
    });
  }

  public async deleteRoute(id: string) {
    return this.enqueueWrite(async () => {
      const rt = this.routes.find(r => r.id === id);
      if (rt) {
        const linkedMembers = this.students.filter(
          s => s.routeId === id || s.routeCode === rt.code
        );
        const linkedTrips = this.trips.filter(t => t.routeId === id);
        if (linkedMembers.length > 0 || linkedTrips.length > 0) {
          const deps: string[] = [];
          if (linkedMembers.length > 0) deps.push(`${linkedMembers.length} member(s)`);
          if (linkedTrips.length > 0) deps.push(`${linkedTrips.length} daily trip(s)`);
          throw new Error(
            `Cannot delete Route "${rt.code}" because it is linked to ${deps.join(' and ')}. Please clear all its dependencies first.`
          );
        }
      }
      this.routes = this.routes.filter(r => r.id !== id);
      await this.internalSyncToGoogleSheets();
      return { success: true };
    });
  }

  // --- Scheduled Services (Routes & Trips Demo Mechanism) ---
  public getScheduledServices(): ScheduledService[] {
    return this.scheduledServices;
  }

  // --- Candidate Resumes (Entry Point for Employees) ---
  public getResumes(): CandidateResume[] {
    return this.resumes;
  }

  public async saveResume(data: Partial<CandidateResume>): Promise<CandidateResume> {
    return this.enqueueWrite(async () => {
      if (!data.name?.trim()) throw new Error('Candidate Name is mandatory.');
      if (!data.age || Number(data.age) <= 0) throw new Error('Age is mandatory.');
      if (!data.gender) throw new Error('Sex / Gender is mandatory.');
      if (!data.mobile?.trim()) throw new Error('Phone number is mandatory.');
      if (!data.address?.trim()) throw new Error('Address is mandatory.');

      const isDriver = !!data.isDriver || (data.appliedDesignation?.toLowerCase().includes('driver') ?? false);
      if (isDriver && !data.drivingLicenseNo?.trim()) {
        throw new Error('Driving License Number (DL No.) is mandatory for Driver candidates.');
      }

      if (data.id) {
        const idx = this.resumes.findIndex(r => r.id === data.id);
        if (idx >= 0) {
          this.resumes[idx] = {
            ...this.resumes[idx],
            ...data,
            age: Number(data.age),
            minExpectedSalary: Number(data.minExpectedSalary) || 0,
            isDriver,
          } as CandidateResume;
          await this.internalSyncToGoogleSheets();
          return this.resumes[idx];
        }
      }

      const newResume: CandidateResume = {
        id: `res-${Date.now()}`,
        candidateCode: data.candidateCode || `CAN-${(this.resumes.length + 1).toString().padStart(3, '0')}`,
        name: data.name.trim(),
        age: Number(data.age),
        gender: data.gender,
        mobile: data.mobile.trim(),
        address: data.address.trim(),
        fatherName: data.fatherName || '',
        educationQualification: data.educationQualification || '',
        appliedDesignation: data.appliedDesignation || (isDriver ? 'Driver' : 'Helper / Conductor'),
        isDriver,
        drivingLicenseNo: isDriver ? data.drivingLicenseNo?.trim() : undefined,
        drivingLicenseValidity: isDriver ? data.drivingLicenseValidity : undefined,
        drivingLicenseType: isDriver ? (data.drivingLicenseType || 'Heavy Passenger Vehicle (HMV)') : undefined,
        minExpectedSalary: Number(data.minExpectedSalary) || 0,
        experience: data.experience || '',
        policeRecord: data.policeRecord || 'None',
        description: data.description || '',
        status: data.status || 'Resume received',
        documents: data.documents || [],
        appliedDate: data.appliedDate || new Date().toISOString().split('T')[0],
      };

      this.resumes.unshift(newResume);
      await this.internalSyncToGoogleSheets();
      return newResume;
    });
  }

  public async deleteResume(id: string) {
    return this.enqueueWrite(async () => {
      const res = this.resumes.find(r => r.id === id);
      if (res && res.hiredEmployeeId) {
        const linkedEmp = this.employees.find(e => e.id === res.hiredEmployeeId);
        if (linkedEmp) {
          throw new Error(`Cannot delete Resume "${res.name}" because they are already onboarded as Employee (${linkedEmp.employeeCode}).`);
        }
      }
      this.resumes = this.resumes.filter(r => r.id !== id);
      await this.internalSyncToGoogleSheets();
      return { success: true };
    });
  }

  public async hireResumeAsEmployee(resumeId: string, salaryOverride?: number, designationIdOverride?: string): Promise<Employee> {
    return this.enqueueWrite(async () => {
      const resume = this.resumes.find(r => r.id === resumeId);
      if (!resume) throw new Error('Candidate resume not found.');
      if (resume.status !== 'Eligible') {
        throw new Error('Only candidates marked as "Eligible" can be onboarded into Employees.');
      }
      if (resume.hiredEmployeeId) {
        const existing = this.employees.find(e => e.id === resume.hiredEmployeeId);
        if (existing) throw new Error(`Candidate "${resume.name}" is already onboarded as ${existing.employeeCode}.`);
      }

      const matchedDes = this.designationsMaster.find(
        d => d.id === designationIdOverride || d.name.toLowerCase() === resume.appliedDesignation.toLowerCase()
      ) || this.designationsMaster[0];

      const isDriver = resume.isDriver || (matchedDes?.isDriver ?? false);
      const newEmp: Employee = {
        id: `emp-${Date.now()}`,
        employeeCode: `EMP-${(this.employees.length + 1).toString().padStart(3, '0')}`,
        resumeId: resume.id,
        name: resume.name,
        designationId: matchedDes?.id || 'des-driver',
        designation: matchedDes?.name || resume.appliedDesignation,
        isDriver,
        drivingLicenseNo: resume.drivingLicenseNo,
        drivingLicenseValidity: resume.drivingLicenseValidity,
        drivingLicenseType: resume.drivingLicenseType,
        age: resume.age,
        gender: resume.gender,
        mobile: resume.mobile,
        address: resume.address,
        fatherName: resume.fatherName || '',
        educationQualification: resume.educationQualification || '10th Standard',
        experience: resume.experience,
        policeRecord: resume.policeRecord,
        description: resume.description,
        status: 'Active',
        monthlyBaseSalary: Number(salaryOverride) || resume.minExpectedSalary || 12000,
        documents: [...(resume.documents || [])],
        joiningDate: new Date().toISOString().split('T')[0],
      };

      this.employees.push(newEmp);
      resume.hiredEmployeeId = newEmp.id;
      await this.internalSyncToGoogleSheets();
      return newEmp;
    });
  }

  // --- Employees & Drivers ---
  public getEmployees() { return this.employees; }
  public async saveEmployee(emp: Partial<Employee>): Promise<Employee> {
    return this.enqueueWrite(async () => {
      const isDriver = emp.isDriver || (emp.designation?.toLowerCase().includes('driver') ?? false);
      if (isDriver && !emp.drivingLicenseNo) {
        throw new Error('Driving License Number is required for employee with Driver designation.');
      }

      if (emp.id) {
        const idx = this.employees.findIndex(e => e.id === emp.id);
        if (idx >= 0) {
          this.employees[idx] = {
            ...this.employees[idx],
            ...emp,
            isDriver,
          } as Employee;
          await this.internalSyncToGoogleSheets();
          return this.employees[idx];
        }
      }

      const newEmp: Employee = {
        id: `emp-${Date.now()}`,
        employeeCode: emp.employeeCode || `EMP-${(this.employees.length + 1).toString().padStart(3, '0')}`,
        resumeId: emp.resumeId,
        name: emp.name || 'New Staff',
        designationId: emp.designationId || 'des-driver',
        designation: emp.designation || (isDriver ? 'Driver' : 'Staff'),
        isDriver,
        drivingLicenseNo: emp.drivingLicenseNo,
        drivingLicenseValidity: emp.drivingLicenseValidity,
        drivingLicenseType: emp.drivingLicenseType || (isDriver ? 'Heavy Passenger Vehicle (HMV)' : undefined),
        age: Number(emp.age) || 30,
        gender: emp.gender || 'M',
        mobile: emp.mobile || '',
        address: emp.address || '',
        fatherName: emp.fatherName || '',
        educationQualification: emp.educationQualification || '10th Standard',
        experience: emp.experience,
        policeRecord: emp.policeRecord,
        description: emp.description,
        status: emp.status || 'Active',
        monthlyBaseSalary: Number(emp.monthlyBaseSalary) || 12000,
        documents: emp.documents || [],
        resumeAttachment: emp.resumeAttachment,
        joiningDate: emp.joiningDate || new Date().toISOString().split('T')[0],
      };

      this.employees.push(newEmp);
      await this.internalSyncToGoogleSheets();
      return newEmp;
    });
  }

  public async deleteEmployee(id: string) {
    return this.enqueueWrite(async () => {
      const emp = this.employees.find(e => e.id === id);
      if (emp) {
        const linkedVehicles = this.vehicles.filter(
          v => v.assignedDriverId === id || v.assignedDriverName === emp.name
        );
        const linkedLogs = this.odometerLogs.filter(o => o.driverName === emp.name);
        const linkedAdvances = this.fuelAdvances.filter(f => f.driverName === emp.name);
        const deps: string[] = [];
        if (linkedVehicles.length > 0) deps.push(`${linkedVehicles.length} vehicle(s)`);
        if (linkedLogs.length > 0) deps.push(`${linkedLogs.length} logbook entry/entries`);
        if (linkedAdvances.length > 0) deps.push(`${linkedAdvances.length} fuel advance(s)`);
        if (deps.length > 0) {
          throw new Error(
            `Cannot delete Employee "${emp.name}" because they are linked to ${deps.join(', ')}. Please clear all dependencies first.`
          );
        }
        // Clear hiredEmployeeId link on resume if deleted
        const linkedResume = this.resumes.find(r => r.hiredEmployeeId === id);
        if (linkedResume) linkedResume.hiredEmployeeId = undefined;
      }
      this.employees = this.employees.filter(e => e.id !== id);
      await this.internalSyncToGoogleSheets();
      return { success: true };
    });
  }

  // --- Members (Students & Staff) ---
  public getStudents(filters?: { campus?: string; status?: string; query?: string }) {
    let result = [...this.students];
    if (filters?.campus && filters.campus !== 'all') {
      result = result.filter(s => s.campus === filters.campus);
    }
    if (filters?.status && filters.status !== 'all') {
      result = result.filter(s => s.transportStatus === filters.status);
    }
    if (filters?.query) {
      const q = filters.query.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        s.routeCode.toLowerCase().includes(q) ||
        s.villageName.toLowerCase().includes(q) ||
        s.pickupDropStopName.toLowerCase().includes(q)
      );
    }
    return result;
  }

  public async saveStudent(data: Partial<StudentMember>): Promise<StudentMember> {
    return this.enqueueWrite(async () => {
      const stopName = data.pickupDropStopName || 'Assigned Stop';
      const stopId = data.pickupDropStopId || '';

      if (data.id) {
        const idx = this.students.findIndex(s => s.id === data.id);
        if (idx >= 0) {
          const existing = this.students[idx];
          const updated: StudentMember = {
            ...existing,
            ...data,
            profilePhoto: data.profilePhoto || existing.profilePhoto,
            pickupDropStopId: stopId,
            pickupDropStopName: stopName,
            morningStopId: stopId,
            morningStopName: stopName,
            eveningStopId: stopId,
            eveningStopName: stopName,
            documents: data.documents !== undefined ? data.documents : existing.documents,
            specialHistory: data.specialHistory !== undefined ? data.specialHistory : existing.specialHistory,
            activePermissionLetter: data.activePermissionLetter !== undefined ? data.activePermissionLetter : existing.activePermissionLetter,
            version: existing.version + 1,
          };
          this.students[idx] = updated;
          await this.internalSyncToGoogleSheets();
          return updated;
        }
      }

      if (!data.profilePhoto) {
        throw new Error('Display Picture (DP) attachment is compulsory when adding a member.');
      }

      const newStudent: StudentMember = {
        id: `stu-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        admissionNo: data.admissionNo || `ADM-${Date.now().toString().slice(-4)}`,
        name: data.name || 'New Member',
        profilePhoto: data.profilePhoto,
        memberType: data.memberType || '',
        class: data.class || '',
        section: data.section || '',
        gender: data.gender || 'M',
        campus: data.campus || '',
        academicSession: data.academicSession || this.config.currentAcademicSession || '2026-27',
        fatherName: data.fatherName || '',
        mobile: data.mobile || '',
        address: data.address || '',
        routeId: data.routeId || '',
        routeCode: data.routeCode || '',
        villageId: data.villageId || '',
        villageName: data.villageName || '',
        pickupDropStopId: stopId,
        pickupDropStopName: stopName,
        morningStopId: stopId,
        morningStopName: stopName,
        eveningStopId: stopId,
        eveningStopName: stopName,
        serviceType: 'both',
        transportStatus: data.transportStatus || 'Active',
        statusReason: data.statusReason,
        emergencyContact: data.emergencyContact || data.mobile || '',
        monthlyFee: Number(data.monthlyFee) || 700,
        concessionAmount: Number(data.concessionAmount) || 0,
        balanceDue: Number(data.balanceDue) || 0,
        joiningDate: data.joiningDate || new Date().toISOString().split('T')[0],
        documents: data.documents || [],
        specialHistory: data.specialHistory || [],
        version: 1,
      };

      this.students.unshift(newStudent);
      await this.internalSyncToGoogleSheets();
      return newStudent;
    });
  }

  public async deleteStudent(id: string) {
    return this.enqueueWrite(async () => {
      this.students = this.students.filter(s => s.id !== id);
      await this.internalSyncToGoogleSheets();
      return { success: true };
    });
  }

  public async reactivateMember(studentId: string, authorizedBy: string, reason: string): Promise<StudentMember> {
    return this.enqueueWrite(async () => {
      const student = this.students.find(s => s.id === studentId);
      if (!student) throw new Error('Member not found');
      const today = new Date().toISOString().split('T')[0];
      student.transportStatus = 'Active';
      student.statusReason = `Reactivated by ${authorizedBy} on ${today}. Reason: ${reason}`;
      student.pendingSuspensionRequest = undefined;
      const evt: SuspensionAndPermissionEvent = {
        id: `spc-${Date.now()}`,
        date: today,
        eventType: 'Revoked_Dues_Cleared',
        reason,
        authorizedBy,
        overdueAmountAtTime: student.balanceDue,
      };
      student.specialHistory = [evt, ...(student.specialHistory || [])];
      student.version += 1;
      await this.internalSyncToGoogleSheets();
      return student;
    });
  }

  public async grantPermissionLetter(
    studentId: string,
    payload: {
      allowedUntilDate: string;
      letterAttachment: string;
      letterFileName?: string;
      approvedBy: string;
      reason: string;
    }
  ): Promise<StudentMember> {
    return this.enqueueWrite(async () => {
      const student = this.students.find(s => s.id === studentId);
      if (!student) throw new Error('Member not found');
      const today = new Date().toISOString().split('T')[0];
      const defaultUntil = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
      const allowedUntil = payload.allowedUntilDate || defaultUntil;
      const attachmentData = payload.letterAttachment || 'Permission_Letter_Verified_In_Office';

      student.transportStatus = 'Active';
      student.statusReason = `Allowed with Permission Letter until ${allowedUntil} (${payload.reason || 'Approved'})`;
      student.pendingSuspensionRequest = undefined;
      student.activePermissionLetter = {
        allowedUntilDate: allowedUntil,
        letterAttachment: attachmentData,
        letterFileName: payload.letterFileName || 'Permission_Letter.pdf',
        approvedBy: payload.approvedBy || 'Admin',
        reason: payload.reason || 'Permission Granted',
        grantedAt: today,
      };
      const evt: SuspensionAndPermissionEvent = {
        id: `spc-${Date.now()}`,
        date: today,
        eventType: 'Revoked_Permission_Letter',
        reason: payload.reason,
        authorizedBy: payload.approvedBy || 'Admin',
        overdueAmountAtTime: student.balanceDue,
        allowedUntilDate: payload.allowedUntilDate,
        letterAttachment: payload.letterAttachment,
        letterFileName: payload.letterFileName || 'Permission_Letter.pdf',
      };
      student.specialHistory = [evt, ...(student.specialHistory || [])];
      // Also archive in member's documents
      student.documents = [
        {
          id: `doc-${Date.now()}`,
          type: 'Permission Letter',
          name: payload.letterFileName || `Permission_Letter_${today}.pdf`,
          fileData: payload.letterAttachment,
          uploadedAt: today,
        },
        ...(student.documents || []),
      ];
      student.version += 1;
      await this.internalSyncToGoogleSheets();
      return student;
    });
  }

  public async suspendStudent(studentId: string, reason: string, authorizedBy = 'Admin'): Promise<StudentMember> {
    return this.enqueueWrite(async () => {
      const student = this.students.find(s => s.id === studentId);
      if (!student) throw new Error('Member not found');

      const trimmedReason = (reason || '').trim();
      if (!trimmedReason || trimmedReason.length < 3) {
        throw new Error('A valid reason is mandatory to suspend a member.');
      }

      if (authorizedBy === 'Transport Assistant') {
        throw new Error(
          'Transport Assistant is not authorized to suspend a member. Suspension can only be done by Transport Coordinator (with Admin approval) or Admin.'
        );
      }

      const today = new Date().toISOString().split('T')[0];

      // Transport Coordinator alone cannot suspend a member; it creates a Pending Approval request for Admin
      if (authorizedBy === 'Transport Coordinator') {
        student.pendingSuspensionRequest = {
          id: `susreq-${Date.now()}`,
          requestedBy: 'Transport Coordinator',
          requestedAt: today,
          reason: trimmedReason,
          status: 'Pending Approval',
        };
        const evt: SuspensionAndPermissionEvent = {
          id: `spc-${Date.now()}`,
          date: today,
          eventType: 'Suspension_Requested',
          reason: `Suspension Requested (Awaiting Admin Approval): ${trimmedReason}`,
          authorizedBy: 'Transport Coordinator',
          overdueAmountAtTime: student.balanceDue,
        };
        student.specialHistory = [evt, ...(student.specialHistory || [])];
        student.version += 1;
        await this.internalSyncToGoogleSheets();
        return student;
      }

      // Admin suspends directly (or approves)
      student.transportStatus = 'Suspended';
      student.statusReason = trimmedReason;
      student.activePermissionLetter = undefined;
      if (student.pendingSuspensionRequest) {
        student.pendingSuspensionRequest = {
          ...student.pendingSuspensionRequest,
          status: 'Approved',
          reviewedBy: 'Admin',
          reviewedAt: today,
        };
      }
      const evt: SuspensionAndPermissionEvent = {
        id: `spc-${Date.now()}`,
        date: today,
        eventType: 'Suspended',
        reason: trimmedReason,
        authorizedBy: authorizedBy || 'Admin',
        overdueAmountAtTime: student.balanceDue,
      };
      student.specialHistory = [evt, ...(student.specialHistory || [])];
      student.version += 1;
      await this.internalSyncToGoogleSheets();
      return student;
    });
  }

  public async reviewSuspensionRequest(
    studentId: string,
    action: 'Approve' | 'Reject',
    reviewedBy = 'Admin',
    rejectionReason?: string
  ): Promise<StudentMember> {
    return this.enqueueWrite(async () => {
      if (reviewedBy !== 'Admin') {
        throw new Error('Only Admin can approve or reject a member suspension request.');
      }
      const student = this.students.find(s => s.id === studentId);
      if (!student) throw new Error('Member not found');
      const req = student.pendingSuspensionRequest;
      if (!req || req.status !== 'Pending Approval') {
        throw new Error('No pending suspension request found for this member.');
      }

      const today = new Date().toISOString().split('T')[0];

      if (action === 'Approve') {
        student.transportStatus = 'Suspended';
        student.statusReason = req.reason;
        student.activePermissionLetter = undefined;
        student.pendingSuspensionRequest = {
          ...req,
          status: 'Approved',
          reviewedBy: 'Admin',
          reviewedAt: today,
        };
        const evt: SuspensionAndPermissionEvent = {
          id: `spc-${Date.now()}`,
          date: today,
          eventType: 'Suspended',
          reason: `${req.reason} (Initiated by ${req.requestedBy}, Approved by Admin)`,
          authorizedBy: 'Admin (Approved Coordinator Request)',
          overdueAmountAtTime: student.balanceDue,
        };
        student.specialHistory = [evt, ...(student.specialHistory || [])];
      } else {
        const rejNote = (rejectionReason || 'Suspension request declined by Admin').trim();
        student.pendingSuspensionRequest = {
          ...req,
          status: 'Rejected',
          reviewedBy: 'Admin',
          reviewedAt: today,
          rejectionReason: rejNote,
        };
        const evt: SuspensionAndPermissionEvent = {
          id: `spc-${Date.now()}`,
          date: today,
          eventType: 'Suspension_Rejected',
          reason: `Coordinator Suspension Request Rejected by Admin: ${rejNote} (Original reason: ${req.reason})`,
          authorizedBy: 'Admin',
          overdueAmountAtTime: student.balanceDue,
        };
        student.specialHistory = [evt, ...(student.specialHistory || [])];
      }

      student.version += 1;
      await this.internalSyncToGoogleSheets();
      return student;
    });
  }

  // --- 24-Hour Daily Log Book (No shift needed) ---
  public getOdometerLogs(vehicleId?: string) {
    if (vehicleId) return this.odometerLogs.filter(o => o.vehicleId === vehicleId);
    return this.odometerLogs;
  }

  public async recordOdometerEntry(entry: Omit<OdometerLog, 'id'>): Promise<OdometerLog> {
    return this.enqueueWrite(async () => {
      const vehicle = this.vehicles.find(v => v.id === entry.vehicleId);
      if (!vehicle) throw new Error('Vehicle not found');

      const startKm = Number(entry.startOdometer);
      const endKm = Number(entry.endOdometer);

      if (endKm < startKm) {
        throw new Error(`Ending odometer (${endKm} km) cannot be less than starting odometer (${startKm} km).`);
      }

      const tripKm = endKm - startKm;

      const newLog: OdometerLog = {
        ...entry,
        id: `odo-${Date.now()}`,
        startOdometer: startKm,
        endOdometer: endKm,
        tripKm,
        fuelLitresAdded: Number(entry.fuelLitresAdded) || 0,
        fuelCost: Number(entry.fuelCost) || 0,
        neatnessChecked: !!entry.neatnessChecked,
        recordedBy: entry.recordedBy || 'Transport Staff',
      };

      this.odometerLogs.unshift(newLog);
      vehicle.currentOdometer = endKm;

      // If fuel cost is recorded in the daily log book, automatically post a fuel expense voucher
      if (newLog.fuelCost && newLog.fuelCost > 0) {
        await this.addExpense({
          date: newLog.date,
          category: 'Fuel (Diesel / CNG)',
          vehicleId: vehicle.id,
          vehicleNumber: vehicle.registrationNumber,
          amount: newLog.fuelCost,
          paymentMode: 'Cash',
          vendorName: 'Daily Fuel Log Entry',
          narration: `Daily log book fuel entry: ${newLog.fuelLitresAdded || 0}L at ${vehicle.registrationNumber}`,
          recordedBy: newLog.recordedBy,
          requiresApproval: false,
          skipLogbookSync: true,
        });
      }

      await this.internalSyncToGoogleSheets();
      return newLog;
    });
  }

  // --- Expenses & Ledgers ---
  public getExpenses(vehicleNumber?: string, category?: string) {
    let list = [...this.expenses];
    if (vehicleNumber && vehicleNumber !== 'all') list = list.filter(e => e.vehicleNumber === vehicleNumber);
    if (category && category !== 'all') list = list.filter(e => e.category === category);
    return list;
  }

  private postApprovedExpenseSideEffects(record: ExpenseRecord, skipLogbookSync = false) {
    let debitAccountId = 'acc-502';
    let debitAccountCode = '5020';
    let debitAccountName = 'Fleet Repairs & Maintenance Expense';

    if (record.category.includes('Fuel')) {
      debitAccountId = 'acc-501';
      debitAccountCode = '5010';
      debitAccountName = 'Vehicle Fuel Expense (Diesel / CNG)';
    } else if (record.category.includes('Tax') || record.category.includes('Permit') || record.category.includes('Toll')) {
      debitAccountId = 'acc-505';
      debitAccountCode = '5050';
      debitAccountName = 'Taxes, Permits & Insurance Expense';
    } else if (record.category.includes('Rent')) {
      debitAccountId = 'acc-504';
      debitAccountCode = '5040';
      debitAccountName = 'Vehicle Rent Expense (Hired Fleet)';
    } else if (record.category.includes('Salary') || record.category.includes('Advance')) {
      debitAccountId = 'acc-503';
      debitAccountCode = '5030';
      debitAccountName = 'Drivers & Helpers Salary Expense';
    }

    const creditAccountId = record.paymentMode === 'Cash' ? 'acc-101' : 'acc-102';
    const creditAccountCode = record.paymentMode === 'Cash' ? '1010' : '1020';
    const creditAccountName = record.paymentMode === 'Cash'
      ? 'Cash in Hand (Transport Counter)'
      : 'State Bank of India - School Transport A/C';

    const vch: JournalVoucher = {
      id: `vch-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      voucherNo: `JV-${record.expenseNo}`,
      date: record.date,
      voucherType: 'Expense',
      narration: `${record.category} - ${record.narration} (Vendor: ${record.vendorName})`,
      status: 'Posted',
      totalDebit: record.amount,
      totalCredit: record.amount,
      createdBy: record.recordedBy,
      approvedBy: record.approvedBy,
      lines: [
        { accountId: debitAccountId, accountCode: debitAccountCode, accountName: debitAccountName, debit: record.amount, credit: 0, costCenter: record.vehicleNumber },
        { accountId: creditAccountId, accountCode: creditAccountCode, accountName: creditAccountName, debit: 0, credit: record.amount, partyName: record.vendorName },
      ],
    };

    const debitAcc = this.accounts.find(a => a.id === debitAccountId);
    if (debitAcc) debitAcc.balance += record.amount;
    const creditAcc = this.accounts.find(a => a.id === creditAccountId);
    if (creditAcc) creditAcc.balance -= record.amount;

    this.vouchers.unshift(vch);
    record.voucherId = vch.id;

    // Reflect in Vehicle Log Book whenever a vehicle is selected on an accepted/approved expense
    if (!skipLogbookSync && record.vehicleNumber && record.vehicleNumber !== 'General') {
      const veh = this.vehicles.find(
        v => v.registrationNumber === record.vehicleNumber || v.id === record.vehicleId
      );
      if (veh) {
        const prevOdo = veh.currentOdometer || 0;
        const enteredOdo = record.odometerReading && record.odometerReading >= prevOdo ? Number(record.odometerReading) : prevOdo;
        const runKm = Math.max(0, enteredOdo - prevOdo);
        if (enteredOdo > prevOdo) {
          veh.currentOdometer = enteredOdo;
        }
        const litresAdded = Number(record.fuelLitres) || (record.category.toLowerCase().includes('fuel') ? Math.round((record.amount / 90) * 10) / 10 : 0);

        const existingLog = this.odometerLogs.find(
          l => l.vehicleNumber === veh.registrationNumber && l.date === record.date && !l.expenseId
        );
        const expNote = `[Expense ${record.expenseNo}] ${record.category}: ₹${record.amount}${litresAdded ? ` (${litresAdded}L)` : ''} (${record.vendorName || 'Vendor'}) - ${record.narration || ''}`;
        if (existingLog) {
          existingLog.expenseId = record.id;
          existingLog.expenseCategory = record.category;
          existingLog.expenseAmount = (existingLog.expenseAmount || 0) + record.amount;
          if (enteredOdo > existingLog.endOdometer) {
            existingLog.endOdometer = enteredOdo;
            existingLog.tripKm = Math.max(0, existingLog.endOdometer - existingLog.startOdometer);
          }
          if (litresAdded > 0) {
            existingLog.fuelLitresAdded = (existingLog.fuelLitresAdded || 0) + litresAdded;
          }
          if (record.category.toLowerCase().includes('fuel')) {
            existingLog.fuelCost = (existingLog.fuelCost || 0) + record.amount;
          }
          existingLog.defectsReported = existingLog.defectsReported
            ? `${existingLog.defectsReported} | ${expNote}`
            : expNote;
        } else {
          const autoLog: OdometerLog = {
            id: `odo-exp-${Date.now()}`,
            date: record.date,
            vehicleId: veh.id,
            vehicleNumber: veh.registrationNumber,
            driverName: record.driverName || veh.assignedDriverName || 'Assigned Driver',
            startOdometer: prevOdo,
            endOdometer: enteredOdo,
            tripKm: runKm,
            fuelLitresAdded: litresAdded,
            fuelCost: record.category.toLowerCase().includes('fuel') ? record.amount : 0,
            neatnessChecked: true,
            defectsReported: expNote,
            recordedBy: record.recordedBy || 'Expense Sync',
            expenseId: record.id,
            expenseCategory: record.category,
            expenseAmount: record.amount,
          };
          this.odometerLogs.unshift(autoLog);
        }
      }
    }
  }

  public async addExpense(data: Omit<ExpenseRecord, 'id' | 'expenseNo'> & { skipLogbookSync?: boolean }): Promise<ExpenseRecord> {
    return this.enqueueWrite(async () => {
      const expNo = `EXP-${new Date().toISOString().slice(2, 7).replace('-', '')}-${(this.expenses.length + 1).toString().padStart(3, '0')}`;
      const matchedHead = this.expenseHeads.find(h => h.name.toLowerCase() === (data.category || '').toLowerCase());
      const requiresApproval = data.requiresApproval !== undefined ? data.requiresApproval : !!matchedHead?.requiresApproval;
      const approvalStatus: ExpenseRecord['approvalStatus'] = requiresApproval ? 'Pending Approval' : 'Approved';

      const veh = data.vehicleNumber && data.vehicleNumber !== 'General'
        ? this.vehicles.find(v => v.registrationNumber === data.vehicleNumber || v.id === data.vehicleId)
        : undefined;

      const record: ExpenseRecord = {
        ...data,
        id: `exp-${Date.now()}`,
        expenseNo: expNo,
        vehicleId: veh?.id || data.vehicleId,
        vehicleNumber: veh?.registrationNumber || data.vehicleNumber || 'General',
        amount: Number(data.amount) || 0,
        recordedBy: data.recordedBy || 'Finance Officer',
        requiresApproval,
        approvalStatus,
        approvedBy: approvalStatus === 'Approved' ? 'Direct Acceptance (No Approval Required)' : undefined,
        approvedAt: approvalStatus === 'Approved' ? new Date().toISOString().split('T')[0] : undefined,
      };

      this.expenses.unshift(record);

      // Only incorporate into paid ledgers, vouchers, and vehicle log book once Approved
      if (record.approvalStatus === 'Approved') {
        this.postApprovedExpenseSideEffects(record, !!data.skipLogbookSync);
      }

      await this.internalSyncToGoogleSheets();
      return record;
    });
  }

  public async updateExpenseApproval(
    id: string,
    payload: { status: 'Approved' | 'Rejected'; approvedBy?: string; rejectionReason?: string }
  ): Promise<ExpenseRecord> {
    return this.enqueueWrite(async () => {
      const record = this.expenses.find(e => e.id === id);
      if (!record) throw new Error('Expense record not found.');
      const prevStatus = record.approvalStatus;
      record.approvalStatus = payload.status;
      record.approvedBy = payload.approvedBy || 'Admin';
      record.approvedAt = new Date().toISOString().split('T')[0];
      if (payload.rejectionReason) {
        record.rejectionReason = payload.rejectionReason;
      }

      if (payload.status === 'Approved' && prevStatus !== 'Approved') {
        this.postApprovedExpenseSideEffects(record, false);
      }

      await this.internalSyncToGoogleSheets();
      return record;
    });
  }

  public async deleteExpense(id: string) {
    return this.enqueueWrite(async () => {
      this.expenses = this.expenses.filter(e => e.id !== id);
      await this.internalSyncToGoogleSheets();
      return { success: true };
    });
  }

  // --- Dynamic Expense Heads & Income Heads & Other Incomes ---
  public getExpenseHeads() {
    return this.expenseHeads;
  }

  public async saveExpenseHead(data: { id?: string; name: string; category?: string; requiresApproval?: boolean }): Promise<ExpenseHead> {
    return this.enqueueWrite(async () => {
      if (data.id) {
        const existingById = this.expenseHeads.find(h => h.id === data.id);
        if (existingById) {
          if (data.name?.trim()) existingById.name = data.name.trim();
          if (data.category) existingById.category = data.category;
          if (data.requiresApproval !== undefined) existingById.requiresApproval = !!data.requiresApproval;
          await this.internalSyncToGoogleSheets();
          return existingById;
        }
      }
      const trimmed = data.name?.trim();
      if (!trimmed) throw new Error('Expense Head name is required.');
      const existing = this.expenseHeads.find(h => h.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        if (data.category) existing.category = data.category;
        if (data.requiresApproval !== undefined) existing.requiresApproval = !!data.requiresApproval;
        await this.internalSyncToGoogleSheets();
        return existing;
      }
      const head: ExpenseHead = {
        id: `eh-${Date.now()}`,
        name: trimmed,
        category: data.category || 'Indirect Expense',
        requiresApproval: !!data.requiresApproval,
        createdAt: new Date().toISOString().split('T')[0],
      };
      this.expenseHeads.unshift(head);
      await this.internalSyncToGoogleSheets();
      return head;
    });
  }

  public async deleteExpenseHead(id: string) {
    return this.enqueueWrite(async () => {
      const head = this.expenseHeads.find(h => h.id === id);
      if (head) {
        const linked = this.expenses.filter(e => e.category === head.name);
        if (linked.length > 0) {
          throw new Error(`Cannot delete Expense Head "${head.name}" because ${linked.length} expense record(s) use it.`);
        }
      }
      this.expenseHeads = this.expenseHeads.filter(h => h.id !== id);
      await this.internalSyncToGoogleSheets();
      return { success: true };
    });
  }

  public getIncomeHeads() {
    return this.incomeHeads;
  }

  public async saveIncomeHead(data: { name: string; category?: string }): Promise<IncomeHead> {
    return this.enqueueWrite(async () => {
      const trimmed = data.name?.trim();
      if (!trimmed) throw new Error('Income Head name is required.');
      const existing = this.incomeHeads.find(h => h.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing;
      const head: IncomeHead = {
        id: `ih-${Date.now()}`,
        name: trimmed,
        category: data.category || 'Indirect Income',
        createdAt: new Date().toISOString().split('T')[0],
      };
      this.incomeHeads.unshift(head);
      await this.internalSyncToGoogleSheets();
      return head;
    });
  }

  public async deleteIncomeHead(id: string) {
    return this.enqueueWrite(async () => {
      const head = this.incomeHeads.find(h => h.id === id);
      if (head) {
        const linked = this.incomes.filter(i => i.incomeHeadId === head.id || i.incomeHeadName === head.name);
        if (linked.length > 0) {
          throw new Error(`Cannot delete Income Head "${head.name}" because ${linked.length} income record(s) use it.`);
        }
      }
      this.incomeHeads = this.incomeHeads.filter(h => h.id !== id);
      await this.internalSyncToGoogleSheets();
      return { success: true };
    });
  }

  public getIncomes() {
    return this.incomes;
  }

  public async addIncome(data: Omit<IncomeRecord, 'id' | 'incomeNo'>): Promise<IncomeRecord> {
    return this.enqueueWrite(async () => {
      const incNo = `INC-${new Date().toISOString().slice(2, 7).replace('-', '')}-${(this.incomes.length + 1).toString().padStart(3, '0')}`;
      const mode = data.receivedTo || data.paymentMode || 'Cash';
      const payer = data.name || data.receivedFrom || data.partyName || 'General Payer';
      const desc = data.description || data.narration || data.remarks || '';
      const invRef = data.invoiceNumber || data.referenceNo || incNo;
      const record: IncomeRecord = {
        ...data,
        id: `inc-${Date.now()}`,
        incomeNo: incNo,
        date: data.date || new Date().toISOString().split('T')[0],
        incomeHeadName: data.incomeHeadName || data.headName || 'Other Income',
        name: payer,
        receivedFrom: payer,
        receivedTo: mode,
        paymentMode: mode,
        invoiceNumber: invRef,
        referenceNo: invRef,
        description: desc,
        narration: desc,
        amount: Number(data.amount) || 0,
        recordedBy: data.recordedBy || 'Admin',
      };
      this.incomes.unshift(record);

      // Update Cash or Bank account & Income account
      const debitAccountId = record.paymentMode === 'Cash' ? 'acc-101' : 'acc-102';
      const debitAcc = this.accounts.find(a => a.id === debitAccountId);
      if (debitAcc) debitAcc.balance += record.amount;
      const incAcc = this.accounts.find(a => a.id === 'acc-401');
      if (incAcc) incAcc.balance += record.amount;

      await this.internalSyncToGoogleSheets();
      return record;
    });
  }

  public async deleteIncome(id: string) {
    return this.enqueueWrite(async () => {
      this.incomes = this.incomes.filter(i => i.id !== id);
      await this.internalSyncToGoogleSheets();
      return { success: true };
    });
  }

  // --- Behaviour & Discipline Records ---
  public getDisciplineRecords() {
    return this.disciplineRecords;
  }

  public async saveDisciplineRecord(data: Partial<DisciplineRecord>): Promise<DisciplineRecord> {
    return this.enqueueWrite(async () => {
      const student = this.students.find(s => s.id === data.studentId);
      if (!student && !data.studentName) {
        throw new Error('Member selection is required to record a behaviour/discipline issue.');
      }
      if (!data.concern?.trim()) {
        throw new Error('Concern / mischief description is required.');
      }
      if (!data.actionTaken?.trim()) {
        throw new Error('Action taken is required.');
      }

      const routeObj = this.routes.find(r => r.id === student?.routeId || r.code === student?.routeCode);

      if (data.id) {
        const idx = this.disciplineRecords.findIndex(d => d.id === data.id);
        if (idx >= 0) {
          this.disciplineRecords[idx] = {
            ...this.disciplineRecords[idx],
            ...data,
          } as DisciplineRecord;
          await this.internalSyncToGoogleSheets();
          return this.disciplineRecords[idx];
        }
      }

      const newRec: DisciplineRecord = {
        id: `disc-${Date.now()}`,
        date: data.date || new Date().toISOString().split('T')[0],
        studentId: student?.id || data.studentId || '',
        admissionNo: student?.admissionNo || data.admissionNo || '',
        studentName: student?.name || data.studentName || '',
        memberType: student?.memberType || data.memberType || 'Student',
        classSection: student ? `${student.class}-${student.section}` : (data.classSection || ''),
        routeCode: student?.routeCode || data.routeCode || routeObj?.code || '',
        vehicleNumber: data.vehicleNumber || routeObj?.vehicleNumber || 'UP 70 BT 7175',
        concern: data.concern.trim(),
        actionTaken: data.actionTaken.trim(),
        reportedBy: data.reportedBy || 'Transport Coordinator',
        severity: data.severity || 'Moderate',
      };

      this.disciplineRecords.unshift(newRec);
      await this.internalSyncToGoogleSheets();
      return newRec;
    });
  }

  public async deleteDisciplineRecord(id: string) {
    return this.enqueueWrite(async () => {
      this.disciplineRecords = this.disciplineRecords.filter(d => d.id !== id);
      await this.internalSyncToGoogleSheets();
      return { success: true };
    });
  }

  // --- Accounts & Vouchers ---
  public getAccounts() { return this.accounts; }
  public getVouchers() { return this.vouchers; }

  public async postJournalVoucher(v: Omit<JournalVoucher, 'id' | 'voucherNo' | 'status'> & { id?: string; voucherNo?: string }): Promise<JournalVoucher> {
    return this.enqueueWrite(async () => {
      const totalDebit = v.lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
      const totalCredit = v.lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Unbalanced Voucher! Total Debit (₹${totalDebit.toFixed(2)}) must equal Total Credit (₹${totalCredit.toFixed(2)}).`);
      }

      const voucher: JournalVoucher = {
        ...v,
        id: v.id || `vch-${Date.now()}`,
        voucherNo: v.voucherNo || `JV-${Date.now().toString().slice(-6)}`,
        status: 'Posted',
        totalDebit,
        totalCredit,
      };

      for (const line of voucher.lines) {
        const acc = this.accounts.find(a => a.id === line.accountId);
        if (acc) {
          if (acc.accountClass === 'Asset' || acc.accountClass === 'Expense') {
            acc.balance += (line.debit - line.credit);
          } else {
            acc.balance += (line.credit - line.debit);
          }
        }
      }

      this.vouchers.unshift(voucher);
      await this.internalSyncToGoogleSheets();
      return voucher;
    });
  }

  // --- Fees & Invoices ---
  public getInvoices(month?: string) {
    if (month) return this.invoices.filter(i => i.month === month);
    return this.invoices;
  }
  public getReceipts() { return this.receipts; }
  public getFollowUps() { return this.followUps; }
  public getWarningLetters() { return this.warningLetters; }

  public async runMonthlyBilling(month: string, runBy = 'Admin'): Promise<{ createdCount: number; totalBilled: number }> {
    return this.enqueueWrite(async () => {
      let createdCount = 0;
      let totalBilled = 0;

      for (const student of this.students) {
        // Generate monthly fee dues for all members except those who have left school/service
        if (student.transportStatus === 'Left') continue;
        const key = `BILL-${month}-${student.id}`;
        const already = this.invoices.find(
          i => i.idempotencyKey === key || (i.studentId === student.id && i.month.toLowerCase() === month.toLowerCase())
        );
        if (already) continue;

        const net = Math.max(0, student.monthlyFee - student.concessionAmount);
        const inv: FeeInvoice = {
          id: `inv-${Date.now()}-${createdCount}`,
          invoiceNo: `INV-${month.replace(/\s+/g, '').replace('-', '')}-${(this.invoices.length + 1).toString().padStart(4, '0')}`,
          studentId: student.id,
          admissionNo: student.admissionNo,
          studentName: student.name,
          month,
          baseFee: student.monthlyFee,
          concession: student.concessionAmount,
          netAmount: net,
          paidAmount: 0,
          balanceDue: net,
          status: 'Unpaid',
          dueDate: `${month}-10`,
          idempotencyKey: key,
        };

        this.invoices.unshift(inv);
        student.balanceDue += net;
        createdCount++;
        totalBilled += net;
      }

      await this.internalSyncToGoogleSheets();
      return { createdCount, totalBilled };
    });
  }

  public async recordReceipt(data: {
    studentId: string;
    amount: number;
    discountAmount?: number;
    lateFine?: number;
    invoiceDiscounts?: Record<string, number>;
    selectedInvoiceIds?: string[];
    feeBreakupDescription?: string;
    date?: string;
    paymentMode: 'Cash' | 'Bank' | 'UPI';
    referenceNo?: string;
    upiScreenshot?: string;
    receivedBy: string;
    remarks?: string;
  }) {
    return this.enqueueWrite(async () => {
      const student = this.students.find(s => s.id === data.studentId);
      if (!student) throw new Error('Student member not found');

      const totalDiscount = Number(data.discountAmount) || 0;
      const lateFineCharged = Number(data.lateFine) || 0;
      const netPaid = Number(data.amount) || 0;
      const feePortionPaid = Math.max(0, netPaid - lateFineCharged);

      // Apply month-specific discounts if provided
      if (data.invoiceDiscounts) {
        for (const [invId, discVal] of Object.entries(data.invoiceDiscounts)) {
          const d = Number(discVal) || 0;
          if (d > 0) {
            const inv = this.invoices.find(i => i.id === invId && i.studentId === student.id);
            if (inv) {
              inv.concession += d;
              inv.netAmount = Math.max(0, inv.baseFee - inv.concession);
              inv.balanceDue = Math.max(0, inv.netAmount - inv.paidAmount);
            }
          }
        }
      }

      const receiptNo = `REC-${new Date().toISOString().slice(2, 7).replace('-', '')}-${(this.receipts.length + 1).toString().padStart(4, '0')}`;
      const balanceDueBefore = student.balanceDue;
      student.balanceDue = Math.max(0, student.balanceDue - feePortionPaid - totalDiscount);
      const balanceDueAfter = student.balanceDue;

      // Mark unpaid invoices as Paid/Partially Paid
      let remaining = feePortionPaid;
      const targetInvoices = data.selectedInvoiceIds && data.selectedInvoiceIds.length > 0
        ? this.invoices.filter(i => data.selectedInvoiceIds!.includes(i.id) && i.studentId === student.id)
        : this.invoices.filter(i => i.studentId === student.id && i.status !== 'Paid');

      const paidMonths: string[] = [];
      for (const inv of targetInvoices) {
        if (remaining <= 0 && inv.balanceDue > 0) break;
        const pay = Math.min(remaining, inv.balanceDue);
        inv.paidAmount += pay;
        inv.balanceDue = Math.max(0, inv.balanceDue - pay);
        inv.status = inv.balanceDue <= 0 ? 'Paid' : 'Partially Paid';
        remaining -= pay;
        paidMonths.push(inv.month);
      }

      const receiptDate = data.date || new Date().toISOString().split('T')[0];

      const receipt: FeeReceipt = {
        id: `rec-${Date.now()}`,
        receiptNo,
        date: receiptDate,
        studentId: student.id,
        admissionNo: student.admissionNo,
        studentName: student.name,
        amount: netPaid,
        discountAmount: totalDiscount,
        lateFine: lateFineCharged,
        lateFineAmount: lateFineCharged,
        balanceDueBefore,
        balanceDueAfter,
        feeBreakupDescription: data.feeBreakupDescription || (paidMonths.length > 0 ? `Transport Fee (${paidMonths.join(', ')})${lateFineCharged > 0 ? ` + Late Fine ₹${lateFineCharged}` : ''}` : 'Transport Fee'),
        advanceLiabilityAmount: Math.max(0, remaining),
        paymentMode: data.paymentMode,
        referenceNo: data.referenceNo,
        upiScreenshot: data.upiScreenshot,
        receivedBy: data.receivedBy,
        remarks: data.remarks || 'Transport fee received',
      };

      // Update Cash or Bank account balance
      const debitAccountId = data.paymentMode === 'Cash' ? 'acc-101' : 'acc-102';
      const debitAcc = this.accounts.find(a => a.id === debitAccountId);
      if (debitAcc) debitAcc.balance += netPaid;

      this.receipts.unshift(receipt);
      await this.internalSyncToGoogleSheets();
      return receipt;
    });
  }

  public async addFollowUp(data: Partial<FollowUpRecord>): Promise<FollowUpRecord> {
    return this.enqueueWrite(async () => {
      const student = this.students.find(s => s.id === data.studentId);
      const rec: FollowUpRecord = {
        id: `fol-${Date.now()}`,
        date: data.date || new Date().toISOString().split('T')[0],
        studentId: student?.id || data.studentId || '',
        admissionNo: student?.admissionNo || data.admissionNo || '',
        studentName: student?.name || data.studentName || '',
        contactPerson: data.contactPerson || student?.fatherName || 'Parent / Guardian',
        phone: data.phone || student?.mobile || '',
        overdueAmount: Number(data.overdueAmount ?? student?.balanceDue ?? 0),
        promiseDate: data.promiseDate,
        outcome: data.outcome || 'Promise to Pay',
        notes: data.notes || '',
        officerName: data.officerName || 'Transport Coordinator',
      };
      this.followUps.unshift(rec);
      await this.internalSyncToGoogleSheets();
      return rec;
    });
  }

  public async deleteFollowUp(id: string) {
    return this.enqueueWrite(async () => {
      this.followUps = this.followUps.filter(f => f.id !== id);
      await this.internalSyncToGoogleSheets();
      return { success: true };
    });
  }

  public async issueWarningLetter(data: Partial<WarningLetter>): Promise<WarningLetter> {
    return this.enqueueWrite(async () => {
      const student = this.students.find(s => s.id === data.studentId);
      const today = new Date().toISOString().split('T')[0];
      const wl: WarningLetter = {
        id: `wl-${Date.now()}`,
        letterNo: data.letterNo || `WL-${new Date().getFullYear()}-${(this.warningLetters.length + 1).toString().padStart(3, '0')}`,
        date: data.date || today,
        issueDate: data.issueDate || today,
        studentId: student?.id || data.studentId || '',
        studentName: student?.name || data.studentName || '',
        admissionNo: student?.admissionNo || data.admissionNo || '',
        parentName: data.parentName || student?.fatherName || 'Parent',
        fatherName: data.fatherName || student?.fatherName || 'Parent',
        address: data.address || student?.address || '',
        overdueAmount: Number(data.overdueAmount ?? student?.balanceDue ?? 0),
        periodOverdue: data.periodOverdue || 'Pending Transport Dues',
        deadlineDate: data.deadlineDate || today,
        proposedSuspensionDate: data.proposedSuspensionDate || today,
        warningLevel: data.warningLevel || 'Level 2: Urgent Notice',
        sentVia: data.sentVia || 'Printed Slip',
        issuedBy: data.issuedBy || 'Admin',
      };
      this.warningLetters.unshift(wl);
      await this.internalSyncToGoogleSheets();
      return wl;
    });
  }

  // --- Daily Operations & Attendance ---
  public getTrips(date?: string, campus?: string) {
    let list = [...this.trips];
    if (date) list = list.filter(t => t.date === date);
    if (campus && campus !== 'all') list = list.filter(t => t.campus === campus);
    return list;
  }

  public async getOrCreateTripForRoute(date: string, routeId: string): Promise<{ trip: DailyTrip; attendance: TripAttendanceRecord[] }> {
    return this.enqueueWrite(async () => {
      const route = this.routes.find(r => r.id === routeId) || this.routes[0];
      if (!route) throw new Error('Route not found');

      let trip = this.trips.find(t => t.date === date && (t.routeId === route.id || t.routeName === route.code));
      const routeStudents = this.students.filter(
        s => (s.routeId === route.id || s.routeCode === route.code) && s.transportStatus !== 'Left'
      );

      if (!trip) {
        const veh = this.vehicles.find(v => v.id === route.vehicleId || v.registrationNumber === route.vehicleNumber);
        trip = {
          id: `dt-${route.id}-${date}`,
          date,
          campus: route.campus,
          routeId: route.id,
          routeName: route.code,
          vehicleId: route.vehicleId,
          vehicleNumber: route.vehicleNumber,
          driverName: veh?.assignedDriverName || 'Assigned Driver',
          helperName: veh?.assignedHelperName,
          tripNumber: route.tripNumber,
          shiftName: `Trip ${route.tripNumber} — ${route.name || route.code}`,
          status: 'Ready',
          rosterCount: routeStudents.length,
          presentCount: 0,
          absentCount: 0,
          mismatchCount: 0,
          plannedStartTime: '06:40 AM',
          plannedEndTime: '07:30 AM',
        };
        this.trips.push(trip);
      }

      // Ensure attendance records exist for all students on this route for this trip
      let existingAtt = this.attendance.filter(a => a.tripId === trip!.id);
      const existingStuIds = new Set(existingAtt.map(a => a.studentId));
      for (const stu of routeStudents) {
        if (!existingStuIds.has(stu.id)) {
          const newAtt: TripAttendanceRecord = {
            id: `att-${trip.id}-${stu.id}`,
            tripId: trip.id,
            date,
            studentId: stu.id,
            admissionNo: stu.admissionNo,
            studentName: stu.name,
            classSection: `${stu.class}-${stu.section}`,
            stopName: stu.pickupDropStopName,
            transportStatus: stu.transportStatus,
            driverStatus: 'Pending',
            assistantStatus: 'Pending',
            reconciliationStatus: 'Assistant_Pending',
          };
          this.attendance.push(newAtt);
        }
      }

      existingAtt = this.attendance.filter(a => a.tripId === trip!.id);
      trip.rosterCount = existingAtt.length;
      trip.presentCount = existingAtt.filter(a => a.assistantStatus === 'Present').length;
      trip.absentCount = existingAtt.filter(a => a.assistantStatus === 'Absent').length;

      return { trip, attendance: existingAtt };
    });
  }

  public getTripAttendance(tripId: string) {
    return this.attendance.filter(a => a.tripId === tripId);
  }
  public getAllAttendance() {
    return this.attendance;
  }

  public async updateAttendanceObservation(recordId: string, source: 'driver' | 'assistant' | 'resolve', value: string, resolverName?: string, reason?: string) {
    return this.enqueueWrite(async () => {
      const rec = this.attendance.find(a => a.id === recordId);
      if (!rec) throw new Error('Record not found');

      if (source === 'driver') rec.driverStatus = value as any;
      else if (source === 'assistant') {
        rec.assistantStatus = value as any;
        rec.driverStatus = value as any;
        rec.reconciliationStatus = value === 'Present' ? 'Matched_Present' : value === 'Absent' ? 'Matched_Absent' : 'Assistant_Pending';
      } else if (source === 'resolve') {
        rec.resolvedStatus = value as any;
        rec.resolvedBy = resolverName;
        rec.resolutionReason = reason;
        rec.reconciliationStatus = 'Resolved_Exception';
      }

      const trip = this.trips.find(t => t.id === rec.tripId);
      if (trip) {
        const tripAtts = this.attendance.filter(a => a.tripId === trip.id);
        trip.presentCount = tripAtts.filter(a => a.assistantStatus === 'Present').length;
        trip.absentCount = tripAtts.filter(a => a.assistantStatus === 'Absent').length;
      }

      return rec;
    });
  }

  public async verifyTrip(
    tripId: string,
    verifiedBy: string,
    notes?: string,
    statusOverride?: 'Arrived' | 'Departed' | 'Completed',
    timingPayload?: { inTime?: string; outTime?: string; inStrength?: number; outStrength?: number }
  ) {
    return this.enqueueWrite(async () => {
      const trip = this.trips.find(t => t.id === tripId);
      if (!trip) throw new Error('Trip not found');
      trip.verifiedBy = verifiedBy;
      trip.verifiedAt = new Date().toISOString();
      if (statusOverride) trip.status = statusOverride;
      if (notes !== undefined) trip.notes = notes;
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      if (statusOverride === 'Arrived' && !trip.inTime && !timingPayload?.inTime) {
        trip.inTime = nowTime;
        trip.inStrength = trip.presentCount || trip.rosterCount;
      }
      if (statusOverride === 'Departed' && !trip.outTime && !timingPayload?.outTime) {
        trip.outTime = nowTime;
        trip.outStrength = trip.presentCount || trip.rosterCount;
      }
      if (timingPayload) {
        if (timingPayload.inTime !== undefined) trip.inTime = timingPayload.inTime;
        if (timingPayload.outTime !== undefined) trip.outTime = timingPayload.outTime;
        if (timingPayload.inStrength !== undefined) trip.inStrength = Number(timingPayload.inStrength);
        if (timingPayload.outStrength !== undefined) trip.outStrength = Number(timingPayload.outStrength);
      }
      return trip;
    });
  }

  public async cancelTrip(tripId: string, reason: string, cancelledBy: string) {
    return this.enqueueWrite(async () => {
      const trip = this.trips.find(t => t.id === tripId);
      if (!trip) throw new Error('Trip not found');
      trip.status = 'Cancelled';
      trip.notes = `Cancelled by ${cancelledBy}: ${reason}`;
      return trip;
    });
  }

  public generateDriverWeeklyPack(routeId: string, shiftName: string, weekStartDate: string, weekEndDate?: string): DriverRegisterWeekPack {
    const route = this.routes.find(r => r.id === routeId) || this.routes[0];
    // Exclude members with status 'Left' ("if left do not print their name")
    const members = this.students
      .filter(s => (s.routeId === route?.id || s.routeCode === route?.code) && s.transportStatus !== 'Left')
      .map((s, idx) => ({
        srNo: idx + 1,
        admissionNo: s.admissionNo,
        name: s.name,
        profilePhoto: s.profilePhoto,
        memberType: s.memberType,
        classSection: `${s.class}-${s.section}`,
        pickupStop: s.pickupDropStopName,
        dropStop: s.pickupDropStopName,
        status: s.transportStatus,
        emergencyPhone: s.emergencyContact,
      }));

    let computedEnd = weekEndDate;
    if (!computedEnd) {
      const endD = new Date(weekStartDate);
      endD.setDate(endD.getDate() + 5);
      computedEnd = endD.toISOString().split('T')[0];
    }

    const vehicle = this.vehicles.find(v => v.id === route?.vehicleId || v.registrationNumber === route?.vehicleNumber);

    return {
      id: `pack-${route?.id || 'r1'}-${weekStartDate}`,
      weekStartDate,
      weekEndDate: computedEnd,
      academicSession: this.config.currentAcademicSession || '2026-27',
      campus: route?.campus || 'Sr',
      routeId: route?.id || 'r1',
      routeName: route?.code ? `${route.code} — ${route.name}` : 'Route List',
      vehicleNumber: route?.vehicleNumber || 'UP 70 BT 7175',
      driverName: vehicle?.assignedDriverName || 'Assigned Driver',
      shiftName: shiftName || `Trip ${route?.tripNumber || 1}`,
      direction: 'both',
      version: 1,
      generatedAt: new Date().toISOString(),
      generatedBy: 'Transport Coordinator',
      roster: members,
    };
  }

  public getFuelAdvances() { return this.fuelAdvances; }
  public async settleFuelAdvance(data: any) {
    return this.enqueueWrite(async () => {
      if (data.id) {
        const idx = this.fuelAdvances.findIndex(f => f.id === data.id);
        if (idx >= 0) {
          this.fuelAdvances[idx] = {
            ...this.fuelAdvances[idx],
            ...data,
          };
          await this.internalSyncToGoogleSheets();
          return this.fuelAdvances[idx];
        }
      }
      const newRecord: FuelAdvanceAndPurchase = {
        id: `fa-${Date.now()}`,
        date: data.date || new Date().toISOString().split('T')[0],
        vehicleId: data.vehicleId || '',
        vehicleNumber: data.vehicleNumber || '',
        driverId: data.driverId || '',
        driverName: data.driverName || '',
        advanceAmount: Number(data.advanceGiven ?? data.advanceAmount ?? 0),
        advanceGiven: Number(data.advanceGiven ?? data.advanceAmount ?? 0),
        litresPurchased: Number(data.litresPurchased) || 0,
        ratePerLitre: Number(data.fuelRate ?? data.ratePerLitre ?? 90),
        fuelRate: Number(data.fuelRate ?? data.ratePerLitre ?? 90),
        actualBillAmount: Number(data.fuelBillAmount ?? data.actualBillAmount ?? 0),
        fuelBillAmount: Number(data.fuelBillAmount ?? data.actualBillAmount ?? 0),
        cashReturned: Number(data.cashReturned) || 0,
        unsettledAdvance: Number(data.unsettledAdvance ?? 0),
        odometerReading: Number(data.odometerReading) || 0,
        vendorName: data.vendorName || 'Fuel Station',
        receiptNumber: data.receiptNumber || '—',
        paymentMode: data.paymentMode || 'Cash',
        status: data.status || 'Settled',
        settledBy: data.settledBy || 'Admin',
        notes: data.notes,
      };
      this.fuelAdvances.unshift(newRecord);
      await this.internalSyncToGoogleSheets();
      return newRecord;
    });
  }

  public getMaintenance() { return this.maintenance; }
  public async addMaintenance(data: Partial<MaintenanceRequest>) {
    return this.enqueueWrite(async () => {
      const veh = this.vehicles.find(
        v => v.id === data.vehicleId || v.registrationNumber === data.vehicleNumber
      );
      const woNo = `WO-${new Date().getFullYear()}-${(this.maintenance.length + 1).toString().padStart(3, '0')}`;
      const maint: MaintenanceRequest = {
        id: `maint-${Date.now()}`,
        workOrderNo: data.workOrderNo || woNo,
        date: data.date || new Date().toISOString().split('T')[0],
        vehicleId: veh?.id || data.vehicleId || '',
        vehicleNumber: veh?.registrationNumber || data.vehicleNumber || '',
        issueDescription: data.issueDescription || '',
        severity: data.severity || 'Medium',
        vendorName: data.vendorName || 'Assigned Workshop',
        estimatedCost: Number(data.estimatedCost) || 0,
        actualCost: Number(data.actualCost) || 0,
        status: data.status || 'Pending Approval',
        requestedBy: data.requestedBy || 'Transport Coordinator',
        workDoneDetails: data.workDoneDetails,
        approvedBy: data.approvedBy,
        approvedAt: data.approvedAt,
        invoiceNumber: data.invoiceNumber,
        attachment: data.attachment,
      };
      this.maintenance.unshift(maint);
      await this.internalSyncToGoogleSheets();
      return maint;
    });
  }

  public async updateMaintenanceStatus(
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
  ): Promise<MaintenanceRequest> {
    return this.enqueueWrite(async () => {
      const maint = this.maintenance.find(m => m.id === id);
      if (!maint) throw new Error('Work Order not found.');
      const prevStatus = maint.status;
      maint.status = payload.status;
      if (payload.approvedBy) {
        maint.approvedBy = payload.approvedBy;
        maint.approvedAt = new Date().toISOString().split('T')[0];
      }
      if (payload.rejectionReason !== undefined) maint.rejectionReason = payload.rejectionReason;
      if (payload.actualCost !== undefined) maint.actualCost = Number(payload.actualCost);
      if (payload.workDoneDetails !== undefined) maint.workDoneDetails = payload.workDoneDetails;
      if (payload.invoiceNumber !== undefined) maint.invoiceNumber = payload.invoiceNumber;
      if (payload.vendorName !== undefined) maint.vendorName = payload.vendorName;

      // When a Work Order is marked Completed or Paid and wasn't previously Completed/Paid, record it in the Vehicle's Log Book
      if ((payload.status === 'Completed' || payload.status === 'Paid') && prevStatus !== 'Completed' && prevStatus !== 'Paid') {
        const veh = this.vehicles.find(v => v.id === maint.vehicleId || v.registrationNumber === maint.vehicleNumber);
        if (veh) {
          const cost = maint.actualCost || maint.estimatedCost || 0;
          const curOdo = veh.currentOdometer || 0;
          this.odometerLogs.unshift({
            id: `odo-wo-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            vehicleId: veh.id,
            vehicleNumber: veh.registrationNumber,
            driverName: veh.assignedDriverName || 'Workshop Service',
            startOdometer: curOdo,
            endOdometer: curOdo,
            tripKm: 0,
            neatnessChecked: true,
            defectsReported: `[Work Order ${maint.workOrderNo || maint.id}] ${maint.issueDescription} (${maint.workDoneDetails || 'Completed'}) - ₹${cost}`,
            recordedBy: payload.approvedBy || 'Maintenance Action',
            expenseCategory: 'Work Order Maintenance',
            expenseAmount: cost,
          });
        }
      }

      await this.internalSyncToGoogleSheets();
      return maint;
    });
  }

  public async evaluateOverdueSuspensions(threshold = 500, triggeredBy = 'Admin') {
    return this.enqueueWrite(async () => {
      if (triggeredBy === 'Transport Assistant') {
        throw new Error('Transport Assistant is not authorized to initiate member suspensions.');
      }
      let count = 0;
      const today = new Date().toISOString().split('T')[0];
      for (const s of this.students) {
        // Respect active permission letter if within stipulated period
        if (s.activePermissionLetter && s.activePermissionLetter.allowedUntilDate >= today) {
          continue;
        }
        if (s.transportStatus === 'Active' && s.balanceDue >= threshold) {
          const validReason = `Overdue fee balance ₹${s.balanceDue} exceeded 20th cutoff threshold (₹${threshold}).`;
          if (triggeredBy === 'Transport Coordinator') {
            if (s.pendingSuspensionRequest?.status === 'Pending Approval') continue;
            s.pendingSuspensionRequest = {
              id: `susreq-${Date.now()}-${count}`,
              requestedBy: 'Transport Coordinator',
              requestedAt: today,
              reason: validReason,
              status: 'Pending Approval',
            };
            s.specialHistory = [
              {
                id: `spc-${Date.now()}-${count}`,
                date: today,
                eventType: 'Suspension_Requested',
                reason: `Suspension Requested by Transport Coordinator: ${validReason}`,
                authorizedBy: 'Transport Coordinator',
                overdueAmountAtTime: s.balanceDue,
              },
              ...(s.specialHistory || []),
            ];
            count++;
          } else {
            s.transportStatus = 'Suspended';
            s.statusReason = validReason;
            s.specialHistory = [
              {
                id: `spc-${Date.now()}-${count}`,
                date: today,
                eventType: 'Suspended',
                reason: validReason,
                authorizedBy: triggeredBy,
                overdueAmountAtTime: s.balanceDue,
              },
              ...(s.specialHistory || []),
            ];
            count++;
          }
        }
      }
      await this.internalSyncToGoogleSheets();
      return { suspendedCount: count, affectedStudents: [] };
    });
  }

  // --- Staff Attendance, Holidays, Advances & Monthly Payroll ---
  public getStaffAttendance() {
    return this.staffAttendance;
  }

  public async markStaffAttendance(payload: {
    employeeId: string;
    date: string;
    status: StaffAttendanceStatus;
    markedBy?: string;
    remarks?: string;
  }): Promise<StaffAttendanceRecord> {
    return this.enqueueWrite(async () => {
      const emp = this.employees.find(e => e.id === payload.employeeId);
      if (!emp) throw new Error('Employee not found');

      const existingIdx = this.staffAttendance.findIndex(
        a => a.employeeId === payload.employeeId && a.date === payload.date
      );
      if (existingIdx >= 0) {
        this.staffAttendance[existingIdx] = {
          ...this.staffAttendance[existingIdx],
          status: payload.status,
          markedBy: payload.markedBy || 'Admin',
          remarks: payload.remarks,
        };
        await this.internalSyncToGoogleSheets();
        return this.staffAttendance[existingIdx];
      }

      const rec: StaffAttendanceRecord = {
        id: `sa-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeCode: emp.employeeCode,
        campus: emp.campus || 'Sr',
        date: payload.date,
        status: payload.status,
        markedBy: payload.markedBy || 'Admin',
        remarks: payload.remarks,
      };
      this.staffAttendance.push(rec);
      await this.internalSyncToGoogleSheets();
      return rec;
    });
  }

  public getHolidays() {
    return this.holidays;
  }

  public async declareHoliday(payload: {
    date: string;
    occasion: string;
    campus?: string;
    declaredBy?: string;
  }): Promise<HolidayRecord> {
    return this.enqueueWrite(async () => {
      const existing = this.holidays.find(h => h.date === payload.date);
      if (existing) {
        existing.occasion = payload.occasion;
        existing.campus = payload.campus || 'all';
        await this.internalSyncToGoogleSheets();
        return existing;
      }
      const hol: HolidayRecord = {
        id: `hol-${Date.now()}`,
        date: payload.date,
        occasion: payload.occasion,
        campus: payload.campus || 'all',
        declaredBy: payload.declaredBy || 'Admin',
      };
      this.holidays.push(hol);
      await this.internalSyncToGoogleSheets();
      return hol;
    });
  }

  public async removeHoliday(date: string) {
    return this.enqueueWrite(async () => {
      this.holidays = this.holidays.filter(h => h.date !== date);
      await this.internalSyncToGoogleSheets();
      return { success: true };
    });
  }

  public getStaffAdvances() {
    return this.staffAdvances;
  }

  public async giveStaffAdvance(data: Omit<StaffAdvanceRecord, 'id'>): Promise<StaffAdvanceRecord> {
    return this.enqueueWrite(async () => {
      const emp = this.employees.find(e => e.id === data.employeeId);
      const amount = Number(data.amount) || 0;
      const rec: StaffAdvanceRecord = {
        id: `sadv-${Date.now()}`,
        employeeId: data.employeeId,
        employeeName: emp?.name || data.employeeName || 'Staff',
        employeeCode: emp?.employeeCode || data.employeeCode || '',
        date: data.date || new Date().toISOString().split('T')[0],
        amount,
        adjustedAmount: 0,
        balanceAmount: amount,
        paymentMode: data.paymentMode || 'Cash',
        reason: data.reason || 'Salary Advance',
        status: 'Active',
        recordedBy: data.recordedBy || 'Admin',
      };
      this.staffAdvances.unshift(rec);
      await this.internalSyncToGoogleSheets();
      return rec;
    });
  }

  public getStaffPayrolls() {
    return this.staffPayrolls;
  }

  public async finalizeStaffPayroll(record: StaffPayrollRecord): Promise<StaffPayrollRecord> {
    return this.enqueueWrite(async () => {
      // Adjust active advances for this employee if advanceDeducted > 0
      let toDeduct = Number(record.advanceDeducted) || 0;
      if (toDeduct > 0) {
        for (const adv of this.staffAdvances) {
          if (adv.employeeId === record.employeeId && adv.status === 'Active' && adv.balanceAmount > 0 && toDeduct > 0) {
            const adj = Math.min(adv.balanceAmount, toDeduct);
            adv.adjustedAmount += adj;
            adv.balanceAmount -= adj;
            toDeduct -= adj;
            if (adv.balanceAmount <= 0) {
              adv.balanceAmount = 0;
              adv.status = 'Settled';
            }
          }
        }
      }

      const existingIdx = this.staffPayrolls.findIndex(
        p => p.employeeId === record.employeeId && p.month === record.month
      );
      const finalized: StaffPayrollRecord = {
        ...record,
        id: record.id || `pay-${Date.now()}`,
        status: 'Finalized & Paid',
        paymentDate: record.paymentDate || new Date().toISOString().split('T')[0],
      };

      if (existingIdx >= 0) {
        this.staffPayrolls[existingIdx] = finalized;
      } else {
        this.staffPayrolls.unshift(finalized);
      }

      await this.internalSyncToGoogleSheets();
      return finalized;
    });
  }

  public async stageImportStudents(rows: any[]) {
    return this.enqueueWrite(async () => {
      let created = 0;
      for (const row of rows) {
        const name = String(row.Name || row.name || '').trim();
        if (!name) continue;
        const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'ST';
        const defaultPhoto = `data:image/svg+xml;utf8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#4f46e5"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="36">${initials}</text></svg>`
        )}`;
        await this.saveStudent({
          admissionNo: row.AdmissionNo || row.admissionNo,
          name,
          profilePhoto: row.profilePhoto || defaultPhoto,
          class: row.Class || 'Class I',
          section: row.Section || 'A',
          campus: row.Campus || 'Sr',
          villageName: row.Village || '',
          pickupDropStopName: row.TransportStop || row.Stop || '',
          monthlyFee: Number(row.Fee) || 700,
        });
        created++;
      }
      return { created, updated: 0, conflicted: 0, needsSetup: 0, summary: `Imported ${created} records.` };
    });
  }
}

export const sheetsDb = new SheetsDatabaseManager();


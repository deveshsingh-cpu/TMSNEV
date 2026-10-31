export type CampusId = string;

export type NavigationTab =
  | 'dashboard'
  | 'students'
  | 'staff'
  | 'vehicles'
  | 'daily_ops'
  | 'fees'
  | 'expenses'
  | 'accounts'
  | 'masters'
  | 'reports'
  | 'sheets_sync';

export interface CampusMaster {
  id: string;
  name: string;
  code: string; // e.g. "Sr", "Jr", "Main"
  address?: string;
}

export interface MemberTypeMaster {
  id: string;
  name: string; // e.g. "Student", "Staff", "Teacher"
}

export type TransportStatus = 'Active' | 'Suspended' | 'Needs Setup' | 'Left' | 'Terminated';

export type TripStatus = 'Planned' | 'Ready' | 'Departed' | 'Arrived' | 'Completed' | 'Cancelled' | 'Verified';

export type AttendanceSource = 'driver_paper' | 'assistant_app' | 'reconciliation';

export type ObservationValue = 'Present' | 'Absent' | 'Leave' | 'Pending' | 'Not Scheduled' | 'Holiday' | 'Cancelled' | 'Suspended_Ineligible';

export type StaffAttendanceStatus = 'P' | 'A' | 'L' | 'H';

export interface StaffAttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  campus: CampusId;
  date: string; // YYYY-MM-DD
  status: StaffAttendanceStatus; // P = Present, A = Unauthorised Absent, L = Leave, H = Holiday
  markedBy: string;
  remarks?: string;
}

export interface StaffAdvanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  date: string;
  amount: number;
  adjustedAmount: number;
  balanceAmount: number;
  paymentMode: 'Cash' | 'UPI' | 'Bank';
  reason: string;
  status: 'Active' | 'Settled';
  recordedBy: string;
}

export interface StaffPayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  campus: string;
  month: string; // e.g. "2026-10" or "October 2026"
  daysInMonth: number;
  monthlyBaseSalary: number;
  dailySalary: number;
  presentDays: number;
  holidayDays: number;
  leaveDays: number;
  absentDays: number;
  clBonusDays: number; // +1 if all present (0 leave, 0 absent)
  clAdjustedDays: number; // up to 1 CL adjusted against leave
  leaveDeductionDays: number; // max(0, leaveDays - 1)
  absentPenaltyDays: number; // absentDays * 2
  grossEarnedSalary: number;
  advanceDeducted: number;
  netPayableSalary: number;
  paymentMode?: 'Cash' | 'UPI' | 'Bank';
  paymentDate?: string;
  status: 'Draft' | 'Finalized & Paid';
  finalizedBy?: string;
}

export interface DriverFuelAdvanceRecord {
  id: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehicleNumber: string;
  date: string;
  advanceAmount: number;
  settledAmount: number;
  balanceAmount: number;
  paymentMode: 'Cash' | 'UPI' | 'Bank';
  purpose: string;
  status: 'Pending Settlement' | 'Partially Settled' | 'Settled';
  givenBy: string;
}

export interface HolidayRecord {
  id: string;
  date: string; // YYYY-MM-DD
  occasion: string;
  campus?: string; // 'all' or specific campus code
  declaredBy: string;
}

export type ReconciliationStatus = 'Matched_Present' | 'Matched_Absent' | 'Mismatch' | 'Driver_Pending' | 'Assistant_Pending' | 'Resolved_Exception';

export type OwnershipType = 'School-Owned' | 'Rented';

export type VehicleCondition = 'Good' | 'Fair' | 'Needs Work' | 'Under Maintenance';

export type VehicleAvailability = 'Available' | 'In-Service' | 'Maintenance' | 'Breakdown' | 'Retired';

export type AccountClass = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';

// 3 Final Multi-Login Designations / Roles
export type UserRole = 'Admin' | 'Transport Coordinator' | 'Transport Assistant';

export interface RolePermissions {
  manageMasters: boolean;
  manageMembers: boolean;
  manageEmployees: boolean;
  manageLogBook: boolean;
  manageExpenses: boolean;
  manageFees: boolean;
  manageAttendance: boolean;
  viewAccounts: boolean;
  postVouchers: boolean;
  viewReports: boolean;
}

export interface SystemUser {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  campus?: string;
  mobile?: string;
  email?: string;
  status: 'Active' | 'Disabled';
  lastLoginAt?: string;
  createdAt: string;
}


export type SessionMonthCode =
  | 'apr'
  | 'may'
  | 'jun'
  | 'jul'
  | 'aug'
  | 'sep'
  | 'oct'
  | 'nov'
  | 'dec'
  | 'jan'
  | 'feb'
  | 'mar';

export interface SchoolConfig {
  schoolName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  academicYear?: string;
  lateFeePerDay?: number;
  autoSuspendAfterMonths?: number;
  currentAcademicSession?: string;
  currentFinancialYear?: string;
  currency?: string;
  timezone?: string;
  campuses?: CampusMaster[];
  attachedSessionMonths?: SessionMonthCode[];
  effectiveBillingStartMonth?: string; // e.g. '2026-11'
  lastAutoBilledMonth?: string;
}

export interface TransportStop {
  id: string;
  name: string;
  fee: number;
  distanceKm: number;
  distanceRoute?: string; // e.g. "School - Chainpur"
  selectedMonths?: SessionMonthCode[];
  totalSessionFee?: number;
  landmark?: string;
  villageName?: string;
  stopId?: string;
  stopName?: string;
  plannedTimeMorning?: string;
  plannedTimeEvening?: string;
}

export interface Village {
  id: string;
  name: string;
  distanceKm: number;
  distanceRoute?: string; // e.g. "School - Chainpur"
  selectedMonths?: SessionMonthCode[];
  totalSessionFee?: number;
  stops: TransportStop[];
  monthlyRate?: number;
}

export interface MemberLifecycleRequest {
  id: string;
  requestType: 'ADD_MEMBER' | 'DROP_MEMBER' | 'SUSPEND_MEMBER';
  status: 'Pending Coordinator Approval' | 'Pending Admin Approval' | 'Approved' | 'Rejected';
  requestedBy: string;
  requestedByRole: UserRole;
  requestedAt: string;
  requestReason: string;
  memberId?: string;
  memberAdmissionNo?: string;
  memberName: string;
  memberClassSection?: string;
  memberCampus?: string;
  memberVillageName?: string;
  memberStopName?: string;
  memberRouteCode?: string;
  memberMonthlyFee?: number;
  leavingDate?: string;
  memberPayload?: Partial<StudentMember>;
  coordinatorApprovedBy?: string;
  coordinatorApprovedAt?: string;
  coordinatorRemarks?: string;
  adminReviewedBy?: string;
  adminReviewedAt?: string;
  adminRemarks?: string;
}

export interface Vehicle {
  id: string;
  registrationNumber: string; // e.g. "UP 70 BT 7175"
  type: 'Bus' | 'Mini Bus' | 'Van' | 'Winger' | 'Cruiser' | 'Other';
  capacity: number;
  ownership: OwnershipType;
  ownerName?: string;
  condition: VehicleCondition;
  registrationValidity: string;
  taxPaidUpto: string;
  fitnessUpto: string;
  insuranceUpto: string;
  pollutionUpto: string;
  permitUpto?: string;
  fuelType: 'Diesel' | 'Petrol' | 'CNG' | 'Electric';
  currentOdometer: number;
  availability: VehicleAvailability;
  assignedDriverId?: string;
  assignedDriverName?: string;
  driverName?: string;
  assignedHelperId?: string;
  assignedHelperName?: string;
  nickname?: string;
  baselineMileageKmPerLitre?: number;
  expectedMileageKmPerL?: number;
  contractTerms?: string;
  ownerMobile?: string;
  ownerAddress?: string;
  ownerAadhaarNo?: string;
  ownerPanNo?: string;
  monthlyRentAmount?: number;
  agreementStartDate?: string;
  agreementEndDate?: string;
  rentAgreementDoc?: DocumentAttachment;
  ownerAadhaarDoc?: DocumentAttachment;
  ownerPanDoc?: DocumentAttachment;
}

export interface VehicleAssignmentRecord {
  id: string;
  vehicleId: string;
  vehicleNumber: string;
  driverId: string;
  driverName: string;
  helperId?: string;
  helperName?: string;
  fromDate?: string;
  startDate?: string;
  toDate?: string;
  endDate?: string;
  status: 'Active' | 'Historical';
  assignedBy?: string;
  remarks?: string;
}

export interface TripMaster {
  id: string;
  tripNumber: number; // e.g. 1, 2, 3
  description: string;
}

export interface Route {
  id: string;
  code: string; // Nomenclature: Campus/VehicleLast4/Trip (e.g. "Sr/7175/1")
  campus: CampusId;
  campusCode: string;
  vehicleId: string;
  vehicleNumber: string;
  vehicleLast4: string;
  tripNumber: number;
  villageIds: string[];
  villageNames: string[];
  stopIds?: string[];
  stopNames?: string[];
  active: boolean;
  name?: string;
  stops?: TransportStop[];
  departureTime?: string;
  arrivalTime?: string;
}

export type RouteMaster = Route;

export interface ScheduledService {
  id: string;
  vehicleNumber: string;
  tripNumber: number;
  shiftName?: string;
  routeId: string;
  routeName: string;
  driverName?: string;
  direction?: 'Morning' | 'Evening' | 'both' | string;
  campus?: CampusId;
  assignedCount?: number;
  capacity?: number;
  helperName?: string;
  departureTime?: string;
  arrivalTime?: string;
  plannedStartTime?: string;
  plannedEndTime?: string;
}

export interface SuspensionAndPermissionEvent {
  id: string;
  date: string;
  eventType:
    | 'Suspended'
    | 'Suspension_Requested'
    | 'Suspension_Rejected'
    | 'Revoked_Dues_Cleared'
    | 'Revoked_Permission_Letter';
  reason: string;
  authorizedBy: string;
  overdueAmountAtTime?: number;
  allowedUntilDate?: string; // Stipulated period for Permission Letter
  letterAttachment?: string; // Compulsory attachment for Permission Letter
  letterFileName?: string;
}

export interface PendingSuspensionRequest {
  id: string;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  status: 'Pending Approval' | 'Approved' | 'Rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface StudentMember {
  id: string; // immutable UUID
  admissionNo: string;
  name: string;
  profilePhoto?: string; // Compulsory DP when adding member
  memberType: string; // from Masters
  class: string; // from Masters
  section: string; // from Masters
  gender: 'M' | 'F' | 'Other';
  campus: CampusId; // from Masters
  academicSession: string;
  fatherName: string;
  mobile: string;
  phone?: string;
  address: string;
  routeId: string;
  routeCode: string; // e.g. "Sr/7175/1"
  villageId: string;
  villageName: string;
  pickupDropStopId: string; // Combined pickup & drop point
  pickupDropStopName: string;
  morningStopId?: string;
  morningStopName?: string;
  eveningStopId?: string;
  eveningStopName?: string;
  serviceType: 'both' | 'morning_only' | 'evening_only';
  transportStatus: TransportStatus;
  statusReason?: string;
  pendingSuspensionRequest?: PendingSuspensionRequest;
  emergencyContact: string;
  monthlyFee: number; // from stop fee
  concessionAmount: number;
  previousDues?: number; // Opening arrears from old software
  previousDuesRemarks?: string;
  balanceDue: number;
  joiningDate: string;
  leavingDate?: string;
  documents?: DocumentAttachment[];
  specialHistory?: SuspensionAndPermissionEvent[];
  activePermissionLetter?: {
    allowedUntilDate: string;
    letterAttachment: string;
    letterFileName?: string;
    approvedBy: string;
    reason: string;
    grantedAt: string;
  };
  version: number;
}

export type Student = StudentMember;

export interface DocumentAttachment {
  id: string;
  type: 'Driving License' | 'Aadhaar Card' | 'PAN Card' | 'School ID Card' | 'Educational Qualification' | 'Resume' | 'Permission Letter' | 'Other';
  name: string;
  fileData?: string; // Base64 data or Google Drive reference
  driveFileId?: string;
  driveWebViewLink?: string;
  uploadedAt: string;
}

export interface DesignationMaster {
  id: string;
  name: string;
  isDriver: boolean;
  description?: string;
  permissions: RolePermissions;
}

export type CandidateResumeStatus = 'Resume received' | 'Eligible' | 'Not eligible';
export type ResumeStatus = CandidateResumeStatus;

export interface CandidateResume {
  id: string;
  candidateCode: string;
  name: string; // Mandatory
  age: number; // Mandatory
  gender: 'M' | 'F' | 'Other'; // Mandatory (Sex)
  mobile: string; // Mandatory (Phone no)
  address: string; // Mandatory
  fatherName?: string;
  educationQualification?: string;
  appliedDesignation: string;
  isDriver: boolean;
  drivingLicenseNo?: string; // Mandatory if Driver
  drivingLicenseValidity?: string;
  drivingLicenseType?: string;
  minExpectedSalary: number;
  experience: string;
  policeRecord: string;
  description?: string;
  status: CandidateResumeStatus;
  hiredEmployeeId?: string;
  documents: DocumentAttachment[];
  appliedDate: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  empCode?: string;
  resumeId?: string;
  name: string;
  designationId: string;
  designation: string;
  role?: string;
  campus?: CampusId;
  isDriver: boolean;
  drivingLicenseNo?: string;
  licenseNumber?: string;
  drivingLicenseValidity?: string;
  drivingLicenseType?: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  mobile: string;
  address: string;
  fatherName: string;
  educationQualification: string;
  experience?: string;
  policeRecord?: string;
  description?: string;
  status: 'Active' | 'On Leave' | 'Resigned' | 'Terminated';
  monthlyBaseSalary: number;
  pendingAdvanceBalance?: number;
  documents: DocumentAttachment[];
  resumeAttachment?: DocumentAttachment;
  joiningDate: string;
}

// Daily Log Book
export interface OdometerLog {
  id: string;
  date: string;
  vehicleId: string;
  vehicleNumber: string;
  driverName: string;
  startOdometer: number;
  endOdometer: number;
  tripKm: number;
  distanceKm?: number;
  fuelLitresAdded?: number;
  fuelCost?: number;
  achievedMileageKmPerLitre?: number;
  neatnessChecked: boolean;
  defectsReported?: string;
  recordedBy: string;
  shiftName?: string;
  expenseId?: string;
  expenseCategory?: string;
  expenseAmount?: number;
  openingOdometer?: number;
  closingOdometer?: number;
  fuelLitres?: number;
  entryType?: 'General Daily Reading' | 'Fuel & Expense Linked';
}

export interface DailyTrip {
  id: string;
  date: string;
  campus: CampusId;
  routeId: string;
  routeName: string; // Route Code
  vehicleId: string;
  vehicleNumber: string;
  driverId?: string;
  driverName: string;
  tripNumber: number;
  direction?: 'Morning' | 'Evening' | 'both';
  status: TripStatus;
  rosterCount?: number;
  expectedStudentsCount?: number;
  presentCountDriver?: number;
  presentCountAssistant?: number;
  presentCount?: number;
  absentCount?: number;
  mismatchCount: number;
  departureTime?: string;
  arrivalTime?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  shiftName?: string;
  helperName?: string;
  plannedStartTime?: string;
  plannedEndTime?: string;
  actualEndTime?: string;
  delayMinutes?: number;
  eligibleCount?: number;
  inTime?: string;
  outTime?: string;
  inStrength?: number;
  outStrength?: number;
  strengthMismatchRemark?: string;
  morningBoardingCount?: number;
  notes?: string;
}

export interface TripAttendanceRecord {
  id: string;
  tripId: string;
  date: string;
  studentId: string;
  admissionNo: string;
  studentName: string;
  classSection: string;
  stopName: string;
  transportStatus: TransportStatus;
  driverStatus: ObservationValue;
  assistantStatus: ObservationValue;
  reconciliationStatus: ReconciliationStatus;
  resolvedStatus?: ObservationValue;
  resolutionReason?: string;
  resolvedBy?: string;
  notes?: string;
}

export interface FeeInvoice {
  id: string;
  invoiceNo: string;
  studentId: string;
  admissionNo: string;
  studentName: string;
  month: string;
  baseFee: number;
  concession: number;
  lateFine?: number;
  netAmount: number;
  netPayable?: number;
  routeStop?: string;
  paidAmount: number;
  balanceDue: number;
  status: 'Unpaid' | 'Partially Paid' | 'Paid' | 'Suspended_Exempt';
  dueDate: string;
  idempotencyKey: string;
}

export interface FeeReceipt {
  id: string;
  receiptNo: string;
  date: string;
  studentId: string;
  admissionNo: string;
  studentName: string;
  amount: number;
  amountPaid?: number;
  monthsCovered?: string[];
  discountAmount?: number;
  lateFine?: number;
  lateFineAmount?: number;
  balanceDueBefore?: number;
  balanceDueAfter?: number;
  allocatedToInvoiceId?: string;
  feeBreakupDescription?: string;
  advanceLiabilityAmount: number;
  paymentMode: 'Cash' | 'Bank' | 'UPI';
  referenceNo?: string;
  upiScreenshot?: string;
  receivedBy: string;
  remarks?: string;
  voucherId?: string;
}

export interface DisciplineRecord {
  id: string;
  date: string;
  studentId?: string;
  memberId?: string;
  admissionNo: string;
  studentName?: string;
  memberName?: string;
  memberType?: string;
  classSection?: string;
  className?: string;
  section?: string;
  routeCode?: string;
  routeId?: string;
  routeName?: string;
  vehicleNumber: string;
  concern: string;
  actionTaken: string;
  reportedBy: string;
  severity?: 'Minor' | 'Moderate' | 'Serious';
}

export interface FollowUpRecord {
  id: string;
  date?: string;
  callDate?: string;
  studentId?: string;
  memberId?: string;
  admissionNo: string;
  studentName?: string;
  memberName?: string;
  contactPerson?: string;
  personTalkedTo?: string;
  phone?: string;
  overdueAmount?: number;
  promiseDate?: string;
  promisedDate?: string;
  outcome?: 'Promise to Pay' | 'Disputed' | 'Exemption Requested' | 'Unreachable';
  notes?: string;
  responseReceived?: string;
  officerName?: string;
  recordedBy?: string;
  status?: 'Pending' | 'Cleared';
}

export type FeeFollowUpRecord = FollowUpRecord;

export interface WarningLetter {
  id: string;
  letterNo: string;
  date: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  parentName: string;
  overdueAmount: number;
  deadlineDate: string;
  warningLevel: 'Level 1: Polite Reminder' | 'Level 2: Urgent Notice' | 'Level 3: Final Suspension Warning';
  sentVia: 'SMS' | 'WhatsApp' | 'Registered Letter' | 'Printed Slip';
  issuedBy: string;
  issueDate?: string;
  fatherName?: string;
  address?: string;
  periodOverdue?: string;
  proposedSuspensionDate?: string;
}

export interface AccountHead {
  id: string;
  code: string;
  name: string;
  accountClass: AccountClass;
  balance: number;
}

export interface JournalVoucher {
  id: string;
  voucherNo: string;
  date: string;
  voucherType: 'Fee Accrual' | 'Receipt' | 'Advance' | 'Settlement' | 'Expense' | 'Payroll' | 'Payment' | 'Journal';
  narration: string;
  status: 'Draft' | 'Posted' | 'Reversed';
  totalDebit: number;
  totalCredit: number;
  createdBy?: string;
  approvedBy?: string;
  lines: {
    accountId: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    costCenter?: string;
    partyName?: string;
  }[];
}

export type JournalLine = JournalVoucher['lines'][number];

export interface ExpenseHead {
  id: string;
  name: string;
  category?: string;
  description?: string;
  requiresApproval?: boolean;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  expenseNo: string;
  date: string;
  categoryId?: string;
  category: string;
  expenseHeadName?: string;
  vehicleId?: string;
  vehicleNumber?: string;
  driverName?: string;
  odometerReading?: number;
  fuelLitres?: number;
  vendorName: string;
  billNumber?: string;
  amount: number;
  paymentMode: 'Cash' | 'Bank' | 'UPI' | 'Fuel Advance';
  narration: string;
  voucherId?: string;
  voucherNo?: string;
  recordedBy: string;
  billPhoto?: string;
  requiresApproval?: boolean;
  approvalStatus?: 'Approved' | 'Pending Approval' | 'Rejected';
  approvedBy?: string;
  approvedDate?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface IncomeHead {
  id: string;
  name: string;
  category?: string;
  description?: string;
  createdAt: string;
}

export interface IncomeRecord {
  id: string;
  incomeNo: string;
  date: string;
  incomeHeadId?: string;
  incomeHeadName?: string;
  headName?: string;
  category?: string;
  receiptNo?: string;
  receivedTo?: 'Cash' | 'UPI' | 'Bank';
  receivedFrom?: string;
  paymentMode?: 'Cash' | 'UPI' | 'Bank';
  name?: string;
  partyName?: string;
  invoiceNumber?: string;
  invoiceNo?: string;
  referenceNo?: string;
  amount: number;
  attachment?: string;
  description?: string;
  remarks?: string;
  narration?: string;
  voucherId?: string;
  voucherNo?: string;
  recordedBy: string;
}

export interface FuelAdvanceAndPurchase {
  id: string;
  date: string;
  vehicleId: string;
  vehicleNumber: string;
  driverId: string;
  driverName: string;
  advanceAmount: number;
  advanceGiven?: number;
  litresPurchased: number;
  ratePerLitre: number;
  fuelRate?: number;
  actualBillAmount: number;
  fuelBillAmount?: number;
  cashReturned?: number;
  unsettledAdvance?: number;
  odometerReading: number;
  vendorName: string;
  receiptNumber: string;
  paymentMode: 'Cash' | 'Bank' | 'UPI';
  status: 'Draft' | 'Settled' | 'Discrepancy' | 'Advance Given' | 'Bill Submitted';
  settledBy?: string;
  notes?: string;
}

export interface MaintenanceRequest {
  id: string;
  workOrderNo?: string;
  date?: string;
  reportedDate?: string;
  vehicleId: string;
  vehicleNumber: string;
  issueType?: 'Mechanical' | 'Electrical' | 'Tyre/Battery' | 'Body' | 'Routine Service' | string;
  issueDescription?: string;
  description?: string;
  severity?: 'Low' | 'Medium' | 'High' | 'Critical';
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  vendorName?: string;
  estimatedCost: number;
  actualCost?: number;
  status: 'Pending Approval' | 'Approved' | 'Rejected' | 'In-Progress' | 'In Progress' | 'Completed' | 'Paid' | 'Reported' | 'Open';
  requestedBy?: string;
  reportedBy?: string;
  workDoneDetails?: string;
  approvedBy?: string;
  approvedAt?: string;
  approvedDate?: string;
  completionDate?: string;
  rejectionReason?: string;
  invoiceNumber?: string;
  attachment?: string;
}

export interface DashboardSummary {
  totalActiveStudents?: number;
  totalActiveMembers?: number;
  totalSuspendedStudents?: number;
  suspendedMembersCount?: number;
  totalVehicles?: number;
  activeRoutesCount?: number;
  todayTripsCount?: number;
  monthlyFeeExpected?: number;
  monthlyFeeCollected?: number;
  monthlyRevenueCollected?: number;
  totalOverdueAmount?: number;
  totalPendingDues?: number;
  monthlyExpenses?: number;
  monthlyExpensesTotal?: number;
  openMaintenanceCount?: number;
}

export interface DriverRegisterWeekPack {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  academicSession: string;
  campus: CampusId;
  routeId: string;
  routeName: string;
  vehicleNumber: string;
  driverName: string;
  shiftName: string;
  direction: 'both';
  version: number;
  generatedAt: string;
  generatedBy: string;
  roster: {
    srNo: number;
    admissionNo: string;
    name: string;
    profilePhoto?: string;
    memberType?: string;
    classSection: string;
    pickupStop: string;
    dropStop: string;
    status: TransportStatus;
    emergencyPhone?: string;
  }[];
}

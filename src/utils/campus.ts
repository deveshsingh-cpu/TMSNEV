import {
  Student,
  Route,
  Vehicle,
  FeeInvoice,
  FeeReceipt,
  ExpenseRecord,
  IncomeRecord,
  JournalVoucher,
  FollowUpRecord,
  WarningLetter,
} from '../types/index.js';

export type ResolvedCampus = 'Sr' | 'Jr';
export type CampusFilter = 'all' | 'Sr' | 'Jr';
export type CampusFilterValue = CampusFilter;

/**
 * Normalizes any campus label ('Sr', 'Senior', 'Senior Campus', 'Jr', 'Junior', etc.)
 * into canonical 'Sr' or 'Jr', or null if 'all' / unrecognized.
 */
export function normalizeCampus(val?: string | null): ResolvedCampus | null {
  if (!val) return null;
  const trimmed = String(val).trim().toLowerCase();
  if (!trimmed || trimmed === 'all' || trimmed === 'all campuses' || trimmed === 'both') return null;
  if (trimmed === 'sr' || trimmed.startsWith('sr') || trimmed.includes('senior')) return 'Sr';
  if (trimmed === 'jr' || trimmed.startsWith('jr') || trimmed.includes('junior')) return 'Jr';
  return null;
}

/**
 * Formats campus code for display
 */
export function formatCampusLabel(campus: CampusFilter | string | null | undefined): string {
  const norm = normalizeCampus(campus);
  if (norm === 'Sr') return 'Senior Campus (Sr)';
  if (norm === 'Jr') return 'Junior Campus (Jr)';
  return 'All Campuses';
}

/**
 * Resolves a Student's campus ('Sr' or 'Jr')
 */
export function getStudentCampus(student?: Partial<Student> | null, routes?: Route[]): ResolvedCampus {
  if (!student) return 'Sr';
  const direct = normalizeCampus(student.campus);
  if (direct) return direct;

  if (student.routeId && Array.isArray(routes) && routes.length > 0) {
    const r = routes.find((rt) => rt && (rt.id === student.routeId || rt.code === student.routeCode));
    const rCamp = normalizeCampus(r?.campus || r?.campusCode);
    if (rCamp) return rCamp;
  }

  const fromRouteCode = normalizeCampus(student.routeCode);
  if (fromRouteCode) return fromRouteCode;

  // Check class level fallback (Playgroup/Nursery/LKG/UKG/Class I-IV -> Jr, V-XII -> Sr)
  const rawClass = student.class || (student as { className?: string }).className || '';
  const cls = String(rawClass).toUpperCase();
  if (
    cls.includes('PLAY') ||
    cls.includes('NUR') ||
    cls.includes('LKG') ||
    cls.includes('UKG') ||
    cls.includes('PREP') ||
    (/\b(I|II|III|IV|1|2|3|4)\b/.test(cls) && !/\b(V|VI|VII|VIII|IX|X|XI|XII|5|6|7|8|9|10|11|12)\b/.test(cls))
  ) {
    return 'Jr';
  }

  return 'Sr';
}

/**
 * Resolves a Route's campus ('Sr' or 'Jr')
 */
export function getRouteCampus(route?: Partial<Route> | null): ResolvedCampus {
  if (!route) return 'Sr';
  const direct = normalizeCampus(route.campus || route.campusCode);
  if (direct) return direct;
  const fromCode = normalizeCampus(route.code || route.name);
  if (fromCode) return fromCode;
  return 'Sr';
}

/**
 * Normalizes an admission number for comparison so 'NEV1368/26', 'NEV 1368/26', and '1368/26' match.
 */
export function normalizeAdmissionNo(adm?: string | null): string {
  if (!adm) return '';
  return String(adm)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^(nev|nrv)[-/\s]*/, '');
}

/**
 * Strictly resolves a Student from a list of students using prioritized matching:
 * 1. Exact studentId + matching normalized admissionNo
 * 2. Exact studentId
 * 3. Exact or normalized admissionNo (preferring matching name if multiple share admissionNo)
 * 4. Student name ONLY when both studentId and admissionNo are absent
 *
 * This prevents single-pass .find(s => s.id === ... || s.name === ...) from returning an earlier
 * student in the array who happens to share the same name (e.g., Ansh Kumar, Anshika Kumari, Pallavi Kumari).
 */
export function findStudentStrictly(
  students: Student[] = [],
  ref:
    | {
        studentId?: string | null;
        memberId?: string | null;
        admissionNo?: string | null;
        studentName?: string | null;
        memberName?: string | null;
        campus?: string | null;
        receivedBy?: string | null;
      }
    | null
    | undefined
): Student | undefined {
  if (!ref || !Array.isArray(students) || students.length === 0) return undefined;

  const targetId = String(ref.studentId || ref.memberId || '').trim();
  const targetAdmRaw = String(ref.admissionNo || '').trim().toLowerCase();
  const targetAdmNorm = normalizeAdmissionNo(ref.admissionNo);
  const targetName = String(ref.studentName || ref.memberName || '').trim().toLowerCase();
  const targetCampus = normalizeCampus(ref.campus) || normalizeCampus(ref.receivedBy);

  // Priority 1: Both studentId and normalized admissionNo match
  if (targetId && targetAdmNorm) {
    const exactBoth = students.find(
      (s) =>
        s &&
        s.id === targetId &&
        normalizeAdmissionNo(s.admissionNo) === targetAdmNorm
    );
    if (exactBoth) return exactBoth;
  }

  // Priority 2: Exact studentId match
  if (targetId) {
    const byId = students.find((s) => s && s.id === targetId);
    if (byId) return byId;
  }

  // Priority 3: Exact or normalized admissionNo match
  if (targetAdmRaw || targetAdmNorm) {
    const admMatches = students.filter(
      (s) =>
        s &&
        Boolean(s.admissionNo) &&
        (String(s.admissionNo).trim().toLowerCase() === targetAdmRaw ||
          (targetAdmNorm && normalizeAdmissionNo(s.admissionNo) === targetAdmNorm))
    );
    if (admMatches.length === 1) return admMatches[0];
    if (admMatches.length > 1) {
      if (targetName) {
        const byAdmAndName = admMatches.find(
          (s) => (s.name || '').trim().toLowerCase() === targetName
        );
        if (byAdmAndName) return byAdmAndName;
      }
      if (targetCampus) {
        const byAdmAndCampus = admMatches.find(
          (s) => getStudentCampus(s) === targetCampus
        );
        if (byAdmAndCampus) return byAdmAndCampus;
      }
      return admMatches[0];
    }
  }

  // Priority 4: Fallback to studentName ONLY when BOTH studentId and admissionNo are absent
  if (!targetId && !targetAdmNorm && targetName) {
    const nameMatches = students.filter(
      (s) => s && (s.name || '').trim().toLowerCase() === targetName
    );
    if (nameMatches.length === 1) return nameMatches[0];
    if (nameMatches.length > 1 && targetCampus) {
      const byCampus = nameMatches.find((s) => getStudentCampus(s) === targetCampus);
      if (byCampus) return byCampus;
    }
    if (nameMatches.length > 0) return nameMatches[0];
  }

  return undefined;
}

/**
 * Resolves a FeeInvoice's campus ('Sr' or 'Jr')
 */
export function getInvoiceCampus(
  invoice: Partial<FeeInvoice> | null | undefined,
  students: Student[] = [],
  routes?: Route[]
): ResolvedCampus {
  if (!invoice) return 'Sr';
  const direct = normalizeCampus(invoice.campus);
  if (direct) return direct;

  const safeStudents = Array.isArray(students) ? students : [];
  const st = findStudentStrictly(safeStudents, invoice);
  if (st) return getStudentCampus(st, routes);

  const fromRoute = normalizeCampus(invoice.routeName);
  if (fromRoute) return fromRoute;

  return 'Sr';
}

/**
 * Resolves a FeeReceipt's campus ('Sr' or 'Jr')
 */
export function getReceiptCampus(
  receipt: Partial<FeeReceipt> | null | undefined,
  students: Student[] = [],
  routes?: Route[],
  invoices?: FeeInvoice[]
): ResolvedCampus {
  if (!receipt) return 'Sr';
  const direct = normalizeCampus(receipt.campus);
  if (direct) return direct;

  const safeStudents = Array.isArray(students) ? students : [];
  const st = findStudentStrictly(safeStudents, receipt);
  if (st) return getStudentCampus(st, routes);

  const fromReceivedBy = normalizeCampus(receipt.receivedBy);
  if (fromReceivedBy) return fromReceivedBy;

  const invId = receipt.invoiceId || receipt.allocatedToInvoiceId;
  if (invId && Array.isArray(invoices)) {
    const inv = invoices.find((i) => i && i.id === invId);
    if (inv) return getInvoiceCampus(inv, safeStudents, routes);
  }

  return 'Sr';
}

/**
 * Helper to get vehicle registration number safely across data shapes
 */
function getVehicleRegNumber(vehicle?: Partial<Vehicle> | null): string {
  if (!vehicle) return '';
  return (
    vehicle.registrationNumber ||
    (vehicle as { vehicleNumber?: string }).vehicleNumber ||
    ''
  );
}

/**
 * Returns the primary campus ('Sr' or 'Jr') for a Vehicle.
 */
export function getPrimaryVehicleCampus(
  vehicle?: Partial<Vehicle> | null,
  routes?: Route[],
  students?: Student[]
): ResolvedCampus {
  if (!vehicle) return 'Sr';
  const vehReg = getVehicleRegNumber(vehicle);

  if (Array.isArray(routes) && routes.length > 0) {
    const matchedRoutes = routes.filter(
      (r) =>
        r &&
        ((vehicle.id && r.vehicleId === vehicle.id) ||
          (vehReg && r.vehicleNumber === vehReg))
    );
    if (matchedRoutes.length > 0) {
      const jrCount = matchedRoutes.filter((r) => getRouteCampus(r) === 'Jr').length;
      const srCount = matchedRoutes.filter((r) => getRouteCampus(r) === 'Sr').length;
      if (jrCount > srCount) return 'Jr';
      if (srCount > 0) return 'Sr';
    }
  }

  if (Array.isArray(students) && students.length > 0 && Array.isArray(routes) && routes.length > 0) {
    const vehRouteIds = new Set(
      routes
        .filter((r) => r && ((vehicle.id && r.vehicleId === vehicle.id) || (vehReg && r.vehicleNumber === vehReg)))
        .map((r) => r.id)
    );
    const matchedStudents = students.filter((s) => s && vehRouteIds.has(s.routeId));
    if (matchedStudents.length > 0) {
      const jrCount = matchedStudents.filter((s) => getStudentCampus(s, routes) === 'Jr').length;
      const srCount = matchedStudents.filter((s) => getStudentCampus(s, routes) === 'Sr').length;
      if (jrCount > srCount) return 'Jr';
    }
  }

  return 'Sr';
}

export function vehicleServesCampus(
  vehicle: Partial<Vehicle> | null | undefined,
  campus: CampusFilter,
  routes?: Route[],
  students?: Student[]
): boolean {
  if (!vehicle) return false;
  const norm = normalizeCampus(campus);
  if (!norm) return true;

  const vehReg = getVehicleRegNumber(vehicle);
  if (Array.isArray(routes) && routes.length > 0) {
    const matchedRoutes = routes.filter(
      (r) =>
        r &&
        ((vehicle.id && r.vehicleId === vehicle.id) ||
          (vehReg && r.vehicleNumber === vehReg))
    );
    if (matchedRoutes.some((r) => getRouteCampus(r) === norm)) return true;

    if (Array.isArray(students) && students.length > 0) {
      const routeIds = new Set(matchedRoutes.map((r) => r.id));
      const routeCodes = new Set(matchedRoutes.map((r) => r.code));
      if (
        students.some(
          (s) =>
            s &&
            (routeIds.has(s.routeId) || routeCodes.has(s.routeCode)) &&
            getStudentCampus(s, routes) === norm
        )
      ) {
        return true;
      }
    }
  }

  return getPrimaryVehicleCampus(vehicle, routes, students) === norm;
}

/**
 * Resolves an ExpenseRecord's campus ('Sr' or 'Jr')
 */
export function getExpenseCampus(
  expense: Partial<ExpenseRecord> | null | undefined,
  vehicles?: Vehicle[],
  routes?: Route[],
  students?: Student[]
): ResolvedCampus {
  if (!expense) return 'Sr';
  const direct = normalizeCampus(expense.campus);
  if (direct) return direct;

  const fromRecordedBy = normalizeCampus(expense.recordedBy);
  if (fromRecordedBy) return fromRecordedBy;

  if ((expense.vehicleId || expense.vehicleNumber) && Array.isArray(vehicles) && vehicles.length > 0) {
    const v = vehicles.find(
      (veh) =>
        veh &&
        ((expense.vehicleId && veh.id === expense.vehicleId) ||
          (expense.vehicleNumber && getVehicleRegNumber(veh) === expense.vehicleNumber))
    );
    if (v) return getPrimaryVehicleCampus(v, routes, students);
  }

  if (expense.vehicleNumber && Array.isArray(routes) && routes.length > 0) {
    const r = routes.find(
      (rt) =>
        rt &&
        (rt.vehicleNumber === expense.vehicleNumber ||
          (rt.code || '').includes(expense.vehicleNumber || ''))
    );
    if (r) return getRouteCampus(r);
  }

  return 'Sr';
}

/**
 * Resolves an IncomeRecord's campus ('Sr' or 'Jr')
 */
export function getIncomeCampus(income?: Partial<IncomeRecord> | null): ResolvedCampus {
  if (!income) return 'Sr';
  const direct = normalizeCampus(income.campus);
  if (direct) return direct;

  const fromRecordedBy = normalizeCampus(income.recordedBy);
  if (fromRecordedBy) return fromRecordedBy;

  const fromDesc = normalizeCampus(income.description || income.narration || income.remarks);
  if (fromDesc) return fromDesc;

  return 'Sr';
}

/**
 * Resolves a JournalVoucher's campus ('Sr' or 'Jr')
 */
export function getVoucherCampus(
  voucher: Partial<JournalVoucher> | null | undefined,
  students?: Student[],
  vehicles?: Vehicle[],
  routes?: Route[]
): ResolvedCampus {
  if (!voucher) return 'Sr';
  const direct = normalizeCampus(voucher.campus);
  if (direct) return direct;

  const partyCandidates: string[] = [];
  if (voucher.partyName) partyCandidates.push(voucher.partyName);
  if (Array.isArray(voucher.lines)) {
    voucher.lines.forEach((l) => {
      if (l?.partyName) partyCandidates.push(l.partyName);
    });
  }

  if (partyCandidates.length > 0 && Array.isArray(students) && students.length > 0) {
    for (const p of partyCandidates) {
      const pLower = String(p || '').trim().toLowerCase();
      const st = students.find(
        (s) => s && ((s.name || '').trim().toLowerCase() === pLower || s.admissionNo === p)
      );
      if (st) return getStudentCampus(st, routes);
    }
  }

  const costCenters: string[] = [];
  if (voucher.costCenter) costCenters.push(voucher.costCenter);
  if (Array.isArray(voucher.lines)) {
    voucher.lines.forEach((l) => {
      if (l?.costCenter) costCenters.push(l.costCenter);
    });
  }

  if (costCenters.length > 0 && Array.isArray(vehicles) && vehicles.length > 0) {
    for (const cc of costCenters) {
      const v = vehicles.find((veh) => veh && (getVehicleRegNumber(veh) === cc || veh.id === cc));
      if (v) return getPrimaryVehicleCampus(v, routes, students);
    }
  }

  // Also check narration for student admissionNo or name
  if (voucher.narration && Array.isArray(students) && students.length > 0) {
    const narrLower = String(voucher.narration).toLowerCase();
    const matchedStudent = students.find(
      (s) =>
        s &&
        ((s.admissionNo && voucher.narration?.includes(s.admissionNo)) ||
          (s.name && s.name.length > 3 && narrLower.includes(s.name.toLowerCase())))
    );
    if (matchedStudent) return getStudentCampus(matchedStudent, routes);
  }

  const fromCreatedBy = normalizeCampus(voucher.createdBy);
  if (fromCreatedBy) return fromCreatedBy;

  return 'Sr';
}

/**
 * Resolves a FollowUpRecord or WarningLetter campus ('Sr' or 'Jr')
 */
export function getStudentLinkedCampus(
  record: Partial<FollowUpRecord | WarningLetter> | null | undefined,
  students: Student[] = [],
  routes?: Route[]
): ResolvedCampus {
  if (!record) return 'Sr';
  const direct = normalizeCampus((record as { campus?: string }).campus);
  if (direct) return direct;

  const safeStudents = Array.isArray(students) ? students : [];
  const st = findStudentStrictly(safeStudents, record as any);
  if (st) return getStudentCampus(st, routes);

  const fromRoute = normalizeCampus((record as { routeName?: string }).routeName);
  if (fromRoute) return fromRoute;

  return 'Sr';
}

/**
 * Helper to check if a resolved campus matches the active campus filter ('all' | 'Sr' | 'Jr')
 */
export function matchesCampusFilter(
  recordCampus: ResolvedCampus,
  filter: CampusFilter | string | null | undefined
): boolean {
  const normFilter = normalizeCampus(filter);
  if (!normFilter) return true; // 'all' matches both Sr and Jr
  return recordCampus === normFilter;
}

/**
 * Computes financial summary (Cash, Online/UPI/Bank, Fee Collected, Other Income, Expenses, Net Balance)
 * for a specific campus filter ('all', 'Sr', 'Jr').
 */
export interface CampusFinancialSummary {
  campus: CampusFilter;
  label: string;
  feeCash: number;
  feeOnline: number; // UPI + Bank Transfer + Cheque
  feeTotal: number;
  receiptCount: number;
  otherIncomeCash: number;
  otherIncomeOnline: number;
  otherIncomeTotal: number;
  totalInflowCash: number;
  totalInflowOnline: number;
  totalInflow: number;
  expenseCash: number;
  expenseOnline: number;
  expenseTotal: number;
  netCashBalance: number;
  netOnlineBalance: number;
  netTotalBalance: number;
  outstandingDues: number;
  studentCount: number;
}

export interface CampusFinancialParams {
  campusFilter?: CampusFilter;
  filter?: CampusFilter;
  students?: Student[];
  routes?: Route[];
  vehicles?: Vehicle[];
  invoices?: FeeInvoice[];
  receipts?: FeeReceipt[];
  incomes?: IncomeRecord[];
  expenses?: ExpenseRecord[];
}

export function calculateCampusFinancials(
  filterOrParams: CampusFilter | CampusFinancialParams,
  maybeParams?: CampusFinancialParams
): CampusFinancialSummary {
  const isFirstArgObject = typeof filterOrParams === 'object' && filterOrParams !== null;
  const resolvedFilter: CampusFilter = isFirstArgObject
    ? filterOrParams.campusFilter || filterOrParams.filter || 'all'
    : filterOrParams || 'all';
  const rawParams: CampusFinancialParams = isFirstArgObject
    ? filterOrParams
    : maybeParams || {};

  const students = Array.isArray(rawParams.students) ? rawParams.students : [];
  const routes = Array.isArray(rawParams.routes) ? rawParams.routes : [];
  const vehicles = Array.isArray(rawParams.vehicles) ? rawParams.vehicles : [];
  const invoices = Array.isArray(rawParams.invoices) ? rawParams.invoices : [];
  const receipts = Array.isArray(rawParams.receipts) ? rawParams.receipts : [];
  const incomes = Array.isArray(rawParams.incomes) ? rawParams.incomes : [];
  const expenses = Array.isArray(rawParams.expenses) ? rawParams.expenses : [];

  const scopedStudents = students.filter(
    (s) => s && matchesCampusFilter(getStudentCampus(s, routes), resolvedFilter)
  );

  const scopedReceipts = receipts.filter(
    (r) => r && matchesCampusFilter(getReceiptCampus(r, students, routes, invoices), resolvedFilter)
  );

  const scopedIncomes = incomes.filter(
    (inc) => inc && matchesCampusFilter(getIncomeCampus(inc), resolvedFilter)
  );

  const approvedExpenses = expenses.filter(
    (exp) =>
      exp &&
      exp.approvalStatus !== 'Rejected' &&
      exp.approvalStatus !== 'Pending Approval' &&
      matchesCampusFilter(getExpenseCampus(exp, vehicles, routes, students), resolvedFilter)
  );

  const isCashMode = (mode?: string) => (mode || '').toLowerCase() === 'cash';
  const getReceiptAmt = (r: FeeReceipt) => Number(r?.amountPaid ?? r?.amount ?? 0) || 0;

  const feeCash = scopedReceipts
    .filter((r) => isCashMode(r.paymentMode))
    .reduce((sum, r) => sum + getReceiptAmt(r), 0);

  const feeOnline = scopedReceipts
    .filter((r) => !isCashMode(r.paymentMode))
    .reduce((sum, r) => sum + getReceiptAmt(r), 0);

  const feeTotal = feeCash + feeOnline;

  const otherIncomeCash = scopedIncomes
    .filter((i) => isCashMode(i.receivedTo || i.paymentMode))
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const otherIncomeOnline = scopedIncomes
    .filter((i) => !isCashMode(i.receivedTo || i.paymentMode))
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const otherIncomeTotal = otherIncomeCash + otherIncomeOnline;

  const totalInflowCash = feeCash + otherIncomeCash;
  const totalInflowOnline = feeOnline + otherIncomeOnline;
  const totalInflow = totalInflowCash + totalInflowOnline;

  const expenseCash = approvedExpenses
    .filter((e) => isCashMode(e.paymentMode))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const expenseOnline = approvedExpenses
    .filter((e) => !isCashMode(e.paymentMode))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const expenseTotal = expenseCash + expenseOnline;

  const netCashBalance = totalInflowCash - expenseCash;
  const netOnlineBalance = totalInflowOnline - expenseOnline;
  const netTotalBalance = totalInflow - expenseTotal;

  // Calculate total outstanding dues for scoped students without double-counting previousDues
  // Every student's balanceDue is authoritatively synced from their unpaid invoices (both Previous Dues and monthly fee invoices)
  const scopedInvoices = invoices.filter(
    (inv) =>
      inv &&
      inv.status !== 'Paid' &&
      matchesCampusFilter(getInvoiceCampus(inv, students, routes), resolvedFilter)
  );
  const invoicePending = scopedInvoices.reduce(
    (sum, inv) => sum + Math.max(0, Number(inv.balanceDue ?? inv.balanceAmount ?? 0) || 0),
    0
  );
  const studentOutstandingSum = scopedStudents.reduce(
    (sum, s) =>
      sum +
      Math.max(
        0,
        Number(s.balanceDue ?? (s as { outstandingAmount?: number }).outstandingAmount ?? 0) || 0
      ),
    0
  );
  const outstandingDues =
    scopedStudents.length > 0 ? studentOutstandingSum : invoicePending;

  return {
    campus: resolvedFilter,
    label: formatCampusLabel(resolvedFilter),
    feeCash,
    feeOnline,
    feeTotal,
    receiptCount: scopedReceipts.length,
    otherIncomeCash,
    otherIncomeOnline,
    otherIncomeTotal,
    totalInflowCash,
    totalInflowOnline,
    totalInflow,
    expenseCash,
    expenseOnline,
    expenseTotal,
    netCashBalance,
    netOnlineBalance,
    netTotalBalance,
    outstandingDues,
    studentCount: scopedStudents.length,
  };
}

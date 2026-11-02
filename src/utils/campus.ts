import { Student, Route, Vehicle, FeeInvoice, FeeReceipt, ExpenseRecord, IncomeRecord, JournalVoucher, FollowUpRecord, WarningLetter } from '../types';

export type ResolvedCampus = 'Sr' | 'Jr';
export type CampusFilter = 'all' | 'Sr' | 'Jr';

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

  if (student.routeId && routes && routes.length > 0) {
    const r = routes.find(rt => rt.id === student.routeId || rt.code === student.routeCode);
    const rCamp = normalizeCampus(r?.campus);
    if (rCamp) return rCamp;
  }

  const fromRouteCode = normalizeCampus(student.routeCode);
  if (fromRouteCode) return fromRouteCode;

  // Check class level fallback (Nursery/LKG/UKG/Class I-V -> Jr, VI-XII -> Sr)
  const cls = (student.className || '').toUpperCase();
  if (
    cls.includes('NUR') ||
    cls.includes('LKG') ||
    cls.includes('UKG') ||
    /\b(I|II|III|IV|V|1|2|3|4|5)\b/.test(cls) && !/\b(VI|VII|VIII|IX|X|XI|XII)\b/.test(cls)
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
  const direct = normalizeCampus(route.campus);
  if (direct) return direct;
  const fromCode = normalizeCampus(route.code || route.name);
  if (fromCode) return fromCode;
  return 'Sr';
}

/**
 * Resolves a FeeInvoice's campus ('Sr' or 'Jr')
 */
export function getInvoiceCampus(
  invoice: Partial<FeeInvoice>,
  students: Student[],
  routes?: Route[]
): ResolvedCampus {
  const direct = normalizeCampus(invoice.campus);
  if (direct) return direct;

  const st = students.find(
    s =>
      s.id === invoice.studentId ||
      (invoice.admissionNo && s.admissionNo === invoice.admissionNo) ||
      (invoice.studentName && s.name.toLowerCase() === invoice.studentName.toLowerCase())
  );
  if (st) return getStudentCampus(st, routes);

  const fromRoute = normalizeCampus(invoice.routeName);
  if (fromRoute) return fromRoute;

  return 'Sr';
}

/**
 * Resolves a FeeReceipt's campus ('Sr' or 'Jr')
 */
export function getReceiptCampus(
  receipt: Partial<FeeReceipt>,
  students: Student[],
  routes?: Route[],
  invoices?: FeeInvoice[]
): ResolvedCampus {
  const direct = normalizeCampus(receipt.campus);
  if (direct) return direct;

  const st = students.find(
    s =>
      s.id === receipt.studentId ||
      (receipt.admissionNo && s.admissionNo === receipt.admissionNo) ||
      (receipt.studentName && s.name.toLowerCase() === receipt.studentName.toLowerCase())
  );
  if (st) return getStudentCampus(st, routes);

  const invId = receipt.invoiceId || receipt.allocatedToInvoiceId;
  if (invId && invoices) {
    const inv = invoices.find(i => i.id === invId);
    if (inv) return getInvoiceCampus(inv, students, routes);
  }

  const fromReceivedBy = normalizeCampus(receipt.receivedBy);
  if (fromReceivedBy) return fromReceivedBy;

  return 'Sr';
}

/**
 * Checks whether a Vehicle serves a given campus ('Sr' or 'Jr').
 * Notice: Some vehicles serve routes in both campuses or a single campus.
 * For strict separation of financial ledgers when a single campus is needed,
 * getPrimaryVehicleCampus returns the primary campus, while vehicleServesCampus
 * checks if the vehicle operates in that campus.
 */
export function getPrimaryVehicleCampus(
  vehicle?: Partial<Vehicle> | null,
  routes?: Route[],
  students?: Student[]
): ResolvedCampus {
  if (!vehicle) return 'Sr';

  if (routes && routes.length > 0) {
    const matchedRoutes = routes.filter(
      r =>
        r.vehicleId === vehicle.id ||
        r.assignedVehicleNumber === vehicle.vehicleNumber ||
        (vehicle.assignedRouteId && r.id === vehicle.assignedRouteId)
    );
    if (matchedRoutes.length > 0) {
      const jrCount = matchedRoutes.filter(r => getRouteCampus(r) === 'Jr').length;
      const srCount = matchedRoutes.filter(r => getRouteCampus(r) === 'Sr').length;
      if (jrCount > srCount) return 'Jr';
      if (srCount > 0) return 'Sr';
    }
  }

  if (students && students.length > 0 && vehicle.id) {
    const matchedStudents = students.filter(s => s.vehicleId === vehicle.id);
    if (matchedStudents.length > 0) {
      const jrCount = matchedStudents.filter(s => getStudentCampus(s, routes) === 'Jr').length;
      const srCount = matchedStudents.filter(s => getStudentCampus(s, routes) === 'Sr').length;
      if (jrCount > srCount) return 'Jr';
    }
  }

  return 'Sr';
}

export function vehicleServesCampus(
  vehicle: Partial<Vehicle>,
  campus: CampusFilter,
  routes?: Route[],
  students?: Student[]
): boolean {
  const norm = normalizeCampus(campus);
  if (!norm) return true;

  if (routes && routes.length > 0) {
    const matchedRoutes = routes.filter(
      r =>
        r.vehicleId === vehicle.id ||
        r.assignedVehicleNumber === vehicle.vehicleNumber ||
        (vehicle.assignedRouteId && r.id === vehicle.assignedRouteId)
    );
    if (matchedRoutes.some(r => getRouteCampus(r) === norm)) return true;
  }

  if (students && students.length > 0 && vehicle.id) {
    if (students.some(s => s.vehicleId === vehicle.id && getStudentCampus(s, routes) === norm)) {
      return true;
    }
  }

  return getPrimaryVehicleCampus(vehicle, routes, students) === norm;
}

/**
 * Resolves an ExpenseRecord's campus ('Sr' or 'Jr')
 */
export function getExpenseCampus(
  expense: Partial<ExpenseRecord>,
  vehicles?: Vehicle[],
  routes?: Route[],
  students?: Student[]
): ResolvedCampus {
  const direct = normalizeCampus(expense.campus);
  if (direct) return direct;

  const fromRecordedBy = normalizeCampus(expense.recordedBy);
  if (fromRecordedBy) return fromRecordedBy;

  if ((expense.vehicleId || expense.vehicleNumber) && vehicles && vehicles.length > 0) {
    const v = vehicles.find(
      veh =>
        (expense.vehicleId && veh.id === expense.vehicleId) ||
        (expense.vehicleNumber && veh.vehicleNumber === expense.vehicleNumber)
    );
    if (v) return getPrimaryVehicleCampus(v, routes, students);
  }

  if (expense.vehicleNumber && routes && routes.length > 0) {
    const r = routes.find(
      rt =>
        rt.assignedVehicleNumber === expense.vehicleNumber ||
        rt.code.includes(expense.vehicleNumber || '')
    );
    if (r) return getRouteCampus(r);
  }

  return 'Sr';
}

/**
 * Resolves an IncomeRecord's campus ('Sr' or 'Jr')
 */
export function getIncomeCampus(income: Partial<IncomeRecord>): ResolvedCampus {
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
  voucher: Partial<JournalVoucher>,
  students?: Student[],
  vehicles?: Vehicle[],
  routes?: Route[]
): ResolvedCampus {
  const direct = normalizeCampus(voucher.campus);
  if (direct) return direct;

  const partyCandidates: string[] = [];
  if (voucher.partyName) partyCandidates.push(voucher.partyName);
  if (voucher.lines) {
    voucher.lines.forEach(l => {
      if (l.partyName) partyCandidates.push(l.partyName);
    });
  }

  if (partyCandidates.length > 0 && students && students.length > 0) {
    for (const p of partyCandidates) {
      const st = students.find(
        s => s.name.toLowerCase() === p.toLowerCase() || s.admissionNo === p
      );
      if (st) return getStudentCampus(st, routes);
    }
  }

  const costCenters: string[] = [];
  if (voucher.costCenter) costCenters.push(voucher.costCenter);
  if (voucher.lines) {
    voucher.lines.forEach(l => {
      if (l.costCenter) costCenters.push(l.costCenter);
    });
  }

  if (costCenters.length > 0 && vehicles && vehicles.length > 0) {
    for (const cc of costCenters) {
      const v = vehicles.find(veh => veh.vehicleNumber === cc || veh.id === cc);
      if (v) return getPrimaryVehicleCampus(v, routes, students);
    }
  }

  // Also check narration for student admissionNo or name
  if (voucher.narration && students && students.length > 0) {
    const narrLower = voucher.narration.toLowerCase();
    const matchedStudent = students.find(
      s =>
        (s.admissionNo && voucher.narration?.includes(s.admissionNo)) ||
        (s.name && s.name.length > 3 && narrLower.includes(s.name.toLowerCase()))
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
  record: Partial<FollowUpRecord | WarningLetter>,
  students: Student[],
  routes?: Route[]
): ResolvedCampus {
  const direct = normalizeCampus((record as any).campus);
  if (direct) return direct;

  const st = students.find(
    s =>
      s.id === record.studentId ||
      (record.admissionNo && s.admissionNo === record.admissionNo) ||
      (record.studentName && s.name.toLowerCase() === record.studentName.toLowerCase())
  );
  if (st) return getStudentCampus(st, routes);

  const fromRoute = normalizeCampus((record as any).routeName);
  if (fromRoute) return fromRoute;

  return 'Sr';
}

/**
 * Helper to check if a resolved campus matches the active campus filter ('all' | 'Sr' | 'Jr')
 */
export function matchesCampusFilter(recordCampus: ResolvedCampus, filter: CampusFilter | string | null | undefined): boolean {
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

export function calculateCampusFinancials(
  filter: CampusFilter,
  params: {
    students: Student[];
    routes?: Route[];
    vehicles?: Vehicle[];
    invoices?: FeeInvoice[];
    receipts: FeeReceipt[];
    incomes?: IncomeRecord[];
    expenses?: ExpenseRecord[];
  }
): CampusFinancialSummary {
  const { students, routes, vehicles, invoices = [], receipts, incomes = [], expenses = [] } = params;

  const scopedStudents = students.filter(s =>
    matchesCampusFilter(getStudentCampus(s, routes), filter)
  );

  const scopedReceipts = receipts.filter(r =>
    matchesCampusFilter(getReceiptCampus(r, students, routes, invoices), filter)
  );

  const scopedIncomes = incomes.filter(inc =>
    matchesCampusFilter(getIncomeCampus(inc), filter)
  );

  const approvedExpenses = expenses.filter(
    exp =>
      exp.approvalStatus !== 'Rejected' &&
      exp.approvalStatus !== 'Pending Approval' &&
      matchesCampusFilter(getExpenseCampus(exp, vehicles, routes, students), filter)
  );

  const isCashMode = (mode?: string) => (mode || '').toLowerCase() === 'cash';
  const getReceiptAmt = (r: FeeReceipt) => Number(r.amountPaid ?? r.amount ?? 0);

  const feeCash = scopedReceipts
    .filter(r => isCashMode(r.paymentMode))
    .reduce((sum, r) => sum + getReceiptAmt(r), 0);

  const feeOnline = scopedReceipts
    .filter(r => !isCashMode(r.paymentMode))
    .reduce((sum, r) => sum + getReceiptAmt(r), 0);

  const feeTotal = feeCash + feeOnline;

  const otherIncomeCash = scopedIncomes
    .filter(i => isCashMode(i.receivedTo || i.paymentMode))
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const otherIncomeOnline = scopedIncomes
    .filter(i => !isCashMode(i.receivedTo || i.paymentMode))
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const otherIncomeTotal = otherIncomeCash + otherIncomeOnline;

  const totalInflowCash = feeCash + otherIncomeCash;
  const totalInflowOnline = feeOnline + otherIncomeOnline;
  const totalInflow = totalInflowCash + totalInflowOnline;

  const expenseCash = approvedExpenses
    .filter(e => isCashMode(e.paymentMode))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const expenseOnline = approvedExpenses
    .filter(e => !isCashMode(e.paymentMode))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const expenseTotal = expenseCash + expenseOnline;

  const netCashBalance = totalInflowCash - expenseCash;
  const netOnlineBalance = totalInflowOnline - expenseOnline;
  const netTotalBalance = totalInflow - expenseTotal;

  // Calculate total outstanding dues for scoped students
  const scopedInvoices = invoices.filter(inv =>
    matchesCampusFilter(getInvoiceCampus(inv, students, routes), filter)
  );
  const invoicePending = scopedInvoices.reduce(
    (sum, inv) => sum + (Number(inv.balanceDue ?? inv.balanceAmount ?? 0) || 0),
    0
  );
  const prevDuesPending = scopedStudents.reduce((sum, s) => sum + (Number(s.previousDues) || 0), 0);
  const studentOutstandingSum = scopedStudents.reduce(
    (sum, s) => sum + Math.max(Number(s.outstandingAmount) || 0, Number(s.previousDues) || 0),
    0
  );
  const outstandingDues = Math.max(invoicePending + prevDuesPending, studentOutstandingSum);

  return {
    campus: filter,
    label: formatCampusLabel(filter),
    feeCash,
    feeOnline,
    feeTotal,
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

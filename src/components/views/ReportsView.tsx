import React, { useState } from 'react';
import {
  BarChart3,
  Users,
  Bus,
  IndianRupee,
  Briefcase,
  MapPin,
  Search,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { ReportsSummary } from '../../services/api.js';
import {
  StudentMember,
  DailyTrip,
  Vehicle,
  FeeInvoice,
  FeeReceipt,
  ExpenseRecord,
  IncomeRecord,
  Employee,
  StaffPayrollRecord,
  StaffAdvanceRecord,
  OdometerLog,
  RouteMaster,
} from '../../types/index.js';
import { PrintExportToolbar } from '../../utils/exportPrint.js';

interface ReportsViewProps {
  schoolName?: string;
  summary: ReportsSummary | null;
  students: StudentMember[];
  trips: DailyTrip[];
  vehicles: Vehicle[];
  routes?: RouteMaster[];
  invoices?: FeeInvoice[];
  receipts?: FeeReceipt[];
  expenses?: ExpenseRecord[];
  incomes?: IncomeRecord[];
  employees?: Employee[];
  staffPayrolls?: StaffPayrollRecord[];
  staffAdvances?: StaffAdvanceRecord[];
  odometerLogs?: OdometerLog[];
  initialSubTab?: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  schoolName = 'Narendra Edu Valley',
  summary,
  students = [],
  trips = [],
  vehicles = [],
  routes = [],
  invoices = [],
  receipts = [],
  expenses = [],
  incomes = [],
  employees = [],
  staffPayrolls = [],
  staffAdvances = [],
  odometerLogs = [],
}) => {
  const [reportType, setReportType] = useState<
    'members' | 'fleet' | 'finance' | 'payroll' | 'routes'
  >('members');

  // Filters for Member Report
  const [searchQuery, setSearchQuery] = useState('');
  const [campusFilter, setCampusFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [duesOnly, setDuesOnly] = useState(false);

  // 1. Member-Wise Detailed Rows
  const memberReportRows = students
    .map((s) => {
      const stuInvs = invoices.filter(
        (i) => i.studentId === s.id || i.admissionNo === s.admissionNo
      );
      const stuRecs = receipts.filter(
        (r) => r.studentId === s.id || r.admissionNo === s.admissionNo
      );
      const totalBilled =
        stuInvs.reduce((acc, i) => acc + i.netAmount, 0) ||
        Math.max(0, s.monthlyFee - s.concessionAmount);
      const totalPaid = stuRecs.reduce((acc, r) => acc + (r.amountPaid ?? r.amount ?? 0), 0);
      const netMonthly = Math.max(0, s.monthlyFee - s.concessionAmount);

      const subjectiveStatus =
        s.transportStatus === 'Left'
          ? 'Left School/Service (Excluded from Auto-Due)'
          : s.transportStatus === 'Suspended'
          ? `Suspended (${s.statusReason || 'Overdue / Indiscipline'})`
          : s.activePermissionLetter
          ? `Permission Extension till ${s.activePermissionLetter.allowedUntilDate}`
          : s.balanceDue > 0
          ? `Arrears Pending (Rs. ${s.balanceDue})`
          : 'Regular / Dues Cleared';

      return {
        ...s,
        netMonthly,
        totalBilled,
        totalPaid,
        subjectiveStatus,
      };
    })
    .filter((r) => {
      if (campusFilter !== 'all' && r.campus !== campusFilter) return false;
      if (statusFilter !== 'all' && r.transportStatus !== statusFilter) return false;
      if (duesOnly && r.balanceDue <= 0) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.admissionNo.toLowerCase().includes(q) ||
          r.villageName.toLowerCase().includes(q) ||
          r.pickupDropStopName.toLowerCase().includes(q) ||
          r.routeCode.toLowerCase().includes(q)
        );
      }
      return true;
    });

  // 2. Fleet Performance, Mileage Threshold & Cost Rows
  const fleetReportRows = vehicles.map((v) => {
    const vehLogs = odometerLogs.filter(
      (l) => l.vehicleId === v.id || l.vehicleNumber === v.registrationNumber
    );
    const totalDistanceKm = vehLogs.reduce(
      (acc, l) =>
        acc +
        Math.max(
          0,
          Number(
            l.tripKm ??
              l.distanceKm ??
              (l.closingOdometer ?? l.endOdometer ?? 0) -
                (l.openingOdometer ?? l.startOdometer ?? 0)
          )
        ),
      0
    );

    const vehExpenses = expenses.filter(
      (e) =>
        (e.vehicleId === v.id || e.vehicleNumber === v.registrationNumber) &&
        (!e.approvalStatus || e.approvalStatus === 'Approved')
    );
    const fuelExpenses = vehExpenses.filter((e) => e.category === 'Fuel');
    const maintExpenses = vehExpenses.filter((e) => e.category !== 'Fuel');

    const totalFuelSpend = fuelExpenses.reduce((acc, e) => acc + e.amount, 0);
    const totalMaintSpend = maintExpenses.reduce((acc, e) => acc + e.amount, 0);
    const totalLitresFromExpenses = fuelExpenses.reduce(
      (acc, e) => acc + Number(e.fuelLitres || 0),
      0
    );
    const totalLitresFromLogs = vehLogs.reduce((acc, l) => acc + Number(l.fuelLitres || 0), 0);
    const totalFuelLitres = totalLitresFromExpenses + totalLitresFromLogs;

    const thresholdKmPerL = Number(v.expectedMileageKmPerL ?? v.baselineMileageKmPerLitre ?? 6.5);
    const actualKmPerL =
      totalFuelLitres > 0 && totalDistanceKm > 0
        ? Number((totalDistanceKm / totalFuelLitres).toFixed(2))
        : thresholdKmPerL;

    const mileageVerdict =
      actualKmPerL >= thresholdKmPerL
        ? `Above Threshold (+${(actualKmPerL - thresholdKmPerL).toFixed(2)} km/L)`
        : `Below Threshold (${(actualKmPerL - thresholdKmPerL).toFixed(2)} km/L — Check Engine/Driver)`;

    const totalCost = totalFuelSpend + totalMaintSpend;
    const costPerKm = totalDistanceKm > 0 ? Number((totalCost / totalDistanceKm).toFixed(2)) : 0;

    return {
      ...v,
      totalDistanceKm,
      totalFuelLitres: Number(totalFuelLitres.toFixed(1)),
      thresholdKmPerL,
      actualKmPerL,
      mileageVerdict,
      totalFuelSpend,
      totalMaintSpend,
      totalCost,
      costPerKm,
    };
  });

  // 3. Financial Income vs Expense Consolidated Rows
  const approvedExpenses = expenses.filter(
    (e) => !e.approvalStatus || e.approvalStatus === 'Approved'
  );
  const totalFeeCollected = receipts.reduce((acc, r) => acc + (r.amountPaid ?? r.amount ?? 0), 0);
  const totalOtherIncome = incomes.reduce((acc, inc) => acc + Number(inc.amount || 0), 0);
  const totalGrossIncome = totalFeeCollected + totalOtherIncome;
  const totalApprovedExpense = approvedExpenses.reduce((acc, e) => acc + e.amount, 0);
  const totalOutstandingDues = students
    .filter((s) => s.transportStatus !== 'Left')
    .reduce((acc, s) => acc + s.balanceDue, 0);

  const financialLedgerRows = [
    ...receipts.map((r) => ({
      id: `rec-${r.id}`,
      date: r.date,
      refNo: r.receiptNo,
      type: 'Fee Collection (Income)',
      head: 'Transport Fee Receipt',
      party: `${r.studentName} (${r.admissionNo})`,
      mode: r.paymentMode,
      creditIncome: r.amountPaid ?? r.amount ?? 0,
      debitExpense: 0,
      remarks: r.feeBreakupDescription || r.remarks || 'Transport Fee',
    })),
    ...incomes.map((inc) => ({
      id: `inc-${inc.id}`,
      date: inc.date,
      refNo: inc.incomeNo || inc.receiptNo || inc.id,
      type: 'Other Income (Income)',
      head: inc.incomeHeadName || inc.headName || inc.category || 'Other Income',
      party: inc.receivedFrom || 'External Party',
      mode: inc.paymentMode,
      creditIncome: Number(inc.amount || 0),
      debitExpense: 0,
      remarks: inc.narration || inc.description || 'Other Transport Income',
    })),
    ...approvedExpenses.map((exp) => ({
      id: `exp-${exp.id}`,
      date: exp.date,
      refNo: exp.expenseNo,
      type: 'Operational Expense (Debit)',
      head: exp.expenseHeadName || exp.category,
      party: `${exp.vendorName}${exp.vehicleNumber ? ` • ${exp.vehicleNumber}` : ''}`,
      mode: exp.paymentMode,
      creditIncome: 0,
      debitExpense: exp.amount,
      remarks: exp.narration,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  // 4. Staff Payroll & Advance Rows
  const staffReportRows = employees.map((emp) => {
    const latestPayroll = staffPayrolls.find((p) => p.employeeId === emp.id);
    const activeAdvances = staffAdvances.filter(
      (a) => a.employeeId === emp.id && a.status === 'Active'
    );
    const pendingAdvance = activeAdvances.reduce((acc, a) => acc + a.balanceAmount, 0);
    const baseSalary = emp.monthlyBaseSalary || 14000;
    const dailyRate = Number((baseSalary / 31).toFixed(2));
    return {
      ...emp,
      baseSalary,
      dailyRate,
      presentDays: latestPayroll?.presentDays ?? 26,
      holidayDays: latestPayroll?.holidayDays ?? 4,
      leaveDays: latestPayroll?.leaveDays ?? 0,
      absentDays: latestPayroll?.absentDays ?? 0,
      clAdjustment:
        latestPayroll
          ? latestPayroll.clBonusDays > 0
            ? '+1 Day Extra (100% Present Bonus)'
            : `CL Adjusted: ${latestPayroll.clAdjustedDays}d | Deduct: ${latestPayroll.leaveDeductionDays}d`
          : '+1 Day Extra (Eligible)',
      absentPenaltyDays: latestPayroll?.absentPenaltyDays ?? 0,
      pendingAdvance,
      netPayable: latestPayroll?.netPayableSalary ?? Math.round(baseSalary + dailyRate - pendingAdvance),
      payrollStatus: latestPayroll?.status ?? 'Projected (Unfinalized)',
    };
  });

  // 5. Route-Wise Revenue & Occupancy Rows
  const routeReportRows = routes.map((rt) => {
    const routeMembers = students.filter(
      (s) => (s.routeId === rt.id || s.routeCode === rt.code) && s.transportStatus !== 'Left'
    );
    const activeCount = routeMembers.filter((s) => s.transportStatus === 'Active').length;
    const suspendedCount = routeMembers.filter((s) => s.transportStatus === 'Suspended').length;
    const monthlyPotential = routeMembers.reduce(
      (acc, s) => acc + Math.max(0, s.monthlyFee - s.concessionAmount),
      0
    );
    const routeArrears = routeMembers.reduce((acc, s) => acc + s.balanceDue, 0);
    const veh = vehicles.find(
      (v) => v.id === rt.vehicleId || v.registrationNumber === rt.vehicleNumber
    );
    const seatCap = veh?.capacity || 40;
    const occupancyPct = Math.round((activeCount / Math.max(1, seatCap)) * 100);

    return {
      ...rt,
      vehicleReg: veh?.registrationNumber || rt.vehicleNumber || 'Unassigned',
      driverName: veh?.assignedDriverName || veh?.driverName || '—',
      helperName: veh?.assignedHelperName || '—',
      seatCap,
      enrolledCount: routeMembers.length,
      activeCount,
      suspendedCount,
      occupancyPct,
      monthlyPotential,
      routeArrears,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Business Intelligence &amp; Subjective Audit Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Comprehensive member dues, fleet mileage threshold analysis, income/expense ledgers, staff payroll &amp; route occupancy
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {reportType === 'members' && (
            <PrintExportToolbar
              title="Member-Wise Consolidated Fee, Dues & Status Report"
              filename="member_consolidated_report"
              schoolName={schoolName}
              isFiltered={
                campusFilter !== 'all' ||
                statusFilter !== 'all' ||
                duesOnly ||
                searchQuery.trim() !== ''
              }
              filteredRows={memberReportRows}
              allRows={students.map((s) => ({
                ...s,
                netMonthly: Math.max(0, s.monthlyFee - s.concessionAmount),
                totalBilled: s.monthlyFee || 0,
                totalPaid: 0,
                subjectiveStatus: String(s.transportStatus || 'Active'),
              }))}
              columns={[
                { header: 'ID / Admission No', accessor: (r) => r.admissionNo },
                { header: 'Member Name', accessor: (r) => r.name },
                { header: 'Member Type', accessor: (r) => r.memberType || 'Student' },
                { header: 'Class & Sec', accessor: (r) => `${r.class}-${r.section}` },
                { header: 'Campus', accessor: (r) => r.campus },
                { header: 'Guardian & Mobile', accessor: (r) => `${r.fatherName} (${r.mobile})` },
                { header: 'Village & Stop', accessor: (r) => `${r.villageName} - ${r.pickupDropStopName}` },
                { header: 'Route Code', accessor: (r) => r.routeCode },
                { header: 'Net Monthly Fee (INR)', accessor: (r) => r.netMonthly },
                { header: 'Balance Due (INR)', accessor: (r) => r.balanceDue },
                { header: 'Subjective Status & Remarks', accessor: (r) => r.subjectiveStatus },
              ]}
            />
          )}

          {reportType === 'fleet' && (
            <PrintExportToolbar
              title="Fleet Performance, Mileage Threshold & Cost/Km Report"
              filename="fleet_mileage_cost_report"
              schoolName={schoolName}
              filteredRows={fleetReportRows}
              allRows={fleetReportRows}
              columns={[
                { header: 'Vehicle No', accessor: (v) => v.registrationNumber },
                { header: 'Fleet Name', accessor: (v) => v.nickname },
                { header: 'Assigned Driver & Helper', accessor: (v) => `${v.assignedDriverName} / ${v.assignedHelperName || '—'}` },
                { header: 'Current Odometer (km)', accessor: (v) => v.currentOdometer },
                { header: 'Logged Running (km)', accessor: (v) => v.totalDistanceKm },
                { header: 'Threshold Mileage (km/L)', accessor: (v) => v.thresholdKmPerL },
                { header: 'Actual Mileage (km/L)', accessor: (v) => v.actualKmPerL },
                { header: 'Threshold Evaluation', accessor: (v) => v.mileageVerdict },
                { header: 'Fuel Spend (INR)', accessor: (v) => v.totalFuelSpend },
                { header: 'Maint. Spend (INR)', accessor: (v) => v.totalMaintSpend },
                { header: 'Fitness & Insurance Expiry', accessor: (v) => `Fit: ${v.fitnessUpto} | Ins: ${v.insuranceUpto}` },
              ]}
            />
          )}

          {reportType === 'finance' && (
            <PrintExportToolbar
              title="Consolidated Transport Income, Expense & Net Cash Flow Report"
              filename="transport_income_expense_report"
              schoolName={schoolName}
              filteredRows={financialLedgerRows}
              allRows={financialLedgerRows}
              columns={[
                { header: 'Date', accessor: (r) => r.date },
                { header: 'Ref / Voucher No', accessor: (r) => r.refNo },
                { header: 'Transaction Type', accessor: (r) => r.type },
                { header: 'Account Head', accessor: (r) => r.head },
                { header: 'Member / Vendor / Vehicle', accessor: (r) => r.party },
                { header: 'Mode', accessor: (r) => r.mode },
                { header: 'Income Credit (INR)', accessor: (r) => r.creditIncome },
                { header: 'Expense Debit (INR)', accessor: (r) => r.debitExpense },
                { header: 'Subjective Narration', accessor: (r) => r.remarks },
              ]}
            />
          )}

          {reportType === 'payroll' && (
            <PrintExportToolbar
              title="Staff Attendance, Casual Leave (CL), Absent Penalty & Payroll Report"
              filename="staff_payroll_audit_report"
              schoolName={schoolName}
              filteredRows={staffReportRows}
              allRows={staffReportRows}
              columns={[
                { header: 'Emp Code', accessor: (r) => r.employeeCode },
                { header: 'Staff Name', accessor: (r) => r.name },
                { header: 'Designation', accessor: (r) => r.designation },
                { header: 'Campus', accessor: (r) => r.campus || 'Sr' },
                { header: 'Base Salary (INR)', accessor: (r) => r.baseSalary },
                { header: 'Daily Salary (INR)', accessor: (r) => r.dailyRate },
                { header: 'P / H / L / A Days', accessor: (r) => `P:${r.presentDays} H:${r.holidayDays} L:${r.leaveDays} A:${r.absentDays}` },
                { header: 'CL Bonus / Leave Adj', accessor: (r) => r.clAdjustment },
                { header: 'Absent Penalty Days (2x)', accessor: (r) => r.absentPenaltyDays },
                { header: 'Pending Advance (INR)', accessor: (r) => r.pendingAdvance },
                { header: 'Net Payable (INR)', accessor: (r) => r.netPayable },
                { header: 'Payroll Status', accessor: (r) => r.payrollStatus },
              ]}
            />
          )}

          {reportType === 'routes' && (
            <PrintExportToolbar
              title="Route-Wise Occupancy, Tariff Potential & Arrears Report"
              filename="route_occupancy_revenue_report"
              schoolName={schoolName}
              filteredRows={routeReportRows}
              allRows={routeReportRows}
              columns={[
                { header: 'Route Code', accessor: (r) => r.code },
                { header: 'Route Name', accessor: (r) => r.name },
                { header: 'Vehicle No', accessor: (r) => r.vehicleReg },
                { header: 'Driver & Helper', accessor: (r) => `${r.driverName} / ${r.helperName}` },
                { header: 'Seat Capacity', accessor: (r) => r.seatCap },
                { header: 'Active / Suspended', accessor: (r) => `${r.activeCount} Active / ${r.suspendedCount} Susp.` },
                { header: 'Occupancy %', accessor: (r) => `${r.occupancyPct}%` },
                { header: 'Monthly Fee Potential (INR)', accessor: (r) => r.monthlyPotential },
                { header: 'Pending Route Dues (INR)', accessor: (r) => r.routeArrears },
              ]}
            />
          )}
        </div>
      </div>

      {/* Top Executive Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => setReportType('members')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            reportType === 'members'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase opacity-75">Member Dues</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono mt-1">
            ₹{totalOutstandingDues.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] opacity-75 mt-1">
            {students.filter((s) => s.balanceDue > 0 && s.transportStatus !== 'Left').length} members with arrears
          </div>
        </div>

        <div
          onClick={() => setReportType('fleet')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            reportType === 'fleet'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase opacity-75">Fleet &amp; Mileage</span>
            <Bus className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono mt-1">{vehicles.length} Vehicles</div>
          <div className="text-[10px] opacity-75 mt-1">
            {fleetReportRows.filter((v) => v.actualKmPerL >= v.thresholdKmPerL).length} meeting threshold km/L
          </div>
        </div>

        <div
          onClick={() => setReportType('finance')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            reportType === 'finance'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase opacity-75">Net Surplus</span>
            <IndianRupee className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono mt-1">
            ₹{(totalGrossIncome - totalApprovedExpense).toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] opacity-75 mt-1">
            Inc: ₹{totalGrossIncome.toLocaleString('en-IN')} | Exp: ₹{totalApprovedExpense.toLocaleString('en-IN')}
          </div>
        </div>

        <div
          onClick={() => setReportType('payroll')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            reportType === 'payroll'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase opacity-75">Staff Payroll</span>
            <Briefcase className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono mt-1">{employees.length} Staff</div>
          <div className="text-[10px] opacity-75 mt-1">
            CL, Absent 2x Penalty &amp; Advance Adj
          </div>
        </div>

        <div
          onClick={() => setReportType('routes')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            reportType === 'routes'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase opacity-75">Route Revenue</span>
            <MapPin className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono mt-1">{routes.length} Routes</div>
          <div className="text-[10px] opacity-75 mt-1">
            Stop-wise tariff &amp; seat utilization
          </div>
        </div>
      </div>

      {/* Report Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        {[
          { id: 'members', label: '1. Member Consolidated Dues & Status' },
          { id: 'fleet', label: '2. Fleet Mileage Threshold & Cost/Km' },
          { id: 'finance', label: '3. Income, Expense & Net Cash Ledger' },
          { id: 'payroll', label: '4. Staff Attendance, CL & Payroll Audit' },
          { id: 'routes', label: '5. Route Occupancy & Revenue Potential' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              reportType === tab.id
                ? 'bg-amber-500 text-slate-950 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* =====================================================================
          REPORT 1: MEMBER-WISE CONSOLIDATED LEDGER
         ===================================================================== */}
      {reportType === 'members' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Member-Wise Consolidated Fee, Dues &amp; Transit Status Report ({memberReportRows.length})
              </h3>
              <p className="text-xs text-slate-500">
                Detailed member tariff, concession, total billed, total paid, pending balance, and subjective status analysis
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search member, village, stop..."
                  className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50"
                />
              </div>
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold"
              >
                <option value="all">All Campuses</option>
                <option value="Sr">Senior (Sr)</option>
                <option value="Jr">Junior (Jr)</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold"
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Left">Left School</option>
              </select>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={duesOnly}
                  onChange={(e) => setDuesOnly(e.target.checked)}
                  className="accent-rose-600"
                />
                <span>Pending Dues Only</span>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">ID / Adm No</th>
                  <th className="py-2.5 px-3">Member &amp; Category</th>
                  <th className="py-2.5 px-3">Class &amp; Campus</th>
                  <th className="py-2.5 px-3">Guardian &amp; Mobile</th>
                  <th className="py-2.5 px-3">Village, Stop &amp; Route</th>
                  <th className="py-2.5 px-3 text-right">Net Fee/Mo</th>
                  <th className="py-2.5 px-3 text-right">Paid</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                  <th className="py-2.5 px-3">Subjective Evaluation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {memberReportRows.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{s.admissionNo}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      <div className="text-[10px] text-slate-500">{s.memberType}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      {s.class}-{s.section} ({s.campus})
                    </td>
                    <td className="py-2.5 px-3">
                      <div>{s.fatherName}</div>
                      <div className="font-mono text-[10px] text-slate-500">{s.mobile}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-amber-800">{s.routeCode}</span> • {s.villageName} ({s.pickupDropStopName})
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">₹{s.netMonthly}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                      ₹{s.totalPaid.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                      ₹{s.balanceDue.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          s.transportStatus === 'Suspended'
                            ? 'bg-rose-100 text-rose-800'
                            : s.transportStatus === 'Left'
                            ? 'bg-slate-200 text-slate-700'
                            : s.balanceDue > 0
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {s.subjectiveStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          REPORT 2: FLEET MILEAGE THRESHOLD & COST/KM ANALYSIS
         ===================================================================== */}
      {reportType === 'fleet' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm">
              Fleet Mileage Threshold Comparison, Running Km &amp; Operational Cost Report
            </h3>
            <p className="text-xs text-slate-500">
              Compares each vehicle&apos;s actual running mileage against the Admin-defined Threshold Mileage (km/L) alongside driver assignment and maintenance spend
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Vehicle &amp; Model</th>
                  <th className="py-2.5 px-3">Assigned Crew</th>
                  <th className="py-2.5 px-3 text-right">Current Odo</th>
                  <th className="py-2.5 px-3 text-right">Logged Running</th>
                  <th className="py-2.5 px-3 text-right">Threshold (km/L)</th>
                  <th className="py-2.5 px-3 text-right">Actual (km/L)</th>
                  <th className="py-2.5 px-3">Threshold Status</th>
                  <th className="py-2.5 px-3 text-right">Fuel + Maint Spend</th>
                  <th className="py-2.5 px-3">Statutory Renewals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fleetReportRows.map((v) => {
                  const isAbove = v.actualKmPerL >= v.thresholdKmPerL;
                  return (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-bold text-slate-900">{v.registrationNumber}</div>
                        <div className="text-[10px] text-slate-500">{v.nickname} ({v.capacity} Seats)</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">Driver: {v.assignedDriverName}</div>
                        <div className="text-[10px] text-slate-500">Helper: {v.assignedHelperName || '—'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {v.currentOdometer.toLocaleString('en-IN')} km
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {v.totalDistanceKm.toLocaleString('en-IN')} km
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                        {v.thresholdKmPerL} km/L
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                        {v.actualKmPerL} km/L
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isAbove ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isAbove ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          <span>{v.mileageVerdict}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="font-bold text-slate-900">₹{v.totalCost.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] text-slate-500">
                          Fuel: ₹{v.totalFuelSpend} | Maint: ₹{v.totalMaintSpend}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-600">
                        <div>Fit: {v.fitnessUpto} | Ins: {v.insuranceUpto}</div>
                        <div>PUC: {v.pollutionUpto} | Tax: {v.taxPaidUpto}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          REPORT 3: CONSOLIDATED INCOME, EXPENSE & NET CASH LEDGER
         ===================================================================== */}
      {reportType === 'finance' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] font-bold uppercase text-emerald-800">Fee Receipts + Other Income</span>
              <div className="text-xl font-bold font-mono text-emerald-900 mt-1">
                ₹{totalGrossIncome.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                Fees: ₹{totalFeeCollected.toLocaleString('en-IN')} • Other: ₹{totalOtherIncome.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
              <span className="text-[10px] font-bold uppercase text-rose-800">Approved Operational Expenses</span>
              <div className="text-xl font-bold font-mono text-rose-900 mt-1">
                ₹{totalApprovedExpense.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-rose-700 mt-0.5">
                Across {approvedExpenses.length} approved vouchers
              </div>
            </div>
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
              <span className="text-[10px] font-bold uppercase text-indigo-800">Net Cash Surplus / Balance</span>
              <div className="text-xl font-bold font-mono text-indigo-900 mt-1">
                ₹{(totalGrossIncome - totalApprovedExpense).toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-indigo-700 mt-0.5">
                Realized cash in hand &amp; bank
              </div>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-[10px] font-bold uppercase text-amber-800">Pending Member Receivables</span>
              <div className="text-xl font-bold font-mono text-amber-950 mt-1">
                ₹{totalOutstandingDues.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-amber-800 mt-0.5">
                Recoverable from active &amp; suspended members
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Ref No</th>
                  <th className="py-2.5 px-3">Type &amp; Head</th>
                  <th className="py-2.5 px-3">Party / Member / Vehicle</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3 text-right">Income Credit (₹)</th>
                  <th className="py-2.5 px-3 text-right">Expense Debit (₹)</th>
                  <th className="py-2.5 px-3">Subjective Narration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {financialLedgerRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono text-slate-600">{row.date}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{row.refNo}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{row.head}</div>
                      <div className="text-[10px] text-slate-500">{row.type}</div>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{row.party}</td>
                    <td className="py-2.5 px-3 font-semibold">{row.mode}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      {row.creditIncome > 0 ? `₹${row.creditIncome.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                      {row.debitExpense > 0 ? `₹${row.debitExpense.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{row.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          REPORT 4: STAFF ATTENDANCE, CASUAL LEAVE (CL) & PAYROLL AUDIT
         ===================================================================== */}
      {reportType === 'payroll' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm">
              Staff Attendance, Casual Leave (1 Paid CL/Mo), Unauthorised Absent Penalty (2x) &amp; Advance Adjustment Report
            </h3>
            <p className="text-xs text-slate-500">
              Subjective breakdown of monthly salary divided by days in month, paid holidays (H), CL bonus/adjustment, and advance deductions
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Emp Code &amp; Name</th>
                  <th className="py-2.5 px-3">Designation &amp; Campus</th>
                  <th className="py-2.5 px-3 text-right">Monthly Salary</th>
                  <th className="py-2.5 px-3 text-right">Daily Rate</th>
                  <th className="py-2.5 px-3 text-center">P / H / L / A</th>
                  <th className="py-2.5 px-3">CL Bonus / Leave Rule</th>
                  <th className="py-2.5 px-3 text-center">Absent Penalty (2x)</th>
                  <th className="py-2.5 px-3 text-right">Pending Advance</th>
                  <th className="py-2.5 px-3 text-right">Net Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffReportRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{r.name}</div>
                      <div className="font-mono text-[10px] text-slate-500">{r.employeeCode}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-800">{r.designation}</span> ({r.campus || 'Sr'})
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      ₹{r.baseSalary.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      ₹{r.dailyRate}/d
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                      <span className="text-emerald-700 font-bold">P:{r.presentDays}</span>{' '}
                      <span className="text-indigo-700 font-bold">H:{r.holidayDays}</span>{' '}
                      <span className="text-amber-700 font-bold">L:{r.leaveDays}</span>{' '}
                      <span className="text-rose-700 font-bold">A:{r.absentDays}</span>
                    </td>
                    <td className="py-2.5 px-3 text-emerald-800 font-semibold">{r.clAdjustment}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-600">
                      {r.absentPenaltyDays}d
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-800 font-bold">
                      ₹{r.pendingAdvance.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700">
                      ₹{r.netPayable.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          REPORT 5: ROUTE OCCUPANCY & REVENUE POTENTIAL
         ===================================================================== */}
      {reportType === 'routes' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm">
              Route-Wise Seat Utilization, Monthly Tariff Potential &amp; Pending Dues Report
            </h3>
            <p className="text-xs text-slate-500">
              Evaluates route profitability, active vs suspended riders, and stop-wise monthly fee revenue
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Route Code &amp; Name</th>
                  <th className="py-2.5 px-3">Vehicle &amp; Crew</th>
                  <th className="py-2.5 px-3 text-center">Seat Cap</th>
                  <th className="py-2.5 px-3 text-center">Active / Suspended</th>
                  <th className="py-2.5 px-3 text-center">Occupancy %</th>
                  <th className="py-2.5 px-3 text-right">Monthly Fee Potential</th>
                  <th className="py-2.5 px-3 text-right">Route Pending Arrears</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {routeReportRows.map((rt) => (
                  <tr key={rt.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <span className="font-mono font-bold text-slate-900">{rt.code}</span> —{' '}
                      <span className="font-semibold text-slate-800">{rt.name}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-bold text-slate-900">{rt.vehicleReg}</div>
                      <div className="text-[10px] text-slate-500">
                        {rt.driverName} / {rt.helperName}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold">{rt.seatCap}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-emerald-700 font-bold">{rt.activeCount} Active</span> /{' '}
                      <span className="text-rose-600 font-bold">{rt.suspendedCount} Susp.</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-700">
                      {rt.occupancyPct}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      ₹{rt.monthlyPotential.toLocaleString('en-IN')}/mo
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                      ₹{rt.routeArrears.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

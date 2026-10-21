import React, { useState, useEffect } from 'react';
import {
  Search, ShieldCheck, AlertTriangle, Edit, Trash2, Upload,
  FileText, UserCheck, Eye, X, FileCheck, UserPlus, Briefcase,
  Calendar, IndianRupee, Check, Clock, Plus, Printer, Sun
} from 'lucide-react';
import {
  Employee, DesignationMaster, DocumentAttachment, CandidateResume,
  CampusMaster, UserRole, StaffAttendanceRecord, StaffAttendanceStatus,
  StaffAdvanceRecord, StaffPayrollRecord, HolidayRecord
} from '../../types/index.js';
import { ResumesView } from './ResumesView.js';
import { PrintExportToolbar, FilterPopover, printTableReport } from '../../utils/exportPrint.js';
import { readFileCompressed } from '../../utils/fileCompressor.js';

interface StaffViewProps {
  schoolName?: string;
  isAdmin?: boolean;
  currentRole?: UserRole;
  userCampus?: string;
  employees: Employee[];
  designations: DesignationMaster[];
  campuses?: CampusMaster[];
  resumes?: CandidateResume[];
  staffAttendance?: StaffAttendanceRecord[];
  staffAdvances?: StaffAdvanceRecord[];
  staffPayrolls?: StaffPayrollRecord[];
  holidays?: HolidayRecord[];
  initialSubTab?: string;
  onSaveEmployee: (emp: Partial<Employee>) => Promise<void>;
  onDeleteEmployee?: (id: string) => Promise<void>;
  onSaveResume?: (resume: Partial<CandidateResume>) => Promise<void>;
  onDeleteResume?: (id: string) => Promise<void>;
  onHireResume?: (resumeId: string, salaryOverride?: number, designationIdOverride?: string) => Promise<void>;
  onMarkStaffAttendance?: (employeeId: string, date: string, status: StaffAttendanceStatus, remarks?: string) => Promise<void>;
  onDeclareHoliday?: (date: string, occasion: string, campus?: string) => Promise<void>;
  onRemoveHoliday?: (date: string) => Promise<void>;
  onGiveStaffAdvance?: (data: Omit<StaffAdvanceRecord, 'id'>) => Promise<void>;
  onFinalizePayroll?: (record: StaffPayrollRecord) => Promise<void>;
  onNavigateToResumes?: () => void;
}

export const StaffView: React.FC<StaffViewProps> = ({
  schoolName = 'Narendra Edu Valley',
  isAdmin = true,
  currentRole = 'Admin',
  userCampus = 'Sr',
  employees,
  designations,
  campuses = [],
  resumes = [],
  staffAttendance = [],
  staffAdvances = [],
  staffPayrolls = [],
  holidays = [],
  initialSubTab,
  onSaveEmployee,
  onDeleteEmployee,
  onSaveResume,
  onDeleteResume,
  onHireResume,
  onMarkStaffAttendance,
  onDeclareHoliday,
  onRemoveHoliday,
  onGiveStaffAdvance,
  onFinalizePayroll,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const currentYearMonth = todayStr.slice(0, 7); // YYYY-MM

  const [subModule, setSubModule] = useState<'resumes' | 'employees' | 'attendance' | 'payroll'>(
    initialSubTab === 'resumes'
      ? 'resumes'
      : initialSubTab === 'attendance'
      ? 'attendance'
      : initialSubTab === 'payroll'
      ? 'payroll'
      : 'employees'
  );

  useEffect(() => {
    if (initialSubTab === 'resumes') setSubModule('resumes');
    else if (initialSubTab === 'attendance') setSubModule('attendance');
    else if (initialSubTab === 'payroll') setSubModule('payroll');
    else if (initialSubTab === 'employees' || initialSubTab === 'directory') setSubModule('employees');
  }, [initialSubTab]);

  // Sub-Tab 2: Onboarded Staff Directory state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDesignation, setFilterDesignation] = useState<string>('ALL');
  const [filterCampus, setFilterCampus] = useState<string>('ALL');
  const [selectedDocPreview, setSelectedDocPreview] = useState<DocumentAttachment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);
  const [docType, setDocType] = useState<DocumentAttachment['type']>('Aadhaar Card');
  const [docName, setDocName] = useState('');

  // Sub-Tab 3: Staff Attendance & Register state
  const [attDate, setAttDate] = useState<string>(todayStr);
  const [attMonth, setAttMonth] = useState<string>(currentYearMonth);
  const [attCampusFilter, setAttCampusFilter] = useState<string>(
    currentRole === 'Transport Assistant' && userCampus && userCampus !== 'All Campuses' ? userCampus : 'all'
  );
  const [attViewMode, setAttViewMode] = useState<'daily' | 'register' | 'calendar'>('daily');
  const [selectedCalendarEmpId, setSelectedCalendarEmpId] = useState<string>(employees[0]?.id || '');
  const [holidayOccasion, setHolidayOccasion] = useState<string>('');
  const [showHolidayModal, setShowHolidayModal] = useState(false);

  // Sub-Tab 4: Payroll & Staff Advances state
  const [payrollMonth, setPayrollMonth] = useState<string>(currentYearMonth);
  const [advanceAdjustments, setAdvanceAdjustments] = useState<Record<string, number>>({});
  const [payrollPayMode, setPayrollPayMode] = useState<'Cash' | 'UPI' | 'Bank'>('Bank');
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advEmpId, setAdvEmpId] = useState<string>(employees[0]?.id || '');
  const [advAmount, setAdvAmount] = useState<number>(2000);
  const [advDate, setAdvDate] = useState<string>(todayStr);
  const [advMode, setAdvMode] = useState<'Cash' | 'UPI' | 'Bank'>('Cash');
  const [advReason, setAdvReason] = useState<string>('Salary Advance');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (currentRole === 'Transport Assistant' && userCampus && userCampus !== 'All Campuses') {
      setAttCampusFilter(userCampus);
    }
  }, [currentRole, userCampus]);

  useEffect(() => {
    if (!selectedCalendarEmpId && employees.length > 0) {
      setSelectedCalendarEmpId(employees[0].id);
    }
    if (!advEmpId && employees.length > 0) {
      setAdvEmpId(employees[0].id);
    }
  }, [employees, selectedCalendarEmpId, advEmpId]);

  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.drivingLicenseNo && e.drivingLicenseNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      e.mobile.includes(searchTerm);
    const matchesDesig = filterDesignation === 'ALL' || e.designation === filterDesignation;
    const matchesCampus = filterCampus === 'ALL' || (e.campus || 'Sr') === filterCampus;
    return matchesSearch && matchesDesig && matchesCampus;
  });

  const handleOpenAdd = () => {
    if (!isAdmin) return;
    const defaultDes = designations[0] || { id: 'des-driver', name: 'Driver', isDriver: true };
    setEditingEmployee({
      employeeCode: `EMP-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      designationId: defaultDes.id,
      designation: defaultDes.name,
      campus: campuses[0]?.code || 'Sr',
      isDriver: defaultDes.isDriver,
      drivingLicenseNo: '',
      drivingLicenseValidity: '2028-12-31',
      drivingLicenseType: 'Heavy Passenger Vehicle (HMV)',
      age: 32,
      gender: 'M',
      mobile: '',
      address: '',
      fatherName: '',
      educationQualification: '12th Pass',
      status: 'Active',
      monthlyBaseSalary: 14500,
      joiningDate: todayStr,
      documents: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee({ ...emp, documents: [...(emp.documents || [])] });
    setIsModalOpen(true);
  };

  const handleDesignationChange = (desName: string) => {
    const found = designations.find(d => d.name === desName);
    if (editingEmployee) {
      setEditingEmployee({
        ...editingEmployee,
        designationId: found?.id || 'des-custom',
        designation: desName,
        isDriver: found ? found.isDriver : desName.toLowerCase().includes('driver'),
      });
    }
  };

  const handleAddDocument = () => {
    if (!docName.trim() || !editingEmployee) return;
    const newDoc: DocumentAttachment = {
      id: `doc-${Date.now()}`,
      type: docType,
      name: docName.trim(),
      uploadedAt: todayStr,
    };
    setEditingEmployee({
      ...editingEmployee,
      documents: [...(editingEmployee.documents || []), newDoc],
    });
    setDocName('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetType: DocumentAttachment['type']) => {
    const file = e.target.files?.[0];
    if (!file || !editingEmployee) return;
    try {
      const compressed = await readFileCompressed(file, 900, 0.72);
      const newDoc: DocumentAttachment = {
        id: `doc-${Date.now()}`,
        type: targetType,
        name: file.name,
        fileData: compressed,
        uploadedAt: todayStr,
      };
      setEditingEmployee({
        ...editingEmployee,
        documents: [...(editingEmployee.documents || []), newDoc],
      });
    } catch {
      // ignore
    }
  };

  const handleRemoveDocument = (docId: string) => {
    if (!editingEmployee) return;
    setEditingEmployee({
      ...editingEmployee,
      documents: (editingEmployee.documents || []).filter(d => d.id !== docId),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    await onSaveEmployee(editingEmployee);
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const isDriver = editingEmployee?.isDriver ?? editingEmployee?.designation?.toLowerCase().includes('driver');
  const documentsList = editingEmployee?.documents || [];

  // --- Attendance Helpers ---
  const isHolidayDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const isSunday = d.getDay() === 0;
    const explicitHoliday = holidays.find(h => h.date === dateStr);
    return { isHoliday: isSunday || !!explicitHoliday, occasion: explicitHoliday?.occasion || (isSunday ? 'Sunday Weekly Off' : '') };
  };

  const getEmployeeStatusForDate = (empId: string, dateStr: string): StaffAttendanceStatus => {
    const explicit = staffAttendance.find(a => a.employeeId === empId && a.date === dateStr);
    if (explicit) return explicit.status;
    const hol = isHolidayDate(dateStr);
    if (hol.isHoliday) return 'H';
    return 'P';
  };

  const getDaysInYearMonth = (ym: string): { count: number; dates: string[] } => {
    const [yStr, mStr] = ym.split('-');
    const year = Number(yStr) || 2026;
    const month = Number(mStr) || 10;
    const count = new Date(year, month, 0).getDate();
    const dates: string[] = [];
    for (let d = 1; d <= count; d++) {
      dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return { count, dates };
  };

  const attFilteredEmployees = employees.filter(e => {
    if (e.status !== 'Active' && e.status !== 'On Leave') return false;
    const empCampus = e.campus || 'Sr';
    if (attCampusFilter !== 'all' && empCampus !== attCampusFilter) return false;
    return true;
  });

  // --- Payroll Calculation Engine (Exact Rules from User Request) ---
  // Rules:
  // 1. Daily Salary = Monthly Salary / No of days in that month
  // 2. Holiday ('H') is paid for staff
  // 3. All staff are given 1 paid Casual Leave (CL) a month:
  //    - If all present (0 Leave, 0 Absent): Add 1 day extra salary (+1 CL bonus day)
  //    - If 1 day Leave ('L'): Adjust with 1 CL (0 deduction)
  //    - If 2+ days Leave ('L'): Adjust 1 CL and deduct remaining (leaveDays - 1) days
  // 4. If any Absent ('A' - unauthorised absence): Deduct 2 days salary per absent day (absentDays * 2)
  // 5. Deduct advance given if any (user can adjust overall advance at once or a part of it)
  const { count: payrollDaysInMonth, dates: payrollMonthDates } = getDaysInYearMonth(payrollMonth);

  const calculateEmployeePayroll = (emp: Employee): StaffPayrollRecord => {
    const existingFinalized = staffPayrolls.find(
      p => p.employeeId === emp.id && p.month === payrollMonth && p.status === 'Finalized & Paid'
    );
    if (existingFinalized) return existingFinalized;

    let presentDays = 0;
    let holidayDays = 0;
    let leaveDays = 0;
    let absentDays = 0;

    for (const dt of payrollMonthDates) {
      // Only count up to today or full month projection
      const st = getEmployeeStatusForDate(emp.id, dt);
      if (st === 'P') presentDays++;
      else if (st === 'H') holidayDays++;
      else if (st === 'L') leaveDays++;
      else if (st === 'A') absentDays++;
    }

    const baseSalary = emp.monthlyBaseSalary || 14000;
    const dailySalary = baseSalary / payrollDaysInMonth;

    // CL & Leave adjustment
    const clBonusDays = leaveDays === 0 && absentDays === 0 ? 1 : 0;
    const clAdjustedDays = leaveDays >= 1 ? 1 : 0;
    const leaveDeductionDays = Math.max(0, leaveDays - 1);

    // Unauthorised Absent penalty: 2 days salary deduction per absent day
    const absentPenaltyDays = absentDays * 2;

    // Net effective paid days = DaysInMonth + clBonusDays - leaveDeductionDays - absentPenaltyDays
    // (Note: Since baseSalary = DaysInMonth * dailySalary, if 1 absent day occurs, employee loses that day + 1 extra penalty day = 2 days deducted from full monthly salary)
    const effectivePaidDays = Math.max(
      0,
      payrollDaysInMonth + clBonusDays - leaveDeductionDays - absentPenaltyDays
    );
    const grossEarnedSalary = Math.round(effectivePaidDays * dailySalary);

    // Pending advance for this employee
    const empActiveAdvances = staffAdvances.filter(
      a => a.employeeId === emp.id && a.status === 'Active' && a.balanceAmount > 0
    );
    const totalPendingAdvance = empActiveAdvances.reduce((s, a) => s + a.balanceAmount, 0);

    const requestedAdvDeduct =
      advanceAdjustments[emp.id] !== undefined
        ? advanceAdjustments[emp.id]
        : Math.min(totalPendingAdvance, grossEarnedSalary);

    const validAdvDeduct = Math.max(0, Math.min(totalPendingAdvance, grossEarnedSalary, requestedAdvDeduct));
    const netPayableSalary = Math.max(0, grossEarnedSalary - validAdvDeduct);

    return {
      id: `pay-${emp.id}-${payrollMonth}`,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.employeeCode,
      designation: emp.designation,
      campus: emp.campus || 'Sr',
      month: payrollMonth,
      daysInMonth: payrollDaysInMonth,
      monthlyBaseSalary: baseSalary,
      dailySalary: Number(dailySalary.toFixed(2)),
      presentDays,
      holidayDays,
      leaveDays,
      absentDays,
      clBonusDays,
      clAdjustedDays,
      leaveDeductionDays,
      absentPenaltyDays,
      grossEarnedSalary,
      advanceDeducted: validAdvDeduct,
      netPayableSalary,
      status: 'Draft',
    };
  };

  const handleGiveAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onGiveStaffAdvance) return;
    const emp = employees.find(x => x.id === advEmpId);
    if (!emp || advAmount <= 0) return;
    setSubmitting(true);
    try {
      await onGiveStaffAdvance({
        employeeId: emp.id,
        employeeName: emp.name,
        employeeCode: emp.employeeCode,
        date: advDate || todayStr,
        amount: Number(advAmount),
        adjustedAmount: 0,
        balanceAmount: Number(advAmount),
        paymentMode: advMode,
        reason: advReason.trim() || 'Staff Salary Advance',
        status: 'Active',
        recordedBy: isAdmin ? 'Admin' : currentRole,
      });
      setShowAdvanceModal(false);
      setAdvAmount(2000);
      setAdvReason('Salary Advance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeclareHolidaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onDeclareHoliday || !attDate || !holidayOccasion.trim()) return;
    setSubmitting(true);
    try {
      await onDeclareHoliday(attDate, holidayOccasion.trim(), attCampusFilter);
      setShowHolidayModal(false);
      setHolidayOccasion('');
    } finally {
      setSubmitting(false);
    }
  };

  const printPayslip = (pr: StaffPayrollRecord) => {
    printTableReport({
      title: `Staff Salary Slip — ${pr.employeeName} (${pr.employeeCode})`,
      schoolName,
      subtitle: `Payroll Month: ${pr.month} • Designation: ${pr.designation}`,
      columns: [
        { header: 'Salary Component', accessor: (r: { label: string; value: string }) => r.label },
        { header: 'Calculation / Details', accessor: (r: { label: string; value: string }) => r.value },
      ],
      data: [
        { label: 'Employee Name & Code', value: `${pr.employeeName} (${pr.employeeCode}) — ${pr.designation}` },
        { label: 'Payroll Month & Total Days', value: `${pr.month} (${pr.daysInMonth} Days)` },
        { label: 'Monthly Base Salary', value: `Rs. ${pr.monthlyBaseSalary.toLocaleString('en-IN')}` },
        { label: 'Daily Salary Rate (Monthly / Days in Month)', value: `Rs. ${pr.dailySalary.toFixed(2)} / day` },
        { label: 'Attendance Breakdown', value: `Present: ${pr.presentDays}d | Paid Holiday (H): ${pr.holidayDays}d | Leave (L): ${pr.leaveDays}d | Absent (A): ${pr.absentDays}d` },
        { label: 'Casual Leave (1 Paid CL/Month) Adjustment', value: pr.clBonusDays > 0 ? `+1 Extra Day Bonus (100% Present)` : `CL Adjusted: ${pr.clAdjustedDays}d | Leave Deduction: ${pr.leaveDeductionDays}d` },
        { label: 'Unauthorised Absent Penalty (2 Days/Absent)', value: `${pr.absentPenaltyDays} Penalty Days Deducted` },
        { label: 'Gross Earned Salary', value: `Rs. ${pr.grossEarnedSalary.toLocaleString('en-IN')}` },
        { label: 'Staff Advance Adjusted / Deducted', value: `- Rs. ${pr.advanceDeducted.toLocaleString('en-IN')}` },
        { label: 'NET PAYABLE SALARY', value: `Rs. ${pr.netPayableSalary.toLocaleString('en-IN')} (${pr.status})` },
      ],
    });
  };

  return (
    <div className="space-y-6">

      {/* =================================================================== */}
      {/* SUB-TAB 1: CANDIDATE RESUMES POOL (With clickable filter cards)     */}
      {/* =================================================================== */}
      {subModule === 'resumes' && onSaveResume && onHireResume ? (
        <ResumesView
          resumes={resumes}
          designations={designations}
          isAdmin={isAdmin}
          onSaveResume={onSaveResume}
          onDeleteResume={onDeleteResume}
          onHireResume={onHireResume}
          onNavigateToEmployees={() => setSubModule('employees')}
        />
      ) : subModule === 'attendance' ? (
        /* =================================================================== */
        /* SUB-TAB 3: STAFF ATTENDANCE & REGISTER (Daily, Register, Calendar)  */
        /* =================================================================== */
        <div className="space-y-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-900">
                Staff Attendance &amp; Holiday Register
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setAttViewMode('daily')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      attViewMode === 'daily' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Mark Daily Attendance
                  </button>
                  <button
                    onClick={() => setAttViewMode('register')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      attViewMode === 'register' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Monthly Register (P/A/L/H)
                  </button>
                  <button
                    onClick={() => setAttViewMode('calendar')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      attViewMode === 'calendar' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Calendar View
                  </button>
                </div>
              </div>
            </div>

            {/* Filter & Holiday Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 items-end">
              {attViewMode === 'daily' ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Attendance Date</label>
                  <input
                    type="date"
                    value={attDate}
                    onChange={e => setAttDate(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Select Month</label>
                  <input
                    type="month"
                    value={attMonth}
                    onChange={e => setAttMonth(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Campus
                </label>
                <select
                  value={attCampusFilter}
                  onChange={e => setAttCampusFilter(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
                >
                  <option value="all">All Campuses</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {attViewMode === 'calendar' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Select Staff Member</label>
                  <select
                    value={selectedCalendarEmpId}
                    onChange={e => setSelectedCalendarEmpId(e.target.value)}
                    className="w-full p-2 border border-slate-900 rounded-xl text-xs font-bold bg-white"
                  >
                    {attFilteredEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.employeeCode}) — {emp.designation}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {attViewMode === 'daily' && (
                <div className="sm:col-span-2 flex flex-wrap items-center justify-end gap-2">
                  {isHolidayDate(attDate).isHoliday ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold">
                      <Sun className="w-4 h-4 text-indigo-600" />
                      <span>Holiday (H): {isHolidayDate(attDate).occasion} (Paid for Staff)</span>
                      {isAdmin && onRemoveHoliday && holidays.some(h => h.date === attDate) && (
                        <button
                          onClick={() => onRemoveHoliday(attDate)}
                          className="ml-2 text-rose-600 hover:underline text-[11px] cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowHolidayModal(true)}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Mark {attDate} as Holiday (H)</span>
                    </button>
                  )}

                  <PrintExportToolbar
                    title={`Staff Attendance — ${attDate}`}
                    filename={`Staff_Attendance_${attDate}`}
                    schoolName={schoolName}
                    filteredData={attFilteredEmployees}
                    allData={employees}
                    hasActiveFilters={attCampusFilter !== 'all'}
                    filterSummary={`Date: ${attDate} | Campus: ${attCampusFilter}`}
                    columns={[
                      { header: 'Emp Code', accessor: e => e.employeeCode },
                      { header: 'Staff Name', accessor: e => e.name },
                      { header: 'Designation', accessor: e => e.designation },
                      { header: 'Campus', accessor: e => e.campus || 'Sr' },
                      { header: 'Date', accessor: () => attDate },
                      { header: 'Status', accessor: e => getEmployeeStatusForDate(e.id, attDate) },
                    ]}
                  />
                </div>
              )}
            </div>
          </div>

          {/* MODE 1: DAILY STAFF ATTENDANCE MARKING */}
          {attViewMode === 'daily' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                      <th className="py-3 px-4">Emp Code</th>
                      <th className="py-3 px-4">Employee Name</th>
                      <th className="py-3 px-3">Designation</th>
                      <th className="py-3 px-3">Campus</th>
                      <th className="py-3 px-3">Current Status ({attDate})</th>
                      <th className="py-3 px-4 text-right">Mark Attendance (P / L / A / H)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attFilteredEmployees.map(emp => {
                      const st = getEmployeeStatusForDate(emp.id, attDate);
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">{emp.employeeCode}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{emp.name}</td>
                          <td className="py-3 px-3 font-medium text-slate-700">{emp.designation}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[11px]">
                              {emp.campus || 'Sr'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                st === 'P'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : st === 'L'
                                  ? 'bg-amber-100 text-amber-900'
                                  : st === 'H'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {st === 'P'
                                ? 'P — Present'
                                : st === 'L'
                                ? 'L — Casual Leave'
                                : st === 'H'
                                ? 'H — Paid Holiday'
                                : 'A — Unauthorised Absent'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {(
                                [
                                  { code: 'P', label: 'P (Present)', activeCls: 'bg-emerald-600 text-white' },
                                  { code: 'L', label: 'L (Leave)', activeCls: 'bg-amber-500 text-slate-950' },
                                  { code: 'A', label: 'A (Absent)', activeCls: 'bg-rose-600 text-white' },
                                  { code: 'H', label: 'H (Holiday)', activeCls: 'bg-indigo-600 text-white' },
                                ] as const
                              ).map(btn => (
                                <button
                                  key={btn.code}
                                  type="button"
                                  onClick={() =>
                                    onMarkStaffAttendance && onMarkStaffAttendance(emp.id, attDate, btn.code)
                                  }
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                    st === btn.code
                                      ? `${btn.activeCls} shadow-2xs`
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {btn.label}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODE 2: MONTHLY ATTENDANCE REGISTER (P, A, L, H Matrix) */}
          {attViewMode === 'register' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">
                  Monthly Staff Attendance Register — {attMonth}
                </h3>
                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">P = Present</span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900">L = Leave (1 CL Free)</span>
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800">A = Absent (2x Ded.)</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">H = Holiday (Paid)</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px] border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold">
                      <th className="border border-slate-200 p-2 sticky left-0 bg-slate-100">Staff Member</th>
                      {getDaysInYearMonth(attMonth).dates.map(dt => (
                        <th key={dt} className="border border-slate-200 p-1.5 text-center font-mono">
                          {dt.slice(-2)}
                        </th>
                      ))}
                      <th className="border border-slate-200 p-1.5 text-center bg-emerald-50 text-emerald-900">P</th>
                      <th className="border border-slate-200 p-1.5 text-center bg-indigo-50 text-indigo-900">H</th>
                      <th className="border border-slate-200 p-1.5 text-center bg-amber-50 text-amber-900">L</th>
                      <th className="border border-slate-200 p-1.5 text-center bg-rose-50 text-rose-900">A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attFilteredEmployees.map(emp => {
                      const monthDates = getDaysInYearMonth(attMonth).dates;
                      let pCnt = 0;
                      let hCnt = 0;
                      let lCnt = 0;
                      let aCnt = 0;
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50">
                          <td className="border border-slate-200 p-2 font-bold text-slate-900 whitespace-nowrap sticky left-0 bg-white">
                            {emp.name} <span className="text-[10px] font-mono text-slate-500">({emp.employeeCode})</span>
                          </td>
                          {monthDates.map(dt => {
                            const st = getEmployeeStatusForDate(emp.id, dt);
                            if (st === 'P') pCnt++;
                            else if (st === 'H') hCnt++;
                            else if (st === 'L') lCnt++;
                            else if (st === 'A') aCnt++;
                            return (
                              <td
                                key={dt}
                                onClick={() => {
                                  const cycle: StaffAttendanceStatus[] = ['P', 'L', 'A', 'H'];
                                  const next = cycle[(cycle.indexOf(st) + 1) % cycle.length];
                                  if (onMarkStaffAttendance) onMarkStaffAttendance(emp.id, dt, next);
                                }}
                                title={`Click to toggle status for ${emp.name} on ${dt}`}
                                className={`border border-slate-200 p-1 text-center font-mono font-bold cursor-pointer ${
                                  st === 'P'
                                    ? 'text-emerald-700 hover:bg-emerald-50'
                                    : st === 'H'
                                    ? 'bg-indigo-50/70 text-indigo-700'
                                    : st === 'L'
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {st}
                              </td>
                            );
                          })}
                          <td className="border border-slate-200 p-1.5 text-center font-bold text-emerald-700 bg-emerald-50/40">{pCnt}</td>
                          <td className="border border-slate-200 p-1.5 text-center font-bold text-indigo-700 bg-indigo-50/40">{hCnt}</td>
                          <td className="border border-slate-200 p-1.5 text-center font-bold text-amber-800 bg-amber-50/40">{lCnt}</td>
                          <td className="border border-slate-200 p-1.5 text-center font-bold text-rose-700 bg-rose-50/40">{aCnt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODE 3: STAFF CALENDAR VIEW (With P, A, L, H) */}
          {attViewMode === 'calendar' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              {(() => {
                const calEmp = employees.find(e => e.id === selectedCalendarEmpId) || attFilteredEmployees[0];
                if (!calEmp) return <div className="text-xs text-slate-400">Select an employee</div>;
                const { dates } = getDaysInYearMonth(attMonth);
                const firstDayIndex = new Date(dates[0] + 'T00:00:00').getDay(); // 0 = Sun
                const blanks = Array.from({ length: firstDayIndex });

                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Attendance Calendar — {calEmp.name} ({calEmp.employeeCode}) • {attMonth}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Click any day cell to cycle between <strong>P</strong> (Present), <strong>L</strong> (Leave), <strong>A</strong> (Absent), and <strong>H</strong> (Holiday).
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800">P = Present</span>
                        <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900">L = Leave</span>
                        <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800">A = Absent</span>
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800">H = Holiday</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 uppercase">
                      <div>Sun</div>
                      <div>Mon</div>
                      <div>Tue</div>
                      <div>Wed</div>
                      <div>Thu</div>
                      <div>Fri</div>
                      <div>Sat</div>
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {blanks.map((_, i) => (
                        <div key={`blank-${i}`} className="h-20 rounded-xl bg-slate-50/50 border border-dashed border-slate-200" />
                      ))}
                      {dates.map(dt => {
                        const st = getEmployeeStatusForDate(calEmp.id, dt);
                        const holInfo = isHolidayDate(dt);
                        return (
                          <div
                            key={dt}
                            onClick={() => {
                              const cycle: StaffAttendanceStatus[] = ['P', 'L', 'A', 'H'];
                              const next = cycle[(cycle.indexOf(st) + 1) % cycle.length];
                              if (onMarkStaffAttendance) onMarkStaffAttendance(calEmp.id, dt, next);
                            }}
                            className={`h-20 rounded-xl border p-2 flex flex-col justify-between cursor-pointer transition-all ${
                              st === 'P'
                                ? 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-400'
                                : st === 'L'
                                ? 'bg-amber-50 border-amber-300 hover:border-amber-400'
                                : st === 'H'
                                ? 'bg-indigo-50 border-indigo-200 hover:border-indigo-400'
                                : 'bg-rose-50 border-rose-300 hover:border-rose-400'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-slate-700">{dt.slice(-2)}</span>
                              <span
                                className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${
                                  st === 'P'
                                    ? 'bg-emerald-600 text-white'
                                    : st === 'L'
                                    ? 'bg-amber-500 text-slate-950'
                                    : st === 'H'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-rose-600 text-white'
                                }`}
                              >
                                {st}
                              </span>
                            </div>
                            <div className="text-[10px] font-semibold truncate text-slate-600">
                              {st === 'H'
                                ? holInfo.occasion || 'Paid Holiday'
                                : st === 'P'
                                ? 'Present'
                                : st === 'L'
                                ? 'Casual Leave'
                                : 'Absent (2x Ded)'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      ) : subModule === 'payroll' ? (
        /* =================================================================== */
        /* SUB-TAB 4: STAFF PAYROLL & ADVANCES                                 */
        /* =================================================================== */
        <div className="space-y-6">
          {/* Top Payroll Toolbar Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900">
                Staff Payroll &amp; Advances — {payrollMonth}
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                {payrollDaysInMonth} Days
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="month"
                value={payrollMonth}
                onChange={e => setPayrollMonth(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
              />
              <select
                value={payrollPayMode}
                onChange={e => setPayrollPayMode(e.target.value as any)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
                title="Disbursement Mode"
              >
                <option value="Bank">Mode: Bank / NEFT</option>
                <option value="UPI">Mode: UPI</option>
                <option value="Cash">Mode: Cash</option>
              </select>

              <PrintExportToolbar
                title={`Monthly Staff Payroll Register — ${payrollMonth}`}
                filename={`Staff_Payroll_${payrollMonth}`}
                schoolName={schoolName}
                filteredData={employees.filter(e => e.status === 'Active' || e.status === 'On Leave').map(e => calculateEmployeePayroll(e))}
                allData={employees.map(e => calculateEmployeePayroll(e))}
                columns={[
                  { header: 'Emp Code', accessor: r => r.employeeCode },
                  { header: 'Staff Name', accessor: r => r.employeeName },
                  { header: 'Designation', accessor: r => r.designation },
                  { header: 'Base Salary (INR)', accessor: r => r.monthlyBaseSalary },
                  { header: 'Present (P)', accessor: r => r.presentDays },
                  { header: 'Holidays (H)', accessor: r => r.holidayDays },
                  { header: 'Leaves (L)', accessor: r => r.leaveDays },
                  { header: 'Absent (A)', accessor: r => r.absentDays },
                  { header: 'Gross Earned (INR)', accessor: r => r.grossEarnedSalary },
                  { header: 'Advance Deducted (INR)', accessor: r => r.advanceDeducted },
                  { header: 'Net Payable (INR)', accessor: r => r.netPayableSalary },
                  { header: 'Status', accessor: r => r.status },
                ]}
              />

              <button
                onClick={() => setShowAdvanceModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Give Advance</span>
              </button>
            </div>
          </div>

          {/* Monthly Payroll Calculation Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                    <th className="py-3 px-3">Staff Member</th>
                    <th className="py-3 px-3 text-right">Monthly / Daily</th>
                    <th className="py-3 px-3 text-center">P / H / L / A</th>
                    <th className="py-3 px-3">CL &amp; Absent Rules Applied</th>
                    <th className="py-3 px-3 text-right">Gross Earned</th>
                    <th className="py-3 px-3 text-center">Advance to Deduct (Full / Part)</th>
                    <th className="py-3 px-3 text-right">Net Payable</th>
                    <th className="py-3 px-4 text-right">Finalize / Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees
                    .filter(e => e.status === 'Active' || e.status === 'On Leave')
                    .map(emp => {
                      const pr = calculateEmployeePayroll(emp);
                      const empPendingAdv = staffAdvances
                        .filter(a => a.employeeId === emp.id && a.status === 'Active')
                        .reduce((s, a) => s + a.balanceAmount, 0);
                      const isFinalized = pr.status === 'Finalized & Paid';

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{emp.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {emp.employeeCode} • {emp.designation}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            <div className="font-bold text-slate-900">₹{pr.monthlyBaseSalary.toLocaleString('en-IN')}</div>
                            <div className="text-[10px] text-slate-500">₹{pr.dailySalary.toFixed(2)}/day</div>
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-[11px]">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold">P:{pr.presentDays}</span>{' '}
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold">H:{pr.holidayDays}</span>{' '}
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 font-bold">L:{pr.leaveDays}</span>{' '}
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 font-bold">A:{pr.absentDays}</span>
                          </td>
                          <td className="py-3 px-3 text-[11px]">
                            {pr.clBonusDays > 0 && (
                              <div className="text-emerald-700 font-bold">+1 Day Extra Salary (All Present CL Bonus)</div>
                            )}
                            {pr.clAdjustedDays > 0 && (
                              <div className="text-amber-800 font-semibold">
                                1 CL Adjusted • {pr.leaveDeductionDays} Leave Day(s) Deducted
                              </div>
                            )}
                            {pr.absentPenaltyDays > 0 && (
                              <div className="text-rose-700 font-bold">
                                -{pr.absentPenaltyDays} Days Deducted ({pr.absentDays} Absent × 2)
                              </div>
                            )}
                            {pr.clBonusDays === 0 && pr.clAdjustedDays === 0 && pr.absentPenaltyDays === 0 && (
                              <span className="text-slate-500">Standard Attendance</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            ₹{pr.grossEarnedSalary.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isFinalized ? (
                              <span className="font-mono font-bold text-amber-800">
                                - ₹{pr.advanceDeducted.toLocaleString('en-IN')}
                              </span>
                            ) : empPendingAdv > 0 ? (
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    max={Math.min(empPendingAdv, pr.grossEarnedSalary)}
                                    value={
                                      advanceAdjustments[emp.id] !== undefined
                                        ? advanceAdjustments[emp.id]
                                        : pr.advanceDeducted
                                    }
                                    onChange={e =>
                                      setAdvanceAdjustments(prev => ({
                                        ...prev,
                                        [emp.id]: Number(e.target.value),
                                      }))
                                    }
                                    className="w-24 p-1 border border-amber-400 rounded-lg text-right font-mono font-bold bg-amber-50/40"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAdvanceAdjustments(prev => ({
                                        ...prev,
                                        [emp.id]: Math.min(empPendingAdv, pr.grossEarnedSalary),
                                      }))
                                    }
                                    className="px-1.5 py-1 bg-slate-200 hover:bg-slate-300 rounded text-[10px] font-bold cursor-pointer"
                                    title="Adjust full pending advance"
                                  >
                                    All
                                  </button>
                                </div>
                                <span className="text-[10px] text-amber-800 font-semibold">
                                  Pending Adv: ₹{empPendingAdv.toLocaleString('en-IN')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">No Advance</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 text-sm">
                            ₹{pr.netPayableSalary.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isFinalized ? (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                  Finalized &amp; Paid
                                </span>
                              ) : isAdmin && onFinalizePayroll ? (
                                <button
                                  onClick={() =>
                                    onFinalizePayroll({
                                      ...pr,
                                      paymentMode: payrollPayMode,
                                      paymentDate: todayStr,
                                      status: 'Finalized & Paid',
                                      finalizedBy: 'Admin',
                                    })
                                  }
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Finalize &amp; Pay</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400">Admin Finalizes</span>
                              )}
                              <button
                                onClick={() => printPayslip(pr)}
                                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-lg cursor-pointer"
                                title="Print Salary Slip"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Staff Advance Ledger & Records */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Staff Salary Advances Register ({staffAdvances.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Complete record of advances given to staff and amounts adjusted in monthly payroll
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Reason / Purpose</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3 text-right">Advance Given</th>
                    <th className="py-2.5 px-3 text-right">Adjusted in Payroll</th>
                    <th className="py-2.5 px-3 text-right">Balance Pending</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffAdvances.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400">
                        No staff advance records found.
                      </td>
                    </tr>
                  ) : (
                    staffAdvances.map(adv => (
                      <tr key={adv.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono">{adv.date}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {adv.employeeName} <span className="text-slate-400 font-mono">({adv.employeeCode})</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{adv.reason}</td>
                        <td className="py-2.5 px-3 font-semibold">{adv.paymentMode}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">₹{adv.amount.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                          ₹{adv.adjustedAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                          ₹{adv.balanceAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              adv.status === 'Settled' || adv.balanceAmount === 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {adv.balanceAmount === 0 ? 'Settled' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* =================================================================== */
        /* SUB-TAB 2: ONBOARDED STAFF DIRECTORY (Clickable Filter Cards!)      */
        /* =================================================================== */
        <>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900">
                Onboarded Employees
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                {filteredEmployees.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 flex-1 lg:max-w-3xl justify-end">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, code, DL, mobile..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-amber-500"
                />
              </div>

              <FilterPopover
                activeCount={(filterCampus !== 'ALL' ? 1 : 0) + (filterDesignation !== 'ALL' ? 1 : 0)}
                onReset={() => {
                  setFilterCampus('ALL');
                  setFilterDesignation('ALL');
                }}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Campus</label>
                  <select
                    value={filterCampus}
                    onChange={(e) => setFilterCampus(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-medium text-slate-700"
                  >
                    <option value="ALL">All Campuses</option>
                    {campuses.map(c => (
                      <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Designation</label>
                  <select
                    value={filterDesignation}
                    onChange={(e) => setFilterDesignation(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 font-medium text-slate-700"
                  >
                    <option value="ALL">All Designations</option>
                    {designations.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </FilterPopover>

              <PrintExportToolbar
                title="Employees & Staff Directory"
                filename="employees_directory"
                schoolName={schoolName}
                filteredData={filteredEmployees}
                allData={employees}
                hasActiveFilters={searchTerm.trim() !== '' || filterDesignation !== 'ALL' || filterCampus !== 'ALL'}
                columns={[
                  { header: 'Emp Code', accessor: (e) => e.employeeCode },
                  { header: 'Employee Name', accessor: (e) => e.name },
                  { header: 'Designation', accessor: (e) => e.designation },
                  { header: 'Campus', accessor: (e) => e.campus || 'Sr' },
                  { header: 'Mobile', accessor: (e) => e.mobile },
                  { header: 'DL Number', accessor: (e) => (e.isDriver ? e.drivingLicenseNo || '' : 'N/A') },
                  { header: 'Monthly Salary', accessor: (e) => e.monthlyBaseSalary || 14000 },
                  { header: 'Status', accessor: (e) => e.status },
                ]}
              />

              {isAdmin && (
                <button
                  onClick={handleOpenAdd}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Onboard Employee</span>
                </button>
              )}
            </div>
          </div>

          {/* Employee Directory Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-sm">
                      {emp.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">{emp.name}</h3>
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                          {emp.employeeCode}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <strong className="text-slate-800">{emp.designation}</strong> • Campus: <strong>{emp.campus || 'Sr'}</strong> • Mobile: {emp.mobile}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        emp.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {emp.status}
                    </span>
                    <button
                      onClick={() => handleOpenEdit(emp)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                      title="Edit Employee"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && onDeleteEmployee && (
                      <button
                        onClick={() => onDeleteEmployee(emp.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Delete Employee"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Monthly Base Salary</span>
                    <span className="font-mono font-bold text-slate-900">
                      ₹{(emp.monthlyBaseSalary || 14000).toLocaleString('en-IN')}/mo
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Age &amp; Sex</span>
                    <span className="font-semibold text-slate-800">{emp.age} Yrs / {emp.gender}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Joining Date</span>
                    <span className="font-semibold text-slate-800">{emp.joiningDate}</span>
                  </div>
                </div>

                {emp.isDriver && (
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="text-[10px] font-bold uppercase text-amber-800 block">
                          Commercial Driving License
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {emp.drivingLicenseNo || 'DL Not Recorded'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">Valid Upto</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {emp.drivingLicenseValidity || 'N/A'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Documents ({emp.documents?.length || 0})
                    </span>
                    <button
                      onClick={() => handleOpenEdit(emp)}
                      className="text-[11px] font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Upload / Manage</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(emp.documents || []).map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedDocPreview(doc)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        <FileCheck className="w-3 h-3 text-emerald-600" />
                        <span>{doc.type}</span>
                        <Eye className="w-3 h-3 text-slate-400" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* DECLARE HOLIDAY MODAL */}
      {showHolidayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Declare Paid Holiday (H) — {attDate}</h3>
              <button onClick={() => setShowHolidayModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleDeclareHolidaySubmit} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Holiday Occasion / Festival Name *</label>
                <input
                  type="text"
                  required
                  value={holidayOccasion}
                  onChange={e => setHolidayOccasion(e.target.value)}
                  placeholder="e.g., Dussehra / Diwali / National Holiday"
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Marking a day as Holiday (<strong>H</strong>) automatically marks <strong>H</strong> in both Member and Staff attendance registers, and counts as a paid day for staff payroll.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHolidayModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Confirm Holiday (H)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GIVE STAFF ADVANCE MODAL */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Record Advance Given to Staff</h3>
              <button onClick={() => setShowAdvanceModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleGiveAdvanceSubmit} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Staff Member *</label>
                <select
                  value={advEmpId}
                  onChange={e => setAdvEmpId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.employeeCode}) — {e.designation}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Advance Amount (₹) *</label>
                  <input
                    type="number"
                    min={100}
                    required
                    value={advAmount}
                    onChange={e => setAdvAmount(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={advDate}
                    onChange={e => setAdvDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Mode *</label>
                  <select
                    value={advMode}
                    onChange={e => setAdvMode(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Reason / Remarks *</label>
                  <input
                    type="text"
                    required
                    value={advReason}
                    onChange={e => setAdvReason(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer"
                >
                  Save Advance Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT EMPLOYEE MODAL */}
      {isModalOpen && editingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingEmployee.id ? 'Edit Employee Profile' : 'Onboard New Employee (Admin Only)'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Employee Code</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.employeeCode || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, employeeCode: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.name || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Designation *</label>
                  <select
                    value={editingEmployee.designation || designations[0]?.name || 'Driver'}
                    onChange={(e) => handleDesignationChange(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-900"
                  >
                    {designations.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Assigned Campus *</label>
                  <select
                    value={editingEmployee.campus || campuses[0]?.code || 'Sr'}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, campus: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-900"
                  >
                    {campuses.map(c => (
                      <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Monthly Base Salary (₹) *</label>
                  <input
                    type="number"
                    required
                    value={editingEmployee.monthlyBaseSalary || 14000}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, monthlyBaseSalary: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={editingEmployee.mobile || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, mobile: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Father&apos;s Name</label>
                  <input
                    type="text"
                    value={editingEmployee.fatherName || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, fatherName: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Age</label>
                  <input
                    type="number"
                    min={18}
                    max={75}
                    value={editingEmployee.age || 30}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, age: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Gender</label>
                  <select
                    value={editingEmployee.gender || 'M'}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, gender: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Status</label>
                  <select
                    value={editingEmployee.status || 'Active'}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, status: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white font-semibold"
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Resigned">Resigned</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>
              </div>

              {isDriver && (
                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-300 space-y-3">
                  <div className="flex items-center gap-2 text-amber-950 font-bold">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Commercial Driving License Details (Mandatory for Driver)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">DL Number *</label>
                      <input
                        type="text"
                        required={isDriver}
                        value={editingEmployee.drivingLicenseNo || ''}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, drivingLicenseNo: e.target.value.toUpperCase() })}
                        className="w-full p-2 border border-amber-300 rounded-xl font-mono font-bold uppercase bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">DL Validity Date *</label>
                      <input
                        type="date"
                        required={isDriver}
                        value={editingEmployee.drivingLicenseValidity || '2028-12-31'}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, drivingLicenseValidity: e.target.value })}
                        className="w-full p-2 border border-amber-300 rounded-xl font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">DL Type</label>
                      <input
                        type="text"
                        value={editingEmployee.drivingLicenseType || 'Heavy Passenger Vehicle (HMV)'}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, drivingLicenseType: e.target.value })}
                        className="w-full p-2 border border-amber-300 rounded-xl bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Document Attachments */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Document Attachments ({documentsList.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Driving License', 'Aadhaar Card', 'PAN Card', 'Resume'] as const).map(t => (
                    <label key={t} className="p-2 border border-dashed border-slate-300 rounded-xl text-center bg-white hover:bg-slate-50 cursor-pointer block">
                      <Upload className="w-3.5 h-3.5 mx-auto text-amber-500 mb-1" />
                      <span className="text-[10px] font-bold text-slate-700 block">Upload {t}</span>
                      <input type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, t)} className="hidden" />
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as any)}
                    className="p-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="Aadhaar Card">Aadhaar Card</option>
                    <option value="PAN Card">PAN Card</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Resume">Resume / CV</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Document Reference / Number"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    className="flex-1 p-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddDocument}
                    className="px-3 py-1.5 bg-slate-800 text-white font-bold rounded-lg text-xs cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {documentsList.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-800">{doc.type}: {doc.name}</span>
                      <button type="button" onClick={() => handleRemoveDocument(doc.id)} className="text-rose-500 p-1 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {selectedDocPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">
                  {selectedDocPreview.type} — {selectedDocPreview.name}
                </h3>
              </div>
              <button onClick={() => setSelectedDocPreview(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl text-xs space-y-2">
              <div><strong>Type:</strong> {selectedDocPreview.type}</div>
              <div><strong>Reference:</strong> {selectedDocPreview.name}</div>
              <div><strong>Uploaded:</strong> {selectedDocPreview.uploadedAt}</div>
              {selectedDocPreview.fileData?.startsWith('data:') && (
                <img src={selectedDocPreview.fileData} alt={selectedDocPreview.name} className="max-h-60 mx-auto rounded-xl border border-slate-200 mt-2" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

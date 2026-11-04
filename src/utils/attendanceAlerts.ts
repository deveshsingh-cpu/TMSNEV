import { DailyTrip, Route, StudentMember, TripAttendanceRecord, UserRole } from '../types/index.js';
import { getStudentCampus, normalizeCampus } from './campus.js';

export interface AttendanceChangeRequest {
  id: string;
  recordId: string;
  tripId: string;
  date: string;
  routeId: string;
  routeCode: string;
  routeName?: string;
  campus: 'Sr' | 'Jr';
  studentId: string;
  studentName: string;
  admissionNo: string;
  classSection?: string;
  className?: string;
  shift?: 'arrival' | 'departure';
  currentStatus?: TripAttendanceRecord['driverStatus'];
  requestedStatus?: TripAttendanceRecord['driverStatus'];
  currentArrivalStatus?: TripAttendanceRecord['driverStatus'];
  currentDepartureStatus?: TripAttendanceRecord['assistantStatus'];
  proposedArrivalStatus?: TripAttendanceRecord['driverStatus'];
  proposedDepartureStatus?: TripAttendanceRecord['assistantStatus'];
  reason: string;
  requestedBy: string;
  requestedByRole: UserRole | string;
  requestedAt: string;
  status: 'Pending Admin Approval' | 'Pending' | 'Approved' | 'Rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  adminRemarks?: string;
}

export interface AttendanceAcknowledgement {
  id: string;
  date: string;
  routeId: string;
  routeCode: string;
  campus: string;
  note: string;
  acknowledgedBy: string;
  acknowledgedByRole: UserRole | string;
  acknowledgedAt: string;
}

export interface MemberAttendanceDiscrepancyItem {
  student: StudentMember;
  route: Route;
  routeId: string;
  routeCode: string;
  routeName: string;
  campus: 'Sr' | 'Jr';
  date: string;
  tripId: string;
  recordId: string;
  arrivalStatus: TripAttendanceRecord['driverStatus'];
  departureStatus: TripAttendanceRecord['assistantStatus'];
  category: 'both_not_marked' | 'arrival_not_marked' | 'departure_not_marked' | 'status_mismatch';
  mismatchReason?: string;
  isAcknowledged: boolean;
  pendingChangeRequest?: AttendanceChangeRequest;
}

export interface PartiallyMarkedRouteSummary {
  route: Route;
  routeId: string;
  routeCode: string;
  routeName: string;
  campus: 'Sr' | 'Jr';
  date: string;
  tripId: string;
  totalMembers: number;
  arrivalMarkedCount: number;
  arrivalPendingCount: number;
  arrivalUnmarkedCount: number;
  departureMarkedCount: number;
  departurePendingCount: number;
  departureUnmarkedCount: number;
  bothNotMarkedCount: number;
  singleShiftNotMarkedCount: number;
  statusMismatchCount: number;
  isPartiallyMarkedArrival: boolean;
  isPartiallyMarkedDeparture: boolean;
  hasAnyMarkedOnRoute: boolean;
  hasAnyUnmarkedOnRoute: boolean;
  isAcknowledged: boolean;
}

const CHANGE_REQ_STORAGE_KEY = 'tms_attendance_change_requests_v1';
const ACK_STORAGE_KEY = 'tms_attendance_acknowledgements_v1';

export function loadAttendanceChangeRequests(): AttendanceChangeRequest[] {
  try {
    const raw = localStorage.getItem(CHANGE_REQ_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAttendanceChangeRequests(list: AttendanceChangeRequest[]): void {
  try {
    localStorage.setItem(CHANGE_REQ_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

export function loadAttendanceAcknowledgements(): AttendanceAcknowledgement[] {
  try {
    const raw = localStorage.getItem(ACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAttendanceAcknowledgements(list: AttendanceAcknowledgement[]): void {
  try {
    localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

export function getPreviousWorkingDate(todayStr: string): string {
  const dt = new Date(`${todayStr}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return todayStr;
  dt.setDate(dt.getDate() - 1);
  // If yesterday was Sunday (0), step back to Saturday
  if (dt.getDay() === 0) {
    dt.setDate(dt.getDate() - 1);
  }
  return dt.toISOString().split('T')[0];
}

export function analyzeAttendanceForDate(params: {
  date: string;
  students: StudentMember[];
  routes: Route[];
  trips?: DailyTrip[];
  attendanceRecords: TripAttendanceRecord[];
  campusScope?: 'all' | 'Sr' | 'Jr';
  campusFilter?: 'all' | 'Sr' | 'Jr';
  acknowledgements?: AttendanceAcknowledgement[];
  changeRequests?: AttendanceChangeRequest[];
}) {
  const {
    date,
    students,
    routes,
    attendanceRecords,
    acknowledgements = [],
    changeRequests = [],
  } = params;
  const campusScope = params.campusScope || params.campusFilter || 'all';

  const activeStudents = students.filter((s) => s.transportStatus === 'Active');

  // Index attendance records by (tripId + studentId) and (date + studentId)
  const attByTripAndStudent = new Map<string, TripAttendanceRecord>();
  const attByDateAndStudent = new Map<string, TripAttendanceRecord>();
  for (const rec of attendanceRecords) {
    if (rec.tripId && rec.studentId) {
      attByTripAndStudent.set(`${rec.tripId}::${rec.studentId}`, rec);
    }
    const recDate = rec.date || (rec.tripId?.length >= 10 ? rec.tripId.slice(-10) : '');
    if (recDate === date && rec.studentId) {
      attByDateAndStudent.set(`${date}::${rec.studentId}`, rec);
    }
  }

  const ackSet = new Set(
    acknowledgements
      .filter((a) => a.date === date)
      .map((a) => `${a.date}::${a.routeId}`)
  );

  const pendingReqByStudentDate = new Map<string, AttendanceChangeRequest>();
  for (const req of changeRequests) {
    if (
      req.date === date &&
      (req.status === 'Pending Admin Approval' || req.status === 'Pending')
    ) {
      pendingReqByStudentDate.set(`${req.date}::${req.studentId}`, req);
    }
  }

  const bothNotMarked: MemberAttendanceDiscrepancyItem[] = [];
  const arrivalNotMarkedOnly: MemberAttendanceDiscrepancyItem[] = [];
  const departureNotMarkedOnly: MemberAttendanceDiscrepancyItem[] = [];
  const singleShiftNotMarked: MemberAttendanceDiscrepancyItem[] = [];
  const statusMismatches: MemberAttendanceDiscrepancyItem[] = [];
  const allItems: MemberAttendanceDiscrepancyItem[] = [];
  const routeSummaries: PartiallyMarkedRouteSummary[] = [];

  let totalActiveMembers = 0;
  let fullyMarkedCount = 0;

  for (const route of routes) {
    const routeMembers = activeStudents.filter((s) => {
      const matchesRoute =
        s.routeId === route.id ||
        (s.routeCode &&
          route.code &&
          s.routeCode.trim().toLowerCase() === route.code.trim().toLowerCase());
      if (!matchesRoute) return false;
      const stuCampus = getStudentCampus(s, routes);
      if (campusScope !== 'all' && stuCampus !== campusScope) return false;
      return true;
    });

    if (routeMembers.length === 0) continue;

    totalActiveMembers += routeMembers.length;

    const tripId = `dt-${route.id}-${date}`;
    const routeCampus: 'Sr' | 'Jr' =
      campusScope !== 'all'
        ? campusScope
        : normalizeCampus(route.campus) || getStudentCampus(routeMembers[0], routes);

    const isRouteAck =
      ackSet.has(`${date}::${route.id}`) ||
      ackSet.has(`${date}::ALL`) ||
      ackSet.has(`${date}::all`);

    let arrivalMarkedCount = 0;
    let arrivalPendingCount = 0;
    let departureMarkedCount = 0;
    let departurePendingCount = 0;
    let bothNotMarkedCount = 0;
    let singleShiftNotMarkedCount = 0;
    let statusMismatchCount = 0;

    for (const stu of routeMembers) {
      const stuCampus = getStudentCampus(stu, routes);
      const rec =
        attByTripAndStudent.get(`${tripId}::${stu.id}`) ||
        attByDateAndStudent.get(`${date}::${stu.id}`);

      const arrStatus: TripAttendanceRecord['driverStatus'] = rec?.driverStatus || 'Pending';
      const depStatus: TripAttendanceRecord['assistantStatus'] = rec?.assistantStatus || 'Pending';
      const recordId = rec?.id || `att-${tripId}-${stu.id}`;
      const pendingReq = pendingReqByStudentDate.get(`${date}::${stu.id}`);

      if (arrStatus === 'Pending') arrivalPendingCount++;
      else arrivalMarkedCount++;

      if (depStatus === 'Pending') departurePendingCount++;
      else departureMarkedCount++;

      if (arrStatus !== 'Pending' && depStatus !== 'Pending') {
        fullyMarkedCount++;
      }

      if (arrStatus === 'Pending' && depStatus === 'Pending') {
        bothNotMarkedCount++;
        const item: MemberAttendanceDiscrepancyItem = {
          student: stu,
          route,
          routeId: route.id,
          routeCode: route.code,
          routeName: route.name || route.code,
          campus: stuCampus,
          date,
          tripId,
          recordId,
          arrivalStatus: arrStatus,
          departureStatus: depStatus,
          category: 'both_not_marked',
          isAcknowledged: isRouteAck,
          pendingChangeRequest: pendingReq,
        };
        bothNotMarked.push(item);
        allItems.push(item);
      } else if (arrStatus === 'Pending' && depStatus !== 'Pending') {
        singleShiftNotMarkedCount++;
        const item: MemberAttendanceDiscrepancyItem = {
          student: stu,
          route,
          routeId: route.id,
          routeCode: route.code,
          routeName: route.name || route.code,
          campus: stuCampus,
          date,
          tripId,
          recordId,
          arrivalStatus: arrStatus,
          departureStatus: depStatus,
          category: 'arrival_not_marked',
          isAcknowledged: isRouteAck,
          pendingChangeRequest: pendingReq,
        };
        arrivalNotMarkedOnly.push(item);
        singleShiftNotMarked.push(item);
        allItems.push(item);
      } else if (arrStatus !== 'Pending' && depStatus === 'Pending') {
        singleShiftNotMarkedCount++;
        const item: MemberAttendanceDiscrepancyItem = {
          student: stu,
          route,
          routeId: route.id,
          routeCode: route.code,
          routeName: route.name || route.code,
          campus: stuCampus,
          date,
          tripId,
          recordId,
          arrivalStatus: arrStatus,
          departureStatus: depStatus,
          category: 'departure_not_marked',
          isAcknowledged: isRouteAck,
          pendingChangeRequest: pendingReq,
        };
        departureNotMarkedOnly.push(item);
        singleShiftNotMarked.push(item);
        allItems.push(item);
      } else if (arrStatus !== depStatus) {
        statusMismatchCount++;
        const item: MemberAttendanceDiscrepancyItem = {
          student: stu,
          route,
          routeId: route.id,
          routeCode: route.code,
          routeName: route.name || route.code,
          campus: stuCampus,
          date,
          tripId,
          recordId,
          arrivalStatus: arrStatus,
          departureStatus: depStatus,
          category: 'status_mismatch',
          mismatchReason: rec?.resolutionReason || rec?.notes,
          isAcknowledged: isRouteAck,
          pendingChangeRequest: pendingReq,
        };
        statusMismatches.push(item);
        allItems.push(item);
      }
    }

    const isPartiallyMarkedArrival = arrivalMarkedCount > 0 && arrivalPendingCount > 0;
    const isPartiallyMarkedDeparture = departureMarkedCount > 0 && departurePendingCount > 0;
    const hasAnyMarkedOnRoute = arrivalMarkedCount > 0 || departureMarkedCount > 0;
    const hasAnyUnmarkedOnRoute = arrivalPendingCount > 0 || departurePendingCount > 0;

    routeSummaries.push({
      route,
      routeId: route.id,
      routeCode: route.code,
      routeName: route.name || route.code,
      campus: routeCampus,
      date,
      tripId,
      totalMembers: routeMembers.length,
      arrivalMarkedCount,
      arrivalPendingCount,
      arrivalUnmarkedCount: arrivalPendingCount,
      departureMarkedCount,
      departurePendingCount,
      departureUnmarkedCount: departurePendingCount,
      bothNotMarkedCount,
      singleShiftNotMarkedCount,
      statusMismatchCount,
      isPartiallyMarkedArrival,
      isPartiallyMarkedDeparture,
      hasAnyMarkedOnRoute,
      hasAnyUnmarkedOnRoute,
      isAcknowledged: isRouteAck,
    });
  }

  // Routes where a few members have been marked and some members are still left unmarked
  const partiallyMarkedRoutes = routeSummaries.filter(
    (r) => r.hasAnyMarkedOnRoute && r.hasAnyUnmarkedOnRoute
  );

  // Routes where any attendance is unmarked or mismatched
  const routesWithAnyDiscrepancy = routeSummaries.filter(
    (r) => r.hasAnyUnmarkedOnRoute || r.statusMismatchCount > 0
  );

  return {
    date,
    totalActiveMembers,
    fullyMarkedCount,
    bothNotMarked,
    arrivalNotMarkedOnly,
    arrivalOnlyNotMarked: arrivalNotMarkedOnly,
    departureNotMarkedOnly,
    departureOnlyNotMarked: departureNotMarkedOnly,
    singleShiftNotMarked,
    statusMismatches,
    allItems,
    routeSummaries,
    partiallyMarkedRoutes,
    routesWithAnyDiscrepancy,
  };
}


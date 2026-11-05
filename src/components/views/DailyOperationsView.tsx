import React, { useState, useEffect } from 'react';
import {
  CheckCircle, Printer, Calendar, Check, X,
  ArrowDownLeft, ArrowUpRight, FileSpreadsheet,
  Phone, AlertTriangle, Clock, UserCheck, MessageSquare, ShieldAlert, Send
} from 'lucide-react';
import {
  DailyTrip, TripAttendanceRecord, Route, StudentMember, CampusMaster, Vehicle, UserRole, AbsenteeCallRecord
} from '../../types/index.js';
import { PrintExportToolbar, FilterPopover, openHtmlPrintPreview, exportToCsv } from '../../utils/exportPrint.js';
import {
  analyzeAttendanceForDate,
  getPreviousWorkingDate,
  AttendanceChangeRequest,
  AttendanceAcknowledgement,
  MemberAttendanceDiscrepancyItem,
} from '../../utils/attendanceAlerts.js';

interface DailyOperationsViewProps {
  schoolName?: string;
  isAdmin?: boolean;
  currentRole?: UserRole;
  userCampus?: string;
  campuses?: CampusMaster[];
  vehicles?: Vehicle[];
  trips: DailyTrip[];
  attendanceRecords: TripAttendanceRecord[];
  routes: Route[];
  students?: StudentMember[];
  absenteeCalls?: AbsenteeCallRecord[];
  initialSubTab?: string;
  externalTargetRoute?: {
    routeId: string;
    date: string;
    mode: 'arrival' | 'departure';
  } | null;
  onClearExternalTargetRoute?: () => void;
  attendanceChangeRequests?: AttendanceChangeRequest[];
  attendanceAcknowledgements?: AttendanceAcknowledgement[];
  onSubmitAttendanceChangeRequest?: (
    req: Omit<AttendanceChangeRequest, 'id' | 'requestedAt' | 'status'>
  ) => void;
  onReviewAttendanceChangeRequest?: (
    id: string,
    action: 'Approve' | 'Reject',
    remarks?: string
  ) => Promise<void>;
  onAcknowledgeUnmarkedAttendance?: (payload: {
    date: string;
    routeId: string;
    routeCode: string;
    campus: string;
    note: string;
  }) => void;
  onSelectTrip: (tripId: string) => void;
  onSelectRouteForDate?: (date: string, routeId: string) => Promise<void>;
  onMarkAttendance: (recordId: string, source: 'driver' | 'assistant', value: string, reason?: string) => Promise<any>;
  onBatchSaveAttendance?: (
    entries: Array<{
      recordId: string;
      source: 'driver' | 'assistant';
      value: string;
      reason?: string;
    }>
  ) => Promise<any>;
  onResolveMismatch: (recordId: string, value: string, reason: string) => Promise<any>;
  onVerifyTrip: (
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
  ) => Promise<any>;
  onCancelTrip: (tripId: string, reason: string) => Promise<any>;
  onOpenPrintPack: (routeId: string, shiftName: string, weekStartDate: string, weekEndDate?: string) => Promise<void>;
  onSaveAbsenteeCall?: (payload: Partial<AbsenteeCallRecord> & { clearExpectedReturn?: boolean }) => Promise<any>;
  onConfirmEarlyArrival?: (payload: {
    studentId: string;
    date: string;
    confirmedBy?: string;
    remarks?: string;
  }) => Promise<any>;
}

interface SummaryTimingOverride {
  inTime1?: string;
  inStrength1?: string;
  outTime1?: string;
  outStrength1?: string;
  remark1?: string;
  inTime2?: string;
  inStrength2?: string;
  outTime2?: string;
  outStrength2?: string;
  remark2?: string;
}

const getCurrentSystemTimeHHMM = (): string => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const summarizeRemarkForTable = (text?: string, maxLen = 28): string => {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
};

const getTodayLocalStr = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeCampusCode = (raw?: string | null): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed || lower === 'all' || lower === 'all campuses') return null;
  if (lower === 'sr' || lower.startsWith('sr ') || lower.includes('senior')) return 'Sr';
  if (lower === 'jr' || lower.startsWith('jr ') || lower.includes('junior')) return 'Jr';
  return trimmed;
};

export const DailyOperationsView: React.FC<DailyOperationsViewProps> = ({
  schoolName,
  isAdmin = true,
  currentRole = 'Admin',
  userCampus,
  campuses = [],
  vehicles = [],
  trips,
  attendanceRecords,
  routes,
  students = [],
  absenteeCalls = [],
  initialSubTab,
  externalTargetRoute,
  onClearExternalTargetRoute,
  attendanceChangeRequests = [],
  attendanceAcknowledgements = [],
  onSubmitAttendanceChangeRequest,
  onReviewAttendanceChangeRequest,
  onAcknowledgeUnmarkedAttendance,
  onSelectTrip,
  onMarkAttendance,
  onBatchSaveAttendance,
  onVerifyTrip,
  onOpenPrintPack,
  onSaveAbsenteeCall,
  onConfirmEarlyArrival,
}) => {
  const isAssistant = currentRole === 'Transport Assistant';
  const isAttendanceIncharge = currentRole === 'Attendance Incharge';
  const isCoordinator = currentRole === 'Transport Coordinator';
  const isCampusRestricted = isAssistant || isAttendanceIncharge;
  const lockedCampus = isCampusRestricted ? normalizeCampusCode(userCampus) : null;

  const resolveAllowedSubView = (
    tab?: string
  ):
    | 'board'
    | 'calendar'
    | 'summary'
    | 'pack'
    | 'call_absentees'
    | 'unmarked_mismatch'
    | 'mark_holiday' => {
    if (tab === 'unmarked_mismatch') return 'unmarked_mismatch';
    if (tab === 'mark_holiday') return 'mark_holiday';
    if (tab === 'summary') return 'summary';
    if (tab === 'calendar') return 'calendar';
    if (tab === 'call_absentees') return 'call_absentees';
    if (tab === 'pack') return 'pack';
    return 'board';
  };

  const [activeSubView, setActiveSubView] = useState<
    | 'board'
    | 'calendar'
    | 'summary'
    | 'pack'
    | 'call_absentees'
    | 'unmarked_mismatch'
    | 'mark_holiday'
  >(() => resolveAllowedSubView(initialSubTab));

  // Separate mode for 1- Arrival Attendance vs 2- Departure Attendance
  const [boardMode, setBoardMode] = useState<'arrival' | 'departure'>(
    initialSubTab === 'departure' ? 'departure' : 'arrival'
  );

  // Mismatch Reason Popup Modal state when Departure Attendance != Arrival Attendance
  const [mismatchPopup, setMismatchPopup] = useState<{
    recordId: string;
    studentName: string;
    admissionNo: string;
    arrivalStatus: string;
    departureStatus: string;
    reason: string;
  } | null>(null);
  const [mismatchError, setMismatchError] = useState<string | null>(null);

  // Early Arrival Confirmation Modal state (when student with future expectedReturnDate arrives early)
  const [earlyArrivalModal, setEarlyArrivalModal] = useState<{
    student: StudentMember;
    record: TripAttendanceRecord;
    mode: 'arrival' | 'departure';
    expectedReturnDate: string;
    remarks: string;
  } | null>(null);
  const [isConfirmingEarlyArrival, setIsConfirmingEarlyArrival] = useState(false);

  useEffect(() => {
    if (initialSubTab === 'unmarked_mismatch') setActiveSubView('unmarked_mismatch');
    else if (initialSubTab === 'mark_holiday') setActiveSubView('mark_holiday');
    else if (initialSubTab === 'pack') setActiveSubView('pack');
    else if (initialSubTab === 'summary') setActiveSubView('summary');
    else if (initialSubTab === 'calendar') setActiveSubView('calendar');
    else if (initialSubTab === 'call_absentees') setActiveSubView('call_absentees');
    else if (initialSubTab === 'departure') {
      setActiveSubView('board');
      setBoardMode('departure');
    } else if (initialSubTab === 'arrival' || initialSubTab === 'board') {
      setActiveSubView('board');
      setBoardMode('arrival');
    }
  }, [initialSubTab]);

  const todayStr = getTodayLocalStr();
  const yesterdayStr = getPreviousWorkingDate(todayStr);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedCampus, setSelectedCampus] = useState<string>(lockedCampus || 'all');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('all');
  const [selectedRouteId, setSelectedRouteId] = useState<string>(() => {
    const initialMatching = lockedCampus
      ? routes.find((r) => normalizeCampusCode(r.campus) === lockedCampus)
      : routes[0];
    return initialMatching?.id || routes[0]?.id || '';
  });
  const [selectedTripId, setSelectedTripId] = useState<string>(trips[0]?.id || '');
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [isLoadingRouteTrip] = useState(false);

  // Deep-link from Startup Popup or Dashboard ("Proceed to Mark Attendance of that Route Directly")
  useEffect(() => {
    if (externalTargetRoute && externalTargetRoute.routeId) {
      setActiveSubView('board');
      setBoardMode(externalTargetRoute.mode || 'arrival');
      if (externalTargetRoute.date) {
        setSelectedDate(externalTargetRoute.date);
      }
      setSelectedVehicleFilter('all');
      setSelectedRouteId(externalTargetRoute.routeId);
      setSelectedTripId(`dt-${externalTargetRoute.routeId}-${externalTargetRoute.date || todayStr}`);
      if (onClearExternalTargetRoute) {
        onClearExternalTargetRoute();
      }
    }
  }, [externalTargetRoute, onClearExternalTargetRoute, todayStr]);

  // --- Unmarked & Mismatch Sub-Module State ---
  const [discrepancyDate, setDiscrepancyDate] = useState<string>(todayStr);
  const [discrepancyCampus, setDiscrepancyCampus] = useState<'all' | 'Sr' | 'Jr'>(
    (lockedCampus as 'Sr' | 'Jr') || 'all'
  );
  const [discrepancyRouteId, setDiscrepancyRouteId] = useState<string>('all');
  const [discrepancyCategoryTab, setDiscrepancyCategoryTab] = useState<
    'both_not_marked' | 'single_shift_not_marked' | 'status_mismatch' | 'requests_acks'
  >('both_not_marked');

  // --- Mark Route Holiday Sub-Module State ---
  const [holidaySubDate, setHolidaySubDate] = useState<string>(todayStr);
  const [holidaySubCampus, setHolidaySubCampus] = useState<'all' | 'Sr' | 'Jr'>(
    (lockedCampus as 'Sr' | 'Jr') || 'all'
  );
  const [holidaySubReason, setHolidaySubReason] = useState<string>('School Holiday');
  const [selectedHolidayRouteIds, setSelectedHolidayRouteIds] = useState<string[]>([]);
  const [isMarkingRoutesHoliday, setIsMarkingRoutesHoliday] = useState<boolean>(false);
  const [localHolidayMarkedRouteDates, setLocalHolidayMarkedRouteDates] = useState<
    Record<string, boolean>
  >({});
  const [holidayResultModal, setHolidayResultModal] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    date?: string;
    routeNames?: string[];
    memberCount?: number;
    occasion?: string;
  } | null>(null);
  const [changeRequestModalTarget, setChangeRequestModalTarget] = useState<{
    studentId: string;
    studentName: string;
    admissionNo: string;
    classSection: string;
    routeId: string;
    routeCode: string;
    campus: 'Sr' | 'Jr';
    date: string;
    tripId: string;
    recordId: string;
    currentArrivalStatus: TripAttendanceRecord['driverStatus'];
    currentDepartureStatus: TripAttendanceRecord['assistantStatus'];
    proposedArrivalStatus: TripAttendanceRecord['driverStatus'];
    proposedDepartureStatus: TripAttendanceRecord['assistantStatus'];
    reason: string;
  } | null>(null);

  // Optimistic local state for marked Arrival (In) and Departure (Out) times per route+date so the UI updates in 0ms
  const [localMarkedTripTimings, setLocalMarkedTripTimings] = useState<
    Record<string, { inTime?: string; outTime?: string; status?: 'Arrived' | 'Departed' }>
  >({});

  // In Time & Out Time quick inputs on Arrival & Departure bar (auto-selected as per current system timings)
  const [tripInTime, setTripInTime] = useState<string>(() => getCurrentSystemTimeHHMM());
  const [tripOutTime, setTripOutTime] = useState<string>(() => getCurrentSystemTimeHHMM());

  // Prompt modal when user tries to mark Arrival/Departure attendance before marking Arrival/Departure time
  const [timeRequiredPrompt, setTimeRequiredPrompt] = useState<{
    mode: 'arrival' | 'departure';
    pendingAction?: {
      type: 'single' | 'all_holiday' | 'mark_pending_present' | 'save_batch';
      rec?: TripAttendanceRecord;
      statusVal?: string;
    };
  } | null>(null);

  // Touch-slide guard to prevent accidental button activation while scrolling with finger on APK/mobile
  const touchStartPosRef = React.useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = React.useRef<boolean>(false);

  const handleAttendanceTouchStart = (e: React.TouchEvent) => {
    const t = e.touches?.[0];
    if (t) {
      touchStartPosRef.current = { x: t.clientX, y: t.clientY };
      touchMovedRef.current = false;
    }
  };

  const handleAttendanceTouchMove = (e: React.TouchEvent) => {
    const t = e.touches?.[0];
    if (t && touchStartPosRef.current) {
      const dx = Math.abs(t.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(t.clientY - touchStartPosRef.current.y);
      if (dx > 6 || dy > 6) {
        touchMovedRef.current = true;
      }
    }
  };

  // Unsaved Draft Attendance State (finalized only when "Save Attendance" is clicked)
  const [draftAttendance, setDraftAttendance] = useState<
    Record<
      string,
      {
        status: string;
        reason?: string;
        earlyArrivalConfirmed?: boolean;
        earlyArrivalRemarks?: string;
      }
    >
  >({});
  const [isSavingAttendanceBatch, setIsSavingAttendanceBatch] = useState<boolean>(false);

  // Modal when Admin tries to change an already-saved attendance record
  const [savedRecordChangeModal, setSavedRecordChangeModal] = useState<{
    mode: 'arrival' | 'departure';
    actionType: 'single' | 'all_holiday';
    rec?: TripAttendanceRecord;
    savedStatus?: string;
    newStatus?: string;
    affectedCount?: number;
  } | null>(null);

  // Modal when non-Admin tries to change an already-saved attendance record
  const [lockedRecordModal, setLockedRecordModal] = useState<{
    studentName: string;
    admissionNo: string;
    savedStatus: string;
    mode: 'arrival' | 'departure';
    rec?: TripAttendanceRecord;
    attemptedNewStatus?: string;
  } | null>(null);

  // Strength mismatch remark input in Attendance window
  const [tripMismatchRemarkInput, setTripMismatchRemarkInput] = useState<string>('');

  // Summary Sheet State (matching Narendra Edu Valley Transport Timings clipboard format)
  const [summaryDate, setSummaryDate] = useState<string>(todayStr);
  const [summaryCampus, setSummaryCampus] = useState<string>(() => lockedCampus || 'All Campuses');
  const [campusInchargeName, setCampusInchargeName] = useState<string>('');
  const [filledByName, setFilledByName] = useState<string>(() =>
    isAttendanceIncharge ? 'Attendance Incharge' : 'Transport Assistant'
  );
  const [summaryRemarks, setSummaryRemarks] = useState<string>('');
  const [timingOverrides, setTimingOverrides] = useState<Record<string, SummaryTimingOverride>>({});

  useEffect(() => {
    if (lockedCampus) {
      setSummaryCampus(lockedCampus);
    }
  }, [lockedCampus]);

  const getStudentCampusCode = (s: StudentMember): string => {
    return (
      normalizeCampusCode(s.campus) ||
      (s.routeCode?.toLowerCase().startsWith('jr') ? 'Jr' : 'Sr')
    );
  };

  // Raw route members helper (all non-Left members attached to a route across any campus)
  const getAllMembersForRouteRaw = (route: Route | undefined): StudentMember[] => {
    if (!route) return [];
    return students
      .filter((s) => {
        if (
          s.transportStatus === 'Left' ||
          String(s.transportStatus || '').trim().toLowerCase() === 'left'
        ) {
          return false;
        }
        if (s.routeId === route.id || (route.code && s.routeCode === route.code)) return true;
        if (!s.routeId && (!s.routeCode || s.routeCode === 'Unassigned')) {
          const hasStopMatch =
            (Array.isArray(route.stopIds) && s.pickupDropStopId && route.stopIds.includes(s.pickupDropStopId)) ||
            (Array.isArray(route.stopNames) &&
              s.pickupDropStopName &&
              route.stopNames.some(
                (sn) => sn.trim().toLowerCase() === s.pickupDropStopName.trim().toLowerCase()
              ));
          if (hasStopMatch) return true;
          const routeHasSpecificStops =
            (Array.isArray(route.stopIds) && route.stopIds.length > 0) ||
            (Array.isArray(route.stopNames) && route.stopNames.length > 0);
          if (!routeHasSpecificStops) {
            const hasVillageMatch =
              (s.villageId && Array.isArray(route.villageIds) && route.villageIds.includes(s.villageId)) ||
              (s.villageName &&
                Array.isArray(route.villageNames) &&
                route.villageNames.some(
                  (vn) => vn.trim().toLowerCase() === s.villageName.trim().toLowerCase()
                ));
            if (hasVillageMatch) return true;
          }
        }
        return false;
      })
      .sort((a, b) =>
        String(a.name || '').trim().localeCompare(String(b.name || '').trim(), undefined, {
          sensitivity: 'base',
          numeric: true,
        })
      );
  };

  // Campus-scoped route members helper:
  // For campus-restricted roles (Sr/Jr Transport Assistant & Sr/Jr Attendance Incharge) or when a campus filter is active,
  // strictly return ONLY students belonging to that campus so other campus members cannot be viewed or marked.
  const getMembersForRoute = (
    route: Route | undefined,
    campusFilterOverride?: string | null
  ): StudentMember[] => {
    const rawMembers = getAllMembersForRouteRaw(route);
    const effectiveCampus =
      lockedCampus ||
      normalizeCampusCode(campusFilterOverride !== undefined ? campusFilterOverride : selectedCampus);
    if (!effectiveCampus) return rawMembers;
    return rawMembers.filter((s) => getStudentCampusCode(s) === effectiveCampus);
  };

  // Check if a route either belongs to targetCampus OR carries at least one active/suspended member of targetCampus
  const routeHasMembersForCampus = (route: Route, targetCampusCode: string | null): boolean => {
    if (!targetCampusCode) return true;
    if (normalizeCampusCode(route.campus) === targetCampusCode) return true;
    return getAllMembersForRouteRaw(route).some(
      (s) => getStudentCampusCode(s) === targetCampusCode
    );
  };

  const activeCampusFilterCode = lockedCampus || normalizeCampusCode(selectedCampus);

  // Filter routes by selected Vehicle and Campus (including cross-campus routes that carry students of activeCampusFilterCode)
  const availableRoutesForDropdown = routes.filter((r) => {
    if (activeCampusFilterCode && !routeHasMembersForCampus(r, activeCampusFilterCode)) {
      return false;
    }
    if (
      selectedVehicleFilter !== 'all' &&
      r.vehicleId !== selectedVehicleFilter &&
      r.vehicleNumber !== selectedVehicleFilter
    ) {
      return false;
    }
    return true;
  });

  const [calendarMonth, setCalendarMonth] = useState<string>(todayStr.slice(0, 7));

  useEffect(() => {
    if (
      availableRoutesForDropdown.length > 0 &&
      !availableRoutesForDropdown.some((r) => r.id === selectedRouteId)
    ) {
      const nextRoute = availableRoutesForDropdown[0];
      setSelectedRouteId(nextRoute.id);
    }
  }, [selectedVehicleFilter, selectedCampus, routes, availableRoutesForDropdown, selectedRouteId]);

  const selectedRouteObj =
    availableRoutesForDropdown.find((r) => r.id === selectedRouteId) ||
    availableRoutesForDropdown[0] ||
    routes.find((r) => r.id === selectedRouteId) ||
    routes[0];

  const matchingTripsForRouteAndDate = trips.filter(
    (t) =>
      t.date === selectedDate &&
      selectedRouteObj &&
      (t.routeId === selectedRouteObj.id || t.routeName === selectedRouteObj.code)
  );

  const matchedTripForRouteAndDate =
    matchingTripsForRouteAndDate.find(
      (t) => (t.inTime || t.outTime) && t.status !== 'Ready' && t.status !== 'Planned'
    ) ||
    matchingTripsForRouteAndDate.find((t) => t.inTime || t.outTime) ||
    matchingTripsForRouteAndDate[0];

  const routeDateKey = `${selectedRouteObj?.id || ''}:${selectedDate}`;
  const localTimingForCurrentRoute = localMarkedTripTimings[routeDateKey];

  const baseCurrentTrip: DailyTrip | undefined =
    matchedTripForRouteAndDate ||
    (selectedRouteObj
      ? {
          id: `dt-${selectedRouteObj.id}-${selectedDate}`,
          date: selectedDate,
          campus: selectedRouteObj.campus,
          routeId: selectedRouteObj.id,
          routeName: selectedRouteObj.code,
          vehicleId: selectedRouteObj.vehicleId,
          vehicleNumber: selectedRouteObj.vehicleNumber,
          driverName:
            selectedRouteObj.driverName ||
            vehicles.find(
              (v) =>
                v.id === selectedRouteObj.vehicleId ||
                v.registrationNumber === selectedRouteObj.vehicleNumber
            )?.assignedDriverName ||
            'Assigned Driver',
          helperName: selectedRouteObj.assistantName,
          tripNumber: selectedRouteObj.tripNumber || 1,
          shiftName: `Trip ${selectedRouteObj.tripNumber || 1} — ${selectedRouteObj.name || selectedRouteObj.code}`,
          status: 'Ready',
          rosterCount: 0,
          presentCount: 0,
          absentCount: 0,
          mismatchCount: 0,
          plannedStartTime: '06:40 AM',
          plannedEndTime: '07:30 AM',
        }
      : undefined);

  const currentTrip: DailyTrip | undefined = baseCurrentTrip
    ? {
        ...baseCurrentTrip,
        status: localTimingForCurrentRoute?.status || baseCurrentTrip.status,
        inTime: localTimingForCurrentRoute?.inTime || baseCurrentTrip.inTime,
        outTime: localTimingForCurrentRoute?.outTime || baseCurrentTrip.outTime,
      }
    : undefined;

  useEffect(() => {
    const nowHHMM = getCurrentSystemTimeHHMM();
    const localTiming = localMarkedTripTimings[`${selectedRouteObj?.id || ''}:${selectedDate}`];
    if (matchedTripForRouteAndDate) {
      if (matchedTripForRouteAndDate.id !== selectedTripId) {
        setSelectedTripId(matchedTripForRouteAndDate.id);
        onSelectTrip(matchedTripForRouteAndDate.id);
      }
      setTripInTime(localTiming?.inTime || matchedTripForRouteAndDate.inTime || nowHHMM);
      setTripOutTime(localTiming?.outTime || matchedTripForRouteAndDate.outTime || nowHHMM);
      setTripMismatchRemarkInput(matchedTripForRouteAndDate.strengthMismatchRemark || '');
    } else {
      setTripInTime(localTiming?.inTime || nowHHMM);
      setTripOutTime(localTiming?.outTime || nowHHMM);
      setTripMismatchRemarkInput('');
    }
  }, [
    matchedTripForRouteAndDate?.id,
    matchedTripForRouteAndDate?.inTime,
    matchedTripForRouteAndDate?.outTime,
    matchedTripForRouteAndDate?.strengthMismatchRemark,
    selectedRouteObj?.id,
    selectedDate,
    boardMode,
  ]);

  const handleRouteDropdownChange = (newRouteId: string) => {
    setSelectedRouteId(newRouteId);
    const existingTrip = trips.find(
      (t) => t.date === selectedDate && t.routeId === newRouteId
    );
    if (existingTrip) {
      setSelectedTripId(existingTrip.id);
      onSelectTrip(existingTrip.id);
    }
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
  };

  const boardRouteMembers = getMembersForRoute(selectedRouteObj);
  const effectiveTripId = currentTrip?.id || (selectedRouteObj ? `dt-${selectedRouteObj.id}-${selectedDate}` : '');

  const tripAttendanceList: TripAttendanceRecord[] = boardRouteMembers.map((stu) => {
    const existingRec = attendanceRecords.find(
      (a) =>
        a.studentId === stu.id &&
        (a.tripId === effectiveTripId ||
          (a.date === selectedDate &&
            (!matchedTripForRouteAndDate || a.tripId === matchedTripForRouteAndDate.id)))
    );
    const stopLabel = stu.pickupDropStopName
      ? stu.villageName && !stu.pickupDropStopName.toLowerCase().includes(stu.villageName.toLowerCase())
        ? `${stu.pickupDropStopName} (${stu.villageName})`
        : stu.pickupDropStopName
      : stu.villageName || '—';

    if (existingRec) {
      return {
        ...existingRec,
        studentName: stu.name,
        admissionNo: stu.admissionNo,
        classSection: `${stu.class}-${stu.section}`,
        stopName: stopLabel,
        transportStatus: stu.transportStatus,
      };
    }

    return {
      id: `att-${effectiveTripId}-${stu.id}`,
      tripId: effectiveTripId,
      date: selectedDate,
      studentId: stu.id,
      admissionNo: stu.admissionNo,
      studentName: stu.name,
      classSection: `${stu.class}-${stu.section}`,
      stopName: stopLabel,
      transportStatus: stu.transportStatus,
      driverStatus: 'Pending',
      assistantStatus: 'Pending',
      reconciliationStatus: 'Assistant_Pending',
    };
  });

  const getSavedStatusForMode = (rec: TripAttendanceRecord, mode: 'arrival' | 'departure' = boardMode) =>
    (mode === 'arrival' ? rec.driverStatus : rec.assistantStatus) || 'Pending';

  const getDraftKey = (recId: string, mode: 'arrival' | 'departure' = boardMode) =>
    `${mode}:${recId}`;

  const activeBoardStatus = (rec: TripAttendanceRecord) => {
    const dEntry = draftAttendance[getDraftKey(rec.id, boardMode)];
    if (dEntry && dEntry.status) return dEntry.status;
    return getSavedStatusForMode(rec, boardMode);
  };

  const getEffectiveArrivalStatus = (rec: TripAttendanceRecord) => {
    const dArr = draftAttendance[getDraftKey(rec.id, 'arrival')];
    if (dArr && dArr.status) return dArr.status;
    return rec.driverStatus || 'Pending';
  };

  const getEffectiveDepartureStatus = (rec: TripAttendanceRecord) => {
    const dDep = draftAttendance[getDraftKey(rec.id, 'departure')];
    if (dDep && dDep.status) return dDep.status;
    return rec.assistantStatus || 'Pending';
  };

  // Unsaved draft records for current route & boardMode
  const unsavedDraftEntriesForCurrentBoard = tripAttendanceList.filter((rec) => {
    const dEntry = draftAttendance[getDraftKey(rec.id, boardMode)];
    const savedSt = getSavedStatusForMode(rec, boardMode);
    return Boolean(dEntry && dEntry.status && dEntry.status !== savedSt);
  });

  const unsavedModifiedSavedRecordsCount = unsavedDraftEntriesForCurrentBoard.filter((rec) => {
    const savedSt = getSavedStatusForMode(rec, boardMode);
    return savedSt !== 'Pending';
  }).length;

  const savedRecordsOnCurrentBoardCount = tripAttendanceList.filter(
    (rec) => getSavedStatusForMode(rec, boardMode) !== 'Pending'
  ).length;

  const presentCount = tripAttendanceList.filter((a) => activeBoardStatus(a) === 'Present').length;
  const absentCount = tripAttendanceList.filter((a) => activeBoardStatus(a) === 'Absent').length;
  const leaveCount = tripAttendanceList.filter((a) => activeBoardStatus(a) === 'Leave').length;
  const holidayCount = tripAttendanceList.filter((a) => activeBoardStatus(a) === 'Holiday').length;
  const isRouteMarkedHoliday =
    tripAttendanceList.length > 0 && holidayCount === tripAttendanceList.length;
  const pendingCount = tripAttendanceList.filter(
    (a) =>
      activeBoardStatus(a) !== 'Present' &&
      activeBoardStatus(a) !== 'Absent' &&
      activeBoardStatus(a) !== 'Leave' &&
      activeBoardStatus(a) !== 'Holiday'
  ).length;

  // Helper to resolve active tentative return date (expectedReturnDate) marked by Assistant/Coordinator
  const getActiveTentativeReturnDateForStudent = (
    studentId: string,
    forDate: string
  ): string | null => {
    const stu = students.find((s) => s.id === studentId);
    if (stu?.expectedReturnDate && forDate < stu.expectedReturnDate) {
      return stu.expectedReturnDate;
    }
    const callWithExpected = absenteeCalls.find(
      (c) =>
        c.studentId === studentId &&
        c.expectedReturnDate &&
        !c.earlyArrivalConfirmedAt &&
        forDate < c.expectedReturnDate
    );
    return callWithExpected?.expectedReturnDate || null;
  };

  // Auto-mark Leave ('L') daily when user opens the attendance form for members with a future Tentative Date of Arrival
  useEffect(() => {
    if (activeSubView !== 'board' || tripAttendanceList.length === 0) return;
    setDraftAttendance((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const rec of tripAttendanceList) {
        const savedSt = getSavedStatusForMode(rec, boardMode);
        if (savedSt !== 'Pending') continue;
        const key = getDraftKey(rec.id, boardMode);
        if (next[key]) continue;
        const tentativeDate = getActiveTentativeReturnDateForStudent(rec.studentId, selectedDate);
        if (tentativeDate) {
          next[key] = {
            status: 'Leave',
            reason: `Auto-marked Leave (Tentative return: ${tentativeDate})`,
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [
    activeSubView,
    selectedRouteObj?.id,
    selectedDate,
    boardMode,
    tripAttendanceList.length,
    absenteeCalls.length,
  ]);

  const effectiveInTime = isRouteMarkedHoliday
    ? undefined
    : localTimingForCurrentRoute?.inTime ||
      (matchedTripForRouteAndDate?.inTime &&
      matchedTripForRouteAndDate?.status !== 'Ready' &&
      matchedTripForRouteAndDate?.status !== 'Planned'
        ? matchedTripForRouteAndDate.inTime
        : undefined) ||
      (tripAttendanceList.some(
        (a) => a.driverStatus && a.driverStatus !== 'Pending' && a.driverStatus !== 'Holiday'
      )
        ? matchedTripForRouteAndDate?.inTime || tripInTime || '07:30'
        : undefined);

  const effectiveOutTime = isRouteMarkedHoliday
    ? undefined
    : localTimingForCurrentRoute?.outTime ||
      (matchedTripForRouteAndDate?.outTime &&
      (matchedTripForRouteAndDate?.status === 'Departed' ||
        matchedTripForRouteAndDate?.status === 'Completed' ||
        matchedTripForRouteAndDate?.status === 'Verified')
        ? matchedTripForRouteAndDate.outTime
        : undefined) ||
      (tripAttendanceList.some(
        (a) => a.assistantStatus && a.assistantStatus !== 'Pending' && a.assistantStatus !== 'Holiday'
      )
        ? matchedTripForRouteAndDate?.outTime || tripOutTime || '14:00'
        : undefined);

  const isArrivalTimeMarked = Boolean(effectiveInTime);
  const isDepartureTimeMarked = Boolean(effectiveOutTime);

  // Separate Arrival vs Departure counts for current route/trip
  const arrivalMarkedRecordsCount = tripAttendanceList.filter(
    (a) => getEffectiveArrivalStatus(a) !== 'Pending'
  ).length;
  const departureMarkedRecordsCount = tripAttendanceList.filter(
    (a) => getEffectiveDepartureStatus(a) !== 'Pending'
  ).length;
  const arrivalPresentStrength = tripAttendanceList.filter(
    (a) => getEffectiveArrivalStatus(a) === 'Present'
  ).length;
  const departurePresentStrength = tripAttendanceList.filter(
    (a) => getEffectiveDepartureStatus(a) === 'Present'
  ).length;
  const hasStrengthMismatchOnBoard =
    arrivalMarkedRecordsCount > 0 &&
    departureMarkedRecordsCount > 0 &&
    arrivalPresentStrength !== departurePresentStrength;

  const autoDerivedMismatchSummary = tripAttendanceList
    .filter((a) => {
      const arr = getEffectiveArrivalStatus(a);
      const dep = getEffectiveDepartureStatus(a);
      return arr !== 'Pending' && dep !== 'Pending' && arr !== dep;
    })
    .map((a) => {
      const arr = getEffectiveArrivalStatus(a);
      const dep = getEffectiveDepartureStatus(a);
      const dDep = draftAttendance[getDraftKey(a.id, 'departure')];
      const rmk = dDep?.reason || a.resolutionReason || a.notes || '';
      return `${a.studentName.split(' ')[0]}(${arr[0]}→${dep[0]}${rmk ? ': ' + rmk : ''})`;
    })
    .join('; ');

  const handleSaveTripStrengthRemark = async () => {
    if (!currentTrip) return;
    const cleanRemark = (tripMismatchRemarkInput || autoDerivedMismatchSummary).trim();
    await onVerifyTrip(currentTrip.id, currentTrip.notes, undefined, {
      strengthMismatchRemark: cleanRemark,
    });
    setStatusFeedback(`Saved Strength Mismatch Remark: "${summarizeRemarkForTable(cleanRemark, 40)}"`);
    setTimeout(() => setStatusFeedback(null), 3500);
  };

  const stageSingleDraftAttendance = (
    rec: TripAttendanceRecord,
    mode: 'arrival' | 'departure',
    statusVal: string,
    extra?: { reason?: string; earlyArrivalConfirmed?: boolean; earlyArrivalRemarks?: string }
  ) => {
    const key = getDraftKey(rec.id, mode);
    const savedSt = getSavedStatusForMode(rec, mode);
    setDraftAttendance((prev) => {
      const next = { ...prev };
      if (statusVal === savedSt && !extra?.reason) {
        delete next[key];
      } else {
        next[key] = {
          status: statusVal,
          reason: extra?.reason,
          earlyArrivalConfirmed: extra?.earlyArrivalConfirmed,
          earlyArrivalRemarks: extra?.earlyArrivalRemarks,
        };
      }
      return next;
    });
  };

  const proceedWithAttendanceSelectionAfterSavedCheck = (
    rec: TripAttendanceRecord,
    mode: 'arrival' | 'departure',
    newStatus: string
  ) => {
    const earlyInfo = checkRequiresEarlyArrivalConfirmation(rec, newStatus);
    if (earlyInfo) {
      setEarlyArrivalModal({
        student: earlyInfo.student,
        record: rec,
        mode,
        expectedReturnDate: earlyInfo.expectedReturnDate,
        remarks: `Arrived early on ${selectedDate} (Tentative Date: ${earlyInfo.expectedReturnDate})`,
      });
      return;
    }

    if (mode === 'departure') {
      const arrStatus = getEffectiveArrivalStatus(rec);
      if (arrStatus !== 'Pending' && arrStatus !== newStatus && newStatus !== 'Holiday' && arrStatus !== 'Holiday') {
        setMismatchError(null);
        const existingDraft = draftAttendance[getDraftKey(rec.id, 'departure')];
        setMismatchPopup({
          recordId: rec.id,
          studentName: rec.studentName,
          admissionNo: rec.admissionNo,
          arrivalStatus: arrStatus,
          departureStatus: newStatus,
          reason: existingDraft?.reason || rec.resolutionReason || rec.notes || '',
        });
        return;
      }
    }

    stageSingleDraftAttendance(rec, mode, newStatus);
  };

  const applyAllHolidayToDraft = async (
    mode: 'arrival' | 'departure',
    includeSavedRecords: boolean
  ) => {
    const recordsToMark = tripAttendanceList.filter((rec) => {
      const savedSt = getSavedStatusForMode(rec, mode);
      return savedSt === 'Pending' || includeSavedRecords;
    });

    if (recordsToMark.length === 0) {
      setHolidayResultModal({
        type: 'error',
        title: 'No Members Available to Mark Holiday',
        message: 'No active or unmarked transport members were found on this route to mark Holiday.',
      });
      return;
    }

    setDraftAttendance((prev) => {
      const next = { ...prev };
      for (const rec of tripAttendanceList) {
        const savedSt = getSavedStatusForMode(rec, mode);
        if (savedSt !== 'Pending' && !includeSavedRecords) continue;
        const key = getDraftKey(rec.id, mode);
        if (savedSt === 'Holiday') {
          delete next[key];
        } else {
          next[key] = { status: 'Holiday' };
        }
      }
      return next;
    });

    setIsSavingAttendanceBatch(true);
    try {
      const batchPayload: Array<{
        recordId: string;
        source: 'driver' | 'assistant';
        value: string;
        reason?: string;
      }> = [];

      for (const rec of recordsToMark) {
        batchPayload.push({
          recordId: rec.id,
          source: 'driver',
          value: 'Holiday',
          reason: 'School Holiday',
        });
        batchPayload.push({
          recordId: rec.id,
          source: 'assistant',
          value: 'Holiday',
          reason: 'School Holiday',
        });
      }

      if (onBatchSaveAttendance) {
        await onBatchSaveAttendance(batchPayload);
      } else {
        for (const item of batchPayload) {
          await onMarkAttendance(item.recordId, item.source, item.value, item.reason);
        }
      }

      // Clear draft entries after direct save
      setDraftAttendance((prev) => {
        const next = { ...prev };
        for (const rec of recordsToMark) {
          delete next[getDraftKey(rec.id, 'arrival')];
          delete next[getDraftKey(rec.id, 'departure')];
        }
        return next;
      });

      if (selectedRouteObj?.id) {
        setLocalHolidayMarkedRouteDates((prev) => ({
          ...prev,
          [`${selectedRouteObj.id}:${selectedDate}`]: true,
        }));
      }

      const routeLabel = selectedRouteObj?.code || currentTrip?.routeName || 'Selected Route';
      setStatusFeedback(
        `✓ Holiday (H) marked and saved for ${recordsToMark.length} member(s) on ${routeLabel} (${selectedDate}).`
      );
      setTimeout(() => setStatusFeedback(null), 5000);

      setHolidayResultModal({
        type: 'success',
        title: 'Holiday Marked Successfully',
        message: `Holiday (H) has been marked and saved for ${recordsToMark.length} transport member(s) on ${routeLabel} (Arrival & Departure time not applicable).`,
        date: selectedDate,
        routeNames: [routeLabel],
        memberCount: recordsToMark.length,
        occasion: 'School Holiday',
      });
    } catch (err: any) {
      const errMsg =
        err?.message || 'An error occurred while saving Holiday attendance. Please try again.';
      setStatusFeedback(`Error: ${errMsg}`);
      setTimeout(() => setStatusFeedback(null), 5000);
      setHolidayResultModal({
        type: 'error',
        title: 'Error Marking Holiday',
        message: errMsg,
      });
    } finally {
      setIsSavingAttendanceBatch(false);
    }
  };

  const handleMarkAllHoliday = async () => {
    // Arrival and departure time is NOT applicable in case of Holiday — never prompt for time here.
    const alreadySavedNonHoliday = tripAttendanceList.filter((rec) => {
      const savedSt = getSavedStatusForMode(rec, boardMode);
      return savedSt !== 'Pending' && savedSt !== 'Holiday';
    });

    if (alreadySavedNonHoliday.length > 0) {
      if (!isAdmin) {
        const pendingRecs = tripAttendanceList.filter(
          (rec) => getSavedStatusForMode(rec, boardMode) === 'Pending'
        );
        if (pendingRecs.length === 0) {
          setLockedRecordModal({
            studentName: `${alreadySavedNonHoliday.length} Saved Member Record(s)`,
            admissionNo: currentTrip?.routeName || 'Route',
            savedStatus: 'Saved & Finalized',
            mode: boardMode,
          });
          return;
        }
        applyAllHolidayToDraft(boardMode, false);
        return;
      }

      setSavedRecordChangeModal({
        mode: boardMode,
        actionType: 'all_holiday',
        affectedCount: alreadySavedNonHoliday.length,
        newStatus: 'Holiday',
      });
      return;
    }

    applyAllHolidayToDraft(boardMode, true);
  };

  const handleMarkPendingAsPresentInDraft = () => {
    if (boardMode === 'arrival' && !isArrivalTimeMarked) {
      setTripInTime((prev) => prev || getCurrentSystemTimeHHMM());
      setTimeRequiredPrompt({
        mode: 'arrival',
        pendingAction: { type: 'mark_pending_present' },
      });
      return;
    }
    if (boardMode === 'departure' && !isDepartureTimeMarked) {
      setTripOutTime((prev) => prev || getCurrentSystemTimeHHMM());
      setTimeRequiredPrompt({
        mode: 'departure',
        pendingAction: { type: 'mark_pending_present' },
      });
      return;
    }

    let stagedCount = 0;
    setDraftAttendance((prev) => {
      const next = { ...prev };
      for (const rec of tripAttendanceList) {
        const savedSt = getSavedStatusForMode(rec, boardMode);
        const key = getDraftKey(rec.id, boardMode);
        const currentEff = next[key]?.status || savedSt;
        if (savedSt === 'Pending' && currentEff === 'Pending') {
          next[key] = { status: 'Present' };
          stagedCount++;
        }
      }
      return next;
    });
    if (stagedCount > 0) {
      setStatusFeedback(
        `Marked ${stagedCount} unmarked member(s) as Present (P) in draft. Click "Save Attendance" to finalize.`
      );
      setTimeout(() => setStatusFeedback(null), 4000);
    }
  };

  const handleDiscardDraftAttendance = () => {
    setDraftAttendance((prev) => {
      const next = { ...prev };
      for (const rec of tripAttendanceList) {
        delete next[getDraftKey(rec.id, boardMode)];
      }
      return next;
    });
    setStatusFeedback('Discarded unsaved changes and restored saved attendance records.');
    setTimeout(() => setStatusFeedback(null), 3500);
  };

  const executeSaveAttendanceBatch = async (modeToSave: 'arrival' | 'departure' = boardMode) => {
    const recordsToSave = tripAttendanceList.filter((rec) => {
      const dEntry = draftAttendance[getDraftKey(rec.id, modeToSave)];
      const savedSt = getSavedStatusForMode(rec, modeToSave);
      return Boolean(dEntry && dEntry.status && dEntry.status !== savedSt && dEntry.status !== 'Pending');
    });

    if (recordsToSave.length === 0) {
      setStatusFeedback('No unsaved attendance changes to save.');
      setTimeout(() => setStatusFeedback(null), 3000);
      return;
    }

    // Double-check role permission if any saved record is being modified (except Leave -> Present early arrival confirmation or Holiday)
    const modifyingSaved = recordsToSave.some((rec) => {
      const savedSt = getSavedStatusForMode(rec, modeToSave);
      if (savedSt === 'Pending') return false;
      const dEntry = draftAttendance[getDraftKey(rec.id, modeToSave)];
      if (savedSt === 'Leave' && dEntry?.status === 'Present' && dEntry?.earlyArrivalConfirmed) {
        return false;
      }
      if (dEntry?.status === 'Holiday') {
        return false;
      }
      return true;
    });
    if (modifyingSaved && !isAdmin) {
      setLockedRecordModal({
        studentName: 'Saved Attendance Record(s)',
        admissionNo: currentTrip?.routeName || 'Route',
        savedStatus: 'Finalized',
        mode: modeToSave,
      });
      return;
    }

    setIsSavingAttendanceBatch(true);
    try {
      const targetSource = modeToSave === 'arrival' ? 'driver' : 'assistant';

      // Process any early arrival confirmations first
      for (const rec of recordsToSave) {
        const dEntry = draftAttendance[getDraftKey(rec.id, modeToSave)];
        if (dEntry?.earlyArrivalConfirmed && onConfirmEarlyArrival) {
          await onConfirmEarlyArrival({
            studentId: rec.studentId,
            date: selectedDate,
            confirmedBy: currentRole,
            remarks: dEntry.earlyArrivalRemarks || `Confirmed early arrival on ${selectedDate}`,
          });
        }
      }

      const batchPayload = recordsToSave.map((rec) => {
        const dEntry = draftAttendance[getDraftKey(rec.id, modeToSave)]!;
        return {
          recordId: rec.id,
          source: targetSource as 'driver' | 'assistant',
          value: dEntry.status,
          reason: dEntry.reason,
        };
      });

      if (onBatchSaveAttendance) {
        await onBatchSaveAttendance(batchPayload);
      } else {
        for (const item of batchPayload) {
          await onMarkAttendance(item.recordId, item.source, item.value, item.reason);
        }
      }

      const allSavedWereHoliday =
        recordsToSave.length > 0 &&
        recordsToSave.every(
          (rec) => draftAttendance[getDraftKey(rec.id, modeToSave)]?.status === 'Holiday'
        );

      // Clear saved draft entries for this mode
      setDraftAttendance((prev) => {
        const next = { ...prev };
        for (const rec of recordsToSave) {
          delete next[getDraftKey(rec.id, modeToSave)];
        }
        return next;
      });

      const routeLabel = selectedRouteObj?.code || currentTrip?.routeName || 'Route';
      setStatusFeedback(
        `✓ Saved & Finalized ${recordsToSave.length} ${
          modeToSave === 'arrival' ? 'Arrival' : 'Departure'
        } Attendance record(s) for ${routeLabel} (${selectedDate}).`
      );
      setTimeout(() => setStatusFeedback(null), 4500);

      if (allSavedWereHoliday) {
        if (selectedRouteObj?.id) {
          setLocalHolidayMarkedRouteDates((prev) => ({
            ...prev,
            [`${selectedRouteObj.id}:${selectedDate}`]: true,
          }));
        }
        setHolidayResultModal({
          type: 'success',
          title: 'Holiday Marked Successfully',
          message: `Holiday (H) has been marked and saved for ${recordsToSave.length} member(s) on ${routeLabel}.`,
          date: selectedDate,
          routeNames: [routeLabel],
          memberCount: recordsToSave.length,
          occasion: 'School Holiday',
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to save attendance records. Please try again.';
      setStatusFeedback(`Error: ${errMsg}`);
      setTimeout(() => setStatusFeedback(null), 4500);
      setHolidayResultModal({
        type: 'error',
        title: 'Error Saving Attendance',
        message: errMsg,
      });
    } finally {
      setIsSavingAttendanceBatch(false);
    }
  };

  const handleSaveAttendanceClick = async () => {
    if (unsavedDraftEntriesForCurrentBoard.length === 0) return;

    // Arrival and departure time is NOT applicable when saving Holiday records
    const allUnsavedAreHoliday = unsavedDraftEntriesForCurrentBoard.every(
      (rec) => draftAttendance[getDraftKey(rec.id, boardMode)]?.status === 'Holiday'
    );

    if (!allUnsavedAreHoliday && !isRouteMarkedHoliday) {
      if (boardMode === 'arrival' && !isArrivalTimeMarked) {
        setTripInTime((prev) => prev || getCurrentSystemTimeHHMM());
        setTimeRequiredPrompt({
          mode: 'arrival',
          pendingAction: { type: 'save_batch' },
        });
        return;
      }
      if (boardMode === 'departure' && !isDepartureTimeMarked) {
        setTripOutTime((prev) => prev || getCurrentSystemTimeHHMM());
        setTimeRequiredPrompt({
          mode: 'departure',
          pendingAction: { type: 'save_batch' },
        });
        return;
      }
    }

    await executeSaveAttendanceBatch(boardMode);
  };

  const checkRequiresEarlyArrivalConfirmation = (
    rec: TripAttendanceRecord,
    statusVal: string
  ): { student: StudentMember; expectedReturnDate: string } | null => {
    if (statusVal !== 'Present') return null;
    const stu = students.find((s) => s.id === rec.studentId);
    if (!stu) return null;
    const tentativeDate = getActiveTentativeReturnDateForStudent(rec.studentId, selectedDate);
    if (tentativeDate) {
      return { student: stu, expectedReturnDate: tentativeDate };
    }
    return null;
  };

  const handleAttendanceButtonClick = (
    rec: TripAttendanceRecord,
    mode: 'arrival' | 'departure',
    newStatus: string
  ) => {
    // Ignore accidental tap if finger slid/scrolled across the screen
    if (touchMovedRef.current) {
      touchMovedRef.current = false;
      return;
    }

    const savedStatus = getSavedStatusForMode(rec, mode);
    const currentEffective =
      mode === 'arrival' ? getEffectiveArrivalStatus(rec) : getEffectiveDepartureStatus(rec);

    // If tapping the already-selected status:
    if (currentEffective === newStatus) {
      // If it was an unsaved draft selection on a Pending record, allow toggling back to Pending
      if (savedStatus === 'Pending') {
        setDraftAttendance((prev) => {
          const next = { ...prev };
          delete next[getDraftKey(rec.id, mode)];
          return next;
        });
      }
      return;
    }

    // If user had modified a saved record in draft and taps the original saved status, revert draft for this row
    if (savedStatus !== 'Pending' && newStatus === savedStatus) {
      setDraftAttendance((prev) => {
        const next = { ...prev };
        delete next[getDraftKey(rec.id, mode)];
        return next;
      });
      return;
    }

    // Arrival / Departure Time is NOT applicable in case of Holiday
    if (newStatus !== 'Holiday') {
      if (mode === 'arrival' && !isArrivalTimeMarked) {
        setTripInTime((prev) => prev || getCurrentSystemTimeHHMM());
        setTimeRequiredPrompt({
          mode: 'arrival',
          pendingAction: { type: 'single', rec, statusVal: newStatus },
        });
        return;
      }
      if (mode === 'departure' && !isDepartureTimeMarked) {
        setTripOutTime((prev) => prev || getCurrentSystemTimeHHMM());
        setTimeRequiredPrompt({
          mode: 'departure',
          pendingAction: { type: 'single', rec, statusVal: newStatus },
        });
        return;
      }
    }

    // If member has a Tentative Date of Arrival and user changes from Leave to Present, show Early Arrival popup directly
    const earlyInfo = checkRequiresEarlyArrivalConfirmation(rec, newStatus);
    if (earlyInfo && (currentEffective === 'Leave' || savedStatus === 'Leave' || savedStatus === 'Pending')) {
      setEarlyArrivalModal({
        student: earlyInfo.student,
        record: rec,
        mode,
        expectedReturnDate: earlyInfo.expectedReturnDate,
        remarks: `Arrived early on ${selectedDate} (Tentative Date: ${earlyInfo.expectedReturnDate})`,
      });
      return;
    }

    // Check if this record is ALREADY SAVED (finalized)
    if (savedStatus !== 'Pending') {
      if (!isAdmin) {
        setLockedRecordModal({
          studentName: rec.studentName,
          admissionNo: rec.admissionNo,
          savedStatus,
          mode,
          rec,
          attemptedNewStatus: newStatus,
        });
        return;
      }

      // Admin trying to change a saved record -> Prompt confirmation with Yes/Continue or Back/Discard
      setSavedRecordChangeModal({
        mode,
        actionType: 'single',
        rec,
        savedStatus,
        newStatus,
      });
      return;
    }

    proceedWithAttendanceSelectionAfterSavedCheck(rec, mode, newStatus);
  };

  const handleConfirmSavedRecordChange = () => {
    if (!savedRecordChangeModal) return;
    const { mode, actionType, rec, newStatus } = savedRecordChangeModal;
    setSavedRecordChangeModal(null);

    if (actionType === 'all_holiday') {
      applyAllHolidayToDraft(mode, true);
      return;
    }

    if (actionType === 'single' && rec && newStatus) {
      proceedWithAttendanceSelectionAfterSavedCheck(rec, mode, newStatus);
    }
  };

  const handleDiscardSavedRecordChange = () => {
    if (savedRecordChangeModal?.actionType === 'single' && savedRecordChangeModal.rec) {
      const key = getDraftKey(savedRecordChangeModal.rec.id, savedRecordChangeModal.mode);
      setDraftAttendance((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    setSavedRecordChangeModal(null);
  };

  const handleConfirmEarlyArrivalAndMarkPresent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!earlyArrivalModal) return;
    setIsConfirmingEarlyArrival(true);
    try {
      const { student, record, mode, remarks } = earlyArrivalModal;
      const cleanRemarks = remarks.trim() || `Confirmed early arrival on ${selectedDate}`;
      stageSingleDraftAttendance(record, mode, 'Present', {
        reason: cleanRemarks,
        earlyArrivalConfirmed: true,
        earlyArrivalRemarks: cleanRemarks,
      });
      setStatusFeedback(
        `Marked ${student.name} (${student.admissionNo}) as Present in draft (Early Arrival confirmed). Click "Save Attendance" to finalize.`
      );
      setEarlyArrivalModal(null);
      setTimeout(() => setStatusFeedback(null), 4000);
    } finally {
      setIsConfirmingEarlyArrival(false);
    }
  };

  const handleConfirmMismatchDeparture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mismatchPopup) return;
    const cleanReason = mismatchPopup.reason.trim();
    if (cleanReason.length < 3) {
      setMismatchError('Please enter a reason / remark for the mismatch between Arrival and Departure attendance.');
      return;
    }
    const targetRec = tripAttendanceList.find((r) => r.id === mismatchPopup.recordId);
    if (targetRec) {
      stageSingleDraftAttendance(targetRec, 'departure', mismatchPopup.departureStatus, {
        reason: cleanReason,
      });
    }
    setStatusFeedback(
      `Marked Departure Attendance (${mismatchPopup.departureStatus}) in draft for ${mismatchPopup.studentName} with remark. Click "Save Attendance" to finalize.`
    );
    setMismatchPopup(null);
    setMismatchError(null);
    setTimeout(() => setStatusFeedback(null), 4000);
  };

  const handleMarkTripArrivalOrDeparture = async (mode: 'Arrived' | 'Departed') => {
    if (!currentTrip) return;
    const nowTime = getCurrentSystemTimeHHMM();
    const effectiveIn = mode === 'Arrived' ? (tripInTime || nowTime) : (effectiveInTime || currentTrip.inTime);
    const effectiveOut = mode === 'Departed' ? (tripOutTime || nowTime) : (effectiveOutTime || currentTrip.outTime);

    // Immediately record timing in optimistic local state (0ms) so the popup never re-triggers
    const currentKey = `${selectedRouteObj?.id || currentTrip.routeId || ''}:${selectedDate}`;
    setLocalMarkedTripTimings((prev) => ({
      ...prev,
      [currentKey]: {
        inTime: mode === 'Arrived' ? effectiveIn : prev[currentKey]?.inTime || effectiveInTime,
        outTime: mode === 'Departed' ? effectiveOut : prev[currentKey]?.outTime || effectiveOutTime,
        status: mode,
      },
    }));

    const inStrPayload =
      mode === 'Arrived'
        ? arrivalMarkedRecordsCount > 0
          ? arrivalPresentStrength
          : undefined
        : currentTrip.inStrength;
    const outStrPayload =
      mode === 'Departed'
        ? departureMarkedRecordsCount > 0
          ? departurePresentStrength
          : undefined
        : currentTrip.outStrength;

    const note =
      mode === 'Arrived'
        ? `Arrived at ${effectiveIn}${inStrPayload !== undefined ? ` (In Strength: ${inStrPayload})` : ''}`
        : `Departed at ${effectiveOut}${outStrPayload !== undefined ? ` (Out Strength: ${outStrPayload})` : ''}`;

    setStatusFeedback(
      mode === 'Arrived'
        ? `✓ ${currentTrip.vehicleNumber} (${currentTrip.routeName}) Arrival Time marked as ${effectiveIn}. Mark attendance and click "Save Attendance" to finalize.`
        : `✓ ${currentTrip.vehicleNumber} (${currentTrip.routeName}) Departure Time marked as ${effectiveOut}. Mark attendance and click "Save Attendance" to finalize.`
    );
    setTimeout(() => setStatusFeedback(null), 3500);

    try {
      await onVerifyTrip(currentTrip.id, note, mode, {
        inTime: mode === 'Arrived' ? effectiveIn : undefined,
        outTime: mode === 'Departed' ? effectiveOut : undefined,
        inStrength: inStrPayload,
        outStrength: outStrPayload,
      });
    } catch (err: any) {
      console.error('Trip timing verify error:', err);
    }
  };

  const handleConfirmMarkTimeFromPrompt = async () => {
    if (!timeRequiredPrompt || !currentTrip) return;
    const promptMode = timeRequiredPrompt.mode;
    const mode = promptMode === 'arrival' ? 'Arrived' : 'Departed';
    const pending = timeRequiredPrompt.pendingAction;
    const nowTime = getCurrentSystemTimeHHMM();
    const effectiveIn = mode === 'Arrived' ? (tripInTime || nowTime) : (effectiveInTime || currentTrip.inTime);
    const effectiveOut = mode === 'Departed' ? (tripOutTime || nowTime) : (effectiveOutTime || currentTrip.outTime);

    // 1. Close prompt & mark arrival/departure time in local state synchronously (0ms)
    const currentKey = `${selectedRouteObj?.id || currentTrip.routeId || ''}:${selectedDate}`;
    setLocalMarkedTripTimings((prev) => ({
      ...prev,
      [currentKey]: {
        inTime: mode === 'Arrived' ? effectiveIn : prev[currentKey]?.inTime || effectiveInTime,
        outTime: mode === 'Departed' ? effectiveOut : prev[currentKey]?.outTime || effectiveOutTime,
        status: mode,
      },
    }));
    setTimeRequiredPrompt(null);

    // 2. Immediately apply any pending draft selection so user experiences zero lag
    if (pending && pending.type !== 'save_batch') {
      if (pending.type === 'all_holiday') {
        const alreadySavedNonHoliday = tripAttendanceList.filter((rec) => {
          const savedSt = getSavedStatusForMode(rec, promptMode);
          return savedSt !== 'Pending' && savedSt !== 'Holiday';
        });
        if (alreadySavedNonHoliday.length > 0 && isAdmin) {
          setSavedRecordChangeModal({
            mode: promptMode,
            actionType: 'all_holiday',
            affectedCount: alreadySavedNonHoliday.length,
            newStatus: 'Holiday',
          });
        } else {
          applyAllHolidayToDraft(promptMode, isAdmin);
        }
      } else if (pending.type === 'mark_pending_present') {
        setDraftAttendance((prev) => {
          const next = { ...prev };
          for (const rec of tripAttendanceList) {
            const savedSt = getSavedStatusForMode(rec, promptMode);
            const key = getDraftKey(rec.id, promptMode);
            if (savedSt === 'Pending' && !next[key]) {
              next[key] = { status: 'Present' };
            }
          }
          return next;
        });
      } else if (pending.type === 'single' && pending.rec && pending.statusVal) {
        const savedSt = getSavedStatusForMode(pending.rec, promptMode);
        if (savedSt !== 'Pending') {
          if (!isAdmin) {
            setLockedRecordModal({
              studentName: pending.rec.studentName,
              admissionNo: pending.rec.admissionNo,
              savedStatus: savedSt,
              mode: promptMode,
            });
          } else {
            setSavedRecordChangeModal({
              mode: promptMode,
              actionType: 'single',
              rec: pending.rec,
              savedStatus: savedSt,
              newStatus: pending.statusVal,
            });
          }
        } else {
          proceedWithAttendanceSelectionAfterSavedCheck(pending.rec, promptMode, pending.statusVal);
        }
      }
      // Persist trip timing in background without blocking student attendance taps
      void handleMarkTripArrivalOrDeparture(mode);
      return;
    }

    // If pending action was save_batch, verify trip timing and then save batch
    await handleMarkTripArrivalOrDeparture(mode);
    if (pending?.type === 'save_batch') {
      await executeSaveAttendanceBatch(promptMode);
    }
  };

  // =========================================================================
  // CALL ABSENTEES SUB-MODULE STATE & COMPUTED DATA
  // =========================================================================
  const [absenteeDate, setAbsenteeDate] = useState<string>(todayStr);
  const [absenteeCampusFilter, setAbsenteeCampusFilter] = useState<string>(lockedCampus || 'all');
  const [absenteeRouteFilter, setAbsenteeRouteFilter] = useState<string>('all');
  const [absenteeSearch, setAbsenteeSearch] = useState<string>('');
  const [activeAbsenteeListTab, setActiveAbsenteeListTab] = useState<'main_calling' | 'escalation_3days' | 'scheduled_return'>('main_calling');

  useEffect(() => {
    if (lockedCampus) {
      setAbsenteeCampusFilter(lockedCampus);
      setSelectedCampus(lockedCampus);
    }
  }, [lockedCampus]);

  const [callModalTarget, setCallModalTarget] = useState<{
    student: StudentMember;
    consecutiveDaysAbsent: number;
    attendanceRemarks: string;
    existingCall?: AbsenteeCallRecord;
  } | null>(null);
  const [callStatusInput, setCallStatusInput] = useState<AbsenteeCallRecord['callStatus']>('Answered - Will Return on Date');
  const [callAssistantRemarksInput, setCallAssistantRemarksInput] = useState<string>('');
  const [callCoordinatorRemarksInput, setCallCoordinatorRemarksInput] = useState<string>('');
  const [callExpectedReturnDateInput, setCallExpectedReturnDateInput] = useState<string>('');
  const [callExpectedReturnReasonInput, setCallExpectedReturnReasonInput] = useState<string>('');
  const [isSavingCall, setIsSavingCall] = useState<boolean>(false);
  const [callSaveError, setCallSaveError] = useState<string | null>(null);
  const [directCallStudentId, setDirectCallStudentId] = useState<string>('');

  // Compute consecutive days absent and daily absentee status for all active members
  const enrichedAbsenteeItems = React.useMemo(() => {
    const activeMembers = students.filter((s) => s.transportStatus !== 'Left');

    return activeMembers
      .map((s) => {
        const stuCampus = s.campus || (s.routeCode?.toLowerCase().startsWith('jr') ? 'Jr' : 'Sr');
        // Attendance records for this student on absenteeDate
        const dayAttRecs = attendanceRecords.filter(
          (a) =>
            (a.studentId === s.id || (s.admissionNo && a.admissionNo === s.admissionNo)) &&
            a.date === absenteeDate
        );
        const isMarkedAbsentToday = dayAttRecs.some(
          (a) =>
            a.driverStatus === 'Absent' ||
            a.assistantStatus === 'Absent' ||
            a.finalStatus === 'Absent' ||
            a.driverStatus === 'Leave' ||
            a.assistantStatus === 'Leave'
        );
        const isMarkedPresentToday = dayAttRecs.some(
          (a) =>
            a.driverStatus === 'Present' ||
            a.assistantStatus === 'Present' ||
            a.finalStatus === 'Present'
        );

        const existingCallToday = absenteeCalls.find(
          (c) =>
            (c.studentId === s.id || (s.admissionNo && c.admissionNo === s.admissionNo)) &&
            c.date === absenteeDate
        );
        const latestCallAnyDate = [...absenteeCalls]
          .filter((c) => c.studentId === s.id || (s.admissionNo && c.admissionNo === s.admissionNo))
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];

        // Compute consecutive days absent backwards from absenteeDate
        const stuAllAtt = attendanceRecords
          .filter(
            (a) =>
              (a.studentId === s.id || (s.admissionNo && a.admissionNo === s.admissionNo)) &&
              (a.date || '') <= absenteeDate
          )
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const distinctDates = Array.from(new Set(stuAllAtt.map((a) => a.date).filter(Boolean))) as string[];
        let streak = 0;
        for (const dt of distinctDates) {
          const recsOnDt = stuAllAtt.filter((a) => a.date === dt);
          const presOnDt = recsOnDt.some(
            (a) => a.driverStatus === 'Present' || a.assistantStatus === 'Present'
          );
          const absOnDt = recsOnDt.some(
            (a) =>
              a.driverStatus === 'Absent' ||
              a.assistantStatus === 'Absent' ||
              a.driverStatus === 'Leave' ||
              a.assistantStatus === 'Leave'
          );
          if (presOnDt) break;
          if (absOnDt) streak += 1;
        }

        if (isMarkedAbsentToday && streak === 0) streak = 1;
        const effectiveExpectedReturn =
          s.expectedReturnDate ||
          existingCallToday?.expectedReturnDate ||
          latestCallAnyDate?.expectedReturnDate ||
          '';
        const effectiveExpectedReason =
          s.expectedReturnReason ||
          existingCallToday?.expectedReturnReason ||
          latestCallAnyDate?.expectedReturnReason ||
          '';

        // If student has an expected return date or call log, ensure streak reflects it
        const consecutiveDaysAbsent = Math.max(
          streak,
          existingCallToday?.consecutiveDaysAbsent || existingCallToday?.consecutiveAbsentDays || 0,
          (isMarkedAbsentToday || Boolean(effectiveExpectedReturn)) ? (s.absentDaysCount || 1) : 0
        );

        const attendanceRemarks =
          dayAttRecs
            .map((a) => a.resolutionReason || a.notes)
            .filter(Boolean)
            .join('; ') ||
          existingCallToday?.attendanceRemarks ||
          '';

        const assistantRemarks =
          existingCallToday?.assistantRemarks ||
          s.lastAbsentAssistantRemark ||
          latestCallAnyDate?.assistantRemarks ||
          '';

        const coordinatorRemarks =
          existingCallToday?.coordinatorRemarks ||
          s.lastAbsentCoordinatorRemark ||
          latestCallAnyDate?.coordinatorRemarks ||
          '';

        // Categorize:
        // 1. Is in Scheduled Return / Tentative Date of Arrival list? (expectedReturnDate > absenteeDate AND not marked Present today)
        const isInScheduledReturnList = Boolean(
          effectiveExpectedReturn &&
            absenteeDate < effectiveExpectedReturn &&
            !isMarkedPresentToday
        );

        // 2. Did NOT arrive on or after Expected Date of Arrival? (expectedReturnDate <= absenteeDate AND not marked Present today)
        const isOverdueOrDueTodayReturn = Boolean(
          effectiveExpectedReturn &&
            absenteeDate >= effectiveExpectedReturn &&
            !isMarkedPresentToday
        );

        // 3. Arrived Early before Expected Date of Arrival? (expectedReturnDate > absenteeDate AND marked Present today)
        const isEarlyArrivalToday = Boolean(
          effectiveExpectedReturn &&
            absenteeDate < effectiveExpectedReturn &&
            isMarkedPresentToday
        );

        // Should appear in Absentee Module today if:
        // - Marked Absent today, OR
        // - Has an absentee call logged today, OR
        // - Has an active expectedReturnDate (either scheduled return, overdue return, or early arrival today), OR
        // - Consecutive days absent >= 3 and not marked Present today
        const isRelevantAbsentee =
          (!isMarkedPresentToday &&
            (isMarkedAbsentToday ||
              Boolean(existingCallToday) ||
              Boolean(effectiveExpectedReturn) ||
              (s.absentDaysCount || 0) >= 3)) ||
          isEarlyArrivalToday;

        return {
          student: s,
          campus: stuCampus,
          isMarkedAbsentToday,
          isMarkedPresentToday,
          consecutiveDaysAbsent: Math.max(consecutiveDaysAbsent, isRelevantAbsentee && !isMarkedPresentToday ? 1 : 0),
          attendanceRemarks,
          assistantRemarks,
          coordinatorRemarks,
          expectedReturnDate: effectiveExpectedReturn,
          expectedReturnReason: effectiveExpectedReason,
          existingCallToday,
          latestCallAnyDate,
          isInScheduledReturnList,
          isOverdueOrDueTodayReturn,
          isEarlyArrivalToday,
          isRelevantAbsentee,
          isCalledToday: Boolean(
            existingCallToday &&
              existingCallToday.status !== 'Pending Call' &&
              existingCallToday.callStatus !== 'Pending'
          ),
        };
      })
      .filter((item) => item.isRelevantAbsentee);
  }, [students, attendanceRecords, absenteeCalls, absenteeDate]);

  // Filter by Campus, Route, Search
  const filteredAbsenteeItems = React.useMemo(() => {
    return enrichedAbsenteeItems.filter((item) => {
      if (lockedCampus && item.campus.toLowerCase() !== lockedCampus.toLowerCase()) {
        return false;
      }
      if (
        absenteeCampusFilter !== 'all' &&
        item.campus.toLowerCase() !== absenteeCampusFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        absenteeRouteFilter !== 'all' &&
        item.student.routeId !== absenteeRouteFilter &&
        item.student.routeCode !== absenteeRouteFilter
      ) {
        return false;
      }
      if (absenteeSearch.trim()) {
        const q = absenteeSearch.toLowerCase().trim();
        const match =
          (item.student.name || '').toLowerCase().includes(q) ||
          (item.student.admissionNo || '').toLowerCase().includes(q) ||
          (item.student.fatherName || '').toLowerCase().includes(q) ||
          (item.student.mobile || '').toLowerCase().includes(q) ||
          (item.student.routeCode || '').toLowerCase().includes(q) ||
          (item.student.pickupDropStopName || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [enrichedAbsenteeItems, lockedCampus, absenteeCampusFilter, absenteeRouteFilter, absenteeSearch]);

  // 1. Main Absentee Calling List (excludes students who are currently in Scheduled Return with future expectedReturnDate > absenteeDate, UNLESS they are due/overdue on expectedReturnDate)
  const mainCallingQueue = React.useMemo(
    () =>
      filteredAbsenteeItems
        .filter((i) => !i.isInScheduledReturnList && !i.isEarlyArrivalToday)
        .sort((a, b) => {
          // Overdue expected return first, then highest consecutive days absent
          if (a.isOverdueOrDueTodayReturn !== b.isOverdueOrDueTodayReturn) {
            return a.isOverdueOrDueTodayReturn ? -1 : 1;
          }
          return b.consecutiveDaysAbsent - a.consecutiveDaysAbsent;
        }),
    [filteredAbsenteeItems]
  );

  // 2. > 3 Consecutive Days Absent Escalation Queue (Across Both Campuses for Transport Coordinator & Admin; Campus-scoped for Assistant)
  const escalationMoreThan3DaysQueue = React.useMemo(
    () =>
      filteredAbsenteeItems
        .filter((i) => i.consecutiveDaysAbsent > 3 && !i.isMarkedPresentToday)
        .sort((a, b) => b.consecutiveDaysAbsent - a.consecutiveDaysAbsent),
    [filteredAbsenteeItems]
  );

  // 3. Scheduled Return / Tentative Date of Arrival List (Informed Leave — Do Not Disturb Until Expected Date)
  const scheduledReturnQueue = React.useMemo(
    () =>
      filteredAbsenteeItems
        .filter((i) => i.isInScheduledReturnList)
        .sort((a, b) => (a.expectedReturnDate || '').localeCompare(b.expectedReturnDate || '')),
    [filteredAbsenteeItems]
  );

  // 4. Early Arrivals Detected Today (arrived before expectedReturnDate)
  const earlyArrivalsTodayList = React.useMemo(
    () => filteredAbsenteeItems.filter((i) => i.isEarlyArrivalToday),
    [filteredAbsenteeItems]
  );

  const openAbsenteeCallModal = (item: (typeof enrichedAbsenteeItems)[number]) => {
    setCallSaveError(null);
    setCallModalTarget({
      student: item.student,
      consecutiveDaysAbsent: item.consecutiveDaysAbsent,
      attendanceRemarks: item.attendanceRemarks,
      existingCall: item.existingCallToday,
    });
    setCallStatusInput(
      item.existingCallToday?.callStatus && item.existingCallToday.callStatus !== 'Pending'
        ? item.existingCallToday.callStatus
        : 'Answered - Will Return on Date'
    );
    setCallAssistantRemarksInput(item.assistantRemarks || '');
    setCallCoordinatorRemarksInput(item.coordinatorRemarks || '');
    setCallExpectedReturnDateInput(item.expectedReturnDate || '');
    setCallExpectedReturnReasonInput(item.expectedReturnReason || '');
  };

  const openDirectStudentCallModal = (studentId: string) => {
    const existingItem = enrichedAbsenteeItems.find((i) => i.student.id === studentId);
    if (existingItem) {
      openAbsenteeCallModal(existingItem);
      return;
    }
    const stu = students.find((s) => s.id === studentId);
    if (!stu) return;
    const existingCallToday = absenteeCalls.find(
      (c) =>
        (c.studentId === stu.id || (stu.admissionNo && c.admissionNo === stu.admissionNo)) &&
        c.date === absenteeDate
    );
    setCallSaveError(null);
    setCallModalTarget({
      student: stu,
      consecutiveDaysAbsent: Math.max(stu.absentDaysCount || 1, 1),
      attendanceRemarks: existingCallToday?.attendanceRemarks || '',
      existingCall: existingCallToday,
    });
    setCallStatusInput(
      existingCallToday?.callStatus && existingCallToday.callStatus !== 'Pending'
        ? existingCallToday.callStatus
        : 'Answered - Will Return on Date'
    );
    setCallAssistantRemarksInput(existingCallToday?.assistantRemarks || stu.lastAbsentAssistantRemark || '');
    setCallCoordinatorRemarksInput(existingCallToday?.coordinatorRemarks || stu.lastAbsentCoordinatorRemark || '');
    setCallExpectedReturnDateInput(existingCallToday?.expectedReturnDate || stu.expectedReturnDate || '');
    setCallExpectedReturnReasonInput(existingCallToday?.expectedReturnReason || stu.expectedReturnReason || '');
  };

  const handleSaveAbsenteeCallForm = async (e: React.FormEvent, clearExpectedReturn = false) => {
    e.preventDefault();
    if (!callModalTarget || !onSaveAbsenteeCall) return;
    setIsSavingCall(true);
    setCallSaveError(null);
    try {
      const stu = callModalTarget.student;
      const stuCampus = stu.campus || (stu.routeCode?.toLowerCase().startsWith('jr') ? 'Jr' : 'Sr');
      const trimmedAsst = callAssistantRemarksInput.trim();
      const trimmedCoord = callCoordinatorRemarksInput.trim();
      const isCoordOrAdminCaller =
        currentRole === 'Transport Coordinator' || currentRole === 'Admin' || isCoordinator || isAdmin;

      // If Transport Coordinator or Admin calls directly and types into either box (or selects callStatus), ensure coordinatorRemarks is saved
      const effectiveCoordRemarks = isCoordOrAdminCaller
        ? trimmedCoord || trimmedAsst || `${callStatusInput}${callExpectedReturnReasonInput.trim() ? ` - ${callExpectedReturnReasonInput.trim()}` : ''}`
        : trimmedCoord;
      const effectiveAsstRemarks = !isCoordOrAdminCaller
        ? trimmedAsst || `${callStatusInput}${callExpectedReturnReasonInput.trim() ? ` - ${callExpectedReturnReasonInput.trim()}` : ''}`
        : trimmedAsst;

      const callerDisplayName =
        currentRole === 'Transport Coordinator'
          ? 'Transport Coordinator'
          : currentRole === 'Transport Assistant'
          ? `Transport Assistant (${stuCampus})`
          : 'Transport Admin';

      await onSaveAbsenteeCall({
        studentId: stu.id,
        admissionNo: stu.admissionNo,
        studentName: stu.name,
        campus: stuCampus,
        className: stu.class,
        section: stu.section,
        routeId: stu.routeId,
        routeCode: stu.routeCode,
        stopName: stu.pickupDropStopName || stu.villageName,
        parentName: stu.fatherName,
        phone: stu.mobile || stu.whatsappNo,
        date: absenteeDate,
        consecutiveDaysAbsent: callModalTarget.consecutiveDaysAbsent,
        consecutiveAbsentDays: callModalTarget.consecutiveDaysAbsent,
        callStatus: callStatusInput,
        calledByRole: currentRole,
        callerRole: currentRole,
        calledByName: callerDisplayName,
        callerName: callerDisplayName,
        calledBy: callerDisplayName,
        assistantRemarks: effectiveAsstRemarks,
        coordinatorRemarks: effectiveCoordRemarks,
        attendanceRemarks: callModalTarget.attendanceRemarks,
        expectedReturnDate: clearExpectedReturn ? '' : callExpectedReturnDateInput,
        expectedReturnReason: clearExpectedReturn ? '' : callExpectedReturnReasonInput.trim(),
        clearExpectedReturn,
      });

      setStatusFeedback(
        clearExpectedReturn
          ? `Cleared Tentative Date of Arrival for ${stu.name} and saved call follow-up.`
          : callExpectedReturnDateInput && callExpectedReturnDateInput > absenteeDate
          ? `Saved follow-up for ${stu.name}. Moved to "Scheduled Return (Tentative Date: ${callExpectedReturnDateInput})" list so parents are not repeatedly called.`
          : `Saved Absentee Parent Call & Remarks for ${stu.name} (${stu.admissionNo}).`
      );
      setCallModalTarget(null);
      setTimeout(() => setStatusFeedback(null), 4500);
    } catch (err: any) {
      setCallSaveError(err?.message || 'Unable to save absentee calling remarks. Please try again.');
    } finally {
      setIsSavingCall(false);
    }
  };

  // --- Print Route List State ---
  const [packVehicleFilter, setPackVehicleFilter] = useState<string>('all');
  const [packRouteId, setPackRouteId] = useState<string>(routes[0]?.id || '');
  const [packWeekStart, setPackWeekStart] = useState<string>(todayStr);
  const [packWeekEnd, setPackWeekEnd] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });

  const filteredPackRoutes = routes.filter((r) => {
    if (lockedCampus && !routeHasMembersForCampus(r, lockedCampus)) return false;
    if (
      packVehicleFilter !== 'all' &&
      r.vehicleId !== packVehicleFilter &&
      r.vehicleNumber !== packVehicleFilter &&
      r.vehicleLast4 !== packVehicleFilter
    ) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (
      filteredPackRoutes.length > 0 &&
      !filteredPackRoutes.some((r) => r.id === packRouteId)
    ) {
      setPackRouteId(filteredPackRoutes[0].id);
    }
  }, [routes, packVehicleFilter, packRouteId, lockedCampus]);

  const handleStartCalendarChange = (val: string) => {
    setPackWeekStart(val);
    if (val) {
      const endD = new Date(val);
      endD.setDate(endD.getDate() + 5);
      setPackWeekEnd(endD.toISOString().split('T')[0]);
    }
  };

  const getCampusLabel = (codeOrId: string) => {
    if (!codeOrId) return '—';
    const found = campuses.find(
      (c) => c.code === codeOrId || c.id === codeOrId || c.name === codeOrId
    );
    return found ? `${found.name} (${found.code})` : codeOrId;
  };

  const getSelectedWeekDates = (): string[] => {
    const result: string[] = [];
    if (!packWeekStart) return result;
    const cur = new Date(packWeekStart);
    const end = packWeekEnd ? new Date(packWeekEnd) : new Date(packWeekStart);
    let count = 0;
    while (cur <= end && count < 7) {
      result.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
      count++;
    }
    if (result.length === 0) result.push(packWeekStart);
    return result;
  };

  const weekDates = getSelectedWeekDates();
  const selectedPackRoute =
    filteredPackRoutes.find((r) => r.id === packRouteId) ||
    routes.find((r) => r.id === packRouteId) ||
    filteredPackRoutes[0] ||
    routes[0];
  const routeRosterMembers = getMembersForRoute(selectedPackRoute);

  const handlePrintRouteList = () => {
    if (selectedPackRoute) {
      onOpenPrintPack(
        selectedPackRoute.id,
        `Trip ${selectedPackRoute.tripNumber || 1}`,
        packWeekStart,
        packWeekEnd
      ).catch(() => {});
    }

    const escapeHtml = (val: string | number | undefined | null): string => {
      if (val === undefined || val === null) return '';
      return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    const routeTitle = selectedPackRoute
      ? `Route Member List: ${selectedPackRoute.code} — ${selectedPackRoute.name}`
      : 'Route Member List';

    const subtitleText = selectedPackRoute
      ? `Vehicle: ${selectedPackRoute.vehicleNumber || '—'} • Trip ${selectedPackRoute.tripNumber || 1} • Campus: ${getCampusLabel(selectedPackRoute.campus || '')}`
      : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(routeTitle)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 14px;
      font-size: 11px;
      background: #fff;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .school-name {
      font-size: 16px;
      font-weight: 800;
      text-transform: uppercase;
      color: #334155;
      margin-bottom: 2px;
    }
    .report-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 4px 0;
    }
    .sub-meta {
      font-size: 11px;
      color: #475569;
    }
    .right-meta {
      text-align: right;
      font-size: 11px;
      color: #334155;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: middle;
    }
    th {
      background-color: #f1f5f9;
      font-weight: 700;
      font-size: 10px;
      color: #334155;
    }
    .suspended-row td {
      background-color: #fff1f2;
      color: #dc2626;
    }
    .dp-img {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      object-fit: cover;
      border: 1px solid #cbd5e1;
      display: block;
      margin: 0 auto;
    }
    .dp-fallback {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: #e2e8f0;
      color: #334155;
      font-weight: 700;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      text-align: center;
      line-height: 28px;
    }
    .badge-active {
      background: #d1fae5;
      color: #065f46;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 9px;
      display: inline-block;
    }
    .badge-suspended {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 9px;
      display: inline-block;
    }
    .footer {
      margin-top: 18px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #475569;
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${schoolName ? `<div class="school-name">${escapeHtml(schoolName)}</div>` : ''}
      <div class="report-title">${escapeHtml(routeTitle)}</div>
      <div class="sub-meta">
        Vehicle: <strong>${escapeHtml(selectedPackRoute?.vehicleNumber || '—')}</strong> •
        Trip: <strong>Trip ${escapeHtml(selectedPackRoute?.tripNumber || 1)}</strong> •
        Campus: <strong>${escapeHtml(getCampusLabel(selectedPackRoute?.campus || ''))}</strong>
        ${selectedPackRoute?.driverName ? ` • Driver: <strong>${escapeHtml(selectedPackRoute.driverName)}</strong>` : ''}
        ${selectedPackRoute?.assistantName ? ` • Assistant: <strong>${escapeHtml(selectedPackRoute.assistantName)}</strong>` : ''}
      </div>
    </div>
    <div class="right-meta">
      <div>Period: <strong>${escapeHtml(packWeekStart)}</strong> to <strong>${escapeHtml(packWeekEnd)}</strong></div>
      <div style="margin-top:3px;font-weight:700;">Total Members: ${routeRosterMembers.length}</div>
      <div style="font-size:9px;color:#64748b;margin-top:2px;">Printed: ${new Date().toLocaleString()}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:28px;text-align:center;">#</th>
        <th style="width:38px;text-align:center;">DP</th>
        <th>Member Name &amp; ID</th>
        <th>Type / Class</th>
        <th>Pickup &amp; Drop Stop</th>
        <th>Status</th>
        ${weekDates
          .map(
            (dt) =>
              `<th style="text-align:center;font-family:monospace;font-size:10px;">
                <div>${escapeHtml(dt)}</div>
                <div style="font-size:8px;color:#64748b;font-weight:normal;">IN / OUT</div>
              </th>`
          )
          .join('')}
      </tr>
    </thead>
    <tbody>
      ${
        routeRosterMembers.length === 0
          ? `<tr><td colspan="${6 + weekDates.length}" style="text-align:center;padding:24px;color:#94a3b8;">No active or suspended members on this route.</td></tr>`
          : routeRosterMembers
              .map((m, idx) => {
                const isSuspended = m.transportStatus === 'Suspended';
                const dpCell = m.profilePhoto
                  ? `<img src="${escapeHtml(m.profilePhoto)}" alt="${escapeHtml(m.name)}" class="dp-img" />`
                  : `<div class="dp-fallback">${escapeHtml(m.name.slice(0, 2).toUpperCase())}</div>`;
                return `<tr class="${isSuspended ? 'suspended-row' : ''}">
                  <td style="text-align:center;font-family:monospace;">${idx + 1}</td>
                  <td style="text-align:center;">${dpCell}</td>
                  <td>
                    <div style="font-weight:700;">${escapeHtml(m.name)}</div>
                    <div style="font-size:9px;font-family:monospace;color:${isSuspended ? '#ef4444' : '#64748b'};">${escapeHtml(m.admissionNo)}</div>
                  </td>
                  <td>${escapeHtml(m.memberType)} (${escapeHtml(m.class)}-${escapeHtml(m.section)})</td>
                  <td>${escapeHtml(m.pickupDropStopName)} (${escapeHtml(m.villageName)})</td>
                  <td>
                    <span class="${isSuspended ? 'badge-suspended' : 'badge-active'}">${escapeHtml(m.transportStatus)}</span>
                  </td>
                  ${weekDates
                    .map(
                      () =>
                        `<td style="text-align:center;font-size:11px;color:${isSuspended ? '#dc2626' : '#64748b'};font-weight:${isSuspended ? '700' : '400'};">
                          ${isSuspended ? 'SUSPENDED' : '☐ / ☐'}
                        </td>`
                    )
                    .join('')}
                </tr>`;
              })
              .join('')
      }
    </tbody>
  </table>
  <div class="footer">
    <div>Driver Signature: _______________________</div>
    <div>Bus Assistant Signature: _______________________</div>
    <div>Transport Incharge: _______________________</div>
  </div>
</body>
</html>`;

    openHtmlPrintPreview({
      title: routeTitle,
      subtitle: `${subtitleText} • Period: ${packWeekStart} to ${packWeekEnd} (${routeRosterMembers.length} members)`,
      html,
      filename: `route_list_${selectedPackRoute?.code || 'route'}_${packWeekStart}`,
    });
  };

  const handleExportRouteListCsv = () => {
    const cols = [
      { header: 'S.No', accessor: (_: StudentMember, i: number) => i + 1 },
      { header: 'Member Name', accessor: (m: StudentMember) => m.name },
      { header: 'Admission / Staff ID', accessor: (m: StudentMember) => m.admissionNo },
      { header: 'Gender', accessor: (m: StudentMember) => m.gender },
      { header: 'Type / Class', accessor: (m: StudentMember) => `${m.memberType} (${m.class}-${m.section})` },
      { header: 'Pickup & Drop Stop', accessor: (m: StudentMember) => `${m.pickupDropStopName} (${m.villageName})` },
      { header: 'Mobile', accessor: (m: StudentMember) => m.mobile },
      { header: 'Status', accessor: (m: StudentMember) => m.transportStatus },
      ...weekDates.map((dt) => ({
        header: `${dt} (IN / OUT)`,
        accessor: (m: StudentMember) => (m.transportStatus === 'Suspended' ? 'SUSPENDED' : '[ ] / [ ]'),
      })),
    ];
    exportToCsv(
      `route_member_list_${selectedPackRoute?.code || 'route'}_${packWeekStart}`,
      cols,
      routeRosterMembers
    );
  };

  // --- Transport Timings & Attendance Summary Sheet Rows (per Vehicle, 1st & 2nd Trip, Campus-Aware) ---
  const targetSummaryCampus = lockedCampus || normalizeCampusCode(summaryCampus);
  const summaryCampusDisplayLabel = targetSummaryCampus
    ? getCampusLabel(targetSummaryCampus)
    : 'All Campuses';

  const studentCampusByIdMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) {
      map.set(s.id, getStudentCampusCode(s));
    }
    return map;
  }, [students]);

  const filteredSummaryVehicles = vehicles.filter((veh) => {
    if (!targetSummaryCampus) return true;
    const vehRoutes = routes.filter(
      (r) => r.vehicleId === veh.id || r.vehicleNumber === veh.registrationNumber
    );
    const hasRouteForCampus = vehRoutes.some((r) =>
      routeHasMembersForCampus(r, targetSummaryCampus)
    );
    if (hasRouteForCampus) return true;
    const vehTripsForDate = trips.filter(
      (t) =>
        (t.vehicleId === veh.id || t.vehicleNumber === veh.registrationNumber) &&
        (!summaryDate || t.date === summaryDate)
    );
    return vehTripsForDate.some(
      (t) => normalizeCampusCode(t.campus) === targetSummaryCampus
    );
  });

  const summaryRows = filteredSummaryVehicles.map((veh, idx) => {
    const vehTrips = trips.filter(
      (t) =>
        (t.vehicleId === veh.id || t.vehicleNumber === veh.registrationNumber) &&
        (!summaryDate || t.date === summaryDate)
    );
    const vehRoutes = routes.filter(
      (r) => r.vehicleId === veh.id || r.vehicleNumber === veh.registrationNumber
    );

    const doesTripMatchSummaryCampus = (t: DailyTrip): boolean => {
      if (!targetSummaryCampus) return true;
      if (normalizeCampusCode(t.campus) === targetSummaryCampus) return true;
      const matchedRoute = vehRoutes.find(
        (r) => r.id === t.routeId || r.code === t.routeName
      );
      if (matchedRoute && routeHasMembersForCampus(matchedRoute, targetSummaryCampus)) {
        return true;
      }
      return attendanceRecords.some(
        (a) =>
          a.tripId === t.id &&
          studentCampusByIdMap.get(a.studentId) === targetSummaryCampus
      );
    };

    const campusMatchingTrips = vehTrips.filter(doesTripMatchSummaryCampus);
    const trip1 =
      campusMatchingTrips.find((t) => t.tripNumber === 1) ||
      (campusMatchingTrips.length === 1 && campusMatchingTrips[0].tripNumber !== 2
        ? campusMatchingTrips[0]
        : undefined);
    const trip2 = campusMatchingTrips.find((t) => t.tripNumber === 2);

    const getTripSummaryStats = (t: DailyTrip | undefined) => {
      if (!t) {
        return { inTime: '', inStr: '', outTime: '', outStr: '', remark: '' };
      }
      const rawTripAtts = attendanceRecords.filter(
        (a) => a.tripId === t.id && (!summaryDate || a.date === summaryDate)
      );
      const tAtts = targetSummaryCampus
        ? rawTripAtts.filter(
            (a) => studentCampusByIdMap.get(a.studentId) === targetSummaryCampus
          )
        : rawTripAtts;

      const hasArrAtt = tAtts.some((a) => a.driverStatus && a.driverStatus !== 'Pending');
      const arrPres = tAtts.filter((a) => a.driverStatus === 'Present').length;
      const hasDepAtt = tAtts.some((a) => a.assistantStatus && a.assistantStatus !== 'Pending');
      const depPres = tAtts.filter((a) => a.assistantStatus === 'Present').length;

      const tripNativeMatchesCampus =
        !targetSummaryCampus || normalizeCampusCode(t.campus) === targetSummaryCampus;

      // Arrival (In) Time & Strength only from Arrival (scoped to selected campus when campus filter is active)
      const inTime = t.inTime || '';
      const inStr = hasArrAtt
        ? String(arrPres).padStart(2, '0')
        : t.inTime && t.inStrength !== undefined && tripNativeMatchesCampus
        ? String(t.inStrength).padStart(2, '0')
        : '';

      // Departure (Out) Time & Strength strictly from Departure
      const outTime = t.outTime || '';
      const outStr = hasDepAtt
        ? String(depPres).padStart(2, '0')
        : t.outTime && t.outStrength !== undefined && hasDepAtt && tripNativeMatchesCampus
        ? String(t.outStrength).padStart(2, '0')
        : '';

      const memberRemarks = tAtts
        .filter(
          (a) =>
            a.driverStatus &&
            a.driverStatus !== 'Pending' &&
            a.assistantStatus &&
            a.assistantStatus !== 'Pending' &&
            a.driverStatus !== a.assistantStatus &&
            (a.resolutionReason || a.notes)
        )
        .map((a) => `${a.studentName.split(' ')[0]}: ${a.resolutionReason || a.notes}`)
        .join('; ');

      const rawRemark =
        (tripNativeMatchesCampus ? t.strengthMismatchRemark : '') || memberRemarks || '';
      return {
        inTime,
        inStr,
        outTime,
        outStr,
        remark: summarizeRemarkForTable(rawRemark, 26),
        fullRemark: rawRemark,
      };
    };

    const stats1 = getTripSummaryStats(trip1);
    const stats2 = getTripSummaryStats(trip2);
    const overrideKey = `${veh.id}:${targetSummaryCampus || 'ALL'}`;
    const ov = timingOverrides[overrideKey] || timingOverrides[veh.id] || {};

    return {
      sl: idx + 1,
      vehicleId: veh.id,
      overrideKey,
      vehicleLabel: veh.nickname ? `${veh.nickname} (${veh.registrationNumber.slice(-4)})` : veh.registrationNumber,
      registrationNumber: veh.registrationNumber,
      driverName: veh.assignedDriverName || trip1?.driverName || trip2?.driverName || '—',
      inTime1: ov.inTime1 !== undefined ? ov.inTime1 : stats1.inTime,
      inStrength1: ov.inStrength1 !== undefined ? ov.inStrength1 : stats1.inStr,
      outTime1: ov.outTime1 !== undefined ? ov.outTime1 : stats1.outTime,
      outStrength1: ov.outStrength1 !== undefined ? ov.outStrength1 : stats1.outStr,
      remark1: ov.remark1 !== undefined ? ov.remark1 : stats1.remark,
      fullRemark1: stats1.fullRemark || stats1.remark,
      inTime2: ov.inTime2 !== undefined ? ov.inTime2 : stats2.inTime,
      inStrength2: ov.inStrength2 !== undefined ? ov.inStrength2 : stats2.inStr,
      outTime2: ov.outTime2 !== undefined ? ov.outTime2 : stats2.outTime,
      outStrength2: ov.outStrength2 !== undefined ? ov.outStrength2 : stats2.outStr,
      remark2: ov.remark2 !== undefined ? ov.remark2 : stats2.remark,
      fullRemark2: stats2.fullRemark || stats2.remark,
    };
  });

  const autoCombinedSummaryRemarks = summaryRows
    .flatMap((r) => {
      const items: string[] = [];
      if (r.remark1) items.push(`${r.registrationNumber}(1st): ${r.remark1}`);
      if (r.remark2) items.push(`${r.registrationNumber}(2nd): ${r.remark2}`);
      return items;
    })
    .join(' | ');

  const updateOverride = (vehId: string, field: keyof SummaryTimingOverride, val: string) => {
    setTimingOverrides((prev) => ({
      ...prev,
      [vehId]: {
        ...(prev[vehId] || {}),
        [field]: val,
      },
    }));
  };

  const handlePrintSummarySheet = () => {
    const rowsHtml = summaryRows
      .map(
        (r) => `
        <tr>
          <td rowspan="2" style="text-align:center;font-weight:700;">${r.sl}</td>
          <td rowspan="2" style="font-weight:700;">${r.vehicleLabel}<br/><span style="font-size:10px;font-weight:400;">${r.registrationNumber}</span></td>
          <td rowspan="2">${r.driverName}</td>
          <td style="text-align:center;font-weight:600;">1 St</td>
          <td style="text-align:center;">${r.inTime1 || '—'}</td>
          <td style="text-align:center;">${r.inStrength1 || '—'}</td>
          <td style="text-align:center;">${r.outTime1 || '—'}</td>
          <td style="text-align:center;">${r.outStrength1 || '—'}</td>
          <td style="font-size:10px;max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${summarizeRemarkForTable(r.remark1, 26) || '—'}</td>
        </tr>
        <tr>
          <td style="text-align:center;font-weight:600;">2nd</td>
          <td style="text-align:center;">${r.inTime2 || '—'}</td>
          <td style="text-align:center;">${r.inStrength2 || '—'}</td>
          <td style="text-align:center;">${r.outTime2 || '—'}</td>
          <td style="text-align:center;">${r.outStrength2 || '—'}</td>
          <td style="font-size:10px;max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${summarizeRemarkForTable(r.remark2, 26) || '—'}</td>
        </tr>`
      )
      .join('');

    const effectiveFooterRemark = summaryRemarks || autoCombinedSummaryRemarks || '—';

    const html = `<!DOCTYPE html>
      <html>
        <head>
          <title>Transport Timings - ${schoolName || 'Narendra Edu Valley'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; border: 2px solid #0f172a; font-size: 12px; table-layout: fixed; }
            th, td { border: 1px solid #0f172a; padding: 6px 8px; overflow: hidden; text-overflow: ellipsis; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <table>
            <thead>
              <tr><th colspan="9" style="font-size:22px;font-weight:800;text-align:center;padding:10px;">${schoolName || 'Narendra Edu Valley'}</th></tr>
              <tr><th colspan="9" style="font-size:12px;text-transform:uppercase;text-align:center;background:#f8fafc;">Transport Timings & Attendance Summary</th></tr>
              <tr>
                <th colspan="5" style="text-align:left;">Campus : ${summaryCampusDisplayLabel}</th>
                <th colspan="4" style="text-align:left;">Date :- ${formattedSummaryDate}</th>
              </tr>
              <tr style="background:#f1f5f9;">
                <th style="width:36px;">Sl</th><th style="width:110px;">Vehicle</th><th style="width:120px;">Driver</th><th style="width:52px;">Trip</th><th style="width:74px;">In Time</th><th style="width:68px;">Strength</th><th style="width:74px;">Out Time</th><th style="width:68px;">Strength</th><th style="width:135px;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr><td colspan="5"><strong>Campus Incharge:</strong> ${campusInchargeName || '________________'}</td><td colspan="4"><strong>Filled By:</strong> ${filledByName || '________________'}</td></tr>
              <tr><td colspan="5" style="padding:14px 8px;">Signature:</td><td colspan="4" style="padding:14px 8px;">Signature:</td></tr>
              <tr><td colspan="9" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong>Remarks:</strong> ${summarizeRemarkForTable(effectiveFooterRemark, 110)}</td></tr>
            </tbody>
          </table>
        </body>
      </html>`;

    openHtmlPrintPreview({
      title: `Transport Timings & Attendance Summary — ${formattedSummaryDate}`,
      subtitle: `Campus: ${summaryCampusDisplayLabel} • Vehicles: ${summaryRows.length}`,
      html,
    });
  };

  const formattedSummaryDate = summaryDate
    ? summaryDate.split('-').reverse().join('/')
    : '';

  return (
    <div className="space-y-5">
      {/* Unified Header & Toolbar (Scoped strictly to active Sidebar screen) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {activeSubView === 'unmarked_mismatch'
              ? '3- Unmarked & Mismatch Attendance Report'
              : activeSubView === 'mark_holiday'
              ? '4- Mark Route Holiday'
              : activeSubView === 'pack'
              ? 'Print Route List'
              : activeSubView === 'summary'
              ? '7- Attendance Summary Sheet'
              : activeSubView === 'calendar'
              ? '6- Monthly Calendar (P/A/L/H)'
              : activeSubView === 'call_absentees'
              ? '5- Call Absentees (Follow-up)'
              : boardMode === 'departure'
              ? '2- Departure Attendance (School Dispersal)'
              : '1- Arrival Attendance (Morning Pickup)'}
          </h2>
          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            {activeSubView === 'board' && `${tripAttendanceList.length} Members`}
            {activeSubView === 'unmarked_mismatch' && `Attendance Audit`}
            {activeSubView === 'mark_holiday' && `Route Holiday`}
            {activeSubView === 'calendar' && `${routes.length} Routes`}
            {activeSubView === 'summary' && `${summaryRows.length} Vehicles`}
            {activeSubView === 'pack' && `Route Sheet`}
            {activeSubView === 'call_absentees' &&
              `${mainCallingQueue.length} To Call • ${scheduledReturnQueue.length} Scheduled Return`}
          </span>
          {lockedCampus && (
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Campus Scoped: {lockedCampus} Campus
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeSubView === 'board' && (
            <>
              <FilterPopover
                activeCount={
                  (selectedCampus !== 'all' ? 1 : 0) +
                  (selectedVehicleFilter !== 'all' ? 1 : 0)
                }
                onReset={() => {
                  setSelectedCampus(lockedCampus || 'all');
                  setSelectedVehicleFilter('all');
                }}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Campus
                  </label>
                  <select
                    value={selectedCampus}
                    disabled={Boolean(lockedCampus)}
                    onChange={(e) => setSelectedCampus(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 disabled:opacity-60"
                  >
                    {!lockedCampus && <option value="all">All Campuses</option>}
                    {campuses
                      .filter((c) => !lockedCampus || c.code.toLowerCase() === lockedCampus.toLowerCase())
                      .map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Vehicle
                  </label>
                  <select
                    value={selectedVehicleFilter}
                    onChange={(e) => setSelectedVehicleFilter(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-900"
                  >
                    <option value="all">All Vehicles ({vehicles.length})</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.registrationNumber}>
                        {v.registrationNumber} — {v.assignedDriverName || v.type}
                      </option>
                    ))}
                  </select>
                </div>
              </FilterPopover>

              <PrintExportToolbar
                title={`${boardMode === 'departure' ? 'Departure Attendance' : 'Arrival Attendance'} — ${currentTrip?.routeName || selectedRouteObj?.code || 'Route'}`}
                filename={boardMode === 'departure' ? 'departure_attendance' : 'arrival_attendance'}
                schoolName={schoolName}
                filteredData={tripAttendanceList}
                allData={tripAttendanceList}
                hasActiveFilters={true}
                filterSummary={`Date: ${selectedDate} | Vehicle: ${currentTrip?.vehicleNumber || selectedRouteObj?.vehicleNumber || 'All'} | Route: ${currentTrip?.routeName || selectedRouteObj?.code || 'All'}`}
                columns={
                  boardMode === 'departure'
                    ? [
                        { header: 'ID / Adm No', accessor: (r) => r.admissionNo },
                        { header: 'Member Name', accessor: (r) => r.studentName },
                        { header: 'Class / Dept', accessor: (r) => r.classSection },
                        { header: 'Transport Stop', accessor: (r) => r.stopName },
                        { header: 'Arrival Status', accessor: (r) => r.driverStatus || 'Pending' },
                        { header: 'Departure Status', accessor: (r) => r.assistantStatus || 'Pending' },
                        { header: 'Mismatch Remark', accessor: (r) => r.resolutionReason || r.notes || '—' },
                      ]
                    : [
                        { header: 'ID / Adm No', accessor: (r) => r.admissionNo },
                        { header: 'Member Name', accessor: (r) => r.studentName },
                        { header: 'Class / Dept', accessor: (r) => r.classSection },
                        { header: 'Transport Stop', accessor: (r) => r.stopName },
                        { header: 'Status', accessor: (r) => r.transportStatus },
                        { header: 'Arrival Attendance', accessor: (r) => r.driverStatus || 'Pending' },
                      ]
                }
              />
            </>
          )}

          {activeSubView === 'calendar' && (
            <>
              <input
                type="month"
                value={calendarMonth}
                onChange={(e) => setCalendarMonth(e.target.value)}
                className="p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-800"
                title="Select Attendance Month"
              />
              <select
                value={selectedRouteObj?.id || ''}
                onChange={(e) => handleRouteDropdownChange(e.target.value)}
                className="p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
              >
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name} ({r.vehicleNumber})
                  </option>
                ))}
              </select>

              <PrintExportToolbar
                title={`Monthly Attendance Register (${calendarMonth}) — ${selectedRouteObj?.code || 'Route'}`}
                filename={`monthly_attendance_${calendarMonth}`}
                schoolName={schoolName}
                filteredData={boardRouteMembers}
                allData={students}
                columns={[
                  { header: 'Admission No', accessor: (s) => s.admissionNo },
                  { header: 'Member Name', accessor: (s) => s.name },
                  { header: 'Class', accessor: (s) => `${s.class}-${s.section}` },
                  { header: 'Stop', accessor: (s) => s.pickupDropStopName || s.morningStopName || '' },
                  { header: 'Route', accessor: (s) => s.routeCode || '' },
                  { header: 'Status', accessor: (s) => s.transportStatus },
                ]}
              />
            </>
          )}

          {activeSubView === 'summary' && (
            <>
              <PrintExportToolbar
                title={`Transport Timings Summary (${formattedSummaryDate})`}
                filename="transport_timings_summary"
                schoolName={schoolName}
                filteredData={summaryRows}
                allData={summaryRows}
                columns={[
                  { header: 'Sl', accessor: (r) => r.sl },
                  { header: 'Vehicle', accessor: (r) => r.registrationNumber },
                  { header: 'Driver', accessor: (r) => r.driverName },
                  { header: '1st In Time', accessor: (r) => r.inTime1 || '—' },
                  { header: '1st In Str', accessor: (r) => r.inStrength1 || '—' },
                  { header: '1st Out Time', accessor: (r) => r.outTime1 || '—' },
                  { header: '1st Out Str', accessor: (r) => r.outStrength1 || '—' },
                  { header: '2nd In Time', accessor: (r) => r.inTime2 || '—' },
                  { header: '2nd Out Time', accessor: (r) => r.outTime2 || '—' },
                ]}
              />
              <button
                type="button"
                onClick={handlePrintSummarySheet}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Clipboard Sheet</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-VIEW 1: SCHOOL ARRIVAL & DEPARTURE ATTENDANCE (CLEAN & NEAT)      */}
      {/* ===================================================================== */}
      {activeSubView === 'board' && (
        <div className="space-y-4">
          {statusFeedback && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{statusFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusFeedback(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Filter & Action Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase">
                    Date
                  </label>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isAdmin
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {isAdmin ? 'Admin: Full Edit' : `${currentRole}: Mark Unmarked Only`}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="date"
                    value={selectedDate}
                    max={todayStr}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      handleDateChange(nextDate);
                    }}
                    className="text-xs font-bold bg-transparent text-slate-800 focus:outline-hidden w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Campus
                </label>
                <select
                  value={lockedCampus || selectedCampus}
                  disabled={Boolean(lockedCampus)}
                  onChange={(e) => {
                    if (lockedCampus) return;
                    setSelectedCampus(e.target.value);
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 disabled:opacity-80"
                >
                  {!lockedCampus && <option value="all">All Campuses</option>}
                  {campuses
                    .filter((c) => !lockedCampus || c.code === lockedCampus)
                    .map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Vehicle
                </label>
                <select
                  value={selectedVehicleFilter}
                  onChange={(e) => setSelectedVehicleFilter(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-900"
                >
                  <option value="all">All Vehicles ({vehicles.length})</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.registrationNumber}>
                      {v.registrationNumber} — {v.assignedDriverName || v.type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Route ({availableRoutesForDropdown.length})
                </label>
                <select
                  value={selectedRouteObj?.id || ''}
                  onChange={(e) => handleRouteDropdownChange(e.target.value)}
                  className="w-full p-2.5 border border-slate-900 rounded-xl text-xs font-bold bg-slate-900 text-white"
                >
                  {availableRoutesForDropdown.length === 0 ? (
                    <option value="">No routes for selected vehicle</option>
                  ) : (
                    availableRoutesForDropdown.map((r) => {
                      const isCrossCampusRoute =
                        Boolean(activeCampusFilterCode) &&
                        normalizeCampusCode(r.campus) !== activeCampusFilterCode;
                      const campusMemberCount = activeCampusFilterCode
                        ? getMembersForRoute(r, activeCampusFilterCode).length
                        : getAllMembersForRouteRaw(r).length;
                      return (
                        <option key={r.id} value={r.id}>
                          {r.code} — {r.name || `Trip ${r.tripNumber}`} ({r.vehicleNumber})
                          {isCrossCampusRoute
                            ? ` • [${campusMemberCount} ${activeCampusFilterCode} Campus Member${
                                campusMemberCount === 1 ? '' : 's'
                              }]`
                            : ` • (${campusMemberCount} Members)`}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
            </div>

            {selectedRouteObj &&
              activeCampusFilterCode &&
              normalizeCampusCode(selectedRouteObj.campus) !== activeCampusFilterCode && (
                <div className="px-3.5 py-2 rounded-xl bg-violet-50 border border-violet-200 text-violet-900 text-xs font-semibold flex items-center justify-between gap-2">
                  <span>
                    Cross-Campus Route Notice: Route <strong>{selectedRouteObj.code}</strong> is assigned to{' '}
                    <strong>{selectedRouteObj.campus}</strong> Campus, but carries{' '}
                    <strong>
                      {boardRouteMembers.length} {activeCampusFilterCode} Campus member(s)
                    </strong>
                    . Only {activeCampusFilterCode} Campus members are visible and allowed for attendance marking here.
                  </span>
                </div>
              )}

            {currentTrip && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 font-mono font-bold">
                    {currentTrip.routeName}
                  </span>
                  <span className="font-semibold text-slate-700">
                    Vehicle: <strong className="font-mono">{currentTrip.vehicleNumber}</strong>
                  </span>
                  <span className="text-slate-600">
                    Driver: <strong className="text-slate-900">{currentTrip.driverName}</strong>
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      currentTrip.status === 'Arrived'
                        ? 'bg-emerald-100 text-emerald-800'
                        : currentTrip.status === 'Departed' || currentTrip.status === 'Completed'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {currentTrip.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isRouteMarkedHoliday ? (
                    <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                      Holiday (H) — Arrival &amp; Departure Time Not Applicable
                    </span>
                  ) : boardMode === 'arrival' ? (
                    <>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          isArrivalTimeMarked
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-900 border-amber-300'
                        }`}
                      >
                        {isArrivalTimeMarked
                          ? `✓ Arrival Time: ${effectiveInTime}`
                          : '⚠ Mark Arrival Time First'}
                      </span>
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Arrival (In) Time:</span>
                        <input
                          type="time"
                          value={tripInTime}
                          onChange={(e) => setTripInTime(e.target.value)}
                          className="font-mono font-bold text-slate-800 bg-transparent focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setTripInTime(getCurrentSystemTimeHHMM())}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer ml-1"
                          title="Auto-select current system time"
                        >
                          Now
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMarkTripArrivalOrDeparture('Arrived')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-2xs"
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        <span>{isArrivalTimeMarked ? 'Update Arrival Time' : 'Mark Arrival'}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          isDepartureTimeMarked
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : 'bg-amber-50 text-amber-900 border-amber-300'
                        }`}
                      >
                        {isDepartureTimeMarked
                          ? `✓ Departure Time: ${effectiveOutTime}`
                          : '⚠ Mark Departure Time First'}
                      </span>
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-xs">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Departure (Out) Time:</span>
                        <input
                          type="time"
                          value={tripOutTime}
                          onChange={(e) => setTripOutTime(e.target.value)}
                          className="font-mono font-bold text-slate-800 bg-transparent focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setTripOutTime(getCurrentSystemTimeHHMM())}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer ml-1"
                          title="Auto-select current system time"
                        >
                          Now
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMarkTripArrivalOrDeparture('Departed')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-2xs"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>{isDepartureTimeMarked ? 'Update Departure Time' : 'Mark Departure'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Compact Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-2xs flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Route Strength</span>
              <span className="text-lg font-bold text-slate-900">{tripAttendanceList.length}</span>
            </div>
            <div className="bg-emerald-50/70 rounded-xl border border-emerald-200 px-4 py-3 shadow-2xs flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800">Present (P)</span>
              <span className="text-lg font-bold text-emerald-700">{presentCount}</span>
            </div>
            <div className="bg-rose-50/70 rounded-xl border border-rose-200 px-4 py-3 shadow-2xs flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-800">Absent (A)</span>
              <span className="text-lg font-bold text-rose-700">{absentCount}</span>
            </div>
            <div className="bg-amber-50/70 rounded-xl border border-amber-200 px-4 py-3 shadow-2xs flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-900">Leave (L)</span>
              <span className="text-lg font-bold text-amber-700">{leaveCount}</span>
            </div>
            <div className="bg-indigo-50/70 rounded-xl border border-indigo-200 px-4 py-3 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-indigo-900 block">Holiday (H): {holidayCount}</span>
                <button
                  type="button"
                  onClick={handleMarkAllHoliday}
                  className="text-[10px] font-bold text-indigo-700 underline hover:text-indigo-900 cursor-pointer"
                >
                  Mark All Holiday (H)
                </button>
              </div>
              <span className="text-xs font-mono text-slate-500">Pend: {pendingCount}</span>
            </div>
          </div>

          {/* In vs Out Strength & Mismatch Remark Bar in Attendance Window */}
          <div
            className={`rounded-2xl border p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs ${
              hasStrengthMismatchOnBoard
                ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-semibold">
                Arrival (In):{' '}
                <strong className="font-mono text-emerald-700">
                  {isRouteMarkedHoliday ? 'N/A (Holiday)' : effectiveInTime || '—'}
                </strong>{' '}
                • Strength:{' '}
                <strong className="font-mono text-slate-900">
                  {isRouteMarkedHoliday
                    ? '00'
                    : arrivalMarkedRecordsCount > 0
                    ? String(arrivalPresentStrength).padStart(2, '0')
                    : '—'}
                </strong>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-semibold">
                Departure (Out):{' '}
                <strong className="font-mono text-indigo-700">
                  {isRouteMarkedHoliday ? 'N/A (Holiday)' : effectiveOutTime || '—'}
                </strong>{' '}
                • Strength:{' '}
                <strong className="font-mono text-slate-900">
                  {isRouteMarkedHoliday
                    ? '00'
                    : departureMarkedRecordsCount > 0
                    ? String(departurePresentStrength).padStart(2, '0')
                    : '—'}
                </strong>
              </div>
              {hasStrengthMismatchOnBoard && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-200 text-amber-950 font-bold text-[11px]">
                  ⚠ Strength Mismatch (In: {String(arrivalPresentStrength).padStart(2, '0')} vs Out:{' '}
                  {String(departurePresentStrength).padStart(2, '0')})
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
              <input
                type="text"
                maxLength={80}
                value={tripMismatchRemarkInput}
                onChange={(e) => setTripMismatchRemarkInput(e.target.value)}
                placeholder={
                  autoDerivedMismatchSummary
                    ? `Summary: ${autoDerivedMismatchSummary}`
                    : 'Write Strength Mismatch / Trip Remark (reflected in Transport Timings)...'
                }
                className="flex-1 min-w-[220px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={handleSaveTripStrengthRemark}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs cursor-pointer shrink-0"
              >
                Save Remark
              </button>
            </div>
          </div>

          {/* Save & Finalize Attendance Action Bar (Top) */}
          <div
            className={`rounded-2xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
              unsavedDraftEntriesForCurrentBoard.length > 0
                ? 'bg-amber-50 border-amber-300 shadow-xs'
                : savedRecordsOnCurrentBoardCount > 0 &&
                  savedRecordsOnCurrentBoardCount === tripAttendanceList.length
                ? 'bg-emerald-50/80 border-emerald-200'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {unsavedDraftEntriesForCurrentBoard.length > 0 ? (
                <>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black uppercase tracking-wide text-[11px]">
                    ● {unsavedDraftEntriesForCurrentBoard.length} Unsaved
                  </span>
                  <span className="font-semibold text-amber-950">
                    Click <strong>Save Attendance</strong> to finalize.
                  </span>
                </>
              ) : savedRecordsOnCurrentBoardCount > 0 ? (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>
                    Saved: {savedRecordsOnCurrentBoardCount}/{tripAttendanceList.length} Finalized
                  </span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 font-bold text-[11px]">
                  Not Saved Yet
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkPendingAsPresentInDraft}
                  className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs cursor-pointer transition-colors"
                >
                  Mark Pending ({pendingCount}) as Present
                </button>
              )}
              {unsavedDraftEntriesForCurrentBoard.length > 0 && (
                <button
                  type="button"
                  disabled={isSavingAttendanceBatch}
                  onClick={handleDiscardDraftAttendance}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  Back / Discard ({unsavedDraftEntriesForCurrentBoard.length})
                </button>
              )}
              <button
                type="button"
                disabled={unsavedDraftEntriesForCurrentBoard.length === 0 || isSavingAttendanceBatch}
                onClick={handleSaveAttendanceClick}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                  unsavedDraftEntriesForCurrentBoard.length > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSavingAttendanceBatch
                    ? 'Saving Attendance...'
                    : unsavedDraftEntriesForCurrentBoard.length > 0
                    ? `Save Attendance (${unsavedDraftEntriesForCurrentBoard.length})`
                    : 'Save Attendance'}
                </span>
              </button>
            </div>
          </div>

          {/* Clean Attendance Table — Separate for Arrival vs Departure */}
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden"
            onTouchStart={handleAttendanceTouchStart}
            onTouchMove={handleAttendanceTouchMove}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-3">Class / Dept</th>
                    <th className="py-3 px-3">Transport Stop</th>
                    <th className="py-3 px-3">Status</th>
                    {boardMode === 'departure' && (
                      <th className="py-3 px-3">Arrival Attendance</th>
                    )}
                    <th className="py-3 px-4 text-right">
                      {boardMode === 'departure'
                        ? 'Mark Departure Attendance (P / A / L / H)'
                        : 'Mark Arrival Attendance (P / A / L / H)'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingRouteTrip ? (
                    <tr>
                      <td colSpan={boardMode === 'departure' ? 6 : 5} className="py-8 text-center text-slate-400">
                        Loading route members...
                      </td>
                    </tr>
                  ) : tripAttendanceList.length === 0 ? (
                    <tr>
                      <td colSpan={boardMode === 'departure' ? 6 : 5} className="py-8 text-center text-slate-400">
                        No members assigned to this route.
                      </td>
                    </tr>
                  ) : (
                    tripAttendanceList.map((rec) => {
                      const stuObj = students.find((s) => s.id === rec.studentId);
                      const isSuspended = rec.transportStatus === 'Suspended';
                      const savedStatus = getSavedStatusForMode(rec, boardMode);
                      const isRecordSaved = savedStatus !== 'Pending';
                      const draftEntry = draftAttendance[getDraftKey(rec.id, boardMode)];
                      const isDraftModified = Boolean(
                        draftEntry && draftEntry.status && draftEntry.status !== savedStatus
                      );
                      const effArrStatus = getEffectiveArrivalStatus(rec);
                      const effDepStatus = getEffectiveDepartureStatus(rec);
                      const currentMarked = boardMode === 'arrival' ? effArrStatus : effDepStatus;
                      const hasMismatch =
                        boardMode === 'departure' &&
                        effArrStatus !== 'Pending' &&
                        effDepStatus !== 'Pending' &&
                        effArrStatus !== effDepStatus;
                      const remarkText =
                        draftAttendance[getDraftKey(rec.id, 'departure')]?.reason ||
                        rec.resolutionReason ||
                        rec.notes ||
                        '';

                      return (
                        <tr
                          key={rec.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isDraftModified
                              ? 'bg-amber-50/40'
                              : isSuspended
                              ? 'bg-rose-50/30'
                              : ''
                          }`}
                        >
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5">
                              {stuObj?.profilePhoto ? (
                                <img
                                  src={stuObj.profilePhoto}
                                  alt={rec.studentName}
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                                  {rec.studentName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div
                                  className={`font-bold flex items-center gap-1.5 flex-wrap ${
                                    isSuspended ? 'text-rose-600' : 'text-slate-900'
                                  }`}
                                >
                                  <span>{rec.studentName}</span>
                                  {isDraftModified ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300">
                                      {isRecordSaved
                                        ? `Unsaved Change (${savedStatus[0]}→${currentMarked[0]})`
                                        : 'Unsaved'}
                                    </span>
                                  ) : isRecordSaved ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      ✓ Saved
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500">
                                  {rec.admissionNo}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-700">
                            {rec.classSection}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{rec.stopName}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isSuspended
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {rec.transportStatus}
                            </span>
                          </td>

                          {/* Arrival Attendance Column (Shown on Departure Page) */}
                          {boardMode === 'departure' && (
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                  effArrStatus === 'Present'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : effArrStatus === 'Absent'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : effArrStatus === 'Leave'
                                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                                    : effArrStatus === 'Holiday'
                                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {effArrStatus === 'Pending' ? 'Not Marked' : `Arrival: ${effArrStatus}`}
                              </span>
                              {(hasMismatch || remarkText) && (
                                <div className="mt-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                  Remark: {remarkText || 'Mismatch noted'}
                                </div>
                              )}
                            </td>
                          )}

                          <td className="py-2.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              {(['Present', 'Absent', 'Leave', 'Holiday'] as const).map((stVal) => {
                                const shortCode = stVal[0];
                                const isSelected = currentMarked === stVal;
                                const isLockedForNonAdmin = isRecordSaved && !isAdmin && !isSelected;
                                const activeColor =
                                  stVal === 'Present'
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : stVal === 'Absent'
                                    ? 'bg-rose-600 text-white shadow-2xs'
                                    : stVal === 'Leave'
                                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                                    : 'bg-indigo-600 text-white shadow-2xs';
                                const hoverColor = isLockedForNonAdmin
                                  ? 'bg-slate-100 text-slate-400 opacity-60'
                                  : stVal === 'Present'
                                  ? 'bg-slate-100 hover:bg-emerald-50 text-slate-700'
                                  : stVal === 'Absent'
                                  ? 'bg-slate-100 hover:bg-rose-50 text-slate-700'
                                  : stVal === 'Leave'
                                  ? 'bg-slate-100 hover:bg-amber-50 text-slate-700'
                                  : 'bg-slate-100 hover:bg-indigo-50 text-slate-700';

                                return (
                                  <button
                                    key={stVal}
                                    type="button"
                                    onTouchStart={handleAttendanceTouchStart}
                                    onTouchMove={handleAttendanceTouchMove}
                                    onClick={() => handleAttendanceButtonClick(rec, boardMode, stVal)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors touch-manipulation select-none ${
                                      isSelected
                                        ? `${activeColor} ${
                                            isDraftModified ? 'ring-2 ring-amber-400 ring-offset-1' : ''
                                          }`
                                        : hoverColor
                                    }`}
                                  >
                                    <span>{shortCode} ({stVal})</span>
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Save Attendance Footer Bar */}
            {tripAttendanceList.length > 0 && (
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-600 font-medium">
                  {unsavedDraftEntriesForCurrentBoard.length > 0 ? (
                    <span className="text-amber-900 font-bold">
                      ● {unsavedDraftEntriesForCurrentBoard.length} member(s) marked in draft — press{' '}
                      <span className="underline">Save Attendance</span> to finalize.
                    </span>
                  ) : (
                    <span>
                      Saved &amp; Finalized: <strong>{savedRecordsOnCurrentBoardCount}</strong> of{' '}
                      <strong>{tripAttendanceList.length}</strong> member(s)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unsavedDraftEntriesForCurrentBoard.length > 0 && (
                    <button
                      type="button"
                      disabled={isSavingAttendanceBatch}
                      onClick={handleDiscardDraftAttendance}
                      className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      Back / Discard
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={unsavedDraftEntriesForCurrentBoard.length === 0 || isSavingAttendanceBatch}
                    onClick={handleSaveAttendanceClick}
                    className={`px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                      unsavedDraftEntriesForCurrentBoard.length > 0
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {isSavingAttendanceBatch
                        ? 'Saving Attendance...'
                        : unsavedDraftEntriesForCurrentBoard.length > 0
                        ? `Save Attendance (${unsavedDraftEntriesForCurrentBoard.length})`
                        : 'Save Attendance'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Floating Sticky Save Bar on Mobile / Scroll when Unsaved Changes Exist */}
          {unsavedDraftEntriesForCurrentBoard.length > 0 && (
            <div className="sticky bottom-3 z-20 bg-slate-900 text-white rounded-2xl border border-slate-700 shadow-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <div>
                  <div className="font-bold text-amber-300">
                    {unsavedDraftEntriesForCurrentBoard.length} Unsaved Attendance Selection(s)
                    {unsavedModifiedSavedRecordsCount > 0
                      ? ` • Changing ${unsavedModifiedSavedRecordsCount} Saved Record(s)`
                      : ''}
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Press <strong>Save Attendance</strong> to finalize or <strong>Back / Discard</strong> to cancel.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSavingAttendanceBatch}
                  onClick={handleDiscardDraftAttendance}
                  className="px-3.5 py-2 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                >
                  Back / Discard
                </button>
                <button
                  type="button"
                  disabled={isSavingAttendanceBatch}
                  onClick={handleSaveAttendanceClick}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSavingAttendanceBatch
                      ? 'Saving...'
                      : `Save Attendance (${unsavedDraftEntriesForCurrentBoard.length})`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Admin Confirmation Modal: "You are trying to change a saved record" */}
          {savedRecordChangeModal && (
            <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl border border-amber-300 shadow-2xl max-w-md w-full overflow-hidden">
                <div className="bg-amber-500 text-slate-950 px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-slate-950 shrink-0" />
                    <h3 className="text-sm font-black uppercase tracking-wide">
                      You are trying to change a saved record
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleDiscardSavedRecordChange}
                    className="text-slate-900 hover:text-slate-950 p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-amber-950">
                    <p className="font-bold text-sm text-slate-900">
                      You are trying to change a saved attendance record.
                    </p>
                    {savedRecordChangeModal.actionType === 'single' && savedRecordChangeModal.rec ? (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Member:</span>
                          <span className="font-bold text-slate-900">
                            {savedRecordChangeModal.rec.studentName} ({savedRecordChangeModal.rec.admissionNo})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Current Saved Record:</span>
                          <span className="font-bold text-emerald-800">
                            {savedRecordChangeModal.savedStatus}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">New Selected Status:</span>
                          <span className="font-bold text-rose-700">
                            {savedRecordChangeModal.newStatus}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-700">
                        <strong>{savedRecordChangeModal.affectedCount}</strong> member record(s) on this route
                        are already saved and finalized. Changing them to{' '}
                        <strong>{savedRecordChangeModal.newStatus}</strong> will modify saved records.
                      </p>
                    )}
                    <p className="pt-1 text-slate-700 font-medium">
                      Press <strong>Yes / Continue</strong> to continue with the changes (and click{' '}
                      <strong>Save Attendance</strong> to finalize), or press{' '}
                      <strong>Back / Discard</strong> to discard the changes.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleDiscardSavedRecordChange}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs cursor-pointer"
                    >
                      Back / Discard
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSavedRecordChange}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs cursor-pointer shadow-xs"
                    >
                      Yes / Continue
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Non-Admin Locked Record Modal (With Option to Send Change Request to Admin) */}
          {lockedRecordModal && (
            <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl border border-rose-200 shadow-2xl max-w-md w-full overflow-hidden">
                <div className="bg-rose-600 text-white px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-white shrink-0" />
                    <h3 className="text-sm font-black uppercase tracking-wide">
                      Saved Record Locked — Request Admin Change
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLockedRecordModal(null)}
                    className="text-white/80 hover:text-white p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1.5 text-rose-950">
                    <p className="font-bold text-sm">
                      Already-marked attendance cannot be changed directly by {currentRole}.
                    </p>
                    <p className="text-rose-900">
                      Attendance for <strong>{lockedRecordModal.studentName}</strong> (
                      {lockedRecordModal.admissionNo}) is already marked and saved as{' '}
                      <strong>{lockedRecordModal.savedStatus}</strong>. You can only mark unmarked
                      (Pending) members directly, or send a <strong>Change Request to Admin</strong>.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setLockedRecordModal(null)}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50"
                    >
                      Skip / Back
                    </button>
                    {lockedRecordModal.rec && onSubmitAttendanceChangeRequest && (
                      <button
                        type="button"
                        onClick={() => {
                          const r = lockedRecordModal.rec!;
                          const stu = students.find((s) => s.id === r.studentId);
                          const stuCampus: 'Sr' | 'Jr' =
                            getStudentCampusCode(stu || ({} as StudentMember)) === 'Jr'
                              ? 'Jr'
                              : 'Sr';
                          setChangeRequestModalTarget({
                            studentId: r.studentId,
                            studentName: r.studentName,
                            admissionNo: r.admissionNo,
                            classSection: r.classSection,
                            routeId: selectedRouteObj?.id || '',
                            routeCode: selectedRouteObj?.code || currentTrip?.routeName || '',
                            campus: stuCampus,
                            date: selectedDate,
                            tripId: r.tripId,
                            recordId: r.id,
                            currentArrivalStatus: r.driverStatus || 'Pending',
                            currentDepartureStatus: r.assistantStatus || 'Pending',
                            proposedArrivalStatus:
                              lockedRecordModal.mode === 'arrival'
                                ? ((lockedRecordModal.attemptedNewStatus as any) ||
                                    r.driverStatus ||
                                    'Present')
                                : r.driverStatus || 'Present',
                            proposedDepartureStatus:
                              lockedRecordModal.mode === 'departure'
                                ? ((lockedRecordModal.attemptedNewStatus as any) ||
                                    r.assistantStatus ||
                                    'Present')
                                : r.assistantStatus || 'Present',
                            reason: '',
                          });
                          setLockedRecordModal(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Request for Change to Admin</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mismatch Reason / Remark Popup Modal (When Departure Attendance != Arrival Attendance) */}
          {mismatchPopup && (
            <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Arrival &amp; Departure Attendance Mismatch
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Please mention the reason / remark for this attendance difference
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMismatchPopup(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Member:</span>
                    <span className="font-bold text-slate-900">
                      {mismatchPopup.studentName} ({mismatchPopup.admissionNo})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Morning Arrival Attendance:</span>
                    <span className="font-bold text-emerald-800">{mismatchPopup.arrivalStatus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Selected Departure Attendance:</span>
                    <span className="font-bold text-rose-700">{mismatchPopup.departureStatus}</span>
                  </div>
                </div>

                {mismatchError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                    {mismatchError}
                  </div>
                )}

                <form onSubmit={handleConfirmMismatchDeparture} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      Quick Select or Enter Reason / Remark *
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[
                        'Picked up by parent from school',
                        'Dropped by parent in morning, returning by bus',
                        'Left early with principal permission',
                        'Half-day / Medical leave',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setMismatchPopup((prev) =>
                              prev ? { ...prev, reason: preset } : prev
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                            mismatchPopup.reason === preset
                              ? 'bg-slate-900 text-amber-400 border-slate-900'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={3}
                      required
                      value={mismatchPopup.reason}
                      onChange={(e) =>
                        setMismatchPopup((prev) =>
                          prev ? { ...prev, reason: e.target.value } : prev
                        )
                      }
                      placeholder="Enter reason / remark why departure attendance differs from arrival..."
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setMismatchPopup(null)}
                      className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl cursor-pointer shadow-xs"
                    >
                      Save Remark &amp; Mark Departure
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Prompt Modal when trying to mark Arrival/Departure Attendance before marking Arrival/Departure Time */}
          {timeRequiredPrompt && (
            <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {timeRequiredPrompt.mode === 'arrival'
                        ? 'Mark Arrival Time First'
                        : 'Mark Departure Time First'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {timeRequiredPrompt.mode === 'arrival'
                        ? 'Arrival attendance cannot be marked without marking Arrival (In) Time first.'
                        : 'Departure attendance cannot be marked without marking Departure (Out) Time first.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTimeRequiredPrompt(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3 text-xs">
                  <p className="font-semibold text-amber-950">
                    Please confirm or adjust the auto-selected{' '}
                    {timeRequiredPrompt.mode === 'arrival' ? 'Arrival (In)' : 'Departure (Out)'}{' '}
                    time below to proceed:
                  </p>
                  <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-amber-300">
                    <span className="font-bold text-slate-700">
                      {timeRequiredPrompt.mode === 'arrival'
                        ? 'Arrival (In) Time:'
                        : 'Departure (Out) Time:'}
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={timeRequiredPrompt.mode === 'arrival' ? tripInTime : tripOutTime}
                        onChange={(e) => {
                          if (timeRequiredPrompt.mode === 'arrival') {
                            setTripInTime(e.target.value);
                          } else {
                            setTripOutTime(e.target.value);
                          }
                        }}
                        className="font-mono font-bold text-sm text-slate-900 bg-slate-50 px-2 py-1 rounded border border-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const now = getCurrentSystemTimeHHMM();
                          if (timeRequiredPrompt.mode === 'arrival') setTripInTime(now);
                          else setTripOutTime(now);
                        }}
                        className="text-[11px] font-bold text-indigo-600 underline cursor-pointer"
                      >
                        Current Time
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setTimeRequiredPrompt(null)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmMarkTimeFromPrompt}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl cursor-pointer shadow-xs"
                  >
                    {timeRequiredPrompt.mode === 'arrival'
                      ? `Mark Arrival (${tripInTime}) & Proceed`
                      : `Mark Departure (${tripOutTime}) & Proceed`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 1B: MONTHLY CALENDAR VIEW WITH P, A, L, H SHOWN              */}
      {/* ===================================================================== */}
      {activeSubView === 'calendar' && (() => {
        const [calYear, calMon] = (calendarMonth || todayStr.slice(0, 7)).split('-').map(Number);
        const daysInMonth = new Date(calYear || 2026, calMon || 10, 0).getDate() || 30;
        const dayNumbers = Array.from({ length: daysInMonth }, (_, idx) => idx + 1);

        return (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold">
                      <th className="py-2.5 px-3 sticky left-0 bg-slate-900 z-10">Member Name</th>
                      <th className="py-2.5 px-2">Stop</th>
                      {dayNumbers.map((dayNum) => (
                        <th key={dayNum} className="py-2.5 px-1.5 text-center font-mono">
                          {String(dayNum).padStart(2, '0')}
                        </th>
                      ))}
                      <th className="py-2.5 px-2 text-center bg-emerald-950 text-emerald-300">P</th>
                      <th className="py-2.5 px-2 text-center bg-rose-950 text-rose-300">A</th>
                      <th className="py-2.5 px-2 text-center bg-amber-950 text-amber-300">L</th>
                      <th className="py-2.5 px-2 text-center bg-indigo-950 text-indigo-300">H</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {boardRouteMembers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6 + dayNumbers.length}
                          className="py-8 text-center text-slate-400"
                        >
                          No members assigned to this route.
                        </td>
                      </tr>
                    ) : (
                      boardRouteMembers.map((stu) => {
                        let pCnt = 0;
                        let aCnt = 0;
                        let lCnt = 0;
                        let hCnt = 0;

                        const cells = dayNumbers.map((d) => {
                          const dateStr = `${calendarMonth}-${String(d).padStart(2, '0')}`;
                          const recForDay = attendanceRecords.find(
                            (r) =>
                              r.studentId === stu.id &&
                              (r.date === dateStr || (r.tripId && r.tripId.endsWith(`-${dateStr}`)))
                          );
                          const markedStatus =
                            recForDay?.resolvedStatus ||
                            (recForDay?.assistantStatus && recForDay.assistantStatus !== 'Pending'
                              ? recForDay.assistantStatus
                              : recForDay?.driverStatus && recForDay.driverStatus !== 'Pending'
                              ? recForDay.driverStatus
                              : undefined);

                          let code: 'P' | 'A' | 'L' | 'H' | null = null;
                          if (markedStatus === 'Present') {
                            code = 'P';
                            pCnt++;
                          } else if (markedStatus === 'Absent') {
                            code = 'A';
                            aCnt++;
                          } else if (markedStatus === 'Leave') {
                            code = 'L';
                            lCnt++;
                          } else if (markedStatus === 'Holiday') {
                            code = 'H';
                            hCnt++;
                          }
                          return { d, code };
                        });

                        return (
                          <tr key={stu.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-slate-900 sticky left-0 bg-white">
                              {stu.name}
                              <span className="block text-[9px] font-mono text-slate-400">
                                {stu.admissionNo}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-slate-600 whitespace-nowrap">
                              {stu.pickupDropStopName || stu.morningStopName || stu.villageName}
                            </td>
                            {cells.map(({ d, code }) => (
                              <td key={d} className="py-2 px-1 text-center font-mono font-bold">
                                {code ? (
                                  <span
                                    className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] ${
                                      code === 'P'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : code === 'A'
                                        ? 'bg-rose-100 text-rose-800'
                                        : code === 'L'
                                        ? 'bg-amber-100 text-amber-900'
                                        : 'bg-indigo-100 text-indigo-800'
                                    }`}
                                  >
                                    {code}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-normal">—</span>
                                )}
                              </td>
                            ))}
                            <td className="py-2 px-2 text-center font-mono font-bold text-emerald-700 bg-emerald-50/50">
                              {pCnt}
                            </td>
                            <td className="py-2 px-2 text-center font-mono font-bold text-rose-700 bg-rose-50/50">
                              {aCnt}
                            </td>
                            <td className="py-2 px-2 text-center font-mono font-bold text-amber-700 bg-amber-50/50">
                              {lCnt}
                            </td>
                            <td className="py-2 px-2 text-center font-mono font-bold text-indigo-700 bg-indigo-50/50">
                              {hCnt}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* SUB-VIEW 2: ATTENDANCE SUMMARY SHEET (TRANSPORT TIMINGS FORMAT)       */}
      {/* ===================================================================== */}
      {activeSubView === 'summary' && (
        <div className="space-y-4">
          {/* Controls Bar (Hidden in Print) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-end justify-between gap-4 print:hidden">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Report Date
                </label>
                <input
                  type="date"
                  value={summaryDate}
                  onChange={(e) => setSummaryDate(e.target.value)}
                  className="p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Campus
                </label>
                <select
                  value={lockedCampus || summaryCampus}
                  disabled={Boolean(lockedCampus)}
                  onChange={(e) => {
                    if (lockedCampus) return;
                    setSummaryCampus(e.target.value);
                  }}
                  className="p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 disabled:opacity-75"
                >
                  {!lockedCampus && <option value="All Campuses">All Campuses</option>}
                  {campuses
                    .filter((c) => !lockedCampus || normalizeCampusCode(c.code) === lockedCampus)
                    .map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Campus Incharge Name
                </label>
                <input
                  type="text"
                  value={campusInchargeName}
                  onChange={(e) => setCampusInchargeName(e.target.value)}
                  placeholder="Enter Campus Incharge"
                  className="p-2 border border-slate-200 rounded-xl text-xs bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Filled By (Transport Assistant)
                </label>
                <input
                  type="text"
                  value={filledByName}
                  onChange={(e) => setFilledByName(e.target.value)}
                  placeholder="Enter Assistant Name"
                  className="p-2 border border-slate-200 rounded-xl text-xs bg-slate-50"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handlePrintSummarySheet}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Attendance Summary Sheet</span>
            </button>
          </div>

          {/* Printable Sheet Container matching Narendra Edu Valley Transport Timings */}
          <div className="bg-white rounded-2xl border-2 border-slate-800 p-6 shadow-xs max-w-5xl mx-auto print:border-black print:shadow-none print:p-2">
            <table className="w-full border-collapse border-2 border-slate-800 text-xs text-slate-900 table-fixed">
              <thead>
                {/* Row 1: Institute Header */}
                <tr>
                  <th
                    colSpan={9}
                    className="border-2 border-slate-800 py-2.5 px-4 text-center text-2xl font-extrabold tracking-wide text-slate-900"
                  >
                    {schoolName || 'Narendra Edu Valley'}
                  </th>
                </tr>
                {/* Row 2: Sub-header "Transport Timings" */}
                <tr>
                  <th
                    colSpan={9}
                    className="border border-slate-800 py-1 px-4 text-center text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-50"
                  >
                    Transport Timings
                  </th>
                </tr>
                {/* Row 3: Campus & Date */}
                <tr>
                  <th
                    colSpan={5}
                    className="border border-slate-800 py-1.5 px-3 text-left font-bold text-xs"
                  >
                    Campus : <span className="font-semibold ml-1">{summaryCampusDisplayLabel}</span>
                  </th>
                  <th
                    colSpan={4}
                    className="border border-slate-800 py-1.5 px-3 text-left font-bold text-xs"
                  >
                    Date :- <span className="font-mono font-bold ml-2 text-sm">{formattedSummaryDate}</span>
                  </th>
                </tr>
                {/* Row 4: Table Column Headers */}
                <tr className="bg-slate-100 font-bold text-slate-900">
                  <th className="border border-slate-800 py-2 px-2 w-10 text-center">Sl</th>
                  <th className="border border-slate-800 py-2 px-3 w-32 text-left">Vehicle</th>
                  <th className="border border-slate-800 py-2 px-3 w-36 text-left">Driver</th>
                  <th className="border border-slate-800 py-2 px-2 w-14 text-center">Trip</th>
                  <th className="border border-slate-800 py-2 px-2 w-20 text-center">In Time</th>
                  <th className="border border-slate-800 py-2 px-2 w-18 text-center">Strength</th>
                  <th className="border border-slate-800 py-2 px-2 w-20 text-center">Out Time</th>
                  <th className="border border-slate-800 py-2 px-2 w-18 text-center">Strength</th>
                  <th className="border border-slate-800 py-2 px-2 w-36 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row) => (
                  <React.Fragment key={row.vehicleId}>
                    {/* 1st Trip Row */}
                    <tr>
                      <td
                        rowSpan={2}
                        className="border border-slate-800 py-2 px-2 text-center font-bold align-middle"
                      >
                        {row.sl}
                      </td>
                      <td
                        rowSpan={2}
                        className="border border-slate-800 py-2 px-3 font-bold align-middle truncate"
                      >
                        <div className="truncate">{row.vehicleLabel}</div>
                        <div className="text-[10px] font-mono text-slate-600 font-normal truncate">
                          {row.registrationNumber}
                        </div>
                      </td>
                      <td
                        rowSpan={2}
                        className="border border-slate-800 py-2 px-3 font-medium align-middle truncate"
                      >
                        {row.driverName}
                      </td>
                      <td className="border border-slate-800 py-1.5 px-2 text-center font-semibold">
                        1 St
                      </td>
                      <td className="border border-slate-800 p-1 text-center">
                        <input
                          type="text"
                          value={row.inTime1}
                          onChange={(e) => updateOverride(row.vehicleId, 'inTime1', e.target.value)}
                          placeholder="—"
                          className="w-full text-center font-mono font-bold text-xs bg-transparent focus:outline-hidden"
                        />
                      </td>
                      <td className="border border-slate-800 p-1 text-center">
                        <input
                          type="text"
                          value={row.inStrength1}
                          onChange={(e) => updateOverride(row.vehicleId, 'inStrength1', e.target.value)}
                          placeholder="—"
                          className="w-full text-center font-mono font-bold text-xs bg-transparent focus:outline-hidden"
                        />
                      </td>
                      <td className="border border-slate-800 p-1 text-center">
                        <input
                          type="text"
                          value={row.outTime1}
                          onChange={(e) => updateOverride(row.vehicleId, 'outTime1', e.target.value)}
                          placeholder="—"
                          className="w-full text-center font-mono font-bold text-xs bg-transparent focus:outline-hidden"
                        />
                      </td>
                      <td className="border border-slate-800 p-1 text-center">
                        <input
                          type="text"
                          value={row.outStrength1}
                          onChange={(e) => updateOverride(row.vehicleId, 'outStrength1', e.target.value)}
                          placeholder="—"
                          className="w-full text-center font-mono font-bold text-xs bg-transparent focus:outline-hidden"
                        />
                      </td>
                      <td
                        className="border border-slate-800 p-1 text-left overflow-hidden"
                        title={row.fullRemark1 || 'Summarized strength mismatch remark'}
                      >
                        <input
                          type="text"
                          maxLength={32}
                          value={row.remark1}
                          onChange={(e) => updateOverride(row.vehicleId, 'remark1', e.target.value)}
                          placeholder="—"
                          className="w-full text-[11px] font-medium text-slate-800 bg-transparent truncate focus:outline-hidden"
                        />
                      </td>
                    </tr>
                    {/* 2nd Trip Row */}
                    <tr>
                      <td className="border border-slate-800 py-1.5 px-2 text-center font-semibold">
                        2nd
                      </td>
                      <td className="border border-slate-800 p-1 text-center">
                        <input
                          type="text"
                          value={row.inTime2}
                          onChange={(e) => updateOverride(row.vehicleId, 'inTime2', e.target.value)}
                          placeholder="—"
                          className="w-full text-center font-mono font-bold text-xs bg-transparent focus:outline-hidden"
                        />
                      </td>
                      <td className="border border-slate-800 p-1 text-center">
                        <input
                          type="text"
                          value={row.inStrength2}
                          onChange={(e) => updateOverride(row.vehicleId, 'inStrength2', e.target.value)}
                          placeholder="—"
                          className="w-full text-center font-mono font-bold text-xs bg-transparent focus:outline-hidden"
                        />
                      </td>
                      <td className="border border-slate-800 p-1 text-center">
                        <input
                          type="text"
                          value={row.outTime2}
                          onChange={(e) => updateOverride(row.vehicleId, 'outTime2', e.target.value)}
                          placeholder="—"
                          className="w-full text-center font-mono font-bold text-xs bg-transparent focus:outline-hidden"
                        />
                      </td>
                      <td className="border border-slate-800 p-1 text-center">
                        <input
                          type="text"
                          value={row.outStrength2}
                          onChange={(e) => updateOverride(row.vehicleId, 'outStrength2', e.target.value)}
                          placeholder="—"
                          className="w-full text-center font-mono font-bold text-xs bg-transparent focus:outline-hidden"
                        />
                      </td>
                      <td
                        className="border border-slate-800 p-1 text-left overflow-hidden"
                        title={row.fullRemark2 || 'Summarized strength mismatch remark'}
                      >
                        <input
                          type="text"
                          maxLength={32}
                          value={row.remark2}
                          onChange={(e) => updateOverride(row.vehicleId, 'remark2', e.target.value)}
                          placeholder="—"
                          className="w-full text-[11px] font-medium text-slate-800 bg-transparent truncate focus:outline-hidden"
                        />
                      </td>
                    </tr>
                  </React.Fragment>
                ))}

                {/* Footer Sign-Off Block matching uploaded manual sheet */}
                <tr>
                  <td colSpan={5} className="border border-slate-800 py-1.5 px-3 font-bold">
                    Campus Incharge
                  </td>
                  <td colSpan={4} className="border border-slate-800 py-1.5 px-3 font-bold">
                    Filled By
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="border border-slate-800 py-2 px-3 font-semibold">
                    Name :- <span className="ml-2 font-bold">{campusInchargeName}</span>
                  </td>
                  <td colSpan={4} className="border border-slate-800 py-2 px-3 font-semibold">
                    Name :- <span className="ml-2 font-bold">{filledByName}</span>
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="border border-slate-800 py-3 px-3 font-semibold">
                    Signature
                  </td>
                  <td colSpan={4} className="border border-slate-800 py-3 px-3 font-semibold">
                    Signature
                  </td>
                </tr>
                <tr>
                  <td colSpan={9} className="border border-slate-800 py-2.5 px-3 font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0">Remarks :-</span>
                      <input
                        type="text"
                        maxLength={110}
                        value={summaryRemarks || autoCombinedSummaryRemarks}
                        onChange={(e) => setSummaryRemarks(e.target.value)}
                        placeholder="Summarized remarks (auto-filled from Attendance window)..."
                        className="flex-1 bg-transparent focus:outline-hidden font-normal truncate"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 3: PRINT ROUTE LIST (WEEKLY DRIVER SHEET)                    */}
      {/* ===================================================================== */}
      {activeSubView === 'pack' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Filter by Vehicle
                </label>
                <select
                  value={packVehicleFilter}
                  onChange={(e) => setPackVehicleFilter(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
                >
                  <option value="all">All Vehicles ({routes.length} Routes)</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.registrationNumber}>
                      {v.registrationNumber} {v.nickname ? `— ${v.nickname}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Route ({filteredPackRoutes.length})
                </label>
                <select
                  value={packRouteId}
                  onChange={(e) => setPackRouteId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
                >
                  {filteredPackRoutes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.name || r.villageNames.join(', ')} ({r.vehicleNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Week Start Date
                </label>
                <input
                  type="date"
                  value={packWeekStart}
                  onChange={(e) => handleStartCalendarChange(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Week End Date
                </label>
                <input
                  type="date"
                  value={packWeekEnd}
                  min={packWeekStart}
                  onChange={(e) => setPackWeekEnd(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintRouteList}
                  className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Route List</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportRouteListCsv}
                  className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  title="Export Route Member List to CSV"
                >
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                {schoolName && (
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {schoolName}
                  </div>
                )}
                <h3 className="text-base font-bold text-slate-900">
                  Route Member List: {selectedPackRoute?.code} — {selectedPackRoute?.name}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Vehicle: <strong>{selectedPackRoute?.vehicleNumber}</strong> • Trip:{' '}
                  <strong>Trip {selectedPackRoute?.tripNumber}</strong> • Campus:{' '}
                  <strong>{getCampusLabel(selectedPackRoute?.campus || '')}</strong>
                </p>
              </div>
              <div className="text-right text-xs text-slate-600">
                <div>
                  Period: <strong>{packWeekStart}</strong> to <strong>{packWeekEnd}</strong>
                </div>
                <div className="font-semibold text-slate-700 mt-0.5">
                  Total Members: {routeRosterMembers.length}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold">
                    <th className="border border-slate-200 p-2 w-10 text-center">#</th>
                    <th className="border border-slate-200 p-2 w-14 text-center">DP</th>
                    <th className="border border-slate-200 p-2">Member Name &amp; ID</th>
                    <th className="border border-slate-200 p-2">Type / Class</th>
                    <th className="border border-slate-200 p-2">Pickup &amp; Drop Stop</th>
                    <th className="border border-slate-200 p-2">Status</th>
                    {weekDates.map((dt) => (
                      <th key={dt} className="border border-slate-200 p-2 text-center font-mono text-[11px]">
                        <div>{dt}</div>
                        <div className="text-[9px] text-slate-500 font-normal">IN / OUT</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {routeRosterMembers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6 + weekDates.length}
                        className="p-8 text-center text-slate-400"
                      >
                        No active or suspended members on this route.
                      </td>
                    </tr>
                  ) : (
                    routeRosterMembers.map((m, idx) => {
                      const isSuspended = m.transportStatus === 'Suspended';
                      return (
                        <tr
                          key={m.id}
                          className={isSuspended ? 'bg-rose-50/60' : 'hover:bg-slate-50'}
                        >
                          <td className="border border-slate-200 p-2 text-center font-mono">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-200 p-2 text-center">
                            {m.profilePhoto ? (
                              <img
                                src={m.profilePhoto}
                                alt={m.name}
                                className="w-8 h-8 rounded-md object-cover mx-auto border border-slate-300"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-md bg-slate-200 flex items-center justify-center font-bold text-[10px] mx-auto">
                                {m.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </td>
                          <td className="border border-slate-200 p-2">
                            <div
                              className={`font-bold ${
                                isSuspended ? 'text-red-600' : 'text-slate-900'
                              }`}
                            >
                              {m.name}
                            </div>
                            <div
                              className={`text-[10px] font-mono ${
                                isSuspended ? 'text-red-500' : 'text-slate-500'
                              }`}
                            >
                              {m.admissionNo}
                            </div>
                          </td>
                          <td
                            className={`border border-slate-200 p-2 ${
                              isSuspended ? 'text-red-600 font-semibold' : 'text-slate-700'
                            }`}
                          >
                            {m.memberType} ({m.class}-{m.section})
                          </td>
                          <td
                            className={`border border-slate-200 p-2 ${
                              isSuspended ? 'text-red-600' : 'text-slate-700'
                            }`}
                          >
                            {m.pickupDropStopName} ({m.villageName})
                          </td>
                          <td className="border border-slate-200 p-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isSuspended
                                  ? 'bg-red-100 text-red-700 border border-red-300'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {m.transportStatus}
                            </span>
                          </td>
                          {weekDates.map((dt) => (
                            <td
                              key={dt}
                              className="border border-slate-200 p-2 text-center text-[10px] text-slate-300"
                            >
                              {isSuspended ? (
                                <span className="text-red-600 font-bold">SUSPENDED</span>
                              ) : (
                                '☐ / ☐'
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 5: CALL ABSENTEES — PARENT FOLLOW-UP & SCHEDULED RETURN      */}
      {/* ===================================================================== */}
      {activeSubView === 'call_absentees' && (
        <div className="space-y-5">
          {statusFeedback && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{statusFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusFeedback(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Top KPI & Calling Progress Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Daily Absentee Calling Queue
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{mainCallingQueue.length}</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {mainCallingQueue.filter((i) => i.isCalledToday).length} / {mainCallingQueue.length} Called
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Campus-wise daily absentees &amp; due/overdue returns requiring parent follow-up
              </p>
            </div>

            <div className="bg-rose-50/70 rounded-2xl border border-rose-200 p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>&gt; 3 Consecutive Days Absent</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-black text-rose-900">
                  {escalationMoreThan3DaysQueue.length}
                </span>
                <span className="text-[11px] font-bold text-rose-800 bg-white px-2 py-0.5 rounded-md border border-rose-200">
                  Coordinator Escalation
                </span>
              </div>
              <p className="text-[11px] text-rose-700 mt-1">
                Shown in Transport Coordinator ID (Both Campuses) to call &amp; log remarks
              </p>
            </div>

            <div className="bg-indigo-50/70 rounded-2xl border border-indigo-200 p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Scheduled Return (Informed Leave)</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-black text-indigo-900">
                  {scheduledReturnQueue.length}
                </span>
                <span className="text-[11px] font-bold text-indigo-800 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                  Tentative Arrival Set
                </span>
              </div>
              <p className="text-[11px] text-indigo-700 mt-1">
                Paused from daily calling until Tentative Date of Arrival to avoid disturbing parents
              </p>
            </div>

            <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-4 shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Overdue / Early Return Alerts</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-black text-amber-950">
                  {mainCallingQueue.filter((i) => i.isOverdueOrDueTodayReturn).length +
                    earlyArrivalsTodayList.length}
                </span>
                <span className="text-[11px] font-bold text-amber-900 bg-white px-2 py-0.5 rounded-md border border-amber-200">
                  {mainCallingQueue.filter((i) => i.isOverdueOrDueTodayReturn).length} Not Arrived •{' '}
                  {earlyArrivalsTodayList.length} Early
                </span>
              </div>
              <p className="text-[11px] text-amber-800 mt-1">
                Auto-surfaced if not arrived on expected date or arrived early during attendance
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Attendance / Calling Date
              </label>
              <input
                type="date"
                value={absenteeDate}
                max={!isAdmin ? todayStr : undefined}
                onChange={(e) => setAbsenteeDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Campus {lockedCampus ? `(Locked: ${lockedCampus})` : '(Sr / Jr Campus)'}
              </label>
              <select
                value={absenteeCampusFilter}
                disabled={Boolean(lockedCampus)}
                onChange={(e) => setAbsenteeCampusFilter(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-900 disabled:opacity-60"
              >
                {!lockedCampus && <option value="all">Both Campuses (Sr &amp; Jr)</option>}
                {campuses
                  .filter((c) => !lockedCampus || c.code.toLowerCase() === lockedCampus.toLowerCase())
                  .map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Route Filter
              </label>
              <select
                value={absenteeRouteFilter}
                onChange={(e) => setAbsenteeRouteFilter(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-900"
              >
                <option value="all">All Routes</option>
                {routes
                  .filter(
                    (r) =>
                      absenteeCampusFilter === 'all' ||
                      (r.campus || '').toLowerCase() === absenteeCampusFilter.toLowerCase()
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.name} ({r.vehicleNumber})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Search Member / Parent / Phone
              </label>
              <input
                type="text"
                value={absenteeSearch}
                onChange={(e) => setAbsenteeSearch(e.target.value)}
                placeholder="Name, Adm No, Phone, Stop..."
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 text-slate-900"
              />
            </div>
          </div>

          {/* Direct Call Any Member Bar (Coordinator & Admin can call any member of Both Campuses directly & save remarks) */}
          <div className="bg-indigo-50/70 rounded-2xl border border-indigo-200 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-black text-indigo-950">
                  Direct Absentee Call &amp; Remarks Entry ({lockedCampus ? `${lockedCampus} Campus` : 'Both Sr & Jr Campuses'})
                </div>
                <div className="text-[11px] text-indigo-800">
                  Transport Coordinator, Admin, or Assistant can directly select any member below to call parents and save calling remarks immediately.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={directCallStudentId}
                onChange={(e) => setDirectCallStudentId(e.target.value)}
                className="flex-1 md:w-80 p-2 border border-indigo-300 rounded-xl text-xs font-bold bg-white text-slate-900"
              >
                <option value="">-- Select Member to Call &amp; Enter Remarks --</option>
                {students
                  .filter((s) => {
                    if (s.transportStatus === 'Left') return false;
                    const stuCamp = s.campus || (s.routeCode?.toLowerCase().startsWith('jr') ? 'Jr' : 'Sr');
                    if (lockedCampus && stuCamp.toLowerCase() !== lockedCampus.toLowerCase()) return false;
                    if (absenteeCampusFilter !== 'all' && stuCamp.toLowerCase() !== absenteeCampusFilter.toLowerCase()) return false;
                    return true;
                  })
                  .map((s) => {
                    const stuCamp = s.campus || (s.routeCode?.toLowerCase().startsWith('jr') ? 'Jr' : 'Sr');
                    return (
                      <option key={s.id} value={s.id}>
                        [{stuCamp}] {s.name} ({s.admissionNo}) — {s.routeCode} • {s.mobile}
                      </option>
                    );
                  })}
              </select>
              <button
                type="button"
                disabled={!directCallStudentId}
                onClick={() => {
                  if (directCallStudentId) {
                    openDirectStudentCallModal(directCallStudentId);
                  }
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call &amp; Enter Remarks</span>
              </button>
            </div>
          </div>

          {/* Early Arrivals Confirmation Banner (if any student with a future Tentative Date of Arrival was marked Present today) */}
          {earlyArrivalsTodayList.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">
                    Early Arrival Confirmation Required ({earlyArrivalsTodayList.length} Member
                    {earlyArrivalsTodayList.length > 1 ? 's' : ''})
                  </h4>
                </div>
                <span className="text-[11px] font-bold text-amber-800">
                  Marked Present before Tentative Date of Arrival
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {earlyArrivalsTodayList.map((item) => (
                  <div
                    key={item.student.id}
                    className="bg-white rounded-xl border border-amber-200 p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {item.student.name}{' '}
                        <span className="font-mono text-[11px] text-slate-500">
                          ({item.student.admissionNo})
                        </span>
                      </div>
                      <div className="text-[11px] text-amber-800 font-semibold mt-0.5">
                        Tentative Arrival was: <strong>{item.expectedReturnDate}</strong> • Reason:{' '}
                        {item.expectedReturnReason || 'Informed Leave'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (onConfirmEarlyArrival) {
                          await onConfirmEarlyArrival({
                            studentId: item.student.id,
                            date: absenteeDate,
                            confirmedBy: currentRole,
                            remarks: `Confirmed early arrival on ${absenteeDate} (Tentative date was ${item.expectedReturnDate})`,
                          });
                          setStatusFeedback(
                            `Confirmed early arrival for ${item.student.name} and cleared Tentative Date of Arrival.`
                          );
                          setTimeout(() => setStatusFeedback(null), 3500);
                        }
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer shrink-0"
                    >
                      Confirm Early Arrival
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-Tabs for the 3 Absentee Lists */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveAbsenteeListTab('main_calling')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                activeAbsenteeListTab === 'main_calling'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>1. Main Daily Absentee Calling List</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  activeAbsenteeListTab === 'main_calling'
                    ? 'bg-amber-400 text-slate-950 font-black'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {mainCallingQueue.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAbsenteeListTab('escalation_3days')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                activeAbsenteeListTab === 'escalation_3days'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>2. &gt; 3 Days Consecutive Absent (Coordinator Escalation)</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  activeAbsenteeListTab === 'escalation_3days'
                    ? 'bg-white text-rose-700 font-black'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {escalationMoreThan3DaysQueue.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveAbsenteeListTab('scheduled_return')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                activeAbsenteeListTab === 'scheduled_return'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>3. Scheduled Return / Tentative Date of Arrival List</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  activeAbsenteeListTab === 'scheduled_return'
                    ? 'bg-white text-indigo-700 font-black'
                    : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                {scheduledReturnQueue.length}
              </span>
            </button>
          </div>

          {/* Active List Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900">
                {activeAbsenteeListTab === 'main_calling'
                  ? 'Daily Absentee Calling Queue'
                  : activeAbsenteeListTab === 'escalation_3days'
                  ? 'Absent > 3 Consecutive Days (Coordinator Escalation)'
                  : 'Scheduled Return / Tentative Date of Arrival List'}
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3">Member &amp; Campus</th>
                    <th className="p-3">Route &amp; Stop</th>
                    <th className="p-3">Parent &amp; Phone</th>
                    <th className="p-3 text-center">Absence Duration</th>
                    <th className="p-3">Tentative Date of Arrival</th>
                    <th className="p-3">Attendance &amp; Assistant Remarks</th>
                    <th className="p-3">Coordinator Remarks</th>
                    <th className="p-3 text-center">Calling Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(() => {
                    const activeRows =
                      activeAbsenteeListTab === 'main_calling'
                        ? mainCallingQueue
                        : activeAbsenteeListTab === 'escalation_3days'
                        ? escalationMoreThan3DaysQueue
                        : scheduledReturnQueue;

                    if (activeRows.length === 0) {
                      return (
                        <tr>
                          <td colSpan={9} className="p-10 text-center text-slate-400 font-medium">
                            {activeAbsenteeListTab === 'main_calling'
                              ? `No absentees pending parent call for ${absenteeDate} under current filters.`
                              : activeAbsenteeListTab === 'escalation_3days'
                              ? 'No students currently absent for more than 3 consecutive days.'
                              : 'No students currently in the Scheduled Return / Tentative Date of Arrival list.'}
                          </td>
                        </tr>
                      );
                    }

                    return activeRows.map((item) => {
                      const s = item.student;
                      const isOver3Days = item.consecutiveDaysAbsent > 3;
                      return (
                        <tr
                          key={s.id}
                          className={`hover:bg-slate-50/90 transition-colors ${
                            item.isOverdueOrDueTodayReturn
                              ? 'bg-amber-50/60'
                              : isOver3Days
                              ? 'bg-rose-50/35'
                              : ''
                          }`}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  item.campus.toLowerCase() === 'jr'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                                }`}
                              >
                                {item.campus}
                              </span>
                              <div>
                                <div className="font-bold text-slate-900">{s.name}</div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {s.admissionNo} • {s.class}-{s.section}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="font-bold text-slate-800">{s.routeCode || '—'}</div>
                            <div className="text-[11px] text-slate-500">
                              {s.pickupDropStopName || s.villageName || '—'}
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="font-semibold text-slate-800">
                              {s.fatherName || s.guardianName || 'Parent'}
                            </div>
                            {s.mobile ? (
                              <a
                                href={`tel:${s.mobile}`}
                                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-mono font-bold text-[11px] mt-0.5"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{s.mobile}</span>
                              </a>
                            ) : (
                              <span className="text-slate-400 text-[11px]">No Phone</span>
                            )}
                          </td>

                          <td className="p-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black ${
                                isOver3Days
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : 'bg-slate-100 text-slate-800 border border-slate-200'
                              }`}
                            >
                              {item.consecutiveDaysAbsent} Day
                              {item.consecutiveDaysAbsent > 1 ? 's' : ''} Consecutive
                            </span>
                            {isOver3Days && (
                              <div className="text-[10px] font-bold text-rose-600 mt-0.5">
                                &gt;3 Days Escalated
                              </div>
                            )}
                          </td>

                          <td className="p-3">
                            {item.expectedReturnDate ? (
                              <div>
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                                    item.isOverdueOrDueTodayReturn
                                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                      : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  }`}
                                >
                                  Arrival: {item.expectedReturnDate}
                                </span>
                                {item.isOverdueOrDueTodayReturn && (
                                  <div className="text-[10px] font-black text-rose-600 mt-0.5">
                                    Not Arrived on Expected Date — Call Today!
                                  </div>
                                )}
                                {item.expectedReturnReason && (
                                  <div className="text-[11px] text-slate-600 mt-0.5">
                                    {item.expectedReturnReason}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Not set</span>
                            )}
                          </td>

                          <td className="p-3 max-w-xs">
                            {item.attendanceRemarks && (
                              <div className="text-[11px] text-slate-600 mb-1">
                                <span className="font-bold text-slate-700">Attendance:</span>{' '}
                                {item.attendanceRemarks}
                              </div>
                            )}
                            {item.assistantRemarks ? (
                              <div className="text-[11px] text-emerald-900 bg-emerald-50/80 border border-emerald-200 px-2 py-1 rounded-lg">
                                <span className="font-bold">Assistant:</span> {item.assistantRemarks}
                              </div>
                            ) : item.coordinatorRemarks ? (
                              <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                Direct Call by Coordinator
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">
                                No assistant remark yet
                              </span>
                            )}
                          </td>

                          <td className="p-3 max-w-xs">
                            {item.coordinatorRemarks ? (
                              <div className="text-[11px] text-indigo-950 bg-indigo-50/90 border border-indigo-200 px-2 py-1 rounded-lg">
                                <span className="font-bold">Coordinator:</span>{' '}
                                {item.coordinatorRemarks}
                              </div>
                            ) : isOver3Days ? (
                              <span className="inline-block px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                Coordinator Call &amp; Remark Required
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>

                          <td className="p-3 text-center">
                            {item.isCalledToday ? (
                              <div>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                                  Called Today
                                </span>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  {item.existingCallToday?.callStatus}
                                </div>
                              </div>
                            ) : item.isInScheduledReturnList ? (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold">
                                Scheduled Return
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold">
                                Call Pending
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => openAbsenteeCallModal(item)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <Phone className="w-3.5 h-3.5 text-amber-400" />
                              <span>Call &amp; Remarks</span>
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ABSENTEE PARENT CALL, REMARKS & TENTATIVE DATE OF ARRIVAL      */}
      {/* ===================================================================== */}
      {callModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-amber-400" />
                  <h3 className="text-base font-black">
                    Absentee Parent Call &amp; Follow-up Remarks
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {callModalTarget.student.name} ({callModalTarget.student.admissionNo}) • Class{' '}
                  {callModalTarget.student.class}-{callModalTarget.student.section} • Route{' '}
                  {callModalTarget.student.routeCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCallModalTarget(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleSaveAbsenteeCallForm(e, false)} className="p-5 space-y-4">
              {/* Parent Info & Absence Streak Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Parent / Guardian</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {callModalTarget.student.fatherName || 'Parent'}
                  </div>
                  <a
                    href={`tel:${callModalTarget.student.mobile}`}
                    className="text-indigo-600 font-mono font-bold inline-flex items-center gap-1 mt-0.5"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{callModalTarget.student.mobile || '—'}</span>
                  </a>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Consecutive Absence Duration
                  </div>
                  <div className="font-black text-rose-700 text-sm mt-0.5">
                    {callModalTarget.consecutiveDaysAbsent} Consecutive Day
                    {callModalTarget.consecutiveDaysAbsent > 1 ? 's' : ''}
                  </div>
                  {callModalTarget.consecutiveDaysAbsent > 3 && (
                    <div className="text-[10px] font-bold text-rose-600">
                      &gt; 3 Days Escalated to Coordinator
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">
                    Stop &amp; Campus
                  </div>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {callModalTarget.student.pickupDropStopName ||
                      callModalTarget.student.villageName}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Campus: {callModalTarget.student.campus || 'Sr'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Call Outcome / Status *
                </label>
                <select
                  value={callStatusInput}
                  onChange={(e) =>
                    setCallStatusInput(e.target.value as AbsenteeCallRecord['callStatus'])
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-900"
                >
                  <option value="Answered - Will Return on Date">
                    Answered — Will Return on Tentative Date
                  </option>
                  <option value="Answered - Coming Tomorrow">Answered — Coming Tomorrow</option>
                  <option value="Answered - Medical / Family Leave">
                    Answered — Medical / Family Leave
                  </option>
                  <option value="No Answer / Switched Off">No Answer / Phone Switched Off</option>
                  <option value="Busy / Call Back Later">Busy / Call Back Later</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Transport Assistant / Parent Call Remarks
                  </label>
                  <textarea
                    rows={3}
                    value={callAssistantRemarksInput}
                    onChange={(e) => setCallAssistantRemarksInput(e.target.value)}
                    placeholder="Enter reason shared by parent during phone call (e.g. Fever, out of station for family function)..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-medium bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-900 mb-1">
                    Transport Coordinator Direct Call / Follow-up Remarks{' '}
                    {(currentRole === 'Transport Coordinator' || isCoordinator) && (
                      <span className="text-indigo-600 font-black">(Direct Coordinator Entry)</span>
                    )}
                    {callModalTarget.consecutiveDaysAbsent > 3 && (
                      <span className="text-rose-600 font-black"> (* &gt;3 Days Absent)</span>
                    )}
                  </label>
                  <textarea
                    rows={3}
                    value={callCoordinatorRemarksInput}
                    onChange={(e) => setCallCoordinatorRemarksInput(e.target.value)}
                    placeholder="Coordinator can directly call absentees of both campuses and enter calling remarks here..."
                    className="w-full p-2.5 border border-indigo-300 rounded-xl text-xs font-medium bg-indigo-50/40 text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {[
                      'Called parent directly — Coming tomorrow',
                      'Called parent directly — Medical / Fever leave',
                      'Called parent directly — Out of station',
                      'Called parent — Phone not answered',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          if (currentRole === 'Transport Coordinator' || isCoordinator || isAdmin) {
                            setCallCoordinatorRemarksInput(preset);
                          } else {
                            setCallAssistantRemarksInput(preset);
                          }
                        }}
                        className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded text-[10px] font-bold cursor-pointer"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {callSaveError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold">
                  {callSaveError}
                </div>
              )}

              {/* Tentative / Expected Date of Arrival Box */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>
                        Tentative Date of Arrival (Move to Scheduled Return / Informed Leave List)
                      </span>
                    </h4>
                    <p className="text-[11px] text-indigo-800 mt-0.5">
                      If the parent states the member will come after a few days (e.g. 5 days), set
                      the <strong>Tentative Date of Arrival</strong> below. The member will be moved
                      to the separate Scheduled Return list so parents are not disturbed daily. If
                      not arrived on that date, the name will automatically appear for calling!
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                      Tentative / Expected Date of Arrival
                    </label>
                    <input
                      type="date"
                      value={callExpectedReturnDateInput}
                      min={absenteeDate}
                      onChange={(e) => setCallExpectedReturnDateInput(e.target.value)}
                      className="w-full p-2 border border-indigo-300 rounded-xl text-xs font-bold bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                      Informed Leave / Return Note
                    </label>
                    <input
                      type="text"
                      value={callExpectedReturnReasonInput}
                      onChange={(e) => setCallExpectedReturnReasonInput(e.target.value)}
                      placeholder="e.g. Going out of station for 5 days, will return on date"
                      className="w-full p-2 border border-indigo-300 rounded-xl text-xs font-medium bg-white text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Past Call History for this Member */}
              {(() => {
                const pastCalls = absenteeCalls.filter(
                  (c) => c.studentId === callModalTarget.student.id
                );
                if (pastCalls.length === 0) return null;
                return (
                  <div className="border-t border-slate-200 pt-3">
                    <div className="text-[11px] font-bold uppercase text-slate-500 mb-2">
                      Past Absentee Call History ({pastCalls.length})
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                      {pastCalls.map((pc) => (
                        <div
                          key={pc.id}
                          className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-mono font-bold text-slate-800">{pc.date}</span> •{' '}
                            <span className="font-bold text-indigo-700">{pc.callStatus}</span>
                            {pc.assistantRemarks && (
                              <span className="text-slate-600">
                                {' '}
                                — Asst: &ldquo;{pc.assistantRemarks}&rdquo;
                              </span>
                            )}
                            {pc.coordinatorRemarks && (
                              <span className="text-indigo-800 font-semibold">
                                {' '}
                                | Coord: &ldquo;{pc.coordinatorRemarks}&rdquo;
                              </span>
                            )}
                          </div>
                          {pc.expectedReturnDate && (
                            <span className="font-mono text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">
                              Tentative Arrival: {pc.expectedReturnDate}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <div>
                  {callModalTarget.student.expectedReturnDate && (
                    <button
                      type="button"
                      disabled={isSavingCall}
                      onClick={(e) => handleSaveAbsenteeCallForm(e, true)}
                      className="px-3 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Clear Tentative Arrival Date
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCallModalTarget(null)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCall}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    {isSavingCall ? 'Saving...' : 'Save Call & Follow-up Remarks'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: EARLY ARRIVAL CONFIRMATION DURING ATTENDANCE MARKING           */}
      {/* ===================================================================== */}
      {earlyArrivalModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-amber-300 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-amber-500 text-slate-950 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-slate-950" />
                <h3 className="text-sm font-black uppercase tracking-wide">
                  Early Arrival Confirmation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEarlyArrivalModal(null)}
                className="text-slate-900 hover:text-slate-950 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmEarlyArrivalAndMarkPresent} className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-1.5">
                <div className="font-black text-sm">
                  {earlyArrivalModal.student.name} ({earlyArrivalModal.student.admissionNo})
                </div>
                <p className="text-xs leading-relaxed">
                  Assistant / Coordinator marked that this member will not use transport facility till{' '}
                  <strong className="font-mono underline">
                    {earlyArrivalModal.expectedReturnDate || earlyArrivalModal.student.expectedReturnDate}
                  </strong>
                  . Has he/she arrived early?
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const { record, mode } = earlyArrivalModal;
                    stageSingleDraftAttendance(record, mode, 'Leave', {
                      reason: `Continued with Leave (Till ${
                        earlyArrivalModal.expectedReturnDate ||
                        earlyArrivalModal.student.expectedReturnDate
                      })`,
                    });
                    setEarlyArrivalModal(null);
                  }}
                  className="px-3.5 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Continue with Leave (Rectify Member)
                </button>
                <button
                  type="submit"
                  disabled={isConfirmingEarlyArrival}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  {isConfirmingEarlyArrival ? 'Saving...' : 'Proceed to Mark Present'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW: MARK ROUTE HOLIDAY (SELECTED ROUTES OR ALL ROUTES AT ONCE)  */}
      {/* ===================================================================== */}
      {activeSubView === 'mark_holiday' &&
        (() => {
          const effectiveHolidayCampus: 'all' | 'Sr' | 'Jr' = lockedCampus
            ? (lockedCampus as 'Sr' | 'Jr')
            : holidaySubCampus;

          const scopedHolidayRoutes = routes.filter((r) => {
            if (effectiveHolidayCampus === 'all') return true;
            return routeHasMembersForCampus(r, effectiveHolidayCampus);
          });

          const getRouteHolidayStats = (r: Route) => {
            const members =
              effectiveHolidayCampus === 'all'
                ? getAllMembersForRouteRaw(r)
                : getMembersForRoute(r, effectiveHolidayCampus);
            const tripId = `dt-${r.id}-${holidaySubDate}`;
            const isOptimisticallyMarked = Boolean(
              localHolidayMarkedRouteDates[`${r.id}:${holidaySubDate}`]
            );
            if (isOptimisticallyMarked && members.length > 0) {
              return {
                members,
                totalCount: members.length,
                holidayCountForRoute: members.length,
                isFullyHoliday: true,
              };
            }
            let holidayCountForRoute = 0;
            for (const m of members) {
              const matchingRecs = attendanceRecords.filter(
                (a) =>
                  a.studentId === m.id &&
                  (a.tripId === tripId ||
                    a.date === holidaySubDate ||
                    a.id === `att-${tripId}-${m.id}`)
              );
              const hasDriverHoliday = matchingRecs.some((rec) => rec.driverStatus === 'Holiday');
              const hasAssistantHoliday = matchingRecs.some(
                (rec) => rec.assistantStatus === 'Holiday'
              );
              if (hasDriverHoliday && hasAssistantHoliday) {
                holidayCountForRoute++;
              }
            }
            return {
              members,
              totalCount: members.length,
              holidayCountForRoute,
              isFullyHoliday: members.length > 0 && holidayCountForRoute === members.length,
            };
          };

          const allRouteIdsInScope = scopedHolidayRoutes.map((r) => r.id);
          const areAllSelected =
            allRouteIdsInScope.length > 0 &&
            allRouteIdsInScope.every((id) => selectedHolidayRouteIds.includes(id));

          const handleToggleSelectAllRoutes = () => {
            if (areAllSelected) {
              setSelectedHolidayRouteIds([]);
            } else {
              setSelectedHolidayRouteIds(allRouteIdsInScope);
            }
          };

          const handleToggleRouteSelection = (rId: string) => {
            setSelectedHolidayRouteIds((prev) =>
              prev.includes(rId) ? prev.filter((id) => id !== rId) : [...prev, rId]
            );
          };

          const executeMarkHolidayForRoutes = async (targetRoutes: Route[]) => {
            if (targetRoutes.length === 0) {
              setStatusFeedback('Select at least one route to mark Holiday.');
              setTimeout(() => setStatusFeedback(null), 3500);
              setHolidayResultModal({
                type: 'error',
                title: 'No Routes Selected',
                message:
                  'Please select at least one route checkbox to mark Holiday, or click "Mark Holiday for All Routes at Once".',
              });
              return;
            }

            const entries: Array<{
              recordId: string;
              source: 'driver' | 'assistant';
              value: string;
              reason?: string;
            }> = [];

            const cleanOccasion = (holidaySubReason || 'School Holiday').trim();

            for (const r of targetRoutes) {
              const members =
                effectiveHolidayCampus === 'all'
                  ? getAllMembersForRouteRaw(r)
                  : getMembersForRoute(r, effectiveHolidayCampus);
              const tripId = `dt-${r.id}-${holidaySubDate}`;

              for (const stu of members) {
                const existingRec = attendanceRecords.find(
                  (a) =>
                    a.studentId === stu.id &&
                    (a.tripId === tripId || a.date === holidaySubDate)
                );
                const recordId = existingRec?.id || `att-${tripId}-${stu.id}`;
                entries.push({
                  recordId,
                  source: 'driver',
                  value: 'Holiday',
                  reason: cleanOccasion,
                });
                entries.push({
                  recordId,
                  source: 'assistant',
                  value: 'Holiday',
                  reason: cleanOccasion,
                });
              }
            }

            if (entries.length === 0) {
              setStatusFeedback('No active transport members found on the selected route(s).');
              setTimeout(() => setStatusFeedback(null), 3500);
              setHolidayResultModal({
                type: 'error',
                title: 'No Active Members Found',
                message:
                  'No active transport members were found on the selected route(s) to mark Holiday.',
              });
              return;
            }

            const totalMembersMarked = Math.round(entries.length / 2);
            setIsMarkingRoutesHoliday(true);
            try {
              if (onBatchSaveAttendance) {
                await onBatchSaveAttendance(entries);
              } else {
                for (const ent of entries) {
                  await onMarkAttendance(ent.recordId, ent.source, ent.value, ent.reason);
                }
              }

              // Immediately reflect Holiday status on the route table rows
              setLocalHolidayMarkedRouteDates((prev) => {
                const next = { ...prev };
                for (const r of targetRoutes) {
                  next[`${r.id}:${holidaySubDate}`] = true;
                }
                return next;
              });
              setSelectedHolidayRouteIds([]);

              const successText = `✓ Holiday (H) marked successfully for ${targetRoutes.length} route(s) (${totalMembersMarked} members) on ${holidaySubDate}.`;
              setStatusFeedback(successText);
              setTimeout(() => setStatusFeedback(null), 5000);

              setHolidayResultModal({
                type: 'success',
                title: 'Holiday Marked Successfully!',
                message: `Holiday (H) has been marked and saved for ${targetRoutes.length} route(s) (${totalMembersMarked} active members) on ${holidaySubDate}. Arrival & Departure timings are automatically marked Not Applicable (N/A).`,
                date: holidaySubDate,
                routeNames: targetRoutes.map((r) => `${r.code} (${r.name})`),
                memberCount: totalMembersMarked,
                occasion: cleanOccasion,
              });
            } catch (err: any) {
              const errMsg =
                err?.message ||
                'An unexpected error occurred while marking Holiday. Please check your connection and try again.';
              setStatusFeedback(`Error: ${errMsg}`);
              setTimeout(() => setStatusFeedback(null), 5000);
              setHolidayResultModal({
                type: 'error',
                title: 'Failed to Mark Holiday',
                message: errMsg,
              });
            } finally {
              setIsMarkingRoutesHoliday(false);
            }
          };

          return (
            <div className="space-y-4">
              {statusFeedback && (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{statusFeedback}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatusFeedback(null)}
                    className="text-emerald-700 hover:text-emerald-950 font-black cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Holiday Date
                    </label>
                    <input
                      type="date"
                      value={holidaySubDate}
                      onChange={(e) => setHolidaySubDate(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Campus
                    </label>
                    <select
                      value={effectiveHolidayCampus}
                      disabled={Boolean(lockedCampus)}
                      onChange={(e) =>
                        setHolidaySubCampus(e.target.value as 'all' | 'Sr' | 'Jr')
                      }
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 disabled:opacity-70"
                    >
                      {!lockedCampus && <option value="all">All Campuses (Sr &amp; Jr)</option>}
                      {(!lockedCampus || lockedCampus === 'Sr') && (
                        <option value="Sr">Senior Campus (Sr)</option>
                      )}
                      {(!lockedCampus || lockedCampus === 'Jr') && (
                        <option value="Jr">Junior Campus (Jr)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Holiday Occasion / Remark
                    </label>
                    <input
                      type="text"
                      value={holidaySubReason}
                      onChange={(e) => setHolidaySubReason(e.target.value)}
                      placeholder="e.g. Festival / School Closed"
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 text-slate-900"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleSelectAllRoutes}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs cursor-pointer"
                    >
                      {areAllSelected ? 'Unselect All Routes' : `Select All Routes (${scopedHolidayRoutes.length})`}
                    </button>
                    <span className="text-xs font-semibold text-slate-500">
                      Selected: <strong className="text-slate-900">{selectedHolidayRouteIds.length}</strong> of{' '}
                      {scopedHolidayRoutes.length} routes
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isMarkingRoutesHoliday || selectedHolidayRouteIds.length === 0}
                      onClick={() =>
                        executeMarkHolidayForRoutes(
                          scopedHolidayRoutes.filter((r) =>
                            selectedHolidayRouteIds.includes(r.id)
                          )
                        )
                      }
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-xs"
                    >
                      {isMarkingRoutesHoliday
                        ? 'Marking Holiday...'
                        : `Mark Holiday for Selected Routes (${selectedHolidayRouteIds.length})`}
                    </button>

                    <button
                      type="button"
                      disabled={isMarkingRoutesHoliday || scopedHolidayRoutes.length === 0}
                      onClick={() => executeMarkHolidayForRoutes(scopedHolidayRoutes)}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-amber-400 font-bold text-xs cursor-pointer shadow-xs"
                    >
                      {isMarkingRoutesHoliday
                        ? 'Marking All Routes...'
                        : `Mark Holiday for All Routes at Once (${scopedHolidayRoutes.length})`}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                        <th className="py-3 px-4 w-10">
                          <input
                            type="checkbox"
                            checked={areAllSelected}
                            onChange={handleToggleSelectAllRoutes}
                            className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-3">Route Code &amp; Name</th>
                        <th className="py-3 px-3">Campus</th>
                        <th className="py-3 px-3">Vehicle &amp; Driver</th>
                        <th className="py-3 px-3 text-center">Active Members</th>
                        <th className="py-3 px-3 text-center">Holiday Status ({holidaySubDate})</th>
                        <th className="py-3 px-4 text-right">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {scopedHolidayRoutes.map((r) => {
                        const stats = getRouteHolidayStats(r);
                        const isChecked = selectedHolidayRouteIds.includes(r.id);
                        return (
                          <tr
                            key={r.id}
                            className={`hover:bg-slate-50/80 ${
                              stats.isFullyHoliday ? 'bg-indigo-50/30' : ''
                            }`}
                          >
                            <td className="py-2.5 px-4">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleRouteSelection(r.id)}
                                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{r.code}</div>
                              <div className="text-[11px] text-slate-500">{r.name}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  normalizeCampusCode(r.campus) === 'Jr'
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-indigo-100 text-indigo-900'
                                }`}
                              >
                                {r.campus}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-mono font-semibold text-slate-800">
                                {r.vehicleNumber || '—'}
                              </div>
                              <div className="text-[11px] text-slate-500">{r.driverName || '—'}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                              {stats.totalCount}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {stats.isFullyHoliday ? (
                                <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 font-bold text-[11px]">
                                  ✓ Holiday Marked ({stats.holidayCountForRoute}/{stats.totalCount})
                                </span>
                              ) : stats.holidayCountForRoute > 0 ? (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-[11px]">
                                  Partial ({stats.holidayCountForRoute}/{stats.totalCount})
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium">Regular / Pending</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                disabled={isMarkingRoutesHoliday || stats.totalCount === 0}
                                onClick={() => executeMarkHolidayForRoutes([r])}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs cursor-pointer"
                              >
                                Mark Holiday (H)
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ===================================================================== */}
      {/* SUB-VIEW 6: UNMARKED & MISMATCH ATTENDANCE REPORT                     */}
      {/* ===================================================================== */}
      {activeSubView === 'unmarked_mismatch' &&
        (() => {
          const effectiveCampusScope: 'all' | 'Sr' | 'Jr' = lockedCampus
            ? (lockedCampus as 'Sr' | 'Jr')
            : discrepancyCampus;

          const auditData = analyzeAttendanceForDate({
            date: discrepancyDate,
            students,
            routes,
            attendanceRecords,
            campusScope: effectiveCampusScope,
            acknowledgements: attendanceAcknowledgements,
            changeRequests: attendanceChangeRequests,
          });

          const filterByRoute = (list: MemberAttendanceDiscrepancyItem[]) =>
            discrepancyRouteId === 'all'
              ? list
              : list.filter((item) => item.route.id === discrepancyRouteId);

          const filteredBothNotMarked = filterByRoute(auditData.bothNotMarked);
          const filteredSingleShift = filterByRoute(auditData.singleShiftNotMarked);
          const filteredMismatches = filterByRoute(auditData.statusMismatches);

          const scopedChangeRequests = attendanceChangeRequests.filter((r) =>
            effectiveCampusScope === 'all' ? true : r.campus === effectiveCampusScope
          );
          const scopedAcknowledgements = attendanceAcknowledgements.filter((a) =>
            effectiveCampusScope === 'all'
              ? true
              : a.campus.toLowerCase() === effectiveCampusScope.toLowerCase()
          );

          const handleQuickMarkUnmarkedOnly = async (
            item: MemberAttendanceDiscrepancyItem,
            shift: 'arrival' | 'departure' | 'both',
            statusValue: 'Present' | 'Absent' | 'Leave'
          ) => {
            const entries: Array<{
              recordId: string;
              source: 'driver' | 'assistant';
              value: string;
              reason?: string;
            }> = [];

            if (
              (shift === 'arrival' || shift === 'both') &&
              item.arrivalStatus === 'Pending'
            ) {
              entries.push({
                recordId: item.recordId,
                source: 'driver',
                value: statusValue,
                reason: `Marked unmarked Arrival by ${currentRole}`,
              });
            }
            if (
              (shift === 'departure' || shift === 'both') &&
              item.departureStatus === 'Pending'
            ) {
              entries.push({
                recordId: item.recordId,
                source: 'assistant',
                value: statusValue,
                reason: `Marked unmarked Departure by ${currentRole}`,
              });
            }

            if (entries.length === 0) return;

            if (onBatchSaveAttendance) {
              await onBatchSaveAttendance(entries);
            } else {
              for (const entry of entries) {
                await onMarkAttendance(entry.recordId, entry.source, entry.value, entry.reason);
              }
            }
            setStatusFeedback(
              `✓ Marked unmarked ${shift} attendance as ${statusValue} for ${item.student.name} (${item.route.code}) without altering already-marked records.`
            );
            setTimeout(() => setStatusFeedback(null), 4000);
          };

          const handleBulkMarkRouteUnmarkedAsPresent = async (
            routeIdFilter?: string,
            shiftMode: 'arrival' | 'departure' | 'both' = 'both'
          ) => {
            const targetItems = auditData.allItems.filter(
              (item) =>
                item.category !== 'status_mismatch' &&
                (!routeIdFilter || routeIdFilter === 'all' || item.route.id === routeIdFilter)
            );
            const entries: Array<{
              recordId: string;
              source: 'driver' | 'assistant';
              value: string;
              reason?: string;
            }> = [];

            for (const item of targetItems) {
              if (
                (shiftMode === 'arrival' || shiftMode === 'both') &&
                item.arrivalStatus === 'Pending'
              ) {
                entries.push({
                  recordId: item.recordId,
                  source: 'driver',
                  value: 'Present',
                  reason: `Bulk marked unmarked Arrival as Present by ${currentRole}`,
                });
              }
              if (
                (shiftMode === 'departure' || shiftMode === 'both') &&
                item.departureStatus === 'Pending'
              ) {
                entries.push({
                  recordId: item.recordId,
                  source: 'assistant',
                  value: 'Present',
                  reason: `Bulk marked unmarked Departure as Present by ${currentRole}`,
                });
              }
            }

            if (entries.length === 0) {
              setStatusFeedback('No unmarked (Pending) attendance records found for selection.');
              setTimeout(() => setStatusFeedback(null), 3500);
              return;
            }

            if (onBatchSaveAttendance) {
              await onBatchSaveAttendance(entries);
            } else {
              for (const entry of entries) {
                await onMarkAttendance(entry.recordId, entry.source, entry.value, entry.reason);
              }
            }
            setStatusFeedback(
              `✓ Marked ${entries.length} unmarked attendance entry/entries as Present without altering any already-marked records.`
            );
            setTimeout(() => setStatusFeedback(null), 4500);
          };

          return (
            <div className="space-y-5">
              {statusFeedback && (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{statusFeedback}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatusFeedback(null)}
                    className="text-emerald-700 hover:text-emerald-950 font-black cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Top Filter & Date Control Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[11px]">
                        Role: {currentRole}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-bold text-[11px]">
                        Campus Scope:{' '}
                        {effectiveCampusScope === 'all'
                          ? 'All Campuses (Sr & Jr)'
                          : `${effectiveCampusScope} Campus Only`}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      Unmarked Attendance &amp; Status Mismatch Report
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDiscrepancyDate(todayStr)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                        discrepancyDate === todayStr
                          ? 'bg-slate-900 text-amber-400 border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Today ({todayStr})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscrepancyDate(yesterdayStr)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                        discrepancyDate === yesterdayStr
                          ? 'bg-slate-900 text-amber-400 border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Yesterday ({yesterdayStr})
                    </button>
                    <input
                      type="date"
                      value={discrepancyDate}
                      max={todayStr}
                      onChange={(e) => setDiscrepancyDate(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Campus Filter
                    </label>
                    <select
                      value={effectiveCampusScope}
                      disabled={Boolean(lockedCampus)}
                      onChange={(e) =>
                        setDiscrepancyCampus(e.target.value as 'all' | 'Sr' | 'Jr')
                      }
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 disabled:opacity-70"
                    >
                      {!lockedCampus && <option value="all">All Campuses (Sr &amp; Jr)</option>}
                      {(!lockedCampus || lockedCampus === 'Sr') && (
                        <option value="Sr">Senior Campus (Sr)</option>
                      )}
                      {(!lockedCampus || lockedCampus === 'Jr') && (
                        <option value="Jr">Junior Campus (Jr)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Filter by Route
                    </label>
                    <select
                      value={discrepancyRouteId}
                      onChange={(e) => setDiscrepancyRouteId(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-900"
                    >
                      <option value="all">All Routes ({auditData.routeSummaries.length})</option>
                      {auditData.routeSummaries.map((rs) => (
                        <option key={rs.route.id} value={rs.route.id}>
                          {rs.route.code} — {rs.route.vehicleNumber} (Both Unmarked: {rs.bothNotMarkedCount}, Single Unmarked: {rs.singleShiftNotMarkedCount}, Mismatch: {rs.statusMismatchCount})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleBulkMarkRouteUnmarkedAsPresent(discrepancyRouteId, 'both')}
                      className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-2xs"
                      title="Marks only Pending entries as Present; already-marked members are untouched"
                    >
                      Mark Only Unmarked as Present
                    </button>
                    {onAcknowledgeUnmarkedAttendance && (
                      <button
                        type="button"
                        onClick={() => {
                          onAcknowledgeUnmarkedAttendance({
                            date: discrepancyDate,
                            routeId: discrepancyRouteId === 'all' ? 'ALL' : discrepancyRouteId,
                            routeCode:
                              discrepancyRouteId === 'all'
                                ? 'All Routes'
                                : routes.find((r) => r.id === discrepancyRouteId)?.code || 'Route',
                            campus: effectiveCampusScope === 'all' ? 'All' : effectiveCampusScope,
                            note: `Acknowledged that ${discrepancyDate} unmarked/mismatched attendances were reviewed by ${currentRole}.`,
                          });
                          setStatusFeedback(
                            `✓ Acknowledged unmarked/mismatched attendance for ${discrepancyDate}.`
                          );
                          setTimeout(() => setStatusFeedback(null), 3500);
                        }}
                        className="py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer shadow-2xs"
                      >
                        Acknowledge ({discrepancyDate})
                      </button>
                    )}
                  </div>
                </div>

                {/* 4 Separate Category Tabs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDiscrepancyCategoryTab('both_not_marked')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      discrepancyCategoryTab === 'both_not_marked'
                        ? 'bg-rose-950 text-white border-rose-900 shadow-sm'
                        : 'bg-rose-50/70 text-rose-950 border-rose-200 hover:bg-rose-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider opacity-85">
                        1. Both Not Marked
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white">
                        {filteredBothNotMarked.length}
                      </span>
                    </div>
                    <div className="text-xs font-semibold mt-1 opacity-90">
                      Arrival &amp; Departure Both Pending
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscrepancyCategoryTab('single_shift_not_marked')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      discrepancyCategoryTab === 'single_shift_not_marked'
                        ? 'bg-amber-950 text-white border-amber-900 shadow-sm'
                        : 'bg-amber-50/80 text-amber-950 border-amber-200 hover:bg-amber-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider opacity-85">
                        2. Arrival OR Departure Unmarked
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950">
                        {filteredSingleShift.length}
                      </span>
                    </div>
                    <div className="text-xs font-semibold mt-1 opacity-90">
                      One Shift Marked, Other Not Marked
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscrepancyCategoryTab('status_mismatch')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      discrepancyCategoryTab === 'status_mismatch'
                        ? 'bg-indigo-950 text-white border-indigo-900 shadow-sm'
                        : 'bg-indigo-50/80 text-indigo-950 border-indigo-200 hover:bg-indigo-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider opacity-85">
                        3. Present vs. Absent Mismatch
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-600 text-white">
                        {filteredMismatches.length}
                      </span>
                    </div>
                    <div className="text-xs font-semibold mt-1 opacity-90">
                      Arrival &ne; Departure Status
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscrepancyCategoryTab('requests_acks')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      discrepancyCategoryTab === 'requests_acks'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider opacity-85">
                        4. Admin Change Requests &amp; Acks
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white">
                        {
                          scopedChangeRequests.filter(
                            (r) => r.status === 'Pending Admin Approval'
                          ).length
                        }
                      </span>
                    </div>
                    <div className="text-xs font-semibold mt-1 opacity-90">
                      {scopedChangeRequests.length} Requests • {scopedAcknowledgements.length} Acks
                    </div>
                  </button>
                </div>
              </div>

              {/* Partially Marked Routes Quick Strip */}
              {auditData.partiallyMarkedRoutes.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <h4 className="text-xs font-black uppercase tracking-wide text-amber-950">
                        Partially Marked Routes on {discrepancyDate} ({auditData.partiallyMarkedRoutes.length} Route(s) have a few members marked &amp; others left unmarked)
                      </h4>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {auditData.partiallyMarkedRoutes.map((pm) => (
                      <div
                        key={pm.route.id}
                        className="bg-white rounded-xl border border-amber-200 p-3 flex flex-col justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-900">
                              {pm.route.code} ({pm.route.vehicleNumber})
                            </span>
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold text-[10px]">
                              {pm.campus} Campus
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-1">
                            Arrival: <strong>{pm.arrivalMarkedCount}/{pm.totalMembers}</strong> marked (
                            <span className="text-rose-600 font-bold">{pm.arrivalPendingCount} left</span>) • Departure:{' '}
                            <strong>{pm.departureMarkedCount}/{pm.totalMembers}</strong> marked (
                            <span className="text-rose-600 font-bold">{pm.departurePendingCount} left</span>)
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                          {pm.arrivalPendingCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSubView('board');
                                setBoardMode('arrival');
                                setSelectedDate(discrepancyDate);
                                setSelectedRouteId(pm.route.id);
                                setSelectedTripId(`dt-${pm.route.id}-${discrepancyDate}`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Mark Remaining Arrival ({pm.arrivalPendingCount})
                            </button>
                          )}
                          {pm.departurePendingCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSubView('board');
                                setBoardMode('departure');
                                setSelectedDate(discrepancyDate);
                                setSelectedRouteId(pm.route.id);
                                setSelectedTripId(`dt-${pm.route.id}-${discrepancyDate}`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Mark Remaining Departure ({pm.departurePendingCount})
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 1, 2, 3 Table */}
              {discrepancyCategoryTab !== 'requests_acks' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold">
                        {discrepancyCategoryTab === 'both_not_marked'
                          ? `1. Members with BOTH Arrival & Departure Attendance Not Marked (${filteredBothNotMarked.length})`
                          : discrepancyCategoryTab === 'single_shift_not_marked'
                          ? `2. Members with Single Shift Not Marked — Arrival OR Departure Pending (${filteredSingleShift.length})`
                          : `3. Members with Arrival vs. Departure Status Mismatch — Present vs. Absent (${filteredMismatches.length})`}
                      </h4>
                      <p className="text-[11px] text-slate-300">
                        Date: {discrepancyDate} •{' '}
                        {discrepancyCategoryTab === 'status_mismatch'
                          ? isAdmin
                            ? 'Admin can directly update status or approve change requests.'
                            : `${currentRole} cannot alter already-marked attendance directly — click "Request Change to Admin" or "Skip".`
                          : 'Click P / A / L to mark ONLY the unmarked shift without altering any already-marked attendance.'}
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const activeRows =
                      discrepancyCategoryTab === 'both_not_marked'
                        ? filteredBothNotMarked
                        : discrepancyCategoryTab === 'single_shift_not_marked'
                        ? filteredSingleShift
                        : filteredMismatches;

                    if (activeRows.length === 0) {
                      return (
                        <div className="p-10 text-center text-xs text-slate-400">
                          No members found in this category for {discrepancyDate}.
                        </div>
                      );
                    }

                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                              <th className="py-2.5 px-3">#</th>
                              <th className="py-2.5 px-3">Member Name &amp; ID</th>
                              <th className="py-2.5 px-3">Campus &amp; Class</th>
                              <th className="py-2.5 px-3">Route &amp; Stop</th>
                              <th className="py-2.5 px-3 text-center">Arrival (In)</th>
                              <th className="py-2.5 px-3 text-center">Departure (Out)</th>
                              <th className="py-2.5 px-3">Discrepancy / Remark</th>
                              <th className="py-2.5 px-3 text-right">
                                Action (Mark Unmarked Only / Request Admin Change)
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activeRows.map((item, idx) => {
                              const arrPending = item.arrivalStatus === 'Pending';
                              const depPending = item.departureStatus === 'Pending';
                              return (
                                <tr key={`${item.recordId}-${idx}`} className="hover:bg-slate-50">
                                  <td className="py-2.5 px-3 font-mono text-slate-400">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-bold text-slate-900">
                                      {item.student.name}
                                    </div>
                                    <div className="font-mono text-[10px] text-slate-500">
                                      {item.student.admissionNo} • {item.student.mobile}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        item.campus === 'Jr'
                                          ? 'bg-amber-100 text-amber-900'
                                          : 'bg-indigo-100 text-indigo-900'
                                      }`}
                                    >
                                      {item.campus} Campus
                                    </span>
                                    <div className="text-[11px] text-slate-600 mt-0.5">
                                      Class {item.student.class}-{item.student.section}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-mono font-bold text-slate-800">
                                      {item.route.code} ({item.route.vehicleNumber})
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {item.student.pickupDropStopName || item.student.villageName}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        arrPending
                                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                          : item.arrivalStatus === 'Present'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-amber-100 text-amber-900'
                                      }`}
                                    >
                                      {arrPending ? 'NOT MARKED' : item.arrivalStatus}
                                    </span>
                                    {arrPending && (
                                      <div className="flex items-center justify-center gap-1 mt-1">
                                        {(['Present', 'Absent', 'Leave'] as const).map((st) => (
                                          <button
                                            key={st}
                                            type="button"
                                            onClick={() =>
                                              handleQuickMarkUnmarkedOnly(item, 'arrival', st)
                                            }
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-black cursor-pointer ${
                                              st === 'Present'
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                : st === 'Absent'
                                                ? 'bg-rose-600 text-white hover:bg-rose-700'
                                                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                            }`}
                                            title={`Mark Unmarked Arrival as ${st}`}
                                          >
                                            {st[0]}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        depPending
                                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                          : item.departureStatus === 'Present'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-amber-100 text-amber-900'
                                      }`}
                                    >
                                      {depPending ? 'NOT MARKED' : item.departureStatus}
                                    </span>
                                    {depPending && (
                                      <div className="flex items-center justify-center gap-1 mt-1">
                                        {(['Present', 'Absent', 'Leave'] as const).map((st) => (
                                          <button
                                            key={st}
                                            type="button"
                                            onClick={() =>
                                              handleQuickMarkUnmarkedOnly(item, 'departure', st)
                                            }
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-black cursor-pointer ${
                                              st === 'Present'
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                : st === 'Absent'
                                                ? 'bg-rose-600 text-white hover:bg-rose-700'
                                                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                            }`}
                                            title={`Mark Unmarked Departure as ${st}`}
                                          >
                                            {st[0]}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {item.category === 'both_not_marked' && (
                                      <span className="text-rose-700 font-semibold">
                                        Both Arrival &amp; Departure Not Marked
                                      </span>
                                    )}
                                    {item.category === 'arrival_not_marked' && (
                                      <span className="text-amber-800 font-semibold">
                                        Arrival Not Marked (Departure: {item.departureStatus})
                                      </span>
                                    )}
                                    {item.category === 'departure_not_marked' && (
                                      <span className="text-amber-800 font-semibold">
                                        Departure Not Marked (Arrival: {item.arrivalStatus})
                                      </span>
                                    )}
                                    {item.category === 'status_mismatch' && (
                                      <div>
                                        <span className="text-indigo-800 font-bold">
                                          Mismatch: In ({item.arrivalStatus}) vs Out ({item.departureStatus})
                                        </span>
                                        {item.mismatchReason && (
                                          <div className="text-[10px] text-slate-500">
                                            Note: {item.mismatchReason}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {item.isAcknowledged && (
                                      <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
                                        ✓ Acknowledged
                                      </div>
                                    )}
                                    {item.pendingChangeRequest && (
                                      <div className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5">
                                        Pending Admin Change Request ({item.pendingChangeRequest.proposedArrivalStatus} / {item.pendingChangeRequest.proposedDepartureStatus})
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                                      {(arrPending || depPending) && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveSubView('board');
                                            setBoardMode(arrPending ? 'arrival' : 'departure');
                                            setSelectedDate(item.date);
                                            setSelectedRouteId(item.route.id);
                                            setSelectedTripId(item.tripId);
                                          }}
                                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-[11px] cursor-pointer"
                                        >
                                          Open Route Board
                                        </button>
                                      )}

                                      {(!arrPending || !depPending) && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setChangeRequestModalTarget({
                                              studentId: item.student.id,
                                              studentName: item.student.name,
                                              admissionNo: item.student.admissionNo,
                                              classSection: `${item.student.class}-${item.student.section}`,
                                              routeId: item.route.id,
                                              routeCode: item.route.code,
                                              campus: item.campus,
                                              date: item.date,
                                              tripId: item.tripId,
                                              recordId: item.recordId,
                                              currentArrivalStatus: item.arrivalStatus,
                                              currentDepartureStatus: item.departureStatus,
                                              proposedArrivalStatus:
                                                item.arrivalStatus === 'Pending'
                                                  ? 'Present'
                                                  : item.arrivalStatus,
                                              proposedDepartureStatus:
                                                item.departureStatus === 'Pending'
                                                  ? 'Present'
                                                  : item.arrivalStatus !== 'Pending'
                                                  ? item.arrivalStatus
                                                  : item.departureStatus,
                                              reason: '',
                                            })
                                          }
                                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                                        >
                                          <Send className="w-3 h-3" />
                                          <span>
                                            {isAdmin
                                              ? 'Direct Change / Override'
                                              : 'Request Change to Admin'}
                                          </span>
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Category 4: Admin Change Requests & Yesterday Acknowledgements */}
              {discrepancyCategoryTab === 'requests_acks' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                      <h4 className="text-sm font-bold">
                        Attendance Change Requests Sent to Admin ({scopedChangeRequests.length})
                      </h4>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                      {scopedChangeRequests.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400">
                          No attendance change requests submitted yet.
                        </div>
                      ) : (
                        scopedChangeRequests.map((req) => (
                          <div key={req.id} className="p-4 space-y-2 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="font-bold text-slate-900">
                                  {req.studentName} ({req.admissionNo})
                                </span>
                                <span className="ml-2 px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold text-[10px]">
                                  {req.campus} Campus • Route {req.routeCode}
                                </span>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  req.status === 'Approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : req.status === 'Rejected'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>
                            <div className="text-slate-600">
                              Date: <strong className="font-mono">{req.date}</strong> • Current:{' '}
                              <strong>
                                In: {req.currentArrivalStatus} / Out: {req.currentDepartureStatus}
                              </strong>{' '}
                              &rarr; Proposed:{' '}
                              <strong className="text-indigo-700">
                                In: {req.proposedArrivalStatus} / Out: {req.proposedDepartureStatus}
                              </strong>
                            </div>
                            <div className="text-slate-700 italic">Reason: &ldquo;{req.reason}&rdquo;</div>
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                              <span>
                                Requested by <strong>{req.requestedBy}</strong> ({req.requestedByRole})
                              </span>
                              {isAdmin &&
                                req.status === 'Pending Admin Approval' &&
                                onReviewAttendanceChangeRequest && (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onReviewAttendanceChangeRequest(req.id, 'Approve')
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                                    >
                                      Approve &amp; Apply
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onReviewAttendanceChangeRequest(req.id, 'Reject')
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                      <h4 className="text-sm font-bold">
                        Unmarked / Mismatched Attendance Acknowledgements ({scopedAcknowledgements.length})
                      </h4>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                      {scopedAcknowledgements.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400">
                          No acknowledgements recorded yet.
                        </div>
                      ) : (
                        scopedAcknowledgements.map((ack) => (
                          <div key={ack.id} className="p-4 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-slate-900">
                                Date: {ack.date} • Route: {ack.routeCode} ({ack.campus})
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                Acknowledged
                              </span>
                            </div>
                            <p className="text-slate-700">{ack.note}</p>
                            <div className="text-[11px] text-slate-500">
                              By <strong>{ack.acknowledgedBy}</strong> ({ack.acknowledgedByRole}) at{' '}
                              {new Date(ack.acknowledgedAt).toLocaleString()}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      {/* ===================================================================== */}
      {/* MODAL: SEND REQUEST FOR CHANGE IN ATTENDANCE TO ADMIN                 */}
      {/* ===================================================================== */}
      {changeRequestModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-indigo-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black">
                  {isAdmin
                    ? 'Admin Direct Attendance Change'
                    : 'Send Attendance Change Request to Admin'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setChangeRequestModalTarget(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!changeRequestModalTarget.reason.trim()) return;
                if (isAdmin) {
                  // Admin applies change directly
                  const entries: Array<{
                    recordId: string;
                    source: 'driver' | 'assistant';
                    value: string;
                    reason?: string;
                  }> = [];
                  if (
                    changeRequestModalTarget.proposedArrivalStatus &&
                    changeRequestModalTarget.proposedArrivalStatus !== 'Pending'
                  ) {
                    entries.push({
                      recordId: changeRequestModalTarget.recordId,
                      source: 'driver',
                      value: changeRequestModalTarget.proposedArrivalStatus,
                      reason: changeRequestModalTarget.reason.trim(),
                    });
                  }
                  if (
                    changeRequestModalTarget.proposedDepartureStatus &&
                    changeRequestModalTarget.proposedDepartureStatus !== 'Pending'
                  ) {
                    entries.push({
                      recordId: changeRequestModalTarget.recordId,
                      source: 'assistant',
                      value: changeRequestModalTarget.proposedDepartureStatus,
                      reason: changeRequestModalTarget.reason.trim(),
                    });
                  }
                  if (entries.length > 0) {
                    if (onBatchSaveAttendance) {
                      await onBatchSaveAttendance(entries);
                    } else {
                      for (const ent of entries) {
                        await onMarkAttendance(ent.recordId, ent.source, ent.value, ent.reason);
                      }
                    }
                  }
                  setStatusFeedback(
                    `✓ Updated attendance for ${changeRequestModalTarget.studentName}.`
                  );
                  setTimeout(() => setStatusFeedback(null), 4000);
                  setChangeRequestModalTarget(null);
                  return;
                }

                if (onSubmitAttendanceChangeRequest) {
                  onSubmitAttendanceChangeRequest({
                    recordId: changeRequestModalTarget.recordId,
                    tripId: changeRequestModalTarget.tripId,
                    date: changeRequestModalTarget.date,
                    routeId: changeRequestModalTarget.routeId,
                    routeCode: changeRequestModalTarget.routeCode,
                    campus: changeRequestModalTarget.campus,
                    studentId: changeRequestModalTarget.studentId,
                    studentName: changeRequestModalTarget.studentName,
                    admissionNo: changeRequestModalTarget.admissionNo,
                    classSection: changeRequestModalTarget.classSection,
                    currentArrivalStatus: changeRequestModalTarget.currentArrivalStatus,
                    currentDepartureStatus: changeRequestModalTarget.currentDepartureStatus,
                    proposedArrivalStatus: changeRequestModalTarget.proposedArrivalStatus,
                    proposedDepartureStatus: changeRequestModalTarget.proposedDepartureStatus,
                    reason: changeRequestModalTarget.reason.trim(),
                    requestedBy: currentRole,
                    requestedByRole: currentRole,
                  });
                  setStatusFeedback(
                    `✓ Sent attendance change request for ${changeRequestModalTarget.studentName} to Admin for approval.`
                  );
                  setTimeout(() => setStatusFeedback(null), 4000);
                }
                setChangeRequestModalTarget(null);
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 text-sm">
                  {changeRequestModalTarget.studentName} ({changeRequestModalTarget.admissionNo})
                </div>
                <div className="text-slate-600">
                  Route: <strong>{changeRequestModalTarget.routeCode}</strong> • Campus:{' '}
                  <strong>{changeRequestModalTarget.campus}</strong> • Date:{' '}
                  <strong className="font-mono">{changeRequestModalTarget.date}</strong>
                </div>
                <div className="text-slate-600 pt-1">
                  Current Saved Attendance: Arrival:{' '}
                  <strong className="text-slate-900">
                    {changeRequestModalTarget.currentArrivalStatus}
                  </strong>{' '}
                  • Departure:{' '}
                  <strong className="text-slate-900">
                    {changeRequestModalTarget.currentDepartureStatus}
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Proposed Arrival Status
                  </label>
                  <select
                    value={changeRequestModalTarget.proposedArrivalStatus}
                    onChange={(e) =>
                      setChangeRequestModalTarget((prev) =>
                        prev
                          ? {
                              ...prev,
                              proposedArrivalStatus: e.target
                                .value as TripAttendanceRecord['driverStatus'],
                            }
                          : null
                      )
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-white"
                  >
                    <option value="Present">Present (P)</option>
                    <option value="Absent">Absent (A)</option>
                    <option value="Leave">Leave (L)</option>
                    <option value="Holiday">Holiday (H)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Proposed Departure Status
                  </label>
                  <select
                    value={changeRequestModalTarget.proposedDepartureStatus}
                    onChange={(e) =>
                      setChangeRequestModalTarget((prev) =>
                        prev
                          ? {
                              ...prev,
                              proposedDepartureStatus: e.target
                                .value as TripAttendanceRecord['assistantStatus'],
                            }
                          : null
                      )
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-white"
                  >
                    <option value="Present">Present (P)</option>
                    <option value="Absent">Absent (A)</option>
                    <option value="Leave">Leave (L)</option>
                    <option value="Holiday">Holiday (H)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason for Attendance Change / Mismatch Explanation *
                </label>
                <textarea
                  rows={3}
                  required
                  value={changeRequestModalTarget.reason}
                  onChange={(e) =>
                    setChangeRequestModalTarget((prev) =>
                      prev ? { ...prev, reason: e.target.value } : null
                    )
                  }
                  placeholder="Enter reason why attendance needs to be changed by Admin (e.g. Marked absent by mistake, or picked up by parent at dispersal)..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangeRequestModalTarget(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Skip / Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  {isAdmin ? 'Apply Attendance Change' : 'Submit Request to Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Holiday Success / Error Confirmation Popup Modal */}
      {holidayResultModal && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div
            className={`bg-white rounded-2xl border shadow-2xl max-w-md w-full overflow-hidden ${
              holidayResultModal.type === 'success'
                ? 'border-emerald-300'
                : 'border-rose-300'
            }`}
          >
            <div
              className={`px-5 py-4 flex items-center justify-between ${
                holidayResultModal.type === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {holidayResultModal.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-white shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-white shrink-0" />
                )}
                <h3 className="text-sm font-black uppercase tracking-wide">
                  {holidayResultModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHolidayResultModal(null)}
                className="text-white/80 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div
                className={`p-3.5 rounded-xl border space-y-2 ${
                  holidayResultModal.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <p className="font-bold text-sm leading-relaxed">
                  {holidayResultModal.message}
                </p>

                {holidayResultModal.type === 'success' && (
                  <div className="pt-2 border-t border-emerald-200/80 space-y-1.5 text-slate-700">
                    {holidayResultModal.date && (
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Holiday Date:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {holidayResultModal.date}
                        </span>
                      </div>
                    )}
                    {holidayResultModal.occasion && (
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Occasion / Remark:</span>
                        <span className="font-bold text-slate-900">
                          {holidayResultModal.occasion}
                        </span>
                      </div>
                    )}
                    {typeof holidayResultModal.memberCount === 'number' && (
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-600">Members Marked (H):</span>
                        <span className="font-bold text-emerald-800">
                          {holidayResultModal.memberCount} Member(s) (Arrival &amp; Departure)
                        </span>
                      </div>
                    )}
                    {holidayResultModal.routeNames && holidayResultModal.routeNames.length > 0 && (
                      <div className="pt-1">
                        <div className="font-semibold text-slate-600 mb-1">
                          Route(s) Marked ({holidayResultModal.routeNames.length}):
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                          {holidayResultModal.routeNames.map((rName) => (
                            <span
                              key={rName}
                              className="px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-emerald-900 font-bold text-[11px]"
                            >
                              ✓ {rName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setHolidayResultModal(null)}
                  className={`px-6 py-2.5 rounded-xl font-bold text-xs cursor-pointer shadow-xs ${
                    holidayResultModal.type === 'success'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  OK, Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import {
  CheckCircle, Printer, Calendar, Check, X,
  ArrowDownLeft, ArrowUpRight, FileSpreadsheet
} from 'lucide-react';
import {
  DailyTrip, TripAttendanceRecord, Route, StudentMember, CampusMaster, Vehicle, UserRole
} from '../../types/index.js';
import { PrintExportToolbar, FilterPopover, openHtmlPrintPreview, exportToCsv } from '../../utils/exportPrint.js';

interface DailyOperationsViewProps {
  schoolName?: string;
  isAdmin?: boolean;
  currentRole?: UserRole;
  campuses?: CampusMaster[];
  vehicles?: Vehicle[];
  trips: DailyTrip[];
  attendanceRecords: TripAttendanceRecord[];
  routes: Route[];
  students?: StudentMember[];
  initialSubTab?: string;
  onSelectTrip: (tripId: string) => void;
  onSelectRouteForDate?: (date: string, routeId: string) => Promise<void>;
  onMarkAttendance: (recordId: string, source: 'driver' | 'assistant', value: string, reason?: string) => Promise<any>;
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

export const DailyOperationsView: React.FC<DailyOperationsViewProps> = ({
  schoolName,
  isAdmin = true,
  currentRole = 'Admin',
  campuses = [],
  vehicles = [],
  trips,
  attendanceRecords,
  routes,
  students = [],
  initialSubTab,
  onSelectTrip,
  onSelectRouteForDate,
  onMarkAttendance,
  onVerifyTrip,
  onOpenPrintPack,
}) => {
  const [activeSubView, setActiveSubView] = useState<'board' | 'calendar' | 'summary' | 'pack'>(
    initialSubTab === 'pack'
      ? 'pack'
      : initialSubTab === 'summary'
      ? 'summary'
      : initialSubTab === 'calendar'
      ? 'calendar'
      : 'board'
  );

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

  useEffect(() => {
    if (initialSubTab === 'pack') setActiveSubView('pack');
    else if (initialSubTab === 'summary') setActiveSubView('summary');
    else if (initialSubTab === 'calendar') setActiveSubView('calendar');
    else if (initialSubTab === 'departure') {
      setActiveSubView('board');
      setBoardMode('departure');
    } else if (initialSubTab === 'arrival' || initialSubTab === 'board') {
      setActiveSubView('board');
      setBoardMode('arrival');
    }
  }, [initialSubTab]);

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('all');
  const [selectedRouteId, setSelectedRouteId] = useState<string>(routes[0]?.id || '');
  const [selectedTripId, setSelectedTripId] = useState<string>(trips[0]?.id || '');
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [isLoadingRouteTrip, setIsLoadingRouteTrip] = useState(false);

  // In Time & Out Time quick inputs on Arrival & Departure bar (auto-selected as per current system timings)
  const [tripInTime, setTripInTime] = useState<string>(() => getCurrentSystemTimeHHMM());
  const [tripOutTime, setTripOutTime] = useState<string>(() => getCurrentSystemTimeHHMM());

  // Prompt modal when user tries to mark Arrival/Departure attendance before marking Arrival/Departure time
  const [timeRequiredPrompt, setTimeRequiredPrompt] = useState<{
    mode: 'arrival' | 'departure';
    pendingAction?: {
      type: 'single' | 'all_holiday';
      rec?: TripAttendanceRecord;
      statusVal?: string;
    };
  } | null>(null);

  // Strength mismatch remark input in Attendance window
  const [tripMismatchRemarkInput, setTripMismatchRemarkInput] = useState<string>('');

  // Summary Sheet State (matching Narendra Edu Valley Transport Timings clipboard format)
  const [summaryDate, setSummaryDate] = useState<string>(todayStr);
  const [summaryCampus, setSummaryCampus] = useState<string>('All Campuses');
  const [campusInchargeName, setCampusInchargeName] = useState<string>('');
  const [filledByName, setFilledByName] = useState<string>('Transport Assistant');
  const [summaryRemarks, setSummaryRemarks] = useState<string>('');
  const [timingOverrides, setTimingOverrides] = useState<Record<string, SummaryTimingOverride>>({});

  // Filter routes by selected Vehicle and Campus
  const availableRoutesForDropdown = routes.filter((r) => {
    if (selectedCampus !== 'all' && r.campus !== selectedCampus) return false;
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

  const getMembersForRoute = (route: Route | undefined): StudentMember[] => {
    if (!route) return [];
    return students
      .filter((s) => {
        if (s.transportStatus === 'Left') return false;
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

  useEffect(() => {
    if (
      availableRoutesForDropdown.length > 0 &&
      !availableRoutesForDropdown.some((r) => r.id === selectedRouteId)
    ) {
      const nextRoute = availableRoutesForDropdown[0];
      setSelectedRouteId(nextRoute.id);
      if (onSelectRouteForDate) {
        onSelectRouteForDate(selectedDate, nextRoute.id);
      }
    }
  }, [selectedVehicleFilter, selectedCampus, routes]);

  const selectedRouteObj =
    routes.find((r) => r.id === selectedRouteId) || availableRoutesForDropdown[0] || routes[0];

  const matchedTripForRouteAndDate = trips.find(
    (t) =>
      t.date === selectedDate &&
      selectedRouteObj &&
      (t.routeId === selectedRouteObj.id || t.routeName === selectedRouteObj.code)
  );

  const currentTrip: DailyTrip | undefined =
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

  useEffect(() => {
    const nowHHMM = getCurrentSystemTimeHHMM();
    if (matchedTripForRouteAndDate) {
      if (matchedTripForRouteAndDate.id !== selectedTripId) {
        setSelectedTripId(matchedTripForRouteAndDate.id);
        onSelectTrip(matchedTripForRouteAndDate.id);
      }
      setTripInTime(matchedTripForRouteAndDate.inTime || nowHHMM);
      setTripOutTime(matchedTripForRouteAndDate.outTime || nowHHMM);
      setTripMismatchRemarkInput(matchedTripForRouteAndDate.strengthMismatchRemark || '');
    } else {
      setTripInTime(nowHHMM);
      setTripOutTime(nowHHMM);
      setTripMismatchRemarkInput('');
    }
  }, [
    matchedTripForRouteAndDate?.id,
    matchedTripForRouteAndDate?.inTime,
    matchedTripForRouteAndDate?.outTime,
    matchedTripForRouteAndDate?.strengthMismatchRemark,
    selectedRouteId,
    selectedDate,
    boardMode,
  ]);

  const handleRouteDropdownChange = async (newRouteId: string) => {
    setSelectedRouteId(newRouteId);
    const existingTrip = trips.find(
      (t) => t.date === selectedDate && t.routeId === newRouteId
    );
    if (existingTrip) {
      setSelectedTripId(existingTrip.id);
      onSelectTrip(existingTrip.id);
    } else if (onSelectRouteForDate) {
      setIsLoadingRouteTrip(true);
      try {
        await onSelectRouteForDate(selectedDate, newRouteId);
      } finally {
        setIsLoadingRouteTrip(false);
      }
    }
  };

  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    if (selectedRouteObj?.id && onSelectRouteForDate) {
      setIsLoadingRouteTrip(true);
      try {
        await onSelectRouteForDate(newDate, selectedRouteObj.id);
      } finally {
        setIsLoadingRouteTrip(false);
      }
    }
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

  const activeBoardStatus = (rec: TripAttendanceRecord) =>
    boardMode === 'arrival' ? rec.driverStatus : rec.assistantStatus;

  const presentCount = tripAttendanceList.filter((a) => activeBoardStatus(a) === 'Present').length;
  const absentCount = tripAttendanceList.filter((a) => activeBoardStatus(a) === 'Absent').length;
  const leaveCount = tripAttendanceList.filter((a) => activeBoardStatus(a) === 'Leave').length;
  const holidayCount = tripAttendanceList.filter((a) => activeBoardStatus(a) === 'Holiday').length;
  const pendingCount = tripAttendanceList.filter(
    (a) =>
      activeBoardStatus(a) !== 'Present' &&
      activeBoardStatus(a) !== 'Absent' &&
      activeBoardStatus(a) !== 'Leave' &&
      activeBoardStatus(a) !== 'Holiday'
  ).length;

  const isArrivalTimeMarked = Boolean(matchedTripForRouteAndDate?.inTime);
  const isDepartureTimeMarked = Boolean(matchedTripForRouteAndDate?.outTime);

  // Separate Arrival vs Departure counts for current route/trip
  const arrivalMarkedRecordsCount = tripAttendanceList.filter(
    (a) => a.driverStatus && a.driverStatus !== 'Pending'
  ).length;
  const departureMarkedRecordsCount = tripAttendanceList.filter(
    (a) => a.assistantStatus && a.assistantStatus !== 'Pending'
  ).length;
  const arrivalPresentStrength = tripAttendanceList.filter(
    (a) => a.driverStatus === 'Present'
  ).length;
  const departurePresentStrength = tripAttendanceList.filter(
    (a) => a.assistantStatus === 'Present'
  ).length;
  const hasStrengthMismatchOnBoard =
    arrivalMarkedRecordsCount > 0 &&
    departureMarkedRecordsCount > 0 &&
    arrivalPresentStrength !== departurePresentStrength;

  const autoDerivedMismatchSummary = tripAttendanceList
    .filter(
      (a) =>
        a.driverStatus &&
        a.driverStatus !== 'Pending' &&
        a.assistantStatus &&
        a.assistantStatus !== 'Pending' &&
        a.driverStatus !== a.assistantStatus
    )
    .map(
      (a) =>
        `${a.studentName.split(' ')[0]}(${a.driverStatus[0]}→${a.assistantStatus[0]}${
          a.resolutionReason || a.notes ? ': ' + (a.resolutionReason || a.notes) : ''
        })`
    )
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

  const handleMarkAllHoliday = async () => {
    if (boardMode === 'arrival' && !isArrivalTimeMarked) {
      setTripInTime((prev) => prev || getCurrentSystemTimeHHMM());
      setTimeRequiredPrompt({
        mode: 'arrival',
        pendingAction: { type: 'all_holiday' },
      });
      return;
    }
    if (boardMode === 'departure' && !isDepartureTimeMarked) {
      setTripOutTime((prev) => prev || getCurrentSystemTimeHHMM());
      setTimeRequiredPrompt({
        mode: 'departure',
        pendingAction: { type: 'all_holiday' },
      });
      return;
    }
    const targetSource = boardMode === 'arrival' ? 'driver' : 'assistant';
    for (const rec of tripAttendanceList) {
      await onMarkAttendance(rec.id, targetSource, 'Holiday');
    }
    setStatusFeedback(
      `Marked ${tripAttendanceList.length} member(s) as Holiday (H) in ${
        boardMode === 'arrival' ? 'Arrival' : 'Departure'
      } Attendance for ${selectedDate}`
    );
    setTimeout(() => setStatusFeedback(null), 3500);
  };

  const handleArrivalAttendanceClick = async (rec: TripAttendanceRecord, newArrStatus: string) => {
    if (!isArrivalTimeMarked) {
      setTripInTime((prev) => prev || getCurrentSystemTimeHHMM());
      setTimeRequiredPrompt({
        mode: 'arrival',
        pendingAction: { type: 'single', rec, statusVal: newArrStatus },
      });
      return;
    }
    await onMarkAttendance(rec.id, 'driver', newArrStatus);
  };

  const handleDepartureAttendanceClick = async (rec: TripAttendanceRecord, newDepStatus: string) => {
    if (!isDepartureTimeMarked) {
      setTripOutTime((prev) => prev || getCurrentSystemTimeHHMM());
      setTimeRequiredPrompt({
        mode: 'departure',
        pendingAction: { type: 'single', rec, statusVal: newDepStatus },
      });
      return;
    }
    const arrStatus = rec.driverStatus || 'Pending';
    // If Arrival Attendance was marked (not Pending) and does NOT match the newly chosen Departure Attendance, open Mismatch Reason Popup
    if (arrStatus !== 'Pending' && arrStatus !== newDepStatus) {
      setMismatchError(null);
      setMismatchPopup({
        recordId: rec.id,
        studentName: rec.studentName,
        admissionNo: rec.admissionNo,
        arrivalStatus: arrStatus,
        departureStatus: newDepStatus,
        reason: rec.resolutionReason || rec.notes || '',
      });
      return;
    }
    await onMarkAttendance(rec.id, 'assistant', newDepStatus);
  };

  const handleConfirmMismatchDeparture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mismatchPopup) return;
    const cleanReason = mismatchPopup.reason.trim();
    if (cleanReason.length < 3) {
      setMismatchError('Please enter a reason / remark for the mismatch between Arrival and Departure attendance.');
      return;
    }
    await onMarkAttendance(
      mismatchPopup.recordId,
      'assistant',
      mismatchPopup.departureStatus,
      cleanReason
    );
    setStatusFeedback(
      `Saved Departure Attendance (${mismatchPopup.departureStatus}) for ${mismatchPopup.studentName} with mismatch remark: "${cleanReason}"`
    );
    setMismatchPopup(null);
    setMismatchError(null);
    setTimeout(() => setStatusFeedback(null), 4000);
  };

  const handleMarkTripArrivalOrDeparture = async (mode: 'Arrived' | 'Departed') => {
    if (!currentTrip) return;
    const nowTime = getCurrentSystemTimeHHMM();
    const effectiveIn = mode === 'Arrived' ? (tripInTime || nowTime) : currentTrip.inTime;
    const effectiveOut = mode === 'Departed' ? (tripOutTime || nowTime) : currentTrip.outTime;

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

    await onVerifyTrip(currentTrip.id, note, mode, {
      inTime: mode === 'Arrived' ? effectiveIn : undefined,
      outTime: mode === 'Departed' ? effectiveOut : undefined,
      inStrength: inStrPayload,
      outStrength: outStrPayload,
    });

    setStatusFeedback(
      mode === 'Arrived'
        ? `${currentTrip.vehicleNumber} (${currentTrip.routeName}) Arrival Time marked as ${effectiveIn}. You can now mark Arrival Attendance.`
        : `${currentTrip.vehicleNumber} (${currentTrip.routeName}) Departure Time marked as ${effectiveOut}. You can now mark Departure Attendance.`
    );
    setTimeout(() => setStatusFeedback(null), 3500);
  };

  const handleConfirmMarkTimeFromPrompt = async () => {
    if (!timeRequiredPrompt || !currentTrip) return;
    const mode = timeRequiredPrompt.mode === 'arrival' ? 'Arrived' : 'Departed';
    const pending = timeRequiredPrompt.pendingAction;
    setTimeRequiredPrompt(null);
    await handleMarkTripArrivalOrDeparture(mode);

    if (pending) {
      if (pending.type === 'all_holiday') {
        const targetSource = timeRequiredPrompt.mode === 'arrival' ? 'driver' : 'assistant';
        for (const rec of tripAttendanceList) {
          await onMarkAttendance(rec.id, targetSource, 'Holiday');
        }
      } else if (pending.type === 'single' && pending.rec && pending.statusVal) {
        if (timeRequiredPrompt.mode === 'arrival') {
          await onMarkAttendance(pending.rec.id, 'driver', pending.statusVal);
        } else {
          const arrStatus = pending.rec.driverStatus || 'Pending';
          if (arrStatus !== 'Pending' && arrStatus !== pending.statusVal) {
            setMismatchError(null);
            setMismatchPopup({
              recordId: pending.rec.id,
              studentName: pending.rec.studentName,
              admissionNo: pending.rec.admissionNo,
              arrivalStatus: arrStatus,
              departureStatus: pending.statusVal,
              reason: pending.rec.resolutionReason || pending.rec.notes || '',
            });
          } else {
            await onMarkAttendance(pending.rec.id, 'assistant', pending.statusVal);
          }
        }
      }
    }
  };

  // --- Print Route List State ---
  const [packRouteId, setPackRouteId] = useState<string>(routes[0]?.id || '');
  const [packWeekStart, setPackWeekStart] = useState<string>(todayStr);
  const [packWeekEnd, setPackWeekEnd] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    if (!packRouteId && routes.length > 0) {
      setPackRouteId(routes[0].id);
    }
  }, [routes, packRouteId]);

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
  const selectedPackRoute = routes.find((r) => r.id === packRouteId) || routes[0];
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

  // --- Transport Timings & Attendance Summary Sheet Rows (per Vehicle, 1st & 2nd Trip) ---
  const summaryRows = vehicles.map((veh, idx) => {
    const vehTrips = trips.filter(
      (t) =>
        (t.vehicleId === veh.id || t.vehicleNumber === veh.registrationNumber) &&
        (!summaryDate || t.date === summaryDate)
    );
    const trip1 = vehTrips.find((t) => t.tripNumber === 1) || (vehTrips.length === 1 && vehTrips[0].tripNumber !== 2 ? vehTrips[0] : undefined);
    const trip2 = vehTrips.find((t) => t.tripNumber === 2);

    const getTripSummaryStats = (t: DailyTrip | undefined) => {
      if (!t) {
        return { inTime: '', inStr: '', outTime: '', outStr: '', remark: '' };
      }
      const tAtts = attendanceRecords.filter(
        (a) => a.tripId === t.id && (!summaryDate || a.date === summaryDate)
      );
      const hasArrAtt = tAtts.some((a) => a.driverStatus && a.driverStatus !== 'Pending');
      const arrPres = tAtts.filter((a) => a.driverStatus === 'Present').length;
      const hasDepAtt = tAtts.some((a) => a.assistantStatus && a.assistantStatus !== 'Pending');
      const depPres = tAtts.filter((a) => a.assistantStatus === 'Present').length;

      // Arrival (In) Time & Strength only from Arrival
      const inTime = t.inTime || '';
      const inStr = hasArrAtt
        ? String(arrPres).padStart(2, '0')
        : t.inTime && t.inStrength !== undefined
        ? String(t.inStrength).padStart(2, '0')
        : '';

      // Departure (Out) Time & Strength strictly from Departure (never fall back to Arrival presentCount!)
      const outTime = t.outTime || '';
      const outStr = hasDepAtt
        ? String(depPres).padStart(2, '0')
        : t.outTime && t.outStrength !== undefined && hasDepAtt
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

      const rawRemark = t.strengthMismatchRemark || memberRemarks || '';
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
    const ov = timingOverrides[veh.id] || {};

    return {
      sl: idx + 1,
      vehicleId: veh.id,
      vehicleLabel: veh.nickname ? `${veh.nickname} (${veh.registrationNumber.slice(-4)})` : veh.registrationNumber,
      registrationNumber: veh.registrationNumber,
      driverName: veh.assignedDriverName || trip1?.driverName || '—',
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
                <th colspan="5" style="text-align:left;">Campus : ${summaryCampus}</th>
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

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1500);
      }, 250);
    }
  };

  const formattedSummaryDate = summaryDate
    ? summaryDate.split('-').reverse().join('/')
    : '';

  return (
    <div className="space-y-5">
      {/* Unified Header & Toolbar (Scoped strictly to active Sidebar screen) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {activeSubView === 'pack'
              ? 'Print Route List'
              : activeSubView === 'summary'
              ? 'Attendance Summary Sheet'
              : activeSubView === 'calendar'
              ? 'Monthly Calendar (P/A/L/H)'
              : boardMode === 'departure'
              ? '2- Departure Attendance (School Dispersal)'
              : '1- Arrival Attendance (Morning Pickup)'}
          </h2>
          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            {activeSubView === 'board' && `${tripAttendanceList.length} Members`}
            {activeSubView === 'calendar' && `${routes.length} Routes`}
            {activeSubView === 'summary' && `${summaryRows.length} Vehicles`}
            {activeSubView === 'pack' && `Route Sheet`}
          </span>
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
                  setSelectedCampus('all');
                  setSelectedVehicleFilter('all');
                }}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Campus
                  </label>
                  <select
                    value={selectedCampus}
                    onChange={(e) => setSelectedCampus(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-800"
                  >
                    <option value="all">All Campuses</option>
                    {campuses.map((c) => (
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
                    {isAdmin ? 'Admin: Back-Date Allowed' : `${currentRole}: Today Only`}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="date"
                    value={selectedDate}
                    min={isAdmin ? undefined : todayStr}
                    max={todayStr}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      if (!isAdmin && nextDate !== todayStr) return;
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
                  value={selectedCampus}
                  onChange={(e) => setSelectedCampus(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-800"
                >
                  <option value="all">All Campuses</option>
                  {campuses.map((c) => (
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
                    availableRoutesForDropdown.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} — {r.name || `Trip ${r.tripNumber}`} ({r.vehicleNumber})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

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
                  {boardMode === 'arrival' ? (
                    <>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          isArrivalTimeMarked
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-900 border-amber-300'
                        }`}
                      >
                        {isArrivalTimeMarked
                          ? `✓ Arrival Time Marked: ${matchedTripForRouteAndDate?.inTime}`
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
                          ? `✓ Departure Time Marked: ${matchedTripForRouteAndDate?.outTime}`
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
                  {matchedTripForRouteAndDate?.inTime || '—'}
                </strong>{' '}
                • Strength:{' '}
                <strong className="font-mono text-slate-900">
                  {arrivalMarkedRecordsCount > 0
                    ? String(arrivalPresentStrength).padStart(2, '0')
                    : '—'}
                </strong>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-semibold">
                Departure (Out):{' '}
                <strong className="font-mono text-indigo-700">
                  {matchedTripForRouteAndDate?.outTime || '—'}
                </strong>{' '}
                • Strength:{' '}
                <strong className="font-mono text-slate-900">
                  {departureMarkedRecordsCount > 0
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

          {/* Clean Attendance Table — Separate for Arrival vs Departure */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
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
                      const arrStatus = rec.driverStatus || 'Pending';
                      const depStatus = rec.assistantStatus || 'Pending';
                      const currentMarked = boardMode === 'arrival' ? arrStatus : depStatus;
                      const hasMismatch =
                        boardMode === 'departure' &&
                        arrStatus !== 'Pending' &&
                        depStatus !== 'Pending' &&
                        arrStatus !== depStatus;
                      const remarkText = rec.resolutionReason || rec.notes || '';

                      return (
                        <tr
                          key={rec.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSuspended ? 'bg-rose-50/30' : ''
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
                                  className={`font-bold ${
                                    isSuspended ? 'text-rose-600' : 'text-slate-900'
                                  }`}
                                >
                                  {rec.studentName}
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
                                  arrStatus === 'Present'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : arrStatus === 'Absent'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : arrStatus === 'Leave'
                                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                                    : arrStatus === 'Holiday'
                                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}
                              >
                                {arrStatus === 'Pending' ? 'Not Marked' : `Arrival: ${arrStatus}`}
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
                                const activeColor =
                                  stVal === 'Present'
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : stVal === 'Absent'
                                    ? 'bg-rose-600 text-white shadow-2xs'
                                    : stVal === 'Leave'
                                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                                    : 'bg-indigo-600 text-white shadow-2xs';
                                const hoverColor =
                                  stVal === 'Present'
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
                                    onClick={() => {
                                      if (boardMode === 'arrival') {
                                        handleArrivalAttendanceClick(rec, stVal);
                                      } else {
                                        handleDepartureAttendanceClick(rec, stVal);
                                      }
                                    }}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                      isSelected ? activeColor : hoverColor
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
          </div>

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
                  value={summaryCampus}
                  onChange={(e) => setSummaryCampus(e.target.value)}
                  className="p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
                >
                  <option value="All Campuses">All Campuses</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={`${c.name} (${c.code})`}>
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
                    Campus : <span className="font-semibold ml-1">{summaryCampus}</span>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Route
                </label>
                <select
                  value={packRouteId}
                  onChange={(e) => setPackRouteId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
                >
                  {routes.map((r) => (
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
    </div>
  );
};

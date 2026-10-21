import React, { useState, useEffect } from 'react';
import {
  CheckCircle, Printer, Calendar, Check, X,
  ArrowDownLeft, ArrowUpRight, FileSpreadsheet
} from 'lucide-react';
import {
  DailyTrip, TripAttendanceRecord, Route, StudentMember, CampusMaster, Vehicle
} from '../../types/index.js';
import { PrintExportToolbar, FilterPopover } from '../../utils/exportPrint.js';

interface DailyOperationsViewProps {
  schoolName?: string;
  campuses?: CampusMaster[];
  vehicles?: Vehicle[];
  trips: DailyTrip[];
  attendanceRecords: TripAttendanceRecord[];
  routes: Route[];
  students?: StudentMember[];
  initialSubTab?: string;
  onSelectTrip: (tripId: string) => void;
  onSelectRouteForDate?: (date: string, routeId: string) => Promise<void>;
  onMarkAttendance: (recordId: string, source: 'driver' | 'assistant', value: string) => Promise<any>;
  onResolveMismatch: (recordId: string, value: string, reason: string) => Promise<any>;
  onVerifyTrip: (
    tripId: string,
    notes?: string,
    statusOverride?: 'Arrived' | 'Departed' | 'Completed',
    timingPayload?: { inTime?: string; outTime?: string; inStrength?: number; outStrength?: number }
  ) => Promise<any>;
  onCancelTrip: (tripId: string, reason: string) => Promise<any>;
  onOpenPrintPack: (routeId: string, shiftName: string, weekStartDate: string, weekEndDate?: string) => Promise<void>;
}

interface SummaryTimingOverride {
  inTime1?: string;
  inStrength1?: string;
  outTime1?: string;
  outStrength1?: string;
  inTime2?: string;
  inStrength2?: string;
  outTime2?: string;
  outStrength2?: string;
}

export const DailyOperationsView: React.FC<DailyOperationsViewProps> = ({
  schoolName,
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

  useEffect(() => {
    if (initialSubTab === 'pack') setActiveSubView('pack');
    else if (initialSubTab === 'summary') setActiveSubView('summary');
    else if (initialSubTab === 'calendar') setActiveSubView('calendar');
    else if (initialSubTab === 'board') setActiveSubView('board');
  }, [initialSubTab]);

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('all');
  const [selectedRouteId, setSelectedRouteId] = useState<string>(routes[0]?.id || '');
  const [selectedTripId, setSelectedTripId] = useState<string>(trips[0]?.id || '');
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [isLoadingRouteTrip, setIsLoadingRouteTrip] = useState(false);

  // In Time & Out Time quick inputs on Arrival & Departure bar
  const [tripInTime, setTripInTime] = useState<string>('07:45');
  const [tripOutTime, setTripOutTime] = useState<string>('02:10');

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
  const currentTrip =
    trips.find(
      (t) =>
        t.date === selectedDate &&
        (t.routeId === selectedRouteObj?.id || t.routeName === selectedRouteObj?.code)
    ) ||
    trips.find((t) => t.id === selectedTripId) ||
    trips[0];

  useEffect(() => {
    if (currentTrip) {
      if (currentTrip.id !== selectedTripId) {
        setSelectedTripId(currentTrip.id);
        onSelectTrip(currentTrip.id);
      }
      if (currentTrip.inTime) setTripInTime(currentTrip.inTime);
      if (currentTrip.outTime) setTripOutTime(currentTrip.outTime);
    }
  }, [currentTrip?.id]);

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
    if (selectedRouteId && onSelectRouteForDate) {
      setIsLoadingRouteTrip(true);
      try {
        await onSelectRouteForDate(newDate, selectedRouteId);
      } finally {
        setIsLoadingRouteTrip(false);
      }
    }
  };

  const tripAttendanceList = currentTrip
    ? attendanceRecords.filter((a) => a.tripId === currentTrip.id)
    : attendanceRecords;

  const presentCount = tripAttendanceList.filter((a) => a.assistantStatus === 'Present').length;
  const absentCount = tripAttendanceList.filter((a) => a.assistantStatus === 'Absent').length;
  const leaveCount = tripAttendanceList.filter((a) => a.assistantStatus === 'Leave').length;
  const holidayCount = tripAttendanceList.filter((a) => a.assistantStatus === 'Holiday').length;
  const pendingCount = tripAttendanceList.filter(
    (a) =>
      a.assistantStatus !== 'Present' &&
      a.assistantStatus !== 'Absent' &&
      a.assistantStatus !== 'Leave' &&
      a.assistantStatus !== 'Holiday'
  ).length;

  const handleMarkAllHoliday = async () => {
    for (const rec of tripAttendanceList) {
      await onMarkAttendance(rec.id, 'assistant', 'Holiday');
    }
    setStatusFeedback(`Marked ${tripAttendanceList.length} member(s) as Holiday (H) for ${selectedDate}`);
    setTimeout(() => setStatusFeedback(null), 3500);
  };

  const handleMarkTripArrivalOrDeparture = async (mode: 'Arrived' | 'Departed') => {
    if (!currentTrip) return;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const effectiveIn = mode === 'Arrived' ? (tripInTime || nowTime) : currentTrip.inTime;
    const effectiveOut = mode === 'Departed' ? (tripOutTime || nowTime) : currentTrip.outTime;
    const strengthVal = presentCount > 0 ? presentCount : tripAttendanceList.length;

    const note =
      mode === 'Arrived'
        ? `Arrived at ${effectiveIn} (Strength: ${strengthVal})`
        : `Departed at ${effectiveOut} (Strength: ${strengthVal})`;

    await onVerifyTrip(currentTrip.id, note, mode, {
      inTime: effectiveIn,
      outTime: effectiveOut,
      inStrength: mode === 'Arrived' ? strengthVal : currentTrip.inStrength,
      outStrength: mode === 'Departed' ? strengthVal : currentTrip.outStrength,
    });

    setStatusFeedback(
      mode === 'Arrived'
        ? `${currentTrip.vehicleNumber} (${currentTrip.routeName}) marked Arrived at ${effectiveIn} • Strength: ${strengthVal}`
        : `${currentTrip.vehicleNumber} (${currentTrip.routeName}) marked Departed at ${effectiveOut} • Strength: ${strengthVal}`
    );
    setTimeout(() => setStatusFeedback(null), 3500);
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
  const routeRosterMembers = students.filter(
    (s) =>
      (s.routeId === selectedPackRoute?.id || s.routeCode === selectedPackRoute?.code) &&
      s.transportStatus !== 'Left'
  );

  // --- Transport Timings & Attendance Summary Sheet Rows (per Vehicle, 1st & 2nd Trip) ---
  const summaryRows = vehicles.map((veh, idx) => {
    const vehTrips = trips.filter(
      (t) =>
        (t.vehicleId === veh.id || t.vehicleNumber === veh.registrationNumber) &&
        (!summaryDate || t.date === summaryDate || trips.every(tr => tr.date !== summaryDate))
    );
    const trip1 = vehTrips.find((t) => t.tripNumber === 1) || vehTrips[0];
    const trip2 = vehTrips.find((t) => t.tripNumber === 2);

    const ov = timingOverrides[veh.id] || {};
    const defaultIn1 = trip1?.inTime || (trip1?.status === 'Arrived' ? '07:45' : '');
    const defaultStr1 =
      trip1?.inStrength !== undefined
        ? String(trip1.inStrength).padStart(2, '0')
        : trip1?.presentCount
        ? String(trip1.presentCount).padStart(2, '0')
        : '';
    const defaultOut1 = trip1?.outTime || (trip1?.status === 'Departed' ? '02:10' : '');
    const defaultOutStr1 =
      trip1?.outStrength !== undefined
        ? String(trip1.outStrength).padStart(2, '0')
        : trip1?.presentCount
        ? String(trip1.presentCount).padStart(2, '0')
        : '';

    const defaultIn2 = trip2?.inTime || '';
    const defaultStr2 =
      trip2?.inStrength !== undefined
        ? String(trip2.inStrength).padStart(2, '0')
        : trip2?.presentCount
        ? String(trip2.presentCount).padStart(2, '0')
        : '';
    const defaultOut2 = trip2?.outTime || '';
    const defaultOutStr2 =
      trip2?.outStrength !== undefined
        ? String(trip2.outStrength).padStart(2, '0')
        : trip2?.presentCount
        ? String(trip2.presentCount).padStart(2, '0')
        : '';

    return {
      sl: idx + 1,
      vehicleId: veh.id,
      vehicleLabel: veh.nickname ? `${veh.nickname} (${veh.registrationNumber.slice(-4)})` : veh.registrationNumber,
      registrationNumber: veh.registrationNumber,
      driverName: veh.assignedDriverName || trip1?.driverName || '—',
      inTime1: ov.inTime1 !== undefined ? ov.inTime1 : defaultIn1,
      inStrength1: ov.inStrength1 !== undefined ? ov.inStrength1 : defaultStr1,
      outTime1: ov.outTime1 !== undefined ? ov.outTime1 : defaultOut1,
      outStrength1: ov.outStrength1 !== undefined ? ov.outStrength1 : defaultOutStr1,
      inTime2: ov.inTime2 !== undefined ? ov.inTime2 : defaultIn2,
      inStrength2: ov.inStrength2 !== undefined ? ov.inStrength2 : defaultStr2,
      outTime2: ov.outTime2 !== undefined ? ov.outTime2 : defaultOut2,
      outStrength2: ov.outStrength2 !== undefined ? ov.outStrength2 : defaultOutStr2,
    };
  });

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
        </tr>
        <tr>
          <td style="text-align:center;font-weight:600;">2nd</td>
          <td style="text-align:center;">${r.inTime2 || '—'}</td>
          <td style="text-align:center;">${r.inStrength2 || '—'}</td>
          <td style="text-align:center;">${r.outTime2 || '—'}</td>
          <td style="text-align:center;">${r.outStrength2 || '—'}</td>
        </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
      <html>
        <head>
          <title>Transport Timings - ${schoolName || 'Narendra Edu Valley'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; border: 2px solid #0f172a; font-size: 12px; }
            th, td { border: 1px solid #0f172a; padding: 6px 8px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <table>
            <thead>
              <tr><th colspan="8" style="font-size:22px;font-weight:800;text-align:center;padding:10px;">${schoolName || 'Narendra Edu Valley'}</th></tr>
              <tr><th colspan="8" style="font-size:12px;text-transform:uppercase;text-align:center;background:#f8fafc;">Transport Timings & Attendance Summary</th></tr>
              <tr>
                <th colspan="4" style="text-align:left;">Campus : ${summaryCampus}</th>
                <th colspan="4" style="text-align:left;">Date :- ${formattedSummaryDate}</th>
              </tr>
              <tr style="background:#f1f5f9;">
                <th>Sl</th><th>Vehicle</th><th>Driver</th><th>Trip</th><th>In Time</th><th>Strength</th><th>Out Time</th><th>Strength</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr><td colspan="4"><strong>Campus Incharge:</strong> ${campusInchargeName || '________________'}</td><td colspan="4"><strong>Filled By:</strong> ${filledByName || '________________'}</td></tr>
              <tr><td colspan="4" style="padding:14px 8px;">Signature:</td><td colspan="4" style="padding:14px 8px;">Signature:</td></tr>
              <tr><td colspan="8"><strong>Remarks:</strong> ${summaryRemarks || '—'}</td></tr>
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
              : 'Arrival & Departure Attendance'}
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
                title={`Attendance — ${currentTrip?.routeName || selectedRouteObj?.code || 'Route'}`}
                filename="school_attendance"
                schoolName={schoolName}
                filteredData={tripAttendanceList}
                allData={tripAttendanceList}
                hasActiveFilters={true}
                filterSummary={`Date: ${selectedDate} | Vehicle: ${currentTrip?.vehicleNumber || selectedRouteObj?.vehicleNumber || 'All'} | Route: ${currentTrip?.routeName || selectedRouteObj?.code || 'All'}`}
                columns={[
                  { header: 'ID / Adm No', accessor: (r) => r.admissionNo },
                  { header: 'Member Name', accessor: (r) => r.studentName },
                  { header: 'Class / Dept', accessor: (r) => r.classSection },
                  { header: 'Transport Stop', accessor: (r) => r.stopName },
                  { header: 'Status', accessor: (r) => r.transportStatus },
                  { header: 'Attendance', accessor: (r) => r.assistantStatus },
                ]}
              />
            </>
          )}

          {activeSubView === 'calendar' && (
            <>
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
                title={`Monthly Attendance Register — ${selectedRouteObj?.code || 'Route'}`}
                filename="monthly_attendance_calendar"
                schoolName={schoolName}
                filteredData={students.filter(
                  (s) =>
                    s.transportStatus !== 'Left' &&
                    (!selectedRouteObj || s.routeId === selectedRouteObj.id || s.routeCode === selectedRouteObj.code)
                )}
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
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Date
                </label>
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
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
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">In Time:</span>
                    <input
                      type="time"
                      value={tripInTime}
                      onChange={(e) => setTripInTime(e.target.value)}
                      className="font-mono font-bold text-slate-800 bg-transparent focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMarkTripArrivalOrDeparture('Arrived')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-2xs"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Mark Arrival</span>
                  </button>

                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-xs ml-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Out Time:</span>
                    <input
                      type="time"
                      value={tripOutTime}
                      onChange={(e) => setTripOutTime(e.target.value)}
                      className="font-mono font-bold text-slate-800 bg-transparent focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMarkTripArrivalOrDeparture('Departed')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer shadow-2xs"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Mark Departure</span>
                  </button>
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

          {/* Clean Attendance Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-3">Class / Dept</th>
                    <th className="py-3 px-3">Transport Stop</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Attendance (P / A / L / H)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingRouteTrip ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Loading route members...
                      </td>
                    </tr>
                  ) : tripAttendanceList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No members assigned to this route.
                      </td>
                    </tr>
                  ) : (
                    tripAttendanceList.map((rec) => {
                      const stuObj = students.find((s) => s.id === rec.studentId);
                      const isSuspended = rec.transportStatus === 'Suspended';
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
                          <td className="py-2.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onMarkAttendance(rec.id, 'assistant', 'Present')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                  rec.assistantStatus === 'Present'
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-slate-100 hover:bg-emerald-50 text-slate-700'
                                }`}
                              >
                                <span>P (Present)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onMarkAttendance(rec.id, 'assistant', 'Absent')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                  rec.assistantStatus === 'Absent'
                                    ? 'bg-rose-600 text-white shadow-2xs'
                                    : 'bg-slate-100 hover:bg-rose-50 text-slate-700'
                                }`}
                              >
                                <span>A (Absent)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onMarkAttendance(rec.id, 'assistant', 'Leave')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                  rec.assistantStatus === 'Leave'
                                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                                    : 'bg-slate-100 hover:bg-amber-50 text-slate-700'
                                }`}
                              >
                                <span>L (Leave)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onMarkAttendance(rec.id, 'assistant', 'Holiday')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                  rec.assistantStatus === 'Holiday'
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'bg-slate-100 hover:bg-indigo-50 text-slate-700'
                                }`}
                              >
                                <span>H (Holiday)</span>
                              </button>
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
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-VIEW 1B: MONTHLY CALENDAR VIEW WITH P, A, L, H SHOWN              */}
      {/* ===================================================================== */}
      {activeSubView === 'calendar' && (
        <div className="space-y-4">

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="py-2.5 px-3 sticky left-0 bg-slate-900 z-10">Member Name</th>
                    <th className="py-2.5 px-2">Stop</th>
                    {Array.from({ length: 15 }, (_, idx) => idx + 1).map((dayNum) => (
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
                  {students
                    .filter(
                      (s) =>
                        s.transportStatus !== 'Left' &&
                        (!selectedRouteObj || s.routeId === selectedRouteObj.id || s.routeCode === selectedRouteObj.code)
                    )
                    .map((stu, sIdx) => {
                      let pCnt = 0;
                      let aCnt = 0;
                      let lCnt = 0;
                      let hCnt = 0;
                      const todayDay = Number(selectedDate.split('-')[2] || 15);
                      const recToday = tripAttendanceList.find((r) => r.studentId === stu.id);

                      const cells = Array.from({ length: 15 }, (_, idx) => {
                        const d = idx + 1;
                        let code: 'P' | 'A' | 'L' | 'H' = 'P';
                        if (d === todayDay && recToday) {
                          if (recToday.assistantStatus === 'Absent') code = 'A';
                          else if (recToday.assistantStatus === 'Leave') code = 'L';
                          else if (recToday.assistantStatus === 'Holiday') code = 'H';
                          else code = 'P';
                        } else if (d % 7 === 0) {
                          code = 'H';
                        } else if ((sIdx + d) % 13 === 0) {
                          code = 'L';
                        } else if ((sIdx + d) % 19 === 0) {
                          code = 'A';
                        }
                        if (code === 'P') pCnt++;
                        if (code === 'A') aCnt++;
                        if (code === 'L') lCnt++;
                        if (code === 'H') hCnt++;
                        return { d, code };
                      });

                      return (
                        <tr key={stu.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-900 sticky left-0 bg-white">
                            {stu.name}
                            <span className="block text-[9px] font-mono text-slate-400">{stu.admissionNo}</span>
                          </td>
                          <td className="py-2 px-2 text-slate-600">{stu.pickupDropStopName || stu.morningStopName}</td>
                          {cells.map(({ d, code }) => (
                            <td key={d} className="py-2 px-1 text-center font-mono font-bold">
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
                            </td>
                          ))}
                          <td className="py-2 px-2 text-center font-mono font-bold text-emerald-700 bg-emerald-50/50">{pCnt}</td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-rose-700 bg-rose-50/50">{aCnt}</td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-amber-700 bg-amber-50/50">{lCnt}</td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-indigo-700 bg-indigo-50/50">{hCnt}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
          <div className="bg-white rounded-2xl border-2 border-slate-800 p-6 shadow-xs max-w-4xl mx-auto print:border-black print:shadow-none print:p-2">
            <table className="w-full border-collapse border-2 border-slate-800 text-xs text-slate-900">
              <thead>
                {/* Row 1: Institute Header */}
                <tr>
                  <th
                    colSpan={8}
                    className="border-2 border-slate-800 py-2.5 px-4 text-center text-2xl font-extrabold tracking-wide text-slate-900"
                  >
                    {schoolName || 'Narendra Edu Valley'}
                  </th>
                </tr>
                {/* Row 2: Sub-header "Transport Timings" */}
                <tr>
                  <th
                    colSpan={8}
                    className="border border-slate-800 py-1 px-4 text-center text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-50"
                  >
                    Transport Timings
                  </th>
                </tr>
                {/* Row 3: Campus & Date */}
                <tr>
                  <th
                    colSpan={4}
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
                  <th className="border border-slate-800 py-2 px-3 text-left">Vehicle</th>
                  <th className="border border-slate-800 py-2 px-3 text-left">Driver</th>
                  <th className="border border-slate-800 py-2 px-2 w-16 text-center">Trip</th>
                  <th className="border border-slate-800 py-2 px-2 w-24 text-center">In Time</th>
                  <th className="border border-slate-800 py-2 px-2 w-20 text-center">Strength</th>
                  <th className="border border-slate-800 py-2 px-2 w-24 text-center">Out Time</th>
                  <th className="border border-slate-800 py-2 px-2 w-20 text-center">Strength</th>
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
                        className="border border-slate-800 py-2 px-3 font-bold align-middle"
                      >
                        <div>{row.vehicleLabel}</div>
                        <div className="text-[10px] font-mono text-slate-600 font-normal">
                          {row.registrationNumber}
                        </div>
                      </td>
                      <td
                        rowSpan={2}
                        className="border border-slate-800 py-2 px-3 font-medium align-middle"
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
                    </tr>
                  </React.Fragment>
                ))}

                {/* Footer Sign-Off Block matching uploaded manual sheet */}
                <tr>
                  <td colSpan={4} className="border border-slate-800 py-1.5 px-3 font-bold">
                    Campus Incharge
                  </td>
                  <td colSpan={4} className="border border-slate-800 py-1.5 px-3 font-bold">
                    Filled By
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="border border-slate-800 py-2 px-3 font-semibold">
                    Name :- <span className="ml-2 font-bold">{campusInchargeName}</span>
                  </td>
                  <td colSpan={4} className="border border-slate-800 py-2 px-3 font-semibold">
                    Name :- <span className="ml-2 font-bold">{filledByName}</span>
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="border border-slate-800 py-3 px-3 font-semibold">
                    Signature
                  </td>
                  <td colSpan={4} className="border border-slate-800 py-3 px-3 font-semibold">
                    Signature
                  </td>
                </tr>
                <tr>
                  <td colSpan={8} className="border border-slate-800 py-2.5 px-3 font-semibold">
                    <div className="flex items-center gap-2">
                      <span>Remarks :-</span>
                      <input
                        type="text"
                        value={summaryRemarks}
                        onChange={(e) => setSummaryRemarks(e.target.value)}
                        placeholder="Add remarks (if any)..."
                        className="flex-1 bg-transparent focus:outline-hidden font-normal"
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

              <div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenPrintPack(
                      selectedPackRoute?.id || '',
                      `Trip ${selectedPackRoute?.tripNumber || 1}`,
                      packWeekStart,
                      packWeekEnd
                    )
                  }
                  className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Route List</span>
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

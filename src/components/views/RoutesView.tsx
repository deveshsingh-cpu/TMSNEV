import React, { useState, useEffect } from 'react';
import { MapPin, Bus, Filter, Search, X, ChevronDown, ChevronUp, Users, Clock, Edit2, Check, Printer, FileSpreadsheet } from 'lucide-react';
import { Route, ScheduledService, Village, TransportStop, Vehicle, CampusMaster, StudentMember } from '../../types/index.js';
import { PrintExportToolbar, FilterPopover, openHtmlPrintPreview, exportToCsv } from '../../utils/exportPrint.js';
import { api } from '../../services/api.js';

interface RoutesViewProps {
  schoolName?: string;
  campuses?: CampusMaster[];
  routes: Route[];
  services: ScheduledService[];
  villages: Village[];
  stops: TransportStop[];
  vehicles: Vehicle[];
  students?: StudentMember[];
  initialSubTab?: string;
  onOpenPrintPack?: (
    routeId: string,
    shiftName: string,
    weekStartDate: string,
    weekEndDate?: string
  ) => Promise<void>;
}

export const RoutesView: React.FC<RoutesViewProps> = ({
  schoolName,
  campuses = [],
  routes,
  services,
  villages,
  stops,
  vehicles,
  students = [],
  initialSubTab = 'routes',
  onOpenPrintPack,
}) => {
  const [activeTab, setActiveTab] = useState<'routes' | 'multi_trips' | 'villages_stops' | 'pack'>(
    initialSubTab === 'services'
      ? 'multi_trips'
      : initialSubTab === 'villages_stops'
      ? 'villages_stops'
      : initialSubTab === 'pack'
      ? 'pack'
      : 'routes'
  );

  useEffect(() => {
    if (initialSubTab === 'services') setActiveTab('multi_trips');
    else if (initialSubTab === 'villages_stops') setActiveTab('villages_stops');
    else if (initialSubTab === 'pack') setActiveTab('pack');
    else if (initialSubTab === 'routes') setActiveTab('routes');
  }, [initialSubTab]);

  const [selectedRoute, setSelectedRoute] = useState<Route | null>(routes[0] || null);
  const [campusFilter, setCampusFilter] = useState<string>('all');
  const [routeVehicleFilter, setRouteVehicleFilter] = useState<string>('all');

  // Expand / collapse state for village member lists under any route (key: `${routeId}__${villageName}`)
  const [expandedRouteVillages, setExpandedRouteVillages] = useState<Record<string, boolean>>({});

  // Expand / collapse state for member lists in Vehicle Schedule (key: service.id)
  const [expandedServiceMembers, setExpandedServiceMembers] = useState<Record<string, boolean>>({});

  // Editable timings state in Vehicle Schedule
  const [editingTimingServiceId, setEditingTimingServiceId] = useState<string | null>(null);
  const [editDepartureTime, setEditDepartureTime] = useState<string>('');
  const [editArrivalTime, setEditArrivalTime] = useState<string>('');
  const [savingTiming, setSavingTiming] = useState<boolean>(false);

  const toggleRouteVillageExpand = (routeId: string, villageName: string) => {
    const key = `${routeId}__${villageName.trim().toLowerCase()}`;
    setExpandedRouteVillages(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isRouteVillageExpanded = (routeId: string, villageName: string) => {
    const key = `${routeId}__${villageName.trim().toLowerCase()}`;
    return Boolean(expandedRouteVillages[key]);
  };

  const getMembersForRouteAndVillage = (route: Route, villageName?: string) => {
    const vNorm = (villageName || '').trim().toLowerCase();
    return students.filter(s => {
      if (s.transportStatus === 'Left') return false;
      const matchesRoute = s.routeId === route.id || s.routeCode === route.code;
      if (!matchesRoute) return false;
      if (!vNorm) return true;
      return (s.villageName || '').trim().toLowerCase() === vNorm;
    });
  };

  // Village selection for dependent Transport Stops view
  const [selectedVillageId, setSelectedVillageId] = useState<string>(villages[0]?.id || '');
  const [villageSearchQuery, setVillageSearchQuery] = useState<string>('');
  useEffect(() => {
    if (!selectedVillageId && villages.length > 0) {
      setSelectedVillageId(villages[0].id);
    }
  }, [villages, selectedVillageId]);

  // Vehicle Schedule filters
  const [vehicleScheduleFilter, setVehicleScheduleFilter] = useState<string>('all');
  const [scheduleCampusFilter, setScheduleCampusFilter] = useState<string>('all');

  const getCampusLabel = (codeOrId: string) => {
    if (!codeOrId) return '—';
    const found = campuses.find(
      (c) => c.code === codeOrId || c.id === codeOrId || c.name === codeOrId
    );
    return found ? `${found.name} (${found.code})` : codeOrId;
  };

  const filteredRoutes = routes.filter((r) => {
    if (campusFilter !== 'all' && r.campus !== campusFilter) return false;
    if (
      routeVehicleFilter !== 'all' &&
      r.vehicleId !== routeVehicleFilter &&
      r.vehicleNumber !== routeVehicleFilter
    ) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (filteredRoutes.length > 0 && (!selectedRoute || !filteredRoutes.some(r => r.id === selectedRoute.id))) {
      setSelectedRoute(filteredRoutes[0]);
    } else if (filteredRoutes.length === 0) {
      setSelectedRoute(null);
    } else if (selectedRoute) {
      const updated = filteredRoutes.find(r => r.id === selectedRoute.id);
      if (updated && updated !== selectedRoute) setSelectedRoute(updated);
    }
  }, [routes, campusFilter, routeVehicleFilter]);

  const sortedVillages = [...villages]
    .map((v) => ({
      ...v,
      stops: [...(v.stops || [])].sort((a, b) =>
        String(a.name || '').trim().localeCompare(String(b.name || '').trim(), undefined, {
          sensitivity: 'base',
          numeric: true,
        })
      ),
    }))
    .sort((a, b) =>
      String(a.name || '').trim().localeCompare(String(b.name || '').trim(), undefined, {
        sensitivity: 'base',
        numeric: true,
      })
    );

  // Dependent stops for the clicked/selected village
  const selectedVillageObj = sortedVillages.find((v) => v.id === selectedVillageId) || sortedVillages[0];
  const dependentStops = selectedVillageObj
    ? (selectedVillageObj.stops || []).map((st) => ({
        ...st,
        villageName: selectedVillageObj.name,
      }))
    : [];

  // Filtered Vehicle Schedule services
  const filteredServices = services.filter((s) => {
    if (vehicleScheduleFilter !== 'all' && s.vehicleNumber !== vehicleScheduleFilter) return false;
    if (scheduleCampusFilter !== 'all' && s.campus !== scheduleCampusFilter) return false;
    return true;
  });

  // Group filtered services by vehicle
  const vehicleSchedules: Record<string, ScheduledService[]> = {};
  for (const s of filteredServices) {
    if (!vehicleSchedules[s.vehicleNumber]) {
      vehicleSchedules[s.vehicleNumber] = [];
    }
    vehicleSchedules[s.vehicleNumber].push(s);
  }

  // --- Print Route List ('pack') State & Helpers ---
  const todayIso = new Date().toISOString().split('T')[0];
  const [packVehicleFilter, setPackVehicleFilter] = useState<string>('all');
  const [packRouteId, setPackRouteId] = useState<string>(routes[0]?.id || '');
  const [packWeekStart, setPackWeekStart] = useState<string>(todayIso);
  const [packWeekEnd, setPackWeekEnd] = useState<string>(() => {
    const endD = new Date();
    endD.setDate(endD.getDate() + 5);
    return endD.toISOString().split('T')[0];
  });

  const filteredPackRoutes = routes.filter((r) => {
    if (packVehicleFilter === 'all') return true;
    return r.vehicleId === packVehicleFilter || r.vehicleNumber === packVehicleFilter;
  });

  useEffect(() => {
    if (
      filteredPackRoutes.length > 0 &&
      !filteredPackRoutes.some((r) => r.id === packRouteId)
    ) {
      setPackRouteId(filteredPackRoutes[0].id);
    }
  }, [packVehicleFilter, routes]);

  const handleStartCalendarChange = (val: string) => {
    setPackWeekStart(val);
    if (val) {
      const endD = new Date(val);
      endD.setDate(endD.getDate() + 5);
      setPackWeekEnd(endD.toISOString().split('T')[0]);
    }
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

  const routeRosterMembers = selectedPackRoute
    ? students.filter(
        (s) =>
          s.transportStatus !== 'Left' &&
          (s.routeId === selectedPackRoute.id ||
            (s.routeCode &&
              selectedPackRoute.code &&
              s.routeCode.trim().toLowerCase() === selectedPackRoute.code.trim().toLowerCase()))
      )
    : [];

  const handlePrintRouteList = () => {
    if (selectedPackRoute && onOpenPrintPack) {
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

  return (
    <div className="space-y-6">
      {/* Unified Header & Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {activeTab === 'multi_trips'
              ? 'Vehicle Schedule & Trip Assignments'
              : activeTab === 'villages_stops'
              ? 'Villages & Transport Stops'
              : activeTab === 'pack'
              ? 'Print Route List (Driver & Bus Assistant Sheet)'
              : 'Active Routes & Stop Sequences'}
          </h2>
          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            {activeTab === 'multi_trips'
              ? `${filteredServices.length} Services`
              : activeTab === 'villages_stops'
              ? `${dependentStops.length} Stops`
              : activeTab === 'pack'
              ? `${routeRosterMembers.length} Members`
              : `${filteredRoutes.length} Routes`}
          </span>

          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            {(
              [
                { id: 'routes', label: '1- Active Routes & Stops' },
                { id: 'multi_trips', label: '2- Vehicle Schedule' },
                { id: 'pack', label: '3- Print Route List' },
                { id: 'villages_stops', label: 'Villages & Stops' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  activeTab === t.id
                    ? 'bg-slate-900 text-amber-400 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'routes' && (
            <>
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 text-slate-800"
              >
                <option value="all">Campus: All</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>

              <select
                value={routeVehicleFilter}
                onChange={(e) => setRouteVehicleFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 text-slate-800"
              >
                <option value="all">Vehicle: All</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.registrationNumber}>
                    {v.registrationNumber} {v.vehicleCode ? `(${v.vehicleCode})` : ''}
                  </option>
                ))}
              </select>

              <FilterPopover
                activeCount={(campusFilter !== 'all' ? 1 : 0) + (routeVehicleFilter !== 'all' ? 1 : 0)}
                onReset={() => {
                  setCampusFilter('all');
                  setRouteVehicleFilter('all');
                }}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Campus
                  </label>
                  <select
                    value={campusFilter}
                    onChange={(e) => setCampusFilter(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50"
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
                    value={routeVehicleFilter}
                    onChange={(e) => setRouteVehicleFilter(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50"
                  >
                    <option value="all">All Vehicles</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.registrationNumber}>
                        {v.registrationNumber}
                      </option>
                    ))}
                  </select>
                </div>
              </FilterPopover>

              <PrintExportToolbar
                title="Routes & Stops Schedule"
                filename="routes_schedule"
                schoolName={schoolName}
                filteredData={filteredRoutes}
                allData={routes}
                hasActiveFilters={campusFilter !== 'all' || routeVehicleFilter !== 'all'}
                filterSummary={
                  [
                    campusFilter !== 'all' ? `Campus: ${getCampusLabel(campusFilter)}` : '',
                    routeVehicleFilter !== 'all' ? `Vehicle: ${routeVehicleFilter}` : '',
                  ]
                    .filter(Boolean)
                    .join(' | ') || undefined
                }
                columns={[
                  { header: 'Route Code', accessor: (r) => r.code },
                  { header: 'Route Name', accessor: (r) => r.name || r.code },
                  { header: 'Campus', accessor: (r) => getCampusLabel(r.campus) },
                  { header: 'Vehicle Number', accessor: (r) => r.vehicleNumber },
                  { header: 'Trip Number', accessor: (r) => `Trip ${r.tripNumber}` },
                  { header: 'Assigned Villages', accessor: (r) => r.villageNames.join(', ') },
                  { header: 'Status', accessor: (r) => (r.active ? 'Active' : 'Inactive') },
                ]}
              />
            </>
          )}

          {activeTab === 'villages_stops' && (
            <PrintExportToolbar
              title={`Village Transport Stops — ${selectedVillageObj?.name || 'Selected Village'}`}
              filename={`village_stops_${selectedVillageObj?.name || 'list'}`}
              schoolName={schoolName}
              filteredData={dependentStops}
              allData={stops}
              hasActiveFilters={!!selectedVillageObj}
              filterSummary={selectedVillageObj ? `Village: ${selectedVillageObj.name}` : undefined}
              columns={[
                { header: 'Village', accessor: (s) => s.villageName || selectedVillageObj?.name || '' },
                { header: 'Transport Stop Name', accessor: (s) => s.name },
                { header: 'Distance (Km)', accessor: (s) => `${s.distanceKm} km` },
                { header: 'Monthly Fee (INR)', accessor: (s) => s.fee },
                { header: 'Morning Pickup', accessor: (s) => s.plannedTimeMorning || '—' },
                { header: 'Evening Drop', accessor: (s) => s.plannedTimeEvening || '—' },
              ]}
            />
          )}

          {activeTab === 'multi_trips' && (
            <>
              <FilterPopover
                activeCount={
                  (vehicleScheduleFilter !== 'all' ? 1 : 0) +
                  (scheduleCampusFilter !== 'all' ? 1 : 0)
                }
                onReset={() => {
                  setVehicleScheduleFilter('all');
                  setScheduleCampusFilter('all');
                }}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Vehicle
                  </label>
                  <select
                    value={vehicleScheduleFilter}
                    onChange={(e) => setVehicleScheduleFilter(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold font-mono bg-slate-50"
                  >
                    <option value="all">All Vehicles</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.registrationNumber}>
                        {v.registrationNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Campus
                  </label>
                  <select
                    value={scheduleCampusFilter}
                    onChange={(e) => setScheduleCampusFilter(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50"
                  >
                    <option value="all">All Campuses</option>
                    {campuses.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </FilterPopover>

              <PrintExportToolbar
                title="Vehicle Trip & Shift Schedule"
                filename="vehicle_schedule"
                schoolName={schoolName}
                filteredData={filteredServices}
                allData={services}
                hasActiveFilters={vehicleScheduleFilter !== 'all' || scheduleCampusFilter !== 'all'}
                filterSummary={
                  [
                    vehicleScheduleFilter !== 'all' ? `Vehicle: ${vehicleScheduleFilter}` : '',
                    scheduleCampusFilter !== 'all' ? `Campus: ${getCampusLabel(scheduleCampusFilter)}` : '',
                  ]
                    .filter(Boolean)
                    .join(' | ') || undefined
                }
                columns={[
                  { header: 'Vehicle Number', accessor: (s) => s.vehicleNumber },
                  { header: 'Trip Number', accessor: (s) => `Trip ${s.tripNumber}` },
                  { header: 'Route Code', accessor: (s) => s.routeName },
                  { header: 'Shift / Description', accessor: (s) => s.shiftName || '' },
                  { header: 'Campus', accessor: (s) => getCampusLabel(s.campus || '') },
                  { header: 'Driver', accessor: (s) => s.driverName || '—' },
                  { header: 'Helper', accessor: (s) => s.helperName || '—' },
                  { header: 'Timing', accessor: (s) => `${s.departureTime || s.plannedStartTime || ''} - ${s.arrivalTime || s.plannedEndTime || ''}` },
                  { header: 'Assigned Members', accessor: (s) => s.assignedCount ?? 0 },
                ]}
              />
            </>
          )}
        </div>
      </div>

      {/* Tab 1: Routes & Stop Sequence */}
      {activeTab === 'routes' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left: Route List */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Configured Routes ({filteredRoutes.length})</h3>
              <div className="space-y-2">
                {filteredRoutes.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No routes found.</p>
                ) : (
                  filteredRoutes.map((r) => {
                    const rStopIds = new Set(r.stopIds || []);
                    const rStopNames = new Set((r.stopNames || []).map(sn => String(sn || '').trim().toLowerCase()));
                    const hasExplicitStops = rStopIds.size > 0 || rStopNames.size > 0;
                    const rStops =
                      r.stops && r.stops.length > 0
                        ? r.stops
                        : villages
                            .filter((v) => r.villageIds?.includes(v.id) || (v.stops || []).some(st => rStopIds.has(st.id)))
                            .flatMap((v) =>
                              (v.stops || [])
                                .filter((s) =>
                                  hasExplicitStops
                                    ? rStopIds.has(s.id) || rStopNames.has(s.name.trim().toLowerCase())
                                    : true
                                )
                                .map((s) => ({ ...s, villageName: v.name }))
                            );
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRoute(r)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          selectedRoute?.id === r.id
                            ? 'bg-amber-50 border-amber-300 font-semibold text-slate-900 shadow-2xs'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-amber-800">{r.code}</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700">
                            {getCampusLabel(r.campus)}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 mt-1 flex items-center justify-between">
                          <span>{r.name || r.code}</span>
                          <span className="font-mono text-[10px] text-slate-500">{r.vehicleNumber}</span>
                        </div>
                        <div className="text-slate-500 text-[11px] mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="font-semibold text-slate-600">{rStops.length} Stop(s):</span>
                          {(r.villageNames || []).map((vName) => {
                            const vilMembers = getMembersForRouteAndVillage(r, vName);
                            const isExp = isRouteVillageExpanded(r.id, vName);
                            return (
                              <button
                                key={vName}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRoute(r);
                                  toggleRouteVillageExpand(r.id, vName);
                                }}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer transition-colors ${
                                  isExp
                                    ? 'bg-slate-900 text-amber-400 border-slate-900'
                                    : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                                }`}
                                title="Click to expand/collapse members in this village"
                              >
                                <span>{vName} ({vilMembers.length})</span>
                                {isExp ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                              </button>
                            );
                          })}
                        </div>

                        {/* Inline Expandable Village Member Lists on Left Route Card */}
                        {(r.villageNames || []).map((vName) => {
                          if (!isRouteVillageExpanded(r.id, vName)) return null;
                          const vilMembers = getMembersForRouteAndVillage(r, vName);
                          return (
                            <div
                              key={vName}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-2 p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                                <span className="text-[11px] font-bold text-slate-900">
                                  {vName} — {vilMembers.length} Member(s)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleRouteVillageExpand(r.id, vName)}
                                  className="text-[10px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                                >
                                  Collapse
                                </button>
                              </div>
                              {vilMembers.length === 0 ? (
                                <div className="text-[11px] text-slate-400 py-1">No active members in {vName} on {r.code}.</div>
                              ) : (
                                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                                  {vilMembers.map((m, mIdx) => (
                                    <div key={m.id} className="py-1 flex items-center justify-between gap-2 text-[11px]">
                                      <div>
                                        <span className="font-bold text-slate-900">{mIdx + 1}. {m.name}</span>
                                        <span className="text-slate-500 font-mono text-[10px] ml-1">({m.admissionNo})</span>
                                      </div>
                                      <span className="text-slate-600 font-semibold shrink-0">{m.class}-{m.section}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Ordered Stops Sequence & Expandable Villages */}
            <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedRoute ? `${selectedRoute.code} — ${selectedRoute.name || ''}` : 'Select a Route'}
                  </h3>
                  {selectedRoute && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Vehicle: <strong>{selectedRoute.vehicleNumber}</strong> • Campus: <strong>{getCampusLabel(selectedRoute.campus)}</strong> • Trip {selectedRoute.tripNumber}
                    </p>
                  )}
                </div>
                {selectedRoute && (
                  <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold">
                    Total Route Members: {getMembersForRouteAndVillage(selectedRoute).length}
                  </span>
                )}
              </div>

              {/* Clickable Villages under Selected Route (Expand / Collapse Members) */}
              {selectedRoute && (selectedRoute.villageNames || []).length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Villages Under {selectedRoute.code} (Click Village Name to Expand / Collapse Members)
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(selectedRoute.villageNames || []).map((vName) => {
                      const isExp = isRouteVillageExpanded(selectedRoute.id, vName);
                      const vilMembers = getMembersForRouteAndVillage(selectedRoute, vName);
                      return (
                        <div key={vName} className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/60">
                          <button
                            type="button"
                            onClick={() => toggleRouteVillageExpand(selectedRoute.id, vName)}
                            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-amber-50/60 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-bold text-slate-900 text-sm">{vName}</span>
                              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[11px]">
                                {vilMembers.length} {vilMembers.length === 1 ? 'Member' : 'Members'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                              <span>{isExp ? 'Hide Members' : 'Show Members'}</span>
                              {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </button>

                          {isExp && (
                            <div className="bg-white border-t border-slate-200 p-3">
                              {vilMembers.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-3">
                                  No active members assigned to {vName} under {selectedRoute.code}.
                                </p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                                        <th className="py-2 px-2.5">#</th>
                                        <th className="py-2 px-2.5">Admission No</th>
                                        <th className="py-2 px-2.5">Member Name</th>
                                        <th className="py-2 px-2.5">Class &amp; Sec</th>
                                        <th className="py-2 px-2.5">Father / Guardian</th>
                                        <th className="py-2 px-2.5">Stop</th>
                                        <th className="py-2 px-2.5">Mobile</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {vilMembers.map((m, idx) => (
                                        <tr key={m.id} className="hover:bg-slate-50">
                                          <td className="py-2 px-2.5 font-mono text-slate-400">{idx + 1}</td>
                                          <td className="py-2 px-2.5 font-mono font-bold text-slate-700">{m.admissionNo}</td>
                                          <td className="py-2 px-2.5 font-bold text-slate-900">{m.name}</td>
                                          <td className="py-2 px-2.5 font-semibold text-slate-700">{m.class}-{m.section}</td>
                                          <td className="py-2 px-2.5 text-slate-600">{m.fatherName || '—'}</td>
                                          <td className="py-2 px-2.5 text-emerald-700 font-semibold">{m.pickupDropStopName || m.villageName}</td>
                                          <td className="py-2 px-2.5 font-mono text-slate-600">{m.mobile || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Ordered Transport Stops Sequence
                </h4>
                {(() => {
                  const selStopIds = new Set(selectedRoute?.stopIds || []);
                  const selStopNames = new Set((selectedRoute?.stopNames || []).map(sn => String(sn || '').trim().toLowerCase()));
                  const selHasExplicitStops = selStopIds.size > 0 || selStopNames.size > 0;
                  const activeStops =
                    selectedRoute?.stops && selectedRoute.stops.length > 0
                      ? selectedRoute.stops
                      : villages
                          .filter((v) => selectedRoute?.villageIds?.includes(v.id) || (v.stops || []).some(st => selStopIds.has(st.id)))
                          .flatMap((v) =>
                            (v.stops || [])
                              .filter((s) =>
                                selHasExplicitStops
                                  ? selStopIds.has(s.id) || selStopNames.has(s.name.trim().toLowerCase())
                                  : true
                              )
                              .map((s) => ({ ...s, villageName: v.name }))
                          );

                  if (activeStops.length === 0) {
                    return (
                      <div className="text-slate-400 text-xs py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No stops found.
                      </div>
                    );
                  }

                  return activeStops.map((stop, index) => (
                    <div
                      key={stop.id || stop.stopId || index}
                      className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{stop.name || stop.stopName}</div>
                          <div className="text-slate-500 text-[11px]">
                            Village:{' '}
                            <button
                              type="button"
                              onClick={() => selectedRoute && stop.villageName && toggleRouteVillageExpand(selectedRoute.id, stop.villageName)}
                              className="font-bold text-indigo-700 hover:underline cursor-pointer"
                            >
                              {stop.villageName || 'Assigned'}
                            </button>{' '}
                            • ₹{stop.fee || 700}/mo
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-slate-600 font-medium">
                        <div>
                          Distance: <strong className="text-slate-900">{stop.distanceKm} km</strong>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Villages & Dependent Stops */}
      {activeTab === 'villages_stops' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-56 sm:w-64">
                <Search className="w-3.5 h-3.5 text-amber-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={villageSearchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setVillageSearchQuery(val);
                    const q = val.trim().toLowerCase();
                    if (q) {
                      const firstMatch =
                        sortedVillages.find((v) => v.name.toLowerCase().startsWith(q)) ||
                        sortedVillages.find((v) => v.name.toLowerCase().includes(q));
                      if (firstMatch) setSelectedVillageId(firstMatch.id);
                    }
                  }}
                  placeholder="Search village by first letters..."
                  className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {villageSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setVillageSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <Filter className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-slate-700">Select Village (A–Z):</span>
              <select
                value={selectedVillageId}
                onChange={(e) => setSelectedVillageId(e.target.value)}
                className="p-2 border border-slate-200 rounded-xl text-xs font-bold bg-amber-50/60 text-slate-900"
              >
                {sortedVillages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.stops.length} Stops)
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-slate-500">
              Type first few alphabets or click any village below to view its dependent transport stops
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Villages List (Clickable) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Villages &amp; Distance Tariffs (A–Z)</h3>
                <span className="text-xs text-slate-500">{sortedVillages.length} Villages</span>
              </div>
              <div className="space-y-2.5 text-xs">
                {sortedVillages.length === 0 ? (
                  <p className="py-6 text-center text-slate-400">No villages configured yet.</p>
                ) : (
                  (() => {
                    const q = villageSearchQuery.trim().toLowerCase();
                    const filteredList = !q
                      ? sortedVillages
                      : [
                          ...sortedVillages.filter((v) => v.name.toLowerCase().startsWith(q)),
                          ...sortedVillages.filter(
                            (v) => !v.name.toLowerCase().startsWith(q) && v.name.toLowerCase().includes(q)
                          ),
                        ];
                    if (filteredList.length === 0) {
                      return (
                        <p className="py-6 text-center text-slate-400">
                          No village found matching &ldquo;{villageSearchQuery}&rdquo;.
                        </p>
                      );
                    }
                    return filteredList.map((v) => {
                      const isSelected = selectedVillageObj?.id === v.id;
                      return (
                        <div
                          key={v.id}
                          onClick={() => setSelectedVillageId(v.id)}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-amber-50 border-amber-400 shadow-2xs ring-1 ring-amber-300'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <span>{v.name}</span>
                            {isSelected && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                                Selected
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            {v.distanceKm} km from School • {v.stops.length} Dependent Stops
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 text-sm">
                            ₹{v.monthlyRate || (v.stops[0]?.fee ?? 0)}
                          </span>
                          <span className="text-slate-400 text-[11px]"> / month</span>
                        </div>
                      </div>
                    );
                  });
                })()
                )}
              </div>
            </div>

            {/* Dependent Stops List for Selected Village Only */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Transport Stops — {selectedVillageObj ? selectedVillageObj.name : 'Select Village'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Showing only transport stops linked to <strong>{selectedVillageObj?.name}</strong>
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-xs">
                  {dependentStops.length} Stops
                </span>
              </div>
              <div className="divide-y divide-slate-100 text-xs max-h-96 overflow-y-auto">
                {dependentStops.length === 0 ? (
                  <p className="py-6 text-center text-slate-400">
                    No transport stops configured for this village.
                  </p>
                ) : (
                  dependentStops.map((st, idx) => (
                    <div key={st.id || idx} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[11px]">
                          {idx + 1}
                        </div>
                        <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                        <div>
                          <span className="font-bold text-slate-900 text-sm">{st.name}</span>
                          <span className="text-slate-500 text-[11px] ml-1.5">
                            ({selectedVillageObj?.name})
                          </span>
                          {(st.plannedTimeMorning || st.plannedTimeEvening) && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Morning: {st.plannedTimeMorning || '—'} • Afternoon: {st.plannedTimeEvening || '—'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900 text-sm">₹{st.fee}/mo</div>
                        <div className="text-slate-500 text-[11px]">{st.distanceKm} km</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Vehicle Schedule with Filters */}
      {activeTab === 'multi_trips' && (
        <div className="space-y-4">
          {/* Vehicle Schedule Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Bus className="w-4 h-4 text-amber-600" />
                <label className="text-xs font-bold text-slate-700">Select Vehicle:</label>
                <select
                  value={vehicleScheduleFilter}
                  onChange={(e) => setVehicleScheduleFilter(e.target.value)}
                  className="p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-900"
                >
                  <option value="all">All Fleet Vehicles ({vehicles.length})</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.registrationNumber}>
                      {v.registrationNumber} — {v.driverName || v.assignedDriverName || v.type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700">Campus:</label>
                <select
                  value={scheduleCampusFilter}
                  onChange={(e) => setScheduleCampusFilter(e.target.value)}
                  className="p-2 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50"
                >
                  <option value="all">All Campuses</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {(vehicleScheduleFilter !== 'all' || scheduleCampusFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setVehicleScheduleFilter('all');
                    setScheduleCampusFilter('all');
                  }}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div className="text-xs font-semibold text-slate-500">
              Showing <strong>{filteredServices.length}</strong> scheduled trip(s)
            </div>
          </div>

          {Object.keys(vehicleSchedules).length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
              No scheduled vehicle services match the selected filter.
            </div>
          ) : (
            Object.entries(vehicleSchedules).map(([vehNum, svcList]) => {
              const vehInfo = vehicles.find((v) => v.registrationNumber === vehNum);

              return (
                <div key={vehNum} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                        <Bus className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-sm">{vehNum}</span>
                          <span className="text-xs text-slate-500">Capacity: {vehInfo?.capacity || 40} seats</span>
                        </div>
                        <p className="text-xs text-slate-600">
                          Driver: <strong>{svcList[0]?.driverName || vehInfo?.assignedDriverName || 'Assigned Driver'}</strong>
                          {(svcList[0]?.helperName || vehInfo?.assignedHelperName) && (
                            <> • Helper: <strong>{svcList[0]?.helperName || vehInfo?.assignedHelperName}</strong></>
                          )}
                          {' '}• {svcList.length} Trip(s) / Day
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {svcList
                      .sort((a, b) => a.tripNumber - b.tripNumber)
                      .map((svc) => {
                        const svcMembers = students.filter(
                          st =>
                            st.transportStatus !== 'Left' &&
                            (st.routeId === svc.routeId || st.routeCode === svc.routeName)
                        );
                        const isMembersExpanded = Boolean(expandedServiceMembers[svc.id]);
                        const isEditingTime = editingTimingServiceId === svc.id;
                        const currentDep = svc.departureTime || svc.plannedStartTime || '06:30 AM';
                        const currentArr = svc.arrivalTime || svc.plannedEndTime || '07:35 AM';

                        return (
                          <div key={svc.id} className="p-4 space-y-3 text-xs">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-sm">
                                    Trip {svc.tripNumber} — {svc.shiftName}
                                  </span>
                                  <span className="text-slate-400">•</span>
                                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-mono font-bold">
                                    {svc.routeName}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-slate-500">
                                  <span>
                                    Campus: <strong className="text-slate-700">{getCampusLabel(svc.campus || '')}</strong>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedServiceMembers(prev => ({
                                        ...prev,
                                        [svc.id]: !prev[svc.id],
                                      }))
                                    }
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold cursor-pointer transition-colors"
                                    title="Click to expand/collapse assigned members list"
                                  >
                                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Assigned: {svcMembers.length} members</span>
                                    {isMembersExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {isEditingTime ? (
                                  <div className="flex flex-wrap items-center gap-2 bg-amber-50 p-2 rounded-xl border border-amber-300">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-600">Departure</label>
                                      <input
                                        type="text"
                                        value={editDepartureTime}
                                        onChange={e => setEditDepartureTime(e.target.value)}
                                        placeholder="e.g. 06:30 AM"
                                        className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono text-xs font-bold"
                                      />
                                    </div>
                                    <span className="text-slate-400 font-bold mt-3">&rarr;</span>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-600">Arrival</label>
                                      <input
                                        type="text"
                                        value={editArrivalTime}
                                        onChange={e => setEditArrivalTime(e.target.value)}
                                        placeholder="e.g. 07:35 AM"
                                        className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono text-xs font-bold"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      disabled={savingTiming}
                                      onClick={async () => {
                                        setSavingTiming(true);
                                        try {
                                          await api.updateRouteTimings(svc.routeId || svc.routeName, {
                                            departureTime: editDepartureTime.trim() || currentDep,
                                            arrivalTime: editArrivalTime.trim() || currentArr,
                                          });
                                          setEditingTimingServiceId(null);
                                        } finally {
                                          setSavingTiming(false);
                                        }
                                      }}
                                      className="mt-3 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>{savingTiming ? 'Saving...' : 'Save'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingTimingServiceId(null)}
                                      className="mt-3 p-1.5 text-slate-500 hover:text-slate-800 rounded-lg cursor-pointer"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 font-mono text-slate-800 font-semibold flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                                      <span>{currentDep} &rarr; {currentArr}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingTimingServiceId(svc.id);
                                        setEditDepartureTime(currentDep);
                                        setEditArrivalTime(currentArr);
                                      }}
                                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1"
                                      title="Change Route / Trip Timings"
                                    >
                                      <Edit2 className="w-3 h-3 text-amber-600" />
                                      <span>Change Timing</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Expandable Member List when clicking "Assigned: X members" */}
                            {isMembersExpanded && (
                              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-800">
                                    Members Assigned to {svc.routeName} ({svcMembers.length})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedServiceMembers(prev => ({ ...prev, [svc.id]: false }))
                                    }
                                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                                  >
                                    Collapse List
                                  </button>
                                </div>
                                {svcMembers.length === 0 ? (
                                  <p className="text-xs text-slate-400 py-2 text-center">
                                    No active members assigned to {svc.routeName}.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                                    <table className="w-full text-left border-collapse text-xs">
                                      <thead>
                                        <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                                          <th className="py-2 px-3">#</th>
                                          <th className="py-2 px-3">Admission No</th>
                                          <th className="py-2 px-3">Member Name</th>
                                          <th className="py-2 px-3">Class &amp; Sec</th>
                                          <th className="py-2 px-3">Father / Guardian</th>
                                          <th className="py-2 px-3">Village &amp; Stop</th>
                                          <th className="py-2 px-3">Mobile</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {svcMembers.map((m, idx) => (
                                          <tr key={m.id} className="hover:bg-slate-50">
                                            <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                                            <td className="py-2 px-3 font-mono font-bold text-slate-700">{m.admissionNo}</td>
                                            <td className="py-2 px-3 font-bold text-slate-900">{m.name}</td>
                                            <td className="py-2 px-3 font-semibold text-slate-700">{m.class}-{m.section}</td>
                                            <td className="py-2 px-3 text-slate-600">{m.fatherName || '—'}</td>
                                            <td className="py-2 px-3 text-emerald-700 font-semibold">
                                              {m.villageName} ({m.pickupDropStopName || m.villageName})
                                            </td>
                                            <td className="py-2 px-3 font-mono text-slate-600">{m.mobile || '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 4: Print Route List (Shifted from Attendance Module to Routes and Trips) */}
      {activeTab === 'pack' && (
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
    </div>
  );
};

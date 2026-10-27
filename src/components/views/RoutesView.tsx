import React, { useState, useEffect } from 'react';
import { MapPin, Bus, Filter, Search, X, ChevronDown, ChevronUp, Users, Clock, Edit2, Check } from 'lucide-react';
import { Route, ScheduledService, Village, TransportStop, Vehicle, CampusMaster, StudentMember } from '../../types/index.js';
import { PrintExportToolbar, FilterPopover } from '../../utils/exportPrint.js';
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
}) => {
  const [activeTab, setActiveTab] = useState<'routes' | 'multi_trips' | 'villages_stops'>(
    initialSubTab === 'services'
      ? 'multi_trips'
      : initialSubTab === 'villages_stops'
      ? 'villages_stops'
      : 'routes'
  );

  useEffect(() => {
    if (initialSubTab === 'services') setActiveTab('multi_trips');
    else if (initialSubTab === 'villages_stops') setActiveTab('villages_stops');
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

  return (
    <div className="space-y-6">
      {/* Unified Header & Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {activeTab === 'multi_trips'
              ? 'Vehicle Schedule & Trip Assignments'
              : activeTab === 'villages_stops'
              ? 'Villages & Transport Stops'
              : 'Active Routes & Stop Sequences'}
          </h2>
          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            {activeTab === 'multi_trips'
              ? `${filteredServices.length} Services`
              : activeTab === 'villages_stops'
              ? `${dependentStops.length} Stops`
              : `${filteredRoutes.length} Routes`}
          </span>
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
    </div>
  );
};

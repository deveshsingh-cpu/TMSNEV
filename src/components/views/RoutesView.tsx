import React, { useState, useEffect } from 'react';
import { MapPin, Bus, Filter, Search, X } from 'lucide-react';
import { Route, ScheduledService, Village, TransportStop, Vehicle, CampusMaster } from '../../types/index.js';
import { PrintExportToolbar, FilterPopover } from '../../utils/exportPrint.js';

interface RoutesViewProps {
  schoolName?: string;
  campuses?: CampusMaster[];
  routes: Route[];
  services: ScheduledService[];
  villages: Village[];
  stops: TransportStop[];
  vehicles: Vehicle[];
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
    return true;
  });

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
              <FilterPopover
                activeCount={campusFilter !== 'all' ? 1 : 0}
                onReset={() => setCampusFilter('all')}
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
              </FilterPopover>

              <PrintExportToolbar
                title="Routes & Stops Schedule"
                filename="routes_schedule"
                schoolName={schoolName}
                filteredData={filteredRoutes}
                allData={routes}
                hasActiveFilters={campusFilter !== 'all'}
                filterSummary={campusFilter !== 'all' ? `Campus: ${getCampusLabel(campusFilter)}` : undefined}
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
                        <div className="font-bold text-slate-900 mt-1">{r.name || r.code}</div>
                        <div className="text-slate-500 text-[11px] mt-1">
                          {rStops.length} {rStops.length === 1 ? 'Stop' : 'Stops'} ({r.villageNames?.join(', ') || 'Assigned'})
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Ordered Stops Sequence */}
            <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedRoute ? `${selectedRoute.code} — ${selectedRoute.name || ''}` : 'Select a Route'}
                  </h3>
                  {selectedRoute && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Vehicle: <strong>{selectedRoute.vehicleNumber}</strong> • Trip {selectedRoute.tripNumber} • Villages: {selectedRoute.villageNames.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
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
                            Village: {stop.villageName || 'Assigned'} • ₹{stop.fee || 700}/mo
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
                      .map((svc) => (
                        <div key={svc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">
                                Trip {svc.tripNumber} — {svc.shiftName}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-700 font-semibold">{svc.routeName}</span>
                            </div>
                            <div className="flex items-center gap-4 text-slate-500">
                              <span>
                                Campus: <strong className="text-slate-700">{getCampusLabel(svc.campus || '')}</strong>
                              </span>
                              <span>
                                Assigned: <strong className="text-slate-900">{svc.assignedCount} members</strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 font-mono text-slate-800 font-semibold">
                              {svc.departureTime || svc.plannedStartTime} &rarr; {svc.arrivalTime || svc.plannedEndTime}
                            </div>
                          </div>
                        </div>
                      ))}
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

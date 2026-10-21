import React, { useState, useEffect } from 'react';
import { 
  Fuel, Wrench, FileText, CheckCircle, 
  Plus, X, Check, Ban, IndianRupee
} from 'lucide-react';
import {
  Vehicle, OdometerLog, FuelAdvanceAndPurchase, MaintenanceRequest, ExpenseRecord, UserRole
} from '../../types/index.js';
import { PrintExportToolbar, FilterPopover } from '../../utils/exportPrint.js';

interface VehiclesViewProps {
  schoolName?: string;
  currentRole?: UserRole;
  vehicles: Vehicle[];
  odometerLogs: OdometerLog[];
  fuelAdvances: FuelAdvanceAndPurchase[];
  maintenanceRequests: MaintenanceRequest[];
  expenses?: ExpenseRecord[];
  initialSubTab?: string;
  onRecordOdometer: (data: Omit<OdometerLog, 'id'>) => Promise<any>;
  onSettleFuelAdvance: (data: any) => Promise<any>;
  onAddMaintenance: (data: Partial<MaintenanceRequest>) => Promise<any>;
  onUpdateMaintenanceStatus?: (
    id: string,
    payload: {
      status: MaintenanceRequest['status'];
      approvedBy?: string;
      rejectionReason?: string;
      actualCost?: number;
      workDoneDetails?: string;
      invoiceNumber?: string;
      vendorName?: string;
    }
  ) => Promise<any>;
}

export const VehiclesView: React.FC<VehiclesViewProps> = ({
  schoolName,
  currentRole = 'Admin',
  vehicles = [],
  odometerLogs = [],
  fuelAdvances = [],
  maintenanceRequests = [],
  expenses = [],
  initialSubTab = 'odometer',
  onRecordOdometer,
  onSettleFuelAdvance,
  onAddMaintenance,
  onUpdateMaintenanceStatus,
}) => {
  const isAdmin = currentRole === 'Admin';
  const todayStr = new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState<'fleet' | 'odometer' | 'fuel' | 'maintenance'>(
    initialSubTab === 'fleet' || initialSubTab === 'odometer' || initialSubTab === 'maintenance'
      ? initialSubTab
      : 'odometer'
  );

  useEffect(() => {
    if (initialSubTab === 'fleet' || initialSubTab === 'odometer' || initialSubTab === 'maintenance') {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  const [logVehicleFilter, setLogVehicleFilter] = useState<string>('all');
  const [woVehicleFilter, setWoVehicleFilter] = useState<string>('all');
  const [woStatusFilter, setWoStatusFilter] = useState<string>('all');

  const filteredLogs = odometerLogs.filter((l) => {
    if (logVehicleFilter !== 'all' && l.vehicleNumber !== logVehicleFilter) return false;
    return true;
  });

  // Approved expenses for the selected vehicle (also shown in Vehicle Log Book)
  const vehicleApprovedExpenses = expenses.filter(
    (e) =>
      e.vehicleNumber &&
      e.vehicleNumber !== 'General' &&
      e.approvalStatus !== 'Pending Approval' &&
      e.approvalStatus !== 'Rejected' &&
      (logVehicleFilter === 'all' || e.vehicleNumber === logVehicleFilter)
  );

  const filteredWorkOrders = maintenanceRequests.filter((m) => {
    if (woVehicleFilter !== 'all' && m.vehicleNumber !== woVehicleFilter) return false;
    if (woStatusFilter !== 'all' && m.status !== woStatusFilter) return false;
    return true;
  });

  // Daily Odometer Log form modal (Once-a-day general odometer reading)
  const [isOdoModalOpen, setIsOdoModalOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || '');
  const [logDate, setLogDate] = useState(todayStr);
  const [odoStart, setOdoStart] = useState<number>(0);
  const [odoEnd, setOdoEnd] = useState<number>(0);
  const [driverName, setDriverName] = useState('');
  const [neatnessChecked, setNeatnessChecked] = useState(true);
  const [defectsReported, setDefectsReported] = useState('');

  // Fuel advance issue & settlement modal
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [fuelModalMode, setFuelModalMode] = useState<'give' | 'settle'>('give');
  const [editingFuelAdvanceId, setEditingFuelAdvanceId] = useState<string | undefined>(undefined);
  const [fuelVehicleId, setFuelVehicleId] = useState(vehicles[0]?.id || '');
  const [fuelDriverName, setFuelDriverName] = useState(vehicles[0]?.assignedDriverName || '');
  const [fuelAdvanceGiven, setFuelAdvanceGiven] = useState(2000);
  const [fuelBillAmount, setFuelBillAmount] = useState(0);
  const [cashReturned, setCashReturned] = useState(0);
  const [fuelLitres, setDailyFuelLitres] = useState<number>(0);
  const [fuelVendor, setFuelVendor] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [fuelPaymentMode, setFuelPaymentMode] = useState<'Cash' | 'UPI' | 'Bank'>('Cash');

  // Raise Work Order Modal
  const [isWoModalOpen, setIsWoModalOpen] = useState(false);
  const [woVehicleId, setWoVehicleId] = useState(vehicles[0]?.id || '');
  const [woDate, setWoDate] = useState(todayStr);
  const [woIssue, setWoIssue] = useState('');
  const [woSeverity, setWoSeverity] = useState<MaintenanceRequest['severity']>('Medium');
  const [woVendor, setWoVendor] = useState('');
  const [woEstimatedCost, setWoEstimatedCost] = useState('');
  const [woNotes, setWoNotes] = useState('');

  // Complete Work Order Modal
  const [completingWo, setCompletingWo] = useState<MaintenanceRequest | null>(null);
  const [completeActualCost, setCompleteActualCost] = useState('');
  const [completeWorkDone, setCompleteWorkDone] = useState('');
  const [completeInvoiceNo, setCompleteInvoiceNo] = useState('');

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];

  const handleOpenOdometerModal = (veh?: Vehicle) => {
    const target = veh || vehicles[0];
    if (target) {
      setSelectedVehicleId(target.id);
      setOdoStart(target.currentOdometer || 0);
      setOdoEnd((target.currentOdometer || 0) + 25);
      setDriverName(target.assignedDriverName || '');
    }
    setLogDate(todayStr);
    setDefectsReported('');
    setIsOdoModalOpen(true);
  };

  const handleOdometerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onRecordOdometer({
        date: todayStr,
        vehicleId: selectedVehicleId,
        vehicleNumber: selectedVehicle?.registrationNumber || '',
        driverName: driverName || selectedVehicle?.assignedDriverName || 'Assigned Driver',
        startOdometer: Number(odoStart),
        endOdometer: Number(odoEnd),
        tripKm: Math.max(0, Number(odoEnd) - Number(odoStart)),
        fuelLitresAdded: 0,
        fuelCost: 0,
        neatnessChecked,
        defectsReported: defectsReported.trim() || 'Daily General Odometer Reading',
        recordedBy: currentRole,
      });
      setIsOdoModalOpen(false);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleOpenGiveFuelAdvance = () => {
    const target = vehicles[0];
    setFuelModalMode('give');
    setEditingFuelAdvanceId(undefined);
    setFuelVehicleId(target?.id || '');
    setFuelDriverName(target?.assignedDriverName || '');
    setFuelAdvanceGiven(2000);
    setFuelBillAmount(0);
    setCashReturned(0);
    setDailyFuelLitres(0);
    setFuelVendor('');
    setReceiptNo('');
    setFuelPaymentMode('Cash');
    setIsFuelModalOpen(true);
  };

  const handleOpenSettleFuelAdvance = (existing?: FuelAdvanceAndPurchase) => {
    setFuelModalMode('settle');
    if (existing) {
      setEditingFuelAdvanceId(existing.id);
      setFuelVehicleId(existing.vehicleId);
      setFuelDriverName(existing.driverName);
      const advGiven = existing.advanceGiven ?? existing.advanceAmount ?? 0;
      setFuelAdvanceGiven(advGiven);
      setFuelBillAmount(existing.fuelBillAmount || advGiven);
      setCashReturned(existing.cashReturned || 0);
      setDailyFuelLitres(existing.litresPurchased || Number((advGiven / 90).toFixed(1)));
      setFuelVendor(existing.vendorName === 'Advance Issued for Fuel' ? '' : existing.vendorName);
      setReceiptNo(existing.receiptNumber === 'PENDING-BILL' ? '' : existing.receiptNumber);
      setFuelPaymentMode(existing.paymentMode || 'Cash');
    } else {
      const target = vehicles[0];
      setEditingFuelAdvanceId(undefined);
      setFuelVehicleId(target?.id || '');
      setFuelDriverName(target?.assignedDriverName || '');
      setFuelAdvanceGiven(2000);
      setFuelBillAmount(1800);
      setCashReturned(200);
      setDailyFuelLitres(20);
      setFuelVendor('');
      setReceiptNo('');
      setFuelPaymentMode('Cash');
    }
    setIsFuelModalOpen(true);
  };

  const handleFuelSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const veh = vehicles.find((v) => v.id === fuelVehicleId) || vehicles[0];
      if (fuelModalMode === 'give') {
        await onSettleFuelAdvance({
          date: todayStr,
          vehicleId: veh?.id || '',
          vehicleNumber: veh?.registrationNumber || '',
          driverId: veh?.assignedDriverId || 'emp-101',
          driverName: fuelDriverName || veh?.assignedDriverName || 'Driver',
          advanceGiven: Number(fuelAdvanceGiven),
          fuelBillAmount: 0,
          cashReturned: 0,
          unsettledAdvance: Number(fuelAdvanceGiven),
          litresPurchased: 0,
          fuelRate: 90.0,
          vendorName: fuelVendor.trim() || 'Advance Issued to Driver for Fuel',
          receiptNumber: receiptNo.trim() || 'PENDING-BILL',
          paymentMode: fuelPaymentMode,
          status: 'Advance Given',
          settledBy: currentRole,
        });
      } else {
        await onSettleFuelAdvance({
          id: editingFuelAdvanceId,
          date: todayStr,
          vehicleId: veh?.id || '',
          vehicleNumber: veh?.registrationNumber || '',
          driverId: veh?.assignedDriverId || 'emp-101',
          driverName: fuelDriverName || veh?.assignedDriverName || 'Driver',
          advanceGiven: Number(fuelAdvanceGiven),
          fuelBillAmount: Number(fuelBillAmount),
          cashReturned: Number(cashReturned),
          unsettledAdvance: Math.max(0, Number(fuelAdvanceGiven) - (Number(fuelBillAmount) + Number(cashReturned))),
          litresPurchased: Number(fuelLitres),
          fuelRate: Number(fuelLitres) > 0 ? Number((Number(fuelBillAmount) / Number(fuelLitres)).toFixed(2)) : 90.0,
          vendorName: fuelVendor.trim() || 'Authorized Fuel Station',
          receiptNumber: receiptNo.trim() || `BILL-${Date.now().toString().slice(-4)}`,
          paymentMode: fuelPaymentMode,
          status:
            Number(fuelAdvanceGiven) <= Number(fuelBillAmount) + Number(cashReturned)
              ? 'Settled'
              : 'Pending Settlement',
          settledBy: currentRole,
        });
      }
      setIsFuelModalOpen(false);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRaiseWorkOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!woIssue.trim()) return;
    const veh = vehicles.find((v) => v.id === woVehicleId) || vehicles[0];
    await onAddMaintenance({
      date: isAdmin ? woDate : todayStr,
      vehicleId: veh?.id || '',
      vehicleNumber: veh?.registrationNumber || '',
      issueDescription: woIssue.trim(),
      severity: woSeverity,
      vendorName: woVendor.trim() || 'Authorized Workshop',
      estimatedCost: Number(woEstimatedCost) || 0,
      actualCost: 0,
      status: isAdmin ? 'Approved' : 'Pending Approval',
      requestedBy: currentRole,
      approvedBy: isAdmin ? 'Admin' : undefined,
      approvedAt: isAdmin ? todayStr : undefined,
      workDoneDetails: woNotes.trim() || undefined,
    });
    setIsWoModalOpen(false);
    setWoIssue('');
    setWoVendor('');
    setWoEstimatedCost('');
    setWoNotes('');
    setActiveTab('maintenance');
  };

  const handleApproveRejectWo = async (wo: MaintenanceRequest, status: 'Approved' | 'Rejected') => {
    if (!onUpdateMaintenanceStatus) return;
    await onUpdateMaintenanceStatus(wo.id, {
      status,
      approvedBy: currentRole,
      rejectionReason: status === 'Rejected' ? 'Rejected by Admin' : undefined,
    });
  };

  const handleCompleteWoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingWo || !onUpdateMaintenanceStatus) return;
    await onUpdateMaintenanceStatus(completingWo.id, {
      status: 'Completed',
      approvedBy: currentRole,
      actualCost: Number(completeActualCost) || completingWo.estimatedCost,
      workDoneDetails: completeWorkDone.trim() || 'Repair work completed and inspected.',
      invoiceNumber: completeInvoiceNo.trim() || undefined,
    });
    setCompletingWo(null);
  };

  return (
    <div className="space-y-6">
      {/* Unified Header & Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {activeTab === 'maintenance'
              ? 'Work Orders & Maintenance'
              : activeTab === 'fuel'
              ? 'Driver Fuel Advances'
              : 'Vehicle Log Book (24-Hr)'}
          </h2>
          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            {activeTab === 'maintenance'
              ? `${filteredWorkOrders.length} Work Orders`
              : activeTab === 'fuel'
              ? `${fuelAdvances.length} Advances`
              : `${filteredLogs.length} Logs`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'odometer' && (
            <>
              <FilterPopover
                activeCount={logVehicleFilter !== 'all' ? 1 : 0}
                onReset={() => setLogVehicleFilter('all')}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Vehicle</label>
                  <select
                    value={logVehicleFilter}
                    onChange={(e) => setLogVehicleFilter(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
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
                title="Vehicle Log Book (Odometer & Synced Expenses)"
                filename="vehicle_log_book"
                schoolName={schoolName}
                filteredData={filteredLogs}
                allData={odometerLogs}
                hasActiveFilters={logVehicleFilter !== 'all'}
                filterSummary={logVehicleFilter !== 'all' ? `Vehicle: ${logVehicleFilter}` : undefined}
                columns={[
                  { header: 'Date', accessor: (l) => l.date },
                  { header: 'Vehicle', accessor: (l) => l.vehicleNumber },
                  { header: 'Driver', accessor: (l) => l.driverName },
                  { header: 'Start Km', accessor: (l) => l.startOdometer },
                  { header: 'End Km', accessor: (l) => l.endOdometer },
                  { header: 'Daily Run (Km)', accessor: (l) => l.tripKm },
                  { header: 'Fuel / Expense (INR)', accessor: (l) => l.expenseAmount || l.fuelCost || 0 },
                  { header: 'Remarks / Synced Expense', accessor: (l) => l.defectsReported || '' },
                  { header: 'Logged By', accessor: (l) => l.recordedBy },
                ]}
              />
              <button
                onClick={() => handleOpenOdometerModal()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Log Book Entry</span>
              </button>
            </>
          )}

          {activeTab === 'maintenance' && (
            <>
              <FilterPopover
                activeCount={(woVehicleFilter !== 'all' ? 1 : 0) + (woStatusFilter !== 'all' ? 1 : 0)}
                onReset={() => {
                  setWoVehicleFilter('all');
                  setWoStatusFilter('all');
                }}
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Vehicle</label>
                  <select
                    value={woVehicleFilter}
                    onChange={(e) => setWoVehicleFilter(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
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
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Work Order Status</label>
                  <select
                    value={woStatusFilter}
                    onChange={(e) => setWoStatusFilter(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Approved">Approved (Ready for Action)</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </FilterPopover>
              <PrintExportToolbar
                title="Vehicle Maintenance Work Orders"
                filename="maintenance_work_orders"
                schoolName={schoolName}
                filteredData={filteredWorkOrders}
                allData={maintenanceRequests}
                hasActiveFilters={woVehicleFilter !== 'all' || woStatusFilter !== 'all'}
                columns={[
                  { header: 'WO No', accessor: (m) => m.workOrderNo || m.id },
                  { header: 'Date', accessor: (m) => m.date },
                  { header: 'Vehicle', accessor: (m) => m.vehicleNumber },
                  { header: 'Issue / Work Description', accessor: (m) => m.issueDescription },
                  { header: 'Priority', accessor: (m) => m.severity },
                  { header: 'Workshop / Vendor', accessor: (m) => m.vendorName },
                  { header: 'Estimated Cost (INR)', accessor: (m) => m.estimatedCost },
                  { header: 'Actual Cost (INR)', accessor: (m) => m.actualCost || m.estimatedCost },
                  { header: 'Raised By', accessor: (m) => m.requestedBy || 'Staff' },
                  { header: 'Status', accessor: (m) => m.status },
                ]}
              />
              <button
                onClick={() => setIsWoModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <Wrench className="w-4 h-4" />
                <span>+ Raise Work Order</span>
              </button>
            </>
          )}

          {activeTab === 'fuel' && (
            <>
              <PrintExportToolbar
                title="Driver Fuel Advances & Settlements"
                filename="driver_fuel_advances"
                schoolName={schoolName}
                filteredData={fuelAdvances}
                allData={fuelAdvances}
                columns={[
                  { header: 'Date', accessor: (f) => f.date },
                  { header: 'Vehicle', accessor: (f) => f.vehicleNumber },
                  { header: 'Driver', accessor: (f) => f.driverName },
                  { header: 'Advance Given (INR)', accessor: (f) => f.advanceAmount || 0 },
                  { header: 'Fuel Bill (INR)', accessor: (f) => f.fuelBillAmount || f.totalAmount || 0 },
                  { header: 'Litres', accessor: (f) => f.litresPurchased || f.litres || 0 },
                  { header: 'Status', accessor: (f) => f.status || 'Settled' },
                ]}
              />
              <button
                onClick={() => handleOpenFuelModal()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Record Fuel Advance</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab 1: Odometer & Vehicle Expense Log Book */}
      {activeTab === 'odometer' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Distance Logged</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {filteredLogs.reduce((s, l) => s + l.tripKm, 0)} <span className="text-xs font-normal text-slate-500">km</span>
              </div>
              <span className="text-[10px] text-slate-400">{filteredLogs.length} log entries</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Synced Vehicle Expenses</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                ₹{vehicleApprovedExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-slate-400">{vehicleApprovedExpenses.length} expense(s) synced via odometer</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mileage Threshold Status</span>
              {(() => {
                const totalKm = filteredLogs.reduce((s, l) => s + (l.tripKm || 0), 0);
                const totalFuelL = filteredLogs.reduce((s, l) => s + (l.fuelLitresAdded || 0), 0);
                const actualKmPerL = totalFuelL > 0 ? Number((totalKm / totalFuelL).toFixed(2)) : 0;
                const vehObj = logVehicleFilter !== 'all' ? vehicles.find(v => v.registrationNumber === logVehicleFilter) : vehicles[0];
                const threshold = vehObj?.expectedMileageKmPerL || vehObj?.baselineMileageKmPerLitre || 6.0;
                const isAbove = actualKmPerL === 0 || actualKmPerL >= threshold;
                return (
                  <div className="mt-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-xl font-bold font-mono ${isAbove ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {actualKmPerL > 0 ? `${actualKmPerL} km/L` : `${threshold} km/L (Std)`}
                      </span>
                      <span className="text-[10px] text-slate-500">Threshold: {threshold} km/L</span>
                    </div>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${isAbove ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {actualKmPerL > 0 ? (isAbove ? 'Above Threshold Mileage' : 'Below Threshold Mileage') : 'Within Standard Threshold'}
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Filter Vehicle</span>
                <p className="text-xs text-slate-300 mt-0.5">Select vehicle to inspect logbook</p>
              </div>
              <select
                value={logVehicleFilter}
                onChange={(e) => setLogVehicleFilter(e.target.value)}
                className="p-2 border border-slate-700 rounded-xl text-xs font-mono font-bold bg-slate-800 text-white"
              >
                <option value="all">All Vehicles</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.registrationNumber}>
                    {v.registrationNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Vehicle Log Book (Odometer Runs &amp; Synced Vehicle Expenses)
              </h3>
              <span className="text-xs text-slate-500">{filteredLogs.length} Entries</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Vehicle</th>
                    <th className="py-3 px-3">Driver</th>
                    <th className="py-3 px-3 font-mono">Start Km</th>
                    <th className="py-3 px-3 font-mono">End Km</th>
                    <th className="py-3 px-3 font-mono">Daily Run</th>
                    <th className="py-3 px-3 font-mono">Fuel / Expense</th>
                    <th className="py-3 px-3">Expense / Inspection Details</th>
                    <th className="py-3 px-4 text-right">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No logbook entries recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-slate-800 font-bold">{log.date}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{log.vehicleNumber}</td>
                        <td className="py-3 px-3 font-medium text-slate-800">{log.driverName}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{log.startOdometer.toLocaleString()}</td>
                        <td className="py-3 px-3 font-mono text-slate-900 font-bold">{log.endOdometer.toLocaleString()}</td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                          {log.tripKm > 0 ? `+${log.tripKm} km` : '—'}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {log.expenseAmount
                            ? `₹${log.expenseAmount.toLocaleString('en-IN')}`
                            : log.fuelLitresAdded
                            ? `${log.fuelLitresAdded} L (₹${log.fuelCost || 0})`
                            : '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-700 max-w-xs">
                          {log.defectsReported ? (
                            <span className="text-slate-800 font-medium">{log.defectsReported}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              <CheckCircle className="w-3 h-3" />
                              <span>Inspected</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500">{log.recordedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dedicated Vehicle Expense Log Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-amber-500" />
                <span>Synced Vehicle Expense Entries ({vehicleApprovedExpenses.length})</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-3">Expense No</th>
                    <th className="py-2.5 px-3">Vehicle</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Vendor / Bill</th>
                    <th className="py-2.5 px-3">Particulars</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicleApprovedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        No approved vehicle expenses recorded for selected filter.
                      </td>
                    </tr>
                  ) : (
                    vehicleApprovedExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{exp.date}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{exp.expenseNo}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{exp.vehicleNumber}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 font-semibold">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {exp.vendorName} {exp.billNumber ? `(#${exp.billNumber})` : ''}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{exp.narration}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          ₹{exp.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Maintenance & Work Orders */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4">

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">WO No &amp; Date</th>
                    <th className="py-3 px-3">Vehicle</th>
                    <th className="py-3 px-3">Issue / Work Required</th>
                    <th className="py-3 px-3">Vendor / Workshop</th>
                    <th className="py-3 px-3">Raised By</th>
                    <th className="py-3 px-3 text-right">Est. / Actual Cost</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWorkOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No maintenance work orders found. Click "Raise Work Order Request" to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredWorkOrders.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900">{m.workOrderNo || m.id}</div>
                          <div className="text-[11px] text-slate-500">{m.date}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-slate-900">{m.vehicleNumber}</div>
                          <span
                            className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              m.severity === 'High' || m.severity === 'Critical'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {m.severity}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          <div className="font-semibold text-slate-900">{m.issueDescription}</div>
                          {m.workDoneDetails && (
                            <div className="text-[11px] text-slate-500 mt-0.5">{m.workDoneDetails}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          <div>{m.vendorName}</div>
                          {m.invoiceNumber && (
                            <div className="text-[10px] font-mono text-slate-500">Inv: {m.invoiceNumber}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {m.requestedBy || 'Transport Coordinator'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{(m.actualCost || m.estimatedCost || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              m.status === 'Approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : m.status === 'Pending Approval'
                                ? 'bg-amber-100 text-amber-800'
                                : m.status === 'Rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {m.status}
                          </span>
                          {m.approvedBy && (
                            <div className="text-[10px] text-slate-400 mt-0.5">By {m.approvedBy}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {m.status === 'Pending Approval' && isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveRejectWo(m, 'Approved')}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApproveRejectWo(m, 'Rejected')}
                                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}
                            {m.status === 'Approved' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCompletingWo(m);
                                  setCompleteActualCost(String(m.estimatedCost || ''));
                                  setCompleteWorkDone(m.workDoneDetails || '');
                                  setCompleteInvoiceNo(m.invoiceNumber || '');
                                }}
                                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                              >
                                Complete Action
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Fleet & Compliance Expiries */}
      {activeTab === 'fleet' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {vehicles.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-mono font-bold text-slate-900 text-base">{v.registrationNumber}</h4>
                  <span className="text-xs text-slate-500 font-medium">{v.nickname}</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  v.availability === 'Available' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {v.availability}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">Type &amp; Seats</span>
                  <div className="font-bold text-slate-800 mt-0.5">{v.type} ({v.capacity} Seats)</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">Ownership</span>
                  <div className="font-bold text-slate-800 mt-0.5">{v.ownership}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">Current Odometer</span>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">{v.currentOdometer.toLocaleString()} km</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">Fuel / Mileage</span>
                  <div className="font-bold text-slate-800 mt-0.5">{v.fuelType} ({v.baselineMileageKmPerLitre || 8} km/L)</div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <span className="text-slate-500 font-semibold block text-[11px]">Compliance Validity:</span>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Fitness Validity:</span>
                  <strong className="text-slate-900">{v.fitnessUpto}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Insurance Policy:</span>
                  <strong className="text-slate-900">{v.insuranceUpto}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Pollution (PUCC):</span>
                  <strong className="text-slate-900">{v.pollutionUpto}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Road Tax Paid Up To:</span>
                  <strong className="text-slate-900">{v.taxPaidUpto}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Fuel Advances */}
      {activeTab === 'fuel' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Driver Fuel Advance &amp; Settlement Register</h3>
              <p className="text-xs text-slate-500">
                Issue fuel advances to drivers and settle against actual petrol/diesel pump bills
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PrintExportToolbar
                title="Driver Fuel Advances & Settlements"
                filename="driver_fuel_advances"
                schoolName={schoolName}
                filteredData={fuelAdvances}
                allData={fuelAdvances}
                columns={[
                  { header: 'Date', accessor: (f) => f.date },
                  { header: 'Vehicle', accessor: (f) => f.vehicleNumber },
                  { header: 'Driver', accessor: (f) => f.driverName },
                  { header: 'Advance Given (INR)', accessor: (f) => f.advanceGiven },
                  { header: 'Actual Fuel Bill (INR)', accessor: (f) => f.fuelBillAmount },
                  { header: 'Cash Returned (INR)', accessor: (f) => f.cashReturned },
                  { header: 'Unsettled Balance (INR)', accessor: (f) => f.unsettledAdvance },
                  { header: 'Vendor / Receipt', accessor: (f) => `${f.vendorName} (${f.receiptNumber})` },
                  { header: 'Status', accessor: (f) => f.status },
                ]}
              />
              <button
                onClick={handleOpenGiveFuelAdvance}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>+ Give Fuel Advance to Driver</span>
              </button>
              <button
                onClick={() => handleOpenSettleFuelAdvance()}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                <Fuel className="w-4 h-4" />
                <span>Settle Fuel Advance</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Vehicle</th>
                    <th className="py-3 px-3">Driver</th>
                    <th className="py-3 px-3 font-mono">Advance Given</th>
                    <th className="py-3 px-3 font-mono">Actual Fuel Bill</th>
                    <th className="py-3 px-3 font-mono">Cash Returned</th>
                    <th className="py-3 px-3 font-mono">Unsettled</th>
                    <th className="py-3 px-3">Vendor / Receipt</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fuelAdvances.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No fuel advances recorded.
                      </td>
                    </tr>
                  ) : (
                    fuelAdvances.map((fa, i) => (
                      <tr key={fa.id || i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-slate-600 font-mono">{fa.date}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{fa.vehicleNumber}</td>
                        <td className="py-3 px-3 font-bold text-slate-800">{fa.driverName}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">₹{(fa.advanceGiven ?? fa.advanceAmount ?? 0).toLocaleString('en-IN')}</td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-800">₹{(fa.fuelBillAmount || 0).toLocaleString('en-IN')}</td>
                        <td className="py-3 px-3 font-mono text-emerald-700 font-semibold">₹{(fa.cashReturned || 0).toLocaleString('en-IN')}</td>
                        <td className="py-3 px-3 font-mono font-bold text-rose-700">
                          ₹{(fa.unsettledAdvance ?? Math.max(0, (fa.advanceGiven ?? fa.advanceAmount ?? 0) - ((fa.fuelBillAmount || 0) + (fa.cashReturned || 0)))).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          <div>{fa.vendorName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Rec: {fa.receiptNumber}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`font-bold px-2.5 py-1 rounded-full text-[10px] ${
                            fa.status === 'Settled'
                              ? 'text-emerald-800 bg-emerald-100'
                              : 'text-amber-900 bg-amber-100'
                          }`}>
                            {fa.status || 'Settled'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {fa.status !== 'Settled' ? (
                            <button
                              type="button"
                              onClick={() => handleOpenSettleFuelAdvance(fa)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] cursor-pointer"
                            >
                              Settle Bill
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Closed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Raise Work Order Request Modal */}
      {isWoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Raise Maintenance Work Order</h3>
              <button onClick={() => setIsWoModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRaiseWorkOrderSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Vehicle *</label>
                  <select
                    value={woVehicleId}
                    onChange={(e) => setWoVehicleId(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono font-bold bg-white"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registrationNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Priority / Severity *</label>
                  <select
                    value={woSeverity}
                    onChange={(e) => setWoSeverity(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Issue / Work Required *</label>
                <textarea
                  rows={2}
                  required
                  value={woIssue}
                  onChange={(e) => setWoIssue(e.target.value)}
                  placeholder="Describe repair or maintenance work needed..."
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Workshop / Vendor</label>
                  <input
                    type="text"
                    value={woVendor}
                    onChange={(e) => setWoVendor(e.target.value)}
                    placeholder="e.g. Tata Authorized Service"
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Estimated Cost (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={woEstimatedCost}
                    onChange={(e) => setWoEstimatedCost(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Remarks / Notes</label>
                <input
                  type="text"
                  value={woNotes}
                  onChange={(e) => setWoNotes(e.target.value)}
                  placeholder="Optional remarks"
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsWoModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {isAdmin ? 'Create & Approve Work Order' : 'Submit for Admin Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Work Order Modal */}
      {completingWo && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Complete Work Order ({completingWo.workOrderNo || completingWo.vehicleNumber})
              </h3>
              <button onClick={() => setCompletingWo(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteWoSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Actual Cost (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={completeActualCost}
                    onChange={(e) => setCompleteActualCost(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Workshop Invoice No</label>
                  <input
                    type="text"
                    value={completeInvoiceNo}
                    onChange={(e) => setCompleteInvoiceNo(e.target.value)}
                    placeholder="e.g. INV-892"
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Work Done Details *</label>
                <textarea
                  rows={2}
                  required
                  value={completeWorkDone}
                  onChange={(e) => setCompleteWorkDone(e.target.value)}
                  placeholder="Enter summary of repair work completed..."
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCompletingWo(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Mark Completed &amp; Sync Log Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Daily Odometer Modal */}
      {isOdoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Daily Odometer Log</h3>
                <p className="text-[11px] text-slate-500">Once-a-day general odometer reading to track vehicle running</p>
              </div>
              <button onClick={() => setIsOdoModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOdometerSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Log Date (System Driven)</label>
                  <input
                    type="date"
                    required
                    value={todayStr}
                    readOnly
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-mono bg-slate-100 text-slate-700 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Select Vehicle *</label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => {
                      setSelectedVehicleId(e.target.value);
                      const v = vehicles.find((veh) => veh.id === e.target.value);
                      if (v) {
                        setOdoStart(v.currentOdometer || 0);
                        setOdoEnd((v.currentOdometer || 0) + 25);
                        setDriverName(v.assignedDriverName || '');
                      }
                    }}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white font-mono font-bold"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registrationNumber} ({v.currentOdometer || 0} km)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Assigned Driver Name (Auto-Populated)</label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Auto-fetched from Vehicle-Driver Master"
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Start Odometer (km)</label>
                  <input
                    type="number"
                    required
                    value={odoStart}
                    onChange={(e) => setOdoStart(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">End Odometer (km)</label>
                  <input
                    type="number"
                    required
                    value={odoEnd}
                    onChange={(e) => setOdoEnd(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                <span className="text-emerald-900 font-semibold">Daily Distance Run:</span>
                <strong className="text-emerald-800 font-mono font-bold text-sm">
                  +{Math.max(0, Number(odoEnd) - Number(odoStart))} km
                </strong>
              </div>

              <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200 text-[11px] text-amber-900">
                <strong>Integrated Expense &amp; Odometer Sync:</strong> Fuel and maintenance expenses are entered under <em>Expenses</em> (with odometer reading) and automatically sync here to prevent duplicate entries.
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Inspection / Running Remarks (Optional)</label>
                <input
                  type="text"
                  value={defectsReported}
                  onChange={(e) => setDefectsReported(e.target.value)}
                  placeholder="e.g. Morning & Afternoon school shifts completed"
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOdoModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Daily Odometer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Give or Settle Fuel Advance Modal */}
      {isFuelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {fuelModalMode === 'give' ? 'Give Fuel Advance to Driver' : 'Settle Driver Fuel Advance'}
              </h3>
              <button onClick={() => setIsFuelModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFuelSettleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Select Vehicle *</label>
                  <select
                    value={fuelVehicleId}
                    onChange={(e) => {
                      setFuelVehicleId(e.target.value);
                      const v = vehicles.find((veh) => veh.id === e.target.value);
                      if (v) setFuelDriverName(v.assignedDriverName || '');
                    }}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono font-bold bg-white"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registrationNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Driver Name *</label>
                  <input
                    type="text"
                    required
                    value={fuelDriverName}
                    onChange={(e) => setFuelDriverName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Advance Given (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={fuelAdvanceGiven}
                    onChange={(e) => setFuelAdvanceGiven(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Payment Mode</label>
                  <select
                    value={fuelPaymentMode}
                    onChange={(e) => setFuelPaymentMode(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white font-bold"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank">Bank</option>
                  </select>
                </div>
              </div>

              {fuelModalMode === 'settle' && (
                <>
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Actual Fuel Bill (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={fuelBillAmount}
                        onChange={(e) => setFuelBillAmount(Number(e.target.value))}
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Fuel Litres (L)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={fuelLitres}
                        onChange={(e) => setDailyFuelLitres(Number(e.target.value))}
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Cash Returned (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={cashReturned}
                        onChange={(e) => setCashReturned(Number(e.target.value))}
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-xs font-mono text-emerald-700 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Fuel Pump / Vendor Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. IndianOil Highway Point"
                      value={fuelVendor}
                      onChange={(e) => setFuelVendor(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Fuel Bill / Receipt No *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. IOCL-4821"
                      value={receiptNo}
                      onChange={(e) => setReceiptNo(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </>
              )}

              {fuelModalMode === 'give' && (
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Purpose / Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Advance given for morning diesel refill"
                    value={fuelVendor}
                    onChange={(e) => setFuelVendor(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFuelModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {fuelModalMode === 'give' ? 'Issue Fuel Advance' : 'Save Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

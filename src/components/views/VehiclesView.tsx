import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpenCheck,
  IndianRupee,
  ShieldCheck,
  Wrench,
  Fuel,
  Camera,
  Check,
  Ban,
  Plus,
  X,
  Eye,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  FileText,
} from 'lucide-react';
import {
  Vehicle,
  OdometerLog,
  FuelAdvanceAndPurchase,
  MaintenanceRequest,
  ExpenseRecord,
  UserRole,
  LogBookPhotoSlot,
  SchoolConfig,
} from '../../types/index.js';
import { PrintExportToolbar, FilterPopover } from '../../utils/exportPrint.js';
import { CameraCaptureModal } from '../modals/CameraCaptureModal.js';
import {
  LOG_BOOK_PHOTO_SLOTS,
  MORNING_INSPECTION_CHECKS,
  getIstDateTimeParts,
  findPreviousLogForVehicle,
  getLogComparableTimestampMs,
  formatTimeDifferenceLabel,
  getRateForFuelType,
  inferFuelTypeFromText,
  buildReconciledLogBookRows,
  ReconciledLogBookRow,
} from '../../utils/logBookReconciliation.js';

export type FleetSubTab = 'odometer' | 'cost_center' | 'statutory' | 'maintenance' | 'fuel';

interface VehiclesViewProps {
  schoolName?: string;
  config?: SchoolConfig;
  onUpdateConfig?: (cfg: Partial<SchoolConfig>) => Promise<any>;
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
  onSaveVehicle?: (data: Partial<Vehicle>) => Promise<any>;
  onDeleteExpense?: (id: string) => Promise<any>;
}

function normalizeFleetSubTab(raw?: string): FleetSubTab {
  if (raw === 'cost_center' || raw === 'vehicle_ledger') return 'cost_center';
  if (raw === 'statutory' || raw === 'fleet' || raw === 'directory') return 'statutory';
  if (raw === 'maintenance') return 'maintenance';
  if (raw === 'fuel') return 'fuel';
  return 'odometer';
}

function getDaysRemaining(dateStr?: string): number | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return null;
  const todayIst = getIstDateTimeParts().dateStr;
  const targetMs = Date.parse(`${dateStr.trim()}T00:00:00Z`);
  const todayMs = Date.parse(`${todayIst}T00:00:00Z`);
  if (Number.isNaN(targetMs) || Number.isNaN(todayMs)) return null;
  return Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));
}

export const VehiclesView: React.FC<VehiclesViewProps> = ({
  schoolName,
  config,
  onUpdateConfig,
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
  onSaveVehicle,
  onDeleteExpense,
}) => {
  const isAdmin = currentRole === 'Admin';
  const isReadOnly = currentRole === 'Principal';
  const canEditVehicles = Boolean(onSaveVehicle) && (currentRole === 'Admin' || currentRole === 'Transport Coordinator');
  const todayStr = getIstDateTimeParts().dateStr;

  const [activeTab, setActiveTab] = useState<FleetSubTab>(() => normalizeFleetSubTab(initialSubTab));

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(normalizeFleetSubTab(initialSubTab));
    }
  }, [initialSubTab]);

  // -------------------------------------------------------------------------
  // SHARED FILTERS & STATE
  // -------------------------------------------------------------------------
  const [logVehicleFilter, setLogVehicleFilter] = useState<string>('all');
  const [logDateFilter, setLogDateFilter] = useState<string>('');
  const [woVehicleFilter, setWoVehicleFilter] = useState<string>('all');
  const [woStatusFilter, setWoStatusFilter] = useState<string>('all');

  // Cost Center state
  const [costVehicleReg, setCostVehicleReg] = useState<string>(
    vehicles[0]?.registrationNumber || ''
  );
  useEffect(() => {
    if (vehicles.length > 0 && !vehicles.some((v) => v.registrationNumber === costVehicleReg)) {
      setCostVehicleReg(vehicles[0].registrationNumber);
    }
  }, [vehicles, costVehicleReg]);

  // Statutory filter state
  const [statStatusFilter, setStatStatusFilter] = useState<
    'all' | 'expired' | 'expiring_soon' | 'valid'
  >('all');
  const [statOwnershipFilter, setStatOwnershipFilter] = useState<
    'all' | 'School-Owned' | 'Rented'
  >('all');
  const [editingStatutoryVehicle, setEditingStatutoryVehicle] = useState<Vehicle | null>(null);
  const [statutorySaveBusy, setStatutorySaveBusy] = useState(false);
  const [statutorySaveError, setStatutorySaveError] = useState<string | null>(null);
  const [previewDocModal, setPreviewDocModal] = useState<{ title: string; url: string } | null>(
    null
  );

  // -------------------------------------------------------------------------
  // SUB-MODULE 1: DAILY LOG BOOK & LIVE CAMERA ENTRY STATE
  // -------------------------------------------------------------------------
  const [isLogEntryOpen, setIsLogEntryOpen] = useState(false);
  const [liveClock, setLiveClock] = useState(() => getIstDateTimeParts());

  useEffect(() => {
    if (!isLogEntryOpen) return;
    setLiveClock(getIstDateTimeParts());
    const timer = setInterval(() => {
      setLiveClock(getIstDateTimeParts());
    }, 1000);
    return () => clearInterval(timer);
  }, [isLogEntryOpen]);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [driverName, setDriverName] = useState<string>(vehicles[0]?.assignedDriverName || '');
  const [currentReadingInput, setCurrentReadingInput] = useState<string>('');
  const [defectsReported, setDefectsReported] = useState<string>('');
  const [logSubmitBusy, setLogSubmitBusy] = useState(false);
  const [logFormError, setLogFormError] = useState<string | null>(null);

  // 6 Mandatory Morning Inspection Checkboxes
  const [checklist, setChecklist] = useState<{
    cleanOutside: boolean;
    cleanInside: boolean;
    hasStepny: boolean;
    hasJack: boolean;
    hasRod: boolean;
    mobileCheckedInMorning: boolean;
  }>({
    cleanOutside: false,
    cleanInside: false,
    hasStepny: false,
    hasJack: false,
    hasRod: false,
    mobileCheckedInMorning: false,
  });

  // 6 Direct-Camera Photos (NO file uploads)
  const [capturedPhotos, setCapturedPhotos] = useState<Partial<Record<LogBookPhotoSlot, string>>>(
    {}
  );
  const [activeCameraSlot, setActiveCameraSlot] = useState<LogBookPhotoSlot | null>(null);

  // Inspection / Photo Lightbox for existing logbook rows
  const [inspectingRow, setInspectingRow] = useState<ReconciledLogBookRow | null>(null);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0],
    [vehicles, selectedVehicleId]
  );

  // Find previous / yesterday's entry automatically for the selected vehicle
  const previousEntryForSelected = useMemo(() => {
    if (!selectedVehicle) return undefined;
    return findPreviousLogForVehicle(
      odometerLogs,
      selectedVehicle.id,
      selectedVehicle.registrationNumber
    );
  }, [odometerLogs, selectedVehicle]);

  const previousReadingForSelected = useMemo(() => {
    if (previousEntryForSelected) {
      return Number(
        previousEntryForSelected.endOdometer ??
          previousEntryForSelected.closingOdometer ??
          previousEntryForSelected.startOdometer ??
          0
      );
    }
    return Number(selectedVehicle?.currentOdometer || 0);
  }, [previousEntryForSelected, selectedVehicle]);

  const liveTimeDiffLabel = useMemo(() => {
    if (!previousEntryForSelected) return 'First Entry';
    const prevMs = getLogComparableTimestampMs(previousEntryForSelected);
    const currMs = Date.parse(liveClock.iso);
    if (prevMs > 0 && !Number.isNaN(currMs) && currMs >= prevMs) {
      return formatTimeDifferenceLabel(Math.round((currMs - prevMs) / 60000));
    }
    return '—';
  }, [previousEntryForSelected, liveClock.iso]);

  const parsedCurrentReading =
    currentReadingInput.trim() === '' ? NaN : Number(currentReadingInput);
  const netRunPreview = !Number.isNaN(parsedCurrentReading)
    ? parsedCurrentReading - previousReadingForSelected
    : null;

  const sameDayMaintPreview = useMemo(() => {
    if (!selectedVehicle) return [];
    const regUpper = selectedVehicle.registrationNumber.trim().toUpperCase();
    return maintenanceRequests.filter(
      (m) =>
        (m.date === liveClock.dateStr || m.reportedDate === liveClock.dateStr) &&
        (m.vehicleId === selectedVehicle.id ||
          String(m.vehicleNumber || '').trim().toUpperCase() === regUpper)
    );
  }, [maintenanceRequests, selectedVehicle, liveClock.dateStr]);

  const sameDayFuelPreview = useMemo(() => {
    if (!selectedVehicle) return 0;
    const regUpper = selectedVehicle.registrationNumber.trim().toUpperCase();
    return expenses
      .filter(
        (e) =>
          e.date === liveClock.dateStr &&
          e.approvalStatus !== 'Rejected' &&
          String(e.category || '').toLowerCase().includes('fuel') &&
          (e.vehicleId === selectedVehicle.id ||
            String(e.vehicleNumber || '').trim().toUpperCase() === regUpper)
      )
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses, selectedVehicle, liveClock.dateStr]);

  // Local Fuel Rates Editor State (Chainpur, Siwan, Bihar 841203)
  const [isEditingFuelRates, setIsEditingFuelRates] = useState(false);
  const [rateDiesel, setRateDiesel] = useState<string>(
    config?.fuelRates?.Diesel ? String(config.fuelRates.Diesel) : ''
  );
  const [ratePetrol, setRatePetrol] = useState<string>(
    config?.fuelRates?.Petrol ? String(config.fuelRates.Petrol) : ''
  );
  const [rateCng, setRateCng] = useState<string>(
    config?.fuelRates?.CNG ? String(config.fuelRates.CNG) : ''
  );
  const [fuelRateSaving, setFuelRateSaving] = useState(false);

  useEffect(() => {
    setRateDiesel(config?.fuelRates?.Diesel ? String(config.fuelRates.Diesel) : '');
    setRatePetrol(config?.fuelRates?.Petrol ? String(config.fuelRates.Petrol) : '');
    setRateCng(config?.fuelRates?.CNG ? String(config.fuelRates.CNG) : '');
  }, [config?.fuelRates?.Diesel, config?.fuelRates?.Petrol, config?.fuelRates?.CNG]);

  const handleSaveFuelRates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateConfig) return;
    setFuelRateSaving(true);
    try {
      await onUpdateConfig({
        fuelRates: {
          Diesel: Number(rateDiesel) > 0 ? Number(rateDiesel) : undefined,
          Petrol: Number(ratePetrol) > 0 ? Number(ratePetrol) : undefined,
          CNG: Number(rateCng) > 0 ? Number(rateCng) : undefined,
          location: 'Chainpur, Siwan, Bihar 841203',
          updatedAt: todayStr,
          updatedBy: currentRole,
        },
      });
      setIsEditingFuelRates(false);
    } finally {
      setFuelRateSaving(false);
    }
  };

  // Reconcile all log book rows cleanly
  const allReconciledRows = useMemo(
    () =>
      buildReconciledLogBookRows(
        odometerLogs,
        vehicles,
        expenses,
        maintenanceRequests,
        fuelAdvances,
        config?.fuelRates
      ),
    [odometerLogs, vehicles, expenses, maintenanceRequests, fuelAdvances, config?.fuelRates]
  );

  const filteredLogRows = useMemo(() => {
    return allReconciledRows.filter((row) => {
      if (logVehicleFilter !== 'all' && row.log.vehicleNumber !== logVehicleFilter) return false;
      if (logDateFilter && row.date !== logDateFilter) return false;
      return true;
    });
  }, [allReconciledRows, logVehicleFilter, logDateFilter]);

  const handleOpenOdometerModal = (veh?: Vehicle) => {
    const target = veh || vehicles[0];
    if (target) {
      setSelectedVehicleId(target.id);
      setDriverName(target.assignedDriverName || 'Assigned Driver');
    }
    setCurrentReadingInput('');
    setDefectsReported('');
    setLogFormError(null);
    setChecklist({
      cleanOutside: false,
      cleanInside: false,
      hasStepny: false,
      hasJack: false,
      hasRod: false,
      mobileCheckedInMorning: false,
    });
    setCapturedPhotos({});
    setLiveClock(getIstDateTimeParts());
    setIsLogEntryOpen(true);
  };

  const handleSelectLogVehicle = (vehId: string) => {
    setSelectedVehicleId(vehId);
    const v = vehicles.find((veh) => veh.id === vehId);
    if (v) {
      setDriverName(v.assignedDriverName || 'Assigned Driver');
    }
    setCurrentReadingInput('');
    setLogFormError(null);
  };

  const handleOdometerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogFormError(null);

    if (!selectedVehicle) {
      setLogFormError('Please select a vehicle.');
      return;
    }
    if (Number.isNaN(parsedCurrentReading) || parsedCurrentReading < 0) {
      setLogFormError('Please enter a valid current odometer reading.');
      return;
    }
    if (parsedCurrentReading < previousReadingForSelected) {
      setLogFormError(
        `Current reading (${parsedCurrentReading.toLocaleString('en-IN')} km) cannot be less than previous reading (${previousReadingForSelected.toLocaleString('en-IN')} km).`
      );
      return;
    }
    if (!driverName.trim()) {
      setLogFormError('Driver name is required.');
      return;
    }

    const submitStamp = getIstDateTimeParts(new Date());
    const prevMs = previousEntryForSelected
      ? getLogComparableTimestampMs(previousEntryForSelected)
      : 0;
    const currMs = Date.parse(submitStamp.iso);
    const diffMins =
      prevMs > 0 && !Number.isNaN(currMs) && currMs >= prevMs
        ? Math.round((currMs - prevMs) / 60000)
        : undefined;

    setLogSubmitBusy(true);
    try {
      await onRecordOdometer({
        date: submitStamp.dateStr,
        entryTime: submitStamp.timeStr,
        recordedAtIso: submitStamp.iso,
        previousLogId: previousEntryForSelected?.id,
        previousDate: previousEntryForSelected?.date,
        previousTime: previousEntryForSelected?.entryTime,
        timeDiffMinutes: diffMins,
        timeDiffLabel: diffMins !== undefined ? formatTimeDifferenceLabel(diffMins) : undefined,
        vehicleId: selectedVehicle.id,
        vehicleNumber: selectedVehicle.registrationNumber,
        driverName: driverName.trim(),
        startOdometer: previousReadingForSelected,
        endOdometer: parsedCurrentReading,
        tripKm: parsedCurrentReading - previousReadingForSelected,
        fuelLitresAdded: 0,
        fuelCost: 0,
        cleanOutside: checklist.cleanOutside,
        cleanInside: checklist.cleanInside,
        hasStepny: checklist.hasStepny,
        hasJack: checklist.hasJack,
        hasRod: checklist.hasRod,
        mobileCheckedInMorning: checklist.mobileCheckedInMorning,
        neatnessChecked: checklist.cleanOutside && checklist.cleanInside,
        odometerPhoto: capturedPhotos.odometerPhoto,
        exteriorFrontPhoto: capturedPhotos.exteriorFrontPhoto,
        exteriorLhsPhoto: capturedPhotos.exteriorLhsPhoto,
        exteriorRhsPhoto: capturedPhotos.exteriorRhsPhoto,
        exteriorBackPhoto: capturedPhotos.exteriorBackPhoto,
        insidePhoto: capturedPhotos.insidePhoto,
        defectsReported: defectsReported.trim() || undefined,
        recordedBy: currentRole,
        entryType: 'General Daily Reading',
      });
      setIsLogEntryOpen(false);
    } catch (err: any) {
      setLogFormError(err?.message || 'Failed to save log book entry.');
    } finally {
      setLogSubmitBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // SUB-MODULE 2: VEHICLE COST CENTER DATA
  // -------------------------------------------------------------------------
  const costCenterSummaryByVehicle = useMemo(() => {
    return vehicles.map((veh) => {
      const regUpper = veh.registrationNumber.trim().toUpperCase();
      const vehExps = expenses.filter(
        (e) =>
          e.approvalStatus !== 'Rejected' &&
          e.approvalStatus !== 'Pending Approval' &&
          (e.vehicleId === veh.id ||
            String(e.vehicleNumber || '').trim().toUpperCase() === regUpper)
      );
      const vehWos = maintenanceRequests.filter(
        (m) =>
          (m.status === 'Completed' || m.status === 'Paid') &&
          (m.vehicleId === veh.id ||
            String(m.vehicleNumber || '').trim().toUpperCase() === regUpper)
      );
      const fuelExps = vehExps.filter((e) =>
        String(e.category || '').toLowerCase().includes('fuel')
      );
      const repairExps = vehExps.filter((e) => {
        const cat = String(e.category || '').toLowerCase();
        return (
          cat.includes('repair') ||
          cat.includes('maint') ||
          cat.includes('spare') ||
          cat.includes('tyre') ||
          cat.includes('battery') ||
          cat.includes('service')
        );
      });
      const fuelIds = new Set(fuelExps.map((e) => e.id));
      const repairIds = new Set(repairExps.map((e) => e.id));
      const otherExps = vehExps.filter((e) => !fuelIds.has(e.id) && !repairIds.has(e.id));

      const fuelSpend = fuelExps.reduce((s, e) => s + Number(e.amount || 0), 0);
      const expRepairSpend = repairExps.reduce((s, e) => s + Number(e.amount || 0), 0);
      const woSpend = vehWos.reduce(
        (s, m) => s + Number(m.actualCost || m.estimatedCost || 0),
        0
      );
      const repairSpend = expRepairSpend + woSpend;
      const otherSpend = otherExps.reduce((s, e) => s + Number(e.amount || 0), 0);
      const totalSpend = fuelSpend + repairSpend + otherSpend;

      const vehLogs = allReconciledRows.filter(
        (r) =>
          r.log.vehicleId === veh.id ||
          String(r.log.vehicleNumber || '').trim().toUpperCase() === regUpper
      );
      const totalKm = vehLogs.reduce((s, r) => s + r.netRun, 0);
      const totalFuelLitres = fuelExps.reduce((s, e) => {
        if (Number(e.fuelLitres) > 0) return s + Number(e.fuelLitres);
        const ft = e.fuelType || inferFuelTypeFromText(e.narration) || veh.fuelType;
        const rate =
          Number(e.fuelRate || 0) || getRateForFuelType(config?.fuelRates, ft);
        if (rate > 0 && Number(e.amount) > 0 && ft !== 'Electric') {
          return s + Math.round((Number(e.amount) / rate) * 100) / 100;
        }
        return s;
      }, 0);
      const thresholdKmPerL = Number(
        veh.expectedMileageKmPerL ?? veh.baselineMileageKmPerLitre ?? 6.0
      );
      const actualKmPerL =
        totalFuelLitres > 0 && totalKm > 0
          ? Number((totalKm / totalFuelLitres).toFixed(2))
          : 0;
      const costPerKm = totalKm > 0 ? Number((totalSpend / totalKm).toFixed(2)) : 0;

      return {
        vehicle: veh,
        fuelSpend,
        repairSpend,
        otherSpend,
        totalSpend,
        totalKm,
        totalFuelLitres,
        thresholdKmPerL,
        actualKmPerL,
        costPerKm,
        expenses: vehExps,
        workOrders: vehWos,
      };
    });
  }, [vehicles, expenses, maintenanceRequests, allReconciledRows]);

  const selectedCostCenter = useMemo(
    () =>
      costCenterSummaryByVehicle.find(
        (c) => c.vehicle.registrationNumber === costVehicleReg
      ) || costCenterSummaryByVehicle[0],
    [costCenterSummaryByVehicle, costVehicleReg]
  );

  // -------------------------------------------------------------------------
  // SUB-MODULE 3: STATUTORY DETAILS DATA
  // -------------------------------------------------------------------------
  const statutoryRows = useMemo(() => {
    return vehicles
      .map((v) => {
        const docs = [
          { key: 'registrationValidity', label: 'RC Validity', date: v.registrationValidity },
          { key: 'taxPaidUpto', label: 'Road Tax', date: v.taxPaidUpto },
          { key: 'fitnessUpto', label: 'Fitness', date: v.fitnessUpto },
          { key: 'insuranceUpto', label: 'Insurance', date: v.insuranceUpto },
          { key: 'pollutionUpto', label: 'Pollution (PUC)', date: v.pollutionUpto },
          { key: 'permitUpto', label: 'Permit', date: v.permitUpto },
        ];
        if (v.ownership === 'Rented' && v.agreementEndDate) {
          docs.push({
            key: 'agreementEndDate',
            label: 'Rent Agreement',
            date: v.agreementEndDate,
          });
        }

        const dayValues = docs
          .map((d) => getDaysRemaining(d.date))
          .filter((d): d is number => d !== null);
        const minDays = dayValues.length > 0 ? Math.min(...dayValues) : null;
        const complianceState: 'expired' | 'expiring_soon' | 'valid' =
          minDays !== null && minDays < 0
            ? 'expired'
            : minDays !== null && minDays <= 30
            ? 'expiring_soon'
            : 'valid';

        return {
          vehicle: v,
          docs,
          minDays,
          complianceState,
        };
      })
      .filter((row) => {
        if (statOwnershipFilter !== 'all' && row.vehicle.ownership !== statOwnershipFilter)
          return false;
        if (statStatusFilter !== 'all' && row.complianceState !== statStatusFilter) return false;
        return true;
      });
  }, [vehicles, statOwnershipFilter, statStatusFilter]);

  const statutoryMetrics = useMemo(() => {
    const all = vehicles.map((v) => {
      const dates = [
        v.registrationValidity,
        v.taxPaidUpto,
        v.fitnessUpto,
        v.insuranceUpto,
        v.pollutionUpto,
        v.permitUpto,
      ];
      const days = dates
        .map((d) => getDaysRemaining(d))
        .filter((d): d is number => d !== null);
      const minD = days.length > 0 ? Math.min(...days) : 999;
      return minD;
    });
    return {
      total: vehicles.length,
      expired: all.filter((d) => d < 0).length,
      expiringSoon: all.filter((d) => d >= 0 && d <= 30).length,
      valid: all.filter((d) => d > 30).length,
    };
  }, [vehicles]);

  const handleSaveStatutorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStatutoryVehicle || !onSaveVehicle) return;
    setStatutorySaveBusy(true);
    setStatutorySaveError(null);
    try {
      await onSaveVehicle(editingStatutoryVehicle);
      setEditingStatutoryVehicle(null);
    } catch (err: any) {
      setStatutorySaveError(err?.message || 'Failed to update statutory dates.');
    } finally {
      setStatutorySaveBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // SUB-MODULE 4 & 5: WORK ORDERS & FUEL ADVANCES MODALS
  // -------------------------------------------------------------------------
  const filteredWorkOrders = maintenanceRequests.filter((m) => {
    if (woVehicleFilter !== 'all' && m.vehicleNumber !== woVehicleFilter) return false;
    if (woStatusFilter !== 'all' && m.status !== woStatusFilter) return false;
    return true;
  });

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

  const [isWoModalOpen, setIsWoModalOpen] = useState(false);
  const [woVehicleId, setWoVehicleId] = useState(vehicles[0]?.id || '');
  const [woDate] = useState(todayStr);
  const [woIssue, setWoIssue] = useState('');
  const [woSeverity, setWoSeverity] = useState<MaintenanceRequest['severity']>('Medium');
  const [woVendor, setWoVendor] = useState('');
  const [woEstimatedCost, setWoEstimatedCost] = useState('');
  const [woNotes, setWoNotes] = useState('');

  const [completingWo, setCompletingWo] = useState<MaintenanceRequest | null>(null);
  const [completeActualCost, setCompleteActualCost] = useState('');
  const [completeWorkDone, setCompleteWorkDone] = useState('');
  const [completeInvoiceNo, setCompleteInvoiceNo] = useState('');

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
      const veh = vehicles.find(
        (v) => v.id === existing.vehicleId || v.registrationNumber === existing.vehicleNumber
      );
      const ft = existing.fuelType || veh?.fuelType || 'Diesel';
      const cfgRate = existing.fuelRate || existing.ratePerLitre || getRateForFuelType(config?.fuelRates, ft);
      setFuelAdvanceGiven(advGiven);
      setFuelBillAmount(existing.fuelBillAmount || advGiven);
      setCashReturned(existing.cashReturned || 0);
      setDailyFuelLitres(
        existing.litresPurchased ||
          (cfgRate > 0 ? Number((advGiven / cfgRate).toFixed(2)) : 0)
      );
      setFuelVendor(existing.vendorName === 'Advance Issued for Fuel' ? '' : existing.vendorName);
      setReceiptNo(existing.receiptNumber === 'PENDING-BILL' ? '' : existing.receiptNumber);
      setFuelPaymentMode(existing.paymentMode || 'Cash');
    } else {
      const target = vehicles[0];
      setEditingFuelAdvanceId(undefined);
      setFuelVehicleId(target?.id || '');
      setFuelDriverName(target?.assignedDriverName || '');
      const ft = target?.fuelType || 'Diesel';
      const cfgRate = getRateForFuelType(config?.fuelRates, ft);
      setFuelAdvanceGiven(2000);
      setFuelBillAmount(1800);
      setCashReturned(200);
      setDailyFuelLitres(cfgRate > 0 ? Number((1800 / cfgRate).toFixed(2)) : 0);
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
      const vehFuelType = veh?.fuelType || 'Diesel';
      const cfgRate = getRateForFuelType(config?.fuelRates, vehFuelType);
      if (fuelModalMode === 'give') {
        await onSettleFuelAdvance({
          date: todayStr,
          vehicleId: veh?.id || '',
          vehicleNumber: veh?.registrationNumber || '',
          driverId: veh?.assignedDriverId || 'emp-101',
          driverName: fuelDriverName || veh?.assignedDriverName || 'Driver',
          fuelType: vehFuelType,
          advanceGiven: Number(fuelAdvanceGiven),
          fuelBillAmount: 0,
          cashReturned: 0,
          unsettledAdvance: Number(fuelAdvanceGiven),
          litresPurchased: 0,
          fuelRate: cfgRate > 0 ? cfgRate : 0,
          vendorName: fuelVendor.trim() || 'Advance Issued to Driver for Fuel',
          receiptNumber: receiptNo.trim() || 'PENDING-BILL',
          paymentMode: fuelPaymentMode,
          status: 'Advance Given',
          settledBy: currentRole,
        });
      } else {
        const finalQty =
          Number(fuelLitres) > 0
            ? Number(fuelLitres)
            : cfgRate > 0 && Number(fuelBillAmount) > 0
            ? Number((Number(fuelBillAmount) / cfgRate).toFixed(2))
            : 0;
        await onSettleFuelAdvance({
          id: editingFuelAdvanceId,
          date: todayStr,
          vehicleId: veh?.id || '',
          vehicleNumber: veh?.registrationNumber || '',
          driverId: veh?.assignedDriverId || 'emp-101',
          driverName: fuelDriverName || veh?.assignedDriverName || 'Driver',
          fuelType: vehFuelType,
          advanceGiven: Number(fuelAdvanceGiven),
          fuelBillAmount: Number(fuelBillAmount),
          cashReturned: Number(cashReturned),
          unsettledAdvance: Math.max(
            0,
            Number(fuelAdvanceGiven) - (Number(fuelBillAmount) + Number(cashReturned))
          ),
          litresPurchased: finalQty,
          fuelRate:
            finalQty > 0
              ? Number((Number(fuelBillAmount) / finalQty).toFixed(2))
              : cfgRate > 0
              ? cfgRate
              : 0,
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

  // Log book stats for selected vehicle filter
  const totalLoggedNetRun = filteredLogRows.reduce((s, r) => s + r.netRun, 0);
  const totalDayFuelAmount = filteredLogRows.reduce((s, r) => s + r.fuelAmountOnDay, 0);
  const totalDayMaintAmount = filteredLogRows.reduce((s, r) => s + r.maintenanceAmountOnDay, 0);
  const activeCameraSlotMeta = activeCameraSlot
    ? LOG_BOOK_PHOTO_SLOTS.find((s) => s.key === activeCameraSlot)
    : null;

  return (
    <div className="space-y-6">
      {/* =================================================================== */}
      {/* FLEET MANAGEMENT MODULE HEADER & SUB-MODULE SWITCHER                */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Fleet Management</span>
              <span aria-hidden="true">·</span>
              <span>{vehicles.length} Registered Vehicles</span>
              <span aria-hidden="true">·</span>
              <span>
                {activeTab === 'odometer'
                  ? `${filteredLogRows.length} Log Entries`
                  : activeTab === 'cost_center'
                  ? `Cost Center`
                  : activeTab === 'statutory'
                  ? `${statutoryRows.length} Compliance Records`
                  : activeTab === 'maintenance'
                  ? `${filteredWorkOrders.length} Work Orders`
                  : `${fuelAdvances.length} Fuel Advances`}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
              {activeTab === 'odometer'
                ? 'Daily Vehicle Log Book & Morning Inspection'
                : activeTab === 'cost_center'
                ? 'Vehicle Cost Center & Operating Efficiency'
                : activeTab === 'statutory'
                ? 'Statutory Details, Renewals & Rent Agreements'
                : activeTab === 'maintenance'
                ? 'Work Orders & Maintenance Register'
                : 'Driver Fuel Advances & Pump Settlement'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'odometer' && (
              <>
                <FilterPopover
                  activeCount={
                    (logVehicleFilter !== 'all' ? 1 : 0) + (logDateFilter ? 1 : 0)
                  }
                  onReset={() => {
                    setLogVehicleFilter('all');
                    setLogDateFilter('');
                  }}
                >
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Vehicle
                    </label>
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
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={logDateFilter}
                      onChange={(e) => setLogDateFilter(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl text-xs font-mono bg-slate-50"
                    />
                  </div>
                </FilterPopover>
                <PrintExportToolbar
                  title="Fleet Management — Daily Vehicle Log Book & Reconciliation"
                  filename="fleet_daily_log_book"
                  schoolName={schoolName}
                  filteredData={filteredLogRows}
                  allData={allReconciledRows}
                  hasActiveFilters={logVehicleFilter !== 'all' || Boolean(logDateFilter)}
                  filterSummary={
                    [
                      logVehicleFilter !== 'all' ? `Vehicle: ${logVehicleFilter}` : '',
                      logDateFilter ? `Date: ${logDateFilter}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ') || undefined
                  }
                  columns={[
                    { header: 'Date', accessor: (r) => r.date },
                    { header: 'Time', accessor: (r) => r.timeDisplay },
                    { header: 'Time Diff vs Prev', accessor: (r) => r.timeDiffLabel || '—' },
                    { header: 'Vehicle', accessor: (r) => r.log.vehicleNumber },
                    { header: 'Driver', accessor: (r) => r.log.driverName },
                    { header: 'Prev Reading (Km)', accessor: (r) => r.previousReading },
                    { header: 'Current Reading (Km)', accessor: (r) => r.currentReading },
                    { header: 'Net Run (Km)', accessor: (r) => r.netRun },
                    {
                      header: 'Morning Checklist',
                      accessor: (r) =>
                        r.hasAnyChecklist ? `${r.checklistCount}/6 Passed` : 'Legacy Entry',
                    },
                    {
                      header: 'Live Photos',
                      accessor: (r) => `${r.photoCount}/6 Captured`,
                    },
                    {
                      header: 'Maintenance on Day',
                      accessor: (r) =>
                        r.maintenanceSummary.length > 0
                          ? r.maintenanceSummary.join('; ')
                          : 'None',
                    },
                    { header: 'Fuel Amount (INR)', accessor: (r) => r.fuelAmountOnDay },
                    { header: 'Logged By', accessor: (r) => r.log.recordedBy },
                  ]}
                />
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleOpenOdometerModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span>New Log Book Entry</span>
                  </button>
                )}
              </>
            )}

            {activeTab === 'cost_center' && selectedCostCenter && (
              <PrintExportToolbar
                title={`Vehicle Cost Center — ${selectedCostCenter.vehicle.registrationNumber}`}
                filename={`cost_center_${selectedCostCenter.vehicle.registrationNumber}`}
                schoolName={schoolName}
                filteredData={selectedCostCenter.expenses}
                allData={selectedCostCenter.expenses}
                columns={[
                  { header: 'Date', accessor: (e) => e.date },
                  { header: 'Ref / Expense No', accessor: (e) => e.expenseNo },
                  { header: 'Vehicle', accessor: (e) => e.vehicleNumber || '' },
                  { header: 'Category', accessor: (e) => e.category },
                  { header: 'Vendor', accessor: (e) => e.vendorName },
                  { header: 'Payment Mode', accessor: (e) => e.paymentMode },
                  { header: 'Amount (INR)', accessor: (e) => e.amount },
                  { header: 'Narration', accessor: (e) => e.narration },
                ]}
              />
            )}

            {activeTab === 'statutory' && (
              <PrintExportToolbar
                title="Fleet Statutory Compliance & Validity Register"
                filename="fleet_statutory_details"
                schoolName={schoolName}
                filteredData={statutoryRows}
                allData={statutoryRows}
                hasActiveFilters={
                  statStatusFilter !== 'all' || statOwnershipFilter !== 'all'
                }
                columns={[
                  { header: 'Vehicle Reg', accessor: (r) => r.vehicle.registrationNumber },
                  { header: 'Type & Seats', accessor: (r) => `${r.vehicle.type} (${r.vehicle.capacity})` },
                  { header: 'Ownership', accessor: (r) => r.vehicle.ownership },
                  { header: 'RC Validity', accessor: (r) => r.vehicle.registrationValidity },
                  { header: 'Tax Paid Upto', accessor: (r) => r.vehicle.taxPaidUpto },
                  { header: 'Fitness Upto', accessor: (r) => r.vehicle.fitnessUpto },
                  { header: 'Insurance Upto', accessor: (r) => r.vehicle.insuranceUpto },
                  { header: 'Pollution (PUC) Upto', accessor: (r) => r.vehicle.pollutionUpto },
                  { header: 'Permit Upto', accessor: (r) => r.vehicle.permitUpto || '—' },
                  { header: 'Agreement End', accessor: (r) => r.vehicle.agreementEndDate || '—' },
                ]}
              />
            )}

            {activeTab === 'maintenance' && (
              <>
                <FilterPopover
                  activeCount={
                    (woVehicleFilter !== 'all' ? 1 : 0) + (woStatusFilter !== 'all' ? 1 : 0)
                  }
                  onReset={() => {
                    setWoVehicleFilter('all');
                    setWoStatusFilter('all');
                  }}
                >
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Vehicle
                    </label>
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
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Work Order Status
                    </label>
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
                    { header: 'Date', accessor: (m) => m.date || m.reportedDate || '' },
                    { header: 'Vehicle', accessor: (m) => m.vehicleNumber },
                    {
                      header: 'Issue / Work Description',
                      accessor: (m) => m.issueDescription || m.description || '',
                    },
                    { header: 'Priority', accessor: (m) => m.severity || m.priority || 'Medium' },
                    { header: 'Workshop / Vendor', accessor: (m) => m.vendorName || '' },
                    { header: 'Estimated Cost (INR)', accessor: (m) => m.estimatedCost },
                    {
                      header: 'Actual Cost (INR)',
                      accessor: (m) => m.actualCost || m.estimatedCost,
                    },
                    { header: 'Raised By', accessor: (m) => m.requestedBy || 'Staff' },
                    { header: 'Status', accessor: (m) => m.status },
                  ]}
                />
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setIsWoModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Wrench className="w-4 h-4 text-amber-400" />
                    <span>Raise Work Order</span>
                  </button>
                )}
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
                    {
                      header: 'Advance Given (INR)',
                      accessor: (f) => f.advanceGiven ?? f.advanceAmount ?? 0,
                    },
                    {
                      header: 'Fuel Bill (INR)',
                      accessor: (f) => f.fuelBillAmount || f.totalAmount || 0,
                    },
                    { header: 'Litres', accessor: (f) => f.litresPurchased || f.litres || 0 },
                    { header: 'Status', accessor: (f) => f.status || 'Settled' },
                  ]}
                />
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleOpenGiveFuelAdvance()}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>Record Fuel Advance</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SUB-MODULE 1: DAILY LOG BOOK & RECONCILIATION TABLE                 */}
      {/* =================================================================== */}
      {activeTab === 'odometer' && (
        <div className="space-y-5">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">Total Net Run Logged</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {totalLoggedNetRun.toLocaleString('en-IN')}{' '}
                <span className="text-xs font-normal text-slate-500">km</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {filteredLogRows.length} reconciled entries
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">Fuel Amount (Log Days)</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                ₹{totalDayFuelAmount.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Auto-correlated with fuel bills
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">
                Maintenance Done (Log Days)
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                ₹{totalDayMaintAmount.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Correlated work orders &amp; repairs
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-500">Filter Vehicle</div>
                <select
                  value={logVehicleFilter}
                  onChange={(e) => setLogVehicleFilter(e.target.value)}
                  className="mt-1.5 w-full p-2 border border-slate-300 rounded-xl text-xs font-mono font-bold bg-slate-50 text-slate-900"
                >
                  <option value="all">All Fleet Vehicles ({vehicles.length})</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.registrationNumber}>
                      {v.registrationNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Local Fuel Prices Config Bar — Chainpur, Siwan, Bihar (841203) */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Fuel className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-bold text-slate-900">
                  Local Fuel Pump Rates (Chainpur, Siwan, Bihar 841203):
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-amber-200 font-mono text-[11px]">
                  Diesel: <strong>{config?.fuelRates?.Diesel ? `₹${config.fuelRates.Diesel}/L` : 'Not set'}</strong>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-amber-200 font-mono text-[11px]">
                  Petrol: <strong>{config?.fuelRates?.Petrol ? `₹${config.fuelRates.Petrol}/L` : 'Not set'}</strong>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-amber-200 font-mono text-[11px]">
                  CNG: <strong>{config?.fuelRates?.CNG ? `₹${config.fuelRates.CNG}/kg` : 'Not set'}</strong>
                </span>
              </div>
              {onUpdateConfig && !isReadOnly && (
                <button
                  type="button"
                  onClick={() => setIsEditingFuelRates((prev) => !prev)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
                >
                  {isEditingFuelRates ? 'Close Rate Editor' : 'Set Chainpur Fuel Rates'}
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-600">
              Fuel quantity is calculated strictly from the exact bill quantity or your saved Chainpur/Siwan rate for each vehicle&apos;s fuel type (Diesel / Petrol / CNG). Indicative Siwan rates: Diesel ~₹100.50/L, Petrol ~₹114.83/L, CNG ~₹87–94/kg — confirm your local pump rate below.
            </p>
            {isEditingFuelRates && (
              <form onSubmit={handleSaveFuelRates} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-amber-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Diesel Rate (₹/Litre)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rateDiesel}
                    onChange={(e) => setRateDiesel(e.target.value)}
                    placeholder="e.g. 100.50"
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Petrol Rate (₹/Litre)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ratePetrol}
                    onChange={(e) => setRatePetrol(e.target.value)}
                    placeholder="e.g. 114.83"
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">CNG Rate (₹/Kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rateCng}
                    onChange={(e) => setRateCng(e.target.value)}
                    placeholder="e.g. 90.00"
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={fuelRateSaving}
                    className="w-full py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50"
                  >
                    {fuelRateSaving ? 'Saving...' : 'Save Pump Rates'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Unified Reconciled Tabular Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Daily Log Book — Yesterday-to-Today Reconciliation Ledger
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automatically calculates elapsed time &amp; net km run against previous reading, correlated with same-day maintenance &amp; fuel
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={logDateFilter}
                  onChange={(e) => setLogDateFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50"
                />
                {logDateFilter && (
                  <button
                    type="button"
                    onClick={() => setLogDateFilter('')}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    Clear Date
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Time &amp; Δ vs Prev</th>
                    <th className="py-3 px-3">Vehicle &amp; Driver</th>
                    <th className="py-3 px-3 text-right">Reading (km)</th>
                    <th className="py-3 px-3 text-right">Net Run</th>
                    <th className="py-3 px-3">Inspection &amp; Live Photos</th>
                    <th className="py-3 px-3">Maintenance Done on Day</th>
                    <th className="py-3 px-3 text-right">Fuel Amount</th>
                    <th className="py-3 px-4 text-right">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-500">
                        <div>No logbook entries found for selected filters.</div>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleOpenOdometerModal()}
                            className="mt-3 px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Camera className="w-3.5 h-3.5 text-amber-400" />
                            <span>Log First Entry</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredLogRows.map((row) => (
                      <tr key={row.log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                          {row.date}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-mono font-semibold tabular-nums text-slate-800">
                            {row.timeDisplay}
                          </div>
                          {row.timeDiffLabel && (
                            <div className="text-[11px] font-mono tabular-nums text-slate-500">
                              Δ {row.timeDiffLabel}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-slate-900">
                            {row.log.vehicleNumber}
                          </div>
                          <div className="text-[11px] text-slate-500">{row.log.driverName}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <div className="font-bold text-slate-900">
                            {row.currentReading.toLocaleString('en-IN')} km
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Prev: {row.previousReading.toLocaleString('en-IN')} km
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold tabular-nums whitespace-nowrap text-emerald-700">
                          {row.netRun > 0 ? `+${row.netRun.toLocaleString('en-IN')} km` : '0 km'}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] text-slate-700">
                              {row.hasAnyChecklist ? (
                                <span
                                  className={`font-semibold ${
                                    row.checklistCount === 6
                                      ? 'text-emerald-700'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {row.checklistCount}/6 Checks
                                </span>
                              ) : (
                                <span className="text-slate-500">Legacy</span>
                              )}
                              <span className="mx-1 text-slate-300">·</span>
                              <span
                                className={`font-semibold ${
                                  row.photoCount > 0 ? 'text-slate-900' : 'text-slate-400'
                                }`}
                              >
                                {row.photoCount}/6 Photos
                              </span>
                            </div>
                            {(row.photoCount > 0 || row.hasAnyChecklist) && (
                              <button
                                type="button"
                                onClick={() => setInspectingRow(row)}
                                className="px-2 py-1 border border-slate-300 hover:bg-slate-100 rounded-lg text-[11px] font-bold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Inspect</span>
                              </button>
                            )}
                          </div>
                          {row.log.defectsReported && (
                            <div className="text-[11px] text-slate-500 truncate max-w-[220px] mt-0.5">
                              {row.log.defectsReported}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 max-w-[240px]">
                          {row.maintenanceSummary.length > 0 ? (
                            <div className="space-y-0.5 text-[11px] text-slate-800">
                              {row.maintenanceSummary.map((line, i) => (
                                <div key={i} className="truncate" title={line}>
                                  {line}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {row.fuelAmountOnDay > 0 ? (
                            <div>
                              <div className="font-bold text-slate-900">
                                ₹{row.fuelAmountOnDay.toLocaleString('en-IN')}
                              </div>
                              {row.fuelLitresOnDay > 0 ? (
                                <div className="text-[11px] text-slate-500">
                                  {row.fuelLitresOnDay}{' '}
                                  {row.fuelTypeOnDay === 'CNG' ? 'kg' : 'L'}{' '}
                                  ({row.fuelTypeOnDay || 'Fuel'}
                                  {row.isEstimatedFuelQty && row.fuelRateUsed
                                    ? ` @ ₹${row.fuelRateUsed}`
                                    : ''}
                                  )
                                </div>
                              ) : (
                                <div className="text-[10px] text-amber-700">
                                  {row.fuelTypeOnDay || 'Fuel'} · Qty needs rate/bill
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">₹0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                          {row.log.recordedBy}
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

      {/* =================================================================== */}
      {/* SUB-MODULE 2: VEHICLE COST CENTER                                   */}
      {/* =================================================================== */}
      {activeTab === 'cost_center' && (
        <div className="space-y-5">
          {/* Fleet-wide Cost Center Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  All-Fleet Cost Center Overview
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any vehicle row below to inspect its detailed vouchers, fuel mileage vs threshold &amp; repairs ledger
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Vehicle</th>
                    <th className="py-2.5 px-3">Driver</th>
                    <th className="py-2.5 px-3 text-right">Net Run (km)</th>
                    <th className="py-2.5 px-3 text-right">Fuel Spend</th>
                    <th className="py-2.5 px-3 text-right">Repairs &amp; Maint.</th>
                    <th className="py-2.5 px-3 text-right">Tax / Other</th>
                    <th className="py-2.5 px-3 text-right">Total Cost</th>
                    <th className="py-2.5 px-4 text-right">Cost / Km</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {costCenterSummaryByVehicle.map((item) => {
                    const isSelected =
                      selectedCostCenter?.vehicle.registrationNumber ===
                      item.vehicle.registrationNumber;
                    return (
                      <tr
                        key={item.vehicle.id}
                        onClick={() => setCostVehicleReg(item.vehicle.registrationNumber)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                          {item.vehicle.registrationNumber}
                          <span className="ml-2 font-sans font-normal text-slate-500 text-[11px]">
                            {item.vehicle.ownership}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {item.vehicle.assignedDriverName || 'Unassigned'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {item.totalKm.toLocaleString('en-IN')} km
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-800 font-semibold">
                          ₹{item.fuelSpend.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-blue-700 font-semibold">
                          ₹{item.repairSpend.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          ₹{item.otherSpend.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-slate-900">
                          ₹{item.totalSpend.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums text-emerald-700">
                          {item.totalKm > 0 ? `₹${item.costPerKm}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Vehicle Cost Center Deep View */}
          {selectedCostCenter && (
            <>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <label className="block text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
                    Active Vehicle Cost Center
                  </label>
                  <select
                    value={selectedCostCenter.vehicle.registrationNumber}
                    onChange={(e) => setCostVehicleReg(e.target.value)}
                    className="p-2 border border-slate-300 rounded-xl text-sm font-bold font-mono bg-slate-50 text-slate-900"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.registrationNumber}>
                        {v.registrationNumber} — {v.nickname || v.type} ({v.ownership})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span>
                    Fuel: <strong className="text-slate-900">{selectedCostCenter.vehicle.fuelType}</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Driver:{' '}
                    <strong className="text-slate-900">
                      {selectedCostCenter.vehicle.assignedDriverName || 'Unassigned'}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Threshold:{' '}
                    <strong className="font-mono text-slate-900">
                      {selectedCostCenter.thresholdKmPerL} km/L
                    </strong>
                    {selectedCostCenter.actualKmPerL > 0 && (
                      <span
                        className={`ml-1.5 font-mono font-bold ${
                          selectedCostCenter.actualKmPerL >= selectedCostCenter.thresholdKmPerL
                            ? 'text-emerald-700'
                            : 'text-rose-600'
                        }`}
                      >
                        (Actual: {selectedCostCenter.actualKmPerL} km/L)
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500">Total Fuel Cost</span>
                  <div className="text-xl font-bold font-mono tabular-nums text-amber-700 mt-1">
                    ₹{selectedCostCenter.fuelSpend.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {selectedCostCenter.totalFuelLitres > 0
                      ? `${selectedCostCenter.totalFuelLitres.toFixed(1)} L recorded`
                      : 'Direct fuel bills'}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Repairs &amp; Maintenance
                  </span>
                  <div className="text-xl font-bold font-mono tabular-nums text-blue-700 mt-1">
                    ₹{selectedCostCenter.repairSpend.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Workshop bills &amp; {selectedCostCenter.workOrders.length} Work Orders
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Taxes, Permits &amp; Other
                  </span>
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    ₹{selectedCostCenter.otherSpend.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] text-slate-400">Statutory &amp; miscellaneous</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Total Operational Spend
                  </span>
                  <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                    ₹{selectedCostCenter.totalSpend.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {selectedCostCenter.expenses.length} Approved vouchers
                  </span>
                </div>

                <div className="bg-slate-900 text-white p-4 rounded-xl">
                  <span className="text-[11px] font-semibold text-amber-400">
                    Operating Efficiency
                  </span>
                  <div className="text-xl font-bold font-mono tabular-nums text-white mt-1">
                    ₹{selectedCostCenter.costPerKm}{' '}
                    <span className="text-xs font-normal text-slate-300">/ km</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {selectedCostCenter.totalKm.toLocaleString('en-IN')} km logged
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">
                    Cost Center Transactions — {selectedCostCenter.vehicle.registrationNumber}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {selectedCostCenter.expenses.length} Expense Vouchers
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4">Date &amp; Ref</th>
                        <th className="py-3 px-3">Expense Head</th>
                        <th className="py-3 px-3">Vendor / Workshop</th>
                        <th className="py-3 px-3">Payment Mode</th>
                        <th className="py-3 px-3 text-right">Amount (₹)</th>
                        <th className="py-3 px-4">Description / Narration</th>
                        {isAdmin && onDeleteExpense && <th className="py-3 px-3 text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedCostCenter.expenses.length === 0 ? (
                        <tr>
                          <td
                            colSpan={isAdmin && onDeleteExpense ? 7 : 6}
                            className="py-8 text-center text-slate-400"
                          >
                            No approved expenses recorded for this vehicle yet.
                          </td>
                        </tr>
                      ) : (
                        selectedCostCenter.expenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <div className="font-mono font-bold text-slate-900">
                                {exp.expenseNo}
                              </div>
                              <div className="text-[11px] text-slate-500">{exp.date}</div>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-800">
                              {exp.category}
                            </td>
                            <td className="py-3 px-3 text-slate-700">{exp.vendorName}</td>
                            <td className="py-3 px-3 text-slate-600">{exp.paymentMode}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-slate-900">
                              ₹{exp.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4 text-slate-600 max-w-sm truncate">
                              {exp.narration}
                            </td>
                            {isAdmin && onDeleteExpense && (
                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => onDeleteExpense(exp.id)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                  title="Delete Vehicle Expense Record"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-MODULE 3: STATUTORY DETAILS & COMPLIANCE REGISTER               */}
      {/* =================================================================== */}
      {activeTab === 'statutory' && (
        <div className="space-y-5">
          {/* Statutory Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">Registered Fleet</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {statutoryMetrics.total}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Active vehicles tracked</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">All Documents Valid</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {statutoryMetrics.valid}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">&gt; 30 days validity left</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">
                Expiring Within 30 Days
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 mt-1">
                {statutoryMetrics.expiringSoon}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Renewal due soon</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500">
                Expired / Action Urgent
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-rose-600 mt-1">
                {statutoryMetrics.expired}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Requires immediate renewal</div>
            </div>
          </div>

          {/* Filter Strip */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              {(
                [
                  { id: 'all', label: 'All Vehicles' },
                  { id: 'expired', label: 'Expired' },
                  { id: 'expiring_soon', label: 'Expiring Soon (≤30d)' },
                  { id: 'valid', label: 'Fully Valid' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    statStatusFilter === f.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <select
              value={statOwnershipFilter}
              onChange={(e) => setStatOwnershipFilter(e.target.value as any)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50"
            >
              <option value="all">All Ownership Types</option>
              <option value="School-Owned">School-Owned Only</option>
              <option value="Rented">Rented / Hired Only</option>
            </select>
          </div>

          {/* Statutory Matrix Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Vehicle &amp; Ownership</th>
                    <th className="py-3 px-3">RC Validity</th>
                    <th className="py-3 px-3">Road Tax Upto</th>
                    <th className="py-3 px-3">Fitness Upto</th>
                    <th className="py-3 px-3">Insurance Upto</th>
                    <th className="py-3 px-3">Pollution (PUC)</th>
                    <th className="py-3 px-3">Permit &amp; Agreement</th>
                    {canEditVehicles && <th className="py-3 px-4 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statutoryRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canEditVehicles ? 8 : 7}
                        className="py-8 text-center text-slate-400"
                      >
                        No vehicles match the selected compliance filters.
                      </td>
                    </tr>
                  ) : (
                    statutoryRows.map(({ vehicle: v }) => {
                      const renderDateCell = (val?: string) => {
                        const d = getDaysRemaining(val);
                        if (!val) return <span className="text-slate-400">Not Set</span>;
                        const statusText =
                          d === null
                            ? ''
                            : d < 0
                            ? `Expired ${Math.abs(d)}d ago`
                            : d <= 30
                            ? `${d}d left`
                            : 'Valid';
                        const cls =
                          d !== null && d < 0
                            ? 'text-rose-600'
                            : d !== null && d <= 30
                            ? 'text-amber-700'
                            : 'text-emerald-700';
                        return (
                          <div>
                            <div className="font-mono font-bold tabular-nums text-slate-900">
                              {val}
                            </div>
                            {statusText && (
                              <div className={`text-[11px] font-semibold ${cls}`}>{statusText}</div>
                            )}
                          </div>
                        );
                      };

                      return (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-900">
                              {v.registrationNumber}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {v.type} ({v.capacity} Seats) · {v.ownership}
                            </div>
                            {v.ownership === 'Rented' && v.ownerName && (
                              <div className="text-[11px] text-slate-600 mt-0.5">
                                Owner: {v.ownerName}
                                {v.monthlyRentAmount
                                  ? ` · ₹${v.monthlyRentAmount.toLocaleString('en-IN')}/mo`
                                  : ''}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">{renderDateCell(v.registrationValidity)}</td>
                          <td className="py-3 px-3">{renderDateCell(v.taxPaidUpto)}</td>
                          <td className="py-3 px-3">{renderDateCell(v.fitnessUpto)}</td>
                          <td className="py-3 px-3">{renderDateCell(v.insuranceUpto)}</td>
                          <td className="py-3 px-3">{renderDateCell(v.pollutionUpto)}</td>
                          <td className="py-3 px-3 space-y-1">
                            <div>
                              <span className="text-[10px] text-slate-500">Permit: </span>
                              <span className="font-mono font-semibold text-slate-900">
                                {v.permitUpto || '—'}
                              </span>
                            </div>
                            {v.ownership === 'Rented' && (
                              <div className="text-[11px] text-slate-600 space-y-0.5">
                                <div>
                                  Agreement Upto:{' '}
                                  <strong className="font-mono">{v.agreementEndDate || '—'}</strong>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {v.rentAgreementAttachment && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewDocModal({
                                          title: `${v.registrationNumber} — Rent Agreement`,
                                          url: v.rentAgreementAttachment!,
                                        })
                                      }
                                      className="text-indigo-600 hover:underline font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                                    >
                                      <FileText className="w-3 h-3" />
                                      <span>Agreement</span>
                                    </button>
                                  )}
                                  {v.ownerAadhaarAttachment && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewDocModal({
                                          title: `${v.registrationNumber} — Owner Aadhaar`,
                                          url: v.ownerAadhaarAttachment!,
                                        })
                                      }
                                      className="text-indigo-600 hover:underline font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                                    >
                                      <FileText className="w-3 h-3" />
                                      <span>Aadhaar</span>
                                    </button>
                                  )}
                                  {v.ownerPanAttachment && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewDocModal({
                                          title: `${v.registrationNumber} — Owner PAN`,
                                          url: v.ownerPanAttachment!,
                                        })
                                      }
                                      className="text-indigo-600 hover:underline font-semibold inline-flex items-center gap-0.5 cursor-pointer"
                                    >
                                      <FileText className="w-3 h-3" />
                                      <span>PAN</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                          {canEditVehicles && (
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setStatutorySaveError(null);
                                  setEditingStatutoryVehicle({ ...v });
                                }}
                                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Update Dates</span>
                              </button>
                            </td>
                          )}
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

      {/* =================================================================== */}
      {/* SUB-MODULE 4: WORK ORDERS & MAINTENANCE                             */}
      {/* =================================================================== */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">WO No &amp; Date</th>
                    <th className="py-3 px-3">Vehicle &amp; Priority</th>
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
                        No maintenance work orders found.
                      </td>
                    </tr>
                  ) : (
                    filteredWorkOrders.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900">
                            {m.workOrderNo || m.id}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {m.date || m.reportedDate}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-slate-900">
                            {m.vehicleNumber}
                          </div>
                          <div
                            className={`text-[11px] font-semibold mt-0.5 ${
                              m.severity === 'High' || m.severity === 'Critical'
                                ? 'text-rose-600'
                                : 'text-slate-500'
                            }`}
                          >
                            {m.severity || m.priority || 'Medium'} Priority
                          </div>
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          <div className="font-semibold text-slate-900">
                            {m.issueDescription || m.description}
                          </div>
                          {m.workDoneDetails && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {m.workDoneDetails}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          <div>{m.vendorName}</div>
                          {m.invoiceNumber && (
                            <div className="text-[10px] font-mono text-slate-500">
                              Inv: {m.invoiceNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {m.requestedBy || m.reportedBy || 'Transport Coordinator'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-slate-900">
                          ₹{(m.actualCost || m.estimatedCost || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`font-bold text-xs ${
                              m.status === 'Approved' || m.status === 'Completed' || m.status === 'Paid'
                                ? 'text-emerald-700'
                                : m.status === 'Pending Approval'
                                ? 'text-amber-700'
                                : m.status === 'Rejected'
                                ? 'text-rose-600'
                                : 'text-slate-700'
                            }`}
                          >
                            {m.status}
                          </span>
                          {m.approvedBy && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              By {m.approvedBy}
                            </div>
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
                            {!isReadOnly && m.status === 'Approved' && (
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

      {/* =================================================================== */}
      {/* SUB-MODULE 5: DRIVER FUEL ADVANCES                                  */}
      {/* =================================================================== */}
      {activeTab === 'fuel' && (
        <div className="space-y-4">
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Fuel className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-bold text-slate-900">
                  Chainpur, Siwan (841203) Fuel Pump Rates:
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-amber-200 font-mono text-[11px]">
                  Diesel: <strong>{config?.fuelRates?.Diesel ? `₹${config.fuelRates.Diesel}/L` : 'Not set'}</strong>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-amber-200 font-mono text-[11px]">
                  Petrol: <strong>{config?.fuelRates?.Petrol ? `₹${config.fuelRates.Petrol}/L` : 'Not set'}</strong>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-amber-200 font-mono text-[11px]">
                  CNG: <strong>{config?.fuelRates?.CNG ? `₹${config.fuelRates.CNG}/kg` : 'Not set'}</strong>
                </span>
              </div>
              {onUpdateConfig && !isReadOnly && (
                <button
                  type="button"
                  onClick={() => setIsEditingFuelRates((prev) => !prev)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
                >
                  {isEditingFuelRates ? 'Close Rate Editor' : 'Set Chainpur Fuel Rates'}
                </button>
              )}
            </div>
            {isEditingFuelRates && (
              <form onSubmit={handleSaveFuelRates} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-amber-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Diesel Rate (₹/Litre)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rateDiesel}
                    onChange={(e) => setRateDiesel(e.target.value)}
                    placeholder="e.g. 100.50"
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Petrol Rate (₹/Litre)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={ratePetrol}
                    onChange={(e) => setRatePetrol(e.target.value)}
                    placeholder="e.g. 114.83"
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">CNG Rate (₹/Kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rateCng}
                    onChange={(e) => setRateCng(e.target.value)}
                    placeholder="e.g. 90.00"
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={fuelRateSaving}
                    className="w-full py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50"
                  >
                    {fuelRateSaving ? 'Saving...' : 'Save Pump Rates'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm">
              Driver Fuel Advance &amp; Settlement Register
            </h3>
            <p className="text-xs text-slate-500">
              Issue fuel advances to drivers and settle against actual petrol/diesel/CNG pump bills
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Vehicle</th>
                  <th className="py-3 px-3">Driver</th>
                  <th className="py-3 px-3 text-right">Advance Given</th>
                  <th className="py-3 px-3 text-right">Fuel Bill</th>
                  <th className="py-3 px-3 text-right">Cash Returned</th>
                  <th className="py-3 px-3 text-right">Unsettled</th>
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
                      <td className="py-3 px-4 text-slate-600 font-mono tabular-nums">{fa.date}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {fa.vehicleNumber}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">{fa.driverName}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-slate-900">
                        ₹{(fa.advanceGiven ?? fa.advanceAmount ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-amber-800">
                        ₹{(fa.fuelBillAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                        ₹{(fa.cashReturned || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-rose-700">
                        ₹
                        {(
                          fa.unsettledAdvance ??
                          Math.max(
                            0,
                            (fa.advanceGiven ?? fa.advanceAmount ?? 0) -
                              ((fa.fuelBillAmount || 0) + (fa.cashReturned || 0))
                          )
                        ).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <div>{fa.vendorName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Rec: {fa.receiptNumber}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-bold text-xs ${
                            fa.status === 'Settled' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {fa.status || 'Settled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fa.status !== 'Settled' ? (
                          isReadOnly ? (
                            <span className="text-[11px] text-amber-700 font-semibold">Pending</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenSettleFuelAdvance(fa)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] cursor-pointer"
                            >
                              Settle Bill
                            </button>
                          )
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

      {/* =================================================================== */}
      {/* MODAL: NEW DAILY LOG BOOK ENTRY (AUTO-TIME + YESTERDAY RECONCILED)   */}
      {/* =================================================================== */}
      {isLogEntryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Daily Vehicle Log Book &amp; Morning Inspection Entry
                </h3>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-800">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Auto Time: {liveClock.dateStr} · {liveClock.timeWithSecondsStr} IST
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Direct Camera Capture Only (Pre-recorded uploads disabled)</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLogEntryOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOdometerSubmit} className="p-6 space-y-6 text-xs">
              {logFormError && (
                <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{logFormError}</span>
                </div>
              )}

              {/* Section 1: Vehicle, Driver & Auto-Tracked Timestamp */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Select Vehicle *
                  </label>
                  <select
                    value={selectedVehicle?.id || ''}
                    onChange={(e) => handleSelectLogVehicle(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold bg-white text-slate-900"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registrationNumber} — {v.nickname || v.type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Assigned Driver *
                  </label>
                  <input
                    type="text"
                    required
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Auto Tracked Entry Date &amp; Time
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`${liveClock.dateStr} · ${liveClock.timeWithSecondsStr}`}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono font-bold bg-slate-100 text-slate-700 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Section 2: Automatic Yesterday / Previous Entry Reconciliation */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-900 text-sm">
                    Previous / Yesterday Reconciliation &amp; Current Reading
                  </div>
                  <div className="text-[11px] font-mono text-slate-600">
                    {previousEntryForSelected
                      ? `Previous Entry: ${previousEntryForSelected.date}${
                          previousEntryForSelected.entryTime
                            ? ` at ${previousEntryForSelected.entryTime}`
                            : ''
                        } · Elapsed: ${liveTimeDiffLabel}`
                      : 'No prior log entry — initialized from Vehicle Master Odometer'}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Previous / Yesterday Odometer (km)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`${previousReadingForSelected.toLocaleString('en-IN')} km`}
                      className="w-full p-2.5 border border-slate-200 rounded-xl font-mono font-bold tabular-nums bg-white text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-900 font-bold mb-1">
                      Today&apos;s Odometer Reading (km) *
                    </label>
                    <input
                      type="number"
                      required
                      min={previousReadingForSelected}
                      step="1"
                      placeholder={`Enter >= ${previousReadingForSelected}`}
                      value={currentReadingInput}
                      onChange={(e) => setCurrentReadingInput(e.target.value)}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl font-mono font-bold tabular-nums text-sm bg-white text-slate-900"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                    <span className="text-slate-600 font-semibold">Net Run Difference:</span>
                    <strong
                      className={`font-mono font-bold tabular-nums text-sm ${
                        netRunPreview === null
                          ? 'text-slate-400'
                          : netRunPreview < 0
                          ? 'text-rose-600'
                          : 'text-emerald-700'
                      }`}
                    >
                      {netRunPreview === null
                        ? '—'
                        : netRunPreview < 0
                        ? `${netRunPreview} km (Invalid)`
                        : `+${netRunPreview.toLocaleString('en-IN')} km`}
                    </strong>
                  </div>
                </div>

                {(sameDayMaintPreview.length > 0 || sameDayFuelPreview > 0) && (
                  <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-4 text-[11px] text-slate-700">
                    <span>
                      Today&apos;s Fuel Linked:{' '}
                      <strong className="font-mono text-slate-900">
                        ₹{sameDayFuelPreview.toLocaleString('en-IN')}
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Today&apos;s Work Orders / Maint:{' '}
                      <strong className="text-slate-900">
                        {sameDayMaintPreview.length > 0
                          ? sameDayMaintPreview
                              .map((w) => `${w.workOrderNo || 'WO'}: ${w.issueDescription}`)
                              .join(', ')
                          : 'None'}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Section 3: Morning Vehicle Checkboxes */}
              <div className="space-y-2.5">
                <div className="font-bold text-slate-900 text-sm">
                  Morning Readiness &amp; Cleanliness Checklist
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {MORNING_INSPECTION_CHECKS.map((chk) => {
                    const checked = checklist[chk.key];
                    return (
                      <label
                        key={chk.key}
                        className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-colors ${
                          checked
                            ? 'bg-emerald-50/70 border-emerald-400 text-slate-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setChecklist((prev) => ({
                              ...prev,
                              [chk.key]: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                        />
                        <span className="font-semibold text-xs">{chk.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Section 4: Direct Camera Capture Photos (6 Mandatory Angle & Odometer Slots) */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      Live Camera Verification Photos (
                      {LOG_BOOK_PHOTO_SLOTS.filter((s) => Boolean(capturedPhotos[s.key])).length} / 6
                      Captured)
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Each slot captures directly from device camera in real time — gallery / pre-recorded photo uploads are disabled
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {LOG_BOOK_PHOTO_SLOTS.map((slot) => {
                    const photoUrl = capturedPhotos[slot.key];
                    return (
                      <div
                        key={slot.key}
                        className={`p-3 rounded-xl border space-y-2.5 ${
                          photoUrl
                            ? 'bg-emerald-50/40 border-emerald-300'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-800 text-xs">{slot.label}</span>
                          {photoUrl ? (
                            <span className="text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Live Shot</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Pending</span>
                          )}
                        </div>

                        {photoUrl ? (
                          <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-950">
                            <img
                              src={photoUrl}
                              alt={slot.label}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="aspect-[4/3] w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                            <Camera className="w-6 h-6" />
                            <span className="text-[11px] font-medium">Camera Only</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveCameraSlot(slot.key)}
                            className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5 text-amber-400" />
                            <span>{photoUrl ? 'Retake Photo' : 'Take Live Photo'}</span>
                          </button>
                          {photoUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setCapturedPhotos((prev) => {
                                  const next = { ...prev };
                                  delete next[slot.key];
                                  return next;
                                })
                              }
                              className="p-2 border border-slate-300 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-500 cursor-pointer"
                              title="Clear Photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Inspection / Running Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={defectsReported}
                  onChange={(e) => setDefectsReported(e.target.value)}
                  placeholder="Note any issue, scratches, tyre pressure, or shift details..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsLogEntryOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={logSubmitBusy}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl cursor-pointer"
                >
                  {logSubmitBusy ? 'Saving Log Book Entry...' : 'Save Log Book & Reconcile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Camera Capture Modal (strictly getUserMedia, zero file upload) */}
      <CameraCaptureModal
        isOpen={Boolean(activeCameraSlot)}
        title={activeCameraSlotMeta?.label || 'Capture Vehicle Photo'}
        subtitle="Direct camera viewfinder capture — pre-recorded photo upload is disabled"
        vehicleLabel={selectedVehicle?.registrationNumber}
        onCapture={(dataUrl) => {
          if (activeCameraSlot) {
            setCapturedPhotos((prev) => ({
              ...prev,
              [activeCameraSlot]: dataUrl,
            }));
          }
          setActiveCameraSlot(null);
        }}
        onClose={() => setActiveCameraSlot(null)}
      />

      {/* =================================================================== */}
      {/* MODAL: INSPECT LOG BOOK CHECKLIST & LIVE CAMERA PHOTOS              */}
      {/* =================================================================== */}
      {inspectingRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {inspectingRow.log.vehicleNumber} — Log Inspection ({inspectingRow.date}{' '}
                  {inspectingRow.timeDisplay})
                </h3>
                <p className="text-xs text-slate-500">
                  Reading: {inspectingRow.currentReading.toLocaleString('en-IN')} km · Prev:{' '}
                  {inspectingRow.previousReading.toLocaleString('en-IN')} km · Net Run: +
                  {inspectingRow.netRun.toLocaleString('en-IN')} km
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingRow(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs">
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2.5">
                  Morning Inspection Checklist
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {MORNING_INSPECTION_CHECKS.map((chk) => {
                    const val = inspectingRow.log[chk.key];
                    return (
                      <div
                        key={chk.key}
                        className={`p-2.5 rounded-xl border flex items-center justify-between ${
                          val
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        <span className="font-semibold">{chk.label}</span>
                        <strong>{val ? 'Yes' : val === false ? 'No' : '—'}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2.5">
                  Captured Verification Photos ({inspectingRow.photoCount} / 6)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {LOG_BOOK_PHOTO_SLOTS.map((slot) => {
                    const url = inspectingRow.log[slot.key];
                    return (
                      <div
                        key={slot.key}
                        className="border border-slate-200 rounded-xl p-2.5 space-y-2 bg-slate-50/50"
                      >
                        <div className="font-bold text-slate-800">{slot.label}</div>
                        {url && url !== '[ATTACHMENT_STORED]' ? (
                          <div className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-950">
                            <img
                              src={url}
                              alt={slot.label}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="aspect-[4/3] rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                            No Photo Captured
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: UPDATE STATUTORY COMPLIANCE DATES                            */}
      {/* =================================================================== */}
      {editingStatutoryVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <h3 className="text-base font-bold text-slate-900">
                Update Statutory Details — {editingStatutoryVehicle.registrationNumber}
              </h3>
              <button
                type="button"
                onClick={() => setEditingStatutoryVehicle(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {statutorySaveError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {statutorySaveError}
              </div>
            )}

            <form onSubmit={handleSaveStatutorySubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">RC Validity Upto</label>
                  <input
                    type="date"
                    value={editingStatutoryVehicle.registrationValidity || ''}
                    onChange={(e) =>
                      setEditingStatutoryVehicle({
                        ...editingStatutoryVehicle,
                        registrationValidity: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Road Tax Paid Upto</label>
                  <input
                    type="date"
                    value={editingStatutoryVehicle.taxPaidUpto || ''}
                    onChange={(e) =>
                      setEditingStatutoryVehicle({
                        ...editingStatutoryVehicle,
                        taxPaidUpto: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Fitness Validity Upto</label>
                  <input
                    type="date"
                    value={editingStatutoryVehicle.fitnessUpto || ''}
                    onChange={(e) =>
                      setEditingStatutoryVehicle({
                        ...editingStatutoryVehicle,
                        fitnessUpto: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Insurance Upto</label>
                  <input
                    type="date"
                    value={editingStatutoryVehicle.insuranceUpto || ''}
                    onChange={(e) =>
                      setEditingStatutoryVehicle({
                        ...editingStatutoryVehicle,
                        insuranceUpto: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Pollution (PUC) Upto
                  </label>
                  <input
                    type="date"
                    value={editingStatutoryVehicle.pollutionUpto || ''}
                    onChange={(e) =>
                      setEditingStatutoryVehicle({
                        ...editingStatutoryVehicle,
                        pollutionUpto: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Permit Validity Upto
                  </label>
                  <input
                    type="date"
                    value={editingStatutoryVehicle.permitUpto || ''}
                    onChange={(e) =>
                      setEditingStatutoryVehicle({
                        ...editingStatutoryVehicle,
                        permitUpto: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStatutoryVehicle(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statutorySaveBusy}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer"
                >
                  {statutorySaveBusy ? 'Saving...' : 'Save Statutory Dates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Modal for Statutory Docs */}
      {previewDocModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="font-bold text-slate-900 text-sm">{previewDocModal.title}</h4>
              <button
                type="button"
                onClick={() => setPreviewDocModal(null)}
                className="text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto flex justify-center bg-slate-100 rounded-xl p-2">
              {previewDocModal.url.includes('application/pdf') ? (
                <iframe src={previewDocModal.url} className="w-full h-[65vh]" title={previewDocModal.title} />
              ) : (
                <img src={previewDocModal.url} alt={previewDocModal.title} className="max-h-[70vh] object-contain" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: RAISE WORK ORDER REQUEST                                     */}
      {/* =================================================================== */}
      {isWoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Raise Maintenance Work Order</h3>
              <button
                type="button"
                onClick={() => setIsWoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
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
                  <label className="block text-slate-600 font-semibold mb-1">
                    Priority / Severity *
                  </label>
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
                <label className="block text-slate-600 font-semibold mb-1">
                  Issue / Work Required *
                </label>
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
                  <label className="block text-slate-600 font-semibold mb-1">
                    Workshop / Vendor
                  </label>
                  <input
                    type="text"
                    value={woVendor}
                    onChange={(e) => setWoVendor(e.target.value)}
                    placeholder="e.g. Tata Authorized Service"
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Estimated Cost (₹) *
                  </label>
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Complete Work Order ({completingWo.workOrderNo || completingWo.vehicleNumber})
              </h3>
              <button
                type="button"
                onClick={() => setCompletingWo(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteWoSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Actual Cost (₹) *
                  </label>
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
                  <label className="block text-slate-600 font-semibold mb-1">
                    Workshop Invoice No
                  </label>
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
                <label className="block text-slate-600 font-semibold mb-1">
                  Work Done Details *
                </label>
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

      {/* Give or Settle Fuel Advance Modal */}
      {isFuelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {fuelModalMode === 'give'
                  ? 'Give Fuel Advance to Driver'
                  : 'Settle Driver Fuel Advance'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFuelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
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
                  <label className="block text-slate-600 font-semibold mb-1">
                    Advance Given (₹) *
                  </label>
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
                      <label className="block text-slate-600 font-semibold mb-1">
                        Actual Fuel Bill (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={fuelBillAmount}
                        onChange={(e) => setFuelBillAmount(Number(e.target.value))}
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        Fuel Litres (L)
                      </label>
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
                      <label className="block text-slate-600 font-semibold mb-1">
                        Cash Returned (₹)
                      </label>
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
                    <label className="block text-slate-600 font-semibold mb-1">
                      Fuel Pump / Vendor Name *
                    </label>
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
                    <label className="block text-slate-600 font-semibold mb-1">
                      Fuel Bill / Receipt No *
                    </label>
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

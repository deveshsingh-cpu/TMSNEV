import {
  OdometerLog,
  Vehicle,
  ExpenseRecord,
  MaintenanceRequest,
  FuelAdvanceAndPurchase,
  LogBookPhotoSlot,
  SchoolConfig,
} from '../types/index.js';

export const LOG_BOOK_PHOTO_SLOTS: {
  key: LogBookPhotoSlot;
  label: string;
  shortLabel: string;
}[] = [
  { key: 'odometerPhoto', label: 'Odometer Reading Photo', shortLabel: 'Odometer' },
  { key: 'exteriorFrontPhoto', label: 'Exterior — Front', shortLabel: 'Front' },
  { key: 'exteriorLhsPhoto', label: 'Exterior — Left Hand Side (LHS)', shortLabel: 'LHS' },
  { key: 'exteriorRhsPhoto', label: 'Exterior — Right Hand Side (RHS)', shortLabel: 'RHS' },
  { key: 'exteriorBackPhoto', label: 'Exterior — Back / Rear', shortLabel: 'Back' },
  { key: 'insidePhoto', label: 'Interior — Inside Cabin & Seats', shortLabel: 'Inside' },
];

export const MORNING_INSPECTION_CHECKS: {
  key:
    | 'cleanOutside'
    | 'cleanInside'
    | 'hasStepny'
    | 'hasJack'
    | 'hasRod'
    | 'mobileCheckedInMorning';
  label: string;
  shortLabel: string;
}[] = [
  { key: 'cleanOutside', label: 'Clean from Outside', shortLabel: 'Ext. Clean' },
  { key: 'cleanInside', label: 'Clean from Inside', shortLabel: 'Int. Clean' },
  { key: 'hasStepny', label: 'Stepney (Spare Tyre) Available', shortLabel: 'Stepney' },
  { key: 'hasJack', label: 'Jack Available', shortLabel: 'Jack' },
  { key: 'hasRod', label: 'Wheel Spanner / Rod Available', shortLabel: 'Rod' },
  {
    key: 'mobileCheckedInMorning',
    label: 'Mobil (Engine Oil) Checked in Morning',
    shortLabel: 'Mobil',
  },
];

export function getIstDateTimeParts(dateObj: Date = new Date()): {
  dateStr: string;
  timeStr: string;
  timeWithSecondsStr: string;
  iso: string;
} {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj);

  const timeStr = dateObj.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const timeWithSecondsStr = dateObj.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return {
    dateStr,
    timeStr,
    timeWithSecondsStr,
    iso: dateObj.toISOString(),
  };
}

export function parseTimeToMinutes24(raw?: string): number | null {
  if (!raw) return null;
  const cleaned = String(raw).trim();
  const match12 = cleaned.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12) {
    let h = Number(match12[1]);
    const m = Number(match12[2]);
    const ampm = match12[4].toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    const h = Number(match24[1]);
    const m = Number(match24[2]);
    return h * 60 + m;
  }
  return null;
}

export function getLogComparableTimestampMs(log: Partial<OdometerLog>): number {
  if (log.recordedAtIso) {
    const parsed = Date.parse(log.recordedAtIso);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const datePart = String(log.date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const mins = parseTimeToMinutes24(log.entryTime);
    const hours = mins !== null ? Math.floor(mins / 60) : 8;
    const remMins = mins !== null ? mins % 60 : 0;
    const hh = String(hours).padStart(2, '0');
    const mm = String(remMins).padStart(2, '0');
    const parsed = Date.parse(`${datePart}T${hh}:${mm}:00+05:30`);
    if (!Number.isNaN(parsed)) return parsed;
  }
  // Fall back to numeric timestamp in id if present (e.g. odo-1763...)
  const idMatch = String(log.id || '').match(/(\d{13})/);
  if (idMatch) return Number(idMatch[1]);
  return 0;
}

export function formatTimeDifferenceLabel(diffMinutes: number): string {
  const absMins = Math.max(0, Math.round(diffMinutes));
  const days = Math.floor(absMins / (24 * 60));
  const hours = Math.floor((absMins % (24 * 60)) / 60);
  const mins = absMins % 60;
  if (days >= 1) {
    return `${days}d ${hours}h ${mins}m`;
  }
  if (hours >= 1) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function hasRecordedOdometerReading(log: Partial<OdometerLog>): boolean {
  const curr = Number(log.endOdometer ?? log.closingOdometer ?? 0);
  if (curr > 0) return true;
  const isAutoSyncedExpenseOnly =
    String(log.id || '').startsWith('odo-exp-') || Boolean(log.expenseId);
  return !isAutoSyncedExpenseOnly;
}

export function findPreviousLogForVehicle(
  logs: OdometerLog[] = [],
  vehicleId?: string,
  vehicleNumber?: string,
  options?: {
    excludeId?: string;
    beforeDate?: string;
    beforeTimestampMs?: number;
  }
): OdometerLog | undefined {
  const cleanVehNo = String(vehicleNumber || '').trim().toUpperCase();
  const candidates = (logs || []).filter((l) => {
    if (options?.excludeId && l.id === options.excludeId) return false;
    if (!hasRecordedOdometerReading(l)) return false;
    const sameId = Boolean(vehicleId && l.vehicleId === vehicleId);
    const sameReg = Boolean(
      cleanVehNo && String(l.vehicleNumber || '').trim().toUpperCase() === cleanVehNo
    );
    if (!sameId && !sameReg) return false;

    if (options?.beforeTimestampMs !== undefined) {
      const ts = getLogComparableTimestampMs(l);
      if (ts >= options.beforeTimestampMs) return false;
    } else if (options?.beforeDate) {
      if ((l.date || '') > options.beforeDate) return false;
    }
    return true;
  });

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => {
    const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
    if (dateCmp !== 0) return dateCmp;
    return getLogComparableTimestampMs(b) - getLogComparableTimestampMs(a);
  });

  // Prefer strictly earlier date ("yesterday's entry") if same-date filtering requested and available,
  // otherwise return latest prior reading
  if (options?.beforeDate) {
    const priorDay = candidates.find((c) => (c.date || '') < options.beforeDate!);
    if (priorDay) return priorDay;
  }
  return candidates[0];
}

export interface ReconciledLogBookRow {
  log: OdometerLog;
  date: string;
  timeDisplay: string;
  previousDate?: string;
  previousTime?: string;
  previousReading: number;
  currentReading: number;
  netRun: number;
  timeDiffMinutes?: number;
  timeDiffLabel?: string;
  maintenanceSummary: string[];
  maintenanceAmountOnDay: number;
  fuelAmountOnDay: number;
  fuelLitresOnDay: number;
  fuelTypeOnDay?: string;
  fuelRateUsed?: number;
  isEstimatedFuelQty?: boolean;
  photoCount: number;
  checklistCount: number;
  hasAnyChecklist: boolean;
}

export function inferFuelTypeFromText(
  rawText?: string
): 'Diesel' | 'Petrol' | 'CNG' | undefined {
  if (!rawText) return undefined;
  const cleaned = String(rawText).replace(/fuel\s*\(\s*diesel\s*\/\s*cng\s*\)/gi, ' ');
  const hasPetrol = /\bpetrol\b/i.test(cleaned) || cleaned.includes('पेट्रोल');
  const hasCng = /\bcng\b/i.test(cleaned) || cleaned.includes('सीएनजी');
  const hasDiesel = /\bdiesel\b/i.test(cleaned) || cleaned.includes('डीजल');
  const matchCount = Number(hasPetrol) + Number(hasCng) + Number(hasDiesel);
  if (matchCount !== 1) return undefined;
  if (hasPetrol) return 'Petrol';
  if (hasCng) return 'CNG';
  return 'Diesel';
}

export function getRateForFuelType(
  fuelRates?: SchoolConfig['fuelRates'],
  fuelType?: string
): number {
  if (!fuelRates) return 0;
  if (fuelType === 'Petrol') return Number(fuelRates.Petrol || 0);
  if (fuelType === 'CNG') return Number(fuelRates.CNG || 0);
  if (fuelType === 'Diesel') return Number(fuelRates.Diesel || 0);
  return 0;
}

export function buildReconciledLogBookRows(
  odometerLogs: OdometerLog[] = [],
  vehicles: Vehicle[] = [],
  expenses: ExpenseRecord[] = [],
  maintenanceRequests: MaintenanceRequest[] = [],
  fuelAdvances: FuelAdvanceAndPurchase[] = [],
  fuelRates?: SchoolConfig['fuelRates']
): ReconciledLogBookRow[] {
  // Sort ascending chronologically per vehicle so we can chain yesterday -> today accurately
  const sortedAsc = [...odometerLogs].sort((a, b) => {
    const dateCmp = String(a.date || '').localeCompare(String(b.date || ''));
    if (dateCmp !== 0) return dateCmp;
    return getLogComparableTimestampMs(a) - getLogComparableTimestampMs(b);
  });

  const lastLogByVehicleKey = new Map<string, OdometerLog>();
  const vehById = new Map<string, Vehicle>();
  const vehByReg = new Map<string, Vehicle>();
  for (const v of vehicles) {
    vehById.set(v.id, v);
    vehByReg.set(String(v.registrationNumber || '').trim().toUpperCase(), v);
  }

  const rowsAsc: ReconciledLogBookRow[] = sortedAsc.map((log) => {
    const regUpper = String(log.vehicleNumber || '').trim().toUpperCase();
    const veh = vehById.get(log.vehicleId) || vehByReg.get(regUpper);
    const vehKey = veh?.id || regUpper || log.vehicleId;

    const currReading = Number(log.endOdometer ?? log.closingOdometer ?? log.startOdometer ?? 0);
    const isOdoReadingLog = hasRecordedOdometerReading(log);
    const priorLog = isOdoReadingLog ? lastLogByVehicleKey.get(vehKey) : undefined;
    if (isOdoReadingLog) {
      lastLogByVehicleKey.set(vehKey, log);
    }

    const prevReading = isOdoReadingLog
      ? priorLog !== undefined
        ? Number(priorLog.endOdometer ?? priorLog.closingOdometer ?? priorLog.startOdometer ?? 0)
        : Number(log.startOdometer ?? log.openingOdometer ?? 0)
      : Number(log.startOdometer ?? log.openingOdometer ?? 0);

    const computedRun = Math.max(0, currReading - prevReading);
    const netRun =
      log.tripKm !== undefined && log.tripKm > 0
        ? log.tripKm
        : priorLog
        ? computedRun
        : Math.max(0, Number(log.tripKm ?? computedRun));

    let timeDiffMinutes = log.timeDiffMinutes;
    let timeDiffLabel = log.timeDiffLabel;
    if (timeDiffMinutes === undefined && priorLog) {
      const prevTs = getLogComparableTimestampMs(priorLog);
      const currTs = getLogComparableTimestampMs(log);
      if (prevTs > 0 && currTs > prevTs) {
        timeDiffMinutes = Math.round((currTs - prevTs) / 60000);
        timeDiffLabel = formatTimeDifferenceLabel(timeDiffMinutes);
      }
    }

    const sameVehicleDate = (itemVehId?: string, itemVehNo?: string, itemDate?: string) => {
      if (String(itemDate || '').trim() !== String(log.date || '').trim()) return false;
      const itemReg = String(itemVehNo || '').trim().toUpperCase();
      return (
        (veh?.id && itemVehId === veh.id) ||
        (log.vehicleId && itemVehId === log.vehicleId) ||
        (regUpper && itemReg === regUpper)
      );
    };

    // Correlate Maintenance on that day (Work Orders + Maintenance Expenses)
    const dayWos = maintenanceRequests.filter((m) =>
      sameVehicleDate(m.vehicleId, m.vehicleNumber, m.date || m.reportedDate)
    );
    const dayExps = expenses.filter(
      (e) =>
        e.approvalStatus !== 'Rejected' &&
        sameVehicleDate(e.vehicleId, e.vehicleNumber, e.date)
    );
    const dayMaintExps = dayExps.filter(
      (e) => !String(e.category || '').toLowerCase().includes('fuel')
    );

    const maintenanceSummary: string[] = [];
    let maintenanceAmountOnDay = 0;

    for (const wo of dayWos) {
      const amt = Number(wo.actualCost || wo.estimatedCost || 0);
      maintenanceAmountOnDay += amt;
      maintenanceSummary.push(
        `${wo.workOrderNo || 'WO'}: ${wo.issueDescription || wo.description || 'Maintenance'} (${wo.status}${amt > 0 ? `, ₹${amt.toLocaleString('en-IN')}` : ''})`
      );
    }
    for (const me of dayMaintExps) {
      maintenanceAmountOnDay += Number(me.amount || 0);
      maintenanceSummary.push(
        `${me.category}: ₹${Number(me.amount || 0).toLocaleString('en-IN')}${me.vendorName ? ` (${me.vendorName})` : ''}`
      );
    }

    // Correlate Fuel amount on that day
    const dayFuelExps = dayExps.filter((e) =>
      String(e.category || '').toLowerCase().includes('fuel')
    );
    const dayFuelAdv = fuelAdvances.filter((fa) =>
      sameVehicleDate(fa.vehicleId, fa.vehicleNumber, fa.date)
    );

    const fuelFromExpenses = dayFuelExps.reduce((s, e) => s + Number(e.amount || 0), 0);
    const litresFromExpenses = dayFuelExps.reduce((s, e) => s + Number(e.fuelLitres || 0), 0);
    const fuelFromAdv = dayFuelAdv.reduce(
      (s, fa) => s + Number(fa.fuelBillAmount || fa.actualBillAmount || 0),
      0
    );
    const litresFromAdv = dayFuelAdv.reduce(
      (s, fa) => s + Number(fa.litresPurchased || fa.litres || 0),
      0
    );

    const fuelAmountOnDay =
      fuelFromExpenses > 0
        ? fuelFromExpenses
        : fuelFromAdv > 0
        ? fuelFromAdv
        : Number(log.fuelCost || 0);

    const fuelTypeFromNarr =
      inferFuelTypeFromText(dayFuelExps.map((e) => e.narration || '').join(' ')) ||
      inferFuelTypeFromText(log.defectsReported);

    const fuelTypeOnDay =
      dayFuelExps.find((e) => e.fuelType)?.fuelType ||
      dayFuelAdv.find((fa) => fa.fuelType)?.fuelType ||
      fuelTypeFromNarr ||
      veh?.fuelType ||
      undefined;

    const matchedAdvWithRate = dayFuelAdv.find((fa) => Number(fa.fuelRate || fa.ratePerLitre) > 0);
    const explicitBillRate =
      Number(dayFuelExps.find((e) => Number(e.fuelRate) > 0)?.fuelRate || 0) ||
      Number(matchedAdvWithRate?.fuelRate || matchedAdvWithRate?.ratePerLitre || 0);

    const configuredRate = getRateForFuelType(fuelRates, fuelTypeOnDay || 'Diesel');
    const resolvedRate = explicitBillRate > 0 ? explicitBillRate : configuredRate;

    const isAutoSyncedWithoutExplicitExpLitres =
      (String(log.id || '').startsWith('odo-exp-') || Boolean(log.expenseId)) &&
      dayFuelExps.length > 0 &&
      litresFromExpenses === 0;

    let fuelLitresOnDay = 0;
    let isEstimatedFuelQty = false;

    if (litresFromExpenses > 0) {
      fuelLitresOnDay = litresFromExpenses;
    } else if (litresFromAdv > 0) {
      fuelLitresOnDay = litresFromAdv;
    } else if (!isAutoSyncedWithoutExplicitExpLitres && Number(log.fuelLitresAdded || log.fuelLitres || 0) > 0) {
      fuelLitresOnDay = Number(log.fuelLitresAdded || log.fuelLitres || 0);
    } else if (fuelAmountOnDay > 0 && resolvedRate > 0 && fuelTypeOnDay && fuelTypeOnDay !== 'Electric') {
      fuelLitresOnDay = Math.round((fuelAmountOnDay / resolvedRate) * 100) / 100;
      isEstimatedFuelQty = true;
    }

    const photoCount = LOG_BOOK_PHOTO_SLOTS.filter((slot) => Boolean(log[slot.key])).length;

    const checklistValues = [
      log.cleanOutside,
      log.cleanInside,
      log.hasStepny,
      log.hasJack,
      log.hasRod,
      log.mobileCheckedInMorning,
    ];
    const hasAnyChecklist = checklistValues.some((v) => v !== undefined);
    const checklistCount = checklistValues.filter((v) => v === true).length;

    return {
      log,
      date: log.date,
      timeDisplay:
        log.entryTime ||
        (log.recordedAtIso
          ? new Date(log.recordedAtIso).toLocaleTimeString('en-US', {
              timeZone: 'Asia/Kolkata',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })
          : '—'),
      previousDate: log.previousDate || priorLog?.date,
      previousTime: log.previousTime || priorLog?.entryTime,
      previousReading: prevReading,
      currentReading: currReading,
      netRun,
      timeDiffMinutes,
      timeDiffLabel,
      maintenanceSummary,
      maintenanceAmountOnDay,
      fuelAmountOnDay,
      fuelLitresOnDay,
      fuelTypeOnDay,
      fuelRateUsed: resolvedRate > 0 ? resolvedRate : undefined,
      isEstimatedFuelQty,
      photoCount,
      checklistCount,
      hasAnyChecklist,
    };
  });

  // Return newest-first tabular order
  return rowsAsc.reverse();
}

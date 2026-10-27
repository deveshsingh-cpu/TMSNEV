import React, { useState, useEffect } from 'react';
import { 
  Building2, Truck, Route as RouteIcon, MapPin, 
  Layers, UserCheck, Plus, Trash2, Edit2, CheckCircle, 
  AlertTriangle, Save, X, Users, Landmark, FileText, Upload, Eye, Printer,
  LayoutGrid, List, Search, ArrowDownAZ, ArrowRight
} from 'lucide-react';
import { 
  SchoolConfig, Vehicle, Village, Route, TripMaster, 
  DesignationMaster, CampusId, CampusMaster, MemberTypeMaster,
  Employee, VehicleAssignmentRecord, SystemUser, UserRole, StudentMember
} from '../../types/index.js';
import { PrintExportToolbar, openHtmlPrintPreview } from '../../utils/exportPrint.js';
import { readFileCompressed } from '../../utils/fileCompressor.js';

interface MastersViewProps {
  config: SchoolConfig;
  campuses: CampusMaster[];
  memberTypes: MemberTypeMaster[];
  classes: string[];
  sections: string[];
  trips: TripMaster[];
  designations: DesignationMaster[];
  villages: Village[];
  vehicles: Vehicle[];
  routes: Route[];
  onUpdateConfig: (cfg: Partial<SchoolConfig>) => Promise<any>;
  onAddCampus: (data: Partial<CampusMaster>) => Promise<any>;
  onUpdateCampus?: (id: string, data: Partial<CampusMaster>) => Promise<any>;
  onRemoveCampus: (id: string) => Promise<any>;
  onAddMemberType: (name: string) => Promise<any>;
  onUpdateMemberType?: (id: string, name: string) => Promise<any>;
  onRemoveMemberType: (id: string) => Promise<any>;
  onAddClass: (name: string) => Promise<any>;
  onUpdateClass?: (oldName: string, newName: string) => Promise<any>;
  onRemoveClass: (name: string) => Promise<any>;
  onAddSection: (name: string) => Promise<any>;
  onUpdateSection?: (oldName: string, newName: string) => Promise<any>;
  onRemoveSection: (name: string) => Promise<any>;
  onAddTrip: (trip: Partial<TripMaster>) => Promise<any>;
  onUpdateTrip?: (id: string, trip: Partial<TripMaster>) => Promise<any>;
  onRemoveTrip: (id: string) => Promise<any>;
  onSaveDesignation: (des: Partial<DesignationMaster>) => Promise<any>;
  onRemoveDesignation: (id: string) => Promise<any>;
  onSaveVillage: (data: Partial<Village>) => Promise<any>;
  onDeleteVillage: (id: string) => Promise<any>;
  onSaveVehicle: (data: Partial<Vehicle>) => Promise<any>;
  onDeleteVehicle: (id: string) => Promise<any>;
  onSaveRoute: (data: any) => Promise<any>;
  onDeleteRoute: (id: string) => Promise<any>;
  students?: StudentMember[];
  employees?: Employee[];
  vehicleAssignments?: VehicleAssignmentRecord[];
  onSaveVehicleAssignment?: (data: Partial<VehicleAssignmentRecord>) => Promise<any>;
  users?: SystemUser[];
  onSaveUser?: (data: Partial<SystemUser>) => Promise<any>;
  onDeleteUser?: (id: string) => Promise<any>;
  isAdmin?: boolean;
  initialSubTab?: string;
}

export const MastersView: React.FC<MastersViewProps> = ({
  config,
  campuses,
  memberTypes,
  classes,
  sections,
  trips,
  designations,
  villages,
  vehicles,
  routes,
  onUpdateConfig,
  onAddCampus,
  onUpdateCampus,
  onRemoveCampus,
  onAddMemberType,
  onUpdateMemberType,
  onRemoveMemberType,
  onAddClass,
  onUpdateClass,
  onRemoveClass,
  onAddSection,
  onUpdateSection,
  onRemoveSection,
  onAddTrip,
  onUpdateTrip,
  onRemoveTrip,
  onSaveDesignation,
  onRemoveDesignation,
  onSaveVillage,
  onDeleteVillage,
  onSaveVehicle,
  onDeleteVehicle,
  onSaveRoute,
  onDeleteRoute,
  students = [],
  employees = [],
  vehicleAssignments = [],
  onSaveVehicleAssignment,
  users = [],
  onSaveUser,
  onDeleteUser,
  isAdmin = true,
  initialSubTab,
}) => {
  const resolveMasterTab = (sub?: string): 'users' | 'routes' | 'vehicles' | 'vehicle_assignments' | 'villages' | 'campuses' | 'memberTypes' | 'trips' | 'classes' | 'designations' | 'branding' => {
    if (!sub) return isAdmin ? 'users' : 'routes';
    const validTabs = [
      'users',
      'routes',
      'vehicles',
      'vehicle_assignments',
      'villages',
      'campuses',
      'memberTypes',
      'trips',
      'classes',
      'designations',
      'branding',
    ];
    if (sub === 'member_types') return 'memberTypes';
    if (sub === 'institute' || sub === 'system') return 'branding';
    if (
      sub === 'assignments' ||
      sub === 'vehicle_assignments' ||
      sub.toLowerCase().includes('driver') ||
      sub.toLowerCase().includes('link')
    ) {
      return 'vehicle_assignments';
    }
    if (validTabs.includes(sub)) {
      return sub as any;
    }
    return isAdmin ? 'users' : 'routes';
  };

  const [activeTab, setActiveTab] = useState<
    'users' | 'routes' | 'vehicles' | 'vehicle_assignments' | 'villages' | 'campuses' | 'memberTypes' | 'trips' | 'classes' | 'designations' | 'branding'
  >(() => resolveMasterTab(initialSubTab));

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(resolveMasterTab(initialSubTab));
    }
  }, [initialSubTab]);

  // --- User & Password Management State ---
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userFormName, setUserFormName] = useState('');
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRole, setUserFormRole] = useState<UserRole>('Transport Coordinator');
  const [userFormCampus, setUserFormCampus] = useState('All Campuses');
  const [userFormMobile, setUserFormMobile] = useState('');
  const [userFormStatus, setUserFormStatus] = useState<'Active' | 'Disabled'>('Active');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [userSavedMsg, setUserSavedMsg] = useState<string | null>(null);

  const handleEditUserClick = (u: SystemUser) => {
    setEditingUserId(u.id);
    setUserFormName(u.fullName);
    setUserFormUsername(u.username);
    setUserFormPassword(u.password);
    setUserFormRole(u.role);
    setUserFormCampus(u.campus || 'All Campuses');
    setUserFormMobile(u.mobile || '');
    setUserFormStatus(u.status);
    setMasterError(null);
  };

  const handleResetUserForm = () => {
    setEditingUserId(null);
    setUserFormName('');
    setUserFormUsername('');
    setUserFormPassword('');
    setUserFormRole('Transport Coordinator');
    setUserFormCampus('All Campuses');
    setUserFormMobile('');
    setUserFormStatus('Active');
  };

  const handleSaveUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveUser) return;
    setMasterError(null);
    setUserSavedMsg(null);
    try {
      await onSaveUser({
        id: editingUserId || undefined,
        fullName: userFormName,
        username: userFormUsername,
        password: userFormPassword,
        role: userFormRole,
        campus: userFormCampus,
        mobile: userFormMobile,
        status: userFormStatus,
      });
      setUserSavedMsg(
        editingUserId
          ? `Updated credentials for "${userFormUsername}" (${userFormRole}).`
          : `Created new ${userFormRole} account "${userFormUsername}".`
      );
      handleResetUserForm();
    } catch (err: any) {
      setMasterError(err.message || 'Failed to save user account');
    }
  };

  const [masterError, setMasterError] = useState<string | null>(null);

  // --- Branding Form State ---
  const [brandingForm, setBrandingForm] = useState<SchoolConfig>(config);
  const [brandingSaved, setBrandingSaved] = useState(false);

  useEffect(() => {
    setBrandingForm(config);
  }, [config]);

  // --- Campus Form State ---
  const [editingCampusId, setEditingCampusId] = useState<string | null>(null);
  const [newCampusName, setNewCampusName] = useState('');
  const [newCampusCode, setNewCampusCode] = useState('');
  const [newCampusAddress, setNewCampusAddress] = useState('');

  // --- Member Type Form State ---
  const [editingMemberTypeId, setEditingMemberTypeId] = useState<string | null>(null);
  const [newMemberTypeName, setNewMemberTypeName] = useState('');

  // --- Vehicle Form Modal ---
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle> | null>(null);
  const [vehicleModalError, setVehicleModalError] = useState<string | null>(null);
  const [previewVehicleDoc, setPreviewVehicleDoc] = useState<{ title: string; url: string } | null>(null);

  // --- Village & Stops Modal & View State ---
  const [villageViewMode, setVillageViewMode] = useState<'card' | 'list'>('card');
  const [villageSearchQuery, setVillageSearchQuery] = useState('');
  const [routeVillageSearch, setRouteVillageSearch] = useState('');
  const [isVillageModalOpen, setIsVillageModalOpen] = useState(false);
  const [villageName, setVillageName] = useState('');
  const [villageDistance, setVillageDistance] = useState(5);
  const [editingVillageId, setEditingVillageId] = useState<string | null>(null);
  const [villageStops, setVillageStops] = useState<{ id?: string; name: string; fee: number; distanceKm: number }[]>([
    { name: '', fee: 700, distanceKm: 5 },
  ]);

  // Alphabetically sorted villages (A–Z) and stops (A–Z)
  const sortedVillages = [...villages]
    .map(v => ({
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

  const filteredVillagesMaster = sortedVillages.filter(v => {
    const q = villageSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      v.name.toLowerCase().includes(q) ||
      v.stops.some(s => s.name.toLowerCase().includes(q))
    );
  });

  // --- Route Form Modal ---
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [routeCampus, setRouteCampus] = useState<CampusId>(campuses[0]?.code || '');
  const [routeVehicleId, setRouteVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [routeTripNumber, setRouteTripNumber] = useState<number>(trips[0]?.tripNumber || 1);
  const [selectedVillageIds, setSelectedVillageIds] = useState<string[]>([]);
  const [selectedStopIds, setSelectedStopIds] = useState<string[]>([]);
  const [showRouteComparisonStep, setShowRouteComparisonStep] = useState(false);
  const [routeModalError, setRouteModalError] = useState<string | null>(null);

  // --- Class & Section Form ---
  const [editingClassOldName, setEditingClassOldName] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [editingSectionOldName, setEditingSectionOldName] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState('');

  // --- Trip Form ---
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [newTripNum, setNewTripNum] = useState<number>(trips.length + 1);
  const [newTripDesc, setNewTripDesc] = useState('');

  // --- Vehicle-Driver-Helper Assignment Form ---
  const todayStr = new Date().toISOString().split('T')[0];
  const driversList = employees.filter(
    e =>
      e.status === 'Active' &&
      (e.isDriver ||
        (e.designation && e.designation.toLowerCase().includes('driver')) ||
        (e.role && e.role.toLowerCase().includes('driver')))
  );
  const helpersList = employees.filter(
    e =>
      e.status === 'Active' &&
      !e.isDriver &&
      ((e.designation &&
        (e.designation.toLowerCase().includes('helper') ||
          e.designation.toLowerCase().includes('conductor') ||
          e.designation.toLowerCase().includes('attendant'))) ||
        (e.role &&
          (e.role.toLowerCase().includes('helper') ||
            e.role.toLowerCase().includes('conductor') ||
            e.role.toLowerCase().includes('attendant'))))
  );
  const [assignVehicleId, setAssignVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [assignDriverId, setAssignDriverId] = useState<string>(driversList[0]?.id || '');
  const [assignHelperId, setAssignHelperId] = useState<string>(helpersList[0]?.id || '');
  const [assignStartDate, setAssignStartDate] = useState<string>(todayStr);
  const [assignRemarks, setAssignRemarks] = useState<string>('');
  const [assignFilterVehicleId, setAssignFilterVehicleId] = useState<string>('all');

  useEffect(() => {
    if (!assignVehicleId && vehicles.length > 0) setAssignVehicleId(vehicles[0].id);
    if (!assignDriverId && driversList.length > 0) setAssignDriverId(driversList[0].id);
  }, [vehicles.length, employees.length, assignVehicleId, assignDriverId]);

  const handleSaveAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignVehicleId || !assignDriverId) {
      setMasterError('Please select both a Vehicle and a Driver.');
      return;
    }
    const veh = vehicles.find(v => v.id === assignVehicleId);
    const drv = employees.find(emp => emp.id === assignDriverId);
    const hlp = employees.find(emp => emp.id === assignHelperId);
    if (!veh || !drv || !onSaveVehicleAssignment) return;

    await runMasterAction(async () => {
      await onSaveVehicleAssignment({
        vehicleId: veh.id,
        vehicleNumber: veh.registrationNumber,
        driverId: drv.id,
        driverName: drv.name,
        helperId: hlp?.id,
        helperName: hlp?.name,
        startDate: assignStartDate || todayStr,
        remarks: assignRemarks.trim() || `Assigned ${drv.name}${hlp ? ` & ${hlp.name}` : ''} to ${veh.registrationNumber}`,
      });
      setAssignRemarks('');
    });
  };

  const runMasterAction = async (fn: () => Promise<any>) => {
    try {
      setMasterError(null);
      await fn();
    } catch (err: any) {
      setMasterError(err.message || 'Operation failed');
    }
  };

  // Save branding
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    await runMasterAction(async () => {
      await onUpdateConfig(brandingForm);
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 3000);
    });
  };

  // Open Vehicle Modal
  const handleOpenVehicleModal = (veh?: Vehicle) => {
    setMasterError(null);
    setVehicleModalError(null);
    if (veh) {
      setEditingVehicle(veh);
    } else {
      setEditingVehicle({
        registrationNumber: '',
        type: 'Bus',
        capacity: 40,
        ownership: 'School-Owned',
        ownerName: config.schoolName,
        ownerMobile: '',
        ownerAddress: '',
        ownerAadhaarNo: '',
        ownerPanNo: '',
        monthlyRentAmount: 35000,
        agreementStartDate: todayStr,
        agreementEndDate: '2027-03-31',
        condition: 'Good',
        registrationValidity: '2030-12-31',
        taxPaidUpto: '2027-03-31',
        fitnessUpto: '2027-06-30',
        insuranceUpto: '2027-08-31',
        pollutionUpto: '2026-12-31',
        fuelType: 'Diesel',
        expectedMileageKmPerL: 6.0,
        baselineMileageKmPerLitre: 6.0,
        currentOdometer: 0,
        availability: 'Available',
      });
    }
    setIsVehicleModalOpen(true);
  };

  const handleRentedDocUpload = async (
    fieldData: 'rentAgreementAttachment' | 'ownerAadhaarAttachment' | 'ownerPanAttachment',
    fieldName: 'rentAgreementFileName' | 'ownerAadhaarFileName' | 'ownerPanFileName',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !editingVehicle) return;
    try {
      const compressed = await readFileCompressed(file, 900, 0.7);
      setEditingVehicle((prev) =>
        prev
          ? {
              ...prev,
              [fieldData]: compressed,
              [fieldName]: file.name,
            }
          : prev
      );
      setVehicleModalError(null);
    } catch {
      setVehicleModalError('Failed to process uploaded file.');
    }
  };

  const handlePrintStandardRentAgreement = () => {
    const v = editingVehicle || {};
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>School Vehicle Rent Agreement — ${v.registrationNumber || 'Draft'}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: 'Times New Roman', Georgia, serif; color: #0f172a; line-height: 1.45; font-size: 12.5px; margin: 0; padding: 12px; }
    .stamp-box { border: 2px dashed #475569; background: #f8fafc; padding: 10px 14px; text-align: center; font-size: 11px; color: #334155; margin-bottom: 14px; border-radius: 6px; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
    .header h1 { font-size: 17px; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .header h2 { font-size: 13px; font-weight: bold; margin: 4px 0 0 0; color: #1e293b; }
    .header p { font-size: 11px; margin: 2px 0 0 0; color: #475569; }
    .section-title { font-weight: bold; text-transform: uppercase; font-size: 12px; margin-top: 12px; margin-bottom: 6px; text-decoration: underline; }
    table.schedule { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
    table.schedule th, table.schedule td { border: 1px solid #1e293b; padding: 5px 8px; text-align: left; }
    table.schedule th { background: #f1f5f9; width: 32%; font-weight: bold; }
    ol.clauses { margin: 6px 0 12px 0; padding-left: 18px; }
    ol.clauses li { margin-bottom: 6px; text-align: justify; }
    .checklist { border: 1px solid #334155; padding: 8px 12px; background: #f8fafc; margin-top: 10px; font-size: 11.5px; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; page-break-inside: avoid; }
    .sig-box { border-top: 1px solid #0f172a; padding-top: 6px; font-size: 11.5px; }
  </style>
</head>
<body>
  <div class="stamp-box">
    <strong>INDIA NON-JUDICIAL STAMP PAPER SPACE (₹100 / As Applicable in State)</strong><br/>
    (Print on Non-Judicial Stamp Paper or Standard A4 Sheet, Fill Any Blank Fields, Sign with Seal, and Upload Scanned Copy)
  </div>

  <div class="header">
    <h1>SCHOOL STUDENT TRANSPORT VEHICLE HIRE / RENT AGREEMENT</h1>
    <h2>${config.schoolName}</h2>
    <p>${config.address} • Academic Session: ${config.academicYear}</p>
  </div>

  <p style="text-align: justify; margin: 0 0 10px 0;">
    This <strong>School Transport Vehicle Hire / Rent Agreement</strong> is executed at <strong>${config.address}</strong> on this <strong>${v.agreementStartDate || todayStr}</strong> between:
  </p>

  <p style="text-align: justify; margin: 0 0 8px 0;">
    <strong>1. FIRST PARTY (THE SCHOOL / INSTITUTION):</strong><br/>
    <strong>${config.schoolName}</strong>, situated at ${config.address}, represented through its Authorized Signatory / Principal / Transport Administrator (hereinafter referred to as the <strong>"First Party / School"</strong>, which expression shall include its successors and assigns).
  </p>

  <p style="text-align: justify; margin: 0 0 10px 0;">
    <strong>2. SECOND PARTY (THE VEHICLE OWNER / TRANSPORT CONTRACTOR):</strong><br/>
    <strong>${v.ownerName || '__________________________________________'}</strong>, Resident / Office at: <strong>${v.ownerAddress || '____________________________________________________________________'}</strong>, Contact Mobile No.: <strong>${v.ownerMobile || '____________________'}</strong>, holding <strong>Aadhaar No.: ${v.ownerAadhaarNo || '________________________'}</strong> and <strong>Income Tax PAN: ${v.ownerPanNo || '__________________'}</strong> (hereinafter referred to as the <strong>"Second Party / Vehicle Owner"</strong>).
  </p>

  <div class="section-title">Schedule of Hired / Rented School Transport Vehicle</div>
  <table class="schedule">
    <tr>
      <th>Vehicle Registration No.</th>
      <td><strong>${v.registrationNumber || '____________________________'}</strong></td>
      <th>Vehicle Type &amp; Seating Capacity</th>
      <td><strong>${v.type || 'Bus'} (${v.capacity || '____'} Seats)</strong></td>
    </tr>
    <tr>
      <th>Monthly Rent / Hire Charges</th>
      <td><strong>₹ ${v.monthlyRentAmount ? Number(v.monthlyRentAmount).toLocaleString('en-IN') : '________________'} /- per month</strong></td>
      <th>Fuel Type &amp; Mileage Norm</th>
      <td><strong>${v.fuelType || 'Diesel'} (${v.expectedMileageKmPerL || 6.0} km/L)</strong></td>
    </tr>
    <tr>
      <th>Agreement Effective From</th>
      <td><strong>${v.agreementStartDate || '____ / ____ / 202__'}</strong></td>
      <th>Agreement Valid Upto</th>
      <td><strong>${v.agreementEndDate || '____ / ____ / 202__'}</strong></td>
    </tr>
    <tr>
      <th>RC &amp; Fitness Validity</th>
      <td>RC: ${v.registrationValidity || '__________'} | Fitness: ${v.fitnessUpto || '__________'}</td>
      <th>Insurance, Tax &amp; PUC Validity</th>
      <td>Ins: ${v.insuranceUpto || '__________'} | Tax: ${v.taxPaidUpto || '__________'}</td>
    </tr>
  </table>

  <div class="section-title">Standard Terms, Safety Norms &amp; Statutory Conditions (India School Bus Norms)</div>
  <ol class="clauses">
    <li><strong>Dedicated School Duty &amp; Timings:</strong> The Second Party agrees to ply the above-mentioned commercial passenger vehicle exclusively for safe pick-up and drop-off of students and staff of the First Party across assigned villages, stops, and trips strictly as per the School's daily arrival and departure schedule.</li>
    <li><strong>Compliance with Supreme Court of India, CBSE &amp; State RTO School Bus Guidelines:</strong> The Vehicle Owner warrants that the vehicle strictly complies with all mandatory safety norms prescribed by the Hon'ble Supreme Court of India and Motor Vehicles Act, 1988, including: Highway Yellow paint with "${config.schoolName}" displayed prominently, "ON SCHOOL DUTY" board, calibrated Speed Governor (maximum speed 40 km/h), functional GPS tracker, CCTV camera, First-Aid Box, ISI-marked Fire Extinguisher, horizontal window safety grilles, and secure door locks.</li>
    <li><strong>Statutory Permits, Fitness &amp; Comprehensive Insurance:</strong> The Second Party shall keep the Registration Certificate (RC), Commercial Fitness Certificate (Form 38), School Bus / Contract Carriage Permit, Comprehensive Passenger &amp; Third-Party Insurance Policy, Road Tax, and Pollution Under Control (PUC) valid at their own expense throughout the tenure of this Agreement.</li>
    <li><strong>Driver &amp; Helper Qualification &amp; Verification:</strong> Any driver deployed on the vehicle must hold a valid Heavy Transport Vehicle (HTV/Trans) Driving License with at least 5 years of driving experience, prior Police Verification Certificate, Medical &amp; Vision Fitness Certificate, and zero record of traffic offences for drunken driving or rash driving.</li>
    <li><strong>Monthly Hire Payment &amp; TDS Deduction:</strong> The agreed monthly rent shall be payable by the School on or before the 10th of the succeeding month after verifying the daily trip attendance register, subject to deduction of applicable TDS under Section 194C of the Income Tax Act, 1961 against the Owner's PAN.</li>
    <li><strong>Mechanical Breakdown &amp; Replacement Vehicle:</strong> In the event of any breakdown, servicing, or non-availability of the contracted vehicle, the Second Party shall immediately provide a roadworthy substitute vehicle of equivalent seating capacity before route departure time, failing which proportionate daily rent and actual alternate arrangement cost shall be deducted.</li>
    <li><strong>Full Indemnity Against Accidents, Challans &amp; Claims:</strong> The Second Party (Vehicle Owner) shall be solely and exclusively liable for any traffic challans, RTO penalties, mechanical failures, third-party claims, MACT compensation, or civil/criminal liabilities arising out of the vehicle's operation, and hereby indemnifies the School Management completely.</li>
    <li><strong>Termination &amp; Notice Period:</strong> Either Party may terminate this Agreement by giving <strong>30 (Thirty) days' prior written notice</strong>. However, the School reserves the right to terminate this Agreement immediately in case of any compromise with student safety, expired vehicle fitness/insurance, or misconduct.</li>
  </ol>

  <div class="checklist">
    <strong>MANDATORY KYC &amp; DOCUMENT ENCLOSURES (TO BE SIGNED &amp; UPLOADED IN ERP):</strong><br/>
    [ &nbsp; ] 1. Duly Signed Vehicle Hire / Rent Agreement &nbsp;&nbsp;&nbsp;
    [ &nbsp; ] 2. Self-Attested Copy of Owner Aadhaar Card &nbsp;&nbsp;&nbsp;
    [ &nbsp; ] 3. Self-Attested Copy of Owner PAN Card &nbsp;&nbsp;&nbsp;
    [ &nbsp; ] 4. Valid RC, Fitness, Insurance &amp; PUC Copies
  </div>

  <div class="sig-grid">
    <div class="sig-box">
      <strong>FOR FIRST PARTY (THE SCHOOL / INSTITUTION)</strong><br/><br/><br/>
      Authorized Signatory &amp; Official Seal<br/>
      <strong>${config.schoolName}</strong><br/>
      Date: ________________________
    </div>
    <div class="sig-box">
      <strong>FOR SECOND PARTY (VEHICLE OWNER / TRANSPORTER)</strong><br/><br/><br/>
      Signature of Owner: ________________________<br/>
      Name: <strong>${v.ownerName || '____________________________'}</strong><br/>
      PAN: ${v.ownerPanNo || '____________'} | Aadhaar: ${v.ownerAadhaarNo || '________________'}
    </div>
    <div class="sig-box">
      <strong>WITNESS 1:</strong><br/>
      Signature: ________________________<br/>
      Name &amp; Mobile: ________________________<br/>
      Address: ______________________________
    </div>
    <div class="sig-box">
      <strong>WITNESS 2:</strong><br/>
      Signature: ________________________<br/>
      Name &amp; Mobile: ________________________<br/>
      Address: ______________________________
    </div>
  </div>
</body>
</html>`;

    openHtmlPrintPreview(html, `School Vehicle Rent Agreement — ${v.registrationNumber || 'Draft'}`);
  };

  const handleSaveVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVehicleModalError(null);
    if (!editingVehicle?.registrationNumber) {
      setVehicleModalError('Vehicle Registration Number is required.');
      return;
    }
    if (editingVehicle.ownership === 'Rented') {
      if (!editingVehicle.ownerName?.trim()) {
        setVehicleModalError('Owner Name is compulsory for a Rented vehicle.');
        return;
      }
      if (!editingVehicle.ownerAadhaarNo?.trim()) {
        setVehicleModalError('Owner Aadhaar Number is compulsory for a Rented vehicle.');
        return;
      }
      if (!editingVehicle.ownerPanNo?.trim()) {
        setVehicleModalError('Owner PAN Number is compulsory for a Rented vehicle.');
        return;
      }
      if (!editingVehicle.rentAgreementAttachment) {
        setVehicleModalError('Uploading the signed Vehicle Rent Agreement is compulsory for a Rented vehicle.');
        return;
      }
      if (!editingVehicle.ownerAadhaarAttachment) {
        setVehicleModalError('Uploading the Owner Aadhaar Card is compulsory for a Rented vehicle.');
        return;
      }
      if (!editingVehicle.ownerPanAttachment) {
        setVehicleModalError('Uploading the Owner PAN Card is compulsory for a Rented vehicle.');
        return;
      }
    }
    await runMasterAction(async () => {
      await onSaveVehicle(editingVehicle);
      setIsVehicleModalOpen(false);
    });
  };

  // Open Village Modal
  const handleOpenVillageModal = (vil?: Village) => {
    setMasterError(null);
    if (vil) {
      setEditingVillageId(vil.id);
      setVillageName(vil.name);
      setVillageDistance(vil.distanceKm);
      setVillageStops(vil.stops.map(s => ({ id: s.id, name: s.name, fee: s.fee, distanceKm: s.distanceKm })));
    } else {
      setEditingVillageId(null);
      setVillageName('');
      setVillageDistance(5);
      setVillageStops([{ name: '', fee: 700, distanceKm: 5 }]);
    }
    setIsVillageModalOpen(true);
  };

  const handleAddStopToVillage = () => {
    setVillageStops(prev => [
      ...prev,
      { name: '', fee: 700, distanceKm: villageDistance }
    ]);
  };

  const handleRemoveStopFromVillage = (index: number) => {
    if (villageStops.length <= 1) {
      setMasterError('A village must have at least one stop.');
      return;
    }
    setVillageStops(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveVillageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!villageName.trim()) {
      setMasterError('Village name is required.');
      return;
    }
    await runMasterAction(async () => {
      await onSaveVillage({
        id: editingVillageId || undefined,
        name: villageName.trim(),
        distanceKm: Number(villageDistance),
        stops: villageStops.map((s, idx) => ({
          id: s.id || `stp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          name: s.name.trim() || `Stop ${idx + 1}`,
          fee: Number(s.fee) || 700,
          distanceKm: Number(s.distanceKm) || Number(villageDistance),
        })),
      });
      setIsVillageModalOpen(false);
    });
  };

  // Calculate Route Nomenclature Preview: Campus/VehicleLast4/Trip
  const selectedVehicleObj = vehicles.find(v => v.id === routeVehicleId) || vehicles[0];
  const digitsOnly = selectedVehicleObj?.registrationNumber?.replace(/\D/g, '') || '';
  const vehicleLast4 = digitsOnly.length >= 4 
    ? digitsOnly.slice(-4) 
    : (selectedVehicleObj?.registrationNumber || '0000').slice(-4).replace(/\s/g, '');
  const selectedCampusObj = campuses.find(c => c.code === routeCampus || c.id === routeCampus);
  const campusCode = selectedCampusObj ? selectedCampusObj.code : (routeCampus || 'CMP');
  const previewRouteCode = `${campusCode}/${vehicleLast4 || 'XXXX'}/${routeTripNumber}`;

  // Active / Suspended transport members (excluding Left) for Route Member Comparison & Auto-Attachment
  const activeTransportMembers = students.filter(s => s.transportStatus !== 'Left');
  const editingRouteObj = editingRouteId ? routes.find(r => r.id === editingRouteId) || null : null;

  // 1. Old Members currently attached to this route (before saving)
  const oldRouteMembers = editingRouteObj
    ? activeTransportMembers.filter(
        s => s.routeId === editingRouteObj.id || s.routeCode === editingRouteObj.code
      )
    : [];

  // 2. New Members who belong to the selected Villages & Stops for this route (after change)
  const selectedStpIdSet = new Set(selectedStopIds);
  const selectedVillagesForModal = sortedVillages.filter(
    v =>
      selectedVillageIds.includes(v.id) ||
      (v.stops || []).some(st => selectedStpIdSet.has(st.id))
  );
  const selectedStopsForModal = selectedVillagesForModal.flatMap(v => {
    const vilStops = v.stops || [];
    const checkedInVil = vilStops.filter(st => selectedStpIdSet.has(st.id));
    return checkedInVil;
  });
  const selectedStpNameSet = new Set(
    selectedStopsForModal.map(st => st.name.trim().toLowerCase())
  );
  const selectedVilIdSet = new Set(selectedVillagesForModal.map(v => v.id));
  const selectedVilNameSet = new Set(selectedVillagesForModal.map(v => v.name.trim().toLowerCase()));

  const newRouteMembers = activeTransportMembers.filter(s => {
    const hasMemberStop = Boolean(
      (s.pickupDropStopId && s.pickupDropStopId.trim()) ||
      (s.pickupDropStopName && s.pickupDropStopName.trim())
    );
    if (hasMemberStop) {
      if (s.pickupDropStopId && selectedStpIdSet.has(s.pickupDropStopId)) return true;
      if (
        s.pickupDropStopName &&
        selectedStpNameSet.has(s.pickupDropStopName.trim().toLowerCase()) &&
        (!s.villageName || selectedVilNameSet.has(s.villageName.trim().toLowerCase()))
      ) {
        return true;
      }
      return false;
    }
    return (
      (!!s.villageId && selectedVilIdSet.has(s.villageId)) ||
      (!!s.villageName && selectedVilNameSet.has(s.villageName.trim().toLowerCase()))
    );
  });

  const oldMemberIdSet = new Set(oldRouteMembers.map(m => m.id));
  const newMemberIdSet = new Set(newRouteMembers.map(m => m.id));
  const addedRouteMembers = newRouteMembers.filter(m => !oldMemberIdSet.has(m.id));
  const retainedRouteMembers = newRouteMembers.filter(m => oldMemberIdSet.has(m.id));
  const removedRouteMembers = oldRouteMembers.filter(m => !newMemberIdSet.has(m.id));

  const getFallbackRouteForRemovedMember = (m: StudentMember): Route | undefined => {
    const cleanVilName = (m.villageName || '').trim().toLowerCase();
    const cleanStopName = (m.pickupDropStopName || '').trim().toLowerCase();
    const otherRoutes = routes.filter(r => {
      if (editingRouteId && r.id === editingRouteId) return false;
      if (r.active === false) return false;
      return true;
    });
    // Priority 1: Another route that explicitly covers the member's stop
    const stopMatches = otherRoutes.filter(r => {
      const rStopIds = r.stopIds || [];
      const rStopNames = (r.stopNames || []).map(sn => String(sn || '').trim().toLowerCase());
      return (
        (!!m.pickupDropStopId && rStopIds.includes(m.pickupDropStopId)) ||
        (!!cleanStopName && rStopNames.includes(cleanStopName))
      );
    });
    if (stopMatches.length > 0) {
      const campusMatch = stopMatches.find(
        r =>
          String(r.campus || '').toLowerCase() === String(m.campus || '').toLowerCase() ||
          String(r.campusCode || '').toLowerCase() === String(m.campus || '').toLowerCase()
      );
      return campusMatch || stopMatches[0];
    }
    // Priority 2: Legacy whole-village route covering this village without restricting to other stops
    const villageMatches = otherRoutes.filter(r => {
      const hasExplicitStops = (r.stopIds && r.stopIds.length > 0) || (r.stopNames && r.stopNames.length > 0);
      if (hasExplicitStops && (m.pickupDropStopId || cleanStopName)) return false;
      const byId = !!m.villageId && (r.villageIds || []).includes(m.villageId);
      const byName =
        !!cleanVilName &&
        (r.villageNames || []).some(vn => String(vn || '').trim().toLowerCase() === cleanVilName);
      return byId || byName;
    });
    if (villageMatches.length === 0) return undefined;
    const campusMatch = villageMatches.find(
      r =>
        String(r.campus || '').toLowerCase() === String(m.campus || '').toLowerCase() ||
        String(r.campusCode || '').toLowerCase() === String(m.campus || '').toLowerCase()
    );
    return campusMatch || villageMatches[0];
  };

  const handleProceedToRouteComparison = (e: React.FormEvent) => {
    e.preventDefault();
    setRouteModalError(null);
    if (!routeCampus) {
      setRouteModalError('Please select a Campus.');
      return;
    }
    if (!routeVehicleId && vehicles.length === 0) {
      setRouteModalError('Please create at least one vehicle in Vehicles Master before creating a route.');
      return;
    }
    if (selectedVillagesForModal.length === 0 || selectedStopsForModal.length === 0) {
      setRouteModalError('Please select at least one Village and Stop for this route.');
      return;
    }
    setShowRouteComparisonStep(true);
  };

  const handleConfirmFinalizeRouteSave = async () => {
    setRouteModalError(null);
    await runMasterAction(async () => {
      await onSaveRoute({
        id: editingRouteId || undefined,
        campus: routeCampus,
        vehicleId: routeVehicleId || vehicles[0]?.id,
        tripNumber: Number(routeTripNumber),
        villageIds: selectedVillagesForModal.map(v => v.id),
        stopIds: selectedStopsForModal.map(s => s.id),
        stopNames: selectedStopsForModal.map(s => s.name),
        confirmedMemberIds: newRouteMembers.map(m => m.id),
        active: true,
      });
      setIsRouteModalOpen(false);
      setShowRouteComparisonStep(false);
      setEditingRouteId(null);
      setSelectedVillageIds([]);
      setSelectedStopIds([]);
      setRouteVillageSearch('');
    });
  };

  const getCampusLabel = (codeOrId: string) => {
    const found = campuses.find(c => c.code === codeOrId || c.id === codeOrId || c.name === codeOrId);
    return found ? `${found.name} (${found.code})` : codeOrId;
  };

  return (
    <div className="space-y-6">
      {/* Dependency / Validation Error Alert Banner */}
      {masterError && (
        <div className="bg-rose-50 border border-rose-300 text-rose-900 px-4 py-3 rounded-2xl flex items-start justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-2.5 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{masterError}</span>
          </div>
          <button
            onClick={() => setMasterError(null)}
            className="text-rose-500 hover:text-rose-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: ROUTES MASTER */}
      {activeTab === 'routes' && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Routes Master</h2>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {routes.length} Routes
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PrintExportToolbar
                title="Routes Master"
                filename="routes_master"
                schoolName={config.schoolName}
                filteredData={routes}
                allData={routes}
                columns={[
                  { header: 'Route Code', accessor: (r) => r.code },
                  { header: 'Campus', accessor: (r) => getCampusLabel(r.campus) },
                  { header: 'Vehicle Number', accessor: (r) => r.vehicleNumber },
                  { header: 'Trip Number', accessor: (r) => `Trip ${r.tripNumber}` },
                  { header: 'Assigned Villages', accessor: (r) => r.villageNames.join(', ') },
                  { header: 'Status', accessor: (r) => (r.active ? 'Active' : 'Inactive') },
                ]}
              />
              <button
                onClick={() => {
                  setMasterError(null);
                  if (campuses.length === 0) {
                    setMasterError('Please create at least one Campus in Campuses Master before creating a route.');
                    setActiveTab('campuses');
                    return;
                  }
                  if (vehicles.length === 0) {
                    setMasterError('Please add at least one Vehicle in Vehicles Master before creating a route.');
                    setActiveTab('vehicles');
                    return;
                  }
                  if (trips.length === 0) {
                    setMasterError('Please add at least one Trip in Trips Master before creating a route.');
                    setActiveTab('trips');
                    return;
                  }
                  setEditingRouteId(null);
                  setRouteVehicleId(vehicles[0]?.id || '');
                  setRouteCampus(campuses[0]?.code || '');
                  setRouteTripNumber(trips[0]?.tripNumber || 1);
                  setSelectedVillageIds(sortedVillages[0] ? [sortedVillages[0].id] : []);
                  setSelectedStopIds(
                    sortedVillages[0] ? (sortedVillages[0].stops || []).map(st => st.id) : []
                  );
                  setRouteVillageSearch('');
                  setRouteModalError(null);
                  setShowRouteComparisonStep(false);
                  setIsRouteModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Route</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Route Code</th>
                    <th className="py-3 px-3">Campus</th>
                    <th className="py-3 px-3">Vehicle (Last 4)</th>
                    <th className="py-3 px-3">Trip</th>
                    <th className="py-3 px-3">Assigned Villages &amp; Stops (A–Z)</th>
                    <th className="py-3 px-3">Attached Members</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {routes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No routes created yet.
                      </td>
                    </tr>
                  ) : (
                    routes.map((r) => {
                      const routeMembersCount = activeTransportMembers.filter(
                        s => s.routeId === r.id || s.routeCode === r.code
                      ).length;
                      const rStopIds = new Set(r.stopIds || []);
                      const rStopNames = new Set((r.stopNames || []).map(sn => String(sn || '').trim().toLowerCase()));
                      const hasExplicitStops = rStopIds.size > 0 || rStopNames.size > 0;
                      const coveredVils = sortedVillages.filter(
                        v =>
                          (r.villageIds || []).includes(v.id) ||
                          (r.villageNames || []).includes(v.name) ||
                          (v.stops || []).some(st => rStopIds.has(st.id))
                      );
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-base text-slate-900 bg-amber-100 text-amber-950 px-2 py-0.5 rounded-md">
                              {r.code}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-900">
                              {getCampusLabel(r.campus)}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-800">
                            {r.vehicleNumber} ({r.vehicleLast4})
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-700">
                            Trip {r.tripNumber}
                          </td>
                          <td className="py-3 px-3 text-slate-800">
                            <div className="flex flex-wrap gap-1.5">
                              {coveredVils.length > 0 ? (
                                coveredVils.map((vil) => {
                                  const stopsInVil = hasExplicitStops
                                    ? (vil.stops || []).filter(
                                        st => rStopIds.has(st.id) || rStopNames.has(st.name.trim().toLowerCase())
                                      )
                                    : vil.stops || [];
                                  return (
                                    <span
                                      key={vil.id}
                                      className="bg-slate-100 border border-slate-200 text-slate-800 px-2 py-0.5 rounded-md text-[10px] font-semibold inline-flex items-center gap-1"
                                    >
                                      <span>{vil.name}</span>
                                      {stopsInVil.length > 0 && (
                                        <span className="text-indigo-700 font-normal">
                                          ({stopsInVil.map(s => s.name).join(', ')})
                                        </span>
                                      )}
                                    </span>
                                  );
                                })
                              ) : (
                                [...(r.villageNames || [])]
                                  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }))
                                  .map((vName, idx) => (
                                    <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium">
                                      {vName}
                                    </span>
                                  ))
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                              <Users className="w-3 h-3" />
                              <span>{routeMembersCount} {routeMembersCount === 1 ? 'Member' : 'Members'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md text-[10px]">
                              Active
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setMasterError(null);
                                  setRouteModalError(null);
                                  setEditingRouteId(r.id);
                                  setRouteCampus(r.campus);
                                  setRouteVehicleId(r.vehicleId);
                                  setRouteTripNumber(r.tripNumber);
                                  const resolvedVilIds =
                                    r.villageIds && r.villageIds.length > 0
                                      ? r.villageIds
                                      : sortedVillages
                                          .filter(v => (r.villageNames || []).includes(v.name))
                                          .map(v => v.id);
                                  setSelectedVillageIds(resolvedVilIds);
                                  if (r.stopIds && r.stopIds.length > 0) {
                                    setSelectedStopIds(r.stopIds);
                                  } else if (r.stopNames && r.stopNames.length > 0) {
                                    const snSet = new Set(r.stopNames.map(sn => sn.trim().toLowerCase()));
                                    setSelectedStopIds(
                                      sortedVillages
                                        .filter(v => resolvedVilIds.includes(v.id))
                                        .flatMap(v => (v.stops || []).filter(st => snSet.has(st.name.trim().toLowerCase())).map(st => st.id))
                                    );
                                  } else {
                                    setSelectedStopIds(
                                      sortedVillages
                                        .filter(v => resolvedVilIds.includes(v.id))
                                        .flatMap(v => (v.stops || []).map(st => st.id))
                                    );
                                  }
                                  setRouteVillageSearch('');
                                  setShowRouteComparisonStep(false);
                                  setIsRouteModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                                title="Edit Route, Villages & Stops"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Edit Route</span>
                              </button>
                              <button
                                onClick={() => runMasterAction(() => onDeleteRoute(r.id))}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                title="Delete Route"
                              >
                                <Trash2 className="w-4 h-4" />
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

      {/* TAB 2: VEHICLES MASTER */}
      {activeTab === 'vehicles' && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Vehicles Master</h2>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {vehicles.length} Vehicles
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PrintExportToolbar
                title="Vehicles Master"
                filename="vehicles_master"
                schoolName={config.schoolName}
                filteredData={vehicles}
                allData={vehicles}
                columns={[
                  { header: 'Reg Number', accessor: (v) => v.registrationNumber },
                  { header: 'Type', accessor: (v) => v.type },
                  { header: 'Capacity', accessor: (v) => v.capacity },
                  { header: 'Ownership', accessor: (v) => v.ownership },
                  { header: 'Owner Name', accessor: (v) => v.ownerName || '' },
                  { header: 'Owner PAN', accessor: (v) => v.ownerPanNo || '—' },
                  { header: 'Owner Aadhaar', accessor: (v) => v.ownerAadhaarNo || '—' },
                  { header: 'Condition', accessor: (v) => v.condition },
                  { header: 'Reg Validity', accessor: (v) => v.registrationValidity },
                  { header: 'Tax Paid Upto', accessor: (v) => v.taxPaidUpto },
                  { header: 'Fitness Upto', accessor: (v) => v.fitnessUpto },
                  { header: 'Insurance Upto', accessor: (v) => v.insuranceUpto },
                  { header: 'Current Odo (km)', accessor: (v) => v.currentOdometer },
                ]}
              />
              <button
                onClick={() => handleOpenVehicleModal()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Vehicle</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Reg Number</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Ownership &amp; Owner KYC</th>
                    <th className="py-3 px-3">Condition</th>
                    <th className="py-3 px-3">Reg Validity</th>
                    <th className="py-3 px-3">Tax Paid Upto</th>
                    <th className="py-3 px-3">Fitness Validity</th>
                    <th className="py-3 px-3">Insurance Upto</th>
                    <th className="py-3 px-3 font-mono">Threshold Mileage</th>
                    <th className="py-3 px-3 font-mono">Current Odo</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicles.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">
                        No vehicles entered yet.
                      </td>
                    </tr>
                  ) : (
                    vehicles.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 text-sm">
                          {v.registrationNumber}
                          {v.assignedDriverName && (
                            <span className="block text-[10px] font-sans font-semibold text-indigo-700">
                              Driver: {v.assignedDriverName}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">{v.type} ({v.capacity} Seats)</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            v.ownership === 'School-Owned' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {v.ownership}
                          </span>
                          <span className="block text-[10px] font-semibold text-slate-700 mt-0.5">{v.ownerName || 'School'}</span>
                          {v.ownership === 'Rented' && (
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {v.ownerPanNo && (
                                <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  PAN: {v.ownerPanNo}
                                </span>
                              )}
                              {v.rentAgreementAttachment && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewVehicleDoc({ title: `Rent Agreement — ${v.registrationNumber}`, url: v.rentAgreementAttachment! })}
                                  className="text-[9px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-1.5 py-0.5 rounded cursor-pointer"
                                >
                                  Agreement
                                </button>
                              )}
                              {v.ownerAadhaarAttachment && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewVehicleDoc({ title: `Owner Aadhaar — ${v.ownerName || v.registrationNumber}`, url: v.ownerAadhaarAttachment! })}
                                  className="text-[9px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-1.5 py-0.5 rounded cursor-pointer"
                                >
                                  Aadhaar
                                </button>
                              )}
                              {v.ownerPanAttachment && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewVehicleDoc({ title: `Owner PAN — ${v.ownerName || v.registrationNumber}`, url: v.ownerPanAttachment! })}
                                  className="text-[9px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-1.5 py-0.5 rounded cursor-pointer"
                                >
                                  PAN Doc
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                            v.condition === 'Good' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {v.condition}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">{v.registrationValidity}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{v.taxPaidUpto}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{v.fitnessUpto}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{v.insuranceUpto}</td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-700">
                          {v.expectedMileageKmPerL || v.baselineMileageKmPerLitre || 6.0} km/L
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{v.currentOdometer.toLocaleString()} km</td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            onClick={() => handleOpenVehicleModal(v)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Edit Vehicle"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => runMasterAction(() => onDeleteVehicle(v.id))}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Delete Vehicle"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* TAB 3: VILLAGES & STOPS MASTER */}
      {activeTab === 'villages' && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Villages &amp; Transport Stops Master</h2>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {filteredVillagesMaster.length} Villages
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                <ArrowDownAZ className="w-3.5 h-3.5" />
                <span>Sorted A–Z</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-48 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={villageSearchQuery}
                  onChange={(e) => setVillageSearchQuery(e.target.value)}
                  placeholder="Search village or stop..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Card View / List View Toggle */}
              <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setVillageViewMode('card')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    villageViewMode === 'card'
                      ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Card View (Alphabetical A–Z)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Card View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVillageViewMode('list')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    villageViewMode === 'list'
                      ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="List View (Alphabetical A–Z)"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>List View</span>
                </button>
              </div>

              <PrintExportToolbar
                title="Villages & Transport Stops Master (Alphabetical A–Z)"
                filename="villages_stops_master"
                schoolName={config.schoolName}
                filteredData={filteredVillagesMaster}
                allData={sortedVillages}
                hasActiveFilters={villageSearchQuery.trim() !== ''}
                filterSummary={villageSearchQuery.trim() ? `Search: ${villageSearchQuery.trim()}` : undefined}
                columns={[
                  { header: 'S.No', accessor: (_v, idx) => (idx ?? 0) + 1 },
                  { header: 'Village Name (A-Z)', accessor: (v) => v.name },
                  { header: 'Distance (km)', accessor: (v) => v.distanceKm },
                  { header: 'Stops Count', accessor: (v) => v.stops.length },
                  { header: 'Stops & Fees', accessor: (v) => v.stops.map(s => `${s.name} (Rs.${s.fee})`).join('; ') },
                ]}
              />
              <button
                onClick={() => handleOpenVillageModal()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Village &amp; Stops</span>
              </button>
            </div>
          </div>

          {villageViewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVillagesMaster.length === 0 ? (
                <div className="col-span-3 py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                  No villages found.
                </div>
              ) : (
                filteredVillagesMaster.map((vil, vIdx) => (
                  <div key={vil.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b pb-2.5 border-slate-100">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                            {vIdx + 1}
                          </span>
                          <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>{vil.name}</span>
                        </h4>
                        <span className="text-[10px] text-slate-500">{vil.distanceKm} km from school</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenVillageModal(vil)}
                          className="p-1 text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
                          title="Edit Village"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => runMasterAction(() => onDeleteVillage(vil.id))}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                          title="Delete Village"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Transport Stops ({vil.stops.length})
                      </span>
                      <div className="space-y-1.5">
                        {vil.stops.map((st, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl text-xs">
                            <span className="font-semibold text-slate-800">{st.name}</span>
                            <div className="text-right">
                              <span className="font-mono font-bold text-emerald-700">₹{st.fee}/mo</span>
                              <span className="text-[10px] text-slate-400 block">{st.distanceKm} km</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-14">#</th>
                      <th className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1">
                          <span>Village Name (A–Z)</span>
                          <ArrowDownAZ className="w-3.5 h-3.5 text-emerald-600" />
                        </span>
                      </th>
                      <th className="py-3.5 px-4">Distance from School</th>
                      <th className="py-3.5 px-4">Stops Count</th>
                      <th className="py-3.5 px-4">Transport Stops &amp; Monthly Fee (A–Z)</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 text-xs">
                    {filteredVillagesMaster.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          No villages found.
                        </td>
                      </tr>
                    ) : (
                      filteredVillagesMaster.map((vil, idx) => (
                        <tr key={vil.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-500">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                              <span>{vil.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                            {vil.distanceKm} km
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                              {vil.stops.length} {vil.stops.length === 1 ? 'Stop' : 'Stops'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {vil.stops.map((st, sIdx) => (
                                <span
                                  key={st.id || sIdx}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                                >
                                  <span className="font-semibold text-slate-800">{st.name}</span>
                                  <span className="font-mono font-bold text-emerald-700">₹{st.fee}/mo</span>
                                  <span className="text-[10px] text-slate-400">({st.distanceKm} km)</span>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => handleOpenVillageModal(vil)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                              title="Edit Village"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => runMasterAction(() => onDeleteVillage(vil.id))}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Delete Village"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CAMPUSES MASTER */}
      {activeTab === 'campuses' && (
        <div className="space-y-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingCampusId ? 'Edit Campus Details' : 'Add Campus to Master'}
              </h3>
              {editingCampusId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCampusId(null);
                    setNewCampusName('');
                    setNewCampusCode('');
                    setNewCampusAddress('');
                  }}
                  className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Campus Name</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Campus"
                  value={newCampusName}
                  onChange={(e) => setNewCampusName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl font-semibold"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Short Code</label>
                <input
                  type="text"
                  placeholder="e.g. Sr, Jr, Main"
                  value={newCampusCode}
                  onChange={(e) => setNewCampusCode(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Address / Location</label>
                <input
                  type="text"
                  placeholder="Optional address"
                  value={newCampusAddress}
                  onChange={(e) => setNewCampusAddress(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() =>
                  runMasterAction(async () => {
                    if (!newCampusName.trim() || !newCampusCode.trim()) {
                      throw new Error('Campus Name and Short Code are required.');
                    }
                    if (editingCampusId && onUpdateCampus) {
                      await onUpdateCampus(editingCampusId, {
                        name: newCampusName.trim(),
                        code: newCampusCode.trim(),
                        address: newCampusAddress.trim(),
                      });
                    } else {
                      await onAddCampus({
                        name: newCampusName.trim(),
                        code: newCampusCode.trim(),
                        address: newCampusAddress.trim(),
                      });
                    }
                    setEditingCampusId(null);
                    setNewCampusName('');
                    setNewCampusCode('');
                    setNewCampusAddress('');
                  })
                }
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
              >
                {editingCampusId ? 'Save Updated Campus' : '+ Add Campus'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden max-w-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Campus Name</th>
                  <th className="py-3 px-3">Short Code</th>
                  <th className="py-3 px-3">Address</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campuses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No campuses added yet.
                    </td>
                  </tr>
                ) : (
                  campuses.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold bg-amber-100 text-amber-950 px-2 py-0.5 rounded-md">
                          {c.code}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{c.address || '—'}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCampusId(c.id);
                              setNewCampusName(c.name);
                              setNewCampusCode(c.code);
                              setNewCampusAddress(c.address || '');
                              setMasterError(null);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            title="Edit Campus"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => runMasterAction(() => onRemoveCampus(c.id))}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Delete Campus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: MEMBER TYPES MASTER */}
      {activeTab === 'memberTypes' && (
        <div className="space-y-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingMemberTypeId ? 'Edit Member Type' : `Member Types Master (${memberTypes.length})`}
              </h3>
              {editingMemberTypeId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMemberTypeId(null);
                    setNewMemberTypeName('');
                  }}
                  className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Member Type (e.g. Student, Teacher, Staff)"
                value={newMemberTypeName}
                onChange={(e) => setNewMemberTypeName(e.target.value)}
                className="flex-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold"
              />
              <button
                onClick={() =>
                  runMasterAction(async () => {
                    if (!newMemberTypeName.trim()) {
                      throw new Error('Member Type name is required.');
                    }
                    if (editingMemberTypeId && onUpdateMemberType) {
                      await onUpdateMemberType(editingMemberTypeId, newMemberTypeName.trim());
                    } else {
                      await onAddMemberType(newMemberTypeName.trim());
                    }
                    setEditingMemberTypeId(null);
                    setNewMemberTypeName('');
                  })
                }
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                {editingMemberTypeId ? 'Save Changes' : '+ Add Member Type'}
              </button>
            </div>

            <div className="divide-y divide-slate-100 pt-2">
              {memberTypes.length === 0 ? (
                <p className="py-6 text-center text-slate-400 text-xs">
                  No member types added yet.
                </p>
              ) : (
                memberTypes.map((mt) => (
                  <div key={mt.id} className="py-2.5 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{mt.name}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMemberTypeId(mt.id);
                          setNewMemberTypeName(mt.name);
                          setMasterError(null);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => runMasterAction(() => onRemoveMemberType(mt.id))}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Delete Member Type"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: TRIPS MASTER (1, 2, 3...) */}
      {activeTab === 'trips' && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs max-w-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingTripId ? 'Edit Trip Details' : 'Add Trip Number to Master'}
              </h3>
              {editingTripId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTripId(null);
                    setNewTripNum(trips.length + 1);
                    setNewTripDesc('');
                  }}
                  className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                placeholder="Trip No (e.g. 1)"
                value={newTripNum}
                onChange={(e) => setNewTripNum(Number(e.target.value))}
                className="w-24 p-2 border border-slate-300 rounded-xl text-xs font-bold"
              />
              <input
                type="text"
                placeholder="Description (e.g. Morning Shift 1)"
                value={newTripDesc}
                onChange={(e) => setNewTripDesc(e.target.value)}
                className="flex-1 p-2 border border-slate-300 rounded-xl text-xs"
              />
              <button
                onClick={() =>
                  runMasterAction(async () => {
                    if (!newTripNum) return;
                    if (editingTripId && onUpdateTrip) {
                      await onUpdateTrip(editingTripId, {
                        tripNumber: newTripNum,
                        description: newTripDesc || `Trip ${newTripNum}`,
                      });
                      setEditingTripId(null);
                    } else {
                      await onAddTrip({ tripNumber: newTripNum, description: newTripDesc || `Trip ${newTripNum}` });
                    }
                    setNewTripDesc('');
                    setNewTripNum(trips.length + 1);
                  })
                }
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
              >
                {editingTripId ? 'Save Changes' : '+ Add Trip'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden max-w-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Trip Number</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trips.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">
                      No trips added yet.
                    </td>
                  </tr>
                ) : (
                  trips.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-bold text-sm text-slate-900">Trip {t.tripNumber}</td>
                      <td className="py-3 px-3 text-slate-700">{t.description}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTripId(t.id);
                              setNewTripNum(t.tripNumber);
                              setNewTripDesc(t.description);
                              setMasterError(null);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => runMasterAction(() => onRemoveTrip(t.id))}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: CLASSES & SECTIONS */}
      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Classes */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingClassOldName ? `Edit Class "${editingClassOldName}"` : `Classes Master (${classes.length})`}
              </h3>
              {editingClassOldName && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingClassOldName(null);
                    setNewClassName('');
                  }}
                  className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = newClassName.trim();
                if (!val) return;
                const oldVal = editingClassOldName;
                setNewClassName('');
                setEditingClassOldName(null);
                runMasterAction(async () => {
                  if (oldVal && onUpdateClass) {
                    await onUpdateClass(oldVal, val);
                  } else {
                    await onAddClass(val);
                  }
                });
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Class Name (e.g. Playgroup, Nursery, Class VI)"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="flex-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                {editingClassOldName ? 'Save Class' : '+ Add Class'}
              </button>
            </form>
            <p className="text-[11px] text-slate-500">
              Click the pencil icon on any class to rename/edit it, or click &times; to remove it.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {classes.length === 0 ? (
                <p className="text-slate-400 text-xs">No classes added yet.</p>
              ) : (
                classes.map((cls, idx) => (
                  <span
                    key={idx}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                      editingClassOldName === cls
                        ? 'bg-amber-50 border-amber-400 text-amber-950'
                        : 'bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <span>{cls}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingClassOldName(cls);
                        setNewClassName(cls);
                        setMasterError(null);
                      }}
                      className="text-slate-500 hover:text-indigo-600 cursor-pointer"
                      title={`Edit "${cls}"`}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => runMasterAction(() => onRemoveClass(cls))}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      title={`Delete "${cls}"`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Sections */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingSectionOldName ? `Edit Section "${editingSectionOldName}"` : `Sections Master (${sections.length})`}
              </h3>
              {editingSectionOldName && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSectionOldName(null);
                    setNewSectionName('');
                  }}
                  className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = newSectionName.trim();
                if (!val) return;
                const oldVal = editingSectionOldName;
                setNewSectionName('');
                setEditingSectionOldName(null);
                runMasterAction(async () => {
                  if (oldVal && onUpdateSection) {
                    await onUpdateSection(oldVal, val);
                  } else {
                    await onAddSection(val);
                  }
                });
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Section Name (e.g. A, B, Rose)"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                className="flex-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                {editingSectionOldName ? 'Save Section' : '+ Add Section'}
              </button>
            </form>
            <p className="text-[11px] text-slate-500">
              Click the pencil icon on any section to rename/edit it, or click &times; to remove it.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {sections.length === 0 ? (
                <p className="text-slate-400 text-xs">No sections added yet.</p>
              ) : (
                sections.map((sec, idx) => (
                  <span
                    key={idx}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                      editingSectionOldName === sec
                        ? 'bg-amber-50 border-amber-400 text-amber-950'
                        : 'bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <span>Section {sec}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSectionOldName(sec);
                        setNewSectionName(sec);
                        setMasterError(null);
                      }}
                      className="text-slate-500 hover:text-indigo-600 cursor-pointer"
                      title={`Edit Section "${sec}"`}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => runMasterAction(() => onRemoveSection(sec))}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      title={`Delete Section "${sec}"`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 0: USERS & PASSWORDS (RBAC AUTHORIZATION SYSTEM) */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Role Access Matrix Summary Banner */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                  Role-Based Access Control (RBAC) &amp; Login Credentials
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Manage Usernames, Full Names &amp; Passwords for All 3 System Roles
                </h3>
              </div>
              <span className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                Active Role Directory
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-amber-500/30 space-y-1">
                <div className="font-bold text-amber-300">1. Admin Role</div>
                <p className="text-slate-300 text-[11px]">
                  Full access to all modules: Executive Dashboard, Masters &amp; Users, Approvals (Suspensions, Work Orders, Expenses), Payroll, Chart of Accounts, Trial Balance, and Reports.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-sky-500/30 space-y-1">
                <div className="font-bold text-sky-300">2. Transport Coordinator Role</div>
                <p className="text-slate-300 text-[11px]">
                  Operational &amp; collection access (no Masters access): Member Directory, Fee Collection &amp; Follow-ups, Active Routes, Vehicles, Staff Attendance, and submitting Work Orders / Suspensions for Admin approval.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-emerald-500/30 space-y-1">
                <div className="font-bold text-emerald-300">3. Transport Assistant Role</div>
                <p className="text-slate-300 text-[11px]">
                  Authorized for Fee Receipts, Dues Follow-ups, Work Order Requests, Route &amp; Staff Attendance, 24-Hr Vehicle Log Book, Expense Entries, Adding New Members, and Receiving Candidate Resumes (no Masters access).
                </p>
              </div>
            </div>
          </div>

          {userSavedMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>{userSavedMsg}</span>
              </span>
              <button onClick={() => setUserSavedMsg(null)} className="text-emerald-700 hover:underline cursor-pointer">
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Form: Create or Edit User Account & Password */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs h-fit space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingUserId ? 'Edit User & Password' : 'Create New User Account'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Assign a username, password, full name, and role
                  </p>
                </div>
                {editingUserId && (
                  <button
                    type="button"
                    onClick={handleResetUserForm}
                    className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveUserSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name of Staff / Officer *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Kumar Sharma"
                    value={userFormName}
                    onChange={(e) => setUserFormName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assign System Role *</label>
                  <select
                    value={userFormRole}
                    onChange={(e) => setUserFormRole(e.target.value as UserRole)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-slate-50"
                  >
                    <option value="Admin">Admin (Full Control &amp; Approvals)</option>
                    <option value="Transport Coordinator">Transport Coordinator (Operations &amp; Fees)</option>
                    <option value="Transport Assistant">Transport Assistant (Gate &amp; Log Book Only)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Login Username *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. coord_rajesh"
                      value={userFormUsername}
                      onChange={(e) => setUserFormUsername(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Login Password *</label>
                    <input
                      type="text"
                      required
                      minLength={4}
                      placeholder="Min 4 chars"
                      value={userFormPassword}
                      onChange={(e) => setUserFormPassword(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold text-emerald-800 bg-emerald-50/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Assigned Campus</label>
                    <select
                      value={userFormCampus}
                      onChange={(e) => setUserFormCampus(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="All Campuses">All Campuses</option>
                      {campuses.map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Account Status</label>
                    <select
                      value={userFormStatus}
                      onChange={(e) => setUserFormStatus(e.target.value as 'Active' | 'Disabled')}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-bold bg-white"
                    >
                      <option value="Active">Active (Can Sign In)</option>
                      <option value="Disabled">Disabled (Blocked)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={userFormMobile}
                    onChange={(e) => setUserFormMobile(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingUserId ? 'Update User & Password' : 'Create User Account'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right Table: All Configured System Users */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Authorized System Users ({users.length})
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Click &ldquo;Edit / Change Password&rdquo; on any row to update credentials
                  </span>
                </div>
                <PrintExportToolbar
                  title="Authorized System Users & Role Register"
                  filename="system_users_roles"
                  schoolName={config.schoolName}
                  filteredData={users}
                  allData={users}
                  hasActiveFilters={false}
                  columns={[
                    { header: 'Full Name', accessor: (u) => u.fullName },
                    { header: 'Username', accessor: (u) => u.username },
                    { header: 'Role', accessor: (u) => u.role },
                    { header: 'Campus', accessor: (u) => u.campus || 'All Campuses' },
                    { header: 'Status', accessor: (u) => u.status },
                    { header: 'Last Login', accessor: (u) => u.lastLoginAt || 'Never' },
                  ]}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                    <tr>
                      <th className="py-3 px-4">Full Name</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Username</th>
                      <th className="py-3 px-3">Password</th>
                      <th className="py-3 px-3">Campus</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Last Login</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const isPassShown = !!visiblePasswords[u.id];
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-bold text-slate-900">{u.fullName}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                u.role === 'Admin'
                                  ? 'bg-amber-100 text-amber-900'
                                  : u.role === 'Transport Coordinator'
                                  ? 'bg-sky-100 text-sky-900'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">{u.username}</td>
                          <td className="py-3 px-3 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-emerald-800">
                                {isPassShown ? u.password : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setVisiblePasswords((prev) => ({ ...prev, [u.id]: !prev[u.id] }))
                                }
                                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                title={isPassShown ? 'Hide Password' : 'Show Password'}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600">{u.campus || 'All Campuses'}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                u.status === 'Active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                            {u.lastLoginAt || 'Never'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEditUserClick(u)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit / Password</span>
                              </button>
                              {onDeleteUser && (
                                <button
                                  type="button"
                                  onClick={() => runMasterAction(() => onDeleteUser(u.id))}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                  title="Delete User Account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: DESIGNATIONS & PERMISSIONS */}
      {activeTab === 'designations' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Designations &amp; Role Permissions</h3>
                <p className="text-[11px] text-slate-500">
                  Click any permission badge below to toggle it On or Off for that designation
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {designations.map((des) => (
                <div key={des.id} className="p-4 space-y-3 hover:bg-slate-50/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{des.name}</span>
                      {des.isDriver && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-md">
                          Requires Driving License
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">{des.description}</span>
                      <button
                        onClick={() => runMasterAction(() => onRemoveDesignation(des.id))}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Delete Designation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {Object.entries(des.permissions || {}).map(([key, val]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          runMasterAction(() =>
                            onSaveDesignation({
                              ...des,
                              permissions: {
                                ...des.permissions,
                                [key]: !val,
                              },
                            })
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors ${
                          val
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-400 line-through hover:bg-slate-200'
                        }`}
                        title="Click to toggle permission"
                      >
                        {key.replace(/([A-Z])/g, ' $1')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: NAME OF INSTITUTE */}
      {activeTab === 'branding' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Form: Edit Institute Details */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5 h-fit">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Edit Name of Institute</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Updates header bar, receipts, reports, login screen &amp; Google Sheets
                </p>
              </div>
              {brandingSaved && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl flex items-center gap-1.5 border border-emerald-200">
                  <CheckCircle className="w-4 h-4" />
                  <span>Saved to Database</span>
                </span>
              )}
            </div>

            <form onSubmit={handleSaveBranding} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Name of Institute *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter Name of School / Institute"
                  value={brandingForm.schoolName}
                  onChange={(e) => setBrandingForm({ ...brandingForm, schoolName: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 text-sm focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tagline / Motto</label>
                  <input
                    type="text"
                    placeholder="Tagline or motto (optional)"
                    value={brandingForm.tagline || ''}
                    onChange={(e) => setBrandingForm({ ...brandingForm, tagline: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Academic Session</label>
                  <input
                    type="text"
                    placeholder="e.g. 2026-2027"
                    value={brandingForm.currentAcademicSession || brandingForm.academicYear || '2026-2027'}
                    onChange={(e) =>
                      setBrandingForm({
                        ...brandingForm,
                        currentAcademicSession: e.target.value,
                        academicYear: e.target.value,
                      })
                    }
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Official Contact Phone</label>
                  <input
                    type="text"
                    placeholder="Phone number"
                    value={brandingForm.phone || ''}
                    onChange={(e) => setBrandingForm({ ...brandingForm, phone: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Official Email</label>
                  <input
                    type="email"
                    placeholder="Official email address"
                    value={brandingForm.email || ''}
                    onChange={(e) => setBrandingForm({ ...brandingForm, email: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Institute Address</label>
                <input
                  type="text"
                  placeholder="Full address of the institute"
                  value={brandingForm.address || ''}
                  onChange={(e) => setBrandingForm({ ...brandingForm, address: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4 text-amber-400" />
                  <span>Save Institute Details</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Card & Table: Currently Saved Institute Record */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between">
            <div>
              <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    Active Saved Record (School_Masters Tab)
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">
                    Current Institute Profile Record
                  </h3>
                </div>
                <PrintExportToolbar
                  title="Institute Master Profile"
                  filename="institute_master_profile"
                  schoolName={config.schoolName}
                  filteredData={[config]}
                  allData={[config]}
                  hasActiveFilters={false}
                  columns={[
                    { header: 'Name of Institute', accessor: (c) => c.schoolName },
                    { header: 'Tagline / Motto', accessor: (c) => c.tagline || '—' },
                    { header: 'Academic Session', accessor: (c) => c.currentAcademicSession || c.academicYear || '2026-2027' },
                    { header: 'Phone', accessor: (c) => c.phone || '—' },
                    { header: 'Email', accessor: (c) => c.email || '—' },
                    { header: 'Address', accessor: (c) => c.address || '—' },
                  ]}
                />
              </div>

              <div className="p-5 space-y-4">
                <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[11px] font-mono text-amber-400 uppercase font-bold">
                      Session {config.currentAcademicSession || config.academicYear || '2026-2027'}
                    </div>
                    <div className="text-lg font-black tracking-tight text-white">
                      {config.schoolName}
                    </div>
                    <div className="text-xs text-slate-300">
                      {config.tagline || '—'}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Active in ERP</span>
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                      <tr>
                        <th className="py-2.5 px-4">Field</th>
                        <th className="py-2.5 px-4">Saved Value in Database</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-slate-600">Name of Institute</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 text-sm">{config.schoolName}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-slate-600">Tagline / Motto</td>
                        <td className="py-2.5 px-4 text-slate-800">{config.tagline || '—'}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-slate-600">Academic Session</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                          {config.currentAcademicSession || config.academicYear || '2026-2027'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-slate-600">Official Phone</td>
                        <td className="py-2.5 px-4 font-mono text-slate-800">{config.phone || '—'}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-slate-600">Official Email</td>
                        <td className="py-2.5 px-4 font-mono text-slate-800">{config.email || '—'}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-slate-600">Institute Address</td>
                        <td className="py-2.5 px-4 text-slate-800">{config.address || '—'}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-semibold text-slate-600">Configured Campuses</td>
                        <td className="py-2.5 px-4 text-slate-800 font-semibold">
                          {campuses.length > 0
                            ? campuses.map((c) => `${c.name} (${c.code})`).join(', ')
                            : 'No campuses added yet'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: VEHICLE - DRIVER - HELPER LINK & DATE HISTORY */}
      {activeTab === 'vehicle_assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Form: Link / Change Driver & Helper for a Vehicle */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs h-fit space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Link Vehicle, Driver &amp; Helper</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Assign or change the Driver and Helper for a vehicle. Previous assignments are automatically archived with exact start and end dates.
              </p>
            </div>

            <form onSubmit={handleSaveAssignmentSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Vehicle *</label>
                <select
                  value={assignVehicleId}
                  onChange={(e) => {
                    const vId = e.target.value;
                    setAssignVehicleId(vId);
                    const vObj = vehicles.find(v => v.id === vId);
                    if (vObj?.assignedDriverId) setAssignDriverId(vObj.assignedDriverId);
                    if (vObj?.assignedHelperId) setAssignHelperId(vObj.assignedHelperId);
                  }}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold bg-slate-50"
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.registrationNumber} ({v.type}) — Current: {v.assignedDriverName || 'Unassigned'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assign Driver *</label>
                <select
                  value={assignDriverId}
                  onChange={(e) => setAssignDriverId(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold bg-white"
                >
                  <option value="">-- Select Driver --</option>
                  {driversList.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.empCode}) — DL: {d.licenseNumber || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assign Helper / Conductor</label>
                <select
                  value={assignHelperId}
                  onChange={(e) => setAssignHelperId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold bg-white"
                >
                  <option value="">-- No Helper / Optional --</option>
                  {helpersList.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.empCode}) — {h.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Effective From Date *</label>
                <input
                  type="date"
                  required
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-mono bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assignment / Handover Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Regular shift handover / relief duty"
                  value={assignRemarks}
                  onChange={(e) => setAssignRemarks(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Vehicle Assignment
                </button>
              </div>
            </form>
          </div>

          {/* Right Table: Complete Date-wise Driver & Helper Assignment Log */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Vehicle Driver &amp; Helper Date-wise Assignment Register
                </h3>
                <span className="text-[11px] text-slate-500">
                  Tracks who drove and assisted each vehicle across specific dates
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={assignFilterVehicleId}
                  onChange={(e) => setAssignFilterVehicleId(e.target.value)}
                  className="p-2 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50"
                >
                  <option value="all">All Vehicles ({vehicleAssignments.length})</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.registrationNumber}</option>
                  ))}
                </select>

                <PrintExportToolbar
                  title="Vehicle Driver & Helper Assignment History"
                  filename="vehicle_driver_helper_history"
                  schoolName={config.schoolName}
                  filteredData={
                    assignFilterVehicleId === 'all'
                      ? vehicleAssignments
                      : vehicleAssignments.filter(a => a.vehicleId === assignFilterVehicleId)
                  }
                  allData={vehicleAssignments}
                  hasActiveFilters={assignFilterVehicleId !== 'all'}
                  columns={[
                    { header: 'Vehicle Reg', accessor: (a) => a.vehicleNumber },
                    { header: 'Driver Name', accessor: (a) => a.driverName },
                    { header: 'Helper Name', accessor: (a) => a.helperName || '—' },
                    { header: 'From Date', accessor: (a) => a.startDate || a.fromDate || '—' },
                    { header: 'To Date', accessor: (a) => a.endDate || a.toDate || 'Present (Active)' },
                    { header: 'Status', accessor: (a) => a.status },
                    { header: 'Remarks', accessor: (a) => a.remarks || '—' },
                  ]}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-3 px-4">Vehicle</th>
                    <th className="py-3 px-3">Driver</th>
                    <th className="py-3 px-3">Helper / Conductor</th>
                    <th className="py-3 px-3">From Date</th>
                    <th className="py-3 px-3">To Date</th>
                    <th className="py-3 px-3">Tenure / Days Driven</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(assignFilterVehicleId === 'all'
                    ? vehicleAssignments
                    : vehicleAssignments.filter(a => a.vehicleId === assignFilterVehicleId)
                  ).map((rec) => {
                    const fromD = rec.startDate || rec.fromDate || todayStr;
                    const toD = rec.endDate || rec.toDate || todayStr;
                    const diffDays = Math.max(
                      1,
                      Math.round((new Date(toD).getTime() - new Date(fromD).getTime()) / (1000 * 60 * 60 * 24)) + 1
                    );
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{rec.vehicleNumber}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">{rec.driverName}</td>
                        <td className="py-3 px-3 text-slate-700">{rec.helperName || '—'}</td>
                        <td className="py-3 px-3 font-mono text-slate-700">{fromD}</td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          {rec.endDate || rec.toDate || <span className="text-emerald-700 font-bold">Present</span>}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-indigo-700">{diffDays} Days</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            rec.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{rec.remarks || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT ROUTE IN MASTERS (WITH BEFORE-FINALISATION OLD vs NEW MEMBERS COMPARISON) */}
      {isRouteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`bg-white rounded-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-6 max-h-[92vh] overflow-y-auto transition-all ${
              showRouteComparisonStep ? 'max-w-4xl' : 'max-w-lg'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <RouteIcon className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {showRouteComparisonStep
                      ? `Before Finalisation: Compare Old vs. New Route Members`
                      : editingRouteId
                      ? 'Edit Route & Covered Villages'
                      : 'Create Route'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {showRouteComparisonStep
                      ? 'Review members automatically attached or reassigned from the selected villages & stops before saving'
                      : 'Members linked to covered villages & stops are automatically attached to this route'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsRouteModalOpen(false);
                  setShowRouteComparisonStep(false);
                  setEditingRouteId(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {routeModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{routeModalError}</span>
              </div>
            )}

            {/* Route Code Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                Route Code
              </span>
              <div className="font-mono text-2xl font-black text-slate-900 mt-0.5 flex items-center justify-center gap-2">
                {editingRouteObj && editingRouteObj.code !== previewRouteCode ? (
                  <>
                    <span className="text-slate-400 line-through text-lg">{editingRouteObj.code}</span>
                    <ArrowRight className="w-4 h-4 text-amber-600" />
                    <span className="text-indigo-700">{previewRouteCode}</span>
                  </>
                ) : (
                  <span>{previewRouteCode}</span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Covered Villages ({selectedVillagesForModal.length}) &amp; Stops ({selectedStopsForModal.length}):{' '}
                <strong className="text-slate-800">
                  {selectedStopsForModal.length > 0
                    ? selectedStopsForModal.map(s => s.name).join(', ')
                    : selectedVillagesForModal.map(v => v.name).join(', ') || 'None selected'}
                </strong>
              </div>
            </div>

            {!showRouteComparisonStep ? (
              /* STEP 1: CONFIGURE ROUTE & SELECT COVERED VILLAGES & STOPS */
              <form onSubmit={handleProceedToRouteComparison} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Campus (Master)</label>
                    <select
                      value={routeCampus}
                      onChange={(e) => setRouteCampus(e.target.value as CampusId)}
                      className="w-full p-2 border border-slate-300 rounded-xl font-bold bg-white"
                    >
                      {campuses.map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Trip Number (Master)</label>
                    <select
                      value={routeTripNumber}
                      onChange={(e) => setRouteTripNumber(Number(e.target.value))}
                      className="w-full p-2 border border-slate-300 rounded-xl font-bold bg-white"
                    >
                      {trips.map(t => (
                        <option key={t.id} value={t.tripNumber}>Trip {t.tripNumber} ({t.description})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Select Vehicle from Master</label>
                  <select
                    value={routeVehicleId}
                    onChange={(e) => setRouteVehicleId(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold bg-white"
                  >
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.registrationNumber} — {v.type} ({v.ownership})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-slate-700 font-semibold">
                      Assign Covered Villages &amp; Stops to this Route{' '}
                      <span className="text-emerald-700 font-bold text-[10px]">(Select specific stops per village • Sorted A–Z)</span>
                    </label>
                    {selectedStopsForModal.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                        {selectedVillagesForModal.length} Village{selectedVillagesForModal.length === 1 ? '' : 's'} • {selectedStopsForModal.length} Stop{selectedStopsForModal.length === 1 ? '' : 's'} • {newRouteMembers.length} Member{newRouteMembers.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  {/* Always-visible Search Input with Search Icon */}
                  <div className="relative mb-2">
                    <Search className="w-4 h-4 text-indigo-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={routeVillageSearch}
                      onChange={(e) => setRouteVillageSearch(e.target.value)}
                      placeholder="Type first few alphabets to search village or stop (e.g. Bhikhpur)..."
                      className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs"
                    />
                    {routeVillageSearch && (
                      <button
                        type="button"
                        onClick={() => setRouteVillageSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-2 bg-slate-50">
                    {sortedVillages.length === 0 ? (
                      <p className="text-slate-400 text-xs py-4 text-center">No villages created yet. Add villages in Villages Master.</p>
                    ) : (
                      (() => {
                        const q = routeVillageSearch.trim().toLowerCase();
                        const matchingVillages = !q
                          ? sortedVillages
                          : [
                              ...sortedVillages.filter(v => v.name.toLowerCase().startsWith(q)),
                              ...sortedVillages.filter(
                                v =>
                                  !v.name.toLowerCase().startsWith(q) &&
                                  (v.name.toLowerCase().includes(q) ||
                                    (v.stops || []).some(st => st.name.toLowerCase().includes(q)))
                              ),
                            ];

                        if (matchingVillages.length === 0) {
                          return (
                            <p className="text-slate-400 text-xs py-4 text-center">
                              No village or stop found matching &ldquo;{routeVillageSearch}&rdquo;.
                            </p>
                          );
                        }

                        return matchingVillages.map(v => {
                          const vilStops = v.stops || [];
                          const checkedStopsInVil = vilStops.filter(st => selectedStopIds.includes(st.id));
                          const isVillageChecked =
                            checkedStopsInVil.length > 0 ||
                            (vilStops.length === 0 && selectedVillageIds.includes(v.id));
                          const areAllStopsInVilChecked =
                            vilStops.length > 0 && checkedStopsInVil.length === vilStops.length;

                          return (
                            <div
                              key={v.id}
                              className={`p-2.5 rounded-xl border transition-colors ${
                                isVillageChecked
                                  ? 'bg-white border-indigo-200 shadow-2xs'
                                  : 'bg-white/60 hover:bg-white border-slate-200/70'
                              }`}
                            >
                              {/* Village Header Row */}
                              <label className="flex items-center justify-between gap-2 cursor-pointer">
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={isVillageChecked}
                                    onChange={() => {
                                      const vilStopIds = vilStops.map(st => st.id);
                                      if (areAllStopsInVilChecked || (vilStops.length === 0 && isVillageChecked)) {
                                        // Uncheck village and all its stops
                                        setSelectedVillageIds(prev => prev.filter(id => id !== v.id));
                                        setSelectedStopIds(prev => prev.filter(id => !vilStopIds.includes(id)));
                                      } else {
                                        // Check village and all its stops
                                        setSelectedVillageIds(prev =>
                                          prev.includes(v.id) ? prev : [...prev, v.id]
                                        );
                                        setSelectedStopIds(prev =>
                                          Array.from(new Set([...prev, ...vilStopIds]))
                                        );
                                      }
                                    }}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="font-bold text-slate-900">{v.name}</span>
                                  <span className="text-slate-500 text-[10px] font-semibold">
                                    ({checkedStopsInVil.length}/{vilStops.length}{' '}
                                    {vilStops.length === 1 ? 'Stop' : 'Stops'} selected)
                                  </span>
                                </div>
                                <span className="text-slate-400 text-[10px] font-mono">
                                  {v.distanceKm} km
                                </span>
                              </label>

                              {/* Individual Stops inside this Village */}
                              {vilStops.length > 0 && (
                                <div className="mt-2 pl-6 grid grid-cols-1 sm:grid-cols-2 gap-1.5 border-t border-slate-100 pt-2">
                                  {vilStops.map(st => {
                                    const isStopChecked = selectedStopIds.includes(st.id);
                                    const stopMembersCount = activeTransportMembers.filter(
                                      s =>
                                        s.pickupDropStopId === st.id ||
                                        (!!s.pickupDropStopName &&
                                          s.pickupDropStopName.trim().toLowerCase() === st.name.trim().toLowerCase() &&
                                          (!s.villageName || s.villageName.trim().toLowerCase() === v.name.trim().toLowerCase()))
                                    ).length;

                                    return (
                                      <label
                                        key={st.id}
                                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                                          isStopChecked
                                            ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 font-semibold'
                                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <input
                                            type="checkbox"
                                            checked={isStopChecked}
                                            onChange={e => {
                                              if (e.target.checked) {
                                                const nextStops = Array.from(new Set([...selectedStopIds, st.id]));
                                                setSelectedStopIds(nextStops);
                                                if (!selectedVillageIds.includes(v.id)) {
                                                  setSelectedVillageIds([...selectedVillageIds, v.id]);
                                                }
                                              } else {
                                                const nextStops = selectedStopIds.filter(id => id !== st.id);
                                                setSelectedStopIds(nextStops);
                                                const anyRemainingInVil = vilStops.some(
                                                  other => other.id !== st.id && nextStops.includes(other.id)
                                                );
                                                if (!anyRemainingInVil) {
                                                  setSelectedVillageIds(selectedVillageIds.filter(id => id !== v.id));
                                                }
                                              }
                                            }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
                                          />
                                          <span className="truncate">{st.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className="font-mono text-[10px] text-emerald-700 font-bold">
                                            ₹{st.fee}
                                          </span>
                                          {stopMembersCount > 0 && (
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                              {stopMembersCount} {stopMembersCount === 1 ? 'Member' : 'Members'}
                                            </span>
                                          )}
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                </div>

                {/* Live Impact Preview Strip */}
                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="font-semibold text-slate-700">
                    Old Route Members: <strong className="text-slate-900">{oldRouteMembers.length}</strong> → New Route Members: <strong className="text-indigo-700">{newRouteMembers.length}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      +{addedRouteMembers.length} Newly Attached
                    </span>
                    {removedRouteMembers.length > 0 && (
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                        -{removedRouteMembers.length} Removed
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRouteModalOpen(false);
                      setShowRouteComparisonStep(false);
                      setEditingRouteId(null);
                    }}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>Compare Old vs. New Members</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            ) : (
              /* STEP 2: BEFORE FINALISATION — OLD vs NEW ROUTE MEMBERS COMPARISON */
              <div className="space-y-4 text-xs">
                {/* Summary KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">
                      Old Members (Before)
                    </span>
                    <span className="text-xl font-black text-slate-900 mt-0.5 block">
                      {oldRouteMembers.length}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200">
                    <span className="text-[10px] font-bold uppercase text-indigo-700 block">
                      New Members (After)
                    </span>
                    <span className="text-xl font-black text-indigo-900 mt-0.5 block">
                      {newRouteMembers.length}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                      Newly Attached (+)
                    </span>
                    <span className="text-xl font-black text-emerald-800 mt-0.5 block">
                      +{addedRouteMembers.length}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                    <span className="text-[10px] font-bold uppercase text-rose-700 block">
                      Detached / Moved (-)
                    </span>
                    <span className="text-xl font-black text-rose-800 mt-0.5 block">
                      -{removedRouteMembers.length}
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Comparison: Old Members vs New Members */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* LEFT COLUMN: OLD MEMBERS OF THIS ROUTE */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">
                          Old Route Members ({oldRouteMembers.length})
                        </h4>
                        <p className="text-[10px] text-slate-500">
                          {editingRouteObj
                            ? `Previously attached to ${editingRouteObj.code}`
                            : 'New Route (No previous members)'}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono font-bold text-[10px]">
                        Before Change
                      </span>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                      {oldRouteMembers.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200">
                          No members were previously attached to this route.
                        </div>
                      ) : (
                        oldRouteMembers.map((m) => {
                          const isRetained = newMemberIdSet.has(m.id);
                          const fallbackRt = !isRetained ? getFallbackRouteForRemovedMember(m) : undefined;
                          return (
                            <div
                              key={m.id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                                isRetained
                                  ? 'bg-white border-slate-200'
                                  : 'bg-rose-50/80 border-rose-200'
                              }`}
                            >
                              <div>
                                <div className="font-bold text-slate-900">
                                  {m.name}{' '}
                                  <span className="font-mono text-[10px] text-slate-500">
                                    ({m.admissionNo})
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {m.class}-{m.section} • <strong>{m.villageName}</strong> ({m.pickupDropStopName})
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {isRetained ? (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                                    Retained
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[10px] block">
                                    {fallbackRt ? `Moved → ${fallbackRt.code}` : 'Detached (Unassigned)'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN: NEW MEMBERS OF THIS ROUTE */}
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-indigo-200/80 pb-2">
                      <div>
                        <h4 className="font-bold text-indigo-950 text-xs">
                          New Route Members ({newRouteMembers.length})
                        </h4>
                        <p className="text-[10px] text-indigo-700">
                          Will be attached to <strong>{previewRouteCode}</strong> from selected villages &amp; stops
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-mono font-bold text-[10px]">
                        After Change
                      </span>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                      {newRouteMembers.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200">
                          No existing members found in the selected villages/stops yet.
                        </div>
                      ) : (
                        newRouteMembers.map((m) => {
                          const isNewlyAdded = !oldMemberIdSet.has(m.id);
                          return (
                            <div
                              key={m.id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                                isNewlyAdded
                                  ? 'bg-emerald-50/90 border-emerald-300 shadow-2xs'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div>
                                <div className="font-bold text-slate-900">
                                  {m.name}{' '}
                                  <span className="font-mono text-[10px] text-slate-500">
                                    ({m.admissionNo})
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-600">
                                  {m.class}-{m.section} • <strong>{m.villageName}</strong> ({m.pickupDropStopName})
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {isNewlyAdded ? (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-[10px] block">
                                    + NEWLY ATTACHED
                                    {m.routeCode && m.routeCode !== previewRouteCode
                                      ? ` (from ${m.routeCode})`
                                      : ''}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                                    Continuing ({previewRouteCode})
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Confirmation Footer */}
                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRouteComparisonStep(false)}
                    className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl text-slate-700 font-semibold cursor-pointer"
                  >
                    ← Back to Edit Villages / Route
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRouteModalOpen(false);
                        setShowRouteComparisonStep(false);
                        setEditingRouteId(null);
                      }}
                      className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmFinalizeRouteSave}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>
                        Confirm &amp; Finalize Route ({newRouteMembers.length} {newRouteMembers.length === 1 ? 'Member' : 'Members'})
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT VEHICLE */}
      {isVehicleModalOpen && editingVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingVehicle.id ? 'Edit Vehicle' : 'Add Vehicle to Master'}
                </h3>
              </div>
              <button onClick={() => setIsVehicleModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {vehicleModalError && (
              <div className="bg-rose-50 border border-rose-300 text-rose-900 px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-2 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{vehicleModalError}</span>
                </div>
                <button type="button" onClick={() => setVehicleModalError(null)} className="text-rose-500 hover:text-rose-800 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <form onSubmit={handleSaveVehicleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Registration Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UP 70 BT 7175"
                    value={editingVehicle.registrationNumber || ''}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, registrationNumber: e.target.value.toUpperCase() })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Vehicle Type</label>
                  <select
                    value={editingVehicle.type || 'Bus'}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, type: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Bus">Bus</option>
                    <option value="Mini Bus">Mini Bus</option>
                    <option value="Van">Van</option>
                    <option value="Winger">Winger</option>
                    <option value="Cruiser">Cruiser</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Ownership Type *</label>
                  <select
                    value={editingVehicle.ownership || 'School-Owned'}
                    onChange={(e) => {
                      const nextOwn = e.target.value as 'School-Owned' | 'Rented';
                      setVehicleModalError(null);
                      setEditingVehicle({
                        ...editingVehicle,
                        ownership: nextOwn,
                        ownerName: nextOwn === 'School-Owned' ? config.schoolName : (editingVehicle.ownerName === config.schoolName ? '' : editingVehicle.ownerName),
                      });
                    }}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white font-bold"
                  >
                    <option value="School-Owned">School-Owned</option>
                    <option value="Rented">Rented / Hired</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Name of Owner {editingVehicle.ownership === 'Rented' && <span className="text-rose-600">*</span>}
                  </label>
                  <input
                    type="text"
                    required={editingVehicle.ownership === 'Rented'}
                    placeholder={editingVehicle.ownership === 'Rented' ? 'Full Name of Vehicle Owner' : 'School Name'}
                    value={editingVehicle.ownerName || ''}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, ownerName: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Condition</label>
                  <select
                    value={editingVehicle.condition || 'Good'}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, condition: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Needs Work">Needs Work</option>
                    <option value="Under Maintenance">Under Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Seating Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={editingVehicle.capacity || 40}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, capacity: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              {/* =====================================================================
                  RENTED VEHICLE COMPULSORY KYC & STANDARD INDIAN SCHOOL RENT AGREEMENT
                 ===================================================================== */}
              {editingVehicle.ownership === 'Rented' && (
                <div className="bg-indigo-50/50 border-2 border-indigo-200 rounded-2xl p-4 space-y-4">
                  {/* Standard Indian School Vehicle Rent Agreement Draft Banner */}
                  <div className="bg-white border border-indigo-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-indigo-950 font-bold text-xs">
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Standard Indian School Vehicle Rent Agreement (Draft)</span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Pre-filled with Indian School Bus Safety Guidelines (Supreme Court / CBSE / RTO norms). Print, sign with owner &amp; witnesses, and upload below.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handlePrintStandardRentAgreement}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Draft &amp; Print Rent Agreement</span>
                    </button>
                  </div>

                  {/* Owner KYC Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Owner Aadhaar No. <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="12-digit Aadhaar Number"
                        value={editingVehicle.ownerAadhaarNo || ''}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, ownerAadhaarNo: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-xl bg-white font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Owner PAN No. <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ABCDE1234F"
                        value={editingVehicle.ownerPanNo || ''}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, ownerPanNo: e.target.value.toUpperCase() })}
                        className="w-full p-2 border border-slate-300 rounded-xl bg-white font-mono font-bold uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Owner Mobile No.</label>
                      <input
                        type="text"
                        placeholder="10-digit Mobile"
                        value={editingVehicle.ownerMobile || ''}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, ownerMobile: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-xl bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Monthly Rent (₹)</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="e.g. 35000"
                        value={editingVehicle.monthlyRentAmount || ''}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, monthlyRentAmount: Number(e.target.value) })}
                        className="w-full p-2 border border-slate-300 rounded-xl bg-white font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Agreement Start Date</label>
                      <input
                        type="date"
                        value={editingVehicle.agreementStartDate || todayStr}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, agreementStartDate: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-xl bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Agreement Valid Upto</label>
                      <input
                        type="date"
                        value={editingVehicle.agreementEndDate || '2027-03-31'}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, agreementEndDate: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-xl bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Owner Full Address</label>
                    <input
                      type="text"
                      placeholder="Complete residential / registered address of vehicle owner for agreement"
                      value={editingVehicle.ownerAddress || ''}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, ownerAddress: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                    />
                  </div>

                  {/* 3 Compulsory Document Uploads */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider">
                      Compulsory Document Uploads (Required for Rented Vehicle *)
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* 1. Signed Rent Agreement */}
                      <div className={`p-3 rounded-xl border ${editingVehicle.rentAgreementAttachment ? 'bg-emerald-50/70 border-emerald-300' : 'bg-white border-rose-300'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-800 text-[11px]">
                            1. Rent Agreement <span className="text-rose-600">*</span>
                          </span>
                          {editingVehicle.rentAgreementAttachment ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <span className="text-[9px] font-bold text-rose-600 uppercase">Required</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mb-2">
                          {editingVehicle.rentAgreementFileName || 'Signed agreement copy'}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <label className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold cursor-pointer flex items-center justify-center gap-1">
                            <Upload className="w-3 h-3" />
                            <span>{editingVehicle.rentAgreementAttachment ? 'Replace' : 'Upload'}</span>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleRentedDocUpload('rentAgreementAttachment', 'rentAgreementFileName', e)}
                              className="hidden"
                            />
                          </label>
                          {editingVehicle.rentAgreementAttachment && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewVehicleDoc({
                                  title: 'Signed Rent Agreement',
                                  url: editingVehicle.rentAgreementAttachment!,
                                })
                              }
                              className="p-1.5 bg-white border border-slate-200 rounded-lg text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                              title="View Uploaded Rent Agreement"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 2. Owner Aadhaar Card */}
                      <div className={`p-3 rounded-xl border ${editingVehicle.ownerAadhaarAttachment ? 'bg-emerald-50/70 border-emerald-300' : 'bg-white border-rose-300'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-800 text-[11px]">
                            2. Owner Aadhaar <span className="text-rose-600">*</span>
                          </span>
                          {editingVehicle.ownerAadhaarAttachment ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <span className="text-[9px] font-bold text-rose-600 uppercase">Required</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mb-2">
                          {editingVehicle.ownerAadhaarFileName || 'Owner Aadhaar card'}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <label className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold cursor-pointer flex items-center justify-center gap-1">
                            <Upload className="w-3 h-3" />
                            <span>{editingVehicle.ownerAadhaarAttachment ? 'Replace' : 'Upload'}</span>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleRentedDocUpload('ownerAadhaarAttachment', 'ownerAadhaarFileName', e)}
                              className="hidden"
                            />
                          </label>
                          {editingVehicle.ownerAadhaarAttachment && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewVehicleDoc({
                                  title: 'Owner Aadhaar Card',
                                  url: editingVehicle.ownerAadhaarAttachment!,
                                })
                              }
                              className="p-1.5 bg-white border border-slate-200 rounded-lg text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                              title="View Uploaded Aadhaar"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 3. Owner PAN Card */}
                      <div className={`p-3 rounded-xl border ${editingVehicle.ownerPanAttachment ? 'bg-emerald-50/70 border-emerald-300' : 'bg-white border-rose-300'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-800 text-[11px]">
                            3. Owner PAN Card <span className="text-rose-600">*</span>
                          </span>
                          {editingVehicle.ownerPanAttachment ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <span className="text-[9px] font-bold text-rose-600 uppercase">Required</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mb-2">
                          {editingVehicle.ownerPanFileName || 'Owner PAN card'}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <label className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold cursor-pointer flex items-center justify-center gap-1">
                            <Upload className="w-3 h-3" />
                            <span>{editingVehicle.ownerPanAttachment ? 'Replace' : 'Upload'}</span>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleRentedDocUpload('ownerPanAttachment', 'ownerPanFileName', e)}
                              className="hidden"
                            />
                          </label>
                          {editingVehicle.ownerPanAttachment && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewVehicleDoc({
                                  title: 'Owner PAN Card',
                                  url: editingVehicle.ownerPanAttachment!,
                                })
                              }
                              className="p-1.5 bg-white border border-slate-200 rounded-lg text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                              title="View Uploaded PAN"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Reg. Validity</label>
                  <input
                    type="date"
                    value={editingVehicle.registrationValidity || '2030-12-31'}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, registrationValidity: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tax Paid Upto</label>
                  <input
                    type="date"
                    value={editingVehicle.taxPaidUpto || '2027-03-31'}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, taxPaidUpto: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Fitness Validity</label>
                  <input
                    type="date"
                    value={editingVehicle.fitnessUpto || '2027-06-30'}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, fitnessUpto: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Insurance Validity</label>
                  <input
                    type="date"
                    value={editingVehicle.insuranceUpto || '2027-08-31'}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, insuranceUpto: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Pollution Validity</label>
                  <input
                    type="date"
                    value={editingVehicle.pollutionUpto || '2026-12-31'}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, pollutionUpto: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Initial / Current Odo (km)</label>
                  <input
                    type="number"
                    value={editingVehicle.currentOdometer || 0}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, currentOdometer: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Threshold Mileage (km/L) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    required
                    placeholder="e.g. 6.0"
                    value={editingVehicle.expectedMileageKmPerL ?? editingVehicle.baselineMileageKmPerLitre ?? 6.0}
                    onChange={(e) =>
                      setEditingVehicle({
                        ...editingVehicle,
                        expectedMileageKmPerL: Number(e.target.value),
                        baselineMileageKmPerLitre: Number(e.target.value),
                      })
                    }
                    className="w-full p-2 border border-indigo-200 bg-indigo-50/40 rounded-xl font-mono font-bold text-indigo-900"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW UPLOADED RENTED VEHICLE KYC DOCUMENT */}
      {previewVehicleDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">{previewVehicleDoc.title}</h3>
              <button
                type="button"
                onClick={() => setPreviewVehicleDoc(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-center max-h-[75vh] overflow-auto">
              {previewVehicleDoc.url.startsWith('data:application/pdf') ? (
                <iframe src={previewVehicleDoc.url} title={previewVehicleDoc.title} className="w-full h-96 rounded-lg" />
              ) : (
                <img src={previewVehicleDoc.url} alt={previewVehicleDoc.title} className="max-h-96 object-contain rounded-lg" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT VILLAGE & MULTIPLE STOPS */}
      {isVillageModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingVillageId ? 'Edit Village & Transport Stops' : 'Add Village to Master'}
                </h3>
              </div>
              <button onClick={() => setIsVillageModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVillageSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Village Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rampur, Kalyanpur"
                    value={villageName}
                    onChange={(e) => setVillageName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Distance from School (km)</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={villageDistance}
                    onChange={(e) => setVillageDistance(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              {/* Dynamic Transport Stops List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    Transport Stops in this Village
                  </label>
                  <button
                    type="button"
                    onClick={handleAddStopToVillage}
                    className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold rounded-lg text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Stop</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
                  {villageStops.map((st, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-400 block font-semibold">Stop Name</label>
                        <input
                          type="text"
                          required
                          value={st.name}
                          onChange={(e) => {
                            const newStops = [...villageStops];
                            newStops[idx].name = e.target.value;
                            setVillageStops(newStops);
                          }}
                          placeholder="e.g. Main Crossing, Temple Gate"
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-semibold"
                        />
                      </div>

                      <div className="w-24">
                        <label className="text-[10px] text-slate-400 block font-semibold">Monthly Fee (₹)</label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={st.fee}
                          onChange={(e) => {
                            const newStops = [...villageStops];
                            newStops[idx].fee = Number(e.target.value);
                            setVillageStops(newStops);
                          }}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold text-emerald-700"
                        />
                      </div>

                      <div className="w-20">
                        <label className="text-[10px] text-slate-400 block font-semibold">Dist (km)</label>
                        <input
                          type="number"
                          value={st.distanceKm}
                          onChange={(e) => {
                            const newStops = [...villageStops];
                            newStops[idx].distanceKm = Number(e.target.value);
                            setVillageStops(newStops);
                          }}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveStopFromVillage(idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg mt-3 cursor-pointer"
                        title="Delete Stop"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVillageModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Village &amp; Stops
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

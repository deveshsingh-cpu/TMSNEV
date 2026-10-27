import React, { useState, useEffect } from 'react';
import {
  Search, Plus, AlertTriangle, X, Eye, Trash2, RotateCcw,
  Camera, Edit2, Printer, FileText, Upload,
  MapPin, Award, PhoneCall, Gavel, IndianRupee, ShieldAlert, Check, Ban
} from 'lucide-react';
import {
  StudentMember, CampusId, Village, Route, CampusMaster, MemberTypeMaster,
  FeeInvoice, FeeReceipt, TripAttendanceRecord, DocumentAttachment,
  FeeFollowUpRecord, DisciplineRecord, Vehicle, UserRole
} from '../../types/index.js';
import { PrintExportToolbar, openHtmlPrintPreview, FilterPopover } from '../../utils/exportPrint.js';
import { readFileCompressed } from '../../utils/fileCompressor.js';

interface MembersViewProps {
  schoolName?: string;
  isAdmin?: boolean;
  currentRole?: UserRole;
  students: StudentMember[];
  villages: Village[];
  routes: Route[];
  vehicles?: Vehicle[];
  campuses: CampusMaster[];
  memberTypes: MemberTypeMaster[];
  classes: string[];
  sections: string[];
  invoices?: FeeInvoice[];
  receipts?: FeeReceipt[];
  attendanceRecords?: TripAttendanceRecord[];
  feeFollowUps?: FeeFollowUpRecord[];
  disciplineRecords?: DisciplineRecord[];
  initialStatusFilter?: string;
  externalOpenMemberId?: string | null;
  onClearExternalMemberId?: () => void;
  onSaveStudent: (student: Partial<StudentMember>) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  onReactivateStudent: (id: string, reason: string) => Promise<void>;
  onGrantPermissionLetter?: (
    id: string,
    payload: {
      allowedUntilDate: string;
      letterAttachment: string;
      letterFileName?: string;
      approvedBy: string;
      reason: string;
    }
  ) => Promise<void>;
  onSuspendStudent?: (id: string, reason: string) => Promise<void>;
  onReviewSuspensionRequest?: (id: string, action: 'Approve' | 'Reject', reason?: string) => Promise<void>;
  onChangeMemberStatus?: (id: string, status: StudentMember['transportStatus'], reason?: string) => Promise<void>;
  onAddFeeFollowUp?: (data: Omit<FeeFollowUpRecord, 'id'>) => Promise<void>;
  onDeleteFeeFollowUp?: (id: string) => Promise<void>;
  onAddDisciplineRecord?: (data: Omit<DisciplineRecord, 'id'>) => Promise<void>;
  onDeleteDisciplineRecord?: (id: string) => Promise<void>;
  onQuickCollectFeeForMember?: (memberId: string) => void;
  onNavigateToMasters?: () => void;
}

type ProfileTabKey =
  | 'general'
  | 'fees'
  | 'fee_structure'
  | 'followups'
  | 'discipline'
  | 'attendance'
  | 'documents'
  | 'special';

export const MembersView: React.FC<MembersViewProps> = ({
  schoolName = 'Institute Transport ERP',
  isAdmin = true,
  currentRole = 'Admin',
  students = [],
  villages = [],
  routes = [],
  vehicles = [],
  campuses = [],
  memberTypes = [],
  classes = [],
  sections = [],
  invoices = [],
  receipts = [],
  attendanceRecords = [],
  feeFollowUps = [],
  disciplineRecords = [],
  initialStatusFilter = 'all',
  externalOpenMemberId,
  onClearExternalMemberId,
  onSaveStudent,
  onDeleteStudent,
  onReactivateStudent,
  onGrantPermissionLetter,
  onSuspendStudent,
  onReviewSuspensionRequest,
  onChangeMemberStatus,
  onAddFeeFollowUp,
  onDeleteFeeFollowUp,
  onAddDisciplineRecord,
  onDeleteDisciplineRecord,
  onQuickCollectFeeForMember,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const canInitiateSuspension = currentRole === 'Admin' || currentRole === 'Transport Coordinator';

  // Mode: 'directory' vs 'suspended' vs 'discipline'
  const [subModule, setSubModule] = useState<'directory' | 'suspended' | 'discipline'>(
    initialStatusFilter === 'discipline'
      ? 'discipline'
      : initialStatusFilter === 'Suspended'
      ? 'suspended'
      : 'directory'
  );

  // Directory Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [suspendedSubFilter, setSuspendedSubFilter] = useState<
    'all' | 'suspended_only' | 'pending_approval' | 'with_permission'
  >('all');
  const [campusFilter, setCampusFilter] = useState<string>('all');
  const [memberTypeFilter, setMemberTypeFilter] = useState<string>('all');
  const [routeFilter, setRouteFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [villageFilter, setVillageFilter] = useState<string>('all');
  const [stopFilter, setStopFilter] = useState<string>('all');

  // Dedicated Suspend / Request Suspension Modal (enforces valid reason & role rules)
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendTargetMemberId, setSuspendTargetMemberId] = useState<string>('');
  const [suspendModalReason, setSuspendModalReason] = useState<string>('');
  const [suspendModalError, setSuspendModalError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStatusFilter === 'discipline') {
      setSubModule('discipline');
    } else if (initialStatusFilter === 'Suspended') {
      setSubModule('suspended');
    } else {
      setSubModule('directory');
      setStatusFilter('all');
    }
  }, [initialStatusFilter]);

  // Selected Member Profile Modal state
  const [profileMemberId, setProfileMemberId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<ProfileTabKey>('general');
  const [attendancePeriod, setAttendancePeriod] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Annual'>('Monthly');

  useEffect(() => {
    if (externalOpenMemberId) {
      setProfileMemberId(externalOpenMemberId);
      setProfileTab('general');
      if (onClearExternalMemberId) onClearExternalMemberId();
    }
  }, [externalOpenMemberId, onClearExternalMemberId]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Receipt Preview & Print Modal
  const [previewReceipt, setPreviewReceipt] = useState<FeeReceipt | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{ title: string; url: string } | null>(null);

  // Document Upload inside Profile
  const [newDocType, setNewDocType] = useState<DocumentAttachment['type']>('School ID Card');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Special Tab: Permission Letter & Suspension form state
  const [permUntilDate, setPermUntilDate] = useState<string>('');
  const [permReason, setPermReason] = useState<string>('');
  const [permApprovedBy, setPermApprovedBy] = useState<string>('Admin (Principal Office)');
  const [permFileData, setPermFileData] = useState<string>('');
  const [permFileName, setPermFileName] = useState<string>('');
  const [suspendReasonInput, setSuspendReasonInput] = useState<string>('');

  // Fee Follow-Up Form inside Profile
  const [fuDate, setFuDate] = useState<string>(todayStr);
  const [fuPersonTalked, setFuPersonTalked] = useState<string>('Father');
  const [fuResponse, setFuResponse] = useState<string>('');
  const [fuPromisedDate, setFuPromisedDate] = useState<string>('');

  // Discipline Record Form (both in Profile and in Discipline Sub-Module)
  const [showAddDisciplineModal, setShowAddDisciplineModal] = useState(false);
  const [discMemberId, setDiscMemberId] = useState<string>(students[0]?.id || '');
  const [discDate, setDiscDate] = useState<string>(todayStr);
  const [discConcern, setDiscConcern] = useState<string>('');
  const [discActionTaken, setDiscActionTaken] = useState<string>('');

  // Combined Discipline Page Filters
  const [discClassFilter, setDiscClassFilter] = useState<string>('all');
  const [discRouteFilter, setDiscRouteFilter] = useState<string>('all');
  const [discVehicleFilter, setDiscVehicleFilter] = useState<string>('all');
  const [discInstanceMin, setDiscInstanceMin] = useState<string>('all');
  const [discSearch, setDiscSearch] = useState<string>('');

  // Form State for Add/Edit Member
  const [admissionNo, setAdmissionNo] = useState('');
  const [name, setName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string>('');
  const [memberType, setMemberType] = useState<string>('');
  const [studentClass, setStudentClass] = useState('');
  const [section, setSection] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | 'Other'>('M');
  const [campus, setCampus] = useState<CampusId>('');
  const [fatherName, setFatherName] = useState('');
  const [mobile, setMobile] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [address, setAddress] = useState('');
  const [selectedVillageId, setSelectedVillageId] = useState('');
  const [memberVillageSearch, setMemberVillageSearch] = useState('');
  const [customVillageName, setCustomVillageName] = useState('');
  const [selectedStopId, setSelectedStopId] = useState('');
  const [customStopName, setCustomStopName] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [monthlyFee, setMonthlyFee] = useState<number>(700);
  const [concessionAmount, setConcessionAmount] = useState<number>(0);
  const [schoolIdDoc, setSchoolIdDoc] = useState<DocumentAttachment | null>(null);

  const [memberStatusInput, setMemberStatusInput] = useState<StudentMember['transportStatus']>('Active');
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [kpiCardFilter, setKpiCardFilter] = useState<'all' | 'Active' | 'Suspended' | 'Left' | 'dues' | 'permission'>('all');

  // Standalone Revoke Suspension / Grant Permission Modal (before or after suspension)
  const [showRevokePermModal, setShowRevokePermModal] = useState(false);
  const [revokePermTargetId, setRevokePermTargetId] = useState<string>('');
  const [revokePermUntilDate, setRevokePermUntilDate] = useState<string>('');
  const [revokePermReason, setRevokePermReason] = useState<string>('');
  const [revokePermApprovedBy, setRevokePermApprovedBy] = useState<string>('Admin (Principal Office)');
  const [revokePermFileData, setRevokePermFileData] = useState<string>('');
  const [revokePermFileName, setRevokePermFileName] = useState<string>('');
  const [revokePermError, setRevokePermError] = useState<string | null>(null);

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

  const selectedVillage = sortedVillages.find(v => v.id === selectedVillageId);
  const availableStops = selectedVillage?.stops || [];
  const selectedStopObj = availableStops.find(s => s.id === selectedStopId);

  const doesRouteMatchVillageAndStop = (r: Route, vilId: string, stpId?: string): { explicitStop: boolean; villageFallback: boolean } => {
    const vil = sortedVillages.find(v => v.id === vilId);
    const stp = vil?.stops?.find(s => s.id === stpId);
    const rStopIds = new Set(r.stopIds || []);
    const rStopNames = new Set((r.stopNames || []).map(sn => String(sn || '').trim().toLowerCase()));
    const hasExplicitStops = rStopIds.size > 0 || rStopNames.size > 0;

    if (stpId && rStopIds.has(stpId)) return { explicitStop: true, villageFallback: false };
    if (stp && rStopNames.has(stp.name.trim().toLowerCase())) return { explicitStop: true, villageFallback: false };

    const coversVillage =
      (r.villageIds || []).includes(vilId) ||
      Boolean(vil && (r.villageNames || []).some(vn => vn.trim().toLowerCase() === vil.name.trim().toLowerCase()));
    if (!coversVillage) return { explicitStop: false, villageFallback: false };

    if (stpId && hasExplicitStops && vil) {
      const routeHasSpecificStopsInVil = (vil.stops || []).some(
        s => rStopIds.has(s.id) || rStopNames.has(s.name.trim().toLowerCase())
      );
      if (routeHasSpecificStopsInVil) {
        return { explicitStop: false, villageFallback: false };
      }
    }
    return { explicitStop: false, villageFallback: true };
  };

  const availableRoutes = selectedVillageId
    ? (() => {
        const stopSpecific = selectedStopId
          ? routes.filter(r => doesRouteMatchVillageAndStop(r, selectedVillageId, selectedStopId).explicitStop)
          : [];
        if (stopSpecific.length > 0) return stopSpecific;
        return routes.filter(r => {
          const m = doesRouteMatchVillageAndStop(r, selectedVillageId, selectedStopId);
          return m.explicitStop || m.villageFallback;
        });
      })()
    : routes;

  // Village-dependent stops for Directory Filter
  const activeFilterVillageObj = sortedVillages.find(
    v => v.id === villageFilter || v.name === villageFilter
  );
  const filterVillageStops = activeFilterVillageObj?.stops || [];

  const isFiltered =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    kpiCardFilter !== 'all' ||
    campusFilter !== 'all' ||
    memberTypeFilter !== 'all' ||
    routeFilter !== 'all' ||
    classFilter !== 'all' ||
    villageFilter !== 'all' ||
    stopFilter !== 'all';

  const filteredStudents = students.filter(s => {
    if (statusFilter !== 'all' && s.transportStatus !== statusFilter) return false;
    if (kpiCardFilter === 'Active' && s.transportStatus !== 'Active') return false;
    if (kpiCardFilter === 'Suspended' && s.transportStatus !== 'Suspended') return false;
    if (kpiCardFilter === 'Left' && s.transportStatus !== 'Left') return false;
    if (kpiCardFilter === 'dues' && (s.balanceDue <= 0 || s.transportStatus === 'Left')) return false;
    if (kpiCardFilter === 'permission' && !s.activePermissionLetter) return false;
    if (campusFilter !== 'all' && s.campus !== campusFilter) return false;
    if (memberTypeFilter !== 'all' && s.memberType !== memberTypeFilter) return false;
    if (routeFilter !== 'all' && s.routeId !== routeFilter && s.routeCode !== routeFilter) return false;
    if (classFilter !== 'all' && s.class !== classFilter) return false;
    if (villageFilter !== 'all' && s.villageId !== villageFilter && s.villageName !== villageFilter) return false;
    if (
      stopFilter !== 'all' &&
      s.pickupDropStopId !== stopFilter &&
      s.pickupDropStopName !== stopFilter &&
      s.morningStopName !== stopFilter
    ) {
      return false;
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        s.villageName.toLowerCase().includes(q) ||
        s.pickupDropStopName.toLowerCase().includes(q) ||
        s.routeCode.toLowerCase().includes(q) ||
        s.mobile.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Suspended & Permissions base list: ONLY members who are Suspended OR have a Pending Suspension Approval request, excluding anyone granted a permission letter
  const suspendedAndPendingMembers = students.filter(
    s =>
      (s.transportStatus === 'Suspended' ||
        s.pendingSuspensionRequest?.status === 'Pending Approval') &&
      !s.activePermissionLetter
  );

  const filteredSuspendedMembers = suspendedAndPendingMembers.filter(s => {
    if (suspendedSubFilter === 'suspended_only' && s.transportStatus !== 'Suspended') return false;
    if (
      suspendedSubFilter === 'pending_approval' &&
      s.pendingSuspensionRequest?.status !== 'Pending Approval'
    ) {
      return false;
    }
    if (suspendedSubFilter === 'with_permission' && !s.activePermissionLetter) return false;
    if (campusFilter !== 'all' && s.campus !== campusFilter) return false;
    if (memberTypeFilter !== 'all' && s.memberType !== memberTypeFilter) return false;
    if (routeFilter !== 'all' && s.routeId !== routeFilter && s.routeCode !== routeFilter) return false;
    if (villageFilter !== 'all' && s.villageId !== villageFilter && s.villageName !== villageFilter) return false;
    if (
      stopFilter !== 'all' &&
      s.pickupDropStopId !== stopFilter &&
      s.pickupDropStopName !== stopFilter &&
      s.morningStopName !== stopFilter
    ) {
      return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        s.villageName.toLowerCase().includes(q) ||
        s.pickupDropStopName.toLowerCase().includes(q) ||
        s.routeCode.toLowerCase().includes(q) ||
        s.mobile.toLowerCase().includes(q) ||
        (s.statusReason && s.statusReason.toLowerCase().includes(q)) ||
        (s.pendingSuspensionRequest?.reason && s.pendingSuspensionRequest.reason.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const openSuspendMemberModal = (memberId?: string) => {
    if (!canInitiateSuspension) return;
    const defaultMember =
      students.find(s => s.id === memberId) ||
      students.find(s => s.transportStatus === 'Active') ||
      students[0];
    setSuspendTargetMemberId(defaultMember?.id || '');
    setSuspendModalReason('');
    setSuspendModalError(null);
    setShowSuspendModal(true);
  };

  const handleConfirmSuspendModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuspendModalError(null);
    if (!canInitiateSuspension) {
      setSuspendModalError('Only Transport Coordinator (with Admin approval) or Admin can suspend a member.');
      return;
    }
    if (!suspendTargetMemberId) {
      setSuspendModalError('Please select a member.');
      return;
    }
    const cleanReason = suspendModalReason.trim();
    if (cleanReason.length < 5) {
      setSuspendModalError('Please enter a valid, specific reason (at least 5 characters) for suspending this member.');
      return;
    }
    setSubmitting(true);
    try {
      if (onSuspendStudent) {
        await onSuspendStudent(suspendTargetMemberId, cleanReason);
      }
      setShowSuspendModal(false);
      setSuspendModalReason('');
    } catch (err: any) {
      setSuspendModalError(err.message || 'Failed to submit suspension');
    } finally {
      setSubmitting(false);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setKpiCardFilter('all');
    setSuspendedSubFilter('all');
    setCampusFilter('all');
    setMemberTypeFilter('all');
    setRouteFilter('all');
    setClassFilter('all');
    setVillageFilter('all');
    setStopFilter('all');
  };

  // Eligible for manual individual suspension: Active members with unpaid dues (>0) and NO active permission letter or permission revocation
  const eligibleForSuspensionList = students.filter(
    s =>
      s.transportStatus === 'Active' &&
      s.balanceDue > 0 &&
      !s.activePermissionLetter &&
      !(s.specialHistory || []).some(e => e.eventType === 'Revoked_Permission_Letter')
  );

  const openRevokePermModal = (memberId?: string) => {
    const defaultMember =
      students.find(s => s.id === memberId) ||
      students.find(s => s.transportStatus === 'Suspended') ||
      students[0];
    const defaultUntil = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    setRevokePermTargetId(defaultMember?.id || '');
    setRevokePermUntilDate(defaultUntil);
    setRevokePermReason('');
    setRevokePermApprovedBy('Admin');
    setRevokePermFileData('');
    setRevokePermFileName('');
    setRevokePermError(null);
    setShowRevokePermModal(true);
  };

  const handleRevokePermFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRevokePermFileName(file.name);
    try {
      const compressed = await readFileCompressed(file, 900, 0.72);
      setRevokePermFileData(compressed);
    } catch {
      setRevokePermError('Failed to process uploaded file.');
    }
  };

  const handleStandaloneRevokePermSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onGrantPermissionLetter) return;
    if (!revokePermTargetId) {
      setRevokePermError('Please select a member.');
      return;
    }
    const defaultUntil = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    setSubmitting(true);
    setRevokePermError(null);
    try {
      await onGrantPermissionLetter(revokePermTargetId, {
        allowedUntilDate: revokePermUntilDate || defaultUntil,
        letterAttachment: revokePermFileData || 'Permission_Letter_Verified_In_Office',
        letterFileName: revokePermFileName || 'Permission_Letter.pdf',
        approvedBy: revokePermApprovedBy || 'Admin',
        reason: revokePermReason || 'Permission granted to revoke/prevent suspension',
      });
      setShowRevokePermModal(false);
    } catch (err: any) {
      setRevokePermError(err.message || 'Failed to save permission letter');
    } finally {
      setSubmitting(false);
    }
  };

  // Count instances per member for Discipline filter
  const memberDisciplineCounts = disciplineRecords.reduce<Record<string, number>>((acc, rec) => {
    const key = rec.memberId || rec.studentId || '';
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const filteredDisciplineRecords = disciplineRecords.filter(d => {
    if (discClassFilter !== 'all' && d.className !== discClassFilter) return false;
    if (discRouteFilter !== 'all' && d.routeId !== discRouteFilter && d.routeName !== discRouteFilter) return false;
    if (discVehicleFilter !== 'all' && d.vehicleNumber !== discVehicleFilter) return false;
    if (discInstanceMin !== 'all') {
      const minCount = Number(discInstanceMin);
      const key = d.memberId || d.studentId || '';
      if ((memberDisciplineCounts[key] || 0) < minCount) return false;
    }
    if (discSearch.trim()) {
      const q = discSearch.toLowerCase();
      return (
        (d.memberName || d.studentName || '').toLowerCase().includes(q) ||
        d.admissionNo.toLowerCase().includes(q) ||
        d.concern.toLowerCase().includes(q) ||
        d.actionTaken.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const resolveBestRouteForVillage = (vilId: string, stpId?: string, campusVal?: string) => {
    const pickBest = (list: Route[]) => {
      if (list.length === 0) return undefined;
      if (campusVal) {
        const campusMatch = list.find(
          r =>
            ((r.campus || '').toLowerCase() === campusVal.toLowerCase() ||
              (r.campusCode || '').toLowerCase() === campusVal.toLowerCase()) &&
            r.active !== false
        );
        if (campusMatch) return campusMatch;
      }
      return list.find(r => r.active !== false) || list[0];
    };

    // Priority 1: Routes that explicitly include the selected stop
    if (stpId) {
      const explicitStopMatches = routes.filter(
        r => doesRouteMatchVillageAndStop(r, vilId, stpId).explicitStop
      );
      if (explicitStopMatches.length > 0) {
        return pickBest(explicitStopMatches);
      }
    }

    // Priority 2: Routes covering the village without excluding the selected stop
    const fallbackMatches = routes.filter(r => {
      const m = doesRouteMatchVillageAndStop(r, vilId, stpId);
      return m.explicitStop || m.villageFallback;
    });
    return pickBest(fallbackMatches);
  };

  const handleVillageSelect = (vilId: string) => {
    setSelectedVillageId(vilId);
    setCustomVillageName('');
    setCustomStopName('');
    const vil = sortedVillages.find(v => v.id === vilId);
    if (vil) {
      const defaultStop = vil.stops.length > 0 ? vil.stops[0] : undefined;
      const nextStopId = defaultStop ? defaultStop.id : '';
      setSelectedStopId(nextStopId);
      setMonthlyFee(defaultStop?.fee || vil.monthlyRate || 700);
      const matchingRoute = resolveBestRouteForVillage(vilId, nextStopId, campus);
      setSelectedRouteId(matchingRoute ? matchingRoute.id : '');
    } else {
      setSelectedStopId('');
      setSelectedRouteId('');
    }
  };

  const handleStopSelect = (stpId: string) => {
    setSelectedStopId(stpId);
    setCustomStopName('');
    const stp = availableStops.find(s => s.id === stpId);
    if (stp && stp.fee) {
      setMonthlyFee(stp.fee);
    }
    if (selectedVillageId) {
      const matchingRoute = resolveBestRouteForVillage(selectedVillageId, stpId, campus);
      setSelectedRouteId(matchingRoute ? matchingRoute.id : '');
    }
  };

  const handleDpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await readFileCompressed(file, 320, 0.74);
      setProfilePhoto(compressed);
      setFormError(null);
    } catch {
      setFormError('Failed to process uploaded photo. Please try another image.');
    }
  };

  const handleInitialSchoolIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await readFileCompressed(file, 900, 0.72);
      setSchoolIdDoc({
        id: `doc-${Date.now()}`,
        type: 'School ID Card',
        name: file.name,
        fileData: compressed,
        uploadedAt: todayStr,
      });
    } catch {
      setFormError('Failed to process uploaded School ID document.');
    }
  };

  const openNewModal = () => {
    setFormError(null);
    setEditingId(null);
    setAdmissionNo('');
    setName('');
    setProfilePhoto('');
    setMemberType('');
    setStudentClass('');
    setSection('');
    setGender('M');
    setCampus('');
    setFatherName('');
    setMobile('');
    setEmergencyContact('');
    setAddress('');
    setSchoolIdDoc(null);
    const defaultVil = sortedVillages[0];
    setSelectedVillageId(defaultVil?.id || '');
    setMemberVillageSearch('');
    setCustomVillageName('');
    setSelectedStopId(defaultVil?.stops[0]?.id || '');
    setCustomStopName('');
    setMonthlyFee(defaultVil?.stops[0]?.fee || defaultVil?.monthlyRate || 700);
    setConcessionAmount(0);
    const defaultRoute = routes[0];
    setSelectedRouteId(defaultRoute?.id || '');
    setMemberStatusInput('Active');
    setShowAddModal(true);
  };

  const openEditModal = (s: StudentMember) => {
    setFormError(null);
    setEditingId(s.id);
    setAdmissionNo(s.admissionNo);
    setName(s.name);
    setProfilePhoto(s.profilePhoto || '');
    setMemberType(s.memberType || '');
    setStudentClass(s.class || '');
    setSection(s.section || '');
    setGender(s.gender || 'M');
    setCampus(s.campus || '');
    setFatherName(s.fatherName || '');
    setMobile(s.mobile || '');
    setEmergencyContact(s.emergencyContact || s.mobile || '');
    setAddress(s.address || '');
    setSelectedVillageId(s.villageId || '');
    setMemberVillageSearch('');
    setCustomVillageName(s.villageName && !villages.some(v => v.id === s.villageId) ? s.villageName : '');
    setSelectedStopId(s.pickupDropStopId || '');
    setCustomStopName(s.pickupDropStopName && !s.pickupDropStopId ? s.pickupDropStopName : '');
    setSelectedRouteId(s.routeId || '');
    setMonthlyFee(s.monthlyFee);
    setConcessionAmount(s.concessionAmount);
    setMemberStatusInput(s.transportStatus || 'Active');
    setSchoolIdDoc(null);
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!admissionNo.trim()) {
      setFormError('Admission No. / Staff ID is mandatory.');
      return;
    }
    if (!name.trim()) {
      setFormError('Member Full Name is mandatory.');
      return;
    }
    if (!profilePhoto) {
      setFormError('Display Picture (DP) attachment is compulsory when adding a member.');
      return;
    }
    if (!memberType.trim()) {
      setFormError('Please enter or select a Member Type.');
      return;
    }
    if (!campus.trim()) {
      setFormError('Please enter or select a Campus.');
      return;
    }
    if (!studentClass.trim()) {
      setFormError('Class / Role / Department is mandatory.');
      return;
    }
    if (!fatherName.trim()) {
      setFormError('Father / Guardian / Spouse Name is mandatory.');
      return;
    }
    if (!mobile.trim() || mobile.replace(/\D/g, '').length < 10) {
      setFormError('A valid 10-digit Mobile / WhatsApp Number is mandatory.');
      return;
    }
    if (!address.trim()) {
      setFormError('Residential Address is mandatory.');
      return;
    }

    const vil = villages.find(v => v.id === selectedVillageId);
    const stp = vil?.stops.find(s => s.id === selectedStopId);
    const rt = routes.find(r => r.id === selectedRouteId);

    const resolvedVillageName = customVillageName.trim() || vil?.name || '';
    const resolvedStopName = customStopName.trim() || stp?.name || '';
    const resolvedRouteCode = rt?.code || '';

    if (!vil && !resolvedVillageName) {
      setFormError('Mandatory prerequisite record missing: Please select a valid Village from Village Master.');
      return;
    }
    if (!stp && !resolvedStopName) {
      setFormError('Mandatory prerequisite record missing: Please select a valid Pickup & Drop Stop.');
      return;
    }
    if (!rt && !resolvedRouteCode) {
      setFormError('Mandatory prerequisite record missing: Please select a valid Assigned Route from Route Master.');
      return;
    }
    if (!monthlyFee || Number(monthlyFee) <= 0) {
      setFormError('Monthly Transport Fee is mandatory and must be greater than ₹0.');
      return;
    }

    setSubmitting(true);
    try {
      const existingMember = editingId ? students.find(x => x.id === editingId) : undefined;
      const existingDocs = existingMember?.documents || [];
      const updatedDocs = schoolIdDoc ? [schoolIdDoc, ...existingDocs] : existingDocs;

      await onSaveStudent({
        id: editingId || undefined,
        admissionNo: admissionNo.trim(),
        name: name.trim(),
        profilePhoto,
        memberType: memberType.trim(),
        class: studentClass.trim(),
        section: section.trim() || 'A',
        gender,
        campus: campus.trim(),
        fatherName: fatherName.trim(),
        mobile: mobile.trim(),
        emergencyContact: (emergencyContact || mobile).trim(),
        address: address.trim(),
        villageId: vil?.id || '',
        villageName: resolvedVillageName,
        pickupDropStopId: stp?.id || '',
        pickupDropStopName: resolvedStopName,
        routeId: rt?.id || '',
        routeCode: resolvedRouteCode,
        monthlyFee: Number(monthlyFee),
        concessionAmount: Number(concessionAmount) || 0,
        transportStatus: memberStatusInput,
        documents: updatedDocs,
      });
      if (editingId && existingMember && existingMember.transportStatus !== memberStatusInput && onChangeMemberStatus) {
        await onChangeMemberStatus(editingId, memberStatusInput, `Status updated to ${memberStatusInput} via Member Info Edit`);
      }
      setShowAddModal(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save member');
    } finally {
      setSubmitting(false);
    }
  };

  const getCampusLabel = (codeOrId: string) => {
    const found = campuses.find(c => c.code === codeOrId || c.id === codeOrId || c.name === codeOrId);
    return found ? `${found.name} (${found.code})` : codeOrId || '—';
  };

  // Profile Modal Member Lookup
  const activeProfileMember = profileMemberId ? students.find(s => s.id === profileMemberId) || null : null;
  const memberInvoices = activeProfileMember
    ? invoices.filter(i => i.studentId === activeProfileMember.id || i.admissionNo === activeProfileMember.admissionNo)
    : [];
  const memberReceipts = activeProfileMember
    ? receipts.filter(r => r.studentId === activeProfileMember.id || r.admissionNo === activeProfileMember.admissionNo)
    : [];
  const memberAttendance = activeProfileMember
    ? attendanceRecords.filter(
        a => a.studentId === activeProfileMember.id || a.admissionNo === activeProfileMember.admissionNo
      )
    : [];
  const memberFollowUps = activeProfileMember
    ? feeFollowUps.filter(f => f.memberId === activeProfileMember.id || f.admissionNo === activeProfileMember.admissionNo)
    : [];
  const memberDisciplines = activeProfileMember
    ? disciplineRecords.filter(d => d.memberId === activeProfileMember.id || d.admissionNo === activeProfileMember.admissionNo)
    : [];

  const isStudentMember = (m: StudentMember) =>
    m.memberType.toLowerCase().includes('student') || (!m.memberType.toLowerCase().includes('staff') && !m.memberType.toLowerCase().includes('teacher'));

  // Handle Document Upload inside Profile -> Documents
  const handleProfileDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProfileMember) return;
    setUploadingDoc(true);
    try {
      const compressed = await readFileCompressed(file, 900, 0.72);
      const newDoc: DocumentAttachment = {
        id: `doc-${Date.now()}`,
        type: newDocType,
        name: file.name,
        fileData: compressed,
        uploadedAt: todayStr,
      };
      const updatedDocs = [...(activeProfileMember.documents || []), newDoc];
      await onSaveStudent({
        ...activeProfileMember,
        documents: updatedDocs,
      });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteProfileDocument = async (docId: string) => {
    if (!activeProfileMember || !isAdmin) return;
    const updatedDocs = (activeProfileMember.documents || []).filter(d => d.id !== docId);
    await onSaveStudent({
      ...activeProfileMember,
      documents: updatedDocs,
    });
  };

  // Handle Permission Letter File Select
  const handlePermFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPermFileName(file.name);
    try {
      const compressed = await readFileCompressed(file, 900, 0.72);
      setPermFileData(compressed);
    } catch {
      setFormError('Failed to process uploaded file.');
    }
  };

  const handleGrantPermissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfileMember || !onGrantPermissionLetter) return;
    const defaultUntil = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    setSubmitting(true);
    setFormError(null);
    try {
      await onGrantPermissionLetter(activeProfileMember.id, {
        allowedUntilDate: permUntilDate || defaultUntil,
        letterAttachment: permFileData || 'Permission_Letter_Verified_In_Office',
        letterFileName: permFileName || 'Permission_Letter.pdf',
        approvedBy: permApprovedBy || 'Admin',
        reason: permReason || 'Permission extension approved',
      });
      setPermUntilDate('');
      setPermReason('');
      setPermFileData('');
      setPermFileName('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to grant permission letter');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProfileFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfileMember || !onAddFeeFollowUp) return;
    if (!fuResponse.trim() || !fuPromisedDate) return;
    setSubmitting(true);
    try {
      await onAddFeeFollowUp({
        memberId: activeProfileMember.id,
        memberName: activeProfileMember.name,
        admissionNo: activeProfileMember.admissionNo,
        callDate: fuDate || todayStr,
        personTalkedTo: fuPersonTalked.trim() || 'Guardian',
        responseReceived: fuResponse.trim(),
        promisedDate: fuPromisedDate,
        recordedBy: isAdmin ? 'Transport Admin' : 'Transport Coordinator',
        status: 'Pending',
      });
      setFuResponse('');
      setFuPromisedDate('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProfileDisciplineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfileMember || !onAddDisciplineRecord) return;
    if (!discConcern.trim() || !discActionTaken.trim()) return;
    setSubmitting(true);
    try {
      const rt = routes.find(r => r.id === activeProfileMember.routeId || r.code === activeProfileMember.routeCode);
      await onAddDisciplineRecord({
        memberId: activeProfileMember.id,
        memberName: activeProfileMember.name,
        admissionNo: activeProfileMember.admissionNo,
        memberType: activeProfileMember.memberType,
        className: activeProfileMember.class,
        section: activeProfileMember.section,
        routeId: rt?.id || activeProfileMember.routeId,
        routeName: rt?.code || activeProfileMember.routeCode,
        vehicleNumber: rt?.vehicleNumber || '',
        date: discDate || todayStr,
        concern: discConcern.trim(),
        actionTaken: discActionTaken.trim(),
        reportedBy: isAdmin ? 'Transport Admin' : 'Transport Assistant',
      });
      setDiscConcern('');
      setDiscActionTaken('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStandaloneDisciplineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddDisciplineRecord) return;
    const m = students.find(s => s.id === discMemberId);
    if (!m || !discConcern.trim() || !discActionTaken.trim()) return;
    setSubmitting(true);
    try {
      const rt = routes.find(r => r.id === m.routeId || r.code === m.routeCode);
      await onAddDisciplineRecord({
        memberId: m.id,
        memberName: m.name,
        admissionNo: m.admissionNo,
        memberType: m.memberType,
        className: m.class,
        section: m.section,
        routeId: rt?.id || m.routeId,
        routeName: rt?.code || m.routeCode,
        vehicleNumber: rt?.vehicleNumber || '',
        date: discDate || todayStr,
        concern: discConcern.trim(),
        actionTaken: discActionTaken.trim(),
        reportedBy: isAdmin ? 'Transport Admin' : 'Transport Assistant',
      });
      setDiscConcern('');
      setDiscActionTaken('');
      setShowAddDisciplineModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const printSingleReceipt = (rec: FeeReceipt, member: StudentMember) => {
    const html = `
      <html>
        <head>
          <title>Fee Receipt ${rec.receiptNo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #0f172a; }
            .box { border: 2px solid #0f172a; border-radius: 12px; padding: 24px; max-width: 680px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 16px; }
            .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
            .header p { margin: 4px 0 0; font-size: 12px; color: #475569; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; margin-bottom: 18px; }
            .amount-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 18px; }
            .footer { display: flex; justify-content: space-between; margin-top: 32px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="header">
              <h1>${schoolName || 'Institute Transport Department'}</h1>
              <p>OFFICIAL TRANSPORT FEE RECEIPT</p>
            </div>
            <div class="grid">
              <div><strong>Receipt ID:</strong> ${rec.receiptNo}</div>
              <div><strong>Date:</strong> ${rec.date}</div>
              <div><strong>Member Name:</strong> ${member.name} (${member.memberType})</div>
              <div><strong>ID / Adm No:</strong> ${member.admissionNo}</div>
              <div><strong>Class / Role:</strong> ${member.class}-${member.section}</div>
              <div><strong>Route & Stop:</strong> ${member.routeCode} • ${member.pickupDropStopName}</div>
            </div>
            <div class="amount-box">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span>Previous Dues Before Payment:</span>
                <strong>Rs. ${(rec.balanceDueBefore ?? (rec.amount + member.balanceDue)).toLocaleString('en-IN')}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:16px;color:#047857;">
                <span><strong>Amount Paid (${rec.paymentMode}):</strong></span>
                <strong>Rs. ${rec.amount.toLocaleString('en-IN')}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span>Balance Due After Payment:</span>
                <strong>Rs. ${(rec.balanceDueAfter ?? member.balanceDue).toLocaleString('en-IN')}</strong>
              </div>
              ${rec.referenceNo ? `<div style="margin-top:6px;font-size:12px;"><strong>Reference / UTR:</strong> ${rec.referenceNo}</div>` : ''}
            </div>
            <div style="font-size:12px;color:#475569;"><strong>Remarks:</strong> ${rec.remarks || 'Transport fee received'}</div>
            <div class="footer">
              <div>Received By: ${rec.receivedBy}</div>
              <div>Authorized Signatory</div>
            </div>
          </div>
        </body>
      </html>
    `;
    openHtmlPrintPreview({
      title: `Transport Fee Receipt — ${rec.receiptNo} (${member.name})`,
      subtitle: `Paid Rs. ${rec.amount.toLocaleString('en-IN')} via ${rec.paymentMode} on ${rec.date}`,
      html,
      filename: `fee_receipt_${rec.receiptNo}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          SUB-MODULE 3: COMBINED DISCIPLINE & BEHAVIOUR REGISTER
         ===================================================================== */}
      {subModule === 'discipline' ? (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900">
                Behaviour &amp; Discipline Register
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                {filteredDisciplineRecords.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-52 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={discSearch}
                  onChange={e => setDiscSearch(e.target.value)}
                  placeholder="Search member, concern..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <FilterPopover
                isFiltered={
                  discClassFilter !== 'all' ||
                  discRouteFilter !== 'all' ||
                  discVehicleFilter !== 'all' ||
                  discInstanceMin !== 'all'
                }
                onReset={() => {
                  setDiscClassFilter('all');
                  setDiscRouteFilter('all');
                  setDiscVehicleFilter('all');
                  setDiscInstanceMin('all');
                }}
              >
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Class</label>
                  <select
                    value={discClassFilter}
                    onChange={e => setDiscClassFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="all">All Classes</option>
                    {classes.map(c => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Route</label>
                  <select
                    value={discRouteFilter}
                    onChange={e => setDiscRouteFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="all">All Routes</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.code}>{r.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Vehicle</label>
                  <select
                    value={discVehicleFilter}
                    onChange={e => setDiscVehicleFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="all">All Vehicles</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.registrationNumber}>{v.registrationNumber}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Minimum Instances</label>
                  <select
                    value={discInstanceMin}
                    onChange={e => setDiscInstanceMin(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="all">All Instances Count</option>
                    <option value="1">1+ Instances</option>
                    <option value="2">2+ Repeat Offenders</option>
                    <option value="3">3+ Frequent Instances</option>
                  </select>
                </div>
              </FilterPopover>

              <PrintExportToolbar
                title="Transit Discipline & Behaviour Register"
                filename="Discipline_Register"
                schoolName={schoolName}
                isFiltered={
                  discClassFilter !== 'all' ||
                  discRouteFilter !== 'all' ||
                  discVehicleFilter !== 'all' ||
                  discInstanceMin !== 'all' ||
                  discSearch.trim() !== ''
                }
                filteredRows={filteredDisciplineRecords}
                allRows={disciplineRecords}
                columns={[
                  { header: 'Date', accessor: d => d.date },
                  { header: 'Admission No', accessor: d => d.admissionNo },
                  { header: 'Member Name', accessor: d => d.memberName },
                  { header: 'Class & Sec', accessor: d => `${d.className}-${d.section}` },
                  { header: 'Route', accessor: d => d.routeName || '—' },
                  { header: 'Vehicle', accessor: d => d.vehicleNumber || '—' },
                  { header: 'Instances', accessor: d => memberDisciplineCounts[d.memberId || d.studentId || ''] || 1 },
                  { header: 'Concern / Mischief', accessor: d => d.concern },
                  { header: 'Action Taken', accessor: d => d.actionTaken },
                ]}
              />

              <button
                onClick={() => {
                  setDiscMemberId(students[0]?.id || '');
                  setDiscDate(todayStr);
                  setDiscConcern('');
                  setDiscActionTaken('');
                  setShowAddDisciplineModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs whitespace-nowrap transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Record Issue</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Member (Click for Profile)</th>
                    <th className="py-3 px-3">Class</th>
                    <th className="py-3 px-3">Route &amp; Vehicle</th>
                    <th className="py-3 px-3">Total Instances</th>
                    <th className="py-3 px-4">Mischief / Concern</th>
                    <th className="py-3 px-4">Action Taken</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Delete</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDisciplineRecords.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-slate-600">{d.date}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            setProfileMemberId(d.memberId || d.studentId || null);
                            setProfileTab('discipline');
                          }}
                          className="font-bold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer text-left"
                        >
                          {d.memberName || d.studentName}
                        </button>
                        <div className="text-[10px] font-mono text-slate-500">{d.admissionNo}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold">{d.className}-{d.section}</td>
                      <td className="py-3 px-3 font-mono text-[11px]">
                        <div>{d.routeName || '—'}</div>
                        <div className="text-[10px] text-slate-400">{d.vehicleNumber}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px]">
                          {memberDisciplineCounts[d.memberId || d.studentId || ''] || 1} Instance(s)
                        </span>
                      </td>
                      <td className="py-3 px-4 text-rose-900 font-medium">{d.concern}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium text-[11px]">
                          {d.actionTaken}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          {onDeleteDisciplineRecord && (
                            <button
                              onClick={() => onDeleteDisciplineRecord(d.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredDisciplineRecords.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="py-10 text-center text-slate-400">
                        No discipline records match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : subModule === 'suspended' ? (
        /* =====================================================================
            SUB-MODULE 2: SUSPENDED & PERMISSIONS (ONLY SUSPENDED & PENDING APPROVAL)
           ===================================================================== */
        <div className="space-y-4">
          <div className="bg-white px-5 py-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900">Suspended &amp; Permissions</h2>
              <span className="text-xs font-bold text-rose-700">
                · {suspendedAndPendingMembers.length} Suspended
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-52 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search member, ID, route..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <FilterPopover
                isFiltered={
                  campusFilter !== 'all' ||
                  routeFilter !== 'all' ||
                  villageFilter !== 'all' ||
                  suspendedSubFilter !== 'all'
                }
                onReset={clearAllFilters}
              >
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Campus</label>
                  <select
                    value={campusFilter}
                    onChange={e => setCampusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                  >
                    <option value="all">All Campuses</option>
                    {campuses.map(c => (
                      <option key={c.id} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Route</label>
                  <select
                    value={routeFilter}
                    onChange={e => setRouteFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                  >
                    <option value="all">All Routes</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Village (A–Z)</label>
                  <select
                    value={villageFilter}
                    onChange={e => {
                      setVillageFilter(e.target.value);
                      setStopFilter('all');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                  >
                    <option value="all">All Villages</option>
                    {sortedVillages.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Suspension State</label>
                  <select
                    value={suspendedSubFilter}
                    onChange={e => setSuspendedSubFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                  >
                    <option value="all">All Suspended &amp; Pending</option>
                    <option value="suspended_only">Suspended Only</option>
                    <option value="pending_approval">Pending Admin Approval</option>
                  </select>
                </div>
              </FilterPopover>

              <PrintExportToolbar
                title="Suspended & Permissions Register"
                filename="Suspended_And_Permissions_Register"
                schoolName={schoolName}
                isFiltered={filteredSuspendedMembers.length !== suspendedAndPendingMembers.length}
                filteredRows={filteredSuspendedMembers}
                allRows={suspendedAndPendingMembers}
                columns={[
                  { header: 'ID / Admission No', accessor: s => s.admissionNo },
                  { header: 'Member Name', accessor: s => s.name },
                  { header: 'Member Type', accessor: s => s.memberType || '—' },
                  { header: 'Class & Sec', accessor: s => `${s.class}-${s.section}` },
                  { header: 'Campus', accessor: s => getCampusLabel(s.campus) },
                  { header: 'Father / Guardian', accessor: s => s.fatherName },
                  { header: 'Mobile', accessor: s => s.mobile },
                  { header: 'Route Code', accessor: s => s.routeCode },
                  { header: 'Stop', accessor: s => s.pickupDropStopName },
                  { header: 'Balance Due', accessor: s => s.balanceDue },
                  {
                    header: 'Status',
                    accessor: s =>
                      s.pendingSuspensionRequest?.status === 'Pending Approval'
                        ? 'Pending Admin Approval'
                        : s.transportStatus,
                  },
                  {
                    header: 'Valid Suspension Reason',
                    accessor: s =>
                      s.pendingSuspensionRequest?.status === 'Pending Approval'
                        ? s.pendingSuspensionRequest.reason
                        : s.statusReason || '—',
                  },
                ]}
              />

              <button
                onClick={() => openRevokePermModal()}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
              >
                <Award className="w-4 h-4" />
                <span>Grant Permission</span>
              </button>

              {canInitiateSuspension && (
                <button
                  onClick={() => openSuspendMemberModal()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>{isAdmin ? 'Suspend Member' : 'Request Suspension'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Suspended & Permissions Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Member</th>
                    <th className="py-3.5 px-4">Type / Class &amp; Campus</th>
                    <th className="py-3.5 px-4">Guardian &amp; Mobile</th>
                    <th className="py-3.5 px-4">Route &amp; Stop</th>
                    <th className="py-3.5 px-4">Fee &amp; Dues</th>
                    <th className="py-3.5 px-4">Valid Suspension Reason &amp; Authority</th>
                    <th className="py-3.5 px-4">Status &amp; Permission</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs">
                  {filteredSuspendedMembers.map(s => {
                    const isPendingApproval =
                      s.pendingSuspensionRequest?.status === 'Pending Approval';
                    const latestSuspendEvt = (s.specialHistory || []).find(
                      e => e.eventType === 'Suspended' || e.eventType === 'Suspension_Requested'
                    );
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => {
                              setProfileMemberId(s.id);
                              setProfileTab('special');
                            }}
                            className="flex items-center gap-3 text-left group cursor-pointer"
                          >
                            {s.profilePhoto ? (
                              <img
                                src={s.profilePhoto}
                                alt={s.name}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {s.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900 group-hover:text-amber-600 underline decoration-slate-300 group-hover:decoration-amber-500 transition-colors">
                                {s.name}
                              </div>
                              <div className="font-mono text-[11px] text-slate-500">{s.admissionNo}</div>
                            </div>
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                isStudentMember(s)
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}
                            >
                              {s.memberType || 'Member'}
                            </span>
                            <span className="font-semibold text-slate-800">
                              {s.class} {s.section && `(${s.section})`}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            Campus: <span className="font-semibold text-slate-700">{getCampusLabel(s.campus)}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-slate-800 font-medium">{s.fatherName || '—'}</div>
                          <div className="text-slate-500 text-[11px]">{s.mobile}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-mono text-[11px] font-bold">
                            {s.routeCode || 'Unassigned'}
                          </span>
                          <div className="text-[11px] text-slate-600 font-medium mt-1">
                            {s.villageName} • {s.pickupDropStopName}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">
                            ₹{Math.max(0, s.monthlyFee - s.concessionAmount)}/mo
                          </div>
                          {s.balanceDue > 0 ? (
                            <div className="text-[11px] text-rose-600 font-bold">
                              Due: ₹{s.balanceDue.toLocaleString('en-IN')}
                            </div>
                          ) : (
                            <div className="text-[11px] text-emerald-600 font-medium">No Dues</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-semibold text-rose-900">
                            {isPendingApproval
                              ? s.pendingSuspensionRequest?.reason
                              : s.statusReason || latestSuspendEvt?.reason || 'Suspended due to transport irregularity / dues'}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {isPendingApproval
                              ? `Requested by ${s.pendingSuspensionRequest?.requestedBy} on ${s.pendingSuspensionRequest?.requestedAt}`
                              : latestSuspendEvt
                              ? `By ${latestSuspendEvt.authorizedBy} on ${latestSuspendEvt.date}`
                              : 'Authorized by Admin'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {isPendingApproval ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold">
                              Pending Admin Approval
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-bold">
                              Suspended
                            </span>
                          )}
                          {s.activePermissionLetter && (
                            <div className="mt-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              Permission till {s.activePermissionLetter.allowedUntilDate}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {isPendingApproval && isAdmin && onReviewSuspensionRequest && (
                              <>
                                <button
                                  onClick={() => onReviewSuspensionRequest(s.id, 'Approve')}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1"
                                  title="Approve Transport Coordinator's Suspension Request"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => onReviewSuspensionRequest(s.id, 'Reject', 'Rejected by Admin')}
                                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1"
                                  title="Reject Suspension Request"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                setProfileMemberId(s.id);
                                setProfileTab('special');
                              }}
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1"
                              title="Grant Permission Letter or Revoke Suspension"
                            >
                              <Award className="w-3.5 h-3.5 text-amber-600" />
                              <span>Permissions</span>
                            </button>
                            <button
                              onClick={() => {
                                setProfileMemberId(s.id);
                                setProfileTab('general');
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Profile</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSuspendedMembers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                        No suspended members or pending suspension requests found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* =====================================================================
            SUB-MODULE 1: MEMBERS DIRECTORY
           ===================================================================== */
        <>
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900">Member Directory</h2>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-mono font-bold">
                {filteredStudents.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-52 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search name, ID, stop, route..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <FilterPopover isFiltered={isFiltered} onReset={clearAllFilters}>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Campus</label>
                  <select
                    value={campusFilter}
                    onChange={e => setCampusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                  >
                    <option value="all">All Campuses</option>
                    {campuses.map(c => (
                      <option key={c.id} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Member Type</label>
                  <select
                    value={memberTypeFilter}
                    onChange={e => setMemberTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                  >
                    <option value="all">All Member Types</option>
                    {memberTypes.map(m => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Route</label>
                  <select
                    value={routeFilter}
                    onChange={e => setRouteFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                  >
                    <option value="all">All Routes</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Village (A–Z)</label>
                  <select
                    value={villageFilter}
                    onChange={e => {
                      setVillageFilter(e.target.value);
                      setStopFilter('all');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                  >
                    <option value="all">All Villages</option>
                    {sortedVillages.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                {villageFilter !== 'all' && filterVillageStops.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Stop</label>
                    <select
                      value={stopFilter}
                      onChange={e => setStopFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-slate-900"
                    >
                      <option value="all">All Stops ({activeFilterVillageObj?.name})</option>
                      {filterVillageStops.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                  >
                    <option value="all">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Needs Setup">Needs Setup</option>
                    <option value="Left">Left</option>
                  </select>
                </div>
              </FilterPopover>

              <PrintExportToolbar
                title="Members Register"
                filename="Members_Register"
                schoolName={schoolName}
                isFiltered={isFiltered}
                filteredRows={filteredStudents}
                allRows={students}
                columns={[
                  { header: 'ID / Admission No', accessor: s => s.admissionNo },
                  { header: 'Member Name', accessor: s => s.name },
                  { header: 'Member Type', accessor: s => s.memberType || '—' },
                  { header: 'Class & Sec', accessor: s => `${s.class}-${s.section}` },
                  { header: 'Campus', accessor: s => getCampusLabel(s.campus) },
                  { header: 'Father / Guardian', accessor: s => s.fatherName },
                  { header: 'Mobile', accessor: s => s.mobile },
                  { header: 'Village', accessor: s => s.villageName },
                  { header: 'Pickup & Drop Stop', accessor: s => s.pickupDropStopName },
                  { header: 'Route Code', accessor: s => s.routeCode },
                  { header: 'Net Monthly Fee', accessor: s => Math.max(0, s.monthlyFee - s.concessionAmount) },
                  { header: 'Balance Due', accessor: s => s.balanceDue },
                  { header: 'Status', accessor: s => s.transportStatus },
                ]}
              />

              <button
                onClick={openNewModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Add Member</span>
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Member</th>
                    <th className="py-3.5 px-4">Type / Class &amp; Campus</th>
                    <th className="py-3.5 px-4">Guardian &amp; Mobile</th>
                    <th className="py-3.5 px-4">Village &amp; Stop</th>
                    <th className="py-3.5 px-4">Route</th>
                    <th className="py-3.5 px-4">Fee &amp; Dues</th>
                    <th className="py-3.5 px-4">Status (Quick Change)</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs">
                  {filteredStudents.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => {
                            setProfileMemberId(s.id);
                            setProfileTab('general');
                          }}
                          className="flex items-center gap-3 text-left group cursor-pointer"
                        >
                          {s.profilePhoto ? (
                            <img
                              src={s.profilePhoto}
                              alt={s.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-amber-600 underline decoration-slate-300 group-hover:decoration-amber-500 transition-colors">
                              {s.name}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">{s.admissionNo}</div>
                          </div>
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              isStudentMember(s)
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {s.memberType || 'Member'}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {s.class} {s.section && `(${s.section})`}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Campus: <span className="font-semibold text-slate-700">{getCampusLabel(s.campus)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium">{s.fatherName || '—'}</div>
                        <div className="text-slate-500 text-[11px]">{s.mobile}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{s.villageName}</div>
                        <div className="text-[11px] text-emerald-700 font-medium">
                          Stop: {s.pickupDropStopName}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 font-mono text-xs font-bold">
                          {s.routeCode || 'Unassigned'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          ₹{Math.max(0, s.monthlyFee - s.concessionAmount)}/mo
                        </div>
                        {s.balanceDue > 0 ? (
                          <div className="text-[11px] text-rose-600 font-semibold">
                            Due: ₹{s.balanceDue.toLocaleString('en-IN')}
                          </div>
                        ) : (
                          <div className="text-[11px] text-emerald-600 font-medium">No Dues</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                            s.transportStatus === 'Active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : s.transportStatus === 'Suspended'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {s.transportStatus}
                        </span>
                        {s.pendingSuspensionRequest?.status === 'Pending Approval' && (
                          <div className="mt-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                            Pending Approval
                          </div>
                        )}
                        {s.activePermissionLetter && (
                          <div className="mt-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            Permission till {s.activePermissionLetter.allowedUntilDate}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMemberId(s.id);
                              setProfileTab('general');
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                            title="View Member Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Profile</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(s)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1"
                            title="Edit Member Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => onDeleteStudent(s.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Delete Member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                        No members match the selected filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          MEMBER PROFILE MODAL (With Action Buttons + Follow-ups + Discipline)
         ===================================================================== */}
      {activeProfileMember && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full my-8 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Profile Top Banner */}
            <div className="bg-slate-900 text-white p-6 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {activeProfileMember.profilePhoto ? (
                    <img
                      src={activeProfileMember.profilePhoto}
                      alt={activeProfileMember.name}
                      className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-400 shadow-md shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-amber-400 flex items-center justify-center text-2xl font-bold text-amber-400 shrink-0">
                      {activeProfileMember.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-white">{activeProfileMember.name}</h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isStudentMember(activeProfileMember)
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                            : 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                        }`}
                      >
                        {isStudentMember(activeProfileMember) ? 'Student' : `Staff (${activeProfileMember.memberType})`}
                      </span>
                      <select
                        value={activeProfileMember.transportStatus}
                        onChange={(e) => {
                          const nextStatus = e.target.value as StudentMember['transportStatus'];
                          if (nextStatus === 'Suspended') {
                            if (!canInitiateSuspension) return;
                            openSuspendMemberModal(activeProfileMember.id);
                            return;
                          }
                          if (onChangeMemberStatus) {
                            onChangeMemberStatus(
                              activeProfileMember.id,
                              nextStatus,
                              `Status changed to ${nextStatus} from Member Profile`
                            );
                          }
                        }}
                        className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-amber-300 border border-slate-700 cursor-pointer"
                      >
                        <option value="Active">Status: Active</option>
                        <option value="Suspended" disabled={!canInitiateSuspension}>
                          {canInitiateSuspension
                            ? isAdmin
                              ? 'Status: Suspended'
                              : 'Status: Suspended (Request Approval)'
                            : 'Status: Suspended (Coordinator/Admin Only)'}
                        </option>
                        <option value="Left">Status: Left</option>
                        <option value="Needs Setup">Status: Needs Setup</option>
                      </select>
                    </div>
                    <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
                      <span>ID: <strong className="font-mono text-amber-400">{activeProfileMember.admissionNo}</strong></span>
                      <span>•</span>
                      <span>Class/Dept: <strong>{activeProfileMember.class} {activeProfileMember.section}</strong></span>
                      <span>•</span>
                      <span>Campus: <strong>{getCampusLabel(activeProfileMember.campus)}</strong></span>
                      <span>•</span>
                      <span>Route: <strong className="text-amber-300 font-mono">{activeProfileMember.routeCode}</strong></span>
                    </div>
                    {activeProfileMember.activePermissionLetter && (
                      <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-semibold">
                        <Award className="w-3.5 h-3.5" />
                        <span>
                          Allowed via Permission Letter until {activeProfileMember.activePermissionLetter.allowedUntilDate}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setProfileMemberId(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer self-end sm:self-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Action Bar inside Member Profile */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800">
                <button
                  onClick={() => {
                    const id = activeProfileMember.id;
                    setProfileMemberId(null);
                    if (onQuickCollectFeeForMember) onQuickCollectFeeForMember(id);
                  }}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <IndianRupee className="w-3.5 h-3.5" />
                  <span>Collect Fees</span>
                </button>
                <button
                  onClick={() => setProfileTab('followups')}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Record Fee Follow-Up / Feedback</span>
                </button>
                <button
                  onClick={() => setProfileTab('discipline')}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Gavel className="w-3.5 h-3.5 text-rose-400" />
                  <span>Discipline Irregularity Reporting</span>
                </button>
                <button
                  onClick={() => {
                    const memberToEdit = activeProfileMember;
                    setProfileMemberId(null);
                    openEditModal(memberToEdit);
                  }}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Edit General Info</span>
                </button>
              </div>
            </div>

            {/* Profile Navigation Tabs */}
            <div className="bg-slate-100 px-6 pt-3 border-b border-slate-200 flex flex-wrap gap-1.5">
              {[
                { key: 'general', label: '1- General Info' },
                { key: 'fees', label: `Fees & Receipts (${memberReceipts.length})` },
                { key: 'fee_structure', label: '2- Fee Structure' },
                { key: 'followups', label: `Fee Follow-Ups (${memberFollowUps.length})` },
                { key: 'discipline', label: `Discipline & Behaviour (${memberDisciplines.length})` },
                { key: 'attendance', label: `3- Attendance (${memberAttendance.length})` },
                { key: 'documents', label: `4- Documents (${(activeProfileMember.documents || []).length})` },
                { key: 'special', label: '5- Special (Suspension & Permission)' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setProfileTab(t.key as ProfileTabKey)}
                  className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all cursor-pointer ${
                    profileTab === t.key
                      ? 'bg-white text-slate-900 border-t border-x border-slate-200 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Profile Tab Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* TAB 1: GENERAL INFO */}
              {profileTab === 'general' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">Recorded Member Information</h4>
                    <button
                      onClick={() => {
                        setProfileMemberId(null);
                        openEditModal(activeProfileMember);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Edit Info</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-400 block">Full Name</span>
                      <span className="font-bold text-slate-900 text-sm">{activeProfileMember.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Member Category</span>
                      <span className="font-bold text-slate-900">{activeProfileMember.memberType}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">ID / Admission No.</span>
                      <span className="font-mono font-bold text-slate-900">{activeProfileMember.admissionNo}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Class &amp; Section</span>
                      <span className="font-semibold text-slate-800">{activeProfileMember.class} - {activeProfileMember.section}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Gender</span>
                      <span className="font-semibold text-slate-800">
                        {activeProfileMember.gender === 'F'
                          ? 'Female (F)'
                          : activeProfileMember.gender === 'M'
                          ? 'Male (M)'
                          : activeProfileMember.gender || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Campus</span>
                      <span className="font-semibold text-slate-800">{getCampusLabel(activeProfileMember.campus)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Father / Guardian Name</span>
                      <span className="font-semibold text-slate-800">{activeProfileMember.fatherName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Mobile / Emergency Phone</span>
                      <span className="font-semibold text-slate-800">{activeProfileMember.mobile} / {activeProfileMember.emergencyContact}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Joining Date</span>
                      <span className="font-semibold text-slate-800">{activeProfileMember.joiningDate}</span>
                    </div>
                    <div className="sm:col-span-3">
                      <span className="text-slate-400 block">Residential Address</span>
                      <span className="font-semibold text-slate-800">{activeProfileMember.address || '—'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: FEES */}
              {profileTab === 'fees' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">Member Fee Receipts Ledger</h4>
                    <div className="px-3.5 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-800">
                      Current Balance Due: <span className="text-rose-600">₹{activeProfileMember.balanceDue.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                          <th className="py-3 px-4">Receipt ID</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Amount Dues</th>
                          <th className="py-3 px-4">Amount Paid</th>
                          <th className="py-3 px-4">Balance After</th>
                          <th className="py-3 px-4">Mode &amp; Attachment</th>
                          <th className="py-3 px-4 text-right">Preview &amp; Print</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {memberReceipts.map(rec => (
                          <tr key={rec.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">{rec.receiptNo}</td>
                            <td className="py-3 px-4 text-slate-600">{rec.date}</td>
                            <td className="py-3 px-4 font-medium text-slate-700">
                              ₹{(rec.balanceDueBefore ?? rec.amount).toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4 font-bold text-emerald-700">
                              ₹{rec.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-700">
                              ₹{(rec.balanceDueAfter ?? 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-800">
                                {rec.paymentMode}
                              </span>
                              {rec.upiScreenshot && (
                                <button
                                  onClick={() =>
                                    setPreviewAttachment({
                                      title: `Attachment — ${rec.receiptNo}`,
                                      url: rec.upiScreenshot!,
                                    })
                                  }
                                  className="ml-2 text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
                                >
                                  View Attachment
                                </button>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setPreviewReceipt(rec)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold cursor-pointer"
                                >
                                  Preview
                                </button>
                                <button
                                  onClick={() => printSingleReceipt(rec, activeProfileMember)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-lg text-[11px] font-semibold cursor-pointer"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>Print</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {memberReceipts.length === 0 && (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-400">
                              No fee receipts recorded for this member yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: FEE FOLLOW-UPS */}
              {profileTab === 'followups' && (
                <div className="space-y-5">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Log Fee Deposit Call Follow-Up / Guardian Response
                    </h4>
                    <form onSubmit={handleProfileFollowUpSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Call Date *</label>
                        <input
                          type="date"
                          required
                          value={fuDate}
                          onChange={e => setFuDate(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Person Talked To *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Father (Rakesh Verma)"
                          value={fuPersonTalked}
                          onChange={e => setFuPersonTalked(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Next Follow-Up / Promised Date *</label>
                        <input
                          type="date"
                          required
                          value={fuPromisedDate}
                          onChange={e => setFuPromisedDate(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block font-bold text-slate-700 mb-1">Response Received *</label>
                        <input
                          type="text"
                          required
                          placeholder="What response was received from guardian/member..."
                          value={fuResponse}
                          onChange={e => setFuResponse(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer"
                        >
                          Save Follow-Up
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                          <th className="py-2.5 px-4">Call Date</th>
                          <th className="py-2.5 px-3">Person Talked To</th>
                          <th className="py-2.5 px-3">Response Received</th>
                          <th className="py-2.5 px-3">Promised Deposit Date</th>
                          <th className="py-2.5 px-3">Status</th>
                          {isAdmin && <th className="py-2.5 px-3 text-right">Delete</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {memberFollowUps.map(f => (
                          <tr key={f.id}>
                            <td className="py-2.5 px-4 font-mono">{f.callDate}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{f.personTalkedTo}</td>
                            <td className="py-2.5 px-3 text-slate-700">{f.responseReceived}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-rose-700">{f.promisedDate}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  f.status === 'Cleared'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {f.status}
                              </span>
                            </td>
                            {isAdmin && (
                              <td className="py-2.5 px-3 text-right">
                                {onDeleteFeeFollowUp && (
                                  <button
                                    onClick={() => onDeleteFeeFollowUp(f.id)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                        {memberFollowUps.length === 0 && (
                          <tr>
                            <td colSpan={isAdmin ? 6 : 5} className="py-6 text-center text-slate-400">
                              No fee follow-up calls recorded for this member.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB: DISCIPLINE & BEHAVIOUR */}
              {profileTab === 'discipline' && (
                <div className="space-y-5">
                  <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 space-y-3">
                    <h4 className="text-xs font-bold text-rose-950 uppercase tracking-wider">
                      Record Transit Mischief / Behaviour &amp; Discipline Irregularity
                    </h4>
                    <form onSubmit={handleProfileDisciplineSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Incident Date *</label>
                        <input
                          type="date"
                          required
                          value={discDate}
                          onChange={e => setDiscDate(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1">Mischief / Concern *</label>
                        <input
                          type="text"
                          required
                          placeholder="Describe mischief or concern during transit..."
                          value={discConcern}
                          onChange={e => setDiscConcern(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1">Action Taken *</label>
                        <input
                          type="text"
                          required
                          placeholder="Warning issued, guardian informed, seat reassigned..."
                          value={discActionTaken}
                          onChange={e => setDiscActionTaken(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer"
                        >
                          Save Discipline Record
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-3">Route / Vehicle</th>
                          <th className="py-2.5 px-3">Mischief / Concern</th>
                          <th className="py-2.5 px-3">Action Taken</th>
                          {isAdmin && <th className="py-2.5 px-3 text-right">Delete</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {memberDisciplines.map(d => (
                          <tr key={d.id}>
                            <td className="py-2.5 px-4 font-mono">{d.date}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              {d.routeName} {d.vehicleNumber && `(${d.vehicleNumber})`}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-rose-900">{d.concern}</td>
                            <td className="py-2.5 px-3 text-emerald-800 font-medium">{d.actionTaken}</td>
                            {isAdmin && (
                              <td className="py-2.5 px-3 text-right">
                                {onDeleteDisciplineRecord && (
                                  <button
                                    onClick={() => onDeleteDisciplineRecord(d.id)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                        {memberDisciplines.length === 0 && (
                          <tr>
                            <td colSpan={isAdmin ? 5 : 4} className="py-6 text-center text-slate-400">
                              No transit discipline concerns recorded for this member.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: FEE STRUCTURE */}
              {profileTab === 'fee_structure' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-xs text-slate-500">Linked Village &amp; Stop</span>
                      <div className="text-sm font-bold text-slate-900 mt-1">
                        {activeProfileMember.villageName}
                      </div>
                      <div className="text-xs text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {activeProfileMember.pickupDropStopName}
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-xs text-slate-500">Net Monthly Transport Rate</span>
                      <div className="text-xl font-bold text-slate-900 mt-1">
                        ₹{Math.max(0, activeProfileMember.monthlyFee - activeProfileMember.concessionAmount).toLocaleString('en-IN')}/mo
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Base: ₹{activeProfileMember.monthlyFee} • Concession: ₹{activeProfileMember.concessionAmount}
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                      <span className="text-xs text-amber-900 font-semibold">Auto-Debited Months Count</span>
                      <div className="text-2xl font-bold text-amber-950 mt-1">
                        {memberInvoices.length} Month(s)
                      </div>
                      <div className="text-[11px] text-amber-800">
                        Total Auto-Debited: ₹{memberInvoices.reduce((s, i) => s + i.netAmount, 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Monthly Auto-Debit Ledger History ({memberInvoices.length} Months)
                    </h5>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                            <th className="py-2.5 px-4">Invoice No</th>
                            <th className="py-2.5 px-4">Billing Month</th>
                            <th className="py-2.5 px-4">Base Fee</th>
                            <th className="py-2.5 px-4">Concession</th>
                            <th className="py-2.5 px-4">Auto-Debited Net</th>
                            <th className="py-2.5 px-4">Paid</th>
                            <th className="py-2.5 px-4">Balance</th>
                            <th className="py-2.5 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {memberInvoices.map(inv => (
                            <tr key={inv.id}>
                              <td className="py-2.5 px-4 font-mono font-semibold">{inv.invoiceNo}</td>
                              <td className="py-2.5 px-4 font-bold text-slate-900">{inv.month}</td>
                              <td className="py-2.5 px-4">₹{inv.baseFee}</td>
                              <td className="py-2.5 px-4">₹{inv.concession}</td>
                              <td className="py-2.5 px-4 font-bold">₹{inv.netAmount}</td>
                              <td className="py-2.5 px-4 text-emerald-700 font-semibold">₹{inv.paidAmount}</td>
                              <td className="py-2.5 px-4 text-rose-600 font-semibold">₹{inv.balanceDue}</td>
                              <td className="py-2.5 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    inv.status === 'Paid'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {memberInvoices.length === 0 && (
                            <tr>
                              <td colSpan={8} className="py-6 text-center text-slate-400">
                                No monthly auto-debit invoices generated yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ATTENDANCE */}
              {profileTab === 'attendance' && (() => {
                const sevenDaysAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
                const currentMonthPrefix = todayStr.slice(0, 7);
                const periodRecords = memberAttendance.filter(a => {
                  const recDate = a.date || '';
                  if (attendancePeriod === 'Daily') return recDate === todayStr;
                  if (attendancePeriod === 'Weekly') return recDate >= sevenDaysAgoStr && recDate <= todayStr;
                  if (attendancePeriod === 'Monthly') return recDate.startsWith(currentMonthPrefix);
                  return true; // Annual
                });

                const getEffectiveAttendanceStatus = (a: TripAttendanceRecord) => {
                  if (a.resolvedStatus && a.resolvedStatus !== 'Pending') return a.resolvedStatus;
                  if (a.assistantStatus && a.assistantStatus !== 'Pending') return a.assistantStatus;
                  if (a.driverStatus && a.driverStatus !== 'Pending') return a.driverStatus;
                  if (a.reconciliationStatus === 'Matched_Present') return 'Present';
                  if (a.reconciliationStatus === 'Matched_Absent') return 'Absent';
                  return 'Pending';
                };

                const presentTrips = periodRecords.filter(
                  a => getEffectiveAttendanceStatus(a) === 'Present'
                ).length;
                const absentOrLeaveTrips = periodRecords.filter(a => {
                  const st = getEffectiveAttendanceStatus(a);
                  return st === 'Absent' || st === 'Leave';
                }).length;
                const totalRecordedTrips = presentTrips + absentOrLeaveTrips;
                const attendanceRateStr =
                  totalRecordedTrips > 0
                    ? `${((presentTrips / totalRecordedTrips) * 100).toFixed(1)}%`
                    : '0% (No Records)';

                return (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">Transport Attendance Summary</h4>
                        <p className="text-[11px] text-slate-500">
                          Calculated strictly from recorded daily trip attendance logs
                        </p>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        {(['Daily', 'Weekly', 'Monthly', 'Annual'] as const).map(p => (
                          <button
                            key={p}
                            onClick={() => setAttendancePeriod(p)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                              attendancePeriod === p
                                ? 'bg-slate-900 text-amber-400 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-xs text-slate-500">{attendancePeriod} Recorded Trips</span>
                        <div className="text-xl font-bold text-slate-900 mt-1">
                          {totalRecordedTrips}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-xs text-emerald-800">Present Trips</span>
                        <div className="text-xl font-bold text-emerald-700 mt-1">
                          {presentTrips}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                        <span className="text-xs text-rose-800">Absent / Leave</span>
                        <div className="text-xl font-bold text-rose-700 mt-1">
                          {absentOrLeaveTrips}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                        <span className="text-xs text-blue-800">Attendance Rate</span>
                        <div className="text-xl font-bold text-blue-700 mt-1">
                          {attendanceRateStr}
                        </div>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                            <th className="py-2.5 px-4">Date</th>
                            <th className="py-2.5 px-3">Stop</th>
                            <th className="py-2.5 px-3">Driver Sheet</th>
                            <th className="py-2.5 px-3">Assistant App</th>
                            <th className="py-2.5 px-3">Final Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {periodRecords.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400">
                                No transport attendance has been recorded for this member in the selected period yet.
                              </td>
                            </tr>
                          ) : (
                            periodRecords.map(rec => {
                              const effStatus = getEffectiveAttendanceStatus(rec);
                              return (
                                <tr key={rec.id}>
                                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                                    {rec.date}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-700">{rec.stopName || activeProfileMember.pickupDropStopName}</td>
                                  <td className="py-2.5 px-3 font-medium text-slate-600">{rec.driverStatus}</td>
                                  <td className="py-2.5 px-3 font-medium text-slate-600">{rec.assistantStatus}</td>
                                  <td className="py-2.5 px-3">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        effStatus === 'Present'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : effStatus === 'Absent' || effStatus === 'Leave'
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      {effStatus}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 4: DOCUMENTS */}
              {profileTab === 'documents' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Upload Document</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={newDocType}
                        onChange={e => setNewDocType(e.target.value as DocumentAttachment['type'])}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                      >
                        <option value="School ID Card">School ID Card (Student)</option>
                        <option value="Aadhaar Card">Aadhaar Card</option>
                        <option value="PAN Card">PAN Card</option>
                        <option value="Permission Letter">Permission Letter</option>
                        <option value="Other">Other Document</option>
                      </select>
                      <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        <span>{uploadingDoc ? 'Uploading...' : 'Attach File'}</span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleProfileDocumentUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(activeProfileMember.documents || []).map(doc => (
                      <div
                        key={doc.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900">{doc.type}</div>
                            <div className="text-[11px] text-slate-500 truncate">{doc.name}</div>
                            <div className="text-[10px] text-slate-400">Uploaded: {doc.uploadedAt}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() =>
                              setPreviewAttachment({ title: `${activeProfileMember.name} — ${doc.type}`, url: doc.fileData || '' })
                            }
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            View
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteProfileDocument(doc.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {(activeProfileMember.documents || []).length === 0 && (
                      <div className="sm:col-span-2 py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                        No documents stored yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: SPECIAL */}
              {profileTab === 'special' && (
                <div className="space-y-6">
                  {formError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
                      <span>{formError}</span>
                      <button onClick={() => setFormError(null)} className="cursor-pointer"><X className="w-4 h-4" /></button>
                    </div>
                  )}

                  <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          Allow Transport Facility with Permission Letter
                        </h4>
                      </div>
                      {activeProfileMember.transportStatus === 'Suspended' && (
                        <button
                          onClick={() => onReactivateStudent(activeProfileMember.id, 'Full overdue balance cleared')}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                        >
                          Revoke Suspension (Dues Cleared)
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleGrantPermissionSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Stipulated Allowed-Until Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={permUntilDate}
                          onChange={e => setPermUntilDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Approved By *</label>
                        <input
                          type="text"
                          required
                          value={permApprovedBy}
                          onChange={e => setPermApprovedBy(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Attach Permission Letter (Compulsory) *
                        </label>
                        <label className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer hover:bg-slate-800">
                          <Upload className="w-3.5 h-3.5 text-amber-400" />
                          <span className="truncate">
                            {permFileName ? permFileName : 'Upload Signed Letter'}
                          </span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handlePermFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          required
                          value={permReason}
                          onChange={e => setPermReason(e.target.value)}
                          placeholder="Reason / Economic difficulty details..."
                          className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-xs"
                        >
                          {submitting ? 'Saving...' : 'Grant Permission & Allow Transport'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Pending Suspension Request Banner inside Special Tab */}
                  {activeProfileMember.pendingSuspensionRequest?.status === 'Pending Approval' && (
                    <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-950 text-xs font-bold">
                            Pending Admin Approval — Suspension Request
                          </span>
                          <span className="text-xs text-slate-600">
                            Requested by <strong>{activeProfileMember.pendingSuspensionRequest.requestedBy}</strong> on {activeProfileMember.pendingSuspensionRequest.requestedAt}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900">
                          Reason: “{activeProfileMember.pendingSuspensionRequest.reason}”
                        </p>
                      </div>
                      {isAdmin && onReviewSuspensionRequest && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => onReviewSuspensionRequest(activeProfileMember.id, 'Approve')}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve Suspension</span>
                          </button>
                          <button
                            onClick={() => onReviewSuspensionRequest(activeProfileMember.id, 'Reject', 'Declined by Admin')}
                            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Reject Request</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeProfileMember.transportStatus === 'Active' && onSuspendStudent && (
                    canInitiateSuspension ? (
                      <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-950">
                            {isAdmin
                              ? 'Suspend Member Transport Service (Valid Reason Mandatory)'
                              : 'Request Member Suspension (Sent to Admin for Approval — Valid Reason Mandatory)'}
                          </span>
                          <span className="text-[11px] font-semibold text-rose-700">
                            {isAdmin ? 'Admin Direct Authority' : 'Coordinator cannot suspend alone'}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                          <input
                            type="text"
                            value={suspendReasonInput}
                            onChange={e => setSuspendReasonInput(e.target.value)}
                            placeholder="Enter valid reason for suspending transport service (Mandatory)..."
                            className="w-full sm:flex-1 px-3.5 py-2 bg-white border border-rose-300 rounded-xl text-xs"
                          />
                          <button
                            onClick={() => {
                              const clean = suspendReasonInput.trim();
                              if (clean.length < 5) {
                                setFormError('Please enter a valid reason (at least 5 characters) before suspending.');
                                return;
                              }
                              setFormError(null);
                              onSuspendStudent(activeProfileMember.id, clean);
                              setSuspendReasonInput('');
                            }}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                          >
                            {isAdmin ? 'Suspend Transport' : 'Submit Suspension for Admin Approval'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 font-medium">
                        Note: Transport Assistant cannot suspend a member. Suspension can only be initiated by Transport Coordinator (with Admin approval) or Admin.
                      </div>
                    )
                  )}

                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                      Instances of Suspension &amp; Revocation History
                    </h5>
                    <div className="space-y-2.5">
                      {(activeProfileMember.specialHistory || []).map(evt => (
                        <div
                          key={evt.id}
                          className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  evt.eventType === 'Suspended'
                                    ? 'bg-rose-100 text-rose-800'
                                    : evt.eventType === 'Suspension_Requested'
                                    ? 'bg-amber-100 text-amber-900'
                                    : evt.eventType === 'Suspension_Rejected'
                                    ? 'bg-slate-200 text-slate-800'
                                    : evt.eventType === 'Revoked_Permission_Letter'
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {evt.eventType === 'Suspended'
                                  ? 'Suspended'
                                  : evt.eventType === 'Suspension_Requested'
                                  ? 'Suspension Requested (Pending Admin)'
                                  : evt.eventType === 'Suspension_Rejected'
                                  ? 'Suspension Request Rejected'
                                  : evt.eventType === 'Revoked_Permission_Letter'
                                  ? 'Revoked via Permission Letter'
                                  : 'Revoked (Dues Cleared)'}
                              </span>
                              <span className="text-xs font-semibold text-slate-600">{evt.date}</span>
                              <span className="text-[11px] text-slate-400">• By {evt.authorizedBy}</span>
                            </div>
                            <p className="text-xs text-slate-800 font-medium">{evt.reason}</p>
                            {evt.allowedUntilDate && (
                              <div className="text-[11px] text-amber-700 font-bold">
                                Stipulated Allowed Period Until: {evt.allowedUntilDate}
                              </div>
                            )}
                          </div>
                          {evt.letterAttachment && (
                            <button
                              onClick={() =>
                                setPreviewAttachment({
                                  title: `Permission Letter — ${activeProfileMember.name} (${evt.date})`,
                                  url: evt.letterAttachment!,
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Permission Letter</span>
                            </button>
                          )}
                        </div>
                      ))}
                      {(activeProfileMember.specialHistory || []).length === 0 && (
                        <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                          No instances of suspension or special permission recorded.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Standalone Add Discipline Issue Modal */}
      {showAddDisciplineModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900">Record Transit Discipline Issue</h3>
              </div>
              <button onClick={() => setShowAddDisciplineModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleStandaloneDisciplineSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Member *</label>
                <select
                  value={discMemberId}
                  onChange={e => setDiscMemberId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admissionNo}) — Class {s.class}-{s.section} • Route {s.routeCode}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={discDate}
                  onChange={e => setDiscDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mischief / Concern *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Describe behaviour or discipline concern in transit..."
                  value={discConcern}
                  onChange={e => setDiscConcern(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Action Taken *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parents informed, seat changed, written warning..."
                  value={discActionTaken}
                  onChange={e => setDiscActionTaken(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDisciplineModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT MEMBER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-5 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingId ? 'Edit Member Details' : 'Register New Transport Member'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt="Member DP"
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-500 shadow-xs"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-slate-200 border-2 border-dashed border-slate-400 flex items-center justify-center text-slate-500">
                      <Camera className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Member Display Picture (DP) * <span className="text-rose-600">(Compulsory)</span>
                    </span>
                  </div>
                </div>
                <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>{profilePhoto ? 'Change DP Photo' : 'Upload DP Photo *'}</span>
                  <input type="file" accept="image/*" onChange={handleDpUpload} className="hidden" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Member Type * <span className="text-[10px] font-normal text-slate-400">(Type or Select)</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="erp-member-types-list"
                    value={memberType}
                    onChange={e => setMemberType(e.target.value)}
                    placeholder="e.g. Student, Staff, Teacher"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:border-slate-900 focus:outline-hidden"
                  />
                  <datalist id="erp-member-types-list">
                    {memberTypes.map(m => (
                      <option key={m.id} value={m.name} />
                    ))}
                  </datalist>
                  {memberTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {memberTypes.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMemberType(m.name)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${
                            memberType === m.name
                              ? 'bg-slate-900 text-amber-400 border-slate-900'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Admission / Staff ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NEV2026123"
                    value={admissionNo}
                    onChange={e => setAdmissionNo(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold focus:border-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Campus * <span className="text-[10px] font-normal text-slate-400">(Type or Select)</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="erp-campuses-list"
                    value={campus}
                    onChange={e => setCampus(e.target.value)}
                    placeholder="e.g. Sr, Jr, Main Campus"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:border-slate-900 focus:outline-hidden"
                  />
                  <datalist id="erp-campuses-list">
                    {campuses.map(c => (
                      <option key={c.id} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </datalist>
                  {campuses.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {campuses.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCampus(c.code)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${
                            campus === c.code
                              ? 'bg-slate-900 text-amber-400 border-slate-900'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {c.name} ({c.code})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:border-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender *</label>
                  <select
                    required
                    value={gender}
                    onChange={e => setGender(e.target.value as 'M' | 'F' | 'Other')}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:border-slate-900 focus:outline-hidden cursor-pointer"
                  >
                    <option value="M">Male (M)</option>
                    <option value="F">Female (F)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Class / Role * <span className="text-[10px] font-normal text-slate-400">(Type or Select)</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="erp-classes-list"
                    value={studentClass}
                    onChange={e => setStudentClass(e.target.value)}
                    placeholder="e.g. Class X, LKG, Teacher"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:border-slate-900 focus:outline-hidden"
                  />
                  <datalist id="erp-classes-list">
                    {classes.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Section <span className="text-[10px] font-normal text-slate-400">(Type or Select)</span>
                  </label>
                  <input
                    type="text"
                    list="erp-sections-list"
                    value={section}
                    onChange={e => setSection(e.target.value)}
                    placeholder="e.g. A, B, Science"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:border-slate-900 focus:outline-hidden"
                  />
                  <datalist id="erp-sections-list">
                    {sections.map(sec => (
                      <option key={sec} value={sec} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Father / Guardian Name</label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={e => setFatherName(e.target.value)}
                    placeholder="Guardian Name"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    placeholder="10-digit Mobile"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="House / Ward / Locality"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              {memberType.toLowerCase().includes('student') && !editingId && (
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between gap-3">
                  <div className="text-xs text-blue-900">
                    <strong>Student Document:</strong> Attach School ID Card
                    {schoolIdDoc && <span className="ml-2 text-emerald-700 font-bold">✓ {schoolIdDoc.name}</span>}
                  </div>
                  <label className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0">
                    <span>Attach School ID Card</span>
                    <input type="file" accept="image/*,.pdf" onChange={handleInitialSchoolIdUpload} className="hidden" />
                  </label>
                </div>
              )}

              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 space-y-3">
                <div className="text-xs font-bold text-amber-900">
                  Transport Stop &amp; Route Assignment
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      1. Select Village (A–Z) *
                    </label>
                    <select
                      required
                      value={selectedVillageId}
                      onChange={e => handleVillageSelect(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:border-slate-900 focus:outline-hidden"
                    >
                      <option value="">-- Select Village (A–Z) --</option>
                      {sortedVillages.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name} (₹{v.monthlyRate || v.stops?.[0]?.fee || 700}/mo)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      2. Pickup &amp; Drop Stop (A–Z) *
                    </label>
                    <select
                      required={availableStops.length > 0}
                      value={selectedStopId}
                      onChange={e => handleStopSelect(e.target.value)}
                      disabled={!selectedVillageId}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-400 focus:border-slate-900 focus:outline-hidden"
                    >
                      <option value="">
                        {selectedVillageId ? '-- Select Stop (A–Z) --' : '-- Select Village First --'}
                      </option>
                      {availableStops.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} (₹{s.fee})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      3. Assigned Route (Auto-Attached by Stop)
                    </label>
                    <select
                      value={selectedRouteId}
                      onChange={e => setSelectedRouteId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold"
                    >
                      <option value="">-- Unassigned / Select Route --</option>
                      {(availableRoutes.length > 0 ? availableRoutes : routes).map(r => (
                        <option key={r.id} value={r.id}>
                          {r.code} ({r.vehicleNumber || 'No Vehicle'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {editingId && (() => {
                  const prevMember = students.find(s => s.id === editingId);
                  if (!prevMember) return null;
                  const newRouteObj = routes.find(r => r.id === selectedRouteId);
                  const newRouteCode = newRouteObj?.code || 'Unassigned';
                  const oldRouteCode = prevMember.routeCode || 'Unassigned';
                  const newVilName = selectedVillage?.name || customVillageName || prevMember.villageName;
                  const newStopName =
                    availableStops.find(s => s.id === selectedStopId)?.name ||
                    customStopName ||
                    prevMember.pickupDropStopName ||
                    prevMember.pickupStopName;
                  const oldStopName = prevMember.pickupDropStopName || prevMember.pickupStopName;
                  if (
                    oldRouteCode === newRouteCode &&
                    prevMember.villageName === newVilName &&
                    oldStopName === newStopName
                  ) {
                    return null;
                  }
                  return (
                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-indigo-950">
                        Village / Stop Route Re-Attachment Preview:
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                          Old: <strong>{prevMember.villageName}</strong> ({oldStopName}) →{' '}
                          <span className="font-mono font-bold">{oldRouteCode}</span>
                        </span>
                        <span className="text-indigo-600 font-bold">→</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-900">
                          New: <strong>{newVilName}</strong> ({newStopName}) →{' '}
                          <span className="font-mono font-bold">{newRouteCode}</span>
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Base Fee (₹)</label>
                    <input
                      type="number"
                      value={monthlyFee}
                      onChange={e => setMonthlyFee(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Concession (₹)</label>
                    <input
                      type="number"
                      value={concessionAmount}
                      onChange={e => setConcessionAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Member Transport Status *</label>
                    <select
                      value={memberStatusInput}
                      onChange={e => setMemberStatusInput(e.target.value as StudentMember['transportStatus'])}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    >
                      <option value="Active">Active (Included in Auto-Fee)</option>
                      <option value="Left">Left School / Service (Excluded from Auto-Fee)</option>
                      <option value="Needs Setup">Needs Setup</option>
                      {canInitiateSuspension && <option value="Suspended">Suspended (Included in Auto-Fee)</option>}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Member' : 'Save Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {previewReceipt && activeProfileMember && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Fee Receipt Preview</h3>
                <p className="text-xs font-mono text-slate-500">{previewReceipt.receiptNo}</p>
              </div>
              <button onClick={() => setPreviewReceipt(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Member:</span>
                <span className="font-bold text-slate-900">{activeProfileMember.name} ({activeProfileMember.admissionNo})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-semibold text-slate-800">{previewReceipt.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Dues Before Payment:</span>
                <span className="font-semibold text-slate-800">₹{(previewReceipt.balanceDueBefore ?? previewReceipt.amount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
                <span className="font-bold text-slate-900">Amount Paid ({previewReceipt.paymentMode}):</span>
                <span className="font-bold text-emerald-700">₹{previewReceipt.amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Balance Due After Payment:</span>
                <span className="font-bold text-rose-600">₹{(previewReceipt.balanceDueAfter ?? 0).toLocaleString('en-IN')}</span>
              </div>
              {previewReceipt.referenceNo && (
                <div className="flex justify-between">
                  <span className="text-slate-500">UTR / Ref No:</span>
                  <span className="font-mono font-semibold">{previewReceipt.referenceNo}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPreviewReceipt(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => printSingleReceipt(previewReceipt, activeProfileMember)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-amber-400 text-xs font-bold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt Again</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document / Attachment Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">{previewAttachment.title}</h3>
              <button onClick={() => setPreviewAttachment(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-100 rounded-xl p-4 flex items-center justify-center max-h-[70vh] overflow-auto">
              <img
                src={previewAttachment.url}
                alt={previewAttachment.title}
                className="max-w-full max-h-[62vh] object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
      {/* SUSPEND MEMBER / REQUEST SUSPENSION MODAL (Enforces Valid Reason & Approval Mechanism) */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {isAdmin ? 'Suspend Transport Member' : 'Request Member Suspension (Requires Admin Approval)'}
                </h3>
              </div>
              <button
                onClick={() => setShowSuspendModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Concise modal header without verbose text */}

            {suspendModalError && (
              <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                <span>{suspendModalError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmSuspendModal} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Member *</label>
                <select
                  value={suspendTargetMemberId}
                  onChange={e => setSuspendTargetMemberId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                >
                  {students
                    .filter(s => s.transportStatus !== 'Suspended' || s.id === suspendTargetMemberId)
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.admissionNo}) — Class {s.class}-{s.section} • Route {s.routeCode} • Due: ₹{s.balanceDue}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Valid Reason for Suspension * <span className="text-rose-600">(Compulsory)</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={suspendModalReason}
                  onChange={e => setSuspendModalReason(e.target.value)}
                  placeholder="Enter a clear, valid reason for suspending this member (e.g., Overdue fees unpaid after warning notice / severe transit indiscipline)..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSuspendModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  {submitting
                    ? 'Submitting...'
                    : isAdmin
                    ? 'Confirm & Suspend Member'
                    : 'Submit for Admin Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STANDALONE REVOKE SUSPENSION / GRANT PERMISSION LETTER MODAL (Before or After Suspension) */}
      {showRevokePermModal && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Revoke Suspension / Record Permission Letter
                </h3>
              </div>
              <button
                onClick={() => setShowRevokePermModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Concise modal header without verbose text */}

            {revokePermError && (
              <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                <span>{revokePermError}</span>
              </div>
            )}

            <form onSubmit={handleStandaloneRevokePermSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Member *</label>
                <select
                  value={revokePermTargetId}
                  onChange={e => setRevokePermTargetId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-semibold"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admissionNo}) — [{s.transportStatus}] • Due: ₹{s.balanceDue}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Allowed Until Date *</label>
                  <input
                    type="date"
                    required
                    value={revokePermUntilDate}
                    onChange={e => setRevokePermUntilDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Approved By *</label>
                  <input
                    type="text"
                    required
                    value={revokePermApprovedBy}
                    onChange={e => setRevokePermApprovedBy(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Attach Signed Permission Letter (Compulsory) *
                </label>
                <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer">
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span>{revokePermFileName ? revokePermFileName : 'Upload Signed Permission Application / Letter'}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleRevokePermFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason / Extension Remarks *</label>
                <textarea
                  rows={2}
                  required
                  value={revokePermReason}
                  onChange={e => setRevokePermReason(e.target.value)}
                  placeholder="Enter reason for granting permission extension / revoking suspension..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRevokePermModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  {submitting ? 'Saving...' : 'Save Permission & Revoke/Protect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

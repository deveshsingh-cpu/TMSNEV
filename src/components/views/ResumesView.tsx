import React, { useState } from 'react';
import {
  FileText, Plus, Search, Phone, MapPin, ShieldCheck,
  AlertTriangle, CheckCircle, UserPlus, Edit2, Trash2,
  Upload, Eye, X, RotateCcw, Briefcase, IndianRupee
} from 'lucide-react';
import { CandidateResume, DesignationMaster, DocumentAttachment, ResumeStatus } from '../../types/index.js';
import { PrintExportToolbar, FilterPopover } from '../../utils/exportPrint.js';
import { readFileCompressed } from '../../utils/fileCompressor.js';

interface ResumesViewProps {
  resumes: CandidateResume[];
  designations: DesignationMaster[];
  isAdmin?: boolean;
  onSaveResume: (resume: Partial<CandidateResume>) => Promise<void>;
  onDeleteResume?: (id: string) => Promise<void>;
  onHireResume: (resumeId: string, salaryOverride?: number, designationIdOverride?: string) => Promise<void>;
  onNavigateToEmployees?: () => void;
}

export const ResumesView: React.FC<ResumesViewProps> = ({
  resumes,
  designations,
  isAdmin = true,
  onSaveResume,
  onDeleteResume,
  onHireResume,
  onNavigateToEmployees,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Onboarding modal state
  const [hiringCandidate, setHiringCandidate] = useState<CandidateResume | null>(null);
  const [hireSalary, setHireSalary] = useState<number>(14000);
  const [hireDesignationId, setHireDesignationId] = useState<string>('');

  // Preview attachment state
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(28);
  const [gender, setGender] = useState<'M' | 'F' | 'Other'>('M');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [educationQualification, setEducationQualification] = useState('12th Standard');
  const [appliedDesignation, setAppliedDesignation] = useState('Driver');
  const [isDriver, setIsDriver] = useState(true);
  const [drivingLicenseNo, setDrivingLicenseNo] = useState('');
  const [drivingLicenseValidity, setDrivingLicenseValidity] = useState('2029-12-31');
  const [drivingLicenseType, setDrivingLicenseType] = useState('Heavy Passenger Vehicle (HMV)');
  const [minExpectedSalary, setMinExpectedSalary] = useState<number>(13500);
  const [experience, setExperience] = useState('');
  const [policeRecord, setPoliceRecord] = useState('None / Clean');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ResumeStatus>('Resume received');
  const [documents, setDocuments] = useState<DocumentAttachment[]>([]);
  const [docTypeInput, setDocTypeInput] = useState<DocumentAttachment['type']>('Resume');

  const isFiltered = searchQuery.trim() !== '' || statusFilter !== 'all' || roleFilter !== 'all';

  const filteredResumes = resumes.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (roleFilter === 'driver' && !r.isDriver) return false;
    if (roleFilter === 'non_driver' && r.isDriver) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.candidateCode.toLowerCase().includes(q) ||
        r.mobile.toLowerCase().includes(q) ||
        r.appliedDesignation.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q) ||
        (r.drivingLicenseNo || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openAddModal = () => {
    setErrorBanner(null);
    setEditingId(null);
    setName('');
    setAge(28);
    setGender('M');
    setMobile('');
    setAddress('');
    setFatherName('');
    setEducationQualification('12th Standard');
    const defaultDes = designations[0]?.name || 'Driver';
    setAppliedDesignation(defaultDes);
    setIsDriver(defaultDes.toLowerCase().includes('driver'));
    setDrivingLicenseNo('');
    setDrivingLicenseValidity('2029-12-31');
    setDrivingLicenseType('Heavy Passenger Vehicle (HMV)');
    setMinExpectedSalary(13500);
    setExperience('');
    setPoliceRecord('None / Clean');
    setDescription('');
    setStatus('Resume received');
    setDocuments([]);
    setShowModal(true);
  };

  const openEditModal = (r: CandidateResume) => {
    setErrorBanner(null);
    setEditingId(r.id);
    setName(r.name);
    setAge(r.age);
    setGender(r.gender);
    setMobile(r.mobile);
    setAddress(r.address);
    setFatherName(r.fatherName || '');
    setEducationQualification(r.educationQualification || '12th Standard');
    setAppliedDesignation(r.appliedDesignation);
    setIsDriver(r.isDriver);
    setDrivingLicenseNo(r.drivingLicenseNo || '');
    setDrivingLicenseValidity(r.drivingLicenseValidity || '2029-12-31');
    setDrivingLicenseType(r.drivingLicenseType || 'Heavy Passenger Vehicle (HMV)');
    setMinExpectedSalary(r.minExpectedSalary);
    setExperience(r.experience);
    setPoliceRecord(r.policeRecord);
    setDescription(r.description || '');
    setStatus(r.status);
    setDocuments(r.documents || []);
    setShowModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await readFileCompressed(file, 900, 0.72);
      const newDoc: DocumentAttachment = {
        id: `doc-${Date.now()}`,
        type: docTypeInput,
        name: file.name,
        fileData: result,
        uploadedAt: new Date().toISOString().split('T')[0],
      };
      setDocuments(prev => [...prev, newDoc]);
    } catch {
      setErrorBanner('Failed to process uploaded file.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    if (!name.trim() || !age || !gender || !mobile.trim() || !address.trim()) {
      setErrorBanner('Name, Age, Sex, Phone No., and Address are mandatory fields.');
      return;
    }
    if (isDriver && !drivingLicenseNo.trim()) {
      setErrorBanner('Driving License Number (DL No.) is mandatory for Driver candidates.');
      return;
    }

    setSubmitting(true);
    try {
      await onSaveResume({
        id: editingId || undefined,
        name: name.trim(),
        age: Number(age),
        gender,
        mobile: mobile.trim(),
        address: address.trim(),
        fatherName: fatherName.trim(),
        educationQualification,
        appliedDesignation,
        isDriver,
        drivingLicenseNo: isDriver ? drivingLicenseNo.trim() : undefined,
        drivingLicenseValidity: isDriver ? drivingLicenseValidity : undefined,
        drivingLicenseType: isDriver ? drivingLicenseType : undefined,
        minExpectedSalary: Number(minExpectedSalary) || 0,
        experience: experience.trim(),
        policeRecord: policeRecord.trim() || 'None',
        description: description.trim(),
        status,
        documents,
      });
      setShowModal(false);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to save resume');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (resume: CandidateResume, newStatus: ResumeStatus) => {
    setErrorBanner(null);
    try {
      await onSaveResume({ ...resume, status: newStatus });
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to update status');
    }
  };

  const handleConfirmHire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hiringCandidate) return;
    setErrorBanner(null);
    setSubmitting(true);
    try {
      await onHireResume(hiringCandidate.id, hireSalary, hireDesignationId || undefined);
      setSuccessBanner(`Candidate "${hiringCandidate.name}" has been onboarded into Employees!`);
      setHiringCandidate(null);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to onboard candidate');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {errorBanner && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <div className="flex items-center gap-2">
            {onNavigateToEmployees && (
              <button
                onClick={onNavigateToEmployees}
                className="px-3 py-1 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
              >
                View in 2- Employees
              </button>
            )}
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header & Unified Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-bold text-slate-900">Candidate Resumes</h2>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
            {filteredResumes.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-1 lg:max-w-3xl justify-end">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search name, phone, DL No., address..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <FilterPopover
            activeCount={(statusFilter !== 'all' ? 1 : 0) + (roleFilter !== 'all' ? 1 : 0)}
            onReset={() => {
              setStatusFilter('all');
              setRoleFilter('all');
            }}
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="Resume received">Resume received</option>
                <option value="Eligible">Eligible</option>
                <option value="Not eligible">Not eligible</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Role Category</label>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
              >
                <option value="all">All Roles</option>
                <option value="driver">Drivers Only (With DL No.)</option>
                <option value="non_driver">Helpers &amp; Support Staff</option>
              </select>
            </div>
          </FilterPopover>

          <PrintExportToolbar
            title="Candidate Resumes & Recruitment Pool"
            filename="Candidate_Resumes_Pool"
            isFiltered={isFiltered}
            filteredRows={filteredResumes}
            allRows={resumes}
            columns={[
              { header: 'Code', accessor: r => r.candidateCode },
              { header: 'Candidate Name', accessor: r => r.name },
              { header: 'Age / Sex', accessor: r => `${r.age} / ${r.gender}` },
              { header: 'Phone No', accessor: r => r.mobile },
              { header: 'Address', accessor: r => r.address },
              { header: 'Role Applied', accessor: r => r.appliedDesignation },
              { header: 'DL No.', accessor: r => r.drivingLicenseNo || 'N/A' },
              { header: 'Min Expected Salary', accessor: r => `Rs. ${r.minExpectedSalary}` },
              { header: 'Experience', accessor: r => r.experience },
              { header: 'Police Record', accessor: r => r.policeRecord },
              { header: 'Status', accessor: r => r.status },
            ]}
          />
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Resume</span>
          </button>
        </div>
      </div>

      {/* Resumes Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Candidate Details</th>
                <th className="py-3.5 px-4">Role & DL No.</th>
                <th className="py-3.5 px-4">Min Expected Salary & Exp</th>
                <th className="py-3.5 px-4">Police Record & Notes</th>
                <th className="py-3.5 px-4">Documents</th>
                <th className="py-3.5 px-4">Eligibility Status</th>
                <th className="py-3.5 px-4 text-right">Call for Work / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {filteredResumes.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {r.candidateCode}
                      </span>
                      <span className="font-bold text-slate-900">{r.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                      <span>Age: <strong>{r.age}</strong> ({r.gender})</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                        <Phone className="w-3 h-3 text-slate-400" /> {r.mobile}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" /> {r.address}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        r.isDriver ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Briefcase className="w-3 h-3" /> {r.appliedDesignation}
                    </span>
                    {r.isDriver && (
                      <div className="mt-1.5 space-y-0.5">
                        <div className="font-mono text-[11px] font-bold text-slate-800">
                          DL: {r.drivingLicenseNo}
                        </div>
                        {r.drivingLicenseValidity && (
                          <div className="text-[10px] text-slate-500">
                            Valid till: {r.drivingLicenseValidity}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 flex items-center gap-0.5 text-sm">
                      <IndianRupee className="w-3.5 h-3.5 text-slate-500" />
                      {r.minExpectedSalary.toLocaleString('en-IN')}/mo
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      Exp: <span className="font-medium">{r.experience || 'Fresher'}</span>
                    </div>
                    {r.educationQualification && (
                      <div className="text-[10px] text-slate-400">Edu: {r.educationQualification}</div>
                    )}
                  </td>

                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck
                        className={`w-3.5 h-3.5 shrink-0 ${
                          r.policeRecord.toLowerCase().includes('none') ||
                          r.policeRecord.toLowerCase().includes('clean')
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }`}
                      />
                      <span className="font-semibold text-slate-800">{r.policeRecord || 'None'}</span>
                    </div>
                    {r.description && (
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{r.description}</p>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    {r.documents && r.documents.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {r.documents.map(doc => (
                          <button
                            key={doc.id}
                            onClick={() => setPreviewDoc({ title: `${r.name} — ${doc.type}`, url: doc.fileData || '' })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-semibold cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{doc.type}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">No files</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <select
                      value={r.status}
                      onChange={e => handleQuickStatusChange(r, e.target.value as ResumeStatus)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        r.status === 'Eligible'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : r.status === 'Not eligible'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      <option value="Resume received">Resume received</option>
                      <option value="Eligible">Eligible</option>
                      <option value="Not eligible">Not eligible</option>
                    </select>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {r.hiredEmployeeId ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          <CheckCircle className="w-3.5 h-3.5" /> Onboarded
                        </span>
                      ) : r.status === 'Eligible' ? (
                        isAdmin ? (
                          <button
                            onClick={() => {
                              setHiringCandidate(r);
                              setHireSalary(r.minExpectedSalary || 14000);
                              const matchedDes = designations.find(
                                d => d.name.toLowerCase() === r.appliedDesignation.toLowerCase()
                              );
                              setHireDesignationId(matchedDes?.id || designations[0]?.id || '');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold shadow-xs cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Onboard Employee</span>
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold">
                            Admin Only Onboarding
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] text-slate-400 italic pr-1">
                          Mark Eligible to Onboard
                        </span>
                      )}

                      <button
                        onClick={() => openEditModal(r)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Edit Candidate Resume"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {onDeleteResume && !r.hiredEmployeeId && (
                        <button
                          onClick={async () => {
                            try {
                              await onDeleteResume(r.id);
                            } catch (err: any) {
                              setErrorBanner(err.message || 'Cannot delete resume');
                            }
                          }}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Delete Resume"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredResumes.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    No candidate resumes match the current filter. Click "+ Add Candidate Resume" to feed a new candidate.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Candidate Resume Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-5 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingId ? 'Edit Candidate Resume' : 'Feed New Candidate Resume'}
                </h3>
                <p className="text-xs text-slate-500">
                  Fields marked with * (Name, Age, Sex, Phone No, Address, and DL No. for Drivers) are mandatory.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Candidate Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g., Dinesh Chandra"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status *</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as ResumeStatus)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    <option value="Resume received">Resume received</option>
                    <option value="Eligible">Eligible</option>
                    <option value="Not eligible">Not eligible</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Age (Years) *</label>
                  <input
                    type="number"
                    required
                    min={18}
                    max={70}
                    value={age}
                    onChange={e => setAge(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sex *</label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value as 'M' | 'F' | 'Other')}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  >
                    <option value="M">Male (M)</option>
                    <option value="F">Female (F)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone No. *</label>
                  <input
                    type="text"
                    required
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    placeholder="10-digit Mobile No."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address *</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Full Village / Ward / House Address"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Father's / Spouse Name</label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={e => setFatherName(e.target.value)}
                    placeholder="Father's Name"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role / Designation Applied *</label>
                  <select
                    value={appliedDesignation}
                    onChange={e => {
                      const val = e.target.value;
                      setAppliedDesignation(val);
                      const desObj = designations.find(d => d.name === val);
                      setIsDriver(desObj ? desObj.isDriver : val.toLowerCase().includes('driver'));
                    }}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  >
                    {designations.map(d => (
                      <option key={d.id} value={d.name}>
                        {d.name} {d.isDriver ? '(Driver)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Expected Salary (₹) *</label>
                  <input
                    type="number"
                    required
                    value={minExpectedSalary}
                    onChange={e => setMinExpectedSalary(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Experience *</label>
                  <input
                    type="text"
                    required
                    value={experience}
                    onChange={e => setExperience(e.target.value)}
                    placeholder="e.g., 5 Years school bus driving"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              {isDriver && (
                <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-amber-950 mb-1">Driving License (DL No.) *</label>
                    <input
                      type="text"
                      required
                      value={drivingLicenseNo}
                      onChange={e => setDrivingLicenseNo(e.target.value)}
                      placeholder="e.g., UP70-20180045112"
                      className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-950 mb-1">DL Validity Date</label>
                    <input
                      type="date"
                      value={drivingLicenseValidity}
                      onChange={e => setDrivingLicenseValidity(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-950 mb-1">License Category</label>
                    <input
                      type="text"
                      value={drivingLicenseType}
                      onChange={e => setDrivingLicenseType(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Any Police Record *</label>
                  <input
                    type="text"
                    required
                    value={policeRecord}
                    onChange={e => setPoliceRecord(e.target.value)}
                    placeholder="e.g., None / Clean Verification"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Education Qualification</label>
                  <input
                    type="text"
                    value={educationQualification}
                    onChange={e => setEducationQualification(e.target.value)}
                    placeholder="e.g., 10th / 12th Pass"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Interview Remarks</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Reference details, route familiarity, availability notice period..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              {/* Document / Resume Attachment Upload */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">Attach Resume / DL / ID Proofs (Google Drive Archive)</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={docTypeInput}
                      onChange={e => setDocTypeInput(e.target.value as DocumentAttachment['type'])}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      <option value="Resume">Resume / CV</option>
                      <option value="Driving License">Driving License</option>
                      <option value="Aadhaar Card">Aadhaar Card</option>
                      <option value="PAN Card">PAN Card</option>
                      <option value="Other">Police Verification / Other</option>
                    </select>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-800">
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload File</span>
                      <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>
                {documents.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {documents.map(d => (
                      <div
                        key={d.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-medium text-slate-700">{d.type}: {d.name}</span>
                        <button
                          type="button"
                          onClick={() => setDocuments(prev => prev.filter(x => x.id !== d.id))}
                          className="text-rose-500 hover:text-rose-700 ml-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Resume' : 'Save Candidate Resume'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Call for Work / Onboard to Employees Modal */}
      {hiringCandidate && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Call for Work & Add to Employees</h3>
                <p className="text-xs text-slate-500">
                  Onboarding eligible candidate <strong>{hiringCandidate.name}</strong> ({hiringCandidate.candidateCode})
                </p>
              </div>
              <button onClick={() => setHiringCandidate(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmHire} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div><strong>Candidate:</strong> {hiringCandidate.name} ({hiringCandidate.age} yrs, {hiringCandidate.gender})</div>
                <div><strong>Phone:</strong> {hiringCandidate.mobile}</div>
                <div><strong>Min Expected Salary:</strong> ₹{hiringCandidate.minExpectedSalary.toLocaleString('en-IN')}/mo</div>
                {hiringCandidate.isDriver && (
                  <div><strong>Driving License:</strong> {hiringCandidate.drivingLicenseNo}</div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Designation in System *</label>
                <select
                  value={hireDesignationId}
                  onChange={e => setHireDesignationId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                >
                  {designations.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.isDriver ? '(Driver)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Approved Monthly Base Salary (₹) *</label>
                <input
                  type="number"
                  required
                  value={hireSalary}
                  onChange={e => setHireSalary(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setHiringCandidate(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  {submitting ? 'Onboarding...' : 'Confirm & Add to Employees'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">{previewDoc.title}</h3>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-center border border-slate-200">
              <img src={previewDoc.url} alt={previewDoc.title} className="max-h-96 object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

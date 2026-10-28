import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { Institution } from '../../types/index.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Modal } from '../../components/common/Modal.js';
import {
  Building2,
  MapPin,
  Globe,
  Award,
  Users,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Edit3,
  Search,
  Filter,
} from 'lucide-react';

export const InstitutionsPage: React.FC = () => {
  const { role, user } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInst, setSelectedInst] = useState<Institution | null>(null);
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Institution>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchInstitutions = async () => {
    try {
      setIsLoading(true);
      const res = await api.getInstitutions();
      setInstitutions(res.institutions);
      if (res.institutions.length > 0 && !selectedInst) {
        setSelectedInst(res.institutions[0]);
      }
    } catch (err) {
      console.error('Failed to load institutions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutions();
  }, [role, user]);

  const handleSaveEdit = async () => {
    if (!selectedInst) return;
    try {
      const res = await api.updateInstitution(selectedInst.id, editForm);
      setSelectedInst(res.institution);
      setInstitutions(prev => prev.map(i => (i.id === res.institution.id ? res.institution : i)));
      setIsEditOpen(false);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const filtered = institutions.filter(i => {
    const matchesSearch =
      i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase());
    const matchesState = filterState ? i.state === filterState : true;
    return matchesSearch && matchesState;
  });

  return (
    <div className="p-4 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-white p-4 sm:p-5 rounded-lg border border-[#D9E7E4] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#0D9488] uppercase tracking-wider">
              {role === 'COLLEGE_MANAGEMENT' ? 'Institutional Profile' : 'Regulatory Directory'}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D] font-medium border border-[#86EFAC]/60">
              {role === 'COLLEGE_MANAGEMENT' ? 'Tenant Authenticated' : `${institutions.length} Institutions`}
            </span>
          </div>
          <h1 className="text-lg font-semibold text-[#193A39] mt-1">
            {role === 'COLLEGE_MANAGEMENT'
              ? selectedInst?.name || 'My Institution'
              : 'AICTE Recognized Technical Institutions'}
          </h1>
          <p className="text-xs text-[#647A78] mt-0.5">
            {role === 'COLLEGE_MANAGEMENT'
              ? 'Authorized institution profile details, infrastructure acreage, student capacity, and leadership contacts.'
              : 'Directory of authorized engineering, technology, management, and pharmacy colleges.'}
          </p>
        </div>

        {(role === 'COLLEGE_MANAGEMENT' || role === 'AICTE_ADMIN') && selectedInst && (
          <button
            onClick={() => {
              setEditForm(selectedInst);
              setIsEditOpen(true);
            }}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Update Profile</span>
          </button>
        )}
      </div>

      {/* Multi-tenant Verification Notice for Admins / Officers */}
      {role !== 'COLLEGE_MANAGEMENT' && (
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#647A78]" />
            <input
              type="text"
              placeholder="Search by institution name or AICTE permanent code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#D9E7E4] rounded-md text-xs text-[#193A39] placeholder-[#647A78] focus:outline-hidden focus:border-[#0D9488]"
            />
          </div>
          <select
            value={filterState}
            onChange={e => setFilterState(e.target.value)}
            className="bg-white border border-[#D9E7E4] px-3 py-1.5 rounded-md text-xs text-[#193A39] focus:outline-hidden focus:border-[#0D9488]"
          >
            <option value="">All States</option>
            <option value="Uttar Pradesh">Uttar Pradesh</option>
            <option value="Karnataka">Karnataka</option>
          </select>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left List (For Admin & Officers) */}
        {role !== 'COLLEGE_MANAGEMENT' && (
          <div className="space-y-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#647A78]">Institutions List</h2>
            {filtered.map(inst => {
              const isSelected = selectedInst?.id === inst.id;
              return (
                <div
                  key={inst.id}
                  onClick={() => setSelectedInst(inst)}
                  className={`p-3.5 rounded-lg border transition-all cursor-pointer bg-white ${
                    isSelected
                      ? 'border-[#115E59] shadow-xs ring-1 ring-[#115E59]/20'
                      : 'border-[#D9E7E4] hover:border-[#0D9488]/60 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-xs text-[#193A39] line-clamp-1">{inst.name}</span>
                    <StatusBadge status={inst.status} />
                  </div>
                  <div className="mt-1.5 text-[11px] text-[#647A78] space-y-1">
                    <div className="flex items-center gap-1 font-mono text-[#115E59]">
                      <ShieldCheck className="w-3 h-3 text-[#0D9488]" />
                      <span>{inst.code}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>{inst.district}, {inst.state}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Right / Full Institution Profile Card */}
        <div className={`${role === 'COLLEGE_MANAGEMENT' ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-5`}>
          {selectedInst ? (
            <div className="bg-white rounded-lg border border-[#D9E7E4] shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[#D9E7E4] bg-[#F3F8F7]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#115E59] bg-white px-2 py-0.5 rounded border border-[#D9E7E4]">
                      {selectedInst.code}
                    </span>
                    <StatusBadge status={selectedInst.status} />
                  </div>
                  <h2 className="text-base font-semibold text-[#193A39] mt-2">{selectedInst.name}</h2>
                  <p className="text-xs text-[#647A78] flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0D9488]" />
                    <span>{selectedInst.address}, {selectedInst.district}, {selectedInst.state} — {selectedInst.pincode}</span>
                  </p>
                </div>

                {/* Profile Completeness Gauge */}
                <div className="text-right sm:border-l sm:border-[#D9E7E4] sm:pl-5">
                  <div className="text-[11px] text-[#647A78]">Profile Completeness</div>
                  <div className="text-xl font-bold text-[#115E59]">{selectedInst.profileCompleteness}%</div>
                  <div className="w-24 bg-[#D9E7E4] h-1.5 rounded-full mt-1 overflow-hidden">
                    <div
                      className="bg-[#0D9488] h-full rounded-full"
                      style={{ width: `${selectedInst.profileCompleteness}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Detail Metrics */}
              <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 border-b border-[#D9E7E4] bg-white">
                <div className="p-2.5 bg-[#F3F8F7] rounded-md border border-[#D9E7E4]/50">
                  <span className="text-[10px] font-medium text-[#647A78] uppercase">Established Year</span>
                  <p className="text-sm font-semibold text-[#193A39] mt-0.5">{selectedInst.establishedYear}</p>
                </div>
                <div className="p-2.5 bg-[#F3F8F7] rounded-md border border-[#D9E7E4]/50">
                  <span className="text-[10px] font-medium text-[#647A78] uppercase">Campus Area</span>
                  <p className="text-sm font-semibold text-[#193A39] mt-0.5">{selectedInst.campusAreaAcres} Acres</p>
                </div>
                <div className="p-2.5 bg-[#F3F8F7] rounded-md border border-[#D9E7E4]/50">
                  <span className="text-[10px] font-medium text-[#647A78] uppercase">Sanctioned Faculty</span>
                  <p className="text-sm font-semibold text-[#193A39] mt-0.5">{selectedInst.totalFacultyCount} Professors</p>
                </div>
                <div className="p-2.5 bg-[#F3F8F7] rounded-md border border-[#D9E7E4]/50">
                  <span className="text-[10px] font-medium text-[#647A78] uppercase">Student Capacity</span>
                  <p className="text-sm font-semibold text-[#193A39] mt-0.5">{selectedInst.totalStudentCapacity} Seats</p>
                </div>
              </div>

              {/* Affiliation & Authorized Signatory */}
              <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <h3 className="font-semibold text-[#193A39] mb-2.5 flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#115E59]" />
                    <span>Affiliation & Recognition</span>
                  </h3>
                  <div className="space-y-2 bg-[#F3F8F7]/40 p-3.5 rounded-md border border-[#D9E7E4]">
                    <div>
                      <span className="text-[#647A78] block">Affiliating University:</span>
                      <span className="font-medium text-[#193A39]">{selectedInst.affiliationUniversity}</span>
                    </div>
                    <div>
                      <span className="text-[#647A78] block">Institution Classification:</span>
                      <span className="font-medium text-[#193A39]">{selectedInst.type.replace(/_/g, ' ')}</span>
                    </div>
                    {selectedInst.website && (
                      <div>
                        <span className="text-[#647A78] block">Official Website:</span>
                        <a
                          href={selectedInst.website}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-[#0D9488] hover:underline flex items-center gap-1"
                        >
                          <Globe className="w-3 h-3" />
                          <span>{selectedInst.website}</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-[#193A39] mb-2.5 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#115E59]" />
                    <span>Authorized Institutional Contact</span>
                  </h3>
                  <div className="space-y-2 bg-[#F3F8F7]/40 p-3.5 rounded-md border border-[#D9E7E4]">
                    <div>
                      <span className="text-[#647A78] block">Principal / Director Name:</span>
                      <span className="font-medium text-[#193A39]">{selectedInst.authorizedContactName}</span>
                    </div>
                    <div>
                      <span className="text-[#647A78] block">Official Contact Email:</span>
                      <span className="font-mono text-[#193A39]">{selectedInst.authorizedContactEmail}</span>
                    </div>
                    <div>
                      <span className="text-[#647A78] block">Direct Telephone:</span>
                      <span className="font-mono text-[#193A39]">{selectedInst.authorizedContactPhone}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-10 text-center text-xs text-[#647A78] border border-[#D9E7E4]">
              Select an institution to inspect profile details.
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Institutional Profile"
        description="Update authorized contact information, campus acreage, or student capacity."
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#193A39] mb-1">Official Institution Name</label>
            <input
              type="text"
              value={editForm.name || ''}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#193A39] mb-1">Campus Area (Acres)</label>
              <input
                type="number"
                step="0.1"
                value={editForm.campusAreaAcres || 0}
                onChange={e => setEditForm({ ...editForm, campusAreaAcres: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
              />
            </div>
            <div>
              <label className="block font-medium text-[#193A39] mb-1">Sanctioned Student Capacity</label>
              <input
                type="number"
                value={editForm.totalStudentCapacity || 0}
                onChange={e => setEditForm({ ...editForm, totalStudentCapacity: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#193A39] mb-1">Authorized Contact Name</label>
              <input
                type="text"
                value={editForm.authorizedContactName || ''}
                onChange={e => setEditForm({ ...editForm, authorizedContactName: e.target.value })}
                className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
              />
            </div>
            <div>
              <label className="block font-medium text-[#193A39] mb-1">Authorized Phone</label>
              <input
                type="text"
                value={editForm.authorizedContactPhone || ''}
                onChange={e => setEditForm({ ...editForm, authorizedContactPhone: e.target.value })}
                className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-[#193A39] mb-1">Official Website</label>
            <input
              type="text"
              value={editForm.website || ''}
              onChange={e => setEditForm({ ...editForm, website: e.target.value })}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3.5 border-t border-[#D9E7E4]">
            <button
              onClick={() => setIsEditOpen(false)}
              className="px-3.5 py-1.5 border border-[#D9E7E4] rounded-md font-medium text-[#647A78] hover:bg-[#F3F8F7] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-3.5 py-1.5 bg-[#115E59] text-white rounded-md font-semibold hover:bg-[#0F766E] shadow-2xs cursor-pointer"
            >
              Save Profile Changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

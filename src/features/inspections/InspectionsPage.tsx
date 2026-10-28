import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { InspectionRecord } from '../../types/index.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Modal } from '../../components/common/Modal.js';
import {
  ClipboardList,
  Building,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  FileText,
  UserCheck,
  CheckSquare,
} from 'lucide-react';

export const InspectionsPage: React.FC = () => {
  const { role, user } = useAuth();
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [selectedInsp, setSelectedInsp] = useState<InspectionRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Submit report modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [recommendation, setRecommendation] = useState<
    'RECOMMEND_APPROVAL' | 'CONDITIONAL_APPROVAL' | 'RECOMMEND_REJECTION'
  >('RECOMMEND_APPROVAL');
  const [summaryFindings, setSummaryFindings] = useState('');

  const fetchInspections = async () => {
    try {
      setIsLoading(true);
      const res = await api.getInspections();
      setInspections(res.inspections);
      if (res.inspections.length > 0 && !selectedInsp) {
        setSelectedInsp(res.inspections[0]);
      }
    } catch (err) {
      console.error('Failed to load inspections:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, [role, user]);

  const handleUpdateCategory = async (
    category: string,
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_IMPROVEMENT',
    verifiedCapacity: string,
    observations: string
  ) => {
    if (!selectedInsp) return;
    try {
      const res = await api.updateInspectionCategory(selectedInsp.id, {
        category,
        status,
        verifiedCapacity,
        observations,
      });
      setSelectedInsp(res.inspection);
      setInspections(prev => prev.map(i => (i.id === res.inspection.id ? res.inspection : i)));
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleSubmitReport = async () => {
    if (!selectedInsp || !summaryFindings) {
      alert('Please enter comprehensive summary findings for the statutory report.');
      return;
    }
    try {
      const res = await api.submitInspectionReport(selectedInsp.id, {
        overallRecommendation: recommendation,
        summaryFindings,
      });
      setIsReportModalOpen(false);
      setSelectedInsp(res.inspection);
      setInspections(prev => prev.map(i => (i.id === res.inspection.id ? res.inspection : i)));
    } catch (err: any) {
      alert(`Report submission failed: ${err.message}`);
    }
  };

  return (
    <div className="p-4 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 sm:p-5 border border-[#D9E7E4] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#0D9488] uppercase tracking-wider">
              Expert Visiting Committee (EVC)
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#CCFBF1] text-[#0F766E] font-medium border border-[#99F6E4]/70">
              {inspections.length} Scheduled Visits
            </span>
          </div>
          <h1 className="text-lg font-semibold text-[#193A39] mt-1">Campus Physical Inspections & Findings</h1>
          <p className="text-xs text-[#647A78] mt-0.5">
            Evaluate infrastructure norms, smart classrooms, laboratories, computer centers, and barrier-free safety facilities.
          </p>
        </div>

        {selectedInsp && selectedInsp.status !== 'COMPLETED' && (role === 'INSPECTION_OFFICER' || role === 'AICTE_ADMIN') && (
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit Inspection Report</span>
          </button>
        )}
      </div>

      {/* Grid: Inspection List on Left, Facility Checklist Dossier on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Inspections List */}
        <div className="space-y-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#647A78]">Inspection Schedules</h2>
          {inspections.map(insp => {
            const isSelected = selectedInsp?.id === insp.id;
            return (
              <div
                key={insp.id}
                onClick={() => setSelectedInsp(insp)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer bg-white ${
                  isSelected
                    ? 'border-[#115E59] shadow-xs ring-1 ring-[#115E59]/20'
                    : 'border-[#D9E7E4] hover:border-[#0D9488]/60 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-xs text-[#193A39] line-clamp-1">{insp.institutionName}</span>
                  <StatusBadge status={insp.status} />
                </div>
                <div className="mt-1.5 text-[11px] text-[#647A78] space-y-1">
                  <div className="flex items-center gap-1.5 font-mono text-[#115E59]">
                    <Calendar className="w-3.5 h-3.5 text-[#0D9488]" />
                    <span>Scheduled: {new Date(insp.scheduledDate).toLocaleDateString()}</span>
                  </div>
                  <div>Officer: {insp.officerName}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Inspection Facility Checklist & Findings */}
        <div className="lg:col-span-2 space-y-5">
          {selectedInsp ? (
            <div className="bg-white rounded-lg border border-[#D9E7E4] shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[#D9E7E4] bg-[#F3F8F7]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#115E59] bg-white px-2 py-0.5 rounded border border-[#D9E7E4]">
                      {selectedInsp.id}
                    </span>
                    <StatusBadge status={selectedInsp.status} />
                    {selectedInsp.overallRecommendation !== 'PENDING' && (
                      <StatusBadge status={selectedInsp.overallRecommendation} />
                    )}
                  </div>
                  <h2 className="text-base font-semibold text-[#193A39] mt-2">{selectedInsp.institutionName}</h2>
                  <p className="text-xs text-[#647A78] mt-0.5">Application: {selectedInsp.applicationId}</p>
                </div>

                <div className="text-right text-xs text-[#647A78]">
                  <span className="text-[11px]">Committee Chairman:</span>
                  <span className="font-semibold text-[#193A39] block">{selectedInsp.officerName}</span>
                </div>
              </div>

              {/* Facility Categories Evaluation */}
              <div className="p-4 sm:p-5 border-b border-[#D9E7E4]">
                <h3 className="text-xs font-semibold text-[#193A39] mb-3 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[#115E59]" />
                  <span>Infrastructure & Facilities Audit Checklist</span>
                </h3>

                <div className="space-y-3">
                  {selectedInsp.categories.map((cat, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg border border-[#D9E7E4] bg-[#F3F8F7]/30 space-y-2.5 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold text-[#193A39] text-xs">{cat.label}</span>
                          <div className="text-[11px] text-[#647A78] mt-0.5">
                            <span className="font-medium text-[#193A39]">APH Benchmark: </span>
                            {cat.requiredCapacity}
                          </div>
                        </div>
                        <StatusBadge status={cat.status} />
                      </div>

                      <div className="text-[11px] bg-white p-2.5 rounded-md border border-[#D9E7E4] space-y-1">
                        <div>
                          <span className="font-medium text-[#647A78]">Verified Physical State: </span>
                          <span className="text-[#193A39]">{cat.verifiedCapacity}</span>
                        </div>
                        <div>
                          <span className="font-medium text-[#647A78]">Observations: </span>
                          <span className="text-[#193A39]">{cat.observations}</span>
                        </div>
                      </div>

                      {/* Officer quick edit buttons */}
                      {(role === 'INSPECTION_OFFICER' || role === 'AICTE_ADMIN') && selectedInsp.status !== 'COMPLETED' && (
                        <div className="flex items-center gap-2 justify-end pt-2 border-t border-[#D9E7E4]">
                          <button
                            onClick={() =>
                              handleUpdateCategory(
                                cat.category,
                                'COMPLIANT',
                                'Physically inspected & verified at 100% capacity',
                                'Meets all AICTE minimum square footage and safety guidelines.'
                              )
                            }
                            className="px-2.5 py-1 text-[11px] font-semibold text-[#15803D] bg-[#DCFCE7] hover:bg-[#BBF7D0] border border-[#86EFAC] rounded-md transition-colors cursor-pointer"
                          >
                            Mark Compliant
                          </button>
                          <button
                            onClick={() =>
                              handleUpdateCategory(
                                cat.category,
                                'NEEDS_IMPROVEMENT',
                                'Partial equipment installed',
                                'Minor deficiency: additional safety signage and calibration certificates required.'
                              )
                            }
                            className="px-2.5 py-1 text-[11px] font-semibold text-[#B45309] bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#FCD34D] rounded-md transition-colors cursor-pointer"
                          >
                            Needs Improvement
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Findings if completed */}
              {selectedInsp.summaryFindings && (
                <div className="p-4 sm:p-5 bg-white">
                  <h3 className="text-xs font-semibold text-[#193A39] mb-2">
                    Official Committee Findings & Summary
                  </h3>
                  <p className="text-xs text-[#193A39] bg-[#F3F8F7] p-3 rounded-md border border-[#D9E7E4] leading-relaxed">
                    {selectedInsp.summaryFindings}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-10 text-center text-xs text-[#647A78] border border-[#D9E7E4]">
              Select an inspection visit to view infrastructure findings.
            </div>
          )}
        </div>
      </div>

      {/* Submit Inspection Report Modal */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Submit Expert Visiting Committee Report"
        description="Formal inspection report submission. This will advance the application docket to AICTE Council review."
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#193A39] mb-1">Overall Recommendation</label>
            <select
              value={recommendation}
              onChange={e => setRecommendation(e.target.value as any)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            >
              <option value="RECOMMEND_APPROVAL">Recommend Full Approval (All norms satisfied)</option>
              <option value="CONDITIONAL_APPROVAL">Conditional Approval (Minor corrective undertakings)</option>
              <option value="RECOMMEND_REJECTION">Recommend Rejection (Major statutory deficiency)</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-[#193A39] mb-1">
              Comprehensive Committee Findings & Rationale
            </label>
            <textarea
              rows={4}
              placeholder="Record detailed observations regarding campus infrastructure, student faculty ratio, and laboratory equipment..."
              value={summaryFindings}
              onChange={e => setSummaryFindings(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3.5 border-t border-[#D9E7E4]">
            <button
              onClick={() => setIsReportModalOpen(false)}
              className="px-3.5 py-1.5 border border-[#D9E7E4] rounded-md font-medium text-[#647A78] hover:bg-[#F3F8F7] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitReport}
              className="px-3.5 py-1.5 bg-[#115E59] text-white rounded-md font-semibold hover:bg-[#0F766E] shadow-2xs cursor-pointer"
            >
              Finalize & Submit Report
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

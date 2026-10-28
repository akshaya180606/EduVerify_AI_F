import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { Application, ScrutinyChecklistItem } from '../../types/index.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Modal } from '../../components/common/Modal.js';
import {
  SearchCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquareWarning,
  ArrowRight,
  ShieldAlert,
  FileText,
  User,
  Clock,
} from 'lucide-react';

export const ScrutinyPage: React.FC = () => {
  const { role, user } = useAuth();
  const [queue, setQueue] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [appDetail, setAppDetail] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Clarification request modal
  const [isClarModalOpen, setIsClarModalOpen] = useState(false);
  const [clarItem, setClarItem] = useState('');
  const [clarReason, setClarReason] = useState('');
  const [clarDueDays, setClarDueDays] = useState(14);

  // Scrutiny recommendation modal
  const [isRecommendModalOpen, setIsRecommendModalOpen] = useState(false);
  const [recommendation, setRecommendation] = useState('FORWARD_TO_VERIFICATION');
  const [recommendNotes, setRecommendNotes] = useState('');

  const fetchQueue = async () => {
    try {
      setIsLoading(true);
      const res = await api.getScrutinyQueue();
      setQueue(res.queue);
      if (res.queue.length > 0 && !selectedApp) {
        loadDetail(res.queue[0].id);
      }
    } catch (err) {
      console.error('Failed to load scrutiny queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDetail = async (appId: string) => {
    try {
      const res = await api.getApplication(appId);
      setSelectedApp(res.application);
      setAppDetail(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [role, user]);

  const handleUpdateChecklist = async (itemId: string, status: string, notes?: string) => {
    try {
      await api.updateChecklistItem(itemId, { status, scrutinyNotes: notes });
      if (selectedApp) await loadDetail(selectedApp.id);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleCreateClarification = async () => {
    if (!selectedApp || !clarItem || !clarReason) return;
    try {
      await api.createClarification({
        applicationId: selectedApp.id,
        requestedItem: clarItem,
        detailedReason: clarReason,
        dueDateDays: clarDueDays,
      });
      setIsClarModalOpen(false);
      setClarItem('');
      setClarReason('');
      await fetchQueue();
      if (selectedApp) await loadDetail(selectedApp.id);
    } catch (err: any) {
      alert(`Clarification error: ${err.message}`);
    }
  };

  const handleSubmitRecommendation = async () => {
    if (!selectedApp) return;
    try {
      await api.submitScrutinyRecommendation({
        applicationId: selectedApp.id,
        recommendation,
        notes: recommendNotes,
      });
      setIsRecommendModalOpen(false);
      setRecommendNotes('');
      await fetchQueue();
      if (selectedApp) await loadDetail(selectedApp.id);
    } catch (err: any) {
      alert(`Recommendation error: ${err.message}`);
    }
  };

  return (
    <div className="p-4 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 sm:p-5 border border-[#D9E7E4] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#0D9488] uppercase tracking-wider">
              Officer Scrutiny Workspace
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#CCFBF1] text-[#0F766E] font-medium border border-[#99F6E4]/70">
              {queue.length} In Queue
            </span>
          </div>
          <h1 className="text-lg font-semibold text-[#193A39] mt-1">Application Scrutiny & Checklist Audit</h1>
          <p className="text-xs text-[#647A78] mt-0.5">
            Audit application completeness, evaluate land/cadre checklist parameters, and submit statutory recommendations.
          </p>
        </div>

        {selectedApp && (role === 'SCRUTINY_OFFICER' || role === 'AICTE_ADMIN') && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsClarModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-[#B45309] bg-[#FEF3C7] hover:bg-[#FDE68A] rounded-md border border-[#FCD34D] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquareWarning className="w-3.5 h-3.5" />
              <span>Request Clarification</span>
            </button>
            <button
              onClick={() => setIsRecommendModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>Submit Recommendation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Queue List */}
        <div className="space-y-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#647A78]">Scrutiny Queue</h2>
          {queue.map(app => {
            const isSelected = selectedApp?.id === app.id;
            return (
              <div
                key={app.id}
                onClick={() => loadDetail(app.id)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer bg-white ${
                  isSelected
                    ? 'border-[#115E59] shadow-xs ring-1 ring-[#115E59]/20'
                    : 'border-[#D9E7E4] hover:border-[#0D9488]/60 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[#115E59]">{app.applicationNumber}</span>
                  <StatusBadge status={app.status} />
                </div>
                <div className="mt-1.5 text-xs font-semibold text-[#193A39] line-clamp-1">{app.institutionName}</div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#647A78]">
                  <span>{app.type.replace(/_/g, ' ')}</span>
                  <span>{app.academicYear}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Scrutiny Checklists & Document Inspector */}
        <div className="lg:col-span-2 space-y-5">
          {selectedApp ? (
            <div className="bg-white rounded-lg border border-[#D9E7E4] shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[#D9E7E4] bg-[#F3F8F7]/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#115E59] bg-white px-2 py-0.5 rounded border border-[#D9E7E4]">
                      {selectedApp.applicationNumber}
                    </span>
                    <StatusBadge status={selectedApp.status} />
                  </div>
                  <h2 className="text-base font-semibold text-[#193A39] mt-2">{selectedApp.institutionName}</h2>
                </div>
                <div className="text-right text-xs text-[#647A78]">
                  <span className="text-[11px]">Assigned Scrutiny Officer:</span>
                  <span className="font-semibold text-[#193A39] block">{selectedApp.assignedScrutinyOfficerName || user?.name}</span>
                </div>
              </div>

              {/* Scrutiny Checklists */}
              <div className="p-4 sm:p-5">
                <h3 className="text-xs font-semibold text-[#193A39] mb-3 flex items-center gap-2">
                  <SearchCheck className="w-4 h-4 text-[#115E59]" />
                  <span>Statutory Compliance Checklist Items</span>
                </h3>

                <div className="space-y-3">
                  {(!appDetail?.checklists || appDetail.checklists.length === 0) ? (
                    <div className="p-4 bg-[#F3F8F7] text-center text-xs text-[#647A78] rounded-md">
                      No specific scrutiny checklist items generated yet for this docket.
                    </div>
                  ) : (
                    appDetail.checklists.map((chk: ScrutinyChecklistItem) => (
                      <div
                        key={chk.id}
                        className="p-3.5 rounded-lg border border-[#D9E7E4] bg-[#F3F8F7]/30 space-y-2.5 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-semibold text-[#193A39]">{chk.category}</span>
                            <p className="text-[11px] text-[#647A78] mt-0.5">{chk.requirement}</p>
                          </div>
                          <StatusBadge status={chk.status} />
                        </div>

                        {chk.scrutinyNotes && (
                          <div className="text-[11px] bg-white p-2.5 rounded-md border border-[#D9E7E4] text-[#193A39]">
                            <span className="font-semibold text-[#647A78] block text-[10px] uppercase">Officer Remarks:</span>
                            {chk.scrutinyNotes}
                          </div>
                        )}

                        {/* Officer Actions for Checklist */}
                        {(role === 'SCRUTINY_OFFICER' || role === 'AICTE_ADMIN') && (
                          <div className="pt-2 border-t border-[#D9E7E4] flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleUpdateChecklist(chk.id, 'COMPLIANT', 'Verified compliant against official APH requirements.')}
                              className="px-2.5 py-1 text-[11px] font-semibold text-[#15803D] bg-[#DCFCE7] hover:bg-[#BBF7D0] border border-[#86EFAC] rounded-md transition-colors cursor-pointer"
                            >
                              Mark Compliant
                            </button>
                            <button
                              onClick={() => handleUpdateChecklist(chk.id, 'CLARIFICATION_REQUIRED', 'Requires clarification or revised document.')}
                              className="px-2.5 py-1 text-[11px] font-semibold text-[#B45309] bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#FCD34D] rounded-md transition-colors cursor-pointer"
                            >
                              Need Clarification
                            </button>
                            <button
                              onClick={() => handleUpdateChecklist(chk.id, 'NON_COMPLIANT', 'Fails statutory minimum capacity.')}
                              className="px-2.5 py-1 text-[11px] font-semibold text-[#B91C1C] bg-[#FEE2E2] hover:bg-[#FECACA] border border-[#FCA5A5] rounded-md transition-colors cursor-pointer"
                            >
                              Non-Compliant
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-10 text-center text-xs text-[#647A78] border border-[#D9E7E4]">
              Select an application to evaluate scrutiny requirements.
            </div>
          )}
        </div>
      </div>

      {/* Clarification Request Modal */}
      <Modal
        isOpen={isClarModalOpen}
        onClose={() => setIsClarModalOpen(false)}
        title="Issue Statutory Clarification Request"
        description="Notify College Management of missing or inadequate compliance documentation."
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#193A39] mb-1">Requested Document or Clarification Item</label>
            <input
              type="text"
              placeholder="e.g. Ratified Associate Professor orders for CSE"
              value={clarItem}
              onChange={e => setClarItem(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            />
          </div>
          <div>
            <label className="block font-medium text-[#193A39] mb-1">Detailed Regulatory Deficiency / Rationale</label>
            <textarea
              rows={3}
              placeholder="Specify the exact regulatory clause or deficiency requiring response..."
              value={clarReason}
              onChange={e => setClarReason(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            />
          </div>
          <div>
            <label className="block font-medium text-[#193A39] mb-1">Response Window (Days)</label>
            <select
              value={clarDueDays}
              onChange={e => setClarDueDays(Number(e.target.value))}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            >
              <option value={7}>7 Days (Urgent)</option>
              <option value={14}>14 Days (Standard Statutory Window)</option>
              <option value={30}>30 Days (Extended)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3.5 border-t border-[#D9E7E4]">
            <button
              onClick={() => setIsClarModalOpen(false)}
              className="px-3.5 py-1.5 border border-[#D9E7E4] rounded-md font-medium text-[#647A78] hover:bg-[#F3F8F7] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateClarification}
              className="px-3.5 py-1.5 bg-[#115E59] text-white rounded-md font-semibold hover:bg-[#0F766E] shadow-2xs cursor-pointer"
            >
              Issue Clarification Notice
            </button>
          </div>
        </div>
      </Modal>

      {/* Scrutiny Recommendation Modal */}
      <Modal
        isOpen={isRecommendModalOpen}
        onClose={() => setIsRecommendModalOpen(false)}
        title="Submit Scrutiny Finding & Forward Case"
        description="Formal officer recommendation for subsequent regulatory stage."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#193A39] mb-1">Recommendation</label>
            <select
              value={recommendation}
              onChange={e => setRecommendation(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            >
              <option value="FORWARD_TO_VERIFICATION">Forward to Document Verification Desk</option>
              <option value="RECOMMEND_INSPECTION">Recommend for On-site EVC Physical Inspection</option>
              <option value="REQUEST_CLARIFICATION">Hold for Clarification Resolution</option>
            </select>
          </div>
          <div>
            <label className="block font-medium text-[#193A39] mb-1">Scrutiny Summary Notes</label>
            <textarea
              rows={3}
              placeholder="Enter official remarks on application completeness..."
              value={recommendNotes}
              onChange={e => setRecommendNotes(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3.5 border-t border-[#D9E7E4]">
            <button
              onClick={() => setIsRecommendModalOpen(false)}
              className="px-3.5 py-1.5 border border-[#D9E7E4] rounded-md font-medium text-[#647A78] hover:bg-[#F3F8F7] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitRecommendation}
              className="px-3.5 py-1.5 bg-[#115E59] text-white rounded-md font-semibold hover:bg-[#0F766E] shadow-2xs cursor-pointer"
            >
              Submit Recommendation
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

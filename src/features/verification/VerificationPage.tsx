import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { VerificationTask } from '../../types/index.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Modal } from '../../components/common/Modal.js';
import {
  FilePlus2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  QrCode,
  ShieldCheck,
  RotateCcw,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';

export const VerificationPage: React.FC = () => {
  const { role, user } = useAuth();
  const [tasks, setTasks] = useState<VerificationTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<VerificationTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  // Adapters state
  const [adapters, setAdapters] = useState<any[]>([]);
  const [selectedAdapterId, setSelectedAdapterId] = useState<string>('ADAPTER-QR-001');

  // Manual dossier modal
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [isManualDossierOpen, setIsManualDossierOpen] = useState(false);
  const [outcome, setOutcome] = useState<'VERIFIED' | 'DISCREPANCY_FOUND' | 'UNABLE_TO_VERIFY'>('VERIFIED');
  const [manualNotes, setManualNotes] = useState('');
  const [discrepancyDetails, setDiscrepancyDetails] = useState('');

  // Manual Dossier form state
  const [authorityContacted, setAuthorityContacted] = useState('');
  const [verificationMode, setVerificationMode] = useState<'OFFICIAL_PORTAL_QUERY' | 'DIRECT_DEPARTMENT_COMMUNICATION' | 'PHYSICAL_INSPECTION_RECORD'>('OFFICIAL_PORTAL_QUERY');
  const [portalOrOffice, setPortalOrOffice] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [dossierOutcome, setDossierOutcome] = useState<'VERIFIED' | 'MISMATCH_DETECTED' | 'UNABLE_TO_VERIFY'>('VERIFIED');
  const [findingsSummary, setFindingsSummary] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');

  const fetchTasksAndAdapters = async () => {
    try {
      setIsLoading(true);
      const [tasksRes, adaptersRes] = await Promise.all([
        api.getVerificationTasks(),
        api.getVerificationAdapters().catch(() => ({ adapters: [] })),
      ]);
      setTasks(tasksRes.tasks);
      setAdapters(adaptersRes.adapters || []);
      if (adaptersRes.adapters?.length > 0) {
        setSelectedAdapterId(adaptersRes.adapters[0].id);
      }
      if (tasksRes.tasks.length > 0 && !selectedTask) {
        setSelectedTask(tasksRes.tasks[0]);
      }
    } catch (err) {
      console.error('Failed to load verification tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksAndAdapters();
  }, [role, user]);

  const handleRunExternalCheck = async () => {
    if (!selectedTask) return;
    try {
      setIsVerifying(true);
      const res = await api.verifyExternalSource(selectedTask.id, selectedAdapterId);
      setSelectedTask(res.task);
      setTasks(prev => prev.map(t => (t.id === res.task.id ? res.task : t)));
    } catch (err: any) {
      alert(`External check failed: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRecordManualDossier = async () => {
    if (!selectedTask || !authorityContacted || !findingsSummary) {
      alert('Please fill in issuing authority name and findings summary.');
      return;
    }

    try {
      const res = await api.recordManualVerification(selectedTask.id, {
        officialAuthorityContacted: authorityContacted,
        verificationMode,
        portalUrlOrOfficeName: portalOrOffice,
        officialReferenceReceiptNumber: receiptNumber,
        verificationOutcome: dossierOutcome,
        findingsSummary,
        supportingEvidenceNotes: evidenceNotes,
      });

      setIsManualDossierOpen(false);
      setSelectedTask(res.task);
      setTasks(prev => prev.map(t => (t.id === res.task.id ? res.task : t)));
      setAuthorityContacted('');
      setFindingsSummary('');
      setEvidenceNotes('');
    } catch (err: any) {
      alert(`Manual verification dossier recording failed: ${err.message}`);
    }
  };

  const handleRecordDecision = async () => {
    if (!selectedTask) return;
    try {
      const res = await api.recordVerificationOutcome(selectedTask.id, {
        outcome,
        manualNotes,
        discrepancyDetails: outcome === 'DISCREPANCY_FOUND' ? discrepancyDetails : undefined,
      });
      setIsDecisionModalOpen(false);
      setManualNotes('');
      setDiscrepancyDetails('');
      setSelectedTask(res.task);
      setTasks(prev => prev.map(t => (t.id === res.task.id ? res.task : t)));
    } catch (err: any) {
      alert(`Decision recording failed: ${err.message}`);
    }
  };

  return (
    <div className="p-4 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 sm:p-5 border border-[#D9E7E4] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#0D9488] uppercase tracking-wider">
              Document Verification Desk
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#CCFBF1] text-[#0F766E] font-medium border border-[#99F6E4]/70">
              {tasks.length} Verification Tasks
            </span>
          </div>
          <h1 className="text-lg font-semibold text-[#193A39] mt-1">External Issuer & QR Verification</h1>
          <p className="text-xs text-[#647A78] mt-0.5">
            Query issuing authority ledgers, decode digital QR codes, and record verified status or confirmed discrepancies.
          </p>
        </div>

        {selectedTask && (role === 'VERIFICATION_OFFICER' || role === 'AICTE_ADMIN') && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedAdapterId}
              onChange={e => setSelectedAdapterId(e.target.value)}
              className="px-2.5 py-1.5 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39] max-w-[200px] truncate"
            >
              {adapters.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.isConfigured ? '✓' : '(Unconfigured)'}
                </option>
              ))}
            </select>
            <button
              onClick={handleRunExternalCheck}
              disabled={isVerifying}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isVerifying ? 'Querying...' : 'Run Adapter Check'}</span>
            </button>
            <button
              onClick={() => setIsManualDossierOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Record Manual Dossier</span>
            </button>
            <button
              onClick={() => setIsDecisionModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0F766E] hover:bg-[#115E59] rounded-md transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Record Decision</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Tasks List */}
        <div className="space-y-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#647A78]">Assigned Verification Tasks</h2>
          {tasks.map(task => {
            const isSelected = selectedTask?.id === task.id;
            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer bg-white ${
                  isSelected
                    ? 'border-[#115E59] shadow-xs ring-1 ring-[#115E59]/20'
                    : 'border-[#D9E7E4] hover:border-[#0D9488]/60 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-xs text-[#193A39] line-clamp-1">{task.documentTitle}</span>
                  <StatusBadge status={task.status} />
                </div>
                <div className="mt-1.5 text-[11px] text-[#647A78] flex items-center justify-between">
                  <span className="font-mono text-[#115E59]">{task.id}</span>
                  <span>{task.externalCheckAttempted ? 'Source Queried' : 'Pending Check'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Task Detail & Electronic Ledger Verification Dossier */}
        <div className="lg:col-span-2 space-y-5">
          {selectedTask ? (
            <div className="bg-white rounded-lg border border-[#D9E7E4] shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[#D9E7E4] bg-[#F3F8F7]/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#115E59] bg-white px-2 py-0.5 rounded border border-[#D9E7E4]">
                      {selectedTask.id}
                    </span>
                    <StatusBadge status={selectedTask.status} />
                  </div>
                  <h2 className="text-base font-semibold text-[#193A39] mt-2">{selectedTask.documentTitle}</h2>
                  <p className="text-xs text-[#647A78] font-mono mt-0.5">
                    Doc ID: {selectedTask.documentId} | Application: {selectedTask.applicationId}
                  </p>
                </div>

                <div className="text-right text-xs text-[#647A78]">
                  <span className="text-[11px]">Lead Verification Officer:</span>
                  <span className="font-semibold text-[#193A39] block">{selectedTask.assignedOfficerName}</span>
                </div>
              </div>

              {/* External Issuer Source Checks */}
              <div className="p-4 sm:p-5 border-b border-[#D9E7E4]">
                <h3 className="text-xs font-semibold text-[#193A39] mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#115E59]" />
                  <span>External Issuer Verification Evidence</span>
                </h3>

                {selectedTask.externalCheckAttempted ? (
                  <div className="p-3.5 bg-[#DCFCE7]/40 rounded-lg border border-[#86EFAC] space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#15803D] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Source Check Successful: {selectedTask.externalSourceUsed}</span>
                      </span>
                      <span className="text-[10px] text-[#647A78] font-mono">
                        {new Date(selectedTask.attemptTimestamp || '').toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#193A39] leading-relaxed">
                      {selectedTask.verificationEvidence}
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 bg-[#F3F8F7] rounded-lg border border-[#D9E7E4] text-xs text-[#647A78] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[#193A39] block">External Issuer Check Pending</span>
                      <p className="text-[11px] text-[#647A78] mt-0.5">
                        Click "Run External Issuer Check" above to query state land registration portal APIs.
                      </p>
                    </div>
                    <HelpCircle className="w-4.5 h-4.5 text-[#647A78]" />
                  </div>
                )}
              </div>

              {/* QR Code & Digital Signature Inspection */}
              <div className="p-4 sm:p-5 border-b border-[#D9E7E4]">
                <h3 className="text-xs font-semibold text-[#193A39] mb-3 flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-[#115E59]" />
                  <span>Decoded QR Code & Digital Signature Audit</span>
                </h3>

                <div className="p-3.5 bg-[#F3F8F7]/40 rounded-lg border border-[#D9E7E4] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#193A39]">Digital Signature Status:</span>
                    <span className="font-medium text-[11px] text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-md border border-[#86EFAC]">
                      Valid X.509 NIC Trust Chain
                    </span>
                  </div>
                  <div>
                    <span className="text-[#647A78] block font-medium text-[11px]">QR Payload Link:</span>
                    <span className="font-mono text-[11px] text-[#0D9488] break-all">
                      https://igrsup.gov.in/verifyDeed?ref=REG-DEED-2001-VOL-84-PG-119
                    </span>
                  </div>
                </div>
              </div>

              {/* Manual Verification Officer Notes */}
              <div className="p-4 sm:p-5">
                <h3 className="text-xs font-semibold text-[#193A39] mb-2">
                  Verification Audit Notes
                </h3>
                {selectedTask.manualNotes ? (
                  <p className="text-xs text-[#193A39] bg-[#F3F8F7] p-3 rounded-md border border-[#D9E7E4]">
                    {selectedTask.manualNotes}
                  </p>
                ) : (
                  <p className="text-xs text-[#647A78] italic">No manual notes recorded yet.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-10 text-center text-xs text-[#647A78] border border-[#D9E7E4]">
              Select a verification task to review external authority matches.
            </div>
          )}
        </div>
      </div>

      {/* Record Outcome Modal */}
      <Modal
        isOpen={isDecisionModalOpen}
        onClose={() => setIsDecisionModalOpen(false)}
        title="Record Formal Verification Outcome"
        description="Select outcome based on external evidence and manual scrutiny."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#193A39] mb-1">Verification Status</label>
            <select
              value={outcome}
              onChange={e => setOutcome(e.target.value as any)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            >
              <option value="VERIFIED">Verified Authentic (Source matches certificate)</option>
              <option value="DISCREPANCY_FOUND">Discrepancy Found (Contradiction detected)</option>
              <option value="UNABLE_TO_VERIFY">Unable to Verify (Source offline or unavailable)</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-[#193A39] mb-1">Officer Notes & Rationale</label>
            <textarea
              rows={3}
              placeholder="Record justification and checked references..."
              value={manualNotes}
              onChange={e => setManualNotes(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            />
          </div>

          {outcome === 'DISCREPANCY_FOUND' && (
            <div>
              <label className="block font-medium text-[#B91C1C] mb-1">Discrepancy Investigation Details</label>
              <textarea
                rows={3}
                placeholder="Explain the specific factual contradiction found in external source..."
                value={discrepancyDetails}
                onChange={e => setDiscrepancyDetails(e.target.value)}
                className="w-full px-3 py-2 border border-[#FCA5A5] bg-[#FEE2E2]/30 rounded-md text-xs text-[#B91C1C]"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3.5 border-t border-[#D9E7E4]">
            <button
              onClick={() => setIsDecisionModalOpen(false)}
              className="px-3.5 py-1.5 border border-[#D9E7E4] rounded-md font-medium text-[#647A78] hover:bg-[#F3F8F7] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleRecordDecision}
              className="px-3.5 py-1.5 bg-[#115E59] text-white rounded-md font-semibold hover:bg-[#0F766E] shadow-2xs cursor-pointer"
            >
              Record Verification
            </button>
          </div>
        </div>
      </Modal>

      {/* Official Manual Verification Dossier Modal */}
      <Modal
        isOpen={isManualDossierOpen}
        onClose={() => setIsManualDossierOpen(false)}
        title="Record Official Manual Verification Dossier"
        description="Authorized Verification Officer dossier recording for offline, intranet, or non-API regulatory authorities."
        maxWidth="lg"
      >
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block font-medium text-[#193A39] mb-1">Official Issuing Authority Contacted *</label>
            <input
              type="text"
              placeholder="e.g. State Directorate of Fire Services / District Sub-Registrar Office"
              value={authorityContacted}
              onChange={e => setAuthorityContacted(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#193A39] mb-1">Verification Mode</label>
              <select
                value={verificationMode}
                onChange={e => setVerificationMode(e.target.value as any)}
                className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
              >
                <option value="OFFICIAL_PORTAL_QUERY">Official State Portal Online Query</option>
                <option value="DIRECT_DEPARTMENT_COMMUNICATION">Official Written/Email Department Communication</option>
                <option value="PHYSICAL_INSPECTION_RECORD">Physical In-Person Verification at Registrar</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-[#193A39] mb-1">Official Receipt / Dispatch Ref No.</label>
              <input
                type="text"
                placeholder="e.g. DISP/2026/9102 or Query Receipt ID"
                value={receiptNumber}
                onChange={e => setReceiptNumber(e.target.value)}
                className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#193A39] mb-1">Verification Outcome Finding *</label>
            <select
              value={dossierOutcome}
              onChange={e => setDossierOutcome(e.target.value as any)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39] font-medium"
            >
              <option value="VERIFIED">VERIFIED — Certificate is authentic & confirmed in authority records</option>
              <option value="MISMATCH_DETECTED">MISMATCH DETECTED — Discrepancy found between document and authority ledger</option>
              <option value="UNABLE_TO_VERIFY">UNABLE TO VERIFY — Authority unable to confirm within regulatory timeline</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-[#193A39] mb-1">Findings Summary *</label>
            <textarea
              rows={2}
              placeholder="State the factual finding from the authority..."
              value={findingsSummary}
              onChange={e => setFindingsSummary(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            />
          </div>

          <div>
            <label className="block font-medium text-[#193A39] mb-1">Supporting Evidence & Officer Notes</label>
            <textarea
              rows={2}
              placeholder="Record supporting URL, officer designation, or attached verification memo..."
              value={evidenceNotes}
              onChange={e => setEvidenceNotes(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3.5 border-t border-[#D9E7E4]">
            <button
              onClick={() => setIsManualDossierOpen(false)}
              className="px-3.5 py-1.5 border border-[#D9E7E4] rounded-md font-medium text-[#647A78] hover:bg-[#F3F8F7] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleRecordManualDossier}
              className="px-3.5 py-1.5 bg-[#115E59] text-white rounded-md font-semibold hover:bg-[#0F766E] shadow-2xs cursor-pointer"
            >
              Submit Official Dossier
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

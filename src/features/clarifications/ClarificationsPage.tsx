import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { Clarification } from '../../types/index.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Modal } from '../../components/common/Modal.js';
import {
  MessageSquareWarning,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  CornerDownRight,
} from 'lucide-react';

export const ClarificationsPage: React.FC = () => {
  const { role, user } = useAuth();
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [selectedClar, setSelectedClar] = useState<Clarification | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // College response modal
  const [isRespondModalOpen, setIsRespondModalOpen] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [responseDocName, setResponseDocName] = useState('');

  // Officer resolution modal
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isAccepted, setIsAccepted] = useState(true);

  const fetchClarifications = async () => {
    try {
      setIsLoading(true);
      const res = await api.getClarifications();
      setClarifications(res.clarifications);
      if (res.clarifications.length > 0 && !selectedClar) {
        setSelectedClar(res.clarifications[0]);
      }
    } catch (err) {
      console.error('Failed to load clarifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClarifications();
  }, [role, user]);

  const handleRespondSubmit = async () => {
    if (!selectedClar || !responseText) {
      alert('Please enter an explanatory response text.');
      return;
    }
    try {
      await api.respondClarification(selectedClar.id, {
        responseText,
        responseDocumentName: responseDocName || undefined,
      });
      setIsRespondModalOpen(false);
      setResponseText('');
      setResponseDocName('');
      await fetchClarifications();
    } catch (err: any) {
      alert(`Response submission failed: ${err.message}`);
    }
  };

  const handleResolveSubmit = async () => {
    if (!selectedClar) return;
    try {
      await api.resolveClarification(selectedClar.id, {
        isAccepted,
        resolutionNotes,
      });
      setIsResolveModalOpen(false);
      setResolutionNotes('');
      await fetchClarifications();
    } catch (err: any) {
      alert(`Resolution failed: ${err.message}`);
    }
  };

  return (
    <div className="p-4 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 sm:p-5 border border-[#D9E7E4] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#0D9488] uppercase tracking-wider">
              Regulatory Clarification Desk
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#B45309] font-medium border border-[#FCD34D]/70">
              {clarifications.filter(c => c.status === 'PENDING_RESPONSE').length} Awaiting Response
            </span>
          </div>
          <h1 className="text-lg font-semibold text-[#193A39] mt-1">Clarification Requests & Resubmissions</h1>
          <p className="text-xs text-[#647A78] mt-0.5">
            Resolve document deficiencies, answer scrutiny queries, and submit verified replacement evidence.
          </p>
        </div>

        {selectedClar && (
          <div className="flex items-center gap-2">
            {role === 'COLLEGE_MANAGEMENT' && selectedClar.status === 'PENDING_RESPONSE' && (
              <button
                onClick={() => setIsRespondModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Response</span>
              </button>
            )}

            {(role === 'SCRUTINY_OFFICER' || role === 'AICTE_ADMIN') && selectedClar.status === 'SUBMITTED' && (
              <button
                onClick={() => setIsResolveModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Resolve Clarification</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Clarifications List */}
        <div className="space-y-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#647A78]">Clarification Tickets</h2>
          {clarifications.map(clar => {
            const isSelected = selectedClar?.id === clar.id;
            return (
              <div
                key={clar.id}
                onClick={() => setSelectedClar(clar)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer bg-white ${
                  isSelected
                    ? 'border-[#115E59] shadow-xs ring-1 ring-[#115E59]/20'
                    : 'border-[#D9E7E4] hover:border-[#0D9488]/60 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-xs text-[#193A39] line-clamp-1">{clar.requestedItem}</span>
                  <StatusBadge status={clar.status} />
                </div>
                <div className="mt-1.5 text-[11px] text-[#647A78] flex items-center justify-between">
                  <span>{clar.institutionName}</span>
                  <span className="text-[#B45309] font-medium">Due: {new Date(clar.dueDate).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Clarification Ticket Thread */}
        <div className="lg:col-span-2 space-y-5">
          {selectedClar ? (
            <div className="bg-white rounded-lg border border-[#D9E7E4] shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[#D9E7E4] bg-[#F3F8F7]/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#115E59] bg-white px-2 py-0.5 rounded border border-[#D9E7E4]">
                      {selectedClar.id}
                    </span>
                    <StatusBadge status={selectedClar.status} />
                  </div>
                  <h2 className="text-base font-semibold text-[#193A39] mt-2">{selectedClar.requestedItem}</h2>
                  <p className="text-xs text-[#647A78] mt-0.5">
                    Institution: {selectedClar.institutionName} (Application: {selectedClar.applicationId})
                  </p>
                </div>

                <div className="text-right text-xs text-[#647A78]">
                  <span className="text-[11px]">Issued By:</span>
                  <span className="font-semibold text-[#193A39] block">{selectedClar.issuedByOfficerName}</span>
                  <span className="text-[10px] text-[#B45309] block mt-0.5 font-medium">
                    Due: {new Date(selectedClar.dueDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Clarification Request Details */}
              <div className="p-4 sm:p-5 border-b border-[#D9E7E4] space-y-3.5">
                <div className="p-3.5 bg-[#FEF3C7]/40 rounded-lg border border-[#FCD34D] text-xs">
                  <div className="font-semibold text-[#B45309] flex items-center gap-1.5 mb-1">
                    <MessageSquareWarning className="w-3.5 h-3.5" />
                    <span>Officer Deficiency Notice:</span>
                  </div>
                  <p className="text-[#193A39] leading-relaxed text-[11px]">{selectedClar.detailedReason}</p>
                  <div className="mt-1.5 text-[10px] text-[#647A78]">
                    Issued: {new Date(selectedClar.issuedAt).toLocaleString()}
                  </div>
                </div>

                {/* Response Thread if submitted */}
                {selectedClar.responseText ? (
                  <div className="p-3.5 bg-[#F3F8F7] rounded-lg border border-[#D9E7E4] text-xs space-y-2">
                    <div className="font-semibold text-[#115E59] flex items-center gap-1.5">
                      <CornerDownRight className="w-3.5 h-3.5 text-[#0D9488]" />
                      <span>College Management Response:</span>
                    </div>
                    <p className="text-[#193A39] text-[11px] leading-relaxed">{selectedClar.responseText}</p>
                    {selectedClar.responseDocumentName && (
                      <div className="pt-1.5 flex items-center gap-2 text-[11px] font-medium text-[#115E59]">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Uploaded Evidence: {selectedClar.responseDocumentName}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-[#647A78] pt-0.5">
                      Submitted: {new Date(selectedClar.responseDate || '').toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-white rounded-lg border border-dashed border-[#D9E7E4] text-xs text-center text-[#647A78]">
                    Awaiting institutional response from College Management.
                  </div>
                )}

                {/* Resolution Notes if resolved */}
                {selectedClar.resolutionNotes && (
                  <div className="p-3.5 bg-[#DCFCE7]/50 rounded-lg border border-[#86EFAC] text-xs">
                    <div className="font-semibold text-[#15803D] flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolution Decision ({selectedClar.status}):</span>
                    </div>
                    <p className="text-[#193A39] text-[11px]">{selectedClar.resolutionNotes}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-10 text-center text-xs text-[#647A78] border border-[#D9E7E4]">
              Select a clarification ticket to inspect response thread.
            </div>
          )}
        </div>
      </div>

      {/* College Response Modal */}
      <Modal
        isOpen={isRespondModalOpen}
        onClose={() => setIsRespondModalOpen(false)}
        title="Submit Clarification Response & Evidence"
        description="Provide comprehensive explanation and replacement document references."
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#193A39] mb-1">Detailed Institutional Response</label>
            <textarea
              rows={4}
              placeholder="Explain how the deficiency has been rectified with reference to university orders..."
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            />
          </div>

          <div>
            <label className="block font-medium text-[#193A39] mb-1">Replacement Document Name (Optional)</label>
            <input
              type="text"
              placeholder="e.g. University_Ratified_Faculty_List_Signed.pdf"
              value={responseDocName}
              onChange={e => setResponseDocName(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3.5 border-t border-[#D9E7E4]">
            <button
              onClick={() => setIsRespondModalOpen(false)}
              className="px-3.5 py-1.5 border border-[#D9E7E4] rounded-md font-medium text-[#647A78] hover:bg-[#F3F8F7] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleRespondSubmit}
              className="px-3.5 py-1.5 bg-[#115E59] text-white rounded-md font-semibold hover:bg-[#0F766E] shadow-2xs cursor-pointer"
            >
              Submit Response
            </button>
          </div>
        </div>
      </Modal>

      {/* Officer Resolution Modal */}
      <Modal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        title="Resolve Clarification Ticket"
        description="Formally mark this clarification as resolved or reject response."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#193A39] mb-1">Decision</label>
            <select
              value={isAccepted ? 'ACCEPT' : 'REJECT'}
              onChange={e => setIsAccepted(e.target.value === 'ACCEPT')}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            >
              <option value="ACCEPT">Accept Response & Mark Resolved</option>
              <option value="REJECT">Reject Response (Deficiency Unresolved)</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-[#193A39] mb-1">Resolution Remarks</label>
            <textarea
              rows={3}
              placeholder="Record officer satisfaction or remaining requirements..."
              value={resolutionNotes}
              onChange={e => setResolutionNotes(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3.5 border-t border-[#D9E7E4]">
            <button
              onClick={() => setIsResolveModalOpen(false)}
              className="px-3.5 py-1.5 border border-[#D9E7E4] rounded-md font-medium text-[#647A78] hover:bg-[#F3F8F7] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleResolveSubmit}
              className="px-3.5 py-1.5 bg-[#115E59] text-white rounded-md font-semibold hover:bg-[#0F766E] shadow-2xs cursor-pointer"
            >
              Record Resolution
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

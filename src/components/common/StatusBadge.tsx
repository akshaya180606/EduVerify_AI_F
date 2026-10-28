import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock, HelpCircle, AlertOctagon, FileCheck } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const norm = (status || '').toUpperCase().replace(/\s+/g, '_');

  // Semantic mappings according to Section 3 of specification
  if (['PASS', 'VERIFIED', 'COMPLIANT', 'APPROVED', 'ACTIVE', 'ACCREDITED', 'SUCCESS', 'CONNECTED', 'HEALTHY'].includes(norm)) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#DCFCE7]/80 text-[#15803D] border border-[#86EFAC]/80 ${className}`}>
        <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
        {status.replace(/_/g, ' ')}
      </span>
    );
  }

  if (['FAIL', 'REJECTED', 'DISCREPANCY_FOUND', 'NON_COMPLIANT', 'ERROR', 'FAILED', 'SUSPENDED'].includes(norm)) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#FEE2E2]/80 text-[#B91C1C] border border-[#FCA5A5]/80 ${className}`}>
        <XCircle className="w-3 h-3 flex-shrink-0" />
        {status.replace(/_/g, ' ')}
      </span>
    );
  }

  if (['WARNING', 'NEEDS_REVIEW', 'CLARIFICATION_REQUIRED', 'EXPIRED', 'NEEDS_IMPROVEMENT', 'POSSIBLE_ANOMALY'].includes(norm)) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#FEF3C7]/80 text-[#B45309] border border-[#FCD34D]/80 ${className}`}>
        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
        {status.replace(/_/g, ' ')}
      </span>
    );
  }

  if (['UNDER_SCRUTINY', 'UNDER_VERIFICATION', 'UNDER_INSPECTION', 'INSPECTION_PENDING', 'RECOMMENDATION_SUBMITTED', 'PROCESSING', 'SCHEDULED'].includes(norm)) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#CCFBF1]/80 text-[#0F766E] border border-[#99F6E4]/80 ${className}`}>
        <FileCheck className="w-3 h-3 flex-shrink-0" />
        {status.replace(/_/g, ' ')}
      </span>
    );
  }

  if (['PENDING', 'PENDING_RESPONSE', 'DRAFT', 'QUEUED', 'UPLOADED'].includes(norm)) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB] ${className}`}>
        <Clock className="w-3 h-3 flex-shrink-0" />
        {status.replace(/_/g, ' ')}
      </span>
    );
  }

  // Neutral / Unable to verify
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F3F4F6] text-[#6B7280] border border-[#D1D5DB] ${className}`}>
      <HelpCircle className="w-3 h-3 flex-shrink-0" />
      {status.replace(/_/g, ' ')}
    </span>
  );
};

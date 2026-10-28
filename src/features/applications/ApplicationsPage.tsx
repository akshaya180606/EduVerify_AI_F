import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { Application, ApplicationStatus, ApplicationType } from '../../types/index.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Modal } from '../../components/common/Modal.js';
import {
  FileText,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Send,
  Building,
  GraduationCap,
  History,
  FileCheck2,
  CheckSquare,
  AlertOctagon,
  Ruler,
} from 'lucide-react';

interface ApplicationsPageProps {
  onNavigateToDocs?: () => void;
}

export const ApplicationsPage: React.FC<ApplicationsPageProps> = ({ onNavigateToDocs }) => {
  const { role, user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [appDetail, setAppDetail] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [targetTransition, setTargetTransition] = useState<{ status: ApplicationStatus; label: string } | null>(null);
  const [transitionReason, setTransitionReason] = useState('');

  // Create form state
  const [newAppType, setNewAppType] = useState<ApplicationType>('EXTENSION_OF_APPROVAL');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [programmeName, setProgrammeName] = useState('Computer Science and Engineering');
  const [intakeRequested, setIntakeRequested] = useState(180);
  const [targetInstitutionId, setTargetInstitutionId] = useState<string>('INST-2026-001');
  const [availableInstitutions, setAvailableInstitutions] = useState<any[]>([]);

  // Detail tabs state
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'COMPLIANCE' | 'ANOMALIES' | 'INFRASTRUCTURE'>('OVERVIEW');
  const [complianceReport, setComplianceReport] = useState<any>(null);
  const [anomalyReport, setAnomalyReport] = useState<any>(null);
  const [infraReport, setInfraReport] = useState<any>(null);

  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      const res = await api.getApplications();
      setApplications(res.applications);
      if (res.applications.length > 0 && !selectedApp) {
        loadAppDetail(res.applications[0].id);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAppDetail = async (id: string) => {
    try {
      const [res, compRes, anomRes, infraRes] = await Promise.all([
        api.getApplication(id),
        api.getApplicationCompliance(id).catch(() => null),
        api.getApplicationAnomalies(id).catch(() => null),
        api.getApplicationInfrastructure(id).catch(() => null),
      ]);
      setSelectedApp(res.application);
      setAppDetail(res);
      setComplianceReport(compRes?.report || null);
      setAnomalyReport(anomRes || null);
      setInfraReport(infraRes?.report || null);
    } catch (err) {
      console.error('Failed to load application detail:', err);
    }
  };

  useEffect(() => {
    fetchApplications();
    if (role === 'AICTE_ADMIN') {
      api.getInstitutions().then(res => {
        setAvailableInstitutions(res.institutions);
        if (res.institutions.length > 0) {
          setTargetInstitutionId(res.institutions[0].id);
        }
      }).catch(() => {});
    }
  }, [role, user]);

  const handleCreateApplication = async () => {
    try {
      const res = await api.createApplication({
        type: newAppType,
        academicYear,
        institutionId: role === 'AICTE_ADMIN' ? targetInstitutionId : undefined,
        programmes: [
          {
            name: programmeName,
            level: 'UG',
            intakeApproved: 120,
            intakeRequested,
          },
        ],
      });
      setIsCreateModalOpen(false);
      await fetchApplications();
      loadAppDetail(res.application.id);
    } catch (err: any) {
      alert(`Error creating application: ${err.message}`);
    }
  };

  const handleExecuteTransition = async () => {
    if (!selectedApp || !targetTransition) return;
    try {
      const res = await api.transitionApplication(
        selectedApp.id,
        targetTransition.status,
        transitionReason
      );
      setIsTransitionModalOpen(false);
      setTransitionReason('');
      await fetchApplications();
      loadAppDetail(res.application.id);
    } catch (err: any) {
      alert(`Transition Failed: ${err.message}`);
    }
  };

  return (
    <div className="p-4 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Banner */}
      <div className="bg-white rounded-lg p-4 sm:p-5 border border-[#D9E7E4] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#0D9488] uppercase tracking-wider">
              {role === 'COLLEGE_MANAGEMENT' ? 'Institutional Applications' : 'Approval Pipeline'}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D] font-medium border border-[#86EFAC]/60">
              {applications.length} Dockets Active
            </span>
          </div>
          <h1 className="text-lg font-semibold text-[#193A39] mt-1">Regulatory Approval Dockets</h1>
          <p className="text-xs text-[#647A78] mt-0.5">
            New Applicant and Extension of Approval (EoA) statutory lifecycle management under AICTE APH Regulations.
          </p>
        </div>

        {(role === 'COLLEGE_MANAGEMENT' || role === 'AICTE_ADMIN') && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Initiate Application</span>
          </button>
        )}
      </div>

      {/* Main Grid: Application Selector on Left, Detail Dossier on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Applications Master List */}
        <div className="space-y-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#647A78]">Applications Queue</h2>
          {applications.map(app => {
            const isSelected = selectedApp?.id === app.id;
            return (
              <div
                key={app.id}
                onClick={() => loadAppDetail(app.id)}
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
                  <span className="font-mono">{app.academicYear}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Complete Application Docket Detail */}
        <div className="lg:col-span-2 space-y-5">
          {selectedApp ? (
            <div className="bg-white rounded-lg border border-[#D9E7E4] shadow-xs overflow-hidden">
              {/* Docket Header */}
              <div className="p-4 sm:p-5 border-b border-[#D9E7E4] bg-[#F3F8F7]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#115E59] bg-white px-2 py-0.5 rounded border border-[#D9E7E4]">
                      {selectedApp.applicationNumber}
                    </span>
                    <StatusBadge status={selectedApp.status} />
                  </div>
                  <h2 className="text-base font-semibold text-[#193A39] mt-2">{selectedApp.institutionName}</h2>
                  <p className="text-xs text-[#647A78] mt-0.5">
                    {selectedApp.type.replace(/_/g, ' ')} — Cycle {selectedApp.academicYear}
                  </p>
                </div>

                {/* Statutory Transition Controls according to Role */}
                <div className="flex items-center gap-2">
                  {selectedApp.status === 'DRAFT' && (role === 'COLLEGE_MANAGEMENT' || role === 'AICTE_ADMIN') && (
                    <button
                      onClick={() => {
                        setTargetTransition({ status: 'SUBMITTED', label: 'Submit Final Application' });
                        setIsTransitionModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-[#115E59] hover:bg-[#0F766E] text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Docket</span>
                    </button>
                  )}

                  {selectedApp.status === 'SUBMITTED' && (role === 'SCRUTINY_OFFICER' || role === 'AICTE_ADMIN') && (
                    <button
                      onClick={() => {
                        setTargetTransition({ status: 'UNDER_SCRUTINY', label: 'Begin Scrutiny Audit' });
                        setIsTransitionModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-[#115E59] hover:bg-[#0F766E] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer shadow-2xs"
                    >
                      <span>Start Scrutiny</span>
                    </button>
                  )}

                  {selectedApp.status === 'RECOMMENDATION_SUBMITTED' && role === 'AICTE_ADMIN' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setTargetTransition({ status: 'APPROVED', label: 'Ratify Final AICTE Approval' });
                          setIsTransitionModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer shadow-2xs"
                      >
                        <span>Ratify Approval</span>
                      </button>
                      <button
                        onClick={() => {
                          setTargetTransition({ status: 'REJECTED', label: 'Record Adverse Decision' });
                          setIsTransitionModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer shadow-2xs"
                      >
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs Header */}
              <div className="flex items-center gap-1 px-4 sm:px-5 pt-3 border-b border-[#D9E7E4] bg-[#F8FAF9] overflow-x-auto text-xs">
                <button
                  onClick={() => setActiveTab('OVERVIEW')}
                  className={`px-3 py-2 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'OVERVIEW'
                      ? 'border-[#115E59] text-[#115E59] font-semibold bg-white'
                      : 'border-transparent text-[#647A78] hover:text-[#193A39]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Overview & Evidence</span>
                </button>

                <button
                  onClick={() => setActiveTab('COMPLIANCE')}
                  className={`px-3 py-2 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'COMPLIANCE'
                      ? 'border-[#115E59] text-[#115E59] font-semibold bg-white'
                      : 'border-transparent text-[#647A78] hover:text-[#193A39]'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Regulatory Checklist</span>
                  {complianceReport && (
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      complianceReport.summary.hasCriticalDeficiency
                        ? 'bg-[#FEE2E2] text-[#B91C1C]'
                        : 'bg-[#DCFCE7] text-[#15803D]'
                    }`}>
                      {complianceReport.summary.complianceScore}%
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('ANOMALIES')}
                  className={`px-3 py-2 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'ANOMALIES'
                      ? 'border-[#115E59] text-[#115E59] font-semibold bg-white'
                      : 'border-transparent text-[#647A78] hover:text-[#193A39]'
                  }`}
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>Anomaly Flags</span>
                  {anomalyReport && anomalyReport.totalAnomalies > 0 && (
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      anomalyReport.highestRiskLevel === 'HIGH'
                        ? 'bg-[#FEE2E2] text-[#B91C1C]'
                        : 'bg-[#FEF3C7] text-[#B45309]'
                    }`}>
                      {anomalyReport.totalAnomalies}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('INFRASTRUCTURE')}
                  className={`px-3 py-2 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'INFRASTRUCTURE'
                      ? 'border-[#115E59] text-[#115E59] font-semibold bg-white'
                      : 'border-transparent text-[#647A78] hover:text-[#193A39]'
                  }`}
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>Infrastructure Norms</span>
                  {infraReport?.requiresEvcOnSiteVisit && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#FEF3C7] text-[#B45309]">
                      EVC
                    </span>
                  )}
                </button>
              </div>

              {/* Tab 1: Overview & Evidence */}
              {activeTab === 'OVERVIEW' && (
                <>
                  {/* Programmes Offered Table */}
                  <div className="p-4 sm:p-5 border-b border-[#D9E7E4]">
                    <h3 className="text-xs font-semibold text-[#193A39] mb-3 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-[#115E59]" />
                      <span>Programmes & Sanctioned Seat Intake</span>
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F3F8F7] text-[#647A78] uppercase text-[10px] tracking-wider border border-[#D9E7E4]">
                          <tr>
                            <th className="py-2 px-3">Programme Title</th>
                            <th className="py-2 px-3">Level</th>
                            <th className="py-2 px-3">Approved Intake</th>
                            <th className="py-2 px-3 font-semibold text-[#115E59]">Requested Intake</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#D9E7E4] border border-[#D9E7E4]">
                          {selectedApp.programmes.map((p, idx) => (
                            <tr key={idx} className="hover:bg-[#F3F8F7]/50">
                              <td className="py-2.5 px-3 font-medium text-[#193A39]">{p.name}</td>
                              <td className="py-2.5 px-3 font-mono">{p.level}</td>
                              <td className="py-2.5 px-3 font-mono">{p.intakeApproved} seats</td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-[#115E59]">{p.intakeRequested} seats</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Uploaded Supporting Documents Dossier */}
                  <div className="p-4 sm:p-5 border-b border-[#D9E7E4]">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-[#193A39] flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-[#115E59]" />
                        <span>Compliance Evidence & Certificates ({appDetail?.documents?.length || 0})</span>
                      </h3>
                      {onNavigateToDocs && (
                        <button
                          onClick={onNavigateToDocs}
                          className="text-xs font-medium text-[#115E59] hover:text-[#0F766E] flex items-center gap-1 cursor-pointer"
                        >
                          <span>Upload Documents</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {(!appDetail?.documents || appDetail.documents.length === 0) ? (
                        <div className="p-4 bg-[#F3F8F7] rounded-md text-center text-xs text-[#647A78]">
                          No documents associated yet. Upload mandatory Land Deed and Fire NOC in Document Vault.
                        </div>
                      ) : (
                        appDetail.documents.map((d: any) => (
                          <div
                            key={d.id}
                            className="p-3 rounded-md border border-[#D9E7E4] bg-white flex items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="font-medium text-[#193A39]">{d.categoryLabel}</div>
                              <div className="font-mono text-[10px] text-[#647A78] mt-0.5">
                                SHA-256: {d.sha256Checksum.substring(0, 16)}... | {(d.fileSizeBytes / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={d.extractionStatus} />
                              <StatusBadge status={d.verificationStatus} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Status Audit Timeline */}
                  <div className="p-4 sm:p-5">
                    <h3 className="text-xs font-semibold text-[#193A39] mb-4 flex items-center gap-2">
                      <History className="w-4 h-4 text-[#115E59]" />
                      <span>Immutable State Transition Timeline</span>
                    </h3>

                    <div className="space-y-3.5">
                      {appDetail?.history?.map((hist: any) => (
                        <div key={hist.id} className="flex items-start gap-3 text-xs">
                          <div className="w-2 h-2 rounded-full bg-[#115E59] mt-1.5 flex-shrink-0" />
                          <div className="flex-1 pb-3 border-b border-[#F3F8F7]">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[#193A39]">
                                {hist.fromStatus} → {hist.toStatus}
                              </span>
                              <span className="text-[10px] text-[#647A78]">
                                {new Date(hist.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#647A78] mt-1">{hist.reason}</p>
                            <div className="text-[10px] text-[#115E59] font-medium mt-0.5">
                              Officer: {hist.changedByName} ({hist.changedByRole})
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Tab 2: AICTE Regulatory Checklist */}
              {activeTab === 'COMPLIANCE' && (
                <div className="p-4 sm:p-5 space-y-4">
                  {complianceReport ? (
                    <>
                      {/* Summary Banner */}
                      <div className="p-4 bg-[#F8FAF9] rounded-lg border border-[#D9E7E4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold text-[#0D9488] uppercase tracking-wider">
                            AICTE Approval Process Handbook (APH 2024-2027) Engine
                          </div>
                          <div className="text-sm font-semibold text-[#193A39] mt-0.5">
                            Compliance Score: {complianceReport.summary.complianceScore}% ({complianceReport.summary.compliantCount} of {complianceReport.summary.totalRules} Prescribed Norms Satisfied)
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-1 rounded bg-[#DCFCE7] text-[#15803D] font-semibold">
                            {complianceReport.summary.compliantCount} Compliant
                          </span>
                          {complianceReport.summary.nonCompliantCount > 0 && (
                            <span className="px-2 py-1 rounded bg-[#FEE2E2] text-[#B91C1C] font-semibold">
                              {complianceReport.summary.nonCompliantCount} Non-Compliant
                            </span>
                          )}
                          {complianceReport.summary.clarificationCount > 0 && (
                            <span className="px-2 py-1 rounded bg-[#FEF3C7] text-[#B45309] font-semibold">
                              {complianceReport.summary.clarificationCount} Clarification Needed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Deficiencies alert */}
                      {complianceReport.deficiencies && complianceReport.deficiencies.length > 0 && (
                        <div className="p-3.5 bg-[#FEF2F2] rounded-lg border border-[#FCA5A5] space-y-2">
                          <div className="text-xs font-semibold text-[#B91C1C] flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Critical Regulatory Deficiencies Identified ({complianceReport.deficiencies.length})</span>
                          </div>
                          <div className="space-y-1.5 text-xs text-[#7F1D1D]">
                            {complianceReport.deficiencies.map((d: any, idx: number) => (
                              <div key={idx} className="p-2 bg-white/70 rounded border border-[#FECACA]">
                                <span className="font-semibold">{d.title}</span> ({d.aphClause})
                                <p className="text-[11px] mt-0.5">{d.explanation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rules evaluation table */}
                      <div className="space-y-2">
                        {complianceReport.results.map((r: any) => (
                          <div key={r.ruleId} className="p-3 bg-white rounded-lg border border-[#D9E7E4] space-y-1.5 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-semibold text-[#193A39]">{r.title}</span>
                                <span className="text-[10px] font-mono ml-2 text-[#0D9488] bg-[#CCFBF1] px-1.5 py-0.5 rounded">
                                  {r.aphClause}
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.outcome === 'COMPLIANT'
                                  ? 'bg-[#DCFCE7] text-[#15803D]'
                                  : r.outcome === 'NON_COMPLIANT'
                                  ? 'bg-[#FEE2E2] text-[#B91C1C]'
                                  : 'bg-[#FEF3C7] text-[#B45309]'
                              }`}>
                                {r.outcome}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#475569]">{r.explanation}</p>
                            <div className="text-[10px] text-[#647A78] font-mono bg-[#F8FAF9] p-1.5 rounded">
                              Evidence: {r.evidence}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-xs text-[#647A78]">Evaluating APH compliance rules...</div>
                  )}
                </div>
              )}

              {/* Tab 3: Anomaly Detection */}
              {activeTab === 'ANOMALIES' && (
                <div className="p-4 sm:p-5 space-y-4">
                  {anomalyReport ? (
                    <>
                      {/* Risk Banner */}
                      <div className={`p-4 rounded-lg border flex items-center justify-between gap-3 ${
                        anomalyReport.highestRiskLevel === 'HIGH'
                          ? 'bg-[#FEF2F2] border-[#FCA5A5]'
                          : anomalyReport.highestRiskLevel === 'MEDIUM'
                          ? 'bg-[#FFFBEB] border-[#FDE68A]'
                          : 'bg-[#F0FDF4] border-[#86EFAC]'
                      }`}>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#647A78]">
                            AI-Assisted Anomaly & Authenticity Audit
                          </div>
                          <div className="text-sm font-semibold text-[#193A39] mt-0.5">
                            Overall Risk Rating: {anomalyReport.highestRiskLevel} ({anomalyReport.totalAnomalies} flags detected across docket)
                          </div>
                        </div>
                      </div>

                      {/* Regulatory Boundary Disclaimer */}
                      <div className="p-3 bg-[#F8FAF9] rounded-lg border border-[#D9E7E4] text-[11px] text-[#647A78]">
                        <span className="font-semibold text-[#193A39]">Important Regulatory Notice:</span> {anomalyReport.disclaimer}
                      </div>

                      {/* Flag Cards */}
                      {anomalyReport.totalAnomalies === 0 ? (
                        <div className="p-8 text-center bg-white rounded-lg border border-[#D9E7E4] text-xs text-[#15803D] font-medium flex flex-col items-center gap-2">
                          <CheckCircle2 className="w-6 h-6 text-[#15803D]" />
                          <span>No structural, chronological, or cryptographic anomalies detected in uploaded documents.</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {anomalyReport.reports.flatMap((rep: any) =>
                            rep.flags.map((flag: any) => (
                              <div key={flag.id} className="p-3.5 bg-white rounded-lg border border-[#D9E7E4] space-y-2 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      flag.severity === 'HIGH'
                                        ? 'bg-[#FEE2E2] text-[#B91C1C]'
                                        : 'bg-[#FEF3C7] text-[#B45309]'
                                    }`}>
                                      {flag.severity} RISK
                                    </span>
                                    <span className="font-semibold text-[#193A39]">{flag.flagTitle}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-[#647A78] bg-[#F1F5F9] px-2 py-0.5 rounded">
                                    {flag.category}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#334155]">{flag.explanation}</p>
                                <div className="p-2 bg-[#F8FAF9] rounded text-[11px] font-mono text-[#475569]">
                                  Evidence: {flag.evidence}
                                </div>
                                <div className="text-[11px] text-[#0F766E] font-medium">
                                  Action Required: {flag.suggestedAction}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-8 text-center text-xs text-[#647A78]">Scanning documents for anomalies...</div>
                  )}
                </div>
              )}

              {/* Tab 4: Infrastructure Norms */}
              {activeTab === 'INFRASTRUCTURE' && (
                <div className="p-4 sm:p-5 space-y-4">
                  {infraReport ? (
                    <>
                      {/* EVC Routing Banner */}
                      {infraReport.requiresEvcOnSiteVisit ? (
                        <div className="p-4 bg-[#FFFBEB] rounded-lg border border-[#FDE68A] space-y-1.5">
                          <div className="text-xs font-semibold text-[#B45309] flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-[#B45309]" />
                            <span>Expert Visiting Committee (EVC) Physical On-Site Inspection Required</span>
                          </div>
                          <p className="text-xs text-[#92400E]">
                            {infraReport.evcRoutingReason || 'Physical measurement required to verify carpet areas.'}
                          </p>
                        </div>
                      ) : (
                        <div className="p-4 bg-[#F0FDF4] rounded-lg border border-[#86EFAC] text-xs text-[#15803D] font-semibold">
                          Documentary Blueprint Schedule Satisfied ({infraReport.complianceRatingPercent}% Norms Corroborated)
                        </div>
                      )}

                      {/* Disclaimer */}
                      <div className="p-3 bg-[#F8FAF9] rounded-lg border border-[#D9E7E4] text-[11px] text-[#647A78]">
                        <span className="font-semibold text-[#193A39]">Statutory Disclaimer:</span> {infraReport.regulatoryDisclaimer}
                      </div>

                      {/* Norms Table */}
                      <div className="space-y-2">
                        {infraReport.items.map((item: any) => (
                          <div key={item.requirementId} className="p-3 bg-white rounded-lg border border-[#D9E7E4] text-xs space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-semibold text-[#193A39]">{item.areaName}</span>
                                <span className="text-[10px] font-mono ml-2 text-[#0D9488] bg-[#CCFBF1] px-1.5 py-0.5 rounded">
                                  {item.aphNormClause}
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.status === 'EVIDENCE_SATISFIED'
                                  ? 'bg-[#DCFCE7] text-[#15803D]'
                                  : item.status === 'REQUIRES_EVC_INSPECTION'
                                  ? 'bg-[#FEF3C7] text-[#B45309]'
                                  : 'bg-[#FEE2E2] text-[#B91C1C]'
                              }`}>
                                {item.status.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#647A78]">
                              Prescribed Minimum Carpet Area: <span className="font-mono font-semibold text-[#193A39]">{item.minCarpetAreaSqm} sq.m</span>
                            </div>
                            {item.discrepancyNote && (
                              <p className="text-[11px] text-[#B45309]">{item.discrepancyNote}</p>
                            )}
                            <div className="text-[10px] text-[#0F766E] font-medium">
                              Guidance: {item.inspectionGuidance}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-xs text-[#647A78]">Checking infrastructure norms...</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-10 text-center text-xs text-[#647A78] border border-[#D9E7E4]">
              Select an application docket to view full statutory documentation.
            </div>
          )}
        </div>
      </div>

      {/* Initiate Application Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Initiate AICTE Approval Application"
        description="Select workflow category and enter intake requirements for academic cycle 2026-27."
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          {role === 'AICTE_ADMIN' && availableInstitutions.length > 0 && (
            <div>
              <label className="block font-medium text-[#193A39] mb-1">Target Institution *</label>
              <select
                value={targetInstitutionId}
                onChange={e => setTargetInstitutionId(e.target.value)}
                className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
              >
                {availableInstitutions.map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} ({inst.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-medium text-[#193A39] mb-1">Application Category</label>
            <select
              value={newAppType}
              onChange={e => setNewAppType(e.target.value as ApplicationType)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white text-[#193A39]"
            >
              <option value="EXTENSION_OF_APPROVAL">Extension of Approval (EoA) — Existing Institution</option>
              <option value="NEW_APPLICANT">New Technical Institution Setup (Initial Letter of Approval)</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-[#193A39] mb-1">Academic Cycle</label>
            <input
              type="text"
              value={academicYear}
              disabled
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md bg-[#F3F8F7] text-xs font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-[#193A39] mb-1">Primary Discipline / Programme</label>
            <input
              type="text"
              value={programmeName}
              onChange={e => setProgrammeName(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white"
            />
          </div>

          <div>
            <label className="block font-medium text-[#193A39] mb-1">Proposed Intake Capacity</label>
            <input
              type="number"
              value={intakeRequested}
              onChange={e => setIntakeRequested(Number(e.target.value))}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3.5 border-t border-[#D9E7E4]">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="px-3.5 py-1.5 border border-[#D9E7E4] rounded-md font-medium text-[#647A78] hover:bg-[#F3F8F7] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateApplication}
              className="px-3.5 py-1.5 bg-[#115E59] text-white rounded-md font-semibold hover:bg-[#0F766E] shadow-2xs cursor-pointer"
            >
              Initialize Draft Docket
            </button>
          </div>
        </div>
      </Modal>

      {/* Transition Confirmation Modal */}
      <Modal
        isOpen={isTransitionModalOpen}
        onClose={() => setIsTransitionModalOpen(false)}
        title={targetTransition?.label || 'Confirm Regulatory Transition'}
        description={`Transition application to ${targetTransition?.status}. This change is permanently audited.`}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#193A39] mb-1">Statutory Rationale / Remarks</label>
            <textarea
              rows={3}
              value={transitionReason}
              onChange={e => setTransitionReason(e.target.value)}
              placeholder="Enter official justification, committee meeting reference, or gazette order..."
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-md text-xs focus:outline-hidden focus:border-[#0D9488]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3.5 border-t border-[#D9E7E4]">
            <button
              onClick={() => setIsTransitionModalOpen(false)}
              className="px-3.5 py-1.5 border border-[#D9E7E4] rounded-md font-medium text-[#647A78] hover:bg-[#F3F8F7] cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteTransition}
              className="px-3.5 py-1.5 bg-[#115E59] text-white rounded-md font-semibold hover:bg-[#0F766E] shadow-2xs cursor-pointer"
            >
              Confirm Transition
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

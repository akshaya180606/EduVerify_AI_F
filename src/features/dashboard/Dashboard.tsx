import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { StatCard } from '../../components/common/StatCard.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import {
  Building2,
  FileText,
  SearchCheck,
  FileCheck2,
  ClipboardList,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  Server,
  CheckCircle2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { role, user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [clarifications, setClarifications] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [sumRes, appRes, clarRes, alertsRes] = await Promise.all([
          api.getReportsSummary(),
          api.getApplications(),
          api.getClarifications(),
          api.getRegulatoryAlerts().catch(() => ({ alerts: [], totalAlerts: 0 })),
        ]);
        setSummary(sumRes);
        setApplications(appRes.applications);
        setClarifications(clarRes.clarifications);
        setAlerts(alertsRes.alerts || []);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [role, user]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-64 bg-[#D9E7E4]/50 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-[#D9E7E4]/40 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Bar chart data for application statuses
  const statusChartData = summary?.byStatus
    ? Object.entries(summary.byStatus).map(([status, count]) => ({
        status: status.replace(/_/g, ' '),
        count,
      }))
    : [];

  const PIE_COLORS = ['#115E59', '#0D9488', '#F59E0B', '#EF4444', '#6B7280'];

  return (
    <div className="p-5 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Role Banner */}
      <div className="bg-white rounded-lg p-5 border border-[#D9E7E4] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#0D9488] uppercase tracking-wide">
              {role.replace(/_/g, ' ')} Console
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-[#F3F8F7] text-[#647A78] border border-[#D9E7E4]">
              Cycle: 2026-2027
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#193A39] mt-1 tracking-tight">Welcome, {user?.name}</h1>
          <p className="text-xs text-[#647A78] mt-0.5 leading-normal">
            {role === 'COLLEGE_MANAGEMENT'
              ? 'Manage institutional profiles, EoA submissions, document uploads, and clarification responses.'
              : 'Regulatory scrutiny, digital document verification, and statutory inspection management.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {role === 'COLLEGE_MANAGEMENT' && (
            <button
              onClick={() => onNavigate('applications')}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <span>Manage Applications</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {role === 'SCRUTINY_OFFICER' && (
            <button
              onClick={() => onNavigate('scrutiny')}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <span>Open Scrutiny Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {role === 'VERIFICATION_OFFICER' && (
            <button
              onClick={() => onNavigate('verification')}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <span>Verification Tasks</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {role === 'INSPECTION_OFFICER' && (
            <button
              onClick={() => onNavigate('inspections')}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <span>Assigned Inspections</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {role === 'AICTE_ADMIN' && (
            <button
              onClick={() => onNavigate('reports')}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <span>Regulatory Reports</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {role === 'AICTE_ADMIN' ? (
          <>
            <StatCard
              title="Total Institutions"
              value={summary?.totalInstitutions || 2}
              subtitle="Accredited & Active"
              icon={<Building2 className="w-4 h-4" />}
              onClick={() => onNavigate('institutions')}
            />
            <StatCard
              title="Active Applications"
              value={summary?.totalApplications || 0}
              subtitle="In Approval Pipeline"
              icon={<FileText className="w-4 h-4" />}
              onClick={() => onNavigate('applications')}
            />
            <StatCard
              title="Under Scrutiny"
              value={summary?.byStatus?.['UNDER_SCRUTINY'] || 0}
              subtitle="Checklist evaluation"
              icon={<SearchCheck className="w-4 h-4" />}
              onClick={() => onNavigate('scrutiny')}
            />
            <StatCard
              title="Pending Clarifications"
              value={summary?.pendingClarifications || 0}
              subtitle="Awaiting College Response"
              icon={<AlertTriangle className="w-4 h-4 text-[#B45309]" />}
              onClick={() => onNavigate('clarifications')}
            />
          </>
        ) : role === 'COLLEGE_MANAGEMENT' ? (
          <>
            <StatCard
              title="Active Applications"
              value={applications.length}
              subtitle="Cycle 2026-27"
              icon={<FileText className="w-4 h-4" />}
              onClick={() => onNavigate('applications')}
            />
            <StatCard
              title="Uploaded Documents"
              value={summary?.totalDocuments || 0}
              subtitle="SHA-256 Validated"
              icon={<FileCheck2 className="w-4 h-4" />}
              onClick={() => onNavigate('documents')}
            />
            <StatCard
              title="Clarification Actions"
              value={clarifications.filter(c => c.status === 'PENDING_RESPONSE').length}
              subtitle="Response Required"
              icon={<AlertTriangle className="w-4 h-4 text-[#B45309]" />}
              onClick={() => onNavigate('clarifications')}
            />
            <StatCard
              title="Profile Completeness"
              value="95%"
              subtitle="AICTE Standard Compliant"
              icon={<CheckCircle2 className="w-4 h-4 text-[#15803D]" />}
              onClick={() => onNavigate('institutions')}
            />
          </>
        ) : role === 'SCRUTINY_OFFICER' ? (
          <>
            <StatCard
              title="Assigned Queue"
              value={applications.length}
              subtitle="Cases Awaiting Review"
              icon={<SearchCheck className="w-4 h-4" />}
              onClick={() => onNavigate('scrutiny')}
            />
            <StatCard
              title="Pending Clarifications"
              value={clarifications.filter(c => c.status === 'PENDING_RESPONSE').length}
              subtitle="Response in progress"
              icon={<Clock className="w-4 h-4" />}
              onClick={() => onNavigate('clarifications')}
            />
            <StatCard
              title="Under Scrutiny"
              value={applications.filter(a => a.status === 'UNDER_SCRUTINY').length}
              subtitle="In Review"
              icon={<FileText className="w-4 h-4" />}
              onClick={() => onNavigate('scrutiny')}
            />
            <StatCard
              title="Verification Pipeline"
              value={summary?.verificationOutcomes?.verified || 0}
              subtitle="Confirmed Authentic"
              icon={<FileCheck2 className="w-4 h-4 text-[#15803D]" />}
              onClick={() => onNavigate('verification')}
            />
          </>
        ) : (
          <>
            <StatCard
              title="Assigned Tasks"
              value={summary?.verificationOutcomes?.pending || 2}
              subtitle="Documents for External Check"
              icon={<FileCheck2 className="w-4 h-4" />}
              onClick={() => onNavigate('verification')}
            />
            <StatCard
              title="Verified Authentic"
              value={summary?.verificationOutcomes?.verified || 1}
              subtitle="G2G API Ledger Matches"
              icon={<CheckCircle2 className="w-4 h-4 text-[#15803D]" />}
              onClick={() => onNavigate('verification')}
            />
            <StatCard
              title="Discrepancies Flagged"
              value={summary?.verificationOutcomes?.discrepancy || 0}
              subtitle="Discrepancy Investigation"
              icon={<AlertTriangle className="w-4 h-4 text-[#B91C1C]" />}
              onClick={() => onNavigate('verification')}
            />
            <StatCard
              title="Scheduled Inspections"
              value={summary?.inspectionStatus?.scheduled || 1}
              subtitle="EVC Physical Visits"
              icon={<ClipboardList className="w-4 h-4" />}
              onClick={() => onNavigate('inspections')}
            />
          </>
        )}
      </div>

      {/* Regulatory Deficiencies & Priority Action Alerts (Priority 6) */}
      {alerts && alerts.length > 0 && (
        <div className="bg-[#FEF2F2] rounded-lg p-4 sm:p-5 border border-[#FCA5A5] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#B91C1C]" />
              <h2 className="text-xs font-bold text-[#B91C1C] uppercase tracking-wider">
                Regulatory Action Alerts & Deficiencies ({alerts.length})
              </h2>
            </div>
            <button
              onClick={() => onNavigate('applications')}
              className="text-xs text-[#B91C1C] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All Applications</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {alerts.slice(0, 4).map(alert => (
              <div
                key={alert.id}
                className="p-3 bg-white rounded-md border border-[#FECACA] flex flex-col justify-between text-xs space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-[#193A39]">{alert.title}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    alert.severity === 'HIGH' ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'bg-[#FEF3C7] text-[#B45309]'
                  }`}>
                    {alert.severity}
                  </span>
                </div>
                <p className="text-[11px] text-[#647A78] leading-relaxed">{alert.description}</p>
                <div className="text-[10px] font-medium text-[#115E59]">
                  {alert.institutionName} ({alert.applicationNumber})
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual Analytics & Recent Docket Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Visual Distribution Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg p-5 border border-[#D9E7E4] shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-[#193A39]">Approval Workflow Distribution</h2>
              <p className="text-xs text-[#647A78] mt-0.5">Real-time pipeline statuses across authorized dockets</p>
            </div>
            <span className="text-[11px] font-medium px-2 py-0.5 bg-[#F3F8F7] text-[#115E59] rounded border border-[#D9E7E4]">
              APH 2026-27 Norms
            </span>
          </div>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F3" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#647A78' }} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#647A78' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '6px',
                    border: '1px solid #D9E7E4',
                    fontSize: '11px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                />
                <Bar dataKey="count" fill="#115E59" radius={[3, 3, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Pending Clarifications & Actions */}
        <div className="bg-white rounded-lg p-5 border border-[#D9E7E4] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-[#193A39]">Regulatory Action Queue</h2>
              <span className="text-xs font-semibold text-[#B45309] bg-[#FEF3C7] px-2 py-0.5 rounded border border-[#FCD34D]/60">
                {clarifications.filter(c => c.status === 'PENDING_RESPONSE').length} Action(s)
              </span>
            </div>
            <p className="text-xs text-[#647A78] mb-3">
              Outstanding clarifications and required statutory documents.
            </p>

            <div className="space-y-2.5">
              {clarifications.length === 0 ? (
                <div className="p-4 rounded-md bg-[#F3F8F7] text-center text-xs text-[#647A78]">
                  No pending clarification requests.
                </div>
              ) : (
                clarifications.slice(0, 3).map(c => (
                  <div
                    key={c.id}
                    onClick={() => onNavigate('clarifications')}
                    className="p-3 rounded-md border border-[#D9E7E4] hover:border-[#0D9488]/80 bg-[#F3F8F7]/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs mb-1 gap-2">
                      <span className="font-semibold text-[#193A39] truncate">{c.requestedItem}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-[11px] text-[#647A78] line-clamp-2 leading-relaxed">{c.detailedReason}</p>
                    <div className="mt-2 text-[10px] text-[#B45309] font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Due: {new Date(c.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate('clarifications')}
            className="w-full mt-3.5 py-1.5 text-xs font-semibold text-[#115E59] bg-[#F3F8F7] hover:bg-[#EAF3F1] rounded-md transition-colors border border-[#D9E7E4] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>View All Clarifications</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Applications Docket Table */}
      <div className="bg-white rounded-lg p-5 border border-[#D9E7E4] shadow-2xs">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-sm font-semibold text-[#193A39]">Active Regulatory Applications</h2>
            <p className="text-xs text-[#647A78] mt-0.5">Authorized cases in currently active session</p>
          </div>
          <button
            onClick={() => onNavigate('applications')}
            className="text-xs font-semibold text-[#115E59] hover:underline flex items-center gap-1"
          >
            <span>View all dockets</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F3F8F7]/80 text-[#647A78] text-[11px] font-semibold border-b border-[#D9E7E4]">
              <tr>
                <th className="py-2.5 px-3.5">Application No.</th>
                <th className="py-2.5 px-3.5">Institution</th>
                <th className="py-2.5 px-3.5">Type</th>
                <th className="py-2.5 px-3.5">Academic Year</th>
                <th className="py-2.5 px-3.5">Workflow Status</th>
                <th className="py-2.5 px-3.5">Officers Assigned</th>
                <th className="py-2.5 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F8F7]">
              {applications.map(app => (
                <tr key={app.id} className="hover:bg-[#F3F8F7]/40 transition-colors">
                  <td className="py-2.5 px-3.5 font-bold text-[#115E59] font-mono">{app.applicationNumber}</td>
                  <td className="py-2.5 px-3.5 font-medium text-[#193A39]">{app.institutionName}</td>
                  <td className="py-2.5 px-3.5 text-[#647A78]">{app.type.replace(/_/g, ' ')}</td>
                  <td className="py-2.5 px-3.5 font-mono text-[#647A78]">{app.academicYear}</td>
                  <td className="py-2.5 px-3.5">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="py-2.5 px-3.5 text-[#647A78]">
                    {app.assignedScrutinyOfficerName ? (
                      <span className="text-[11px] block">{app.assignedScrutinyOfficerName} (Scrutiny)</span>
                    ) : (
                      <span className="text-[11px] text-gray-400">Unassigned</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3.5 text-right">
                    <button
                      onClick={() => onNavigate('applications')}
                      className="px-2.5 py-1 text-xs font-medium text-[#115E59] bg-[#F3F8F7] hover:bg-[#E8F2F0] border border-[#D9E7E4] rounded transition-colors cursor-pointer"
                    >
                      Open Docket
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

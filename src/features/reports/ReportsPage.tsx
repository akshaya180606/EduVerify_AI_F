import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { StatCard } from '../../components/common/StatCard.js';
import {
  BarChart3,
  Download,
  Calendar,
  Building2,
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  PieChart as PieIcon,
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
  Legend,
} from 'recharts';

export const ReportsPage: React.FC = () => {
  const { role, user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setIsLoading(true);
        const res = await api.getReportsSummary();
        setSummary(res);
      } catch (err) {
        console.error('Failed to load reports summary:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSummary();
  }, [role, user]);

  const handleExportCsv = () => {
    window.location.href = `/api/v1/reports/export-csv`;
  };

  const PIE_COLORS = ['#115E59', '#0D9488', '#F59E0B', '#EF4444', '#6B7280'];

  const verificationChartData = summary?.verificationOutcomes
    ? [
        { name: 'Verified Authentic', value: summary.verificationOutcomes.verified },
        { name: 'Pending Review', value: summary.verificationOutcomes.pending },
        { name: 'Discrepancy Found', value: summary.verificationOutcomes.discrepancy },
        { name: 'Unable to Verify', value: summary.verificationOutcomes.unableToVerify },
      ].filter(d => d.value > 0)
    : [];

  const documentCategoriesData = summary?.documentCategories
    ? [
        { name: 'Land Title Deeds', count: summary.documentCategories.landTitle },
        { name: 'Fire Safety NOCs', count: summary.documentCategories.fireSafety },
        { name: 'Building Plans', count: summary.documentCategories.buildingPlan },
        { name: 'Other Compliance', count: summary.documentCategories.others },
      ]
    : [];

  return (
    <div className="p-4 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Banner */}
      <div className="bg-white rounded-lg p-4 sm:p-5 border border-[#D9E7E4] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#0D9488] uppercase tracking-wider">
              Regulatory Analytics & Exports
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D] font-medium border border-[#86EFAC]/60">
              CSV Sanitized (CWE-1236 Compliant)
            </span>
          </div>
          <h1 className="text-lg font-semibold text-[#193A39] mt-1">Approval Volume & Verification Analytics</h1>
          <p className="text-xs text-[#647A78] mt-0.5">
            Statistical breakdown of institutional compliance rates, verification desk throughput, and exportable datasets.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Applications CSV</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <StatCard
          title="Total Institutional Dockets"
          value={summary?.totalApplications || 0}
          subtitle="Processed in Cycle 2026-27"
          icon={<BarChart3 className="w-4 h-4 text-[#115E59]" />}
        />
        <StatCard
          title="Verified Documents"
          value={summary?.verificationOutcomes?.verified || 0}
          subtitle="G2G Authentic Cross-checks"
          icon={<CheckCircle2 className="w-4 h-4 text-[#15803D]" />}
        />
        <StatCard
          title="Clarification Deficiencies"
          value={summary?.pendingClarifications || 0}
          subtitle="Active Resolution Tickets"
          icon={<AlertTriangle className="w-4 h-4 text-[#B45309]" />}
        />
        <StatCard
          title="Physical Inspections"
          value={summary?.inspectionStatus?.scheduled || 0}
          subtitle="EVC Visiting Committee"
          icon={<FileCheck2 className="w-4 h-4 text-[#0D9488]" />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Document Classification Distribution */}
        <div className="bg-white rounded-lg p-4 sm:p-5 border border-[#D9E7E4] shadow-xs">
          <h2 className="text-sm font-semibold text-[#193A39] mb-0.5">Uploaded Evidence by Classification</h2>
          <p className="text-xs text-[#647A78] mb-3.5">Mandatory statutory certificates under APH requirements</p>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={documentCategoriesData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F8F7" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#647A78' }} />
                <YAxis tick={{ fontSize: 11, fill: '#647A78' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '6px',
                    border: '1px solid #D9E7E4',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="count" fill="#0D9488" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Verification Desk Outcomes Pie */}
        <div className="bg-white rounded-lg p-4 sm:p-5 border border-[#D9E7E4] shadow-xs">
          <h2 className="text-sm font-semibold text-[#193A39] mb-0.5">Verification Desk Outcomes</h2>
          <p className="text-xs text-[#647A78] mb-3.5">Issuer electronic ledger check distribution</p>

          <div className="h-60 w-full flex items-center justify-center">
            {verificationChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={verificationChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={76}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {verificationChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px',
                      border: '1px solid #D9E7E4',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-[#647A78]">No verification data available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

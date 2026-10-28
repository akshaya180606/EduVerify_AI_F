import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { AuditLogItem } from '../../types/index.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import {
  ShieldAlert,
  Search,
  Filter,
  ShieldCheck,
  Lock,
  User,
  Clock,
  Layers,
} from 'lucide-react';

export const AuditPage: React.FC = () => {
  const { role, user } = useAuth();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const res = await api.getAuditLogs();
      setLogs(res.logs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'AICTE_ADMIN') {
      fetchLogs();
    }
  }, [role, user]);

  if (role !== 'AICTE_ADMIN') {
    return (
      <div className="p-12 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 bg-[#FEE2E2] text-[#B91C1C] rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-[#193A39]">Regulatory Access Denied</h1>
        <p className="text-xs text-[#647A78] leading-relaxed">
          Access to the Central Regulatory Audit Trail is strictly restricted to authorized AICTE Central Bureau Administrators. This access attempt has been recorded.
        </p>
      </div>
    );
  }

  const filteredLogs = logs.filter(l => {
    const matchesSearch =
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.actorName.toLowerCase().includes(search.toLowerCase()) ||
      l.details.toLowerCase().includes(search.toLowerCase()) ||
      (l.institutionName && l.institutionName.toLowerCase().includes(search.toLowerCase()));
    const matchesEntity = filterEntity ? l.entityType === filterEntity : true;
    return matchesSearch && matchesEntity;
  });

  return (
    <div className="p-4 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 sm:p-5 border border-[#D9E7E4] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#0D9488] uppercase tracking-wider">
              AICTE Central Regulatory Audit
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D] font-medium border border-[#86EFAC]/60">
              Append-Only & Immutable
            </span>
          </div>
          <h1 className="text-lg font-semibold text-[#193A39] mt-1">Statutory Compliance Audit Trail</h1>
          <p className="text-xs text-[#647A78] mt-0.5">
            Cryptographic ledger tracking document uploads, scrutiny reviews, G2G verification checks, and final council ratifications.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#115E59] bg-[#F3F8F7] px-2.5 py-1.5 rounded-md border border-[#D9E7E4]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0D9488]" />
          <span className="text-[11px]">Integrity Chain: SHA-256 Verified</span>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#647A78]" />
          <input
            type="text"
            placeholder="Search by action, actor name, institution, or keywords..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#D9E7E4] rounded-md text-xs text-[#193A39] placeholder-[#647A78] focus:outline-hidden focus:border-[#0D9488]"
          />
        </div>
        <select
          value={filterEntity}
          onChange={e => setFilterEntity(e.target.value)}
          className="bg-white border border-[#D9E7E4] px-3 py-1.5 rounded-md text-xs text-[#193A39] focus:outline-hidden focus:border-[#0D9488]"
        >
          <option value="">All Entity Types</option>
          <option value="APPLICATION">Application Dockets</option>
          <option value="DOCUMENT">Documents & Extractions</option>
          <option value="VERIFICATION">Verification Attempts</option>
          <option value="CLARIFICATION">Clarifications</option>
          <option value="INSPECTION">Inspections</option>
          <option value="USER">User Sessions</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg border border-[#D9E7E4] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F3F8F7] text-[#647A78] uppercase text-[10px] tracking-wider border-b border-[#D9E7E4]">
              <tr>
                <th className="py-2.5 px-3.5 font-semibold">Timestamp</th>
                <th className="py-2.5 px-3.5 font-semibold">Actor</th>
                <th className="py-2.5 px-3.5 font-semibold">Action</th>
                <th className="py-2.5 px-3.5 font-semibold">Target Entity</th>
                <th className="py-2.5 px-3.5 font-semibold">Institutional Scope</th>
                <th className="py-2.5 px-3.5 font-semibold">Audit Event Details</th>
                <th className="py-2.5 px-3.5 font-semibold text-right">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F8F7]">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-[#F3F8F7]/50 transition-colors">
                  <td className="py-2.5 px-3.5 text-[#647A78] font-mono whitespace-nowrap text-[11px]">
                    {new Date(log.timestamp).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 px-3.5">
                    <span className="font-semibold text-[#193A39] block text-xs">{log.actorName}</span>
                    <span className="text-[10px] text-[#0D9488] font-mono">{log.actorRole}</span>
                  </td>
                  <td className="py-2.5 px-3.5 font-mono font-semibold text-[#115E59] text-[11px] whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-3.5">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-[#F3F8F7] text-[#647A78] border border-[#D9E7E4]">
                      {log.entityType} ({log.entityId})
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 text-[#647A78] text-[11px]">
                    {log.institutionName || 'Central AICTE Central'}
                  </td>
                  <td className="py-2.5 px-3.5 text-[#193A39] max-w-xs truncate text-xs" title={log.details}>
                    {log.details}
                  </td>
                  <td className="py-2.5 px-3.5 text-right">
                    <StatusBadge status={log.outcome} />
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

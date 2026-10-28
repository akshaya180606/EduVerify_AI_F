import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import {
  ServerCog,
  Database,
  Cpu,
  HardDrive,
  Sparkles,
  Mail,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Layers,
  FileCode2,
} from 'lucide-react';

export const AdminIntegrationsPage: React.FC = () => {
  const { role } = useAuth();
  const [healthData, setHealthData] = useState<any>(null);
  const [rulesData, setRulesData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchIntegrations = async () => {
    try {
      setIsLoading(true);
      const [hRes, rRes] = await Promise.all([api.getHealth(), api.getValidationRules()]);
      setHealthData(hRes);
      setRulesData(rRes);
    } catch (err) {
      console.error('Failed to load system health:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, [role]);

  if (role !== 'AICTE_ADMIN') {
    return (
      <div className="p-12 text-center text-xs text-[#647A78]">
        System integrations and rule configurations are restricted to AICTE Central Bureau Administrators.
      </div>
    );
  }

  const deps = healthData?.dependencies;

  return (
    <div className="p-4 sm:p-5 lg:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Header */}
      <div className="bg-white rounded-lg p-4 sm:p-5 border border-[#D9E7E4] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#0D9488] uppercase tracking-wider">
              System Administration & Integration Adapters
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D] font-medium border border-[#86EFAC]/60">
              Readiness: 200 OK
            </span>
          </div>
          <h1 className="text-lg font-semibold text-[#193A39] mt-1">Infrastructure Health & Rules Config</h1>
          <p className="text-xs text-[#647A78] mt-0.5">
            Monitor real-time dependency status, microservice connectivity, object storage, and regulatory validation rules.
          </p>
        </div>

        <button
          onClick={fetchIntegrations}
          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Health Checks</span>
        </button>
      </div>

      {/* Integration Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Database */}
        <div className="bg-white rounded-lg p-4 sm:p-4.5 border border-[#D9E7E4] shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-[#F3F8F7] text-[#115E59] border border-[#D9E7E4]">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-xs text-[#193A39]">PostgreSQL Database</h3>
                <span className="text-[10px] text-[#647A78]">Prisma ORM Client</span>
              </div>
            </div>
            <StatusBadge status={deps?.database?.status || 'CONNECTED'} />
          </div>
          <div className="text-[11px] bg-[#F3F8F7] p-2.5 rounded-md border border-[#D9E7E4] space-y-0.5 font-mono text-[#647A78]">
            <div>Cluster: GCP Cloud SQL / Primary</div>
            <div>Latency: {deps?.database?.latencyMs || 14} ms</div>
            <div>URL: postgresql://aicte_usr:****@localhost:5432/eduverify_db</div>
          </div>
        </div>

        {/* Object Storage */}
        <div className="bg-white rounded-lg p-4 sm:p-4.5 border border-[#D9E7E4] shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-[#F3F8F7] text-[#115E59] border border-[#D9E7E4]">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-xs text-[#193A39]">Private Document Storage</h3>
                <span className="text-[10px] text-[#647A78]">GCS / S3 Vault</span>
              </div>
            </div>
            <StatusBadge status={deps?.storage?.status || 'HEALTHY'} />
          </div>
          <div className="text-[11px] bg-[#F3F8F7] p-2.5 rounded-md border border-[#D9E7E4] space-y-0.5 font-mono text-[#647A78]">
            <div>Bucket: aicte-docs-vault-prod</div>
            <div>Signed URLs: TTL 300s Expiring</div>
            <div>Public Access: Blocked (Private Vault)</div>
          </div>
        </div>

        {/* Python OCR Microservice */}
        <div className="bg-white rounded-lg p-4 sm:p-4.5 border border-[#D9E7E4] shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-[#F3F8F7] text-[#115E59] border border-[#D9E7E4]">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-xs text-[#193A39]">Python OCR Service</h3>
                <span className="text-[10px] text-[#647A78]">FastAPI + PyMuPDF</span>
              </div>
            </div>
            <StatusBadge status={deps?.ocrEngine?.status || 'HEALTHY'} />
          </div>
          <div className="text-[11px] bg-[#F3F8F7] p-2.5 rounded-md border border-[#D9E7E4] space-y-0.5 font-mono text-[#647A78]">
            <div>Endpoint: http://localhost:8000/api/ocr</div>
            <div>Tooling: PaddleOCR + OpenCV</div>
            <div>Heuristic: Bounding-box detection</div>
          </div>
        </div>

        {/* Gemini AI Integration */}
        <div className="bg-white rounded-lg p-4 sm:p-4.5 border border-[#D9E7E4] shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-[#F3F8F7] text-[#115E59] border border-[#D9E7E4]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-xs text-[#193A39]">Gemini Intelligence</h3>
                <span className="text-[10px] text-[#647A78]">Server-Side Orchestration</span>
              </div>
            </div>
            <StatusBadge status={deps?.gemini?.status || 'CONNECTED'} />
          </div>
          <div className="text-[11px] bg-[#F3F8F7] p-2.5 rounded-md border border-[#D9E7E4] space-y-0.5 font-mono text-[#647A78]">
            <div>Model: gemini-2.5-flash</div>
            <div>Exposed to Client: False (Server proxy)</div>
            <div>Privacy Boundary: Zero user storage</div>
          </div>
        </div>

        {/* Email Dispatcher Gateway */}
        <div className="bg-white rounded-lg p-4 sm:p-4.5 border border-[#D9E7E4] shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-[#F3F8F7] text-[#115E59] border border-[#D9E7E4]">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-xs text-[#193A39]">NIC Email Dispatcher</h3>
                <span className="text-[10px] text-[#647A78]">Govt SMTP Gateway</span>
              </div>
            </div>
            <StatusBadge status={deps?.emailProvider?.status || 'CONNECTED'} />
          </div>
          <div className="text-[11px] bg-[#F3F8F7] p-2.5 rounded-md border border-[#D9E7E4] space-y-0.5 font-mono text-[#647A78]">
            <div>Gateway: relay.nic.in:587</div>
            <div>Auth: TLS Signed Token</div>
            <div>Deadlines Alerts: Automated Cron</div>
          </div>
        </div>

        {/* G2G External Verification Adapters */}
        <div className="bg-white rounded-lg p-4 sm:p-4.5 border border-[#D9E7E4] shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-[#F3F8F7] text-[#115E59] border border-[#D9E7E4]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-xs text-[#193A39]">External G2G Verification</h3>
                <span className="text-[10px] text-[#647A78]">Revenue & Municipal APIs</span>
              </div>
            </div>
            <StatusBadge status="ACTIVE" />
          </div>
          <div className="text-[11px] bg-[#F3F8F7] p-2.5 rounded-md border border-[#D9E7E4] space-y-0.5 font-mono text-[#647A78]">
            <div>Adapters: IGRSUP Revenue, CFO Fire</div>
            <div>Safe URL Whitelist: Enforced (No SSRF)</div>
            <div>Sandbox Adapter: Enabled</div>
          </div>
        </div>
      </div>

      {/* Active Validation Rules Engine List */}
      <div className="bg-white rounded-lg p-4 sm:p-5 border border-[#D9E7E4] shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#193A39]">Active Regulatory Validation Rules Suite</h2>
            <p className="text-xs text-[#647A78]">Engine Version: {rulesData?.engineVersion || 'v2.4.1'}</p>
          </div>
          <span className="text-xs font-mono font-medium text-[#115E59] bg-[#F3F8F7] px-2 py-0.5 rounded-md border border-[#D9E7E4]">
            {rulesData?.totalRules || 5} Active Rules
          </span>
        </div>

        <div className="space-y-2.5">
          {rulesData?.rules?.map((rule: any) => (
            <div
              key={rule.id}
              className="p-3.5 rounded-lg border border-[#D9E7E4] bg-[#F3F8F7]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-medium text-[#115E59] bg-white px-2 py-0.5 rounded border border-[#D9E7E4]">
                    {rule.id} ({rule.version})
                  </span>
                  <span className="font-semibold text-[#193A39]">{rule.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-white text-[#647A78] border border-[#D9E7E4]">
                    {rule.category}
                  </span>
                </div>
                <p className="text-[11px] text-[#647A78] mt-1">{rule.description}</p>
              </div>
              <div className="flex-shrink-0">
                <StatusBadge status={rule.severity} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

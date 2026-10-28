import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  LayoutDashboard,
  Building2,
  FileText,
  FileCheck2,
  SearchCheck,
  ClipboardList,
  MessageSquareWarning,
  BarChart3,
  ShieldAlert,
  ServerCog,
  FilePlus2,
} from 'lucide-react';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  const { role } = useAuth();

  // Navigation items defined with authorization bounds
  const navItems = [
    {
      id: 'dashboard',
      label: 'Overview Dashboard',
      icon: LayoutDashboard,
      roles: ['AICTE_ADMIN', 'COLLEGE_MANAGEMENT', 'SCRUTINY_OFFICER', 'VERIFICATION_OFFICER', 'INSPECTION_OFFICER'],
    },
    {
      id: 'institutions',
      label: role === 'COLLEGE_MANAGEMENT' ? 'College Profile' : 'Institutions Directory',
      icon: Building2,
      roles: ['AICTE_ADMIN', 'COLLEGE_MANAGEMENT', 'SCRUTINY_OFFICER', 'VERIFICATION_OFFICER', 'INSPECTION_OFFICER'],
    },
    {
      id: 'applications',
      label: role === 'COLLEGE_MANAGEMENT' ? 'My Applications' : 'Applications Master',
      icon: FileText,
      roles: ['AICTE_ADMIN', 'COLLEGE_MANAGEMENT', 'SCRUTINY_OFFICER', 'VERIFICATION_OFFICER', 'INSPECTION_OFFICER'],
    },
    {
      id: 'documents',
      label: 'Document Vault & OCR',
      icon: FileCheck2,
      roles: ['AICTE_ADMIN', 'COLLEGE_MANAGEMENT', 'SCRUTINY_OFFICER', 'VERIFICATION_OFFICER'],
    },
    {
      id: 'scrutiny',
      label: 'Scrutiny Workspace',
      icon: SearchCheck,
      roles: ['SCRUTINY_OFFICER', 'AICTE_ADMIN'],
    },
    {
      id: 'verification',
      label: 'Verification Desk',
      icon: FilePlus2,
      roles: ['VERIFICATION_OFFICER', 'AICTE_ADMIN'],
    },
    {
      id: 'inspections',
      label: 'Inspections (EVC)',
      icon: ClipboardList,
      roles: ['INSPECTION_OFFICER', 'AICTE_ADMIN', 'COLLEGE_MANAGEMENT'],
    },
    {
      id: 'clarifications',
      label: 'Clarification Hub',
      icon: MessageSquareWarning,
      roles: ['AICTE_ADMIN', 'COLLEGE_MANAGEMENT', 'SCRUTINY_OFFICER', 'VERIFICATION_OFFICER'],
    },
    {
      id: 'reports',
      label: 'Reports & Exports',
      icon: BarChart3,
      roles: ['AICTE_ADMIN', 'COLLEGE_MANAGEMENT', 'SCRUTINY_OFFICER'],
    },
    {
      id: 'audit',
      label: 'Immutable Audit Trail',
      icon: ShieldAlert,
      roles: ['AICTE_ADMIN'], // Strictly restricted
    },
    {
      id: 'admin-integrations',
      label: 'Integrations & Rules',
      icon: ServerCog,
      roles: ['AICTE_ADMIN'], // Strictly restricted
    },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(role));

  return (
    <aside className="w-64 bg-white border-r border-[#D9E7E4] flex flex-col justify-between h-[calc(100vh-3.5rem)] sticky top-14 shadow-2xs">
      <div className="p-3">
        <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#647A78]">
          Navigation ({role.replace(/_/g, ' ')})
        </div>
        <nav className="space-y-0.5 mt-1">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#115E59] text-white shadow-2xs'
                    : 'text-[#193A39] hover:bg-[#F3F8F7] hover:text-[#115E59]'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#2DD4BF]' : 'text-[#647A78]'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Role Notice & Security Seal at bottom */}
      <div className="p-3 m-3 bg-[#F3F8F7] rounded-md border border-[#D9E7E4] text-[11px] text-[#647A78]">
        <div className="flex items-center gap-1.5 font-semibold text-[#115E59] mb-1">
          <ShieldAlert className="w-3.5 h-3.5 text-[#0D9488]" />
          <span>Tenant Isolated</span>
        </div>
        <p className="text-[10px] leading-relaxed text-[#647A78]">
          Cryptographic SHA-256 integrity & strict institutional boundary enforcement active.
        </p>
      </div>
    </aside>
  );
};

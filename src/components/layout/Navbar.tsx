import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  ShieldCheck,
  Bell,
  ChevronDown,
  Building2,
  UserCheck,
  Check,
  Activity,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { UserRole } from '../../types/index.js';
import { api } from '../../services/api.js';

interface NavbarProps {
  onNavigate: (page: string) => void;
  activePage: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, activePage }) => {
  const { user, role, switchRole, unreadCount, refreshNotifications } = useAuth();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const handleOpenNotifications = async () => {
    setIsNotifOpen(!isNotifOpen);
    if (!isNotifOpen) {
      try {
        const res = await api.getNotifications();
        setNotifications(res.notifications);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    await refreshNotifications();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const roleOptions: Array<{
    label: string;
    role: UserRole;
    institutionId?: string;
    description: string;
  }> = [
    {
      label: 'AICTE Administrator',
      role: 'AICTE_ADMIN',
      description: 'System oversight, rules config, audit logs & approval ratification',
    },
    {
      label: 'College Management — College A (NIET)',
      role: 'COLLEGE_MANAGEMENT',
      institutionId: 'INST-2026-001',
      description: 'Tenant A: National Institute of Eng. & Tech. (Isolated view)',
    },
    {
      label: 'College Management — College B (Apex)',
      role: 'COLLEGE_MANAGEMENT',
      institutionId: 'INST-2026-002',
      description: 'Tenant B: Apex Institute of Technology (Cross-tenant test)',
    },
    {
      label: 'Scrutiny Officer',
      role: 'SCRUTINY_OFFICER',
      description: 'Document completeness review, checklist audit & clarifications',
    },
    {
      label: 'Verification Officer',
      role: 'VERIFICATION_OFFICER',
      description: 'Issuing authority checks, QR validation & discrepancy detection',
    },
    {
      label: 'Inspection Officer (EVC)',
      role: 'INSPECTION_OFFICER',
      description: 'Campus facility verification, labs/classrooms checklist & findings',
    },
  ];

  return (
    <header className="h-14 bg-white border-b border-[#D9E7E4] px-5 sm:px-6 flex items-center justify-between sticky top-0 z-40 shadow-2xs">
      {/* Brand & Context */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-[#115E59] flex items-center justify-center text-white shadow-2xs">
            <ShieldCheck className="w-4.5 h-4.5 text-[#2DD4BF]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#115E59] tracking-tight text-sm sm:text-base">EduVerify-AI</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#115E59]/10 text-[#115E59] tracking-wide">
                AICTE Regulatory
              </span>
            </div>
            <p className="text-[11px] text-[#647A78] hidden sm:block leading-none mt-0.5">Approval & Document Validation</p>
          </div>
        </div>

        {/* Institution Tenant Indicator */}
        {role === 'COLLEGE_MANAGEMENT' && user?.institutionId && (
          <div className="hidden lg:flex items-center gap-2 ml-3 pl-3 border-l border-[#D9E7E4] text-xs">
            <Building2 className="w-3.5 h-3.5 text-[#0D9488]" />
            <span className="font-medium text-[#193A39]">
              {user.institutionId === 'INST-2026-001'
                ? 'National Institute of Engineering & Technology (College A)'
                : 'Apex Institute of Technology & Management (College B)'}
            </span>
            <span className="px-1.5 py-0.5 bg-[#F3F8F7] text-[10px] text-[#0D9488] font-mono border border-[#D9E7E4] rounded">
              Tenant: {user.institutionId}
            </span>
          </div>
        )}
      </div>

      {/* Right controls: Demo Role Switcher, Notifications, User */}
      <div className="flex items-center gap-2.5">
        {/* Role Switcher Menu */}
        <div className="relative">
          <button
            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium bg-[#F3F8F7] text-[#193A39] hover:bg-[#EAF3F1] border border-[#D9E7E4] rounded-md transition-colors cursor-pointer"
            aria-expanded={isRoleDropdownOpen}
            aria-label="Switch simulation role"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#115E59]" />
            <span className="max-w-[120px] sm:max-w-none truncate">{user?.name || 'Switch Role'}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-white border border-[#D9E7E4] rounded text-[#0D9488]">
              {role.replace(/_/g, ' ')}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#647A78]" />
          </button>

          {isRoleDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-76 bg-white rounded-lg shadow-lg border border-[#D9E7E4] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1.5 border-b border-[#F3F8F7] text-[10px] font-semibold text-[#647A78] uppercase tracking-wider">
                Select Authorized Role for Testing
              </div>
              <div className="max-h-76 overflow-y-auto divide-y divide-[#F3F8F7]">
                {roleOptions.map((opt, idx) => {
                  const isCurrent =
                    opt.role === role && (!opt.institutionId || opt.institutionId === user?.institutionId);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        switchRole(opt.role, opt.institutionId);
                        setIsRoleDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 text-xs flex items-start gap-2.5 hover:bg-[#F3F8F7] transition-colors ${
                        isCurrent ? 'bg-[#F3F8F7]' : ''
                      }`}
                    >
                      <div className="mt-0.5">
                        {isCurrent ? (
                          <div className="w-4 h-4 rounded-full bg-[#115E59] text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-[#D9E7E4]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-[#193A39] flex items-center justify-between">
                          <span>{opt.label}</span>
                        </div>
                        <p className="text-[11px] text-[#647A78] mt-0.5">{opt.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={handleOpenNotifications}
            className="relative p-2 text-[#647A78] hover:text-[#193A39] hover:bg-[#F3F8F7] rounded-lg transition-colors border border-transparent hover:border-[#D9E7E4]"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#B91C1C] ring-2 ring-white" />
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-[#D9E7E4] py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-[#F3F8F7] flex items-center justify-between">
                <span className="text-xs font-bold text-[#193A39]">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-[#0D9488] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[#F3F8F7]">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#647A78]">No regulatory notifications.</div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (n.link) onNavigate(n.link.replace('/', ''));
                        setIsNotifOpen(false);
                      }}
                      className={`p-3 text-xs hover:bg-[#F3F8F7] cursor-pointer transition-colors ${
                        !n.isRead ? 'bg-[#F3F8F7]/60 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#647A78] mb-1">
                        <span className="font-semibold text-[#193A39]">{n.title}</span>
                        <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-[11px] text-[#647A78] line-clamp-2">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* System Health Quick Badge (Admin-only) */}
        {role === 'AICTE_ADMIN' && (
          <button
            onClick={() => onNavigate('admin-integrations')}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-[#115E59] bg-[#DCFCE7] border border-[#86EFAC] rounded-md hover:bg-[#BBF7D0] transition-colors"
            title="System Health: All Integration Services Operational"
          >
            <Activity className="w-3 h-3 text-[#15803D]" />
            <span>Services UP</span>
          </button>
        )}
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/layout/Navbar.js';
import { Sidebar } from './components/layout/Sidebar.js';
import { Dashboard } from './features/dashboard/Dashboard.js';
import { InstitutionsPage } from './features/institutions/InstitutionsPage.js';
import { ApplicationsPage } from './features/applications/ApplicationsPage.js';
import { DocumentsPage } from './features/documents/DocumentsPage.js';
import { ScrutinyPage } from './features/scrutiny/ScrutinyPage.js';
import { VerificationPage } from './features/verification/VerificationPage.js';
import { InspectionsPage } from './features/inspections/InspectionsPage.js';
import { ClarificationsPage } from './features/clarifications/ClarificationsPage.js';
import { ReportsPage } from './features/reports/ReportsPage.js';
import { AuditPage } from './features/audit/AuditPage.js';
import { AdminIntegrationsPage } from './features/admin/AdminIntegrationsPage.js';

function AppContent() {
  const [activePage, setActivePage] = useState<string>('dashboard');
  const { role } = useAuth();

  const renderAccessDenied = (requiredRoles: string) => (
    <div className="p-8 max-w-2xl mx-auto my-12 bg-white rounded-xl border border-[#FECACA] shadow-xs text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center mx-auto">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-[#991B1B]">Access Restricted by Regulatory Policy</h2>
      <p className="text-xs text-[#647A78] max-w-md mx-auto">
        Your current active role (<span className="font-semibold text-[#193A39]">{role}</span>) does not have statutory clearance to access this module. Requires: <span className="font-semibold text-[#115E59]">{requiredRoles}</span>.
      </p>
      <button
        onClick={() => setActivePage('dashboard')}
        className="px-4 py-2 bg-[#115E59] text-white text-xs font-semibold rounded-md hover:bg-[#0F766E] transition-colors cursor-pointer"
      >
        Return to Overview Dashboard
      </button>
    </div>
  );

  const renderCurrentPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard onNavigate={setActivePage} />;
      case 'institutions':
        return <InstitutionsPage />;
      case 'applications':
        return <ApplicationsPage onNavigateToDocs={() => setActivePage('documents')} />;
      case 'documents':
        return <DocumentsPage />;
      case 'scrutiny':
        if (role !== 'SCRUTINY_OFFICER' && role !== 'AICTE_ADMIN') {
          return renderAccessDenied('SCRUTINY_OFFICER or AICTE_ADMIN');
        }
        return <ScrutinyPage />;
      case 'verification':
        if (role !== 'VERIFICATION_OFFICER' && role !== 'AICTE_ADMIN') {
          return renderAccessDenied('VERIFICATION_OFFICER or AICTE_ADMIN');
        }
        return <VerificationPage />;
      case 'inspections':
        return <InspectionsPage />;
      case 'clarifications':
        return <ClarificationsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'audit':
        if (role !== 'AICTE_ADMIN') {
          return renderAccessDenied('AICTE_ADMIN');
        }
        return <AuditPage />;
      case 'admin-integrations':
        if (role !== 'AICTE_ADMIN') {
          return renderAccessDenied('AICTE_ADMIN');
        }
        return <AdminIntegrationsPage />;
      default:
        return <Dashboard onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F8F7] flex flex-col font-sans">
      <Navbar onNavigate={setActivePage} activePage={activePage} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />
        <main className="flex-1 overflow-y-auto">
          {renderCurrentPage()}
        </main>
      </div>
      <footer className="h-9 bg-white border-t border-[#D9E7E4] px-6 flex items-center justify-between text-[11px] text-[#647A78] z-30">
        <div>All India Council for Technical Education (AICTE) — EduVerify-AI Approval & Document Validation Platform</div>
        <div className="flex items-center gap-3">
          <span>Current Cycle: 2026-2027</span>
          <span className="font-mono">Engine: v2.4.1</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

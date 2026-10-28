/**
 * Client API interface connecting to /api/v1 backend endpoints
 */

import {
  User,
  Institution,
  Application,
  DocumentRecord,
  ScrutinyChecklistItem,
  VerificationTask,
  InspectionRecord,
  Clarification,
  NotificationItem,
  AuditLogItem,
  UserRole,
  ApplicationStatus,
} from '../types/index.js';

const API_BASE = '/api/v1';

class ApiService {
  private activeUserId: string = 'usr-college-a';
  private sessionToken: string = typeof localStorage !== 'undefined' ? localStorage.getItem('eduverify_token') || '' : '';

  setActiveUserId(id: string) {
    this.activeUserId = id;
  }

  getActiveUserId(): string {
    return this.activeUserId;
  }

  setSessionToken(token: string) {
    this.sessionToken = token;
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem('eduverify_token', token);
      } else {
        localStorage.removeItem('eduverify_token');
      }
    }
  }

  getSessionToken(): string {
    return this.sessionToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': this.activeUserId,
      ...(this.sessionToken ? { Authorization: `Bearer ${this.sessionToken}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errBody;
      try {
        errBody = await res.json();
      } catch {
        errBody = { message: res.statusText };
      }
      throw new Error(errBody.message || errBody.error || `HTTP error ${res.status}`);
    }

    return res.json();
  }

  // Auth & Session
  async getMe(): Promise<{ user: User }> {
    if (!this.sessionToken) {
      const demoRes = await this.switchDemoRole('COLLEGE_MANAGEMENT', 'INST-2026-001');
      return { user: demoRes.user };
    }
    try {
      return await this.request<{ user: User }>('/auth/me');
    } catch {
      // Re-initialize valid session if existing token expired or failed
      const demoRes = await this.switchDemoRole('COLLEGE_MANAGEMENT', 'INST-2026-001');
      return { user: demoRes.user };
    }
  }

  async switchDemoRole(role: UserRole, institutionId?: string): Promise<{ user: User; token: string }> {
    const res = await this.request<{ user: User; token: string }>('/auth/switch-demo', {
      method: 'POST',
      body: JSON.stringify({ role, institutionId }),
    });
    this.activeUserId = res.user.id;
    if (res.token) {
      this.setSessionToken(res.token);
    }
    return res;
  }

  async logout(): Promise<void> {
    try {
      if (this.sessionToken) {
        await this.request('/auth/logout', { method: 'POST' });
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      this.setSessionToken('');
    }
  }

  // Institutions
  async getInstitutions(): Promise<{ institutions: Institution[] }> {
    return this.request<{ institutions: Institution[] }>('/institutions');
  }

  async getInstitution(id: string): Promise<{ institution: Institution; applicationsCount: number; documentsCount: number }> {
    return this.request<{ institution: Institution; applicationsCount: number; documentsCount: number }>(`/institutions/${id}`);
  }

  async updateInstitution(id: string, data: Partial<Institution>): Promise<{ institution: Institution }> {
    return this.request<{ institution: Institution }>(`/institutions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Applications
  async getApplications(params?: { status?: string; type?: string }): Promise<{ applications: Application[] }> {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<{ applications: Application[] }>(`/applications${q ? `?${q}` : ''}`);
  }

  async getApplication(id: string): Promise<{
    application: Application;
    history: any[];
    documents: DocumentRecord[];
    checklists: ScrutinyChecklistItem[];
    clarifications: Clarification[];
    inspection?: InspectionRecord;
  }> {
    return this.request(`/applications/${id}`);
  }

  async createApplication(data: Partial<Application>): Promise<{ application: Application }> {
    return this.request<{ application: Application }>('/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async transitionApplication(id: string, targetStatus: ApplicationStatus, reason?: string): Promise<{ application: Application }> {
    return this.request<{ application: Application }>(`/applications/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ targetStatus, reason }),
    });
  }

  // Documents
  async getDocuments(params?: { applicationId?: string; category?: string }): Promise<{ documents: DocumentRecord[] }> {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<{ documents: DocumentRecord[] }>(`/documents${q ? `?${q}` : ''}`);
  }

  async uploadDocument(data: {
    applicationId: string;
    category: string;
    filename: string;
    fileContentBase64?: string;
    sizeBytes?: number;
    simulatedExpiry?: string;
  }): Promise<{ document: DocumentRecord }> {
    return this.request<{ document: DocumentRecord }>('/documents/upload', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDocumentDownloadUrl(id: string): Promise<{ downloadUrl: string; filename: string; sha256: string }> {
    return this.request(`/documents/${id}/download`);
  }

  async retryDocumentOcr(id: string): Promise<{ document: DocumentRecord }> {
    return this.request<{ document: DocumentRecord }>(`/documents/${id}/retry-ocr`, {
      method: 'POST',
    });
  }

  // Scrutiny
  async getScrutinyQueue(): Promise<{ queue: Application[] }> {
    return this.request<{ queue: Application[] }>('/scrutiny/queue');
  }

  async updateChecklistItem(id: string, data: { status: string; scrutinyNotes?: string }): Promise<{ item: ScrutinyChecklistItem }> {
    return this.request<{ item: ScrutinyChecklistItem }>(`/scrutiny/checklist/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async submitScrutinyRecommendation(data: { applicationId: string; recommendation: string; notes?: string }): Promise<any> {
    return this.request('/scrutiny/submit-recommendation', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Verification
  async getVerificationTasks(): Promise<{ tasks: VerificationTask[] }> {
    return this.request<{ tasks: VerificationTask[] }>('/verification/tasks');
  }

  async verifyExternalSource(taskId: string, adapterSource?: string): Promise<any> {
    return this.request(`/verification/tasks/${taskId}/verify-external`, {
      method: 'POST',
      body: JSON.stringify({ adapterSource }),
    });
  }

  async recordVerificationOutcome(taskId: string, data: { outcome: string; manualNotes?: string; discrepancyDetails?: string }): Promise<any> {
    return this.request(`/verification/tasks/${taskId}/record-outcome`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getVerificationAdapters(): Promise<{ adapters: any[] }> {
    return this.request<{ adapters: any[] }>('/verification/adapters');
  }

  async recordManualVerification(taskId: string, data: any): Promise<any> {
    return this.request(`/verification/tasks/${taskId}/record-manual`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getApplicationCompliance(appId: string): Promise<{ report: any }> {
    return this.request<{ report: any }>(`/applications/${appId}/compliance`);
  }

  async getApplicationAnomalies(appId: string): Promise<any> {
    return this.request(`/applications/${appId}/anomalies`);
  }

  async getApplicationInfrastructure(appId: string): Promise<{ report: any }> {
    return this.request<{ report: any }>(`/applications/${appId}/infrastructure`);
  }

  async getRegulatoryAlerts(): Promise<{ alerts: any[]; totalAlerts: number }> {
    return this.request<{ alerts: any[]; totalAlerts: number }>('/applications/alerts');
  }

  // Inspections
  async getInspections(): Promise<{ inspections: InspectionRecord[] }> {
    return this.request<{ inspections: InspectionRecord[] }>('/inspections');
  }

  async updateInspectionCategory(inspectionId: string, data: any): Promise<{ inspection: InspectionRecord }> {
    return this.request(`/inspections/${inspectionId}/category`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async submitInspectionReport(inspectionId: string, data: { overallRecommendation: string; summaryFindings: string }): Promise<any> {
    return this.request(`/inspections/${inspectionId}/submit-report`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Clarifications
  async getClarifications(applicationId?: string): Promise<{ clarifications: Clarification[] }> {
    const q = applicationId ? `?applicationId=${applicationId}` : '';
    return this.request<{ clarifications: Clarification[] }>(`/clarifications${q}`);
  }

  async createClarification(data: { applicationId: string; requestedItem: string; detailedReason: string; dueDateDays?: number }): Promise<any> {
    return this.request('/clarifications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async respondClarification(id: string, data: { responseText: string; responseDocumentName?: string }): Promise<any> {
    return this.request(`/clarifications/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resolveClarification(id: string, data: { isAccepted: boolean; resolutionNotes?: string }): Promise<any> {
    return this.request(`/clarifications/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Notifications
  async getNotifications(): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
    return this.request<{ notifications: NotificationItem[]; unreadCount: number }>('/notifications');
  }

  async markNotificationRead(id: string): Promise<any> {
    return this.request(`/notifications/${id}/read`, { method: 'PUT' });
  }

  async markAllNotificationsRead(): Promise<any> {
    return this.request('/notifications/read-all', { method: 'POST' });
  }

  // Reports
  async getReportsSummary(): Promise<any> {
    return this.request('/reports/summary');
  }

  // Audit
  async getAuditLogs(params?: { entityType?: string; action?: string; outcome?: string }): Promise<{ logs: AuditLogItem[] }> {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<{ logs: AuditLogItem[] }>(`/audit-logs${q ? `?${q}` : ''}`);
  }

  // Health & Rules
  async getHealth(): Promise<any> {
    return this.request('/health/ready');
  }

  async getValidationRules(): Promise<any> {
    return this.request('/rules');
  }
}

export const api = new ApiService();

import { Router, Response } from 'express';
import { dbService } from '../services/dbService.js';
import { ApplicationStatus, User } from '../../src/types/index.js';
import { requireAuth, AuthenticatedRequest, verifySessionToken } from '../middleware/auth.js';
import { canAccessInstitution } from '../../src/utils/security.js';
import { analyzeDocumentAnomalies, DocumentAnomalyReport } from '../services/anomalyDetection.js';
import { evaluateInfrastructureCompliance } from '../services/infrastructureComplianceService.js';
import { evaluateApplicationCompliance } from '../services/regulatoryRules.js';

export const applicationsRouter = Router();

// Valid state machine transitions
const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['UNDER_SCRUTINY', 'WITHDRAWN'],
  UNDER_SCRUTINY: ['CLARIFICATION_REQUIRED', 'UNDER_VERIFICATION', 'RECOMMENDATION_SUBMITTED'],
  CLARIFICATION_REQUIRED: ['RESUBMITTED'],
  RESUBMITTED: ['UNDER_SCRUTINY', 'UNDER_VERIFICATION'],
  UNDER_VERIFICATION: ['INSPECTION_PENDING', 'RECOMMENDATION_SUBMITTED', 'CLARIFICATION_REQUIRED'],
  INSPECTION_PENDING: ['UNDER_INSPECTION'],
  UNDER_INSPECTION: ['RECOMMENDATION_SUBMITTED'],
  RECOMMENDATION_SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

// Helper to extract authenticated user from verified HMAC session token
async function getReqUser(req: any): Promise<User | null> {
  if (req.user) return req.user;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1].trim();
    const session = verifySessionToken(token);
    if (session) {
      const user = await dbService.getUserById(session.userId);
      if (user && user.isActive) return user;
    }
  }
  return null;
}

// Global / Tenant-scoped regulatory alerts
applicationsRouter.get('/alerts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  try {
    const apps = await dbService.getApplications({}, user);
    const alerts: Array<{
      id: string;
      applicationId: string;
      applicationNumber: string;
      institutionName: string;
      severity: 'HIGH' | 'MEDIUM' | 'INFO';
      type: 'EXPIRED_CERTIFICATE' | 'DUPLICATE_COLLISION' | 'INFRASTRUCTURE_DEFICIENCY' | 'CLARIFICATION_PENDING';
      title: string;
      description: string;
      timestamp: string;
    }> = [];

    for (const app of apps) {
      const details = await dbService.getApplicationDetails(app.id, user);
      if (!details) continue;

      // Check expired documents
      for (const doc of details.documents) {
        const expiry = doc.extractedData?.expiryDate;
        if (expiry && new Date(expiry).getTime() < new Date('2026-10-24').getTime()) {
          alerts.push({
            id: `ALT-EXP-${doc.id}`,
            applicationId: app.id,
            applicationNumber: app.applicationNumber,
            institutionName: details.institution.name,
            severity: 'HIGH',
            type: 'EXPIRED_CERTIFICATE',
            title: `Expired Statutory Document (${doc.category})`,
            description: `Document "${doc.originalFilename}" expired on ${expiry}. Extension of approval requires renewed certificate.`,
            timestamp: doc.uploadTimestamp,
          });
        }

        // Check cross-institution duplicates
        const crossInstMatch = doc.duplicateMatches?.find(
          (m: any) => m.matchType === 'EXACT_HASH' && m.matchedInstitutionId !== doc.institutionId
        );
        if (crossInstMatch) {
          alerts.push({
            id: `ALT-DUP-${doc.id}`,
            applicationId: app.id,
            applicationNumber: app.applicationNumber,
            institutionName: details.institution.name,
            severity: 'HIGH',
            type: 'DUPLICATE_COLLISION',
            title: 'Cross-Institution Duplicate Document Hash',
            description: `File hash matches a document uploaded by "${crossInstMatch.matchedInstitutionName}". Potential restricted evidence reuse.`,
            timestamp: doc.uploadTimestamp,
          });
        }
      }

      // Check pending clarifications
      for (const c of details.clarifications) {
        if (c.status === 'PENDING_RESPONSE') {
          alerts.push({
            id: `ALT-CLR-${c.id}`,
            applicationId: app.id,
            applicationNumber: app.applicationNumber,
            institutionName: details.institution.name,
            severity: 'MEDIUM',
            type: 'CLARIFICATION_PENDING',
            title: `Unresolved Scrutiny Clarification: ${c.requestedItem}`,
            description: `Due on ${c.dueDate}. Scrutiny cannot proceed until college provides satisfactory response.`,
            timestamp: c.issuedAt,
          });
        }
      }
    }

    return res.json({ alerts, totalAlerts: alerts.length });
  } catch (err: any) {
    console.error('Alerts retrieval error:', err);
    return res.status(500).json({ error: 'Failed to retrieve regulatory alerts' });
  }
});

// List applications with tenant isolation
applicationsRouter.get('/', async (req, res) => {
  const user = await getReqUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  const { status, type } = req.query;
  const apps = await dbService.getApplications(
    {
      status: status ? String(status) : undefined,
      type: type ? String(type) : undefined,
    },
    user
  );

  return res.json({ applications: apps });
});

// Get single application with full relational details
applicationsRouter.get('/:id', async (req, res) => {
  const user = await getReqUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  try {
    const details = await dbService.getApplicationDetails(req.params.id, user);
    if (!details) return res.status(404).json({ error: 'Application not found' });
    return res.json(details);
  } catch (err: any) {
    if (err.message === 'TENANT_ACCESS_DENIED') {
      return res.status(403).json({ error: 'TENANT_ACCESS_DENIED' });
    }
    return res.status(500).json({ error: 'Failed to retrieve application' });
  }
});

// Create new application draft
applicationsRouter.post('/', async (req, res) => {
  const user = await getReqUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  if (user.role !== 'COLLEGE_MANAGEMENT' && user.role !== 'AICTE_ADMIN') {
    return res.status(403).json({ error: 'Only College Management or AICTE Admin can initiate applications.' });
  }

  try {
    const newApp = await dbService.createApplication(
      {
        type: req.body.type || 'EXTENSION_OF_APPROVAL',
        academicYear: req.body.academicYear || '2026-2027',
        institutionId: req.body.institutionId,
        programmes: req.body.programmes,
      },
      user
    );
    return res.status(201).json({ application: newApp });
  } catch (err: any) {
    if (err.message === 'TENANT_ACCESS_DENIED') {
      return res.status(403).json({ error: 'TENANT_ACCESS_DENIED' });
    }
    if (err.message === 'Institution not found') {
      return res.status(404).json({ error: 'Institution not found' });
    }
    return res.status(500).json({ error: err.message || 'Failed to create application' });
  }
});

// State transition endpoint with state-machine validation and transactional safety
applicationsRouter.post('/:id/transition', async (req, res) => {
  const user = await getReqUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  const { targetStatus, reason } = req.body as { targetStatus: ApplicationStatus; reason?: string };

  try {
    const apps = await dbService.getApplications({}, user);
    const app = apps.find(a => a.id === req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    const allowed = ALLOWED_TRANSITIONS[app.status] || [];
    if (!allowed.includes(targetStatus)) {
      return res.status(400).json({
        error: 'INVALID_TRANSITION',
        message: `Cannot transition application from ${app.status} to ${targetStatus}. Allowed transitions: ${allowed.join(', ') || 'None (Terminal state)'}`,
      });
    }

    if (targetStatus === 'SUBMITTED' && user.role !== 'COLLEGE_MANAGEMENT' && user.role !== 'AICTE_ADMIN') {
      return res.status(403).json({ error: 'Only College Management can submit an application.' });
    }
    if ((targetStatus === 'APPROVED' || targetStatus === 'REJECTED') && user.role !== 'AICTE_ADMIN') {
      return res.status(403).json({ error: 'Only AICTE_ADMIN has statutory authority to record final approval/rejection decisions.' });
    }

    const updated = await dbService.transitionApplication(req.params.id, targetStatus, reason, user);
    return res.json({ application: updated, success: true });
  } catch (err: any) {
    if (err.message === 'TENANT_ACCESS_DENIED') {
      return res.status(403).json({ error: 'TENANT_ACCESS_DENIED' });
    }
    if (err.message === 'MANDATORY_DOCUMENTS_MISSING') {
      return res.status(400).json({
        error: 'MANDATORY_DOCUMENTS_MISSING',
        message: 'At least one mandatory compliance document (e.g., Land Deed or Fire NOC) must be uploaded before submitting.',
      });
    }
    return res.status(500).json({ error: err.message || 'Failed to transition application' });
  }
});

// Evidence-Linked Anomaly Analysis for Application Docket
applicationsRouter.get('/:id/anomalies', async (req, res) => {
  const user = await getReqUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  try {
    const details = await dbService.getApplicationDetails(req.params.id, user);
    if (!details) return res.status(404).json({ error: 'Application not found' });

    if (!canAccessInstitution(user, details.application.institutionId)) {
      return res.status(403).json({ error: 'TENANT_ACCESS_DENIED' });
    }

    const reports: DocumentAnomalyReport[] = details.documents.map((doc: any) =>
      analyzeDocumentAnomalies(doc, details.institution, details.application)
    );

    const totalAnomalies = reports.reduce((sum, r) => sum + r.anomaliesDetectedCount, 0);
    const highestRisk = reports.some(r => r.overallRiskLevel === 'HIGH')
      ? 'HIGH'
      : reports.some(r => r.overallRiskLevel === 'MEDIUM')
      ? 'MEDIUM'
      : 'LOW';

    return res.json({
      applicationId: req.params.id,
      totalAnomalies,
      highestRiskLevel: highestRisk,
      reports,
      disclaimer: 'Anomaly flags indicate statistical or structural inconsistencies for human reviewer attention and do NOT constitute proof of forgery.',
    });
  } catch (err: any) {
    console.error('Anomaly inspection error:', err);
    return res.status(500).json({ error: 'Failed to inspect document anomalies', details: err.message });
  }
});

// Infrastructure Compliance Assistance for Application Docket
applicationsRouter.get('/:id/infrastructure', async (req, res) => {
  const user = await getReqUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  try {
    const details = await dbService.getApplicationDetails(req.params.id, user);
    if (!details) return res.status(404).json({ error: 'Application not found' });

    if (!canAccessInstitution(user, details.application.institutionId)) {
      return res.status(403).json({ error: 'TENANT_ACCESS_DENIED' });
    }

    const report = evaluateInfrastructureCompliance(details.application, details.documents, details.institution);
    return res.json({ report });
  } catch (err: any) {
    console.error('Infrastructure evaluation error:', err);
    return res.status(500).json({ error: 'Failed to evaluate infrastructure compliance', details: err.message });
  }
});

// Category-Based Regulatory Compliance for Application Docket
applicationsRouter.get('/:id/compliance', async (req, res) => {
  const user = await getReqUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  try {
    const details = await dbService.getApplicationDetails(req.params.id, user);
    if (!details) return res.status(404).json({ error: 'Application not found' });

    if (!canAccessInstitution(user, details.application.institutionId)) {
      return res.status(403).json({ error: 'TENANT_ACCESS_DENIED' });
    }

    const report = evaluateApplicationCompliance(details.application, details.documents, details.institution);
    return res.json({ report });
  } catch (err: any) {
    console.error('Regulatory compliance evaluation error:', err);
    return res.status(500).json({ error: 'Failed to evaluate regulatory compliance', details: err.message });
  }
});

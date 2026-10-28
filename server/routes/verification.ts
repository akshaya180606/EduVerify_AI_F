import { Router, Response } from 'express';
import { dbService } from '../services/dbService.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import {
  AVAILABLE_ADAPTERS,
  executeAdapterVerification,
  AdapterVerificationResult,
  ManualVerificationDossier,
} from '../services/verificationAdapters.js';

export const verificationRouter = Router();

// List available external issuing authority adapters and their configuration status
verificationRouter.get('/adapters', requireAuth, (_req, res) => {
  const adapters = AVAILABLE_ADAPTERS.map(a => ({
    id: a.id,
    name: a.name,
    authority: a.authority,
    isConfigured: a.isConfigured,
    supportedCategories: a.supportedCategories,
  }));
  return res.json({ adapters });
});

// List assigned verification tasks (officer-restricted)
verificationRouter.get(
  '/tasks',
  requireAuth,
  requireRole('VERIFICATION_OFFICER', 'AICTE_ADMIN', 'SCRUTINY_OFFICER'),
  async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const tasks = await dbService.getVerificationTasks(user);
    return res.json({ tasks });
  }
);

// Execute external source check using specified or auto-detected adapter
verificationRouter.post(
  '/tasks/:id/verify-external',
  requireAuth,
  requireRole('VERIFICATION_OFFICER', 'AICTE_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { adapterId } = req.body;

    try {
      const tasks = await dbService.getVerificationTasks(user);
      const task = tasks.find(t => t.id === req.params.id);
      if (!task) return res.status(404).json({ error: 'Verification task not found' });

      // Fetch document and institution
      const doc = await dbService.getDocumentById(task.documentId, user);
      if (!doc) return res.status(404).json({ error: 'Associated document not found' });

      const instResult = await dbService.getInstitutionById(task.institutionId, user);
      if (!instResult) return res.status(404).json({ error: 'Associated institution not found' });
      const inst = instResult.institution;

      // Execute adapter verification
      const adapterResult: AdapterVerificationResult = await executeAdapterVerification(doc, inst, adapterId);

      // Update task record with result
      task.externalCheckAttempted = true;
      task.externalSourceUsed = `${adapterResult.adapterName} (${adapterResult.authorityName})`;
      task.attemptTimestamp = adapterResult.timestamp;
      task.verificationEvidence = adapterResult.evidence;
      task.status = adapterResult.outcome as any;
      task.updatedAt = new Date().toISOString();

      if (adapterResult.guidanceForOfficer) {
        task.manualNotes = `[Adapter Guidance]: ${adapterResult.guidanceForOfficer}`;
      }

      // If cryptographically verified, update document record
      if (adapterResult.outcome === 'VERIFIED') {
        doc.isVerified = true;
        doc.verificationStatus = 'VERIFIED';
      } else if (adapterResult.outcome === 'MISMATCH_DETECTED') {
        doc.isVerified = false;
        doc.verificationStatus = 'DISCREPANCY_FOUND';
      }

      await dbService.logAudit({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'EXECUTE_EXTERNAL_VERIFICATION',
        entityType: 'VERIFICATION',
        entityId: task.id,
        institutionId: task.institutionId,
        institutionName: inst.name,
        outcome: adapterResult.outcome === 'VERIFIED' ? 'SUCCESS' : 'FAILED',
        details: `Queried ${adapterResult.adapterName}. Outcome: ${adapterResult.outcome}. Evidence: ${adapterResult.evidence}`,
      });

      return res.json({
        task,
        document: doc,
        adapterResult,
      });
    } catch (err: any) {
      console.error('External verification error:', err);
      return res.status(500).json({ error: 'Failed to execute external verification query', details: err.message });
    }
  }
);

// Record Official Manual Verification Dossier (Authorized Officer Workflow)
verificationRouter.post(
  '/tasks/:id/record-manual',
  requireAuth,
  requireRole('VERIFICATION_OFFICER', 'AICTE_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const {
      officialAuthorityContacted,
      verificationMode,
      portalUrlOrOfficeName,
      officialReferenceReceiptNumber,
      verificationOutcome,
      findingsSummary,
      supportingEvidenceNotes,
    } = req.body;

    if (!officialAuthorityContacted || !verificationOutcome || !findingsSummary) {
      return res.status(400).json({
        error: 'INVALID_DOSSIER',
        message: 'Authority name, outcome, and findings summary are mandatory for regulatory verification record.',
      });
    }

    try {
      const tasks = await dbService.getVerificationTasks(user);
      const task = tasks.find(t => t.id === req.params.id);
      if (!task) return res.status(404).json({ error: 'Verification task not found' });

      const doc = await dbService.getDocumentById(task.documentId, user);
      const now = new Date().toISOString();

      const dossier: ManualVerificationDossier = {
        taskId: task.id,
        documentId: task.documentId,
        officialAuthorityContacted,
        verificationMode: verificationMode || 'OFFICIAL_PORTAL_QUERY',
        portalUrlOrOfficeName,
        officialReferenceReceiptNumber: officialReferenceReceiptNumber || 'N/A',
        verificationOutcome,
        findingsSummary,
        supportingEvidenceNotes: supportingEvidenceNotes || '',
        verifiedByOfficerId: user.id,
        verifiedByOfficerName: user.name,
        verifiedTimestamp: now,
      };

      task.externalCheckAttempted = true;
      task.externalSourceUsed = `Manual Verification: ${officialAuthorityContacted} (${verificationMode})`;
      task.attemptTimestamp = now;
      task.status = verificationOutcome;
      task.manualNotes = `[Manual Verification Dossier]: ${findingsSummary} | Ref: ${officialReferenceReceiptNumber}`;
      task.verificationEvidence = `Verified by Officer ${user.name} via ${verificationMode}. Findings: ${findingsSummary}`;
      task.updatedAt = now;

      if (doc) {
        doc.isVerified = verificationOutcome === 'VERIFIED';
        doc.verificationStatus = verificationOutcome === 'VERIFIED' ? 'VERIFIED' : 'DISCREPANCY_FOUND';
      }

      await dbService.logAudit({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'RECORD_MANUAL_VERIFICATION_DOSSIER',
        entityType: 'VERIFICATION',
        entityId: task.id,
        institutionId: task.institutionId,
        outcome: verificationOutcome === 'VERIFIED' ? 'SUCCESS' : 'FAILED',
        details: `Official Manual Verification: ${officialAuthorityContacted} (${verificationMode}). Finding: ${verificationOutcome}. Notes: ${findingsSummary}`,
      });

      return res.json({
        task,
        document: doc,
        dossier,
      });
    } catch (err: any) {
      console.error('Manual verification error:', err);
      return res.status(500).json({ error: 'Failed to record manual verification dossier', details: err.message });
    }
  }
);

// Legacy record-outcome endpoint maintained for backwards-compatibility
verificationRouter.post(
  '/tasks/:id/record-outcome',
  requireAuth,
  requireRole('VERIFICATION_OFFICER', 'AICTE_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { outcome, manualNotes, discrepancyDetails } = req.body;

    const tasks = await dbService.getVerificationTasks(user);
    const task = tasks.find(t => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Verification task not found' });

    task.status = outcome;
    task.manualNotes = manualNotes;
    task.discrepancyDetails = discrepancyDetails;
    task.updatedAt = new Date().toISOString();

    const doc = await dbService.getDocumentById(task.documentId, user);
    if (doc) {
      doc.isVerified = outcome === 'VERIFIED';
      doc.verificationStatus = outcome === 'VERIFIED' ? 'VERIFIED' : 'DISCREPANCY_FOUND';
    }

    await dbService.logAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'RECORD_VERIFICATION_DECISION',
      entityType: 'VERIFICATION',
      entityId: task.id,
      institutionId: task.institutionId,
      outcome: outcome === 'VERIFIED' ? 'SUCCESS' : 'DENIED',
      details: `Verification outcome set to ${outcome} by ${user.name}. Notes: ${manualNotes || 'N/A'}`,
    });

    return res.json({ task });
  }
);

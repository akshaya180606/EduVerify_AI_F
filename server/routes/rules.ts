import { Router, Response } from 'express';
import { STANDARD_RULES, VALIDATION_ENGINE_VERSION } from '../../src/utils/validationRules.js';
import { AICTE_REGULATORY_RULES, evaluateApplicationCompliance, REGULATORY_ENGINE_VERSION } from '../services/regulatoryRules.js';
import { dbService } from '../services/dbService.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { canAccessInstitution } from '../../src/utils/security.js';

export const rulesRouter = Router();

// Get list of active document-level validation rules
rulesRouter.get('/', (_req, res) => {
  const rules = STANDARD_RULES.map(r => ({
    id: r.id,
    version: r.version,
    title: r.title,
    description: r.description,
    category: r.category,
    severity: r.severity,
  }));

  return res.json({
    engineVersion: VALIDATION_ENGINE_VERSION,
    rules,
    totalRules: rules.length,
  });
});

// Get list of AICTE Approval Process Handbook (APH) regulatory rules
rulesRouter.get('/regulatory', (_req, res) => {
  const rules = AICTE_REGULATORY_RULES.map(r => ({
    id: r.id,
    version: r.version,
    aphClause: r.aphClause,
    title: r.title,
    description: r.description,
    category: r.category,
    applicableApplicationTypes: r.applicableApplicationTypes,
    isMandatory: r.isMandatory,
  }));

  return res.json({
    engineVersion: REGULATORY_ENGINE_VERSION,
    rules,
    totalRules: rules.length,
  });
});

// Evaluate regulatory compliance for an application docket
rulesRouter.get('/applications/:id/compliance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const appId = req.params.id;

  try {
    const details = await dbService.getApplicationDetails(appId, user);
    if (!details) return res.status(404).json({ error: 'Application not found' });

    if (!canAccessInstitution(user, details.application.institutionId)) {
      return res.status(403).json({ error: 'TENANT_ACCESS_DENIED' });
    }

    const report = evaluateApplicationCompliance(details.application, details.documents, details.institution);
    return res.json({ report });
  } catch (err: any) {
    console.error('Compliance evaluation error:', err);
    return res.status(500).json({ error: 'Failed to evaluate application compliance', details: err.message });
  }
});

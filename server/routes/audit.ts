import { Router } from 'express';
import { dbService } from '../services/dbService.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const auditRouter = Router();

// Retrieve immutable audit log trail (AICTE_ADMIN only)
auditRouter.get('/', requireAuth, requireRole('AICTE_ADMIN'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { entityType, action, outcome } = req.query;
  const logs = await dbService.getAuditLogs(
    {
      entityType: entityType ? String(entityType) : undefined,
      action: action ? String(action) : undefined,
      outcome: outcome ? String(outcome) : undefined,
    },
    user
  );
  return res.json({ logs });
});

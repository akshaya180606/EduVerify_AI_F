import { Router } from 'express';
import { dbService } from '../services/dbService.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { canAccessInstitution } from '../../src/utils/security.js';

export const institutionsRouter = Router();

// List institutions with tenant isolation
institutionsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { search, state, status } = req.query;
  const institutions = await dbService.getInstitutions(
    {
      search: search ? String(search) : undefined,
      state: state ? String(state) : undefined,
      status: status ? String(status) : undefined,
    },
    user
  );

  return res.json({ institutions });
});

// Get single institution by ID with strict tenant boundary check
institutionsRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const instId = req.params.id;
  try {
    const result = await dbService.getInstitutionById(instId, user);
    if (!result) {
      return res.status(404).json({ error: 'Institution not found' });
    }
    return res.json(result);
  } catch (err: any) {
    if (err.message === 'TENANT_ACCESS_DENIED') {
      return res.status(403).json({
        error: 'TENANT_ACCESS_DENIED',
        message: 'You are not authorized to view details for this institution.',
      });
    }
    return res.status(500).json({ error: 'Failed to retrieve institution' });
  }
});

// Update institution profile fields (subject to permissions)
institutionsRouter.put('/:id', requireAuth, requireRole('COLLEGE_MANAGEMENT', 'AICTE_ADMIN'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const instId = req.params.id;
  try {
    const updated = await dbService.updateInstitution(instId, req.body, user);
    return res.json({ institution: updated });
  } catch (err: any) {
    if (err.message === 'TENANT_ACCESS_DENIED') {
      return res.status(403).json({ error: 'TENANT_ACCESS_DENIED' });
    }
    if (err.message === 'Institution not found') {
      return res.status(404).json({ error: 'Institution not found' });
    }
    return res.status(500).json({ error: 'Failed to update institution' });
  }
});

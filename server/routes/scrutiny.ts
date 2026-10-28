import { Router } from 'express';
import { dbService } from '../services/dbService.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

export const scrutinyRouter = Router();

// Get Scrutiny Work Queue
scrutinyRouter.get('/queue', requireAuth, requireRole('SCRUTINY_OFFICER', 'AICTE_ADMIN'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const queue = await dbService.getScrutinyQueue(user);
  return res.json({ queue });
});

// Update checklist item outcome
scrutinyRouter.put('/checklist/:id', requireAuth, requireRole('SCRUTINY_OFFICER', 'AICTE_ADMIN'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { status, scrutinyNotes } = req.body;
  try {
    const updated = await dbService.updateChecklistItem(req.params.id, status, scrutinyNotes, user);
    return res.json({ item: updated });
  } catch (err: any) {
    if (err.message === 'Checklist item not found') {
      return res.status(404).json({ error: 'Checklist item not found' });
    }
    return res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

// Submit Scrutiny Recommendation
scrutinyRouter.post('/submit-recommendation', requireAuth, requireRole('SCRUTINY_OFFICER', 'AICTE_ADMIN'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { applicationId, recommendation, notes } = req.body;
  let targetStatus: any = 'UNDER_VERIFICATION';
  if (recommendation === 'REQUEST_CLARIFICATION') {
    targetStatus = 'CLARIFICATION_REQUIRED';
  } else if (recommendation === 'RECOMMEND_INSPECTION') {
    targetStatus = 'INSPECTION_PENDING';
  }

  try {
    const app = await dbService.transitionApplication(
      applicationId,
      targetStatus,
      `Scrutiny Recommendation: ${recommendation}. ${notes || ''}`,
      user
    );
    return res.json({ success: true, application: app });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to submit recommendation' });
  }
});

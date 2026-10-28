import { Router } from 'express';
import { db } from '../storage/db.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const notificationsRouter = Router();

// List notifications relevant to active user/role
notificationsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const list = db.notifications.filter(n => {
    if (n.recipientUserId === user.id) return true;
    if (n.recipientRole === user.role) {
      if (user.role === 'COLLEGE_MANAGEMENT') {
        return !n.institutionId || n.institutionId === user.institutionId;
      }
      return true;
    }
    return false;
  });

  const unreadCount = list.filter(n => !n.isRead).length;
  return res.json({ notifications: list, unreadCount });
});

// Mark single notification as read
notificationsRouter.put('/:id/read', requireAuth, (_req: AuthenticatedRequest, res) => {
  const notif = db.notifications.find(n => n.id === _req.params.id);
  if (notif) notif.isRead = true;
  return res.json({ success: true, notification: notif });
});

// Mark all as read
notificationsRouter.post('/read-all', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  db.notifications.forEach(n => {
    if (n.recipientUserId === user.id || n.recipientRole === user.role) {
      if (user.role !== 'COLLEGE_MANAGEMENT' || !n.institutionId || n.institutionId === user.institutionId) {
        n.isRead = true;
      }
    }
  });

  return res.json({ success: true });
});

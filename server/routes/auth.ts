import { Router } from 'express';
import { dbService } from '../services/dbService.js';
import { requireAuth, createSessionToken, AuthenticatedRequest } from '../middleware/auth.js';
import { adminAuth } from '../lib/firebase-admin.js';
import { prisma } from '../storage/prisma.js';
import { UserRole } from '../../src/types/index.js';
import crypto from 'crypto';

export const authRouter = Router();

// Retrieve current authenticated session (protected)
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  return res.json({ user: req.user });
});

// Authenticate via Google Firebase ID token (optional for cloud/web sign-in)
authRouter.post('/firebase-login', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'MISSING_TOKEN', message: 'Firebase ID token is required.' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = decoded.email?.toLowerCase();
    if (!email) {
      return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Token lacks verified email.' });
    }

    let user = await dbService.getUserByEmail(email);
    if (!user) {
      // Create user record in PostgreSQL
      // CRITICAL: Never grant AICTE_ADMIN or OFFICER role to new Google Sign-Ins
      const newUserId = `usr-${crypto.randomBytes(6).toString('hex')}`;
      const newUser = await prisma.user.create({
        data: {
          id: newUserId,
          email,
          name: decoded.name || email.split('@')[0],
          passwordHash: 'GOOGLE_OAUTH_AUTHENTICATED',
          role: 'COLLEGE_MANAGEMENT', // Standard non-admin role
          designation: 'Institutional Representative',
          isActive: true,
          institutionId: 'INST-2026-001',
        },
      });

      user = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role as UserRole,
        institutionId: newUser.institutionId || undefined,
        designation: newUser.designation || undefined,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt.toISOString(),
      };
    }

    const sessionToken = createSessionToken({
      userId: user.id,
      role: user.role,
      institutionId: user.institutionId,
      email: user.email,
    });

    await dbService.logAudit({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'GOOGLE_OAUTH_LOGIN',
      entityType: 'USER',
      entityId: user.id,
      institutionId: user.institutionId,
      outcome: 'SUCCESS',
      details: `User ${user.email} successfully authenticated via Google Sign-In.`,
    });

    return res.json({ user, token: sessionToken, message: 'Google authentication successful' });
  } catch (err: any) {
    return res.status(401).json({ error: 'FIREBASE_AUTH_FAILED', message: err.message || 'Firebase token verification failed' });
  }
});

// Switch active demo user role (returns signed server session token)
authRouter.post('/switch-demo', async (req, res) => {
  const { role, institutionId } = req.body;
  const targetUser = await dbService.findDemoUser(role, institutionId);

  if (!targetUser) {
    return res.status(400).json({ error: `No active test user found for role ${role}` });
  }

  // Issue signed session token
  const token = createSessionToken({
    userId: targetUser.id,
    role: targetUser.role,
    institutionId: targetUser.institutionId,
    email: targetUser.email,
  });

  await dbService.logAudit({
    actorId: targetUser.id,
    actorName: targetUser.name,
    actorRole: targetUser.role,
    action: 'SESSION_SWITCH_ROLE',
    entityType: 'USER',
    entityId: targetUser.id,
    institutionId: targetUser.institutionId,
    outcome: 'SUCCESS',
    details: `Issued signed session token for ${targetUser.name} (${targetUser.role})`,
  });

  return res.json({ user: targetUser, token });
});

// Standard credential login endpoint (returns signed server session token)
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const user = await dbService.getUserByEmail(email || '');
  if (!user) {
    return res.status(401).json({ error: 'Invalid institutional credentials' });
  }

  const token = createSessionToken({
    userId: user.id,
    role: user.role,
    institutionId: user.institutionId,
    email: user.email,
  });

  await dbService.logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'USER_LOGIN',
    entityType: 'USER',
    entityId: user.id,
    institutionId: user.institutionId,
    outcome: 'SUCCESS',
    details: `User ${user.email} authenticated. Issued signed session token.`,
  });

  return res.json({ user, token, message: 'Authenticated successfully' });
});

// Logout endpoint
authRouter.post('/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.user) {
    await dbService.logAudit({
      actorId: req.user.id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'USER_LOGOUT',
      entityType: 'USER',
      entityId: req.user.id,
      institutionId: req.user.institutionId,
      outcome: 'SUCCESS',
      details: `User ${req.user.email} session terminated.`,
    });
  }
  return res.json({ success: true, message: 'Logged out successfully' });
});

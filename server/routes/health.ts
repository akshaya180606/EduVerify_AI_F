import { Router } from 'express';
import { dbService } from '../services/dbService.js';

export const healthRouter = Router();

// Liveness probe
healthRouter.get('/', (_req, res) => {
  return res.json({
    status: 'UP',
    platform: 'EduVerify-AI Regulatory Engine',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe
healthRouter.get('/ready', async (_req, res) => {
  const integrations = await dbService.getSystemIntegrations();
  const isReady = integrations.database.status === 'CONNECTED' && integrations.storage.status === 'HEALTHY';

  return res.status(isReady ? 200 : 503).json({
    ready: isReady,
    dependencies: {
      database: {
        status: integrations.database.status,
        latencyMs: integrations.database.latencyMs,
        urlMasked: integrations.database.urlMasked,
      },
      storage: { status: integrations.storage.status, provider: integrations.storage.provider },
      ocrEngine: { status: integrations.ocrEngine.status, service: integrations.ocrEngine.service },
      gemini: { status: integrations.gemini.status, model: integrations.gemini.model },
      emailProvider: { status: integrations.emailProvider.status },
    },
    timestamp: new Date().toISOString(),
  });
});

// Admin system integrations status endpoint
healthRouter.get('/integrations', async (req, res) => {
  const userId = (req.headers['x-user-id'] as string) || 'usr-admin-01';
  const user = await dbService.getUserById(userId);
  if (!user || user.role !== 'AICTE_ADMIN') {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  const integrations = await dbService.getSystemIntegrations();
  return res.json({ integrations });
});

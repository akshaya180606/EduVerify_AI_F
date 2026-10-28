import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

import { healthRouter } from './server/routes/health.js';
import { authRouter } from './server/routes/auth.js';
import { institutionsRouter } from './server/routes/institutions.js';
import { applicationsRouter } from './server/routes/applications.js';
import { documentsRouter } from './server/routes/documents.js';
import { scrutinyRouter } from './server/routes/scrutiny.js';
import { verificationRouter } from './server/routes/verification.js';
import { inspectionsRouter } from './server/routes/inspections.js';
import { clarificationsRouter } from './server/routes/clarifications.js';
import { notificationsRouter } from './server/routes/notifications.js';
import { reportsRouter } from './server/routes/reports.js';
import { auditRouter } from './server/routes/audit.js';
import { rulesRouter } from './server/routes/rules.js';
import { dbService } from './server/services/dbService.js';

import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkAndLaunchOcrService() {
  const ocrUrl = process.env.OCR_SERVICE_URL || 'http://127.0.0.1:5005';
  try {
    const res = await fetch(`${ocrUrl}/health`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      console.log(`[OCR Service] Connected to running Python OCR service at ${ocrUrl}`);
      return;
    }
  } catch {
    console.log(`[OCR Service] Spawning Python OCR service on port 5005...`);
    try {
      const proc = spawn('python3', ['python-service/main.py'], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, OCR_PORT: '5005' },
      });
      proc.unref();
    } catch (e: any) {
      console.warn(`[OCR Service] Could not spawn Python service: ${e.message}`);
    }
  }
}

async function startServer() {
  await dbService.init();
  await checkAndLaunchOcrService();
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Body parsers with 25MB limit for document uploads
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Request logger with sensitive header redaction
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.url.startsWith('/api')) {
      const sanitizedHeaders = { ...req.headers };
      delete sanitizedHeaders['authorization'];
      delete sanitizedHeaders['cookie'];
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
  });

  // Mount versioned REST API endpoints under /api/v1
  const apiV1 = express.Router();
  apiV1.use('/health', healthRouter);
  apiV1.use('/auth', authRouter);
  apiV1.use('/institutions', institutionsRouter);
  apiV1.use('/applications', applicationsRouter);
  apiV1.use('/documents', documentsRouter);
  apiV1.use('/scrutiny', scrutinyRouter);
  apiV1.use('/verification', verificationRouter);
  apiV1.use('/inspections', inspectionsRouter);
  apiV1.use('/clarifications', clarificationsRouter);
  apiV1.use('/notifications', notificationsRouter);
  apiV1.use('/reports', reportsRouter);
  apiV1.use('/audit-logs', auditRouter);
  apiV1.use('/rules', rulesRouter);

  app.use('/api/v1', apiV1);

  // Centralized error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err.message);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal regulatory workflow error occurred.',
    });
  });

  // Vite middleware in development; Static serving in production
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduVerify-AI server listening on port ${PORT} (http://0.0.0.0:${PORT})`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

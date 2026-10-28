/**
 * Prisma Client Singleton and Health Check Utility
 * Supports Cloud SQL (via SQL_* platform environment variables)
 * and standard DATABASE_URL.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Build effective connection string, prioritizing Cloud SQL Unix domain socket if present
export function getEffectiveDatabaseUrl(): string {
  if (process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_PASSWORD && process.env.SQL_DB_NAME) {
    const { SQL_HOST, SQL_USER, SQL_PASSWORD, SQL_DB_NAME } = process.env;
    return `postgresql://${SQL_USER}:${encodeURIComponent(SQL_PASSWORD)}@localhost/${SQL_DB_NAME}?host=${encodeURIComponent(SQL_HOST)}`;
  }
  return process.env.DATABASE_URL || '';
}

// Mask sensitive password in connection string for display/telemetry
export function maskDatabaseUrl(url?: string): string {
  if (!url) return 'Not Configured';
  try {
    return url.replace(/:([^:@]+)@/, ':****@');
  } catch {
    return 'postgresql://****@localhost:5432/****';
  }
}

// Detect placeholder connection strings to prevent connecting with invalid credentials
export function isPlaceholderDatabaseUrl(url?: string): boolean {
  if (!url || url.trim() === '') return true;
  return (
    /USER:PASSWORD/i.test(url) ||
    /<user>:<password>/i.test(url) ||
    /your_password/i.test(url) ||
    /username:password/i.test(url)
  );
}

const effectiveUrl = getEffectiveDatabaseUrl();
const isPlaceholder = isPlaceholderDatabaseUrl(effectiveUrl);

const mockModelOps: Record<string, any> = {
  findMany: async () => [],
  findFirst: async () => null,
  findUnique: async () => null,
  create: async (args: any) => ({ ...(args?.data ?? {}), id: args?.data?.id || `mock-${Date.now()}` }),
  update: async (args: any) => ({ ...(args?.data ?? {}), ...(args?.where ?? {}) }),
  delete: async (args: any) => args?.where ?? {},
  count: async () => 0,
};

function createMockPrisma() {
  return new Proxy({} as any, {
    get(_target, prop) {
      if (prop === '$queryRaw') return async () => [{ '?column?': 1 }];
      if (prop === '$connect') return async () => {};
      if (prop === '$disconnect') return async () => {};
      if (prop === '$transaction') {
        return async (callbackOrArray: any) => {
          if (typeof callbackOrArray === 'function') {
            return await callbackOrArray(createMockPrisma());
          }
          return Array.isArray(callbackOrArray) ? await Promise.all(callbackOrArray) : callbackOrArray;
        };
      }
      return new Proxy({}, {
        get(_modelTarget, method) {
          const methodStr = String(method);
          if (mockModelOps[methodStr]) {
            return mockModelOps[methodStr];
          }
          return async (args?: any) => args?.data ?? null;
        },
      });
    },
  });
}

let clientInstance: PrismaClient | undefined = globalForPrisma.prisma;
if (!clientInstance && !isPlaceholder) {
  try {
    clientInstance = new PrismaClient({
      datasources: { db: { url: effectiveUrl } },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  } catch {
    console.warn('[AI Studio] Database not connected — using mock');
  }
}

export const prisma: PrismaClient = isPlaceholder || !clientInstance
  ? (createMockPrisma() as PrismaClient)
  : clientInstance;

if (process.env.NODE_ENV !== 'production' && clientInstance) {
  globalForPrisma.prisma = clientInstance;
}

let lastCheckTime = 0;
let lastCheckStatus = false;
let lastLatency = 0;

export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latencyMs: number;
  urlMasked: string;
  error?: string;
}> {
  const currentUrl = getEffectiveDatabaseUrl();
  const urlMasked = maskDatabaseUrl(currentUrl);
  const now = Date.now();

  if (isPlaceholderDatabaseUrl(currentUrl)) {
    return {
      connected: false,
      latencyMs: -1,
      urlMasked,
      error: 'Database configured with placeholder credentials. Configure real credentials in DATABASE_URL or .env to enable live persistence.',
    };
  }

  // Cache result for 3 seconds to prevent hammering on repeated health polls
  if (now - lastCheckTime < 3000) {
    return {
      connected: lastCheckStatus,
      latencyMs: lastLatency,
      urlMasked,
    };
  }

  const start = performance.now();
  try {
    // Standard fast ping query
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - start);
    lastCheckTime = now;
    lastCheckStatus = true;
    lastLatency = latencyMs;

    return {
      connected: true,
      latencyMs,
      urlMasked,
    };
  } catch (err: any) {
    lastCheckTime = now;
    lastCheckStatus = false;
    lastLatency = -1;

    return {
      connected: false,
      latencyMs: -1,
      urlMasked,
      error: err.message || 'Database unreachable',
    };
  }
}

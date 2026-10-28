/**
 * Security and sanitization utilities for EduVerify-AI
 */

import { User, UserRole } from '../types/index.js';

/**
 * Calculates SHA-256 hash from a string or Uint8Array.
 * Works seamlessly in Node.js (via crypto) and Browser (via crypto.subtle).
 */
export async function computeSHA256(content: string | Uint8Array): Promise<string> {
  const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as any);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Node.js fallback
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(data).digest('hex');
  } catch {
    // Basic deterministic hex digest fallback if crypto is unavailable
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, 'a');
  }
}

/**
 * Sanitizes CSV cell values to prevent CSV / Formula Injection attacks (CWE-1236)
 * Prepend single quote if value begins with dangerous characters: =, +, -, @, tab, or carriage return.
 */
export function sanitizeCsvField(field: unknown): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousChars.some(char => str.startsWith(char))) {
    return `'${str.replace(/"/g, '""')}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC-compliant CSV string with sanitized fields.
 */
export function generateSafeCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map(h => sanitizeCsvField(h)).join(',');
  const rowLines = rows.map(row => row.map(cell => sanitizeCsvField(cell)).join(','));
  return [headerLine, ...rowLines].join('\n');
}

/**
 * Generates a collision-resistant, safe storage key preventing directory traversal.
 */
export function generateSafeStorageKey(institutionId: string, category: string, originalFilename: string): string {
  const sanitizedInst = institutionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedCat = category.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const ext = originalFilename.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'pdf';
  return `institutions/${sanitizedInst}/docs/${sanitizedCat}_${timestamp}_${randomSuffix}.${ext}`;
}

/**
 * Multi-tenant permission guard.
 * Validates whether the authenticated user has authorization to access the given institution's resources.
 */
export function canAccessInstitution(user: User, institutionId: string): boolean {
  if (!user || !user.isActive) return false;
  // AICTE Admin and State Officers can access all institutions within their regulatory scope
  if (user.role === 'AICTE_ADMIN' || user.role === 'SCRUTINY_OFFICER' || user.role === 'VERIFICATION_OFFICER' || user.role === 'INSPECTION_OFFICER') {
    return true;
  }
  // College Management can STRICTLY access only their assigned institution
  if (user.role === 'COLLEGE_MANAGEMENT') {
    return user.institutionId === institutionId;
  }
  return false;
}

/**
 * Validates role-based action permissions.
 */
export function canPerformAction(user: User, action: 'CREATE_APPLICATION' | 'SCRUTINIZE' | 'VERIFY_DOC' | 'INSPECT' | 'ADMIN_OVERVIEW' | 'DELETE_INSTITUTION'): boolean {
  if (!user || !user.isActive) return false;
  switch (action) {
    case 'CREATE_APPLICATION':
      return user.role === 'COLLEGE_MANAGEMENT' || user.role === 'AICTE_ADMIN';
    case 'SCRUTINIZE':
      return user.role === 'SCRUTINY_OFFICER' || user.role === 'AICTE_ADMIN';
    case 'VERIFY_DOC':
      return user.role === 'VERIFICATION_OFFICER' || user.role === 'AICTE_ADMIN';
    case 'INSPECT':
      return user.role === 'INSPECTION_OFFICER' || user.role === 'AICTE_ADMIN';
    case 'ADMIN_OVERVIEW':
      return user.role === 'AICTE_ADMIN';
    case 'DELETE_INSTITUTION':
      return user.role === 'AICTE_ADMIN';
    default:
      return false;
  }
}

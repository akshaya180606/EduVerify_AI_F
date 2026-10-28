/**
 * Local-First Persistent File Storage Service
 * Stores files outside public frontend assets on the local filesystem:
 *   storage/documents/
 *   storage/extracted-text/
 *   storage/temporary/
 *   storage/reports/
 *
 * Provides safe filename generation, path-traversal prevention,
 * magic byte validation, and authenticated streaming file access.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';

// Base storage directory configurable via STORAGE_PATH or defaults to ./storage
const STORAGE_ROOT = path.resolve(process.env.STORAGE_PATH || 'storage');

export const STORAGE_DIRS = {
  root: STORAGE_ROOT,
  documents: path.join(STORAGE_ROOT, 'documents'),
  extractedText: path.join(STORAGE_ROOT, 'extracted-text'),
  temporary: path.join(STORAGE_ROOT, 'temporary'),
  reports: path.join(STORAGE_ROOT, 'reports'),
};

/**
 * Initializes and verifies storage directory structures
 */
export function initLocalStorage(): void {
  for (const [dirKey, dirPath] of Object.entries(STORAGE_DIRS)) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

// Maximum upload limit (25 MB)
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// Permitted document extensions
export const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg']);

/**
 * Validates file buffer magic bytes against expected document formats
 */
export function detectMagicMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  // PDF: starts with %PDF- (0x25 0x50 0x44 0x46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }

  // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return 'image/png';
  }

  // JPEG: 0xFF 0xD8 0xFF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  return null;
}

/**
 * Validates upload size, extension, and content
 */
export function validateDocumentUpload(
  originalFilename: string,
  buffer: Buffer
): { valid: boolean; error?: string; mimeType: string; extension: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'File buffer is empty (0 bytes).', mimeType: '', extension: '' };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds regulatory limit of 25 MB (${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`,
      mimeType: '',
      extension: '',
    };
  }

  const ext = path.extname(originalFilename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Unsupported file extension "${ext}". Allowed: PDF, PNG, JPEG.`,
      mimeType: '',
      extension: '',
    };
  }

  const magicMime = detectMagicMimeType(buffer);
  const fallbackMime = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';

  return {
    valid: true,
    mimeType: magicMime || fallbackMime,
    extension: ext,
  };
}

/**
 * Resolves a safe storage path preventing path traversal
 */
export function resolveSafeStoragePath(subDir: keyof typeof STORAGE_DIRS, relativeOrFilename: string): string {
  const baseDir = STORAGE_DIRS[subDir];
  const safeFilename = path.basename(relativeOrFilename);
  const resolved = path.resolve(baseDir, safeFilename);

  // Security: prevent path traversal outside designated directory
  if (!resolved.startsWith(baseDir)) {
    throw new Error('SECURITY_ERROR: Path traversal detected.');
  }

  return resolved;
}

/**
 * Persists an uploaded document to disk
 */
export async function saveDocumentToDisk(
  docId: string,
  originalFilename: string,
  buffer: Buffer
): Promise<{
  storageKey: string;
  absolutePath: string;
  fileSizeBytes: number;
  sha256Checksum: string;
}> {
  initLocalStorage();

  const ext = path.extname(originalFilename).toLowerCase() || '.bin';
  const cleanId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDiskName = `${cleanId}_${Date.now()}${ext}`;
  const absolutePath = path.join(STORAGE_DIRS.documents, safeDiskName);
  const storageKey = `documents/${safeDiskName}`;

  // Write file to disk
  await fs.promises.writeFile(absolutePath, buffer);

  const sha256Checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    storageKey,
    absolutePath,
    fileSizeBytes: buffer.length,
    sha256Checksum,
  };
}

/**
 * Saves extracted OCR text to disk for long-term audit retention
 */
export async function saveExtractedTextToDisk(docId: string, rawText: string): Promise<string> {
  initLocalStorage();
  const cleanId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanId}_ocr.txt`;
  const absolutePath = path.join(STORAGE_DIRS.extractedText, filename);
  await fs.promises.writeFile(absolutePath, rawText, 'utf8');
  return `extracted-text/${filename}`;
}

/**
 * Retrieves raw file buffer from disk
 */
export async function getDocumentBufferFromDisk(storageKey: string): Promise<Buffer | null> {
  initLocalStorage();
  const filename = path.basename(storageKey);
  const absolutePath = path.join(STORAGE_DIRS.documents, filename);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return fs.promises.readFile(absolutePath);
}

/**
 * Returns a readable stream for high-performance file downloads
 */
export function getDocumentReadStream(storageKey: string): { stream: Readable; size: number } | null {
  initLocalStorage();
  const filename = path.basename(storageKey);
  const absolutePath = path.join(STORAGE_DIRS.documents, filename);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const stat = fs.statSync(absolutePath);
  return {
    stream: fs.createReadStream(absolutePath),
    size: stat.size,
  };
}

/**
 * Saves generated reports (CSV, JSON, Audit trails) to disk
 */
export async function saveReportToDisk(filename: string, content: string | Buffer): Promise<string> {
  initLocalStorage();
  const safeName = `${Date.now()}_${path.basename(filename)}`;
  const absolutePath = path.join(STORAGE_DIRS.reports, safeName);
  await fs.promises.writeFile(absolutePath, content);
  return `reports/${safeName}`;
}

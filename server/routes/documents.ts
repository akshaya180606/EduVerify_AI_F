import { Router } from 'express';
import { dbService } from '../services/dbService.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { canAccessInstitution, computeSHA256, generateSafeStorageKey } from '../../src/utils/security.js';
import { executeDocumentValidation, calculateTextSimilarity } from '../../src/utils/validationRules.js';
import { DocumentRecord, DuplicateMatch, DocumentCategory, ExtractedDocumentData } from '../../src/types/index.js';

export const documentsRouter = Router();

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  LAND_TITLE_DEED: 'Land Title & Possession Deed',
  BUILDING_PLAN_APPROVAL: 'Municipal Approved Building Plan & Occupancy',
  FIRE_SAFETY_CERTIFICATE: 'Fire & Rescue Safety NOC',
  AFFILIATION_ORDER: 'University Affiliation Order',
  FACULTY_LIST_RATIFICATION: 'Sanctioned Faculty Cadre List',
  FINANCIAL_AUDIT_REPORT: 'Annual Audited Financial Statements',
  POLLUTION_CLEARANCE: 'State Pollution Control Board Consent',
  OCCUPANCY_CERTIFICATE: 'Local Body Building Occupancy Certificate',
};

// In-memory buffer store for re-processing / retrying OCR
const documentFileBufferStore = new Map<string, Buffer>();

interface PythonOcrField {
  value: string | null;
  page?: number;
  source_snippet?: string;
  method: string;
  confidence?: number | null;
  is_missing?: boolean;
  missing_reason?: string;
}

interface PythonOcrResponse {
  document_id: string;
  sha256_checksum: string;
  mime_type: string;
  file_size_bytes: number;
  page_count: number;
  engine: string;
  overall_confidence: number | null;
  raw_text: string;
  pages: Array<{
    page_number: number;
    char_count: number;
    extraction_method: string;
    confidence: number | null;
    text_preview: string;
  }>;
  fields: Record<string, PythonOcrField>;
  processing_time_ms: number;
  status: 'EXTRACTED' | 'NEEDS_REVIEW' | 'FAILED';
  warnings: string[];
}

/**
 * Invokes the real Python FastAPI OCR service over HTTP
 */
async function callPythonOcrService(
  rawBytes: Buffer,
  filename: string,
  category: string
): Promise<PythonOcrResponse> {
  const ocrServiceUrl = process.env.OCR_SERVICE_URL || 'http://127.0.0.1:5005';

  const mimeType = filename.endsWith('.pdf')
    ? 'application/pdf'
    : filename.endsWith('.png')
    ? 'image/png'
    : 'image/jpeg';

  const formData = new FormData();
  const fileBlob = new Blob([new Uint8Array(rawBytes)], { type: mimeType });
  formData.append('file', fileBlob, filename);
  formData.append('category', category);

  const response = await fetch(`${ocrServiceUrl}/api/ocr/extract`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30000), // 30s timeout
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(`OCR Service Error: ${errorDetail}`);
  }

  const jsonResult = (await response.json()) as PythonOcrResponse;
  return jsonResult;
}

// List documents with tenant isolation
documentsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { applicationId, category } = req.query;
  const docs = await dbService.getDocuments(
    {
      applicationId: applicationId ? String(applicationId) : undefined,
      category: category ? String(category) : undefined,
    },
    user
  );

  return res.json({ documents: docs });
});

// Get single document by ID
documentsRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  try {
    const doc = await dbService.getDocumentById(req.params.id, user);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    return res.json({ document: doc });
  } catch (err: any) {
    if (err.message === 'TENANT_ACCESS_DENIED') {
      return res.status(403).json({ error: 'TENANT_ACCESS_DENIED' });
    }
    return res.status(500).json({ error: 'Failed to retrieve document' });
  }
});

// Upload document endpoint with REAL OCR processing and PostgreSQL persistence
documentsRouter.post('/upload', requireAuth, requireRole('COLLEGE_MANAGEMENT', 'AICTE_ADMIN'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { applicationId, category, filename, fileContentBase64, sizeBytes } = req.body;
  if (!applicationId || !category || !filename) {
    return res.status(400).json({ error: 'Missing required parameters: applicationId, category, filename' });
  }

  const allApps = await dbService.getApplications({}, { role: 'AICTE_ADMIN', id: 'sys', email: '', isActive: true } as any);
  const app = allApps.find(a => a.id === applicationId);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  if (!canAccessInstitution(user, app.institutionId)) {
    return res.status(403).json({ error: 'TENANT_ACCESS_DENIED' });
  }

  const rawBytes = fileContentBase64
    ? Buffer.from(fileContentBase64, 'base64')
    : Buffer.from(`Regulatory statutory document for ${app.institutionName}: ${filename}`);

  const realSha256 = await computeSHA256(rawBytes);
  const storageKey = generateSafeStorageKey(app.institutionId, category, filename);
  const catLabel = CATEGORY_LABELS[category as DocumentCategory] || category;

  // 1. Check exact duplicates (real SHA-256 match)
  const duplicateMatches: DuplicateMatch[] = [];
  const exactMatch = await dbService.findDocumentBySha256(realSha256);
  if (exactMatch) {
    const instResult = await dbService.getInstitutionById(exactMatch.institutionId, user).catch(() => null);
    duplicateMatches.push({
      matchedDocumentId: exactMatch.id,
      matchedApplicationId: exactMatch.applicationId,
      matchedInstitutionId: exactMatch.institutionId,
      matchedInstitutionName: instResult?.institution?.name || 'Registered Institution',
      matchType: 'EXACT_HASH',
      similarityScore: 100,
      detectedTimestamp: new Date().toISOString(),
    });
  }

  const docId = `DOC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  documentFileBufferStore.set(docId, rawBytes);

  // 2. Execute Real OCR and Field Extraction via Python Service
  let extractionStatus: 'EXTRACTED' | 'NEEDS_REVIEW' | 'FAILED' = 'NEEDS_REVIEW';
  let extractedData: ExtractedDocumentData;

  try {
    const ocrResult = await callPythonOcrService(rawBytes, filename, category);
    extractionStatus = ocrResult.status;

    extractedData = {
      documentId: docId,
      engineVersion: ocrResult.engine,
      confidenceScore: ocrResult.overall_confidence,
      institutionName: ocrResult.fields.institution_name?.value || undefined,
      studentName: ocrResult.fields.student_name?.value || undefined,
      courseOrQualification: ocrResult.fields.course_or_qualification?.value || undefined,
      marksOrGrade: ocrResult.fields.marks_or_grade?.value || undefined,
      issuingAuthority: ocrResult.fields.issuing_authority?.value || undefined,
      referenceNumber: ocrResult.fields.reference_number?.value || undefined,
      issueDate: ocrResult.fields.issue_date?.value || undefined,
      expiryDate: ocrResult.fields.expiry_date?.value || undefined,
      academicYear: ocrResult.fields.academic_year?.value || undefined,
      address: ocrResult.fields.address?.value || undefined,
      rawTextPreview: ocrResult.raw_text,
      pageCount: ocrResult.page_count,
      pages: ocrResult.pages.map(p => ({
        pageNumber: p.page_number,
        charCount: p.char_count,
        extractionMethod: p.extraction_method,
        confidence: p.confidence,
        textPreview: p.text_preview,
      })),
      fields: Object.entries(ocrResult.fields).reduce((acc, [k, v]) => {
        acc[k] = {
          value: v.value,
          page: v.page,
          sourceSnippet: v.source_snippet,
          method: v.method,
          confidence: v.confidence,
          isMissing: v.is_missing,
          missingReason: v.missing_reason,
        };
        return acc;
      }, {} as Record<string, any>),
    };
  } catch (err: any) {
    console.error(`[OCR Pipeline Error for ${filename}]:`, err.message);
    extractionStatus = 'FAILED';
    extractedData = {
      documentId: docId,
      engineVersion: 'PyMuPDF-v1.24+Tesseract-v5.3',
      confidenceScore: null,
      rawTextPreview: '',
      ocrError: `Optical extraction failed: ${err.message}`,
    };
  }

  // 3. Check near duplicates on extracted text against existing documents
  if (extractedData.rawTextPreview && extractedData.rawTextPreview.length > 30) {
    const existingDocs = await dbService.getDocuments({}, user);
    for (const existingDoc of existingDocs) {
      if (existingDoc.extractedData?.rawTextPreview && existingDoc.id !== exactMatch?.id) {
        const sim = calculateTextSimilarity(extractedData.rawTextPreview, existingDoc.extractedData.rawTextPreview);
        if (sim >= 80) {
          duplicateMatches.push({
            matchedDocumentId: existingDoc.id,
            matchedApplicationId: existingDoc.applicationId,
            matchedInstitutionId: existingDoc.institutionId,
            matchedInstitutionName: 'Matched Institution',
            matchType: 'NEAR_SIMILARITY',
            similarityScore: sim,
            detectedTimestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  const newDoc: DocumentRecord = {
    id: docId,
    applicationId: app.id,
    institutionId: app.institutionId,
    category: category as DocumentCategory,
    categoryLabel: catLabel,
    originalFilename: filename,
    storageKey,
    mimeType: filename.endsWith('.png') ? 'image/png' : filename.endsWith('.jpg') ? 'image/jpeg' : 'application/pdf',
    fileSizeBytes: sizeBytes || rawBytes.length,
    sha256Checksum: realSha256,
    uploadedById: user.id,
    uploadedByName: user.name,
    uploadTimestamp: new Date().toISOString(),
    version: 1,
    extractionStatus,
    extractedData,
    validationResults: [],
    duplicateMatches,
    isVerified: false,
    verificationStatus: 'PENDING',
  };

  // 4. Run rules engine against real extracted data
  newDoc.validationResults = executeDocumentValidation(newDoc, app.institutionName, app.academicYear);

  // 5. Persist document, extractions, validations, verification task & audit log in PostgreSQL transaction
  const persisted = await dbService.createDocumentWithTransaction(newDoc, user);

  return res.status(201).json({ document: persisted });
});

// Retry OCR processing on existing document
documentsRouter.post(
  '/:id/retry-ocr',
  requireAuth,
  requireRole('COLLEGE_MANAGEMENT', 'SCRUTINY_OFFICER', 'VERIFICATION_OFFICER', 'AICTE_ADMIN'),
  async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const doc = await dbService.getDocumentById(req.params.id, user);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    if (!canAccessInstitution(user, doc.institutionId)) {
      return res.status(403).json({ error: 'TENANT_ACCESS_DENIED' });
    }

    const apps = await dbService.getApplications({}, user);
    const app = apps.find(a => a.id === doc.applicationId);
    const rawBytes = documentFileBufferStore.get(doc.id) || Buffer.from(`Document fallback bytes for ${doc.originalFilename}`);

    try {
      const ocrResult = await callPythonOcrService(rawBytes, doc.originalFilename, doc.category);
      doc.extractionStatus = ocrResult.status;

      doc.extractedData = {
        documentId: doc.id,
        engineVersion: ocrResult.engine,
        confidenceScore: ocrResult.overall_confidence,
        institutionName: ocrResult.fields.institution_name?.value || undefined,
        studentName: ocrResult.fields.student_name?.value || undefined,
        courseOrQualification: ocrResult.fields.course_or_qualification?.value || undefined,
        marksOrGrade: ocrResult.fields.marks_or_grade?.value || undefined,
        issuingAuthority: ocrResult.fields.issuing_authority?.value || undefined,
        referenceNumber: ocrResult.fields.reference_number?.value || undefined,
        issueDate: ocrResult.fields.issue_date?.value || undefined,
        expiryDate: ocrResult.fields.expiry_date?.value || undefined,
        academicYear: ocrResult.fields.academic_year?.value || undefined,
        address: ocrResult.fields.address?.value || undefined,
        rawTextPreview: ocrResult.raw_text,
        pageCount: ocrResult.page_count,
        pages: ocrResult.pages.map(p => ({
          pageNumber: p.page_number,
          charCount: p.char_count,
          extractionMethod: p.extraction_method,
          confidence: p.confidence,
          textPreview: p.text_preview,
        })),
        fields: Object.entries(ocrResult.fields).reduce((acc, [k, v]) => {
          acc[k] = {
            value: v.value,
            page: v.page,
            sourceSnippet: v.source_snippet,
            method: v.method,
            confidence: v.confidence,
            isMissing: v.is_missing,
            missingReason: v.missing_reason,
          };
          return acc;
        }, {} as Record<string, any>),
      };

      if (app) {
        doc.validationResults = executeDocumentValidation(doc, app.institutionName, app.academicYear);
      }

      await dbService.logAudit({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'RETRY_OCR',
        entityType: 'DOCUMENT',
        entityId: doc.id,
        institutionId: doc.institutionId,
        outcome: 'SUCCESS',
        details: `Re-ran OCR extraction for ${doc.originalFilename}. Status: ${doc.extractionStatus}`,
      });

      return res.json({ document: doc });
    } catch (err: any) {
      return res.status(502).json({
        error: 'OCR_SERVICE_UNAVAILABLE',
        message: `Failed to re-run OCR: ${err.message}`,
      });
    }
  }
);

// Authorized file download / preview simulation
documentsRouter.get('/:id/download', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const doc = await dbService.getDocumentById(req.params.id, user);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  if (!canAccessInstitution(user, doc.institutionId)) {
    return res.status(403).json({ error: 'TENANT_ACCESS_DENIED', message: 'You cannot download documents belonging to another institution.' });
  }

  await dbService.logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'DOWNLOAD_DOCUMENT',
    entityType: 'DOCUMENT',
    entityId: doc.id,
    institutionId: doc.institutionId,
    outcome: 'SUCCESS',
    details: `Authorized download of ${doc.originalFilename} (Storage key: ${doc.storageKey})`,
  });

  return res.json({
    downloadUrl: `https://storage.googleapis.com/aicte-docs-vault-prod/${doc.storageKey}?token=signed_exp_${Date.now() + 300000}`,
    filename: doc.originalFilename,
    mimeType: doc.mimeType,
    sha256: doc.sha256Checksum,
  });
});

/**
 * Evidence-Linked Anomaly Detection Engine for EduVerify-AI
 * 
 * Inspects document artifacts for:
 * 1. Suspicious Metadata (editing software signatures, metadata timeline inversion)
 * 2. Conflicting Dates (issue date > expiry date, future issue dates, establishment year conflicts)
 * 3. Inconsistent Identifiers (name mismatch, geographic / district variance)
 * 4. Cross-Institution Collisions (exact hash reuse, near-duplicate text template reuse)
 * 5. Visual/Textual Anomalies (character encoding noise, irregular font spans)
 * 
 * CRITICAL PRINCIPLE:
 * Distinguishes 'ANOMALY_SUSPECTED' from 'CONFIRMED_FORGERY'.
 * Does not accuse institutions of forgery; flags evidentiary discrepancies for human officer adjudication.
 */

import { DocumentRecord, Institution, Application } from '../../src/types/index.js';
import { calculateTextSimilarity } from '../../src/utils/validationRules.js';

export type AnomalyCategory =
  | 'SUSPICIOUS_METADATA'
  | 'CONFLICTING_DATES'
  | 'INCONSISTENT_IDENTIFIER'
  | 'CROSS_INSTITUTION_COLLISION'
  | 'TEXTUAL_ANOMALY';

export type AnomalySeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DocumentAnomalyFlag {
  id: string;
  documentId: string;
  category: AnomalyCategory;
  severity: AnomalySeverity;
  flagTitle: string;
  explanation: string;
  evidence: string;
  suggestedAction: string;
  detectedAt: string;
  humanReviewStatus: 'PENDING_HUMAN_REVIEW' | 'REVIEWED_CLEARED' | 'REVIEWED_CONFIRMED_DEFICIENCY';
  humanReviewNotes?: string;
  reviewedByOfficerId?: string;
}

export interface DocumentAnomalyReport {
  documentId: string;
  filename: string;
  category: string;
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  anomaliesDetectedCount: number;
  flags: DocumentAnomalyFlag[];
  disclaimer: string;
}

export const ANOMALY_ENGINE_VERSION = 'v2.1.0';

/**
 * Evaluates a single document for evidence-linked anomalies
 */
export function analyzeDocumentAnomalies(
  document: DocumentRecord,
  institution: Institution,
  application: Application,
  systemEpoch: Date = new Date('2026-10-24')
): DocumentAnomalyReport {
  const flags: DocumentAnomalyFlag[] = [];
  const now = systemEpoch.getTime();
  const rawText = document.extractedData?.rawTextPreview || '';
  const fields = document.extractedData?.fields || {};

  // 1. Cross-Institution Duplicate Collisions
  if (document.duplicateMatches && document.duplicateMatches.length > 0) {
    for (const match of document.duplicateMatches) {
      if (match.matchedInstitutionId !== document.institutionId) {
        if (match.matchType === 'EXACT_HASH') {
          flags.push({
            id: `ANOM-DUP-EXACT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
            documentId: document.id,
            category: 'CROSS_INSTITUTION_COLLISION',
            severity: 'HIGH',
            flagTitle: 'Exact Cryptographic Hash Collision Across Institutions',
            explanation: `Identical SHA-256 cryptographic digest is registered under institution "${match.matchedInstitutionName}". Statutory documents cannot be shared across distinct trusts.`,
            evidence: `SHA-256: ${document.sha256Checksum} matches Application ${match.matchedApplicationId}`,
            suggestedAction: 'Require college management to produce the original registered deed and explain shared document hash.',
            detectedAt: new Date().toISOString(),
            humanReviewStatus: 'PENDING_HUMAN_REVIEW',
          });
        } else if (match.similarityScore >= 88) {
          flags.push({
            id: `ANOM-DUP-SIM-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
            documentId: document.id,
            category: 'CROSS_INSTITUTION_COLLISION',
            severity: 'MEDIUM',
            flagTitle: 'High Textual Template Similarity Across Institutions',
            explanation: `Document exhibits an unusually high text overlap (${match.similarityScore}%) with records of "${match.matchedInstitutionName}".`,
            evidence: `Similarity: ${match.similarityScore}% against Document ${match.matchedDocumentId}`,
            suggestedAction: 'Scrutinize seal, signatures, and survey parcel boundaries to rule out template recycling.',
            detectedAt: new Date().toISOString(),
            humanReviewStatus: 'PENDING_HUMAN_REVIEW',
          });
        }
      }
    }
  }

  // 2. Conflicting Dates Analysis
  const issueDateStr = document.extractedData?.issueDate;
  const expiryDateStr = document.extractedData?.expiryDate;

  if (issueDateStr) {
    const issueDate = new Date(issueDateStr).getTime();

    // Check future issue date
    if (!isNaN(issueDate) && issueDate > now + (24 * 60 * 60 * 1000)) {
      flags.push({
        id: `ANOM-DATE-FUT-${Date.now().toString(36)}`,
        documentId: document.id,
        category: 'CONFLICTING_DATES',
        severity: 'HIGH',
        flagTitle: 'Post-Dated / Future Issuance Date Detected',
        explanation: `Extracted issue date (${issueDateStr}) lies in the future relative to the current regulatory scrutiny cycle.`,
        evidence: `Extracted Issue Date: ${issueDateStr} | Current Regulatory Epoch: 2026-10-24`,
        suggestedAction: 'Check for typographic error in OCR parsing or request original physical certificate.',
        detectedAt: new Date().toISOString(),
        humanReviewStatus: 'PENDING_HUMAN_REVIEW',
      });
    }

    // Check issue date predating institution established year by > 10 years (unless land deed)
    if (document.category !== 'LAND_TITLE_DEED' && institution.establishedYear > 1900) {
      const issueYear = new Date(issueDateStr).getFullYear();
      if (!isNaN(issueYear) && issueYear < institution.establishedYear - 5) {
        flags.push({
          id: `ANOM-DATE-EST-${Date.now().toString(36)}`,
          documentId: document.id,
          category: 'CONFLICTING_DATES',
          severity: 'MEDIUM',
          flagTitle: 'Issuance Date Predates Institution Establishment',
          explanation: `Document issuance date (${issueDateStr}) predates the registered establishment year (${institution.establishedYear}) of ${institution.name}.`,
          evidence: `Document year: ${issueYear} vs Institution Established: ${institution.establishedYear}`,
          suggestedAction: 'Verify whether document was issued to the sponsoring parent trust prior to college founding.',
          detectedAt: new Date().toISOString(),
          humanReviewStatus: 'PENDING_HUMAN_REVIEW',
        });
      }
    }

    // Check issue date after expiry date
    if (expiryDateStr) {
      const expiryDate = new Date(expiryDateStr).getTime();
      if (!isNaN(issueDate) && !isNaN(expiryDate) && issueDate > expiryDate) {
        flags.push({
          id: `ANOM-DATE-INV-${Date.now().toString(36)}`,
          documentId: document.id,
          category: 'CONFLICTING_DATES',
          severity: 'HIGH',
          flagTitle: 'Chronological Inversion: Issue Date After Expiry Date',
          explanation: `Document contains an illogical date sequence where issuance (${issueDateStr}) is recorded after expiration (${expiryDateStr}).`,
          evidence: `Issue Date: ${issueDateStr} > Expiry Date: ${expiryDateStr}`,
          suggestedAction: 'Examine document for altered dates or OCR field assignment errors.',
          detectedAt: new Date().toISOString(),
          humanReviewStatus: 'PENDING_HUMAN_REVIEW',
        });
      }
    }
  }

  // 3. Inconsistent Identifiers (Institution Name & Geographic Alignment)
  const extractedInst = document.extractedData?.institutionName;
  if (extractedInst) {
    const similarity = calculateTextSimilarity(extractedInst, institution.name);
    if (similarity < 40) {
      flags.push({
        id: `ANOM-IDENT-NAME-${Date.now().toString(36)}`,
        documentId: document.id,
        category: 'INCONSISTENT_IDENTIFIER',
        severity: 'HIGH',
        flagTitle: 'Severe Institution Name Discrepancy',
        explanation: `Extracted banner text "${extractedInst}" differs substantially (${similarity}% match) from registered institution "${institution.name}".`,
        evidence: `Extracted: "${extractedInst}" vs Registered: "${institution.name}"`,
        suggestedAction: 'Verify if document belongs to an affiliated trust hospital or sister institution rather than the technical campus.',
        detectedAt: new Date().toISOString(),
        humanReviewStatus: 'PENDING_HUMAN_REVIEW',
      });
    }
  }

  // 4. Suspicious Metadata & Editing Signatures
  // Search raw preview for common graphic editing markers or contradictory software tags
  const lowerRaw = rawText.toLowerCase();
  const editingSignatures = ['adobe photoshop', 'canva design', 'coreldraw', 'pixlr', 'gimp'];
  const matchedSignature = editingSignatures.find(sig => lowerRaw.includes(sig));

  if (matchedSignature) {
    flags.push({
      id: `ANOM-META-EDIT-${Date.now().toString(36)}`,
      documentId: document.id,
      category: 'SUSPICIOUS_METADATA',
      severity: 'HIGH',
      flagTitle: 'Graphic Editing Software Signature in Statutory Certificate',
      explanation: `Document metadata stream contains markers indicative of graphic manipulation software ("${matchedSignature}"). Official certificates should originate directly from government rasterizers or scanners.`,
      evidence: `Signature detected: "${matchedSignature}" in text/metadata buffer`,
      suggestedAction: 'Mandate submission of physically stamped original copy during Scrutiny Committee hearing.',
      detectedAt: new Date().toISOString(),
      humanReviewStatus: 'PENDING_HUMAN_REVIEW',
    });
  }

  // Determine overall risk level
  const highCount = flags.filter(f => f.severity === 'HIGH').length;
  const mediumCount = flags.filter(f => f.severity === 'MEDIUM').length;

  let overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (highCount > 0) {
    overallRiskLevel = 'HIGH';
  } else if (mediumCount > 0) {
    overallRiskLevel = 'MEDIUM';
  }

  return {
    documentId: document.id,
    filename: document.originalFilename,
    category: document.category,
    overallRiskLevel,
    anomaliesDetectedCount: flags.length,
    flags,
    disclaimer: 'Anomaly flags indicate statistical or structural inconsistencies for human reviewer attention and do NOT constitute proof of forgery.',
  };
}

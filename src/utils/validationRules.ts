/**
 * Configurable Document Validation Rules Engine for EduVerify-AI
 */

import { DocumentRecord, ValidationOutcome, ValidationResultItem, ExtractedDocumentData } from '../types/index.js';

export interface RuleDefinition {
  id: string;
  version: string;
  title: string;
  description: string;
  category: 'INTEGRITY' | 'CONSISTENCY' | 'VALIDITY' | 'METADATA';
  severity: 'FAIL' | 'WARNING' | 'NEEDS_REVIEW';
  evaluate: (doc: DocumentRecord, institutionName: string, academicYear: string) => {
    outcome: ValidationOutcome;
    explanation: string;
    evidence: string;
  };
}

export const VALIDATION_ENGINE_VERSION = 'v2.4.1';

/**
 * Normalizes text for similarity and name matching.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates Jaccard / token similarity score between two strings (0 - 100).
 */
export function calculateTextSimilarity(strA: string, strB: string): number {
  const wordsA = new Set(normalizeText(strA).split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normalizeText(strB).split(' ').filter(w => w.length > 2));
  
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  
  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }
  
  const union = new Set([...wordsA, ...wordsB]).size;
  return Math.round((intersection / union) * 100);
}

/**
 * Standard Suite of AICTE Regulatory Validation Rules
 */
export const STANDARD_RULES: RuleDefinition[] = [
  {
    id: 'RULE-INT-001',
    version: '1.2.0',
    title: 'File Integrity & Size Compliance',
    description: 'Verifies the file is non-empty, within the 20MB limit, and has valid checksum.',
    category: 'INTEGRITY',
    severity: 'FAIL',
    evaluate: (doc) => {
      if (!doc.sha256Checksum || doc.sha256Checksum.length !== 64) {
        return {
          outcome: 'FAIL',
          explanation: 'Corrupted or uncomputed SHA-256 cryptographic digest.',
          evidence: `Digest length: ${doc.sha256Checksum?.length || 0}`,
        };
      }
      if (doc.fileSizeBytes <= 0 || doc.fileSizeBytes > 20 * 1024 * 1024) {
        return {
          outcome: 'FAIL',
          explanation: `File size (${(doc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB) violates limits (0 < size <= 20 MB).`,
          evidence: `Bytes: ${doc.fileSizeBytes}`,
        };
      }
      return {
        outcome: 'PASS',
        explanation: 'Document file passed integrity check, byte-count verification, and SHA-256 seal.',
        evidence: `SHA-256: ${doc.sha256Checksum.substring(0, 16)}... | Size: ${(doc.fileSizeBytes / 1024).toFixed(1)} KB`,
      };
    },
  },
  {
    id: 'RULE-MET-002',
    version: '1.1.0',
    title: 'Mandatory Metadata Extraction Presence',
    description: 'Ensures the document content was parsed and basic metadata (reference/issue date) exists.',
    category: 'METADATA',
    severity: 'NEEDS_REVIEW',
    evaluate: (doc) => {
      const data = doc.extractedData;
      if (!data || doc.extractionStatus === 'FAILED') {
        return {
          outcome: 'NEEDS_REVIEW',
          explanation: 'Document text could not be extracted automatically. Manual scrutiny required.',
          evidence: `Status: ${doc.extractionStatus}`,
        };
      }
      if (!data.referenceNumber && !data.issueDate) {
        return {
          outcome: 'WARNING',
          explanation: 'No certificate reference number or issuance date could be automatically parsed.',
          evidence: 'Missing fields: referenceNumber, issueDate',
        };
      }
      const confDisplay = data.confidenceScore != null ? `${data.confidenceScore}%` : 'Digital Text';
      return {
        outcome: 'PASS',
        explanation: 'Key metadata parameters extracted with sufficient parsing confidence.',
        evidence: `Ref: ${data.referenceNumber || 'N/A'} | Date: ${data.issueDate || 'N/A'} (Confidence: ${confDisplay})`,
      };
    },
  },
  {
    id: 'RULE-CON-003',
    version: '2.0.1',
    title: 'Institution Name Alignment',
    description: 'Cross-checks extracted institution name in certificate against registered institution.',
    category: 'CONSISTENCY',
    severity: 'WARNING',
    evaluate: (doc, institutionName) => {
      const extractedName = doc.extractedData?.institutionName;
      if (!extractedName) {
        return {
          outcome: 'NEEDS_REVIEW',
          explanation: 'Extracted certificate lacks readable institution name banner.',
          evidence: 'Extracted name is empty.',
        };
      }
      const similarity = calculateTextSimilarity(extractedName, institutionName);
      if (similarity >= 65) {
        return {
          outcome: 'PASS',
          explanation: `Extracted name closely matches official registered institution (${similarity}% token similarity).`,
          evidence: `Certificate: "${extractedName}" vs Registered: "${institutionName}"`,
        };
      }
      return {
        outcome: 'WARNING',
        explanation: `Potential mismatch detected between document text and registered institution (${similarity}% match).`,
        evidence: `Certificate: "${extractedName}" vs Registered: "${institutionName}"`,
      };
    },
  },
  {
    id: 'RULE-VAL-004',
    version: '1.4.0',
    title: 'Document Expiration and Validity Check',
    description: 'Validates that document is not expired and falls within authorized regulatory timeframe.',
    category: 'VALIDITY',
    severity: 'WARNING',
    evaluate: (doc) => {
      const expiry = doc.extractedData?.expiryDate;
      if (!expiry) {
        return {
          outcome: 'NOT_APPLICABLE',
          explanation: 'Document category does not carry a mandatory fixed expiry date (e.g. perpetual Land Deed).',
          evidence: 'No expiry field detected.',
        };
      }
      
      const expiryTime = new Date(expiry).getTime();
      const now = new Date('2026-10-24').getTime(); // Current system epoch
      
      if (isNaN(expiryTime)) {
        return {
          outcome: 'NEEDS_REVIEW',
          explanation: `Extracted expiry date format "${expiry}" could not be parsed unambiguously.`,
          evidence: `Raw value: "${expiry}"`,
        };
      }
      
      if (expiryTime < now) {
        return {
          outcome: 'FAIL',
          explanation: `Certificate expired on ${expiry}. Extension or updated renewal required.`,
          evidence: `Expired: ${expiry} (Current: 2026-10-24)`,
        };
      }
      
      const daysRemaining = Math.round((expiryTime - now) / (1000 * 60 * 60 * 24));
      if (daysRemaining < 60) {
        return {
          outcome: 'WARNING',
          explanation: `Certificate is valid but expires soon (${daysRemaining} days remaining).`,
          evidence: `Expiry: ${expiry}`,
        };
      }
      
      return {
        outcome: 'PASS',
        explanation: `Document is active and valid until ${expiry}.`,
        evidence: `Valid through: ${expiry}`,
      };
    },
  },
  {
    id: 'RULE-DUP-005',
    version: '1.0.0',
    title: 'Cross-Institution Duplicate Document Anomaly',
    description: 'Flags if identical SHA-256 or high-similarity document belongs to another institution.',
    category: 'INTEGRITY',
    severity: 'FAIL',
    evaluate: (doc) => {
      const duplicates = doc.duplicateMatches || [];
      const crossInstExact = duplicates.find(d => d.matchType === 'EXACT_HASH' && d.matchedInstitutionId !== doc.institutionId);
      
      if (crossInstExact) {
        return {
          outcome: 'FAIL',
          explanation: `Identical cryptographic file hash found in application for "${crossInstExact.matchedInstitutionName}". Potential reuse of restricted evidence.`,
          evidence: `Matched Inst: ${crossInstExact.matchedInstitutionName} (App: ${crossInstExact.matchedApplicationId})`,
        };
      }
      
      const nearMatch = duplicates.find(d => d.matchType === 'NEAR_SIMILARITY' && d.similarityScore >= 85);
      if (nearMatch) {
        return {
          outcome: 'NEEDS_REVIEW',
          explanation: `High visual/textual template similarity (${nearMatch.similarityScore}%) with existing archive document. Human scrutiny required.`,
          evidence: `Score: ${nearMatch.similarityScore}% against doc ${nearMatch.matchedDocumentId.substring(0, 8)}`,
        };
      }
      
      return {
        outcome: 'PASS',
        explanation: 'No conflicting duplicate document hashes or suspicious template clones detected.',
        evidence: 'Unique hash across active database.',
      };
    },
  },
];

/**
 * Executes all validation rules against a given document record.
 */
export function executeDocumentValidation(
  doc: DocumentRecord,
  institutionName: string,
  academicYear: string
): ValidationResultItem[] {
  return STANDARD_RULES.map(rule => {
    const result = rule.evaluate(doc, institutionName, academicYear);
    return {
      id: `VAL-${rule.id}-${Date.now().toString(36)}`,
      ruleId: rule.id,
      ruleTitle: rule.title,
      outcome: result.outcome,
      explanation: result.explanation,
      evidence: result.evidence,
      timestamp: new Date().toISOString(),
      ruleVersion: rule.version,
    };
  });
}

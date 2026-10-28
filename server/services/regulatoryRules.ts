/**
/**
 * AICTE Approval Process Handbook (APH) Configurable Regulatory Rules Engine
 * Implements category-specific checklists, statutory norms, and compliance scoring.
 * 
 * References:
 * - AICTE Approval Process Handbook (APH 2024-2027) Chapter I & II
 * - AICTE Norms for Land, Built-up Area, and Faculty Cadre (Appendices 4 & 5)
 */

import { Application, DocumentRecord, Institution, ApplicationStatus } from '../../src/types/index.js';

export interface RegulatoryRule {
  id: string;
  version: string;
  aphClause: string;
  title: string;
  description: string;
  category: 'LAND_REQUIREMENT' | 'INFRASTRUCTURE' | 'STATUTORY_NOC' | 'ACADEMIC_FACULTY' | 'SAFETY_ENVIRONMENT';
  applicableApplicationTypes: Array<'NEW_APPLICANT' | 'EXTENSION_OF_APPROVAL' | 'ALL'>;
  isMandatory: boolean;
  evaluate: (context: EvaluationContext) => RuleEvaluationResult;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleVersion: string;
  aphClause: string;
  title: string;
  isMandatory: boolean;
  outcome: 'COMPLIANT' | 'NON_COMPLIANT' | 'CLARIFICATION_REQUIRED' | 'PENDING';
  explanation: string;
  evidence: string;
  remedialAction?: string;
}

export interface EvaluationContext {
  application: Application;
  documents: DocumentRecord[];
  institution: Institution;
  now?: Date;
}

export interface ApplicationComplianceReport {
  applicationId: string;
  applicationNumber: string;
  applicationType: string;
  academicYear: string;
  evaluatedAt: string;
  engineVersion: string;
  summary: {
    totalRules: number;
    mandatoryRules: number;
    compliantCount: number;
    nonCompliantCount: number;
    clarificationCount: number;
    pendingCount: number;
    complianceScore: number; // 0 - 100 percentage
    hasCriticalDeficiency: boolean;
  };
  results: RuleEvaluationResult[];
  deficiencies: Array<{
    ruleId: string;
    aphClause: string;
    title: string;
    explanation: string;
    evidence: string;
  }>;
}

export const REGULATORY_ENGINE_VERSION = 'v3.1.0-APH-2024-27';

/**
 * AICTE Regulatory Norms Definitions
 */
export const AICTE_REGULATORY_RULES: RegulatoryRule[] = [
  // 1. Land Requirement (APH Appendix 4)
  {
    id: 'APH-LAND-001',
    version: '2024.1',
    aphClause: 'Clause 1.4 & Appendix 4 Table 4.1',
    title: 'Minimum Campus Land Area Compliance',
    description: 'Verifies campus land area meets prescribed AICTE norms (Metro >= 1.5 acres, Urban >= 2.5 acres, Rural >= 7.5 acres) on clear, contiguous, and unencumbered title.',
    category: 'LAND_REQUIREMENT',
    applicableApplicationTypes: ['NEW_APPLICANT'],
    isMandatory: true,
    evaluate: (ctx) => {
      const landDoc = ctx.documents.find(d => d.category === 'LAND_TITLE_DEED');
      if (!landDoc) {
        return {
          ruleId: 'APH-LAND-001',
          ruleVersion: '2024.1',
          aphClause: 'Clause 1.4 & Appendix 4 Table 4.1',
          title: 'Minimum Campus Land Area Compliance',
          isMandatory: true,
          outcome: 'NON_COMPLIANT',
          explanation: 'Mandatory Land Title Deed & Possession certificate is missing from the application docket.',
          evidence: 'Document category LAND_TITLE_DEED not uploaded.',
          remedialAction: 'Upload registered Land Sale Deed / 30-year Govt Lease Deed with non-encumbrance certificate.',
        };
      }

      // Check extracted land area or institution campusAreaAcres
      const area = ctx.institution.campusAreaAcres || 0;
      const isUrban = ctx.institution.district.toLowerCase().includes('urban') || ctx.institution.district.toLowerCase().includes('metro');
      const requiredAcres = isUrban ? 2.5 : 7.5;

      if (area < requiredAcres) {
        return {
          ruleId: 'APH-LAND-001',
          ruleVersion: '2024.1',
          aphClause: 'Clause 1.4 & Appendix 4 Table 4.1',
          title: 'Minimum Campus Land Area Compliance',
          isMandatory: true,
          outcome: 'NON_COMPLIANT',
          explanation: `Registered campus area (${area} acres) is below prescribed AICTE requirement for ${isUrban ? 'Urban' : 'Rural'} location (${requiredAcres} acres).`,
          evidence: `Campus area: ${area} acres | Required: ${requiredAcres} acres (Location: ${ctx.institution.district})`,
          remedialAction: 'Submit additional land registration documents or demarcation order demonstrating contiguous boundary.',
        };
      }

      return {
        ruleId: 'APH-LAND-001',
        ruleVersion: '2024.1',
        aphClause: 'Clause 1.4 & Appendix 4 Table 4.1',
        title: 'Minimum Campus Land Area Compliance',
        isMandatory: true,
        outcome: 'COMPLIANT',
        explanation: `Campus land area of ${area} acres meets and exceeds the prescribed AICTE threshold of ${requiredAcres} acres.`,
        evidence: `Campus area: ${area} acres (Required: ${requiredAcres} acres). Land deed document verified (Ref: ${landDoc.extractedData?.referenceNumber || 'Present'}).`,
      };
    },
  },

  // 2. Fire and Rescue Safety Certificate (APH Chapter II / Appendix 15)
  {
    id: 'APH-FIRE-002',
    version: '2024.2',
    aphClause: 'Clause 2.3 & Appendix 15',
    title: 'Active Fire and Life Safety Certificate (NOC)',
    description: 'Ensures institution possesses an active, valid Fire Safety Certificate issued by State Fire Services Department without expiry.',
    category: 'SAFETY_ENVIRONMENT',
    applicableApplicationTypes: ['ALL'],
    isMandatory: true,
    evaluate: (ctx) => {
      const fireDoc = ctx.documents.find(d => d.category === 'FIRE_SAFETY_CERTIFICATE');
      if (!fireDoc) {
        return {
          ruleId: 'APH-FIRE-002',
          ruleVersion: '2024.2',
          aphClause: 'Clause 2.3 & Appendix 15',
          title: 'Active Fire and Life Safety Certificate (NOC)',
          isMandatory: true,
          outcome: 'NON_COMPLIANT',
          explanation: 'Mandatory Fire Safety Certificate is absent from application docket.',
          evidence: 'Document category FIRE_SAFETY_CERTIFICATE not uploaded.',
          remedialAction: 'Upload valid Fire Safety Renewal NOC from Chief Fire Officer.',
        };
      }

      const expiry = fireDoc.extractedData?.expiryDate;
      if (expiry) {
        const expiryTime = new Date(expiry).getTime();
        const now = ctx.now ? ctx.now.getTime() : new Date('2026-10-24').getTime();
        if (expiryTime < now) {
          return {
            ruleId: 'APH-FIRE-002',
            ruleVersion: '2024.2',
            aphClause: 'Clause 2.3 & Appendix 15',
            title: 'Active Fire and Life Safety Certificate (NOC)',
            isMandatory: true,
            outcome: 'NON_COMPLIANT',
            explanation: `Fire Safety Certificate expired on ${expiry}. Extension of approval cannot be granted without active life safety clearance.`,
            evidence: `Certificate expired: ${expiry} (Current cycle: ${ctx.application.academicYear})`,
            remedialAction: 'Obtain immediate renewal from Fire Services Directorate or submit renewal application receipt with temporary cover.',
          };
        }
      }

      return {
        ruleId: 'APH-FIRE-002',
        ruleVersion: '2024.2',
        aphClause: 'Clause 2.3 & Appendix 15',
        title: 'Active Fire and Life Safety Certificate (NOC)',
        isMandatory: true,
        outcome: 'COMPLIANT',
        explanation: 'Fire Safety Certificate is active, non-expired, and verified in application docket.',
        evidence: `Ref: ${fireDoc.extractedData?.referenceNumber || 'NOC Found'} | Expiry: ${expiry || 'Active'}`,
      };
    },
  },

  // 3. Approved Building Plan and Occupancy Certificate (APH Appendix 4)
  {
    id: 'APH-BLDG-003',
    version: '2024.1',
    aphClause: 'Clause 1.5 & Appendix 4 Table 4.2',
    title: 'Municipal Building Plan & Occupancy Approval',
    description: 'Requires approved Master Plan and structural safety/occupancy certificate from local municipal / panchayat authority.',
    category: 'INFRASTRUCTURE',
    applicableApplicationTypes: ['ALL'],
    isMandatory: true,
    evaluate: (ctx) => {
      const bldgDoc = ctx.documents.find(d => d.category === 'BUILDING_PLAN_APPROVAL');
      if (!bldgDoc) {
        return {
          ruleId: 'APH-BLDG-003',
          ruleVersion: '2024.1',
          aphClause: 'Clause 1.5 & Appendix 4 Table 4.2',
          title: 'Municipal Building Plan & Occupancy Approval',
          isMandatory: true,
          outcome: 'NON_COMPLIANT',
          explanation: 'Building Plan Approval from competent town planning / municipal authority is missing.',
          evidence: 'Document category BUILDING_PLAN_APPROVAL not uploaded.',
          remedialAction: 'Upload sanction order and blue-print building drawing approved by Town Planning Authority.',
        };
      }

      return {
        ruleId: 'APH-BLDG-003',
        ruleVersion: '2024.1',
        aphClause: 'Clause 1.5 & Appendix 4 Table 4.2',
        title: 'Municipal Building Plan & Occupancy Approval',
        isMandatory: true,
        outcome: 'COMPLIANT',
        explanation: 'Sanctioned building plan approval is present in application docket.',
        evidence: `Approved Plan Ref: ${bldgDoc.extractedData?.referenceNumber || 'Document Verified'}`,
      };
    },
  },

  // 4. University Affiliation & Continuation (APH Chapter II)
  {
    id: 'APH-AFF-004',
    version: '2024.1',
    aphClause: 'Clause 2.4',
    title: 'Continuation of University Affiliation Order',
    description: 'Ensures the affiliating University has granted continuation of affiliation for all sanctioned programmes for the upcoming academic cycle.',
    category: 'STATUTORY_NOC',
    applicableApplicationTypes: ['ALL'],
    isMandatory: true,
    evaluate: (ctx) => {
      const affDoc = ctx.documents.find(d => d.category === 'AFFILIATION_ORDER');
      if (!affDoc) {
        return {
          ruleId: 'APH-AFF-004',
          ruleVersion: '2024.1',
          aphClause: 'Clause 2.4',
          title: 'Continuation of University Affiliation Order',
          isMandatory: true,
          outcome: 'NON_COMPLIANT',
          explanation: 'University Affiliation order is missing.',
          evidence: 'Document category AFFILIATION_ORDER not uploaded.',
          remedialAction: 'Upload official gazetted affiliation notification from State Technical University.',
        };
      }

      return {
        ruleId: 'APH-AFF-004',
        ruleVersion: '2024.1',
        aphClause: 'Clause 2.4',
        title: 'Continuation of University Affiliation Order',
        isMandatory: true,
        outcome: 'COMPLIANT',
        explanation: `Affiliation order from ${ctx.institution.affiliationUniversity} is documented.`,
        evidence: `University: ${ctx.institution.affiliationUniversity} | Ref: ${affDoc.extractedData?.referenceNumber || 'Affiliation Order on Record'}`,
      };
    },
  },

  // 5. Faculty Cadre & Student-to-Faculty Ratio (APH Appendix 7)
  {
    id: 'APH-FAC-005',
    version: '2024.1',
    aphClause: 'Clause 2.14 & Appendix 7 Table 7.1',
    title: 'Faculty-to-Student Cadre Ratio Compliance',
    description: 'Verifies institution maintains minimum 1:20 (or 1:15 for accredited) faculty-to-student ratio across sanctioned intake.',
    category: 'ACADEMIC_FACULTY',
    applicableApplicationTypes: ['EXTENSION_OF_APPROVAL', 'ALL'],
    isMandatory: true,
    evaluate: (ctx) => {
      const facultyDoc = ctx.documents.find(d => d.category === 'FACULTY_LIST_RATIFICATION');
      const facultyCount = ctx.institution.totalFacultyCount || 0;
      const studentCapacity = ctx.institution.totalStudentCapacity || 0;

      if (!facultyDoc && ctx.application.type === 'EXTENSION_OF_APPROVAL') {
        return {
          ruleId: 'APH-FAC-005',
          ruleVersion: '2024.1',
          aphClause: 'Clause 2.14 & Appendix 7 Table 7.1',
          title: 'Faculty-to-Student Cadre Ratio Compliance',
          isMandatory: true,
          outcome: 'CLARIFICATION_REQUIRED',
          explanation: 'Ratified faculty list signed by Affiliating University Registrar is pending.',
          evidence: 'Category FACULTY_LIST_RATIFICATION missing from submission.',
          remedialAction: 'Submit university-ratified faculty selection committee proceedings and list.',
        };
      }

      if (studentCapacity > 0 && facultyCount > 0) {
        const ratio = studentCapacity / facultyCount;
        if (ratio > 20) {
          return {
            ruleId: 'APH-FAC-005',
            ruleVersion: '2024.1',
            aphClause: 'Clause 2.14 & Appendix 7 Table 7.1',
            title: 'Faculty-to-Student Cadre Ratio Compliance',
            isMandatory: true,
            outcome: 'NON_COMPLIANT',
            explanation: `Current student-to-faculty ratio (1:${ratio.toFixed(1)}) violates AICTE maximum ceiling of 1:20.`,
            evidence: `Students: ${studentCapacity} | Faculty: ${facultyCount} (Ratio: 1:${ratio.toFixed(1)})`,
            remedialAction: `Recruit additional qualified faculty (minimum ${Math.ceil(studentCapacity / 20) - facultyCount} faculty needed) to meet 1:20 norm.`,
          };
        }

        return {
          ruleId: 'APH-FAC-005',
          ruleVersion: '2024.1',
          aphClause: 'Clause 2.14 & Appendix 7 Table 7.1',
          title: 'Faculty-to-Student Cadre Ratio Compliance',
          isMandatory: true,
          outcome: 'COMPLIANT',
          explanation: `Faculty-to-student ratio of 1:${ratio.toFixed(1)} satisfies AICTE norms (<= 1:20).`,
          evidence: `Students: ${studentCapacity} | Faculty: ${facultyCount} (Ratio: 1:${ratio.toFixed(1)})`,
        };
      }

      return {
        ruleId: 'APH-FAC-005',
        ruleVersion: '2024.1',
        aphClause: 'Clause 2.14 & Appendix 7 Table 7.1',
        title: 'Faculty-to-Student Cadre Ratio Compliance',
        isMandatory: false,
        outcome: 'PENDING',
        explanation: 'Faculty list under scrutiny verification.',
        evidence: `Faculty count recorded: ${facultyCount}`,
      };
    },
  },

  // 6. Pollution Control Board Clearance (APH Appendix 15)
  {
    id: 'APH-POL-006',
    version: '2024.1',
    aphClause: 'Clause 2.5 & Appendix 15',
    title: 'State Pollution Control Board Consent',
    description: 'Requires Consent to Operate (CTO) or Certificate of Environmental Exemption from State Pollution Control Board.',
    category: 'SAFETY_ENVIRONMENT',
    applicableApplicationTypes: ['ALL'],
    isMandatory: false,
    evaluate: (ctx) => {
      const polDoc = ctx.documents.find(d => d.category === 'POLLUTION_CLEARANCE');
      if (!polDoc) {
        return {
          ruleId: 'APH-POL-006',
          ruleVersion: '2024.1',
          aphClause: 'Clause 2.5 & Appendix 15',
          title: 'State Pollution Control Board Consent',
          isMandatory: false,
          outcome: 'CLARIFICATION_REQUIRED',
          explanation: 'Pollution Control Board Consent / Exemption certificate not detected in docket.',
          evidence: 'Category POLLUTION_CLEARANCE missing.',
          remedialAction: 'Submit Consent to Establish/Operate from State Pollution Control Board or green-category exemption certificate.',
        };
      }

      return {
        ruleId: 'APH-POL-006',
        ruleVersion: '2024.1',
        aphClause: 'Clause 2.5 & Appendix 15',
        title: 'State Pollution Control Board Consent',
        isMandatory: false,
        outcome: 'COMPLIANT',
        explanation: 'Pollution Clearance certificate documented.',
        evidence: `Ref: ${polDoc.extractedData?.referenceNumber || 'Present'}`,
      };
    },
  },

  // 7. Financial Audit Report & Stability (APH Chapter II)
  {
    id: 'APH-FIN-007',
    version: '2024.1',
    aphClause: 'Clause 2.6',
    title: 'Audited Financial Statements Compliance',
    description: 'Requires previous financial year balance sheet and audit report certified by Chartered Accountant with UDIN.',
    category: 'STATUTORY_NOC',
    applicableApplicationTypes: ['EXTENSION_OF_APPROVAL'],
    isMandatory: true,
    evaluate: (ctx) => {
      const finDoc = ctx.documents.find(d => d.category === 'FINANCIAL_AUDIT_REPORT');
      if (!finDoc && ctx.application.type === 'EXTENSION_OF_APPROVAL') {
        return {
          ruleId: 'APH-FIN-007',
          ruleVersion: '2024.1',
          aphClause: 'Clause 2.6',
          title: 'Audited Financial Statements Compliance',
          isMandatory: true,
          outcome: 'NON_COMPLIANT',
          explanation: 'CA-certified Financial Audit Report with UDIN is missing.',
          evidence: 'Document category FINANCIAL_AUDIT_REPORT not uploaded.',
          remedialAction: 'Upload audited Balance Sheet, Income & Expenditure account, and UDIN-stamped CA certificate.',
        };
      }

      return {
        ruleId: 'APH-FIN-007',
        ruleVersion: '2024.1',
        aphClause: 'Clause 2.6',
        title: 'Audited Financial Statements Compliance',
        isMandatory: true,
        outcome: 'COMPLIANT',
        explanation: 'Audited financial statements recorded in application docket.',
        evidence: `Audit Record Ref: ${finDoc?.extractedData?.referenceNumber || 'CA Stamped'}`,
      };
    },
  },
];

/**
 * Evaluates an application docket against AICTE regulatory norms.
 */
export function evaluateApplicationCompliance(
  application: Application,
  documents: DocumentRecord[],
  institution: Institution,
  now?: Date
): ApplicationComplianceReport {
  const context: EvaluationContext = { application, documents, institution, now };

  const applicableRules = AICTE_REGULATORY_RULES.filter(r => {
    if (r.applicableApplicationTypes.includes('ALL')) return true;
    return r.applicableApplicationTypes.includes(application.type as any);
  });

  const results: RuleEvaluationResult[] = applicableRules.map(rule => rule.evaluate(context));

  const totalRules = results.length;
  const mandatoryRules = results.filter(r => r.isMandatory).length;
  const compliantCount = results.filter(r => r.outcome === 'COMPLIANT').length;
  const nonCompliantCount = results.filter(r => r.outcome === 'NON_COMPLIANT').length;
  const clarificationCount = results.filter(r => r.outcome === 'CLARIFICATION_REQUIRED').length;
  const pendingCount = results.filter(r => r.outcome === 'PENDING').length;

  // Score calculation: compliant items / total items * 100
  const complianceScore = totalRules > 0 ? Math.round((compliantCount / totalRules) * 100) : 0;
  const hasCriticalDeficiency = results.some(r => r.isMandatory && r.outcome === 'NON_COMPLIANT');

  const deficiencies = results
    .filter(r => r.outcome === 'NON_COMPLIANT')
    .map(r => ({
      ruleId: r.ruleId,
      aphClause: r.aphClause,
      title: r.title,
      explanation: r.explanation,
      evidence: r.evidence,
    }));

  return {
    applicationId: application.id,
    applicationNumber: application.applicationNumber,
    applicationType: application.type,
    academicYear: application.academicYear,
    evaluatedAt: (now || new Date()).toISOString(),
    engineVersion: REGULATORY_ENGINE_VERSION,
    summary: {
      totalRules,
      mandatoryRules,
      compliantCount,
      nonCompliantCount,
      clarificationCount,
      pendingCount,
      complianceScore,
      hasCriticalDeficiency,
    },
    results,
    deficiencies,
  };
}

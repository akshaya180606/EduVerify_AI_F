/**
 * Infrastructure Compliance Assistance Service for EduVerify-AI
 * 
 * Inspects physical infrastructure evidence based on AICTE Approval Process Handbook (APH)
 * norms for Instructional Area, Administrative Area, Amenities, and Safety/Access.
 * 
 * CRITICAL AICTE REGULATORY BOUNDARY:
 * Automated AI analysis evaluates documentary evidence, blueprints, and uploaded photographs only.
 * Physical compliance CANNOT be legally certified from photographs alone.
 * Uncertain or deficient items are automatically flagged and routed for on-site Expert Visiting
 * Committee (EVC) physical inspection.
 */

import { Application, DocumentRecord, Institution } from '../../src/types/index.js';

export interface InfrastructureItemRequirement {
  id: string;
  category: 'INSTRUCTIONAL' | 'ADMINISTRATIVE' | 'AMENITIES' | 'CIRCULATION_SAFETY';
  areaName: string;
  minCarpetAreaSqm: number;
  aphNormClause: string;
  requiredEvidenceTypes: Array<'BUILDING_PLAN_APPROVAL' | 'OCCUPANCY_CERTIFICATE' | 'FACILITY_PHOTOGRAPH' | 'BARRIER_FREE_CERT'>;
  isMandatory: boolean;
}

export interface InfrastructureEvaluationItem {
  requirementId: string;
  category: string;
  areaName: string;
  minCarpetAreaSqm: number;
  aphNormClause: string;
  status: 'EVIDENCE_SATISFIED' | 'DEFICIENT_EVIDENCE' | 'REQUIRES_EVC_INSPECTION';
  evidenceFound: string[];
  discrepancyNote?: string;
  inspectionGuidance: string;
}

export interface InfrastructureComplianceReport {
  applicationId: string;
  institutionId: string;
  evaluatedAt: string;
  totalRequirements: number;
  satisfiedCount: number;
  deficientCount: number;
  evcRoutingCount: number;
  complianceRatingPercent: number;
  requiresEvcOnSiteVisit: boolean;
  evcRoutingReason?: string;
  items: InfrastructureEvaluationItem[];
  regulatoryDisclaimer: string;
}

/**
 * AICTE Prescribed Infrastructure Norms (APH Appendix 4 & 5)
 */
export const AICTE_INFRASTRUCTURE_NORMS: InfrastructureItemRequirement[] = [
  // 1. Instructional Area: Classrooms
  {
    id: 'INFRA-INST-001',
    category: 'INSTRUCTIONAL',
    areaName: 'Classrooms (Minimum 66 sq.m each with AV projection facilities)',
    minCarpetAreaSqm: 66,
    aphNormClause: 'Appendix 4 Table 4.1.1',
    requiredEvidenceTypes: ['BUILDING_PLAN_APPROVAL', 'OCCUPANCY_CERTIFICATE'],
    isMandatory: true,
  },
  // 2. Instructional Area: Laboratories & Workshops
  {
    id: 'INFRA-INST-002',
    category: 'INSTRUCTIONAL',
    areaName: 'Laboratories & Engineering Workshops (Minimum 66 to 132 sq.m)',
    minCarpetAreaSqm: 66,
    aphNormClause: 'Appendix 4 Table 4.1.2',
    requiredEvidenceTypes: ['BUILDING_PLAN_APPROVAL'],
    isMandatory: true,
  },
  // 3. Instructional Area: Central Library & Reading Room
  {
    id: 'INFRA-INST-003',
    category: 'INSTRUCTIONAL',
    areaName: 'Central Library & Reading Room (Minimum 400 sq.m with seating for 150+)',
    minCarpetAreaSqm: 400,
    aphNormClause: 'Appendix 4 Table 4.1.3',
    requiredEvidenceTypes: ['BUILDING_PLAN_APPROVAL'],
    isMandatory: true,
  },
  // 4. Instructional Area: Computer Center
  {
    id: 'INFRA-INST-004',
    category: 'INSTRUCTIONAL',
    areaName: 'Computer Center (Minimum 150 sq.m with high-speed LAN/Wi-Fi)',
    minCarpetAreaSqm: 150,
    aphNormClause: 'Appendix 4 Table 4.1.4',
    requiredEvidenceTypes: ['BUILDING_PLAN_APPROVAL'],
    isMandatory: true,
  },
  // 5. Administrative Area: Principal Cabin & Board Room
  {
    id: 'INFRA-ADMIN-005',
    category: 'ADMINISTRATIVE',
    areaName: 'Principal Cabin (30 sq.m) & Board Room (20 sq.m)',
    minCarpetAreaSqm: 50,
    aphNormClause: 'Appendix 4 Table 4.2.1',
    requiredEvidenceTypes: ['BUILDING_PLAN_APPROVAL'],
    isMandatory: true,
  },
  // 6. Amenities: Barrier-free Access & Disabled-friendly Amenities
  {
    id: 'INFRA-AMEN-006',
    category: 'CIRCULATION_SAFETY',
    areaName: 'Barrier-Free Physical Environment (Ramps, Lifts, Accessible Toilets)',
    minCarpetAreaSqm: 30,
    aphNormClause: 'Appendix 4 Table 4.4 & Rights of Persons with Disabilities Act',
    requiredEvidenceTypes: ['BUILDING_PLAN_APPROVAL', 'OCCUPANCY_CERTIFICATE'],
    isMandatory: true,
  },
  // 7. Safety: Dedicated Fire Escape Staircases & Clear Passages
  {
    id: 'INFRA-SAFE-007',
    category: 'CIRCULATION_SAFETY',
    areaName: 'Fire Safety Exits (Minimum 2 wide enclosed staircases per block >= 2.0m)',
    minCarpetAreaSqm: 20,
    aphNormClause: 'National Building Code 2016 Part 4 & APH Appendix 15',
    requiredEvidenceTypes: ['BUILDING_PLAN_APPROVAL', 'OCCUPANCY_CERTIFICATE'],
    isMandatory: true,
  },
];

/**
 * Evaluates an institution's infrastructure docket
 */
export function evaluateInfrastructureCompliance(
  application: Application,
  documents: DocumentRecord[],
  institution: Institution
): InfrastructureComplianceReport {
  const bldgDoc = documents.find(d => d.category === 'BUILDING_PLAN_APPROVAL');
  const fireDoc = documents.find(d => d.category === 'FIRE_SAFETY_CERTIFICATE');
  const rawBldgText = bldgDoc?.extractedData?.rawTextPreview?.toLowerCase() || '';

  const items: InfrastructureEvaluationItem[] = AICTE_INFRASTRUCTURE_NORMS.map(norm => {
    const evidenceFound: string[] = [];

    if (bldgDoc) {
      evidenceFound.push(`Building Plan Approval on record (Ref: ${bldgDoc.extractedData?.referenceNumber || 'Approved Plan'})`);
    }

    if (norm.category === 'CIRCULATION_SAFETY' && fireDoc) {
      evidenceFound.push(`Fire Safety NOC on record (Ref: ${fireDoc.extractedData?.referenceNumber || 'Verified'})`);
    }

    // Keyword detection in extracted blueprints
    let planMentionsArea = false;
    if (norm.id === 'INFRA-INST-001' && (rawBldgText.includes('classroom') || rawBldgText.includes('class room') || rawBldgText.includes('lecture hall'))) {
      planMentionsArea = true;
    } else if (norm.id === 'INFRA-INST-002' && (rawBldgText.includes('lab') || rawBldgText.includes('workshop'))) {
      planMentionsArea = true;
    } else if (norm.id === 'INFRA-INST-003' && (rawBldgText.includes('library') || rawBldgText.includes('reading room'))) {
      planMentionsArea = true;
    } else if (norm.id === 'INFRA-INST-004' && (rawBldgText.includes('computer') || rawBldgText.includes('it lab'))) {
      planMentionsArea = true;
    } else if (norm.id === 'INFRA-AMEN-006' && (rawBldgText.includes('ramp') || rawBldgText.includes('lift') || rawBldgText.includes('disabled'))) {
      planMentionsArea = true;
    }

    if (!bldgDoc) {
      return {
        requirementId: norm.id,
        category: norm.category,
        areaName: norm.areaName,
        minCarpetAreaSqm: norm.minCarpetAreaSqm,
        aphNormClause: norm.aphNormClause,
        status: 'DEFICIENT_EVIDENCE',
        evidenceFound: [],
        discrepancyNote: 'Approved building master plan drawing not provided.',
        inspectionGuidance: 'Require applicant to upload sanctioned floor plans showing dimension schedules.',
      };
    }

    if (planMentionsArea) {
      evidenceFound.push(`Blueprints annotate room schedule for ${norm.areaName.split('(')[0].trim()}`);
      return {
        requirementId: norm.id,
        category: norm.category,
        areaName: norm.areaName,
        minCarpetAreaSqm: norm.minCarpetAreaSqm,
        aphNormClause: norm.aphNormClause,
        status: 'EVIDENCE_SATISFIED',
        evidenceFound,
        inspectionGuidance: 'Documentary evidence satisfactory. EVC committee to spot-check dimensions on-site.',
      };
    }

    // Uncertain or missing explicit carpet area callout
    return {
      requirementId: norm.id,
      category: norm.category,
      areaName: norm.areaName,
      minCarpetAreaSqm: norm.minCarpetAreaSqm,
      aphNormClause: norm.aphNormClause,
      status: 'REQUIRES_EVC_INSPECTION',
      evidenceFound,
      discrepancyNote: `Specific carpet area allocation for ${norm.areaName.split('(')[0].trim()} could not be unambiguously extracted from blueprint schedule.`,
      inspectionGuidance: 'Route to Expert Visiting Committee (EVC) to measure carpet area physically and verify functional equipment.',
    };
  });

  const total = items.length;
  const satisfiedCount = items.filter(i => i.status === 'EVIDENCE_SATISFIED').length;
  const deficientCount = items.filter(i => i.status === 'DEFICIENT_EVIDENCE').length;
  const evcRoutingCount = items.filter(i => i.status === 'REQUIRES_EVC_INSPECTION').length;

  const complianceRatingPercent = Math.round((satisfiedCount / total) * 100);
  const requiresEvcOnSiteVisit = evcRoutingCount > 0 || deficientCount > 0 || application.type === 'NEW_APPLICANT';

  let evcRoutingReason: string | undefined;
  if (application.type === 'NEW_APPLICANT') {
    evcRoutingReason = 'Mandatory physical inspection required for all New Technical Institution applicants as per APH Chapter I Clause 1.8.';
  } else if (evcRoutingCount > 0) {
    evcRoutingReason = `${evcRoutingCount} infrastructure norms require on-site physical measurement to verify statutory carpet area.`;
  }

  return {
    applicationId: application.id,
    institutionId: institution.id,
    evaluatedAt: new Date().toISOString(),
    totalRequirements: total,
    satisfiedCount,
    deficientCount,
    evcRoutingCount,
    complianceRatingPercent,
    requiresEvcOnSiteVisit,
    evcRoutingReason,
    items,
    regulatoryDisclaimer: 'Documentary assistance report only. Physical infrastructure compliance cannot be determined from photographs or scans alone. Final determination rests with the AICTE Expert Visiting Committee (EVC).',
  };
}

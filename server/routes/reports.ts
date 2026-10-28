import { Router } from 'express';
import { dbService } from '../services/dbService.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { generateSafeCsv } from '../../src/utils/security.js';

export const reportsRouter = Router();

// Aggregated statistical report metrics
reportsRouter.get('/summary', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const apps = await dbService.getApplications({}, user);
  const docs = await dbService.getDocuments({}, user);
  const tasks = await dbService.getVerificationTasks(user);

  const byStatus: Record<string, number> = {};
  apps.forEach(a => {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
  });

  const verificationOutcomes = {
    verified: tasks.filter(t => t.status === 'VERIFIED').length,
    pending: tasks.filter(t => t.status === 'PENDING').length,
    discrepancy: tasks.filter(t => t.status === 'DISCREPANCY_FOUND').length,
    unableToVerify: tasks.filter(t => t.status === 'UNABLE_TO_VERIFY').length,
  };

  const documentCategories = {
    landTitle: docs.filter(d => d.category === 'LAND_TITLE_DEED').length,
    fireSafety: docs.filter(d => d.category === 'FIRE_SAFETY_CERTIFICATE').length,
    buildingPlan: docs.filter(d => d.category === 'BUILDING_PLAN_APPROVAL').length,
    others: docs.filter(d => !['LAND_TITLE_DEED', 'FIRE_SAFETY_CERTIFICATE', 'BUILDING_PLAN_APPROVAL'].includes(d.category)).length,
  };

  const totalInstitutions = user.role === 'COLLEGE_MANAGEMENT'
    ? 1
    : (await dbService.getInstitutions({}, user)).length;

  return res.json({
    totalInstitutions,
    totalApplications: apps.length,
    totalDocuments: docs.length,
    byStatus,
    verificationOutcomes,
    documentCategories,
    inspectionStatus: { scheduled: 1, completed: 0 },
    pendingClarifications: 1,
  });
});

// CSV Export endpoint with formula injection protection
reportsRouter.get('/export-csv', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const apps = await dbService.getApplications({}, user);

  const headers = [
    'Application Number',
    'Institution Name',
    'Application Type',
    'Academic Year',
    'Workflow Status',
    'Submission Date',
    'Scrutiny Officer',
    'Verification Officer',
    'Inspection Officer',
    'Created At',
  ];

  const rows = apps.map(a => [
    a.applicationNumber,
    a.institutionName,
    a.type,
    a.academicYear,
    a.status,
    a.submissionDate || 'N/A',
    a.assignedScrutinyOfficerName || 'Unassigned',
    a.assignedVerificationOfficerName || 'Unassigned',
    a.assignedInspectionOfficerName || 'Unassigned',
    a.createdAt,
  ]);

  const safeCsv = generateSafeCsv(headers, rows);

  await dbService.logAudit({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'EXPORT_REPORTS_CSV',
    entityType: 'APPLICATION',
    entityId: 'ALL',
    outcome: 'SUCCESS',
    details: `Exported ${apps.length} applications to CSV with formula injection sanitization.`,
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="AICTE_Applications_Report_${Date.now()}.csv"`);
  return res.send(safeCsv);
});

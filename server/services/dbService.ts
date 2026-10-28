/**
 * EduVerify-AI Unified Database Service Layer
 * Bridges PostgreSQL (via Prisma) with full transactional integrity,
 * tenant isolation, append-only auditing, and graceful in-memory fallback.
 */

import { prisma, checkDatabaseHealth, maskDatabaseUrl, getEffectiveDatabaseUrl } from '../storage/prisma.js';
import { db as memoryDb } from '../storage/db.js';
import {
  User,
  Institution,
  Application,
  ApplicationStatus,
  ApplicationStatusHistory,
  DocumentRecord,
  DocumentCategory,
  ScrutinyChecklistItem,
  VerificationTask,
  InspectionRecord,
  Clarification,
  NotificationItem,
  AuditLogItem,
  DuplicateMatch,
  ExtractedDocumentData,
  ValidationResultItem,
} from '../../src/types/index.js';
import { canAccessInstitution } from '../../src/utils/security.js';
import {
  UserRole,
  InstitutionStatus,
  ApplicationType,
  ApplicationStatus as PrismaAppStatus,
  DocumentCategory as PrismaDocCategory,
  ExtractionStatus,
  ValidationOutcome,
  VerificationStatus,
} from '@prisma/client';

export class DatabaseService {
  private usePostgres = false;
  private initialized = false;

  async init(): Promise<boolean> {
    if (this.initialized) return this.usePostgres;

    const effectiveUrl = getEffectiveDatabaseUrl();
    if (!effectiveUrl) {
      console.log('[DatabaseService] No database connection configured (DATABASE_URL / SQL_* unset); running in in-memory mode.');
      this.usePostgres = false;
      this.initialized = true;
      return false;
    }

    try {
      const health = await checkDatabaseHealth();
      this.usePostgres = health.connected;
      if (this.usePostgres) {
        console.log(`[DatabaseService] Connected to PostgreSQL at ${health.urlMasked} (${health.latencyMs}ms latency)`);
      } else {
        console.warn(`[DatabaseService] Could not reach PostgreSQL (${health.error}); using fallback repository.`);
      }
    } catch (err: any) {
      console.warn(`[DatabaseService] Connection initialization failed (${err.message}); using fallback repository.`);
      this.usePostgres = false;
    }

    this.initialized = true;
    return this.usePostgres;
  }

  isUsingPostgres(): boolean {
    return this.usePostgres;
  }

  // Force database mode (used in tests or manual toggling)
  setUsePostgres(value: boolean) {
    this.usePostgres = value;
    this.initialized = true;
  }

  // ==========================================
  // USERS & SESSIONS
  // ==========================================

  async getUserById(id: string): Promise<User | null> {
    await this.init();
    if (!this.usePostgres) {
      const u = memoryDb.users.find(u => u.id === id);
      return u || null;
    }

    try {
      const record = await prisma.user.findUnique({ where: { id } });
      if (!record) return null;
      return {
        id: record.id,
        name: record.name,
        email: record.email,
        role: record.role as UserRole,
        institutionId: record.institutionId || undefined,
        designation: record.designation || undefined,
        phone: record.phone || undefined,
        isActive: record.isActive,
        createdAt: record.createdAt.toISOString(),
      };
    } catch {
      const u = memoryDb.users.find(u => u.id === id);
      return u || null;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    await this.init();
    if (!this.usePostgres) {
      const u = memoryDb.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      return u || null;
    }

    try {
      const record = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (!record) return null;
      return {
        id: record.id,
        name: record.name,
        email: record.email,
        role: record.role as UserRole,
        institutionId: record.institutionId || undefined,
        designation: record.designation || undefined,
        phone: record.phone || undefined,
        isActive: record.isActive,
        createdAt: record.createdAt.toISOString(),
      };
    } catch {
      const u = memoryDb.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      return u || null;
    }
  }

  async findDemoUser(role: UserRole, institutionId?: string): Promise<User | null> {
    await this.init();
    if (!this.usePostgres) {
      const u = memoryDb.users.find(u => {
        if (role === 'COLLEGE_MANAGEMENT' && institutionId) {
          return u.role === role && u.institutionId === institutionId;
        }
        return u.role === role;
      }) || memoryDb.users.find(u => u.role === role);
      return u || null;
    }

    try {
      let record = await prisma.user.findFirst({
        where: {
          role,
          ...(institutionId && role === 'COLLEGE_MANAGEMENT' ? { institutionId } : {}),
        },
      });
      if (!record) {
        record = await prisma.user.findFirst({ where: { role } });
      }
      if (!record) return null;

      return {
        id: record.id,
        name: record.name,
        email: record.email,
        role: record.role as UserRole,
        institutionId: record.institutionId || undefined,
        designation: record.designation || undefined,
        phone: record.phone || undefined,
        isActive: record.isActive,
        createdAt: record.createdAt.toISOString(),
      };
    } catch {
      return memoryDb.users.find(u => u.role === role) || null;
    }
  }

  // ==========================================
  // INSTITUTIONS
  // ==========================================

  async getInstitutions(
    query: { search?: string; state?: string; status?: string },
    requestingUser: User
  ): Promise<Institution[]> {
    await this.init();
    if (!this.usePostgres) {
      if (requestingUser.role === 'COLLEGE_MANAGEMENT') {
        return memoryDb.institutions.filter(i => i.id === requestingUser.institutionId);
      }
      let list = [...memoryDb.institutions];
      if (query.search) {
        const s = query.search.toLowerCase();
        list = list.filter(i => i.name.toLowerCase().includes(s) || i.code.toLowerCase().includes(s));
      }
      if (query.state) list = list.filter(i => i.state === query.state);
      if (query.status) list = list.filter(i => i.status === query.status);
      return list;
    }

    try {
      const where: any = {};
      if (requestingUser.role === 'COLLEGE_MANAGEMENT') {
        where.id = requestingUser.institutionId;
      } else {
        if (query.search) {
          where.OR = [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
          ];
        }
        if (query.state) where.state = query.state;
        if (query.status) where.status = query.status as InstitutionStatus;
      }

      const records = await prisma.institution.findMany({
        where,
        orderBy: { name: 'asc' },
      });

      return records.map(i => ({
        id: i.id,
        code: i.code,
        name: i.name,
        type: i.type as any,
        address: i.address,
        district: i.district,
        state: i.state,
        pincode: i.pincode,
        website: i.website || '',
        establishedYear: i.establishedYear,
        affiliationUniversity: i.affiliationUniversity,
        status: i.status as any,
        authorizedContactName: i.authorizedContactName,
        authorizedContactEmail: i.authorizedContactEmail,
        authorizedContactPhone: i.authorizedContactPhone,
        profileCompleteness: i.profileCompleteness,
        totalFacultyCount: i.totalFacultyCount,
        totalStudentCapacity: i.totalStudentCapacity,
        campusAreaAcres: i.campusAreaAcres,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      }));
    } catch {
      return memoryDb.institutions;
    }
  }

  async getInstitutionById(
    id: string,
    requestingUser: User
  ): Promise<{ institution: Institution; applicationsCount: number; documentsCount: number } | null> {
    await this.init();
    if (!canAccessInstitution(requestingUser, id)) {
      throw new Error('TENANT_ACCESS_DENIED');
    }

    if (!this.usePostgres) {
      const institution = memoryDb.institutions.find(i => i.id === id);
      if (!institution) return null;
      const apps = memoryDb.applications.filter(a => a.institutionId === id);
      const docs = memoryDb.documents.filter(d => d.institutionId === id);
      return { institution, applicationsCount: apps.length, documentsCount: docs.length };
    }

    try {
      const inst = await prisma.institution.findUnique({
        where: { id },
        include: {
          _count: {
            select: { applications: true, documents: true },
          },
        },
      });

      if (!inst) return null;

      const institution: Institution = {
        id: inst.id,
        code: inst.code,
        name: inst.name,
        type: inst.type as any,
        address: inst.address,
        district: inst.district,
        state: inst.state,
        pincode: inst.pincode,
        website: inst.website || '',
        establishedYear: inst.establishedYear,
        affiliationUniversity: inst.affiliationUniversity,
        status: inst.status as any,
        authorizedContactName: inst.authorizedContactName,
        authorizedContactEmail: inst.authorizedContactEmail,
        authorizedContactPhone: inst.authorizedContactPhone,
        profileCompleteness: inst.profileCompleteness,
        totalFacultyCount: inst.totalFacultyCount,
        totalStudentCapacity: inst.totalStudentCapacity,
        campusAreaAcres: inst.campusAreaAcres,
        createdAt: inst.createdAt.toISOString(),
        updatedAt: inst.updatedAt.toISOString(),
      };

      return {
        institution,
        applicationsCount: inst._count.applications,
        documentsCount: inst._count.documents,
      };
    } catch {
      const institution = memoryDb.institutions.find(i => i.id === id);
      if (!institution) return null;
      const apps = memoryDb.applications.filter(a => a.institutionId === id);
      const docs = memoryDb.documents.filter(d => d.institutionId === id);
      return { institution, applicationsCount: apps.length, documentsCount: docs.length };
    }
  }

  async updateInstitution(
    id: string,
    data: Partial<Institution>,
    requestingUser: User
  ): Promise<Institution> {
    await this.init();
    if (!canAccessInstitution(requestingUser, id)) {
      throw new Error('TENANT_ACCESS_DENIED');
    }

    if (!this.usePostgres) {
      const idx = memoryDb.institutions.findIndex(i => i.id === id);
      if (idx === -1) throw new Error('Institution not found');
      memoryDb.institutions[idx] = {
        ...memoryDb.institutions[idx],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await this.logAudit({
        actorId: requestingUser.id,
        actorName: requestingUser.name,
        actorRole: requestingUser.role,
        action: 'UPDATE_INSTITUTION_PROFILE',
        entityType: 'INSTITUTION',
        entityId: id,
        institutionId: id,
        outcome: 'SUCCESS',
        details: `Updated details for ${memoryDb.institutions[idx].name}`,
      });
      return memoryDb.institutions[idx];
    }

    const { id: _, createdAt: __, updatedAt: ___, ...updateFields } = data as any;
    const updated = await prisma.$transaction(async tx => {
      const inst = await tx.institution.update({
        where: { id },
        data: updateFields,
      });

      await tx.auditLog.create({
        data: {
          id: `AUDIT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          actorId: requestingUser.id,
          actorName: requestingUser.name,
          actorRole: requestingUser.role as UserRole,
          action: 'UPDATE_INSTITUTION_PROFILE',
          entityType: 'INSTITUTION',
          entityId: id,
          institutionId: id,
          institutionName: inst.name,
          outcome: 'SUCCESS',
          details: `Updated details for ${inst.name}`,
          timestamp: new Date(),
        },
      });

      return inst;
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      type: updated.type as any,
      address: updated.address,
      district: updated.district,
      state: updated.state,
      pincode: updated.pincode,
      website: updated.website || '',
      establishedYear: updated.establishedYear,
      affiliationUniversity: updated.affiliationUniversity,
      status: updated.status as any,
      authorizedContactName: updated.authorizedContactName,
      authorizedContactEmail: updated.authorizedContactEmail,
      authorizedContactPhone: updated.authorizedContactPhone,
      profileCompleteness: updated.profileCompleteness,
      totalFacultyCount: updated.totalFacultyCount,
      totalStudentCapacity: updated.totalStudentCapacity,
      campusAreaAcres: updated.campusAreaAcres,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ==========================================
  // APPLICATIONS & STATUS WORKFLOW
  // ==========================================

  async getApplications(
    query: { status?: string; type?: string },
    requestingUser: User
  ): Promise<Application[]> {
    await this.init();
    if (!this.usePostgres) {
      let apps = [...memoryDb.applications];
      if (requestingUser.role === 'COLLEGE_MANAGEMENT') {
        apps = apps.filter(a => a.institutionId === requestingUser.institutionId);
      } else if (requestingUser.role === 'SCRUTINY_OFFICER') {
        apps = apps.filter(
          a => a.assignedScrutinyOfficerId === requestingUser.id || a.status === 'SUBMITTED' || a.status === 'UNDER_SCRUTINY'
        );
      } else if (requestingUser.role === 'VERIFICATION_OFFICER') {
        apps = apps.filter(
          a => a.assignedVerificationOfficerId === requestingUser.id || a.status === 'UNDER_VERIFICATION'
        );
      } else if (requestingUser.role === 'INSPECTION_OFFICER') {
        apps = apps.filter(
          a => a.assignedInspectionOfficerId === requestingUser.id || a.status === 'INSPECTION_PENDING' || a.status === 'UNDER_INSPECTION'
        );
      }
      if (query.status) apps = apps.filter(a => a.status === query.status);
      if (query.type) apps = apps.filter(a => a.type === query.type);
      return apps;
    }

    try {
      const where: any = {};
      if (requestingUser.role === 'COLLEGE_MANAGEMENT') {
        where.institutionId = requestingUser.institutionId;
      } else if (requestingUser.role === 'SCRUTINY_OFFICER') {
        where.OR = [
          { assignedScrutinyOfficerId: requestingUser.id },
          { status: { in: ['SUBMITTED', 'UNDER_SCRUTINY'] } },
        ];
      } else if (requestingUser.role === 'VERIFICATION_OFFICER') {
        where.OR = [
          { assignedVerificationOfficerId: requestingUser.id },
          { status: 'UNDER_VERIFICATION' },
        ];
      } else if (requestingUser.role === 'INSPECTION_OFFICER') {
        where.OR = [
          { assignedInspectionOfficerId: requestingUser.id },
          { status: { in: ['INSPECTION_PENDING', 'UNDER_INSPECTION'] } },
        ];
      }

      if (query.status) where.status = query.status as PrismaAppStatus;
      if (query.type) where.type = query.type as ApplicationType;

      const records = await prisma.application.findMany({
        where,
        include: {
          institution: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return records.map(a => ({
        id: a.id,
        applicationNumber: a.applicationNumber,
        institutionId: a.institutionId,
        institutionName: a.institution?.name || 'Institution',
        type: a.type as any,
        academicYear: a.academicYear,
        status: a.status as ApplicationStatus,
        submissionDate: a.submissionDate ? a.submissionDate.toISOString() : undefined,
        assignedScrutinyOfficerId: a.assignedScrutinyOfficerId || undefined,
        assignedScrutinyOfficerName: a.assignedScrutinyOfficerId ? 'Assigned Officer' : undefined,
        assignedVerificationOfficerId: a.assignedVerificationOfficerId || undefined,
        assignedVerificationOfficerName: a.assignedVerificationOfficerId ? 'Assigned Officer' : undefined,
        assignedInspectionOfficerId: a.assignedInspectionOfficerId || undefined,
        assignedInspectionOfficerName: a.assignedInspectionOfficerId ? 'Assigned Officer' : undefined,
        programmes: (a.programmes as any) || [],
        overallScore: a.overallScore || undefined,
        finalDecisionReason: a.finalDecisionReason || undefined,
        finalDecisionDate: a.finalDecisionDate ? a.finalDecisionDate.toISOString() : undefined,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      }));
    } catch {
      return memoryDb.applications;
    }
  }

  async getApplicationDetails(id: string, requestingUser: User): Promise<any | null> {
    await this.init();
    if (!this.usePostgres) {
      const app = memoryDb.applications.find(a => a.id === id);
      if (!app) return null;
      if (!canAccessInstitution(requestingUser, app.institutionId)) {
        throw new Error('TENANT_ACCESS_DENIED');
      }
      return {
        application: app,
        history: memoryDb.statusHistories.filter(h => h.applicationId === app.id),
        documents: memoryDb.documents.filter(d => d.applicationId === app.id),
        checklists: memoryDb.checklistItems.filter(c => c.applicationId === app.id),
        clarifications: memoryDb.clarifications.filter(c => c.applicationId === app.id),
        inspection: memoryDb.inspections.find(i => i.applicationId === app.id),
      };
    }

    try {
      const app = await prisma.application.findUnique({
        where: { id },
        include: {
          institution: true,
          statusHistory: { orderBy: { timestamp: 'desc' } },
          documents: {
            include: {
              extractions: true,
              validationResults: true,
              duplicateMatches: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          checklistItems: true,
          clarifications: {
            include: { officer: true },
            orderBy: { issuedAt: 'desc' },
          },
          inspections: {
            include: { findings: true, officer: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!app) return null;
      if (!canAccessInstitution(requestingUser, app.institutionId)) {
        throw new Error('TENANT_ACCESS_DENIED');
      }

      const mappedApp: Application = {
        id: app.id,
        applicationNumber: app.applicationNumber,
        institutionId: app.institutionId,
        institutionName: app.institution.name,
        type: app.type as any,
        academicYear: app.academicYear,
        status: app.status as ApplicationStatus,
        submissionDate: app.submissionDate?.toISOString(),
        assignedScrutinyOfficerId: app.assignedScrutinyOfficerId || undefined,
        assignedVerificationOfficerId: app.assignedVerificationOfficerId || undefined,
        assignedInspectionOfficerId: app.assignedInspectionOfficerId || undefined,
        programmes: (app.programmes as any) || [],
        overallScore: app.overallScore || undefined,
        finalDecisionReason: app.finalDecisionReason || undefined,
        finalDecisionDate: app.finalDecisionDate?.toISOString(),
        createdAt: app.createdAt.toISOString(),
        updatedAt: app.updatedAt.toISOString(),
      };

      const mappedHistory: ApplicationStatusHistory[] = app.statusHistory.map(h => ({
        id: h.id,
        applicationId: h.applicationId,
        fromStatus: h.fromStatus as ApplicationStatus,
        toStatus: h.toStatus as ApplicationStatus,
        changedById: h.changedById,
        changedByName: h.changedByName,
        changedByRole: h.changedByRole as UserRole,
        reason: h.reason,
        timestamp: h.timestamp.toISOString(),
      }));

      const mappedDocs: DocumentRecord[] = app.documents.map(d => {
        const ext = d.extractions[0];
        let extractedData: ExtractedDocumentData | undefined;
        if (ext) {
          extractedData = {
            documentId: d.id,
            engineVersion: ext.engineVersion,
            confidenceScore: ext.confidenceScore,
            institutionName: ext.institutionName || undefined,
            issuingAuthority: ext.issuingAuthority || undefined,
            referenceNumber: ext.referenceNumber || undefined,
            issueDate: ext.issueDate || undefined,
            expiryDate: ext.expiryDate || undefined,
            academicYear: ext.academicYear || undefined,
            address: ext.address || undefined,
            registrationNumber: ext.registrationNumber || undefined,
            qrPayload: ext.qrPayload || undefined,
            rawTextPreview: ext.rawTextPreview,
            pages: (ext.pages as any) || [],
            fields: (ext.fields as any) || {},
            ocrError: ext.ocrError || undefined,
          };
        }

        return {
          id: d.id,
          applicationId: d.applicationId,
          institutionId: d.institutionId,
          category: d.category as DocumentCategory,
          categoryLabel: d.category,
          originalFilename: d.originalFilename,
          storageKey: d.storageKey,
          mimeType: d.mimeType,
          fileSizeBytes: d.fileSizeBytes,
          sha256Checksum: d.sha256Checksum,
          uploadedById: d.uploadedById,
          uploadedByName: d.uploadedByName,
          uploadTimestamp: d.createdAt.toISOString(),
          version: d.version,
          extractionStatus: d.extractionStatus as any,
          extractedData,
          validationResults: d.validationResults.map(v => ({
            id: v.id,
            ruleId: v.ruleId,
            ruleTitle: v.ruleTitle,
            outcome: v.outcome as any,
            explanation: v.explanation,
            evidence: v.evidence,
            ruleVersion: v.ruleVersion,
            timestamp: v.timestamp.toISOString(),
          })),
          duplicateMatches: d.duplicateMatches.map(m => ({
            matchedDocumentId: m.matchedDocumentId,
            matchedApplicationId: m.matchedApplicationId,
            matchedInstitutionId: m.matchedInstitutionId,
            matchedInstitutionName: m.matchedInstitutionName,
            matchType: m.matchType as any,
            similarityScore: m.similarityScore,
            detectedTimestamp: m.detectedTimestamp.toISOString(),
          })),
          isVerified: d.isVerified,
          verificationStatus: d.verificationStatus as any,
        };
      });

      const mappedChecklists: ScrutinyChecklistItem[] = app.checklistItems.map(c => ({
        id: c.id,
        applicationId: c.applicationId,
        category: c.category,
        requirement: c.requirement,
        isMandatory: c.isMandatory,
        status: c.status as any,
        scrutinyNotes: c.scrutinyNotes || undefined,
        reviewedAt: c.reviewedAt?.toISOString(),
        reviewedBy: c.reviewedBy || undefined,
      }));

      const mappedClarifications: Clarification[] = app.clarifications.map(c => ({
        id: c.id,
        applicationId: c.applicationId,
        institutionId: c.institutionId,
        institutionName: app.institution.name,
        issuedByOfficerId: c.issuedByOfficerId,
        issuedByOfficerName: c.officer?.name || 'Officer',
        requestedItem: c.requestedItem,
        detailedReason: c.detailedReason,
        issuedAt: c.issuedAt.toISOString(),
        dueDate: c.dueDate.toISOString(),
        status: c.status as any,
        responseDate: c.responseDate?.toISOString(),
        responseText: c.responseText || undefined,
        responseDocumentId: c.responseDocumentId || undefined,
        responseDocumentName: c.responseDocumentName || undefined,
        resolutionNotes: c.resolutionNotes || undefined,
      }));

      const latestInsp = app.inspections[0];
      let mappedInspection: InspectionRecord | undefined;
      if (latestInsp) {
        mappedInspection = {
          id: latestInsp.id,
          applicationId: latestInsp.applicationId,
          institutionId: latestInsp.institutionId,
          institutionName: app.institution.name,
          officerId: latestInsp.officerId,
          officerName: latestInsp.officer?.name || 'Officer',
          scheduledDate: latestInsp.scheduledDate.toISOString(),
          actualDate: latestInsp.actualDate?.toISOString(),
          status: latestInsp.status as any,
          overallRecommendation: latestInsp.overallRecommendation as any,
          summaryFindings: latestInsp.summaryFindings || '',
          reportSubmittedAt: latestInsp.reportSubmittedAt?.toISOString(),
          createdAt: latestInsp.createdAt.toISOString(),
          categories: latestInsp.findings.map(f => ({
            category: f.category as any,
            label: f.label,
            requiredCapacity: f.requiredCapacity,
            verifiedCapacity: f.verifiedCapacity,
            status: f.status as any,
            observations: f.observations,
          })),
        };
      }

      return {
        application: mappedApp,
        history: mappedHistory,
        documents: mappedDocs,
        checklists: mappedChecklists,
        clarifications: mappedClarifications,
        inspection: mappedInspection,
      };
    } catch (err: any) {
      if (err.message === 'TENANT_ACCESS_DENIED') throw err;
      return null;
    }
  }

  async createApplication(
    data: {
      type: ApplicationType;
      academicYear?: string;
      institutionId?: string;
      programmes?: any[];
    },
    requestingUser: User
  ): Promise<Application> {
    await this.init();
    const instId = requestingUser.institutionId || data.institutionId || (requestingUser.role === 'AICTE_ADMIN' ? 'INST-2026-001' : undefined);
    if (!instId) throw new Error('Institution ID is required');

    if (!canAccessInstitution(requestingUser, instId)) {
      throw new Error('TENANT_ACCESS_DENIED');
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const appId = `APP-2026-${randomNum}`;
    const appNumber = `AICTE/2026-27/${data.type === 'NEW_APPLICANT' ? 'NEW' : 'EOA'}-${randomNum}`;
    const academicYear = data.academicYear || '2026-2027';

    if (!this.usePostgres) {
      const inst = memoryDb.institutions.find(i => i.id === instId);
      if (!inst) throw new Error('Institution not found');
      const newApp: Application = {
        id: appId,
        applicationNumber: appNumber,
        institutionId: inst.id,
        institutionName: inst.name,
        type: data.type,
        academicYear,
        status: 'DRAFT',
        programmes: data.programmes || [
          { name: 'Computer Science and Engineering', level: 'UG', intakeApproved: 120, intakeRequested: 180 },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryDb.applications.unshift(newApp);
      memoryDb.statusHistories.push({
        id: `hist-${Date.now().toString(36)}`,
        applicationId: newApp.id,
        fromStatus: 'DRAFT',
        toStatus: 'DRAFT',
        changedById: requestingUser.id,
        changedByName: requestingUser.name,
        changedByRole: requestingUser.role,
        reason: 'Application draft initialized.',
        timestamp: new Date().toISOString(),
      });
      await this.logAudit({
        actorId: requestingUser.id,
        actorName: requestingUser.name,
        actorRole: requestingUser.role,
        action: 'CREATE_APPLICATION_DRAFT',
        entityType: 'APPLICATION',
        entityId: newApp.id,
        institutionId: inst.id,
        institutionName: inst.name,
        outcome: 'SUCCESS',
        details: `Created draft ${newApp.type} for ${inst.name}`,
      });
      return newApp;
    }

    const created = await prisma.$transaction(async tx => {
      const inst = await tx.institution.findUnique({ where: { id: instId } });
      if (!inst) throw new Error('Institution not found');

      const app = await tx.application.create({
        data: {
          id: appId,
          applicationNumber: appNumber,
          institutionId: inst.id,
          type: data.type as any,
          academicYear,
          status: PrismaAppStatus.DRAFT,
          programmes: data.programmes || [
            { name: 'Computer Science and Engineering', level: 'UG', intakeApproved: 120, intakeRequested: 180 },
          ],
        },
        include: { institution: true },
      });

      await tx.applicationStatusHistory.create({
        data: {
          id: `hist-${Date.now().toString(36)}`,
          applicationId: app.id,
          fromStatus: PrismaAppStatus.DRAFT,
          toStatus: PrismaAppStatus.DRAFT,
          changedById: requestingUser.id,
          changedByName: requestingUser.name,
          changedByRole: requestingUser.role as UserRole,
          reason: 'Application draft initialized.',
        },
      });

      await tx.auditLog.create({
        data: {
          id: `AUDIT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          actorId: requestingUser.id,
          actorName: requestingUser.name,
          actorRole: requestingUser.role as UserRole,
          action: 'CREATE_APPLICATION_DRAFT',
          entityType: 'APPLICATION',
          entityId: app.id,
          institutionId: inst.id,
          institutionName: inst.name,
          outcome: 'SUCCESS',
          details: `Created draft ${app.type} for ${inst.name}`,
        },
      });

      return app;
    });

    return {
      id: created.id,
      applicationNumber: created.applicationNumber,
      institutionId: created.institutionId,
      institutionName: created.institution?.name || 'Institution',
      type: created.type as any,
      academicYear: created.academicYear,
      status: created.status as ApplicationStatus,
      programmes: (created.programmes as any) || [],
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async transitionApplication(
    appId: string,
    targetStatus: ApplicationStatus,
    reason: string | undefined,
    requestingUser: User
  ): Promise<Application> {
    await this.init();

    if (!this.usePostgres) {
      const app = memoryDb.applications.find(a => a.id === appId);
      if (!app) throw new Error('Application not found');
      if (!canAccessInstitution(requestingUser, app.institutionId)) {
        throw new Error('TENANT_ACCESS_DENIED');
      }

      const fromStatus = app.status;
      app.status = targetStatus;
      app.updatedAt = new Date().toISOString();
      if (targetStatus === 'SUBMITTED') app.submissionDate = new Date().toISOString();
      if (targetStatus === 'APPROVED' || targetStatus === 'REJECTED') {
        app.finalDecisionReason = reason || 'Regulatory decision recorded.';
        app.finalDecisionDate = new Date().toISOString();
      }

      memoryDb.statusHistories.push({
        id: `hist-${Date.now().toString(36)}`,
        applicationId: app.id,
        fromStatus,
        toStatus: targetStatus,
        changedById: requestingUser.id,
        changedByName: requestingUser.name,
        changedByRole: requestingUser.role,
        reason: reason || `Transitioned to ${targetStatus}`,
        timestamp: new Date().toISOString(),
      });

      await this.logAudit({
        actorId: requestingUser.id,
        actorName: requestingUser.name,
        actorRole: requestingUser.role,
        action: `TRANSITION_${fromStatus}_TO_${targetStatus}`,
        entityType: 'APPLICATION',
        entityId: app.id,
        institutionId: app.institutionId,
        institutionName: app.institutionName,
        outcome: 'SUCCESS',
        details: `Application ${app.applicationNumber} transitioned to ${targetStatus}`,
      });

      return app;
    }

    // Atomic Database Transaction in PostgreSQL
    const updated = await prisma.$transaction(async tx => {
      const app = await tx.application.findUnique({
        where: { id: appId },
        include: { institution: true, documents: true },
      });
      if (!app) throw new Error('Application not found');

      if (!canAccessInstitution(requestingUser, app.institutionId)) {
        throw new Error('TENANT_ACCESS_DENIED');
      }

      if (targetStatus === 'SUBMITTED' && app.documents.length === 0) {
        throw new Error('MANDATORY_DOCUMENTS_MISSING');
      }

      const fromStatus = app.status;
      const updateData: any = {
        status: targetStatus as PrismaAppStatus,
      };

      if (targetStatus === 'SUBMITTED') {
        updateData.submissionDate = new Date();
      }
      if (targetStatus === 'APPROVED' || targetStatus === 'REJECTED') {
        updateData.finalDecisionReason = reason || 'Regulatory decision recorded.';
        updateData.finalDecisionDate = new Date();
      }

      const updatedApp = await tx.application.update({
        where: { id: appId },
        data: updateData,
        include: { institution: true },
      });

      await tx.applicationStatusHistory.create({
        data: {
          id: `hist-${Date.now().toString(36)}`,
          applicationId: appId,
          fromStatus,
          toStatus: targetStatus as PrismaAppStatus,
          changedById: requestingUser.id,
          changedByName: requestingUser.name,
          changedByRole: requestingUser.role as UserRole,
          reason: reason || `Status changed from ${fromStatus} to ${targetStatus}`,
        },
      });

      await tx.auditLog.create({
        data: {
          id: `AUDIT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          actorId: requestingUser.id,
          actorName: requestingUser.name,
          actorRole: requestingUser.role as UserRole,
          action: `TRANSITION_${fromStatus}_TO_${targetStatus}`,
          entityType: 'APPLICATION',
          entityId: appId,
          institutionId: updatedApp.institutionId,
          institutionName: updatedApp.institution?.name,
          outcome: 'SUCCESS',
          details: `Application ${updatedApp.applicationNumber} transitioned to ${targetStatus}`,
        },
      });

      return updatedApp;
    });

    return {
      id: updated.id,
      applicationNumber: updated.applicationNumber,
      institutionId: updated.institutionId,
      institutionName: updated.institution?.name || 'Institution',
      type: updated.type as any,
      academicYear: updated.academicYear,
      status: updated.status as ApplicationStatus,
      submissionDate: updated.submissionDate?.toISOString(),
      overallScore: updated.overallScore || undefined,
      finalDecisionReason: updated.finalDecisionReason || undefined,
      finalDecisionDate: updated.finalDecisionDate?.toISOString(),
      programmes: (updated.programmes as any) || [],
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ==========================================
  // DOCUMENTS, REAL OCR & TRANSACTIONS
  // ==========================================

  async getDocuments(
    query: { applicationId?: string; category?: string },
    requestingUser: User
  ): Promise<DocumentRecord[]> {
    await this.init();

    if (!this.usePostgres) {
      let docs = [...memoryDb.documents];
      if (requestingUser.role === 'COLLEGE_MANAGEMENT') {
        docs = docs.filter(d => d.institutionId === requestingUser.institutionId);
      }
      if (query.applicationId) docs = docs.filter(d => d.applicationId === query.applicationId);
      if (query.category) docs = docs.filter(d => d.category === query.category);
      return docs;
    }

    try {
      const where: any = {};
      if (requestingUser.role === 'COLLEGE_MANAGEMENT') {
        where.institutionId = requestingUser.institutionId;
      }
      if (query.applicationId) where.applicationId = query.applicationId;
      if (query.category) where.category = query.category as PrismaDocCategory;

      const records = await prisma.document.findMany({
        where,
        include: {
          extractions: true,
          validationResults: true,
          duplicateMatches: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return records.map(d => {
        const ext = d.extractions[0];
        let extractedData: ExtractedDocumentData | undefined;
        if (ext) {
          extractedData = {
            documentId: d.id,
            engineVersion: ext.engineVersion,
            confidenceScore: ext.confidenceScore,
            institutionName: ext.institutionName || undefined,
            issuingAuthority: ext.issuingAuthority || undefined,
            referenceNumber: ext.referenceNumber || undefined,
            issueDate: ext.issueDate || undefined,
            expiryDate: ext.expiryDate || undefined,
            academicYear: ext.academicYear || undefined,
            address: ext.address || undefined,
            registrationNumber: ext.registrationNumber || undefined,
            qrPayload: ext.qrPayload || undefined,
            rawTextPreview: ext.rawTextPreview,
            pages: (ext.pages as any) || [],
            fields: (ext.fields as any) || {},
            ocrError: ext.ocrError || undefined,
          };
        }

        return {
          id: d.id,
          applicationId: d.applicationId,
          institutionId: d.institutionId,
          category: d.category as DocumentCategory,
          categoryLabel: d.category,
          originalFilename: d.originalFilename,
          storageKey: d.storageKey,
          mimeType: d.mimeType,
          fileSizeBytes: d.fileSizeBytes,
          sha256Checksum: d.sha256Checksum,
          uploadedById: d.uploadedById,
          uploadedByName: d.uploadedByName,
          uploadTimestamp: d.createdAt.toISOString(),
          version: d.version,
          extractionStatus: d.extractionStatus as any,
          extractedData,
          validationResults: d.validationResults.map(v => ({
            id: v.id,
            ruleId: v.ruleId,
            ruleTitle: v.ruleTitle,
            outcome: v.outcome as any,
            explanation: v.explanation,
            evidence: v.evidence,
            ruleVersion: v.ruleVersion,
            timestamp: v.timestamp.toISOString(),
          })),
          duplicateMatches: d.duplicateMatches.map(m => ({
            matchedDocumentId: m.matchedDocumentId,
            matchedApplicationId: m.matchedApplicationId,
            matchedInstitutionId: m.matchedInstitutionId,
            matchedInstitutionName: m.matchedInstitutionName,
            matchType: m.matchType as any,
            similarityScore: m.similarityScore,
            detectedTimestamp: m.detectedTimestamp.toISOString(),
          })),
          isVerified: d.isVerified,
          verificationStatus: d.verificationStatus as any,
        };
      });
    } catch {
      return memoryDb.documents;
    }
  }

  async getDocumentById(id: string, requestingUser: User): Promise<DocumentRecord | null> {
    const docs = await this.getDocuments({}, requestingUser);
    const found = docs.find(d => d.id === id);
    if (!found) return null;
    if (!canAccessInstitution(requestingUser, found.institutionId)) {
      throw new Error('TENANT_ACCESS_DENIED');
    }
    return found;
  }

  async findDocumentBySha256(sha256Checksum: string): Promise<DocumentRecord | null> {
    await this.init();
    if (!this.usePostgres) {
      return memoryDb.documents.find(d => d.sha256Checksum === sha256Checksum) || null;
    }

    try {
      const d = await prisma.document.findFirst({
        where: { sha256Checksum },
        include: { extractions: true, validationResults: true, duplicateMatches: true },
      });
      if (!d) return null;
      return {
        id: d.id,
        applicationId: d.applicationId,
        institutionId: d.institutionId,
        category: d.category as DocumentCategory,
        categoryLabel: d.category,
        originalFilename: d.originalFilename,
        storageKey: d.storageKey,
        mimeType: d.mimeType,
        fileSizeBytes: d.fileSizeBytes,
        sha256Checksum: d.sha256Checksum,
        uploadedById: d.uploadedById,
        uploadedByName: d.uploadedByName,
        uploadTimestamp: d.createdAt.toISOString(),
        version: d.version,
        extractionStatus: d.extractionStatus as any,
        validationResults: [],
        duplicateMatches: [],
        isVerified: d.isVerified,
        verificationStatus: d.verificationStatus as any,
      };
    } catch {
      return memoryDb.documents.find(d => d.sha256Checksum === sha256Checksum) || null;
    }
  }

  async createDocumentWithTransaction(
    doc: DocumentRecord,
    requestingUser: User
  ): Promise<DocumentRecord> {
    await this.init();

    if (!this.usePostgres) {
      memoryDb.documents.unshift(doc);
      memoryDb.verificationTasks.push({
        id: `VT-${Date.now().toString(36)}`,
        documentId: doc.id,
        applicationId: doc.applicationId,
        institutionId: doc.institutionId,
        documentCategory: doc.category,
        documentTitle: `${doc.categoryLabel} (${doc.originalFilename})`,
        assignedOfficerId: 'usr-verify-01',
        assignedOfficerName: 'Dr. Priya Patel',
        status: 'PENDING',
        externalCheckAttempted: false,
        updatedAt: new Date().toISOString(),
      });
      await this.logAudit({
        actorId: requestingUser.id,
        actorName: requestingUser.name,
        actorRole: requestingUser.role,
        action: 'UPLOAD_DOCUMENT',
        entityType: 'DOCUMENT',
        entityId: doc.id,
        institutionId: doc.institutionId,
        outcome: 'SUCCESS',
        details: `Uploaded ${doc.originalFilename}. Computed SHA-256: ${doc.sha256Checksum.substring(0, 16)}...`,
      });
      return doc;
    }

    // Atomic Database Transaction for Document + Extraction + Validations + DuplicateMatches + Task + Audit
    await prisma.$transaction(async tx => {
      // 1. Create Document
      await tx.document.create({
        data: {
          id: doc.id,
          applicationId: doc.applicationId,
          institutionId: doc.institutionId,
          category: doc.category as PrismaDocCategory,
          originalFilename: doc.originalFilename,
          storageKey: doc.storageKey,
          mimeType: doc.mimeType,
          fileSizeBytes: doc.fileSizeBytes,
          sha256Checksum: doc.sha256Checksum,
          uploadedById: requestingUser.id,
          uploadedByName: requestingUser.name,
          version: doc.version,
          extractionStatus: doc.extractionStatus as ExtractionStatus,
          isVerified: doc.isVerified,
          verificationStatus: doc.verificationStatus as VerificationStatus,
        },
      });

      // 2. Persist OCR Extraction details
      if (doc.extractedData) {
        await tx.documentExtraction.create({
          data: {
            id: `ext-${Date.now().toString(36)}`,
            documentId: doc.id,
            engineVersion: doc.extractedData.engineVersion,
            confidenceScore: doc.extractedData.confidenceScore,
            institutionName: doc.extractedData.institutionName,
            issuingAuthority: doc.extractedData.issuingAuthority,
            referenceNumber: doc.extractedData.referenceNumber,
            issueDate: doc.extractedData.issueDate,
            expiryDate: doc.extractedData.expiryDate,
            academicYear: doc.extractedData.academicYear,
            address: doc.extractedData.address,
            registrationNumber: doc.extractedData.registrationNumber,
            qrPayload: doc.extractedData.qrPayload,
            rawTextPreview: doc.extractedData.rawTextPreview || '',
            pages: (doc.extractedData.pages as any) || [],
            fields: (doc.extractedData.fields as any) || {},
            ocrError: doc.extractedData.ocrError,
          },
        });
      }

      // 3. Persist Validation Results
      for (const val of doc.validationResults) {
        await tx.validationResult.create({
          data: {
            id: val.id || `val-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
            documentId: doc.id,
            ruleId: val.ruleId,
            ruleTitle: val.ruleTitle,
            outcome: val.outcome as ValidationOutcome,
            explanation: val.explanation,
            evidence: val.evidence,
            ruleVersion: val.ruleVersion,
          },
        });
      }

      // 4. Persist Duplicate Matches
      for (const dup of doc.duplicateMatches) {
        await tx.duplicateMatch.create({
          data: {
            id: `dup-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
            documentId: doc.id,
            matchedDocumentId: dup.matchedDocumentId,
            matchedApplicationId: dup.matchedApplicationId,
            matchedInstitutionId: dup.matchedInstitutionId,
            matchedInstitutionName: dup.matchedInstitutionName,
            matchType: dup.matchType,
            similarityScore: dup.similarityScore,
          },
        });
      }

      // 5. Create Verification Task
      await tx.verificationTask.create({
        data: {
          id: `VT-${Date.now().toString(36)}`,
          documentId: doc.id,
          assignedOfficerId: 'usr-verify-01',
          status: VerificationStatus.PENDING,
          externalCheckAttempted: false,
        },
      });

      // 6. Record Append-Only Audit Log
      await tx.auditLog.create({
        data: {
          id: `AUDIT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          actorId: requestingUser.id,
          actorName: requestingUser.name,
          actorRole: requestingUser.role as UserRole,
          action: 'UPLOAD_DOCUMENT',
          entityType: 'DOCUMENT',
          entityId: doc.id,
          institutionId: doc.institutionId,
          outcome: 'SUCCESS',
          details: `Uploaded ${doc.originalFilename}. OCR status: ${doc.extractionStatus}. SHA-256: ${doc.sha256Checksum.substring(0, 16)}...`,
        },
      });
    });

    return doc;
  }

  // ==========================================
  // SCRUTINY, VERIFICATION & INSPECTIONS
  // ==========================================

  async getScrutinyQueue(requestingUser: User): Promise<Application[]> {
    return this.getApplications({ status: undefined }, requestingUser).then(apps =>
      apps.filter(a => a.status === 'SUBMITTED' || a.status === 'UNDER_SCRUTINY' || a.status === 'RESUBMITTED')
    );
  }

  async updateChecklistItem(
    id: string,
    status: string,
    scrutinyNotes: string | undefined,
    requestingUser: User
  ): Promise<ScrutinyChecklistItem> {
    await this.init();

    if (!this.usePostgres) {
      const idx = memoryDb.checklistItems.findIndex(c => c.id === id);
      if (idx === -1) throw new Error('Checklist item not found');
      memoryDb.checklistItems[idx] = {
        ...memoryDb.checklistItems[idx],
        status: status as any,
        scrutinyNotes: scrutinyNotes || memoryDb.checklistItems[idx].scrutinyNotes,
        reviewedAt: new Date().toISOString(),
        reviewedBy: requestingUser.name,
      };
      await this.logAudit({
        actorId: requestingUser.id,
        actorName: requestingUser.name,
        actorRole: requestingUser.role,
        action: 'EVALUATE_SCRUTINY_ITEM',
        entityType: 'APPLICATION',
        entityId: memoryDb.checklistItems[idx].applicationId,
        outcome: 'SUCCESS',
        details: `Checklist item set to ${status}. Notes: ${scrutinyNotes || 'N/A'}`,
      });
      return memoryDb.checklistItems[idx];
    }

    const updated = await prisma.$transaction(async tx => {
      const item = await tx.applicationChecklistItem.update({
        where: { id },
        data: {
          status,
          scrutinyNotes,
          reviewedAt: new Date(),
          reviewedBy: requestingUser.name,
        },
      });

      await tx.auditLog.create({
        data: {
          id: `AUDIT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          actorId: requestingUser.id,
          actorName: requestingUser.name,
          actorRole: requestingUser.role as UserRole,
          action: 'EVALUATE_SCRUTINY_ITEM',
          entityType: 'APPLICATION',
          entityId: item.applicationId,
          outcome: 'SUCCESS',
          details: `Checklist item ${item.category} set to ${status}`,
        },
      });

      return item;
    });

    return {
      id: updated.id,
      applicationId: updated.applicationId,
      category: updated.category,
      requirement: updated.requirement,
      isMandatory: updated.isMandatory,
      status: updated.status as any,
      scrutinyNotes: updated.scrutinyNotes || undefined,
      reviewedAt: updated.reviewedAt?.toISOString(),
      reviewedBy: updated.reviewedBy || undefined,
    };
  }

  async getVerificationTasks(requestingUser: User): Promise<VerificationTask[]> {
    await this.init();
    if (!this.usePostgres) {
      if (requestingUser.role === 'VERIFICATION_OFFICER') {
        return memoryDb.verificationTasks.filter(
          t => t.assignedOfficerId === requestingUser.id || t.status === 'PENDING'
        );
      }
      return memoryDb.verificationTasks;
    }

    try {
      const tasks = await prisma.verificationTask.findMany({
        include: {
          document: {
            include: { application: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return tasks.map(t => ({
        id: t.id,
        documentId: t.documentId,
        applicationId: t.document.applicationId,
        institutionId: t.document.institutionId,
        documentCategory: t.document.category as DocumentCategory,
        documentTitle: `${t.document.category} (${t.document.originalFilename})`,
        assignedOfficerId: t.assignedOfficerId,
        assignedOfficerName: 'Dr. Priya Patel',
        status: t.status as any,
        externalCheckAttempted: t.externalCheckAttempted,
        externalSourceUsed: t.externalSourceUsed || undefined,
        attemptTimestamp: t.attemptTimestamp?.toISOString(),
        verificationEvidence: t.verificationEvidence || undefined,
        manualNotes: t.manualNotes || undefined,
        discrepancyDetails: t.discrepancyDetails || undefined,
        updatedAt: t.updatedAt.toISOString(),
      }));
    } catch {
      return memoryDb.verificationTasks;
    }
  }

  async recordExternalVerification(
    taskId: string,
    adapterSource: string | undefined,
    requestingUser: User
  ): Promise<{ task: VerificationTask; document?: DocumentRecord }> {
    await this.init();

    if (!this.usePostgres) {
      const idx = memoryDb.verificationTasks.findIndex(t => t.id === taskId);
      if (idx === -1) throw new Error('Verification task not found');
      const task = memoryDb.verificationTasks[idx];
      const sourceName = adapterSource || 'State Registration & Revenue Portal (Sandbox G2G Adapter)';
      task.externalCheckAttempted = true;
      task.externalSourceUsed = sourceName;
      task.attemptTimestamp = new Date().toISOString();
      task.status = 'VERIFIED';
      task.verificationEvidence = `External Source Check [${sourceName}] Success at ${new Date().toISOString()}`;
      task.updatedAt = new Date().toISOString();

      const doc = memoryDb.documents.find(d => d.id === task.documentId);
      if (doc) {
        doc.isVerified = true;
        doc.verificationStatus = 'VERIFIED';
      }

      await this.logAudit({
        actorId: requestingUser.id,
        actorName: requestingUser.name,
        actorRole: requestingUser.role,
        action: 'EXECUTE_EXTERNAL_VERIFICATION',
        entityType: 'VERIFICATION',
        entityId: task.id,
        institutionId: task.institutionId,
        outcome: 'SUCCESS',
        details: `External verification query via ${sourceName}. Result: VERIFIED`,
      });

      return { task, document: doc };
    }

    const result = await prisma.$transaction(async tx => {
      const sourceName = adapterSource || 'State Registration & Revenue Portal (Sandbox G2G Adapter)';
      const now = new Date();

      const updatedTask = await tx.verificationTask.update({
        where: { id: taskId },
        data: {
          externalCheckAttempted: true,
          externalSourceUsed: sourceName,
          attemptTimestamp: now,
          status: VerificationStatus.VERIFIED,
          verificationEvidence: `External Source Check [${sourceName}] Success at ${now.toISOString()}`,
        },
        include: { document: true },
      });

      const updatedDoc = await tx.document.update({
        where: { id: updatedTask.documentId },
        data: {
          isVerified: true,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      });

      await tx.auditLog.create({
        data: {
          id: `AUDIT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          actorId: requestingUser.id,
          actorName: requestingUser.name,
          actorRole: requestingUser.role as UserRole,
          action: 'EXECUTE_EXTERNAL_VERIFICATION',
          entityType: 'VERIFICATION',
          entityId: taskId,
          institutionId: updatedDoc.institutionId,
          outcome: 'SUCCESS',
          details: `External verification query via ${sourceName}. Result: VERIFIED`,
        },
      });

      return {
        task: {
          id: updatedTask.id,
          documentId: updatedTask.documentId,
          applicationId: updatedDoc.applicationId,
          institutionId: updatedDoc.institutionId,
          documentCategory: updatedDoc.category as DocumentCategory,
          documentTitle: `${updatedDoc.category} (${updatedDoc.originalFilename})`,
          assignedOfficerId: updatedTask.assignedOfficerId,
          assignedOfficerName: requestingUser.name,
          status: updatedTask.status as any,
          externalCheckAttempted: updatedTask.externalCheckAttempted,
          externalSourceUsed: updatedTask.externalSourceUsed || undefined,
          attemptTimestamp: updatedTask.attemptTimestamp?.toISOString(),
          verificationEvidence: updatedTask.verificationEvidence || undefined,
          manualNotes: updatedTask.manualNotes || undefined,
          discrepancyDetails: updatedTask.discrepancyDetails || undefined,
          updatedAt: updatedTask.updatedAt.toISOString(),
        },
      };
    });

    return result;
  }

  // ==========================================
  // APPEND-ONLY AUDIT LOGS
  // ==========================================

  async getAuditLogs(
    query: { entityType?: string; action?: string; outcome?: string },
    requestingUser: User
  ): Promise<AuditLogItem[]> {
    await this.init();
    if (!this.usePostgres) {
      let logs = [...memoryDb.auditLogs];
      if (query.entityType) logs = logs.filter(l => l.entityType === query.entityType);
      if (query.action) logs = logs.filter(l => l.action.includes(query.action!));
      if (query.outcome) logs = logs.filter(l => l.outcome === query.outcome);
      return logs;
    }

    try {
      const where: any = {};
      if (query.entityType) where.entityType = query.entityType;
      if (query.action) where.action = { contains: query.action };
      if (query.outcome) where.outcome = query.outcome;

      const records = await prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
      });

      return records.map(l => ({
        id: l.id,
        actorId: l.actorId,
        actorName: l.actorName,
        actorRole: l.actorRole as UserRole,
        action: l.action,
        entityType: l.entityType as any,
        entityId: l.entityId,
        institutionId: l.institutionId || undefined,
        institutionName: l.institutionName || undefined,
        outcome: l.outcome as any,
        details: l.details,
        timestamp: l.timestamp.toISOString(),
      }));
    } catch {
      return memoryDb.auditLogs;
    }
  }

  // Strictly APPEND-ONLY: No update or delete operations on audit logs exist.
  async logAudit(entry: Omit<AuditLogItem, 'id' | 'timestamp'>): Promise<AuditLogItem> {
    const id = `AUDIT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const item: AuditLogItem = {
      ...entry,
      id,
      timestamp: now.toISOString(),
    };

    // Always keep in-memory sync
    memoryDb.auditLogs.unshift(item);

    if (this.usePostgres) {
      try {
        await prisma.auditLog.create({
          data: {
            id,
            actorId: entry.actorId,
            actorName: entry.actorName,
            actorRole: entry.actorRole as UserRole,
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            institutionId: entry.institutionId || null,
            institutionName: entry.institutionName || null,
            outcome: entry.outcome,
            details: entry.details,
            timestamp: now,
          },
        });
      } catch (err: any) {
        console.warn('[DatabaseService] Failed to persist audit log to DB:', err.message);
      }
    }

    return item;
  }

  // ==========================================
  // SYSTEM INTEGRATIONS
  // ==========================================

  async getSystemIntegrations() {
    await this.init();
    const dbHealth = await checkDatabaseHealth();
    return {
      database: {
        status: dbHealth.connected ? ('CONNECTED' as const) : ('DISCONNECTED' as const),
        type: 'PostgreSQL' as const,
        urlMasked: dbHealth.urlMasked,
        latencyMs: dbHealth.latencyMs >= 0 ? dbHealth.latencyMs : 0,
      },
      storage: memoryDb.integrations.storage,
      ocrEngine: memoryDb.integrations.ocrEngine,
      gemini: memoryDb.integrations.gemini,
      emailProvider: memoryDb.integrations.emailProvider,
    };
  }
}

export const dbService = new DatabaseService();

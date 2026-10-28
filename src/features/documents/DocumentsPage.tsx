import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { DocumentRecord, DocumentCategory } from '../../types/index.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Modal } from '../../components/common/Modal.js';
import { computeSHA256 } from '../../utils/security.js';
import {
  FileCheck2,
  UploadCloud,
  FileText,
  Search,
  AlertTriangle,
  Download,
  Eye,
  CheckCircle2,
  ShieldCheck,
  Cpu,
  Layers,
  Copy,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  Check,
} from 'lucide-react';

const CATEGORIES: Array<{ key: DocumentCategory; label: string }> = [
  { key: 'LAND_TITLE_DEED', label: 'Land Title & Possession Deed' },
  { key: 'BUILDING_PLAN_APPROVAL', label: 'Municipal Approved Building Plan & Occupancy' },
  { key: 'FIRE_SAFETY_CERTIFICATE', label: 'Fire & Rescue Safety NOC' },
  { key: 'AFFILIATION_ORDER', label: 'University Affiliation Order' },
  { key: 'FACULTY_LIST_RATIFICATION', label: 'Sanctioned Faculty Cadre List' },
  { key: 'FINANCIAL_AUDIT_REPORT', label: 'Annual Audited Financial Statements' },
  { key: 'POLLUTION_CLEARANCE', label: 'State Pollution Control Board Consent' },
];

export const DocumentsPage: React.FC = () => {
  const { role, user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRetryingOcr, setIsRetryingOcr] = useState(false);
  const [showFullRawText, setShowFullRawText] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadAppId, setUploadAppId] = useState('');
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('LAND_TITLE_DEED');
  const [uploadFilename, setUploadFilename] = useState('');
  const [fileContentBase64, setFileContentBase64] = useState<string | undefined>(undefined);
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(0);
  const [computedSha256Preview, setComputedSha256Preview] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const [docRes, appRes] = await Promise.all([api.getDocuments(), api.getApplications()]);
      setDocuments(docRes.documents);
      setApplications(appRes.applications);
      if (appRes.applications.length > 0 && !uploadAppId) {
        setUploadAppId(appRes.applications[0].id);
      }
      if (docRes.documents.length > 0 && !selectedDoc) {
        setSelectedDoc(docRes.documents[0]);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryOcr = async (docId: string) => {
    try {
      setIsRetryingOcr(true);
      const res = await api.retryDocumentOcr(docId);
      setSelectedDoc(res.document);
      setDocuments(prev => prev.map(d => (d.id === docId ? res.document : d)));
    } catch (err: any) {
      alert(`OCR Retry Failed: ${err.message}`);
    } finally {
      setIsRetryingOcr(false);
    }
  };

  const handleCopyText = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDownloadDoc = async (docId: string, filename: string) => {
    try {
      const res = await api.getDocumentDownloadUrl(docId);
      const blob = new Blob([`Regulatory Document Evidence: ${filename}\nSHA-256: ${res.sha256}\nSigned Storage Access: ${res.downloadUrl}`], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [role, user]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFilename(file.name);
    setFileSizeBytes(file.size);

    const reader = new FileReader();
    reader.onload = async () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const uint8 = new Uint8Array(arrayBuffer);
      const hash = await computeSHA256(uint8);
      setComputedSha256Preview(hash);

      // Base64 encode for mock storage transfer
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      const len = Math.min(bytes.byteLength, 1024 * 1024); // max 1MB for preview
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      setFileContentBase64(btoa(binary));
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUploadSubmit = async () => {
    if (!uploadAppId || !uploadCategory || !uploadFilename) {
      alert('Please select an application, category, and choose a document file.');
      return;
    }

    try {
      setIsUploading(true);
      const res = await api.uploadDocument({
        applicationId: uploadAppId,
        category: uploadCategory,
        filename: uploadFilename,
        fileContentBase64,
        sizeBytes: fileSizeBytes || 512000,
      });

      setIsUploadOpen(false);
      setUploadFilename('');
      setComputedSha256Preview('');
      setFileContentBase64(undefined);
      await fetchDocuments();
      setSelectedDoc(res.document);
    } catch (err: any) {
      alert(`Upload Failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredDocs = documents.filter(d => {
    const matchesSearch =
      d.originalFilename.toLowerCase().includes(search.toLowerCase()) ||
      d.categoryLabel.toLowerCase().includes(search.toLowerCase()) ||
      d.sha256Checksum.toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCategory ? d.category === filterCategory : true;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="p-5 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Banner */}
      <div className="bg-white rounded-lg p-5 border border-[#D9E7E4] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#0D9488] uppercase tracking-wide">
              Regulatory Document Vault & OCR
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-[#DCFCE7]/80 text-[#15803D] font-medium border border-[#86EFAC]/80">
              SHA-256 Validated
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#193A39] mt-1 tracking-tight">Evidence & Verification Vault</h1>
          <p className="text-xs text-[#647A78] mt-0.5 leading-normal">
            Tamper-evident document repository with automated optical extraction, duplicate detection, and rule evaluation.
          </p>
        </div>

        {(role === 'COLLEGE_MANAGEMENT' || role === 'AICTE_ADMIN') && (
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#115E59] hover:bg-[#0F766E] rounded-md transition-colors shadow-2xs flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Regulatory Certificate</span>
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#647A78]" />
          <input
            type="text"
            placeholder="Search by filename, category label, or SHA-256 hash..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-white border border-[#D9E7E4] rounded-md text-xs text-[#193A39] placeholder-[#647A78] focus:outline-hidden focus:border-[#0D9488]"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="bg-white border border-[#D9E7E4] px-3 py-1.5 rounded-md text-xs text-[#193A39] focus:outline-hidden focus:border-[#0D9488]"
        >
          <option value="">All Document Categories</option>
          {CATEGORIES.map(c => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Grid: Document List on Left, Extraction & Validation Inspector on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Documents Master List */}
        <div className="space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#647A78]">Documents Repository</h2>
          {filteredDocs.map(doc => {
            const isSelected = selectedDoc?.id === doc.id;
            const hasDuplicate = doc.duplicateMatches && doc.duplicateMatches.length > 0;
            return (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer bg-white ${
                  isSelected
                    ? 'border-[#115E59] shadow-2xs ring-1 ring-[#115E59]/20'
                    : 'border-[#D9E7E4] hover:border-[#0D9488]/60 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-xs text-[#193A39] line-clamp-1">{doc.categoryLabel}</span>
                  <StatusBadge status={doc.verificationStatus} />
                </div>
                <div className="mt-1 text-[11px] text-[#647A78] truncate">{doc.originalFilename}</div>
                <div className="mt-2 pt-2 border-t border-[#F3F8F7] flex items-center justify-between text-[10px] text-[#647A78]">
                  <span className="font-mono text-[#115E59]">{doc.sha256Checksum.substring(0, 12)}...</span>
                  <span>{(doc.fileSizeBytes / 1024).toFixed(0)} KB</span>
                </div>
                {hasDuplicate && (
                  <div className="mt-2 text-[10px] font-medium text-[#B91C1C] flex items-center gap-1 bg-[#FEE2E2] px-2 py-0.5 rounded border border-[#FCA5A5]/80">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Cross-Institution Match Found!</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Column: Deep OCR Extractions & Rule Validation Engine */}
        <div className="lg:col-span-2 space-y-5">
          {selectedDoc ? (
            <div className="bg-white rounded-lg border border-[#D9E7E4] shadow-2xs overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-[#D9E7E4] bg-[#F3F8F7]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#115E59] bg-white px-2 py-0.5 rounded border border-[#D9E7E4]">
                      {selectedDoc.id}
                    </span>
                    <StatusBadge status={selectedDoc.extractionStatus} />
                    <StatusBadge status={selectedDoc.verificationStatus} />
                  </div>
                  <h2 className="text-base font-bold text-[#193A39] mt-2">{selectedDoc.categoryLabel}</h2>
                  <p className="text-xs text-[#647A78] font-mono mt-0.5">
                    Storage Key: {selectedDoc.storageKey}
                  </p>
                </div>

                <div className="flex flex-col sm:items-end gap-2">
                  <div className="text-right">
                    <div className="text-[10px] text-[#647A78] uppercase font-semibold">Uploaded By</div>
                    <div className="text-xs font-semibold text-[#193A39]">{selectedDoc.uploadedByName}</div>
                    <div className="text-[10px] text-[#647A78] mt-0.5">
                      {new Date(selectedDoc.uploadTimestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadDoc(selectedDoc.id, selectedDoc.originalFilename)}
                    className="px-2.5 py-1 text-xs font-medium text-[#115E59] bg-white hover:bg-[#F3F8F7] border border-[#D9E7E4] rounded-md transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer self-start sm:self-auto"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Evidence</span>
                  </button>
                </div>
              </div>

              {/* SHA-256 Cryptographic Seal Bar */}
              <div className="px-6 py-3 bg-[#F3F8F7] border-b border-[#D9E7E4] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#15803D]" />
                  <span className="text-[#647A78] font-semibold">Cryptographic SHA-256 Seal:</span>
                  <span className="font-mono text-[#115E59] font-bold select-all break-all text-[11px]">
                    {selectedDoc.sha256Checksum}
                  </span>
                </div>
              </div>

              {/* OCR Extracted Metadata Section */}
              <div className="p-6 border-b border-[#D9E7E4]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#115E59]" />
                    <h3 className="text-xs font-bold text-[#193A39] uppercase tracking-wider">
                      OCR Extracted Statutory Fields & Intelligence
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#0D9488] bg-[#F3F8F7] px-2.5 py-0.5 rounded border border-[#D9E7E4]">
                      {selectedDoc.extractedData?.engineVersion || 'PyMuPDF-v1.24+Tesseract-v5.3'}
                    </span>
                    <button
                      onClick={() => handleRetryOcr(selectedDoc.id)}
                      disabled={isRetryingOcr}
                      title="Re-run real PyMuPDF + Tesseract OCR extraction"
                      className="px-2.5 py-1 text-xs font-medium text-[#115E59] bg-[#E6F4F2] hover:bg-[#D1EBE7] border border-[#B2DFDB] rounded-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRetryingOcr ? 'animate-spin' : ''}`} />
                      <span>{isRetryingOcr ? 'Running OCR...' : 'Retry OCR'}</span>
                    </button>
                  </div>
                </div>

                {/* Error Banner if OCR Failed */}
                {(selectedDoc.extractionStatus === 'FAILED' || selectedDoc.extractedData?.ocrError) && (
                  <div className="mb-4 p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs text-[#991B1B]">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                      <span>Optical Extraction Failure</span>
                    </div>
                    <p className="text-[11px] text-[#B91C1C] leading-relaxed">
                      {selectedDoc.extractedData?.ocrError || 'Document OCR engine was unable to extract legible text from this file.'}
                    </p>
                    <div className="mt-2 text-[10px] text-[#7F1D1D]">
                      Ensure the file is an unencrypted PDF or supported high-contrast image (PNG/JPEG). Click &quot;Retry OCR&quot; above to reprocess.
                    </div>
                  </div>
                )}

                {/* Review Notice if Needs Review */}
                {selectedDoc.extractionStatus === 'NEEDS_REVIEW' && !selectedDoc.extractedData?.ocrError && (
                  <div className="mb-4 p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-xs text-[#92400E] flex items-center gap-2">
                    <FileQuestion className="w-4 h-4 text-[#D97706] flex-shrink-0" />
                    <span>
                      Automated extraction parsed document text, but one or more mandatory statutory identifiers require scrutiny officer review.
                    </span>
                  </div>
                )}

                {selectedDoc.extractedData ? (
                  <div className="space-y-4">
                    {/* Top KPI row for OCR */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-[#F3F8F7]/50 rounded-lg border border-[#D9E7E4]">
                        <span className="text-[10px] text-[#647A78] uppercase font-bold block">Engine Confidence</span>
                        <span className="text-base font-bold text-[#115E59]">
                          {selectedDoc.extractedData.confidenceScore != null
                            ? `${selectedDoc.extractedData.confidenceScore}%`
                            : 'Digital Vector (N/A)'}
                        </span>
                        <span className="text-[10px] text-[#647A78] block mt-0.5">
                          {selectedDoc.extractedData.confidenceScore != null ? 'Tesseract OCR word mean' : 'PyMuPDF digital stream'}
                        </span>
                      </div>

                      <div className="p-3 bg-[#F3F8F7]/50 rounded-lg border border-[#D9E7E4]">
                        <span className="text-[10px] text-[#647A78] uppercase font-bold block">Recognized Pages</span>
                        <span className="text-base font-bold text-[#193A39]">
                          {selectedDoc.extractedData.pageCount || selectedDoc.extractedData.pages?.length || 1} Page(s)
                        </span>
                        <span className="text-[10px] text-[#647A78] block mt-0.5">
                          {selectedDoc.mimeType === 'application/pdf' ? 'PDF Document' : 'Raster Image File'}
                        </span>
                      </div>

                      <div className="p-3 bg-[#F3F8F7]/50 rounded-lg border border-[#D9E7E4]">
                        <span className="text-[10px] text-[#647A78] uppercase font-bold block">Extraction Status</span>
                        <div className="mt-1">
                          <StatusBadge status={selectedDoc.extractionStatus} />
                        </div>
                      </div>
                    </div>

                    {/* Multi-page breakdown if applicable */}
                    {selectedDoc.extractedData.pages && selectedDoc.extractedData.pages.length > 1 && (
                      <div className="p-3 bg-white rounded-lg border border-[#D9E7E4] text-xs">
                        <span className="text-[10px] text-[#647A78] uppercase font-bold block mb-1.5">
                          Multi-Page Processing Breakdown
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {selectedDoc.extractedData.pages.map(p => (
                            <div
                              key={p.pageNumber || p.page_number}
                              className="px-2.5 py-1 bg-[#F3F8F7] border border-[#D9E7E4] rounded text-[11px] flex items-center gap-2"
                            >
                              <span className="font-bold text-[#115E59]">Page {p.pageNumber || p.page_number}:</span>
                              <span className="text-[#647A78]">{p.charCount || p.char_count || 0} chars</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white rounded border border-[#D9E7E4] text-[#0D9488]">
                                {p.extractionMethod || p.extraction_method || 'OCR'}
                              </span>
                              {p.confidence != null && (
                                <span className="text-[10px] font-semibold text-[#15803D]">
                                  {p.confidence}%
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Structured Statutory Extracted Fields List */}
                    <div className="space-y-2.5 text-xs">
                      <span className="text-[10px] text-[#647A78] uppercase font-bold tracking-wider block">
                        Statutory Evidence & Field Mapping
                      </span>

                      {[
                        {
                          key: 'institution_name',
                          label: 'Institution Name',
                          field: selectedDoc.extractedData.fields?.institution_name,
                          fallbackVal: selectedDoc.extractedData.institutionName,
                        },
                        {
                          key: 'student_name',
                          label: 'Student / Candidate Name',
                          field: selectedDoc.extractedData.fields?.student_name,
                          fallbackVal: selectedDoc.extractedData.studentName,
                        },
                        {
                          key: 'course_or_qualification',
                          label: 'Course / Qualification / Degree',
                          field: selectedDoc.extractedData.fields?.course_or_qualification,
                          fallbackVal: selectedDoc.extractedData.courseOrQualification,
                        },
                        {
                          key: 'marks_or_grade',
                          label: 'Marks / CGPA / Grade',
                          field: selectedDoc.extractedData.fields?.marks_or_grade,
                          fallbackVal: selectedDoc.extractedData.marksOrGrade,
                        },
                        {
                          key: 'reference_number',
                          label: 'Statutory Reference / Reg No.',
                          field: selectedDoc.extractedData.fields?.reference_number,
                          fallbackVal: selectedDoc.extractedData.referenceNumber,
                        },
                        {
                          key: 'issue_date',
                          label: 'Issuance Date',
                          field: selectedDoc.extractedData.fields?.issue_date,
                          fallbackVal: selectedDoc.extractedData.issueDate,
                        },
                        {
                          key: 'expiry_date',
                          label: 'Validity / Expiry Date',
                          field: selectedDoc.extractedData.fields?.expiry_date,
                          fallbackVal: selectedDoc.extractedData.expiryDate,
                        },
                        {
                          key: 'issuing_authority',
                          label: 'Issuing Authority / Dept.',
                          field: selectedDoc.extractedData.fields?.issuing_authority,
                          fallbackVal: selectedDoc.extractedData.issuingAuthority,
                        },
                        {
                          key: 'academic_year',
                          label: 'Academic Year / Approval Cycle',
                          field: selectedDoc.extractedData.fields?.academic_year,
                          fallbackVal: selectedDoc.extractedData.academicYear,
                        },
                        {
                          key: 'address',
                          label: 'Campus Address / Location',
                          field: selectedDoc.extractedData.fields?.address,
                          fallbackVal: selectedDoc.extractedData.address,
                        },
                      ].map(item => {
                        const val = item.field?.value || item.fallbackVal;
                        const isMissing = !val || item.field?.isMissing || item.field?.is_missing;
                        const snippet = item.field?.sourceSnippet || item.field?.source_snippet;
                        const page = item.field?.page;
                        const method = item.field?.method || (selectedDoc.extractedData?.confidenceScore != null ? 'Tesseract OCR' : 'PyMuPDF');
                        const conf = item.field?.confidence;

                        return (
                          <div
                            key={item.key}
                            className={`p-3 rounded-lg border transition-colors ${
                              isMissing
                                ? 'bg-[#F9FAFB] border-[#E5E7EB]'
                                : 'bg-white border-[#D9E7E4]'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <span className="font-semibold text-[#647A78] text-[11px]">{item.label}</span>
                              <div className="flex items-center gap-2">
                                {page && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-[#F3F8F7] text-[#115E59] rounded border border-[#D9E7E4] font-medium">
                                    Page {page}
                                  </span>
                                )}
                                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#F3F8F7] text-[#647A78] rounded border border-[#D9E7E4]">
                                  {method}
                                </span>
                                {conf != null && (
                                  <span className="text-[10px] font-semibold text-[#15803D]">
                                    {conf}% conf
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-1">
                              {val ? (
                                <span className="font-bold text-[#193A39] text-xs font-mono">{val}</span>
                              ) : (
                                <span className="text-[11px] italic text-[#9CA3AF] flex items-center gap-1">
                                  <span>Not detected in document</span>
                                  {item.field?.missingReason || item.field?.missing_reason ? (
                                    <span className="text-[10px] text-[#647A78] font-normal not-italic">
                                      ({item.field.missingReason || item.field.missing_reason})
                                    </span>
                                  ) : null}
                                </span>
                              )}
                            </div>

                            {snippet && (
                              <div className="mt-2 text-[10px] font-mono text-[#0D9488] bg-[#F3F8F7]/60 p-2 rounded border border-[#D9E7E4]/60 overflow-x-auto whitespace-pre-wrap">
                                <span className="text-[#647A78] font-sans font-semibold block text-[9px] uppercase tracking-wider mb-0.5">
                                  Evidence Snippet:
                                </span>
                                &quot;{snippet}&quot;
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Raw Text View (Collapsible) */}
                    <div className="p-3 bg-[#F3F8F7]/40 rounded-lg border border-[#D9E7E4]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#647A78] font-semibold text-[11px]">
                          Recognized Optical Text ({selectedDoc.extractedData.rawTextPreview?.length || 0} characters)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopyText(selectedDoc.extractedData?.rawTextPreview || '')}
                            className="text-[11px] text-[#115E59] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            {copySuccess ? <Check className="w-3 h-3 text-[#15803D]" /> : <Copy className="w-3 h-3" />}
                            <span>{copySuccess ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            onClick={() => setShowFullRawText(!showFullRawText)}
                            className="text-[11px] text-[#0D9488] hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                          >
                            <span>{showFullRawText ? 'Collapse' : 'Expand Full'}</span>
                            {showFullRawText ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>

                      <div
                        className={`font-mono text-[11px] text-[#475569] mt-2 bg-white p-2.5 rounded border border-[#D9E7E4] leading-relaxed whitespace-pre-wrap overflow-y-auto ${
                          showFullRawText ? 'max-h-96' : 'max-h-28'
                        }`}
                      >
                        {selectedDoc.extractedData.rawTextPreview || (
                          <span className="italic text-[#9CA3AF]">No text recognized.</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-[#F3F8F7] text-center text-xs text-[#647A78] rounded-lg">
                    OCR extraction pending or failed for this document scan.
                  </div>
                )}
              </div>

              {/* Validation Rules Engine Report */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-[#193A39] uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#115E59]" />
                    <span>Statutory Validation Rules Report</span>
                  </h3>
                  <span className="text-[11px] font-semibold text-[#647A78]">
                    {selectedDoc.validationResults?.length || 0} Rule(s) Evaluated
                  </span>
                </div>

                <div className="space-y-3">
                  {selectedDoc.validationResults?.map(res => (
                    <div
                      key={res.id}
                      className="p-3 rounded-lg border border-[#D9E7E4] bg-white flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-[#115E59] bg-[#F3F8F7] px-1.5 py-0.2 rounded border border-[#D9E7E4]">
                            {res.ruleId}
                          </span>
                          <span className="font-bold text-[#193A39]">{res.ruleTitle}</span>
                        </div>
                        <p className="text-[11px] text-[#647A78] mt-1">{res.explanation}</p>
                        <div className="mt-1 text-[10px] font-mono text-[#0D9488]">
                          Evidence: {res.evidence}
                        </div>
                      </div>
                      <div className="flex-shrink-0 self-start sm:self-auto">
                        <StatusBadge status={res.outcome} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-12 text-center text-xs text-[#647A78] border border-[#D9E7E4]">
              Select a document to inspect OCR metadata and validation rules.
            </div>
          )}
        </div>
      </div>

      {/* Upload Document Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Statutory Compliance Document"
        description="Select category, pick PDF/Image certificate, and compute cryptographic integrity seal."
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#193A39] mb-1">Target Regulatory Application</label>
            <select
              value={uploadAppId}
              onChange={e => setUploadAppId(e.target.value)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-lg text-xs"
            >
              {applications.map(a => (
                <option key={a.id} value={a.id}>
                  {a.applicationNumber} — {a.type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#193A39] mb-1">Document Classification</label>
            <select
              value={uploadCategory}
              onChange={e => setUploadCategory(e.target.value as DocumentCategory)}
              className="w-full px-3 py-2 border border-[#D9E7E4] rounded-lg text-xs"
            >
              {CATEGORIES.map(c => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* File Picker Zone */}
          <div>
            <label className="block font-semibold text-[#193A39] mb-1">Select File (PDF, PNG, JPG)</label>
            <div className="border-2 border-dashed border-[#D9E7E4] hover:border-[#0D9488] rounded-xl p-6 text-center bg-[#F3F8F7]/50 cursor-pointer relative">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <UploadCloud className="w-8 h-8 text-[#115E59] mx-auto mb-2" />
              <p className="font-semibold text-xs text-[#193A39]">
                {uploadFilename ? uploadFilename : 'Click to browse or drag file here'}
              </p>
              <p className="text-[10px] text-[#647A78] mt-1">Maximum 20 MB per regulatory certificate</p>
            </div>
          </div>

          {/* Real-time Computed SHA-256 Seal Preview */}
          {computedSha256Preview && (
            <div className="p-3 bg-[#DCFCE7] border border-[#86EFAC] rounded-lg text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#15803D]">
                <CheckCircle2 className="w-4 h-4" />
                <span>Computed SHA-256 Digest (Client-Side & Verified on Server):</span>
              </div>
              <div className="font-mono text-[11px] text-[#15803D] mt-1 select-all break-all">
                {computedSha256Preview}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-[#D9E7E4]">
            <button
              onClick={() => setIsUploadOpen(false)}
              className="px-4 py-2 border border-[#D9E7E4] rounded-lg font-semibold text-[#647A78] hover:bg-[#F3F8F7]"
            >
              Cancel
            </button>
            <button
              onClick={handleUploadSubmit}
              disabled={isUploading}
              className="px-4 py-2 bg-[#115E59] text-white rounded-lg font-bold hover:bg-[#0F766E] disabled:opacity-50"
            >
              {isUploading ? 'Executing OCR & Rules...' : 'Upload & Seal Document'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError, fetchReceiptBlobUrl } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Plus, ChevronRight, ArrowLeft, Save,
  Trash2, Pencil, Paperclip, FileText, Image as ImageIcon,
  CheckCircle2, XCircle, CalendarClock,
} from 'lucide-react';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  gender?: string;
  dob?: string;
  phone?: string;
  personalEmail?: string;
  address?: string;
  joinDate: string;
  employmentType: string;
  employmentStatus: string;
  status: string;
  department?: { name: string };
  designation?: { title: string };
  lineManager?: { firstName: string; lastName: string };
  user?: { email: string; roles?: RoleOption[] };
}

interface RoleOption {
  id: string;
  name: string;
}

interface JobChange {
  id: string; type: string; effectiveDate: string;
  reason?: string; createdAt: string;
}

interface ProbationRecord {
  id: string; startDate: string; probationMonths: number;
  expectedConfirmationDate: string; status: string;
  confirmedOn?: string; extendedTo?: string;
}

interface SalaryStructure {
  id: string;
  effectiveFrom: string;
  effectiveTo?: string;
  inputBasis: string;
  inputAmount: string;
  basicAmount: string;
  grossAmount: string;
  ctcAmount: string;
  currency: string;
  reason: string;
  status: string;
  createdAt: string;
  lines: Array<{
    id: string;
    calcType: string;
    inputValue: string | null;
    computedAmount: string;
    component: { name: string; code: string; type: string };
  }>;
}

interface PfAccount {
  id: string;
  pfNumber?: string;
  enrolledOn: string;
  employeeContribPercent: string;
  employerContribPercent: string;
  pfBase: string;
  status: string;
}

interface Benefit {
  id: string;
  type: string;
  description?: string;
  valueType: string;
  value: string;
  effectiveFrom: string;
  effectiveTo?: string;
  note?: string;
}

interface DocumentRow {
  id: string;
  type: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  expiryDate?: string | null;
  label?: string | null;
  createdAt: string;
}

interface EducationRow {
  id: string;
  degree: string;
  institution: string;
  fieldOfStudy?: string | null;
  result?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  note?: string | null;
}

interface PreviousEmploymentRow {
  id: string;
  companyName: string;
  designation?: string | null;
  fromDate: string;
  toDate?: string | null;
  reasonForLeaving?: string | null;
  note?: string | null;
}

interface DeptOption { id: string; name: string; }
interface DesigOption { id: string; title: string; }
interface EmployeeOption { id: string; firstName: string; lastName: string; employeeCode: string; }

type Tab = 'personal' | 'job' | 'probation' | 'compensation' | 'documents' | 'education' | 'workHistory';

const VALID_TABS: Tab[] = ['personal', 'education', 'workHistory', 'job', 'probation', 'compensation', 'documents'];

const DOC_TYPES = ['NID', 'contract', 'certificate', 'other'];
const DOC_ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const DOC_MAX_BYTES = 5 * 1024 * 1024;
const DEGREES = ['ssc', 'hsc', 'diploma', 'bachelors', 'masters', 'phd', 'other'];
const JOB_CHANGE_TYPES = ['promotion', 'transfer', 'demotion', 'reassignment'];

const EMPTY_EDU_FORM = { degree: 'bachelors', institution: '', fieldOfStudy: '', result: '', startYear: '', endYear: '', note: '' };
const EMPTY_WORK_FORM = { companyName: '', designation: '', fromDate: '', toDate: '', reasonForLeaving: '', note: '' };

const fieldClass = 'block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const { hasPermission } = useAuth();
  const canManageRoles = hasPermission('role.manage');
  const canManageEmployee = hasPermission('employee.update');
  const [emp, setEmp] = useState<Employee | null>(null);
  const [allRoles, setAllRoles] = useState<RoleOption[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [savingRoles, setSavingRoles] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleSuccess, setRoleSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(
    VALID_TABS.includes(requestedTab as Tab) ? (requestedTab as Tab) : 'personal',
  );
  const [jobHistory, setJobHistory] = useState<JobChange[]>([]);
  const [probation, setProbation] = useState<ProbationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Compensation state
  const [currentSalary, setCurrentSalary] = useState<SalaryStructure | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryStructure[]>([]);
  const [pfAccount, setPfAccount] = useState<PfAccount | null>(null);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [compLoading, setCompLoading] = useState(false);
  const [compLoaded, setCompLoaded] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsLoaded, setDocsLoaded] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [docForm, setDocForm] = useState({ type: 'other', expiryDate: '', label: '' });
  const [docDeletingId, setDocDeletingId] = useState<string | null>(null);

  // Education state
  const [education, setEducation] = useState<EducationRow[]>([]);
  const [eduLoading, setEduLoading] = useState(false);
  const [eduLoaded, setEduLoaded] = useState(false);
  const [eduSaving, setEduSaving] = useState(false);
  const [eduError, setEduError] = useState<string | null>(null);
  const [eduForm, setEduForm] = useState(EMPTY_EDU_FORM);
  const [editingEducationId, setEditingEducationId] = useState<string | null>(null);
  const [editEduForm, setEditEduForm] = useState(EMPTY_EDU_FORM);

  // Previous employment state
  const [prevEmployment, setPrevEmployment] = useState<PreviousEmploymentRow[]>([]);
  const [workLoading, setWorkLoading] = useState(false);
  const [workLoaded, setWorkLoaded] = useState(false);
  const [workSaving, setWorkSaving] = useState(false);
  const [workError, setWorkError] = useState<string | null>(null);
  const [workForm, setWorkForm] = useState(EMPTY_WORK_FORM);
  const [editingPrevId, setEditingPrevId] = useState<string | null>(null);
  const [editWorkForm, setEditWorkForm] = useState(EMPTY_WORK_FORM);

  // Probation-action state
  const [startProbationOpen, setStartProbationOpen] = useState(false);
  const [startProbationForm, setStartProbationForm] = useState({ startDate: '', probationMonths: '3' });
  const [probationSaving, setProbationSaving] = useState(false);
  const [probationError, setProbationError] = useState<string | null>(null);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [extendForm, setExtendForm] = useState({ extendedTo: '' });

  // Job-change state
  const [jobChangeOpen, setJobChangeOpen] = useState(false);
  const [jobChangeForm, setJobChangeForm] = useState({
    type: 'promotion', effectiveDate: '', toDepartmentId: '', toDesignationId: '', toManagerId: '', reason: '', note: '',
  });
  const [jobChangeSaving, setJobChangeSaving] = useState(false);
  const [jobChangeError, setJobChangeError] = useState<string | null>(null);
  const [depts, setDepts] = useState<DeptOption[]>([]);
  const [desigs, setDesigs] = useState<DesigOption[]>([]);
  const [managerOptions, setManagerOptions] = useState<EmployeeOption[]>([]);

  // Personal-info edit state
  const [personalEditOpen, setPersonalEditOpen] = useState(false);
  const [personalForm, setPersonalForm] = useState({ gender: '', dob: '', phone: '', personalEmail: '', address: '' });
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);

  // Line-manager change state
  const [managerChangeOpen, setManagerChangeOpen] = useState(false);
  const [managerChangeForm, setManagerChangeForm] = useState({ toManagerId: '', effectiveDate: '', reason: '' });
  const [managerChangeSaving, setManagerChangeSaving] = useState(false);
  const [managerChangeError, setManagerChangeError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Employee>(`/employees/${id}`),
      api.get<JobChange[]>(`/employees/${id}/job-history`),
      api.get<ProbationRecord[]>(`/employees/${id}/probation`),
    ]).then(([e, j, p]) => {
      setEmp(e);
      setJobHistory(j);
      setProbation(p);
      setSelectedRoleIds(new Set(e.user?.roles?.map((r) => r.id) ?? []));
    })
      .catch(() => setError('Failed to load employee profile.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!canManageRoles) return;
    api.get<RoleOption[]>('/roles').then(setAllRoles).catch(() => {});
  }, [canManageRoles]);

  function toggleRole(roleId: string) {
    setSelectedRoleIds((s) => {
      const next = new Set(s);
      if (next.has(roleId)) next.delete(roleId); else next.add(roleId);
      return next;
    });
  }

  async function saveRoles() {
    setSavingRoles(true);
    setRoleError(null);
    setRoleSuccess(null);
    try {
      const updated = await api.patch<Employee>(`/employees/${id}/roles`, { roleIds: Array.from(selectedRoleIds) });
      setEmp(updated);
      setRoleSuccess('Roles updated');
    } catch (err: unknown) {
      setRoleError((err as ApiError).message ?? 'Failed to update roles');
    } finally {
      setSavingRoles(false);
    }
  }

  const loadCompensation = useCallback(() => {
    if (compLoaded) return;
    setCompLoading(true);
    Promise.all([
      api.get<SalaryStructure | null>(`/compensation/employees/${id}/salary`).catch(() => null),
      api.get<SalaryStructure[]>(`/compensation/employees/${id}/salary/history`).catch(() => []),
      api.get<PfAccount | null>(`/compensation/employees/${id}/pf`).catch(() => null),
      api.get<Benefit[]>(`/compensation/employees/${id}/benefits`).catch(() => []),
    ]).then(([cur, hist, pf, ben]) => {
      setCurrentSalary(cur);
      setSalaryHistory(hist ?? []);
      setPfAccount(pf);
      setBenefits(ben ?? []);
      setCompLoaded(true);
    }).finally(() => setCompLoading(false));
  }, [id, compLoaded]);

  const loadDocuments = useCallback(() => {
    if (docsLoaded) return;
    setDocsLoading(true);
    api.get<DocumentRow[]>(`/employees/${id}/documents`)
      .then(setDocuments)
      .catch(() => setDocError('Failed to load documents.'))
      .finally(() => { setDocsLoading(false); setDocsLoaded(true); });
  }, [id, docsLoaded]);

  const loadEducation = useCallback(() => {
    if (eduLoaded) return;
    setEduLoading(true);
    api.get<EducationRow[]>(`/employees/${id}/education`)
      .then(setEducation)
      .catch(() => setEduError('Failed to load education history.'))
      .finally(() => { setEduLoading(false); setEduLoaded(true); });
  }, [id, eduLoaded]);

  const loadPreviousEmployment = useCallback(() => {
    if (workLoaded) return;
    setWorkLoading(true);
    api.get<PreviousEmploymentRow[]>(`/employees/${id}/previous-employment`)
      .then(setPrevEmployment)
      .catch(() => setWorkError('Failed to load work history.'))
      .finally(() => { setWorkLoading(false); setWorkLoaded(true); });
  }, [id, workLoaded]);

  useEffect(() => {
    if (tab === 'compensation') loadCompensation();
    if (tab === 'documents') loadDocuments();
    if (tab === 'education') loadEducation();
    if (tab === 'workHistory') loadPreviousEmployment();
  }, [tab, loadCompensation, loadDocuments, loadEducation, loadPreviousEmployment]);

  useEffect(() => {
    if ((tab !== 'job' && tab !== 'personal') || !canManageEmployee || depts.length > 0) return;
    api.get<DeptOption[]>('/departments').then(setDepts).catch(() => {});
    api.get<DesigOption[]>('/designations').then(setDesigs).catch(() => {});
    api.get<{ data: EmployeeOption[] }>('/employees?limit=100').then((r) => setManagerOptions(r.data ?? [])).catch(() => {});
  }, [tab, canManageEmployee, depts.length]);

  // ── Documents ──────────────────────────────────────────────────────────────

  async function handleUploadDocument(file: File) {
    if (!DOC_ACCEPT.includes(file.type)) {
      setDocError('File must be a JPEG, PNG, WEBP or PDF file');
      return;
    }
    if (file.size > DOC_MAX_BYTES) {
      setDocError('File must be smaller than 5MB');
      return;
    }
    if (docForm.type === 'certificate' && !docForm.label.trim()) {
      setDocError('Enter the certificate name');
      return;
    }
    if (docForm.type === 'other' && !docForm.label.trim()) {
      setDocError('Specify the document type');
      return;
    }
    setDocUploading(true);
    setDocError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', docForm.type);
      if (docForm.expiryDate) formData.append('expiryDate', docForm.expiryDate);
      if (docForm.label.trim()) formData.append('label', docForm.label.trim());
      const created = await api.upload<DocumentRow>(`/employees/${id}/documents`, formData);
      setDocuments((prev) => [created, ...prev]);
      setDocForm({ type: 'other', expiryDate: '', label: '' });
    } catch (err: unknown) {
      setDocError((err as ApiError).message ?? 'Failed to upload document');
    } finally {
      setDocUploading(false);
    }
  }

  async function handleDeleteDocument(docId: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    setDocDeletingId(docId);
    try {
      await api.delete(`/employees/${id}/documents/${docId}`);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: unknown) {
      setDocError((err as ApiError).message ?? 'Failed to delete document');
    } finally {
      setDocDeletingId(null);
    }
  }

  function openDocument(docId: string) {
    fetchReceiptBlobUrl(`/employees/${id}/documents/${docId}/file`);
  }

  // ── Education ──────────────────────────────────────────────────────────────

  async function handleAddEducation(e: FormEvent) {
    e.preventDefault();
    setEduSaving(true);
    setEduError(null);
    try {
      const created = await api.post<EducationRow>(`/employees/${id}/education`, {
        degree: eduForm.degree,
        institution: eduForm.institution,
        fieldOfStudy: eduForm.fieldOfStudy || undefined,
        result: eduForm.result || undefined,
        startYear: eduForm.startYear ? Number(eduForm.startYear) : undefined,
        endYear: eduForm.endYear ? Number(eduForm.endYear) : undefined,
        note: eduForm.note || undefined,
      });
      setEducation((prev) => [created, ...prev]);
      setEduForm(EMPTY_EDU_FORM);
    } catch (err: unknown) {
      setEduError((err as ApiError).message ?? 'Failed to add education record');
    } finally {
      setEduSaving(false);
    }
  }

  function startEditEducation(row: EducationRow) {
    setEditingEducationId(row.id);
    setEditEduForm({
      degree: row.degree,
      institution: row.institution,
      fieldOfStudy: row.fieldOfStudy ?? '',
      result: row.result ?? '',
      startYear: row.startYear ? String(row.startYear) : '',
      endYear: row.endYear ? String(row.endYear) : '',
      note: row.note ?? '',
    });
  }

  async function handleSaveEducation(eduId: string) {
    setEduSaving(true);
    setEduError(null);
    try {
      const updated = await api.patch<EducationRow>(`/employees/${id}/education/${eduId}`, {
        degree: editEduForm.degree,
        institution: editEduForm.institution,
        fieldOfStudy: editEduForm.fieldOfStudy || undefined,
        result: editEduForm.result || undefined,
        startYear: editEduForm.startYear ? Number(editEduForm.startYear) : undefined,
        endYear: editEduForm.endYear ? Number(editEduForm.endYear) : undefined,
        note: editEduForm.note || undefined,
      });
      setEducation((prev) => prev.map((r) => (r.id === eduId ? updated : r)));
      setEditingEducationId(null);
    } catch (err: unknown) {
      setEduError((err as ApiError).message ?? 'Failed to update education record');
    } finally {
      setEduSaving(false);
    }
  }

  async function handleDeleteEducation(eduId: string) {
    if (!confirm('Delete this education record? This cannot be undone.')) return;
    try {
      await api.delete(`/employees/${id}/education/${eduId}`);
      setEducation((prev) => prev.filter((r) => r.id !== eduId));
    } catch (err: unknown) {
      setEduError((err as ApiError).message ?? 'Failed to delete education record');
    }
  }

  // ── Previous employment ─────────────────────────────────────────────────────

  async function handleAddPreviousEmployment(e: FormEvent) {
    e.preventDefault();
    setWorkSaving(true);
    setWorkError(null);
    try {
      const created = await api.post<PreviousEmploymentRow>(`/employees/${id}/previous-employment`, {
        companyName: workForm.companyName,
        designation: workForm.designation || undefined,
        fromDate: workForm.fromDate,
        toDate: workForm.toDate || undefined,
        reasonForLeaving: workForm.reasonForLeaving || undefined,
        note: workForm.note || undefined,
      });
      setPrevEmployment((prev) => [created, ...prev]);
      setWorkForm(EMPTY_WORK_FORM);
    } catch (err: unknown) {
      setWorkError((err as ApiError).message ?? 'Failed to add previous employment record');
    } finally {
      setWorkSaving(false);
    }
  }

  function startEditPreviousEmployment(row: PreviousEmploymentRow) {
    setEditingPrevId(row.id);
    setEditWorkForm({
      companyName: row.companyName,
      designation: row.designation ?? '',
      fromDate: row.fromDate,
      toDate: row.toDate ?? '',
      reasonForLeaving: row.reasonForLeaving ?? '',
      note: row.note ?? '',
    });
  }

  async function handleSavePreviousEmployment(prevId: string) {
    setWorkSaving(true);
    setWorkError(null);
    try {
      const updated = await api.patch<PreviousEmploymentRow>(`/employees/${id}/previous-employment/${prevId}`, {
        companyName: editWorkForm.companyName,
        designation: editWorkForm.designation || undefined,
        fromDate: editWorkForm.fromDate,
        toDate: editWorkForm.toDate || undefined,
        reasonForLeaving: editWorkForm.reasonForLeaving || undefined,
        note: editWorkForm.note || undefined,
      });
      setPrevEmployment((prev) => prev.map((r) => (r.id === prevId ? updated : r)));
      setEditingPrevId(null);
    } catch (err: unknown) {
      setWorkError((err as ApiError).message ?? 'Failed to update previous employment record');
    } finally {
      setWorkSaving(false);
    }
  }

  async function handleDeletePreviousEmployment(prevId: string) {
    if (!confirm('Delete this previous employment record? This cannot be undone.')) return;
    try {
      await api.delete(`/employees/${id}/previous-employment/${prevId}`);
      setPrevEmployment((prev) => prev.filter((r) => r.id !== prevId));
    } catch (err: unknown) {
      setWorkError((err as ApiError).message ?? 'Failed to delete previous employment record');
    }
  }

  // ── Probation actions ────────────────────────────────────────────────────────

  async function refreshProbationAndEmployee() {
    await Promise.all([
      api.get<ProbationRecord[]>(`/employees/${id}/probation`).then(setProbation),
      api.get<Employee>(`/employees/${id}`).then(setEmp),
    ]);
  }

  async function handleStartProbation(e: FormEvent) {
    e.preventDefault();
    setProbationSaving(true);
    setProbationError(null);
    try {
      await api.post(`/employees/${id}/probation`, {
        startDate: startProbationForm.startDate,
        probationMonths: Number(startProbationForm.probationMonths),
      });
      await refreshProbationAndEmployee();
      setStartProbationOpen(false);
      setStartProbationForm({ startDate: '', probationMonths: '3' });
    } catch (err: unknown) {
      setProbationError((err as ApiError).message ?? 'Failed to start probation');
    } finally {
      setProbationSaving(false);
    }
  }

  async function handleProbationAction(action: 'confirmed' | 'extended' | 'failed', extendedTo?: string) {
    setProbationSaving(true);
    setProbationError(null);
    try {
      await api.post(`/employees/${id}/probation/action`, { action, extendedTo });
      await refreshProbationAndEmployee();
      setExtendingId(null);
      setExtendForm({ extendedTo: '' });
    } catch (err: unknown) {
      setProbationError((err as ApiError).message ?? 'Failed to update probation');
    } finally {
      setProbationSaving(false);
    }
  }

  // ── Job change ──────────────────────────────────────────────────────────────

  async function handleSubmitJobChange(e: FormEvent) {
    e.preventDefault();
    setJobChangeSaving(true);
    setJobChangeError(null);
    try {
      await api.post(`/employees/${id}/job-change`, {
        type: jobChangeForm.type,
        effectiveDate: jobChangeForm.effectiveDate,
        toDepartmentId: jobChangeForm.toDepartmentId || undefined,
        toDesignationId: jobChangeForm.toDesignationId || undefined,
        toManagerId: jobChangeForm.toManagerId || undefined,
        reason: jobChangeForm.reason || undefined,
        note: jobChangeForm.note || undefined,
      });
      await Promise.all([
        api.get<JobChange[]>(`/employees/${id}/job-history`).then(setJobHistory),
        api.get<Employee>(`/employees/${id}`).then(setEmp),
      ]);
      setJobChangeOpen(false);
      setJobChangeForm({
        type: 'promotion', effectiveDate: '', toDepartmentId: '', toDesignationId: '', toManagerId: '', reason: '', note: '',
      });
    } catch (err: unknown) {
      setJobChangeError((err as ApiError).message ?? 'Failed to record job change');
    } finally {
      setJobChangeSaving(false);
    }
  }

  // ── Personal info edit ──────────────────────────────────────────────────────

  function openPersonalEdit() {
    if (!emp) return;
    setPersonalForm({
      gender: emp.gender ?? '',
      dob: emp.dob ?? '',
      phone: emp.phone ?? '',
      personalEmail: emp.personalEmail ?? '',
      address: emp.address ?? '',
    });
    setPersonalError(null);
    setPersonalEditOpen(true);
  }

  async function handleSavePersonalInfo(e: FormEvent) {
    e.preventDefault();
    setPersonalSaving(true);
    setPersonalError(null);
    try {
      const updated = await api.patch<Employee>(`/employees/${id}`, {
        gender: personalForm.gender || undefined,
        dob: personalForm.dob || undefined,
        phone: personalForm.phone || undefined,
        personalEmail: personalForm.personalEmail || undefined,
        address: personalForm.address || undefined,
      });
      setEmp(updated);
      setPersonalEditOpen(false);
    } catch (err: unknown) {
      setPersonalError((err as ApiError).message ?? 'Failed to update personal information');
    } finally {
      setPersonalSaving(false);
    }
  }

  // ── Line manager change ─────────────────────────────────────────────────────

  function openManagerChange() {
    setManagerChangeForm({ toManagerId: '', effectiveDate: '', reason: '' });
    setManagerChangeError(null);
    setManagerChangeOpen(true);
  }

  async function handleChangeLineManager(e: FormEvent) {
    e.preventDefault();
    setManagerChangeSaving(true);
    setManagerChangeError(null);
    try {
      await api.post(`/employees/${id}/job-change`, {
        type: 'reassignment',
        effectiveDate: managerChangeForm.effectiveDate,
        toManagerId: managerChangeForm.toManagerId,
        reason: managerChangeForm.reason || undefined,
      });
      await Promise.all([
        api.get<JobChange[]>(`/employees/${id}/job-history`).then(setJobHistory),
        api.get<Employee>(`/employees/${id}`).then(setEmp),
      ]);
      setManagerChangeOpen(false);
    } catch (err: unknown) {
      setManagerChangeError((err as ApiError).message ?? 'Failed to change line manager');
    } finally {
      setManagerChangeSaving(false);
    }
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading…</div>;
  if (error) return <div className="py-20 text-center text-danger">{error}</div>;
  if (!emp) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'personal', label: 'Personal' },
    { key: 'education', label: 'Education' },
    { key: 'workHistory', label: 'Work History' },
    { key: 'job', label: 'Job & History' },
    { key: 'probation', label: 'Probation' },
    { key: 'compensation', label: 'Compensation' },
    { key: 'documents', label: 'Documents' },
  ];

  const hasActiveProbation = probation.some((p) => p.status === 'in_probation');

  return (
    <div className="space-y-6 p-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Back
      </Button>

      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/employees" className="hover:text-foreground hover:underline">Employees</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{emp.firstName} {emp.lastName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4 rounded-2xl bg-card p-6 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-semibold text-white">
          {emp.firstName[0]}{emp.lastName[0]}
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">
            {emp.firstName} {emp.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {emp.employeeCode} · {emp.designation?.title ?? '—'} · {emp.department?.name ?? '—'}
          </p>
        </div>
        <div className="ml-auto">
          <span className={`rounded-md px-2 py-1 text-xs capitalize ${statusColor(emp.employmentStatus)}`}>
            {emp.employmentStatus.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1 w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Personal */}
      {tab === 'personal' && (
        <div className="rounded-2xl bg-card p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Personal information</h2>
            {canManageEmployee && !personalEditOpen && (
              <Button size="sm" variant="outline" onClick={openPersonalEdit}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>

          {!personalEditOpen ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {[
                ['Email', emp.user?.email],
                ['Personal email', emp.personalEmail],
                ['Phone', emp.phone],
                ['Gender', emp.gender],
                ['Date of birth', emp.dob],
                ['Address', emp.address],
                ['Join date', emp.joinDate],
                ['Employment type', emp.employmentType],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 text-sm text-foreground">{value ?? '—'}</dd>
                </div>
              ))}
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Line manager</dt>
                <dd className="mt-0.5 flex items-center gap-2 text-sm text-foreground">
                  {emp.lineManager ? `${emp.lineManager.firstName} ${emp.lineManager.lastName}` : '—'}
                  {canManageEmployee && !managerChangeOpen && (
                    <button onClick={openManagerChange} className="text-xs font-medium text-primary hover:underline">
                      Change
                    </button>
                  )}
                </dd>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSavePersonalInfo} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Gender</label>
                  <select value={personalForm.gender} onChange={(e) => setPersonalForm((f) => ({ ...f, gender: e.target.value }))} className={fieldClass}>
                    <option value="">— not specified —</option>
                    {['male', 'female', 'other'].map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Date of birth</label>
                  <input type="date" value={personalForm.dob} onChange={(e) => setPersonalForm((f) => ({ ...f, dob: e.target.value }))} className={fieldClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Phone</label>
                  <input type="tel" value={personalForm.phone} onChange={(e) => setPersonalForm((f) => ({ ...f, phone: e.target.value }))} className={fieldClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Personal email</label>
                  <input type="email" value={personalForm.personalEmail} onChange={(e) => setPersonalForm((f) => ({ ...f, personalEmail: e.target.value }))} className={fieldClass} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">Address</label>
                <textarea rows={2} value={personalForm.address} onChange={(e) => setPersonalForm((f) => ({ ...f, address: e.target.value }))} className={fieldClass} />
              </div>
              {personalError && <p className="text-sm text-danger">{personalError}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={personalSaving}>
                  {personalSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setPersonalEditOpen(false)}>Cancel</Button>
              </div>
            </form>
          )}

          {managerChangeOpen && (
            <form onSubmit={handleChangeLineManager} className="space-y-3 rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">Change line manager</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">New line manager</label>
                  <select required value={managerChangeForm.toManagerId}
                    onChange={(e) => setManagerChangeForm((f) => ({ ...f, toManagerId: e.target.value }))} className={fieldClass}>
                    <option value="">— select —</option>
                    {managerOptions.filter((m) => m.id !== id).map((m) => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.employeeCode})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Effective date</label>
                  <input required type="date" value={managerChangeForm.effectiveDate}
                    onChange={(e) => setManagerChangeForm((f) => ({ ...f, effectiveDate: e.target.value }))} className={fieldClass} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">Reason (optional)</label>
                <input value={managerChangeForm.reason} onChange={(e) => setManagerChangeForm((f) => ({ ...f, reason: e.target.value }))} className={fieldClass} />
              </div>
              {managerChangeError && <p className="text-sm text-danger">{managerChangeError}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={managerChangeSaving}>
                  {managerChangeSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setManagerChangeOpen(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Roles */}
      {tab === 'personal' && (
        <div className="rounded-2xl bg-card p-6 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Roles</h2>
          {!canManageRoles ? (
            <div className="flex flex-wrap gap-2">
              {emp.user?.roles?.length ? emp.user.roles.map((r) => (
                <Badge key={r.id} variant="outline" className="text-xs">{r.name}</Badge>
              )) : <p className="text-sm text-muted-foreground">No roles assigned.</p>}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                {allRoles.map((r) => (
                  <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border accent-[color:var(--primary)]"
                      checked={selectedRoleIds.has(r.id)}
                      onChange={() => toggleRole(r.id)}
                    />
                    {r.name}
                  </label>
                ))}
              </div>
              {roleError && <p className="text-sm text-danger">{roleError}</p>}
              {roleSuccess && <p className="text-sm text-success">{roleSuccess}</p>}
              <Button size="sm" onClick={saveRoles} disabled={savingRoles}>
                {savingRoles ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save roles
              </Button>
            </>
          )}
        </div>
      )}

      {/* Job & History */}
      {tab === 'job' && (
        <div className="space-y-4">
          {canManageEmployee && (
            <div className="rounded-2xl bg-card p-5 shadow-sm space-y-3">
              {!jobChangeOpen ? (
                <Button size="sm" onClick={() => setJobChangeOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Record promotion / transfer
                </Button>
              ) : (
                <form onSubmit={handleSubmitJobChange} className="space-y-3">
                  <h2 className="text-sm font-semibold text-foreground">Record promotion / transfer</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-muted-foreground">Type</label>
                      <select value={jobChangeForm.type} onChange={(e) => setJobChangeForm((f) => ({ ...f, type: e.target.value }))} className={fieldClass}>
                        {JOB_CHANGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-muted-foreground">Effective date</label>
                      <input required type="date" value={jobChangeForm.effectiveDate}
                        onChange={(e) => setJobChangeForm((f) => ({ ...f, effectiveDate: e.target.value }))} className={fieldClass} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-muted-foreground">New department</label>
                      <select value={jobChangeForm.toDepartmentId} onChange={(e) => setJobChangeForm((f) => ({ ...f, toDepartmentId: e.target.value }))} className={fieldClass}>
                        <option value="">— unchanged —</option>
                        {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-muted-foreground">New designation</label>
                      <select value={jobChangeForm.toDesignationId} onChange={(e) => setJobChangeForm((f) => ({ ...f, toDesignationId: e.target.value }))} className={fieldClass}>
                        <option value="">— unchanged —</option>
                        {desigs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground">New line manager</label>
                      <select value={jobChangeForm.toManagerId} onChange={(e) => setJobChangeForm((f) => ({ ...f, toManagerId: e.target.value }))} className={fieldClass}>
                        <option value="">— unchanged —</option>
                        {managerOptions.filter((m) => m.id !== id).map((m) => (
                          <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.employeeCode})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">Reason</label>
                    <input value={jobChangeForm.reason} onChange={(e) => setJobChangeForm((f) => ({ ...f, reason: e.target.value }))} className={fieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">Note</label>
                    <textarea value={jobChangeForm.note} onChange={(e) => setJobChangeForm((f) => ({ ...f, note: e.target.value }))} rows={2} className={fieldClass} />
                  </div>
                  {jobChangeError && <p className="text-sm text-danger">{jobChangeError}</p>}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={jobChangeSaving}>
                      {jobChangeSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setJobChangeOpen(false)}>Cancel</Button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div className="rounded-2xl bg-card shadow-sm overflow-hidden">
            {jobHistory.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No job changes recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Effective date</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {jobHistory.map((j) => (
                    <tr key={j.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 capitalize">{j.type}</td>
                      <td className="px-4 py-3 font-mono text-xs">{j.effectiveDate}</td>
                      <td className="px-4 py-3 text-muted-foreground">{j.reason ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(j.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Probation */}
      {tab === 'probation' && (
        <div className="space-y-4">
          {canManageEmployee && !hasActiveProbation && (
            <div className="rounded-2xl bg-card p-5 shadow-sm space-y-3">
              {!startProbationOpen ? (
                <Button size="sm" onClick={() => setStartProbationOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Start probation
                </Button>
              ) : (
                <form onSubmit={handleStartProbation} className="space-y-3">
                  <h2 className="text-sm font-semibold text-foreground">Start probation</h2>
                  <div className="flex flex-wrap gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-muted-foreground">Start date</label>
                      <input required type="date" value={startProbationForm.startDate}
                        onChange={(e) => setStartProbationForm((f) => ({ ...f, startDate: e.target.value }))}
                        className={`${fieldClass} w-40`} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-muted-foreground">Duration (months)</label>
                      <input required type="number" min={1} value={startProbationForm.probationMonths}
                        onChange={(e) => setStartProbationForm((f) => ({ ...f, probationMonths: e.target.value }))}
                        className={`${fieldClass} w-28`} />
                    </div>
                  </div>
                  {probationError && <p className="text-sm text-danger">{probationError}</p>}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={probationSaving}>
                      {probationSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Start
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setStartProbationOpen(false)}>Cancel</Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {probation.length === 0 ? (
            <div className="rounded-2xl bg-card p-6 shadow-sm text-sm text-muted-foreground">
              No probation records.
            </div>
          ) : probation.map((p) => (
            <div key={p.id} className="rounded-2xl bg-card p-6 shadow-sm space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Start date</dt>
                  <dd className="mt-0.5 text-sm font-mono">{p.startDate}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Duration</dt>
                  <dd className="mt-0.5 text-sm">{p.probationMonths} months</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Expected confirmation</dt>
                  <dd className="mt-0.5 text-sm font-mono">{p.expectedConfirmationDate}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Status</dt>
                  <dd className="mt-0.5">
                    <span className={`rounded-md px-2 py-0.5 text-xs ${probationColor(p.status)}`}>
                      {p.status.replace(/_/g, ' ')}
                    </span>
                  </dd>
                </div>
                {p.confirmedOn && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Confirmed on</dt>
                    <dd className="mt-0.5 text-sm font-mono">{p.confirmedOn}</dd>
                  </div>
                )}
                {p.extendedTo && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Extended to</dt>
                    <dd className="mt-0.5 text-sm font-mono">{p.extendedTo}</dd>
                  </div>
                )}
              </div>

              {canManageEmployee && p.status === 'in_probation' && (
                <div className="border-t border-border pt-4 space-y-3">
                  {extendingId === p.id ? (
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-muted-foreground">Extend to</label>
                        <input type="date" value={extendForm.extendedTo}
                          onChange={(e) => setExtendForm({ extendedTo: e.target.value })}
                          className={`${fieldClass} w-40`} />
                      </div>
                      <Button size="sm" className="bg-warning hover:bg-warning/90 text-white" disabled={probationSaving || !extendForm.extendedTo}
                        onClick={() => handleProbationAction('extended', extendForm.extendedTo)}>
                        Confirm extension
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setExtendingId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="bg-success hover:bg-success/90 text-white" disabled={probationSaving}
                        onClick={() => handleProbationAction('confirmed')}>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" className="border-warning text-warning hover:bg-warning/10" disabled={probationSaving}
                        onClick={() => setExtendingId(p.id)}>
                        <CalendarClock className="mr-1.5 h-3.5 w-3.5" /> Extend
                      </Button>
                      <Button size="sm" variant="outline" className="border-danger text-danger hover:bg-danger/10" disabled={probationSaving}
                        onClick={() => { if (confirm("Fail this employee's probation? This will set their status to Terminated.")) handleProbationAction('failed'); }}>
                        <XCircle className="mr-1.5 h-3.5 w-3.5" /> Fail
                      </Button>
                    </div>
                  )}
                  {probationError && <p className="text-sm text-danger">{probationError}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Compensation */}
      {tab === 'compensation' && (
        <div className="space-y-6">
          {compLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading compensation…</div>
          ) : (
            <>
              {/* Current salary + Set salary button */}
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Current Salary Structure</h2>
                <Button asChild size="sm">
                  <Link href={`/employees/${id}/salary/new`}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    {currentSalary ? 'Revise salary' : 'Set salary'}
                  </Link>
                </Button>
              </div>

              {currentSalary ? (
                <SalaryCard structure={currentSalary} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                  <p>No salary structure set for this employee.</p>
                  <Button className="mt-4" asChild>
                    <Link href={`/employees/${id}/salary/new`}>
                      <Plus className="mr-1.5 h-4 w-4" /> Set salary
                    </Link>
                  </Button>
                </div>
              )}

              {/* Salary history */}
              {salaryHistory.length > 1 && (
                <div>
                  <h2 className="font-semibold text-foreground mb-3">Salary History</h2>
                  <div className="relative space-y-0 before:absolute before:left-4 before:top-0 before:h-full before:w-px before:bg-border">
                    {salaryHistory.map((s, idx) => (
                      <div key={s.id} className={`relative flex gap-4 pb-6 ${idx === 0 ? 'opacity-50' : ''}`}>
                        <div className="relative z-10 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-medium text-muted-foreground">
                          {idx + 1}
                        </div>
                        <div className="flex-1 rounded-xl bg-card p-4 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-foreground capitalize">{s.reason}</span>
                              <span className="ml-2 font-mono text-xs text-muted-foreground">{s.effectiveFrom}</span>
                            </div>
                            <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                              {s.status}
                            </Badge>
                          </div>
                          <div className="mt-2 flex gap-6 text-sm">
                            <Stat label="Basic" value={fmt(s.basicAmount, s.currency)} />
                            <Stat label="Gross" value={fmt(s.grossAmount, s.currency)} />
                            <Stat label="CTC" value={fmt(s.ctcAmount, s.currency)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PF Account */}
              <div>
                <h2 className="font-semibold text-foreground mb-3">Provident Fund</h2>
                {pfAccount ? (
                  <div className="rounded-2xl bg-card p-5 shadow-sm grid grid-cols-3 gap-4">
                    <Stat label="PF Number" value={pfAccount.pfNumber ?? '—'} mono />
                    <Stat label="Enrolled on" value={pfAccount.enrolledOn} mono />
                    <Stat label="PF base" value={pfAccount.pfBase} />
                    <Stat label="Employee contribution" value={`${pfAccount.employeeContribPercent}%`} />
                    <Stat label="Employer contribution" value={`${pfAccount.employerContribPercent}%`} />
                    <Stat label="Status" value={pfAccount.status} />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No PF account enrolled. Use the API to create one.
                  </div>
                )}
              </div>

              {/* Benefits */}
              <div>
                <h2 className="font-semibold text-foreground mb-3">Benefits</h2>
                {benefits.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No benefits recorded.
                  </div>
                ) : (
                  <div className="rounded-2xl bg-card shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3">Value</th>
                          <th className="px-4 py-3">Effective from</th>
                          <th className="px-4 py-3">Until</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benefits.map((b) => (
                          <tr key={b.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 capitalize">{b.type}</td>
                            <td className="px-4 py-3 text-muted-foreground">{b.description ?? '—'}</td>
                            <td className="px-4 py-3 font-mono tabular-nums">{b.value} {b.valueType === 'percent' ? '%' : ''}</td>
                            <td className="px-4 py-3 font-mono text-xs">{b.effectiveFrom}</td>
                            <td className="px-4 py-3 font-mono text-xs">{b.effectiveTo ?? 'Ongoing'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Documents */}
      {tab === 'documents' && (
        <div className="space-y-4">
          {canManageEmployee && (
            <div className="rounded-2xl bg-card p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Upload document</h2>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Type</label>
                  <select value={docForm.type} onChange={(e) => setDocForm((f) => ({ ...f, type: e.target.value, label: '' }))}
                    className={`${fieldClass} w-40`}>
                    {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {docForm.type === 'certificate' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">Certificate name</label>
                    <input value={docForm.label} onChange={(e) => setDocForm((f) => ({ ...f, label: e.target.value }))}
                      placeholder="e.g. AWS Certified Developer" className={`${fieldClass} w-56`} />
                  </div>
                )}
                {docForm.type === 'other' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">Specify type</label>
                    <input value={docForm.label} onChange={(e) => setDocForm((f) => ({ ...f, label: e.target.value }))}
                      placeholder="e.g. Vaccination card" className={`${fieldClass} w-56`} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Expiry date (optional)</label>
                  <input type="date" value={docForm.expiryDate}
                    onChange={(e) => setDocForm((f) => ({ ...f, expiryDate: e.target.value }))}
                    className={`${fieldClass} w-40`} />
                </div>
                <label className={`inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors ${docUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  {docUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  Choose file
                  <input
                    type="file"
                    accept={DOC_ACCEPT.join(',')}
                    className="hidden"
                    disabled={docUploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadDocument(f); e.target.value = ''; }}
                  />
                </label>
              </div>
              {docError && <p className="text-sm text-danger">{docError}</p>}
            </div>
          )}

          <div className="rounded-2xl bg-card shadow-sm overflow-hidden">
            {docsLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading documents…
              </div>
            ) : documents.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">
                No documents uploaded yet. Upload one to get started.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">Expiry</th>
                    <th className="px-4 py-3">Uploaded</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => {
                    const expired = d.expiryDate ? new Date(d.expiryDate) < new Date() : false;
                    const soon = d.expiryDate && !expired
                      ? (new Date(d.expiryDate).getTime() - Date.now()) / 86400000 <= 30
                      : false;
                    return (
                      <tr key={d.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <span className="capitalize">{d.type}</span>
                          {d.label && <span className="text-muted-foreground"> — {d.label}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => openDocument(d.id)} className="inline-flex items-center gap-1.5 text-foreground hover:text-primary">
                            {d.mimeType.startsWith('image/') ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                            {d.fileName}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {d.expiryDate ? (
                            <span className={`rounded-md px-2 py-0.5 text-xs ${expired ? 'bg-danger/15 text-danger' : soon ? 'bg-warning/15 text-warning' : 'text-muted-foreground'}`}>
                              {d.expiryDate}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          {canManageEmployee && (
                            <button onClick={() => handleDeleteDocument(d.id)} disabled={docDeletingId === d.id}
                              className="text-danger hover:text-danger/80" aria-label="Delete document">
                              {docDeletingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Education */}
      {tab === 'education' && (
        <div className="space-y-4">
          {canManageEmployee && (
            <form onSubmit={handleAddEducation} className="rounded-2xl bg-card p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Add education</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Degree</label>
                  <select value={eduForm.degree} onChange={(e) => setEduForm((f) => ({ ...f, degree: e.target.value }))} className={fieldClass}>
                    {DEGREES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground">Institution</label>
                  <input required value={eduForm.institution} onChange={(e) => setEduForm((f) => ({ ...f, institution: e.target.value }))} className={fieldClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Field of study</label>
                  <input value={eduForm.fieldOfStudy} onChange={(e) => setEduForm((f) => ({ ...f, fieldOfStudy: e.target.value }))} className={fieldClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Result</label>
                  <input value={eduForm.result} onChange={(e) => setEduForm((f) => ({ ...f, result: e.target.value }))} className={fieldClass} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">Start year</label>
                    <input type="number" value={eduForm.startYear} onChange={(e) => setEduForm((f) => ({ ...f, startYear: e.target.value }))} className={fieldClass} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted-foreground">End year</label>
                    <input type="number" value={eduForm.endYear} onChange={(e) => setEduForm((f) => ({ ...f, endYear: e.target.value }))} className={fieldClass} placeholder="Ongoing" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">Note</label>
                <textarea value={eduForm.note} onChange={(e) => setEduForm((f) => ({ ...f, note: e.target.value }))} rows={2} className={fieldClass} />
              </div>
              {eduError && <p className="text-sm text-danger">{eduError}</p>}
              <Button type="submit" size="sm" disabled={eduSaving}>
                {eduSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Add education
              </Button>
            </form>
          )}

          <div className="rounded-2xl bg-card shadow-sm overflow-hidden">
            {eduLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading education history…
              </div>
            ) : education.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">
                No education history recorded. Add the employee&apos;s academic background above.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Degree</th>
                    <th className="px-4 py-3">Institution</th>
                    <th className="px-4 py-3">Field of study</th>
                    <th className="px-4 py-3">Years</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {education.map((row) => editingEducationId === row.id ? (
                    <tr key={row.id} className="border-b border-border last:border-0 bg-muted/30">
                      <td className="px-4 py-2">
                        <select value={editEduForm.degree} onChange={(e) => setEditEduForm((f) => ({ ...f, degree: e.target.value }))} className={`${fieldClass} text-xs`}>
                          {DEGREES.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input value={editEduForm.institution} onChange={(e) => setEditEduForm((f) => ({ ...f, institution: e.target.value }))} className={`${fieldClass} text-xs`} />
                      </td>
                      <td className="px-4 py-2">
                        <input value={editEduForm.fieldOfStudy} onChange={(e) => setEditEduForm((f) => ({ ...f, fieldOfStudy: e.target.value }))} className={`${fieldClass} text-xs`} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <input type="number" value={editEduForm.startYear} onChange={(e) => setEditEduForm((f) => ({ ...f, startYear: e.target.value }))} className={`${fieldClass} text-xs w-16`} />
                          <input type="number" value={editEduForm.endYear} onChange={(e) => setEditEduForm((f) => ({ ...f, endYear: e.target.value }))} className={`${fieldClass} text-xs w-16`} />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input value={editEduForm.result} onChange={(e) => setEditEduForm((f) => ({ ...f, result: e.target.value }))} className={`${fieldClass} text-xs`} />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <Button size="sm" onClick={() => handleSaveEducation(row.id)} disabled={eduSaving}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingEducationId(null)}>Cancel</Button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 capitalize">{row.degree}</td>
                      <td className="px-4 py-3">{row.institution}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.fieldOfStudy ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.startYear ?? '—'}–{row.endYear ?? 'present'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.result ?? '—'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canManageEmployee && (
                          <>
                            <button onClick={() => startEditEducation(row)} className="text-muted-foreground hover:text-primary mr-2" aria-label="Edit education record">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDeleteEducation(row.id)} className="text-danger hover:text-danger/80" aria-label="Delete education record">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Work History */}
      {tab === 'workHistory' && (
        <div className="space-y-4">
          {canManageEmployee && (
            <form onSubmit={handleAddPreviousEmployment} className="rounded-2xl bg-card p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Add previous employment</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Company</label>
                  <input required value={workForm.companyName} onChange={(e) => setWorkForm((f) => ({ ...f, companyName: e.target.value }))} className={fieldClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">Designation</label>
                  <input value={workForm.designation} onChange={(e) => setWorkForm((f) => ({ ...f, designation: e.target.value }))} className={fieldClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">From date</label>
                  <input required type="date" value={workForm.fromDate} onChange={(e) => setWorkForm((f) => ({ ...f, fromDate: e.target.value }))} className={fieldClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">To date</label>
                  <input type="date" value={workForm.toDate} onChange={(e) => setWorkForm((f) => ({ ...f, toDate: e.target.value }))} className={fieldClass} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">Reason for leaving</label>
                <input value={workForm.reasonForLeaving} onChange={(e) => setWorkForm((f) => ({ ...f, reasonForLeaving: e.target.value }))} className={fieldClass} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">Note</label>
                <textarea value={workForm.note} onChange={(e) => setWorkForm((f) => ({ ...f, note: e.target.value }))} rows={2} className={fieldClass} />
              </div>
              {workError && <p className="text-sm text-danger">{workError}</p>}
              <Button type="submit" size="sm" disabled={workSaving}>
                {workSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Add record
              </Button>
            </form>
          )}

          <div className="rounded-2xl bg-card shadow-sm overflow-hidden">
            {workLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading work history…
              </div>
            ) : prevEmployment.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">
                No previous employment recorded.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Designation</th>
                    <th className="px-4 py-3">From – To</th>
                    <th className="px-4 py-3">Reason for leaving</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {prevEmployment.map((row) => editingPrevId === row.id ? (
                    <tr key={row.id} className="border-b border-border last:border-0 bg-muted/30">
                      <td className="px-4 py-2">
                        <input value={editWorkForm.companyName} onChange={(e) => setEditWorkForm((f) => ({ ...f, companyName: e.target.value }))} className={`${fieldClass} text-xs`} />
                      </td>
                      <td className="px-4 py-2">
                        <input value={editWorkForm.designation} onChange={(e) => setEditWorkForm((f) => ({ ...f, designation: e.target.value }))} className={`${fieldClass} text-xs`} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <input type="date" value={editWorkForm.fromDate} onChange={(e) => setEditWorkForm((f) => ({ ...f, fromDate: e.target.value }))} className={`${fieldClass} text-xs`} />
                          <input type="date" value={editWorkForm.toDate} onChange={(e) => setEditWorkForm((f) => ({ ...f, toDate: e.target.value }))} className={`${fieldClass} text-xs`} />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input value={editWorkForm.reasonForLeaving} onChange={(e) => setEditWorkForm((f) => ({ ...f, reasonForLeaving: e.target.value }))} className={`${fieldClass} text-xs`} />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <Button size="sm" onClick={() => handleSavePreviousEmployment(row.id)} disabled={workSaving}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingPrevId(null)}>Cancel</Button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{row.companyName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.designation ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.fromDate} – {row.toDate ?? 'present'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.reasonForLeaving ?? '—'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canManageEmployee && (
                          <>
                            <button onClick={() => startEditPreviousEmployment(row)} className="text-muted-foreground hover:text-primary mr-2" aria-label="Edit previous employment record">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDeletePreviousEmployment(row.id)} className="text-danger hover:text-danger/80" aria-label="Delete previous employment record">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SalaryCard({ structure: s }: { structure: SalaryStructure }) {
  const [expanded, setExpanded] = useState(false);
  const earnings = s.lines?.filter((l) => l.component.type === 'earning') ?? [];
  const deductions = s.lines?.filter((l) => l.component.type === 'deduction') ?? [];

  return (
    <div className="rounded-2xl bg-card shadow-sm overflow-hidden">
      <div className="p-5 flex items-center justify-between border-b border-border">
        <div className="flex gap-8">
          <Stat label="Basic" value={fmt(s.basicAmount, s.currency)} />
          <Stat label="Gross" value={fmt(s.grossAmount, s.currency)} />
          <Stat label="CTC" value={fmt(s.ctcAmount, s.currency)} />
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Effective from</div>
          <div className="font-mono text-sm">{s.effectiveFrom}</div>
        </div>
      </div>
      <button
        className="w-full px-5 py-2.5 text-left text-xs text-primary hover:bg-primary-soft/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? '▲ Hide breakdown' : '▼ Show full breakdown'}
      </button>
      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          {earnings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Earnings</p>
              {earnings.map((l) => (
                <div key={l.id} className="flex justify-between text-sm py-0.5">
                  <span>{l.component.name}</span>
                  <span className="font-mono tabular-nums text-success">
                    + {Number(l.computedAmount).toLocaleString()} {s.currency}
                  </span>
                </div>
              ))}
            </div>
          )}
          {deductions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Deductions</p>
              {deductions.map((l) => (
                <div key={l.id} className="flex justify-between text-sm py-0.5">
                  <span>{l.component.name}</span>
                  <span className="font-mono tabular-nums text-danger">
                    − {Number(l.computedAmount).toLocaleString()} {s.currency}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-sm text-foreground ${mono ? 'font-mono' : 'tabular-nums'}`}>{value}</dd>
    </div>
  );
}

function fmt(amount: string, currency: string) {
  return `${Number(amount).toLocaleString()} ${currency}`;
}

function statusColor(s: string) {
  const m: Record<string, string> = {
    probation: 'bg-warning/15 text-warning',
    confirmed: 'bg-success/15 text-success',
    notice_period: 'bg-info/15 text-info',
    terminated: 'bg-danger/15 text-danger',
    resigned: 'bg-danger/15 text-danger',
  };
  return m[s] ?? 'bg-muted text-muted-foreground';
}

function probationColor(s: string) {
  const m: Record<string, string> = {
    in_probation: 'bg-warning/15 text-warning',
    confirmed: 'bg-success/15 text-success',
    extended: 'bg-info/15 text-info',
    failed: 'bg-danger/15 text-danger',
  };
  return m[s] ?? 'bg-muted text-muted-foreground';
}

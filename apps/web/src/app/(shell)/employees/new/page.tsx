'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';

interface Dept { id: string; name: string; code: string; }
interface Desig { id: string; title: string; }

export default function NewEmployeePage() {
  const router = useRouter();
  const [depts, setDepts] = useState<Dept[]>([]);
  const [desigs, setDesigs] = useState<Desig[]>([]);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', joinDate: '',
    employmentType: 'probation', departmentId: '', designationId: '',
    gender: '', dob: '', phone: '', address: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Dept[]>('/departments').then(setDepts).catch(() => {});
    api.get<Desig[]>('/designations').then(setDesigs).catch(() => {});
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body: Record<string, string> = {
        firstName: form.firstName, lastName: form.lastName,
        email: form.email, joinDate: form.joinDate,
        employmentType: form.employmentType,
      };
      if (form.departmentId) body.departmentId = form.departmentId;
      if (form.designationId) body.designationId = form.designationId;
      if (form.gender) body.gender = form.gender;
      body.dob = form.dob;
      if (form.phone) body.phone = form.phone;
      body.address = form.address;
      const emp = await api.post<{ id: string }>('/employees', body);
      router.push(`/employees/${emp.id}`);
    } catch (err: unknown) {
      const msg = (err as { message?: string | string[] })?.message ?? 'Failed to create employee.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  }

  const field = 'block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        breadcrumb={[{ label: 'Employees', href: '/employees' }]}
        title="Add employee"
        description="Create an employee record and provision their login."
      />
      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-card p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          {[['First name', 'firstName', 'text'], ['Last name', 'lastName', 'text']].map(([label, key, type]) => (
            <div key={key} className="space-y-1.5">
              <label className="block text-sm font-medium text-muted-foreground">{label}</label>
              <input required type={type} value={form[key as keyof typeof form]}
                onChange={(e) => set(key, e.target.value)} className={field} />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-muted-foreground">Work email</label>
          <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={field} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted-foreground">Join date</label>
            <input required type="date" value={form.joinDate} onChange={(e) => set('joinDate', e.target.value)} className={field} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted-foreground">Employment type</label>
            <select value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)} className={field}>
              {['permanent', 'contract', 'intern', 'probation'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted-foreground">Department</label>
            <select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)} className={field}>
              <option value="">— none —</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted-foreground">Designation</label>
            <select value={form.designationId} onChange={(e) => set('designationId', e.target.value)} className={field}>
              <option value="">— none —</option>
              {desigs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted-foreground">Gender</label>
            <select value={form.gender} onChange={(e) => set('gender', e.target.value)} className={field}>
              <option value="">— not specified —</option>
              {['male', 'female', 'other'].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-muted-foreground">Date of birth</label>
            <input required type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} className={field} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-muted-foreground">Phone</label>
          <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={field} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-muted-foreground">Address</label>
          <textarea required rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} className={field} />
        </div>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-60">
            {loading ? 'Creating…' : 'Create employee'}
          </button>
        </div>
      </form>
    </div>
  );
}

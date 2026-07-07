'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Search, Plus, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  status: string;
  employmentStatus: string;
  employmentType: string;
  joinDate: string;
  department?: { name: string };
  designation?: { title: string };
  user?: { email: string };
}

interface PageResult {
  data: Employee[];
  total: number;
  page: number;
  limit: number;
}

export default function EmployeesPage() {
  const [result, setResult] = useState<PageResult | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const data = await api.get<PageResult>(`/employees?${params}`);
      setResult(data);
    } catch {
      setError('Failed to load employees.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = result ? Math.ceil(result.total / result.limit) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-foreground">Employees</h1>
        <Link
          href="/employees/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add employee
        </Link>
      </div>

      <div className="rounded-2xl bg-card shadow-sm">
        {/* Search bar */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search by name, code, or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {error && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-danger">{error}</td></tr>
              )}
              {!loading && !error && result?.data.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No employees found. Add your first employee to get started.</td></tr>
              )}
              {!loading && !error && result?.data.map((emp) => (
                <tr key={emp.id} className="border-b border-border last:border-0 hover:bg-primary-soft/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{emp.employeeCode}</td>
                  <td className="px-4 py-3">
                    <Link href={`/employees/${emp.id}`} className="font-medium text-foreground hover:text-primary">
                      {emp.firstName} {emp.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.user?.email ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.department?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.designation?.title ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize">{emp.employmentType}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={emp.employmentStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/employees/${emp.id}`}
                      aria-label={`Edit ${emp.firstName} ${emp.lastName}`}
                      className="inline-flex rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>{result?.total} total</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
                aria-label="Previous page"
                className="rounded p-1 hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
                aria-label="Next page"
                className="rounded p-1 hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    probation: 'bg-warning/15 text-warning',
    confirmed: 'bg-success/15 text-success',
    notice_period: 'bg-info/15 text-info',
    terminated: 'bg-danger/15 text-danger',
    resigned: 'bg-danger/15 text-danger',
  };
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs capitalize ${map[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

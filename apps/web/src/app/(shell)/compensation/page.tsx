'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Wallet, Sliders, Users, Download, Loader2, Search } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { api, downloadFile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EmployeeMatch {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department?: { name: string };
}

export default function CompensationPage() {
  const { hasPermission } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<EmployeeMatch[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (search.trim().length < 2) {
      setMatches([]);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(() => {
      api.get<{ data: EmployeeMatch[] }>(`/employees?search=${encodeURIComponent(search)}&limit=5`)
        .then((r) => setMatches(r.data))
        .catch(() => setMatches([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadFile('/reports/export/salary-summary?format=xlsx', 'salary-summary.xlsx');
    } finally {
      setExporting(false);
    }
  }

  const cards = [
    {
      href: '/compensation/components',
      icon: Sliders,
      title: 'Salary Components',
      description: 'Define earnings (Basic, HRA, allowances) and deductions used in salary structures.',
    },
    {
      href: '/employees',
      icon: Users,
      title: 'Employee Salary Structures',
      description: 'View or assign salary structures to employees from their profile page.',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Compensation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage salary components and employee compensation structures.
          </p>
        </div>
        {hasPermission('exports.finance') && (
          <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
            Export Salary Summary
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <label htmlFor="comp-employee-search" className="text-sm font-medium text-foreground">
          Set or review an employee&apos;s salary
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Find an employee by name or code to jump straight to their compensation record.
        </p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="comp-employee-search"
            placeholder="Search employees…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search.trim().length >= 2 && (
          <div className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border">
            {searching ? (
              <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
              </div>
            ) : matches.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">No employees match &quot;{search}&quot;.</p>
            ) : (
              matches.map((m) => (
                <Link
                  key={m.id}
                  href={`/employees/${m.id}?tab=compensation`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-primary-soft/30"
                >
                  <span className="font-medium text-foreground">{m.firstName} {m.lastName}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {m.employeeCode}{m.department ? ` · ${m.department.name}` : ''}
                  </span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href}>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary hover:bg-primary-soft/30 cursor-pointer h-full">
              <Icon className="mb-3 h-8 w-8 text-primary" />
              <h2 className="font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

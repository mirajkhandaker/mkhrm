'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';
import { AlertCircle, Clock, Users, Wallet, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProbationRecord {
  id: string;
  expectedConfirmationDate: string;
  probationMonths: number;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string };
}

interface DashboardSummary {
  pendingApprovalsForMe: number;
  employee: { todayStatus: string | null; leaveBalanceAvailable: number; myPendingCount: number } | null;
  manager: { teamPresentToday: number; teamOnLeaveToday: number } | null;
  hr: { totalEmployees: number; onLeaveToday: number; confirmationsDue: number } | null;
  finance: { pendingReimbursementsCount: number; pendingReimbursementsTotal: number } | null;
}

const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  present: 'Present', late: 'Late', absent: 'Not clocked in', half_day: 'Half day',
  on_leave: 'On leave', holiday: 'Holiday', weekend: 'Weekend',
};

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [confirmations, setConfirmations] = useState<ProbationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardSummary>('/dashboard/summary').then(setSummary).catch(() => {}).finally(() => setLoading(false));
    if (hasPermission('employee.readAll')) {
      api.get<ProbationRecord[]>('/employees/confirmations-due?days=14').then(setConfirmations).catch(() => {});
    }
  }, [hasPermission]);

  if (loading) {
    return <div className="h-40" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back, {user?.email}.
        </p>
      </div>

      {/* My Day — every user with an employee profile */}
      {summary?.employee && (
        <Section icon={Clock} title="My Day">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Today's Status" value={ATTENDANCE_STATUS_LABEL[summary.employee.todayStatus ?? ''] ?? 'Not recorded'} />
            <StatCard label="Leave Balance" value={summary.employee.leaveBalanceAvailable.toFixed(1)} />
            <StatCard label="My Pending Requests" value={String(summary.employee.myPendingCount)} />
            <StatCard label="Awaiting My Approval" value={String(summary.pendingApprovalsForMe)} highlight={summary.pendingApprovalsForMe > 0} href="/approvals" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link href="/attendance">Attendance</Link></Button>
            <Button variant="outline" size="sm" asChild><Link href="/leave">Leave</Link></Button>
            <Button variant="outline" size="sm" asChild><Link href="/approvals">My Approvals</Link></Button>
          </div>
        </Section>
      )}

      {/* Team Status — managers */}
      {summary?.manager && (
        <Section icon={Users} title="Team Status">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Present Today" value={String(summary.manager.teamPresentToday)} />
            <StatCard label="On Leave Today" value={String(summary.manager.teamOnLeaveToday)} href="/attendance/team" />
          </div>
          <Button variant="outline" size="sm" asChild><Link href="/attendance/team">Team Attendance</Link></Button>
        </Section>
      )}

      {/* Org Metrics — HR */}
      {summary?.hr && (
        <Section icon={AlertCircle} title="Org Metrics">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total Employees" value={String(summary.hr.totalEmployees)} />
            <StatCard label="On Leave Today" value={String(summary.hr.onLeaveToday)} />
            <StatCard label="Confirmations Due" value={String(summary.hr.confirmationsDue)} highlight={summary.hr.confirmationsDue > 0} />
          </div>

          {confirmations.length > 0 && (
            <div className="rounded-2xl bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <AlertCircle className="h-4 w-4 text-warning" />
                <h3 className="text-sm font-semibold text-foreground">Confirmations due in 14 days</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Expected date</th>
                    <th className="px-4 py-3">Months</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmations.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-primary-soft/30">
                      <td className="px-4 py-3">
                        <Link href={`/employees/${p.employee?.id}`} className="font-medium text-foreground hover:text-primary">
                          {p.employee?.firstName} {p.employee?.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.employee?.employeeCode}</td>
                      <td className="px-4 py-3 font-mono text-xs text-warning">{p.expectedConfirmationDate}</td>
                      <td className="px-4 py-3">{p.probationMonths}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* Pending Reimbursements — Finance */}
      {summary?.finance && (
        <Section icon={Wallet} title="Pending Reimbursements">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Claims Awaiting Reimbursement" value={String(summary.finance.pendingReimbursementsCount)} highlight={summary.finance.pendingReimbursementsCount > 0} href="/expenses/reimbursement" />
            <StatCard label="Total Amount" value={`$${summary.finance.pendingReimbursementsTotal.toFixed(2)}`} />
          </div>
          <Button variant="outline" size="sm" asChild><Link href="/expenses/reimbursement">Go to Reimbursement</Link></Button>
        </Section>
      )}

      {!summary?.employee && !summary?.manager && !summary?.hr && !summary?.finance && (
        <div className="rounded-2xl bg-card p-8 text-center shadow-sm">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">Nothing to show yet — check back once you have activity.</p>
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.FC<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, highlight, href }: { label: string; value: string; highlight?: boolean; href?: string }) {
  const content = (
    <div
      className={cn(
        'rounded-2xl bg-card p-5 shadow-sm',
        highlight ? 'ring-1 ring-warning/40' : '',
        href && 'transition-colors hover:border hover:border-primary hover:bg-primary-soft/30 cursor-pointer',
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${highlight ? 'text-warning' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

'use client';

import { CheckCircle, XCircle, CornerUpLeft, MessageSquare, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface ApprovalStep {
  id: string;
  stepOrder: number;
  approverType: string;
  approverRef: string | null;
  isMandatory: boolean;
}

export interface ApprovalActionItem {
  id: string;
  stepOrder: number;
  actorId: string;
  action: 'approve' | 'reject' | 'return' | 'comment';
  comment: string | null;
  actedAt: string;
  approvedAmount?: string | number | null;
}

export interface ApprovalTimelineProps {
  currentStep: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  steps: ApprovalStep[];
  actions: ApprovalActionItem[];
}

const ACTION_META = {
  approve: { icon: CheckCircle,    label: 'Approved',  color: 'text-success' },
  reject:  { icon: XCircle,        label: 'Rejected',  color: 'text-danger'  },
  return:  { icon: CornerUpLeft,   label: 'Returned',  color: 'text-warning' },
  comment: { icon: MessageSquare,  label: 'Comment',   color: 'text-info'    },
} as const;

function stepLabel(step: ApprovalStep) {
  switch (step.approverType) {
    case 'line_manager':     return 'Line Manager';
    case 'department_head':  return 'Department Head';
    case 'role':             return step.approverRef ?? 'Role';
    case 'specific_user':    return 'Specific Approver';
    default:                 return 'Approver';
  }
}

function stepStatus(
  step: ApprovalStep,
  currentStep: number,
  finalStatus: ApprovalTimelineProps['status'],
  actions: ApprovalActionItem[],
): 'completed' | 'current' | 'upcoming' | 'skipped' {
  const stepActions = actions.filter((a) => a.stepOrder === step.stepOrder);
  const lastAction = stepActions[stepActions.length - 1];

  if (lastAction?.action === 'approve') return 'completed';
  if (lastAction?.action === 'reject')  return 'completed';
  if (step.stepOrder === currentStep && finalStatus === 'pending') return 'current';
  if (finalStatus !== 'pending' && step.stepOrder > currentStep)  return 'skipped';
  return 'upcoming';
}

export function ApprovalTimeline({ currentStep, status, steps, actions }: ApprovalTimelineProps) {
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  return (
    <ol className="relative space-y-0">
      {sorted.map((step, idx) => {
        const ss = stepStatus(step, currentStep, status, actions);
        const stepActions = actions.filter((a) => a.stepOrder === step.stepOrder);
        const isLast = idx === sorted.length - 1;

        return (
          <li key={step.id} className="flex gap-4">
            {/* Timeline rail */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold',
                  ss === 'completed' && 'border-success bg-success text-white',
                  ss === 'current'   && 'border-primary bg-primary text-white',
                  ss === 'upcoming'  && 'border-border bg-card text-muted-foreground',
                  ss === 'skipped'   && 'border-border bg-muted text-muted-foreground opacity-50',
                )}
              >
                {ss === 'completed' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : ss === 'current' ? (
                  <Clock className="h-4 w-4 animate-pulse" />
                ) : (
                  step.stepOrder
                )}
              </div>
              {!isLast && (
                <div className={cn('w-0.5 flex-1 my-1', ss === 'completed' ? 'bg-success' : 'bg-border')} />
              )}
            </div>

            {/* Content */}
            <div className={cn('pb-6 flex-1 min-w-0', isLast && 'pb-0')}>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'text-sm font-medium',
                    ss === 'current' ? 'text-foreground' : 'text-muted-foreground',
                    ss === 'skipped' && 'opacity-50',
                  )}
                >
                  Step {step.stepOrder} — {stepLabel(step)}
                </span>
                {ss === 'current' && (
                  <Badge variant="outline" className="border-warning text-warning text-xs">
                    Awaiting
                  </Badge>
                )}
                {ss === 'skipped' && (
                  <Badge variant="outline" className="text-xs opacity-50">Skipped</Badge>
                )}
              </div>

              {/* Actions taken at this step */}
              {stepActions.map((act) => {
                const meta = ACTION_META[act.action];
                const Icon = meta.icon;
                return (
                  <div
                    key={act.id}
                    className="mt-1 rounded-lg border border-border bg-card p-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-4 w-4 shrink-0', meta.color)} />
                      <span className="font-medium">{meta.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(act.actedAt).toLocaleString()}
                      </span>
                    </div>
                    {act.action === 'approve' && act.approvedAmount != null && (
                      <p className="mt-1.5 text-muted-foreground pl-6 tabular-nums">
                        Approved amount: <span className="font-medium text-foreground">${Number(act.approvedAmount).toFixed(2)}</span>
                      </p>
                    )}
                    {act.comment && (
                      <p className="mt-1.5 text-muted-foreground pl-6">{act.comment}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

import { render, screen } from '@testing-library/react';
import {
  ApprovalTimeline,
  type ApprovalStep,
  type ApprovalActionItem,
} from '@/components/approvals/approval-timeline';

const steps: ApprovalStep[] = [
  { id: 's1', stepOrder: 1, approverType: 'line_manager', approverRef: null, isMandatory: true },
  { id: 's2', stepOrder: 2, approverType: 'role', approverRef: 'Finance', isMandatory: true },
  { id: 's3', stepOrder: 3, approverType: 'department_head', approverRef: null, isMandatory: true },
];

describe('ApprovalTimeline', () => {
  it('renders each step with a resolved approver label', () => {
    render(<ApprovalTimeline currentStep={1} status="pending" steps={steps} actions={[]} />);
    expect(screen.getByText(/Step 1 — Line Manager/)).toBeInTheDocument();
    expect(screen.getByText(/Step 2 — Finance/)).toBeInTheDocument();
    expect(screen.getByText(/Step 3 — Department Head/)).toBeInTheDocument();
  });

  it('marks a completed step, the current step, and shows an approved amount', () => {
    const actions: ApprovalActionItem[] = [
      {
        id: 'a1',
        stepOrder: 1,
        actorId: 'u1',
        action: 'approve',
        comment: 'Looks good',
        actedAt: '2025-01-01T10:00:00Z',
        approvedAmount: 400,
      },
    ];
    render(<ApprovalTimeline currentStep={2} status="pending" steps={steps} actions={actions} />);

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Looks good')).toBeInTheDocument();
    expect(screen.getByText('$400.00')).toBeInTheDocument();
    // Step 2 is the pending/current step
    expect(screen.getByText('Awaiting')).toBeInTheDocument();
  });

  it('renders skipped steps once the approval is finalized', () => {
    const actions: ApprovalActionItem[] = [
      { id: 'a1', stepOrder: 1, actorId: 'u1', action: 'approve', comment: null, actedAt: '2025-01-01T10:00:00Z' },
    ];
    render(<ApprovalTimeline currentStep={1} status="approved" steps={steps} actions={actions} />);
    // steps 2 and 3 are beyond currentStep on a finalized approval → skipped
    expect(screen.getAllByText('Skipped')).toHaveLength(2);
  });
});

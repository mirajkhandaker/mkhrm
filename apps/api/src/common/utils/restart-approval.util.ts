import { ApprovalsService, StartApprovalParams } from '../../modules/approvals/approvals.service';

// Cancels a still-pending approval (no-op if it already finalized) and starts a fresh
// one at step 1 — the single rule behind "editing a request restarts the whole approval
// process," used by every edit path across travel/expense.
export async function restartApproval(
  approvalsService: ApprovalsService,
  params: StartApprovalParams & { previousApprovalId?: string | null },
) {
  const { previousApprovalId, ...startParams } = params;
  if (previousApprovalId) {
    await approvalsService.cancelApproval(previousApprovalId).catch(() => undefined);
  }
  return approvalsService.start(startParams);
}

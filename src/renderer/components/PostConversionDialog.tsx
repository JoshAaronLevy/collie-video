import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import type {
  ReplacementAction,
  ReplacementExecutionAction,
  ReplacementExecutionJobSnapshot,
  ReplacementPlan,
  ReplacementPlanBulkAction,
  ReplacementPlanItem
} from '../../shared/types/replacementWorkflow';
import type { AppSettings } from '../../shared/types/settings';
import { DialogFooter, DialogHeader } from './DialogChrome';
import { ReplacementPlanSummary } from './ReplacementPlanSummary';
import { ReplacementReviewTable } from './ReplacementReviewTable';

const REPLACE_CONFIRMATION = 'REPLACE';
const TRASH_CONFIRMATION = 'Move to Trash';
const TEN_GB_BYTES = 10 * 1024 * 1024 * 1024;

export type PostConversionDialogMode = 'choices' | 'manual-review';

interface PostConversionDialogProps {
  visible: boolean;
  sourceLabel: string | null;
  plan: ReplacementPlan | null;
  settings: AppSettings | null;
  mode: PostConversionDialogMode;
  error: string | null;
  message: string | null;
  isPlanning: boolean;
  isUpdatingActions: boolean;
  isExecuting: boolean;
  progress: ReplacementExecutionJobSnapshot | null;
  percent: number | null;
  executionAction: ReplacementExecutionAction | null;
  onPlanActionChange: (itemId: string, selectedAction: ReplacementAction) => void;
  onPlanBulkAction: (action: ReplacementPlanBulkAction) => void;
  onExecutePlan: (actionOverride: ReplacementExecutionAction | null, typedConfirmation: string | null) => void;
  onCancelExecution: () => void;
  onReviewManually: () => void;
  onLeaveOutputs: () => void;
  onBackToChoices: () => void;
  onHide: () => void;
}

export function PostConversionDialog({
  visible,
  sourceLabel,
  plan,
  settings,
  mode,
  error,
  message,
  isPlanning,
  isUpdatingActions,
  isExecuting,
  progress,
  percent,
  executionAction,
  onPlanActionChange,
  onPlanBulkAction,
  onExecutePlan,
  onCancelExecution,
  onReviewManually,
  onLeaveOutputs,
  onBackToChoices,
  onHide
}: PostConversionDialogProps): ReactElement {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const replaceHighRiskReasons = useMemo(
    () => (plan ? getHighRiskReasons(plan, settings, 'replace-original') : []),
    [plan, settings]
  );
  const trashHighRiskReasons = useMemo(
    () => (plan ? getHighRiskReasons(plan, settings, 'trash-original') : []),
    [plan, settings]
  );
  const selectedHighRiskReasons = useMemo(
    () => (plan ? getHighRiskReasons(plan, settings, null) : []),
    [plan, settings]
  );
  const replaceRequiresConfirmation = replaceHighRiskReasons.length > 0;
  const trashRequiresConfirmation = trashHighRiskReasons.length > 0;
  const selectedRequiresConfirmation = selectedHighRiskReasons.length > 0;
  const directActionCount = plan?.items.filter((item) => isExecutableReplacementItem(item, 'replace-original')).length ?? 0;
  const selectedExecutableCount = plan?.items.filter((item) => isExecutableReplacementItem(item, null)).length ?? 0;
  const isBusy = isPlanning || isUpdatingActions || isExecuting;
  const canReplace = Boolean(
    plan &&
      directActionCount > 0 &&
      !isBusy &&
      (!replaceRequiresConfirmation || typedConfirmation === REPLACE_CONFIRMATION)
  );
  const canTrashOriginals = Boolean(
    plan &&
      directActionCount > 0 &&
      !isBusy &&
      (!trashRequiresConfirmation || typedConfirmation === TRASH_CONFIRMATION)
  );
  const canExecuteSelectedActions = Boolean(
    plan &&
      selectedExecutableCount > 0 &&
      !isBusy &&
      (!selectedRequiresConfirmation || typedConfirmation === getSelectedConfirmationPhrase(plan))
  );
  const confirmationRows = getConfirmationRows({
    mode,
    plan,
    replaceRequiresConfirmation,
    trashRequiresConfirmation,
    selectedRequiresConfirmation
  });
  const confirmationReasons = [
    ...new Set([
      ...replaceHighRiskReasons,
      ...trashHighRiskReasons,
      ...selectedHighRiskReasons
    ])
  ];

  useEffect(() => {
    if (visible) {
      setTypedConfirmation('');
    }
  }, [visible, plan?.id, mode]);

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow={sourceLabel ? `${sourceLabel} Complete` : 'Conversion Complete'}
          title={mode === 'manual-review' ? 'Review Replacement Plan' : 'Conversion Complete'}
          description={
            mode === 'manual-review'
              ? 'Review source files, converted outputs, proposed final paths, and blocked items.'
              : 'What do you want to do with the converted videos?'
          }
        />
      }
      footer={
        isExecuting ? (
          <DialogFooter>
            <Button
              label="Cancel Replacement"
              icon="pi pi-times"
              severity="danger"
              onClick={onCancelExecution}
            />
          </DialogFooter>
        ) : (
          <DialogFooter>
            {mode === 'manual-review' ? (
              <Button label="Back" icon="pi pi-arrow-left" severity="secondary" outlined onClick={onBackToChoices} />
            ) : null}
            <Button
              label="Leave Files Where They Are"
              icon="pi pi-check"
              severity="secondary"
              outlined
              disabled={isBusy}
              onClick={onLeaveOutputs}
            />
            {mode === 'choices' ? (
              <Button
                label="Review Manually"
                icon="pi pi-list-check"
                severity="info"
                outlined
                disabled={!plan || isBusy}
                onClick={onReviewManually}
              />
            ) : null}
            {mode === 'choices' ? (
              <Button
                label="Move Originals to Trash"
                icon="pi pi-trash"
                severity="warning"
                outlined
                disabled={!canTrashOriginals}
                loading={isExecuting && executionAction === 'trash-original'}
                onClick={() => onExecutePlan('trash-original', trashRequiresConfirmation ? typedConfirmation : null)}
              />
            ) : null}
            <Button
              label={mode === 'manual-review' ? 'Execute Selected Actions' : 'Replace Originals'}
              icon="pi pi-sync"
              severity="danger"
              disabled={mode === 'manual-review' ? !canExecuteSelectedActions : !canReplace}
              loading={isExecuting && (mode === 'manual-review' || executionAction === 'replace-original')}
              onClick={() =>
                onExecutePlan(
                  mode === 'manual-review' ? null : 'replace-original',
                  getTypedConfirmationForSubmit({
                    mode,
                    plan,
                    typedConfirmation,
                    replaceRequiresConfirmation,
                    selectedRequiresConfirmation
                  })
                )
              }
            />
          </DialogFooter>
        )
      }
      visible={visible}
      modal
      draggable={false}
      className="app-dialog post-conversion-dialog"
      onHide={() => {
        if (!isBusy) {
          onHide();
        }
      }}
    >
      <div className="post-conversion-content">
        {isPlanning ? <Message severity="info" text="Preparing replacement plan..." /> : null}
        {isExecuting ? (
          <section className="replacement-progress" aria-label="Replacement progress">
            <ProgressBar value={percent ?? 0} />
            <p>{progress?.message ?? getProgressFallback(executionAction)}</p>
            <div className="replacement-progress-counts">
              <Tag
                value={`${(progress?.processedItems ?? 0).toLocaleString()} / ${(progress?.totalItems ?? (selectedExecutableCount || directActionCount)).toLocaleString()}`}
              />
              <Tag
                value={`${(progress?.succeededCount ?? 0).toLocaleString()} ${getSuccessProgressLabel(executionAction)}`}
                severity="success"
              />
              <Tag value={`${(progress?.skippedCount ?? 0).toLocaleString()} skipped`} severity="warning" />
              <Tag value={`${(progress?.failedCount ?? 0).toLocaleString()} failed`} severity="danger" />
            </div>
            <div className="replacement-summary-grid">
              <div>
                <span>Current</span>
                <strong title={progress?.currentFile ?? 'Preparing'}>
                  {progress?.currentFile ?? 'Preparing'}
                </strong>
              </div>
              <div>
                <span>Phase</span>
                <strong>{progress?.phase ?? 'pending'}</strong>
              </div>
            </div>
          </section>
        ) : null}
        {error ? <Message severity="error" text={error} /> : null}
        {message ? <Message severity="info" text={message} /> : null}

        {plan ? (
          <>
            <ReplacementPlanSummary plan={plan} />

            {confirmationRows.length > 0 ? (
              <section className="typed-confirmation-row">
                <span>Typed confirmation required</span>
                <InputText
                  value={typedConfirmation}
                  placeholder={confirmationRows.map((row) => row.phrase).join(' / ')}
                  onChange={(event) => setTypedConfirmation(event.target.value)}
                />
                <small>
                  {confirmationRows.map((row) => `${row.label}: ${row.phrase}`).join('  ')}
                  {confirmationReasons.length > 0 ? ` ${confirmationReasons.join(' ')}` : ''}
                </small>
              </section>
            ) : null}

            {mode === 'choices' ? (
              <>
                <section className="post-conversion-option-grid" aria-label="Post-conversion actions">
                  <button
                    type="button"
                    className="post-conversion-option"
                    disabled={isBusy}
                    onClick={onReviewManually}
                  >
                    <span>Review manually</span>
                    <strong>{plan.summary.warning + plan.summary.blocked > 0 ? 'Recommended' : 'Inspect plan'}</strong>
                    <small>Open the itemized plan before deciding what to replace.</small>
                  </button>
                  <button
                    type="button"
                    className="post-conversion-option"
                    disabled={isBusy}
                    onClick={onLeaveOutputs}
                  >
                    <span>Leave files where they are</span>
                    <strong>No file changes</strong>
                    <small>Keep converted videos in the output folder.</small>
                  </button>
                  <button
                    type="button"
                    className="post-conversion-option"
                    disabled={!canTrashOriginals}
                    onClick={() => onExecutePlan('trash-original', trashRequiresConfirmation ? typedConfirmation : null)}
                  >
                    <span>Move originals to Trash</span>
                    <strong>Keep fixed outputs</strong>
                    <small>Move source videos to macOS Trash and leave converted videos in the output folder.</small>
                  </button>
                </section>

                <Message
                  severity={plan.summary.blocked > 0 ? 'warn' : 'info'}
                  text="Replace Originals moves source files to macOS Trash, then moves converted files into the original source folders. Move Originals to Trash leaves converted files in the output folder."
                />
              </>
            ) : (
              <ReplacementReviewTable
                plan={plan}
                isBusy={isBusy}
                canExecute={canExecuteSelectedActions}
                onActionChange={onPlanActionChange}
                onBulkAction={onPlanBulkAction}
                onExecute={() =>
                  onExecutePlan(
                    null,
                    selectedRequiresConfirmation ? typedConfirmation : null
                  )
                }
              />
            )}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

function isExecutableReplacementItem(
  item: ReplacementPlanItem,
  actionOverride: ReplacementExecutionAction | null
): boolean {
  const action = actionOverride ?? item.selectedAction;

  return (
    (action === 'replace-original' || action === 'trash-original') &&
    (item.status === 'ready' || item.status === 'warning')
  );
}

function getHighRiskReasons(
  plan: ReplacementPlan,
  settings: AppSettings | null,
  actionOverride: ReplacementExecutionAction | null
): string[] {
  const reasons: string[] = [];
  const executableItems = plan.items.filter((item) => isExecutableReplacementItem(item, actionOverride));
  const thresholds = getReplacementConfirmationThresholds(settings);

  if (executableItems.length > thresholds.fileCount) {
    reasons.push(`More than ${thresholds.fileCount.toLocaleString()} files are ready to replace.`);
  }

  if (executableItems.reduce((total, item) => total + (item.originalSizeBytes ?? 0), 0) > thresholds.sizeBytes) {
    reasons.push(`Original files total more than ${formatBytes(thresholds.sizeBytes)}.`);
  }

  if (executableItems.some((item) => item.warnings.length > 0)) {
    reasons.push('One or more replacement items has warnings.');
  }

  if (plan.summary.destinationConflicts > 0) {
    reasons.push('One or more destination conflicts was detected.');
  }

  if (executableItems.some((item) => isExternalPath(item.originalPath) || isExternalPath(item.outputPath))) {
    reasons.push('One or more paths appears to be on an external volume.');
  }

  if (executableItems.some((item) => item.warningCodes.includes('extension-changed'))) {
    reasons.push('One or more converted extensions differs from the original.');
  }

  return reasons;
}

function getConfirmationRows({
  mode,
  plan,
  replaceRequiresConfirmation,
  trashRequiresConfirmation,
  selectedRequiresConfirmation
}: {
  mode: PostConversionDialogMode;
  plan: ReplacementPlan | null;
  replaceRequiresConfirmation: boolean;
  trashRequiresConfirmation: boolean;
  selectedRequiresConfirmation: boolean;
}): { label: string; phrase: string }[] {
  if (!plan) {
    return [];
  }

  if (mode === 'manual-review') {
    return selectedRequiresConfirmation
      ? [{ label: 'Execute Selected Actions', phrase: getSelectedConfirmationPhrase(plan) }]
      : [];
  }

  const rows: { label: string; phrase: string }[] = [];

  if (replaceRequiresConfirmation) {
    rows.push({ label: 'Replace Originals', phrase: REPLACE_CONFIRMATION });
  }

  if (trashRequiresConfirmation) {
    rows.push({ label: 'Move Originals to Trash', phrase: TRASH_CONFIRMATION });
  }

  return rows;
}

function getSelectedConfirmationPhrase(plan: ReplacementPlan | null): string {
  if (!plan) {
    return REPLACE_CONFIRMATION;
  }

  return plan.items.some((item) => item.selectedAction === 'replace-original' && isExecutableReplacementItem(item, null))
    ? REPLACE_CONFIRMATION
    : TRASH_CONFIRMATION;
}

function getTypedConfirmationForSubmit({
  mode,
  plan,
  typedConfirmation,
  replaceRequiresConfirmation,
  selectedRequiresConfirmation
}: {
  mode: PostConversionDialogMode;
  plan: ReplacementPlan | null;
  typedConfirmation: string;
  replaceRequiresConfirmation: boolean;
  selectedRequiresConfirmation: boolean;
}): string | null {
  if (mode === 'manual-review') {
    return selectedRequiresConfirmation ? typedConfirmation : null;
  }

  return plan && replaceRequiresConfirmation ? typedConfirmation : null;
}

function getProgressFallback(action: ReplacementExecutionAction | null): string {
  if (action === 'trash-original') {
    return 'Moving originals to Trash...';
  }

  if (action === 'replace-original') {
    return 'Replacing originals with converted files...';
  }

  return 'Executing selected actions...';
}

function getSuccessProgressLabel(action: ReplacementExecutionAction | null): string {
  if (action === 'trash-original') {
    return 'trashed';
  }

  if (action === 'replace-original') {
    return 'replaced';
  }

  return 'completed';
}

function getReplacementConfirmationThresholds(settings: AppSettings | null): { fileCount: number; sizeBytes: number } {
  if (!settings?.requireTypedConfirmationForLargeOperations) {
    return {
      fileCount: 10,
      sizeBytes: TEN_GB_BYTES
    };
  }

  return {
    fileCount: Math.min(10, Math.max(1, settings.typedConfirmationFileCountThreshold)),
    sizeBytes: Math.min(TEN_GB_BYTES, Math.max(1024 * 1024, settings.typedConfirmationSizeThresholdBytes))
  };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(0)} GB`;
  }

  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  }

  return `${bytes.toLocaleString()} B`;
}

function isExternalPath(path: string): boolean {
  return path.startsWith('/Volumes/');
}

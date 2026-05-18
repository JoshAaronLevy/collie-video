import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type {
  ReplacementPlan,
  ReplacementPlanItem
} from '../../shared/types/replacementWorkflow';
import { DialogFooter, DialogHeader } from './DialogChrome';
import { ReplacementPlanSummary } from './ReplacementPlanSummary';

const REPLACE_CONFIRMATION = 'REPLACE';
const TEN_GB_BYTES = 10 * 1024 * 1024 * 1024;

export type PostConversionDialogMode = 'choices' | 'manual-review';

interface PostConversionDialogProps {
  visible: boolean;
  sourceLabel: string | null;
  plan: ReplacementPlan | null;
  mode: PostConversionDialogMode;
  error: string | null;
  message: string | null;
  isPlanning: boolean;
  onReplaceOriginals: (typedConfirmation: string | null) => void;
  onReviewManually: () => void;
  onLeaveOutputs: () => void;
  onBackToChoices: () => void;
  onHide: () => void;
}

export function PostConversionDialog({
  visible,
  sourceLabel,
  plan,
  mode,
  error,
  message,
  isPlanning,
  onReplaceOriginals,
  onReviewManually,
  onLeaveOutputs,
  onBackToChoices,
  onHide
}: PostConversionDialogProps): ReactElement {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const highRiskReasons = useMemo(() => (plan ? getHighRiskReasons(plan) : []), [plan]);
  const requiresConfirmation = highRiskReasons.length > 0;
  const canReplace = Boolean(
    plan &&
      plan.summary.ready > 0 &&
      (!requiresConfirmation || typedConfirmation === REPLACE_CONFIRMATION)
  );
  const reviewItems = plan?.items.slice(0, 12) ?? [];

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
        <DialogFooter>
          {mode === 'manual-review' ? (
            <Button label="Back" icon="pi pi-arrow-left" severity="secondary" outlined onClick={onBackToChoices} />
          ) : null}
          <Button
            label="Leave Files Where They Are"
            icon="pi pi-check"
            severity="secondary"
            outlined
            onClick={onLeaveOutputs}
          />
          {mode === 'choices' ? (
            <Button
              label="Review Manually"
              icon="pi pi-list-check"
              severity="info"
              outlined
              disabled={!plan}
              onClick={onReviewManually}
            />
          ) : null}
          <Button
            label="Replace Originals"
            icon="pi pi-sync"
            severity="danger"
            disabled={!canReplace}
            onClick={() => onReplaceOriginals(requiresConfirmation ? typedConfirmation : null)}
          />
        </DialogFooter>
      }
      visible={visible}
      modal
      draggable={false}
      className="app-dialog post-conversion-dialog"
      onHide={onHide}
    >
      <div className="post-conversion-content">
        {isPlanning ? <Message severity="info" text="Preparing replacement plan..." /> : null}
        {error ? <Message severity="error" text={error} /> : null}
        {message ? <Message severity="info" text={message} /> : null}

        {plan ? (
          <>
            <ReplacementPlanSummary plan={plan} />

            {mode === 'choices' ? (
              <>
                <section className="post-conversion-option-grid" aria-label="Post-conversion actions">
                  <button type="button" className="post-conversion-option" onClick={onReviewManually}>
                    <span>Review manually</span>
                    <strong>{plan.summary.warning + plan.summary.blocked > 0 ? 'Recommended' : 'Inspect plan'}</strong>
                    <small>Open the itemized plan before deciding what to replace.</small>
                  </button>
                  <button type="button" className="post-conversion-option" onClick={onLeaveOutputs}>
                    <span>Leave files where they are</span>
                    <strong>No file changes</strong>
                    <small>Keep converted videos in the output folder.</small>
                  </button>
                </section>

                <Message
                  severity={plan.summary.blocked > 0 ? 'warn' : 'info'}
                  text="Replace originals with converted files moves original files to Trash or archive, then moves converted files into the original source folders."
                />

                {highRiskReasons.length > 0 ? (
                  <section className="typed-confirmation-row">
                    <span>Type {REPLACE_CONFIRMATION} to confirm</span>
                    <InputText
                      value={typedConfirmation}
                      placeholder={REPLACE_CONFIRMATION}
                      onChange={(event) => setTypedConfirmation(event.target.value)}
                    />
                    <small>{highRiskReasons.join(' ')}</small>
                  </section>
                ) : null}
              </>
            ) : (
              <section className="replacement-review-list" aria-label="Replacement plan items">
                <h3>Plan Items</h3>
                <ul>
                  {reviewItems.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong title={item.originalPath}>{item.originalFileName}</strong>
                        <Tag value={item.status} severity={getStatusSeverity(item)} />
                      </div>
                      <span title={item.outputPath}>{item.outputFileName}</span>
                      <code title={item.proposedFinalPath}>{item.proposedFinalPath || 'No final path'}</code>
                      {[...item.warnings, ...item.errors].length > 0 ? (
                        <small>{[...item.warnings, ...item.errors].join(' ')}</small>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

function getHighRiskReasons(plan: ReplacementPlan): string[] {
  const reasons: string[] = [];

  if (plan.summary.ready > 10) {
    reasons.push('More than 10 files are ready to replace.');
  }

  if (plan.summary.totalOriginalSizeBytes > TEN_GB_BYTES) {
    reasons.push('Original files total more than 10 GB.');
  }

  if (plan.summary.warning > 0) {
    reasons.push('One or more replacement items has warnings.');
  }

  if (plan.summary.destinationConflicts > 0) {
    reasons.push('One or more destination conflicts was detected.');
  }

  if (plan.items.some((item) => isExternalPath(item.originalPath) || isExternalPath(item.outputPath))) {
    reasons.push('One or more paths appears to be on an external volume.');
  }

  if (plan.items.some((item) => item.warningCodes.includes('extension-changed'))) {
    reasons.push('One or more converted extensions differs from the original.');
  }

  return reasons;
}

function getStatusSeverity(item: ReplacementPlanItem): 'success' | 'info' | 'warning' | 'danger' {
  if (item.status === 'ready') {
    return 'success';
  }

  if (item.status === 'warning') {
    return 'warning';
  }

  return 'danger';
}

function isExternalPath(path: string): boolean {
  return path.startsWith('/Volumes/');
}

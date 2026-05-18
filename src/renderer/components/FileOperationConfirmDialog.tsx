import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type { TrashOperationPlan } from '../../shared/types/fileOperations';
import { DialogFooter, DialogHeader } from './DialogChrome';

interface FileOperationConfirmDialogProps {
  visible: boolean;
  plan: TrashOperationPlan | null;
  error: string | null;
  isSubmitting: boolean;
  onConfirm: (typedConfirmation: string | null) => void;
  onHide: () => void;
}

export function FileOperationConfirmDialog({
  visible,
  plan,
  error,
  isSubmitting,
  onConfirm,
  onHide
}: FileOperationConfirmDialogProps): ReactElement {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const executableCount = plan ? plan.summary.ready + plan.summary.warning : 0;
  const typedConfirmationMatches = typedConfirmation === plan?.confirmation.phrase;
  const canConfirm = Boolean(plan && executableCount > 0 && (!plan.confirmation.isRequired || typedConfirmationMatches));
  const attentionItems = useMemo(
    () => plan?.items.filter((item) => item.status !== 'ready').slice(0, 6) ?? [],
    [plan]
  );

  useEffect(() => {
    if (visible) {
      setTypedConfirmation('');
    }
  }, [visible, plan?.id]);

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow="File Management"
          title="Move to Trash"
          description="Review the selected files before moving recoverable items to macOS Trash."
        />
      }
      footer={
        <DialogFooter
          left={plan ? `${executableCount.toLocaleString()} file(s) eligible` : undefined}
        >
          <Button label="Cancel" icon="pi pi-times" severity="secondary" outlined onClick={onHide} />
          <Button
            label="Move to Trash"
            icon="pi pi-trash"
            severity="danger"
            loading={isSubmitting}
            disabled={!canConfirm}
            onClick={() => onConfirm(plan?.confirmation.isRequired ? typedConfirmation : null)}
          />
        </DialogFooter>
      }
      visible={visible}
      modal
      draggable={false}
      className="app-dialog file-operation-dialog"
      onHide={onHide}
    >
      <div className="file-operation-content">
        {error ? <Message severity="error" text={error} /> : null}
        {plan ? (
          <>
            <section className="file-operation-summary-grid" aria-label="Trash plan summary">
              <Metric label="Selected" value={plan.summary.total.toLocaleString()} />
              <Metric label="Ready" value={plan.summary.ready.toLocaleString()} />
              <Metric label="Warnings" value={plan.summary.warning.toLocaleString()} />
              <Metric label="Blocked" value={plan.summary.blocked.toLocaleString()} />
              <Metric label="Size" value={formatBytes(plan.summary.totalSizeBytes)} />
            </section>

            {plan.confirmation.reasons.length > 0 ? (
              <Message
                severity="warn"
                text={`Extra confirmation required: ${plan.confirmation.reasons.join(' ')}`}
              />
            ) : null}

            {plan.confirmation.isRequired ? (
              <label className="typed-confirmation-row">
                <span>Type {plan.confirmation.phrase} to confirm</span>
                <InputText
                  value={typedConfirmation}
                  placeholder={plan.confirmation.phrase}
                  onChange={(event) => setTypedConfirmation(event.target.value)}
                />
              </label>
            ) : null}

            {attentionItems.length > 0 ? (
              <section className="file-operation-attention-list" aria-label="Items needing attention">
                <h3>Needs Attention</h3>
                <ul>
                  {attentionItems.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong title={item.sourcePath}>{item.fileName}</strong>
                        <Tag value={item.status} severity={item.status === 'warning' ? 'warning' : 'danger'} />
                      </div>
                      <small>{[...item.warnings, ...item.errors].join(' ')}</small>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }

  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  return `${bytes.toLocaleString()} B`;
}

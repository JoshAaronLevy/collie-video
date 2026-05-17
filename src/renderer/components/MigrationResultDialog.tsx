import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import type {
  MigrationResult,
  MigrationResultItem,
  MigrationScanResult
} from '../../shared/types/migration';

interface MigrationResultDialogProps {
  visible: boolean;
  result: MigrationResult | null;
  scan: MigrationScanResult | null;
  error: string | null;
  onHide: () => void;
  onRevealPath: (path: string) => void;
}

export function MigrationResultDialog({
  visible,
  result,
  scan,
  error,
  onHide,
  onRevealPath
}: MigrationResultDialogProps): ReactElement {
  const failedItems = result?.items.filter((item) => item.status === 'failed') ?? [];
  const archiveRunDir = result?.archiveRunDir ?? scan?.archiveRunDir ?? null;
  const footer = (
    <div className="dialog-actions">
      {archiveRunDir ? (
        <Button
          label="Reveal Archive"
          icon="pi pi-folder-open"
          severity="help"
          onClick={() => onRevealPath(archiveRunDir)}
        />
      ) : null}
      <Button label="Close" icon="pi pi-check" severity="info" onClick={onHide} />
    </div>
  );

  return (
    <Dialog
      header={result ? 'Migration Complete' : 'Migration Result'}
      visible={visible}
      modal
      draggable={false}
      className="migration-result-dialog"
      footer={footer}
      onHide={onHide}
    >
      <div className="migration-dialog-content">
        {result ? (
          <>
            <Message
              severity={result.summary.failedItems > 0 ? 'warn' : 'success'}
              text="New edited files were copied. Old matching destination files were archived, not deleted."
            />

            <div className="migration-summary-grid">
              <SummaryMetric label="Copied" value={result.summary.filesCopiedToDestination.toLocaleString()} />
              <SummaryMetric label="Archived" value={result.summary.destinationMatchesArchived.toLocaleString()} />
              <SummaryMetric label="Failed" value={result.summary.failedItems.toLocaleString()} />
              <SummaryMetric label="No previous match" value={result.summary.filesWithNoMatches.toLocaleString()} />
              <SummaryMetric label="New bytes copied" value={formatBytes(result.summary.newBytesCopied)} />
              <SummaryMetric label="Old bytes archived" value={formatBytes(result.summary.oldBytesArchived)} />
              <SummaryMetric label="Active file delta" value={formatSignedInteger(result.summary.netActiveFileDelta)} />
              <SummaryMetric label="Active storage delta" value={formatSignedBytes(result.summary.netActiveBytesDelta)} />
            </div>

            <div className="migration-result-paths">
              {archiveRunDir ? (
                <PathRow label="Archive folder" value={archiveRunDir} onRevealPath={onRevealPath} />
              ) : null}
              {result.manifestPath ? (
                <PathRow label="Manifest" value={result.manifestPath} onRevealPath={onRevealPath} />
              ) : null}
              {result.operationLogPath ? (
                <PathRow label="Operation log" value={result.operationLogPath} onRevealPath={onRevealPath} />
              ) : null}
            </div>

            <Message
              severity="info"
              text="Actual drive space is not reclaimed until you manually review and delete the archive folder."
            />

            {failedItems.length > 0 ? (
              <div className="migration-failed-items">
                <h3>Failures</h3>
                <DataTable
                  value={failedItems}
                  dataKey="sourcePath"
                  rows={6}
                  paginator
                  size="small"
                  className="migration-failed-table"
                >
                  <Column field="fileName" header="File" />
                  <Column header="Details" body={failedDetailsTemplate} />
                </DataTable>
              </div>
            ) : null}
          </>
        ) : null}

        {error ? <Message severity="error" text={error} /> : null}
      </div>
    </Dialog>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function PathRow({
  label,
  value,
  onRevealPath
}: {
  label: string;
  value: string;
  onRevealPath: (path: string) => void;
}): ReactElement {
  return (
    <div className="migration-result-path-row">
      <div>
        <span>{label}</span>
        <code title={value}>{value}</code>
      </div>
      <Button
        aria-label={`Reveal ${label}`}
        icon="pi pi-folder-open"
        severity="secondary"
        text
        rounded
        onClick={() => onRevealPath(value)}
      />
    </div>
  );
}

function failedDetailsTemplate(item: MigrationResultItem): ReactElement {
  return (
    <div className="migration-failed-item">
      <strong>{item.fileName}</strong>
      <small>{item.error ?? 'Migration item failed.'}</small>
      {item.warnings && item.warnings.length > 0 ? <small>{item.warnings.join(' ')}</small> : null}
    </div>
  );
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatSignedInteger(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toLocaleString()}`;
}

function formatSignedBytes(value: number): string {
  const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${prefix}${formatBytes(Math.abs(value))}`;
}

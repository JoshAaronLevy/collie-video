import { useMemo, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type {
  OperationHistoryItemRecord,
  OperationHistoryRecord,
  OperationHistoryStatus
} from '../../shared/types/operationHistory';
import type { FileOperationExecutionStatus, FileOperationType } from '../../shared/types/fileOperations';
import { DialogFooter, DialogHeader } from './DialogChrome';

interface OperationHistoryDialogProps {
  visible: boolean;
  records: OperationHistoryRecord[];
  selectedRecord: OperationHistoryRecord | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectRecord: (operationId: string) => void;
  onRevealPath: (path: string) => void;
  onHide: () => void;
}

type TagSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary';

export function OperationHistoryDialog({
  visible,
  records,
  selectedRecord,
  isLoading,
  error,
  onRefresh,
  onSelectRecord,
  onRevealPath,
  onHide
}: OperationHistoryDialogProps): ReactElement {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const detailRecord = selectedRecord ?? records[0] ?? null;
  const detailLogPath = detailRecord?.logPath ?? null;
  const detailRevealPath = detailRecord ? getRecordRevealPath(detailRecord) : null;
  const recordsHeader = (
    <div className="operation-history-table-header">
      <span>{records.length.toLocaleString()} recent operation(s)</span>
      <Button
        label="Refresh"
        icon="pi pi-refresh"
        severity="secondary"
        outlined
        size="small"
        loading={isLoading}
        onClick={onRefresh}
      />
    </div>
  );
  const summaryText = useMemo(() => (detailRecord ? formatOperationSummary(detailRecord) : ''), [detailRecord]);

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow="File Management"
          title="Operation History"
          description="Review recent trash, move, archive, and replacement operations."
        />
      }
      footer={
        <DialogFooter>
          {detailRecord ? (
            <Button
              label="Copy Summary"
              icon="pi pi-copy"
              severity="secondary"
              outlined
              onClick={() => {
                void copySummary(summaryText, setCopyMessage);
              }}
            />
          ) : null}
          <Button label="Close" icon="pi pi-check" onClick={onHide} />
        </DialogFooter>
      }
      visible={visible}
      modal
      draggable={false}
      className="app-dialog operation-history-dialog"
      onHide={onHide}
    >
      <div className="operation-history-content">
        {error ? <Message severity="error" text={error} /> : null}
        {copyMessage ? <Message severity="success" text={copyMessage} /> : null}

        <DataTable
          value={records}
          dataKey="id"
          header={recordsHeader}
          rows={8}
          paginator={records.length > 8}
          rowsPerPageOptions={[8, 16, 32, 50]}
          sortMode="multiple"
          removableSort
          stripedRows
          size="small"
          loading={isLoading}
          className="operation-history-table"
          emptyMessage="No file operations have been recorded yet."
        >
          <Column field="createdAt" header="Started" sortable body={operationStartedTemplate} style={{ width: '12rem' }} />
          <Column field="type" header="Operation" sortable body={operationTypeTemplate} style={{ width: '12rem' }} />
          <Column field="status" header="Status" sortable body={operationStatusTemplate} style={{ width: '9rem' }} />
          <Column header="Summary" body={operationSummaryTemplate} style={{ width: '18rem' }} />
          <Column
            header="Details"
            body={(record: OperationHistoryRecord) => (
              <Button
                label="Inspect"
                icon="pi pi-list"
                severity={detailRecord?.id === record.id ? 'info' : 'secondary'}
                outlined={detailRecord?.id !== record.id}
                size="small"
                onClick={() => onSelectRecord(record.id)}
              />
            )}
            style={{ width: '8rem' }}
          />
        </DataTable>

        {detailRecord ? (
          <section className="operation-history-details" aria-label="Operation details">
            <div className="operation-history-detail-header">
              <div>
                <span>{formatOperationType(detailRecord.type)}</span>
                <strong>{formatDateTime(detailRecord.createdAt)}</strong>
              </div>
              <Tag value={formatHistoryStatus(detailRecord.status)} severity={getHistoryStatusSeverity(detailRecord.status)} />
            </div>

            <section className="file-operation-summary-grid" aria-label="Operation history summary">
              <Metric label="Requested" value={detailRecord.summary.requested.toLocaleString()} />
              <Metric label="Succeeded" value={detailRecord.summary.succeeded.toLocaleString()} />
              <Metric label="Skipped" value={detailRecord.summary.skipped.toLocaleString()} />
              <Metric label="Failed" value={detailRecord.summary.failed.toLocaleString()} />
              <Metric label="Size" value={formatBytes(detailRecord.summary.totalSizeBytes)} />
              <Metric label="Completed" value={detailRecord.completedAt ? formatDateTime(detailRecord.completedAt) : 'Not complete'} />
            </section>

            <div className="operation-history-path-actions">
              {detailLogPath ? (
                <Button
                  label="Reveal Log"
                  icon="pi pi-file"
                  severity="secondary"
                  outlined
                  size="small"
                  onClick={() => onRevealPath(detailLogPath)}
                />
              ) : null}
              {detailRevealPath ? (
                <Button
                  label="Reveal Result"
                  icon="pi pi-folder-open"
                  severity="secondary"
                  outlined
                  size="small"
                  onClick={() => onRevealPath(detailRevealPath)}
                />
              ) : null}
            </div>

            <DataTable
              value={detailRecord.items}
              dataKey="id"
              rows={10}
              paginator={detailRecord.items.length > 10}
              rowsPerPageOptions={[10, 25, 50, 100]}
              sortMode="multiple"
              removableSort
              stripedRows
              size="small"
              scrollable
              className="operation-history-item-table"
              tableStyle={{ minWidth: '1180px' }}
              emptyMessage="No item results were recorded for this operation."
            >
              <Column field="fileName" header="File" sortable body={itemFileTemplate} style={{ width: '22rem' }} />
              <Column field="operationType" header="Operation" sortable body={itemOperationTemplate} style={{ width: '12rem' }} />
              <Column field="status" header="Status" sortable body={itemStatusTemplate} style={{ width: '9rem' }} />
              <Column header="Paths" body={(item: OperationHistoryItemRecord) => itemPathsTemplate(item, onRevealPath)} style={{ width: '24rem' }} />
              <Column header="Diagnostics" body={itemDiagnosticsTemplate} style={{ width: '22rem' }} />
            </DataTable>
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function operationStartedTemplate(record: OperationHistoryRecord): string {
  return formatDateTime(record.startedAt ?? record.createdAt);
}

function operationTypeTemplate(record: OperationHistoryRecord): string {
  return formatOperationType(record.type);
}

function operationStatusTemplate(record: OperationHistoryRecord): ReactElement {
  return <Tag value={formatHistoryStatus(record.status)} severity={getHistoryStatusSeverity(record.status)} />;
}

function operationSummaryTemplate(record: OperationHistoryRecord): ReactElement {
  return (
    <div className="operation-history-summary-cell">
      <span>{record.summary.succeeded.toLocaleString()} succeeded</span>
      <span>{record.summary.skipped.toLocaleString()} skipped</span>
      <span>{record.summary.failed.toLocaleString()} failed</span>
      <span>{formatBytes(record.summary.totalSizeBytes)}</span>
    </div>
  );
}

function itemFileTemplate(item: OperationHistoryItemRecord): ReactElement {
  return (
    <div className="operation-history-file-cell">
      <strong title={item.sourcePath}>{item.fileName}</strong>
      <code title={item.sourcePath}>{item.sourcePath}</code>
    </div>
  );
}

function itemOperationTemplate(item: OperationHistoryItemRecord): string {
  return formatOperationType(item.operationType);
}

function itemStatusTemplate(item: OperationHistoryItemRecord): ReactElement {
  return <Tag value={formatExecutionStatus(item.status)} severity={getExecutionStatusSeverity(item.status)} />;
}

function itemPathsTemplate(
  item: OperationHistoryItemRecord,
  onRevealPath: (path: string) => void
): ReactElement {
  const paths = [
    { label: 'Source', value: item.sourcePath },
    { label: 'Destination', value: item.destinationPath ?? null },
    { label: 'Output', value: item.outputPath ?? null },
    { label: 'Archive', value: item.archivePath ?? null }
  ].filter((path): path is { label: string; value: string } => Boolean(path.value));

  return (
    <div className="operation-history-path-list">
      {paths.map((path) => (
        <div key={`${item.id}-${path.label}`}>
          <span>{path.label}</span>
          <code title={path.value}>{path.value}</code>
          <Button
            aria-label={`Reveal ${path.label.toLowerCase()} path`}
            icon="pi pi-folder-open"
            severity="secondary"
            text
            size="small"
            onClick={() => onRevealPath(path.value)}
          />
        </div>
      ))}
    </div>
  );
}

function itemDiagnosticsTemplate(item: OperationHistoryItemRecord): ReactElement {
  const messages = [...(item.warnings ?? [])];

  if (item.error) {
    messages.push(item.error);
  }

  return (
    <div className="operation-history-diagnostics-cell">
      {messages.length > 0 ? messages.map((message) => <span key={message}>{message}</span>) : <span>No issues recorded</span>}
    </div>
  );
}

function getRecordRevealPath(record: OperationHistoryRecord): string | null {
  const successfulItem = record.items.find((item) => item.status === 'success');

  if (!successfulItem) {
    return null;
  }

  return successfulItem.archivePath ?? successfulItem.destinationPath ?? successfulItem.outputPath ?? successfulItem.sourcePath;
}

async function copySummary(summaryText: string, setCopyMessage: (message: string | null) => void): Promise<void> {
  if (!summaryText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(summaryText);
    setCopyMessage('Operation summary copied.');
  } catch {
    setCopyMessage('Could not copy operation summary.');
  }
}

function formatOperationSummary(record: OperationHistoryRecord): string {
  return [
    `Operation: ${formatOperationType(record.type)}`,
    `Status: ${formatHistoryStatus(record.status)}`,
    `Started: ${formatDateTime(record.startedAt ?? record.createdAt)}`,
    `Completed: ${record.completedAt ? formatDateTime(record.completedAt) : 'Not complete'}`,
    `Requested: ${record.summary.requested}`,
    `Succeeded: ${record.summary.succeeded}`,
    `Skipped: ${record.summary.skipped}`,
    `Failed: ${record.summary.failed}`,
    `Size: ${formatBytes(record.summary.totalSizeBytes)}`
  ].join('\n');
}

function formatOperationType(type: FileOperationType): string {
  const labels: Record<FileOperationType, string> = {
    trash: 'Move to Trash',
    move: 'Move Files',
    copy: 'Copy Files',
    archive: 'Archive Originals',
    'replace-original-with-output': 'Replace Original'
  };

  return labels[type];
}

function formatHistoryStatus(status: OperationHistoryStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatExecutionStatus(status: FileOperationExecutionStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getHistoryStatusSeverity(status: OperationHistoryStatus): TagSeverity {
  if (status === 'complete') {
    return 'success';
  }

  if (status === 'partial' || status === 'canceled') {
    return 'warning';
  }

  if (status === 'failed') {
    return 'danger';
  }

  return 'info';
}

function getExecutionStatusSeverity(status: FileOperationExecutionStatus): TagSeverity {
  if (status === 'success') {
    return 'success';
  }

  if (status === 'skipped' || status === 'pending') {
    return 'warning';
  }

  if (status === 'failed') {
    return 'danger';
  }

  return 'info';
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

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

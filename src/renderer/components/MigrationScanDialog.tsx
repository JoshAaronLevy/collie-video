import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import type {
  MigrationJobSnapshot,
  MigrationScanItem,
  MigrationScanResult
} from '../../shared/types/migration';
import { DialogFooter, DialogHeader } from './DialogChrome';

interface MigrationScanDialogProps {
  visible: boolean;
  auditedRootDirectory: string | null;
  newEditedDir: string;
  scan: MigrationScanResult | null;
  error: string | null;
  resultError: string | null;
  progress: MigrationJobSnapshot | null;
  percent: number | null;
  isScanning: boolean;
  isExecuting: boolean;
  onNewEditedDirChange: (value: string) => void;
  onSelectFolder: () => void;
  onStartScan: () => void;
  onExecute: () => void;
  onHide: () => void;
}

export function MigrationScanDialog({
  visible,
  auditedRootDirectory,
  newEditedDir,
  scan,
  error,
  resultError,
  progress,
  percent,
  isScanning,
  isExecuting,
  onNewEditedDirChange,
  onSelectFolder,
  onStartScan,
  onExecute,
  onHide
}: MigrationScanDialogProps): ReactElement {
  const isBusy = isScanning || isExecuting;
  const executableItems = scan?.items.filter((item) => item.status !== 'blocked').length ?? 0;
  const canStartScan = Boolean(auditedRootDirectory && newEditedDir.trim()) && !isBusy;
  const canExecute = Boolean(scan) && executableItems > 0 && !isBusy;
  const footer = scan ? (
    <DialogFooter>
      <Button label="Cancel" icon="pi pi-times" severity="secondary" outlined disabled={isBusy} onClick={onHide} />
      <Button
        label="Copy New Files and Archive Old Copies"
        icon="pi pi-copy"
        severity="success"
        loading={isExecuting}
        disabled={!canExecute}
        onClick={onExecute}
      />
    </DialogFooter>
  ) : (
    <DialogFooter>
      <Button label="Cancel" icon="pi pi-times" severity="secondary" outlined disabled={isBusy} onClick={onHide} />
      <Button
        label="Scan New Edits"
        icon="pi pi-search"
        severity="success"
        loading={isScanning}
        disabled={!canStartScan}
        onClick={onStartScan}
      />
    </DialogFooter>
  );

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow="Migration"
          title="Migrate New Edits"
          description="Copy new edited videos into the audited destination and archive previous exact filename matches."
        />
      }
      visible={visible}
      modal
      draggable={false}
      className="app-dialog migration-dialog"
      footer={footer}
      onHide={() => {
        if (!isBusy) {
          onHide();
        }
      }}
    >
      <div className="migration-dialog-content">
        <Message
          severity="info"
          text="Copy new edited videos into the audited destination folder and archive older exact filename matches. Source files are not moved or deleted."
        />

        <div className="migration-path-grid">
          <PathPanel label="Audited destination folder" value={auditedRootDirectory ?? 'Run a folder audit first.'} />
          <div className="migration-path-panel">
            <span>New edited videos folder</span>
            <div className="migration-folder-row">
              <InputText
                value={newEditedDir}
                placeholder="/Users/joshlevy/Movies/Edited"
                disabled={isBusy}
                onChange={(event) => onNewEditedDirChange(event.target.value)}
              />
              <Button
                label="Select Folder"
                icon="pi pi-folder-open"
                severity="info"
                outlined
                disabled={isBusy}
                onClick={onSelectFolder}
              />
            </div>
          </div>
        </div>

        {!scan && !isBusy ? (
          <div className="migration-notes">
            <span>New edits are copied flat into the destination root.</span>
            <span>Old destination matches are moved to a timestamped Archive folder.</span>
            <span>Drive space is only reclaimed after you review and delete the archive yourself.</span>
          </div>
        ) : null}

        {isScanning ? (
          <Message
            severity="info"
            text="Scanning the new edits folder and matching exact filenames against the audited destination root..."
          />
        ) : null}

        {isExecuting ? (
          <div className="migration-progress">
            <ProgressBar value={percent ?? 0} />
            <p>{progress?.message ?? 'Migrating files...'}</p>
            <div className="migration-progress-counts">
              <Tag
                value={`${(progress?.processedFiles ?? 0).toLocaleString()} / ${(progress?.totalFiles ?? scan?.items.length ?? 0).toLocaleString()}`}
              />
              <Tag value={`${(progress?.copiedCount ?? 0).toLocaleString()} copied`} severity="success" />
              <Tag value={`${(progress?.archivedCount ?? 0).toLocaleString()} archived`} severity="info" />
              <Tag value={`${(progress?.failedCount ?? 0).toLocaleString()} failed`} severity="danger" />
            </div>
            <PathPanel label="Current" value={progress?.currentFile || 'Preparing...'} />
          </div>
        ) : null}

        {scan ? (
          <>
            <div className="migration-summary-grid">
              <SummaryMetric label="New files found" value={scan.summary.newFilesFound.toLocaleString()} />
              <SummaryMetric label="Files with matches" value={scan.summary.filesWithMatches.toLocaleString()} />
              <SummaryMetric label="No previous match" value={scan.summary.filesWithoutMatches.toLocaleString()} />
              <SummaryMetric
                label="Old files to archive"
                value={scan.summary.totalDestinationMatchesToArchive.toLocaleString()}
              />
              <SummaryMetric label="New bytes to copy" value={formatBytes(scan.summary.newBytesToCopy)} />
              <SummaryMetric label="Old bytes to archive" value={formatBytes(scan.summary.oldBytesToArchive)} />
              <SummaryMetric label="Active file delta" value={formatSignedInteger(scan.summary.netActiveFileDelta)} />
              <SummaryMetric label="Active storage delta" value={formatSignedBytes(scan.summary.netActiveBytesDelta)} />
            </div>

            <PathPanel label="Archive run folder" value={scan.archiveRunDir} />

            {scan.summary.newFilesFound === 0 ? (
              <Message severity="warn" text="No supported videos were found in the new edits folder." />
            ) : null}

            {executableItems === 0 && scan.summary.newFilesFound > 0 ? (
              <Message severity="warn" text="All scanned items are blocked. Resolve warnings before executing." />
            ) : null}

            {scan.warnings.length > 0 ? (
              <div className="migration-warning-panel">
                <h3>Scan Warnings</h3>
                <ul>
                  {scan.warnings.slice(0, 6).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <DataTable
              value={scan.items}
              dataKey="sourcePath"
              rows={8}
              paginator
              size="small"
              className="migration-plan-table"
              emptyMessage="No migration items found."
            >
              <Column field="fileName" header="New File" sortable body={fileTemplate} style={{ width: '30%' }} />
              <Column header="Old Matches" body={matchesTemplate} style={{ width: '26%' }} />
              <Column header="Action" body={actionTemplate} style={{ width: '22%' }} />
              <Column header="Warnings" body={warningsTemplate} style={{ width: '22%' }} />
            </DataTable>
          </>
        ) : null}

        {error ? <Message severity="error" text={error} /> : null}
        {resultError ? <Message severity="error" text={resultError} /> : null}
      </div>
    </Dialog>
  );
}

function PathPanel({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="migration-path-panel">
      <span>{label}</span>
      <code title={value}>{value}</code>
    </div>
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

function fileTemplate(item: MigrationScanItem): ReactElement {
  return (
    <div className="file-cell">
      <span title={item.sourcePath}>{item.fileName}</span>
      <small title={item.sourcePath}>{formatBytes(item.sourceSizeBytes)}</small>
    </div>
  );
}

function matchesTemplate(item: MigrationScanItem): ReactElement {
  if (item.matches.length === 0) {
    return <span className="cell-muted">No old match</span>;
  }

  return (
    <ul className="migration-match-list">
      {item.matches.slice(0, 3).map((match) => (
        <li key={match.originalPath}>
          <span title={match.originalPath}>{match.originalRelativePath}</span>
          <small>{formatBytes(match.sizeBytes)}</small>
        </li>
      ))}
      {item.matches.length > 3 ? <li>{(item.matches.length - 3).toLocaleString()} more</li> : null}
    </ul>
  );
}

function actionTemplate(item: MigrationScanItem): ReactElement {
  if (item.status === 'blocked') {
    return <Tag value="Blocked" severity="danger" />;
  }

  if (item.matchCount > 1) {
    return <Tag value={`${item.matchCount.toLocaleString()} old copies`} severity="warning" />;
  }

  if (item.matchCount === 1) {
    return <Tag value="Archive old copy" severity="info" />;
  }

  return <Tag value="Copy new file" severity="success" />;
}

function warningsTemplate(item: MigrationScanItem): ReactElement {
  if (item.warnings.length === 0) {
    return <span className="cell-muted">None</span>;
  }

  return (
    <ul className="migration-warning-list">
      {item.warnings.map((warning) => (
        <li key={warning}>{warning}</li>
      ))}
    </ul>
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

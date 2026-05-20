import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import type { DuplicateScanJobSnapshot, DuplicateScanResult } from '../../shared/types/duplicateScan';
import { DialogFooter, DialogHeader } from './DialogChrome';

interface DuplicateScanDialogProps {
  visible: boolean;
  selectedCount: number;
  scanFolder: string;
  progress: DuplicateScanJobSnapshot | null;
  percent: number | null;
  result: DuplicateScanResult | null;
  error: string | null;
  isScanning: boolean;
  onScanFolderChange: (value: string) => void;
  onSelectFolder: () => void | Promise<void>;
  onStartScan: () => void | Promise<void>;
  onCancelScan: () => void | Promise<void>;
  onHide: () => void;
}

export function DuplicateScanDialog({
  visible,
  selectedCount,
  scanFolder,
  progress,
  percent,
  result,
  error,
  isScanning,
  onScanFolderChange,
  onSelectFolder,
  onStartScan,
  onCancelScan,
  onHide
}: DuplicateScanDialogProps): ReactElement {
  const hasNoResults = Boolean(result && result.groups.length === 0);
  const canStartScan = selectedCount > 0 && scanFolder.trim().length > 0 && !isScanning;
  const checkedVideoFileCount = result?.checkedVideoFileCount ?? progress?.checkedVideoFileCount ?? 0;
  const footer = (
    <DialogFooter>
      {isScanning ? (
        <Button
          label="Cancel Scan"
          icon="pi pi-times"
          severity="danger"
          outlined
          onClick={() => {
            void onCancelScan();
          }}
        />
      ) : (
        <>
          <Button label="Close" icon="pi pi-times" severity="secondary" outlined onClick={onHide} />
          <Button
            label="Start Duplicate Scan"
            icon="pi pi-search"
            severity="success"
            disabled={!canStartScan}
            onClick={() => {
              void onStartScan();
            }}
          />
        </>
      )}
    </DialogFooter>
  );

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow="Duplicate Scan"
          title="Find Duplicate Candidates"
          description="Scan another folder tree for possible duplicates of the selected project videos."
        />
      }
      visible={visible}
      modal
      draggable={false}
      className="app-dialog duplicate-scan-dialog"
      footer={footer}
      onHide={() => {
        if (!isScanning) {
          onHide();
        }
      }}
    >
      <div className="duplicate-scan-dialog-content">
        <Message
          severity="info"
          text="Find possible duplicates by exact filename, including extension. Duration, size, and metadata are only shown later for comparison."
        />

        <div className="duplicate-scan-summary-grid">
          <SummaryMetric label="Selected source videos" value={selectedCount.toLocaleString()} />
          <SummaryMetric label="Match rule" value="Exact filename match" />
          <SummaryMetric label="Source protection" value="Project sources are kept" />
        </div>

        <div className="duplicate-scan-path-panel">
          <span>Folder to scan recursively</span>
          <div className="duplicate-scan-folder-row">
            <InputText
              value={scanFolder}
              placeholder="/Users/joshlevy/Movies/Exports"
              disabled={isScanning}
              onChange={(event) => onScanFolderChange(event.target.value)}
            />
            <Button
              label="Select Folder"
              icon="pi pi-folder-open"
              severity="info"
              outlined
              disabled={isScanning}
              onClick={() => {
                void onSelectFolder();
              }}
            />
          </div>
          {scanFolder ? <code title={scanFolder}>{scanFolder}</code> : null}
        </div>

        {isScanning || (progress && !hasNoResults) ? (
          <div className="duplicate-scan-progress">
            <ProgressBar value={percent ?? 0} showValue={percent !== null} />
            <p>{progress?.message ?? 'Preparing Duplicate Scan...'}</p>
            <div className="duplicate-scan-progress-counts">
              <Tag value={`${(progress?.scannedFileCount ?? 0).toLocaleString()} files scanned`} />
              <Tag value={`${(progress?.checkedVideoFileCount ?? 0).toLocaleString()} videos checked`} />
              <Tag
                value={`${(progress?.filenameMatchesFound ?? 0).toLocaleString()} filename matches`}
                severity="info"
              />
              <Tag value={formatMetadataProgress(progress)} severity="secondary" />
            </div>
            <PathPanel label="Current file" value={progress?.currentFile || 'Preparing...'} />
          </div>
        ) : null}

        {hasNoResults ? (
          <div className="duplicate-scan-no-results">
            <Message severity="warn" text="No duplicate candidates found." />
            <div className="duplicate-scan-summary-grid">
              <SummaryMetric label="Scanned folder" value={result?.scannedFolder ?? scanFolder} />
              <SummaryMetric label="Video files checked" value={checkedVideoFileCount.toLocaleString()} />
              <SummaryMetric label="Filename matches" value="0" />
            </div>
          </div>
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

function PathPanel({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="duplicate-scan-path-panel">
      <span>{label}</span>
      <code title={value}>{value}</code>
    </div>
  );
}

function formatMetadataProgress(progress: DuplicateScanJobSnapshot | null): string {
  const processed = progress?.metadataProcessedCount ?? 0;
  const total = progress?.metadataTotalCount;

  if (total === null || total === undefined) {
    return `${processed.toLocaleString()} metadata processed`;
  }

  return `${processed.toLocaleString()} / ${total.toLocaleString()} metadata`;
}

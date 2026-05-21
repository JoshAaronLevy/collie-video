import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { ProgressBar } from 'primereact/progressbar';
import { SelectButton } from 'primereact/selectbutton';
import { Tag } from 'primereact/tag';
import type {
  DuplicateFingerprintCacheStats,
  DuplicateReviewScanJobSnapshot,
  DuplicateReviewScanResult,
  DuplicateScanMode,
  DuplicateScanProfile,
  ImprovedDuplicateScanJobSnapshot
} from '../../shared/types/duplicateScan';
import { isImprovedDuplicateScanResult } from '../../shared/types/duplicateScan';
import { DialogFooter, DialogHeader } from './DialogChrome';

interface DuplicateScanDialogProps {
  visible: boolean;
  selectedCount: number;
  scanFolder: string;
  modes: DuplicateScanMode[];
  profile: DuplicateScanProfile;
  progress: DuplicateReviewScanJobSnapshot | null;
  percent: number | null;
  result: DuplicateReviewScanResult | null;
  error: string | null;
  fingerprintCacheStats: DuplicateFingerprintCacheStats | null;
  fingerprintCacheError: string | null;
  isFingerprintCacheLoading: boolean;
  isFingerprintCacheClearing: boolean;
  isScanning: boolean;
  onScanFolderChange: (value: string) => void;
  onModesChange: (modes: DuplicateScanMode[]) => void;
  onProfileChange: (profile: DuplicateScanProfile) => void;
  onSelectFolder: () => void | Promise<void>;
  onRefreshFingerprintCache: () => void | Promise<void>;
  onClearFingerprintCache: () => void | Promise<void>;
  onStartScan: () => void | Promise<void>;
  onCancelScan: () => void | Promise<void>;
  onHide: () => void;
}

const MODE_OPTIONS: Array<{
  value: DuplicateScanMode;
  label: string;
  description: string;
}> = [
  {
    value: 'filename-exact',
    label: 'Exact Filename',
    description: 'Same basename across folders'
  },
  {
    value: 'visual-fingerprint',
    label: 'Visual Match',
    description: 'Perceptual frame fingerprints'
  },
  {
    value: 'contained-clip',
    label: 'Contained Clip',
    description: 'Offset-aligned segment evidence'
  }
];

const PROFILE_OPTIONS: Array<{ label: string; value: DuplicateScanProfile }> = [
  { label: 'Fast', value: 'fast' },
  { label: 'Deep', value: 'deep' }
];

export function DuplicateScanDialog({
  visible,
  selectedCount,
  scanFolder,
  modes,
  profile,
  progress,
  percent,
  result,
  error,
  fingerprintCacheStats,
  fingerprintCacheError,
  isFingerprintCacheLoading,
  isFingerprintCacheClearing,
  isScanning,
  onScanFolderChange,
  onModesChange,
  onProfileChange,
  onSelectFolder,
  onRefreshFingerprintCache,
  onClearFingerprintCache,
  onStartScan,
  onCancelScan,
  onHide
}: DuplicateScanDialogProps): ReactElement {
  const hasNoResults = Boolean(result && result.groups.length === 0);
  const selectedModes = normalizeModes(modes);
  const hasVisualMode = selectedModes.includes('visual-fingerprint') || selectedModes.includes('contained-clip');
  const canStartScan = selectedCount > 0 && scanFolder.trim().length > 0 && selectedModes.length > 0 && !isScanning;
  const checkedVideoFileCount = result?.checkedVideoFileCount ?? getProgressCheckedCount(progress);
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
          description="Scan another folder tree for likely duplicate matches against the selected project videos."
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
      <div className="duplicate-scan-dialog-content" aria-busy={isScanning}>
        <Message
          severity="info"
          text={
            hasVisualMode
              ? 'Visual modes use local fingerprints and may take longer. Exact filename-only scans keep the current fast matching behavior.'
              : 'Exact filename mode matches basename plus extension across folders. Duration and metadata are shown later for comparison only.'
          }
        />

        <div className="duplicate-scan-summary-grid">
          <SummaryMetric label="Selected source videos" value={selectedCount.toLocaleString()} />
          <SummaryMetric label="Modes" value={formatSelectedModes(selectedModes)} />
          <SummaryMetric label="Profile" value={hasVisualMode ? formatProfile(profile) : 'Exact only'} />
          <SummaryMetric label="Source protection" value="Project sources are kept" />
        </div>

        <section className="duplicate-scan-mode-panel" aria-label="Duplicate Scan modes">
          <div className="duplicate-scan-mode-heading">
            <span>Detection modes</span>
            <small>{hasVisualMode ? 'Deep is recommended for contained clips.' : 'OpenCV is not needed for exact-only scans.'}</small>
          </div>
          <div className="duplicate-scan-mode-grid">
            {MODE_OPTIONS.map((option) => {
              const checked = selectedModes.includes(option.value);
              const inputId = `duplicate-mode-${option.value}`;

              return (
                <label key={option.value} className="duplicate-scan-mode-option" htmlFor={inputId}>
                  <Checkbox
                    inputId={inputId}
                    checked={checked}
                    disabled={isScanning}
                    onChange={(event) =>
                      onModesChange(toggleMode(selectedModes, option.value, Boolean(event.checked)))
                    }
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="duplicate-scan-profile-row" aria-label="Duplicate Scan profile">
          <div>
            <span>Visual scan profile</span>
            <small>{profile === 'deep' ? 'More samples per video' : 'Lower sample count for faster review'}</small>
          </div>
          <SelectButton
            value={profile}
            options={PROFILE_OPTIONS}
            disabled={isScanning || !hasVisualMode}
            allowEmpty={false}
            onChange={(event) => {
              if (event.value) {
                onProfileChange(event.value as DuplicateScanProfile);
              }
            }}
          />
        </section>

        {hasVisualMode ? (
          <section className="duplicate-scan-cache-row" aria-label="Duplicate fingerprint cache">
            <div>
              <span>Fingerprint cache</span>
              <small title={fingerprintCacheStats?.cacheDir ?? undefined}>
                {formatFingerprintCacheStats(fingerprintCacheStats)}
              </small>
            </div>
            <div className="duplicate-scan-cache-actions">
              <Button
                label="Refresh"
                icon="pi pi-refresh"
                severity="secondary"
                outlined
                loading={isFingerprintCacheLoading}
                disabled={isScanning || isFingerprintCacheClearing}
                onClick={() => {
                  void onRefreshFingerprintCache();
                }}
              />
              <Button
                label="Clear"
                icon="pi pi-trash"
                severity="warning"
                outlined
                loading={isFingerprintCacheClearing}
                disabled={isScanning || isFingerprintCacheLoading}
                onClick={() => {
                  void onClearFingerprintCache();
                }}
              />
            </div>
            {fingerprintCacheError ? <small className="duplicate-scan-cache-error">{fingerprintCacheError}</small> : null}
          </section>
        ) : null}

        <div className="duplicate-scan-path-panel">
          <span>Folder to scan recursively</span>
          <div className="duplicate-scan-folder-row">
            <InputText
              value={scanFolder}
              aria-label="Duplicate Scan folder path"
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
          <div className="duplicate-scan-progress" role="status" aria-live="polite">
            <ProgressBar value={percent ?? 0} showValue={percent !== null} aria-label="Duplicate Scan progress" />
            <p>{progress?.message ?? 'Preparing Duplicate Scan...'}</p>
            <div className="duplicate-scan-progress-counts">
              {progressCountTags(progress)}
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
              {resultSummaryMetrics(result)}
            </div>
            {result && result.warnings.length > 0 ? <ScanWarningPanel warnings={result.warnings} /> : null}
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

function ScanWarningPanel({ warnings }: { warnings: string[] }): ReactElement {
  const visibleWarnings = warnings.slice(0, 5);
  const hiddenCount = warnings.length - visibleWarnings.length;

  return (
    <section className="duplicate-warning-panel" aria-label="Duplicate scan warnings">
      <div>
        <i className="pi pi-exclamation-triangle" aria-hidden="true" />
        <strong>{warnings.length.toLocaleString()} scan warning(s)</strong>
      </div>
      <ul>
        {visibleWarnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
      {hiddenCount > 0 ? <small>{hiddenCount.toLocaleString()} more warning(s) hidden.</small> : null}
    </section>
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

function progressCountTags(progress: DuplicateReviewScanJobSnapshot | null): ReactElement[] {
  if (!progress) {
    return [<Tag key="starting" value="Preparing" />];
  }

  if (isImprovedDuplicateScanProgress(progress)) {
    return [
      <Tag key="processed" value={formatProcessedFiles(progress)} />,
      <Tag key="fingerprinted" value={`${progress.fingerprintedFiles.toLocaleString()} fingerprinted`} />,
      <Tag
        key="cache"
        value={`${progress.cacheHits.toLocaleString()} cache hits / ${progress.cacheMisses.toLocaleString()} misses`}
        severity="info"
      />,
      <Tag
        key="groups"
        value={`${progress.candidateGroupCount.toLocaleString()} candidate groups`}
        severity="secondary"
      />
    ];
  }

  return [
    <Tag key="scanned" value={`${progress.scannedFileCount.toLocaleString()} files scanned`} />,
    <Tag key="checked" value={`${progress.checkedVideoFileCount.toLocaleString()} videos checked`} />,
    <Tag
      key="matches"
      value={`${progress.filenameMatchesFound.toLocaleString()} filename matches`}
      severity="info"
    />,
    <Tag key="metadata" value={formatMetadataProgress(progress)} severity="secondary" />
  ];
}

function resultSummaryMetrics(result: DuplicateReviewScanResult | null): ReactElement[] {
  if (!result) {
    return [<SummaryMetric key="candidates" label="Candidates" value="0" />];
  }

  if (isImprovedDuplicateScanResult(result)) {
    return [
      <SummaryMetric
        key="exact"
        label="Exact groups"
        value={result.summary.exactFilenameGroupCount.toLocaleString()}
      />,
      <SummaryMetric
        key="visual"
        label="Visual groups"
        value={result.summary.visualGroupCount.toLocaleString()}
      />,
      <SummaryMetric
        key="contained"
        label="Contained groups"
        value={result.summary.containedClipGroupCount.toLocaleString()}
      />
    ];
  }

  return [
    <SummaryMetric key="matches" label="Filename matches" value={result.matchCount.toLocaleString()} />,
    <SummaryMetric key="groups" label="Groups" value={result.groups.length.toLocaleString()} />
  ];
}

function toggleMode(
  currentModes: DuplicateScanMode[],
  mode: DuplicateScanMode,
  checked: boolean
): DuplicateScanMode[] {
  const nextModes = new Set(currentModes);

  if (checked) {
    nextModes.add(mode);
  } else {
    nextModes.delete(mode);
  }

  return nextModes.size > 0 ? [...nextModes] : ['filename-exact'];
}

function normalizeModes(modes: DuplicateScanMode[]): DuplicateScanMode[] {
  const normalizedModes = MODE_OPTIONS
    .map((option) => option.value)
    .filter((mode) => modes.includes(mode));

  return normalizedModes.length > 0 ? normalizedModes : ['filename-exact'];
}

function formatSelectedModes(modes: DuplicateScanMode[]): string {
  return modes
    .map((mode) => MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode)
    .join(', ');
}

function formatProfile(profile: DuplicateScanProfile): string {
  return profile === 'deep' ? 'Deep' : 'Fast';
}

function formatFingerprintCacheStats(stats: DuplicateFingerprintCacheStats | null): string {
  if (!stats) {
    return 'Stats not loaded yet';
  }

  const updatedText = stats.lastModifiedAt ? `, updated ${formatDateTime(stats.lastModifiedAt)}` : '';

  return `${stats.entryCount.toLocaleString()} entr${stats.entryCount === 1 ? 'y' : 'ies'}, ${formatBytes(stats.totalBytes)}${updatedText}`;
}

function formatProcessedFiles(progress: ImprovedDuplicateScanJobSnapshot): string {
  if (progress.totalFiles === null || progress.totalFiles === undefined) {
    return `${progress.processedFiles.toLocaleString()} files processed`;
  }

  return `${progress.processedFiles.toLocaleString()} / ${progress.totalFiles.toLocaleString()} files`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
}

function formatMetadataProgress(progress: DuplicateReviewScanJobSnapshot | null): string {
  if (!progress || isImprovedDuplicateScanProgress(progress)) {
    return '0 metadata processed';
  }

  const processed = progress.metadataProcessedCount ?? 0;
  const total = progress.metadataTotalCount;

  if (total === null || total === undefined) {
    return `${processed.toLocaleString()} metadata processed`;
  }

  return `${processed.toLocaleString()} / ${total.toLocaleString()} metadata`;
}

function getProgressCheckedCount(progress: DuplicateReviewScanJobSnapshot | null): number {
  if (!progress) {
    return 0;
  }

  if (isImprovedDuplicateScanProgress(progress)) {
    return progress.processedFiles;
  }

  return progress.checkedVideoFileCount;
}

function isImprovedDuplicateScanProgress(
  progress: DuplicateReviewScanJobSnapshot
): progress is ImprovedDuplicateScanJobSnapshot {
  return 'processedFiles' in progress && 'candidateGroupCount' in progress;
}

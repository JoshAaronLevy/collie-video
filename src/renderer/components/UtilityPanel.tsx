import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import type { FileDiscoveryJobSnapshot, FfprobeMetadataJobSnapshot } from '../../shared/types/audit';
import type { FfprobeResult } from '../../shared/types/video';

interface UtilityPanelProps {
  discoveryProgress: FileDiscoveryJobSnapshot | null;
  discoveryPercent: number | null;
  discoveredPaths: string[];
  ffprobeProgress: FfprobeMetadataJobSnapshot | null;
  ffprobePercent: number | null;
  metadataItems: FfprobeResult[];
  isDiscoveryActive: boolean;
  isFfprobeActive: boolean;
  hasSources: boolean;
  activeAction: string | null;
  onStartDiscovery: () => void;
  onCancelDiscovery: () => void;
  onStartFfprobe: () => void;
  onCancelFfprobe: () => void;
  onRevealPath: (path: string) => void;
}

export function UtilityPanel({
  discoveryProgress,
  discoveryPercent,
  discoveredPaths,
  ffprobeProgress,
  ffprobePercent,
  metadataItems,
  isDiscoveryActive,
  isFfprobeActive,
  hasSources,
  activeAction,
  onStartDiscovery,
  onCancelDiscovery,
  onStartFfprobe,
  onCancelFfprobe,
  onRevealPath
}: UtilityPanelProps): ReactElement {
  return (
    <Card className="workspace-card side-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Utilities</p>
          <h2>Discovery</h2>
        </div>
      </div>

      <div className="action-row side-actions">
        <Button
          label="Scan Files"
          icon="pi pi-search"
          severity="secondary"
          outlined
          loading={activeAction === 'discovery'}
          disabled={isDiscoveryActive || !hasSources}
          onClick={onStartDiscovery}
        />
        <Button
          label="Cancel"
          icon="pi pi-times"
          severity="danger"
          outlined
          disabled={!isDiscoveryActive}
          onClick={onCancelDiscovery}
        />
      </div>

      {discoveryProgress ? (
        <CompactProgress
          label="Files"
          status={discoveryProgress.status}
          percent={discoveryPercent}
          active={isDiscoveryActive}
          primary={discoveryProgress.foundCount}
          secondary={discoveryProgress.skippedFiles}
          message={discoveryProgress.currentPath ?? discoveryProgress.message}
        />
      ) : null}

      <PathPreview
        title="Discovered"
        paths={discoveredPaths}
        revealDisabled={activeAction === 'reveal'}
        onRevealPath={onRevealPath}
      />

      <div className="action-row side-actions">
        <Button
          label="Read Metadata"
          icon="pi pi-info-circle"
          severity="info"
          outlined
          loading={activeAction === 'ffprobe'}
          disabled={isFfprobeActive || isDiscoveryActive || discoveredPaths.length === 0}
          onClick={onStartFfprobe}
        />
        <Button
          label="Cancel"
          icon="pi pi-times"
          severity="danger"
          outlined
          disabled={!isFfprobeActive}
          onClick={onCancelFfprobe}
        />
      </div>

      {ffprobeProgress ? (
        <CompactProgress
          label="Metadata"
          status={ffprobeProgress.status}
          percent={ffprobePercent}
          active={isFfprobeActive}
          primary={ffprobeProgress.succeededCount}
          secondary={ffprobeProgress.errorCount}
          message={ffprobeProgress.currentFile ?? ffprobeProgress.message}
        />
      ) : null}

      <MetadataPreview items={metadataItems} />
    </Card>
  );
}

function CompactProgress({
  label,
  status,
  percent,
  active,
  primary,
  secondary,
  message
}: {
  label: string;
  status: string;
  percent: number | null;
  active: boolean;
  primary: number;
  secondary: number;
  message: string | null;
}): ReactElement {
  return (
    <section className="compact-progress" aria-label={`${label} progress`}>
      <div className="compact-heading">
        <h3>{label}</h3>
        <Tag value={status} severity={status === 'complete' ? 'success' : 'info'} />
      </div>
      <ProgressBar
        mode={percent === null && active ? 'indeterminate' : 'determinate'}
        value={percent ?? 0}
        showValue={percent !== null}
      />
      <div className="compact-metrics">
        <span>{primary.toLocaleString()}</span>
        <span>{secondary.toLocaleString()}</span>
      </div>
      {message ? <p className="path-hint" title={message}>{message}</p> : null}
    </section>
  );
}

function PathPreview({
  title,
  paths,
  revealDisabled,
  onRevealPath
}: {
  title: string;
  paths: string[];
  revealDisabled: boolean;
  onRevealPath: (path: string) => void;
}): ReactElement {
  const previewPaths = paths.slice(0, 5);

  return (
    <section className="path-list-panel" aria-label={title}>
      <div className="compact-heading">
        <h3>{title}</h3>
        <Tag value={String(paths.length)} severity={paths.length > 0 ? 'success' : 'secondary'} />
      </div>
      {previewPaths.length > 0 ? (
        <ul className="compact-path-list">
          {previewPaths.map((path) => (
            <li key={path}>
              <span title={path}>{path}</span>
              <Button
                aria-label={`Reveal ${path} in Finder`}
                icon="pi pi-external-link"
                severity="secondary"
                text
                rounded
                disabled={revealDisabled}
                onClick={() => onRevealPath(path)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-copy">No discovered files</p>
      )}
    </section>
  );
}

function MetadataPreview({ items }: { items: FfprobeResult[] }): ReactElement {
  return (
    <section className="path-list-panel" aria-label="Metadata results">
      <div className="compact-heading">
        <h3>Metadata</h3>
        <Tag value={String(items.length)} severity={items.length > 0 ? 'success' : 'secondary'} />
      </div>
      {items.length > 0 ? (
        <ul className="metadata-preview-list">
          {items.slice(0, 5).map((item) => (
            <li key={item.path}>
              <span title={item.path}>{item.fileName ?? item.path}</span>
              <small>{item.ok ? formatMetadataSummary(item) : (item.error ?? 'Failed')}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-copy">No metadata read</p>
      )}
    </section>
  );
}

function formatMetadataSummary(item: FfprobeResult): string {
  const width = item.stream?.width;
  const height = item.stream?.height;
  const resolution = width && height ? `${width}x${height}` : 'Unknown';
  const codec = item.stream?.codec_name ?? 'unknown codec';
  return `${resolution} · ${codec}`;
}

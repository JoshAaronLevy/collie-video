import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import type { AuditJobSnapshot } from '../../shared/types/audit';

interface AuditProgressPanelProps {
  progress: AuditJobSnapshot | null;
  percent: number | null;
  isActive: boolean;
  onCancelAudit: () => void;
}

export function AuditProgressPanel({
  progress,
  percent,
  isActive,
  onCancelAudit
}: AuditProgressPanelProps): ReactElement | null {
  if (!progress) {
    return null;
  }

  return (
    <Card className="workspace-card progress-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Progress</p>
          <h2>Audit</h2>
        </div>
        <Tag value={progress.status} severity={getProgressSeverity(progress.status)} />
      </div>

      <ProgressBar
        mode={percent === null && isActive ? 'indeterminate' : 'determinate'}
        value={percent ?? 0}
        showValue={percent !== null}
      />

      <div className="metric-grid">
        <Metric label="Flagged" value={progress.flaggedCount.toLocaleString()} />
        <Metric label="Errors" value={progress.errorCount.toLocaleString()} />
        <Metric label="Processed" value={progress.processedFiles.toLocaleString()} />
        <Metric label="Skipped" value={progress.skippedFiles.toLocaleString()} />
      </div>

      <div className="progress-footer">
        <p>{progress.currentFile ?? progress.message ?? 'Audit running'}</p>
        <Button
          label="Cancel"
          icon="pi pi-times"
          severity="danger"
          outlined
          disabled={!isActive}
          onClick={onCancelAudit}
        />
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getProgressSeverity(
  status: AuditJobSnapshot['status']
): 'success' | 'secondary' | 'info' | 'warning' | 'danger' | 'contrast' {
  if (status === 'complete') {
    return 'success';
  }

  if (status === 'error' || status === 'canceled') {
    return 'danger';
  }

  if (status === 'running' || status === 'starting') {
    return 'info';
  }

  return 'secondary';
}

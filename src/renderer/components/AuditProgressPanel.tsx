import { useEffect, useState, type ReactElement } from 'react';
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
  const timing = useAuditProgressTiming(progress);
  const nowMs = useAuditTimerNow(isActive);

  if (!progress) {
    return null;
  }

  const processedFileCount = getProcessedFileCount(progress);
  const totalFileCount = progress.totalFiles ?? progress.result?.summary.totalFiles ?? 0;
  const durationSeconds = getElapsedSeconds(timing, nowMs);
  const remainingSeconds = getRemainingSeconds({
    durationSeconds,
    processedFileCount,
    totalFileCount,
    status: progress.status
  });

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
        <Metric
          label="Processed"
          value={`${processedFileCount.toLocaleString()}/${totalFileCount.toLocaleString()}`}
        />
        <Metric label="Flagged" value={formatFlaggedProgress(progress.flaggedCount, processedFileCount)} />
        <Metric label="Duration" value={formatTimerDuration(durationSeconds)} />
        <Metric
          label="Remaining"
          value={progress.status === 'complete' ? 'Scan Complete' : formatTimerDuration(remainingSeconds)}
        />
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

interface AuditProgressTiming {
  jobId: string | null;
  startedAtMs: number;
  completedAtMs: number | null;
}

function useAuditProgressTiming(progress: AuditJobSnapshot | null): AuditProgressTiming | null {
  const [timing, setTiming] = useState<AuditProgressTiming | null>(null);

  useEffect(() => {
    if (!progress) {
      setTiming(null);
      return;
    }

    setTiming((currentTiming) => {
      const nowMs = Date.now();
      const isTerminal = isTerminalAuditStatus(progress.status);

      if (!currentTiming) {
        return {
          jobId: progress.jobId,
          startedAtMs: nowMs,
          completedAtMs: isTerminal ? nowMs : null
        };
      }

      const isPendingJobHydration =
        currentTiming.jobId === null && progress.jobId !== null && currentTiming.completedAtMs === null;
      const isSameJob = currentTiming.jobId === progress.jobId || isPendingJobHydration;

      if (!isSameJob) {
        return {
          jobId: progress.jobId,
          startedAtMs: nowMs,
          completedAtMs: isTerminal ? nowMs : null
        };
      }

      const nextTiming: AuditProgressTiming = {
        jobId: progress.jobId ?? currentTiming.jobId,
        startedAtMs: currentTiming.startedAtMs,
        completedAtMs: isTerminal ? currentTiming.completedAtMs ?? nowMs : null
      };

      if (
        nextTiming.jobId === currentTiming.jobId &&
        nextTiming.completedAtMs === currentTiming.completedAtMs
      ) {
        return currentTiming;
      }

      return nextTiming;
    });
  }, [progress]);

  return timing;
}

function useAuditTimerNow(isActive: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());

    if (!isActive) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isActive]);

  return nowMs;
}

function Metric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getProcessedFileCount(progress: AuditJobSnapshot): number {
  if (progress.status === 'complete') {
    return progress.result?.summary.scannedVideos ?? progress.processedFiles;
  }

  if (progress.totalFiles === null) {
    return 0;
  }

  return Math.min(progress.processedFiles, progress.totalFiles);
}

function formatFlaggedProgress(flaggedCount: number, processedFileCount: number): string {
  const percentage = processedFileCount > 0 ? Math.round((flaggedCount / processedFileCount) * 100) : 0;

  return `${flaggedCount.toLocaleString()} (${percentage.toLocaleString()}%)`;
}

function getElapsedSeconds(timing: AuditProgressTiming | null, nowMs: number): number {
  if (!timing) {
    return 0;
  }

  const endMs = timing.completedAtMs ?? nowMs;

  return Math.max(0, Math.floor((endMs - timing.startedAtMs) / 1000));
}

function getRemainingSeconds({
  durationSeconds,
  processedFileCount,
  totalFileCount,
  status
}: {
  durationSeconds: number;
  processedFileCount: number;
  totalFileCount: number;
  status: AuditJobSnapshot['status'];
}): number {
  if (isTerminalAuditStatus(status) || totalFileCount <= 0 || processedFileCount <= 0) {
    return 0;
  }

  const remainingFiles = Math.max(0, totalFileCount - processedFileCount);
  const averageSecondsPerFile = durationSeconds / processedFileCount;

  return Math.ceil(averageSecondsPerFile * remainingFiles);
}

function formatTimerDuration(totalSeconds: number): string {
  const normalizedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  const seconds = normalizedSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function isTerminalAuditStatus(status: AuditJobSnapshot['status']): boolean {
  return status === 'complete' || status === 'error' || status === 'canceled';
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

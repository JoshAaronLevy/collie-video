import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuditJobSnapshot, AuditRequest, AuditResult } from '../../shared/types/audit';

export interface AuditLifecycle {
  auditJobId: string | null;
  auditProgress: AuditJobSnapshot | null;
  auditResult: AuditResult | null;
  auditMessage: string | null;
  isAuditActive: boolean;
  auditProgressValue: number | null;
  startAudit: (request: AuditRequest) => Promise<void>;
  cancelAudit: () => Promise<void>;
  refreshAuditResult: (jobId?: string | null) => Promise<void>;
}

export function useAuditLifecycle(): AuditLifecycle {
  const [auditJobId, setAuditJobId] = useState<string | null>(null);
  const [auditProgress, setAuditProgress] = useState<AuditJobSnapshot | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditMessage, setAuditMessage] = useState<string | null>(null);

  useEffect(() => {
    return window.videoAudit.audit.onProgress((progress) => {
      setAuditProgress(progress);

      if (progress.jobId) {
        setAuditJobId(progress.jobId);
      }

      if (progress.result) {
        setAuditResult(progress.result);
      }

      if (progress.status === 'complete') {
        setAuditMessage(progress.message ?? 'Audit complete.');
      }

      if (progress.status === 'error' || progress.status === 'canceled') {
        setAuditMessage(progress.message ?? 'Audit stopped.');
      }
    });
  }, []);

  const isAuditActive =
    auditProgress?.status === 'starting' || auditProgress?.status === 'running';

  const auditProgressValue = useMemo(() => {
    if (!auditProgress?.totalFiles || auditProgress.totalFiles <= 0) {
      return null;
    }

    return Math.min(100, Math.round((auditProgress.processedFiles / auditProgress.totalFiles) * 100));
  }, [auditProgress]);

  const startAudit = useCallback(async (request: AuditRequest): Promise<void> => {
    setAuditMessage(null);
    setAuditProgress(null);
    setAuditResult(null);

    try {
      const response = await window.videoAudit.audit.start(request);

      if (response.status !== 'started' || !response.jobId) {
        setAuditMessage(response.message ?? 'Could not start audit.');
        return;
      }

      setAuditJobId(response.jobId);
      setAuditMessage(response.message ?? 'Audit started.');
    } catch (error: unknown) {
      setAuditMessage(error instanceof Error ? error.message : 'Could not start audit.');
    }
  }, []);

  const cancelAudit = useCallback(async (): Promise<void> => {
    if (!auditJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.audit.cancel(auditJobId);
      setAuditProgress(progress);
      setAuditMessage(progress.message ?? 'Audit canceled.');
    } catch (error: unknown) {
      setAuditMessage(error instanceof Error ? error.message : 'Could not cancel audit.');
    }
  }, [auditJobId]);

  const refreshAuditResult = useCallback(
    async (jobId = auditJobId): Promise<void> => {
      if (!jobId) {
        setAuditMessage('No audit job is available.');
        return;
      }

      try {
        const response = await window.videoAudit.audit.getResult(jobId);

        if (!response.result) {
          setAuditMessage(response.message ?? 'Audit result is not ready.');
          return;
        }

        setAuditResult(response.result);
        setAuditMessage('Audit result loaded.');
      } catch (error: unknown) {
        setAuditMessage(error instanceof Error ? error.message : 'Could not load audit result.');
      }
    },
    [auditJobId]
  );

  return {
    auditJobId,
    auditProgress,
    auditResult,
    auditMessage,
    isAuditActive,
    auditProgressValue,
    startAudit,
    cancelAudit,
    refreshAuditResult
  };
}

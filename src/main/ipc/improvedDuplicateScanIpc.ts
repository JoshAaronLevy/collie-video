import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  ImprovedDuplicateScanCancelResponse,
  ImprovedDuplicateScanJobSnapshot,
  ImprovedDuplicateScanRequest,
  ImprovedDuplicateScanResult,
  ImprovedDuplicateScanResultResponse,
  ImprovedDuplicateScanStartResponse
} from '../../shared/types/duplicateScan';
import type { JobRecord } from '../services/jobRegistry';
import { JobRegistry } from '../services/jobRegistry';
import { runImprovedDuplicateScan } from '../services/improvedDuplicateScanService';
import { notifyLongJobComplete } from '../services/notificationService';

const improvedDuplicateScanJobs = new JobRegistry<
  ImprovedDuplicateScanRequest,
  ImprovedDuplicateScanJobSnapshot,
  ImprovedDuplicateScanResult
>();

export function registerImprovedDuplicateScanIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.improvedDuplicateScanStart,
    (event, request: ImprovedDuplicateScanRequest): ImprovedDuplicateScanStartResponse => {
      const validation = validateImprovedDuplicateScanStartRequest(request);

      if (!validation.ok) {
        return {
          status: 'invalid_request',
          message: validation.error
        };
      }

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const job = improvedDuplicateScanJobs.create(validation.request, {
        jobId: null,
        scanId: null,
        status: 'starting',
        phase: 'validating',
        totalFiles: null,
        processedFiles: 0,
        fingerprintedFiles: 0,
        cacheHits: 0,
        cacheMisses: 0,
        cacheStale: 0,
        cacheErrors: 0,
        candidateGroupCount: 0,
        currentFile: null,
        message: 'Starting improved Duplicate Scan.',
        error: null
      });

      improvedDuplicateScanJobs.patchSnapshot(job, {
        scanId: job.id
      });
      sendImprovedDuplicateScanProgress(browserWindow, job.snapshot);
      void runImprovedDuplicateScanJob(job, browserWindow);

      return {
        jobId: job.id,
        scanId: job.id,
        status: 'started',
        message: 'Improved Duplicate Scan started.'
      };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.improvedDuplicateScanCancel,
    (event, jobId: string): ImprovedDuplicateScanCancelResponse => {
      const job = improvedDuplicateScanJobs.get(jobId);

      if (!job) {
        return createMissingImprovedDuplicateScanJobSnapshot(jobId);
      }

      if (
        job.snapshot.status === 'complete' ||
        job.snapshot.status === 'error' ||
        job.snapshot.status === 'canceled'
      ) {
        return job.snapshot;
      }

      job.abortController.abort();
      const snapshot = improvedDuplicateScanJobs.patchSnapshot(job, {
        status: 'canceled',
        phase: 'canceled',
        currentFile: null,
        message: 'Improved Duplicate Scan canceled.'
      });

      sendImprovedDuplicateScanProgress(BrowserWindow.fromWebContents(event.sender), snapshot);
      return snapshot;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.improvedDuplicateScanGetResult,
    (_event, jobId: string): ImprovedDuplicateScanResultResponse => {
      const job = improvedDuplicateScanJobs.get(jobId);

      if (!job) {
        return {
          jobId,
          scanId: jobId,
          status: 'not_found',
          message: 'Improved Duplicate Scan job not found.'
        };
      }

      if (!job.result) {
        return {
          jobId,
          scanId: job.snapshot.scanId ?? jobId,
          status: 'not_ready',
          message: 'Improved Duplicate Scan result is not ready.'
        };
      }

      return {
        jobId,
        scanId: job.result.scanId,
        status: job.result.status,
        result: job.result
      };
    }
  );
}

async function runImprovedDuplicateScanJob(
  job: JobRecord<ImprovedDuplicateScanRequest, ImprovedDuplicateScanJobSnapshot, ImprovedDuplicateScanResult>,
  browserWindow: BrowserWindow | null
): Promise<void> {
  try {
    const result = await runImprovedDuplicateScan({
      request: job.request,
      scanId: job.id,
      signal: job.abortController.signal,
      onProgress: (progress) =>
        updateImprovedDuplicateScanProgress(job, browserWindow, {
          ...progress,
          jobId: job.id,
          status: 'running',
          error: null
        })
    });

    improvedDuplicateScanJobs.setResult(job, result);
    notifyLongJobComplete(
      'Improved Duplicate Scan complete',
      `${result.summary.candidateFileCount.toLocaleString()} duplicate candidate(s) found.`
    );
    updateImprovedDuplicateScanProgress(job, browserWindow, {
      jobId: job.id,
      scanId: result.scanId,
      status: 'complete',
      phase: 'complete',
      totalFiles: result.checkedVideoFileCount,
      processedFiles: result.checkedVideoFileCount,
      fingerprintedFiles: result.fingerprintedFileCount,
      cacheHits: result.cacheHitCount,
      cacheMisses: result.cacheMissCount,
      cacheStale: result.cacheStaleCount,
      cacheErrors: result.cacheErrorCount,
      candidateGroupCount: result.groups.length,
      currentFile: null,
      message: 'Improved Duplicate Scan complete.',
      error: null,
      result
    });
  } catch (error: unknown) {
    const wasCanceled = job.abortController.signal.aborted || isAbortError(error);
    const message = wasCanceled
      ? 'Improved Duplicate Scan canceled.'
      : 'Improved Duplicate Scan failed.';

    updateImprovedDuplicateScanProgress(job, browserWindow, {
      ...job.snapshot,
      jobId: job.id,
      scanId: job.snapshot.scanId ?? job.id,
      status: wasCanceled ? 'canceled' : 'error',
      phase: wasCanceled ? 'canceled' : 'error',
      currentFile: null,
      message,
      error: error instanceof Error ? error.message : message
    });
  }
}

function validateImprovedDuplicateScanStartRequest(
  request: ImprovedDuplicateScanRequest
): { ok: true; request: ImprovedDuplicateScanRequest } | { ok: false; error: string } {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      error: 'Improved Duplicate Scan request is required.'
    };
  }

  if (typeof request.scanFolder !== 'string' || request.scanFolder.trim() === '') {
    return {
      ok: false,
      error: 'Choose a folder before starting an improved Duplicate Scan.'
    };
  }

  if (!Array.isArray(request.sources) || request.sources.length === 0) {
    return {
      ok: false,
      error: 'Select at least one project video before starting an improved Duplicate Scan.'
    };
  }

  if (!request.options || typeof request.options !== 'object') {
    return {
      ok: false,
      error: 'Choose Duplicate Scan modes before starting an improved Duplicate Scan.'
    };
  }

  if (!Array.isArray(request.options.modes) || request.options.modes.length === 0) {
    return {
      ok: false,
      error: 'Choose at least one Duplicate Scan mode.'
    };
  }

  return {
    ok: true,
    request: {
      ...request,
      scanFolder: request.scanFolder,
      sources: request.sources
    }
  };
}

function updateImprovedDuplicateScanProgress(
  job: JobRecord<ImprovedDuplicateScanRequest, ImprovedDuplicateScanJobSnapshot, ImprovedDuplicateScanResult>,
  browserWindow: BrowserWindow | null,
  progress: ImprovedDuplicateScanJobSnapshot
): void {
  improvedDuplicateScanJobs.patchSnapshot(job, progress);
  sendImprovedDuplicateScanProgress(browserWindow, job.snapshot);
}

function sendImprovedDuplicateScanProgress(
  browserWindow: BrowserWindow | null,
  snapshot: ImprovedDuplicateScanJobSnapshot
): void {
  if (browserWindow?.isDestroyed()) {
    return;
  }

  browserWindow?.webContents.send(IPC_CHANNELS.improvedDuplicateScanProgress, snapshot);
}

function createMissingImprovedDuplicateScanJobSnapshot(jobId: string): ImprovedDuplicateScanJobSnapshot {
  return {
    jobId,
    scanId: jobId,
    status: 'error',
    phase: 'error',
    totalFiles: null,
    processedFiles: 0,
    fingerprintedFiles: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheStale: 0,
    cacheErrors: 0,
    candidateGroupCount: 0,
    currentFile: null,
    message: 'Improved Duplicate Scan job not found.',
    error: 'Improved Duplicate Scan job not found.'
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

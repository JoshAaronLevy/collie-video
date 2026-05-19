import { useCallback, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AuditRequest, AuditResult } from '../../shared/types/audit';
import type {
  MediaPreviewResult,
  MediaPreviewResultItem,
  PreviewClipResult
} from '../../shared/types/mediaPreview';
import type { VideoRow } from '../../shared/types/video';
import { getErrorMessage } from '../helpers/errors';
import { formatDateTime } from '../helpers/formatting';
import { mergeMediaPreviewItems, mergePreviewClipItems } from '../helpers/mediaPreviewRows';
import {
  clearStoredAuditResult,
  loadStoredAuditResult,
  saveStoredAuditHistoryEntry,
  saveStoredAuditResult
} from '../storage/auditResultStorage';
import type { StoredAuditResultState } from '../storage/auditResultStorage';

interface UseAuditResultsOptions {
  setSelectedVideos: Dispatch<SetStateAction<VideoRow[]>>;
  clearSelectedVideos: () => void;
}

interface ApplyAuditResultOptions {
  persist: boolean;
  savedAt?: string;
  showThumbnails?: boolean;
}

interface ResetAuditResultsOptions {
  storageMessage?: string | null;
}

interface AuditHistoryArchiveResult {
  savedHistoryMetadata: boolean;
  historyMetadataError: string | null;
}

export interface UseAuditResultsValue {
  auditResult: AuditResult | null;
  auditSummary: AuditResult['summary'] | null;
  auditErrors: AuditResult['errors'];
  videoRows: VideoRow[] | null;
  visibleVideoRows: VideoRow[];
  removedVideoCount: number;
  storageMessage: string | null;
  storageSavedAt: string | null;
  isStorageLoading: boolean;
  lastAuditRequest: AuditRequest | null;
  showThumbnails: boolean;
  loadStoredAuditResultState: () => Promise<StoredAuditResultState | null>;
  applyStoredAuditResult: (storedAudit: StoredAuditResultState) => Promise<void>;
  finishStorageLoading: () => void;
  applyAuditResult: (
    result: AuditResult,
    request: AuditRequest | null,
    options: ApplyAuditResultOptions
  ) => Promise<void>;
  persistCurrentResult: (nextResult: AuditResult, thumbnailValue?: boolean) => Promise<void>;
  hideVideoPathsFromTable: (paths: string[]) => Promise<number>;
  restoreRemovedVideos: () => Promise<void>;
  setShowThumbnails: (value: boolean) => Promise<void>;
  mergeMediaPreviewResult: (result: MediaPreviewResult) => Promise<void>;
  mergeMediaPreviewItemsIntoRows: (items: MediaPreviewResultItem[]) => Promise<void>;
  mergePreviewClipResult: (result: PreviewClipResult) => Promise<void>;
  resetResultStateForAuditStart: (request: AuditRequest) => void;
  resetAuditResults: (options?: ResetAuditResultsOptions) => void;
  setStorageMessage: (message: string | null) => void;
  archiveCurrentResultToHistory: (
    options: { outputFolder: string | null }
  ) => Promise<AuditHistoryArchiveResult>;
  clearStoredAuditResultState: () => Promise<void>;
}

export function useAuditResults({
  setSelectedVideos,
  clearSelectedVideos
}: UseAuditResultsOptions): UseAuditResultsValue {
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditSummary, setAuditSummary] = useState<AuditResult['summary'] | null>(null);
  const [auditErrors, setAuditErrors] = useState<AuditResult['errors']>([]);
  const [videoRows, setVideoRows] = useState<VideoRow[] | null>(null);
  const [showThumbnailsState, setShowThumbnailsState] = useState(true);
  const [isStorageLoading, setIsStorageLoading] = useState(true);
  const [storageMessage, setStorageMessageState] = useState<string | null>(null);
  const [storageSavedAt, setStorageSavedAt] = useState<string | null>(null);
  const [lastAuditRequest, setLastAuditRequest] = useState<AuditRequest | null>(null);

  const visibleVideoRows = useMemo(
    () => (videoRows ?? []).filter((row) => row.visible !== false),
    [videoRows]
  );
  const removedVideoCount = (videoRows?.length ?? 0) - visibleVideoRows.length;

  const setStorageMessage = useCallback((message: string | null): void => {
    setStorageMessageState(message);
  }, []);

  const persistCurrentResult = useCallback(
    async (nextResult: AuditResult, thumbnailValue = showThumbnailsState): Promise<void> => {
      if (!lastAuditRequest) {
        return;
      }

      const storedState = await saveStoredAuditResult({
        request: lastAuditRequest,
        result: nextResult,
        showThumbnails: thumbnailValue
      });

      setStorageSavedAt(storedState.savedAt);
      setStorageMessageState(`Saved ${nextResult.videos.length.toLocaleString()} flagged row(s).`);
    },
    [lastAuditRequest, showThumbnailsState]
  );

  const applyAuditResult = useCallback(
    async (
      result: AuditResult,
      request: AuditRequest | null,
      options: ApplyAuditResultOptions
    ): Promise<void> => {
      const normalizedRows = result.videos.map((row) => ({
        ...row,
        visible: row.visible !== false
      }));
      const normalizedResult = {
        ...result,
        videos: normalizedRows
      };

      setAuditResult(normalizedResult);
      setVideoRows(normalizedRows);
      setAuditSummary(normalizedResult.summary);
      setAuditErrors(normalizedResult.errors);
      clearSelectedVideos();

      if (request) {
        setLastAuditRequest(request);
      }

      if (options.persist && request) {
        const storedState = await saveStoredAuditResult({
          request,
          result: normalizedResult,
          showThumbnails: options.showThumbnails ?? showThumbnailsState,
          savedAt: options.savedAt
        });

        setStorageSavedAt(storedState.savedAt);
        setStorageMessageState(`Saved ${normalizedRows.length.toLocaleString()} flagged row(s).`);
      }
    },
    [clearSelectedVideos, showThumbnailsState]
  );

  const loadStoredAuditResultState = useCallback(async (): Promise<StoredAuditResultState | null> => {
    return loadStoredAuditResult();
  }, []);

  const applyStoredAuditResult = useCallback(
    async (storedAudit: StoredAuditResultState): Promise<void> => {
      setShowThumbnailsState(storedAudit.showThumbnails);
      setStorageSavedAt(storedAudit.savedAt);
      setStorageMessageState(`Restored saved audit from ${formatDateTime(storedAudit.savedAt)}.`);
      await applyAuditResult(storedAudit.result, storedAudit.request, {
        persist: false,
        savedAt: storedAudit.savedAt,
        showThumbnails: storedAudit.showThumbnails
      });
    },
    [applyAuditResult]
  );

  const finishStorageLoading = useCallback((): void => {
    setIsStorageLoading(false);
  }, []);

  const hideVideoPathsFromTable = useCallback(
    async (paths: string[]): Promise<number> => {
      if (!auditResult || paths.length === 0) {
        return 0;
      }

      const pathSet = new Set(paths);
      let hiddenCount = 0;
      const nextRows = auditResult.videos.map((row) => {
        if (!pathSet.has(row.path) || row.visible === false) {
          return row;
        }

        hiddenCount += 1;
        return {
          ...row,
          visible: false
        };
      });

      if (hiddenCount === 0) {
        return 0;
      }

      const nextResult = {
        ...auditResult,
        videos: nextRows
      };

      setAuditResult(nextResult);
      setVideoRows(nextRows);
      setSelectedVideos((currentSelection) =>
        currentSelection.filter((video) => !pathSet.has(video.path))
      );
      await persistCurrentResult(nextResult);

      return hiddenCount;
    },
    [auditResult, persistCurrentResult, setSelectedVideos]
  );

  const restoreRemovedVideos = useCallback(async (): Promise<void> => {
    if (!auditResult) {
      return;
    }

    const nextRows = auditResult.videos.map((row) => ({ ...row, visible: true }));
    const nextResult = {
      ...auditResult,
      videos: nextRows
    };

    setAuditResult(nextResult);
    setVideoRows(nextRows);
    await persistCurrentResult(nextResult);
  }, [auditResult, persistCurrentResult]);

  const setShowThumbnails = useCallback(
    async (value: boolean): Promise<void> => {
      setShowThumbnailsState(value);

      if (auditResult) {
        await persistCurrentResult(auditResult, value);
      }
    },
    [auditResult, persistCurrentResult]
  );

  const mergeMediaPreviewItemsIntoRows = useCallback(
    async (items: MediaPreviewResultItem[]): Promise<void> => {
      if (!auditResult) {
        return;
      }

      const nextRows = mergeMediaPreviewItems(auditResult.videos, items);
      const nextResult = {
        ...auditResult,
        videos: nextRows
      };

      setAuditResult(nextResult);
      setVideoRows(nextRows);
      setSelectedVideos((currentSelection) => mergeMediaPreviewItems(currentSelection, items));
      await persistCurrentResult(nextResult);
    },
    [auditResult, persistCurrentResult, setSelectedVideos]
  );

  const mergeMediaPreviewResult = useCallback(
    async (result: MediaPreviewResult): Promise<void> => {
      await mergeMediaPreviewItemsIntoRows(result.items);
    },
    [mergeMediaPreviewItemsIntoRows]
  );

  const mergePreviewClipResult = useCallback(
    async (result: PreviewClipResult): Promise<void> => {
      if (!auditResult) {
        return;
      }

      const nextRows = mergePreviewClipItems(auditResult.videos, result.items);
      const nextResult = {
        ...auditResult,
        videos: nextRows
      };

      setAuditResult(nextResult);
      setVideoRows(nextRows);
      setSelectedVideos((currentSelection) => mergePreviewClipItems(currentSelection, result.items));
      await persistCurrentResult(nextResult);
    },
    [auditResult, persistCurrentResult, setSelectedVideos]
  );

  const resetResultStateForAuditStart = useCallback(
    (request: AuditRequest): void => {
      setAuditResult(null);
      setAuditSummary(null);
      setAuditErrors([]);
      setVideoRows(null);
      clearSelectedVideos();
      setLastAuditRequest(request);
    },
    [clearSelectedVideos]
  );

  const resetAuditResults = useCallback(
    (options: ResetAuditResultsOptions = {}): void => {
      setAuditResult(null);
      setAuditSummary(null);
      setAuditErrors([]);
      setVideoRows(null);
      clearSelectedVideos();
      setShowThumbnailsState(true);
      setLastAuditRequest(null);
      setStorageSavedAt(null);
      setStorageMessageState(options.storageMessage ?? null);
    },
    [clearSelectedVideos]
  );

  const archiveCurrentResultToHistory = useCallback(
    async ({ outputFolder }: { outputFolder: string | null }): Promise<AuditHistoryArchiveResult> => {
      if (!auditResult || !lastAuditRequest) {
        return {
          savedHistoryMetadata: false,
          historyMetadataError: null
        };
      }

      try {
        await saveStoredAuditHistoryEntry({
          request: lastAuditRequest,
          result: auditResult,
          outputFolder,
          savedAt: storageSavedAt
        });

        return {
          savedHistoryMetadata: true,
          historyMetadataError: null
        };
      } catch (error: unknown) {
        return {
          savedHistoryMetadata: false,
          historyMetadataError: getErrorMessage(error, 'Could not save scan history metadata.')
        };
      }
    },
    [auditResult, lastAuditRequest, storageSavedAt]
  );

  const clearStoredAuditResultState = useCallback(async (): Promise<void> => {
    await clearStoredAuditResult();
  }, []);

  return {
    auditResult,
    auditSummary,
    auditErrors,
    videoRows,
    visibleVideoRows,
    removedVideoCount,
    storageMessage,
    storageSavedAt,
    isStorageLoading,
    lastAuditRequest,
    showThumbnails: showThumbnailsState,
    loadStoredAuditResultState,
    applyStoredAuditResult,
    finishStorageLoading,
    applyAuditResult,
    persistCurrentResult,
    hideVideoPathsFromTable,
    restoreRemovedVideos,
    setShowThumbnails,
    mergeMediaPreviewResult,
    mergeMediaPreviewItemsIntoRows,
    mergePreviewClipResult,
    resetResultStateForAuditStart,
    resetAuditResults,
    setStorageMessage,
    archiveCurrentResultToHistory,
    clearStoredAuditResultState
  };
}

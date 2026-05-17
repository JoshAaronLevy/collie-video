import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppInfo } from '../../shared/types/app';
import type {
  AuditJobSnapshot,
  AuditOptions,
  AuditRequest,
  AuditResult,
  AuditSummary,
  FileDiscoveryJobSnapshot,
  FileDiscoveryRequest,
  FfprobeMetadataJobSnapshot,
  FfprobeMetadataRequest
} from '../../shared/types/audit';
import type { PathSelectionResult } from '../../shared/types/dialog';
import type { AppSettings, AppSettingsUpdate } from '../../shared/types/settings';
import type { FfprobeResult, VideoRow } from '../../shared/types/video';
import {
  clearStoredAuditResult,
  loadStoredAuditResult,
  saveStoredAuditResult
} from '../storage/auditResultStorage';

type ActiveAction =
  | 'folders'
  | 'files'
  | 'output'
  | 'settings'
  | 'reveal'
  | 'discovery'
  | 'ffprobe'
  | null;

const DEFAULT_AUDIT_OPTIONS: AuditOptions = {
  includeSubfolders: true,
  includeLowResolutionAnalysis: true,
  includeBlackBorderAnalysis: true,
  minHeight: 720,
  targetAspectRatio: 16 / 9,
  aspectRatioTolerance: 0.01
};

export interface VideoAuditAppController {
  appInfo: AppInfo | null;
  appInfoMessage: string | null;
  settings: AppSettings | null;
  settingsMessage: string | null;
  selectionMessage: string | null;
  workflowMessage: string | null;
  activeAction: ActiveAction;
  selectedFolders: string[];
  selectedFiles: string[];
  outputFolder: string | null;
  auditOptions: AuditOptions;
  auditProgress: AuditJobSnapshot | null;
  auditPercent: number | null;
  auditSummary: AuditSummary | null;
  auditErrors: AuditResult['errors'];
  videoRows: VideoRow[] | null;
  visibleVideoRows: VideoRow[];
  removedVideoCount: number;
  selectedVideos: VideoRow[];
  globalFilter: string;
  showThumbnails: boolean;
  isAuditActive: boolean;
  isDiscoveryActive: boolean;
  isFfprobeActive: boolean;
  canRunAudit: boolean;
  canRefreshAudit: boolean;
  isStorageLoading: boolean;
  storageMessage: string | null;
  storageSavedAt: string | null;
  discoveryProgress: FileDiscoveryJobSnapshot | null;
  discoveryPercent: number | null;
  discoveredPaths: string[];
  metadataItems: FfprobeResult[];
  ffprobeProgress: FfprobeMetadataJobSnapshot | null;
  ffprobePercent: number | null;
  chooseFolders: () => Promise<void>;
  chooseFiles: () => Promise<void>;
  chooseOutputFolder: () => Promise<void>;
  revealPath: (path: string) => Promise<void>;
  updateAuditOption: <Key extends keyof AuditOptions>(key: Key, value: AuditOptions[Key]) => Promise<void>;
  updateSettingsField: <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => Promise<void>;
  resetSettings: () => Promise<void>;
  runAudit: () => Promise<void>;
  refreshAudit: () => Promise<void>;
  cancelAudit: () => Promise<void>;
  clearAuditData: () => Promise<void>;
  removeSelectedVideos: () => Promise<void>;
  restoreRemovedVideos: () => Promise<void>;
  setSelectedVideos: (videos: VideoRow[]) => void;
  setGlobalFilter: (value: string) => void;
  setShowThumbnails: (value: boolean) => Promise<void>;
  startDiscovery: () => Promise<void>;
  cancelDiscovery: () => Promise<void>;
  startFfprobe: () => Promise<void>;
  cancelFfprobe: () => Promise<void>;
}

export function useVideoAuditAppController(): VideoAuditAppController {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [appInfoMessage, setAppInfoMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [auditOptions, setAuditOptions] = useState<AuditOptions>(DEFAULT_AUDIT_OPTIONS);
  const [auditJobId, setAuditJobId] = useState<string | null>(null);
  const [auditProgress, setAuditProgress] = useState<AuditJobSnapshot | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [auditErrors, setAuditErrors] = useState<AuditResult['errors']>([]);
  const [videoRows, setVideoRows] = useState<VideoRow[] | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<VideoRow[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [showThumbnailsState, setShowThumbnailsState] = useState(true);
  const [isStorageLoading, setIsStorageLoading] = useState(true);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [storageSavedAt, setStorageSavedAt] = useState<string | null>(null);
  const [lastAuditRequest, setLastAuditRequest] = useState<AuditRequest | null>(null);
  const [discoveryJobId, setDiscoveryJobId] = useState<string | null>(null);
  const [discoveryProgress, setDiscoveryProgress] = useState<FileDiscoveryJobSnapshot | null>(null);
  const [ffprobeJobId, setFfprobeJobId] = useState<string | null>(null);
  const [ffprobeProgress, setFfprobeProgress] = useState<FfprobeMetadataJobSnapshot | null>(null);
  const pendingAuditRequestRef = useRef<AuditRequest | null>(null);

  const applyAuditResult = useCallback(
    async (
      result: AuditResult,
      request: AuditRequest | null,
      options: { persist: boolean; savedAt?: string; showThumbnails?: boolean }
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
      setSelectedVideos([]);

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
        setStorageMessage(`Saved ${normalizedRows.length.toLocaleString()} flagged row(s).`);
      }
    },
    [showThumbnailsState]
  );

  useEffect(() => {
    let isMounted = true;

    window.videoAudit.app
      .getInfo()
      .then((info) => {
        if (isMounted) {
          setAppInfo(info);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setAppInfoMessage(getErrorMessage(error, 'Could not read app info.'));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialState(): Promise<void> {
      try {
        const [loadedSettings, storedAudit] = await Promise.all([
          window.videoAudit.settings.get(),
          loadStoredAuditResult()
        ]);

        if (!isMounted) {
          return;
        }

        setSettings(loadedSettings);
        setOutputFolder(loadedSettings.defaultOutputDirectory);

        if (storedAudit) {
          setSelectedFolders(storedAudit.request.folderPaths);
          setSelectedFiles(storedAudit.request.filePaths);
          setAuditOptions(storedAudit.request.options);
          setShowThumbnailsState(storedAudit.showThumbnails);
          setStorageSavedAt(storedAudit.savedAt);
          setStorageMessage(`Restored saved audit from ${formatDateTime(storedAudit.savedAt)}.`);
          await applyAuditResult(storedAudit.result, storedAudit.request, {
            persist: false,
            savedAt: storedAudit.savedAt,
            showThumbnails: storedAudit.showThumbnails
          });
        } else {
          setAuditOptions(settingsToAuditOptions(loadedSettings));
        }
      } catch (error: unknown) {
        if (isMounted) {
          setSettingsMessage(getErrorMessage(error, 'Could not load settings.'));
        }
      } finally {
        if (isMounted) {
          setIsStorageLoading(false);
        }
      }
    }

    void loadInitialState();

    return () => {
      isMounted = false;
    };
  }, [applyAuditResult]);

  useEffect(() => {
    return window.videoAudit.audit.onProgress((progress) => {
      setAuditProgress(progress);

      if (progress.jobId) {
        setAuditJobId(progress.jobId);
      }

      if (progress.status === 'complete') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Audit complete.');
      }

      if (progress.status === 'error' || progress.status === 'canceled') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Audit stopped.');
      }

      if (progress.result) {
        void applyAuditResult(progress.result, pendingAuditRequestRef.current, { persist: true });
      }
    });
  }, [applyAuditResult]);

  useEffect(() => {
    return window.videoAudit.discovery.onProgress((progress) => {
      setDiscoveryProgress(progress);

      if (progress.jobId) {
        setDiscoveryJobId(progress.jobId);
      }

      if (progress.status === 'complete') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'File discovery complete.');
      }

      if (progress.status === 'error' || progress.status === 'canceled') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'File discovery stopped.');
      }
    });
  }, []);

  useEffect(() => {
    return window.videoAudit.ffprobe.onProgress((progress) => {
      setFfprobeProgress(progress);

      if (progress.jobId) {
        setFfprobeJobId(progress.jobId);
      }

      if (progress.status === 'complete') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Metadata extraction complete.');
      }

      if (progress.status === 'error' || progress.status === 'canceled') {
        setActiveAction(null);
        setWorkflowMessage(progress.message ?? 'Metadata extraction stopped.');
      }
    });
  }, []);

  const visibleVideoRows = useMemo(
    () => (videoRows ?? []).filter((row) => row.visible !== false),
    [videoRows]
  );
  const removedVideoCount = (videoRows?.length ?? 0) - visibleVideoRows.length;
  const isAuditActive = auditProgress?.status === 'starting' || auditProgress?.status === 'running';
  const isDiscoveryActive =
    activeAction === 'discovery' ||
    discoveryProgress?.status === 'starting' ||
    discoveryProgress?.status === 'running';
  const isFfprobeActive =
    activeAction === 'ffprobe' ||
    ffprobeProgress?.status === 'starting' ||
    ffprobeProgress?.status === 'running';
  const auditPercent = getProgressPercent(auditProgress?.processedFiles, auditProgress?.totalFiles);
  const discoveryPercent = getProgressPercent(
    discoveryProgress?.processedFiles,
    discoveryProgress?.totalFiles
  );
  const ffprobePercent = getProgressPercent(ffprobeProgress?.processedFiles, ffprobeProgress?.totalFiles);
  const discoveredPaths = discoveryProgress?.result?.files.map((file) => file.path) ?? [];
  const metadataItems = ffprobeProgress?.result?.items ?? [];
  const canRunAudit =
    !isAuditActive &&
    !isDiscoveryActive &&
    !isFfprobeActive &&
    (selectedFolders.length > 0 || selectedFiles.length > 0) &&
    (auditOptions.includeLowResolutionAnalysis || auditOptions.includeBlackBorderAnalysis);
  const canRefreshAudit = Boolean(lastAuditRequest) && !isAuditActive && !isDiscoveryActive && !isFfprobeActive;

  const persistSettings = useCallback(async (partialSettings: AppSettingsUpdate): Promise<AppSettings | null> => {
    setActiveAction('settings');

    try {
      const updatedSettings = await window.videoAudit.settings.update(partialSettings);
      setSettings(updatedSettings);
      setSettingsMessage('Settings saved.');
      return updatedSettings;
    } catch (error: unknown) {
      setSettingsMessage(getErrorMessage(error, 'Could not save settings.'));
      return null;
    } finally {
      setActiveAction(null);
    }
  }, []);

  const handleSelectionResult = useCallback(
    async (result: PathSelectionResult, onValidPaths: (paths: string[]) => void): Promise<void> => {
      if (result.canceled) {
        setSelectionMessage(null);
        return;
      }

      onValidPaths(result.paths);
      setSelectionMessage(
        result.invalidPaths.length > 0
          ? `${result.invalidPaths.length} selected path(s) could not be used.`
          : null
      );
    },
    []
  );

  const chooseFolders = useCallback(async (): Promise<void> => {
    setActiveAction('folders');

    try {
      const result = await window.videoAudit.dialog.chooseFolders();
      await handleSelectionResult(result, setSelectedFolders);

      if (!result.canceled && result.paths.length > 0) {
        await persistSettings({
          recentFolders: mergeRecentPaths(result.paths, settings?.recentFolders ?? []),
          latestSelectedFolder: result.paths[0]
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not choose folders.'));
    } finally {
      setActiveAction(null);
    }
  }, [handleSelectionResult, persistSettings, settings?.recentFolders]);

  const chooseFiles = useCallback(async (): Promise<void> => {
    setActiveAction('files');

    try {
      const result = await window.videoAudit.dialog.chooseVideoFiles();
      await handleSelectionResult(result, setSelectedFiles);

      if (!result.canceled && result.paths.length > 0) {
        await persistSettings({
          recentFiles: mergeRecentPaths(result.paths, settings?.recentFiles ?? [])
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not choose files.'));
    } finally {
      setActiveAction(null);
    }
  }, [handleSelectionResult, persistSettings, settings?.recentFiles]);

  const chooseOutputFolder = useCallback(async (): Promise<void> => {
    setActiveAction('output');

    try {
      const result = await window.videoAudit.dialog.chooseOutputFolder();
      await handleSelectionResult(result, (paths) => setOutputFolder(paths[0] ?? null));

      if (!result.canceled && result.paths[0]) {
        await persistSettings({
          defaultOutputDirectory: result.paths[0]
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not choose an output folder.'));
    } finally {
      setActiveAction(null);
    }
  }, [handleSelectionResult, persistSettings]);

  const revealPath = useCallback(async (path: string): Promise<void> => {
    setActiveAction('reveal');

    try {
      const result = await window.videoAudit.shell.revealPath(path);
      setSelectionMessage(result.ok ? null : (result.message ?? 'Could not reveal that path in Finder.'));
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not reveal that path in Finder.'));
    } finally {
      setActiveAction(null);
    }
  }, []);

  const updateSettingsField = useCallback(
    async <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]): Promise<void> => {
      await persistSettings({ [key]: value } as AppSettingsUpdate);
    },
    [persistSettings]
  );

  const updateAuditOption = useCallback(
    async <Key extends keyof AuditOptions>(key: Key, value: AuditOptions[Key]): Promise<void> => {
      const nextOptions = {
        ...auditOptions,
        [key]: value
      };

      setAuditOptions(nextOptions);

      if (key === 'includeSubfolders') {
        await persistSettings({ includeSubfoldersDefault: Boolean(value) });
      }

      if (key === 'includeLowResolutionAnalysis') {
        await persistSettings({ lowResolutionAnalysisEnabledDefault: Boolean(value) });
      }

      if (key === 'includeBlackBorderAnalysis') {
        await persistSettings({ blackBorderAnalysisEnabledDefault: Boolean(value) });
      }
    },
    [auditOptions, persistSettings]
  );

  const resetSettings = useCallback(async (): Promise<void> => {
    setActiveAction('settings');

    try {
      const reset = await window.videoAudit.settings.reset();
      setSettings(reset);
      setOutputFolder(reset.defaultOutputDirectory);
      setAuditOptions(settingsToAuditOptions(reset));
      setSettingsMessage('Settings reset.');
    } catch (error: unknown) {
      setSettingsMessage(getErrorMessage(error, 'Could not reset settings.'));
    } finally {
      setActiveAction(null);
    }
  }, []);

  const startAuditRequest = useCallback(async (request: AuditRequest): Promise<void> => {
    setWorkflowMessage(null);
    setAuditProgress(null);
    setAuditResult(null);
    setAuditSummary(null);
    setAuditErrors([]);
    setVideoRows(null);
    setSelectedVideos([]);
    setActiveAction(null);
    pendingAuditRequestRef.current = request;
    setLastAuditRequest(request);

    const response = await window.videoAudit.audit.start(request);

    if (response.status !== 'started' || !response.jobId) {
      setWorkflowMessage(response.message ?? 'Could not start audit.');
      return;
    }

    setAuditJobId(response.jobId);
    setWorkflowMessage(response.message ?? 'Audit started.');
  }, []);

  const runAudit = useCallback(async (): Promise<void> => {
    const request = {
      folderPaths: selectedFolders,
      filePaths: selectedFiles,
      options: auditOptions
    };

    if (request.folderPaths.length === 0 && request.filePaths.length === 0) {
      setWorkflowMessage('Choose at least one folder or video file before running an audit.');
      return;
    }

    if (!request.options.includeLowResolutionAnalysis && !request.options.includeBlackBorderAnalysis) {
      setWorkflowMessage('At least one audit option must be selected.');
      return;
    }

    try {
      await startAuditRequest(request);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not start audit.'));
    }
  }, [auditOptions, selectedFiles, selectedFolders, startAuditRequest]);

  const refreshAudit = useCallback(async (): Promise<void> => {
    if (!lastAuditRequest) {
      setWorkflowMessage('No saved audit request is available.');
      return;
    }

    setSelectedFolders(lastAuditRequest.folderPaths);
    setSelectedFiles(lastAuditRequest.filePaths);
    setAuditOptions(lastAuditRequest.options);

    try {
      await startAuditRequest(lastAuditRequest);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not refresh audit.'));
    }
  }, [lastAuditRequest, startAuditRequest]);

  const cancelAudit = useCallback(async (): Promise<void> => {
    if (!auditJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.audit.cancel(auditJobId);
      setAuditProgress(progress);
      setWorkflowMessage(progress.message ?? 'Audit canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not cancel audit.'));
    }
  }, [auditJobId]);

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
      setStorageMessage(`Saved ${nextResult.videos.length.toLocaleString()} flagged row(s).`);
    },
    [lastAuditRequest, showThumbnailsState]
  );

  const removeSelectedVideos = useCallback(async (): Promise<void> => {
    if (!auditResult || selectedVideos.length === 0) {
      return;
    }

    const selectedPaths = new Set(selectedVideos.map((video) => video.path));
    const nextRows = auditResult.videos.map((row) =>
      selectedPaths.has(row.path) ? { ...row, visible: false } : row
    );
    const nextResult = {
      ...auditResult,
      videos: nextRows
    };

    setAuditResult(nextResult);
    setVideoRows(nextRows);
    setSelectedVideos([]);
    await persistCurrentResult(nextResult);
  }, [auditResult, persistCurrentResult, selectedVideos]);

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

  const clearAuditData = useCallback(async (): Promise<void> => {
    await clearStoredAuditResult();
    setAuditJobId(null);
    setAuditProgress(null);
    setAuditResult(null);
    setAuditSummary(null);
    setAuditErrors([]);
    setVideoRows(null);
    setSelectedVideos([]);
    setGlobalFilter('');
    setSelectedFolders([]);
    setSelectedFiles([]);
    setDiscoveryProgress(null);
    setFfprobeProgress(null);
    setLastAuditRequest(null);
    pendingAuditRequestRef.current = null;
    setStorageSavedAt(null);
    setStorageMessage('Audit data cleared.');
    setWorkflowMessage(null);
  }, []);

  const startDiscovery = useCallback(async (): Promise<void> => {
    const request: FileDiscoveryRequest = {
      folderPaths: selectedFolders,
      filePaths: selectedFiles,
      includeSubfolders: auditOptions.includeSubfolders
    };

    setWorkflowMessage(null);
    setDiscoveryProgress(null);

    if (request.folderPaths.length === 0 && request.filePaths.length === 0) {
      setWorkflowMessage('Choose at least one folder or video file before scanning.');
      return;
    }

    setActiveAction('discovery');

    try {
      const response = await window.videoAudit.discovery.start(request);

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setWorkflowMessage(response.message ?? 'Could not start file discovery.');
        return;
      }

      setDiscoveryJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'File discovery started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setWorkflowMessage(getErrorMessage(error, 'Could not start file discovery.'));
    }
  }, [auditOptions.includeSubfolders, selectedFiles, selectedFolders]);

  const cancelDiscovery = useCallback(async (): Promise<void> => {
    if (!discoveryJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.discovery.cancel(discoveryJobId);
      setDiscoveryProgress(progress);
      setWorkflowMessage(progress.message ?? 'File discovery canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not cancel file discovery.'));
    }
  }, [discoveryJobId]);

  const startFfprobe = useCallback(async (): Promise<void> => {
    const request: FfprobeMetadataRequest = {
      filePaths: discoveredPaths,
      ffprobePathOverride: settings?.ffprobePathOverride ?? null
    };

    setWorkflowMessage(null);
    setFfprobeProgress(null);

    if (request.filePaths.length === 0) {
      setWorkflowMessage('Scan files before running metadata extraction.');
      return;
    }

    setActiveAction('ffprobe');

    try {
      const response = await window.videoAudit.ffprobe.start(request);

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setWorkflowMessage(response.message ?? 'Could not start metadata extraction.');
        return;
      }

      setFfprobeJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Metadata extraction started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setWorkflowMessage(getErrorMessage(error, 'Could not start metadata extraction.'));
    }
  }, [discoveredPaths, settings?.ffprobePathOverride]);

  const cancelFfprobe = useCallback(async (): Promise<void> => {
    if (!ffprobeJobId) {
      return;
    }

    try {
      const progress = await window.videoAudit.ffprobe.cancel(ffprobeJobId);
      setFfprobeProgress(progress);
      setWorkflowMessage(progress.message ?? 'Metadata extraction canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      setWorkflowMessage(getErrorMessage(error, 'Could not cancel metadata extraction.'));
    }
  }, [ffprobeJobId]);

  return {
    appInfo,
    appInfoMessage,
    settings,
    settingsMessage,
    selectionMessage,
    workflowMessage,
    activeAction,
    selectedFolders,
    selectedFiles,
    outputFolder,
    auditOptions,
    auditProgress,
    auditPercent,
    auditSummary,
    auditErrors,
    videoRows,
    visibleVideoRows,
    removedVideoCount,
    selectedVideos,
    globalFilter,
    showThumbnails: showThumbnailsState,
    isAuditActive,
    isDiscoveryActive,
    isFfprobeActive,
    canRunAudit,
    canRefreshAudit,
    isStorageLoading,
    storageMessage,
    storageSavedAt,
    discoveryProgress,
    discoveryPercent,
    discoveredPaths,
    metadataItems,
    ffprobeProgress,
    ffprobePercent,
    chooseFolders,
    chooseFiles,
    chooseOutputFolder,
    revealPath,
    updateAuditOption,
    updateSettingsField,
    resetSettings,
    runAudit,
    refreshAudit,
    cancelAudit,
    clearAuditData,
    removeSelectedVideos,
    restoreRemovedVideos,
    setSelectedVideos,
    setGlobalFilter,
    setShowThumbnails,
    startDiscovery,
    cancelDiscovery,
    startFfprobe,
    cancelFfprobe
  };
}

function settingsToAuditOptions(settings: AppSettings): AuditOptions {
  return {
    ...DEFAULT_AUDIT_OPTIONS,
    includeSubfolders: settings.includeSubfoldersDefault,
    includeLowResolutionAnalysis: settings.lowResolutionAnalysisEnabledDefault,
    includeBlackBorderAnalysis: settings.blackBorderAnalysisEnabledDefault
  };
}

function mergeRecentPaths(nextPaths: string[], currentPaths: string[]): string[] {
  return [...new Set([...nextPaths, ...currentPaths])].slice(0, 10);
}

function getProgressPercent(processedFiles?: number, totalFiles?: number | null): number | null {
  if (!totalFiles || totalFiles <= 0 || processedFiles === undefined) {
    return null;
  }

  return Math.min(100, Math.round((processedFiles / totalFiles) * 100));
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

import { useCallback, useEffect, useState } from 'react';
import type {
  MigrationJobSnapshot,
  MigrationResult,
  MigrationScanResult
} from '../../shared/types/migration';
import * as dialogClient from '../api/dialogClient';
import * as migrationClient from '../api/migrationClient';
import { getErrorMessage } from '../helpers/errors';
import { getProgressPercent } from '../helpers/progress';

export type MigrationWorkflowActiveAction = 'migrationScan' | 'migrationExecute' | null;

interface UseMigrationWorkflowOptions {
  auditedRootDirectory: string | null;
  setWorkflowMessage: (message: string | null) => void;
  setActiveAction: (action: MigrationWorkflowActiveAction) => void;
  busyState: {
    activeAction: string | null;
  };
}

interface UseMigrationWorkflowValue {
  migrationNewEditedDir: string;
  migrationScan: MigrationScanResult | null;
  migrationScanError: string | null;
  migrationProgress: MigrationJobSnapshot | null;
  migrationPercent: number | null;
  migrationResult: MigrationResult | null;
  migrationResultError: string | null;
  isMigrationScanDialogVisible: boolean;
  isMigrationResultDialogVisible: boolean;
  setMigrationNewEditedDir: (value: string) => void;
  openMigrationDialog: () => void;
  closeMigrationDialog: () => void;
  selectMigrationFolder: () => Promise<void>;
  startMigrationScan: () => Promise<void>;
  executeMigration: () => Promise<void>;
  closeMigrationResultDialog: () => void;
  resetMigrationWorkflow: () => void;
}

export function useMigrationWorkflow({
  auditedRootDirectory,
  setWorkflowMessage,
  setActiveAction,
  busyState
}: UseMigrationWorkflowOptions): UseMigrationWorkflowValue {
  const [migrationNewEditedDir, setMigrationNewEditedDirState] = useState('');
  const [migrationScan, setMigrationScan] = useState<MigrationScanResult | null>(null);
  const [migrationScanError, setMigrationScanError] = useState<string | null>(null);
  const [migrationJobId, setMigrationJobId] = useState<string | null>(null);
  const [migrationProgress, setMigrationProgress] = useState<MigrationJobSnapshot | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [migrationResultError, setMigrationResultError] = useState<string | null>(null);
  const [isMigrationScanDialogVisible, setIsMigrationScanDialogVisible] = useState(false);
  const [isMigrationResultDialogVisible, setIsMigrationResultDialogVisible] = useState(false);
  const migrationPercent = getProgressPercent(migrationProgress?.processedFiles, migrationProgress?.totalFiles);

  const resetMigrationWorkflow = useCallback((): void => {
    setMigrationNewEditedDirState('');
    setMigrationScan(null);
    setMigrationScanError(null);
    setMigrationJobId(null);
    setMigrationProgress(null);
    setMigrationResult(null);
    setMigrationResultError(null);
    setIsMigrationScanDialogVisible(false);
    setIsMigrationResultDialogVisible(false);
  }, []);

  useEffect(() => {
    return migrationClient.subscribeToMigrationProgress((progress) => {
      setMigrationProgress(progress);

      if (progress.jobId) {
        setMigrationJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('migrationExecute');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setMigrationResult(progress.result);
        setMigrationResultError(null);
        setIsMigrationScanDialogVisible(false);
        setIsMigrationResultDialogVisible(true);
        setWorkflowMessage(
          `Migration complete. ${progress.result.summary.filesCopiedToDestination.toLocaleString()} copied, ${progress.result.summary.destinationMatchesArchived.toLocaleString()} archived.`
        );
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setMigrationResultError(progress.error ?? progress.message ?? 'Migration failed.');
        setIsMigrationScanDialogVisible(false);
        setIsMigrationResultDialogVisible(true);
        setWorkflowMessage(progress.message ?? 'Migration failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setMigrationResultError(null);
        setWorkflowMessage(progress.message ?? 'Migration canceled.');
      }
    });
  }, [setActiveAction, setWorkflowMessage]);

  const setMigrationNewEditedDir = useCallback((value: string): void => {
    setMigrationNewEditedDirState(value);
    setMigrationScan(null);
    setMigrationScanError(null);
    setMigrationResult(null);
    setMigrationResultError(null);
  }, []);

  const openMigrationDialog = useCallback((): void => {
    if (!auditedRootDirectory) {
      setWorkflowMessage('Migration needs a single audited root folder. Run or refresh an audit from one folder first.');
      return;
    }

    setMigrationScan(null);
    setMigrationScanError(null);
    setMigrationProgress(null);
    setMigrationResult(null);
    setMigrationResultError(null);
    setIsMigrationResultDialogVisible(false);
    setIsMigrationScanDialogVisible(true);
  }, [auditedRootDirectory, setWorkflowMessage]);

  const closeMigrationDialog = useCallback((): void => {
    if (isMigrationActive(busyState.activeAction, migrationProgress)) {
      return;
    }

    setIsMigrationScanDialogVisible(false);
    setMigrationScanError(null);
    setMigrationResultError(null);
  }, [busyState.activeAction, migrationProgress]);

  const selectMigrationFolder = useCallback(async (): Promise<void> => {
    setActiveAction('migrationScan');
    setMigrationScanError(null);

    try {
      const result = await dialogClient.chooseFolders();

      if (result.canceled) {
        return;
      }

      const selectedPath = result.paths[0];

      if (selectedPath) {
        setMigrationNewEditedDir(selectedPath);
      }

      if (result.invalidPaths.length > 0) {
        setMigrationScanError(`${result.invalidPaths.length.toLocaleString()} selected path(s) could not be used.`);
      }
    } catch (error: unknown) {
      setMigrationScanError(getErrorMessage(error, 'Could not choose a new edits folder.'));
    } finally {
      setActiveAction(null);
    }
  }, [setActiveAction, setMigrationNewEditedDir]);

  const startMigrationScan = useCallback(async (): Promise<void> => {
    const newEditedDir = migrationNewEditedDir.trim();

    if (!auditedRootDirectory) {
      setMigrationScanError('Migration needs a single audited root folder.');
      return;
    }

    if (!newEditedDir) {
      setMigrationScanError('Choose the folder that contains the new edited videos.');
      return;
    }

    setActiveAction('migrationScan');
    setMigrationScan(null);
    setMigrationScanError(null);
    setMigrationProgress(null);
    setMigrationResult(null);
    setMigrationResultError(null);

    try {
      const response = await migrationClient.scanMigration({
        newEditedDir,
        destinationRoot: auditedRootDirectory
      });

      if (response.status !== 'complete' || !response.result) {
        setMigrationScanError(response.message ?? 'Migration scan failed.');
        return;
      }

      setMigrationScan(response.result);
      setWorkflowMessage(
        `Migration scan complete. ${response.result.summary.newFilesFound.toLocaleString()} new file(s) found.`
      );
    } catch (error: unknown) {
      setMigrationScanError(getErrorMessage(error, 'Migration scan failed.'));
    } finally {
      setActiveAction(null);
    }
  }, [auditedRootDirectory, migrationNewEditedDir, setActiveAction, setWorkflowMessage]);

  const executeMigration = useCallback(async (): Promise<void> => {
    if (!migrationScan) {
      setMigrationResultError('Run a migration scan before executing.');
      return;
    }

    setMigrationResult(null);
    setMigrationResultError(null);
    setMigrationProgress({
      jobId: null,
      migrationId: migrationScan.migrationId,
      status: 'starting',
      phase: 'validating',
      totalFiles: migrationScan.items.length,
      processedFiles: 0,
      copiedCount: 0,
      archivedCount: 0,
      failedCount: 0,
      currentFile: null,
      message: 'Starting migration.',
      error: null
    });
    setActiveAction('migrationExecute');

    try {
      const response = await migrationClient.executeMigration({
        migrationId: migrationScan.migrationId
      });

      if (response.status !== 'started' || !response.jobId) {
        setActiveAction(null);
        setMigrationResultError(response.message ?? 'Could not start migration.');
        return;
      }

      setMigrationJobId(response.jobId);
      setWorkflowMessage(response.message ?? 'Migration started.');
    } catch (error: unknown) {
      setActiveAction(null);
      setMigrationResultError(getErrorMessage(error, 'Could not start migration.'));
    }
  }, [migrationScan, setActiveAction, setWorkflowMessage]);

  const closeMigrationResultDialog = useCallback((): void => {
    if (isMigrationActive(busyState.activeAction, migrationProgress)) {
      return;
    }

    setIsMigrationResultDialogVisible(false);
    setMigrationResultError(null);
  }, [busyState.activeAction, migrationProgress]);

  return {
    migrationNewEditedDir,
    migrationScan,
    migrationScanError,
    migrationProgress,
    migrationPercent,
    migrationResult,
    migrationResultError,
    isMigrationScanDialogVisible,
    isMigrationResultDialogVisible,
    setMigrationNewEditedDir,
    openMigrationDialog,
    closeMigrationDialog,
    selectMigrationFolder,
    startMigrationScan,
    executeMigration,
    closeMigrationResultDialog,
    resetMigrationWorkflow
  };
}

function isMigrationActive(activeAction: string | null, progress: MigrationJobSnapshot | null): boolean {
  return activeAction === 'migrationScan' || activeAction === 'migrationExecute' || isRunningMigrationProgress(progress);
}

function isRunningMigrationProgress(progress: MigrationJobSnapshot | null): boolean {
  return progress?.status === 'starting' || progress?.status === 'running';
}

import { useCallback, useState } from 'react';
import type {
  ArchiveOperationPlan,
  DestinationConflictStrategy,
  FileOperationResult,
  MoveOperationPlan,
  TrashOperationPlan
} from '../../shared/types/fileOperations';
import type { VideoRow } from '../../shared/types/video';
import * as dialogClient from '../api/dialogClient';
import * as fileOperationsClient from '../api/fileOperationsClient';
import { getErrorMessage } from '../helpers/errors';
import { toKnownFileOperationItem } from '../helpers/fileOperationItems';
import { getKnownDirectories } from '../helpers/knownDirectories';

export type FileOperationsWorkflowActiveAction =
  | 'trashPlan'
  | 'trashExecute'
  | 'movePlan'
  | 'moveExecute'
  | 'archivePlan'
  | 'archiveExecute'
  | null;

interface FileOperationsWorkflowBusyState {
  isTrashExecuting: boolean;
  isMoveExecuting: boolean;
  isArchiveExecuting: boolean;
}

interface UseFileOperationsWorkflowOptions {
  selectedVideos: VideoRow[];
  selectedFolders: string[];
  auditedRootDirectory: string | null;
  outputFolder: string | null;
  fileManagementConflictStrategy?: DestinationConflictStrategy;
  previewOperationHistoryAfterExecution?: boolean;
  hideVideoPathsFromTable: (paths: string[]) => Promise<number>;
  openOperationHistory: () => Promise<void>;
  setWorkflowMessage: (message: string | null) => void;
  setActiveAction: (action: FileOperationsWorkflowActiveAction) => void;
  busyState: FileOperationsWorkflowBusyState;
}

interface UseFileOperationsWorkflowValue {
  trashPlan: TrashOperationPlan | null;
  trashPlanError: string | null;
  trashResult: FileOperationResult | null;
  trashResultError: string | null;
  isTrashConfirmDialogVisible: boolean;
  isTrashResultDialogVisible: boolean;
  openTrashDialog: () => Promise<void>;
  closeTrashDialog: () => void;
  executeTrashPlan: (typedConfirmation: string | null) => Promise<void>;
  closeTrashResultDialog: () => void;
  movePlan: MoveOperationPlan | null;
  movePlanError: string | null;
  moveResult: FileOperationResult | null;
  moveResultError: string | null;
  isMoveConfirmDialogVisible: boolean;
  isMoveResultDialogVisible: boolean;
  openMoveDialog: (conflictStrategy?: DestinationConflictStrategy) => Promise<void>;
  closeMoveDialog: () => void;
  executeMovePlan: () => Promise<void>;
  closeMoveResultDialog: () => void;
  archivePlan: ArchiveOperationPlan | null;
  archivePlanError: string | null;
  archiveResult: FileOperationResult | null;
  archiveResultError: string | null;
  isArchiveConfirmDialogVisible: boolean;
  isArchiveResultDialogVisible: boolean;
  openArchiveDialog: () => Promise<void>;
  closeArchiveDialog: () => void;
  executeArchivePlan: () => Promise<void>;
  closeArchiveResultDialog: () => void;
  resetFileOperationsWorkflow: () => void;
}

export function useFileOperationsWorkflow({
  selectedVideos,
  selectedFolders,
  auditedRootDirectory,
  outputFolder,
  fileManagementConflictStrategy,
  previewOperationHistoryAfterExecution,
  hideVideoPathsFromTable,
  openOperationHistory,
  setWorkflowMessage,
  setActiveAction,
  busyState
}: UseFileOperationsWorkflowOptions): UseFileOperationsWorkflowValue {
  const [trashPlan, setTrashPlan] = useState<TrashOperationPlan | null>(null);
  const [trashPlanError, setTrashPlanError] = useState<string | null>(null);
  const [trashResult, setTrashResult] = useState<FileOperationResult | null>(null);
  const [trashResultError, setTrashResultError] = useState<string | null>(null);
  const [isTrashConfirmDialogVisible, setIsTrashConfirmDialogVisible] = useState(false);
  const [isTrashResultDialogVisible, setIsTrashResultDialogVisible] = useState(false);
  const [movePlan, setMovePlan] = useState<MoveOperationPlan | null>(null);
  const [movePlanError, setMovePlanError] = useState<string | null>(null);
  const [moveResult, setMoveResult] = useState<FileOperationResult | null>(null);
  const [moveResultError, setMoveResultError] = useState<string | null>(null);
  const [isMoveConfirmDialogVisible, setIsMoveConfirmDialogVisible] = useState(false);
  const [isMoveResultDialogVisible, setIsMoveResultDialogVisible] = useState(false);
  const [archivePlan, setArchivePlan] = useState<ArchiveOperationPlan | null>(null);
  const [archivePlanError, setArchivePlanError] = useState<string | null>(null);
  const [archiveResult, setArchiveResult] = useState<FileOperationResult | null>(null);
  const [archiveResultError, setArchiveResultError] = useState<string | null>(null);
  const [isArchiveConfirmDialogVisible, setIsArchiveConfirmDialogVisible] = useState(false);
  const [isArchiveResultDialogVisible, setIsArchiveResultDialogVisible] = useState(false);

  const resetFileOperationsWorkflow = useCallback((): void => {
    setTrashPlan(null);
    setTrashPlanError(null);
    setTrashResult(null);
    setTrashResultError(null);
    setIsTrashConfirmDialogVisible(false);
    setIsTrashResultDialogVisible(false);
    setMovePlan(null);
    setMovePlanError(null);
    setMoveResult(null);
    setMoveResultError(null);
    setIsMoveConfirmDialogVisible(false);
    setIsMoveResultDialogVisible(false);
    setArchivePlan(null);
    setArchivePlanError(null);
    setArchiveResult(null);
    setArchiveResultError(null);
    setIsArchiveConfirmDialogVisible(false);
    setIsArchiveResultDialogVisible(false);
  }, []);

  const openTrashDialog = useCallback(async (): Promise<void> => {
    if (selectedVideos.length === 0) {
      setWorkflowMessage('Select at least one video before moving files to Trash.');
      return;
    }

    setTrashPlan(null);
    setTrashPlanError(null);
    setTrashResult(null);
    setTrashResultError(null);
    setActiveAction('trashPlan');

    try {
      const response = await fileOperationsClient.createTrashPlan({
        operationType: 'trash',
        items: selectedVideos.map(toKnownFileOperationItem),
        knownRootDirectories: getKnownDirectories({
          auditedRootDirectory,
          selectedFolders,
          selectedVideos
        }),
        knownOutputDirectories: outputFolder ? [outputFolder] : []
      });

      if (response.status !== 'planned' || !response.plan) {
        setTrashPlanError(response.message ?? 'Could not create a Move to Trash plan.');
        setWorkflowMessage(response.message ?? 'Could not create a Move to Trash plan.');
        return;
      }

      setTrashPlan(response.plan);
      setIsTrashConfirmDialogVisible(true);
      setWorkflowMessage(null);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Could not create a Move to Trash plan.');
      setTrashPlanError(message);
      setWorkflowMessage(message);
    } finally {
      setActiveAction(null);
    }
  }, [
    auditedRootDirectory,
    outputFolder,
    selectedFolders,
    selectedVideos,
    setActiveAction,
    setWorkflowMessage
  ]);

  const closeTrashDialog = useCallback((): void => {
    if (busyState.isTrashExecuting) {
      return;
    }

    setIsTrashConfirmDialogVisible(false);
    setTrashPlanError(null);
  }, [busyState.isTrashExecuting]);

  const executeTrashPlan = useCallback(
    async (typedConfirmation: string | null): Promise<void> => {
      if (!trashPlan) {
        setTrashPlanError('Create a Move to Trash plan before executing.');
        return;
      }

      setTrashPlanError(null);
      setTrashResult(null);
      setTrashResultError(null);
      setActiveAction('trashExecute');

      try {
        const response = await fileOperationsClient.executeTrashPlan({
          planId: trashPlan.id,
          confirmed: true,
          typedConfirmation
        });

        if (!response.result) {
          const message = response.message ?? 'Move to Trash did not complete.';
          setTrashPlanError(message);
          setWorkflowMessage(message);
          return;
        }

        setTrashResult(response.result);
        setIsTrashConfirmDialogVisible(false);
        setIsTrashResultDialogVisible(true);
        setTrashPlan(null);
        setWorkflowMessage(response.message ?? 'Move to Trash complete.');

        const trashedPaths = response.result.items
          .filter((item) => item.status === 'success')
          .map((item) => item.sourcePath);
        await hideVideoPathsFromTable(trashedPaths);
      } catch (error: unknown) {
        const message = getErrorMessage(error, 'Could not move selected files to Trash.');
        setTrashPlanError(message);
        setTrashResultError(message);
        setWorkflowMessage(message);
      } finally {
        setActiveAction(null);
      }
    },
    [hideVideoPathsFromTable, setActiveAction, setWorkflowMessage, trashPlan]
  );

  const closeTrashResultDialog = useCallback((): void => {
    setIsTrashResultDialogVisible(false);
    setTrashResultError(null);
    if (previewOperationHistoryAfterExecution) {
      void openOperationHistory();
    }
  }, [openOperationHistory, previewOperationHistoryAfterExecution]);

  const openMoveDialog = useCallback(
    async (conflictStrategy?: DestinationConflictStrategy): Promise<void> => {
      if (selectedVideos.length === 0) {
        setWorkflowMessage('Select at least one video before moving files.');
        return;
      }

      const effectiveConflictStrategy = conflictStrategy ?? fileManagementConflictStrategy ?? 'skip';

      setMovePlan(null);
      setMovePlanError(null);
      setMoveResult(null);
      setMoveResultError(null);
      setActiveAction('movePlan');

      try {
        const destinationResult = await dialogClient.chooseMoveDestinationFolder();

        if (destinationResult.canceled) {
          return;
        }

        const destinationDirectory = destinationResult.paths[0];

        if (!destinationDirectory) {
          const reason = destinationResult.invalidPaths[0]?.reason ?? 'Choose a valid destination folder.';
          setMovePlanError(reason);
          setWorkflowMessage(reason);
          return;
        }

        const response = await fileOperationsClient.createMovePlan({
          operationType: 'move',
          items: selectedVideos.map(toKnownFileOperationItem),
          destinationDirectory,
          conflictStrategy: effectiveConflictStrategy
        });

        if (response.status !== 'planned' || !response.plan) {
          setMovePlanError(response.message ?? 'Could not create a move plan.');
          setWorkflowMessage(response.message ?? 'Could not create a move plan.');
          return;
        }

        setMovePlan(response.plan);
        setIsMoveConfirmDialogVisible(true);
        setWorkflowMessage(null);
      } catch (error: unknown) {
        const message = getErrorMessage(error, 'Could not create a move plan.');
        setMovePlanError(message);
        setWorkflowMessage(message);
      } finally {
        setActiveAction(null);
      }
    },
    [fileManagementConflictStrategy, selectedVideos, setActiveAction, setWorkflowMessage]
  );

  const closeMoveDialog = useCallback((): void => {
    if (busyState.isMoveExecuting) {
      return;
    }

    setIsMoveConfirmDialogVisible(false);
    setMovePlanError(null);
  }, [busyState.isMoveExecuting]);

  const executeMovePlan = useCallback(async (): Promise<void> => {
    if (!movePlan) {
      setMovePlanError('Create a move plan before executing.');
      return;
    }

    setMovePlanError(null);
    setMoveResult(null);
    setMoveResultError(null);
    setActiveAction('moveExecute');

    try {
      const response = await fileOperationsClient.executeMovePlan({
        planId: movePlan.id,
        confirmed: true
      });

      if (!response.result) {
        const message = response.message ?? 'Move operation did not complete.';
        setMovePlanError(message);
        setWorkflowMessage(message);
        return;
      }

      setMoveResult(response.result);
      setIsMoveConfirmDialogVisible(false);
      setIsMoveResultDialogVisible(true);
      setMovePlan(null);
      setWorkflowMessage(response.message ?? 'Move operation complete.');

      const movedPaths = response.result.items
        .filter((item) => item.status === 'success')
        .map((item) => item.sourcePath);
      await hideVideoPathsFromTable(movedPaths);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Could not move selected files.');
      setMovePlanError(message);
      setMoveResultError(message);
      setWorkflowMessage(message);
    } finally {
      setActiveAction(null);
    }
  }, [hideVideoPathsFromTable, movePlan, setActiveAction, setWorkflowMessage]);

  const closeMoveResultDialog = useCallback((): void => {
    setIsMoveResultDialogVisible(false);
    setMoveResultError(null);
    if (previewOperationHistoryAfterExecution) {
      void openOperationHistory();
    }
  }, [openOperationHistory, previewOperationHistoryAfterExecution]);

  const openArchiveDialog = useCallback(async (): Promise<void> => {
    if (selectedVideos.length === 0) {
      setWorkflowMessage('Select at least one video before archiving originals.');
      return;
    }

    setArchivePlan(null);
    setArchivePlanError(null);
    setArchiveResult(null);
    setArchiveResultError(null);
    setActiveAction('archivePlan');

    try {
      const response = await fileOperationsClient.createArchivePlan({
        operationType: 'archive',
        items: selectedVideos.map(toKnownFileOperationItem),
        conflictStrategy: fileManagementConflictStrategy ?? 'rename-with-suffix'
      });

      if (response.status !== 'planned' || !response.plan) {
        setArchivePlanError(response.message ?? 'Could not create an archive plan.');
        setWorkflowMessage(response.message ?? 'Could not create an archive plan.');
        return;
      }

      setArchivePlan(response.plan);
      setIsArchiveConfirmDialogVisible(true);
      setWorkflowMessage(null);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Could not create an archive plan.');
      setArchivePlanError(message);
      setWorkflowMessage(message);
    } finally {
      setActiveAction(null);
    }
  }, [fileManagementConflictStrategy, selectedVideos, setActiveAction, setWorkflowMessage]);

  const closeArchiveDialog = useCallback((): void => {
    if (busyState.isArchiveExecuting) {
      return;
    }

    setIsArchiveConfirmDialogVisible(false);
    setArchivePlanError(null);
  }, [busyState.isArchiveExecuting]);

  const executeArchivePlan = useCallback(async (): Promise<void> => {
    if (!archivePlan) {
      setArchivePlanError('Create an archive plan before executing.');
      return;
    }

    setArchivePlanError(null);
    setArchiveResult(null);
    setArchiveResultError(null);
    setActiveAction('archiveExecute');

    try {
      const response = await fileOperationsClient.executeArchivePlan({
        planId: archivePlan.id,
        confirmed: true
      });

      if (!response.result) {
        const message = response.message ?? 'Archive operation did not complete.';
        setArchivePlanError(message);
        setWorkflowMessage(message);
        return;
      }

      setArchiveResult(response.result);
      setIsArchiveConfirmDialogVisible(false);
      setIsArchiveResultDialogVisible(true);
      setArchivePlan(null);
      setWorkflowMessage(response.message ?? 'Archive operation complete.');

      const archivedPaths = response.result.items
        .filter((item) => item.status === 'success')
        .map((item) => item.sourcePath);
      await hideVideoPathsFromTable(archivedPaths);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Could not archive selected originals.');
      setArchivePlanError(message);
      setArchiveResultError(message);
      setWorkflowMessage(message);
    } finally {
      setActiveAction(null);
    }
  }, [archivePlan, hideVideoPathsFromTable, setActiveAction, setWorkflowMessage]);

  const closeArchiveResultDialog = useCallback((): void => {
    setIsArchiveResultDialogVisible(false);
    setArchiveResultError(null);
    if (previewOperationHistoryAfterExecution) {
      void openOperationHistory();
    }
  }, [openOperationHistory, previewOperationHistoryAfterExecution]);

  return {
    trashPlan,
    trashPlanError,
    trashResult,
    trashResultError,
    isTrashConfirmDialogVisible,
    isTrashResultDialogVisible,
    openTrashDialog,
    closeTrashDialog,
    executeTrashPlan,
    closeTrashResultDialog,
    movePlan,
    movePlanError,
    moveResult,
    moveResultError,
    isMoveConfirmDialogVisible,
    isMoveResultDialogVisible,
    openMoveDialog,
    closeMoveDialog,
    executeMovePlan,
    closeMoveResultDialog,
    archivePlan,
    archivePlanError,
    archiveResult,
    archiveResultError,
    isArchiveConfirmDialogVisible,
    isArchiveResultDialogVisible,
    openArchiveDialog,
    closeArchiveDialog,
    executeArchivePlan,
    closeArchiveResultDialog,
    resetFileOperationsWorkflow
  };
}

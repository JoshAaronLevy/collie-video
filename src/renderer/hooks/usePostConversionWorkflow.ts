import { useCallback, useEffect, useState } from 'react';
import type { AutoCropResult } from '../../shared/types/autoCrop';
import type { AutoFixResult } from '../../shared/types/autoFix';
import type { FileOperationResult } from '../../shared/types/fileOperations';
import type {
  ReplacementAction,
  ReplacementExecutionJobSnapshot,
  ReplacementPlan,
  ReplacementPlanActionUpdate,
  ReplacementPlanBulkAction
} from '../../shared/types/replacementWorkflow';
import type { AppSettings } from '../../shared/types/settings';
import * as replacementClient from '../api/replacementClient';
import { getErrorMessage } from '../helpers/errors';
import { getProgressPercent } from '../helpers/progress';
import {
  getExecutableReplacementItemCount,
  getReplacementBulkActionMessage,
  getReplacementBulkActionUpdates,
  hasSuccessfulConversionOutputs,
  requiresReplacementConfirmation
} from '../helpers/replacementPlan';

export type PostConversionDialogMode = 'choices' | 'manual-review';

export type PostConversionWorkflowActiveAction =
  | 'replacementPlan'
  | 'replacementUpdate'
  | 'replacementExecute'
  | null;

interface UsePostConversionWorkflowOptions {
  settings: AppSettings | null;
  hideVideoPathsFromTable: (paths: string[]) => Promise<number>;
  openOperationHistory: () => Promise<void>;
  setWorkflowMessage: (message: string | null) => void;
  setActiveAction: (action: PostConversionWorkflowActiveAction) => void;
  busyState: {
    activeAction: string | null;
  };
}

interface CreatePostConversionPlanInput {
  sourceLabel: string;
  autoFixResult?: AutoFixResult;
  autoCropResult?: AutoCropResult;
}

interface UsePostConversionWorkflowValue {
  postConversionPlan: ReplacementPlan | null;
  postConversionSourceLabel: string | null;
  postConversionMode: PostConversionDialogMode;
  postConversionError: string | null;
  postConversionMessage: string | null;
  isPostConversionDialogVisible: boolean;
  replacementProgress: ReplacementExecutionJobSnapshot | null;
  replacementPercent: number | null;
  replacementResult: FileOperationResult | null;
  replacementResultError: string | null;
  isReplacementResultDialogVisible: boolean;
  createPostConversionPlan: (input: CreatePostConversionPlanInput) => Promise<boolean>;
  changePostConversionPlanAction: (itemId: string, selectedAction: ReplacementAction) => Promise<void>;
  applyPostConversionPlanBulkAction: (action: ReplacementPlanBulkAction) => Promise<void>;
  replacePostConversionOriginals: (typedConfirmation: string | null) => Promise<void>;
  reviewPostConversionPlan: () => void;
  leavePostConversionOutputs: () => void;
  backToPostConversionChoices: () => void;
  closePostConversionDialog: () => void;
  cancelReplacementExecution: () => Promise<void>;
  closeReplacementResultDialog: () => void;
  resetPostConversionWorkflow: () => void;
}

export function usePostConversionWorkflow({
  settings,
  hideVideoPathsFromTable,
  openOperationHistory,
  setWorkflowMessage,
  setActiveAction,
  busyState
}: UsePostConversionWorkflowOptions): UsePostConversionWorkflowValue {
  const [postConversionPlan, setPostConversionPlan] = useState<ReplacementPlan | null>(null);
  const [postConversionSourceLabel, setPostConversionSourceLabel] = useState<string | null>(null);
  const [postConversionMode, setPostConversionMode] = useState<PostConversionDialogMode>('choices');
  const [postConversionError, setPostConversionError] = useState<string | null>(null);
  const [postConversionMessage, setPostConversionMessage] = useState<string | null>(null);
  const [isPostConversionDialogVisible, setIsPostConversionDialogVisible] = useState(false);
  const [replacementJobId, setReplacementJobId] = useState<string | null>(null);
  const [replacementProgress, setReplacementProgress] = useState<ReplacementExecutionJobSnapshot | null>(null);
  const [replacementResult, setReplacementResult] = useState<FileOperationResult | null>(null);
  const [replacementResultError, setReplacementResultError] = useState<string | null>(null);
  const [isReplacementResultDialogVisible, setIsReplacementResultDialogVisible] = useState(false);

  const replacementPercent = getProgressPercent(
    replacementProgress?.processedItems,
    replacementProgress?.totalItems
  );

  const resetPostConversionWorkflow = useCallback((): void => {
    setPostConversionPlan(null);
    setPostConversionSourceLabel(null);
    setPostConversionMode('choices');
    setPostConversionError(null);
    setPostConversionMessage(null);
    setIsPostConversionDialogVisible(false);
    setReplacementJobId(null);
    setReplacementProgress(null);
    setReplacementResult(null);
    setReplacementResultError(null);
    setIsReplacementResultDialogVisible(false);
  }, []);

  const createPostConversionPlan = useCallback(
    async ({
      sourceLabel,
      autoFixResult,
      autoCropResult
    }: CreatePostConversionPlanInput): Promise<boolean> => {
      const source = autoFixResult ? 'auto-fix-result' : 'auto-crop-result';

      if (!hasSuccessfulConversionOutputs(autoFixResult ?? autoCropResult ?? null)) {
        return false;
      }

      const postConversionAction = settings?.defaultPostConversionAction ?? 'ask-every-time';
      const shouldShowPostConversionDialog = settings?.showPostConversionDialogAutomatically ?? true;

      if (!shouldShowPostConversionDialog || postConversionAction === 'leave-outputs') {
        setPostConversionPlan(null);
        setPostConversionSourceLabel(null);
        setPostConversionMode('choices');
        setPostConversionError(null);
        setPostConversionMessage(null);
        setIsPostConversionDialogVisible(false);
        setWorkflowMessage(`${sourceLabel} complete. Converted files were left in the output folder.`);
        return true;
      }

      setPostConversionPlan(null);
      setPostConversionSourceLabel(sourceLabel);
      setPostConversionMode(postConversionAction === 'review-manually' ? 'manual-review' : 'choices');
      setPostConversionError(null);
      setPostConversionMessage(null);
      setIsPostConversionDialogVisible(true);
      setActiveAction('replacementPlan');

      try {
        const response = await replacementClient.createReplacementPlan({
          source,
          defaultAction: 'replace-original',
          autoFixResult: autoFixResult ?? null,
          autoCropResult: autoCropResult ?? null
        });

        if (response.status !== 'planned' || !response.plan) {
          setPostConversionError(response.message ?? 'Could not create a replacement plan.');
          return true;
        }

        setPostConversionPlan(response.plan);
        return true;
      } catch (error: unknown) {
        setPostConversionError(getErrorMessage(error, 'Could not create a replacement plan.'));
        return true;
      } finally {
        setActiveAction(null);
      }
    },
    [
      setActiveAction,
      setWorkflowMessage,
      settings?.defaultPostConversionAction,
      settings?.showPostConversionDialogAutomatically
    ]
  );

  const updatePostConversionPlanActions = useCallback(
    async (actions: ReplacementPlanActionUpdate[], successMessage: string): Promise<void> => {
      if (!postConversionPlan) {
        setPostConversionError('Create a replacement plan before updating actions.');
        return;
      }

      if (actions.length === 0) {
        setPostConversionMessage('No matching replacement plan items to update.');
        return;
      }

      setPostConversionError(null);
      setPostConversionMessage(null);
      setActiveAction('replacementUpdate');

      try {
        const response = await replacementClient.updateReplacementPlanActions({
          planId: postConversionPlan.id,
          actions
        });

        if (response.status !== 'updated' || !response.plan) {
          setPostConversionError(response.message ?? 'Could not update replacement plan actions.');
          return;
        }

        setPostConversionPlan(response.plan);
        setPostConversionMessage(successMessage);
      } catch (error: unknown) {
        setPostConversionError(getErrorMessage(error, 'Could not update replacement plan actions.'));
      } finally {
        setActiveAction(null);
      }
    },
    [postConversionPlan, setActiveAction]
  );

  const changePostConversionPlanAction = useCallback(
    async (itemId: string, selectedAction: ReplacementAction): Promise<void> => {
      await updatePostConversionPlanActions(
        [
          {
            itemId,
            selectedAction
          }
        ],
        'Replacement action updated.'
      );
    },
    [updatePostConversionPlanActions]
  );

  const applyPostConversionPlanBulkAction = useCallback(
    async (action: ReplacementPlanBulkAction): Promise<void> => {
      if (!postConversionPlan) {
        setPostConversionError('Create a replacement plan before updating actions.');
        return;
      }

      const actions = getReplacementBulkActionUpdates(postConversionPlan, action);

      await updatePostConversionPlanActions(actions, getReplacementBulkActionMessage(action));
    },
    [postConversionPlan, updatePostConversionPlanActions]
  );

  const replacePostConversionOriginals = useCallback(
    async (typedConfirmation: string | null): Promise<void> => {
      if (!postConversionPlan) {
        setPostConversionError('Create a replacement plan before replacing originals.');
        return;
      }

      const executableCount = getExecutableReplacementItemCount(postConversionPlan);

      if (executableCount === 0) {
        setPostConversionError('No replacement items are ready.');
        return;
      }

      if (
        requiresReplacementConfirmation(postConversionPlan, settings) &&
        typedConfirmation !== REPLACE_CONFIRMATION_PHRASE
      ) {
        setPostConversionError('Type REPLACE before replacing originals.');
        return;
      }

      setPostConversionError(null);
      setPostConversionMessage(null);
      setReplacementProgress({
        jobId: null,
        planId: postConversionPlan.id,
        status: 'starting',
        phase: 'validating',
        totalItems: postConversionPlan.items.length,
        processedItems: 0,
        succeededCount: 0,
        skippedCount: 0,
        failedCount: 0,
        currentFile: null,
        message: 'Starting replacement execution.',
        error: null
      });
      setReplacementResult(null);
      setReplacementResultError(null);
      setIsReplacementResultDialogVisible(false);
      setActiveAction('replacementExecute');

      try {
        const response = await replacementClient.executeReplacementPlan({
          planId: postConversionPlan.id,
          confirmed: true,
          typedConfirmation,
          originalDisposition: 'move-original-to-trash'
        });

        if (response.status !== 'started' || !response.jobId) {
          setActiveAction(null);
          setPostConversionError(response.message ?? 'Could not start replacement execution.');
          setReplacementResultError(response.message ?? 'Could not start replacement execution.');
          return;
        }

        setReplacementJobId(response.jobId);
        setPostConversionMessage(
          response.message ?? `${executableCount.toLocaleString()} replacement item(s) queued.`
        );
        setWorkflowMessage(response.message ?? 'Replacement execution started.');
      } catch (error: unknown) {
        const message = getErrorMessage(error, 'Could not start replacement execution.');
        setActiveAction(null);
        setPostConversionError(message);
        setReplacementResultError(message);
        setWorkflowMessage(message);
      }
    },
    [postConversionPlan, setActiveAction, setWorkflowMessage, settings]
  );

  const reviewPostConversionPlan = useCallback((): void => {
    setPostConversionError(null);
    setPostConversionMessage(null);
    setPostConversionMode('manual-review');
  }, []);

  const leavePostConversionOutputs = useCallback((): void => {
    setIsPostConversionDialogVisible(false);
    setPostConversionError(null);
    setPostConversionMessage(null);
    setWorkflowMessage('Converted files were left in the output folder.');
  }, [setWorkflowMessage]);

  const backToPostConversionChoices = useCallback((): void => {
    setPostConversionMode('choices');
    setPostConversionError(null);
    setPostConversionMessage(null);
  }, []);

  const closePostConversionDialog = useCallback((): void => {
    if (
      busyState.activeAction === 'replacementUpdate' ||
      busyState.activeAction === 'replacementExecute' ||
      isRunningReplacementProgress(replacementProgress)
    ) {
      return;
    }

    setIsPostConversionDialogVisible(false);
    setPostConversionError(null);
    setPostConversionMessage(null);
  }, [busyState.activeAction, replacementProgress]);

  const cancelReplacementExecution = useCallback(async (): Promise<void> => {
    if (!replacementJobId) {
      return;
    }

    try {
      const progress = await replacementClient.cancelReplacementExecution(replacementJobId);
      setReplacementProgress(progress);
      setWorkflowMessage(progress.message ?? 'Replacement execution canceled.');
      setActiveAction(null);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Could not cancel replacement execution.');
      setReplacementResultError(message);
      setWorkflowMessage(message);
    }
  }, [replacementJobId, setActiveAction, setWorkflowMessage]);

  const closeReplacementResultDialog = useCallback((): void => {
    setIsReplacementResultDialogVisible(false);
    setReplacementResultError(null);
    if (settings?.previewOperationHistoryAfterExecution) {
      void openOperationHistory();
    }
  }, [openOperationHistory, settings?.previewOperationHistoryAfterExecution]);

  useEffect(() => {
    return replacementClient.subscribeToReplacementProgress((progress) => {
      setReplacementProgress(progress);

      if (progress.jobId) {
        setReplacementJobId(progress.jobId);
      }

      if (progress.status === 'running' || progress.status === 'starting') {
        setActiveAction('replacementExecute');
      }

      if (progress.status === 'complete' && progress.result) {
        setActiveAction(null);
        setReplacementResult(progress.result);
        setReplacementResultError(null);
        setIsPostConversionDialogVisible(false);
        setIsReplacementResultDialogVisible(true);

        const replacedPaths = progress.result.items
          .filter((item) => item.status === 'success')
          .map((item) => item.sourcePath);

        void hideVideoPathsFromTable(replacedPaths).then((hiddenCount) => {
          const hiddenText =
            hiddenCount > 0 ? ` ${hiddenCount.toLocaleString()} original row(s) were removed from the table.` : '';
          setWorkflowMessage(`${progress.message ?? 'Replacement complete.'}${hiddenText}`);
        });
      }

      if (progress.status === 'error') {
        setActiveAction(null);
        setReplacementResultError(progress.error ?? progress.message ?? 'Replacement execution failed.');
        setWorkflowMessage(progress.message ?? 'Replacement execution failed.');
      }

      if (progress.status === 'canceled') {
        setActiveAction(null);
        setReplacementResult(progress.result ?? null);
        setReplacementResultError(null);
        setIsPostConversionDialogVisible(false);
        setIsReplacementResultDialogVisible(Boolean(progress.result));
        setWorkflowMessage(progress.message ?? 'Replacement execution canceled.');
      }
    });
  }, [hideVideoPathsFromTable, setActiveAction, setWorkflowMessage]);

  return {
    postConversionPlan,
    postConversionSourceLabel,
    postConversionMode,
    postConversionError,
    postConversionMessage,
    isPostConversionDialogVisible,
    replacementProgress,
    replacementPercent,
    replacementResult,
    replacementResultError,
    isReplacementResultDialogVisible,
    createPostConversionPlan,
    changePostConversionPlanAction,
    applyPostConversionPlanBulkAction,
    replacePostConversionOriginals,
    reviewPostConversionPlan,
    leavePostConversionOutputs,
    backToPostConversionChoices,
    closePostConversionDialog,
    cancelReplacementExecution,
    closeReplacementResultDialog,
    resetPostConversionWorkflow
  };
}

function isRunningReplacementProgress(progress: ReplacementExecutionJobSnapshot | null): boolean {
  return progress?.status === 'starting' || progress?.status === 'running';
}

const REPLACE_CONFIRMATION_PHRASE = 'REPLACE';

import { useCallback, useEffect, useState } from 'react';
import type {
  PremiereRequestResponse,
  PremiereStatusResponse
} from '../../shared/types/premiere';
import type { VideoRow } from '../../shared/types/video';
import * as premiereClient from '../api/premiereClient';
import { getErrorMessage } from '../helpers/errors';
import { toPremiereRequestVideo } from '../helpers/premiereRows';

export type PremiereBridgeActiveAction = 'premiereLaunch' | 'premiereImport' | null;

interface UsePremiereBridgeOptions {
  selectedVideos: VideoRow[];
  selectedPaths: string[];
  hideVideoPathsFromTable: (paths: string[]) => Promise<number>;
  setWorkflowMessage: (message: string | null) => void;
  setActiveAction: (action: PremiereBridgeActiveAction) => void;
  busyState: {
    activeAction: string | null;
  };
}

interface UsePremiereBridgeValue {
  premiereStatus: PremiereStatusResponse | null;
  premiereStatusError: string | null;
  premiereLaunchMessage: string | null;
  isPremiereStatusLoading: boolean;
  isPremiereImportSubmitting: boolean;
  premiereImportResult: PremiereRequestResponse | null;
  premiereImportError: string | null;
  refreshPremiereStatus: () => Promise<void>;
  openPremiereBridgeApps: () => Promise<void>;
  editSelectedInPremiere: () => Promise<void>;
  resetPremiereBridgeWorkflow: () => void;
}

export function usePremiereBridge({
  selectedVideos,
  selectedPaths,
  hideVideoPathsFromTable,
  setWorkflowMessage,
  setActiveAction
}: UsePremiereBridgeOptions): UsePremiereBridgeValue {
  const [premiereStatus, setPremiereStatus] = useState<PremiereStatusResponse | null>(null);
  const [premiereStatusError, setPremiereStatusError] = useState<string | null>(null);
  const [premiereLaunchMessage, setPremiereLaunchMessage] = useState<string | null>(null);
  const [isPremiereStatusLoading, setIsPremiereStatusLoading] = useState(false);
  const [isPremiereImportSubmitting, setIsPremiereImportSubmitting] = useState(false);
  const [premiereImportResult, setPremiereImportResult] = useState<PremiereRequestResponse | null>(null);
  const [premiereImportError, setPremiereImportError] = useState<string | null>(null);
  const selectedVideoCount = selectedVideos.length;

  const refreshPremiereStatus = useCallback(async (): Promise<void> => {
    setIsPremiereStatusLoading(true);
    setPremiereStatusError(null);

    try {
      const status = await premiereClient.getPremiereStatus();
      setPremiereStatus(status);
    } catch (error: unknown) {
      setPremiereStatusError(getErrorMessage(error, 'Unable to check Premiere bridge status.'));
      setPremiereStatus({
        status: 'error',
        message: getErrorMessage(error, 'Unable to check Premiere bridge status.'),
        bridge: {
          connected: false,
          reason: 'status_check_failed'
        }
      });
    } finally {
      setIsPremiereStatusLoading(false);
    }
  }, []);

  const openPremiereBridgeApps = useCallback(async (): Promise<void> => {
    setActiveAction('premiereLaunch');
    setPremiereStatusError(null);
    setPremiereLaunchMessage(null);
    let launchError: string | null = null;

    try {
      const response = await premiereClient.openPremiereBridgeApps();
      setPremiereLaunchMessage(`${response.message} Bridge folder: ${response.bridgeDir || 'Unknown'}`);

      if (response.status !== 'opened') {
        launchError = response.message;
      }
    } catch (error: unknown) {
      launchError = getErrorMessage(error, 'Unable to open Premiere bridge apps.');
      setPremiereLaunchMessage(launchError);
    } finally {
      setActiveAction(null);
      await refreshPremiereStatus();

      if (launchError) {
        setPremiereStatusError(launchError);
      }
    }
  }, [refreshPremiereStatus, setActiveAction]);

  useEffect(() => {
    void refreshPremiereStatus();
  }, [refreshPremiereStatus]);

  const editSelectedInPremiere = useCallback(async (): Promise<void> => {
    if (selectedVideoCount === 0) {
      setPremiereImportError('Select at least one video to import into Premiere.');
      return;
    }

    if (premiereStatus?.status !== 'ready') {
      setPremiereImportError('Premiere bridge must be ready before importing videos.');
      await refreshPremiereStatus();
      return;
    }

    setActiveAction('premiereImport');
    setIsPremiereImportSubmitting(true);
    setPremiereImportResult(null);
    setPremiereImportError(null);

    try {
      const response = await premiereClient.createPremiereImportRequest({
        videos: selectedVideos.map(toPremiereRequestVideo)
      });

      if (response.premiereStatus) {
        setPremiereStatus(response.premiereStatus);
      }

      if (response.status !== 'queued' || !response.requestId) {
        throw new Error(response.message ?? 'Unable to import selected videos into Premiere.');
      }

      setPremiereImportResult(response);
      const importedCount = selectedVideoCount;
      const hiddenCount = await hideVideoPathsFromTable(selectedPaths);
      const hiddenText =
        hiddenCount > 0 ? ` ${hiddenCount.toLocaleString()} video(s) were removed from the table.` : '';

      setWorkflowMessage(
        `Premiere import requested for ${importedCount.toLocaleString()} video(s).${hiddenText}`
      );
      await refreshPremiereStatus();
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Unable to import selected videos into Premiere.');
      setPremiereImportError(message);
      setWorkflowMessage(message);
    } finally {
      setIsPremiereImportSubmitting(false);
      setActiveAction(null);
    }
  }, [
    hideVideoPathsFromTable,
    premiereStatus?.status,
    refreshPremiereStatus,
    selectedPaths,
    selectedVideoCount,
    selectedVideos,
    setActiveAction,
    setWorkflowMessage
  ]);

  const resetPremiereBridgeWorkflow = useCallback((): void => {
    setPremiereImportResult(null);
    setPremiereImportError(null);
    setIsPremiereImportSubmitting(false);
  }, []);

  return {
    premiereStatus,
    premiereStatusError,
    premiereLaunchMessage,
    isPremiereStatusLoading,
    isPremiereImportSubmitting,
    premiereImportResult,
    premiereImportError,
    refreshPremiereStatus,
    openPremiereBridgeApps,
    editSelectedInPremiere,
    resetPremiereBridgeWorkflow
  };
}

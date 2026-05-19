import { useCallback, useState } from 'react';
import type { ToolDiagnosticsResult } from '../../shared/types/diagnostics';
import * as diagnosticsClient from '../api/diagnosticsClient';
import { getErrorMessage } from '../helpers/errors';

interface UseDiagnosticsWorkflowOptions {
  setSettingsMessage: (message: string | null) => void;
}

export interface UseDiagnosticsWorkflowValue {
  toolDiagnostics: ToolDiagnosticsResult | null;
  toolDiagnosticsError: string | null;
  isToolDiagnosticsLoading: boolean;
  runToolDiagnostics: () => Promise<void>;
}

export function useDiagnosticsWorkflow({
  setSettingsMessage
}: UseDiagnosticsWorkflowOptions): UseDiagnosticsWorkflowValue {
  const [toolDiagnostics, setToolDiagnostics] = useState<ToolDiagnosticsResult | null>(null);
  const [toolDiagnosticsError, setToolDiagnosticsError] = useState<string | null>(null);
  const [isToolDiagnosticsLoading, setIsToolDiagnosticsLoading] = useState(false);

  const runToolDiagnostics = useCallback(async (): Promise<void> => {
    setIsToolDiagnosticsLoading(true);
    setToolDiagnosticsError(null);

    try {
      const result = await diagnosticsClient.checkTools();
      setToolDiagnostics(result);
      setSettingsMessage(result.message ?? 'Media tool diagnostic complete.');
    } catch (error: unknown) {
      setToolDiagnosticsError(getErrorMessage(error, 'Unable to check ffmpeg/ffprobe availability.'));
    } finally {
      setIsToolDiagnosticsLoading(false);
    }
  }, [setSettingsMessage]);

  return {
    toolDiagnostics,
    toolDiagnosticsError,
    isToolDiagnosticsLoading,
    runToolDiagnostics
  };
}

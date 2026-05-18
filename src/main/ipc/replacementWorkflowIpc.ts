import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  CreateReplacementPlanRequest,
  CreateReplacementPlanResponse
} from '../../shared/types/replacementWorkflow';
import { createReplacementPlan } from '../services/replacementPlanService';

export function registerReplacementWorkflowIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.replacementCreatePlan,
    async (_event, request: CreateReplacementPlanRequest): Promise<CreateReplacementPlanResponse> => {
      try {
        return await createReplacementPlan(request);
      } catch (error: unknown) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to create replacement plan.'
        };
      }
    }
  );
}

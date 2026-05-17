import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type { AppSettings, AppSettingsUpdate } from '../../shared/types/settings';
import { getSettings, resetSettings, updateSettings } from '../services/settingsService';

export function registerSettingsIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.settingsGet, async (): Promise<AppSettings> => getSettings());

  ipcMain.handle(
    IPC_CHANNELS.settingsUpdate,
    async (_event, partialSettings: AppSettingsUpdate): Promise<AppSettings> =>
      updateSettings(partialSettings)
  );

  ipcMain.handle(IPC_CHANNELS.settingsReset, async (): Promise<AppSettings> => resetSettings());
}

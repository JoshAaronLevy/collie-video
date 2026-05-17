import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants/ipcChannels';
import type { AppInfo } from '../shared/types/app';
import type { PathSelectionResult, RevealPathResult } from '../shared/types/dialog';
import type { AppSettings, AppSettingsUpdate } from '../shared/types/settings';

export interface VideoAuditApi {
  app: {
    getInfo: () => Promise<AppInfo>;
  };
  dialog: {
    chooseFolders: () => Promise<PathSelectionResult>;
    chooseVideoFiles: () => Promise<PathSelectionResult>;
    chooseOutputFolder: () => Promise<PathSelectionResult>;
  };
  shell: {
    revealPath: (path: string) => Promise<RevealPathResult>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    update: (partialSettings: AppSettingsUpdate) => Promise<AppSettings>;
    reset: () => Promise<AppSettings>;
  };
}

export const videoAuditApi: VideoAuditApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appGetInfo)
  },
  dialog: {
    chooseFolders: () => ipcRenderer.invoke(IPC_CHANNELS.dialogChooseFolders),
    chooseVideoFiles: () => ipcRenderer.invoke(IPC_CHANNELS.dialogChooseVideoFiles),
    chooseOutputFolder: () => ipcRenderer.invoke(IPC_CHANNELS.dialogChooseOutputFolder)
  },
  shell: {
    revealPath: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.shellRevealPath, path)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    update: (partialSettings: AppSettingsUpdate) =>
      ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, partialSettings),
    reset: () => ipcRenderer.invoke(IPC_CHANNELS.settingsReset)
  }
};

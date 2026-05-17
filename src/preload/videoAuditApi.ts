import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants/ipcChannels';
import type { AppInfo } from '../shared/types/app';

export interface VideoAuditApi {
  app: {
    getInfo: () => Promise<AppInfo>;
  };
}

export const videoAuditApi: VideoAuditApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appGetInfo)
  }
};

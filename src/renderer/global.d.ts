import type { VideoAuditApi } from '../preload/videoAuditApi';

declare global {
  interface Window {
    videoAudit: VideoAuditApi;
  }
}

export {};

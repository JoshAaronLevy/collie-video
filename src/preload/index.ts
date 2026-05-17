import { contextBridge } from 'electron';
import { videoAuditApi } from './videoAuditApi';

contextBridge.exposeInMainWorld('videoAudit', videoAuditApi);

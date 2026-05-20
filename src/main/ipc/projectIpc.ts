import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipcChannels';
import type {
  ProjectCreateRequest,
  ProjectDeleteResponse,
  ProjectIndex,
  ProjectMutationResponse,
  ProjectSaveRequest,
  VideoProject
} from '../../shared/types/project';
import {
  createProject,
  deleteProject,
  listProjects,
  loadProject,
  saveProject,
  setLastActiveProjectId
} from '../services/projectService';

export function registerProjectIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.projectList, async (): Promise<ProjectIndex> => listProjects());

  ipcMain.handle(
    IPC_CHANNELS.projectCreate,
    async (_event, request: ProjectCreateRequest): Promise<ProjectMutationResponse> =>
      createProject(request)
  );

  ipcMain.handle(
    IPC_CHANNELS.projectSave,
    async (_event, request: ProjectSaveRequest): Promise<ProjectMutationResponse | null> =>
      saveProject(request)
  );

  ipcMain.handle(
    IPC_CHANNELS.projectLoad,
    async (_event, projectId: string): Promise<VideoProject | null> =>
      loadProject(projectId)
  );

  ipcMain.handle(
    IPC_CHANNELS.projectDelete,
    async (_event, projectId: string): Promise<ProjectDeleteResponse> =>
      deleteProject(projectId)
  );

  ipcMain.handle(
    IPC_CHANNELS.projectSetLastActive,
    async (_event, projectId: string | null): Promise<ProjectIndex> =>
      setLastActiveProjectId(projectId)
  );
}

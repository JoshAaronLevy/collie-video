import { useCallback, useEffect, useState } from 'react';
import type { ProjectIndex, ProjectIndexItem, VideoProject } from '../../shared/types/project';
import * as projectClient from '../api/projectClient';
import { getErrorMessage } from '../helpers/errors';
import type { DraftVideoProjectSnapshot } from '../helpers/projectSnapshot';

interface UseProjectWorkspaceOptions {
  buildSnapshot: () => DraftVideoProjectSnapshot;
}

export interface UseProjectWorkspaceValue {
  projectIndexItems: ProjectIndexItem[];
  activeProjectId: string | null;
  activeProjectName: string | null;
  projectSavedAt: string | null;
  projectMessage: string | null;
  projectError: string | null;
  isProjectIndexLoading: boolean;
  isProjectSaving: boolean;
  loadProjectIndex: () => Promise<ProjectIndex | null>;
  createProject: (name: string) => Promise<VideoProject | null>;
  saveProject: () => Promise<VideoProject | null>;
  loadProject: (projectId: string) => Promise<VideoProject | null>;
  activateProject: (project: VideoProject | null) => Promise<void>;
  deleteProject: (projectId: string) => Promise<boolean>;
  clearProjectStatus: () => void;
}

export function useProjectWorkspace({ buildSnapshot }: UseProjectWorkspaceOptions): UseProjectWorkspaceValue {
  const [projectIndexItems, setProjectIndexItems] = useState<ProjectIndexItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null);
  const [projectSavedAt, setProjectSavedAt] = useState<string | null>(null);
  const [projectMessage, setProjectMessage] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [isProjectIndexLoading, setIsProjectIndexLoading] = useState(false);
  const [isProjectSaving, setIsProjectSaving] = useState(false);

  const clearProjectStatus = useCallback((): void => {
    setProjectMessage(null);
    setProjectError(null);
  }, []);

  const setActiveProjectMetadata = useCallback((project: VideoProject | null): void => {
    setActiveProjectId(project?.id ?? null);
    setActiveProjectName(project?.name ?? null);
    setProjectSavedAt(project?.updatedAt ?? null);
  }, []);

  const applyProjectIndex = useCallback(
    (index: ProjectIndex): void => {
      setProjectIndexItems(index.projects);

      if (!activeProjectId) {
        return;
      }

      const activeIndexItem = index.projects.find((project) => project.id === activeProjectId);

      if (!activeIndexItem) {
        setActiveProjectMetadata(null);
        return;
      }

      setActiveProjectName(activeIndexItem.name);
      setProjectSavedAt(activeIndexItem.updatedAt);
    },
    [activeProjectId, setActiveProjectMetadata]
  );

  const loadProjectIndex = useCallback(async (): Promise<ProjectIndex | null> => {
    setIsProjectIndexLoading(true);
    setProjectError(null);

    try {
      const index = await projectClient.listProjects();
      applyProjectIndex(index);
      return index;
    } catch (error: unknown) {
      setProjectError(getErrorMessage(error, 'Could not load saved projects.'));
      return null;
    } finally {
      setIsProjectIndexLoading(false);
    }
  }, [applyProjectIndex]);

  useEffect(() => {
    void loadProjectIndex();
  }, []);

  const createProject = useCallback(
    async (name: string): Promise<VideoProject | null> => {
      setIsProjectSaving(true);
      clearProjectStatus();

      try {
        const result = await projectClient.createProject({
          name,
          project: buildSnapshot()
        });

        applyProjectIndex(result.index);
        setActiveProjectMetadata(result.project);
        setProjectMessage(`Saved "${result.project.name}".`);
        return result.project;
      } catch (error: unknown) {
        setProjectError(getErrorMessage(error, 'Could not save the project.'));
        return null;
      } finally {
        setIsProjectSaving(false);
      }
    },
    [applyProjectIndex, buildSnapshot, clearProjectStatus, setActiveProjectMetadata]
  );

  const saveProject = useCallback(async (): Promise<VideoProject | null> => {
    if (!activeProjectId || !activeProjectName) {
      setProjectError('Name this project before saving it.');
      return null;
    }

    setIsProjectSaving(true);
    clearProjectStatus();

    try {
      const result = await projectClient.saveProject({
        id: activeProjectId,
        project: {
          ...buildSnapshot(),
          name: activeProjectName
        }
      });

      if (!result) {
        setProjectError('Saved project was not found.');
        await loadProjectIndex();
        return null;
      }

      applyProjectIndex(result.index);
      setActiveProjectMetadata(result.project);
      setProjectMessage(`Saved "${result.project.name}".`);
      return result.project;
    } catch (error: unknown) {
      setProjectError(getErrorMessage(error, 'Could not save the project.'));
      return null;
    } finally {
      setIsProjectSaving(false);
    }
  }, [
    activeProjectId,
    activeProjectName,
    applyProjectIndex,
    buildSnapshot,
    clearProjectStatus,
    loadProjectIndex,
    setActiveProjectMetadata
  ]);

  const loadProject = useCallback(async (projectId: string): Promise<VideoProject | null> => {
    clearProjectStatus();

    try {
      const project = await projectClient.loadProject(projectId);

      if (!project) {
        setProjectError('Saved project was not found.');
        await loadProjectIndex();
        return null;
      }

      return project;
    } catch (error: unknown) {
      setProjectError(getErrorMessage(error, 'Could not load the project.'));
      return null;
    }
  }, [clearProjectStatus, loadProjectIndex]);

  const activateProject = useCallback(
    async (project: VideoProject | null): Promise<void> => {
      setActiveProjectMetadata(project);
      clearProjectStatus();

      try {
        const index = await projectClient.setLastActiveProject(project?.id ?? null);
        applyProjectIndex(index);
      } catch (error: unknown) {
        setProjectError(getErrorMessage(error, 'Could not update the active project.'));
      }
    },
    [applyProjectIndex, clearProjectStatus, setActiveProjectMetadata]
  );

  const deleteProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      clearProjectStatus();

      try {
        const result = await projectClient.deleteProject(projectId);
        applyProjectIndex(result.index);

        if (activeProjectId === projectId) {
          setActiveProjectMetadata(null);
        }

        setProjectMessage(result.deleted ? 'Deleted saved project.' : 'Saved project was already gone.');
        return result.deleted;
      } catch (error: unknown) {
        setProjectError(getErrorMessage(error, 'Could not delete the project.'));
        return false;
      }
    },
    [activeProjectId, applyProjectIndex, clearProjectStatus, setActiveProjectMetadata]
  );

  return {
    projectIndexItems,
    activeProjectId,
    activeProjectName,
    projectSavedAt,
    projectMessage,
    projectError,
    isProjectIndexLoading,
    isProjectSaving,
    loadProjectIndex,
    createProject,
    saveProject,
    loadProject,
    activateProject,
    deleteProject,
    clearProjectStatus
  };
}

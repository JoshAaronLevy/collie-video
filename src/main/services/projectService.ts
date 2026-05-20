import { randomUUID } from 'node:crypto';
import { access, mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import type {
  ProjectCreateRequest,
  ProjectIndex,
  ProjectIndexItem,
  ProjectSaveRequest,
  VideoProject
} from '../../shared/types/project';
import { PROJECT_SCHEMA_VERSION } from '../../shared/types/project';
import type { VideoRow } from '../../shared/types/video';
import {
  createEmptyProjectIndex,
  isSafeProjectId,
  normalizeProjectIndex,
  normalizeVideoProject
} from '../../shared/utils/projectNormalizers';
import {
  getProjectFilePath,
  getProjectIndexFilePath,
  getProjectsDir
} from './appPaths';

const PROJECT_FILE_EXTENSION = '.json';
const PROJECT_INDEX_FILE_NAME = 'project-index.json';
const PROJECT_ID_PREFIX = 'project-';
const MAX_PROJECT_ID_ATTEMPTS = 10;
const MAX_PROJECT_NAME_LENGTH = 120;

let projectMutationQueue: Promise<unknown> = Promise.resolve();

export interface ProjectMutationResult {
  project: VideoProject;
  index: ProjectIndex;
}

export interface ProjectDeleteResult {
  id: string;
  deleted: boolean;
  index: ProjectIndex;
}

export async function listProjects(): Promise<ProjectIndex> {
  return readReconciledProjectIndex();
}

export async function createProject(input: ProjectCreateRequest): Promise<ProjectMutationResult> {
  return mutateProjects(async () => {
    const now = nowIsoString();
    const projectId = await createProjectId();
    const project = normalizeWritableProject({
      ...input.project,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: projectId,
      name: normalizeProjectName(input.name),
      createdAt: now,
      updatedAt: now
    });

    await writeProjectFile(project);

    const index = upsertProjectIndexItem(await readReconciledProjectIndex(), project, project.id);
    await writeProjectIndex(index);

    return {
      project,
      index
    };
  });
}

export async function saveProject(input: ProjectSaveRequest): Promise<ProjectMutationResult | null> {
  return mutateProjects(async () => {
    const projectId = normalizeProjectId(input.id);
    const index = await readReconciledProjectIndex();
    const existingProject = await loadProject(projectId);
    const existingIndexItem = index.projects.find((project) => project.id === projectId);

    if (!existingProject && !existingIndexItem) {
      return null;
    }

    const now = nowIsoString();
    const project = normalizeWritableProject({
      ...input.project,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: projectId,
      name: normalizeProjectName(input.project.name),
      createdAt: existingProject?.createdAt ?? existingIndexItem?.createdAt ?? now,
      updatedAt: now
    });

    await writeProjectFile(project);

    const nextIndex = upsertProjectIndexItem(index, project, project.id);
    await writeProjectIndex(nextIndex);

    return {
      project,
      index: nextIndex
    };
  });
}

export async function loadProject(projectId: string): Promise<VideoProject | null> {
  return readProjectFile(normalizeProjectId(projectId));
}

export async function deleteProject(projectId: string): Promise<ProjectDeleteResult> {
  return mutateProjects(async () => {
    const normalizedProjectId = normalizeProjectId(projectId);
    const projectPath = getProjectFilePath(normalizedProjectId);
    const deleted = await deleteProjectFile(projectPath);
    const index = await readReconciledProjectIndex();
    const nextIndex: ProjectIndex = {
      ...index,
      lastActiveProjectId:
        index.lastActiveProjectId === normalizedProjectId ? null : index.lastActiveProjectId,
      projects: index.projects.filter((project) => project.id !== normalizedProjectId)
    };

    await writeProjectIndex(nextIndex);

    return {
      id: normalizedProjectId,
      deleted,
      index: nextIndex
    };
  });
}

export async function setLastActiveProjectId(projectId: string | null): Promise<ProjectIndex> {
  return mutateProjects(async () => {
    const normalizedProjectId = projectId === null ? null : normalizeProjectId(projectId);
    const index = await readReconciledProjectIndex();
    const hasProject = normalizedProjectId
      ? index.projects.some((project) => project.id === normalizedProjectId)
      : false;
    const nextIndex: ProjectIndex = {
      ...index,
      lastActiveProjectId: hasProject ? normalizedProjectId : null
    };

    await writeProjectIndex(nextIndex);
    return nextIndex;
  });
}

async function mutateProjects<T>(callback: () => Promise<T>): Promise<T> {
  const nextMutation = projectMutationQueue.then(callback, callback);
  projectMutationQueue = nextMutation.catch(() => undefined);
  return nextMutation;
}

async function readStoredProjectIndex(): Promise<ProjectIndex> {
  try {
    const rawIndex = await readFile(getProjectIndexFilePath(), 'utf8');
    return normalizeProjectIndex(JSON.parse(rawIndex));
  } catch {
    return createEmptyProjectIndex();
  }
}

async function readReconciledProjectIndex(): Promise<ProjectIndex> {
  const storedIndex = await readStoredProjectIndex();
  const projects = await readAllProjectFiles();
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const orderedProjects: VideoProject[] = [];
  const seenIds = new Set<string>();

  for (const indexItem of storedIndex.projects) {
    const project = projectsById.get(indexItem.id);

    if (project && !seenIds.has(project.id)) {
      orderedProjects.push(project);
      seenIds.add(project.id);
    }
  }

  for (const project of projects) {
    if (!seenIds.has(project.id)) {
      orderedProjects.push(project);
      seenIds.add(project.id);
    }
  }

  const sortedItems = orderedProjects
    .map(createProjectIndexItem)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const projectIds = new Set(sortedItems.map((project) => project.id));

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    lastActiveProjectId:
      storedIndex.lastActiveProjectId && projectIds.has(storedIndex.lastActiveProjectId)
        ? storedIndex.lastActiveProjectId
        : null,
    projects: sortedItems
  };
}

async function readAllProjectFiles(): Promise<VideoProject[]> {
  const entries = await readProjectDirectoryEntries();
  const projects: VideoProject[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || entry.name === PROJECT_INDEX_FILE_NAME || !entry.name.endsWith(PROJECT_FILE_EXTENSION)) {
      continue;
    }

    const projectId = entry.name.slice(0, -PROJECT_FILE_EXTENSION.length);

    if (!isSafeProjectId(projectId)) {
      continue;
    }

    const project = await readProjectFile(projectId);

    if (project) {
      projects.push(project);
    }
  }

  return projects;
}

async function readProjectDirectoryEntries() {
  try {
    return await readdir(getProjectsDir(), { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readProjectFile(projectId: string): Promise<VideoProject | null> {
  try {
    const rawProject = await readFile(getProjectFilePath(projectId), 'utf8');
    const project = normalizeVideoProject(JSON.parse(rawProject));

    return project?.id === projectId ? project : null;
  } catch {
    return null;
  }
}

async function writeProjectFile(project: VideoProject): Promise<void> {
  await writeJsonFile(getProjectFilePath(project.id), normalizeWritableProject(project));
}

async function writeProjectIndex(index: ProjectIndex): Promise<void> {
  await writeJsonFile(getProjectIndexFilePath(), normalizeProjectIndex(index));
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.tmp`;

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tempPath, filePath);
}

async function deleteProjectFile(projectPath: string): Promise<boolean> {
  try {
    await unlink(projectPath);
    return true;
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function createProjectId(): Promise<string> {
  for (let attempt = 0; attempt < MAX_PROJECT_ID_ATTEMPTS; attempt += 1) {
    const projectId = `${PROJECT_ID_PREFIX}${randomUUID()}`;

    if (!(await projectFileExists(projectId))) {
      return projectId;
    }
  }

  throw new Error('Could not create a unique project id.');
}

async function projectFileExists(projectId: string): Promise<boolean> {
  try {
    await access(getProjectFilePath(projectId));
    return true;
  } catch {
    return false;
  }
}

function upsertProjectIndexItem(
  index: ProjectIndex,
  project: VideoProject,
  lastActiveProjectId: string | null
): ProjectIndex {
  const item = createProjectIndexItem(project);
  const projects = [item, ...index.projects.filter((candidate) => candidate.id !== item.id)]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    lastActiveProjectId,
    projects
  };
}

function createProjectIndexItem(project: VideoProject): ProjectIndexItem {
  const result = project.audit.result;
  const rows = result?.videos ?? [];
  const visibleRows = rows.filter((row) => row.visible !== false);

  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    sourceSummary: getProjectSourceSummary(project),
    outputFolder: project.sources.outputFolder,
    rowCount: rows.length,
    visibleRowCount: visibleRows.length,
    removedRowCount: rows.length - visibleRows.length,
    flaggedCount: visibleRows.filter(isFlaggedProjectRow).length,
    errorCount: result?.errors.length ?? 0,
    lastRunAt: result ? project.audit.savedAt : null
  };
}

function getProjectSourceSummary(project: VideoProject): string {
  const folderPaths = getProjectFolderPaths(project);
  const filePaths = getProjectFilePaths(project);
  const parts: string[] = [];

  if (folderPaths.length === 1) {
    parts.push(getDisplayPathName(folderPaths[0]));
  } else if (folderPaths.length > 1) {
    parts.push(`${folderPaths.length.toLocaleString()} folders`);
  }

  if (filePaths.length === 1) {
    parts.push(getDisplayPathName(filePaths[0]));
  } else if (filePaths.length > 1) {
    parts.push(`${filePaths.length.toLocaleString()} files`);
  }

  return parts.join(', ') || 'No sources';
}

function getProjectFolderPaths(project: VideoProject): string[] {
  if (project.sources.selectedFolders.length > 0) {
    return project.sources.selectedFolders;
  }

  return project.audit.request?.folderPaths ?? [];
}

function getProjectFilePaths(project: VideoProject): string[] {
  if (project.sources.selectedFiles.length > 0) {
    return project.sources.selectedFiles;
  }

  return project.audit.request?.filePaths ?? [];
}

function getDisplayPathName(path: string): string {
  return basename(path) || path;
}

function isFlaggedProjectRow(row: VideoRow): boolean {
  return row.isLowResolution || row.isWrongAspectRatio || hasCropIssue(row) || hasRowError(row) || Boolean(row.reasons);
}

function hasCropIssue(row: VideoRow): boolean {
  const blackBorder = row.adjustments?.blackBorder;

  if (!blackBorder?.analyzed) {
    return false;
  }

  return (
    blackBorder.detected ||
    blackBorder.classification === 'nested_borders' ||
    blackBorder.classification === 'asymmetric_border' ||
    blackBorder.classification === 'pillarboxed' ||
    blackBorder.classification === 'letterboxed' ||
    blackBorder.classification === 'uncertain' ||
    blackBorder.classification === 'analysis_error' ||
    blackBorder.recommendedFix?.eligible === true ||
    blackBorder.recommendedFix?.type === 'crop-scale' ||
    blackBorder.recommendedFix?.type === 'manual-review'
  );
}

function hasRowError(row: VideoRow): boolean {
  const blackBorder = row.adjustments?.blackBorder;

  return (
    Boolean(blackBorder?.error) ||
    blackBorder?.classification === 'analysis_error' ||
    row.reasons.toLowerCase().includes('error')
  );
}

function normalizeWritableProject(project: VideoProject): VideoProject {
  const normalizedProject = normalizeVideoProject(project);

  if (!normalizedProject) {
    throw new Error('Project data is invalid.');
  }

  return normalizedProject;
}

function normalizeProjectId(projectId: string): string {
  const normalizedProjectId = projectId.trim();

  if (!isSafeProjectId(normalizedProjectId)) {
    throw new Error('Invalid project id.');
  }

  return normalizedProjectId;
}

function normalizeProjectName(name: string): string {
  const normalizedName = name.trim().replace(/\s+/g, ' ').slice(0, MAX_PROJECT_NAME_LENGTH);

  if (!normalizedName) {
    throw new Error('Project name is required.');
  }

  return normalizedName;
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error !== null && typeof error === 'object' && 'code' in error;
}

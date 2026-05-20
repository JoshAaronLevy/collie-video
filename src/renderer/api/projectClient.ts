export function listProjects() {
  return window.videoAudit.projects.list();
}

export function createProject(
  request: Parameters<typeof window.videoAudit.projects.create>[0]
) {
  return window.videoAudit.projects.create(request);
}

export function saveProject(
  request: Parameters<typeof window.videoAudit.projects.save>[0]
) {
  return window.videoAudit.projects.save(request);
}

export function loadProject(projectId: string) {
  return window.videoAudit.projects.load(projectId);
}

export function deleteProject(projectId: string) {
  return window.videoAudit.projects.delete(projectId);
}

export function setLastActiveProject(projectId: string | null) {
  return window.videoAudit.projects.setLastActive(projectId);
}

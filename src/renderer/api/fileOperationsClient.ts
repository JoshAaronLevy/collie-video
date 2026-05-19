export function revealFile(request: Parameters<typeof window.videoAudit.fileOperations.revealFile>[0]) {
  return window.videoAudit.fileOperations.revealFile(request);
}

export function revealFolder(request: Parameters<typeof window.videoAudit.fileOperations.revealFolder>[0]) {
  return window.videoAudit.fileOperations.revealFolder(request);
}

export function validateKnownPaths(
  request: Parameters<typeof window.videoAudit.fileOperations.validateKnownPaths>[0]
) {
  return window.videoAudit.fileOperations.validateKnownPaths(request);
}

export function createTrashPlan(
  request: Parameters<typeof window.videoAudit.fileOperations.createTrashPlan>[0]
) {
  return window.videoAudit.fileOperations.createTrashPlan(request);
}

export function executeTrashPlan(
  request: Parameters<typeof window.videoAudit.fileOperations.executeTrashPlan>[0]
) {
  return window.videoAudit.fileOperations.executeTrashPlan(request);
}

export function createMovePlan(
  request: Parameters<typeof window.videoAudit.fileOperations.createMovePlan>[0]
) {
  return window.videoAudit.fileOperations.createMovePlan(request);
}

export function executeMovePlan(
  request: Parameters<typeof window.videoAudit.fileOperations.executeMovePlan>[0]
) {
  return window.videoAudit.fileOperations.executeMovePlan(request);
}

export function createArchivePlan(
  request: Parameters<typeof window.videoAudit.fileOperations.createArchivePlan>[0]
) {
  return window.videoAudit.fileOperations.createArchivePlan(request);
}

export function executeArchivePlan(
  request: Parameters<typeof window.videoAudit.fileOperations.executeArchivePlan>[0]
) {
  return window.videoAudit.fileOperations.executeArchivePlan(request);
}

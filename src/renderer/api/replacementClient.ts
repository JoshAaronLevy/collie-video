export function createReplacementPlan(
  request: Parameters<typeof window.videoAudit.replacement.createPlan>[0]
) {
  return window.videoAudit.replacement.createPlan(request);
}

export function updateReplacementPlanActions(
  request: Parameters<typeof window.videoAudit.replacement.updatePlanActions>[0]
) {
  return window.videoAudit.replacement.updatePlanActions(request);
}

export function executeReplacementPlan(
  request: Parameters<typeof window.videoAudit.replacement.executePlan>[0]
) {
  return window.videoAudit.replacement.executePlan(request);
}

export function cancelReplacementExecution(jobId: string) {
  return window.videoAudit.replacement.cancelExecution(jobId);
}

export function getReplacementExecutionResult(jobId: string) {
  return window.videoAudit.replacement.getExecutionResult(jobId);
}

export function subscribeToReplacementProgress(
  callback: Parameters<typeof window.videoAudit.replacement.onProgress>[0]
) {
  return window.videoAudit.replacement.onProgress(callback);
}

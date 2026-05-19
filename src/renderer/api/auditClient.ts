export function startAudit(request: Parameters<typeof window.videoAudit.audit.start>[0]) {
  return window.videoAudit.audit.start(request);
}

export function cancelAudit(jobId: string) {
  return window.videoAudit.audit.cancel(jobId);
}

export function getAuditResult(jobId: string) {
  return window.videoAudit.audit.getResult(jobId);
}

export function subscribeToAuditProgress(
  callback: Parameters<typeof window.videoAudit.audit.onProgress>[0]
) {
  return window.videoAudit.audit.onProgress(callback);
}

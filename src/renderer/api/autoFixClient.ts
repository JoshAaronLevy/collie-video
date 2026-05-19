export function startAutoFix(request: Parameters<typeof window.videoAudit.autoFix.start>[0]) {
  return window.videoAudit.autoFix.start(request);
}

export function cancelAutoFix(jobId: string) {
  return window.videoAudit.autoFix.cancel(jobId);
}

export function getAutoFixResult(jobId: string) {
  return window.videoAudit.autoFix.getResult(jobId);
}

export function subscribeToAutoFixProgress(
  callback: Parameters<typeof window.videoAudit.autoFix.onProgress>[0]
) {
  return window.videoAudit.autoFix.onProgress(callback);
}

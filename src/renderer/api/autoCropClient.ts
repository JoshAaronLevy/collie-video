export function startAutoCrop(request: Parameters<typeof window.videoAudit.autoCrop.start>[0]) {
  return window.videoAudit.autoCrop.start(request);
}

export function cancelAutoCrop(jobId: string) {
  return window.videoAudit.autoCrop.cancel(jobId);
}

export function getAutoCropResult(jobId: string) {
  return window.videoAudit.autoCrop.getResult(jobId);
}

export function subscribeToAutoCropProgress(
  callback: Parameters<typeof window.videoAudit.autoCrop.onProgress>[0]
) {
  return window.videoAudit.autoCrop.onProgress(callback);
}

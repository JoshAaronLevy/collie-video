export function startMediaPreview(request: Parameters<typeof window.videoAudit.mediaPreview.start>[0]) {
  return window.videoAudit.mediaPreview.start(request);
}

export function cancelMediaPreview(jobId: string) {
  return window.videoAudit.mediaPreview.cancel(jobId);
}

export function getMediaPreviewResult(jobId: string) {
  return window.videoAudit.mediaPreview.getResult(jobId);
}

export function generateFrames(request: Parameters<typeof window.videoAudit.mediaPreview.generateFrames>[0]) {
  return window.videoAudit.mediaPreview.generateFrames(request);
}

export function startClipGeneration(
  request: Parameters<typeof window.videoAudit.mediaPreview.startClipGeneration>[0]
) {
  return window.videoAudit.mediaPreview.startClipGeneration(request);
}

export function cancelClipGeneration(jobId: string) {
  return window.videoAudit.mediaPreview.cancelClipGeneration(jobId);
}

export function getClipResult(jobId: string) {
  return window.videoAudit.mediaPreview.getClipResult(jobId);
}

export function clearCache() {
  return window.videoAudit.mediaPreview.clearCache();
}

export function subscribeToMediaPreviewProgress(
  callback: Parameters<typeof window.videoAudit.mediaPreview.onProgress>[0]
) {
  return window.videoAudit.mediaPreview.onProgress(callback);
}

export function subscribeToClipProgress(
  callback: Parameters<typeof window.videoAudit.mediaPreview.onClipProgress>[0]
) {
  return window.videoAudit.mediaPreview.onClipProgress(callback);
}

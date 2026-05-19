export function startFfprobe(request: Parameters<typeof window.videoAudit.ffprobe.start>[0]) {
  return window.videoAudit.ffprobe.start(request);
}

export function cancelFfprobe(jobId: string) {
  return window.videoAudit.ffprobe.cancel(jobId);
}

export function subscribeToFfprobeProgress(
  callback: Parameters<typeof window.videoAudit.ffprobe.onProgress>[0]
) {
  return window.videoAudit.ffprobe.onProgress(callback);
}

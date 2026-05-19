export function startDiscovery(request: Parameters<typeof window.videoAudit.discovery.start>[0]) {
  return window.videoAudit.discovery.start(request);
}

export function cancelDiscovery(jobId: string) {
  return window.videoAudit.discovery.cancel(jobId);
}

export function subscribeToDiscoveryProgress(
  callback: Parameters<typeof window.videoAudit.discovery.onProgress>[0]
) {
  return window.videoAudit.discovery.onProgress(callback);
}

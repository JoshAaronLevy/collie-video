export function getPremiereStatus() {
  return window.videoAudit.premiere.getStatus();
}

export function openPremiereBridgeApps() {
  return window.videoAudit.premiere.openBridgeApps();
}

export function createPremiereImportRequest(
  request: Parameters<typeof window.videoAudit.premiere.createImportRequest>[0]
) {
  return window.videoAudit.premiere.createImportRequest(request);
}

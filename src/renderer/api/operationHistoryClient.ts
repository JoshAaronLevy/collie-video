export function listRecentOperations(
  request?: Parameters<typeof window.videoAudit.operationHistory.listRecent>[0]
) {
  return window.videoAudit.operationHistory.listRecent(request);
}

export function getOperationDetails(operationId: string) {
  return window.videoAudit.operationHistory.getDetails(operationId);
}

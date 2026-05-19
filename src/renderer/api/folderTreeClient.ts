export function chooseRootFolder() {
  return window.videoAudit.folderTree.chooseRootFolder();
}

export function scanRoot(rootPath: string) {
  return window.videoAudit.folderTree.scanRoot(rootPath);
}

export function cancelScan(scanId: string) {
  return window.videoAudit.folderTree.cancelScan(scanId);
}

export function getScanResult(scanId: string) {
  return window.videoAudit.folderTree.getResult(scanId);
}

export function subscribeToFolderTreeScanProgress(
  callback: Parameters<typeof window.videoAudit.folderTree.onScanProgress>[0]
) {
  return window.videoAudit.folderTree.onScanProgress(callback);
}

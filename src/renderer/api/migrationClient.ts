export function scanMigration(request: Parameters<typeof window.videoAudit.migration.scan>[0]) {
  return window.videoAudit.migration.scan(request);
}

export function executeMigration(request: Parameters<typeof window.videoAudit.migration.execute>[0]) {
  return window.videoAudit.migration.execute(request);
}

export function getMigrationResult(jobId: string) {
  return window.videoAudit.migration.getResult(jobId);
}

export function subscribeToMigrationProgress(
  callback: Parameters<typeof window.videoAudit.migration.onProgress>[0]
) {
  return window.videoAudit.migration.onProgress(callback);
}

import type { JobStatus } from './jobs';

export interface MigrationScanRequest {
  newEditedDir: string;
  destinationRoot: string;
  archiveRoot?: string;
}

export interface MigrationScanSummary {
  newFilesFound: number;
  filesWithMatches: number;
  filesWithoutMatches: number;
  totalDestinationMatchesToArchive: number;
  multiMatchFiles: number;
  newBytesToCopy: number;
  oldBytesToArchive: number;
  netActiveFileDelta: number;
  netActiveBytesDelta: number;
  potentialBytesReclaimableIfArchiveDeleted: number;
}

export interface MigrationMatch {
  originalPath: string;
  originalRelativePath: string;
  archivePath: string;
  archiveRelativePath: string;
  sizeBytes: number;
  modifiedAt?: string;
  createdAt?: string;
}

export interface MigrationScanItem {
  fileName: string;
  sourcePath: string;
  finalDestinationPath: string;
  sourceSizeBytes: number;
  matchCount: number;
  matches: MigrationMatch[];
  action: string;
  status: 'planned' | 'blocked' | string;
  warnings: string[];
}

export interface MigrationScanResult {
  migrationId: string;
  status: 'planned' | string;
  createdAt?: string;
  newEditedDir: string;
  destinationRoot: string;
  archiveRoot: string;
  archiveRunDir: string;
  summary: MigrationScanSummary;
  items: MigrationScanItem[];
  warnings: string[];
}

export interface MigrationScanResponse {
  status: 'complete' | 'invalid_request' | 'error' | string;
  message?: string;
  result?: MigrationScanResult;
}

export interface MigrationExecuteRequest {
  migrationId: string;
}

export interface MigrationProgress {
  migrationId: string | null;
  jobId?: string | null;
  status: Extract<JobStatus, 'idle' | 'starting' | 'running' | 'complete' | 'error'> | string;
  phase: string | null;
  totalFiles: number | null;
  processedFiles: number;
  copiedCount: number;
  archivedCount: number;
  failedCount: number;
  currentFile: string | null;
  message: string | null;
  error: string | null;
}

export interface MigrationJobSnapshot extends MigrationProgress {
  result?: MigrationResult;
}

export interface MigrationStartResponse {
  jobId?: string;
  migrationId?: string;
  status: 'started' | 'invalid_request' | 'error' | string;
  message?: string;
  totalFiles?: number;
}

export interface MigrationResultMatch {
  originalPath: string;
  archivePath: string;
  sizeBytes: number;
}

export interface MigrationResultItem {
  fileName: string;
  sourcePath: string;
  finalDestinationPath: string;
  status: 'success' | 'failed' | 'skipped' | string;
  archivedMatches: MigrationResultMatch[];
  error?: string | null;
  warnings?: string[];
}

export interface MigrationResult {
  jobId?: string;
  migrationId: string;
  status: 'complete' | 'error' | string;
  archiveRunDir?: string;
  manifestPath?: string;
  operationLogPath?: string;
  summary: {
    newFilesFound: number;
    filesCopiedToDestination: number;
    destinationMatchesArchived: number;
    filesWithNoMatches: number;
    multiMatchFiles: number;
    failedItems: number;
    newBytesCopied: number;
    oldBytesArchived: number;
    netActiveFileDelta: number;
    netActiveBytesDelta: number;
    potentialBytesReclaimableIfArchiveDeleted: number;
  };
  items: MigrationResultItem[];
}

export interface MigrationResultResponse {
  jobId?: string;
  status: MigrationResult['status'] | 'not_found' | 'not_ready' | 'error' | string;
  message?: string;
  result?: MigrationResult;
}

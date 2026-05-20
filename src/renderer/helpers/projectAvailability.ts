import type {
  KnownPathValidationItem,
  KnownPathValidationResult
} from '../../shared/types/fileOperations';
import type { SavedFileAvailability, VideoFileAvailability, VideoRow } from '../../shared/types/video';

const ROW_ID_PREFIX = 'row:';
const SOURCE_ID_PREFIX = 'source:';

export interface ProjectAvailabilityValidationInput {
  rows: VideoRow[];
  selectedFolders: string[];
  selectedFiles: string[];
}

export interface ProjectAvailabilityValidationItems {
  rowItems: KnownPathValidationItem[];
  sourceItems: KnownPathValidationItem[];
}

export interface ProjectAvailabilitySummary {
  checkedAt: string;
  rowCount: number;
  missingRows: number;
  changedRows: number;
  unavailableRows: number;
  sourceCount: number;
  missingSources: number;
  unavailableSources: number;
}

export interface ProjectAvailabilityMergeResult {
  rowAvailability: Array<{ path: string; availability: VideoFileAvailability }>;
  summary: ProjectAvailabilitySummary;
}

export function buildProjectAvailabilityValidationItems({
  rows,
  selectedFolders,
  selectedFiles
}: ProjectAvailabilityValidationInput): ProjectAvailabilityValidationItems {
  const rowItems = rows.map((row) => ({
    id: `${ROW_ID_PREFIX}${row.path}`,
    path: row.path,
    expectedKind: 'file' as const,
    expectedFileName: row.fileName,
    expectedSizeBytes: row.fileSystemSizeBytes ?? row.sizeBytes ?? row.sourceSizeBytes ?? null,
    expectedModifiedAtMs: row.modifiedAtMs ?? null,
    requireSupportedVideoExtension: true
  }));
  const sourceFolderItems = selectedFolders.map((path) => ({
    id: `${SOURCE_ID_PREFIX}${path}`,
    path,
    expectedKind: 'directory' as const
  }));
  const sourceFileItems = selectedFiles.map((path) => ({
    id: `${SOURCE_ID_PREFIX}${path}`,
    path,
    expectedKind: 'file' as const,
    requireSupportedVideoExtension: true
  }));

  return {
    rowItems,
    sourceItems: [...sourceFolderItems, ...sourceFileItems]
  };
}

export function buildProjectAvailabilityMergeResult(
  rows: VideoRow[],
  results: KnownPathValidationResult[],
  checkedAt: string
): ProjectAvailabilityMergeResult {
  const resultsById = new Map(results.map((result) => [result.id, result]));
  const rowAvailability = rows.flatMap((row) => {
    const result = resultsById.get(`${ROW_ID_PREFIX}${row.path}`);

    if (!result) {
      return [];
    }

    return [
      {
        path: row.path,
        availability: toVideoFileAvailability(result, checkedAt)
      }
    ];
  });
  const summary = summarizeProjectAvailability(rowAvailability, results, checkedAt);

  return {
    rowAvailability,
    summary
  };
}

export function formatProjectAvailabilityMessage(summary: ProjectAvailabilitySummary): string | null {
  const rowIssues = [
    summary.missingRows > 0 ? `${summary.missingRows.toLocaleString()} missing` : null,
    summary.changedRows > 0 ? `${summary.changedRows.toLocaleString()} changed` : null,
    summary.unavailableRows > 0 ? `${summary.unavailableRows.toLocaleString()} unavailable` : null
  ].filter(Boolean);
  const sourceIssues = [
    summary.missingSources > 0 ? `${summary.missingSources.toLocaleString()} missing source` : null,
    summary.unavailableSources > 0 ? `${summary.unavailableSources.toLocaleString()} unavailable source` : null
  ].filter(Boolean);
  const issueParts = [...rowIssues, ...sourceIssues];

  if (summary.rowCount === 0 && summary.sourceCount === 0) {
    return null;
  }

  if (issueParts.length === 0) {
    return `File availability checked: ${summary.rowCount.toLocaleString()} row file(s) and ${summary.sourceCount.toLocaleString()} source path(s) available.`;
  }

  return `File availability checked: ${issueParts.join(', ')}. Source videos and output files were not modified.`;
}

function summarizeProjectAvailability(
  rowAvailability: Array<{ path: string; availability: VideoFileAvailability }>,
  results: KnownPathValidationResult[],
  checkedAt: string
): ProjectAvailabilitySummary {
  const sourceResults = results.filter((result) => result.id?.startsWith(SOURCE_ID_PREFIX));
  const sourceUnavailable = sourceResults.filter((result) => result.exists && !result.isValid).length;

  return {
    checkedAt,
    rowCount: rowAvailability.length,
    missingRows: rowAvailability.filter((item) => item.availability.status === 'missing').length,
    changedRows: rowAvailability.filter((item) => item.availability.status === 'changed').length,
    unavailableRows: rowAvailability.filter((item) => item.availability.status === 'unavailable').length,
    sourceCount: sourceResults.length,
    missingSources: sourceResults.filter((result) => !result.exists).length,
    unavailableSources: sourceUnavailable
  };
}

function toVideoFileAvailability(
  result: KnownPathValidationResult,
  checkedAt: string
): VideoFileAvailability {
  const status = getAvailabilityStatus(result);

  return {
    status,
    checkedAt,
    message: getAvailabilityMessage(status, result),
    sizeBytes: result.identity?.sizeBytes ?? null,
    modifiedAtMs: result.identity?.modifiedAtMs ?? null,
    warnings: result.warnings,
    errors: result.errors
  };
}

function getAvailabilityStatus(result: KnownPathValidationResult): SavedFileAvailability {
  if (!result.exists) {
    return 'missing';
  }

  if (result.isValid) {
    return 'available';
  }

  if (result.errors.some(isChangedFileError)) {
    return 'changed';
  }

  return 'unavailable';
}

function getAvailabilityMessage(
  status: SavedFileAvailability,
  result: KnownPathValidationResult
): string | null {
  if (result.errors.length > 0) {
    return result.errors.join(' ');
  }

  if (result.warnings.length > 0) {
    return result.warnings.join(' ');
  }

  if (status === 'available') {
    return 'File is available.';
  }

  return null;
}

function isChangedFileError(error: string): boolean {
  const normalizedError = error.toLowerCase();
  return (
    normalizedError.includes('file name changed') ||
    normalizedError.includes('file size') ||
    normalizedError.includes('modified timestamp')
  );
}

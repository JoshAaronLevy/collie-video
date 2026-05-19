import type { AuditRequest, AuditSummary } from '../../shared/types/audit';
import type { VideoRow } from '../../shared/types/video';
import type { ResultsViewCounts, ResultsViewFilter } from '../types/resultsView';

export function getAuditedRootDirectory(
  request: AuditRequest | null,
  summary: AuditSummary | null
): string | null {
  if (request?.folderPaths.length === 1) {
    return request.folderPaths[0];
  }

  if (request?.folderPaths && request.folderPaths.length !== 1) {
    return null;
  }

  const summaryPath = summary?.resolvedDirectory ?? summary?.directoryPath ?? null;

  if (!summaryPath || summaryPath === 'Selected files') {
    return null;
  }

  return summaryPath;
}

export function getResultsViewCounts(rows: VideoRow[]): ResultsViewCounts {
  return {
    all: rows.length,
    flagged: rows.filter(isFlaggedRow).length,
    'low-res': rows.filter((row) => row.isLowResolution).length,
    aspect: rows.filter((row) => row.isWrongAspectRatio).length,
    crop: rows.filter(hasCropIssue).length,
    errors: rows.filter(hasRowError).length
  };
}

export function matchesResultsViewFilter(row: VideoRow, filter: ResultsViewFilter): boolean {
  switch (filter) {
    case 'flagged':
      return isFlaggedRow(row);
    case 'low-res':
      return row.isLowResolution;
    case 'aspect':
      return row.isWrongAspectRatio;
    case 'crop':
      return hasCropIssue(row);
    case 'errors':
      return hasRowError(row);
    case 'all':
      return true;
  }
}

export function isFlaggedRow(row: VideoRow): boolean {
  return row.isLowResolution || row.isWrongAspectRatio || hasCropIssue(row) || hasRowError(row) || Boolean(row.reasons);
}

export function hasCropIssue(row: VideoRow): boolean {
  const blackBorder = row.adjustments?.blackBorder;

  if (!blackBorder?.analyzed) {
    return false;
  }

  return (
    blackBorder.detected ||
    blackBorder.classification === 'nested_borders' ||
    blackBorder.classification === 'asymmetric_border' ||
    blackBorder.classification === 'pillarboxed' ||
    blackBorder.classification === 'letterboxed' ||
    blackBorder.classification === 'uncertain' ||
    blackBorder.classification === 'analysis_error' ||
    blackBorder.recommendedFix?.eligible === true ||
    blackBorder.recommendedFix?.type === 'crop-scale' ||
    blackBorder.recommendedFix?.type === 'manual-review'
  );
}

export function hasRowError(row: VideoRow): boolean {
  const blackBorder = row.adjustments?.blackBorder;

  return (
    Boolean(blackBorder?.error) ||
    blackBorder?.classification === 'analysis_error' ||
    row.reasons.toLowerCase().includes('error')
  );
}

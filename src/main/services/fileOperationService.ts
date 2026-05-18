import { randomUUID } from 'node:crypto';
import { shell } from 'electron';
import { basename, isAbsolute, relative, sep } from 'node:path';
import type {
  CreateTrashOperationPlanRequest,
  CreateTrashOperationPlanResponse,
  ExecuteTrashOperationPlanRequest,
  ExecuteTrashOperationPlanResponse,
  FileIdentity,
  FileOperationErrorCode,
  FileOperationPlanItem,
  FileOperationResult,
  FileOperationResultItem,
  FileOperationWarningCode,
  KnownFileOperationItem,
  TrashOperationPlan
} from '../../shared/types/fileOperations';
import {
  appendOperationItemResult,
  createOperationRecord,
  markOperationCompleted,
  markOperationFailed
} from './operationHistoryService';
import { validateKnownPath } from '../utils/fileOperationSafety';

const TEN_GB_BYTES = 10 * 1024 * 1024 * 1024;
const TRASH_CONFIRMATION_PHRASE = 'Move to Trash';
const trashPlans = new Map<string, TrashOperationPlan>();

export async function createTrashPlan(
  request: Partial<CreateTrashOperationPlanRequest> | null | undefined
): Promise<CreateTrashOperationPlanResponse> {
  const validation = normalizeTrashPlanRequest(request);

  if (!validation.ok) {
    return {
      status: 'invalid_request',
      message: validation.message
    };
  }

  const planItems = await Promise.all(
    validation.items.map((item) => buildTrashPlanItem({
      item,
      knownDirectories: validation.knownDirectories
    }))
  );
  const summary = summarizePlanItems(planItems);
  const confirmationReasons = getConfirmationReasons({
    items: planItems,
    summary
  });
  const plan: TrashOperationPlan = {
    id: randomUUID(),
    type: 'trash',
    createdAt: nowIsoString(),
    items: planItems,
    summary,
    confirmation: {
      isRequired: confirmationReasons.length > 0,
      phrase: TRASH_CONFIRMATION_PHRASE,
      reasons: confirmationReasons
    }
  };

  trashPlans.set(plan.id, plan);

  return {
    status: 'planned',
    plan
  };
}

export async function executeTrashPlan(
  request: Partial<ExecuteTrashOperationPlanRequest> | null | undefined
): Promise<ExecuteTrashOperationPlanResponse> {
  if (!request || typeof request !== 'object') {
    return {
      status: 'invalid_request',
      message: 'Trash execution request is required.'
    };
  }

  if (typeof request.planId !== 'string' || request.planId.trim() === '') {
    return {
      status: 'invalid_request',
      message: 'Trash plan id is required.'
    };
  }

  const plan = trashPlans.get(request.planId.trim());

  if (!plan) {
    return {
      status: 'not_found',
      message: 'Trash plan not found. Create a fresh plan before moving files to Trash.'
    };
  }

  if (request.confirmed !== true) {
    return {
      status: 'invalid_request',
      message: 'Confirm Move to Trash before executing this plan.'
    };
  }

  if (plan.confirmation.isRequired && request.typedConfirmation !== TRASH_CONFIRMATION_PHRASE) {
    return {
      status: 'invalid_request',
      message: `Type "${TRASH_CONFIRMATION_PHRASE}" to confirm this Move to Trash operation.`
    };
  }

  const startedAt = nowIsoString();
  const historyRecord = await createOperationRecord({
    plan,
    startedAt
  });
  const resultItems: FileOperationResultItem[] = [];

  for (const item of plan.items) {
    const resultItem = await executeTrashPlanItem(item);
    resultItems.push(resultItem);
    await appendOperationItemResult(historyRecord.id, resultItem);
  }

  const completedAt = nowIsoString();
  const result: FileOperationResult = {
    id: randomUUID(),
    planId: plan.id,
    type: 'trash',
    status: summarizeResultStatus(resultItems),
    createdAt: plan.createdAt,
    startedAt,
    completedAt,
    summary: summarizeResultItems(resultItems),
    items: resultItems
  };

  if (result.status === 'failed') {
    await markOperationFailed(historyRecord.id, result);
  } else {
    await markOperationCompleted(historyRecord.id, result);
  }

  trashPlans.delete(plan.id);

  return {
    status: result.status === 'success' ? 'complete' : result.status === 'failed' ? 'failed' : 'partial',
    result,
    message: getTrashResultMessage(result)
  };
}

async function buildTrashPlanItem({
  item,
  knownDirectories
}: {
  item: KnownFileOperationItem;
  knownDirectories: string[];
}): Promise<FileOperationPlanItem> {
  const validation = await validateKnownPath({
    id: item.id,
    path: item.sourcePath,
    expectedKind: 'file',
    expectedFileName: item.fileName ?? item.identity?.fileName ?? null,
    expectedSizeBytes: item.expectedSizeBytes ?? item.identity?.sizeBytes ?? null,
    expectedModifiedAtMs: item.expectedModifiedAtMs ?? item.identity?.modifiedAtMs ?? null,
    requireSupportedVideoExtension: item.allowUnsupportedFileType !== true
  });
  const sourceIdentity = validation.identity ?? item.identity ?? null;
  const warnings = [...validation.warnings];
  const warningCodes: FileOperationWarningCode[] = [];
  const errors = [...validation.errors];
  const errorCodes = getValidationErrorCodes(validation);

  if (validation.exists && validation.isValid) {
    if (isLikelyExternalVolume(validation.path)) {
      warnings.push('File appears to be on an external volume.');
      warningCodes.push('external-volume');
    }

    if (knownDirectories.length > 0 && !isInsideAnyDirectory(validation.path, knownDirectories)) {
      warnings.push('File is outside the latest audited roots and output folders.');
      warningCodes.push('outside-known-roots');
    }
  }

  const status = getPlanItemStatus({
    exists: validation.exists,
    errors,
    warnings
  });

  return {
    id: item.id ?? randomUUID(),
    operationType: 'trash',
    sourcePath: validation.path || item.sourcePath,
    fileName: sourceIdentity?.fileName ?? item.fileName ?? basename(item.sourcePath),
    expectedSizeBytes: item.expectedSizeBytes ?? item.identity?.sizeBytes ?? sourceIdentity?.sizeBytes ?? null,
    expectedModifiedAtMs:
      item.expectedModifiedAtMs ?? item.identity?.modifiedAtMs ?? sourceIdentity?.modifiedAtMs ?? null,
    allowUnsupportedFileType: item.allowUnsupportedFileType === true,
    sourceIdentity,
    status,
    warningCodes,
    warnings,
    errorCodes,
    errors
  };
}

async function executeTrashPlanItem(item: FileOperationPlanItem): Promise<FileOperationResultItem> {
  const startedAt = nowIsoString();
  const baseResult: Omit<FileOperationResultItem, 'status' | 'completedAt'> = {
    id: randomUUID(),
    planItemId: item.id,
    operationType: 'trash',
    sourcePath: item.sourcePath,
    fileName: item.fileName,
    startedAt,
    sourceBefore: item.sourceIdentity ?? null,
    warningCodes: [...item.warningCodes],
    warnings: [...item.warnings],
    errorCode: item.errorCodes[0] ?? null,
    error: item.errors[0] ?? null
  };

  if (item.status !== 'ready' && item.status !== 'warning') {
    return {
      ...baseResult,
      status: 'skipped',
      completedAt: nowIsoString(),
      errorCode: item.errorCodes[0] ?? 'operation-not-allowed',
      error: item.errors[0] ?? 'Item is blocked by the trash plan.'
    };
  }

  const revalidation = await validateKnownPath({
    id: item.id,
    path: item.sourcePath,
    expectedKind: 'file',
    expectedFileName: item.fileName,
    expectedSizeBytes: item.expectedSizeBytes ?? null,
    expectedModifiedAtMs: item.expectedModifiedAtMs ?? null,
    requireSupportedVideoExtension: item.allowUnsupportedFileType !== true
  });

  if (!revalidation.isValid) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      sourceBefore: revalidation.identity ?? item.sourceIdentity ?? null,
      errorCode: getValidationErrorCodes(revalidation)[0] ?? 'invalid-source-path',
      error: revalidation.errors[0] ?? 'File no longer matches the trash plan.'
    };
  }

  try {
    await shell.trashItem(item.sourcePath);
    const afterValidation = await validateKnownPath({
      id: item.id,
      path: item.sourcePath,
      expectedKind: 'file',
      expectedFileName: item.fileName,
      requireSupportedVideoExtension: item.allowUnsupportedFileType !== true
    });

    return {
      ...baseResult,
      status: 'success',
      completedAt: nowIsoString(),
      sourceBefore: revalidation.identity ?? item.sourceIdentity ?? null,
      sourceAfter: afterValidation.identity,
      errorCode: null,
      error: null
    };
  } catch (error: unknown) {
    return {
      ...baseResult,
      status: 'failed',
      completedAt: nowIsoString(),
      sourceBefore: revalidation.identity ?? item.sourceIdentity ?? null,
      errorCode: 'operation-not-allowed',
      error: error instanceof Error ? error.message : 'Unable to move file to Trash.'
    };
  }
}

function normalizeTrashPlanRequest(
  request: Partial<CreateTrashOperationPlanRequest> | null | undefined
): { ok: true; items: KnownFileOperationItem[]; knownDirectories: string[] } | { ok: false; message: string } {
  if (!request || typeof request !== 'object') {
    return {
      ok: false,
      message: 'Trash plan request is required.'
    };
  }

  if (!Array.isArray(request.items) || request.items.length === 0) {
    return {
      ok: false,
      message: 'Select at least one video before creating a trash plan.'
    };
  }

  const items = request.items.filter((item): item is KnownFileOperationItem =>
    Boolean(item) && typeof item === 'object' && typeof item.sourcePath === 'string'
  );

  if (items.length === 0) {
    return {
      ok: false,
      message: 'Trash plan must contain known file items.'
    };
  }

  return {
    ok: true,
    items,
    knownDirectories: [
      ...normalizeDirectoryList(request.knownRootDirectories),
      ...normalizeDirectoryList(request.knownOutputDirectories)
    ]
  };
}

function getValidationErrorCodes(validation: {
  exists: boolean;
  errors: string[];
}): FileOperationErrorCode[] {
  if (!validation.exists) {
    return ['missing-source'];
  }

  return validation.errors.map((error) => {
    if (error.includes('supported video')) {
      return 'unsupported-file';
    }

    if (error.includes('file')) {
      return 'invalid-source-path';
    }

    return 'operation-not-allowed';
  });
}

function getPlanItemStatus({
  exists,
  errors,
  warnings
}: {
  exists: boolean;
  errors: string[];
  warnings: string[];
}): FileOperationPlanItem['status'] {
  if (!exists) {
    return 'missing-source';
  }

  if (errors.some((error) => error.includes('supported video'))) {
    return 'unsupported-file';
  }

  if (errors.length > 0) {
    return 'invalid-path';
  }

  return warnings.length > 0 ? 'warning' : 'ready';
}

function summarizePlanItems(items: FileOperationPlanItem[]): TrashOperationPlan['summary'] {
  return {
    total: items.length,
    ready: items.filter((item) => item.status === 'ready').length,
    warning: items.filter((item) => item.status === 'warning').length,
    blocked: items.filter((item) => item.status !== 'ready' && item.status !== 'warning').length,
    totalSizeBytes: items.reduce((total, item) => total + (item.sourceIdentity?.sizeBytes ?? item.expectedSizeBytes ?? 0), 0)
  };
}

function getConfirmationReasons({
  items,
  summary
}: {
  items: FileOperationPlanItem[];
  summary: TrashOperationPlan['summary'];
}): string[] {
  const reasons: string[] = [];

  if (summary.total > 10) {
    reasons.push('More than 10 files are selected.');
  }

  if (summary.totalSizeBytes > TEN_GB_BYTES) {
    reasons.push('Selected files total more than 10 GB.');
  }

  if (items.some((item) => item.warnings.length > 0)) {
    reasons.push('One or more files has warnings.');
  }

  return reasons;
}

function summarizeResultItems(items: FileOperationResultItem[]): FileOperationResult['summary'] {
  return {
    total: items.length,
    pending: 0,
    running: 0,
    succeeded: items.filter((item) => item.status === 'success').length,
    skipped: items.filter((item) => item.status === 'skipped').length,
    failed: items.filter((item) => item.status === 'failed').length,
    totalSizeBytes: items.reduce((total, item) => total + (item.sourceBefore?.sizeBytes ?? 0), 0)
  };
}

function summarizeResultStatus(items: FileOperationResultItem[]): FileOperationResult['status'] {
  const succeeded = items.filter((item) => item.status === 'success').length;
  const failedOrSkipped = items.filter((item) => item.status === 'failed' || item.status === 'skipped').length;

  if (failedOrSkipped === 0) {
    return 'success';
  }

  return succeeded > 0 ? 'complete-with-failures' : 'failed';
}

function getTrashResultMessage(result: FileOperationResult): string {
  if (result.status === 'success') {
    return `${result.summary.succeeded.toLocaleString()} file(s) moved to Trash.`;
  }

  if (result.status === 'failed') {
    return 'No files were moved to Trash.';
  }

  return `${result.summary.succeeded.toLocaleString()} file(s) moved to Trash; ${(
    result.summary.failed + result.summary.skipped
  ).toLocaleString()} item(s) need attention.`;
}

function normalizeDirectoryList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter((value): value is string => typeof value === 'string' && isAbsolute(value));
}

function isInsideAnyDirectory(filePath: string, directories: string[]): boolean {
  return directories.some((directory) => {
    const relativePath = relative(directory, filePath);
    return relativePath === '' || (!relativePath.startsWith('..') && !relativePath.startsWith(sep));
  });
}

function isLikelyExternalVolume(filePath: string): boolean {
  return filePath.startsWith('/Volumes/');
}

function nowIsoString(): string {
  return new Date().toISOString();
}
